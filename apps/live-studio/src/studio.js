// TikTok Live Studio: one backend process that hosts the prayer (Chùa Linh Ứng), wedding and classroom
// (Lớp Học Chữ) apps as switchable sessions on a single port. Exactly one session receives HTTP and
// WebSocket traffic at a time; inactive sessions keep their state.
//
// Studio owns the shared pieces (packages/live-core):
//   - ONE TikTok connection. Switching sessions only changes who receives the events, so the room is
//     never dropped and reconnected on a switch. It reconnects by itself after drops.
//   - ONE ZeroTTS worker (the model is heavy), used by the prayer voice and as the classroom's offline voice.
//   - The "viewers per phase" report for every session: /studio/bao-cao.
import express from 'express';
import { createServer } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import templeModule from '../../../src/temple/server.js';
import { createWeddingServer } from '../../virtual-wedding/src/server.js';
import { createClassroomServer, PHASE_NAMES as CLASSROOM_PHASES } from '../../classroom/src/server.ts';
import { createLiveConnection } from '../../../packages/live-core/src/tiktok.js';
import { createZeroTts } from '../../../packages/live-core/src/zerotts.js';
import { openStore } from '../../../packages/live-core/src/store.js';
import { createViewerSampler, viewStats, viewStatsTable } from '../../../packages/live-core/src/analytics.js';
import { dayKey } from '../../../packages/live-core/src/time.js';

const { createTempleServer } = templeModule;

const repoRoot = path.resolve(import.meta.dir, '..', '..', '..');

const PHASE_NAMES = {
  prayer: {
    idle: 'Chờ nghi thức', burnIncense: 'Thắp hương', strikeWoodenFish: 'Gõ mõ', ringBell: 'Thỉnh chuông', sendPrayer: 'Thả đèn cầu nguyện',
    offerGift: 'Dâng lễ vật', grandCeremony: 'Đại lễ', drawFortune: 'Xin xăm', releaseFish: 'Phóng sinh', checkIn: 'Điểm danh'
  },
  wedding: { lobby: 'Đón khách', entrance: 'Đón dâu', vows: 'Lời thề', rings: 'Trao nhẫn', celebration: 'Chung vui', ended: 'Đã khép lễ' },
  classroom: CLASSROOM_PHASES
};

export function resolveStudioPaths(env = process.env) {
  const resources = env.STUDIO_RESOURCE_DIR || '';
  const data = env.APP_DATA_DIR || path.join(repoRoot, 'data', 'studio');
  return resources
    ? {
        templeResources: path.join(resources, 'temple'),
        weddingWeb: path.join(resources, 'wedding', 'web'),
        classroomResources: path.join(resources, 'classroom'),
        studioWeb: path.join(resources, 'studio', 'web'),
        data
      }
    : {
        templeResources: repoRoot,
        weddingWeb: path.join(repoRoot, 'apps', 'virtual-wedding', 'web'),
        classroomResources: path.join(repoRoot, 'apps', 'classroom'),
        studioWeb: path.join(repoRoot, 'apps', 'live-studio', 'web'),
        data
      };
}

export function createStudioServer(options = {}) {
  const host = options.host || process.env.STUDIO_HOST || '127.0.0.1';
  const port = Number(options.port || process.env.STUDIO_PORT || 3200);
  const paths = options.paths || resolveStudioPaths();
  const shutdownToken = options.shutdownToken ?? process.env.STUDIO_SHUTDOWN_TOKEN ?? '';
  const zeroTtsBin = options.zeroTtsBin ?? process.env.ZERO_TTS_BIN ?? null;
  const stateFile = path.join(paths.data, 'studio.json');
  fs.mkdirSync(paths.data, { recursive: true });

  const instances = new Map();
  const listeners = new Set();
  let saved = readSaved();
  let activeId = null;
  let switching = null;

  // ---------- shared live connection ----------
  const live = createLiveConnection({
    onEvent: (event) => { if (activeId) instances.get(activeId)?.onLiveEvent?.(event); },
    onStatus: (status) => {
      for (const instance of instances.values()) instance.onLiveStatus?.(status);
      if (status.username && status.username !== saved.lastUsername) {
        saved.lastUsername = status.username;
        persist();
      }
    }
  });
  // What each session gets instead of its own connection.
  const liveLink = {
    connect: async (input) => {
      const result = await live.connect(input);
      saved = { ...saved, wanted: live.getWanted() };
      persist();
      return result;
    },
    disconnect: async () => {
      saved = { ...saved, wanted: '' };
      persist();
      return live.disconnect();
    },
    getStatus: () => live.getStatus(),
    getWanted: () => live.getWanted()
  };

  // ---------- shared ZeroTTS worker (started when the prayer session first opens) ----------
  let zeroTts = options.zeroTts ?? null;
  const ttsDataDir = path.join(paths.data, 'temple');
  const getZeroTts = () => (zeroTts ??= createZeroTts({ resourceDir: paths.templeResources, dataDir: ttsDataDir, bin: zeroTtsBin }));
  // The classroom only needs it when the internet voices fail: do not start the model just for that.
  const lazyZeroTts = {
    synthesize: (text, voice) => (zeroTts ? zeroTts.synthesize(text, voice) : Promise.resolve({ ok: false, error: 'ZeroTTS chưa chạy' }))
  };

  // ---------- viewers per phase, for every session ----------
  const store = openStore(path.join(paths.data, 'studio.db'));
  const sampler = createViewerSampler({
    collection: store.collection('views'),
    sample: () => {
      const status = live.getStatus();
      const instance = activeId ? instances.get(activeId) : null;
      if (!instance || status.state !== 'live') return null;
      return { session: activeId, phase: String(instance.getPhase?.() || 'live'), viewers: status.viewerCount };
    }
  });

  const definitions = {
    prayer: {
      id: 'prayer',
      title: 'Chùa Linh Ứng Online',
      kicker: 'PHIÊN CẦU NGUYỆN',
      description: 'Chánh điện 9:16: thắp hương, xin xăm, phóng sinh, niệm Phật cùng cả phòng.',
      art: '/studio/art/prayer.webp',
      operatorPath: '/',
      stagePath: '/?obs=1',
      htmlRoutes: {
        '/': path.join(paths.templeResources, 'public', 'index.html'),
        '/index.html': path.join(paths.templeResources, 'public', 'index.html'),
        '/admin': path.join(paths.templeResources, 'public', 'admin.html'),
        '/admin.html': path.join(paths.templeResources, 'public', 'admin.html')
      },
      create: () => createTempleServer({
        standalone: false,
        port,
        host,
        resourceDir: paths.templeResources,
        dataDir: path.join(paths.data, 'temple'),
        zeroTts: getZeroTts(),
        live: liveLink,
        shutdownToken: ''
      })
    },
    wedding: {
      id: 'wedding',
      title: 'Virtual Wedding Live',
      kicker: 'PHIÊN LỄ CƯỚI',
      description: 'Lễ đường 9:16: nhận vai cô dâu chú rể, nhà trai đấu nhà gái, hô “hôn đi”, bắt hoa cưới.',
      art: '/studio/art/wedding.webp',
      operatorPath: '/',
      stagePath: '/stage?obs=1',
      htmlRoutes: {
        '/': path.join(paths.weddingWeb, 'index.html'),
        '/index.html': path.join(paths.weddingWeb, 'index.html'),
        '/stage': path.join(paths.weddingWeb, 'stage.html'),
        '/stage.html': path.join(paths.weddingWeb, 'stage.html')
      },
      create: () => createWeddingServer({ standalone: false, port, host, webRoot: paths.weddingWeb, live: liveLink })
    },
    classroom: {
      id: 'classroom',
      title: 'Lớp Học Chữ',
      kicker: 'PHIÊN LỚP HỌC',
      description: 'Lớp học 9:16 có cô Ngân: đố chữ, đuổi hình bắt chữ, toán nhẩm; ai gõ đúng nhanh nhất được ngồi bàn đầu.',
      art: '/studio/art/classroom.webp',
      operatorPath: '/',
      stagePath: '/?view=stage',
      htmlRoutes: {
        '/': path.join(paths.classroomResources, 'dist', 'index.html'),
        '/index.html': path.join(paths.classroomResources, 'dist', 'index.html')
      },
      create: () => createClassroomServer({
        standalone: false,
        port,
        host,
        resourceDir: paths.classroomResources,
        dataDir: path.join(paths.data, 'classroom'),
        live: liveLink,
        zeroTts: lazyZeroTts,
        viewRows: (day) => sampler.rows(day)
      })
    }
  };
  activeId = definitions[saved.active] ? saved.active : null;

  function readSaved() {
    try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')) || {}; } catch { return {}; }
  }

  function persist() {
    saved = { ...saved, active: activeId };
    try { fs.writeFileSync(stateFile, JSON.stringify(saved, null, 2)); } catch (error) { console.warn(`[Studio] Could not save session: ${error.message}`); }
  }

  function instanceFor(id) {
    if (!instances.has(id)) {
      console.log(`[Studio] Starting ${definitions[id].title}`);
      const instance = definitions[id].create();
      instances.set(id, instance);
      instance.onLiveStatus?.(live.getStatus());
    }
    return instances.get(id);
  }

  function summary(id) {
    const instance = instances.get(id);
    if (!instance) return { running: false };
    const status = live.getStatus();
    const onAir = status.state === 'live' && id === activeId ? status.username : '';
    try {
      if (typeof instance.getSummary === 'function') return { running: true, ...instance.getSummary(), live: onAir };
      if (id === 'prayer') {
        const st = instance.getState();
        return {
          running: true,
          live: onAir,
          lines: [
            `${Number(st.totalMerit || 0).toLocaleString('vi-VN')} công đức`,
            `${Number(st.chant?.rounds || 0)} lần viên mãn niệm Phật`,
            `${Number(st.fishReleased || 0)} cá chép phóng sinh`
          ]
        };
      }
      const { wedding } = instance.getSnapshot();
      const couple = [wedding.couple.groom?.name, wedding.couple.bride?.name].filter(Boolean).join(' & ');
      return {
        running: true,
        live: onAir,
        lines: [
          `Nghi thức: ${PHASE_NAMES.wedding[wedding.phase] || wedding.phase}`,
          couple ? `Đôi uyên ương: ${couple}` : 'Chưa chọn đôi uyên ương',
          `${wedding.wishes.length} lời chúc · ${Number(wedding.likes.total || 0).toLocaleString('vi-VN')} tim`
        ]
      };
    } catch (error) {
      return { running: true, lines: [`Lỗi đọc trạng thái: ${error.message}`] };
    }
  }

  function describe() {
    const status = live.getStatus();
    return {
      active: activeId,
      switching: Boolean(switching),
      lastUsername: saved.lastUsername || '',
      live: { state: status.state, username: status.username, viewerCount: status.viewerCount, error: status.error, retryInMs: status.retryInMs },
      obsUrl: `http://${host}:${port}/obs`,
      reportUrl: '/studio/bao-cao',
      sessions: Object.values(definitions).map((definition) => ({
        id: definition.id,
        title: definition.title,
        kicker: definition.kicker,
        description: definition.description,
        art: definition.art,
        operatorPath: definition.operatorPath,
        stagePath: definition.stagePath,
        active: definition.id === activeId,
        ...summary(definition.id)
      }))
    };
  }

  function emit() {
    const payload = `data: ${JSON.stringify({ active: activeId })}\n\n`;
    for (const response of listeners) response.write(payload);
  }

  /** `carryLive: false` (launcher checkbox off) leaves the TikTok room on a switch. */
  async function activate(id, { carryLive = true } = {}) {
    if (!definitions[id]) throw Object.assign(new Error('Unknown session.'), { status: 400 });
    if (switching) await switching;
    if (id === activeId) {
      instanceFor(id).activate();
      return { ...describe(), carried: '' };
    }
    switching = (async () => {
      if (activeId && instances.has(activeId)) {
        try { await instances.get(activeId).deactivate(); }
        catch (error) { console.warn(`[Studio] Could not pause ${activeId}: ${error.message}`); }
      }
      if (!carryLive) await liveLink.disconnect();
      activeId = id;
      const instance = instanceFor(id);
      instance.activate();
      persist();
      emit();
      return carryLive ? live.getWanted() : '';
    })();
    let carried = '';
    try { carried = await switching; } finally { switching = null; }
    return { ...describe(), carried };
  }

  async function deactivateAll() {
    if (!activeId) return describe();
    const current = instances.get(activeId);
    if (current) await current.deactivate();
    activeId = null;
    persist();
    emit();
    return describe();
  }

  const app = express();
  app.disable('x-powered-by');
  const studioStatic = express.static(paths.studioWeb, { index: false, maxAge: 0 });

  app.get('/api/health', (_request, response) => response.json({ ok: true, app: 'live-studio', pid: process.pid, port }));
  app.post('/api/shutdown', (request, response) => {
    const provided = Buffer.from(request.get('x-studio-shutdown-token') || '');
    const expected = Buffer.from(shutdownToken || '');
    if (!expected.length || provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      response.status(403).json({ ok: false, error: 'Invalid shutdown token' });
      return;
    }
    response.status(202).json({ ok: true });
    setTimeout(() => void close().then(() => process.exit(0)), 40).unref();
  });

  app.get('/studio', (_request, response) => response.sendFile(path.join(paths.studioWeb, 'index.html')));
  app.get('/studio/art/prayer.webp', (_request, response) => response.sendFile(path.join(paths.templeResources, 'public', 'assets', 'amitabha_stage.webp')));
  app.get('/studio/art/wedding.webp', (_request, response) => response.sendFile(path.join(paths.weddingWeb, 'assets', 'plates', 'hall-photo.webp')));
  app.get('/studio/art/classroom.webp', (_request, response) => response.sendFile(path.join(paths.classroomResources, 'public', 'assets', 'bg', 'lop.webp')));
  app.get('/studio/api/session', (_request, response) => response.json(describe()));
  app.post('/studio/api/session', express.json({ limit: '8kb' }), async (request, response) => {
    try {
      const id = request.body?.id;
      const result = id === null ? await deactivateAll() : await activate(String(id), { carryLive: request.body?.carryLive !== false });
      response.json(result);
    } catch (error) {
      response.status(error.status || 500).json({ error: error.message });
    }
  });
  app.get('/studio/api/events', (request, response) => {
    response.set({ 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    response.flushHeaders();
    response.write(`data: ${JSON.stringify({ active: activeId })}\n\n`);
    listeners.add(response);
    const keepAlive = setInterval(() => response.write(': ping\n\n'), 20000);
    request.on('close', () => { clearInterval(keepAlive); listeners.delete(response); });
  });
  // Viewers per phase across every session (?ngay=YYYY-MM-DD for another day)
  app.get('/studio/bao-cao', (request, response) => {
    const day = typeof request.query.ngay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(request.query.ngay) ? request.query.ngay : dayKey();
    const names = Object.assign({}, ...Object.values(PHASE_NAMES));
    const sessions = Object.fromEntries(Object.values(definitions).map((d) => [d.id, d.title]));
    response.type('html').send(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Báo cáo người xem ${day}</title>
<style>body{font-family:system-ui,sans-serif;max-width:860px;margin:0 auto;padding:16px;background:#14110f;color:#f3ece2}
.muted{color:#a8998a}code{background:#2a231e;padding:1px 5px;border-radius:4px}table.views{border-collapse:collapse;width:100%;background:#1f1a16;border-radius:12px}
table.views th{text-align:left;padding:8px}table.views td{padding:8px;border-top:1px solid #ffffff14}td.down{color:#ff8a80;font-weight:700}td.up{color:#8bdc9b;font-weight:700}a{color:#f2c46b}</style></head><body>
<p><a href="/studio">← TikTok Live Studio</a></p>
<h1>👀 Người xem theo từng phần</h1>
<p class="muted">Ngày ${day} (đổi ngày: thêm <code>?ngay=YYYY-MM-DD</code>). Cứ 15 giây ghi phiên, phần đang chạy và số người xem khi đang kết nối TikTok. Phần làm người xem giảm nhiều nhất ở trên cùng.</p>
${viewStatsTable(viewStats(sampler.rows(day)), { names, sessions })}
</body></html>`);
  });
  app.use('/studio/fonts', express.static(path.join(paths.weddingWeb, 'assets', 'fonts'), { maxAge: '7d' }));
  app.use('/studio', studioStatic);

  // One OBS browser source for every session: it follows the active session.
  app.get('/obs', (_request, response) => {
    if (!activeId) {
      response.sendFile(path.join(paths.studioWeb, 'obs-idle.html'));
      return;
    }
    response.redirect(302, definitions[activeId].stagePath);
  });

  // Active session pages get the session bar; everything else goes to the session app untouched.
  app.use((request, response, next) => {
    if (!activeId) {
      if (request.method === 'GET' && request.accepts('html') && !request.path.startsWith('/api')) {
        response.redirect(302, '/studio');
        return;
      }
      response.status(409).json({ error: 'No session is active. Open /studio to choose one.' });
      return;
    }
    const definition = definitions[activeId];
    const file = request.method === 'GET' ? definition.htmlRoutes[request.path] : null;
    if (file) {
      fs.readFile(file, 'utf8', (error, html) => {
        if (error) { next(); return; }
        const tag = `<script src="/studio/session-bar.js" data-session="${definition.id}" defer></script>`;
        response.set('cache-control', 'no-store');
        response.type('html').send(html.includes('</body>') ? html.replace('</body>', `${tag}\n</body>`) : html + tag);
      });
      return;
    }
    instanceFor(activeId).app(request, response, next);
  });

  const server = createServer(app);
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname !== '/ws' || !activeId) {
      socket.destroy();
      return;
    }
    instanceFor(activeId).handleUpgrade(request, socket, head);
  });

  async function listen() {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, resolve);
    });
    if (activeId) instanceFor(activeId).activate();
    // Last run was connected: reconnect (it keeps retrying until the account is live).
    if (saved.wanted) {
      liveLink.connect(saved.wanted).catch((error) => console.warn(`[Studio] @${saved.wanted}: ${error.message}`));
    }
    return { host, port };
  }

  async function close() {
    for (const response of listeners) response.end();
    listeners.clear();
    sampler.stop();
    for (const [id, instance] of instances) {
      try {
        if (id === 'prayer') await instance.shutdown();
        else await instance.close();
      } catch (error) {
        console.warn(`[Studio] ${id} shutdown: ${error.message}`);
      }
    }
    // keep `wanted` so the next start reconnects; only leave the room
    await live.disconnect().catch(() => {});
    await zeroTts?.stop?.();
    persist();
    store.close();
    await new Promise((resolve) => server.close(() => resolve()));
  }

  return { app, server, listen, close, activate, describe, live: liveLink };
}
