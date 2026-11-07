const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const { WebSocketServer } = require('ws');
// Shared TikTok Live plumbing (packages/live-core): connection with auto-reconnect, local ZeroTTS worker,
// viewer-text safety, and "only one stage speaks".
const { createLiveConnection } = require('../../packages/live-core/src/tiktok.js');
const { createZeroTts } = require('../../packages/live-core/src/zerotts.js');
const { cleanName, cleanSpeech, cleanComment, containsBanned, isStrangeSpam } = require('../../packages/live-core/src/text.js');
const { createSpeakerElection } = require('../../packages/live-core/src/speaker.js');
const { createEngagement } = require('./engagement.js');

function createTempleServer(options = {}) {
const PORT = Number(options.port || process.env.PORT || 3000);
const HOST = options.host || process.env.HOST || 'localhost';
const RESOURCE_DIR = options.resourceDir || process.env.APP_RESOURCE_DIR || path.resolve(__dirname, '..', '..');
const DATA_DIR = options.dataDir || process.env.APP_DATA_DIR || path.join(RESOURCE_DIR, 'data');
const TTS_CACHE_DIR = path.join(DATA_DIR, 'tts-cache');
const STATE_FILE = path.join(DATA_DIR, 'merit-state.json');
const TTS_WORKER_PATH = path.join(RESOURCE_DIR, 'tts_worker.py');
const ZERO_TTS_BIN = options.zeroTtsBin || process.env.ZERO_TTS_BIN || null;
const SHUTDOWN_TOKEN = options.shutdownToken !== undefined ? options.shutdownToken : (process.env.TEMPLE_SHUTDOWN_TOKEN || null);
const STANDALONE = options.standalone !== false;
const ALLOWED_PORTS = [PORT, ...(options.allowedPorts || [])];

fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });

// ============================================================================
// 1. BỘ 18 QUẺ LINH XĂM CHÙA LINH ỨNG (FORTUNE STICKS DECK)
// ============================================================================
const FORTUNE_DECK = [
  {
    number: 1,
    rank: 'Thượng Thượng Cát',
    title: 'Nhật Xuất Đông Phương — Mặt Trời Mọc Phương Đông',
    poem: 'Đông phương nhật xuất chiếu Càn Khôn\nHoa nở đầy cành rạng sắc xuân\nCông danh tài lộc đều viên mãn\nGia đạo bình an phúc lộc tồn.',
    meaning: 'Mọi sự mưu cầu đều đại cát đại lợi. Công việc hanh thông, quý nhân phù trợ, gia đình hòa thuận ấm êm.',
    ttsSummary: 'Quẻ số 1, Thượng Thượng Cát, Nhật Xuất Đông Phương. Mọi sự mưu cầu đều đại cát đại lợi, công danh tài lộc viên mãn, quý nhân phù trợ.'
  },
  {
    number: 8,
    rank: 'Thượng Cát',
    title: 'Kim Liên Khai Nở — Sen Vàng Tỏa Ngát',
    poem: 'Sen vàng nở rộ giữa hồ trong\nHương thơm lan tỏa khắp non sông\nLòng thành thắp nén nhang cầu nguyện\nTrời Phật chứng tri thỏa ước mong.',
    meaning: 'Tâm thiện lành ắt gặp phước báu. Cầu tài đắc tài, cầu bình an đắc bình an, bệnh tật tiêu trừ.',
    ttsSummary: 'Quẻ số 8, Thượng Cát, Kim Liên Khai Nở. Tâm thiện lành ắt gặp phước báu, cầu tài đắc tài, cầu bình an đắc bình an.'
  },
  {
    number: 12,
    rank: 'Đại Cát',
    title: 'Long Vân Tương Hội — Rồng Mây Gặp Gỡ',
    poem: 'Rồng thiêng gặp hội tầng mây xanh\nVượt Vũ Môn Quan rạng rỡ danh\nThí chủ kiên tâm hành thiện đạo\nPhúc dày lộc vượng khắp gia đình.',
    meaning: 'Thời vận đang lên mạnh mẽ. Thi cử đỗ đạt, kinh doanh phát đạt, gặp cơ hội lớn đổi đời.',
    ttsSummary: 'Quẻ số 12, Đại Cát, Long Vân Tương Hội. Thời vận đang lên mạnh mẽ, thi cử đỗ đạt, kinh doanh phát đạt.'
  },
  {
    number: 18,
    rank: 'Thượng Cát',
    title: 'Xuân Phong Đắc Ý — Gió Xuân Thuận Buồm',
    poem: 'Thuận buồm xuôi gió vượt trùng khơi\nBến giác bình yên nắng rạng ngời\nTài lộc dồi dào nhân duyên tốt\nBốn mùa hưng thịnh rộn niềm vui.',
    meaning: 'Đi xa gặp may, buôn bán thuận lợi, tình duyên êm đẹp, người thân mạnh khỏe.',
    ttsSummary: 'Quẻ số 18, Thượng Cát, Xuân Phong Đắc Ý. Thuận buồm xuôi gió, tài lộc dồi dào, nhân duyên tốt đẹp.'
  },
  {
    number: 24,
    rank: 'Trung Cát',
    title: 'Vũ Quá Thiên Thanh — Mưa Tạnh Trời Trong',
    poem: 'Mưa qua trời lại sáng trong ngần\nGian khó lùi xa đón phúc phần\nGiữ vững lòng thành đừng nản chí\nHoa thơm trái ngọt đến mười phân.',
    meaning: 'Khó khăn cũ sắp qua đi, vận may mới đang tới. Hãy kiên nhẫn và giữ tâm bình tĩnh.',
    ttsSummary: 'Quẻ số 24, Trung Cát, Vũ Quá Thiên Thanh. Mưa qua trời lại sáng trong, gian khó lùi xa để đón phúc phần mới.'
  },
  {
    number: 36,
    rank: 'Thượng Thượng Cát',
    title: 'Phúc Tinh Cao Chiếu — Sao Phúc Chiếu Mệnh',
    poem: 'Phúc tinh rực sáng giữa đêm rằm\nTừ bi Phật độ suốt quanh năm\nTài lộc tự nhiên về gõ cửa\nTrăm điều như ý vạn điều lành.',
    meaning: 'Sao Phúc chiếu mạng, tai qua nạn khỏi, tiền tài sung túc, gia đạo hưng long.',
    ttsSummary: 'Quẻ số 36, Thượng Thượng Cát, Phúc Tinh Cao Chiếu. Sao Phúc chiếu mạng, tài lộc tự nhiên gõ cửa, trăm điều như ý.'
  },
  {
    number: 52,
    rank: 'Thượng Cát',
    title: 'Ngọc Xuất Côn Sơn — Ngọc Quý Phát Sáng',
    poem: 'Ngọc quý Côn Sơn tỏa ánh ngời\nBấy lâu rèn giũa nay gặp thời\nTri âm tương ngộ cùng nâng đỡ\nSự nghiệp thăng hoa rạng rỡ đời.',
    meaning: 'Nỗ lực bấy lâu nay sắp được đền đáp xứng đáng. Có người tốt nâng đỡ trong công việc và cuộc sống.',
    ttsSummary: 'Quẻ số 52, Thượng Cát, Ngọc Xuất Côn Sơn. Nỗ lực bấy lâu sắp được đền đáp xứng đáng, sự nghiệp thăng hoa.'
  },
  {
    number: 68,
    rank: 'Đại Cát',
    title: 'Lộc Mã Đồng Hương — Lộc Tài Cùng Tới',
    poem: 'Lộc Mã song hành đến tận nhà\nLàm ăn buôn bán nở như hoa\nTâm thành bố thí thêm công đức\nPhú quý vinh hoa khắp một nhà.',
    meaning: 'Quẻ đại lợi về tài lộc và kinh doanh. Nên làm nhiều việc thiện để phúc đức càng thêm bền vững.',
    ttsSummary: 'Quẻ số 68, Đại Cát, Lộc Mã Đồng Hương. Đại lợi về tài lộc và buôn bán, phú quý vinh hoa khắp một nhà.'
  },
  {
    number: 81,
    rank: 'Thượng Cát',
    title: 'Nguyệt Nhập Trung Thiên — Trăng Rằm Giữa Đỉnh',
    poem: 'Trăng tròn vằng vặc giữa trời thu\nSoi sáng muôn phương sạch mây mù\nTình duyên viên mãn gia đình thuận\nTâm an vạn sự chẳng ưu tư.',
    meaning: 'Tình duyên và gia đạo vô cùng tốt đẹp. Người độc thân dễ gặp ý trung nhân, gia đình thêm tin vui.',
    ttsSummary: 'Quẻ số 81, Thượng Cát, Nguyệt Nhập Trung Thiên. Tình duyên viên mãn, gia đình hòa thuận, tâm an vạn sự lành.'
  },
  {
    number: 99,
    rank: 'Thượng Thượng Cát',
    title: 'Vạn Sự Viên Thành — Cửu Cửu Đại Cát',
    poem: 'Chín tầng mây trắng ánh hào quang\nTừ bi Phật Tổ độ nhân gian\nThí chủ lòng thành dâng lễ bái\nTrọn đời trường thọ hưởng vinh khang.',
    meaning: 'Quẻ tối thượng cát tường. Sức khỏe trường thọ, công danh hiển đạt, vạn sự viên thành.',
    ttsSummary: 'Quẻ số 99, Thượng Thượng Cát, Vạn Sự Viên Thành. Quẻ tối thượng cát tường, sức khỏe trường thọ, vạn sự như ý.'
  }
];

// ============================================================================
// 2. ZEROTTS (live-core): giọng Mai Chi chạy offline. Studio có thể truyền options.zeroTts để mọi phiên
//    dùng chung MỘT worker (model nặng); khi đó chùa không tắt worker lúc đóng.
// ============================================================================
const ownsZeroTts = !options.zeroTts;
const zeroTts = options.zeroTts || createZeroTts({ resourceDir: RESOURCE_DIR, dataDir: DATA_DIR, bin: ZERO_TTS_BIN });
// Giọng đang chọn trong cài đặt của chùa (worker chỉ biết giọng mặc định).
function ttsStatus() {
  const status = zeroTts.getStatus();
  // Only called after startup (worker status arrives asynchronously), when `state` exists.
  return { ...status, voice: state.settings.ttsVoice || status.voice };
}
zeroTts.subscribe(() => broadcastNotification('tts.status', ttsStatus()));

// ============================================================================
// 3. TRẠNG THÁI CHÙA ONLINE & BẢNG VÀNG CÔNG ĐỨC
// ============================================================================
const DEFAULT_STATE = {
  totalIncense: 108,
  totalMerit: 1080,
  woodenFishHits: 360,
  bellRings: 36,
  lanternCount: 18,
  fortuneCount: 12,
  activeIncenseSticks: 9,
  haloIntensity: 0.45,
  offerings: {
    lotus: 3,
    fruit: 2,
    lamp: 2,
    dragon: 1
  },
  fishReleased: 0,
  checkIns: 0,
  chant: { count: 0, goal: 108, rounds: 0, contributors: {} },
  lamp: { likes: 0, goal: 300, lit: 0 },
  devotees: {},
  recentEvents: [],
  // Người vừa tặng quà gần nhất (mới nhất đứng đầu) — ngồi hai hàng đầu đạo tràng.
  recentDonors: [],
  // Người vừa bình luận gần đây — chỉ giữ trong bộ nhớ, ngồi ngẫu nhiên ở các hàng sau.
  recentCommenters: [],
  settings: {
    ttsEnabled: true,
    ttsVoice: 'maichi',
    bgMusicEnabled: true,
    sfxEnabled: true,
    smokeDensity: 1.0,
    autoSim: false,
    autoSimIntervalMs: 9500,
    autoGoals: true,
    background: 'chanh-dien'
  },
  tiktok: {
    connected: false,
    connecting: false,
    username: '',
    roomId: null,
    viewerCount: 0,
    lastError: null
  },
  // Thống kê của buổi live đang phát (3 thẻ dưới đáy: số lượt mỗi mức quà). Về 0 khi vào phòng live mới.
  liveSession: { roomId: null, comments: 0, hoa: 0, huong: 0, congduc: 0 }
};

// Mục tiêu cộng đồng tự co giãn theo số người xem, để phòng vắng vẫn viên mãn được
// còn phòng đông vẫn có thử thách. Biến niệm chọn trong các số có ý nghĩa nhà Phật.
const CHANT_LADDER = [21, 27, 54, 108, 216, 540, 1080];
function goalsForAudience(viewers) {
  const audience = Math.max(1, Number(viewers) || 0);
  const target = audience * 0.8;
  const chantGoal = CHANT_LADDER.reduce((best, n) => (Math.abs(n - target) < Math.abs(best - target) ? n : best));
  const rawLamp = Math.max(100, audience * 15);
  const step = rawLamp >= 2000 ? 500 : rawLamp >= 500 ? 100 : 50;
  return { chantGoal, lampGoal: Math.round(rawLamp / step) * step };
}

// Hai hàng đầu đạo tràng có 16 chỗ cho người tặng quà; hàng sau lấy ngẫu nhiên từ nhóm người bình luận.
const MAX_RECENT_DONORS = 16;
const MAX_RECENT_COMMENTERS = 60;

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        ...DEFAULT_STATE,
        ...saved,
        devotees: saved.devotees || {},
        recentDonors: Array.isArray(saved.recentDonors) ? saved.recentDonors.slice(0, MAX_RECENT_DONORS) : [],
        recentCommenters: [],
        offerings: { ...DEFAULT_STATE.offerings, ...(saved.offerings || {}) },
        chant: { ...DEFAULT_STATE.chant, ...(saved.chant || {}), contributors: {} },
        lamp: { ...DEFAULT_STATE.lamp, ...(saved.lamp || {}) },
        settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}) },
        tiktok: { ...DEFAULT_STATE.tiktok },
        liveSession: { ...DEFAULT_STATE.liveSession, ...(saved.liveSession || {}) }
      };
    }
  } catch (e) {
    console.warn('[State] Không đọc được merit-state.json, dùng mặc định:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

let state = loadState();

let saveTimer = null;
function getPersistedState() {
  return {
    totalIncense: state.totalIncense,
    totalMerit: state.totalMerit,
    woodenFishHits: state.woodenFishHits,
    bellRings: state.bellRings,
    lanternCount: state.lanternCount,
    fortuneCount: state.fortuneCount,
    activeIncenseSticks: state.activeIncenseSticks,
    offerings: state.offerings,
    fishReleased: state.fishReleased,
    checkIns: state.checkIns,
    chant: { count: state.chant.count, goal: state.chant.goal, rounds: state.chant.rounds },
    lamp: state.lamp,
    devotees: state.devotees,
    recentDonors: state.recentDonors,
    settings: state.settings,
    liveSession: state.liveSession
  };
}

async function flushState() {
  clearTimeout(saveTimer);
  saveTimer = null;
  await fs.promises.writeFile(STATE_FILE, JSON.stringify(getPersistedState(), null, 2), 'utf8');
}

function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushState().catch((e) => {
      console.error('[State] Lỗi lưu file:', e.message);
    });
  }, 1200);
}

// Bảng vàng (đệm VIP + Top 5) chỉ xếp người đã tặng quà, theo tổng xu đã dâng.
// Bằng xu thì ai đạt mức đó trước đứng trên.
const BACKGROUND_NAMES = { 'chanh-dien': 'Chánh điện', 'dem-hoa-dang': 'Đêm hoa đăng', 'dai-dien': 'Điện Liên Hoa', 'dai-dien-3d': 'Đại Hùng Bảo Điện' };
// Bố cục riêng của nền (xem live-life.css): "hall" = tượng Phật nhỏ cuối điện, ẩn hào quang lớn;
// "hall3d" = như hall, thêm dời lư hương và 6 đệm VIP cho khớp ảnh dai-dien-3d.
const BACKGROUND_LAYOUTS = { 'dai-dien': 'hall', 'dai-dien-3d': 'hall3d' };
function listBackgrounds() {
  const list = [{ id: 'chanh-dien', name: BACKGROUND_NAMES['chanh-dien'], src: '/assets/amitabha_stage.webp', layout: 'default' }];
  try {
    const dir = path.join(RESOURCE_DIR, 'public', 'assets', 'backgrounds');
    for (const file of fs.readdirSync(dir).sort()) {
      const m = /^(.+)\.(webp|jpe?g|png)$/i.exec(file);
      if (!m) continue;
      const id = m[1].toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60);
      if (!id || list.some((bg) => bg.id === id)) continue;
      const name = BACKGROUND_NAMES[id] || m[1].replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
      list.push({ id, name, src: `/assets/backgrounds/${encodeURIComponent(file)}`, layout: BACKGROUND_LAYOUTS[id] || 'default' });
    }
  } catch (_) {}
  return list;
}

function getLeaderboard(limit = 6) {
  return Object.values(state.devotees)
    .filter((d) => (d.coins || 0) > 0)
    .sort((a, b) => b.coins - a.coins || (a.lastGiftAt || 0) - (b.lastGiftAt || 0))
    .slice(0, limit)
    .map((d, index) => ({
      rank: index + 1,
      name: d.name,
      uniqueId: d.uniqueId,
      avatar: d.avatar || '',
      coins: d.coins,
      merit: d.merit,
      incense: d.incense || 0,
      lastWish: d.lastWish || ''
    }));
}
// Bộ lọc chặn ký tự lạ (Cuneiform 𒐫, Zalgo, Braille) & từ ngữ phản cảm: dùng chung live-core/text.js.
// Từ cấm so theo cả từ (không còn bắt nhầm "vlog", "đmm" nằm trong chữ khác).
function isBlockedSpamOrToxic(raw) {
  if (!raw) return true;
  return isStrangeSpam(raw) || containsBanned(raw);
}

function sanitizeUserName(rawName) {
  return cleanName(rawName, { max: 26, fallback: 'Thí Chủ Hữu Duyên' });
}

function sanitizeWishText(rawWish) {
  return cleanSpeech(rawWish, { max: 120 });
}

function sanitizeLiveComment(rawComment) {
  const { text, safe } = cleanComment(rawComment, { max: 180 });
  return safe ? text : '';
}

function recordDevotee(user, uniqueId, avatar, meritDelta, incenseDelta = 0, giftDelta = 0, wish = '') {
  const displayName = sanitizeUserName(user || uniqueId);
  const cleanWish = sanitizeWishText(wish);
  const key = (uniqueId || displayName).slice(0, 40);
  if (!state.devotees[key]) {
    state.devotees[key] = {
      name: displayName,
      uniqueId: uniqueId || displayName.toLowerCase().replace(/\s+/g, ''),
      avatar: avatar || '',
      merit: 0,
      incense: 0,
      gifts: 0,
      lastWish: ''
    };
  }
  const dev = state.devotees[key];
  dev.name = displayName;
  if (avatar) dev.avatar = avatar;
  dev.merit += meritDelta;
  dev.incense += incenseDelta;
  dev.gifts += giftDelta;
  if (cleanWish) dev.lastWish = cleanWish;
  engagement.addMerit({ key, name: displayName, uniqueId: dev.uniqueId, avatar: dev.avatar, merit: meritDelta });

  state.totalMerit += meritDelta;
  state.haloIntensity = Math.min(1.0, 0.35 + (state.totalMerit % 1000) / 1400);
  return dev;
}

function safeAvatarUrl(avatar) {
  return /^https?:\/\//i.test(String(avatar || '')) ? String(avatar).slice(0, 512) : '';
}

// Đưa người tặng quà lên đầu danh sách (mỗi người một chỗ, chỉ giữ người mới nhất).
function noteRecentDonor(devotee, giftName, coins) {
  if (!devotee) return;
  const id = String(devotee.uniqueId || devotee.name).slice(0, 96);
  const previous = state.recentDonors.find((d) => d.id === id);
  const entry = {
    id,
    name: devotee.name,
    avatar: safeAvatarUrl(devotee.avatar),
    giftName: String(giftName || '').slice(0, 60),
    coins: (previous?.coins || 0) + Math.max(0, Number(coins) || 0),
    at: Date.now()
  };
  state.recentDonors = [entry, ...state.recentDonors.filter((d) => d.id !== id)].slice(0, MAX_RECENT_DONORS);
}

function noteRecentCommenter(id, name, avatar) {
  if (!id) return;
  const entry = { id: String(id).slice(0, 96), name, avatar: safeAvatarUrl(avatar), at: Date.now() };
  state.recentCommenters = [entry, ...state.recentCommenters.filter((c) => c.id !== entry.id)].slice(0, MAX_RECENT_COMMENTERS);
}

// ---------- Mức quà & thống kê buổi live ----------
// Mỗi lần tặng quà (cả combo tính chung theo tổng xu) rơi vào một mức, mỗi mức có hiệu ứng riêng trên sân khấu:
//   dưới 5 xu  → "hoa"     : lên dâng hoa (1 Rose)
//   5 – 9 xu   → "huong"   : lên thắp hương
//   từ 10 xu   → "congduc" : bùng nổ công đức (chuông, cả đạo tràng lạy)
// Combo đang tăng thì lên mức dần (Rose thứ 5 nâng lên thắp hương); một combo chỉ tính 1 lượt, ở mức cao nhất.
const giftCombos = new Map(); // comboId -> { coins, tier }

function giftTierOf(coins) {
  return coins >= 10 ? 'congduc' : coins >= 5 ? 'huong' : 'hoa';
}

function liveStats() {
  const s = state.liveSession;
  return { comments: s.comments || 0, hoa: s.hoa || 0, huong: s.huong || 0, congduc: s.congduc || 0 };
}

function announceLiveStats() {
  broadcastNotification('temple.liveStats', liveStats());
  saveState();
}

// Vào phòng live mới (roomId khác buổi trước): mọi bộ đếm về 0. Rớt mạng nối lại cùng phòng thì giữ.
function startLiveSession(roomId) {
  if (!roomId || state.liveSession.roomId === roomId) return;
  state.liveSession = { roomId, comments: 0, hoa: 0, huong: 0, congduc: 0 };
  giftCombos.clear();
  console.log(`[Thống kê] Buổi live mới ${roomId}: bình luận / lượt quà đếm lại từ 0`);
  announceLiveStats();
}

function countComment() {
  state.liveSession.comments = (state.liveSession.comments || 0) + 1;
  announceLiveStats();
}

// Ghi một lần tặng (hoặc combo đang tăng) vào đúng mức. Trả về { tier, tierUp }: tierUp = lượt mới hoặc vừa lên mức,
// lúc đó sân khấu chạy hiệu ứng lớn + giọng đọc; các bông tiếp theo cùng mức chỉ có hiệu ứng nhẹ.
function countGiftSend({ comboId, comboCoins, comboEnd }) {
  const coins = Math.max(1, Math.round(Number(comboCoins) || 1));
  const tier = giftTierOf(coins);
  // Cùng mã combo mà tổng xu không tăng: đó là một lần gửi mới (combo trước đã xong).
  const known = comboId ? giftCombos.get(comboId) : null;
  const prev = known && coins > known.coins ? known : null;
  const s = state.liveSession;
  const tierUp = !prev || prev.tier !== tier;
  if (prev && prev.tier !== tier) s[prev.tier] = Math.max(0, (s[prev.tier] || 0) - 1);
  if (tierUp) s[tier] = (s[tier] || 0) + 1;
  if (comboId) {
    giftCombos.delete(comboId);
    if (!comboEnd) giftCombos.set(comboId, { coins, tier });
    if (giftCombos.size > 500) giftCombos.delete(giftCombos.keys().next().value);
  }
  announceLiveStats();
  return { tier, tierUp };
}

// Đang xử lý bình luận: nghi thức sinh ra từ bình luận (xin xăm, phóng sinh, cầu nguyện...) được đánh dấu
// fromComment để sân khấu giữ người bình luận ở ghế của họ (bóng chat trên nhân vật), không kéo lên thảm đỏ.
let commentContext = false;

function pushEventLog(evt) {
  const entry = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...(commentContext ? { fromComment: true } : {}),
    ...evt
  };
  state.recentEvents.unshift(entry);
  if (state.recentEvents.length > 35) {
    state.recentEvents.length = 35;
  }
  return entry;
}

let welcomeQueue = [];
// Bình chọn 1/2/3 theo vòng 5 phút + top công đức trong giờ (src/temple/engagement.js).
// broadcast bọc try: vòng đầu tiên được tạo trước khi WebSocket server sẵn sàng.
const engagement = createEngagement({
  broadcast: (method, params) => {
    try { broadcastNotification(method, params); } catch (_) {}
  }
});
let lastWelcomeAt = 0;

function vietnamDay(ms) {
  return new Date(ms + 7 * 3600000).toISOString().slice(0, 10);
}

function foldVi(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function getPublicState() {
  return {
    totalIncense: state.totalIncense,
    totalMerit: state.totalMerit,
    woodenFishHits: state.woodenFishHits,
    bellRings: state.bellRings,
    lanternCount: state.lanternCount,
    fortuneCount: state.fortuneCount,
    activeIncenseSticks: state.activeIncenseSticks,
    haloIntensity: state.haloIntensity,
    offerings: state.offerings,
    fishReleased: state.fishReleased || 0,
    checkIns: state.checkIns || 0,
    chant: { count: state.chant.count, goal: state.chant.goal, rounds: state.chant.rounds },
    lamp: { likes: state.lamp.likes, goal: state.lamp.goal, lit: state.lamp.lit },
    leaderboard: getLeaderboard(24),
    engagement: engagement.getState(),
    recentDonors: state.recentDonors,
    recentCommenters: state.recentCommenters.slice(0, 40),
    recentEvents: state.recentEvents.slice(0, 15),
    settings: state.settings,
    tiktok: state.tiktok,
    liveStats: liveStats(),
    tts: ttsStatus()
  };
}

// ============================================================================
// 4. NGHI THỨC TƯƠNG TÁC (RITUAL HANDLERS)
// ============================================================================
// Chỉ chỉnh mục tiêu khi vòng hiện tại mới bắt đầu (hoặc vừa viên mãn), để thanh tiến độ không nhảy lùi.
function retuneGoals({ force = false } = {}) {
  if (!state.settings.autoGoals || !(state.tiktok.viewerCount > 0)) return false;
  const { chantGoal, lampGoal } = goalsForAudience(state.tiktok.viewerCount);
  let changed = false;
  if (chantGoal !== state.chant.goal && (force || state.chant.count <= state.chant.goal * 0.15)) {
    state.chant.goal = chantGoal;
    changed = true;
  }
  const lampDrift = Math.abs(lampGoal - state.lamp.goal) / state.lamp.goal;
  if (lampDrift > 0.3 && (force || state.lamp.likes <= state.lamp.goal * 0.15)) {
    state.lamp.goal = lampGoal;
    changed = true;
  }
  return changed;
}

function setViewerCount(viewerCount) {
  state.tiktok.viewerCount = viewerCount;
  broadcastNotification('temple.viewerCount', { viewerCount });
  if (retuneGoals()) broadcastNotification('temple.state', getPublicState());
}

const Rituals = {
  burnIncense(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 3));
    const wish = sanitizeWishText(params.wish) || 'Thành tâm dâng hương bái Phật, cầu bình an cát tường';
    const merit = count * 5;

    state.totalIncense += count;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + count);
    const devotee = recordDevotee(user, uniqueId, avatar, merit, count, 0, wish);

    const ttsText = params.readTts === false
      ? ''
      : `Nam mô A Di Đà Phật. Cảm tạ thí chủ ${devotee.name} đã thành tâm thắp ${count} nén hương thơm. ${wish}.`;

    const event = pushEventLog({
      type: 'burnIncense',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  strikeWoodenFish(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(50, Number(params.count) || 1));
    const merit = count;

    state.woodenFishHits += count;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0);

    const event = pushEventLog({
      type: 'strikeWoodenFish',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      ttsText: params.ttsText || ''
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  ringBell(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 1));
    const wish = sanitizeWishText(params.wish) || 'Thỉnh chuông Bát Nhã, phiền não tiêu tan, trí tuệ sáng ngời';
    const merit = count * 10;

    state.bellRings += count;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0, wish);

    const ttsText = params.readTts
      ? `Thí chủ ${devotee.name} thỉnh Đại Hồng Chung cầu nguyện: ${wish}.`
      : '';

    const event = pushEventLog({
      type: 'ringBell',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  sendPrayer(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const wish = sanitizeWishText(params.wish) || 'Cầu cho quốc thái dân an, gia đình mạnh khỏe hạnh phúc';
    const merit = 10;

    state.lanternCount += 1;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 1, 0, wish);

    const ttsText = params.readTts === false
      ? ''
      : `Lời cầu nguyện của thí chủ ${devotee.name}: ${wish}. Nam mô A Di Đà Phật.`;

    const event = pushEventLog({
      type: 'sendPrayer',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      wish,
      merit,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  offerGift(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const coins = Math.max(1, Number(params.coins) || 10);
    const requestedGiftCount = Number(params.giftCount ?? params.count);
    const giftCount = Number.isFinite(requestedGiftCount) ? Math.max(1, Math.floor(requestedGiftCount)) : 1;
    const giftType = ['lotus', 'fruit', 'lamp', 'dragon'].includes(params.giftType)
      ? params.giftType
      : (coins >= 100 ? 'dragon' : coins >= 20 ? 'fruit' : coins >= 5 ? 'lamp' : 'lotus');

    const giftLabels = {
      lotus: 'Đài Hoa Sen Vàng',
      fruit: 'Mâm Ngũ Quả Cát Tường',
      lamp: 'Đèn Lưu Ly Trí Tuệ',
      dragon: 'Đại Lễ Kim Long Chầu Phật'
    };
    const giftName = params.giftName || giftLabels[giftType];
    const multiplier = coins >= 100 ? 50 : coins >= 10 ? 30 : 20;
    const merit = Math.max(20, coins * multiplier);

    // Mức quà của cả lần gửi: TikTok gửi kèm combo (comboId, tổng xu combo); gửi thử từ bảng điều khiển
    // thì coins là cả lần gửi.
    const { tier, tierUp } = countGiftSend({
      comboId: params.comboId,
      comboCoins: params.comboCoins ?? coins,
      comboEnd: params.comboEnd ?? true
    });

    state.offerings[giftType] = (state.offerings[giftType] || 0) + 1;
    state.totalIncense += 3;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + 3);

    const wish = params.wish || `Dâng cúng ${giftName} lên Tam Bảo`;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 3, 1, wish);
    devotee.coins = (devotee.coins || 0) + coins;
    devotee.lastGiftAt = Date.now();
    noteRecentDonor(devotee, giftName, coins);

    // Combo: chỉ đọc lời cảm tạ khi lượt mới hoặc vừa lên mức (không đọc lại theo từng bông hồng).
    const ttsText = params.readTts === false || !tierUp
      ? ''
      : `Công đức vô lượng! Cảm tạ thí chủ ${devotee.name} đã phát tâm dâng cúng ${giftName}, tích thêm ${merit} điểm công đức. Nguyện cầu chư Phật gia hộ cho thí chủ vạn sự cát tường như ý.`;

    const event = pushEventLog({
      type: giftType === 'dragon' ? 'grandCeremony' : 'offerGift',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      tier,
      tierUp,
      giftType,
      giftName,
      giftCount,
      coins,
      merit,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  drawFortune(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const topic = sanitizeWishText(params.topic) || 'Gia đạo, Tài lộc và Bình an';
    const fortune = FORTUNE_DECK[Math.floor(Math.random() * FORTUNE_DECK.length)];
    const merit = 10;

    state.fortuneCount += 1;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0, `Xin xăm: Quẻ số ${fortune.number} (${fortune.rank})`);

    const ttsText = params.readTts === false
      ? ''
      : `Thí chủ ${devotee.name} vừa gieo được ${fortune.ttsSummary}`;

    const event = pushEventLog({
      type: 'drawFortune',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      topic,
      fortune,
      merit,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  grandCeremony(params = {}) {
    return this.offerGift({
      ...params,
      giftType: 'dragon',
      coins: Math.max(100, Number(params.coins) || 199),
      giftName: params.giftName || 'Đại Lễ Hào Quang Vạn Trượng'
    });
  },

  // Phóng sinh: người xem gửi tên và lời nguyện, cá chép được thả xuống hồ sen trên sân khấu.
  releaseFish(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const wish = sanitizeWishText(params.wish) || 'Phóng sinh cầu bình an, tiêu tai giải nạn';
    const merit = 15;
    state.fishReleased = (state.fishReleased || 0) + 1;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0, wish);
    const ttsText = params.readTts === false
      ? ''
      : `Thí chủ ${devotee.name} phóng sinh cá chép, nguyện: ${wish}.`;
    const event = pushEventLog({
      type: 'releaseFish',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      wish,
      merit,
      fishNumber: state.fishReleased,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });
    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  // Điểm danh lễ Phật mỗi ngày: chuỗi ngày liên tiếp được lưu theo từng người xem.
  checkIn(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const today = vietnamDay(Date.now());
    const devotee = recordDevotee(user, uniqueId, avatar, 0, 0, 0);
    if (devotee.lastCheckIn === today) {
      return { event: null, state: getPublicState() };
    }
    const yesterday = vietnamDay(Date.now() - 86400000);
    devotee.streak = devotee.lastCheckIn === yesterday ? (devotee.streak || 0) + 1 : 1;
    devotee.lastCheckIn = today;
    const merit = Math.min(30, 5 + devotee.streak * 2);
    recordDevotee(user, uniqueId, avatar, merit, 0, 0);
    state.checkIns = (state.checkIns || 0) + 1;
    const event = pushEventLog({
      type: 'checkIn',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      streak: devotee.streak,
      merit,
      ttsText: devotee.streak > 1 && devotee.streak % 3 === 0
        ? `Tùy hỷ thí chủ ${devotee.name} đã điểm danh lễ Phật ${devotee.streak} ngày liên tiếp.`
        : '',
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });
    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  // Chia sẻ buổi lễ: lan tỏa phước lành, mưa cánh sen nhỏ.
  shareBlessing(params = {}) {
    const user = sanitizeUserName(params.user);
    const devotee = recordDevotee(user, params.uniqueId || '', params.avatar || '', 5, 0, 0);
    const event = pushEventLog({
      type: 'shareBlessing',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      merit: 5,
      ttsText: ''
    });
    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  // Cả đạo tràng cùng niệm Phật: mỗi bình luận "Nam mô A Di Đà Phật" góp một biến niệm.
  addChant(params = {}) {
    const user = sanitizeUserName(params.user);
    const key = String(params.uniqueId || user).slice(0, 40);
    const chant = state.chant;
    chant.count += 1;
    if (Object.keys(chant.contributors).length < 300 || chant.contributors[key]) {
      chant.contributors[key] = { name: user, count: (chant.contributors[key]?.count || 0) + 1 };
    }
    if (chant.count < chant.goal) {
      broadcastNotification('temple.chant', { count: chant.count, goal: chant.goal, rounds: chant.rounds, user });
      return null;
    }
    const contributors = Object.entries(chant.contributors)
      .sort((a, b) => b[1].count - a[1].count);
    for (const [id, entry] of contributors) {
      recordDevotee(entry.name, id, '', 5, 0, 0);
    }
    const top = contributors.slice(0, 3).map(([, entry]) => entry.name);
    chant.rounds += 1;
    chant.count = 0;
    chant.contributors = {};
    const finishedGoal = chant.goal;
    retuneGoals({ force: true });
    const event = pushEventLog({
      type: 'chantComplete',
      user: top[0] || user,
      rounds: chant.rounds,
      goal: finishedGoal,
      participants: contributors.length,
      top,
      merit: 5,
      ttsText: `Nam mô A Di Đà Phật. Đạo tràng vừa viên mãn ${finishedGoal} biến niệm Phật, lần thứ ${chant.rounds}. Hồi hướng công đức đến ${contributors.length} thí chủ${top.length ? `, tùy hỷ ${top.join(', ')}` : ''}.`,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });
    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  // Thả tim thắp đèn: lượt thích của cả phòng đổ đầy ngọn đèn công đức.
  addLampLikes(params = {}) {
    const count = Math.max(1, Math.min(100, Number(params.count) || 1));
    const lamp = state.lamp;
    lamp.likes += count;
    if (lamp.likes < lamp.goal) {
      broadcastNotification('temple.lamp', { likes: lamp.likes, goal: lamp.goal, lit: lamp.lit });
      return null;
    }
    lamp.likes = lamp.likes % lamp.goal;
    lamp.lit += 1;
    const finishedLampGoal = lamp.goal;
    retuneGoals({ force: true });
    const event = pushEventLog({
      type: 'lampsLit',
      user: sanitizeUserName(params.user),
      lit: lamp.lit,
      goal: finishedLampGoal,
      merit: 0,
      ttsText: `Cảm tạ đại chúng đã thả tim thắp sáng ngọn đèn công đức thứ ${lamp.lit}.`,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });
    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  welcome(params = {}) {
    const now = Date.now();
    const user = sanitizeUserName(params.user);
    welcomeQueue.push(user);
    if (welcomeQueue.length > 20) welcomeQueue.shift();
    if (now - lastWelcomeAt < 1800) return null;
    lastWelcomeAt = now;
    const names = welcomeQueue.splice(0);
    broadcastNotification('temple.welcome', { user: names[names.length - 1], others: names.length - 1 });
    return null;
  },

  updateSettings(params = {}) {
    const allowed = ['ttsEnabled', 'ttsVoice', 'bgMusicEnabled', 'sfxEnabled', 'smokeDensity', 'autoSim', 'autoSimIntervalMs', 'musicVolume', 'ttsVolume', 'background'];
    const patch = Object.fromEntries(Object.entries(params).filter(([key]) => allowed.includes(key)));
    if ('background' in patch && !listBackgrounds().some((bg) => bg.id === patch.background)) delete patch.background;
    state.settings = {
      ...state.settings,
      ...patch
    };
    if (typeof params.autoSim === 'boolean') {
      configureAutoSim(params.autoSim);
    }
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  },

  setGoals(params = {}) {
    if (typeof params.autoGoals === 'boolean') state.settings.autoGoals = params.autoGoals;
    else if (params.chantGoal !== undefined || params.lampGoal !== undefined) state.settings.autoGoals = false;
    if (state.settings.autoGoals) {
      retuneGoals({ force: true });
      saveState();
      broadcastNotification('temple.state', getPublicState());
      return getPublicState();
    }
    if (params.chantGoal !== undefined) state.chant.goal = Math.max(9, Math.min(10000, Math.floor(Number(params.chantGoal) || 108)));
    if (params.lampGoal !== undefined) state.lamp.goal = Math.max(50, Math.min(1000000, Math.floor(Number(params.lampGoal) || 300)));
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  },

  // Chỉ xoá bảng xếp hạng (tổng + top giờ), giữ nguyên số hương, chuông, mục tiêu...
  resetLeaderboard() {
    state.devotees = {};
    state.recentDonors = [];
    engagement.resetHourly();
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  },

  resetMerit() {
    state.totalIncense = 9;
    state.totalMerit = 0;
    state.woodenFishHits = 0;
    state.bellRings = 0;
    state.lanternCount = 0;
    state.fortuneCount = 0;
    state.activeIncenseSticks = 3;
    state.offerings = { lotus: 1, fruit: 1, lamp: 1, dragon: 0 };
    state.fishReleased = 0;
    state.checkIns = 0;
    state.chant = { ...state.chant, count: 0, rounds: 0, contributors: {} };
    state.lamp = { ...state.lamp, likes: 0, lit: 0 };
    state.devotees = {};
    state.recentDonors = [];
    state.recentCommenters = [];
    state.recentEvents = [];
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  }
};

// ============================================================================
// 5. TIKTOK LIVE CONNECTOR & COMMENT PARSER
// ============================================================================
const commentCooldownMap = new Map();

function parseViewerComment(commentText, user, uniqueId, avatar) {
  const raw = String(commentText || '').trim();
  if (!raw || isBlockedSpamOrToxic(raw)) {
    return null;
  }

  const cleanWish = sanitizeWishText(raw);
  if (!cleanWish || cleanWish.length < 3) {
    return null;
  }

  // Chống 1 người spam bình luận liên tục làm nghẽn hàng đợi TTS (cooldown 3.5 giây/người)
  const userKey = uniqueId || user || '';
  const now = Date.now();
  if (userKey) {
    const lastTs = commentCooldownMap.get(userKey) || 0;
    if (now - lastTs < 3500) {
      return null;
    }
    commentCooldownMap.set(userKey, now);
    if (commentCooldownMap.size > 600) {
      const oldestKey = commentCooldownMap.keys().next().value;
      commentCooldownMap.delete(oldestKey);
    }
  }

  const cleanUser = sanitizeUserName(user);
  const lower = cleanWish.toLowerCase();
  const rawLower = String(commentText || '').toLowerCase();
  const folded = foldVi(rawLower);
  const has = (re) => re.test(folded);

  // Niệm Phật cộng đồng: đếm song song với nghi thức chính của bình luận.
  if (has(/nam mo|a di da|adida|mo phat/)) {
    const chantResult = Rituals.addChant({ user: cleanUser, uniqueId });
    // Bình luận chỉ có câu niệm Phật thì chỉ góp vào biến niệm chung, không thả sớ/đọc TTS từng câu.
    const rest = folded.replace(/nam ?mo|a ?di ?da ?phat|a ?di ?da|adida(phat)?|mo ?phat|\bphat\b/g, '').replace(/[^a-z0-9]+/g, '');
    if (rest.length < 3) return chantResult;
  }

  // 0. Điểm danh lễ Phật hằng ngày
  if (has(/(^|[\s#])diem ?danh\b/)) {
    const res = Rituals.checkIn({ user: cleanUser, uniqueId, avatar });
    if (res?.event) return res;
  }

  // 1. Phóng sinh cá chép
  if (has(/phong ?sinh|tha ca\b|tha ca chep/)) {
    return Rituals.releaseFish({ user: cleanUser, uniqueId, avatar, wish: cleanWish });
  }

  // 2. Xin xăm / Gieo quẻ (cụm từ rõ ràng để không bắt nhầm "quen", "quê"...)
  if (lower.includes('quẻ') || has(/xin ?xam|gieo que|rut que|xin (1|mot) que|que xam/)) {
    return Rituals.drawFortune({ user: cleanUser, uniqueId, avatar, topic: cleanWish });
  }

  // 3. Thỉnh chuông
  if (rawLower.includes('chuông') || has(/thinh ?chuong|go chuong|dong chuong/)) {
    return Rituals.ringBell({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish, readTts: true });
  }

  // 4. Gõ mõ
  if (rawLower.includes('mõ') || has(/go ?mo\b|tung kinh/)) {
    return Rituals.strikeWoodenFish({ user: cleanUser, uniqueId, avatar, count: 3 });
  }

  // 5. Thắp hương / Bái Phật
  if (has(/thap ?huong|dang ?huong|bai phat|lay phat|thap nhang/)) {
    return Rituals.burnIncense({ user: cleanUser, uniqueId, avatar, count: 3, wish: cleanWish });
  }

  // 6. Cầu nguyện / Thả đèn hoa đăng
  if (
    /cầu|nguyện|chúc|bình an|tài lộc|hoa đăng/.test(rawLower) ||
    has(/nam mo|a di da|mo phat|hoa dang/)
  ) {
    return Rituals.sendPrayer({ user: cleanUser, uniqueId, avatar, wish: cleanWish });
  }

  // Bình luận thường: chỉ hiện bóng chat trên nhân vật của người bình luận (temple.liveComment).
  // Lên thảm đỏ dâng hương / dâng hoa là phần của người tặng quà.
  return null;
}

function handleViewerComment(commentText, user, uniqueId, avatar) {
  countComment(); // thẻ "COMMENTS": mọi bình luận nhận được, kể cả bình luận bị lọc không hiện
  const comment = sanitizeLiveComment(commentText);
  const name = sanitizeUserName(user || uniqueId);
  const viewerId = String(uniqueId || name.toLowerCase().replace(/\s+/g, '')).slice(0, 96);
  if (comment) {
    const avatarUrl = safeAvatarUrl(avatar);
    noteRecentCommenter(viewerId, name, avatarUrl);
    broadcastNotification('temple.liveComment', {
      uniqueId: viewerId,
      user: name,
      avatar: avatarUrl,
      comment
    });
  }
  // "1" / "2" / "3" là phiếu bình chọn: vẫn hiện bóng chat, không chạy nghi thức nào.
  if (engagement.handleComment(viewerId, commentText)) return null;

  let result;
  commentContext = true;
  try {
    result = parseViewerComment(commentText, user, uniqueId, avatar);
  } finally {
    commentContext = false;
  }
  if (!result?.event) return result;

  const prayerComment = sanitizeWishText(commentText);
  if (!prayerComment) return result;

  const handle = String(uniqueId || '')
    .normalize('NFKC')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^A-Za-z0-9._]/g, '')
    .slice(0, 24);
  const usableHandle = handle && /[A-Za-z0-9]/.test(handle) && !containsBanned(handle);
  const username = `@${usableHandle ? handle : sanitizeUserName(user)}`;
  broadcastNotification('temple.prayerComment', { uniqueId: viewerId, username, comment: prayerComment });
  return result;
}

// Kết nối TikTok dùng chung live-core: tự kết nối lại (15 giây, gấp đôi tới 2 phút) tới khi bấm Ngắt,
// hỏi TikTok "đang LIVE chưa" trước khi vào phòng, nhận cả link chia sẻ vt.tiktok.com.
// Trong Studio, options.live là kết nối chung của Studio; Studio gọi onLiveEvent / onLiveStatus.
const live = options.live || createLiveConnection({ onEvent: handleLiveEvent, onStatus: handleLiveStatus });

function handleLiveStatus(s) {
  state.tiktok = {
    connected: s.state === 'live',
    connecting: s.state === 'connecting' || s.state === 'reconnecting',
    reconnecting: s.state === 'reconnecting',
    username: s.username,
    roomId: s.roomId,
    viewerCount: state.tiktok?.viewerCount || 0,
    lastError: s.error,
    retryInMs: s.retryInMs
  };
  if (s.state === 'live' && s.viewerCount > 0 && s.viewerCount !== state.tiktok.viewerCount) setViewerCount(s.viewerCount);
  if (s.state !== 'live') state.tiktok.viewerCount = 0;
  if (s.state === 'live' && s.roomId) startLiveSession(String(s.roomId));
  broadcastNotification('temple.state', getPublicState());
}

function handleLiveEvent(e) {
  const user = e.viewer.name;
  const uniqueId = e.viewer.id;
  const avatar = e.viewer.avatar;
  switch (e.kind) {
    case 'member':
      recordDevotee(user, uniqueId, avatar, 1, 0, 0);
      Rituals.welcome({ user });
      break;
    case 'comment':
      handleViewerComment(e.text, user, uniqueId, avatar);
      break;
    case 'like':
      Rituals.strikeWoodenFish({ user, uniqueId, avatar, count: Math.min(15, Math.max(1, e.count)) });
      Rituals.addLampLikes({ user, count: e.count });
      break;
    case 'follow':
      Rituals.ringBell({ user, uniqueId, avatar, count: 1, wish: 'Hữu duyên tương ngộ nơi cửa Phật, cầu bình an may mắn', readTts: false });
      break;
    case 'share':
      Rituals.shareBlessing({ user, uniqueId, avatar });
      break;
    case 'gift': {
      const giftName = e.count > 1 ? `${e.count}x ${e.name}` : e.name;
      console.log(`[TikTok Gift] ${user} gửi ${giftName} (${e.coins} xu)`);
      Rituals.offerGift({
        user,
        uniqueId,
        avatar,
        coins: e.coins,
        giftName,
        giftCount: e.count,
        comboId: e.comboId,
        // tổng xu của cả combo tới giờ = giá 1 món × số món đã gửi trong combo
        comboCoins: Math.round((e.coins / Math.max(1, e.count)) * Math.max(e.count, Number(e.comboTotal) || e.count)),
        comboEnd: e.comboEnd,
        wish: `Thành tâm dâng ${giftName} kính lễ Đức Phật A Di Đà`
      });
      break;
    }
  }
}

async function connectTikTokLive(usernameOrUrl) {
  await live.connect(usernameOrUrl);
  return state.tiktok;
}

async function disconnectTikTokLive() {
  await live.disconnect();
  return state.tiktok;
}

// "Phần" đang diễn ra (cho báo cáo người xem theo từng phần): nghi thức gần nhất trong 30 giây, không thì chờ.
function currentPhase() {
  const latest = state.recentEvents[0];
  if (latest && Date.now() - Date.parse(latest.timestamp) < 30_000) return latest.type || 'ritual';
  return 'idle';
}

// ============================================================================
// 6. AUTO-SIMULATION ENGINE (CHẾ ĐỘ TỰ ĐỘNG GIẢ LẬP ĐÔNG NGƯỜI XEM)
// ============================================================================
let autoSimTimer = null;
const SIM_DEVOTEES = [
  { user: 'Ngọc Anh Nguyễn', uniqueId: 'ngocanh.98', wish: 'Con thành tâm cầu cho bố mẹ luôn mạnh khỏe, bình an' },
  { user: 'Trần Minh Quân', uniqueId: 'minhquan_bds', wish: 'Cầu tháng mới công việc thuận buồm xuôi gió, tài lộc hanh thông' },
  { user: 'Diệu Thảo Tâm An', uniqueId: 'tam_an_99', wish: 'Nam Mô A Di Đà Phật, nguyện cầu thế giới hòa bình chúng sinh an lạc' },
  { user: 'Lê Hoàng Nam', uniqueId: 'hoangnam.dev', wish: 'Cầu thi cử đỗ đạt điểm cao, sự nghiệp rộng mở' },
  { user: 'Phạm Thanh Hà', uniqueId: 'thanhha.lotus', wish: 'Cầu gia đạo êm ấm, con cái ngoan ngoãn học giỏi' },
  { user: 'Vũ Đức Thịnh', uniqueId: 'ducthinh88', wish: 'Con xin gieo một quẻ cầu tài lộc đầu năm' }
];

function runSingleSimulationStep() {
  const pick = SIM_DEVOTEES[Math.floor(Math.random() * SIM_DEVOTEES.length)];
  const roll = Math.random();
  if (roll < 0.12) {
    handleViewerComment('Nam mô A Di Đà Phật', pick.user, pick.uniqueId, '');
    return;
  }
  if (roll < 0.2) {
    Rituals.releaseFish({ user: pick.user, uniqueId: pick.uniqueId, wish: pick.wish });
    return;
  }
  if (roll < 0.25) {
    Rituals.checkIn({ user: pick.user, uniqueId: pick.uniqueId });
    return;
  }
  Rituals.addLampLikes({ user: pick.user, count: 15 });
  if (roll < 0.30) {
    Rituals.burnIncense({ user: pick.user, uniqueId: pick.uniqueId, count: 3, wish: pick.wish });
  } else if (roll < 0.55) {
    Rituals.sendPrayer({ user: pick.user, uniqueId: pick.uniqueId, wish: pick.wish });
  } else if (roll < 0.75) {
    Rituals.drawFortune({ user: pick.user, uniqueId: pick.uniqueId, topic: pick.wish });
  } else if (roll < 0.90) {
    Rituals.offerGift({ user: pick.user, uniqueId: pick.uniqueId, giftType: 'lotus', coins: 15, giftName: 'Hoa Sen Vàng Tinh Khiết' });
  } else {
    Rituals.ringBell({ user: pick.user, uniqueId: pick.uniqueId, count: 1, wish: pick.wish, readTts: true });
  }
}

function configureAutoSim(enabled) {
  state.settings.autoSim = Boolean(enabled);
  if (autoSimTimer) {
    clearInterval(autoSimTimer);
    autoSimTimer = null;
  }
  if (state.settings.autoSim) {
    runSingleSimulationStep();
    autoSimTimer = setInterval(runSingleSimulationStep, state.settings.autoSimIntervalMs || 9500);
  }
}

// ============================================================================
// 7. JSON-RPC 2.0 DISPATCHER
// ============================================================================
async function handleRpcCall(method, params = {}) {
  switch (method) {
    case 'temple.getState':
      return getPublicState();
    case 'temple.burnIncense':
      return Rituals.burnIncense(params);
    case 'temple.strikeWoodenFish':
      return Rituals.strikeWoodenFish(params);
    case 'temple.ringBell':
      return Rituals.ringBell(params);
    case 'temple.sendPrayer':
      return Rituals.sendPrayer(params);
    case 'temple.offerGift':
      return Rituals.offerGift(params);
    case 'temple.drawFortune':
      return Rituals.drawFortune(params);
    case 'temple.grandCeremony':
      return Rituals.grandCeremony(params);
    case 'temple.releaseFish':
      return Rituals.releaseFish(params);
    case 'temple.checkIn':
      return Rituals.checkIn(params);
    case 'temple.shareBlessing':
      return Rituals.shareBlessing(params);
    case 'temple.like':
      Rituals.strikeWoodenFish({ ...params, count: Math.min(15, Math.max(1, Number(params.count) || 1)) });
      return Rituals.addLampLikes(params) || getPublicState();
    case 'temple.join':
      Rituals.welcome(params);
      return getPublicState();
    case 'temple.setGoals':
      return Rituals.setGoals(params);
    case 'temple.setViewerCount':
      setViewerCount(Math.max(0, Math.floor(Number(params.viewerCount) || 0)));
      return getPublicState();
    case 'temple.updateSettings':
      return Rituals.updateSettings(params);
    case 'temple.resetMerit':
      return Rituals.resetMerit();
    case 'temple.resetLeaderboard':
      return Rituals.resetLeaderboard();
    case 'temple.comment':
      return handleViewerComment(params.comment, params.user, params.uniqueId, params.avatar);
    case 'temple.speak': {
      const res = await zeroTts.synthesize(params.text, params.voice || 'maichi');
      if (res.ok && params.broadcast !== false) {
        broadcastNotification('tts.play', {
          text: params.text,
          voice: res.voice,
          url: res.url
        });
      }
      return res;
    }
    case 'temple.ttsStatus':
      return ttsStatus();
    case 'live.connect':
      return await connectTikTokLive(params.username);
    case 'live.disconnect':
      return disconnectTikTokLive();
    case 'live.setAutoSim':
      configureAutoSim(Boolean(params.enabled));
      saveState();
      broadcastNotification('temple.state', getPublicState());
      return getPublicState();
    default:
      throw new Error(`Không tìm thấy phương thức JSON-RPC: ${method}`);
  }
}

// ============================================================================
// 8. EXPRESS + WEBSOCKET SERVER
// ============================================================================
const app = express();
const allowedOrigins = new Set(ALLOWED_PORTS.flatMap((port) => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
  `http://tauri.localhost`,
  `tauri://localhost`
]));
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  }
}));
app.use(express.json({ limit: '2mb' }));
app.use('/tts-cache', express.static(zeroTts.cacheDir, { maxAge: '7d' }));
app.use(express.static(path.join(RESOURCE_DIR, 'public')));
// Shared browser modules (speaker election) from packages/live-core/browser
app.use('/live-core', express.static(path.join(RESOURCE_DIR, 'packages', 'live-core', 'browser'), { maxAge: 0 }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, pid: process.pid });
});

// Hình nền sân khấu: nền gốc + mọi ảnh trong public/assets/backgrounds/ (ảnh 1080x1920, cùng bố cục với nền gốc).
// Nền đang chọn lưu ở state.settings.background, đổi qua temple.updateSettings({ background: id }).
app.get('/api/backgrounds', (_req, res) => {
  res.json({ backgrounds: listBackgrounds(), current: state.settings.background || 'chanh-dien' });
});

// Ảnh mặt người do AI tạo (không phải người thật) cho nhân vật ảo / người xem không có ảnh TikTok.
// Chỉ cần thả file .jpg/.png/.webp vào public/assets/avatars/ai/, không phải khai báo gì thêm.
const AI_AVATAR_DIR = path.join(RESOURCE_DIR, 'public', 'assets', 'avatars', 'ai');
app.get('/api/ai-avatars', async (_req, res) => {
  try {
    const files = await fs.promises.readdir(AI_AVATAR_DIR);
    const urls = files
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort()
      .map((f) => `/assets/avatars/ai/${encodeURIComponent(f)}`);
    res.json({ urls });
  } catch {
    res.json({ urls: [] });
  }
});

app.post('/api/shutdown', (req, res) => {
  const provided = Buffer.from(req.get('x-temple-shutdown-token') || '');
  const expected = Buffer.from(SHUTDOWN_TOKEN || '');
  const tokenMatches = expected.length > 0
    && provided.length === expected.length
    && crypto.timingSafeEqual(provided, expected);
  if (!tokenMatches) {
    return res.status(403).json({ ok: false, error: 'Invalid shutdown token' });
  }

  res.once('finish', () => {
    gracefulShutdown().catch((err) => {
      console.error('[Shutdown] Cleanup failed:', err.message);
      process.exitCode = 1;
    });
  });
  res.status(202).json({ ok: true });
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(RESOURCE_DIR, 'public', 'admin.html'));
});

// HTTP JSON-RPC 2.0 Endpoint
app.post('/rpc', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {};
  if (!method) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'Invalid JSON-RPC Request: thiếu method' }
    });
  }
  try {
    const result = await handleRpcCall(method, params || {});
    res.json({
      jsonrpc: jsonrpc || '2.0',
      id: id ?? null,
      result
    });
  } catch (err) {
    res.status(200).json({
      jsonrpc: jsonrpc || '2.0',
      id: id ?? null,
      error: { code: -32000, message: err.message || 'Server error' }
    });
  }
});

// ZeroTTS HTTP Endpoint (Mai Chi default)
app.all('/api/tts', async (req, res) => {
  const text = (req.body?.text || req.query?.text || '').trim();
  const voice = (req.body?.voice || req.query?.voice || state.settings.ttsVoice || 'maichi').trim();
  if (!text) {
    return res.status(400).json({ ok: false, error: 'Thiếu nội dung text cần đọc' });
  }
  const result = await zeroTts.synthesize(text, voice);
  res.json(result);
});

app.get('/api/state', (_req, res) => {
  res.json(getPublicState());
});

const server = http.createServer(app);
const wss = STANDALONE
  ? new WebSocketServer({ server, path: '/ws' })
  : new WebSocketServer({ noServer: true });
const election = createSpeakerElection({ broadcast: broadcastNotification });
let shutdownPromise = null;
let stageSeq = 0;

function gracefulShutdown() {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    if (autoSimTimer) {
      clearInterval(autoSimTimer);
      autoSimTimer = null;
    }
    engagement.stop();

    if (!options.live) await disconnectTikTokLive();
    if (ownsZeroTts) await zeroTts.stop();
    try {
      await flushState();
    } catch (err) {
      console.error('[Shutdown] State save failed:', err.message);
    }

    for (const client of wss.clients) {
      client.terminate();
    }
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  })();

  return shutdownPromise;
}

function broadcastNotification(method, params) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    method,
    params
  });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws, req) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    ws.close(1008, 'Origin not allowed');
    return;
  }

  ws.send(
    JSON.stringify({
      jsonrpc: '2.0',
      method: 'temple.state',
      params: getPublicState()
    })
  );

  // Chỉ MỘT trang sân khấu đọc giọng (trang mở sau cùng): 2 nguồn OBS không còn đọc chồng giọng.
  const voiceId = `s${++stageSeq}`;
  const role = new URL(req.url || '/ws', 'http://localhost').searchParams.get('role');
  const sendTo = (method, params) => { if (ws.readyState === 1) ws.send(JSON.stringify({ jsonrpc: '2.0', method, params })); };
  if (role === 'stage') election.join(voiceId, sendTo);
  else sendTo('stage.speaker', election.describe());
  ws.on('close', () => election.leave(voiceId));

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString('utf8'));
    } catch (_) {
      return;
    }
    if (!msg || !msg.method) return;
    try {
      const result = await handleRpcCall(msg.method, msg.params || {});
      if (msg.id !== undefined) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result
          })
        );
      }
    } catch (err) {
      if (msg.id !== undefined) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32000, message: err.message || 'RPC Error' }
          })
        );
      }
    }
  });
});

function listen() {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, () => {
      console.log(`============================================================`);
      console.log(`🪷 CHÙA ONLINE TIKTOK LIVE RPC ĐÃ KHỞI ĐỘNG`);
      console.log(`📺 Màn hình Live (9:16 OBS): http://localhost:${PORT}`);
      console.log(`🎛️ Bảng điều khiển RPC Admin: http://localhost:${PORT}/admin`);
      console.log(`🔌 JSON-RPC 2.0 Endpoint   : http://localhost:${PORT}/rpc (ws://localhost:${PORT}/ws)`);
      console.log(`============================================================`);
      const defaultChannel = process.env.TIKTOK_USER;
      if (defaultChannel) {
        connectTikTokLive(defaultChannel).catch((err) => {
          console.warn(`[Auto-Connect @${defaultChannel}] Chưa kết nối được ngay:`, err.message);
        });
      }
      resolve({ host: HOST, port: PORT });
    });
  });
}

// Studio session lifecycle: pause timers and the live room without discarding merit state.
async function deactivate() {
  if (autoSimTimer) {
    clearInterval(autoSimTimer);
    autoSimTimer = null;
  }
  // Kết nối chung của Studio: giữ nguyên. Kết nối riêng: trả phòng cho phiên kế tiếp và dừng tự nối lại.
  const username = options.live ? '' : live.getWanted();
  if (!options.live) await disconnectTikTokLive();
  for (const client of wss.clients) client.close(1012, 'Session switched');
  try { await flushState(); } catch (err) { console.error('[State] Lỗi lưu file:', err.message); }
  return { username };
}

function activate() {
  if (state.settings.autoSim) configureAutoSim(true);
}

function handleUpgrade(req, socket, head) {
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
}

return {
  app,
  wss,
  server,
  listen,
  shutdown: gracefulShutdown,
  activate,
  deactivate,
  handleUpgrade,
  connectLive: (username) => connectTikTokLive(username),
  onLiveEvent: handleLiveEvent,
  onLiveStatus: handleLiveStatus,
  getPhase: currentPhase,
  getStatus: () => ({ live: { ...state.tiktok }, tts: ttsStatus() }),
  getState: () => getPublicState()
};
}

module.exports = { createTempleServer };
