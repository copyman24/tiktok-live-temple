import { GAME } from './config';
import { LINES, PICK_TOPICS, POLLS, REWARDS, type Poll } from './loi-thoai';
import { SLOTS, type Question, type Slot } from './questions';
import { makeMath, type MathLevel } from './math';
import { LETTERS, choiceOf, type CodeQ, type McLevel, type McQ, type ShowBank, type ShowKind } from './show';

// ---------- 2 game lớn (bản riêng cô Ngân) ----------
type ShowTag = 'warm' | 'storm' | 'peak' | 'hold' | 'rescue' | 'final' | 'bell' | 'tie';
type ShowStep =
  | { k: 'gather' }
  | { k: 'section'; key: SectionKey }
  | { k: 'mc'; level: McLevel; sec: number; pts: number; tag: ShowTag }
  | { k: 'stake' }
  | { k: 'code'; hint: number } // 0..2 gợi ý, 3 = cứu trợ
  | { k: 'codeReveal' }
  | { k: 'honor' };
type SectionKey = 'evWarm' | 'evCode' | 'evStorm' | 'evPeak' | 'chWarm' | 'chHold' | 'chRescue' | 'chFinal' | 'chBell' | 'showTie';
/** tên phần chơi hiện trên bảng */
export const SECTION_TITLE: Record<SectionKey, string> = {
  evWarm: '👣 Bước chân đầu tiên',
  evCode: '🔐 Mật mã trạm',
  evStorm: '🌪️ Bão tốc độ',
  evPeak: '🏔️ Chạm đỉnh',
  chWarm: '🔥 Làm nóng',
  chHold: '💪 Trụ vững',
  chRescue: '🤝 Cứu trợ cả phòng',
  chFinal: '⚡ Thử thách cuối',
  chBell: '🔔 Câu Chuông Đồng',
  showTie: '⚖️ Phân định đỉnh cao',
};
export const SHOW_NAME: Record<ShowKind, string> = { everest: 'Đường lên đỉnh Everest', chuong: 'Rung Chuông Đồng' };
/** danh hiệu sau game: [hạng nhất, top 10, người cứu trợ] */
const SHOW_TITLES: Record<ShowKind, [string, string, string]> = {
  everest: ['🚩 Người chạm đỉnh Everest', '⛰️ Đội leo núi', '🧭 Người dẫn đường'],
  chuong: ['🔔 Người giữ chuông', '💪 Người chơi bền bỉ', '🤝 Người tiếp sức'],
};
interface ShowState {
  kind: ShowKind;
  steps: ShowStep[];
  i: number;
  stage: 'ask' | 'reveal';
  qNo: number;
  scores: Map<string, number>;
  tieWin: Set<string>; // đúng câu phụ: xếp trên người đồng điểm
  players: Set<string>;
  mc: { q: McQ; opts: string[]; ans: number; tag: ShowTag; pts: number } | null;
  answers: Map<string, number>;
  removed: number[]; // phiếu gợi ý: 2 đáp án sai bị bỏ
  ticketUser: string;
  stakes: Map<string, number>;
  tickets: Set<string>;
  code: CodeQ | null;
  codeTried: Set<string>;
  codeSolvers: { username: string; pts: number; hint: number }[];
  tied: string[];
  bellRingers: string[];
  helpers: string[];
  honors: { username: string; nickname: string; score: number; title: string }[];
  used: Set<string>;
  lastRight: number; // số bạn đúng câu vừa rồi
}

/**
 * Lõi game Lớp Học Chữ: không đụng React, không đụng giọng đọc, chạy theo đồng hồ truyền vào.
 * Trang stage gọi chat/gift/like/tick rồi đọc các câu trả về; test ở quiz.check.ts.
 *
 * Một vòng: intro → 20 câu, có 4 câu toán (question → [bonus] → reveal) → results → recess (giờ ra chơi) → intro ...
 */

export type Phase = 'team' | 'intro' | 'question' | 'bonus' | 'reveal' | 'praise' | 'results' | 'recess' | 'show' | 'vote';

/** "tổ 2", "to2", "t2", "2", "tổ hai" -> 2; không phải chọn tổ thì 0 */
const TEAM_WORDS: Record<string, number> = { mot: 1, hai: 2, ba: 3, bon: 4 };
export function teamOf(comment: string): number {
  const m = /^(?:to|t)?(\d|mot|hai|ba|bon)$/.exec(plain(comment));
  const n = m ? (TEAM_WORDS[m[1]] ?? Number(m[1])) : 0;
  return n >= 1 && n <= GAME.teamCount ? n : 0;
}

/** Số câu chữ thường trong 1 tiết (không phải toán, không phải câu có chỗ riêng) */
const PLAIN_SLOTS = GAME.roundPlan.filter((d) => !d.startsWith('math') && !(SLOTS as readonly string[]).includes(d)).length;

/** Bậc bó hoa theo số xu của món quà (GAME.giftTiers): 0 bông hoa, 1 bó nhỏ, 2 bó lớn, 3 xe hoa */
/** Quà có trong bảng "Gửi tặng cô" (GAME.giftMenu) thì lấy tên đọc + icon riêng, không thì null */
export function giftOf(giftName = '') {
  const n = giftName.toLowerCase();
  return GAME.giftMenu.find((g) => g.match.some((m) => n.includes(m))) ?? null;
}

export function tierOf(coins: number) {
  let t = 0;
  GAME.giftTiers.forEach((g, i) => {
    if (coins >= g.min) t = i;
  });
  return t;
}

/** Học bạ cả đời (server lưu): điểm, số câu đúng từng loại -> lên lớp, huy hiệu */
export interface Life {
  points: number;
  total: number; // tổng câu trả lời đúng
  toan: number;
  su: number;
  meo: number;
  anh: number;
}
export const emptyLife = (): Life => ({ points: 0, total: 0, toan: 0, su: 0, meo: 0, anh: 0 });
/** Lớp mấy theo điểm cả đời: 1..12, 13 = tốt nghiệp (mốc ở GAME.gradePoints) */
export function gradeOf(points: number) {
  let g = 1;
  GAME.gradePoints.forEach((p, i) => {
    if (points >= p) g = i + 1;
  });
  return g;
}
export const gradeLabel = (g: number) => (g > 12 ? 'tốt nghiệp' : `lớp ${g}`);
/** Huy hiệu: đúng đủ số câu từng loại */
export const BADGES = [
  { key: 'toan', need: 50, icon: '🧮', name: 'Thần đồng toán' },
  { key: 'su', need: 30, icon: '📜', name: 'Sử gia nhí' },
  { key: 'meo', need: 30, icon: '🤪', name: 'Vua đố mẹo' },
  { key: 'anh', need: 30, icon: '🔤', name: 'Siêu tiếng Anh' },
  { key: 'total', need: 300, icon: '⭐', name: 'Học sinh chăm chỉ' },
] as const;
export const badgesOf = (l: Life) => BADGES.filter((b) => l[b.key] >= b.need);

/** 1 dòng báo cáo sau buổi live: câu nào khó quá / dễ quá */
export interface ReportRow {
  id: string;
  answer: string;
  category: string;
  attempts: number; // số bạn trả lời (đúng + sai)
  correct: number;
  at: number;
}
export type RecessGame = 'rps' | 'callup' | 'pick' | 'roll' | 'heart';
type RecessStage = 'play' | 'result' | 'board';

export interface Student {
  username: string;
  nickname: string; // đã lọc từ cấm
  spoken: string; // tên để đọc
  avatar: string;
  girl: boolean;
  score: number; // điểm tiết này (xếp chỗ ngồi, xoá khi sang tiết mới)
  session: number; // điểm cả buổi live (lớp trưởng, lớp phó)
  reachedAt: number; // lúc đạt điểm hiện tại (hòa điểm: ai đạt trước xếp trên)
  streak: number;
  lastActive: number;
  joinedAt: number;
  desk: DeskGift[]; // quà cô thưởng đặt trên bàn (xoá khi sang tiết mới)
  days: number; // chuyên cần: số ngày đi học liền (server báo về, 0 = chưa biết)
  bubble?: { text: string; at: number }; // bình luận gần nhất hiện thành bong bóng trên đầu
  standLeft: number; // gõ sai bị phạt lên đứng cạnh cô (học sinh cá biệt): còn đứng chừng này câu nữa
  team: number; // tổ 1..4 (0 = chưa có tổ, chỉ trong lúc đang chọn tổ)
  life: Life; // học bạ cả đời (server gửi về lúc vào lớp, cộng dồn trong buổi)
  lastTalkAt?: number; // lần cuối được tính 1 tương tác (chống gõ dồn)
}

export interface DeskGift {
  icon: string;
  at: number; // lúc cô tặng (để vẽ quà bay xuống bàn)
}

export interface Answerer {
  username: string;
  nickname: string;
  avatar: string;
  createTime: number; // giờ TikTok gắn lúc người xem gửi comment
  seq: number; // thứ tự bot nhận (phụ khi trùng giờ)
  points: number;
}

export interface Say {
  text: string;
  priority?: boolean;
  /** câu chính (đọc đề, đáp án, tổng kết, ra chơi): chen lên đọc trước, câu nói thêm còn chờ thì bỏ */
  main?: boolean;
  /** câu nói thêm: quá chừng này ms chưa tới lúc nói thì bỏ (mặc định GAME.chatterMaxWaitMs) */
  ttl?: number;
  /** nhắc sắp hết giờ: nói liền nhưng KHÔNG dừng đồng hồ */
  warn?: boolean;
  /** câu cô hô bắt đầu: lúc bắt đầu đọc câu này thì hiện bảng chữ (gọi showBoard) */
  go?: boolean;
  /** chế độ nhanh: đọc XONG câu này (câu đề) thì hiện bảng chữ */
  showAfter?: boolean;
}

export interface ChatIn {
  username: string;
  nickname: string;
  spoken: string;
  avatar: string;
  comment: string;
  createTime: number;
  /** false: bình luận có từ cấm, không hiện bong bóng */
  safe?: boolean;
}

type Person = Pick<ChatIn, 'username' | 'nickname' | 'spoken' | 'avatar'>;

// Dấu thanh kiểu cũ/mới ("hóa"/"hoá", "thủy"/"thuỷ") coi là một: đưa về kiểu mới (dấu trên chữ sau) ở cuối từ
const OLD_OA = /o([̣̀́̃̉])([ae])(?!\p{L})/gu;
const OLD_UY = /u([̣̀́̃̉])y(?!\p{L})/gu;
export const normVi = (s: string) =>
  s.normalize('NFD').toLowerCase().replace(OLD_OA, 'o$2$1').replace(OLD_UY, 'uy$1').normalize('NFC');
// Thường hoá: chuẩn Unicode, chữ thường, bỏ khoảng trắng và dấu câu, GIỮ dấu tiếng Việt
export const compactVi = (s: string) => normVi(s).replace(/[^\p{L}\p{N}]/gu, '');
// Bỏ cả dấu: "Vào Lớp" -> "vaolop"
export const plain = (s: string) =>
  compactVi(s).normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');

/** Buổi trong ngày theo giờ máy: sáng 5-10h, trưa 10-13h, chiều 13-17h, tối 17-22h, khuya 22-5h */
export type DayPeriod = 'sang' | 'trua' | 'chieu' | 'toi' | 'khuya';
export function dayPeriod(now: number): DayPeriod {
  const h = new Date(now).getHours();
  return h >= 5 && h < 10 ? 'sang' : h >= 10 && h < 13 ? 'trua' : h >= 13 && h < 17 ? 'chieu' : h >= 17 && h < 22 ? 'toi' : 'khuya';
}
const PERIOD_LINES = { sang: 'timeMorning', trua: 'timeNoon', chieu: 'timeAfternoon', toi: 'timeEvening', khuya: 'timeNight' } as const;

/** Tên chủ đề gọn để hiện và đọc: bỏ phần trong ngoặc, vd "Ca dao, thành ngữ (điền từ còn thiếu)" -> "Ca dao, thành ngữ" */
export const topicName = (category: string) => category.replace(/\s*\(.*\)\s*$/, '');

/** Bình luận báo sinh nhật của chính mình ("hôm nay sinh nhật con"), không tính câu chúc người khác ("chúc mừng sinh nhật") */
export function isBirthday(comment: string) {
  const p = plain(comment);
  return p.includes('sinhnhat') && !p.includes('chuc') && !p.includes('mung');
}

/** Điểm theo thứ hạng trả lời đúng (0 = nhanh nhất) */
export function pointsForRank(rank: number) {
  return GAME.rankPoints[rank] ?? GAME.latePoints;
}

/** Xáo chữ cái của đáp án (bỏ khoảng trắng), chắc chắn khác thứ tự gốc nếu được */
export function scramble(answer: string, rand = Math.random): string[] {
  const letters = [...answer.normalize('NFC').toUpperCase().replace(/\s+/g, '')];
  if (new Set(letters).size < 2) return letters;
  let out = letters;
  for (let tries = 0; tries < 10 && out.join('') === letters.join(''); tries++) {
    out = [...letters];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}

const hash = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
};

/** Bốc câu thoại kiểu xáo bài: đọc hết cả nhóm mới lặp, và không lặp ngay câu vừa đọc */
export class LineBag {
  private left = new Map<string, number[]>();
  private last = new Map<string, number>();
  constructor(private rand = Math.random) {}
  pick<T>(key: string, list: T[]): T {
    let pool = this.left.get(key);
    if (!pool || pool.length === 0) {
      pool = list.map((_, i) => i);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      if (pool.length > 1 && pool[pool.length - 1] === this.last.get(key)) pool.unshift(pool.pop()!);
      this.left.set(key, pool);
    }
    const i = pool.pop()!;
    this.last.set(key, i);
    return list[i];
  }
}

const RPS = { bua: 'búa', keo: 'kéo', bao: 'bao' } as const;
type Rps = keyof typeof RPS;
const BEATS: Record<Rps, Rps> = { bua: 'keo', keo: 'bao', bao: 'bua' };
const RECESS_GAMES: RecessGame[] = ['rps', 'callup', 'pick', 'roll', 'heart'];

interface Recess {
  game: RecessGame;
  stage: RecessStage;
  rps: Map<string, Rps>;
  teacher: Rps | null;
  callTarget: Student | null;
  callQ: Question | null;
  callTiles: string[];
  callResult: '' | 'right' | 'wrong' | 'silent';
  pick: [string, string];
  votes: Map<string, 1 | 2>;
  roll: Answerer[];
  hearts: number;
}

export class Classroom {
  phase: Phase = 'intro';
  round = 0; // gọi newRound() để vào tiết 1
  qNo = 0; // câu thứ mấy trong tiết (1..questionsPerRound)
  phaseStartedAt: number;
  phaseEndsAt: number;
  students = new Map<string, Student>();

  private roundQs: Question[] = [];
  q: Question | null = null;
  tiles: string[] = [];
  revealed = new Set<number>(); // vị trí chữ đã mở (tính trên đáp án bỏ khoảng trắng)
  private bonusUsed = false;
  private quietSaid = false;
  correct: Answerer[] = [];
  private tried = new Set<string>(); // ai đã trả lời câu này (đúng hay sai)
  private wrong = new Set<string>();
  private seq = 0;
  stats = { received: 0, attempts: 0 };
  flowers = 0;
  lastFlowerAt = 0;
  clapUntil = 0;
  private lastChatAt: number;
  /** lần cuối có người xem làm gì (bình luận, tặng quà, thả tim): lâu quá thì coi là lớp vắng */
  private lastSeenAt: number;
  /** tiết ôn bài: lớp vắng nên hỏi lại câu cũ, để dành câu mới */
  review = false;
  private lastPeriod = '';
  private lastIdleAt = 0;
  private monitor = ''; // lớp trưởng hiện tại: điểm tiết này cao nhất (mỗi tiết tranh lại từ đầu)
  /** lớp trưởng các tiết đã xong (mới nhất trước), hiện ở bảng giờ ra chơi */
  champions: { round: number; username: string; nickname: string; score: number }[] = [];
  recess: Recess | null = null;
  private lastRecess: RecessGame | null = null;

  /** id câu vừa dùng, trang stage gửi lên server để buổi sau không hỏi lại sớm */
  usedLog: string[] = [];
  /** điểm cộng thêm cho bảng vàng tuần, trang stage gửi lên server rồi xoá */
  weekDelta = new Map<string, { nickname: string; points: number }>();
  /** tên người nhất bảng vàng tuần (server báo về), cô đọc thỉnh thoảng */
  weekLeader = '';
  /** câu chủ kênh bấm "Bỏ câu này": không bao giờ hỏi lại; banLog gửi lên server rồi xoá */
  private banned: Set<string>;
  banLog: { id: string; answer: string; clue: string }[] = [];
  /** báo cáo từng câu đã hỏi, gửi lên server rồi xoá */
  reportLog: ReportRow[] = [];
  /** bình chọn chủ đề tiết sau (pha 'vote') và chủ đề cả lớp đã chọn cho tiết này */
  vote: { topics: [string, string]; votes: Map<string, 1 | 2> } | null = null;
  topic = '';
  private lastTopics: string[] = [];
  /** chúc mừng sinh nhật: ai đã được chúc (mỗi người 1 lần mỗi buổi) và biểu ngữ đang hiện */
  private birthdayDone = new Set<string>();
  private lastBirthdayAt = -Infinity;
  birthday: { nickname: string; at: number } | null = null;
  /** chủ kênh bấm "Chào tạm biệt" lúc chuẩn bị xuống live */
  goodbyeAt = 0;
  /** "Ai yêu cô thì gõ số 1": đang đếm ai gõ (trong GAME.loveWindowMs) */
  love: { at: number; fans: string[] } | null = null;
  /** bình chọn vui ("miền Bắc gõ B, miền Nam gõ N"): đang đếm phiếu */
  poll: { at: number; opts: Poll['opts']; votes: Map<string, string> } | null = null;
  private lastLoveAt: number;
  private engageNo = 0;
  /** bạn nhỏ đang đi lên bục tặng hoa cô (mỗi lúc 1 bạn), tier = bậc bó hoa (0 bông, 1 bó nhỏ, 2 bó lớn, 3 xe hoa) */
  walk: { username: string; at: number; tier: number; icon: string } | null = null;
  /** quỹ hoa hôm nay (số bông, xem flowersToday) và phần mới chưa gửi lên server */
  private flowerBase = 0;
  flowerDelta = 0;
  /** vừa đạt mốc quỹ hoa (biểu ngữ + pháo hoa) */
  fundParty: { goal: number; at: number } | null = null;
  /** quà cô nhận trong buổi, đặt trên bàn sau lưng cô: bậc từng món (giữ GAME.giftPileMax món mới nhất) */
  giftPile: { tier: number; icon: string }[] = [];
  /** số tiết mỗi tổ thắng (cờ thi đua), vị trí 0 = tổ 1 */
  teamWins: number[] = Array(GAME.teamCount).fill(0);
  /** tổ thắng tiết vừa xong (hiện ở bảng tổng kết) */
  lastTeamWin: number[] = [];
  private teamReminded = false;
  /** bộ câu 2 game lớn (useGame nạp từ cau-hoi-show/) và game đang chơi */
  showBank: ShowBank = { mc: [], codes: [] };
  show: ShowState | null = null;
  private showNo = 0;
  /** trang phục cô Ngân tiết này (đổi ngẫu nhiên khi hết 20 câu); đang chơi game lớn thì mặc bộ của game */
  outfit: (typeof GAME.outfits)[number] = 'trang';
  /** danh hiệu nhận trong buổi từ 2 game lớn (hiện icon trên bảng tên) */
  titles = new Map<string, string[]>();
  /** học bạ cả đời: phần cộng thêm chờ gửi lên server (điểm, câu đúng từng loại) */
  lifeDelta = new Map<string, { nickname: string } & Life>();
  /** tương tác hôm nay (1 bình luận = 1, 1 quà = 10, không nói ra): chờ gửi lên server */
  talkDelta = new Map<string, { nickname: string; points: number }>();
  /** câu chúc mừng lên lớp / huy hiệu mới: nói ở nhịp kế tiếp */
  private announce: Say[] = [];
  private cardAt = new Map<string, number>();
  private lastCardAt = -Infinity;

  readonly lines: LineBag;

  constructor(
    private bank: Question[],
    now: number,
    private rand = Math.random,
    private history: Record<string, number> = {}, // id câu -> lần hỏi gần nhất (ms)
    banned: Iterable<string> = [],
  ) {
    this.banned = new Set(banned);
    this.lines = new LineBag(rand);
    this.phaseStartedAt = now;
    this.phaseEndsAt = now + GAME.introSec * 1000;
    this.lastChatAt = now;
    this.lastSeenAt = now;
    this.lastLoveAt = now;
  }

  /** Lớp vắng: quá GAME.emptyRoomMs không ai bình luận, tặng quà hay thả tim */
  isEmpty(now: number) {
    return now - this.lastSeenAt > GAME.emptyRoomMs;
  }

  /** 1 câu cô nói (giọng nữ) */
  private t(text: string, priority = false): Say {
    return { text: `F: ${text}`, priority };
  }
  /** đánh dấu câu chính */
  private mainOf(lines: Say[]): Say[] {
    return lines.map((l) => ({ ...l, main: true }));
  }
  private line0(key: keyof typeof LINES) {
    return this.t(this.lines.pick(key, LINES[key] as string[]));
  }
  private line(key: keyof typeof LINES, ...args: string[]) {
    const fn = this.lines.pick(key, LINES[key] as ((...a: string[]) => string)[]);
    return fn(...args);
  }

  // ---------- người chơi ----------
  private touch(e: Person, now: number) {
    this.lastSeenAt = now;
    this.clock = Math.max(this.clock, now);
    let s = this.students.get(e.username);
    if (!s) {
      s = { ...e, girl: hash(e.username) % 2 === 0, score: 0, session: 0, reachedAt: 0, streak: 0, lastActive: now, joinedAt: now, desk: [], days: 0, standLeft: 0, team: 0, life: emptyLife() };
      // vào lớp giữa tiết: xếp ngay vào tổ ít người (đang giờ chọn tổ thì để bạn tự chọn, hết giờ cô xếp)
      if (GAME.teamPickSec > 0 && this.phase !== 'team') s.team = this.smallestTeam(now);
      this.students.set(e.username, s);
    } else {
      s.nickname = e.nickname;
      s.spoken = e.spoken;
      if (e.avatar) s.avatar = e.avatar;
      s.lastActive = now;
    }
    return s;
  }

  /** Cộng điểm: `inClass` = điểm tiết học (xếp ghế); mọi điểm đều vào cả buổi + bảng tuần */
  private award(s: Student, points: number, now: number, inClass: boolean) {
    if (inClass) {
      s.score += points;
      s.reachedAt = now;
    }
    s.session += points;
    const w = this.weekDelta.get(s.username) ?? { nickname: s.nickname, points: 0 };
    w.nickname = s.nickname;
    w.points += points;
    this.weekDelta.set(s.username, w);
    // học bạ cả đời: đủ điểm thì lên lớp, cô chúc mừng + đội mũ tốt nghiệp 🎓 lên bàn
    const before = gradeOf(s.life.points);
    this.addLife(s, { points });
    const after = gradeOf(s.life.points);
    if (after > before && s.spoken !== 'bạn') {
      s.desk = [...s.desk, { icon: '🎓', at: now }].slice(-GAME.deskGifts);
      this.clapUntil = now + GAME.clapSec * 1000;
      this.announce.push({ ...this.t(this.line('gradeUp', s.spoken, gradeLabel(after)), true), ttl: 60_000 });
    }
  }

  /** Cộng vào học bạ (của bạn trong lớp và phần chờ gửi lên server) */
  private addLife(s: Student, add: Partial<Life>) {
    const d = this.lifeDelta.get(s.username) ?? { nickname: s.nickname, ...emptyLife() };
    d.nickname = s.nickname;
    for (const k of Object.keys(add) as (keyof Life)[]) {
      s.life[k] += add[k]!;
      d[k] += add[k]!;
    }
    this.lifeDelta.set(s.username, d);
  }

  /** Trả lời đúng 1 câu: đếm vào học bạ theo loại câu, đủ số thì có huy hiệu mới */
  private countCorrect(s: Student, q: Question) {
    const kind: keyof Life | null = q.math ? 'toan' : q.slot === 'su' || q.slot === 'meo' || q.slot === 'anh' ? q.slot : null;
    const had = new Set(badgesOf(s.life).map((b) => b.key));
    this.addLife(s, kind ? { total: 1, [kind]: 1 } : { total: 1 });
    for (const b of badgesOf(s.life)) {
      if (!had.has(b.key) && s.spoken !== 'bạn') this.announce.push({ ...this.t(this.line('badgeNew', s.spoken, `${b.icon} ${b.name}`), true), ttl: 60_000 });
    }
  }

  /** Gõ "học bạ": cô đọc lớp mấy, điểm, số câu đúng, huy hiệu (mỗi bạn 5 phút 1 lần, cả lớp 15 giây 1 lần) */
  private reportCard(s: Student, now: number): Say[] {
    if (now - (this.cardAt.get(s.username) ?? -Infinity) < 5 * 60_000 || now - this.lastCardAt < 15_000 || s.spoken === 'bạn') return [];
    this.cardAt.set(s.username, now);
    this.lastCardAt = now;
    const l = s.life;
    const badges = badgesOf(l).map((b) => b.name);
    const days = s.days >= 2 ? ` Đi học ${s.days} ngày liền.` : '';
    const text =
      `Học bạ của ${s.spoken} nè: đang học ${gradeLabel(gradeOf(l.points))}, ${l.points} điểm, trả lời đúng ${l.total} câu.` +
      days +
      (badges.length ? ` Huy hiệu: ${badges.join(', ')}.` : ' Chưa có huy hiệu, cố lên nha.');
    return [{ ...this.t(text, true), ttl: 30_000 }];
  }

  /** Cô tặng 1 món quà: đặt lên bàn bạn nhỏ, trả về tên quà để cô đọc */
  private giveGift(s: Student, now: number): string {
    const g = REWARDS[Math.floor(this.rand() * REWARDS.length)];
    s.desk = [...s.desk, { icon: g.icon, at: now }].slice(-GAME.deskGifts);
    return g.name;
  }

  private monitorSaidQ = -99;
  /** Lớp trưởng đổi người thì cô thông báo */
  private checkMonitor(): Say[] {
    const top = this.seats(1)[0];
    if (!top || top.score <= 0 || top.username === this.monitor) return [];
    const first = this.monitor === '';
    this.monitor = top.username;
    // người đầu tiên có điểm trong tiết thì khỏi báo (cô vừa khen rồi), từ lần đổi người mới báo;
    // đổi liên tục thì cách GAME.monitorEveryQ câu mới báo 1 lần (đỡ nói nhiều)
    if (first || this.qNo - this.monitorSaidQ < GAME.monitorEveryQ) return [];
    this.monitorSaidQ = this.qNo;
    return [this.t(this.line('newMonitor', top.spoken))];
  }


  /**
   * 20 ghế: điểm tiết cao ngồi đầu; cùng điểm thì bạn còn tương tác (bình luận trong 10 phút) ngồi trước bạn đã im lâu
   * (thường đã rời live), rồi ai đạt trước, rồi điểm cả buổi, rồi ai vào trước (chỗ không nhảy lung tung)
   */
  seats(n = GAME.seats): Student[] {
    const away = (s: Student) => (this.clock - s.lastActive > GAME.seatActiveMs ? 1 : 0);
    return [...this.students.values()]
      .sort((a, b) => b.score - a.score || away(a) - away(b) || a.reachedAt - b.reachedAt || b.session - a.session || a.joinedAt - b.joinedAt)
      .slice(0, n);
  }
  /** giờ của nhịp gần nhất (để xếp ghế biết ai đã im lâu) */
  private clock = 0;

  // ---------- chia tổ ----------
  /** Số bạn đang chơi mỗi tổ (bình luận trong 10 phút, bạn đã rời live thì không tính khi chia cho đều) */
  private teamSizes(now: number) {
    const n = Array(GAME.teamCount).fill(0);
    for (const s of this.students.values()) if (s.team && now - s.lastActive <= GAME.seatActiveMs) n[s.team - 1]++;
    return n;
  }
  /** Tổ ít người nhất (bằng nhau thì bốc thăm) */
  private smallestTeam(now: number) {
    const n = this.teamSizes(now);
    const min = Math.min(...n);
    const ties = n.flatMap((x, i) => (x === min ? [i + 1] : []));
    return ties[Math.floor(this.rand() * ties.length)];
  }
  /** Bảng thi đua: điểm tiết này của cả tổ (cộng điểm từng bạn), số bạn, số cờ đã thắng */
  teamStats(now: number) {
    const sizes = this.teamSizes(now);
    const score = Array(GAME.teamCount).fill(0);
    for (const s of this.students.values()) if (s.team) score[s.team - 1] += s.score;
    return score.map((sc, i) => ({ no: i + 1, score: sc, members: sizes[i], wins: this.teamWins[i] }));
  }
  private teamCountsText(now: number) {
    return this.teamSizes(now).map((n, i) => `Tổ ${i + 1} ${n} bạn.`).join(' ');
  }
  private teamChat(s: Student, e: ChatIn): Say[] {
    const n = teamOf(e.comment);
    if (n) s.team = n; // đổi ý trong giờ chọn tổ thì theo lần chọn sau
    return [];
  }
  /** Hết giờ chọn tổ: quét cả lớp, ai chưa có tổ thì xếp vào tổ ít người nhất (không sót ai), rồi vào tiết */
  private closeTeams(now: number): Say[] {
    let auto = 0;
    // xếp bạn đang chơi trước cho các tổ đều nhau, rồi tới bạn đã im lâu
    const left = [...this.students.values()].filter((s) => !s.team).sort((a, b) => b.lastActive - a.lastActive);
    for (const s of left) {
      s.team = this.smallestTeam(now);
      auto++;
    }
    const b = auto ? `Cô xếp ${auto} bạn chưa chọn vào tổ ít người.` : 'Bạn nào cũng có tổ rồi.';
    this.setPhase('intro', now, GAME.introSec);
    return this.mainOf([this.t(this.line('teamClose', this.teamCountsText(now), b)), this.review ? this.line0('reviewIntro') : this.line0('intro'), ...this.showSoon()]);
  }
  /** Cuối tiết: tổ nhiều điểm nhất được cờ thi đua (hoà thì các tổ hoà cùng được) */
  private teamResult(now: number): Say[] {
    if (GAME.teamPickSec <= 0) return [];
    const st = this.teamStats(now);
    const best = Math.max(...st.map((t) => t.score));
    this.lastTeamWin = best > 0 ? st.filter((t) => t.score === best).map((t) => t.no) : [];
    for (const no of this.lastTeamWin) this.teamWins[no - 1]++;
    if (!this.lastTeamWin.length) return [this.line0('teamNobody')];
    return [this.t(this.line('teamWin', this.lastTeamWin.map((n) => `tổ ${n}`).join(' và '), String(best)))];
  }

  sessionTop(n: number): Student[] {
    return [...this.students.values()].filter((s) => s.session > 0).sort((a, b) => b.session - a.session || a.joinedAt - b.joinedAt).slice(0, n);
  }

  // ---------- chọn câu ----------
  /** Chọn câu lâu chưa hỏi nhất theo độ khó, tránh 2 câu liền cùng chủ đề và quá 2 câu/chủ đề mỗi tiết */
  /** `difficulty` = 'meo' / 'su': bốc câu đố mẹo / lịch sử; còn lại bốc câu chữ thường (không bao giờ lấy câu có chỗ riêng) */
  private pickOne(difficulty: Question['difficulty'] | Slot, taken: Question[], now: number, topic = ''): Question | null {
    const used = new Set(taken.map((q) => q.id));
    const perCat = (c: string) => taken.filter((q) => q.category === c).length;
    const prev = taken[taken.length - 1]?.category;
    const slot = (SLOTS as readonly string[]).includes(difficulty) ? difficulty : undefined;
    const kind = (q: Question) => q.slot === slot && !this.banned.has(q.id) && !used.has(q.id);
    let pool = this.bank.filter((q) => kind(q) && (slot || q.difficulty === difficulty));
    // chủ đề cả lớp bình chọn: lấy trong chủ đề đó trước (cùng độ khó, hết thì khác độ khó)
    const fav = topic ? pool.filter((q) => q.category === topic) : [];
    const favAny = topic && !fav.length ? this.bank.filter((q) => kind(q) && q.category === topic) : [];
    if (fav.length || favAny.length) pool = fav.length ? fav : favAny;
    else {
      const nice = pool.filter((q) => q.category !== prev && perCat(q.category) < 2);
      if (nice.length) pool = nice;
    }
    if (!pool.length) pool = this.bank.filter((q) => kind(q));
    if (!pool.length) return null;
    // xáo trước rồi xếp theo lần hỏi gần nhất: câu chưa hỏi bao giờ lên đầu, thứ tự trong file không ảnh hưởng
    const at = (q: Question) => this.history[q.id] ?? 0;
    pool = [...pool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool.sort((a, b) => at(a) - at(b));
    let q = pool[0];
    // bản riêng: phần lớn câu chữ thường lấy từ bộ Gen Z / công sở / ăn uống yêu đương, nhưng chỉ trong nhóm câu
    // lâu chưa hỏi nhất (cùng lần hỏi với pool[0]): bộ hot hết câu mới thì lấy câu mới bộ khác, không hỏi lại câu cũ
    if (!slot && !fav.length && !favAny.length && this.rand() < GAME.hotShare) {
      const hot = pool.find((x) => at(x) === at(pool[0]) && (GAME.hotTopics as readonly string[]).includes(x.id.split(':')[0]));
      if (hot) q = hot;
    }
    this.history[q.id] = now;
    this.usedLog.push(q.id);
    return q;
  }

  /** Lớp vắng: hỏi lại câu đã từng hỏi (bốc ngẫu nhiên), không ghi sổ, để dành câu mới cho lúc đông người */
  private pickReview(difficulty: Question['difficulty'] | Slot, taken: Question[]): Question | null {
    const used = new Set(taken.map((q) => q.id));
    const slot = (SLOTS as readonly string[]).includes(difficulty) ? difficulty : undefined;
    const pool = this.bank.filter(
      (q) => q.slot === slot && (slot || q.difficulty === difficulty) && (this.history[q.id] ?? 0) > 0 && !this.banned.has(q.id) && !used.has(q.id),
    );
    return pool.length ? pool[Math.floor(this.rand() * pool.length)] : null;
  }

  /** Bốc câu cho tiết. `from`: giữ nguyên các câu trước vị trí này (đang ôn bài thì có bạn vào, đổi phần còn lại sang câu mới) */
  private pickRound(now: number, from = 0) {
    const out: Question[] = this.roundQs.slice(0, from);
    let plain = 0; // thứ tự câu chữ thường trong tiết
    let fav = 0; // số câu đã lấy theo chủ đề cả lớp chọn
    for (const [i, d] of GAME.roundPlan.entries()) {
      if (i < from) {
        if (!d.startsWith('math') && !(SLOTS as readonly string[]).includes(d)) plain++;
        continue;
      }
      let q: Question | null;
      // lớp vắng: ôn bài bằng câu cũ (câu toán vẫn tự sinh); chưa có câu cũ thì lấy câu mới như thường
      const old = this.review && !d.startsWith('math') ? this.pickReview(d as Question['difficulty'] | Slot, out) : null;
      if (old) {
        out.push(old);
        if (!(SLOTS as readonly string[]).includes(d)) plain++;
        continue;
      }
      // câu toán tự sinh, không tính vào chủ đề nên câu chữ trước và sau nó vẫn khác chủ đề nhau
      if (d.startsWith('math')) q = makeMath(Number(d.slice(4)) as MathLevel, this.rand);
      else if ((SLOTS as readonly string[]).includes(d)) q = this.pickOne(d as Slot, out.filter((x) => !x.math), now);
      else {
        // chủ đề cả lớp chọn: tối đa GAME.voteTopicQuestions câu chủ đề đó; câu chữ thường nhiều thì cách 1 câu lấy 1,
        // ít (bản riêng chỉ còn 5 câu chữ thường) thì lấy liền
        const step = PLAIN_SLOTS >= 2 * GAME.voteTopicQuestions ? 2 : 1;
        const useTopic = this.topic && plain % step === 0 && fav < GAME.voteTopicQuestions ? this.topic : '';
        q = this.pickOne(d as Question['difficulty'], out.filter((x) => !x.math), now, useTopic);
        if (useTopic && q?.category === useTopic) fav++;
        plain++;
      }
      if (q) out.push(q);
    }
    this.roundQs = out;
  }

  get golden() {
    return this.qNo > 0 && this.qNo === this.roundQs.length && this.roundQs.length >= GAME.questionsPerRound;
  }

  private lettersOf(q: Question | null) {
    return q ? [...q.answer.normalize('NFC').toUpperCase().replace(/\s+/g, '')] : [];
  }
  get answerLetters() {
    return this.lettersOf(this.q);
  }

  /** Ô đáp án theo từng chữ: null = chưa mở, ' ' = khoảng cách giữa 2 từ */
  slotsOf(q: Question | null, revealed: Set<number>, showAll: boolean): (string | null)[] {
    if (!q) return [];
    const out: (string | null)[] = [];
    let i = 0;
    for (const ch of q.answer.normalize('NFC').toUpperCase().trim()) {
      if (/\s/.test(ch)) {
        if (out[out.length - 1] !== ' ') out.push(' ');
        continue;
      }
      out.push(showAll || revealed.has(i) ? ch : null);
      i++;
    }
    return out;
  }
  slots(showAll = false) {
    return this.slotsOf(this.q, this.revealed, showAll);
  }

  /** Mở thêm 1 chữ (không mở quá số chữ - 2). Trả về false nếu hết chữ được mở */
  revealOne(): boolean {
    const n = this.answerLetters.length;
    if (this.revealed.size >= Math.max(0, n - GAME.keepHiddenLetters)) return false;
    const hidden = [...Array(n).keys()].filter((i) => !this.revealed.has(i));
    this.revealed.add(hidden[Math.floor(this.rand() * hidden.length)]);
    return true;
  }

  private setPhase(p: Phase, now: number, sec: number) {
    this.phase = p;
    this.phaseStartedAt = now;
    this.phaseEndsAt = now + sec * 1000;
    this.heldMs = 0;
    this.warned = false;
    if (p !== 'bonus') this.chatterUsed = 0; // thêm giờ vẫn tính chung lượt với câu đang hỏi
  }

  /** số câu nói thêm (không ưu tiên) cô đã nói trong phần này; GAME.chatterPerPhase là trần */
  chatterUsed = 0;
  /** còn được nói thêm câu này không: câu ưu tiên (cảm ơn quà, sinh nhật, lên lớp) luôn được, câu thường theo trần */
  chatterAllowed(priority: boolean) {
    return priority || this.chatterUsed < GAME.chatterPerPhase;
  }

  private warned = false; // đã nhắc "chuẩn bị hết giờ" ở phần này chưa

  private heldMs = 0;
  /** Cô đang đọc câu chính: dừng đồng hồ phần hiện tại (đọc đề xong mới đếm giờ trả lời). Có trần để không kẹt. */
  hold(ms: number) {
    const add = Math.max(0, Math.min(ms, GAME.maxHoldMs - this.heldMs));
    this.heldMs += add;
    this.phaseStartedAt += add;
    this.phaseEndsAt += add;
    if (this.phase === 'question') this.answerStartAt += add; // đọc đề xong mới bắt đầu tính giờ trả lời
  }

  /** lúc bắt đầu tính giờ trả lời câu đang hỏi (cô hô bắt đầu xong), giờ máy */
  private answerStartAt = 0;
  /** độ lệch giờ máy so với giờ TikTok (giờ máy nhận - giờ TikTok gắn), trung bình trượt */
  private clockSkew = 0;
  private skewSamples = 0;

  /** Đã hiện bảng chữ (chữ xáo / phép tính) chưa: cô đọc đề xong, hô bắt đầu mới hiện */
  boardShown = false;
  showBoard(now = this.clock) {
    if (!this.boardShown) this.boardShownAt = now;
    this.boardShown = true;
  }
  /** lúc bảng chữ hiện (giờ máy): đáp án GỬI trước lúc này là gõ khi cô chưa đọc xong đề, không tính */
  private boardShownAt = 0;

  /** Lúc được nói thêm (chào, cảm ơn, cà khịa): đang chờ học sinh trả lời (hoặc lúc cô dừng giữa tiết) và còn đủ giờ */
  chatterWindow(now: number) {
    const left = this.phaseEndsAt - now;
    const answering =
      this.phase === 'question' ||
      this.phase === 'bonus' ||
      this.phase === 'praise' ||
      this.phase === 'vote' ||
      this.phase === 'team' ||
      this.showAsking() ||
      (this.phase === 'recess' && this.recess?.stage === 'play');
    return answering && left > GAME.chatterMinLeftMs;
  }

  /** Câu cô đọc trước gợi ý: "Đây là một từ gồm 5 chữ cái, là một món ăn." (hô bắt đầu xong mới hiện chữ trên bảng) */
  intro(q: Question) {
    if (q.math) return q.kind;
    // chế độ nhanh (chủ kênh duyệt cách đọc 2026-11-05): "Đây là một từ gồm 7 chữ cái." rồi đọc gợi ý, bỏ câu dẫn chung của bộ.
    // Tiếng Anh: "Đây là một từ tiếng Anh gồm 5 chữ cái." Lịch sử, đuổi hình: giữ danh xưng của nhóm
    // ("Đây là tên một vị vua gồm 11 chữ cái.", "Đuổi hình bắt chữ! Đây là một thành ngữ gồm 14 chữ cái.")
    if (GAME.quickRead) {
      const n = this.lettersOf(q).length;
      const named = /^Đây là\s+/i.test(q.kind) ? `${q.kind.replace(/[.!\s]+$/, '')} gồm ${n} chữ cái.` : `Đây là một từ gồm ${n} chữ cái.`;
      if (q.slot === 'dh') return `Đuổi hình bắt chữ! ${named}`;
      if (q.slot === 'su') return named;
      if (q.slot === 'anh') return `Đây là một từ tiếng Anh gồm ${n} chữ cái.`;
      return `Đây là một từ gồm ${n} chữ cái.`;
    }
    const n = this.lettersOf(q).length;
    const word = q.slot === 'anh' ? `một từ tiếng Anh gồm ${n} chữ cái` : `một từ gồm ${n} chữ cái`;
    const kind = /^Đây là\s+/i.exec(q.kind);
    // đuổi hình bắt chữ: "Đuổi hình bắt chữ! Đây là một từ gồm 12 chữ cái, là một thành ngữ."
    const dh = q.slot === 'dh' ? 'Đuổi hình bắt chữ! ' : '';
    // "Đây là một món ăn." -> "Đây là một từ gồm 5 chữ cái, là một món ăn."
    if (kind) return `${dh}Đây là ${word}, là ${q.kind.slice(kind[0].length)}`;
    // "Câu lịch sử nè." -> "Câu lịch sử nè. Đây là một từ gồm 8 chữ cái."
    return `${dh}${q.kind} Đây là ${word}.`;
  }

  private startQuestion(now: number): Say[] {
    this.qNo++;
    // đang ôn bài mà có bạn vào lớp: phần còn lại của tiết đổi sang câu mới
    const back: Say[] = [];
    if (this.review && !this.isEmpty(now) && this.roundQs.length === GAME.roundPlan.length) {
      this.review = false;
      this.pickRound(now, this.qNo - 1);
      back.push(this.line0('reviewEnd'));
    }
    this.q = this.roundQs[this.qNo - 1] ?? null;
    if (!this.q) return this.startResults(now, true);
    // câu toán hiện phép tính, đuổi hình bắt chữ hiện emoji: không xáo chữ
    this.tiles = this.q.math || this.q.slot === 'dh' ? [] : scramble(this.q.answer, this.rand);
    this.boardShown = false;
    this.revealed = new Set();
    // đuổi hình bắt chữ: hiện sẵn chữ cái đầu của mỗi chữ trong ô đáp án để người chơi có chỗ bám (chủ kênh duyệt 2026-11-05)
    if (this.q.slot === 'dh' && GAME.dhFirstLetters) {
      let i = 0;
      for (const w of this.q.answer.trim().split(/\s+/)) {
        this.revealed.add(i);
        i += [...w.normalize('NFC')].length;
      }
    }
    this.bonusUsed = false;
    this.quietSaid = false;
    this.correct = [];
    this.tried = new Set();
    this.wrong = new Set();
    this.stats = { received: 0, attempts: 0 };
    this.setPhase('question', now, GAME.questionSec);
    this.answerStartAt = now;
    const out: Say[] = [...back];
    if (this.golden) out.push(this.line0('goldenIntro'));
    else if (this.q.math && !GAME.quickRead) out.push(this.line0('mathIntro'));
    // đuổi hình bắt chữ: không đọc emoji, chỉ mời nhìn hình
    const clue = this.q.slot === 'dh' ? (GAME.quickRead ? 'Nhìn hình đoán nhanh!' : 'Nhìn hình đoán chữ nha cả lớp.') : this.q.clue;
    // tiết mục đố mẹo (2 câu liền giữa tiết): câu đầu cô dẫn hài, câu sau nói ngắn "câu đố mẹo thứ hai"
    const prevSlot = this.roundQs[this.qNo - 2]?.slot;
    if (this.q.slot === 'meo' && prevSlot !== 'meo') {
      out.push(this.line0('riddleSegment'));
      out.push(this.t(`Câu ${this.qNo}. ${clue}`));
    } else if (this.q.slot === 'meo') {
      out.push(this.t(`Câu ${this.qNo}. ${this.line0('riddleSecond').text.slice(3)} ${clue}`));
    } else out.push(this.t(`Câu ${this.qNo}. ${this.intro(this.q)} ${clue}`));
    // chế độ nhanh: đọc đề ngắn, không hô bắt đầu; đọc xong là hiện bảng chữ, nhận đáp án, chạy giờ
    // (chủ kênh 2026-11-04: hiện bảng lúc cô còn đọc thì người chơi đoán trước, không công bằng)
    if (GAME.quickRead) {
      out[out.length - 1] = { ...out[out.length - 1], showAfter: true };
      return this.mainOf(out);
    }
    // đọc đề xong cô hô bắt đầu (lúc đó mới hiện bảng chữ); đồng hồ dừng trong lúc cô nói nên hô xong mới đếm giờ
    out.push({ ...this.line0('go'), go: true });
    return this.mainOf(out);
  }

  private matches(q: Question | null, comment: string) {
    if (!q) return false;
    const key = GAME.requireDiacritics ? compactVi : plain;
    const typed = key(comment);
    return [q.answer, ...(q.acceptedAnswers ?? [])].some((a) => key(a) === typed);
  }

  /** Comment có phải là câu trả lời không: dài đúng bằng đáp án (không tính khoảng trắng). Nói chuyện thường không bị tính sai */
  private isAttempt(q: Question | null, comment: string) {
    const n = compactVi(comment).length;
    return !!q && [q.answer, ...(q.acceptedAnswers ?? [])].some((a) => compactVi(a).length === n);
  }

  // ---------- sự kiện ----------
  chat(e: ChatIn, now: number): Say[] {
    const s = this.touch(e, now);
    this.lastChatAt = now;
    // độ lệch đồng hồ TikTok so với máy: lấy mức nhỏ nhất gần đây (ít trễ mạng nhất), nhích lên dần để theo kịp nếu đồng hồ trôi
    const sample = now - e.createTime;
    if (Number.isFinite(sample) && Math.abs(sample) < 10 * 60_000) {
      this.clockSkew = this.skewSamples++ === 0 ? sample : Math.min(sample, this.clockSkew + 5);
    }
    // bong bóng chat: không hiện câu trả lời (lộ đáp án cho bạn khác) và câu có từ cấm
    const asking = this.phase === 'question' || this.phase === 'bonus';
    const answering =
      (asking && this.isAttempt(this.q, e.comment)) ||
      (this.recess?.game === 'callup' && this.isAttempt(this.recess.callQ, e.comment)) ||
      (this.phase === 'show' && this.isShowAnswer(e.comment));
    if (e.safe !== false && !answering && e.comment.trim()) s.bubble = { text: e.comment.trim().slice(0, 28), at: now };
    // tương tác: 1 bình luận = 1 (mỗi bạn tối đa 1 lần / 2 giây để gõ dồn không leo bảng)
    if (now - (s.lastTalkAt ?? -Infinity) >= GAME.talkGapMs) {
      s.lastTalkAt = now;
      this.addTalk(s, 1);
    }
    // đang trả lời câu có đáp án "sinh nhật" thì chấm bài, không coi là báo sinh nhật
    if (!answering && isBirthday(e.comment)) return this.celebrate(s, now);
    if (!answering && plain(e.comment) === 'hocba') return this.reportCard(s, now);
    // đang rủ "ai yêu cô gõ số 1": ghi tên (không ảnh hưởng trả lời câu chữ vì đáp án không dài 1 chữ)
    if (this.love && now - this.love.at < GAME.loveWindowMs && plain(e.comment) === '1' && !this.love.fans.includes(s.username)) {
      this.love.fans.push(s.username);
    }
    // đang hỏi bình chọn vui: gõ đúng 1 chữ của lựa chọn (đáp án câu chữ luôn dài từ 2 chữ nên không lẫn)
    const key = plain(e.comment);
    if (this.poll && now - this.poll.at < GAME.loveWindowMs && this.poll.opts.some((o) => o.key === key) && !this.poll.votes.has(s.username)) {
      this.poll.votes.set(s.username, key);
    }
    if (this.phase === 'team') return this.teamChat(s, e);
    if (this.phase === 'show') return this.showChat(s, e, now);
    if (this.phase === 'vote') return this.voteChat(s, e);
    if (this.phase === 'recess') return this.recessChat(s, e, now);
    if (this.phase !== 'question' && this.phase !== 'bonus') return [];
    this.stats.received++;
    // cô chưa đọc xong đề (bảng chữ chưa hiện): đáp án gõ trước không tính, cũng không mất lượt
    if (GAME.quickRead && !this.boardShown) return [];
    // gửi lúc cô còn đang đọc mà bình luận tới trễ (sau khi bảng hiện): xét theo giờ gửi TikTok (đổi sang giờ máy), không tính,
    // không mất lượt. Người xem thật thấy bảng trên điện thoại trễ hơn máy vài giây nên luôn gửi sau mốc này (chủ kênh 2026-11-05)
    if (GAME.quickRead && this.phase === 'question' && this.skewSamples > 1 && e.createTime + this.clockSkew < this.boardShownAt - GAME.earlySendGraceMs) return [];
    if (!this.isAttempt(this.q, e.comment) || this.tried.has(e.username)) return [];
    this.tried.add(e.username);
    this.stats.attempts++;
    if (!this.matches(this.q, e.comment)) {
      this.wrong.add(e.username);
      return [];
    }
    this.correct.push({ username: e.username, nickname: e.nickname, avatar: e.avatar, createTime: e.createTime, seq: ++this.seq, points: 0 });
    // xếp theo giờ TikTok gắn, không theo lúc bot nhận (comment có thể tới lệch thứ tự)
    this.correct.sort((a, b) => a.createTime - b.createTime || a.seq - b.seq);
    const mult = this.golden ? 2 : 1;
    this.correct.forEach((a, i) => (a.points = pointsForRank(i) * mult));
    // đủ top N bạn đúng (các hạng có điểm cao) thì vài giây nữa chốt câu, khỏi chờ hết 20 giây
    if (GAME.closeAfterTopN > 0 && this.correct.length === GAME.closeAfterTopN) {
      this.phaseEndsAt = Math.min(this.phaseEndsAt, now + GAME.closeAfterTopSec * 1000);
    }
    if (this.correct.length === 1) {
      // phòng vắng (ít bạn đang chơi): có người đúng thì chốt sớm, khỏi chờ đủ 20 giây
      const endAfter = this.activePlayers(now) < GAME.smallRoomPlayers ? GAME.smallRoomEndAfterSec : GAME.endAfterFirstSec;
      if (endAfter > 0) this.phaseEndsAt = Math.min(this.phaseEndsAt, now + endAfter * 1000);
      const fast = now - this.phaseStartedAt < GAME.superFastSec * 1000;
      if (!fast && this.rand() < GAME.giftChance) {
        return [{ ...this.t(this.line('firstCorrectGift', e.spoken, this.giveGift(s, now))), ttl: 6000 }];
      }
      // siêu nhanh: khen lố theo loại câu (toán: thần đồng toán học, tiếng Anh: vua ngôn ngữ), ưu tiên nên luôn được nói
      if (fast) {
        const key = this.q?.math ? 'superFastMath' : this.q?.slot === 'anh' ? 'superFastEnglish' : 'superFast';
        return [{ ...this.t(this.line(key, e.spoken), true), ttl: 8000 }];
      }
      return [{ ...this.t(this.line('firstCorrect', e.spoken)), ttl: 6000 }];
    }
    return [];
  }

  /** Số bạn đang chơi: có bình luận trong 2 phút gần đây */
  activePlayers(now: number) {
    let n = 0;
    for (const s of this.students.values()) if (now - s.lastActive < GAME.activeWindowMs) n++;
    return n;
  }

  /** Chúc mừng sinh nhật: bánh kem lên bàn, cả lớp vỗ tay, biểu ngữ. Mỗi bạn 1 lần mỗi buổi, cách nhau ít nhất 1 phút */
  /** Nút "Chào tạm biệt" (trang điều khiển): cô chào cuối buổi, cảm ơn bạn dẫn đầu tiết (nếu có), biểu ngữ tan lớp + vỗ tay */
  goodbye(now: number): Say[] {
    this.goodbyeAt = now;
    this.clapUntil = now + GAME.clapSec * 1000;
    const top = this.seats(1)[0];
    const line = top && top.score > 0 && top.spoken !== 'bạn' ? this.line('goodbyeTop', top.spoken) : this.line0('goodbye').text.slice(3);
    return this.mainOf([this.t(line)]);
  }

  celebrate(s: Person, now: number): Say[] {
    const st = this.touch(s, now);
    if (this.birthdayDone.has(st.username) || now - this.lastBirthdayAt < GAME.birthdayCooldownMs) return [];
    this.birthdayDone.add(st.username);
    this.lastBirthdayAt = now;
    this.birthday = { nickname: st.nickname, at: now };
    st.desk = [...st.desk, { icon: '🎂', at: now }].slice(-GAME.deskGifts);
    this.clapUntil = now + GAME.clapSec * 1000;
    // nói chen lúc đang chờ trả lời (câu nói thêm), ưu tiên như cảm ơn quà, không cắt ngang đề
    return [this.t(this.line('birthday', st.spoken), true)];
  }

  /** Chuyên cần: server báo bạn này đi học mấy ngày liền. Ngày thứ 2 trở đi cô nhận ra, mốc đẹp thì tặng quà */
  attendance(e: Person, days: number, now: number, life?: Life): Say[] {
    const s = this.touch(e, now);
    s.days = days;
    // học bạ cả đời từ server (cộng thêm phần đã có trong buổi mà server chưa nhận)
    if (life) {
      const pending = this.lifeDelta.get(s.username);
      for (const k of Object.keys(s.life) as (keyof Life)[]) s.life[k] = (Number(life[k]) || 0) + (pending?.[k] ?? 0);
    }
    if (days < 2 || s.spoken === 'bạn') return [];
    if (GAME.attendMilestones.includes(days) || (days > 30 && days % 10 === 0)) {
      return [{ ...this.t(this.line('attendMilestone', s.spoken, String(days), this.giveGift(s, now)), true), ttl: 60_000 }];
    }
    return [{ ...this.t(this.line('attendBack', s.spoken, String(days))), ttl: 30_000 }];
  }

  /** Nút "Bỏ câu này": câu lỗi thì bỏ luôn, ghi sổ không hỏi lại, sang câu tiếp không ai được điểm */
  banCurrent(now: number): Say[] {
    const asking = this.phase === 'question' || this.phase === 'bonus' || this.phase === 'reveal';
    if (!asking || !this.q || this.q.math) return [];
    this.banned.add(this.q.id);
    this.banLog.push({ id: this.q.id, answer: this.q.answer, clue: this.q.clue });
    this.correct = [];
    this.wrong = new Set();
    return [...this.mainOf([this.line0('banned')]), ...this.afterQuestion(now)];
  }

  /** Cộng tương tác hôm nay (bảng Top tương tác, không hiện cách tính) */
  private addTalk(s: Student, n: number) {
    const d = this.talkDelta.get(s.username) ?? { nickname: s.nickname, points: 0 };
    d.nickname = s.nickname;
    d.points += n;
    this.talkDelta.set(s.username, d);
  }

  /** Quà: luôn là hoa tặng cô, mỗi món quà = 10 tương tác (không nói ra). `count` = số món (combo) */
  gift(e: Person, coins: number, now: number, count = 1, giftName = ''): Say[] {
    const s = this.touch(e, now);
    this.addTalk(s, GAME.talkPerGift * Math.max(1, count));
    this.flowers++;
    this.lastFlowerAt = now;
    // quỹ hoa của cô hôm nay: mỗi xu = 1 bông; qua mốc thì cô cảm ơn cả lớp + pháo hoa
    const bong = Math.max(1, coins);
    const before = this.flowersToday;
    this.flowerBase += bong;
    this.flowerDelta += bong;
    const out: Say[] = [];
    const reached = GAME.flowerGoals.filter((g) => before < g && this.flowersToday >= g).pop();
    if (reached) {
      this.fundParty = { goal: reached, at: now };
      this.clapUntil = now + GAME.clapSec * 1000;
      out.push({ ...this.t(this.line('fundGoal', String(reached))), warn: true });
    }
    // bạn nhỏ đi lên bục đưa hoa cho cô, cô cảm ơn ngay (đang có bạn đi thì thôi, tránh combo chen nhau)
    const tier = tierOf(coins);
    // quà trong bảng "Gửi tặng cô": cô cảm ơn đúng tên món, bạn nhỏ cầm đúng món đó (hoa hồng, bắn tim, bánh donut)
    const known = giftOf(giftName);
    const icon = known?.icon ?? GAME.giftTiers[tier].icon;
    this.giftPile = [...this.giftPile, { tier, icon }].slice(-GAME.giftPileMax);
    if (!this.walk || now - this.walk.at > GAME.walkMs) {
      this.walk = { username: e.username, at: now, tier, icon };
      // món có lời đáp riêng (bắn tim, hoa hồng, bánh donut) thì đáp riêng; tặng nhiều xu (bậc lớn) vẫn dùng lời cảm ơn theo bậc
      const key = (['thankTier0', 'thankTier1', 'thankTier2', 'thankTier3'] as const)[tier];
      const text = known && tier < 2 ? this.line(known.thanks, s.spoken) : this.line(key, s.spoken, known?.say ?? GAME.giftTiers[tier].name);
      out.unshift({ ...this.t(text), warn: true });
    }
    const asking = this.phase === 'question' || this.phase === 'bonus';
    if (asking && GAME.hintGiftCoins > 0 && coins >= GAME.hintGiftCoins && this.correct.length === 0 && this.revealOne()) {
      out.push(...this.mainOf([this.t(this.line('giftHint', e.spoken), true)]));
    }
    return out;
  }

  /** Quỹ hoa hôm nay = số bông server đã lưu + số bông mới chưa gửi */
  get flowersToday() {
    return this.flowerBase;
  }
  /** Server báo số bông đã lưu hôm nay (sang ngày mới thì về 0); cộng phần chưa gửi */
  setFlowersSaved(saved: number) {
    this.flowerBase = saved + this.flowerDelta;
  }

  /** Câu cảm ơn quà (useGame quyết định có cảm ơn hay không để tránh lặp combo) */
  thank(e: Person, giftName: string, coins: number): Say {
    return this.t(coins >= GAME.bigGiftCoins ? this.line('bigGift', e.spoken) : this.line('thankGift', e.spoken, giftOf(giftName)?.say ?? giftName), true);
  }
  follow(e: Person): Say {
    return this.t(this.line('thankFollow', e.spoken));
  }
  greet(names: string): Say {
    return this.t(this.line('greeting', names));
  }
  share(): Say {
    return this.line0('share');
  }

  /** Tim: giờ ra chơi "thả tim" thì đếm; ngoài ra đủ mốc thì cả lớp vỗ tay */
  like(count: number, now: number, reachedClap: boolean): Say[] {
    this.lastSeenAt = now;
    if (this.recess?.game === 'heart' && this.recess.stage === 'play') {
      this.recess.hearts += count * GAME.heartBoost;
      return [];
    }
    if (!reachedClap) return [];
    this.clapUntil = now + GAME.clapSec * 1000;
    return [this.line0('clap')];
  }

  /**
   * Khen chuỗi câu đúng liền (mốc GAME.streakMilestones): 1 bạn thì khen riêng; nhiều bạn cùng mốc thì gộp 1 câu, đọc tối đa
   * GAME.streakNamesRead tên (chủ kênh chốt 2026-11-04, trước đọc từng bạn làm cô nói quá nhiều). Điểm, quà vẫn đủ cho mọi bạn.
   */
  private streakLines(all: { s: Student; gift: string }[]): Say[] {
    const out: Say[] = [];
    for (const m of GAME.streakMilestones) out.push(...this.streakGroupLines(all.filter((x) => x.s.streak === m), String(m)));
    return out;
  }
  private streakGroupLines(list: { s: Student; gift: string }[], k: string): Say[] {
    if (list.length === 0) return [];
    if (list.length === 1) {
      const { s, gift } = list[0];
      return [this.t(gift ? this.line('streakGift', s.spoken, gift, k) : this.line('streak', s.spoken, k))];
    }
    const named = list.map((x) => x.s.spoken).filter((n) => n !== 'bạn').slice(0, GAME.streakNamesRead);
    const more = list.length - named.length;
    const names = named.length === 0 ? `${more} bạn` : more > 0 ? `${named.join(', ')} và ${more} bạn nữa` : `${named.slice(0, -1).join(', ')} với ${named[named.length - 1]}`;
    const out = [this.t(this.line('streakGroup', names, k))];
    if (list.some((x) => x.gift)) out.push(this.line0('streakGroupGift'));
    return out;
  }

  private reveal(now: number): Say[] {
    this.setPhase('reveal', now, GAME.revealSec);
    const q = this.q!;
    this.reportLog.push({ id: q.id, answer: q.answer, category: q.category, attempts: this.stats.attempts, correct: this.correct.length, at: now });
    const out: Say[] = [];
    const winners = new Set(this.correct.map((a) => a.username));
    const streakers: { s: Student; gift: string }[] = [];
    for (const a of this.correct) {
      const s = this.students.get(a.username);
      if (!s) continue;
      this.countCorrect(s, this.q!);
      this.award(s, a.points, now + a.seq / 1e6, true);
      s.streak++;
      if ((GAME.streakMilestones as readonly number[]).includes(s.streak)) {
        this.award(s, GAME.streakBonus, now, true);
        streakers.push({ s, gift: this.rand() < GAME.giftChance ? this.giveGift(s, now) : '' });
      }
    }
    out.push(...this.streakLines(streakers));
    // cùng lúc chốt điểm: ai trả lời trước xếp trên
    this.correct.forEach((a, i) => {
      const s = this.students.get(a.username);
      if (s) s.reachedAt = now + i / 1000;
    });
    for (const s of this.students.values()) if (!winners.has(s.username)) s.streak = 0;
    const math = this.q!.math;
    const riddle = this.q!.slot === 'meo';
    const eng = this.q!.slot === 'anh'; // câu tiếng Anh: lời hiện đáp án đọc từ tiếng Anh bằng giọng tiếng Anh
    // câu toán đọc cả phép tính: "36 cộng 47 bằng 83"
    const answer = math ? `${math.say} bằng ${this.q!.answer}` : this.q!.answer.toLowerCase();
    const top = this.correct[0] && this.students.get(this.correct[0].username);
    let main: string;
    if (top) {
      const rest = this.line('revealTop', top.spoken) + (this.correct.length > 1 ? ' ' + this.line('revealCount', String(this.correct.length)) : '');
      const slot = this.q!.slot;
      main = this.line(math ? 'mathReveal' : riddle ? 'riddleReveal' : eng ? 'englishReveal' : slot === 'dh' ? 'pictureReveal' : slot === 'su' ? 'historyReveal' : 'reveal', answer, rest);
      if (this.golden) out.unshift(this.t(this.rand() < 0.5 ? this.line('goldenGift', top.spoken, this.giveGift(top, now)) : this.line('goldenWinner', top.spoken)));
    } else main = this.line(math ? 'mathNobody' : riddle ? 'riddleNobody' : eng ? 'englishNobody' : 'revealNobody', answer);
    out.unshift({ ...this.t(main), main: true });
    // gõ sai: lên đứng cạnh cô GAME.standQuestions câu (chủ kênh chốt 2026-11-05), tối đa GAME.standMax bạn cùng lúc,
    // ai sai trước lên trước. Bạn đang đứng: qua mỗi câu bớt 1, hết thì về chỗ
    for (const s of this.students.values()) if (s.standLeft > 0) s.standLeft--;
    let free = GAME.standMax - [...this.students.values()].filter((s) => s.standLeft > 0).length;
    const sentUp: Student[] = [];
    for (const u of this.wrong) {
      if (free <= 0) break;
      const s = this.students.get(u);
      if (!s || s.standLeft > 0) continue;
      s.standLeft = GAME.standQuestions;
      sentUp.push(s);
      free--;
    }
    const named = sentUp.filter((s) => s.spoken !== 'bạn');
    if (named.length) out.push(this.t(this.line('roastStand', named[0].spoken)));
    else {
      // cà khịa 1 bạn trả lời sai (tên đọc được)
      const wrongs = [...this.wrong].map((u) => this.students.get(u)).filter((s): s is Student => !!s && s.spoken !== 'bạn');
      if (wrongs.length && this.rand() < GAME.roastChance) {
        out.push(this.t(this.line(math ? 'mathWrong' : riddle ? 'riddleWrong' : 'roastWrong', wrongs[Math.floor(this.rand() * wrongs.length)].spoken)));
      }
    }
    return this.mainOf([...out, ...this.checkMonitor()]);
  }

  /** Dừng giữa tiết: cô điểm danh 3 bạn nhỏ điểm cao nhất, tặng quà, mời cả lớp tương tác rồi mới ra câu tiếp */
  private startPraise(now: number): Say[] {
    const top = this.seats(3).filter((s) => s.score > 0);
    this.setPhase('praise', now, GAME.praiseSec);
    const keys = ['praiseFirst', 'praiseSecond', 'praiseThird'] as const;
    if (GAME.praiseShort) {
      // chế độ nhanh: 1 câu đọc top 3, quà vẫn đặt lên bàn
      top.forEach((s) => this.giveGift(s, now));
      const names = top.map((s) => `${s.spoken} ${s.score} điểm`).join(', ');
      return this.mainOf([this.t(this.line('praiseQuick', names))]);
    }
    return this.mainOf([
      this.line0('praiseIntro'),
      ...top.map((s, i) => this.t(this.line(keys[i], s.spoken, String(s.score), this.giveGift(s, now)))),
      this.line0('praiseOutro'),
    ]);
  }

  private startResults(now: number, outOfQuestions = false): Say[] {
    this.setPhase('results', now, GAME.resultsSec);
    // phạt đứng chỉ tính trong giờ học: hết tiết thì cả lớp về chỗ, ra chơi / game lớn không ai đứng phạt
    for (const s of this.students.values()) s.standLeft = 0;
    // hết 20 câu: cô thay bộ trang phục khác (bốc ngẫu nhiên, không trùng bộ đang mặc)
    const others = GAME.outfits.filter((o) => o !== this.outfit);
    this.outfit = others[Math.floor(this.rand() * others.length)];
    const best = this.seats(1)[0];
    const lines: Say[] = [];
    // ghi lớp trưởng tiết này vào bảng các tiết trước
    if (best && best.score > 0) {
      this.champions = [{ round: this.round, username: best.username, nickname: best.nickname, score: best.score }, ...this.champions].slice(0, GAME.championsKept);
    }
    if (outOfQuestions) lines.push(this.t('Hết câu hỏi rồi, cô tổng kết luôn nha.'));
    lines.push(best && best.score > 0 ? this.t(this.line('results', best.spoken, String(best.score))) : this.line0('resultsNobody'));
    lines.push(...this.teamResult(now));
    if (this.weekLeader && this.round % 3 === 0) lines.push(this.t(this.line('weekBoard', this.weekLeader)));
    return this.mainOf(lines);
  }

  // ---------- giờ ra chơi ----------
  private startRecess(now: number, forced?: RecessGame): Say[] {
    const choices = RECESS_GAMES.filter((g) => g !== this.lastRecess);
    let game = forced ?? choices[Math.floor(this.rand() * choices.length)];
    let callTarget: Student | null = null;
    let callQ: Question | null = null;
    if (game === 'callup') {
      // gọi 1 bạn đang ngồi lớp, vừa hoạt động trong 3 phút
      const active = this.seats().filter((s) => now - s.lastActive < 180_000 && s.spoken !== 'bạn');
      callTarget = active[Math.floor(this.rand() * active.length)] ?? null;
      // câu dễ chưa có trong tiết; bộ câu quá ít thì lấy đại 1 câu
      callQ = callTarget ? (this.pickOne('easy', this.roundQs, now) ?? this.bank[Math.floor(this.rand() * this.bank.length)] ?? null) : null;
      if (!callTarget || !callQ) game = 'roll';
    }
    this.lastRecess = game;
    this.recess = {
      game,
      stage: 'play',
      rps: new Map(),
      teacher: null,
      callTarget,
      callQ,
      callTiles: callQ ? scramble(callQ.answer, this.rand) : [],
      callResult: '',
      pick: PICK_TOPICS[Math.floor(this.rand() * PICK_TOPICS.length)],
      votes: new Map(),
      roll: [],
      hearts: 0,
    };
    this.setPhase('recess', now, GAME.recessPlaySec[game]);
    const out: Say[] = [this.line0('recessIntro')];
    const r = this.recess;
    if (game === 'rps') out.push(this.line0('rpsIntro'));
    if (game === 'callup') out.push(this.t(this.line('callUp', callTarget!.spoken)), this.t(`${callQ!.kind} ${callQ!.clue}`));
    if (game === 'pick') out.push(this.t(this.line('pickIntro', r.pick[0], r.pick[1])));
    if (game === 'roll') out.push(this.line0('rollIntro'));
    if (game === 'heart') out.push(this.t(this.line('heartIntro', String(GAME.heartTarget))));
    return this.mainOf(out);
  }

  private recessChat(s: Student, e: ChatIn, now: number): Say[] {
    const r = this.recess;
    if (!r || r.stage !== 'play') return [];
    const word = plain(e.comment);
    if (r.game === 'rps' && word in RPS && !r.rps.has(s.username)) r.rps.set(s.username, word as Rps);
    if (r.game === 'pick' && (word === '1' || word === '2') && !r.votes.has(s.username)) r.votes.set(s.username, word === '1' ? 1 : 2);
    if (r.game === 'roll' && word === 'comat' && !r.roll.some((a) => a.username === s.username)) {
      r.roll.push({ username: s.username, nickname: s.nickname, avatar: s.avatar, createTime: e.createTime, seq: ++this.seq, points: GAME.rollPoints });
      r.roll.sort((a, b) => a.createTime - b.createTime || a.seq - b.seq);
    }
    if (r.game === 'callup' && r.callTarget?.username === s.username && this.isAttempt(r.callQ, e.comment)) {
      r.callResult = this.matches(r.callQ, e.comment) ? 'right' : 'wrong';
      this.phaseEndsAt = now; // trả lời rồi thì chốt luôn
    }
    return [];
  }

  private recessResult(now: number): Say[] {
    const r = this.recess!;
    r.stage = 'result';
    this.setPhase('recess', now, GAME.recessResultSec);
    const out: Say[] = [];
    if (r.game === 'rps') {
      if (r.rps.size === 0) return this.mainOf([this.line0('rpsNobody')]);
      r.teacher = (Object.keys(RPS) as Rps[])[Math.floor(this.rand() * 3)];
      let win = 0;
      let lose = 0;
      for (const [u, p] of r.rps) {
        if (BEATS[p] === r.teacher) {
          win++;
          const s = this.students.get(u);
          if (s) this.award(s, GAME.rpsPoints, now, false);
        } else if (BEATS[r.teacher] === p) lose++;
      }
      const rest = win ? this.line('rpsWin', String(win)) : lose ? this.line('rpsLose', String(lose)) : 'Hòa cả lớp luôn.';
      out.push(this.t(this.line('rpsReveal', RPS[r.teacher], rest)));
    }
    if (r.game === 'callup') {
      const s = r.callTarget!;
      if (r.callResult === 'right') this.award(s, GAME.callUpPoints, now, false);
      if (r.callResult === '') r.callResult = 'silent';
      const key = r.callResult === 'right' ? 'callUpRight' : r.callResult === 'wrong' ? 'callUpWrong' : 'callUpSilent';
      out.push(this.t(this.line(key, s.spoken)));
      if (r.callResult !== 'right') out.push(this.t(`Đáp án là ${r.callQ!.answer.toLowerCase()}.`));
    }
    if (r.game === 'pick') {
      const one = [...r.votes.values()].filter((v) => v === 1).length;
      const two = r.votes.size - one;
      if (r.votes.size === 0) out.push(this.line0('pickNobody'));
      else if (one === two) out.push(this.line0('pickTie'));
      else {
        const [win, lose, n] = one > two ? [r.pick[0], r.pick[1], one] : [r.pick[1], r.pick[0], two];
        out.push(this.t(this.line('pickResult', win, String(Math.round((n / r.votes.size) * 100)))), this.t(this.line('pickRoast', lose)));
      }
    }
    if (r.game === 'roll') {
      const first = r.roll.slice(0, GAME.rollWinners);
      for (const a of first) {
        const s = this.students.get(a.username);
        if (s) this.award(s, GAME.rollPoints, now, false);
      }
      const names = first.slice(0, 3).map((a) => this.students.get(a.username)?.spoken ?? 'bạn');
      out.push(first.length ? this.t(this.line('rollResult', names.join(', '))) : this.line0('rollNobody'));
    }
    if (r.game === 'heart') {
      if (r.hearts >= GAME.heartTarget) {
        for (const s of this.students.values()) if (now - s.lastActive < 600_000) this.award(s, 1, now, false);
        out.push(this.line0('heartWin'));
        this.clapUntil = now + GAME.clapSec * 1000;
      } else out.push(this.t(this.line('heartFail', String(r.hearts))));
    }
    return this.mainOf([...out, ...this.checkMonitor()]);
  }

  /** Cuối giờ ra chơi: bảng lớp trưởng các tiết trước, cô nhắc bạn làm lớp trưởng nhiều lần nhất */
  private recessBoard(now: number): Say[] {
    this.recess!.stage = 'board';
    this.setPhase('recess', now, GAME.recessBoardSec);
    const last = this.champions[0];
    const s = last && this.students.get(last.username);
    if (!s) return [];
    const times = this.champions.filter((c) => c.username === last.username).length;
    return this.mainOf([this.t(times > 1 ? this.line('championAgain', s.spoken, String(times)) : this.line('championBoard', s.spoken))]);
  }

  // ---------- 2 game lớn: Đường lên đỉnh Everest / Rung Chuông Đồng (bản riêng cô Ngân) ----------
  // Nhịp giọng như tiết học: câu cô đọc là câu chính (đồng hồ dừng), hô bắt đầu (go) mới nhận đáp án và chạy giờ.
  // Ai đúng trong giờ đều được điểm, không xét nhanh chậm; mỗi tài khoản 1 đáp án mỗi câu.

  /** Bảng điểm + xếp hạng của game đang chơi (đúng câu phụ thì xếp trên người đồng điểm) */
  private showRank() {
    const sh = this.show;
    if (!sh) return [];
    return [...sh.scores]
      .map(([username, score]) => ({ username, score, nickname: this.students.get(username)?.nickname ?? username, tie: sh.tieWin.has(username) ? 1 : 0 }))
      .sort((a, b) => b.score - a.score || b.tie - a.tie || a.nickname.localeCompare(b.nickname));
  }

  /** Đang chờ người xem trả lời trong game lớn (cô đã hô bắt đầu) */
  showAsking() {
    return this.phase === 'show' && this.show?.stage === 'ask' && this.boardShown && ['mc', 'stake', 'code'].includes(this.show.steps[this.show.i]?.k);
  }

  private showStepSec() {
    const st = this.show?.steps[this.show.i];
    return st?.k === 'mc' ? st.sec : 0;
  }

  /** Bình luận này là đáp án trong game lớn (không hiện bong bóng, không coi là nói chuyện) */
  private isShowAnswer(comment: string) {
    const st = this.show?.steps[this.show.i];
    if (!st) return false;
    if (st.k === 'mc') return choiceOf(comment) >= 0 || plain(comment) === 'goiy';
    if (st.k === 'stake') return /^(10|20)$/.test(plain(comment));
    if (st.k === 'code' && this.show!.code) return compactVi(comment).length === compactVi(this.show!.code.answer).length;
    return false;
  }

  /** Bốc câu trắc nghiệm lâu chưa hỏi nhất của nhóm (không lặp trong game), xáo vị trí A B C D */
  private pickMc(level: McLevel, now: number) {
    const sh = this.show!;
    const at = (q: McQ) => this.history[q.id] ?? 0;
    let pool = this.showBank.mc.filter((q) => q.level === level && !sh.used.has(q.id));
    if (!pool.length) pool = this.showBank.mc.filter((q) => !sh.used.has(q.id));
    if (!pool.length) return null;
    pool = [...pool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool.sort((a, b) => at(a) - at(b));
    const q = pool[0];
    sh.used.add(q.id);
    this.history[q.id] = now;
    this.usedLog.push(q.id);
    const opts = [q.right, ...q.wrong];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return { q, opts, ans: opts.indexOf(q.right) };
  }

  private pickCode(now: number): CodeQ | null {
    const at = (c: CodeQ) => this.history[c.id] ?? 0;
    const pool = [...this.showBank.codes];
    if (!pool.length) return null;
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool.sort((a, b) => at(a) - at(b));
    this.history[pool[0].id] = now;
    this.usedLog.push(pool[0].id);
    return pool[0];
  }

  /**
   * Bảng sự kiện cạnh tên kênh: game lớn kế tiếp là game nào, sau tiết mấy.
   * `now` = đang chơi; `soon` = hết tiết này là tới (tiết đang học hoặc đang tổng kết tiết đó).
   */
  nextShow() {
    if (GAME.showEvery <= 0 || !this.showBank.mc.length) return null;
    if (this.show) return { kind: this.show.kind, name: SHOW_NAME[this.show.kind], afterRound: this.round, now: true, soon: false };
    // tiết hiện tại đã xong (ra chơi, chọn chủ đề) thì tính từ tiết sau
    const done = this.phase === 'recess' || this.phase === 'vote';
    const base = Math.max(1, done ? this.round + 1 : this.round);
    const afterRound = Math.ceil(base / GAME.showEvery) * GAME.showEvery;
    const kind: ShowKind = this.showNo % 2 === 0 ? 'everest' : 'chuong';
    return { kind, name: SHOW_NAME[kind], afterRound, now: false, soon: !done && afterRound === this.round };
  }

  /** Đầu tiết có game lớn ở cuối: cô báo trước cho cả lớp chuẩn bị */
  private showSoon(): Say[] {
    const n = this.nextShow();
    return n?.soon ? [this.t(this.line('showSoon', n.name))] : [];
  }

  /** Nút "Game lớn" ở trang điều khiển: chơi ngay 1 game */
  forceShow(kind: ShowKind, now: number): Say[] {
    if (!this.showBank.mc.length) return [];
    return this.startShow(now, kind);
  }

  private startShow(now: number, forced?: ShowKind): Say[] {
    const kind: ShowKind = forced ?? (this.showNo % 2 === 0 ? 'everest' : 'chuong');
    this.showNo++;
    this.recess = null;
    const E = GAME.show.everest;
    const C = GAME.show.chuong;
    const mc = (level: McLevel, x: { sec: number; pts: number }, tag: ShowTag): ShowStep => ({ k: 'mc', level, sec: x.sec, pts: x.pts, tag });
    const times = <T,>(n: number, f: () => T) => Array.from({ length: n }, f);
    const steps: ShowStep[] =
      kind === 'everest'
        ? [
            { k: 'gather' },
            { k: 'section', key: 'evWarm' },
            ...times(E.warm.n, () => mc('de', E.warm, 'warm')),
            { k: 'section', key: 'evCode' },
            { k: 'code', hint: 0 },
            { k: 'code', hint: 1 },
            { k: 'code', hint: 2 },
            { k: 'code', hint: 3 },
            { k: 'codeReveal' },
            { k: 'section', key: 'evStorm' },
            ...times(E.storm.n, () => mc('vua', E.storm, 'storm')),
            { k: 'section', key: 'evPeak' },
            ...times(E.peak.n, () => [{ k: 'stake' } as ShowStep, mc('kho', { sec: E.peak.sec, pts: 0 }, 'peak')]).flat(),
            { k: 'section', key: 'showTie' },
            { k: 'honor' },
          ]
        : [
            { k: 'gather' },
            { k: 'section', key: 'chWarm' },
            ...times(C.warm.n, () => mc('de', C.warm, 'warm')),
            { k: 'section', key: 'chHold' },
            ...times(C.hold.n, () => mc('vua', C.hold, 'hold')),
            { k: 'section', key: 'chRescue' },
            mc('vua', { sec: C.rescue.sec, pts: 0 }, 'rescue'),
            { k: 'section', key: 'chFinal' },
            ...times(C.final.n, () => mc('kho', C.final, 'final')),
            { k: 'section', key: 'chBell' },
            mc('chuong', C.bell, 'bell'),
            { k: 'section', key: 'showTie' },
            { k: 'honor' },
          ];
    this.show = {
      kind,
      steps,
      i: 0,
      stage: 'ask',
      qNo: 0,
      scores: new Map(),
      tieWin: new Set(),
      players: new Set(),
      mc: null,
      answers: new Map(),
      removed: [],
      ticketUser: '',
      stakes: new Map(),
      tickets: new Set(),
      code: null,
      codeTried: new Set(),
      codeSolvers: [],
      tied: [],
      bellRingers: [],
      helpers: [],
      honors: [],
      used: new Set(),
      lastRight: 0,
    };
    return this.showStep(now);
  }

  /** Vào bước hiện tại của game lớn */
  private showStep(now: number): Say[] {
    const sh = this.show!;
    const st = sh.steps[sh.i];
    sh.stage = 'ask';
    this.boardShown = false;
    const go = (): Say => ({ ...this.line0('showGo'), go: true });
    switch (st.k) {
      case 'gather':
        this.setPhase('show', now, GAME.show.gatherSec);
        return this.mainOf([this.line0(sh.kind === 'everest' ? 'showIntroEverest' : 'showIntroChuong')]);
      case 'section': {
        // câu phụ: chỉ khi top đầu đồng điểm (từ 2 bạn trở lên), không thì bỏ qua
        if (st.key === 'showTie') {
          const rank = this.showRank();
          const top = rank[0]?.score ?? 0;
          sh.tied = top > 0 ? rank.filter((r) => r.score === top).map((r) => r.username) : [];
          if (sh.tied.length < 2) return this.showNext(now);
          sh.steps.splice(sh.i + 1, 0, { k: 'mc', level: 'phu', sec: GAME.show.tieSec, pts: 0, tag: 'tie' });
          const names = sh.tied.slice(0, 4).map((u) => this.students.get(u)?.spoken ?? 'bạn').join(', ');
          this.setPhase('show', now, 2);
          return this.mainOf([this.t(this.line('showTie', names, String(top)))]);
        }
        this.setPhase('show', now, 2);
        return this.mainOf([this.line0(st.key)]);
      }
      case 'mc': {
        const p = this.pickMc(st.level, now);
        if (!p) return this.showNext(now);
        sh.qNo++;
        sh.mc = { ...p, tag: st.tag, pts: st.pts };
        sh.answers = new Map();
        sh.removed = [];
        sh.ticketUser = '';
        this.setPhase('show', now, st.sec);
        const opts = p.opts.map((o, i) => `${LETTERS[i]}, ${o}.`).join(' ');
        const head = st.tag === 'tie' ? 'Câu phụ.' : st.tag === 'bell' ? 'Câu Chuông Đồng.' : `Câu ${sh.qNo}.`;
        return this.mainOf([this.t(`${head} ${p.q.q}`), this.t(opts), go()]);
      }
      case 'stake':
        sh.stakes = new Map();
        this.setPhase('show', now, GAME.show.everest.peak.stakeSec);
        return this.mainOf([this.line0('evStake'), go()]);
      case 'code': {
        if (st.hint === 0) {
          sh.code = this.pickCode(now);
          sh.codeSolvers = [];
        }
        if (!sh.code) return this.showNext(now);
        // cứu trợ: chỉ mở khi hết 3 gợi ý mà chưa ai giải được
        if (st.hint === 3 && sh.codeSolvers.length) return this.showNext(now);
        sh.codeTried = new Set();
        const C = GAME.show.everest.code;
        this.setPhase('show', now, st.hint === 3 ? C.rescueSec : C.hintSec);
        const n = compactVi(sh.code.answer).length;
        const line =
          st.hint === 3
            ? this.t(this.line('codeRescue', sh.code.answer.trim()[0].toUpperCase(), String(n)))
            : this.t(`Gợi ý ${st.hint + 1}, ${C.pts[st.hint]} điểm. ${sh.code.hints[st.hint]}`);
        return this.mainOf(st.hint === 0 ? [this.t(this.line('codeIntro', String(n))), line, go()] : [line, go()]);
      }
      case 'codeReveal': {
        sh.stage = 'reveal';
        this.setPhase('show', now, GAME.show.revealSec);
        const c = sh.code!;
        const names = sh.codeSolvers.slice(0, 3).map((x) => this.students.get(x.username)?.spoken ?? 'bạn').join(', ');
        return this.mainOf([
          this.t(sh.codeSolvers.length ? this.line('codeReveal', c.answer.toLowerCase(), String(sh.codeSolvers.length), names) : this.line('codeNobody', c.answer.toLowerCase())),
        ]);
      }
      case 'honor':
        return this.showHonor(now);
    }
  }

  private showNext(now: number): Say[] {
    const sh = this.show!;
    sh.i++;
    if (sh.i >= sh.steps.length) return this.endShow(now);
    return this.showStep(now);
  }

  private showAdvance(now: number): Say[] {
    const sh = this.show;
    if (!sh) return this.startVote(now);
    const st = sh.steps[sh.i];
    if (st.k === 'mc' && sh.stage === 'ask') return this.showReveal(now);
    if (st.k === 'honor') return this.endShow(now);
    return this.showNext(now);
  }

  /** Chấm 1 câu trắc nghiệm, cộng điểm, cô đọc đáp án */
  private showReveal(now: number): Say[] {
    const sh = this.show!;
    const m = sh.mc!;
    sh.stage = 'reveal';
    this.setPhase('show', now, GAME.show.revealSec);
    const right = [...sh.answers].filter(([, a]) => a === m.ans).map(([u]) => u);
    sh.lastRight = right.length;
    const out: Say[] = [];
    for (const u of right) {
      const s = this.students.get(u);
      if (!s) continue;
      if (m.tag === 'tie') sh.tieWin.add(u);
      else if (m.tag === 'rescue') {
        sh.tickets.add(u);
        if (!sh.helpers.includes(u)) sh.helpers.push(u);
      } else {
        const pts = m.tag === 'peak' ? (sh.stakes.get(u) ?? GAME.show.everest.peak.stakes[0]) : m.pts;
        sh.scores.set(u, (sh.scores.get(u) ?? 0) + pts);
        this.award(s, pts, now, false);
        if (m.tag === 'bell') sh.bellRingers.push(u);
      }
    }
    const answer = `${LETTERS[m.ans]}, ${m.opts[m.ans]}`;
    out.push({ ...this.t(right.length ? this.line('showReveal', answer, String(right.length)) : this.line('showNobody', answer)), main: true });
    if (m.tag === 'rescue' && right.length) out.push({ ...this.t(this.line('ticketWin', String(right.length))), main: true });
    if (m.tag === 'bell' && right.length) {
      this.clapUntil = now + GAME.clapSec * 1000;
      out.push({ ...this.t(this.line('bellRing', String(right.length))), main: true });
    }
    return out;
  }

  private showChat(s: Student, e: ChatIn, now: number): Say[] {
    const sh = this.show;
    if (!sh || sh.stage !== 'ask' || !this.boardShown) return [];
    const st = sh.steps[sh.i];
    if (st.k === 'mc' && sh.mc) {
      // tiếp sức: thử thách cuối, ai có phiếu gõ "gợi ý" thì cô bỏ 2 đáp án sai cho cả phòng (mỗi câu 1 lần)
      if (plain(e.comment) === 'goiy') {
        if (sh.mc.tag !== 'final' || sh.ticketUser || !sh.tickets.has(s.username)) return [];
        sh.tickets.delete(s.username);
        sh.ticketUser = s.username;
        const wrong = [0, 1, 2, 3].filter((i) => i !== sh.mc!.ans);
        for (let i = wrong.length - 1; i > 0; i--) {
          const j = Math.floor(this.rand() * (i + 1));
          [wrong[i], wrong[j]] = [wrong[j], wrong[i]];
        }
        sh.removed = wrong.slice(0, 2);
        return [{ ...this.t(this.line('ticketUse', s.spoken)), warn: true }];
      }
      const c = choiceOf(e.comment);
      if (c < 0 || sh.answers.has(s.username) || sh.removed.includes(c)) return [];
      if (sh.mc.tag === 'tie' && !sh.tied.includes(s.username)) return [];
      sh.answers.set(s.username, c);
      sh.players.add(s.username);
      return [];
    }
    if (st.k === 'stake') {
      const p = plain(e.comment);
      if (p === '10' || p === '20') sh.stakes.set(s.username, Number(p));
      return [];
    }
    if (st.k === 'code' && sh.code) {
      // mỗi gợi ý được đoán 1 lần; giải rồi thì thôi
      if (!this.isShowAnswer(e.comment) || sh.codeTried.has(s.username) || sh.codeSolvers.some((x) => x.username === s.username)) return [];
      sh.codeTried.add(s.username);
      sh.players.add(s.username);
      const key = GAME.requireDiacritics ? compactVi : plain;
      if (key(e.comment) !== key(sh.code.answer)) return [];
      const C = GAME.show.everest.code;
      const pts = st.hint === 3 ? C.rescuePts : C.pts[st.hint];
      sh.codeSolvers.push({ username: s.username, pts, hint: st.hint });
      sh.scores.set(s.username, (sh.scores.get(s.username) ?? 0) + pts);
      this.award(s, pts, now, false);
      if (st.hint === 3 && !sh.helpers.includes(s.username)) sh.helpers.push(s.username);
      return [];
    }
    return [];
  }

  /** Vinh danh: hạng nhất, top 10, người cứu trợ nhận danh hiệu (hiện icon trên bảng tên cả buổi) */
  private showHonor(now: number): Say[] {
    const sh = this.show!;
    sh.stage = 'reveal';
    this.setPhase('show', now, GAME.show.honorSec);
    const [first, top, helper] = SHOW_TITLES[sh.kind];
    const rank = this.showRank().filter((r) => r.score > 0);
    const give = (u: string, title: string) => this.titles.set(u, [...new Set([...(this.titles.get(u) ?? []), title])]);
    const best = rank[0];
    const winners = best ? rank.filter((r) => r.score === best.score && r.tie === best.tie) : [];
    sh.honors = rank.slice(0, GAME.show.topShown).map((r) => ({ ...r, title: winners.includes(r) ? first : top }));
    for (const h of sh.honors) give(h.username, h.title);
    for (const u of sh.helpers) give(u, helper);
    if (winners.length) this.clapUntil = now + GAME.clapSec * 1000;
    const names = winners.slice(0, 3).map((w) => this.students.get(w.username)?.spoken ?? 'bạn').join(', ');
    return this.mainOf([
      this.t(
        winners.length
          ? this.line(sh.kind === 'everest' ? 'honorEverest' : 'honorChuong', names, String(best.score))
          : this.line('honorNobody', SHOW_NAME[sh.kind]),
      ),
      ...(sh.players.size ? [this.t(this.line('honorThanks', String(sh.players.size)))] : []),
    ]);
  }

  private endShow(now: number): Say[] {
    this.show = null;
    return this.startVote(now);
  }

  /** Ảnh chụp game lớn cho màn hình */
  private showView() {
    const sh = this.show;
    if (!sh) return null;
    const st = sh.steps[sh.i];
    const reveal = sh.stage === 'reveal';
    const m = sh.mc;
    const rank = this.showRank();
    const C = GAME.show.everest;
    // điểm tối đa (để vẽ độ cao trên núi / thanh điểm)
    const maxScore =
      sh.kind === 'everest'
        ? C.warm.n * C.warm.pts + C.code.pts[0] + C.storm.n * C.storm.pts + C.peak.n * Math.max(...C.peak.stakes)
        : GAME.show.chuong.warm.n * GAME.show.chuong.warm.pts + GAME.show.chuong.hold.n * GAME.show.chuong.hold.pts + GAME.show.chuong.final.n * GAME.show.chuong.final.pts + GAME.show.chuong.bell.pts;
    const counts = m ? [0, 1, 2, 3].map((i) => [...sh.answers.values()].filter((a) => a === i).length) : [];
    const nameOf = (u: string) => this.students.get(u)?.nickname ?? u;
    const code = sh.code;
    const codeHint = st.k === 'code' ? st.hint : st.k === 'codeReveal' ? 3 : -1;
    return {
      kind: sh.kind,
      name: SHOW_NAME[sh.kind],
      step: st.k,
      section: st.k === 'section' ? SECTION_TITLE[st.key] : '',
      tag: st.k === 'mc' ? st.tag : '',
      stage: sh.stage,
      qNo: sh.qNo,
      question: st.k === 'mc' && m ? m.q.q : '',
      opts: st.k === 'mc' && m ? m.opts : [],
      removed: sh.removed,
      ans: reveal && m ? m.ans : -1,
      counts: reveal ? counts : [],
      answered: st.k === 'mc' ? sh.answers.size : st.k === 'stake' ? sh.stakes.size : st.k === 'code' ? sh.codeTried.size : 0,
      lastRight: sh.lastRight,
      ticketUser: sh.ticketUser ? nameOf(sh.ticketUser) : '',
      tickets: sh.tickets.size,
      stakes: [10, 20].map((v) => [...sh.stakes.values()].filter((x) => x === v).length),
      code: code && codeHint >= 0
        ? {
            hints: code.hints.slice(0, Math.min(3, codeHint + 1)),
            rescue: codeHint === 3,
            len: compactVi(code.answer).length,
            first: codeHint === 3 ? code.answer.trim()[0].toUpperCase() : '',
            answer: st.k === 'codeReveal' ? code.answer.toUpperCase() : '',
            solvers: sh.codeSolvers.slice(0, 5).map((x) => ({ nickname: nameOf(x.username), pts: x.pts })),
            solved: sh.codeSolvers.length,
            pts: codeHint < 3 ? C.code.pts[codeHint] : C.code.rescuePts,
          }
        : null,
      top: rank.slice(0, GAME.show.topShown).map((r) => ({ username: r.username, nickname: r.nickname, score: r.score })),
      maxScore,
      players: sh.players.size,
      tied: sh.tied.map(nameOf),
      bellRingers: sh.bellRingers.slice(0, 8).map(nameOf),
      honors: sh.honors,
      sectionNo: sh.steps.slice(0, sh.i + 1).filter((x) => x.k === 'section').length,
    };
  }

  newRound(now: number): Say[] {
    const voted = this.phase === 'vote' ? this.closeVote() : [];
    if (this.phase !== 'vote') this.topic = '';
    this.round++;
    this.monitor = ''; // tiết mới: cả lớp tranh lớp trưởng lại từ đầu
    this.qNo = 0;
    this.q = null;
    this.correct = [];
    this.recess = null;
    for (const s of this.students.values()) {
      s.score = 0;
      s.streak = 0;
      s.standLeft = 0; // tiết mới: bạn đang đứng phạt về chỗ hết
      s.reachedAt = 0;
      s.desk = [];
      // chịu tải hàng ngàn người: bạn đã rời live lâu (im quá GAME.forgetAfterMs) thì xoá khỏi lớp cho nhẹ.
      // Điểm hôm nay, tuần, học bạ đã lưu trên server; quay lại thì vào lớp như bạn mới, học bạ lấy lại từ server
      if (now - s.lastActive > GAME.forgetAfterMs && !this.lifeDelta.has(s.username) && !this.weekDelta.has(s.username)) this.students.delete(s.username);
    }
    // lớp vắng lâu: tiết này ôn bài bằng câu cũ (có bạn vào thì đổi sang câu mới ngay câu kế)
    this.review = this.isEmpty(now);
    this.pickRound(now);
    this.lastTeamWin = [];
    // lời chào theo giờ: đổi buổi thì chào, còn lại thỉnh thoảng nhắc
    const period = dayPeriod(now);
    const greet = period !== this.lastPeriod || this.round % GAME.timeGreetEvery === 0 ? [this.line0(PERIOD_LINES[period])] : [];
    this.lastPeriod = period;
    // bản cô Ngân: trước mỗi tiết 45 giây chọn tổ, hết giờ mới vào phần giới thiệu tiết
    if (GAME.teamPickSec > 0 && (this.round - 1) % GAME.teamPickEvery === 0) {
      this.setPhase('team', now, GAME.teamPickSec);
      this.teamReminded = false;
      return this.mainOf([...voted, ...greet, this.line0('teamIntro')]);
    }
    this.setPhase('intro', now, GAME.introSec);
    return this.mainOf([...voted, ...greet, this.review ? this.line0('reviewIntro') : this.line0('intro'), ...this.showSoon()]);
  }

  /** Bỏ qua phần đang chạy (nút "Qua phần tiếp" ở trang điều khiển) */
  skip(now: number): Say[] {
    this.phaseEndsAt = now;
    return this.tick(now);
  }

  /** Nút "Ra chơi ngay" ở trang điều khiển: chơi luôn 1 trò */
  forceRecess(game: RecessGame, now: number): Say[] {
    return this.startRecess(now, game);
  }

  tick(now: number): Say[] {
    this.clock = Math.max(this.clock, now);
    const extra: Say[] = [];
    // lớp im quá lâu: cô nhắc 1 câu
    if (now - this.lastChatAt > GAME.idleAfterSec * 1000 && now - this.lastIdleAt > GAME.idleAfterSec * 1000) {
      this.lastIdleAt = now;
      extra.push({ ...this.line0('idle'), ttl: 15000 });
    }
    if (this.phase === 'question' && !this.quietSaid && this.correct.length === 0 && now - this.phaseStartedAt > GAME.questionSec * 500) {
      this.quietSaid = true;
      if (this.rand() < 0.5) extra.push({ ...this.line0('quietHalfway'), ttl: 5000 });
    }
    extra.push(...this.engageTick(now));
    extra.push(...this.announce.splice(0)); // chúc mừng lên lớp / huy hiệu mới
    // còn 5 giây: cô nhắc sắp hết giờ (đồng hồ vẫn chạy)
    const asking = this.phase === 'question' || this.phase === 'bonus';
    if (asking && !this.warned && now < this.phaseEndsAt && this.phaseEndsAt - now <= GAME.warnLeftSec * 1000) {
      this.warned = true;
      extra.push({ ...this.line0('timeWarn'), warn: true });
    }
    // giờ chọn tổ: còn 15 giây thì cô đọc số bạn mỗi tổ, nhắc ai chưa chọn
    if (this.phase === 'team' && !this.teamReminded && now < this.phaseEndsAt && this.phaseEndsAt - now <= GAME.teamRemindLeftSec * 1000) {
      this.teamReminded = true;
      extra.push({ ...this.t(this.line('teamRemind', this.teamCountsText(now))), warn: true });
    }
    // game lớn: câu dài (từ 12 giây) còn 5 giây thì cô nhắc, đồng hồ vẫn chạy; câu 8 giây ngắn quá nên thôi
    const showAsk = this.phase === 'show' && this.show?.stage === 'ask' && this.boardShown;
    if (showAsk && !this.warned && this.showStepSec() >= 12 && now < this.phaseEndsAt && this.phaseEndsAt - now <= GAME.warnLeftSec * 1000) {
      this.warned = true;
      extra.push({ ...this.line0('timeWarn'), warn: true });
    }
    // phòng giọng hỏng / tắt tiếng: đồng hồ đã chạy hơn 1 giây (cô đọc xong) thì vẫn hiện bảng chữ / nhận đáp án
    if ((asking || (this.phase === 'show' && this.show?.stage === 'ask')) && !this.boardShown && now - this.phaseStartedAt > 1000) this.showBoard(now);
    if (now < this.phaseEndsAt) return extra;
    return [...extra, ...this.advance(now)];
  }

  private advance(now: number): Say[] {
    switch (this.phase) {
      case 'team':
        return this.closeTeams(now);
      case 'intro':
        return this.startQuestion(now);
      case 'question':
        if (this.correct.length === 0 && !this.bonusUsed) {
          this.bonusUsed = true;
          // câu toán không mở số, chỉ cho thêm giờ
          if (!this.q?.math) this.revealOne();
          this.setPhase('bonus', now, GAME.bonusSec);
          return this.mainOf([this.line0(this.q?.math ? 'mathBonus' : 'bonus')]);
        }
        return this.reveal(now);
      case 'bonus':
        return this.reveal(now);
      case 'reveal':
        return this.afterQuestion(now);
      case 'praise':
        return this.startQuestion(now);
      case 'results':
        // cứ GAME.showEvery tiết thì thay giờ ra chơi bằng 1 game lớn (xen kẽ Everest / Rung Chuông Đồng)
        if (GAME.showEvery > 0 && this.round % GAME.showEvery === 0 && this.showBank.mc.length) return this.startShow(now);
        return this.startRecess(now);
      case 'show':
        return this.showAdvance(now);
      case 'recess':
        if (this.recess?.stage === 'play') return this.recessResult(now);
        if (this.recess?.stage === 'result') return this.recessBoard(now);
        return this.startVote(now);
      case 'vote':
        return this.newRound(now);
    }
  }

  /**
   * Lấp khoảng im lặng lúc đang chờ trả lời câu chữ (câu toán thì không: gõ số sẽ bị tính là trả lời).
   * Xoay vòng: "ai yêu cô gõ số 1" / kể chuyện vui, mẹo tiếng Anh / bình chọn vui; hết 15 giây thì cảm ơn, đọc kết quả.
   */
  private engageTick(now: number): Say[] {
    if (this.love && now - this.love.at >= GAME.loveWindowMs) {
      const fans = this.love.fans.map((u) => this.students.get(u)?.spoken).filter((n): n is string => !!n && n !== 'bạn');
      const n = this.love.fans.length;
      this.love = null;
      if (n === 0) return [];
      const names = fans.slice(0, 3).join(', ') || 'các bạn';
      return [{ ...this.t(this.line('loveThanks', String(n), names)), ttl: 12_000 }];
    }
    if (this.poll && now - this.poll.at >= GAME.loveWindowMs) {
      const p = this.poll;
      this.poll = null;
      if (p.votes.size === 0) return [];
      const counts = p.opts.map((o) => ({ ...o, n: [...p.votes.values()].filter((k) => k === o.key).length })).sort((a, b) => b.n - a.n);
      const tie = counts.length > 1 && counts[0].n === counts[1].n;
      return [{ ...this.t(tie ? this.line('pollTie', String(p.votes.size)) : this.line('pollResult', counts[0].label, String(counts[0].n))), ttl: 12_000 }];
    }
    const quiet = this.phase === 'question' && this.boardShown && !this.q?.math && this.phaseEndsAt - now > 12_000;
    if (this.love || this.poll || !quiet || now - this.lastLoveAt < GAME.engageEveryMs) return [];
    this.lastLoveAt = now;
    const kind = GAME.engageOrder[this.engageNo++ % GAME.engageOrder.length];
    if (kind === 'love') {
      this.love = { at: now, fans: [] };
      return [{ ...this.line0('loveCall'), ttl: 6000 }];
    }
    if (kind === 'sleep') {
      // gọi 1 bạn đang ngồi mà ngủ gật dậy; không ai ngủ thì kể chuyện
      const sleepy = this.seats().filter((s) => now - s.lastActive > GAME.sleepAfterMs && s.spoken !== 'bạn');
      if (sleepy.length) return [{ ...this.t(this.line('wakeUp', sleepy[Math.floor(this.rand() * sleepy.length)].spoken)), ttl: 8000 }];
    }
    if (kind === 'poll') {
      const p = this.lines.pick('poll', POLLS);
      this.poll = { at: now, opts: p.opts, votes: new Map() };
      return [{ ...this.t(p.ask), ttl: 6000 }];
    }
    return [{ ...this.line0('funFact'), ttl: 8000 }];
  }

  /** Xong 1 câu: tổng kết tiết / dừng điểm danh / câu tiếp */
  private afterQuestion(now: number): Say[] {
    if (this.qNo >= this.roundQs.length) return this.startResults(now);
    // cứ 5 câu dừng lại điểm danh bạn nhỏ giỏi (chưa ai có điểm thì thôi)
    if (this.qNo % GAME.praiseEvery === 0 && this.seats(1)[0]?.score > 0) return this.startPraise(now);
    return this.startQuestion(now);
  }

  // ---------- bình chọn chủ đề tiết sau ----------
  private startVote(now: number): Say[] {
    this.recess = null;
    // 2 chủ đề câu chữ thường, khác các chủ đề vừa chọn gần đây
    const cats = [...new Set(this.bank.filter((q) => !q.slot).map((q) => q.category))];
    const fresh = cats.filter((c) => !this.lastTopics.includes(c));
    const pool = fresh.length >= 2 ? fresh : cats;
    if (pool.length < 2) return this.newRound(now);
    const a = pool[Math.floor(this.rand() * pool.length)];
    const rest = pool.filter((c) => c !== a);
    const b = rest[Math.floor(this.rand() * rest.length)];
    this.vote = { topics: [a, b], votes: new Map() };
    this.setPhase('vote', now, GAME.voteSec);
    return this.mainOf([this.t(this.line('voteIntro', topicName(a), topicName(b)))]);
  }

  private voteChat(s: Student, e: ChatIn): Say[] {
    const w = plain(e.comment);
    if (this.vote && (w === '1' || w === '2') && !this.vote.votes.has(s.username)) this.vote.votes.set(s.username, w === '1' ? 1 : 2);
    return [];
  }

  /** Đếm phiếu: chủ đề thắng thành chủ đề tiết sau (hoà thì bốc thăm, không ai chọn thì học bình thường) */
  private closeVote(): Say[] {
    const v = this.vote;
    this.vote = null;
    this.topic = '';
    if (!v || v.votes.size === 0) return [this.line0('voteNobody')];
    const one = [...v.votes.values()].filter((x) => x === 1).length;
    const two = v.votes.size - one;
    this.topic = one > two ? v.topics[0] : two > one ? v.topics[1] : v.topics[Math.floor(this.rand() * 2)];
    this.lastTopics = [...this.lastTopics, this.topic].slice(-4);
    return [this.t(this.line('voteResult', topicName(this.topic)))];
  }

  /** Ảnh chụp trạng thái để vẽ (gọn, gửi được qua mạng cho trang điều khiển xem trước) */
  view(now: number) {
    const showAnswer = this.phase === 'reveal';
    const asking = this.phase === 'question' || this.phase === 'bonus' || this.phase === 'reveal';
    const seated = this.seats(GAME.seats + GAME.standing);
    // lớp trưởng, lớp phó: 3 bạn điểm tiết cao nhất (chỉ tính 20 câu của tiết này); dùng lại danh sách ghế, khỏi xếp lại
    const titles = new Map(seated.slice(0, 3).filter((s) => s.score > 0).map((s, i) => [s.username, i === 0 ? 'lop-truong' : 'lop-pho']));
    const pub = ({ username, nickname, avatar, girl, score, session, lastActive, joinedAt, desk, days, bubble, standLeft, life, team }: Student) => ({
      team,
      desk,
      days,
      grade: gradeOf(life.points), // học bạ: lớp mấy (13 = tốt nghiệp)
      bubble: bubble && now - bubble.at < GAME.bubbleMs ? bubble.text : '',
      standing: standLeft > 0, // gõ sai bị phạt đứng cạnh cô: ghế trống
      sleeping: now - lastActive > GAME.sleepAfterMs,
      username,
      nickname,
      avatar,
      girl,
      score,
      session,
      lastActive,
      joinedAt,
      title: titles.get(username) ?? '',
      // danh hiệu từ 2 game lớn: chỉ lấy icon đầu mỗi danh hiệu cho gọn bảng tên
      showIcons: (this.titles.get(username) ?? []).map((x) => x.split(' ')[0]).join(''),
      // câu đang hỏi: trả lời đúng / sai / chưa (ngoài giờ hỏi thì không hiện)
      answered: !asking ? '' : this.correct.some((a) => a.username === username) ? 'right' : this.wrong.has(username) ? 'wrong' : '',
      // điểm vừa được của câu này: "+10" bay lên trên đầu bạn trả lời đúng
      gain: asking ? (this.correct.find((a) => a.username === username)?.points ?? 0) : 0,
    });
    const r = this.recess;
    return {
      phase: this.phase,
      round: this.round,
      qNo: this.qNo,
      total: this.roundQs.length,
      golden: this.golden,
      endsAt: this.phaseEndsAt,
      clue: this.q?.clue ?? '',
      kind: this.q?.kind ?? '',
      slot: this.q?.slot ?? '', // 'meo' câu đố mẹo, 'su' câu lịch sử: bảng hiện nhãn riêng
      // tiết mục đố mẹo: câu thứ mấy trong 2 câu liền (1 = câu đầu, cô đang dẫn thì bảng hiện thẻ "chuẩn bị")
      riddleNo: this.q?.slot === 'meo' ? (this.roundQs[this.qNo - 2]?.slot === 'meo' ? 2 : 1) : 0,
      math: this.q?.math?.show ?? '', // câu toán: phép tính hiện thay cho chữ xáo
      category: this.q?.category ?? '',
      answer: this.phase === 'recess' ? (r?.callQ?.answer ?? '') : (this.q?.answer ?? ''),
      tiles: this.tiles,
      slots: this.slots(showAnswer),
      vote: this.vote && {
        topics: this.vote.topics.map(topicName) as [string, string],
        counts: [1, 2].map((k) => [...this.vote!.votes.values()].filter((x) => x === k).length),
      },
      topic: topicName(this.topic), // chủ đề cả lớp chọn cho tiết này
      review: this.review, // tiết ôn bài (lớp vắng)
      // bạn nhỏ đang đi lên bục tặng hoa
      walk: (() => {
        const s = this.walk && now - this.walk.at < GAME.walkMs ? this.students.get(this.walk.username) : undefined;
        return s ? { username: s.username, nickname: s.nickname, girl: s.girl, at: this.walk!.at, tier: this.walk!.tier, icon: this.walk!.icon } : null;
      })(),
      // học sinh cá biệt đang đứng trên bục (kể cả bạn không có ghế)
      punished: [...this.students.values()].filter((s) => s.standLeft > 0).map(({ username, nickname, girl, standLeft }) => ({ username, nickname, girl, left: standLeft })),
      loveFans: this.love?.fans.length ?? 0, // đang rủ "ai yêu cô gõ số 1": số bạn đã gõ (tim bay lên)
      // đang bình chọn vui: các lựa chọn và số phiếu
      poll: this.poll && this.poll.opts.map((o) => ({ ...o, n: [...this.poll!.votes.values()].filter((k) => k === o.key).length })),
      birthday: this.birthday && now - this.birthday.at < GAME.birthdayBannerSec * 1000 ? this.birthday : null,
      goodbye: this.goodbyeAt && now - this.goodbyeAt < GAME.goodbyeBannerSec * 1000 ? { at: this.goodbyeAt } : null,
      players: this.activePlayers(now),
      // cô đang đọc đề: chưa hiện chữ xáo / phép tính / ô đáp án, hô bắt đầu mới hiện
      boardShown: (this.phase !== 'question' && this.phase !== 'show') || this.boardShown, // game lớn: cô hô bắt đầu mới chạy đồng hồ, nhận đáp án
      // dừng giữa tiết: 3 bạn nhỏ điểm cao nhất kèm quà trên bàn
      praiseTop: this.phase === 'praise' ? this.seats(3).filter((s) => s.score > 0).map(({ username, nickname, score, desk }) => ({ username, nickname, score, desk })) : [],
      correctTop: this.correct.slice(0, 3).map(({ username, nickname, avatar, points }) => ({ username, nickname, avatar, points })),
      // bảng Top 5 nhanh nhất lúc hiện đáp án: tên, thời gian (ms), điểm; còn lại đúng chậm hơn +1
      // thời gian trả lời: giờ TikTok gắn lúc gửi đổi sang giờ máy (cùng 1 độ lệch cho mọi bạn nên khớp thứ hạng), tính từ lúc cô hô bắt đầu.
      // Độ lệch đo được gồm cả trễ mạng ít nhất, nên số giây có thể dư chừng vài trăm mili giây
      fastest: this.correct.slice(0, GAME.fastestShown).map(({ username, nickname, points, createTime }) => ({
        username,
        nickname,
        points,
        ms: Math.max(0, Math.round(createTime + this.clockSkew - this.answerStartAt)),
      })),
      laterCount: Math.max(0, this.correct.length - GAME.fastestShown),
      laterPoints: GAME.latePoints * (this.golden ? 2 : 1),
      correctCount: this.correct.length,
      seats: seated.slice(0, GAME.seats).map(pub),
      standing: seated.slice(GAME.seats).map(pub), // không có ghế: đứng ngoài cửa hóng, vẫn tính điểm
      sessionTop: this.sessionTop(5).map(({ username, nickname, session }) => ({ username, nickname, session })),
      champions: this.champions.slice(0, 5).map((c) => ({ ...c, times: this.champions.filter((x) => x.username === c.username).length })),
      classSize: this.students.size,
      // trang phục cô Ngân: bộ của tiết, đang chơi game lớn thì bộ của game
      outfit: this.show ? this.show.kind : this.outfit,
      nextShow: this.nextShow(),
      show: this.showView(),
      // thi đua tổ (tắt chọn tổ thì rỗng)
      teams: GAME.teamPickSec > 0 ? this.teamStats(now) : [],
      teamWin: this.lastTeamWin,
      // giờ chọn tổ: số bạn chưa có tổ (hết giờ cô xếp)
      noTeam: this.phase === 'team' ? [...this.students.values()].filter((s) => !s.team).length : 0,
      // sĩ số: bạn đang ngồi trong lớp / bạn còn tương tác (10 phút) mà chưa có ghế, đang chờ vào lớp
      roster: (() => {
        const inClass = Math.min(GAME.seats, seated.length);
        let active = 0;
        for (const s of this.students.values()) if (now - s.lastActive <= GAME.seatActiveMs) active++;
        const activeSeated = seated.slice(0, GAME.seats).filter((s) => now - s.lastActive <= GAME.seatActiveMs).length;
        return { seated: inClass, seats: GAME.seats, waiting: Math.max(0, active - activeSeated) };
      })(),
      stats: this.stats,
      flowers: this.flowers,
      // quỹ hoa hôm nay: số bông, mốc đang hướng tới, vừa đạt mốc (pháo hoa 8 giây)
      fund: {
        today: this.flowersToday,
        goal: GAME.flowerGoals.find((g) => g > this.flowersToday) ?? GAME.flowerGoals[GAME.flowerGoals.length - 1],
        party: this.fundParty && now - this.fundParty.at < 8000 ? this.fundParty.goal : 0,
      },
      // quà cô đã nhận trong buổi (để trên bàn sau lưng cô): bậc của từng món, mới nhất sau cùng
      gifts: this.giftPile,
      lastFlowerAt: this.lastFlowerAt,
      clapping: now < this.clapUntil,
      recess: r && {
        game: r.game,
        stage: r.stage,
        rpsCounts: (Object.keys(RPS) as Rps[]).map((k) => [...r.rps.values()].filter((v) => v === k).length),
        teacher: r.teacher ? RPS[r.teacher] : '',
        callName: r.callTarget?.nickname ?? '',
        callUser: r.callTarget?.username ?? '',
        callClue: r.callQ ? `${r.callQ.kind} ${r.callQ.clue}` : '',
        callTiles: r.callTiles,
        callSlots: this.slotsOf(r.callQ, new Set(), r.stage !== 'play'),
        callResult: r.callResult,
        pick: r.pick,
        votes: [[...r.votes.values()].filter((v) => v === 1).length, [...r.votes.values()].filter((v) => v === 2).length],
        roll: r.roll.slice(0, GAME.rollWinners).map((a) => a.nickname),
        hearts: r.hearts,
        heartTarget: GAME.heartTarget,
      },
    };
  }
}

export type ClassView = ReturnType<Classroom['view']>;
