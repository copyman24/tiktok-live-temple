// Durable per-app storage on bun:sqlite. One database file per app (APP_DATA_DIR/<app>/<name>.db).
// Each write touches one row, so a room with thousands of lifetime viewers does not rewrite a big
// JSON file every few seconds. WAL mode keeps reads fast while the live loop writes.
//
//   const store = openStore(path.join(dataDir, 'classroom.db'));
//   const life = store.collection('life');      life.set('lan', { points: 3 }); life.get('lan');
//   const settings = store.doc('settings', {});  settings.update((s) => ({ ...s, channelName: 'Lớp 1A' }));
//   store.transaction(() => { ...many writes... });
import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openStore(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file, { create: true, strict: true });
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  db.exec('CREATE TABLE IF NOT EXISTS kv (ns TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (ns, key)) WITHOUT ROWID');
  const q = {
    get: db.query('SELECT value FROM kv WHERE ns = $ns AND key = $key'),
    set: db.query('INSERT INTO kv (ns, key, value) VALUES ($ns, $key, $value) ON CONFLICT (ns, key) DO UPDATE SET value = excluded.value'),
    del: db.query('DELETE FROM kv WHERE ns = $ns AND key = $key'),
    all: db.query('SELECT key, value FROM kv WHERE ns = $ns'),
    prefix: db.query("SELECT key, value FROM kv WHERE ns = $ns AND key >= $lo AND key < $hi ORDER BY key"),
    count: db.query('SELECT COUNT(*) AS n FROM kv WHERE ns = $ns'),
    clear: db.query('DELETE FROM kv WHERE ns = $ns')
  };
  const parse = (row) => (row ? JSON.parse(row.value) : undefined);

  /**
   * @param {string} ns
   * @returns {{
   *   get(key: string): any, has(key: string): boolean, set<V>(key: string, value: V): V,
   *   update<V>(key: string, fn: (value: V) => V, fallback: V): V, delete(key: string): void,
   *   entries(): [string, any][], withPrefix(prefix: string): [string, any][], size(): number, clear(): void
   * }}
   */
  function collection(ns) {
    const name = `c:${ns}`;
    return {
      get: (key) => parse(q.get.get({ ns: name, key: String(key) })),
      has: (key) => q.get.get({ ns: name, key: String(key) }) != null,
      set(key, value) { q.set.run({ ns: name, key: String(key), value: JSON.stringify(value) }); return value; },
      update(key, fn, fallback) {
        const next = fn(this.get(key) ?? structuredClone(fallback));
        return this.set(key, next);
      },
      delete: (key) => { q.del.run({ ns: name, key: String(key) }); },
      entries: () => q.all.all({ ns: name }).map((row) => [row.key, JSON.parse(row.value)]),
      /** Rows whose key starts with `prefix`, in key order (e.g. one day's samples keyed "2026-11-06|..."). */
      withPrefix: (prefix) => q.prefix.all({ ns: name, lo: prefix, hi: `${prefix}￿` }).map((row) => [row.key, JSON.parse(row.value)]),
      size: () => q.count.get({ ns: name }).n,
      clear: () => { q.clear.run({ ns: name }); }
    };
  }

  /**
   * @template T
   * @param {string} key
   * @param {T} fallback
   * @returns {{ get(): T, set(value: T): T, update(fn: (value: T) => T): T }}
   */
  function doc(key, fallback) {
    const docs = collection('$docs');
    return {
      get: () => docs.get(key) ?? structuredClone(fallback),
      set: (value) => docs.set(key, value),
      update: (fn) => docs.set(key, fn(docs.get(key) ?? structuredClone(fallback)))
    };
  }

  return {
    collection,
    doc,
    transaction: (fn) => db.transaction(fn)(),
    close: () => db.close(false)
  };
}
