import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { createWeddingState, publicWeddingState, reduceWedding, WeddingRuleError } from './domain.js';
import { createLiveConnection } from '../../../packages/live-core/src/tiktok.js';

const RPC_ERRORS = { invalid: -32600, params: -32602, method: -32601, rule: -32010, internal: -32603 };

export function createWeddingServer(options = {}) {
  const standalone = options.standalone !== false;
  const host = options.host || process.env.WEDDING_HOST || '127.0.0.1';
  const port = readPort(String(options.port || process.env.WEDDING_PORT || '3108'));
  const webRoot = options.webRoot || (process.env.WEDDING_RESOURCE_DIR
    ? path.join(process.env.WEDDING_RESOURCE_DIR, 'web')
    : path.resolve(import.meta.dir, '../web'));
  const shutdownToken = standalone ? (process.env.WEDDING_SHUTDOWN_TOKEN || '') : '';
  const app = express();
  const server = standalone ? createServer(app) : null;
  const sockets = standalone
    ? new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 })
    : new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
  let wedding = createWeddingState();
  let stream = { state: 'offline', username: '', viewerCount: 0, totalLikes: 0, roomId: null, error: null, retryInMs: null };
  let sequence = 0;
  let closing = false;
  let autoGoals = true;

  function snapshot() {
    return { wedding: publicWeddingState(wedding), stream: { ...stream }, autoGoals };
  }

  function notify(method, params) {
    const payload = JSON.stringify({ jsonrpc: '2.0', method, params });
    for (const socket of sockets.clients) {
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    }
  }

  function applyTransition(input, actor) {
    const previous = wedding;
    const transition = reduceWedding(previous, input);
    wedding = transition.state;
    for (const event of transition.events) {
      sequence += 1;
      notify('wedding.event', { sequence, actor, event });
    }
    if (wedding !== previous || transition.events.length > 0) notify('wedding.state', snapshot());
    if (actor !== 'auto') retuneGoals();
    return snapshot();
  }

  // Mục tiêu "hôn đi", "dô!" và thả tim co giãn theo số người xem. Chỉ đổi khi vòng hiện tại
  // còn gần như trống, để thanh tiến độ trên sân khấu không nhảy lùi.
  function retuneGoals() {
    if (!autoGoals || !(stream.viewerCount > 0)) return;
    const target = goalsForAudience(stream.viewerCount);
    const fresh = (count, goal) => count <= goal * 0.15;
    const patch = {};
    if (target.kissGoal !== wedding.kiss.goal && fresh(wedding.kiss.count, wedding.kiss.goal)) patch.kissGoal = target.kissGoal;
    if (target.cheersGoal !== wedding.cheers.goal && fresh(wedding.cheers.count, wedding.cheers.goal)) patch.cheersGoal = target.cheersGoal;
    if (Object.keys(patch).length) applyTransition({ type: 'wedding.setGoals', ...patch }, 'auto');
    const likeProgress = wedding.likes.total % wedding.likes.goal;
    if (Math.abs(target.likeGoal - wedding.likes.goal) / wedding.likes.goal > 0.3 && fresh(likeProgress, wedding.likes.goal)) {
      applyTransition({ type: 'wedding.setLikeGoal', goal: target.likeGoal }, 'auto');
    }
  }

  // live-core connection: reconnects by itself until tiktok.disconnect(). Inside Studio, options.live is
  // Studio's one shared connection and Studio calls onLiveEvent / onLiveStatus.
  function onLiveEvent(interaction) {
    try { applyTransition({ type: 'interaction', interaction }, 'tiktok'); }
    catch (error) { console.warn(`[Wedding event] ${error.message}`); }
  }
  function onLiveStatus(status) {
    stream = status;
    notify('wedding.state', snapshot());
    retuneGoals();
  }
  const tiktok = options.live || createLiveConnection({ onEvent: onLiveEvent, onStatus: onLiveStatus });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb', strict: true }));
  app.get('/health', (_request, response) => response.json({ ok: true, app: 'virtual-wedding', pid: process.pid, port }));
  app.get('/api/health', (_request, response) => response.json({ ok: true, app: 'virtual-wedding', pid: process.pid, port }));
  app.post('/rpc', async (request, response) => {
    const id = request.body?.id ?? null;
    try {
      const { method, params } = readRpcRequest(request.body);
      const result = await dispatch(method, params);
      response.json({ jsonrpc: '2.0', id, result });
    } catch (error) {
      response.status(200).json(rpcError(id, error));
    }
  });
  app.post('/api/shutdown', (request, response) => {
    if (!shutdownToken || request.get('X-Wedding-Shutdown-Token') !== shutdownToken) {
      response.status(403).json({ error: 'Forbidden' });
      return;
    }
    response.json({ ok: true });
    setTimeout(() => void close(), 40).unref();
  });
  app.get('/stage', (_request, response) => response.sendFile(path.join(webRoot, 'stage.html')));
  app.use(express.static(webRoot, { fallthrough: true, index: 'index.html', maxAge: 0 }));
  app.use((request, response) => response.status(404).json({ error: `No route for ${request.path}` }));

  sockets.on('connection', (socket) => {
    socket.send(JSON.stringify({ jsonrpc: '2.0', method: 'wedding.state', params: snapshot() }));
    socket.on('message', async (raw) => {
      let request;
      try { request = JSON.parse(raw.toString()); }
      catch { return sendSocketError(socket, null, { code: RPC_ERRORS.invalid, message: 'Invalid JSON-RPC request.' }); }
      const id = request?.id ?? null;
      try {
        const { method, params } = readRpcRequest(request);
        const result = await dispatch(method, params);
        if (id !== null) socket.send(JSON.stringify({ jsonrpc: '2.0', id, result }));
      } catch (error) {
        sendSocketError(socket, id, error);
      }
    });
  });

  async function dispatch(method, params) {
    if (method === 'wedding.state.get') return snapshot();
    if (method === 'wedding.open') return applyTransition({ type: 'wedding.open' }, 'host');
    if (method === 'wedding.assignRole') {
      const role = readRole(params.role);
      const name = readText(params.name, 32, 'Enter a participant name.');
      return applyTransition({ type: 'wedding.assignRole', role, name }, 'host');
    }
    if (method === 'wedding.claim.confirm') {
      return applyTransition({ type: 'wedding.claimConfirm', claimId: readText(params.claimId, 80, 'A claim id is required.') }, 'host');
    }
    if (method === 'wedding.claim.decline') {
      return applyTransition({ type: 'wedding.claimDecline', claimId: readText(params.claimId, 80, 'A claim id is required.') }, 'host');
    }
    if (method === 'wedding.couple.lock') return applyTransition({ type: 'wedding.lockCouple' }, 'host');
    if (method === 'wedding.phase.advance') return applyTransition({ type: 'wedding.advance' }, 'host');
    if (method === 'wedding.end') return applyTransition({ type: 'wedding.end' }, 'host');
    if (method === 'wedding.bouquet.open') return applyTransition({ type: 'wedding.bouquetOpen' }, 'host');
    if (method === 'wedding.bouquet.toss') return applyTransition({ type: 'wedding.bouquetToss' }, 'host');
    if (method === 'wedding.goals.set') {
      if (typeof params.autoGoals === 'boolean') autoGoals = params.autoGoals;
      else if (params.kissGoal !== undefined || params.cheersGoal !== undefined) autoGoals = false;
      if (autoGoals) {
        retuneGoals();
        notify('wedding.state', snapshot());
        return snapshot();
      }
      return applyTransition({
        type: 'wedding.setGoals',
        kissGoal: params.kissGoal === undefined ? undefined : readNumber(params.kissGoal, 'Kiss goal must be a number.'),
        cheersGoal: params.cheersGoal === undefined ? undefined : readNumber(params.cheersGoal, 'Cheers goal must be a number.')
      }, 'host');
    }
    if (method === 'wedding.likeGoal.set') {
      const goal = readNumber(params.goal, 'Like goal must be a number.');
      autoGoals = false;
      return applyTransition({ type: 'wedding.setLikeGoal', goal }, 'host');
    }
    if (method === 'tiktok.connect') {
      const username = readText(params.username, 80, 'Enter a TikTok username.');
      try {
        await tiktok.connect(username);
      } catch (error) {
        throw { code: RPC_ERRORS.rule, data: { code: 'tiktok_connect_failed' }, message: error.message };
      }
      return snapshot();
    }
    if (method === 'tiktok.disconnect') {
      await tiktok.disconnect();
      return snapshot();
    }
    if (method === 'wedding.audience.simulate') {
      stream = { ...stream, viewerCount: readNumber(params.viewerCount, 'Viewer count must be a number.') };
      notify('wedding.state', snapshot());
      retuneGoals();
      return snapshot();
    }
    if (method === 'wedding.simulate') {
      const interaction = readSimulation(params.interaction);
      return applyTransition({ type: 'interaction', interaction }, 'simulator');
    }
    throw { code: RPC_ERRORS.method, message: `Unknown method: ${method}` };
  }

  function sendSocketError(socket, id, error) {
    if (socket.readyState !== WebSocket.OPEN || id === null) return;
    socket.send(JSON.stringify(rpcError(id, error)));
  }

  async function listen() {
    if (!server) throw new Error('This wedding instance is embedded; the host server owns the port.');
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, resolve);
    });
    return { host, port };
  }

  async function close() {
    if (closing) return;
    closing = true;
    if (!options.live) await tiktok.disconnect();
    for (const socket of sockets.clients) socket.close(1001, 'Wedding app shutting down');
    if (server) await new Promise((resolve) => server.close(resolve));
  }

  // Studio session lifecycle: keep the ceremony in memory, release the live room and sockets.
  async function deactivate() {
    // Studio's shared connection stays up. Our own connection: hand the room over and stop retrying.
    const username = options.live ? '' : tiktok.getWanted();
    if (!options.live) await tiktok.disconnect();
    for (const socket of sockets.clients) socket.close(1012, 'Session switched');
    return { username };
  }

  function handleUpgrade(request, socket, head) {
    sockets.handleUpgrade(request, socket, head, (ws) => sockets.emit('connection', ws, request));
  }

  return {
    app,
    dispatch,
    listen,
    close,
    deactivate,
    activate: () => {},
    handleUpgrade,
    connectLive: (username) => dispatch('tiktok.connect', { username }),
    onLiveEvent,
    onLiveStatus,
    getPhase: () => wedding.phase,
    getSnapshot: snapshot,
    getStatus: () => ({ live: { ...stream } })
  };
}

function readRpcRequest(body) {
  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string' || !body.method.trim()) {
    throw { code: RPC_ERRORS.invalid, message: 'A JSON-RPC 2.0 method is required.' };
  }
  if (body.params !== undefined && (!body.params || typeof body.params !== 'object' || Array.isArray(body.params))) {
    throw { code: RPC_ERRORS.params, message: 'RPC params must be an object.' };
  }
  return { method: body.method, params: body.params || {} };
}

function readSimulation(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw { code: RPC_ERRORS.params, message: 'An interaction object is required.' };
  }
  const kind = raw.kind;
  if (!['comment', 'like', 'follow', 'share', 'member', 'gift'].includes(kind)) {
    throw { code: RPC_ERRORS.params, message: 'Choose a supported TikTok interaction.' };
  }
  const viewerRaw = raw.viewer && typeof raw.viewer === 'object' ? raw.viewer : {};
  const viewer = {
    id: String(viewerRaw.id || 'simulated-viewer').slice(0, 96),
    name: String(viewerRaw.name || 'Khách mời').slice(0, 32),
    avatar: safeAvatar(viewerRaw.avatar)
  };
  if (kind === 'comment') return { kind, viewer, text: String(raw.text || '').slice(0, 500) };
  if (kind === 'like') return { kind, viewer, count: readNumber(raw.count ?? 1, 'Like count must be a number.') };
  if (kind === 'gift') {
    return {
      kind,
      viewer,
      name: String(raw.name || 'Hoa chúc mừng').slice(0, 48),
      count: readNumber(raw.count ?? 1, 'Gift count must be a number.'),
      coins: readNumber(raw.coins ?? 1, 'Gift value must be a number.')
    };
  }
  return { kind, viewer };
}

function readRole(value) {
  if (value !== 'bride' && value !== 'groom') {
    throw { code: RPC_ERRORS.params, message: 'Role must be bride or groom.' };
  }
  return value;
}

function readText(value, max, message) {
  if (typeof value !== 'string' || !value.trim()) throw { code: RPC_ERRORS.params, message };
  return value.trim().slice(0, max);
}

function readNumber(value, message) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw { code: RPC_ERRORS.params, message };
  return number;
}

function safeAvatar(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value.slice(0, 512) : '';
}

function rpcError(id, error) {
  const isRuleError = error instanceof WeddingRuleError;
  const code = isRuleError ? RPC_ERRORS.rule : Number.isInteger(error?.code) ? error.code : RPC_ERRORS.internal;
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message: String(error?.message || 'The request failed.'),
      ...(isRuleError ? { data: { code: error.code } } : error?.data ? { data: error.data } : {})
    }
  };
}

function readPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('WEDDING_PORT must be between 1 and 65535.');
  return port;
}

function goalsForAudience(viewers) {
  const audience = Math.max(1, Number(viewers) || 0);
  const round = (value, step) => Math.round(value / step) * step;
  return {
    kissGoal: Math.min(300, Math.max(10, round(audience * 0.3, 5))),
    cheersGoal: Math.min(200, Math.max(8, round(audience * 0.25, 2))),
    likeGoal: Math.min(1_000_000, Math.max(200, round(audience * 20, audience >= 100 ? 500 : 100)))
  };
}
