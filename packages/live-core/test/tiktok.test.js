import { describe, expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { ControlEvent, WebcastEvent } from 'tiktok-live-connector';
import { createLiveConnection, createSkewEstimator, readGift, viewerOf } from '../src/tiktok.js';
import { parseUsername, resolveUsername } from '../src/username.js';

// ---------- fakes ----------

function fakeTimers() {
  let clock = 0;
  let nextId = 1;
  const pending = new Map();
  return {
    setTimeout(fn, ms) { const id = nextId++; pending.set(id, { at: clock + ms, fn }); return id; },
    clearTimeout(id) { pending.delete(id); },
    /** Run every timer due within `ms`, in order. */
    async advance(ms) {
      const until = clock + ms;
      for (;;) {
        const due = [...pending].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        pending.delete(due[0]);
        clock = due[1].at;
        due[1].fn();
        await flush();
      }
      clock = until;
    },
    get size() { return pending.size; }
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function fakeConnectionClass({ live = true, fail = null, hang = false } = {}) {
  const created = [];
  class FakeConnection extends EventEmitter {
    constructor(username) {
      super();
      this.username = username;
      this.disconnected = false;
      created.push(this);
    }
    async fetchIsLive() { return typeof live === 'function' ? live(created.length) : live; }
    connect() {
      if (hang) return new Promise(() => {});
      const failure = typeof fail === 'function' ? fail(created.length) : fail;
      if (failure) return Promise.reject(new Error(failure));
      return Promise.resolve({ roomId: `room-${created.length}` });
    }
    async disconnect() { this.disconnected = true; }
  }
  return { FakeConnection, created };
}

function setup(connectionOptions, extra = {}) {
  const timers = fakeTimers();
  const { FakeConnection, created } = fakeConnectionClass(connectionOptions);
  const events = [];
  const statuses = [];
  let clock = 1_000_000;
  const live = createLiveConnection({
    Connection: FakeConnection,
    resolve: async (input) => parseUsername(input),
    timers,
    now: () => clock,
    log: { log() {}, warn() {} },
    onEvent: (event) => events.push(event),
    onStatus: (status) => statuses.push(status),
    ...extra
  });
  return { live, timers, created, events, statuses, setClock: (value) => { clock = value; } };
}

const chat = (user, content, createTime) => ({ user: { uniqueId: user, nickname: user.toUpperCase() }, content, common: { createTime } });

// ---------- tests ----------

describe('connect lifecycle', () => {
  test('connects and reports live with the room id', async () => {
    const { live, statuses } = setup();
    const status = await live.connect('@lan.anh');
    expect(status).toMatchObject({ state: 'live', username: 'lan.anh', roomId: 'room-1', error: null });
    expect(statuses.map((s) => s.state)).toEqual(['connecting', 'live']);
  });

  test('refuses an account that is not live, then keeps retrying with backoff', async () => {
    const { live, timers, created } = setup({ live: (n) => n >= 3 });
    await expect(live.connect('lan')).rejects.toThrow('chưa LIVE');
    expect(live.getStatus()).toMatchObject({ state: 'reconnecting', retryInMs: 15_000 });

    await timers.advance(15_000); // second try: still not live
    expect(created).toHaveLength(2);
    expect(live.getStatus().retryInMs).toBe(30_000);

    await timers.advance(30_000); // third try: live
    expect(live.getStatus()).toMatchObject({ state: 'live', roomId: 'room-3' });
    expect(timers.size).toBe(0);
  });

  test('backoff is capped', async () => {
    const { live, timers } = setup({ fail: 'boom' }, { reconnectBaseMs: 1000, reconnectMaxMs: 5000 });
    await expect(live.connect('lan')).rejects.toThrow('boom');
    const delays = [];
    for (let i = 0; i < 5; i++) {
      delays.push(live.getStatus().retryInMs);
      await timers.advance(live.getStatus().retryInMs);
    }
    expect(delays).toEqual([1000, 2000, 4000, 5000, 5000]);
  });

  test('a hanging connect times out', async () => {
    const { live, timers } = setup({ hang: true }, { connectTimeoutMs: 30_000 });
    const pending = live.connect('lan');
    const settled = pending.catch((error) => error);
    await flush();
    await timers.advance(30_000);
    expect((await settled).message).toContain('30 giây');
    expect(live.getStatus().state).toBe('reconnecting');
  });

  test('a drop or stream end schedules a reconnect to the same account', async () => {
    const { live, timers, created } = setup();
    await live.connect('lan');
    created[0].emit(ControlEvent.DISCONNECTED);
    expect(live.getStatus()).toMatchObject({ state: 'reconnecting', error: 'Mất kết nối TikTok' });
    await timers.advance(15_000);
    expect(live.getStatus()).toMatchObject({ state: 'live', roomId: 'room-2', username: 'lan' });
    expect(created[0].disconnected).toBe(true);

    created[1].emit(WebcastEvent.STREAM_END, {});
    expect(live.getStatus()).toMatchObject({ state: 'reconnecting', retryInMs: 15_000 }); // tries reset after success
  });

  test('disconnect stops retries and clears the wanted account', async () => {
    const { live, timers, created } = setup({ fail: 'boom' });
    await expect(live.connect('lan')).rejects.toThrow();
    await live.disconnect();
    expect(live.getWanted()).toBe('');
    expect(live.getStatus()).toMatchObject({ state: 'offline', username: '', error: null });
    await timers.advance(600_000);
    expect(created).toHaveLength(1);
  });

  test('connecting to another account replaces the old one and ignores its events', async () => {
    const { live, created, events } = setup();
    await live.connect('first');
    await live.connect('second');
    created[0].emit(WebcastEvent.CHAT, chat('ghost', 'hi'));
    created[0].emit(ControlEvent.DISCONNECTED);
    created[1].emit(WebcastEvent.CHAT, chat('real', 'hello'));
    expect(events.map((e) => e.viewer.id)).toEqual(['real']);
    expect(live.getStatus()).toMatchObject({ state: 'live', username: 'second' });
  });
});

describe('events', () => {
  test('comments carry viewer, text and timing', async () => {
    const { live, created, events, setClock } = setup();
    await live.connect('lan');
    setClock(5_000_500);
    created[0].emit(WebcastEvent.CHAT, chat('minh', 'PHỞ', String(5_000_000)));
    expect(events[0]).toEqual({
      kind: 'comment',
      viewer: { id: 'minh', name: 'MINH', avatar: '' },
      text: 'PHỞ',
      sentAt: 5_000_000 + 500,
      receivedAt: 5_000_500
    });
  });

  test('likes update the room total; viewer count accepts both field names', async () => {
    const { live, created, events } = setup();
    await live.connect('lan');
    created[0].emit(WebcastEvent.LIKE, { user: { uniqueId: 'a' }, likeCount: 15, totalLikeCount: 1200 });
    expect(events[0]).toMatchObject({ kind: 'like', count: 15, totalLikes: 1200 });
    created[0].emit(WebcastEvent.ROOM_USER, { total: 321 });
    expect(live.getStatus().viewerCount).toBe(321);
    created[0].emit(WebcastEvent.ROOM_USER, { viewerCount: 400 });
    expect(live.getStatus().viewerCount).toBe(400);
  });

  test('follow, share and member become social events', async () => {
    const { live, created, events } = setup();
    await live.connect('lan');
    created[0].emit(WebcastEvent.FOLLOW, { user: { uniqueId: 'f' } });
    created[0].emit(WebcastEvent.SHARE, { user: { uniqueId: 's' } });
    created[0].emit(WebcastEvent.MEMBER, { user: { uniqueId: 'm' } });
    expect(events.map((e) => `${e.kind}:${e.viewer.id}`)).toEqual(['follow:f', 'share:s', 'member:m']);
  });

  test('a throwing consumer does not break the connection', async () => {
    const { FakeConnection, created } = fakeConnectionClass();
    const live = createLiveConnection({
      Connection: FakeConnection,
      resolve: async (input) => input,
      log: { log() {}, warn() {} },
      onEvent: () => { throw new Error('consumer bug'); }
    });
    await live.connect('lan');
    expect(() => created[0].emit(WebcastEvent.CHAT, chat('a', 'x'))).not.toThrow();
    expect(live.getStatus().state).toBe('live');
  });
});

describe('gifts', () => {
  const rose = (extra) => ({ user: { uniqueId: 'lan' }, giftId: 5655, gift: { name: 'Rose', diamondCount: 1, type: 1 }, ...extra });

  test('a streak counts only the new part of each resend', () => {
    const groups = new Map();
    expect(readGift(rose({ repeatCount: 1 }), groups).count).toBe(1);
    expect(readGift(rose({ repeatCount: 5 }), groups)).toMatchObject({ count: 4, coins: 4 });
    expect(readGift(rose({ repeatCount: 5 }), groups)).toBeNull(); // duplicate resend
    expect(readGift(rose({ repeatCount: 7, repeatEnd: true }), groups).count).toBe(2);
    expect(groups.size).toBe(0);
  });

  test('every part of a combo reports the combo id and its running total', () => {
    const groups = new Map();
    const a = readGift(rose({ groupId: 'g9', repeatCount: 2 }), groups);
    const b = readGift(rose({ groupId: 'g9', repeatCount: 5, repeatEnd: true }), groups);
    expect([a.comboId, a.comboTotal, a.count]).toEqual(['g9', 2, 2]);
    expect([b.comboId, b.comboTotal, b.count]).toEqual(['g9', 5, 3]);
  });

  test('two separate non-streak gifts both count', () => {
    const groups = new Map();
    const lion = { user: { uniqueId: 'lan' }, giftId: 1, gift: { name: 'Lion', diamondCount: 29999, type: 2 }, repeatCount: 1 };
    expect(readGift(lion, groups)).toMatchObject({ count: 1, coins: 29999 });
    expect(readGift(lion, groups)).toMatchObject({ count: 1, coins: 29999 });
  });

  test('groupId separates parallel streaks of the same gift', () => {
    const groups = new Map();
    readGift(rose({ groupId: 'g1', repeatCount: 3 }), groups);
    expect(readGift(rose({ groupId: 'g2', repeatCount: 2 }), groups).count).toBe(2);
  });

  test('open streaks are bounded', () => {
    const groups = new Map();
    for (let i = 0; i < 600; i++) readGift(rose({ groupId: `g${i}`, repeatCount: 1 }), groups);
    expect(groups.size).toBe(500);
  });
});

describe('helpers', () => {
  test('viewerOf prefers the handle and accepts only http avatars', () => {
    expect(viewerOf({ user: { displayId: 'd', nickname: 'Lan', avatarThumb: { urlList: ['https://x/a.jpg'] } } }))
      .toEqual({ id: 'd', name: 'Lan', avatar: 'https://x/a.jpg' });
    expect(viewerOf({ user: { uniqueId: 'u', profilePictureUrl: 'javascript:alert(1)' } }).avatar).toBe('');
  });

  test('skew estimator maps TikTok time onto the local clock without reordering', () => {
    const skew = createSkewEstimator();
    // TikTok clock is 2 s behind; network delay varies 100–900 ms
    const a = skew.toLocal(10_000, 12_100);
    const b = skew.toLocal(10_050, 12_950); // sent later, arrived much later
    const c = skew.toLocal(10_020, 12_300); // sent between a and b
    expect(a).toBe(12_100);
    expect(c).toBe(12_120);
    expect(a < c && c < b).toBe(true);
  });

  test('parseUsername handles handles and profile URLs', () => {
    expect(parseUsername('@lan.anh')).toBe('lan.anh');
    expect(parseUsername('https://www.tiktok.com/@lan_anh/live?x=1')).toBe('lan_anh');
    expect(parseUsername('vt.tiktok.com/ZSabc/')).toBe('');
    expect(() => parseUsername('')).toThrow();
    expect(() => parseUsername('not a valid!')).toThrow();
    expect(() => parseUsername('https://example.com/x')).toThrow();
  });

  test('resolveUsername follows short share links', async () => {
    const fetchImpl = async () => ({ url: 'https://www.tiktok.com/@chua.linh.ung/live' });
    expect(await resolveUsername('https://vt.tiktok.com/ZSabc/', { fetchImpl })).toBe('chua.linh.ung');
    const dead = async () => ({ url: 'https://www.tiktok.com/' });
    await expect(resolveUsername('vm.tiktok.com/x', { fetchImpl: dead })).rejects.toThrow('không dẫn tới');
  });
});
