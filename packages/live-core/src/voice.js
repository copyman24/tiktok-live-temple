// Speech for every session: try engines in order, cache what worked, serve it over HTTP.
//
//   const voice = createVoiceService({ engines: [edgeEngine(), googleEngine()] });
//   app.get('/api/tts', voice.httpHandler((query) => ({ text: query.text, voiceName: 'vi-VN-HoaiMyNeural', lang: 'vi' })));
//
// Engines:
//   edgeEngine   Microsoft Edge neural voices (cloud). One request at a time, identical requests share
//                one call, and a throttled request (429) waits 2/5/10 s before giving up (classroom app).
//   googleEngine Google Translate voice (cloud), always in the requested language. Last resort.
//   zeroTtsEngine the local ZeroTTS worker (offline), Vietnamese only (prayer app).
// A fallback result is not cached, so the next request tries the better engine again.
import fs from 'node:fs/promises';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @typedef {{ text: string, voiceName?: string, lang?: 'vi' | 'en', rate?: number, hype?: boolean }} SpeechRequest
 * @typedef {{ audio: Buffer, contentType: string }} SpeechResult
 * @typedef {{ name: string, cacheable?: boolean, supports?: (req: SpeechRequest) => boolean, synth: (req: SpeechRequest) => Promise<SpeechResult> }} Engine
 */

/** @param {{ engines: Engine[], cacheSize?: number, log?: Pick<Console, 'warn'> }} options */
export function createVoiceService({ engines, cacheSize = 200, log = console }) {
  const cache = new Map();

  async function synthesize(request) {
    const req = normalize(request);
    if (!req.text) throw new Error('Thiếu nội dung cần đọc');
    const key = JSON.stringify([req.voiceName, req.lang, req.rate, req.hype, req.text]);
    const hit = cache.get(key);
    if (hit) return { ...hit, cached: true };
    const usable = engines.filter((engine) => !engine.supports || engine.supports(req));
    const errors = [];
    for (const [index, engine] of usable.entries()) {
      try {
        const result = await engine.synth(req);
        const out = { ...result, engine: engine.name, fallback: index > 0 };
        if (index === 0 && engine.cacheable !== false) {
          cache.set(key, out);
          if (cache.size > cacheSize) cache.delete(cache.keys().next().value);
        }
        if (index > 0) log.warn(`[giọng dự phòng] ${usable[0].name} lỗi, đọc bằng ${engine.name}: "${req.text.slice(0, 60)}" (${errors.join('; ')})`);
        return out;
      } catch (error) {
        errors.push(`${engine.name}: ${error?.message || error}`);
      }
    }
    throw new Error(`Không tạo được giọng đọc (${errors.join('; ') || 'không có engine phù hợp'})`);
  }

  /** Express handler: `toRequest(query)` maps the query string to a SpeechRequest (apps choose voices). */
  function httpHandler(toRequest) {
    return async (request, response) => {
      try {
        const req = toRequest(request.query || {});
        if (!req?.text) return response.status(400).send('Thiếu text');
        const result = await synthesize(req);
        response.setHeader('Content-Type', result.contentType);
        response.setHeader('Cache-Control', result.fallback ? 'no-store' : 'public, max-age=86400');
        response.send(result.audio);
      } catch (error) {
        log.warn(`[voice] ${error.message}`);
        response.status(500).json({ error: 'TTS failed' });
      }
    };
  }

  return { synthesize, httpHandler };
}

function normalize(req) {
  return {
    text: String(req?.text || '').trim().slice(0, 1500),
    voiceName: req?.voiceName || '',
    lang: req?.lang === 'en' ? 'en' : 'vi',
    rate: Math.min(1.5, Math.max(0.5, Number(req?.rate) || 1)),
    hype: Boolean(req?.hype)
  };
}

/** Microsoft Edge neural TTS. `MsEdgeTTS` is injectable for tests. */
export function edgeEngine({ pitch = '+0%', defaultVoice = 'vi-VN-HoaiMyNeural', retryDelays = [0, 2000, 5000, 10000], timeoutMs = 20_000, MsEdgeTTS, OUTPUT_FORMAT } = {}) {
  let chain = Promise.resolve();
  const running = new Map();
  let lib = MsEdgeTTS ? { MsEdgeTTS, OUTPUT_FORMAT } : null;

  async function once(req) {
    lib ??= await import('msedge-tts');
    const tts = new lib.MsEdgeTTS();
    try {
      await tts.setMetadata(req.voiceName || defaultVoice, lib.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(escapeXml(req.text), {
        rate: `${req.rate >= 1 ? '+' : ''}${Math.round((req.rate - 1) * 100)}%`,
        pitch,
        volume: req.hype ? '+40%' : '+0%'
      });
      const chunks = [];
      const read = (async () => { for await (const chunk of audioStream) chunks.push(chunk); })();
      let timer;
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Edge TTS timeout')), timeoutMs); });
      try { await Promise.race([read, timeout]); } finally { clearTimeout(timer); }
      if (!chunks.length) throw new Error('Edge TTS không trả âm thanh');
      return { audio: Buffer.concat(chunks), contentType: 'audio/mpeg' };
    } finally {
      tts.close();
    }
  }

  return {
    name: 'edge',
    synth(req) {
      const key = JSON.stringify([req.voiceName, req.rate, req.hype, req.text]);
      if (running.has(key)) return running.get(key);
      const job = chain.then(async () => {
        let last;
        for (const wait of retryDelays) {
          if (wait) await sleep(wait);
          try { return await once(req); } catch (error) { last = error; }
        }
        throw last;
      });
      chain = job.catch(() => {});
      running.set(key, job);
      job.finally(() => running.delete(key)).catch(() => {});
      return job;
    }
  };
}

/** Google Translate TTS in the request's language (never reads English with a Vietnamese voice). */
export function googleEngine({ fetchImpl = globalThis.fetch } = {}) {
  return {
    name: 'google',
    cacheable: false,
    async synth(req) {
      const parts = [];
      for (const chunk of splitText(req.text)) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${req.lang}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
        const response = await fetchImpl(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: 'https://translate.google.com/'
          }
        });
        if (!response.ok) throw new Error(`Google TTS lỗi ${response.status}`);
        parts.push(Buffer.from(await response.arrayBuffer()));
      }
      return { audio: Buffer.concat(parts), contentType: 'audio/mpeg' };
    }
  };
}

/** The local ZeroTTS worker (see zerotts.js). Vietnamese only; works with no internet. */
export function zeroTtsEngine(zeroTts, { voice = 'maichi' } = {}) {
  return {
    name: 'zerotts',
    supports: (req) => req.lang === 'vi',
    async synth(req) {
      const result = await zeroTts.synthesize(req.text, voice);
      if (!result?.ok || !result.file) throw new Error(result?.error || 'ZeroTTS không trả âm thanh');
      return { audio: await fs.readFile(result.file), contentType: 'audio/wav' };
    }
  };
}

export function splitText(text, max = 190) {
  const chunks = [];
  let rest = String(text).trim();
  while (rest.length > max) {
    const win = rest.slice(0, max + 1);
    let cut = Math.max(win.lastIndexOf('. '), win.lastIndexOf('! '), win.lastIndexOf('? '));
    if (cut < max / 2) cut = Math.max(win.lastIndexOf(', '), win.lastIndexOf('; '));
    if (cut < max / 2) cut = win.lastIndexOf(' ');
    if (cut <= 0) cut = max - 1;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
