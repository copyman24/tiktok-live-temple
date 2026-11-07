import { describe, expect, test } from 'bun:test';
import { createServer } from 'node:http';
import { openStore } from '../src/store.js';
import { cleanComment, cleanName, cleanSpeech, containsBanned, maskBanned } from '../src/text.js';
import { createVoiceService, splitText } from '../src/voice.js';
import { createRpcHub, RpcError } from '../src/rpc.js';
import { createSpeakerElection } from '../src/speaker.js';
import { viewStats } from '../src/analytics.js';
import { dayKey, weekKey } from '../src/time.js';
import { parts } from '../browser/voice.js';

describe('store', () => {
  test('collections and docs survive reopen', () => {
    const file = `${process.env.TEMP || '/tmp'}/live-core-test-${Date.now()}.db`;
    let store = openStore(file);
    const life = store.collection('life');
    life.set('lan', { points: 3 });
    life.update('lan', (v) => ({ points: v.points + 2 }), { points: 0 });
    life.update('minh', (v) => ({ points: v.points + 1 }), { points: 0 });
    store.doc('settings', { name: '' }).update((s) => ({ ...s, name: 'Lớp 1A' }));
    store.close();

    store = openStore(file);
    expect(store.collection('life').get('lan')).toEqual({ points: 5 });
    expect(store.collection('life').size()).toBe(2);
    expect(store.doc('settings', {}).get()).toEqual({ name: 'Lớp 1A' });
    expect(store.collection('other').get('lan')).toBeUndefined();
    store.close();
  });

  test('prefix queries, transactions, and prototype-looking keys', () => {
    const store = openStore(':memory:');
    const c = store.collection('views');
    store.transaction(() => {
      c.set('2026-11-05|1', { v: 1 });
      c.set('2026-11-06|2', { v: 2 });
      c.set('2026-11-06|3', { v: 3 });
    });
    expect(c.withPrefix('2026-11-06|').map(([, v]) => v.v)).toEqual([2, 3]);
    c.set('__proto__', { safe: true });
    expect(c.get('__proto__')).toEqual({ safe: true });
    expect(store.doc('missing', { a: 1 }).get()).toEqual({ a: 1 });
    store.close();
  });
});

describe('text', () => {
  test('banned words match whole tokens only', () => {
    expect(containsBanned('đm thằng này')).toBe(true);
    expect(containsBanned('Địt mẹ')).toBe(true);
    expect(containsBanned('lớn lên đi buổi sáng')).toBe(false);
    expect(containsBanned('xem vlog nè')).toBe(false);
    expect(maskBanned('ê đm mày')).toBe('ê *** mày');
  });

  test('names: fancy unicode folds, junk falls back', () => {
    expect(cleanName('𝓛𝓪𝓷 𝓐𝓷𝓱')).toBe('Lan Anh');
    expect(cleanName('🔥🔥', { fallback: 'Thí Chủ' })).toBe('Thí Chủ');
    expect(cleanName('đm', { fallback: 'Bạn' })).toBe('Bạn');
    expect(cleanName('Ngọccccccc')).toBe('Ngọcc');
  });

  test('comments keep content but flag unsafe ones; spam is dropped', () => {
    expect(cleanComment('  PHỞ  ')).toEqual({ text: 'PHỞ', safe: true });
    expect(cleanComment('đm khó quá')).toEqual({ text: 'đm khó quá', safe: false });
    expect(cleanComment('𒐫𒐫𒐫').text).toBe('');
    expect(cleanSpeech('Cầu bình an!!!! [smile]')).toBe('Cầu bình an');
  });
});

describe('voice service', () => {
  const engine = (name, impl, extra = {}) => ({ name, synth: impl, ...extra });

  test('caches the primary engine and falls back without caching', async () => {
    let edgeCalls = 0;
    let edgeUp = false;
    const voice = createVoiceService({
      log: { warn() {} },
      engines: [
        engine('edge', async () => { edgeCalls++; if (!edgeUp) throw new Error('429'); return { audio: Buffer.from('E'), contentType: 'audio/mpeg' }; }),
        engine('google', async () => ({ audio: Buffer.from('G'), contentType: 'audio/mpeg' }))
      ]
    });
    expect((await voice.synthesize({ text: 'xin chào' })).engine).toBe('google');
    edgeUp = true;
    expect((await voice.synthesize({ text: 'xin chào' })).engine).toBe('edge'); // fallback was not cached
    expect((await voice.synthesize({ text: 'xin chào' })).cached).toBe(true);
    expect(edgeCalls).toBe(2);
  });

  test('engines can refuse a language', async () => {
    const voice = createVoiceService({
      log: { warn() {} },
      engines: [engine('zerotts', async () => ({ audio: Buffer.from('Z'), contentType: 'audio/wav' }), { supports: (r) => r.lang === 'vi' })]
    });
    await expect(voice.synthesize({ text: 'cat', lang: 'en' })).rejects.toThrow('không có engine');
  });

  test('splitText cuts long text at sentence boundaries', () => {
    const chunks = splitText(`${'a'.repeat(150)}. ${'b'.repeat(150)}`);
    expect(chunks).toEqual([`${'a'.repeat(150)}.`, 'b'.repeat(150)]);
  });

  test('browser parts parser', () => {
    expect(parts('F: Đáp án là | E: cat | ^Giỏi quá!')).toEqual([
      { who: 'F', hype: false, text: 'Đáp án là' },
      { who: 'E', hype: false, text: 'cat' },
      { who: 'E', hype: true, text: 'Giỏi quá!' }
    ]);
  });
});

describe('rpc hub + speaker election', () => {
  test('dispatches requests, reports errors, elects the newest stage', async () => {
    const election = createSpeakerElection({ broadcast: (m, p) => hub.notify(m, p) });
    const hub = createRpcHub({
      log: { warn() {} },
      dispatch: (method, params) => {
        if (method === 'add') return params.a + params.b;
        throw new RpcError(-32601, `Unknown method: ${method}`);
      },
      onConnect: (client) => { if (client.query.get('role') === 'stage') election.join(client.id, client.send); },
      onDisconnect: (client) => election.leave(client.id)
    });
    const server = createServer();
    hub.attach(server);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const url = `ws://127.0.0.1:${server.address().port}/ws`;

    const open = (suffix = '') => new Promise((resolve) => {
      const ws = new WebSocket(url + suffix);
      const inbox = [];
      ws.onmessage = (e) => inbox.push(JSON.parse(e.data));
      ws.onopen = () => resolve({ ws, inbox });
    });
    const wait = () => new Promise((r) => setTimeout(r, 60));

    const a = await open('?role=stage');
    const b = await open('?role=stage');
    a.ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'add', params: { a: 2, b: 3 } }));
    a.ws.send(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'nope' }));
    a.ws.send('not json');
    await wait();
    expect(a.inbox.find((m) => m.id === 1).result).toBe(5);
    expect(a.inbox.find((m) => m.id === 2).error.code).toBe(-32601);
    expect(a.inbox.some((m) => m.error?.code === -32700)).toBe(true);

    const idOf = (box) => box.find((m) => m.method === 'stage.hello').params.clientId;
    const lastSpeaker = (box) => box.filter((m) => m.method === 'stage.speaker').at(-1).params;
    expect(lastSpeaker(a.inbox)).toEqual({ speakerId: idOf(b.inbox), stages: 2 });
    b.ws.close();
    await wait();
    expect(lastSpeaker(a.inbox)).toEqual({ speakerId: idOf(a.inbox), stages: 1 });

    a.ws.close();
    server.close();
  });
});

describe('analytics + time', () => {
  test('viewStats: per-phase change per minute, worst first, session breaks not counted', () => {
    const rows = [
      { at: 0, session: 'classroom', phase: 'question', viewers: 100 },
      { at: 15_000, session: 'classroom', phase: 'question', viewers: 110 },
      { at: 30_000, session: 'classroom', phase: 'recess', viewers: 110 },
      { at: 45_000, session: 'classroom', phase: 'recess', viewers: 80 },
      { at: 60_000, session: 'prayer', phase: 'idle', viewers: 20 }
    ];
    const stats = viewStats(rows);
    // recess: 110 → 80 in 15 s (the step into the prayer session is not counted)
    expect(stats[0]).toMatchObject({ phase: 'recess', perMin: -120 });
    // question: +10 then +0 (the interval that ends in the next phase belongs to the earlier one)
    expect(stats.find((s) => s.phase === 'question').perMin).toBe(20);
  });

  test('day and week keys use Vietnam time', () => {
    const lateUtc = new Date(Date.UTC(2026, 10, 5, 18, 30)); // 01:30 on Nov 6 in Vietnam
    expect(dayKey(lateUtc)).toBe('2026-11-06');
    expect(weekKey(lateUtc)).toBe('2026-W45');
  });
});
