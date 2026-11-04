// TikTok Live Studio: one backend process that hosts the prayer (Chùa Linh Ứng) and wedding
// apps as switchable sessions on a single port. Exactly one session receives HTTP and
// WebSocket traffic at a time; the inactive session keeps its in-memory state.
import express from 'express';
import { createServer } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import templeModule from '../../../src/temple/server.js';
import { createWeddingServer } from '../../virtual-wedding/src/server.js';

const { createTempleServer } = templeModule;

const repoRoot = path.resolve(import.meta.dir, '..', '..', '..');

export function resolveStudioPaths(env = process.env) {
  const resources = env.STUDIO_RESOURCE_DIR || '';
  const data = env.APP_DATA_DIR || path.join(repoRoot, 'data', 'studio');
  return resources
    ? {
        templeResources: path.join(resources, 'temple'),
        weddingWeb: path.join(resources, 'wedding', 'web'),
        studioWeb: path.join(resources, 'studio', 'web'),
        data
      }
    : {
        templeResources: repoRoot,
        weddingWeb: path.join(repoRoot, 'apps', 'virtual-wedding', 'web'),
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
        zeroTtsBin,
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
      create: () => createWeddingServer({ standalone: false, port, host, webRoot: paths.weddingWeb })
    }
  };

  const instances = new Map();
  const listeners = new Set();
  let saved = readSaved();
  let activeId = definitions[saved.active] ? saved.active : null;
  let switching = null;

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
      instances.set(id, definitions[id].create());
    }
    return instances.get(id);
  }

  function summary(id) {
    const instance = instances.get(id);
    if (!instance) return { running: false };
    try {
      if (id === 'prayer') {
        const st = instance.getState();
        return {
          running: true,
          live: st.tiktok?.connected ? st.tiktok.username : '',
          lines: [
            `${Number(st.totalMerit || 0).toLocaleString('vi-VN')} công đức`,
            `${Number(st.chant?.rounds || 0)} lần viên mãn niệm Phật`,
            `${Number(st.fishReleased || 0)} cá chép phóng sinh`
          ]
        };
      }
      const { wedding, stream } = instance.getSnapshot();
      const phaseNames = { lobby: 'Đón khách', entrance: 'Đón dâu', vows: 'Lời thề', rings: 'Trao nhẫn', celebration: 'Chung vui', ended: 'Đã khép lễ' };
      const couple = [wedding.couple.groom?.name, wedding.couple.bride?.name].filter(Boolean).join(' & ');
      return {
        running: true,
        live: stream.state === 'live' ? stream.username : '',
        lines: [
          `Nghi thức: ${phaseNames[wedding.phase] || wedding.phase}`,
          couple ? `Đôi uyên ương: ${couple}` : 'Chưa chọn đôi uyên ương',
          `${wedding.wishes.length} lời chúc · ${Number(wedding.likes.total || 0).toLocaleString('vi-VN')} tim`
        ]
      };
    } catch (error) {
      return { running: true, lines: [`Lỗi đọc trạng thái: ${error.message}`] };
    }
  }

  function describe() {
    return {
      active: activeId,
      switching: Boolean(switching),
      lastUsername: saved.lastUsername || '',
      obsUrl: `http://${host}:${port}/obs`,
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

  async function activate(id, { carryLive = true } = {}) {
    if (!definitions[id]) throw Object.assign(new Error('Unknown session.'), { status: 400 });
    if (switching) await switching;
    if (id === activeId) {
      instanceFor(id);
      return { ...describe(), carried: '' };
    }
    switching = (async () => {
      let username = '';
      if (activeId && instances.has(activeId)) {
        try {
          username = (await instances.get(activeId).deactivate())?.username || '';
        } catch (error) {
          console.warn(`[Studio] Could not pause ${activeId}: ${error.message}`);
        }
      }
      if (username) saved.lastUsername = username;
      activeId = id;
      const instance = instanceFor(id);
      instance.activate();
      persist();
      emit();
      if (carryLive && username) {
        Promise.resolve(instance.connectLive(username)).catch((error) => {
          console.warn(`[Studio] Could not reconnect @${username} in ${id}: ${error.message}`);
        });
      }
      return username;
    })();
    let carried = '';
    try {
      carried = await switching;
    } finally {
      switching = null;
    }
    return { ...describe(), carried };
  }

  async function deactivateAll() {
    if (!activeId) return describe();
    const current = instances.get(activeId);
    if (current) {
      const result = await current.deactivate();
      if (result?.username) saved.lastUsername = result.username;
    }
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
  app.use('/studio/fonts', express.static(path.join(paths.weddingWeb, 'assets', 'fonts'), { maxAge: '7d' }));
  app.use('/studio', studioStatic);

  // One OBS browser source for both sessions: it follows the active session.
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
    return { host, port };
  }

  async function close() {
    for (const response of listeners) response.end();
    listeners.clear();
    for (const [id, instance] of instances) {
      try {
        if (id === 'prayer') await instance.shutdown();
        else await instance.close();
      } catch (error) {
        console.warn(`[Studio] ${id} shutdown: ${error.message}`);
      }
    }
    persist();
    await new Promise((resolve) => server.close(() => resolve()));
  }

  return { app, server, listen, close, activate, describe };
}
