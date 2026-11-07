// Local, offline Vietnamese speech: a resident Python ZeroTTS worker (tts_worker.py, or the
// packaged ZERO_TTS_BIN executable) that loads the model once and answers JSON lines on stdin/stdout.
// Moved here from the prayer app so Studio can run ONE worker for every session (the model is heavy).
//
// Results are WAV files the worker writes to <dataDir>/tts-cache and reports as `/tts-cache/<name>`.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function createZeroTts({ resourceDir, dataDir, bin = null, defaultVoice = 'maichi', timeoutMs = 30_000, log = console } = {}) {
  const cacheDir = path.join(dataDir, 'tts-cache');
  const workerScript = path.join(resourceDir, 'tts_worker.py');
  fs.mkdirSync(cacheDir, { recursive: true });

  const listeners = new Set();
  const pending = new Map();
  const inflight = new Map();
  let proc = null;
  let ready = false;
  let status = 'starting';
  let voice = defaultVoice;
  let voices = [defaultVoice];
  let model = 'zeroweight-ai/ZeroTTS';
  let counter = 0;
  let buffer = '';
  let stopPromise = null;

  const getStatus = () => ({ ready, status, engine: 'ZeroTTS (zeroweight-ai/ZeroTTS)', voice, voices, model });
  const announce = () => { for (const fn of listeners) { try { fn(getStatus()); } catch {} } };

  function resolveCommand() {
    if (bin) return { command: bin, args: [] };
    const venvPy = process.platform === 'win32'
      ? path.join(resourceDir, '.venv', 'Scripts', 'python.exe')
      : path.join(resourceDir, '.venv', 'bin', 'python');
    if (fs.existsSync(venvPy)) return { command: venvPy, args: [workerScript] };
    return { command: process.platform === 'win32' ? 'python' : 'python3', args: [workerScript] };
  }

  function failAll(error) {
    for (const [, item] of pending) {
      clearTimeout(item.timer);
      item.resolve({ ok: false, error });
    }
    pending.clear();
  }

  function handleLine(line) {
    let msg;
    try { msg = JSON.parse(line); } catch { log.log('[ZeroTTS stdout]', line); return; }
    if (msg.type === 'status') {
      status = msg.status;
      model = msg.model || model;
      announce();
    } else if (msg.type === 'ready') {
      ready = true;
      status = 'ready';
      voice = msg.voice || defaultVoice;
      voices = msg.voices || [voice];
      model = msg.model || model;
      log.log(`[ZeroTTS] Sẵn sàng sau ${msg.loadSec}s! Giọng: ${voice} (${voices.join(', ')})`);
      announce();
    } else if (msg.type === 'result' && msg.id != null) {
      const entry = pending.get(msg.id);
      if (entry) {
        clearTimeout(entry.timer);
        pending.delete(msg.id);
        entry.resolve(msg);
      }
    } else if (msg.type === 'error') {
      log.error?.('[ZeroTTS Error]', msg.error);
      status = 'error';
      announce();
    }
  }

  function start() {
    const worker = resolveCommand();
    log.log(`[ZeroTTS] Khởi chạy worker với ${worker.command} (Giọng mặc định: ${defaultVoice})...`);
    status = 'loading';
    const child = spawn(worker.command, worker.args, {
      cwd: resourceDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, APP_DATA_DIR: dataDir, HF_HOME: process.env.HF_HOME || path.join(dataDir, 'models') }
    });
    proc = child;
    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) if (line.trim()) handleLine(line.trim());
    });
    child.stderr.on('data', (chunk) => {
      const msg = chunk.toString('utf8').trim();
      if (msg) log.log(`[ZeroTTS stderr] ${msg}`);
    });
    child.on('error', (err) => {
      log.error?.('[ZeroTTS] Worker failed to start:', err.message);
      ready = false;
      status = 'error';
      if (proc === child) proc = null;
      failAll('ZeroTTS worker failed to start');
      announce();
    });
    child.on('exit', (code) => {
      log.warn(`[ZeroTTS] Worker thoát với mã ${code}`);
      ready = false;
      status = 'stopped';
      if (proc === child) proc = null;
      failAll('ZeroTTS worker exited');
      announce();
    });
  }

  /** Synthesize `text`; resolves { ok, url, file, cached } or { ok: false, error }. Never rejects. */
  function synthesize(text, voiceOverride) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return Promise.resolve({ ok: false, error: 'Empty text' });
    const v = String(voiceOverride || voice || defaultVoice).toLowerCase();
    const key = `${v}::${cleanText}`;
    if (inflight.has(key)) return inflight.get(key);
    const promise = new Promise((resolve) => {
      if (!proc || !ready) return resolve({ ok: false, error: `ZeroTTS đang ở trạng thái: ${status}` });
      const id = ++counter;
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ ok: false, error: 'ZeroTTS synthesis timeout' });
      }, timeoutMs);
      pending.set(id, { resolve, timer });
      proc.stdin.write(`${JSON.stringify({ id, text: cleanText, voice: v })}\n`);
    }).then((result) => (result?.ok && result.url ? { ...result, file: path.join(cacheDir, path.basename(result.url)) } : result))
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  function stop() {
    if (stopPromise) return stopPromise;
    const child = proc;
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      proc = null;
      return Promise.resolve();
    }
    ready = false;
    status = 'stopping';
    stopPromise = new Promise((resolve) => {
      const timer = setTimeout(() => { if (proc === child) child.kill(); }, 5000);
      timer.unref?.();
      const finish = () => {
        clearTimeout(timer);
        if (proc === child) proc = null;
        resolve();
      };
      child.once('exit', finish);
      child.once('error', finish);
      child.stdin.end();
    });
    return stopPromise;
  }

  start();
  return {
    synthesize,
    stop,
    getStatus,
    cacheDir,
    /** Status changes (loading → ready, errors). Returns an unsubscribe function. */
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
