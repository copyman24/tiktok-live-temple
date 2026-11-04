const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');

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
// 2. ZEROTTS PYTHON WORKER MANAGER (VOICE: MAI CHI)
// ============================================================================
class ZeroTTSManager {
  constructor() {
    this.proc = null;
    this.ready = false;
    this.status = 'starting';
    this.voice = 'maichi';
    this.voices = ['maichi'];
    this.model = 'zeroweight-ai/ZeroTTS';
    this.pending = new Map();
    this.inflight = new Map();
    this.reqCounter = 0;
    this.buffer = '';
    this.stopPromise = null;
    this.startWorker();
  }

  resolveWorkerCommand() {
    if (ZERO_TTS_BIN) {
      return { command: ZERO_TTS_BIN, args: [] };
    }

    const venvPy = process.platform === 'win32'
      ? path.join(RESOURCE_DIR, '.venv', 'Scripts', 'python.exe')
      : path.join(RESOURCE_DIR, '.venv', 'bin', 'python');
    if (fs.existsSync(venvPy)) {
      return { command: venvPy, args: [TTS_WORKER_PATH] };
    }

    return {
      command: process.platform === 'win32' ? 'python' : 'python3',
      args: [TTS_WORKER_PATH]
    };
  }

  startWorker() {
    const worker = this.resolveWorkerCommand();
    console.log(`[ZeroTTS] Khởi chạy worker với ${worker.command} (Giọng mặc định: Mai Chi)...`);

    this.status = 'loading';
    this.proc = spawn(worker.command, worker.args, {
      cwd: RESOURCE_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        APP_DATA_DIR: DATA_DIR,
        HF_HOME: process.env.HF_HOME || path.join(DATA_DIR, 'models')
      }
    });
    const proc = this.proc;

    proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      let lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        this.handleWorkerLine(line.trim());
      }
    });

    proc.stderr.on('data', (chunk) => {
      const msg = chunk.toString('utf8').trim();
      if (msg) console.log(`[ZeroTTS stderr] ${msg}`);
    });

    proc.on('error', (err) => {
      console.error('[ZeroTTS] Worker failed to start:', err.message);
      this.ready = false;
      this.status = 'error';
      if (this.proc === proc) this.proc = null;
      for (const [, item] of this.pending) {
        clearTimeout(item.timer);
        item.resolve({ ok: false, error: 'ZeroTTS worker failed to start' });
      }
      this.pending.clear();
      broadcastNotification('tts.status', this.getStatus());
    });

    proc.on('exit', (code) => {
      console.warn(`[ZeroTTS] Worker thoát với mã ${code}`);
      this.ready = false;
      this.status = 'stopped';
      if (this.proc === proc) this.proc = null;
      for (const [, item] of this.pending) {
        clearTimeout(item.timer);
        item.resolve({ ok: false, error: 'ZeroTTS worker exited' });
      }
      this.pending.clear();
    });
  }

  stop() {
    if (this.stopPromise) return this.stopPromise;
    const proc = this.proc;
    if (!proc || proc.exitCode !== null || proc.signalCode !== null) {
      this.proc = null;
      return Promise.resolve();
    }

    this.ready = false;
    this.status = 'stopping';
    this.stopPromise = new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.proc === proc) proc.kill();
      }, 5000);
      timer.unref?.();

      const finish = () => {
        clearTimeout(timer);
        if (this.proc === proc) this.proc = null;
        resolve();
      };
      proc.once('exit', () => {
        finish();
      });
      proc.once('error', finish);

      proc.stdin.end();
    });
    return this.stopPromise;
  }

  handleWorkerLine(line) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === 'status') {
        this.status = msg.status;
        this.model = msg.model || this.model;
        broadcastNotification('tts.status', this.getStatus());
      } else if (msg.type === 'ready') {
        this.ready = true;
        this.status = 'ready';
        this.voice = msg.voice || 'maichi';
        this.voices = msg.voices || ['maichi'];
        this.model = msg.model || this.model;
        console.log(`[ZeroTTS] Sẵn sàng sau ${msg.loadSec}s! Giọng: ${this.voice} (${this.voices.join(', ')})`);
        broadcastNotification('tts.status', this.getStatus());
      } else if (msg.type === 'result' && msg.id != null) {
        const entry = this.pending.get(msg.id);
        if (entry) {
          clearTimeout(entry.timer);
          this.pending.delete(msg.id);
          entry.resolve(msg);
        }
      } else if (msg.type === 'error') {
        console.error('[ZeroTTS Error]', msg.error);
        this.status = 'error';
        broadcastNotification('tts.status', this.getStatus());
      }
    } catch (err) {
      console.log('[ZeroTTS stdout]', line);
    }
  }

  getStatus() {
    return {
      ready: this.ready,
      status: this.status,
      engine: 'ZeroTTS (zeroweight-ai/ZeroTTS)',
      voice: state.settings.ttsVoice || this.voice || 'maichi',
      voices: this.voices,
      model: this.model
    };
  }

  synthesize(text, voiceOverride) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return Promise.resolve({ ok: false, error: 'Empty text' });
    const voice = (voiceOverride || state.settings.ttsVoice || 'maichi').toLowerCase();
    const dedupKey = `${voice}::${cleanText}`;

    if (this.inflight.has(dedupKey)) {
      return this.inflight.get(dedupKey);
    }

    const promise = new Promise((resolve) => {
      if (!this.proc || !this.ready) {
        return resolve({ ok: false, error: `ZeroTTS đang ở trạng thái: ${this.status}` });
      }
      const id = ++this.reqCounter;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: 'ZeroTTS synthesis timeout' });
      }, 30000);

      this.pending.set(id, { resolve, timer });
      const payload = JSON.stringify({ id, text: cleanText, voice }) + '\n';
      this.proc.stdin.write(payload);
    }).finally(() => {
      this.inflight.delete(dedupKey);
    });

    this.inflight.set(dedupKey, promise);
    return promise;
  }
}

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
  settings: {
    ttsEnabled: true,
    ttsVoice: 'maichi',
    bgMusicEnabled: true,
    sfxEnabled: true,
    smokeDensity: 1.0,
    autoSim: false,
    autoSimIntervalMs: 9500,
    autoGoals: true
  },
  tiktok: {
    connected: false,
    connecting: false,
    username: '',
    roomId: null,
    viewerCount: 0,
    lastError: null
  }
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

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        ...DEFAULT_STATE,
        ...saved,
        devotees: saved.devotees || {},
        offerings: { ...DEFAULT_STATE.offerings, ...(saved.offerings || {}) },
        chant: { ...DEFAULT_STATE.chant, ...(saved.chant || {}), contributors: {} },
        lamp: { ...DEFAULT_STATE.lamp, ...(saved.lamp || {}) },
        settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}) },
        tiktok: { ...DEFAULT_STATE.tiktok }
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
    settings: state.settings
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

function getLeaderboard(limit = 6) {
  return Object.values(state.devotees)
    .sort((a, b) => b.merit - a.merit)
    .slice(0, limit)
    .map((d, index) => ({
      rank: index + 1,
      name: d.name,
      uniqueId: d.uniqueId,
      avatar: d.avatar || '',
      merit: d.merit,
      incense: d.incense || 0,
      lastWish: d.lastWish || ''
    }));
}
// Bộ lọc chặn ký tự lạ (Cuneiform 𒐫, Zalgo, Braille, ký tự spam) & từ ngữ phản cảm
const WEIRD_SPAM_RE = /[\u{12000}-\u{1254F}\uFDFD\u2800-\u28FF\u2580-\u259F]|[\u0300-\u036F]{3,}/u;
const BRACKET_EMOTE_RE = /\[[^\]]{1,24}\]/g;
const ALLOWED_VI_TEXT_RE = /[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ\s.,!?]/g;
const ALLOWED_VI_NAME_RE = /[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ\s._-]/g;
const VI_LETTER_RE = /[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]/g;
const BAD_WORDS_RE = /(đá dái|địt|lồn|cặc|đm|vcl|vl|yamate|i cư|lừa đảo|lừa à|te-le gram|telegram|bố là trùm)/i;

function isBlockedSpamOrToxic(raw) {
  if (!raw) return true;
  const s = String(raw);
  if (WEIRD_SPAM_RE.test(s)) return true;
  if (BAD_WORDS_RE.test(s)) return true;
  return false;
}

function sanitizeUserName(rawName) {
  const normalized = String(rawName || '')
    .normalize('NFKC')
    .normalize('NFC')
    .replace(BRACKET_EMOTE_RE, ' ')
    .replace(ALLOWED_VI_NAME_RE, ' ')
    .replace(/(.)\1{3,}/gi, '$1$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 26);

  if (!normalized || BAD_WORDS_RE.test(normalized)) {
    return 'Thí Chủ Hữu Duyên';
  }
  const letters = normalized.match(VI_LETTER_RE) || [];
  if (letters.length < 2) {
    return 'Thí Chủ Hữu Duyên';
  }
  return normalized;
}

function sanitizeWishText(rawWish) {
  if (!rawWish) return '';
  const cleaned = String(rawWish)
    .normalize('NFKC')
    .normalize('NFC')
    .replace(BRACKET_EMOTE_RE, ' ')
    .replace(ALLOWED_VI_TEXT_RE, ' ')
    .replace(/([.,!?])\1+/g, '$1')
    .replace(/(.)\1{2,}/gi, '$1$1')
    .replace(/\s+/g, ' ')
    .replace(/^[.,!?\s-]+|[.,!?\s-]+$/g, '')
    .slice(0, 120);

  if (!cleaned || BAD_WORDS_RE.test(cleaned)) return '';
  const letters = cleaned.match(VI_LETTER_RE) || [];
  if (letters.length < 2) return '';
  return cleaned;
}

function sanitizeLiveComment(rawComment) {
  const comment = String(rawComment || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  return comment && !isBlockedSpamOrToxic(comment) ? comment : '';
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

  state.totalMerit += meritDelta;
  state.haloIntensity = Math.min(1.0, 0.35 + (state.totalMerit % 1000) / 1400);
  return dev;
}

function pushEventLog(evt) {
  const entry = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...evt
  };
  state.recentEvents.unshift(entry);
  if (state.recentEvents.length > 35) {
    state.recentEvents.length = 35;
  }
  return entry;
}

let welcomeQueue = [];
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
    recentEvents: state.recentEvents.slice(0, 15),
    settings: state.settings,
    tiktok: state.tiktok,
    tts: zeroTts ? zeroTts.getStatus() : { ready: false, status: 'init', voice: 'maichi' }
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

    state.offerings[giftType] = (state.offerings[giftType] || 0) + 1;
    state.totalIncense += 3;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + 3);

    const wish = params.wish || `Dâng cúng ${giftName} lên Tam Bảo`;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 3, 1, wish);

    const ttsText = params.readTts === false
      ? ''
      : `Công đức vô lượng! Cảm tạ thí chủ ${devotee.name} đã phát tâm dâng cúng ${giftName}, tích thêm ${merit} điểm công đức. Nguyện cầu chư Phật gia hộ cho thí chủ vạn sự cát tường như ý.`;

    const event = pushEventLog({
      type: giftType === 'dragon' ? 'grandCeremony' : 'offerGift',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
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
    const allowed = ['ttsEnabled', 'ttsVoice', 'bgMusicEnabled', 'sfxEnabled', 'smokeDensity', 'autoSim', 'autoSimIntervalMs', 'musicVolume', 'ttsVolume'];
    const patch = Object.fromEntries(Object.entries(params).filter(([key]) => allowed.includes(key)));
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
    state.recentEvents = [];
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  }
};

// ============================================================================
// 5. TIKTOK LIVE CONNECTOR & COMMENT PARSER
// ============================================================================
let tiktokConn = null;

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

  return Rituals.burnIncense({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish });
}

function handleViewerComment(commentText, user, uniqueId, avatar) {
  const comment = sanitizeLiveComment(commentText);
  const name = sanitizeUserName(user || uniqueId);
  const viewerId = String(uniqueId || name.toLowerCase().replace(/\s+/g, '')).slice(0, 96);
  if (comment) {
    const avatarUrl = /^https?:\/\//i.test(String(avatar || '')) ? String(avatar).slice(0, 512) : '';
    broadcastNotification('temple.liveComment', {
      uniqueId: viewerId,
      user: name,
      avatar: avatarUrl,
      comment
    });
  }

  const result = parseViewerComment(commentText, user, uniqueId, avatar);
  if (!result?.event) return result;

  const prayerComment = sanitizeWishText(commentText);
  if (!prayerComment) return result;

  const handle = String(uniqueId || '')
    .normalize('NFKC')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^A-Za-z0-9._]/g, '')
    .slice(0, 24);
  const usableHandle = handle && /[A-Za-z0-9]/.test(handle) && !BAD_WORDS_RE.test(handle);
  const username = `@${usableHandle ? handle : sanitizeUserName(user)}`;
  broadcastNotification('temple.prayerComment', { uniqueId: viewerId, username, comment: prayerComment });
  return result;
}

const giftComboTracker = new Map();

async function resolveTikTokUsername(rawInput) {
  let input = String(rawInput || '').trim();
  if (!input) {
    throw new Error('Vui lòng nhập @username hoặc link TikTok Live cần kết nối');
  }
  if (input.startsWith('http://') || input.startsWith('https://') || input.includes('tiktok.com/')) {
    const urlToFetch = input.startsWith('http') ? input : `https://${input}`;
    const directMatch = urlToFetch.match(/tiktok\.com\/@([^/?#]+)/i);
    if (directMatch && directMatch[1]) {
      return directMatch[1];
    }
    try {
      const resp = await fetch(urlToFetch, { redirect: 'follow' });
      const finalUrl = resp.url || '';
      const resolvedMatch = finalUrl.match(/tiktok\.com\/@([^/?#]+)/i);
      if (resolvedMatch && resolvedMatch[1]) {
        return resolvedMatch[1];
      }
    } catch (e) {
      console.warn('[TikTok URL Resolve Warning]', e.message);
    }
  }
  return input.replace(/^@/, '').split(/[/?#]/)[0].trim();
}

function extractUserFromEvent(data) {
  const u = data?.user || data || {};
  const uniqueId = u.uniqueId || u.displayId || data?.uniqueId || '';
  const user = u.nickname || uniqueId || data?.nickname || 'Thí Chủ';
  const avatar =
    u.profilePictureUrl ||
    u.avatarLarge?.urlList?.[0] ||
    u.avatarThumb?.urlList?.[0] ||
    u.avatarMedium?.urlList?.[0] ||
    data?.profilePictureUrl ||
    '';
  return { user, uniqueId, avatar };
}

async function connectTikTokLive(usernameOrUrl) {
  const cleanUser = await resolveTikTokUsername(usernameOrUrl);
  if (!cleanUser) {
    throw new Error('Không tìm thấy @username hợp lệ từ dữ liệu nhập vào');
  }

  if (tiktokConn) {
    try {
      await tiktokConn.disconnect();
    } catch (_) {}
    tiktokConn = null;
  }

  state.tiktok = {
    connected: false,
    connecting: true,
    username: cleanUser,
    roomId: null,
    viewerCount: 0,
    lastError: null
  };
  broadcastNotification('temple.state', getPublicState());

  tiktokConn = new TikTokLiveConnection(cleanUser, {
    processInitialData: true,
    fetchRoomInfoOnConnect: false,
    enableExtendedGiftInfo: false
  });

  tiktokConn.on(ControlEvent.CONNECTED, (roomState) => {
    state.tiktok.connected = true;
    state.tiktok.connecting = false;
    state.tiktok.roomId = roomState?.roomId || tiktokConn?.roomId || null;
    state.tiktok.lastError = null;
    console.log(`[TikTok Live] Đã kết nối phòng @${cleanUser} (roomId: ${state.tiktok.roomId})`);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(ControlEvent.DISCONNECTED, () => {
    state.tiktok.connected = false;
    state.tiktok.connecting = false;
    console.log(`[TikTok Live] Đã ngắt kết nối @${cleanUser}`);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(ControlEvent.ERROR, (err) => {
    state.tiktok.lastError = err?.message || String(err);
    console.warn('[TikTok Live Warning]', state.tiktok.lastError);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(WebcastEvent.ROOM_USER, (data) => {
    const viewerCount = Number(data?.total ?? data?.viewerCount ?? 0);
    if (viewerCount > 0) setViewerCount(viewerCount);
  });

  tiktokConn.on(WebcastEvent.MEMBER, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    recordDevotee(user, uniqueId, avatar, 1, 0, 0);
    Rituals.welcome({ user });
  });

  tiktokConn.on(WebcastEvent.CHAT, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const commentText = data?.content || data?.comment || '';
    console.log(`[TikTok Chat] ${user}: ${commentText}`);
    handleViewerComment(commentText, user, uniqueId, avatar);
  });

  tiktokConn.on(WebcastEvent.LIKE, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const likeCount = Math.min(15, Math.max(1, Number(data?.count ?? data?.likeCount ?? 1)));
    Rituals.strikeWoodenFish({ user, uniqueId, avatar, count: likeCount });
    Rituals.addLampLikes({ user, count: Number(data?.count ?? data?.likeCount ?? 1) });
  });

  const handleSocialEvent = (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    Rituals.ringBell({
      user,
      uniqueId,
      avatar,
      count: 1,
      wish: 'Hữu duyên tương ngộ nơi cửa Phật, cầu bình an may mắn',
      readTts: false
    });
  };
  const handleShareEvent = (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    Rituals.shareBlessing({ user, uniqueId, avatar });
  };
  tiktokConn.on(WebcastEvent.FOLLOW, handleSocialEvent);
  tiktokConn.on(WebcastEvent.SHARE, handleShareEvent);

  tiktokConn.on(WebcastEvent.GIFT, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const giftObj = data?.gift || data?.giftDetails || {};
    const giftId = String(data?.giftId || giftObj?.id || 'rose');
    const groupId = String(data?.groupId || `${uniqueId}_${giftId}`);
    const repeatCount = Math.max(1, Number(data?.repeatCount || data?.comboCount || 1));

    const prevCount = giftComboTracker.get(groupId) || 0;
    if (repeatCount <= prevCount) {
      // Tin nhắn lặp lại cùng một combo: không cộng thêm quà.
      if (data?.repeatEnd) giftComboTracker.delete(groupId);
      return;
    }
    const deltaCount = repeatCount - prevCount;
    if (data?.repeatEnd) giftComboTracker.delete(groupId);
    else giftComboTracker.set(groupId, repeatCount);
    if (giftComboTracker.size > 500) {
      const firstKey = giftComboTracker.keys().next().value;
      giftComboTracker.delete(firstKey);
    }

    const diamondCount = Math.max(1, Number(giftObj?.diamondCount || data?.diamondCount || 1));
    const totalCoins = diamondCount * deltaCount;
    const rawGiftName = giftObj?.name || data?.giftName || giftObj?.describe || 'Hoa Hồng Tâm Thành';
    const displayGiftName = deltaCount > 1 ? `${deltaCount}x ${rawGiftName}` : rawGiftName;

    console.log(`[TikTok Gift] ${user} gửi ${displayGiftName} (${totalCoins} xu)`);

    Rituals.offerGift({
      user,
      uniqueId,
      avatar,
      coins: totalCoins,
      giftName: displayGiftName,
      giftCount: deltaCount,
      wish: `Thành tâm dâng ${displayGiftName} kính lễ Đức Phật A Di Đà`
    });
  });

  try {
    const roomState = await tiktokConn.connect();
    state.tiktok.connected = true;
    state.tiktok.connecting = false;
    state.tiktok.roomId = roomState?.roomId || tiktokConn?.roomId || null;
    broadcastNotification('temple.state', getPublicState());
    return state.tiktok;
  } catch (err) {
    state.tiktok.connected = false;
    state.tiktok.connecting = false;
    state.tiktok.lastError = err?.message || 'Không thể kết nối phòng Live (kiểm tra tài khoản đang phát Live chưa)';
    broadcastNotification('temple.state', getPublicState());
    throw new Error(state.tiktok.lastError);
  }
}

async function disconnectTikTokLive() {
  if (tiktokConn) {
    try {
      await tiktokConn.disconnect();
    } catch (_) {}
    tiktokConn = null;
  }
  state.tiktok.connected = false;
  state.tiktok.connecting = false;
  state.tiktok.viewerCount = 0;
  broadcastNotification('temple.state', getPublicState());
  return state.tiktok;
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
      return zeroTts.getStatus();
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
app.use('/tts-cache', express.static(TTS_CACHE_DIR, { maxAge: '7d' }));
app.use(express.static(path.join(RESOURCE_DIR, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, pid: process.pid });
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
const zeroTts = new ZeroTTSManager();
let shutdownPromise = null;

function gracefulShutdown() {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    if (autoSimTimer) {
      clearInterval(autoSimTimer);
      autoSimTimer = null;
    }

    await disconnectTikTokLive();
    await zeroTts.stop();
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
  const username = state.tiktok.connected || state.tiktok.connecting ? state.tiktok.username : '';
  await disconnectTikTokLive();
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
  getStatus: () => ({ live: { ...state.tiktok }, tts: zeroTts.getStatus() }),
  getState: () => getPublicState()
};
}

module.exports = { createTempleServer };
