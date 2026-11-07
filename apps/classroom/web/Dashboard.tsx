import { useEffect, useState, type ReactNode } from 'react';
import type { LiveStatus } from './useClassroom';
import { emitTest, sendControl } from './page';
import { rpc } from './rpc';

const FAKE_NAMES = ['Lan Anh', 'Minh Tuấn', 'Bé Na 🌸', 'Hoàng Long', 'Thu Trang', 'Quốc Bảo', 'duyanh99', '𝑵𝒈𝒐̣𝒄 𝑨𝒏𝒉'];
const pick = () => {
  const nickname = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
  return { nickname, username: nickname.normalize('NFKD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'khach' };
};

/**
 * Trang điều khiển (http://localhost:3006). Im lặng, không phát tiếng.
 * - Kết nối phòng live
 * - Gõ câu cho giọng đọc trên stage
 * - Nút giả lập sự kiện để test khi chưa live
 * `preview`: bản xem trước của stage (im lặng)
 */
export function Dashboard({
  status,
  channelName,
  preview,
  extra,
}: {
  status: LiveStatus | null;
  channelName: string;
  preview: ReactNode;
  extra?: ReactNode;
}) {
  const [user, setUser] = useState(() => localStorageGet('tiktokUser'));
  const [nameText, setNameText] = useState('');
  const [msg, setMsg] = useState('');
  const [speakText, setSpeakText] = useState('');
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    setMsg('');
    localStorageSet('tiktokUser', user);
    try {
      await rpc('live.connect', { username: user });
      setMsg('Đã kết nối');
    } catch (e) {
      setMsg(`${e instanceof Error ? e.message : String(e)}. Máy chủ sẽ tự thử lại.`);
    }
    setBusy(false);
  };

  const disconnect = () => {
    setMsg('');
    void rpc('live.disconnect').catch(() => {});
  };

  const speak = async () => {
    const r = await sendControl('speak', speakText);
    setMsg(!r.success ? (r.error ?? 'Chưa gửi được') : (r.pages ?? 0) > 1 ? `Đã gửi (đang mở ${r.pages} trang stage, trang mở sau cùng đọc)` : 'Đã gửi');
    setSpeakText('');
  };

  const saveName = async () => {
    const r = await sendControl('setName', nameText);
    setMsg(r.success ? `Đã lưu tên lớp: ${nameText.trim()}` : (r.error ?? 'Chưa lưu được'));
    if (r.success) setNameText('');
  };

  return (
    // Gọn trong 1 màn hình: cột trái là nút (tự cuộn nếu thiếu chỗ), cột phải là bản xem trước cao bằng màn hình
    <div className="h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_left,#26215a_0%,#0b0f24_55%)] p-3 text-sm text-slate-100">
      <div className="mx-auto flex h-full max-w-[1500px] gap-4">
        <div className="min-w-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <header className="flex items-center justify-between px-1 pt-1">
            <div>
              <div className="bg-gradient-to-r from-white via-amber-200 to-pink-300 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">{channelName || 'Lớp Học Chữ'}</div>
              <div className="text-xs text-indigo-200/70">Trang điều khiển · không phát tiếng</div>
            </div>
            <LivePill status={status} />
          </header>
          <Card title="Kết nối TikTok LIVE" dot="#f472b6">
            <div className="flex gap-2">
              <input
                className={INPUT + ' min-w-0 flex-1'}
                placeholder="username TikTok (không cần @)"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && user.trim() && connect()}
              />
              <Btn onClick={connect} disabled={busy || !user.trim()}>
                {busy ? 'Đang nối...' : 'Kết nối'}
              </Btn>
              <Btn onClick={disconnect} tone="ghost">
                Ngắt
              </Btn>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 text-xs">
              {status?.state === 'live' ? (
                <span className="text-emerald-400">
                  ● Đang live @{status.username} · {status.viewerCount} người xem · {status.totalLikes} tim
                </span>
              ) : status?.state === 'connecting' ? (
                <span className="text-amber-400">● Đang kết nối...</span>
              ) : status?.state === 'reconnecting' ? (
                <span className="text-amber-400">
                  ● Chờ kết nối lại @{status.username}
                  {status.retryInMs ? ` (thử lại sau ${Math.round(status.retryInMs / 1000)} giây)` : ''}
                </span>
              ) : (
                <span className="text-slate-400">● Chưa kết nối</span>
              )}
              <span className="text-slate-400">
                LIVE Studio: <b className="select-all font-mono text-indigo-200">http://lvh.me:{window.location.port || 80}/?view=stage</b> · 1080×1920
              </span>
            </div>
            {(msg || status?.error) && <div className="mt-1 text-xs text-amber-300">{msg || status?.error}</div>}
          </Card>

          <Card title="Giọng đọc trên stage" dot="#38bdf8">
            <div className="flex gap-2">
              <input
                className={INPUT + ' min-w-0 flex-1'}
                placeholder="Gõ câu muốn MC đọc ngay..."
                value={speakText}
                onChange={(e) => setSpeakText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && speakText.trim() && speak()}
              />
              <Btn onClick={speak} disabled={!speakText.trim()}>
                Đọc ngay
              </Btn>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <RateSlider />
              <span className="ml-2 text-slate-400">Tên lớp</span>
              <input
                className={INPUT + ' w-32 !py-1'}
                placeholder={channelName}
                maxLength={40}
                value={nameText}
                onChange={(e) => setNameText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && nameText.trim() && saveName()}
              />
              <Btn tone="ghost" onClick={saveName} disabled={!nameText.trim()}>
                Lưu
              </Btn>
              <span className="flex-1" />
              <Btn tone="danger" onClick={() => confirmReset()}>
                Reset game
              </Btn>
            </div>
          </Card>

          {extra}

          <details className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
            <summary className="cursor-pointer font-semibold text-indigo-100">Giả lập chung (người vào, follow, combo quà...)</summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Btn tone="ghost" onClick={() => emitTest('member', pick())}>
                👋 Người vào
              </Btn>
              <Btn tone="ghost" onClick={() => emitTest('chat', { ...pick(), comment: 'Live hay quá' })}>
                💬 Comment
              </Btn>
              <Btn tone="ghost" onClick={() => emitTest('chat', { ...pick(), comment: 'mong mai thi được điểm cao' })}>
                🙏 Cầu chúc
              </Btn>
              <Btn tone="ghost" onClick={() => comboSameUser()}>
                🔁 1 người tặng 3 lần liền
              </Btn>
              <Btn tone="ghost" onClick={() => emitTest('follow', pick())}>
                ➕ Follow
              </Btn>
            </div>
            <p className="mt-2 text-xs text-slate-500">Sự kiện giả đi tới mọi trang đang mở, kể cả stage trong LIVE Studio.</p>
          </details>
        </div>

        <div className="flex flex-none flex-col items-center">
          <div className="mb-1 text-xs text-indigo-200/70">Xem trước (im lặng)</div>
          <div className="overflow-hidden rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] ring-1 ring-white/15">{preview}</div>
        </div>
      </div>
    </div>
  );
}

// Cùng 1 người tặng 3 lần cách nhau 1 giây: chỉ được cảm ơn 1 lần
function comboSameUser() {
  const who = pick();
  for (let i = 0; i < 3; i++) {
    setTimeout(() => emitTest('gift', { ...who, giftName: 'Hoa hồng', giftId: 5655, diamondCount: 1, repeatCount: 1 }), i * 1000);
  }
}

function confirmReset() {
  // không dùng window.confirm để tránh hộp thoại chặn
  void sendControl('reset');
}

const INPUT = 'rounded-lg bg-white/[0.06] px-3 py-1.5 ring-1 ring-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400';

function Card({ title, dot = '#a78bfa', children }: { title: string; dot?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/[0.04] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)] ring-1 ring-white/10 backdrop-blur">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-indigo-100">
        <span className="h-2 w-2 rounded-full" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function LivePill({ status }: { status: LiveStatus | null }) {
  const live = status?.state === 'live';
  const waiting = status?.state === 'connecting' || status?.state === 'reconnecting';
  return (
    <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ring-1 ${live ? 'bg-rose-500/15 text-rose-200 ring-rose-400/40' : waiting ? 'bg-amber-500/10 text-amber-200 ring-amber-400/30' : 'bg-white/5 text-slate-400 ring-white/10'}`}>
      <span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-rose-500' : waiting ? 'bg-amber-400' : 'bg-slate-500'}`} />
      {live ? `LIVE · ${status!.viewerCount} xem` : waiting ? 'Đang kết nối' : 'Chưa live'}
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  tone = 'primary',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'ghost' | 'danger';
}) {
  const cls = {
    primary: 'bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)] hover:brightness-110',
    ghost: 'bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/[0.12]',
    danger: 'bg-rose-600/80 ring-1 ring-rose-400/40 hover:bg-rose-500',
  }[tone];
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}

function localStorageGet(k: string) {
  try {
    return localStorage.getItem(k) || '';
  } catch {
    return '';
  }
}
function localStorageSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    // bỏ qua
  }
}

// Tốc độ giọng cô: lưu trên máy chủ, có tác dụng ngay trên trang stage
function RateSlider() {
  const [rate, setRate] = useState(1.0);
  useEffect(() => {
    rpc<{ rate: number }>('classroom.state').then((s) => setRate(s.rate || 1)).catch(() => {});
  }, []);
  const change = (r: number) => {
    setRate(r);
    void sendControl('setRate', String(r));
  };
  return (
    <label className="flex items-center gap-1.5 text-slate-400">
      Tốc độ giọng
      <input type="range" min={0.8} max={1.5} step={0.05} value={rate} onChange={(e) => change(Number(e.target.value))} className="w-28 accent-indigo-400" />
      <b className="w-10 text-slate-200">{rate.toFixed(2)}×</b>
    </label>
  );
}
