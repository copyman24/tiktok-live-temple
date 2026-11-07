import { useState } from 'react';
import { emitTest, sendControl } from './page';
import type { StageView } from './useClassroom';
import { GAME } from '../src/game/config';

// Nút riêng của Lớp Học Chữ ở trang điều khiển: điều khiển ván + giả lập phòng đông để thử bot
const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi'];
const TEN = ['Lan Anh', 'Minh Tuấn', 'Thu Trang', 'Quốc Bảo', 'Ngọc Hân', 'Gia Huy', 'Khánh Linh', 'Hải Yến', 'Đức Anh', 'Bảo Ngọc', 'Thanh Hà', 'Văn Toàn'];
const CHAT = ['khó quá cô ơi', 'chữ gì vậy trời', 'hay quá', 'vào lớp', 'cô xinh quá', 'ủa là gì', '???', 'hihi'];
const fake = (i: number) => ({ username: `hs${i}`, nickname: `${HO[i % HO.length]} ${TEN[i % TEN.length]}`, avatar: '' });
const shuffleWord = (w: string) => [...w].sort(() => Math.random() - 0.5).join('');

export function GameControls({ view, stageCount = 0 }: { view: StageView | null; stageCount?: number }) {
  const [sent, setSent] = useState(0);
  const [running, setRunning] = useState(false);
  const [bdName, setBdName] = useState('');

  /** Giả lập n người xem cùng bình luận trong 20 giây: 15% đúng, 20% đoán sai, còn lại nói chuyện */
  const flood = async (n: number) => {
    if (!view?.answer || running) return;
    setRunning(true);
    setSent(0);
    const answer = view.answer.toLowerCase();
    const start = Date.now();
    let done = 0;
    await Promise.all(
      Array.from({ length: n }, (_, i) => {
        const r = Math.random();
        const comment = r < 0.15 ? answer : r < 0.35 ? shuffleWord(answer) : CHAT[i % CHAT.length];
        const delay = Math.random() * 20_000;
        return new Promise<void>((ok) =>
          setTimeout(async () => {
            // TikTok gắn giờ lúc gửi; tới tay bot có thể trễ tới 1,5 giây và lệch thứ tự
            await emitTest('chat', { ...fake(i), comment, createTime: start + delay - Math.random() * 1500 }).catch(() => {});
            setSent(++done);
            ok();
          }, delay),
        );
      }),
    );
    setRunning(false);
  };

  return (
    <div className="space-y-3">
      {stageCount > 1 && <div className="rounded-xl bg-amber-500/15 p-2.5 text-amber-100 ring-1 ring-amber-400/40">Đang mở {stageCount} trang stage. Chỉ trang mở sau cùng phát tiếng; đóng bớt cho nhẹ máy.</div>}
      {stageCount === 0 && <div className="rounded-xl bg-white/[0.04] p-2.5 text-amber-300 ring-1 ring-amber-400/30">Chưa mở trang stage nào: lớp vẫn chạy nhưng không ai nghe giọng cô.</div>}
      {view && (
        <div className="rounded-2xl bg-white/[0.04] p-3 text-sm leading-6 ring-1 ring-white/10">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-500/20 px-2.5 text-xs font-bold text-indigo-100 ring-1 ring-indigo-400/40">Ván {view.round}</span>
            <span className="rounded-full bg-white/[0.06] px-2.5 text-xs font-bold ring-1 ring-white/10">Câu {view.qNo}/{view.total}</span>
            <span className="rounded-full bg-white/[0.06] px-2.5 text-xs font-bold text-slate-300 ring-1 ring-white/10">{view.phase}</span>
          </div>
          <div>
            Đáp án (chỉ mình thấy): <b className="rounded bg-amber-400/15 px-1.5 text-amber-200">{view.answer || '—'}</b>
          </div>
          <div>
            Bot nhận câu này: <b>{view.stats.received}</b> comment · {view.stats.attempts} lượt trả lời · {view.correctCount} đúng
          </div>
          <div>
            Đang chơi: <b>{view.players}</b> bạn
            {view.players < GAME.smallRoomPlayers && <span className="text-amber-300"> · phòng vắng: có người đúng là {GAME.smallRoomEndAfterSec} giây sau chốt câu</span>}
          </div>
          {view.topic && <div>Chủ đề cả lớp chọn: {view.topic}</div>}
          {sent > 0 && <div>Giả lập đã gửi: {sent}</div>}
        </div>
      )}
      {/* Chủ kênh dùng trong lúc live */}
      <Group title="Trong lúc live" dot="#f472b6">
        <Btn onClick={() => sendControl('custom', 'skip')} tone="primary">⏭ Qua phần tiếp</Btn>
        <Btn onClick={() => sendControl('custom', 'newRound')}>🔄 Ván mới</Btn>
        <Btn onClick={() => sendControl('custom', 'goodbye')}>👋 Chào tạm biệt (xuống live)</Btn>
        <Btn
          tone="danger"
          onClick={() => confirm(`Bỏ câu "${view?.answer}"? Câu này sẽ không bao giờ được hỏi lại.`) && sendControl('custom', 'ban')}
          disabled={!view?.answer || !!view.math || !['question', 'bonus', 'reveal'].includes(view.phase)}
        >
          🚫 Bỏ câu này
        </Btn>
        <a href="/bao-cao" target="_blank" className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-400/40 hover:bg-emerald-500/25">
          📊 Báo cáo hôm nay
        </a>
        <div className="flex w-full gap-2 pt-1">
          <input
            value={bdName}
            onChange={(e) => setBdName(e.target.value)}
            placeholder="Tên bạn sinh nhật"
            className="w-48 rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white ring-1 ring-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <Btn
            onClick={() => {
              if (bdName.trim()) sendControl('custom', `birthday:${bdName.trim()}`);
              setBdName('');
            }}
          >
            🎂 Chúc sinh nhật
          </Btn>
        </div>
      </Group>
      <Group title="Ra chơi" dot="#34d399">
        <Btn onClick={() => sendControl('custom', 'recess:rps')}>✊ Oẳn tù tì</Btn>
        <Btn onClick={() => sendControl('custom', 'recess:callup')}>📢 Kiểm tra miệng</Btn>
        <Btn onClick={() => sendControl('custom', 'recess:pick')}>⚖️ Chọn phe</Btn>
        <Btn onClick={() => sendControl('custom', 'recess:roll')}>🙋 Điểm danh</Btn>
        <Btn onClick={() => sendControl('custom', 'recess:heart')}>❤️ Thả tim</Btn>
      </Group>
      <Group title="Game lớn" dot="#fbbf24">
        <Btn onClick={() => sendControl('custom', 'show:everest')}>🏔️ Đường lên đỉnh Everest</Btn>
        <Btn onClick={() => sendControl('custom', 'show:chuong')}>🔔 Rung Chuông Đồng</Btn>
      </Group>
      <Group title="Thử trước khi live" dot="#38bdf8">
        <Btn onClick={() => emitTest('chat', { ...fake(Math.floor(Math.random() * 50)), comment: view?.answer.toLowerCase() ?? '' })}>✅ 1 bạn trả lời đúng</Btn>
        <Btn onClick={() => emitTest('chat', { ...fake(Math.floor(Math.random() * 50)), comment: 'vào lớp' })}>🙋 1 bạn vào lớp</Btn>
        <Btn onClick={() => emitTest('gift', { ...fake(3), giftName: 'Hoa hồng', giftId: 1, diamondCount: 1, repeatCount: 1 })}>🌹 Tặng hoa</Btn>
        <Btn onClick={() => emitTest('gift', { ...fake(4), giftName: 'Mũ', giftId: 2, diamondCount: 99, repeatCount: 1 })}>🎁 Quà to</Btn>
        <Btn onClick={() => emitTest('like', { ...fake(5), likeCount: 300 })}>❤️ 300 tim</Btn>
        <Btn onClick={() => emitTest('chat', { ...fake(Math.floor(Math.random() * 50)), comment: 'hôm nay sinh nhật con cô ơi' })}>🎂 1 bạn báo sinh nhật</Btn>
        <Btn onClick={() => Array.from({ length: 10 }, (_, i) => emitTest('chat', { ...fake(i), comment: view?.show?.step === 'stake' ? ['10', '20'][i % 2] : 'ABCD'[Math.floor(Math.random() * 4)] }))}>
          🎲 Game: 10 bạn gõ A/B/C/D
        </Btn>
        <Btn onClick={() => flood(100)} disabled={running}>👥 100 người cùng đoán</Btn>
        <Btn onClick={() => flood(1000)} disabled={running}>👥 1000 người cùng đoán</Btn>
      </Group>
    </div>
  );
}

function Group({ title, dot, children }: { title: string; dot: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-indigo-100">
        <span className="h-2 w-2 rounded-full" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />
        {title}
      </h3>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </section>
  );
}

function Btn({ children, onClick, disabled, tone = 'ghost' }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: 'ghost' | 'primary' | 'danger' }) {
  const cls = {
    ghost: 'bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/[0.12]',
    primary: 'bg-gradient-to-r from-indigo-500 to-pink-500 shadow-[0_4px_14px_rgba(99,102,241,0.35)] hover:brightness-110',
    danger: 'bg-rose-600/80 ring-1 ring-rose-400/40 hover:bg-rose-500',
  }[tone];
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}
