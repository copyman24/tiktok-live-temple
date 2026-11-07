// One JSON-RPC 2.0 WebSocket to the classroom server (/ws), shared by the whole page.
// Reconnects by itself; requests made while offline wait for the connection.
type Handler = (params: any) => void;

const params = new URLSearchParams(window.location.search);
const role = params.get('view') === 'stage' ? 'stage' : 'dashboard';
const handlers = new Map<string, Set<Handler>>();
const waiting = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
let socket: WebSocket | null = null;
let nextId = 1;
let opened: Promise<void>;
let markOpen: () => void = () => {};

function connect() {
  opened = new Promise((resolve) => { markOpen = resolve; });
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${location.host}/ws?role=${role}`);
  socket = ws;
  ws.onopen = () => {
    markOpen();
    emit('$open', {});
  };
  ws.onmessage = (event) => {
    let msg: any;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.id != null && waiting.has(msg.id)) {
      const w = waiting.get(msg.id)!;
      waiting.delete(msg.id);
      if (msg.error) w.reject(new Error(msg.error.message || 'Yêu cầu chưa thực hiện được'));
      else w.resolve(msg.result);
    } else if (msg.method) emit(msg.method, msg.params);
  };
  ws.onclose = () => {
    for (const [, w] of waiting) w.reject(new Error('Mất kết nối tới máy chủ'));
    waiting.clear();
    emit('$close', {});
    setTimeout(connect, 2000);
  };
}

function emit(method: string, payload: unknown) {
  for (const fn of handlers.get(method) ?? []) {
    try { fn(payload); } catch (error) { console.warn(`[rpc] ${method}:`, error); }
  }
}

export function on(method: string, fn: Handler) {
  if (!handlers.has(method)) handlers.set(method, new Set());
  handlers.get(method)!.add(fn);
  return () => handlers.get(method)?.delete(fn);
}

export async function rpc<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  await opened;
  return new Promise<T>((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    socket!.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  });
}

/** Fire-and-forget (voice reports): never blocks, dropped while offline. */
export function notify(method: string, params: Record<string, unknown> = {}) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }));
}

connect();
