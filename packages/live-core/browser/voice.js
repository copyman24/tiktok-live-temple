// Browser side of speech, shared by every stage page. Plain ES module, no dependencies.
//
// createVoicePlayer: an ordered speech queue (from the classroom app)
//   - priority lines jump the queue; lines that waited longer than maxWaitMs are dropped (stale news)
//   - "|" splits a line into parts; "M:" / "F:" / "E:" picks a voice; "^" marks a louder shout
//   - a part that cannot start within 8 s, or runs 4 s past its length, is cancelled for good,
//     so a stuck download never makes the stage silent or plays over the next line
//   - onSpeaking(who | null) lets the stage animate the speaker or duck background music
//
// joinSpeakerElection: only ONE open stage page speaks (the most recently opened), so two OBS
// sources or a stray browser tab never play two voices over each other. The server side is
// createSpeakerElection in packages/live-core/src/speaker.js.

const PLAY_START_TIMEOUT_MS = 8000;
const OVERRUN_MS = 4000;

/**
 * @param {{
 *   urlOf: (part: { who: string, hype: boolean, text: string }, rate: number) => string,
 *   defaultWho?: string, maxWaitMs?: number, maxQueue?: number,
 *   onSpeaking?: (who: string | null) => void
 * }} options
 */
export function createVoicePlayer({ urlOf, defaultWho = 'F', maxWaitMs = 60_000, maxQueue = 30, onSpeaking = () => {} }) {
  let normal = [];
  let priority = [];
  let playing = false;
  let current = null;
  let lastSpokeAt = Date.now();

  const player = {
    enabled: true,
    rate: 1,
    volume: 1,

    /**
     * Queue a line. `done` runs when it finished, was dropped, or this page does not speak.
     * @param {string} text
     * @param {{ priority?: boolean, keep?: boolean, start?: () => void, done?: () => void, valid?: () => boolean }} [opts]
     */
    say(text, opts = {}) {
      const clean = String(text || '').trim();
      if (!player.enabled || !clean) {
        if (opts.start) setTimeout(opts.start, 0);
        if (opts.done) setTimeout(opts.done, 0);
        return;
      }
      const queue = opts.priority ? priority : normal;
      queue.push({ text: clean, at: Date.now(), ...opts });
      // priority lines: warm the server cache now so playback starts the moment it is their turn
      if (opts.priority) for (const part of parts(clean, defaultWho)) fetch(urlOf(part, player.rate)).catch(() => {});
      if (queue.length > maxQueue) queue.shift()?.done?.();
      void next();
    },

    /** Drop everything queued and cut the current line. */
    stop() {
      for (const line of [...normal, ...priority]) line.done?.();
      normal = [];
      priority = [];
      current?.cancel();
      current = null;
      playing = false;
    },

    get busy() { return playing || normal.length + priority.length > 0; },
    get waiting() { return normal.length; },
    get waitingPriority() { return priority.length; },
    quietForMs(now = Date.now()) { return player.busy ? 0 : now - lastSpokeAt; }
  };

  async function next() {
    if (playing) return;
    const now = Date.now();
    let line;
    while ((line = priority.shift() ?? normal.shift())) {
      if (line.valid && !line.valid()) { line.done?.(); continue; }
      if (line.keep || now - line.at < maxWaitMs) break;
      line.done?.();
    }
    if (!line) return;
    playing = true;
    line.start?.();
    try {
      for (const part of parts(line.text, defaultWho)) {
        onSpeaking(part.who);
        const handle = playPart(urlOf(part, player.rate), player.volume);
        current = handle;
        await handle.finished;
        if (current !== handle) break; // stop() while speaking
      }
    } finally {
      onSpeaking(null);
      line.done?.();
      current = null;
      playing = false;
      lastSpokeAt = Date.now();
      void next();
    }
  }

  return player;
}

/** "M: Trời ơi! | ^Hoan hô!" → [{ who: 'M', hype: false, text: 'Trời ơi!' }, { who: 'M', hype: true, text: 'Hoan hô!' }] */
export function parts(text, defaultWho = 'F') {
  let who = defaultWho;
  const out = [];
  for (let raw of String(text).split('|')) {
    raw = raw.trim();
    const speaker = /^(M|F|E):\s*/.exec(raw);
    if (speaker) {
      who = speaker[1];
      raw = raw.slice(speaker[0].length);
    }
    const t = raw.replace(/^\^+/, '');
    if (t) out.push({ who, hype: raw.startsWith('^'), text: t });
  }
  return out;
}

function playPart(url, volume) {
  const audio = new Audio(url);
  audio.volume = volume;
  let over = false;
  let resolveFinished;
  const finished = new Promise((resolve) => { resolveFinished = resolve; });
  let guard = setTimeout(finish, PLAY_START_TIMEOUT_MS);
  function finish() {
    if (over) return;
    over = true;
    clearTimeout(guard);
    audio.pause();
    if (!audio.ended) {
      audio.removeAttribute('src');
      audio.load(); // stop the download: a cancelled line must never start later
    }
    resolveFinished();
  }
  audio.onplaying = () => {
    if (over) { audio.pause(); return; }
    clearTimeout(guard);
    const ms = Number.isFinite(audio.duration) ? audio.duration * 1000 + OVERRUN_MS : 40_000;
    guard = setTimeout(finish, ms);
  };
  audio.onended = finish;
  audio.onerror = finish;
  // autoplay blocked: retry a few times rather than dropping the line
  const tryPlay = (left) => {
    if (over) return;
    audio.play().catch(() => (left > 0 && !over ? setTimeout(() => tryPlay(left - 1), 1500) : finish()));
  };
  tryPlay(4);
  return { finished, cancel: finish };
}

/**
 * Take part in "which stage speaks". Opens its own WebSocket to `/ws?role=stage` and calls
 * onChange(isSpeaker, stageCount) whenever the server picks a speaker. Reconnects by itself.
 * Pass `existing` to reuse a socket you already manage instead (call handleMessage on its messages).
 */
export function joinSpeakerElection({ path = '/ws?role=stage', onChange }) {
  let clientId = null;
  let socket = null;
  let closed = false;
  let retry = null;
  const handleMessage = (msg) => {
    if (msg?.method === 'stage.hello') clientId = msg.params?.clientId ?? null;
    if (msg?.method === 'stage.speaker') onChange(Boolean(clientId) && msg.params?.speakerId === clientId, Number(msg.params?.stages) || 0);
  };
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${proto}//${location.host}${path}`);
    socket.onmessage = (event) => { try { handleMessage(JSON.parse(event.data)); } catch {} };
    socket.onclose = () => { clientId = null; if (!closed) retry = setTimeout(connect, 3000); };
  }
  connect();
  return { close() { closed = true; clearTimeout(retry); socket?.close(); } };
}
