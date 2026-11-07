// Lớp Học Chữ backend: one factory used standalone (port 3006) and inside TikTok Live Studio.
//
// HTTP:  GET /            operator dashboard (React, built into dist/)
//        GET /?view=stage the 1080×1920 stage for TikTok LIVE Studio / OBS (the only page that speaks)
//        GET /api/tts     speech audio (Edge → Google → ZeroTTS)
//        GET /bao-cao     after-show report
//        POST /rpc        JSON-RPC 2.0
// WS:    /ws              JSON-RPC 2.0; stages connect with ?role=stage
import express from 'express';
import { createServer, type Server } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createLiveConnection } from '../../../packages/live-core/src/tiktok.js';
import { openStore } from '../../../packages/live-core/src/store.js';
import { createRpcHub, RpcError, RPC_ERRORS } from '../../../packages/live-core/src/rpc.js';
import { createSpeakerElection } from '../../../packages/live-core/src/speaker.js';
import { createVoiceService, edgeEngine, googleEngine, zeroTtsEngine } from '../../../packages/live-core/src/voice.js';
import { createViewerSampler, viewStats, viewStatsTable } from '../../../packages/live-core/src/analytics.js';
import { dayKey } from '../../../packages/live-core/src/time.js';
import { createClassroomHost, type LiveEvent } from './host';
import { loadBank } from './bank';
import { GAME } from './game/config';

const appRoot = path.resolve(import.meta.dir, '..');
const TEACHER_VOICE = process.env.TTS_VOICE || 'vi-VN-HoaiMyNeural';
const ENGLISH_VOICE = 'en-US-AnaNeural';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'lvh.me']);

export const PHASE_NAMES: Record<string, string> = {
  team: 'Chọn tổ', intro: 'Giới thiệu tiết', question: 'Đang trả lời', bonus: 'Thêm giờ (mở chữ)', reveal: 'Hiện đáp án',
  praise: 'Điểm danh giữa tiết', results: 'Tổng kết tiết', recess: 'Ra chơi', vote: 'Bình chọn chủ đề', show: 'Game lớn',
};

type LiveStatus = { state: string; username: string; roomId: string | null; viewerCount: number; totalLikes: number; error: string | null; retryInMs: number | null };
type LiveLink = { connect(input: string): Promise<LiveStatus>; disconnect(): Promise<LiveStatus>; getStatus(): LiveStatus; getWanted(): string };

export interface ClassroomOptions {
  standalone?: boolean;
  host?: string;
  port?: number;
  /** folder holding src/game (question banks), public/assets and dist/ */
  resourceDir?: string;
  dataDir?: string;
  /** Studio: a shared TikTok connection. Studio then calls onLiveEvent / onLiveStatus. */
  live?: LiveLink;
  /** Studio: a shared ZeroTTS worker, used as the offline fallback voice */
  zeroTts?: { synthesize(text: string, voice?: string): Promise<any> } | null;
  /** Studio: viewer samples come from Studio's sampler instead of our own */
  viewRows?: (day: string) => { at: number; session: string; phase: string; viewers: number }[];
  log?: Pick<Console, 'log' | 'warn'>;
}

export function createClassroomServer(options: ClassroomOptions = {}) {
  const standalone = options.standalone !== false;
  const host = options.host || process.env.CLASSROOM_HOST || '127.0.0.1';
  const port = Number(options.port || process.env.PORT || 3006);
  const resourceDir = options.resourceDir || process.env.CLASSROOM_RESOURCE_DIR || appRoot;
  const dataDir = options.dataDir || process.env.DATA_DIR || process.env.APP_DATA_DIR || path.join(appRoot, '.data');
  const log = options.log || console;
  const webRoot = path.join(resourceDir, 'dist');

  const store = openStore(path.join(dataDir, 'classroom.db'));
  const settings = store.doc('settings', { channelName: '', tiktokUser: '', rate: 1 });
  const { questions, showBank } = loadBank(path.join(resourceDir, 'src', 'game'));

  // ---------- voice ----------
  const engines: any[] = [edgeEngine({ pitch: process.env.TTS_PITCH || '+6%', defaultVoice: TEACHER_VOICE }), googleEngine()];
  if (options.zeroTts) engines.push(zeroTtsEngine(options.zeroTts));
  const voice = createVoiceService({ engines, log });

  // ---------- transport ----------
  let speakerId: string | null = null;
  const hub = createRpcHub({
    log,
    dispatch: (method: string, params: unknown, client: { id: string } | null) => dispatch(method, params as Record<string, unknown>, client),
    onConnect(client) {
      client.send('classroom.state', stateFor());
      if (client.query.get('role') === 'stage') election.join(client.id, client.send);
      else client.send('stage.speaker', election.describe());
    },
    onDisconnect(client) {
      election.leave(client.id);
    },
  });
  const election = createSpeakerElection({
    broadcast(method: string, params: any) {
      if (method === 'stage.speaker') {
        if (speakerId && params.speakerId !== speakerId) game.speakerLost();
        speakerId = params.speakerId;
      }
      hub.notify(method, params);
    },
  });
  const speakerClient = () => hub.clients().find((c) => c.id === speakerId) ?? null;

  // ---------- game ----------
  let active = standalone;
  let started = false;
  const game = createClassroomHost({
    questions,
    showBank,
    store,
    log,
    speech: {
      say(line) {
        const client = active ? speakerClient() : null;
        if (!client) return false;
        client.send('voice.say', line);
        return true;
      },
      stop() { speakerClient()?.send('voice.stop', {}); },
    },
    onView(view) {
      if (active) hub.notify('classroom.view', { view, lastGift: game.lastGift() });
    },
  });

  // ---------- live connection ----------
  let status: LiveStatus = { state: 'offline', username: '', roomId: null, viewerCount: 0, totalLikes: 0, error: null, retryInMs: null };
  let simLikes = 0;
  function onLiveStatus(next: LiveStatus) {
    const roomChanged = next.roomId && next.roomId !== status.roomId;
    status = next;
    if (roomChanged) game.onRoom(next.roomId);
    hub.notify('live.status', status);
  }
  function onLiveEvent(event: LiveEvent) {
    if (active) game.onLive(event);
  }
  const live: LiveLink = options.live ?? createLiveConnection({ onEvent: onLiveEvent, onStatus: onLiveStatus, log });
  const sampler = options.viewRows ? null : createViewerSampler({
    collection: store.collection('views'),
    sample: () => (active && status.state === 'live' ? { session: 'classroom', phase: game.phase(), viewers: status.viewerCount } : null),
  });

  function stateFor() {
    const s = settings.get();
    return {
      view: game.view(),
      lastGift: game.lastGift(),
      status,
      channelName: s.channelName || GAME.defaultChannelName,
      rate: s.rate || 1,
    };
  }

  async function dispatch(method: string, params: Record<string, unknown>, client: { id: string } | null) {
    const text = (key: string, max = 1000) => (typeof params[key] === 'string' ? (params[key] as string).trim().slice(0, max) : '');
    switch (method) {
      case 'classroom.state':
        return stateFor();
      case 'classroom.control': {
        const action = text('action', 40);
        game.control(action, text('text', 1000));
        return { ok: true, stages: election.count() };
      }
      case 'classroom.setName': {
        const name = text('name', 40).replace(/[\x00-\x1f\x7f]/g, '');
        if (!name) throw new RpcError(RPC_ERRORS.params, 'Chưa nhập tên lớp');
        settings.update((s) => ({ ...s, channelName: name }));
        hub.notify('classroom.settings', { channelName: name, rate: settings.get().rate });
        return { ok: true, channelName: name };
      }
      case 'classroom.setRate': {
        const rate = Math.min(1.5, Math.max(0.5, Number(params.rate) || 1));
        settings.update((s) => ({ ...s, rate }));
        hub.notify('classroom.settings', { channelName: settings.get().channelName || GAME.defaultChannelName, rate });
        return { ok: true, rate };
      }
      case 'voice.started':
      case 'voice.done': {
        if (!client || client.id !== speakerId) return { ok: false }; // only the speaking stage reports
        const id = text('id', 40);
        if (method === 'voice.started') game.voiceStarted(id);
        else game.voiceDone(id);
        return { ok: true };
      }
      case 'live.connect': {
        const username = text('username', 200);
        if (!username) throw new RpcError(RPC_ERRORS.params, 'Chưa nhập username TikTok');
        try {
          const result = await live.connect(username);
          settings.update((s) => ({ ...s, tiktokUser: live.getWanted() }));
          return result;
        } catch (error: any) {
          if (live.getWanted()) settings.update((s) => ({ ...s, tiktokUser: live.getWanted() }));
          throw new RpcError(RPC_ERRORS.rule, error.message, { code: 'tiktok_connect_failed' });
        }
      }
      case 'live.disconnect':
        settings.update((s) => ({ ...s, tiktokUser: '' }));
        return live.disconnect();
      case 'classroom.simulate':
        return simulate(text('type', 20), (params.data as Record<string, unknown>) || {});
      default:
        throw new RpcError(RPC_ERRORS.method, `Unknown method: ${method}`);
    }
  }

  /** Fake viewer events for rehearsal; they take the same path as real TikTok events. */
  function simulate(type: string, data: Record<string, unknown>) {
    const nickname = String(data.nickname || 'Bạn').slice(0, 48);
    const viewer = { id: String(data.username || nickname).slice(0, 96), name: nickname, avatar: '' };
    const t = Date.now();
    let event: LiveEvent;
    if (type === 'chat') event = { kind: 'comment', viewer, text: String(data.comment || ''), sentAt: Number(data.createTime) || t };
    else if (type === 'gift') {
      const count = Math.max(1, Number(data.repeatCount) || 1);
      event = { kind: 'gift', viewer, name: String(data.giftName || 'Quà'), giftId: String(data.giftId || 'gift'), count, coins: Math.max(1, Number(data.diamondCount) || 1) * count };
    } else if (type === 'like') {
      const count = Math.max(1, Number(data.likeCount) || 1);
      simLikes += count;
      event = { kind: 'like', viewer, count, totalLikes: Math.max(status.totalLikes, 0) + simLikes };
    } else if (type === 'follow' || type === 'share' || type === 'member') event = { kind: type, viewer };
    else throw new RpcError(RPC_ERRORS.params, 'Loại sự kiện không hợp lệ');
    game.onLive(event);
    return { ok: true };
  }

  // ---------- HTTP ----------
  const app = express();
  app.disable('x-powered-by');
  // DNS-rebinding guard (from the classroom app): a foreign page that points its domain at 127.0.0.1
  // arrives with a Host / Origin that is not one of ours.
  const hostOk = (h?: string) => !!h && LOCAL_HOSTS.has(h.replace(/:\d+$/, '').toLowerCase());
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!hostOk(req.headers.host) || (origin && !hostOk(origin.replace(/^https?:\/\//, '')))) return res.status(403).end();
    next();
  });
  app.post('/rpc', express.json({ limit: '256kb' }), (req, res) => void hub.httpHandler(req, res));
  app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'classroom', port }));
  app.get('/api/tts', voice.httpHandler((q: Record<string, unknown>) => ({
    text: String(q.text || ''),
    voiceName: q.v === 'en' ? ENGLISH_VOICE : TEACHER_VOICE,
    lang: q.v === 'en' ? 'en' : 'vi',
    rate: Number(q.rate) || settings.get().rate || 1,
    hype: q.hype === '1',
  })));
  app.get('/bao-cao', (req, res) => {
    const day = typeof req.query.ngay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.ngay) ? req.query.ngay : dayKey();
    const rows = options.viewRows ? options.viewRows(day).filter((r) => r.session === 'classroom') : (sampler?.rows(day) ?? []);
    res.type('html').send(reportPage(day, game, rows));
  });
  app.use('/assets', express.static(path.join(resourceDir, 'public', 'assets'), { maxAge: '7d' }));
  app.use(express.static(webRoot, { index: 'index.html', maxAge: 0 }));
  app.get('/', (_req, res) => {
    const index = path.join(webRoot, 'index.html');
    if (fs.existsSync(index)) res.sendFile(index);
    else res.status(503).type('text').send('Chưa build giao diện lớp học: chạy `bun run classroom:build`.');
  });

  let server: Server | null = null;
  if (standalone) {
    server = createServer(app);
    hub.attach(server);
  }

  return {
    app,
    async listen() {
      if (!server) throw new Error('This classroom instance is embedded; the host server owns the port.');
      await new Promise<void>((resolve, reject) => {
        server!.once('error', reject);
        server!.listen(port, host, resolve);
      });
      started = true;
      game.start();
      log.log(`Lớp Học Chữ: http://localhost:${port}  |  Link LIVE Studio: http://lvh.me:${port}/?view=stage`);
      const saved = settings.get().tiktokUser;
      if (saved && !options.live) live.connect(saved).catch((error: Error) => log.warn(`[Lớp học] Chưa kết nối lại @${saved}: ${error.message}`));
      return { host, port };
    },
    // ---- Studio session lifecycle ----
    activate() {
      if (!active) {
        active = true;
        if (!started) { started = true; game.start(); } else game.resume();
      }
    },
    async deactivate() {
      active = false;
      game.pause();
      hub.closeAll(1012, 'Session switched');
      // A shared connection belongs to Studio: keep it. Our own connection: hand the room over.
      if (options.live) return { username: '' };
      const username = live.getWanted();
      await live.disconnect();
      return { username };
    },
    handleUpgrade: hub.handleUpgrade,
    connectLive: (username: string) => live.connect(username),
    onLiveEvent,
    onLiveStatus,
    getPhase: () => game.phase(),
    getSummary() {
      const v = game.view();
      return {
        live: status.state === 'live' ? status.username : '',
        lines: [
          `Tiết ${v.round} · câu ${v.qNo}/${v.total} · ${PHASE_NAMES[v.phase] ?? v.phase}`,
          `${v.classSize} bạn trong lớp`,
          v.todayTop[0] ? `Dẫn đầu hôm nay: ${v.todayTop[0].nickname} (${v.todayTop[0].points} điểm)` : 'Chưa có điểm hôm nay',
        ],
      };
    },
    async close() {
      sampler?.stop();
      game.stop();
      if (!options.live) await live.disconnect();
      hub.closeAll(1001, 'Classroom shutting down');
      if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
      store.close();
    },
    game,
  };
}

function reportPage(day: string, game: ReturnType<typeof createClassroomHost>, viewRows: { at: number; session: string; phase: string; viewers: number }[]) {
  const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const rows = game.reportRows(day);
  const words = rows.filter((r: any) => r.category !== 'Toán nhẩm');
  const hard = words.filter((r: any) => r.correct === 0 && r.attempts >= 3).sort((a: any, b: any) => b.attempts - a.attempts);
  const easy = words.filter((r: any) => r.attempts >= 5 && r.correct / r.attempts >= 0.9);
  const attended = game.attendance().filter(([, a]) => a.last === day);
  const loyal = attended.sort((a, b) => b[1].streak - a[1].streak).slice(0, 15);
  const top = day === dayKey() ? game.todayScores() : [];
  const banned = game.bannedList().sort((a, b) => b[1].at - a[1].at);
  const list = (items: string[], empty: string) => (items.length ? `<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>` : `<p class="muted">${empty}</p>`);
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Báo cáo Lớp Học Chữ ${esc(day)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:860px;margin:0 auto;padding:16px;background:#fdf8ec;color:#3b2a14}
h1{margin:0 0 4px}h2{margin-top:28px;border-bottom:2px solid #e9d8a6;padding-bottom:4px}.muted{color:#8a7350}
.stats{display:flex;gap:12px;flex-wrap:wrap}.stat{background:#fff;border-radius:12px;padding:10px 16px;box-shadow:0 1px 3px #0002}
.stat b{display:block;font-size:28px}li{margin:4px 0}code{background:#f3e9cf;padding:1px 5px;border-radius:4px}
table.views{border-collapse:collapse;width:100%;background:#fff;border-radius:12px}table.views th{text-align:left;padding:6px}
table.views td{padding:6px;border-top:1px solid #eee}td.down{color:#b91c1c;font-weight:700}td.up{color:#15803d;font-weight:700}</style></head><body>
<h1>📊 Báo cáo buổi live</h1><div class="muted">Ngày ${esc(day)} · đổi ngày: thêm <code>?ngay=YYYY-MM-DD</code> vào link</div>
<div class="stats" style="margin-top:12px">
<div class="stat"><b>${rows.length}</b>câu đã hỏi</div>
<div class="stat"><b>${attended.length}</b>bạn vào lớp</div>
<div class="stat"><b>${hard.length}</b>câu không ai đúng</div>
<div class="stat"><b>${easy.length}</b>câu quá dễ</div></div>
<h2>👀 Người xem theo từng phần</h2><p class="muted">Số người xem tăng (+) hay giảm (−) trung bình mỗi phút trong từng phần. Phần giảm nhiều nhất ở trên cùng: đó là chỗ khách rời live.</p>
${viewStatsTable(viewStats(viewRows), { names: PHASE_NAMES })}
<h2>❌ Câu không ai trả lời đúng</h2><p class="muted">Có nhiều bạn thử mà vẫn sai: có thể câu quá khó hoặc gợi ý chưa rõ, nên xem lại.</p>
${list(hard.map((r: any) => `<b>${esc(r.answer)}</b> · ${esc(r.category)} · ${r.attempts} bạn thử <code>${esc(r.id)}</code>`), 'Không có câu nào.')}
<h2>✅ Câu quá dễ (90% trở lên trả lời đúng)</h2>
${list(easy.map((r: any) => `<b>${esc(r.answer)}</b> · ${esc(r.category)} · ${r.correct}/${r.attempts} đúng`), 'Không có câu nào.')}
<h2>🏆 Điểm cao hôm nay</h2>
${list(top.map((s) => `${esc(s.nickname)} · ${s.points} điểm`), 'Chưa có điểm (hoặc không phải hôm nay).')}
<h2>🎒 Chuyên cần (đi học nhiều ngày liền)</h2>
${list(loyal.map(([, a]) => `${esc(a.nickname)} · ${a.streak} ngày liền · tổng ${a.total} ngày`), 'Chưa có ai.')}
<h2>🚫 Câu đã bấm "Bỏ câu này"</h2><p class="muted">Sửa câu trong <code>apps/classroom/src/game/cau-hoi/</code> (đổi đáp án hoặc xoá dòng). Đổi đáp án là thành câu mới.</p>
${list(banned.map(([id, b]) => `<b>${esc(b.answer)}</b> · ${esc(b.clue)} <code>${esc(id)}</code>`), 'Chưa bỏ câu nào.')}
</body></html>`;
}
