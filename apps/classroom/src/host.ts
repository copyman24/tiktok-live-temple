// The classroom game, run on the server (it used to run inside the stage page, useGame.ts).
//
// Why: Studio reloads the OBS page when the operator switches sessions, and OBS reloads its
// sources on its own. With the game in the page, every reload restarted the lesson. Now the
// lesson lives here; pages only draw the latest view and play what the server says.
//
// Speech pacing is unchanged. The teacher's "main" lines (question, answer, summary) still stop
// the phase clock while she reads, and a question's board still appears only when she finishes
// reading it. The server sends each line to the ONE stage that speaks and waits for that stage to
// report `voice.started` / `voice.done`. With no speaking stage, or if a report never comes,
// lines finish after an estimated reading time so the lesson never stalls.
import { GAME } from './game/config';
import { Classroom, plain, type ClassView, type Life, type RecessGame, type Say } from './game/quiz';
import type { Question } from './game/questions';
import type { ShowBank, ShowKind } from './game/show';
import { NameBatcher } from './game/scoreboard';
import { GiftThanker, OncePerPerson } from './game/chatter';
import { speakableName } from './game/names';
import { cleanComment, containsBanned } from '../../../packages/live-core/src/text.js';
import { dayKey, weekKey } from '../../../packages/live-core/src/time.js';

export type Row = { username: string; nickname: string; points: number };
export type GiftShown = { username: string; nickname: string; giftName: string; giftId: string; diamondCount: number; repeatCount: number; avatar: string; at: number };
export type StageView = ClassView & {
  weekTop: Row[];
  todayTop: Row[];
  talkTop: Row[];
  /** for sound effects on the speaking stage */
  audio: { clockPhase: string; musicKind: ShowKind | null; musicLevel: number };
};

/** Normalized live-core events (see packages/live-core/src/tiktok.js). */
export type LiveEvent =
  | { kind: 'comment'; viewer: Viewer; text: string; sentAt: number }
  | { kind: 'like'; viewer: Viewer; count: number; totalLikes: number }
  | { kind: 'gift'; viewer: Viewer; name: string; giftId: string; count: number; coins: number }
  | { kind: 'follow' | 'share' | 'member'; viewer: Viewer };
type Viewer = { id: string; name: string; avatar: string };

export interface SpeechOut {
  /** Send a line to the speaking stage. Returns false when no stage can speak right now. */
  say(line: { id: string; text: string; priority: boolean }): boolean;
  stop(): void;
}

type Store = {
  collection(name: string): {
    get(key: string): any; set(key: string, value: unknown): unknown; delete(key: string): void;
    entries(): [string, any][]; clear(): void; withPrefix(prefix: string): [string, any][];
  };
  doc<T>(name: string, fallback: T): { get(): T; set(value: T): unknown; update(fn: (value: T) => T): unknown };
  transaction(fn: () => void): void;
};

type Pending = { main: boolean; showAfter: boolean; go: boolean; started: boolean; deadline: number };

const TICK_MS = 200;
const SAVE_EVERY_MS = 20_000;
const LIFE_KEYS = ['points', 'total', 'toan', 'su', 'meo', 'anh'] as const;

export function createClassroomHost({
  questions,
  showBank,
  store,
  speech,
  onView,
  now = Date.now,
  rand = Math.random,
  log = console,
}: {
  questions: Question[];
  showBank: ShowBank;
  store: Store;
  speech: SpeechOut;
  onView: (view: StageView) => void;
  now?: () => number;
  rand?: () => number;
  log?: Pick<Console, 'log' | 'warn'>;
}) {
  const used = store.collection('used');
  const banned = store.collection('banned');
  const weekScores = store.collection('weekScores');
  const todayScores = store.collection('todayScores');
  const todayTalk = store.collection('todayTalk');
  const life = store.collection('life');
  const attend = store.collection('attend');
  const report = store.collection('report');
  const meta = store.doc('meta', { week: weekKey(), day: dayKey(), flowers: 0, talkRoom: '' });

  rollCalendar();
  const room = new Classroom(
    questions,
    now(),
    rand,
    Object.fromEntries(used.entries().map(([id, at]) => [id, Number(at) || 0])),
    banned.entries().map(([id]) => id),
  );
  room.showBank = showBank;
  room.setFlowersSaved(meta.get().flowers);

  let weekTop = topOf(weekScores);
  let todayTop = topOf(todayScores);
  let talkTop = topOf(todayTalk);
  room.weekLeader = weekTop[0] ? speakableName(weekTop[0].nickname) : '';

  let lastGift: GiftShown | null = null;
  let dirty = true;
  let lastSent = 0;
  let lastTick = now();
  let pausedAt: number | null = null;
  let likeBase: number | null = null;
  let lineSeq = 0;
  let mainSpeaking = 0;
  let chatter: { text: string; priority: boolean; until: number }[] = [];
  const pending = new Map<string, Pending>();
  const timers: ReturnType<typeof setInterval>[] = [];

  const talk = {
    greeter: new NameBatcher(
      GAME.greetEveryMs,
      GAME.namesPerGreeting,
      (names: string[]) => say([room.greet(joinNames(names))]),
      () => chatter.length >= 2,
    ),
    gifts: new GiftThanker(GAME.giftThanksCooldownMs, GAME.bigGiftCoins),
    follows: new OncePerPerson(),
  };

  // ---------- speech ----------

  /** Rough reading time, used when no stage reports back (≈ 14 Vietnamese characters per second). */
  const estimateMs = (text: string) => 1200 + text.replace(/[|^]|[MFE]:/g, '').length * 72;

  function send(text: string, priority: boolean, flags: { main?: boolean; showAfter?: boolean; go?: boolean } = {}) {
    const id = `l${++lineSeq}`;
    const entry: Pending = { main: !!flags.main, showAfter: !!flags.showAfter, go: !!flags.go, started: false, deadline: 0 };
    if (entry.main) mainSpeaking++;
    pending.set(id, entry);
    const delivered = speech.say({ id, text, priority });
    // Nobody can hear it: run the line on an estimated timer so pacing stays natural.
    entry.deadline = now() + (delivered ? estimateMs(text) + 20_000 : estimateMs(text));
    if (!delivered) started(id);
  }

  function started(id: string) {
    const entry = pending.get(id);
    if (!entry || entry.started) return;
    entry.started = true;
    if (entry.go) { room.showBoard(); dirty = true; }
  }

  function finished(id: string) {
    const entry = pending.get(id);
    if (!entry) return;
    started(id);
    pending.delete(id);
    if (entry.main) mainSpeaking = Math.max(0, mainSpeaking - 1);
    if (entry.showAfter) room.showBoard();
    dirty = true;
  }

  function say(lines: Say[]) {
    const t = now();
    for (const l of lines) {
      if (l.main) send(l.text, true, { main: true, showAfter: l.showAfter, go: l.go });
      else if (l.warn) send(l.text, true); // "sắp hết giờ": jumps the queue, the clock keeps running
      else chatter.push({ text: l.text, priority: !!l.priority, until: t + (l.ttl ?? (l.priority ? GAME.giftLineMaxWaitMs : GAME.chatterMaxWaitMs)) });
    }
    dirty = true;
  }

  /** Release one side line (greeting, thanks, teasing) when the lesson has room for it. */
  function flushChatter(t: number) {
    chatter = chatter.filter((c) => c.until > t);
    if (pending.size > 0 || mainSpeaking > 0 || !room.chatterWindow(t)) return;
    const p = chatter.findIndex((c) => c.priority);
    const i = p >= 0 ? p : room.chatterAllowed(false) ? 0 : -1;
    if (i < 0) return;
    const next = chatter.splice(i, 1)[0];
    if (!next) return;
    if (!next.priority) room.chatterUsed++;
    send(next.text, false);
  }

  function stopSpeech() {
    speech.stop();
    for (const id of [...pending.keys()]) finished(id);
    chatter = [];
  }

  // ---------- people ----------

  const person = (v: Viewer) => {
    const nickname = containsBanned(v.name) ? v.id : v.name;
    return { username: v.id, nickname, spoken: speakableName(nickname), avatar: v.avatar };
  };

  /** Attendance streak in Vietnam days (from the classroom app's /api/game/attend). */
  function markAttendance(username: string, nickname: string) {
    const today = dayKey(new Date(now()));
    const yesterday = dayKey(new Date(now() - 86_400_000));
    const cur = attend.get(username) ?? { nickname: '', last: '', streak: 0, total: 0 };
    if (cur.last !== today) {
      cur.streak = cur.last === yesterday ? cur.streak + 1 : 1;
      cur.total++;
      cur.last = today;
    }
    cur.nickname = String(nickname || cur.nickname).slice(0, 60);
    attend.set(username, cur);
    const { nickname: _n, ...lifeRow } = life.get(username) ?? { nickname: '', points: 0, total: 0, toan: 0, su: 0, meo: 0, anh: 0 };
    return { days: cur.streak as number, life: lifeRow as Life };
  }

  // ---------- live events ----------

  function onLive(event: LiveEvent) {
    if (pausedAt !== null) return;
    const t = now();
    if (event.kind === 'comment') {
      const { text, safe } = cleanComment(event.text);
      if (!text) return;
      const p = person(event.viewer);
      const isNew = !room.students.has(p.username);
      say(room.chat({ ...p, comment: text, createTime: event.sentAt || t, safe }, t));
      if (isNew && p.spoken !== 'bạn' && GAME.joinKeywords.includes(plain(text))) talk.greeter.add(p.username, p.spoken);
      if (isNew) {
        const a = markAttendance(p.username, p.nickname);
        say(room.attendance(p, a.days, t, a.life));
      }
    } else if (event.kind === 'gift') {
      const p = person(event.viewer);
      const count = Math.max(1, event.count);
      lastGift = { username: p.username, nickname: p.nickname, giftName: event.name, giftId: event.giftId, diamondCount: Math.round(event.coins / count), repeatCount: count, avatar: p.avatar, at: t };
      const hint = room.gift(p, event.coins, t, count, event.name);
      say(hint);
      if (!hint.length && talk.gifts.shouldThank(p.username, event.coins, chatter.filter((c) => c.priority).length)) say([room.thank(p, event.name, event.coins)]);
    } else if (event.kind === 'follow') {
      const p = person(event.viewer);
      if (talk.follows.first(p.username)) say([room.follow(p)]);
    } else if (event.kind === 'like') {
      if (likeBase === null) likeBase = event.totalLikes - event.count;
      const reached = (event.totalLikes - likeBase) * GAME.heartBoost >= GAME.likesPerClap;
      if (reached) likeBase = event.totalLikes;
      say(room.like(event.count, t, reached));
    }
    dirty = true;
  }

  /** A new TikTok broadcast (room id changed): the interaction leaderboard starts over. */
  function onRoom(roomId: string | null) {
    if (!roomId) return;
    rollCalendar();
    if (meta.get().talkRoom === roomId) return;
    meta.update((m) => ({ ...m, talkRoom: roomId }));
    todayTalk.clear();
    room.talkDelta.clear();
    talkTop = [];
    log.log(`[Lớp học] phiên live mới ${roomId}: làm lại Top tương tác`);
  }

  // ---------- operator commands ----------

  function control(action: string, text = ''): void {
    const t = now();
    if (action === 'speak' && text.trim()) send(text.trim(), true);
    else if (action === 'reset' || action === 'newRound') { stopSpeech(); say(room.newRound(t)); }
    else if (action === 'skip') say(room.skip(t));
    else if (action === 'ban') say(room.banCurrent(t));
    else if (action === 'goodbye') say(room.goodbye(t));
    else if (action === 'birthday') {
      const name = text.trim().slice(0, 40);
      if (!name) return;
      const s = [...room.students.values()].find((x) => x.nickname.toLowerCase() === name.toLowerCase());
      say(room.celebrate(s ?? person({ id: `kenh:${name}`, name, avatar: '' }), t));
    } else if (action === 'recess') say(room.forceRecess(text as RecessGame, t));
    else if (action === 'show') say(room.forceShow(text as ShowKind, t));
    else throw Object.assign(new Error(`Lệnh không hợp lệ: ${action}`), { code: -32602 });
    dirty = true;
  }

  // ---------- loop, view, persistence ----------

  function tick() {
    if (pausedAt !== null) return;
    const t = now();
    for (const [id, entry] of pending) if (t >= entry.deadline) finished(id); // stage never reported
    if (mainSpeaking > 0) { room.hold(t - lastTick); dirty = true; }
    lastTick = t;
    say(room.tick(t));
    flushChatter(t);
    if (!dirty && t - lastSent < 1000) return;
    dirty = false;
    lastSent = t;
    onView(view(t));
  }

  function view(t = now()): StageView {
    const show = room.show;
    const step = show?.steps[show.i]?.k;
    const busy = mainSpeaking > 0;
    const musicLevel = !show || busy ? 0 : room.showAsking() ? (room.phaseEndsAt - t <= 5000 ? 2 : 1) : step === 'gather' || step === 'honor' ? 1 : 0;
    return {
      ...room.view(t),
      weekTop,
      todayTop: merge(todayTop, room.weekDelta),
      talkTop: merge(talkTop, room.talkDelta),
      audio: { clockPhase: room.showAsking() ? 'question' : room.phase, musicKind: show?.kind ?? null, musicLevel },
    };
  }

  function save() {
    rollCalendar();
    const t = now();
    const usedIds = room.usedLog.splice(0);
    const week = [...room.weekDelta];
    room.weekDelta.clear();
    const bans = room.banLog.splice(0);
    const rows = room.reportLog.splice(0);
    const lifeRows = [...room.lifeDelta];
    room.lifeDelta.clear();
    const talkRows = [...room.talkDelta];
    room.talkDelta.clear();
    const flowers = room.flowerDelta;
    room.flowerDelta = 0;
    store.transaction(() => {
      for (const id of usedIds) used.set(id, t);
      for (const [username, v] of week) {
        const pts = Math.max(0, Math.min(1000, Math.round(v.points)));
        addPoints(weekScores, username, v.nickname, pts);
        addPoints(todayScores, username, v.nickname, pts);
      }
      for (const [username, v] of talkRows) addPoints(todayTalk, username, v.nickname, Math.max(0, Math.round(v.points)));
      for (const [username, v] of lifeRows) {
        const cur = life.get(username) ?? { nickname: '', points: 0, total: 0, toan: 0, su: 0, meo: 0, anh: 0 };
        cur.nickname = String(v.nickname || cur.nickname).slice(0, 60);
        for (const k of LIFE_KEYS) cur[k] += Math.max(0, Math.round(Number((v as any)[k]) || 0));
        life.set(username, cur);
      }
      for (const b of bans) banned.set(b.id, { answer: String(b.answer ?? '').slice(0, 60), clue: String(b.clue ?? '').slice(0, 300), at: t });
      for (const r of rows) report.set(`${dayKey(new Date(r.at || t))}|${String(r.at || t).padStart(14, '0')}|${r.id}`, r);
      if (flowers > 0) meta.update((m) => ({ ...m, flowers: m.flowers + flowers }));
    });
    weekTop = topOf(weekScores);
    todayTop = topOf(todayScores);
    talkTop = topOf(todayTalk);
    room.setFlowersSaved(meta.get().flowers);
    room.weekLeader = weekTop[0] ? speakableName(weekTop[0].nickname) : '';
  }

  /** New week or new day (Vietnam time): clear the boards that belong to the old one. */
  function rollCalendar() {
    const m = meta.get();
    const week = weekKey(new Date(now()));
    const day = dayKey(new Date(now()));
    if (m.week !== week) weekScores.clear();
    if (m.day !== day) { todayScores.clear(); todayTalk.clear(); }
    if (m.week !== week || m.day !== day) meta.set({ ...m, week, day, flowers: m.day === day ? m.flowers : 0 });
  }

  return {
    start() {
      say(room.newRound(now()));
      timers.push(setInterval(tick, TICK_MS), setInterval(() => pausedAt === null && say([room.share()]), GAME.shareReminderEveryMs), setInterval(save, SAVE_EVERY_MS));
      for (const timer of timers) (timer as any).unref?.();
    },
    /** Studio switched away: freeze the lesson (timers shift by the paused time on resume). */
    pause() {
      if (pausedAt !== null) return;
      pausedAt = now();
      stopSpeech();
      save();
    },
    resume() {
      if (pausedAt === null) return;
      room.hold(now() - pausedAt);
      pausedAt = null;
      lastTick = now();
      dirty = true;
    },
    stop() {
      for (const timer of timers) clearInterval(timer);
      timers.length = 0;
      save();
    },
    onLive,
    onRoom,
    control,
    voiceStarted: started,
    voiceDone: finished,
    /** The speaking stage went away: its queued lines will never report. */
    speakerLost: () => { for (const id of [...pending.keys()]) finished(id); },
    view: () => view(),
    lastGift: () => lastGift,
    phase: () => room.phase,
    save,
    // for tests and the report page
    room,
    reportRows: (day: string) => report.withPrefix(`${day}|`).map(([, r]) => r),
    attendance: () => attend.entries(),
    todayScores: () => topOf(todayScores, 15),
    bannedList: () => banned.entries(),
  };
}

function topOf(c: { entries(): [string, any][] }, n = 10): Row[] {
  return c.entries()
    .map(([username, v]) => ({ username, nickname: String(v.nickname || ''), points: Number(v.points) || 0 }))
    .sort((a, b) => b.points - a.points)
    .slice(0, n);
}

function addPoints(c: { get(k: string): any; set(k: string, v: unknown): unknown }, key: string, nickname: string, points: number) {
  const cur = c.get(key) ?? { nickname: '', points: 0 };
  c.set(key, { nickname: String(nickname || cur.nickname).slice(0, 60), points: cur.points + points });
}

/** Saved board + points scored since the last save, so the stage updates at once. */
function merge(saved: Row[], pending: Map<string, { nickname: string; points: number }>): Row[] {
  const all = new Map(saved.map((r) => [r.username, { ...r }]));
  for (const [username, p] of pending) {
    const cur = all.get(username) ?? { username, nickname: p.nickname, points: 0 };
    cur.points += p.points;
    cur.nickname = p.nickname || cur.nickname;
    all.set(username, cur);
  }
  return [...all.values()].sort((a, b) => b.points - a.points).slice(0, 5);
}

// ['An', 'Bình', 'Chi'] -> 'bạn An, bạn Bình và bạn Chi'
function joinNames(names: string[]) {
  const spoken = names.map((n) => `bạn ${n}`);
  return spoken.length > 1 ? `${spoken.slice(0, -1).join(', ')} và ${spoken[spoken.length - 1]}` : spoken[0] ?? '';
}
