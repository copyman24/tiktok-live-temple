// JSON-RPC 2.0 over one WebSocket path (`/ws`) plus `POST /rpc`, the transport every session uses.
//
//   const hub = createRpcHub({ dispatch: (method, params, client) => ..., onConnect: (client) => ... });
//   standalone: hub.attach(httpServer)          embedded (Studio): hub.handleUpgrade(req, socket, head)
//   hub.notify('classroom.view', view)          hub.notify('voice.say', line, (c) => c.id === speakerId)
//   app.post('/rpc', express.json(), hub.httpHandler)
import { WebSocket, WebSocketServer } from 'ws';

export const RPC_ERRORS = { parse: -32700, invalid: -32600, method: -32601, params: -32602, internal: -32603, rule: -32010 };

export class RpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

/**
 * @param {{
 *   dispatch: (method: string, params: object, client: RpcClient | null) => unknown | Promise<unknown>,
 *   onConnect?: (client: RpcClient) => void,
 *   onDisconnect?: (client: RpcClient) => void,
 *   maxPayload?: number,
 *   log?: Pick<Console, 'warn'>
 * }} options
 * @typedef {{ id: string, query: URLSearchParams, data: Record<string, unknown>, send: (method: string, params?: unknown) => void, close: (code?: number, reason?: string) => void }} RpcClient
 */
export function createRpcHub({ dispatch, onConnect = () => {}, onDisconnect = () => {}, maxPayload = 256 * 1024, log = console }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload });
  const clients = new Map();
  let nextId = 1;

  wss.on('connection', (ws, request) => {
    const url = new URL(request.url || '/ws', 'http://localhost');
    const client = {
      id: `c${nextId++}`,
      query: url.searchParams,
      data: {},
      send(method, params) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ jsonrpc: '2.0', method, params }));
      },
      close: (code = 1000, reason = '') => ws.close(code, reason)
    };
    clients.set(ws, client);
    ws.on('message', async (raw) => {
      let body;
      try { body = JSON.parse(raw.toString()); } catch {
        return reply(ws, { jsonrpc: '2.0', id: null, error: { code: RPC_ERRORS.parse, message: 'Invalid JSON.' } });
      }
      const response = await handle(body, client);
      if (response && body?.id !== undefined && body?.id !== null) reply(ws, response);
    });
    ws.on('close', () => {
      clients.delete(ws);
      try { onDisconnect(client); } catch (error) { log.warn(`[rpc] onDisconnect: ${error.message}`); }
    });
    try { onConnect(client); } catch (error) { log.warn(`[rpc] onConnect: ${error.message}`); }
  });

  async function handle(body, client) {
    const id = body?.id ?? null;
    try {
      if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string' || !body.method.trim()) {
        throw new RpcError(RPC_ERRORS.invalid, 'A JSON-RPC 2.0 method is required.');
      }
      if (body.params !== undefined && (!body.params || typeof body.params !== 'object' || Array.isArray(body.params))) {
        throw new RpcError(RPC_ERRORS.params, 'RPC params must be an object.');
      }
      const result = await dispatch(body.method, body.params || {}, client);
      return { jsonrpc: '2.0', id, result: result ?? null };
    } catch (error) {
      const code = Number.isInteger(error?.code) ? error.code : RPC_ERRORS.internal;
      if (code === RPC_ERRORS.internal) log.warn(`[rpc] ${body?.method}: ${error?.stack || error}`);
      return { jsonrpc: '2.0', id, error: { code, message: String(error?.message || 'The request failed.'), ...(error?.data ? { data: error.data } : {}) } };
    }
  }

  function reply(ws, payload) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  }

  return {
    /** Standalone: serve `/ws` on this HTTP server. */
    attach(server, path = '/ws') {
      server.on('upgrade', (request, socket, head) => {
        if (new URL(request.url || '/', 'http://localhost').pathname !== path) return socket.destroy();
        wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
      });
    },
    handleUpgrade(request, socket, head) {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    },
    /** Push a notification to every client, or to those `filter` accepts. */
    notify(method, params, filter) {
      const payload = JSON.stringify({ jsonrpc: '2.0', method, params });
      for (const [ws, client] of clients) {
        if (ws.readyState === WebSocket.OPEN && (!filter || filter(client))) ws.send(payload);
      }
    },
    clients: () => [...clients.values()],
    async httpHandler(request, response) {
      response.json(await handle(request.body, null));
    },
    closeAll(code = 1001, reason = 'Server closing') {
      for (const ws of clients.keys()) ws.close(code, reason);
    }
  };
}
