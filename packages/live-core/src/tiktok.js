// One TikTok Live room connection with the lifecycle a stream left running all day needs,
// and one normalized event shape for every session (prayer, wedding, classroom).
//
// Lifecycle (from the classroom app): ask TikTok whether the account is live before connecting,
// give up a connect attempt after `connectTimeoutMs`, and reconnect with backoff after a drop,
// a stream end or a failed attempt until the operator calls disconnect().
// Stale-event guard (from the wedding app): every handler belongs to one attempt, so events from
// a replaced connection are dropped.
// Fair timing (from the classroom app): every event carries `sentAt`, TikTok's send time mapped
// onto this machine's clock, so "who answered first" does not depend on delivery order.
import { ControlEvent, TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { resolveUsername } from './username.js';

const MAX_GIFT_GROUPS = 500;
const SKEW_WINDOW = 64;

const DEFAULTS = {
  checkLive: true,
  connectTimeoutMs: 30_000,
  reconnectBaseMs: 15_000,
  reconnectMaxMs: 120_000
};

/**
 * @typedef {{ id: string, name: string, avatar: string }} Viewer
 * @typedef {(
 *   | { kind: 'comment', viewer: Viewer, text: string }
 *   | { kind: 'like', viewer: Viewer, count: number, totalLikes: number }
 *   | { kind: 'follow' | 'share' | 'member', viewer: Viewer }
 *   | { kind: 'gift', viewer: Viewer, name: string, giftId: string, count: number, coins: number, comboId: string, comboTotal: number }
 * ) & { sentAt: number, receivedAt: number }} LiveEvent
 * @typedef {{
 *   state: 'offline' | 'connecting' | 'live' | 'reconnecting' | 'error',
 *   username: string, roomId: string | null, viewerCount: number, totalLikes: number,
 *   error: string | null, retryInMs: number | null
 * }} LiveStatus
 */

/**
 * @param {{
 *   onEvent?: (event: LiveEvent) => void,
 *   onStatus?: (status: LiveStatus) => void,
 *   Connection?: typeof TikTokLiveConnection,
 *   resolve?: (input: string) => Promise<string>,
 *   now?: () => number,
 *   timers?: { setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout },
 *   checkLive?: boolean, connectTimeoutMs?: number, reconnectBaseMs?: number, reconnectMaxMs?: number,
 *   log?: Pick<Console, 'log' | 'warn'>
 * }} options
 */
export function createLiveConnection(options = {}) {
  const {
    onEvent = () => {},
    onStatus = () => {},
    Connection = TikTokLiveConnection,
    resolve = (input) => resolveUsername(input),
    now = Date.now,
    timers = { setTimeout, clearTimeout },
    log = console
  } = options;
  const config = { ...DEFAULTS, ...pick(options, Object.keys(DEFAULTS)) };

  let status = offlineStatus();
  let connection = null;
  let generation = 0;
  let wanted = '';
  let reconnectTimer = null;
  let reconnectTries = 0;
  const giftGroups = new Map();
  const skew = createSkewEstimator();

  function update(patch) {
    status = { ...status, ...patch };
    try { onStatus({ ...status }); } catch (error) { log.warn(`[live-core] onStatus failed: ${error.message}`); }
  }

  function emit(event) {
    try { onEvent(event); } catch (error) { log.warn(`[live-core] onEvent(${event.kind}) failed: ${error.message}`); }
  }

  async function release() {
    generation += 1;
    const active = connection;
    connection = null;
    giftGroups.clear();
    if (active) {
      try { await active.disconnect(); } catch {}
    }
  }

  function stopReconnect() {
    if (reconnectTimer) timers.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function scheduleReconnect(reason) {
    if (!wanted || reconnectTimer) return;
    const delay = Math.min(config.reconnectMaxMs, config.reconnectBaseMs * 2 ** reconnectTries);
    reconnectTries += 1;
    log.log(`[live-core] ${reason}. Reconnecting @${wanted} in ${delay / 1000}s`);
    update({ state: 'reconnecting', error: reason, retryInMs: delay });
    reconnectTimer = timers.setTimeout(() => {
      reconnectTimer = null;
      attempt(wanted).catch(() => {}); // a failed attempt schedules the next one itself
    }, delay);
    reconnectTimer?.unref?.();
  }

  async function attempt(username) {
    await release();
    const own = generation;
    const current = () => own === generation;
    const live = new Connection(username, {
      processInitialData: true,
      fetchRoomInfoOnConnect: false,
      enableExtendedGiftInfo: false
    });
    connection = live;
    update({ state: 'connecting', username, roomId: null, viewerCount: 0, error: null, retryInMs: null });

    const on = (name, handler) => live.on(name, (data) => {
      if (!current()) return;
      try { handler(data); } catch (error) { log.warn(`[live-core] ${name} handler failed: ${error.message}`); }
    });

    on(ControlEvent.CONNECTED, (roomState) => {
      reconnectTries = 0;
      update({ state: 'live', roomId: roomIdOf(roomState, live), error: null, retryInMs: null });
    });
    on(ControlEvent.DISCONNECTED, () => {
      update({ state: 'offline', viewerCount: 0 });
      scheduleReconnect('Mất kết nối TikTok');
    });
    on(WebcastEvent.STREAM_END, () => {
      update({ state: 'offline', viewerCount: 0 });
      scheduleReconnect('Phiên live đã kết thúc');
    });
    on(ControlEvent.ERROR, (error) => {
      update({ error: messageOf(error) });
    });
    on(WebcastEvent.ROOM_USER, (data) => {
      const viewerCount = boundedInt(data?.total ?? data?.viewerCount ?? data?.totalUser, 0, 100_000_000, -1);
      if (viewerCount >= 0) update({ viewerCount });
    });
    on(WebcastEvent.CHAT, (data) => {
      emit({ kind: 'comment', viewer: viewerOf(data), text: String(data?.content ?? data?.comment ?? '').slice(0, 500), ...timing(data) });
    });
    on(WebcastEvent.LIKE, (data) => {
      const totalLikes = boundedInt(data?.totalLikeCount ?? data?.totalLikes, 0, Number.MAX_SAFE_INTEGER, -1);
      if (totalLikes >= 0) update({ totalLikes });
      emit({
        kind: 'like',
        viewer: viewerOf(data),
        count: boundedInt(data?.count ?? data?.likeCount, 1, 10_000, 1),
        totalLikes: status.totalLikes,
        ...timing(data)
      });
    });
    for (const kind of ['follow', 'share', 'member']) {
      const name = { follow: WebcastEvent.FOLLOW, share: WebcastEvent.SHARE, member: WebcastEvent.MEMBER }[kind];
      on(name, (data) => emit({ kind, viewer: viewerOf(data), ...timing(data) }));
    }
    on(WebcastEvent.GIFT, (data) => {
      const gift = readGift(data, giftGroups);
      if (gift) emit({ kind: 'gift', viewer: gift.viewer, name: gift.name, giftId: gift.giftId, count: gift.count, coins: gift.coins, comboId: gift.comboId, comboTotal: gift.comboTotal, comboEnd: gift.comboEnd, ...timing(data) });
    });

    try {
      if (config.checkLive && typeof live.fetchIsLive === 'function') {
        const isLive = await live.fetchIsLive().catch(() => true); // the check itself failing is not a verdict
        if (!current()) return { ...status };
        if (!isLive) throw new Error(`@${username} chưa LIVE. Bấm Phát trực tiếp trong TikTok LIVE Studio trước`);
      }
      const roomState = await withTimeout(live.connect(), config.connectTimeoutMs, timers,
        `quá ${Math.round(config.connectTimeoutMs / 1000)} giây không vào được phòng live`);
      if (current()) {
        reconnectTries = 0;
        update({ state: 'live', roomId: roomIdOf(roomState, live), error: null, retryInMs: null });
      }
      return { ...status };
    } catch (error) {
      const message = messageOf(error);
      if (current()) {
        await release();
        update({ state: 'error', error: message, retryInMs: null });
        scheduleReconnect(`Không kết nối được: ${message}`);
      }
      throw new Error(message);
    }
  }

  /** Connect to `input` (handle, URL or share link) and keep that room connected until disconnect(). */
  async function connect(input) {
    const username = await resolve(input);
    stopReconnect();
    reconnectTries = 0;
    wanted = username;
    return attempt(username);
  }

  /** Leave the room and stop reconnecting. */
  async function disconnect() {
    wanted = '';
    stopReconnect();
    reconnectTries = 0;
    await release();
    skew.reset();
    status = offlineStatus();
    update({});
    return { ...status };
  }

  function timing(data) {
    const receivedAt = now();
    const tiktokTime = createTimeOf(data);
    return { sentAt: tiktokTime ? skew.toLocal(tiktokTime, receivedAt) : receivedAt, receivedAt };
  }

  return {
    connect,
    disconnect,
    getStatus: () => ({ ...status }),
    /** The handle this connection is trying to keep live ('' after disconnect). */
    getWanted: () => wanted
  };
}

// ---------- normalization helpers (exported for tests and for apps that replay raw payloads) ----------

export function viewerOf(data) {
  const user = data?.user || data || {};
  const id = String(user.uniqueId || user.displayId || user.userId || data?.uniqueId || user.nickname || 'viewer').slice(0, 96);
  const name = String(user.nickname || user.uniqueId || user.displayId || data?.nickname || 'Bạn').slice(0, 48);
  const avatar = user.profilePictureUrl
    || user.avatarLarge?.urlList?.[0]
    || user.avatarMedium?.urlList?.[0]
    || user.avatarThumb?.urlList?.[0]
    || data?.profilePictureUrl
    || '';
  return { id, name, avatar: /^https?:\/\//i.test(avatar) ? String(avatar).slice(0, 512) : '' };
}

/**
 * TikTok resends a gift combo with a growing repeatCount. Count only the new part.
 * Streakable gifts (type 1) stay open until repeatEnd. Other gifts close at once, so two
 * separate roses from the same viewer both count.
 */
export function readGift(data, groups) {
  const gift = data?.gift || data?.giftDetails || {};
  const viewer = viewerOf(data);
  const giftId = String(data?.giftId || gift.id || gift.name || 'gift');
  const key = String(data?.groupId || `${viewer.id}:${giftId}`);
  const repeatCount = boundedInt(data?.repeatCount ?? data?.comboCount, 1, 100_000, 1);
  const streakable = (gift.type ?? data?.giftDetails?.giftType ?? data?.giftType) === 1;
  const previous = groups.get(key) || 0;
  if (repeatCount <= previous) {
    if (data?.repeatEnd || !streakable) groups.delete(key);
    return null;
  }
  const count = repeatCount - previous;
  if (streakable && !data?.repeatEnd) {
    groups.delete(key);
    groups.set(key, repeatCount);
    if (groups.size > MAX_GIFT_GROUPS) groups.delete(groups.keys().next().value);
  } else {
    groups.delete(key);
  }
  const diamondCount = boundedInt(gift.diamondCount ?? data?.diamondCount, 1, 1_000_000, 1);
  return {
    viewer,
    giftId,
    name: String(gift.name || data?.giftName || gift.describe || 'Quà').slice(0, 48),
    count,
    coins: diamondCount * count,
    // The whole send so far: a combo keeps its id while repeatCount grows (×5 tap or a 5-tap streak).
    // The same id comes back for the viewer's next send of this gift; a total that does not grow means a new send.
    comboId: key,
    comboTotal: repeatCount,
    comboEnd: !(streakable && !data?.repeatEnd)
  };
}

/** TikTok's send time in ms, or 0 when the payload has none. Accepts seconds or milliseconds. */
export function createTimeOf(data) {
  const raw = Number(data?.common?.createTime ?? data?.createTime ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw < 1e12 ? raw * 1000 : raw;
}

/**
 * Map TikTok timestamps onto the local clock. The smallest recent (received − sent) gap is the
 * best estimate of clock offset plus minimum network delay; adding it keeps ordering exact and
 * puts `sentAt` no later than the receive time.
 */
export function createSkewEstimator(windowSize = SKEW_WINDOW) {
  let samples = [];
  return {
    toLocal(tiktokTime, receivedAt) {
      samples.push(receivedAt - tiktokTime);
      if (samples.length > windowSize) samples = samples.slice(-windowSize);
      return Math.min(receivedAt, tiktokTime + Math.min(...samples));
    },
    reset() { samples = []; }
  };
}

function offlineStatus() {
  return { state: 'offline', username: '', roomId: null, viewerCount: 0, totalLikes: 0, error: null, retryInMs: null };
}

function roomIdOf(roomState, live) {
  const id = roomState?.roomId || live?.roomId || '';
  return id ? String(id) : null;
}

function messageOf(error) {
  return String(error?.message || error || 'Lỗi không rõ').slice(0, 240);
}

function boundedInt(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
}

function pick(source, keys) {
  return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}

function withTimeout(promise, ms, timers, message) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = timers.setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, timeout]).finally(() => timers.clearTimeout(timer));
}
