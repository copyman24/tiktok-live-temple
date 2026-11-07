import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { GameState, StageView } from './useClassroom';
import { GAME } from '../src/game/config';
import { Hair } from './Hair';
import { giftOf } from '../src/game/quiz';
import { Classroom } from './art/Classroom';
import { Teacher as TeacherArt } from './art/Teacher';
import { KidBack, KidFront, type KidPose } from './art/Kid';
import './stage.css';

/**
 * Màn hình lớp học 1080x1920. Nền và nhân vật vẽ bằng SVG (web/art). Bố cục giữ theo ảnh nền cũ (941x1672 phóng lên
 * 1080 ngang), nên mọi toạ độ dưới đây = toạ độ trên ảnh gốc x K.
 */
const K = 1080 / 941;

// Bàn dài + ghế băng vẽ đè lên dãy bàn lẻ trong ảnh nền (đo trên ảnh gốc): mép trên mặt bàn y, mép dưới b, 2 đầu bàn x1..x2.
// n = số bạn ngồi mỗi dãy (chủ kênh chốt 2026-11-04: 7–8 bạn một dãy, các bạn nhỏ lại một chút). Dãy cuối nằm dưới giao diện TikTok nên để trống.
const ROWS = [
  { y: 812, b: 922, x1: 100, x2: 838, n: GAME.rowSeats[0], s: 0.92 },
  { y: 942, b: 1069, x1: 72, x2: 870, n: GAME.rowSeats[1], s: 0.98 },
  { y: 1093, b: 1232, x1: 45, x2: 902, n: GAME.rowSeats[2], s: 1.04 },
  { y: 1253, b: 1414, x1: 28, x2: 922, n: GAME.rowSeats[3], s: 1.1 },
  { y: 1458, b: 1646, x1: 5, x2: 938, n: 0, s: 1.16 },
];
const KID = 0.82; // các bạn nhỏ hơn bản ghế lẻ để ngồi vừa bàn dài
const SEAT_ROW: number[] = ROWS.flatMap((r, ri) => Array.from({ length: r.n }, () => ri));
const SPRITE_H = 250; // chiều cao cả người
const SHOW = 0.5; // ngồi ghế: chỉ hiện phần trên (đầu tới hông)
// khung đầu đã xoá khỏi ảnh thân sau lưng, tính theo tỉ lệ ảnh (tools/tach-nen.py ghi ra public/assets/nv/*/head.json)
const HEAD = { nam: { x: 0.136, y: 0, w: 0.682, h: 0.284 }, nu: { x: 0.174, y: 0, w: 0.668, h: 0.248 } };
// màu 4 tổ (bản riêng cô Ngân): tổ 1 đỏ, tổ 2 xanh dương, tổ 3 xanh lá, tổ 4 vàng
const TEAM_COLOR = ['#ef4444', '#3b82f6', '#16a34a', '#f59e0b'];
const TEAM_ICON = ['🔴', '🔵', '🟢', '🟡'];

/** Huy chương 1-2-3 (vàng, bạc, đồng), từ hạng 4 là số thường */
function Rank({ i, size = 30 }: { i: number; size?: number }) {
  return (
    <span className={`rank-chip ${i < 3 ? `r${i + 1}` : 'rn'}`} style={{ width: size, height: size, fontSize: size * 0.52 }}>
      {i + 1}
    </span>
  );
}

function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function GameStage({ game }: { game: GameState }) {
  const now = useNow();
  const v = game.view;
  if (!v) {
    return (
      <div className="flex h-full items-center justify-center bg-black/60 p-20 text-center text-[48px] text-white">
        Chưa mở trang stage (lvh.me:3000/?view=stage) nên chưa có gì để xem trước
      </div>
    );
  }
  return (
    <div className={`relative h-full w-full overflow-hidden ${v.clapping ? 'class-clap' : ''}`}>
      {/* tặng hoa: chỉ có bạn nhỏ đi lên bục đưa cô (FlowerWalk), không zoom, không khung cận cảnh (chủ kênh bỏ 2026-11-04).
          Giữ motion.div như cũ (scale luôn 1): đổi sang div thường thì hình trên live khác đi */}
      <motion.div className="absolute inset-0" style={{ transformOrigin: '330px 700px' }} animate={{ scale: 1 }}>
        <Classroom />
        <Header v={v} name={game.channelName} />
        <EventBadge v={v} />
        <Motto />
        <Board v={v} now={now} />
        <DayTop v={v} />
        <TeamBoard v={v} />
        <TalkTop v={v} />
        <GiftPile v={v} />
        <ClassFund v={v} />
        <GiftMenu />
        <Vase v={v} />
        <Teacher v={v} now={now} />
        <Punished v={v} />
        <Podium v={v} />
        {v.phase !== 'show' && <SeatHint now={now} asking={v.phase === 'question' || v.phase === 'bonus'} />}
        <Students v={v} now={now} />
        <FlowerWalk v={v} />
      </motion.div>
      <GiftBanner gift={game.lastGift} now={now} />
      <BirthdayBanner v={v} />
      <GoodbyeBanner v={v} />
      <FundParty v={v} />
      <LoveHearts n={v.loveFans} />
      <PollCard v={v} />
      {(v.clapping || v.fund.party > 0) && <Claps />}
    </div>
  );
}

// Quà cô nhận trong buổi: xếp thẳng ra chỗ cửa lớp bên trái (sau lưng cô), bó càng to icon càng to, chồng dần lên
const PILE_PER_ROW = 5;
function GiftPile({ v }: { v: StageView }) {
  const pile = v.gifts;
  return (
    <div className="pointer-events-none absolute left-[2px] top-[640px] z-[1] h-[230px] w-[150px]">
      {pile.map(({ tier, icon }, i) => {
        const t = GAME.giftTiers[tier];
        const size = 26 * t.size;
        const row = Math.floor(i / PILE_PER_ROW);
        const col = i % PILE_PER_ROW;
        return (
          <motion.div
            key={i}
            initial={i === pile.length - 1 ? { scale: 0, x: 220, y: -40 } : false}
            animate={{ scale: 1, x: 0, y: 0 }}
            transition={{ delay: i === pile.length - 1 ? (GAME.walkMs * 0.65) / 1000 : 0, type: 'spring', stiffness: 140, damping: 14 }}
            className="absolute leading-none drop-shadow-[0_3px_2px_rgba(0,0,0,0.35)]"
            style={{ fontSize: size, left: 6 + col * 26 + (row % 2) * 12 - size / 4, top: 210 - size - row * 24 }}
          >
            {icon}
          </motion.div>
        );
      })}
    </div>
  );
}

// Bảng "Gửi tặng cô Ngân" giữa Quỹ lớp và Top tương tác (chủ kênh 2026-11-05): viết kiểu gửi tặng, không giục,
// không hứa điểm hay lợi thế (TikTok cấm khuyến khích tặng quà). Món và câu mô tả ở GAME.giftMenu
function GiftMenu() {
  return (
    // cột hẹp bên phải bảng đen (như Quỹ lớp), mỗi món 1 dòng: không đè lên câu hỏi
    <div className="glass absolute right-[8px] top-[490px] z-[8] w-[168px] !rounded-[18px] px-2 pb-[6px] pt-[6px]">
      <div className="panel-title justify-center text-[14px]" style={{ ['--dot' as string]: '#f472b6' }}>Gửi tặng cô</div>
      {GAME.giftMenu.map((g) => (
        <div key={g.label} className="flex items-center gap-[2px] whitespace-nowrap text-[15px] font-semibold leading-[24px] text-[#e0e7ff]">
          <span className="w-6 text-center text-[19px]">{g.icon}</span>
          {g.caption}
        </div>
      ))}
    </div>
  );
}

// Quỹ lớp: cột phải, giữa bảng Thi đua tổ và Top tương tác. Mỗi xu quà = 1 bông hoa vào quỹ, có mốc trong ngày
function ClassFund({ v }: { v: StageView }) {
  const f = v.fund;
  return (
    // chỉ ghi "Quỹ lớp" + số bông (chủ kênh bỏ mục tiêu 2026-11-05), nằm trong cột hẹp bên phải bảng đen, không đè câu hỏi
    <div className="glass absolute right-[8px] top-[428px] z-20 flex w-[168px] items-center justify-between !rounded-[18px] px-3 py-[6px]">
      <span className="panel-title text-[15px]" style={{ ['--dot' as string]: '#f472b6' }}>Quỹ lớp</span>
      <span className="text-[28px] font-extrabold leading-tight tabular-nums text-[#f9a8d4]">{f.today}</span>
    </div>
  );
}

// Quỹ hoa đạt mốc: biểu ngữ + pháo hoa (vỗ tay) 8 giây
function FundParty({ v }: { v: StageView }) {
  return (
    <AnimatePresence>
      {v.fund.party > 0 && (
        <motion.div
          key={v.fund.party}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="absolute left-1/2 top-[650px] z-[70] w-[880px] -translate-x-1/2 rounded-[32px] border-2 border-white/70 shadow-[0_20px_60px_rgba(236,72,153,0.45)] bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 px-6 py-4 text-center font-extrabold text-white shadow-2xl"
        >
          <div className="text-[44px] leading-tight">🎆 Quỹ lớp đủ {v.fund.party} bông hoa! 🎆</div>
          <div className="text-[30px]">Cô cảm ơn cả lớp nhiều lắm 💕</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Header({ v, name }: { v: StageView; name: string }) {
  const sub =
    v.phase === 'team'
      ? `Chọn tổ · Tiết ${v.round}`
      : v.phase === 'show' && v.show
      ? v.show.kind === 'everest' ? '🏔️ Đường lên đỉnh Everest' : '🔔 Rung Chuông Đồng'
      : v.phase === 'recess'
      ? 'Giờ ra chơi'
      : v.phase === 'vote'
        ? 'Chọn chủ đề tiết sau'
        : v.qNo > 0 && v.phase !== 'results'
          ? `${v.review ? 'Ôn bài' : `Tiết ${v.round}`} · Câu ${v.qNo}/${v.total}`
          : `Tiết ${v.round}`;
  return (
    <div className="glass absolute left-1/2 top-[14px] z-20 flex w-[470px] -translate-x-1/2 flex-col items-center !rounded-[28px] px-6 pb-3 pt-[10px]">
      <div className="text-grad max-w-full truncate pb-1 font-extrabold leading-none tracking-wide" style={{ fontSize: name.length > 14 ? 34 : 46 }}>
        {name.toUpperCase()}
      </div>
      {/* sĩ số trong lớp / số bạn đang chờ vào (chỗ bảng sĩ số cũ ở cửa trái giờ là bàn quà của cô) */}
      <div className="mt-1 whitespace-nowrap text-[24px] font-semibold text-[#c7d2fe]">
        {sub} · 👥 {v.roster.seated}/{v.roster.seats}
        {v.roster.waiting > 0 && ` · ⏳ chờ ${v.roster.waiting}`}
      </div>
    </div>
  );
}

// ---------- Bảng đen ----------
function Board({ v, now }: { v: StageView; now: number }) {
  const left = Math.max(0, Math.ceil((v.endsAt - now) / 1000));
  return (
    <div className={`chalk absolute left-[350px] top-[262px] h-[348px] w-[555px] text-[#f4f1e6] ${v.golden && v.phase !== 'recess' ? 'golden-board' : ''}`}>
      {v.phase === 'intro' && v.round % 2 === 0 && v.weekTop.length > 0 && <WeekBoard v={v} left={left} />}
      {v.phase === 'intro' && !(v.round % 2 === 0 && v.weekTop.length > 0) && (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="text-[64px] leading-none">Sắp vào học!</div>
          <div className="mt-6 text-[36px] leading-snug">
            Cô xáo chữ, cả lớp đoán từ.
            <br />
            Gõ đáp án vào <b className="text-[#ffe680]">bình luận</b>
            <br />
            Nhanh nhất <b className="text-[#ffe680]">+10 điểm</b>
          </div>
          {v.topic && <div className="mt-3 text-[32px] text-[#ffe680]">🗳️ Cả lớp chọn: {v.topic}</div>}
          {v.review && <div className="mt-3 text-[32px] text-[#ffe680]">📖 Giờ ôn bài · gõ "vào lớp" để học bài mới</div>}
          <div className="mt-4 text-[30px] opacity-80">Bắt đầu sau {left} giây</div>
        </div>
      )}

      {(v.phase === 'question' || v.phase === 'bonus' || v.phase === 'reveal') && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            {v.golden ? (
              <span className="rounded-full bg-gradient-to-r from-[#fde68a] to-[#fbbf24] px-4 py-[2px] text-[26px] font-extrabold text-[#1e1b4b] shadow-[0_0_20px_rgba(253,224,71,0.5)]">⭐ CÂU HỎI VÀNG x2</span>
            ) : !v.slot && !v.boardShown ? (
              // câu chữ thường đang đọc đề: ẩn nhãn chủ đề (cũng là gợi ý), chỉ hiện "Câu N"
              <span />
            ) : (
              <span className={`rounded-full border-2 px-4 py-[2px] text-[24px] font-bold ${v.slot ? 'border-[#fde68a]/80 bg-[#fde68a]/10 text-[#fde68a]' : 'border-white/40 bg-white/[0.06]'}`}>
                {v.slot === 'meo'
                  ? `🤪 Đố mẹo ${v.riddleNo}/2`
                  : v.slot === 'su'
                    ? '📜 Lịch sử'
                    : v.slot === 'anh'
                      ? '🔤 Tiếng Anh'
                      : v.slot === 'dh'
                        ? '🖼️ Đuổi hình bắt chữ'
                        : v.category}
              </span>
            )}
            {v.phase !== 'reveal' ? <Timer left={left} /> : <span className="text-[34px] text-[#9df29d]">Đáp án</span>}
          </div>
          {!v.boardShown ? (
            v.riddleNo === 1 ? (
              // mở màn phần đố mẹo: cô đang dẫn, bảng báo trước để cả lớp chuẩn bị
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 160, damping: 13 }}
                className="flex flex-1 flex-col items-center justify-center text-center"
              >
                <motion.div animate={{ rotate: [-8, 8, -8] }} transition={{ duration: 1.2, repeat: Infinity }} className="text-[90px] leading-none">
                  🤪
                </motion.div>
                <div className="mt-2 text-[58px] font-bold leading-none text-[#ffe680]">PHẦN ĐỐ MẸO</div>
                <div className="mt-3 text-[36px]">2 câu liền · vẫn tính điểm</div>
                <div className="mt-2 text-[32px] opacity-90">Chuẩn bị tinh thần, nghĩ xéo mới thắng!</div>
              </motion.div>
            ) : (
            // cô đang đọc đề: chưa hiện chữ xáo / phép tính, hô bắt đầu mới hiện
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              {/* cô đang đọc: chỉ hiện "Câu N", KHÔNG hiện gợi ý (chủ kênh 2026-11-05: hiện gợi ý thì người đọc nhanh đoán trước, không công bằng).
                  Đọc xong mới hiện gợi ý + chữ xáo + ô đáp án cùng lúc */}
              <div className="text-[72px] font-bold leading-none text-[#ffe680]">Câu {v.qNo}</div>
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="mt-6 text-[40px] text-[#ffe680]"
              >
                👂 Nghe cô đọc đề nè…
              </motion.div>
            </div>
            )
          ) : v.slot === 'dh' ? (
            // đuổi hình bắt chữ: hình ghép bằng emoji thật to, bên dưới là ô đáp án
            <motion.div
              key={v.clue}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 160, damping: 14 }}
              className={`mt-3 shrink-0 whitespace-nowrap text-center text-[84px] leading-[110px] ${v.phase === 'reveal' ? 'opacity-60' : ''}`}
            >
              {v.clue}
            </motion.div>
          ) : v.math ? (
            // câu toán: phép tính viết to bằng phấn, người xem gõ số
            <motion.div
              key={v.math}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`mt-4 shrink-0 text-center text-[76px] font-extrabold leading-[96px] text-[#ffe680] ${v.phase === 'reveal' ? 'opacity-50' : ''}`}
            >
              {v.math}
            </motion.div>
          ) : (
            <>
              <div className="mt-2 line-clamp-2 min-h-[96px] shrink-0 text-center text-[38px] leading-[48px]">{v.clue}</div>
              <Tiles letters={v.tiles} dim={v.phase === 'reveal'} />
            </>
          )}
          {v.boardShown && <Slots slots={v.slots} reveal={v.phase === 'reveal'} />}
          {v.boardShown && v.math && v.phase !== 'reveal' && <div className="mt-2 text-center text-[28px] opacity-80">Gõ số vào bình luận</div>}
          {v.phase === 'bonus' && (
            <div className="mt-auto text-center text-[28px] text-[#ffe680]">{v.math ? 'Thêm 10 giây, nhẩm lẹ lên!' : 'Cô mở thêm 1 chữ, thêm 10 giây!'}</div>
          )}
        </div>
      )}

      {v.phase === 'team' && <TeamPick v={v} left={left} />}
      {v.phase === 'show' && v.show && <ShowBoard v={v} left={left} />}
      {v.phase === 'praise' && <Praise v={v} />}
      {v.phase === 'vote' && v.vote && <Vote v={v} left={left} />}
      {v.phase === 'results' && <Results v={v} />}
      {v.phase === 'recess' && v.recess && <Recess v={v} left={left} />}
    </div>
  );
}

function Timer({ left }: { left: number }) {
  const urgent = left <= 5;
  return (
    <motion.div
      key={urgent ? left : 'calm'}
      initial={urgent ? { scale: 1.35 } : false}
      animate={{ scale: 1 }}
      className={`flex h-[78px] min-w-[78px] items-center justify-center rounded-full border-[4px] px-2 text-[44px] font-extrabold leading-none tabular-nums ${urgent ? 'border-[#fb7185] bg-[#fb7185]/20 text-[#fecdd3] shadow-[0_0_24px_rgba(251,113,133,0.6)]' : 'border-[#5eead4]/80 bg-white/[0.06] text-white shadow-[0_0_18px_rgba(94,234,212,0.3)]'}`}
    >
      {left}
    </motion.div>
  );
}

function Tiles({ letters, dim }: { letters: string[]; dim: boolean }) {
  const n = letters.length || 1;
  const size = Math.min(76, Math.floor((555 - 8 * (n - 1)) / n));
  return (
    <div className={`mt-3 flex justify-center gap-2 ${dim ? 'opacity-40' : ''}`}>
      {letters.map((ch, i) => (
        <motion.div
          key={`${i}${ch}`}
          initial={{ y: -30, opacity: 0, rotate: -8 }}
          animate={{ y: 0, opacity: 1, rotate: ((i * 37) % 9) - 4 }}
          transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 18 }}
          className="tile flex items-center justify-center font-extrabold"
          style={{ width: size, height: size * 1.1, fontSize: size * 0.62 }}
        >
          {ch}
        </motion.div>
      ))}
    </div>
  );
}

function Slots({ slots, reveal }: { slots: (string | null)[]; reveal: boolean }) {
  const n = slots.length || 1;
  const size = Math.min(56, Math.floor((555 - 6 * (n - 1)) / n));
  return (
    <div className="mt-4 flex justify-center gap-[6px]">
      {slots.map((ch, i) =>
        ch === ' ' ? (
          <div key={i} style={{ width: size * 0.5 }} />
        ) : (
          <div
            key={i}
            className={`flex items-end justify-center border-b-4 ${reveal ? 'border-[#9df29d] text-[#9df29d]' : 'border-[#f4f1e6]'}`}
            style={{ width: size, height: size, fontSize: size * 0.8, lineHeight: 1 }}
          >
            {ch ?? ''}
          </div>
        ),
      )}
    </div>
  );
}

// Cả lớp chọn chủ đề tiết sau: gõ 1 hoặc 2
function Vote({ v, left }: { v: StageView; left: number }) {
  const r = v.vote!;
  const total = r.counts[0] + r.counts[1] || 1;
  return (
    <div className="flex h-full flex-col items-center text-center">
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full bg-gradient-to-r from-[#fde68a] to-[#fbbf24] px-4 py-[2px] text-[24px] font-extrabold text-[#1e1b4b]">🗳️ Cả lớp quyết định</span>
        <Timer left={left} />
      </div>
      <div className="mt-1 text-[44px] leading-tight text-[#ffe680]">Tiết sau học gì?</div>
      <div className="mt-3 w-full space-y-4 px-4">
        {r.topics.map((label, i) => {
          const pct = Math.round((r.counts[i] / total) * 100);
          return (
            <div key={label} className="relative h-[76px] overflow-hidden rounded-2xl border-2 border-white/40 text-left">
              <div className="absolute inset-y-0 left-0 bg-[#ffd84a]/35 transition-all duration-500" style={{ width: `${pct}%` }} />
              <div className="relative flex h-full items-center justify-between gap-3 px-4 text-[32px]">
                <span className="truncate">
                  Gõ <b className="text-[#ffe680]">{i + 1}</b>: {label}
                </span>
                <span>{r.counts[i]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Dừng giữa tiết: bạn nhỏ giỏi nhất từ đầu tiết, kèm quà cô vừa tặng
function Praise({ v }: { v: StageView }) {
  return (
    <div className="flex h-full flex-col items-center">
      <div className="text-[50px] leading-none text-[#ffe680]">🎁 Cô phát quà nè!</div>
      <div className="mt-1 text-[28px] opacity-80">Bạn nhỏ giỏi nhất sau {v.qNo} câu</div>
      <div className="mt-4 w-full space-y-2">
        {v.praiseTop.map((s, i) => (
          <motion.div
            key={s.username}
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.4 }}
            className="flex items-center gap-3 px-6 text-[40px]"
          >
            <Rank i={i} size={44} />
            <span className="flex-1 truncate">{s.nickname}</span>
            <span className="text-[34px]">{s.desk[s.desk.length - 1]?.icon}</span>
            <span>{s.score}đ</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-auto text-[30px] text-[#ffe680]">Chào cô, thả tim để được quà nha! 💕</div>
    </div>
  );
}

function Results({ v }: { v: StageView }) {
  const top = v.seats.filter((s) => s.score > 0).slice(0, 5);
  return (
    <div className="flex h-full flex-col items-center">
      <div className="text-[56px] leading-none text-[#ffe680]">Bảng vàng tiết {v.round}</div>
      {top.length === 0 && <div className="mt-16 text-[38px]">Chưa ai ghi điểm</div>}
      <div className="mt-4 w-full space-y-1">
        {top.map((s, i) => (
          <motion.div
            key={s.username}
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.25 }}
            className="flex items-center gap-3 px-6 text-[40px]"
          >
            <Rank i={i} size={44} />
            <span className="flex-1 truncate">{s.nickname}</span>
            <span className="tabular-nums text-[#fde68a]">{s.score}đ</span>
          </motion.div>
        ))}
      </div>
      {v.teamWin.length > 0 && (
        <div className="mt-auto text-[36px] text-[#ffe680]">
          🚩 {v.teamWin.map((n) => `Tổ ${n}`).join(' & ')} thắng tiết này!
        </div>
      )}
    </div>
  );
}

// ---------- Chia tổ (bản riêng cô Ngân) ----------
// 45 giây đầu tiết: 4 ô tổ trên bảng đen, số bạn mỗi tổ nhảy lên khi có người chọn
function TeamPick({ v, left }: { v: StageView; left: number }) {
  return (
    <div className="flex h-full flex-col items-center">
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full bg-gradient-to-r from-[#fde68a] to-[#fbbf24] px-4 py-[2px] text-[24px] font-extrabold text-[#1e1b4b]">🚩 Chọn tổ thi đua</span>
        <Timer left={left} />
      </div>
      <div className="mt-1 text-[32px] leading-tight">
        Gõ <b className="text-[#ffe680]">tổ 1</b>, <b className="text-[#ffe680]">tổ 2</b>, <b className="text-[#ffe680]">tổ 3</b> hoặc <b className="text-[#ffe680]">tổ 4</b>
      </div>
      <div className="mt-2 grid w-full grid-cols-2 gap-2 px-2">
        {v.teams.map((t, i) => (
          <div key={t.no} className="rounded-2xl border-[3px] bg-white/10 text-center leading-[38px]" style={{ borderColor: TEAM_COLOR[i] }}>
            <div className="text-[32px] font-bold" style={{ color: TEAM_COLOR[i] }}>
              {TEAM_ICON[i]} Tổ {t.no}
            </div>
            <motion.div key={t.members} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="text-[28px] leading-[32px]">
              {t.members} bạn{t.wins > 0 && <span className="ml-2 text-[24px] text-[#ffe680]">🚩{t.wins}</span>}
            </motion.div>
          </div>
        ))}
      </div>
      <div className="mt-auto text-[24px] leading-tight opacity-85">
        {v.noTeam > 0 ? `${v.noTeam} bạn chưa chọn, hết giờ cô Ngân xếp giùm` : 'Chưa chọn thì cô Ngân tự xếp vào tổ ít người'}
      </div>
    </div>
  );
}

// Bảng thi đua tổ: ghim bên phải bảng đen, điểm tiết này của cả tổ, tổ dẫn đầu nổi lên trên, 🚩 = số tiết đã thắng
function TeamBoard({ v }: { v: StageView }) {
  if (!v.teams.length) return null;
  const rows = [...v.teams].sort((a, b) => b.score - a.score || b.wins - a.wins || a.no - b.no);
  const lead = rows[0].score > 0 ? rows[0].no : 0;
  return (
    <div className="glass absolute right-[8px] top-[150px] z-20 w-[168px] !rounded-[18px] px-2 pb-2 pt-2">
      <div className="panel-title justify-center text-[15px]" style={{ ['--dot' as string]: '#34d399' }}>Thi đua tổ</div>
      <div className="mt-[6px] space-y-[5px]">
        {rows.map((t) => (
          <motion.div
            key={t.no}
            layout
            className="rounded-[12px] border-l-[6px] bg-white/[0.07] px-2 py-[2px] text-white"
            style={{ borderColor: TEAM_COLOR[t.no - 1], boxShadow: t.no === lead ? `0 0 0 2px #fde047, 0 0 16px ${TEAM_COLOR[t.no - 1]}` : undefined }}
          >
            <div className="flex items-center justify-between text-[20px] font-extrabold leading-tight">
              <span>
                {t.no === lead ? '👑 ' : ''}Tổ {t.no}
              </span>
              <span className="tabular-nums" style={{ color: TEAM_COLOR[t.no - 1] === '#3b82f6' ? '#93c5fd' : TEAM_COLOR[t.no - 1] }}>{t.score}đ</span>
            </div>
            <div className="flex justify-between text-[15px] font-semibold leading-tight text-[#a5b4fc]">
              <span>{t.members} bạn</span>
              <span>{t.wins > 0 ? `🚩x${t.wins}` : ''}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Bảng sự kiện bên phải tên kênh: cho khán giả biết lớp có 2 game lớn và phiên tới là game nào, sau tiết mấy
function EventBadge({ v }: { v: StageView }) {
  const n = v.nextShow;
  if (!n) return null;
  const games = [
    { kind: 'everest', label: '🏔️ Đường lên đỉnh Everest' },
    { kind: 'chuong', label: '🔔 Rung Chuông Đồng' },
  ];
  return (
    <div className="glass absolute left-[784px] top-[12px] z-20 w-[288px] overflow-hidden !rounded-[20px]">
      <div className="panel-title justify-center bg-gradient-to-r from-[#7c3aed]/60 to-[#db2777]/50 py-[3px] text-[16px] text-[#fde68a]" style={{ ['--dot' as string]: '#fbbf24' }}>Sự kiện trong lớp</div>
      <div className="px-3 pt-1">
        {games.map((g) => (
          <div key={g.kind} className={`truncate text-[19px] font-bold leading-[26px] ${g.kind === n.kind ? 'text-[#fde68a]' : 'opacity-70'}`}>
            {g.label}
          </div>
        ))}
      </div>
      <motion.div
        key={`${n.kind}${n.now}${n.soon}`}
        animate={n.now || n.soon ? { scale: [1, 1.06, 1] } : {}}
        transition={{ duration: 1, repeat: Infinity }}
        className={`mx-2 mb-2 mt-1 rounded-full px-2 text-center text-[18px] font-extrabold leading-[28px] ${n.now ? 'bg-gradient-to-r from-[#ef4444] to-[#ec4899]' : n.soon ? 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#1e1b4b]' : 'bg-white/10 text-[#c7d2fe]'}`}
      >
        {n.now ? `🔴 ĐANG DIỄN RA` : n.soon ? '⏰ Hết tiết này là tới!' : `⏭ Phiên tới: sau tiết ${n.afterRound}`}
      </motion.div>
    </div>
  );
}

// ---------- 2 game lớn (bản riêng): Đường lên đỉnh Everest / Rung Chuông Đồng ----------
// Bảng đen: cô đọc câu thì hiện câu + 4 đáp án để đọc theo; cô hô bắt đầu (boardShown) mới chạy đồng hồ và nhận đáp án
type ShowView = NonNullable<StageView['show']>;
const SHOW_ACCENT = { everest: '#7dd3fc', chuong: '#fbbf24' };
function ShowBoard({ v, left }: { v: StageView; left: number }) {
  const s = v.show!;
  const accent = SHOW_ACCENT[s.kind];
  const answering = s.stage === 'ask' && v.boardShown;
  const badge =
    s.tag === 'tie' ? '⚖️ Câu phụ' : s.tag === 'bell' ? '🔔 Câu Chuông Đồng' : s.tag === 'rescue' ? '🤝 Cứu trợ cả phòng' : s.step === 'code' ? '🔐 Mật mã trạm' : s.step === 'stake' ? '🏔️ Chọn mức điểm' : `Câu ${s.qNo}`;
  return (
    <div className="flex h-full flex-col">
      {s.step !== 'gather' && s.step !== 'section' && s.step !== 'honor' && (
        <div className="flex shrink-0 items-center justify-between">
          <span className="rounded-full px-4 text-[26px] font-bold text-[#1e1b4b]" style={{ background: accent }}>
            {badge}
          </span>
          {answering ? <Timer left={left} /> : s.stage === 'reveal' ? <span className="text-[30px] text-[#9df29d]">Đáp án</span> : <span className="text-[26px] opacity-80">👂 Nghe cô đọc…</span>}
        </div>
      )}
      {s.step === 'gather' && <ShowGather s={s} left={left} />}
      {s.step === 'section' && (
        <motion.div key={s.section} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex h-full flex-col items-center justify-center text-center">
          <div className="text-[30px] opacity-80">{s.name}</div>
          <div className="mt-2 text-[58px] font-extrabold leading-tight" style={{ color: accent }}>
            {s.section}
          </div>
        </motion.div>
      )}
      {s.step === 'mc' && <ShowQuestion s={s} answering={answering} />}
      {s.step === 'stake' && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-[36px]">Câu tiếp theo cược bao nhiêu?</div>
          <div className="mt-3 flex gap-6">
            {[10, 20].map((x, i) => (
              <div key={x} className="w-[190px] rounded-2xl border-4 py-2" style={{ borderColor: accent }}>
                <div className="text-[54px] font-extrabold leading-none" style={{ color: accent }}>
                  {x}
                </div>
                <div className="text-[24px]">Gõ "{x}" · {s.stakes[i]} bạn</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[24px] opacity-80">Không chọn thì tính 10 · sai không bị trừ</div>
        </div>
      )}
      {(s.step === 'code' || s.step === 'codeReveal') && s.code && <ShowCode s={s} answering={answering} />}
      {s.step === 'honor' && <ShowHonor s={s} />}
      {answering && (s.step === 'mc' || s.step === 'stake') && (
        <div className="mt-auto shrink-0 text-center text-[24px] opacity-85">
          {s.step === 'stake' ? 'Gõ 10 hoặc 20' : 'Gõ A, B, C hoặc D'} · {s.answered} bạn đã chọn
          {s.tag === 'final' && s.tickets > 0 && !s.ticketUser && <span className="text-[#ffe680]"> · 🎟️ có phiếu: gõ "gợi ý"</span>}
        </div>
      )}
    </div>
  );
}

function ShowGather({ s, left }: { s: ShowView; left: number }) {
  const rules =
    s.kind === 'everest'
      ? ['👣 Bước chân đầu tiên · 🔐 Mật mã trạm', '🌪️ Bão tốc độ · 🏔️ Chạm đỉnh', 'Gõ A B C D · ai đúng cũng có điểm']
      : ['🔥 Làm nóng · 💪 Trụ vững · 🤝 Cứu trợ', '⚡ Thử thách cuối · 🔔 Câu Chuông Đồng', 'Gõ A B C D · sai không bị loại'];
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 0.47, repeat: Infinity }} className="text-[64px] leading-none">
        {s.kind === 'everest' ? '🏔️' : '🔔'}
      </motion.div>
      <div className="mt-1 text-[48px] font-extrabold leading-tight" style={{ color: SHOW_ACCENT[s.kind] }}>
        {s.name}
      </div>
      <div className="mt-2 space-y-1 text-[27px] leading-snug">
        {rules.map((r) => (
          <div key={r}>{r}</div>
        ))}
      </div>
      <div className="mt-3 text-[26px] opacity-80">Bắt đầu sau {left} giây</div>
    </div>
  );
}

function ShowQuestion({ s, answering }: { s: ShowView; answering: boolean }) {
  const reveal = s.stage === 'reveal';
  return (
    <>
      <div className="mt-2 line-clamp-3 shrink-0 text-center text-[31px] leading-[38px]">{s.question}</div>
      <div className="mt-2 grid flex-1 grid-cols-2 content-center gap-2">
        {s.opts.map((o, i) => {
          const right = reveal && i === s.ans;
          const gone = s.removed.includes(i);
          return (
            <motion.div
              key={i}
              initial={{ x: i % 2 ? 30 : -30, opacity: 0 }}
              animate={{ x: 0, opacity: gone || (reveal && !right) ? 0.35 : 1, scale: right ? [1, 1.08, 1] : 1 }}
              transition={{ delay: reveal ? 0 : i * 0.08 }}
              className={`flex min-h-[54px] items-center gap-2 rounded-xl border-[3px] px-2 text-[25px] leading-tight ${
                right ? 'border-[#4ade80] bg-[#16a34a]/50' : answering ? 'border-white/60 bg-white/10' : 'border-white/30 bg-white/5'
              }`}
            >
              <b className="w-7 shrink-0 text-center text-[28px]" style={{ color: SHOW_ACCENT[s.kind] }}>
                {'ABCD'[i]}
              </b>
              <span className={`min-w-0 flex-1 ${gone ? 'line-through' : ''}`}>{o}</span>
              {reveal && <span className="shrink-0 text-[20px] opacity-80">{s.counts[i]}</span>}
            </motion.div>
          );
        })}
      </div>
      {s.tag === 'tie' && s.stage === 'ask' && <div className="shrink-0 truncate text-center text-[22px] text-[#ffe680]">Chỉ tính: {s.tied.join(', ')}</div>}
      {s.ticketUser && s.stage === 'ask' && <div className="shrink-0 truncate text-center text-[22px] text-[#ffe680]">🎟️ {s.ticketUser} tiếp sức: bỏ 2 đáp án sai</div>}
      {reveal && <div className="shrink-0 text-center text-[24px] text-[#9df29d]">{s.lastRight} bạn trả lời đúng</div>}
    </>
  );
}

function ShowCode({ s, answering }: { s: ShowView; answering: boolean }) {
  const c = s.code!;
  const letters = c.answer ? [...c.answer.replace(/\s+/g, '')] : [];
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-2 flex shrink-0 justify-center gap-1">
        {Array.from({ length: c.len }, (_, i) => (
          <div key={i} className="flex h-[48px] w-[38px] items-end justify-center border-b-4 border-[#ffe680] text-[34px] font-bold leading-none text-[#ffe680]">
            {letters[i] ?? (i === 0 ? c.first : '')}
          </div>
        ))}
      </div>
      <div className="mt-2 flex-1 space-y-1 overflow-hidden">
        {c.hints.map((h, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2 text-[24px] leading-[30px]">
            <b className="shrink-0 text-[#7dd3fc]">{[30, 20, 10][i]}đ</b>
            <span className="line-clamp-2">{h}</span>
          </motion.div>
        ))}
        {c.rescue && !c.answer && <div className="text-[24px] text-[#ffe680]">🆘 Cứu trợ 10 giây · chữ đầu là {c.first}</div>}
      </div>
      <div className="shrink-0 text-center text-[23px] opacity-90">
        {c.answer
          ? c.solvers.length
            ? `🔓 ${c.solved} bạn giải được: ${c.solvers.map((x) => x.nickname).slice(0, 3).join(', ')}`
            : '🔒 Không ai giải được'
          : answering
            ? `Gõ từ khoá có dấu · đúng được ${c.pts} điểm · ${c.solved} bạn đã giải`
            : `${c.solved} bạn đã giải`}
      </div>
    </div>
  );
}

function ShowHonor({ s }: { s: ShowView }) {
  return (
    <div className="flex h-full flex-col items-center">
      <div className="text-[44px] font-extrabold leading-none" style={{ color: SHOW_ACCENT[s.kind] }}>
        {s.kind === 'everest' ? '🚩 Vinh danh đỉnh Everest' : '🔔 Vinh danh Chuông Đồng'}
      </div>
      {s.honors.length === 0 && <div className="mt-16 text-[34px]">Chưa ai ghi điểm</div>}
      <div className="mt-2 grid w-full grid-cols-2 gap-x-4 px-2 text-[22px] leading-[30px]">
        {s.honors.map((h, i) => (
          <motion.div key={h.username} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }} className={`flex min-w-0 gap-1 ${i === 0 ? 'col-span-2 justify-center text-[30px] text-[#ffe680]' : ''}`}>
            <span className="shrink-0">{i === 0 ? h.title.split(' ')[0] : `${i + 1}.`}</span>
            <span className="min-w-0 truncate">{h.nickname}</span>
            <b className="shrink-0">{h.score}đ</b>
          </motion.div>
        ))}
      </div>
      {s.honors[0] && <div className="mt-auto text-[24px] opacity-85">{s.honors[0].title.slice(s.honors[0].title.indexOf(' ') + 1)} · top 10 nhận huy hiệu</div>}
    </div>
  );
}

// Dưới bảng đen: núi Everest, top 10 leo cao theo điểm (điểm tối đa = đỉnh), người đầu cầm cờ
function Mountain({ v }: { v: StageView }) {
  const s = v.show!;
  const W = 400; // nhỏ lại cho khỏi che bảng Top tương tác bên phải
  const H = 168;
  const top = s.top.slice(0, 10);
  const pos = (i: number, score: number) => {
    const p = Math.min(1, score / Math.max(1, s.maxScore));
    const side = i % 2 === 0 ? -1 : 1; // so le 2 sườn núi cho đỡ chồng tên
    const y = H - 18 - p * (H - 40);
    const halfWidth = ((y - 20) / (H - 20)) * (W / 2 - 10);
    return { x: W / 2 + side * Math.max(8, halfWidth * (0.35 + ((i * 37) % 50) / 100)), y };
  };
  return (
    <div className="glass absolute left-[392px] top-[622px] z-30 overflow-hidden !rounded-[18px]" style={{ width: W, height: H }}>
      <svg width={W} height={H} className="absolute inset-0">
        <defs>
          <linearGradient id="mt-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1e3a8a" />
            <stop offset="1" stopColor="#7c3aed" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#mt-sky)" opacity="0.55" />
        <polygon points={`-30,${H} ${W * 0.22},70 ${W * 0.42},${H}`} fill="#334155" />
        <polygon points={`10,${H} ${W / 2},20 ${W - 10},${H}`} fill="#475569" />
        <polygon points={`${W / 2},20 ${W - 10},${H} ${W / 2 + 30},${H}`} fill="#334155" />
        <polygon points={`${W / 2 - 46},62 ${W / 2},20 ${W / 2 + 46},62 ${W / 2 + 20},54 ${W / 2},66 ${W / 2 - 22},54`} fill="#f8fafc" />
        <line x1={W / 2} y1={20} x2={W / 2} y2={2} stroke="#e2e8f0" strokeWidth={3} />
        <polygon points={`${W / 2},2 ${W / 2 + 22},8 ${W / 2},14`} fill="#f43f5e" />
      </svg>
      <div className="panel-title absolute left-3 top-[6px] text-[15px] text-white" style={{ ['--dot' as string]: '#7dd3fc' }}>Top 10 leo núi · {s.players} bạn chơi</div>
      {top.length === 0 && <div className="absolute inset-x-0 bottom-3 text-center text-[20px] font-bold text-white">Trả lời đúng để leo lên nha!</div>}
      {top.map((r, i) => {
        const p = pos(i, r.score);
        return (
          <motion.div
            key={r.username}
            animate={{ left: p.x, top: p.y }}
            transition={{ type: 'spring', stiffness: 80, damping: 14 }}
            className="absolute flex -translate-x-1/2 -translate-y-full items-center gap-[2px] whitespace-nowrap rounded-full bg-white/95 px-[6px] text-[14px] font-bold text-[#1e1b4b] shadow-[0_3px_8px_rgba(0,0,0,0.35)]"
          >
            {i === 0 ? '🚩' : '🧗'}
            <span className="max-w-[90px] truncate">{r.nickname}</span>
            <span className="text-[#db2777]">{r.score}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

// Dưới bảng đen: Rung Chuông Đồng, top 5 thanh điểm + người đủ điều kiện rung chuông
function BellBoard({ v }: { v: StageView }) {
  const s = v.show!;
  const top = s.top.slice(0, 5);
  return (
    <div className="glass absolute left-[392px] top-[622px] z-30 w-[400px] overflow-hidden !rounded-[18px]">
      <div className="flex items-center justify-between bg-gradient-to-r from-[#d97706]/70 to-[#f59e0b]/40 px-3 py-[3px] text-[17px] font-bold">
        <span className="panel-title text-[15px] text-white" style={{ ['--dot' as string]: '#fde047' }}>Chuông Đồng</span>
        <span className="text-[#fde68a]">
          {s.players} bạn chơi{s.tickets > 0 ? ` · 🎟️ ${s.tickets}` : ''}
        </span>
      </div>
      <div className="space-y-[4px] px-2 py-[6px]">
        {top.length === 0 && <div className="py-3 text-center text-[20px] text-[#a5b4fc]">Trả lời đúng để lên bảng nha!</div>}
        {top.map((r, i) => (
          <motion.div key={r.username} layout className="relative h-[28px] overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#f59e0b]/80 to-[#fde047]/60" animate={{ width: `${Math.min(100, (r.score / Math.max(1, s.maxScore)) * 100)}%` }} />
            <div className="relative flex h-full items-center gap-2 px-1 text-[18px] font-bold text-white">
              <Rank i={i} size={22} />
              <span className="min-w-0 flex-1 truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">{r.nickname}</span>
              <span className="pr-2 tabular-nums">{r.score}đ</span>
            </div>
          </motion.div>
        ))}
        {s.bellRingers.length > 0 && <div className="truncate text-[17px] font-semibold text-[#fde68a]">🔔 Rung chuông: {s.bellRingers.join(', ')}</div>}
      </div>
    </div>
  );
}

// ---------- Giờ ra chơi ----------
const RECESS_TITLE = { rps: 'Oẳn tù tì với cô', callup: 'Kiểm tra miệng', pick: 'Chọn phe', roll: 'Điểm danh siêu tốc', heart: 'Thả tim cả lớp' };

function Recess({ v, left }: { v: StageView; left: number }) {
  const r = v.recess!;
  if (r.stage === 'board') return <SessionBoard v={v} />;
  const playing = r.stage === 'play';
  return (
    <div className="flex h-full flex-col items-center text-center">
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full bg-gradient-to-r from-[#fde68a] to-[#fbbf24] px-4 py-[2px] text-[24px] font-extrabold text-[#1e1b4b]">
          🔔 Giờ ra chơi{r.game === 'callup' ? ` · ${RECESS_TITLE.callup}` : ''}
        </span>
        {playing && <Timer left={left} />}
      </div>
      {r.game !== 'callup' && <div className="mt-1 shrink-0 text-[48px] leading-tight text-[#ffe680]">{RECESS_TITLE[r.game]}</div>}
      {r.game === 'rps' && (
        <>
          <div className="mt-3 flex w-full justify-center gap-6 text-[34px]">
            {[
              ['✊', 'búa'],
              ['✌️', 'kéo'],
              ['✋', 'bao'],
            ].map(([icon, word], i) => (
              <div key={word} className={`w-[150px] rounded-2xl border-2 py-2 ${r.teacher === word ? 'border-[#ffd84a] bg-white/15' : 'border-white/30'}`}>
                <div className="text-[56px] leading-none">{icon}</div>
                <div>{word}</div>
                <div className="text-[30px] text-[#9df29d]">{r.rpsCounts[i]}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[32px]">{playing ? 'Gõ: búa, kéo hoặc bao' : r.teacher ? `Cô ra: ${r.teacher}` : 'Không ai chơi'}</div>
        </>
      )}
      {r.game === 'callup' && (
        <>
          <div className="mt-1 max-w-full shrink-0 truncate text-[36px] text-[#ffe680]">📢 {r.callName} lên bảng!</div>
          <div className="line-clamp-2 shrink-0 text-[30px] leading-[36px]">{r.callClue}</div>
          <Tiles letters={r.callTiles} dim={!playing} />
          <Slots slots={r.callSlots} reveal={!playing} />
          {!playing && (
            <div className="mt-1 text-[34px]">{r.callResult === 'right' ? '✅ Đúng! +5 điểm' : r.callResult === 'wrong' ? '❌ Sai mất rồi' : '💤 Không trả lời'}</div>
          )}
        </>
      )}
      {r.game === 'pick' && (
        <div className="mt-4 w-full space-y-4 px-4">
          {r.pick.map((label, i) => {
            const total = r.votes[0] + r.votes[1] || 1;
            const pct = Math.round((r.votes[i] / total) * 100);
            return (
              <div key={label} className="relative h-[70px] overflow-hidden rounded-2xl border-2 border-white/40 text-left">
                <div className="absolute inset-y-0 left-0 bg-[#ffd84a]/35 transition-all duration-500" style={{ width: `${pct}%` }} />
                <div className="relative flex h-full items-center justify-between px-4 text-[36px]">
                  <span>
                    Gõ <b className="text-[#ffe680]">{i + 1}</b>: {label}
                  </span>
                  <span>{r.votes[i]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {r.game === 'roll' && (
        <>
          <div className="text-[34px]">
            Gõ <b className="text-[#ffe680]">CÓ MẶT</b> thật nhanh, 10 bạn đầu +3
          </div>
          <div className="mt-2 grid w-full grid-cols-2 gap-x-6 px-6 text-left text-[28px]">
            {r.roll.map((n, i) => (
              <div key={i} className="truncate">
                {i + 1}. {n}
              </div>
            ))}
          </div>
        </>
      )}
      {r.game === 'heart' && (
        <>
          <div className="mt-4 text-[90px] leading-none">❤️</div>
          <div className="mt-2 h-[40px] w-[460px] overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-[#ff5d8f] transition-all duration-300" style={{ width: `${Math.min(100, (r.hearts / r.heartTarget) * 100)}%` }} />
          </div>
          <div className="mt-2 text-[36px]">
            {r.hearts}/{r.heartTarget} tim
          </div>
        </>
      )}
    </div>
  );
}

// Cuối giờ ra chơi: lớp trưởng các tiết trước (mới nhất trên cùng), ai làm nhiều lần thì có số lần
function SessionBoard({ v }: { v: StageView }) {
  return (
    <div className="flex h-full flex-col items-center">
      <div className="text-[48px] leading-none text-[#ffe680]">👑 Lớp trưởng các tiết</div>
      {v.champions.length === 0 && <div className="mt-16 text-[36px]">Chưa có lớp trưởng</div>}
      <div className="mt-3 w-full space-y-1">
        {v.champions.map((c, i) => (
          <motion.div
            key={c.round}
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.2 }}
            className="flex items-center gap-3 px-6 text-[36px]"
          >
            <span className="w-[110px] text-[26px] text-[#ffe680]">Tiết {c.round}</span>
            <span className="flex-1 truncate">{c.nickname}</span>
            {c.times > 1 && <span className="text-[26px] text-[#ffe680]">👑x{c.times}</span>}
            <span>{c.score}đ</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-auto text-[28px] opacity-80">Tiết mới điểm làm lại, ai cũng có thể làm lớp trưởng!</div>
    </div>
  );
}

function WeekBoard({ v, left }: { v: StageView; left: number }) {
  return (
    <div className="flex h-full flex-col items-center">
      <div className="text-[48px] leading-none text-[#ffe680]">Bảng vàng tuần này</div>
      <div className="mt-3 w-full space-y-1">
        {v.weekTop.slice(0, 5).map((s, i) => (
          <div key={s.username} className="flex items-center gap-3 px-6 text-[36px]">
            <Rank i={i} size={40} />
            <span className="flex-1 truncate">{s.nickname}</span>
            <span className="tabular-nums text-[#fde68a]">{s.points}đ</span>
          </div>
        ))}
      </div>
      <div className="mt-auto text-[28px] opacity-80">Vào tiết sau {left} giây</div>
    </div>
  );
}

// Góc trái trên đầu cô: tờ giấy ghim "Học sinh xuất sắc trong tiết", chỉ tính điểm tiết đang học, sang tiết mới làm lại
// (chủ kênh đổi 2026-11-04, trước tính cả ngày). Ghế đã xếp theo điểm tiết nên lấy luôn 4 bạn đầu
function DayTop({ v }: { v: StageView }) {
  const rows = v.seats.filter((s) => s.score > 0).slice(0, 4).map((s) => ({ username: s.username, nickname: s.nickname, points: s.score })); // top 4 thôi để không che đầu cô
  return (
    <div className="glass absolute left-[10px] top-[236px] z-20 w-[326px] px-4 pb-3 pt-3">
      <div className="panel-title text-[17px]" style={{ ['--dot' as string]: '#fbbf24' }}>Xuất sắc trong tiết</div>
      {rows.length === 0 && <div className="py-3 text-center text-[19px] text-[#a5b4fc]">Chưa có ai, trả lời đúng là lên bảng!</div>}
      <div className="mt-2 space-y-[6px]">
        {rows.map((r, i) => (
          <motion.div key={r.username} layout className="flex items-center gap-2 text-[22px] leading-[28px]">
            <Rank i={i} size={26} />
            <span className="min-w-0 flex-1 truncate font-semibold">{r.nickname}</span>
            <b className="tabular-nums text-[#fde68a]">{r.points}</b>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ---------- Cô giáo (cô Ngân, bản riêng: 16 tư thế, ảnh gốc trong nhan-vat/co-giao-ngan, tách nền ra public/assets/nv/co-ngan) ----------
function teacherPose(v: StageView, now: number): string {
  // có bạn cầm hoa đi lên: ngạc nhiên, tới bục đưa hoa thì cười che miệng
  if (v.walk) return now - v.walk.at < GAME.walkMs * 0.35 ? '13-ngac-nhien' : '06-cuoi';
  if (now - v.lastFlowerAt < 3000) return '06-cuoi'; // được tặng hoa
  if (v.birthday) return '09-mung';
  if (v.clapping) return '10-vo-tay';
  if (v.loveFans > 0) return '07-tay-nguc'; // các bạn gõ "yêu cô"
  switch (v.phase) {
    case 'team':
    case 'intro':
      return '04-vay-chao';
    case 'question':
      if (!v.boardShown) return '02-gioi-thieu'; // đang đọc đề
      if (v.correctCount > 0) return '08-ngon-cai'; // có bạn đúng rồi
      return now % 8000 < 4000 ? '03-chi-bang' : '01-dung'; // chờ trả lời: lúc chỉ bảng, lúc đứng
    case 'bonus':
      return '12-gai-dau'; // chưa ai ra, thêm giờ
    case 'reveal':
      return v.correctCount === 0 ? '11-nhun-vai' : v.golden ? '09-mung' : '08-ngon-cai';
    case 'praise':
      return '09-mung';
    case 'results':
    case 'vote':
      return '14-ngon-tro';
    case 'recess':
      if (v.recess?.stage === 'play') return v.recess.game === 'callup' ? '16-chi-trai' : '05-dang-tay';
      return v.recess?.stage === 'result' ? '15-chong-hong' : '07-tay-nguc';
  }
  return '01-dung';
}

/** 2 game lớn: tư thế theo từng bước (ảnh nhan-vat/co-giao-ngan/duong-len-dinh-everest và Rung-Chuong-Dong) */
function showPose(v: StageView, now: number): string {
  const sh = v.show!;
  const flower = now - v.lastFlowerAt < 3000 || !!v.walk;
  const alt = now % 6000 < 3000;
  const answering = sh.stage === 'ask' && v.boardShown;
  if (sh.kind === 'everest') {
    if (flower) return '10-cuoi-vui';
    if (v.clapping) return '15-vo-tay';
    switch (sh.step) {
      case 'gather':
        return alt ? '04-chao-doan-leo' : '12-vay-chao';
      case 'section':
        return sh.section.includes('Chạm đỉnh') ? '02-chi-len-dinh' : '03-chi-lo-trinh';
      case 'stake':
        return '16-tu-tin';
      case 'code':
        return !answering ? '05-doc-ban-do' : sh.code?.rescue ? '14-dong-vien' : alt ? '06-suy-nghi' : '01-dung-san-sang';
      case 'codeReveal':
        return sh.code?.solved ? '10-cuoi-vui' : '09-bat-ngo';
      case 'honor':
        return '13-cam-co-dinh';
      default:
        if (sh.stage === 'reveal') return sh.lastRight > 0 ? '07-like' : '09-bat-ngo';
        if (!answering) return '05-doc-ban-do';
        if (Math.max(0, v.endsAt - now) <= 3000) return '11-nhac-nho-an-toan';
        return alt ? '08-co-vu' : '01-dung-san-sang';
    }
  }
  if (flower) return '06-rung-chuong-cuoi-tuoi';
  if (v.clapping) return '07-rung-chuong-hao-hung';
  switch (sh.step) {
    case 'gather':
      return alt ? '12-moi-thi-sinh' : '13-vay-chao-cam-chuong';
    case 'section':
      return sh.section.includes('Chuông') ? '15-chuan-bi-rung' : '09-bao-hieu-bat-dau';
    case 'honor':
      return alt ? '10-mung-chien-thang' : '03-rung-chuong-cao';
    default:
      if (sh.stage === 'reveal') {
        if (sh.lastRight === 0) return '11-bat-ngo-nghe-chuong';
        return sh.tag === 'bell' ? '04-rung-chuong-hai-tay' : alt ? '02-rung-chuong-ben' : '05-rung-chuong-nghieng-nguoi';
      }
      if (!answering) return sh.tag === 'tie' ? '16-nghi-thang-tran' : '08-rung-chuong-nghiem-tuc';
      return alt ? '01-cam-chuong-san-sang' : '14-tu-hao-gio-chuong';
  }
}

function Teacher({ v, now }: { v: StageView; now: number }) {
  const gotFlower = now - v.lastFlowerAt < 3000;
  // trang phục: 2 game lớn mặc bộ của game, còn lại theo bộ cô đang mặc (đổi sau mỗi 20 câu)
  const outfit = v.show ? v.show.kind : v.outfit || 'trang';
  const pose = v.show ? showPose(v, now) : teacherPose(v, now);
  return (
    <div className="absolute left-[86px] top-[410px] h-[490px] w-[320px]">
      <TeacherArt outfit={outfit} pose={pose} />
      {/* bảng tên cài ngực áo (trên đầu cô là bảng Học sinh xuất sắc nên không đặt ở đó) */}
      <div className="absolute left-1/2 top-[262px] z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-white/80 bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] px-4 py-[2px] text-[21px] font-extrabold text-white shadow-[0_6px_16px_rgba(139,92,246,0.45)]">
        Cô Ngân
      </div>
      <AnimatePresence>
        {gotFlower && (
          <motion.div
            key={v.lastFlowerAt}
            initial={{ scale: 0, y: 80 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute left-[130px] top-[150px] text-[80px]"
          >
            💐
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Ai nhanh nhất câu này ----------
// Hết câu (hiện đáp án): bảng Top 5 nhanh nhất, thời gian tới mili giây + điểm được cộng; ai đúng chậm hơn +1
const secText = (ms: number) => `${(ms / 1000).toFixed(3).replace('.', ',')} giây`;
function FastestBoard({ v }: { v: StageView }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass absolute left-[378px] top-[618px] z-30 w-[460px] overflow-hidden"
    >
      <div className="flex items-center justify-between bg-gradient-to-r from-[#6366f1]/55 to-[#ec4899]/45 px-4 py-[4px] text-[22px] font-extrabold">
        <span className="panel-title text-[18px] text-white" style={{ ['--dot' as string]: '#fde047' }}>Top {GAME.fastestShown} nhanh nhất</span>
        <span className="text-[#fde68a]">{v.correctCount} bạn đúng</span>
      </div>
      {v.fastest.length === 0 && <div className="py-3 text-center text-[22px] text-[#a5b4fc]">Chưa ai đúng câu này</div>}
      <div className="py-1">
        {v.fastest.map((a, i) => (
          <motion.div
            key={a.username}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 * i }}
            className={`flex items-center gap-2 px-3 text-[27px] leading-[42px] ${i % 2 ? 'bg-white/[0.05]' : ''}`}
          >
            <Rank i={i} size={30} />
            <span className="min-w-0 flex-1 truncate font-semibold">{a.nickname}</span>
            <span className="shrink-0 whitespace-nowrap text-right text-[22px] font-semibold tabular-nums text-[#a5b4fc]">{secText(a.ms)}</span>
            <b className="w-[58px] shrink-0 text-right text-[28px] text-[#fde047]">+{a.points}</b>
          </motion.div>
        ))}
      </div>
      {v.laterCount > 0 && (
        <div className="border-t border-white/10 px-3 text-center text-[21px] font-semibold leading-[34px] text-[#c7d2fe]">
          {v.laterCount} bạn khác đúng chậm hơn: mỗi bạn +{v.laterPoints}
        </div>
      )}
    </motion.div>
  );
}

function Podium({ v }: { v: StageView }) {
  if (v.phase === 'show' && v.show) return v.show.kind === 'everest' ? <Mountain v={v} /> : <BellBoard v={v} />;
  if (v.phase === 'reveal') return <FastestBoard v={v} />;
  if (v.phase !== 'question' && v.phase !== 'bonus') return null;
  return (
    <div className="glass absolute left-[417px] top-[630px] z-[9] w-[420px] overflow-hidden !rounded-[18px]">
      <div className="flex items-center justify-between bg-gradient-to-r from-[#6366f1]/55 to-[#ec4899]/45 px-3 py-[2px] text-[18px] font-bold">
        <span className="panel-title text-[16px] text-white" style={{ ['--dot' as string]: '#fde047' }}>Nhanh nhất</span>
        <span className="text-[#fde68a]">{v.correctCount} bạn đã đúng</span>
      </div>
      <div className="flex h-[50px] items-center gap-1 px-2">
        {v.correctTop.length === 0 && <div className="w-full text-center text-[19px] text-[#a5b4fc]">Chưa ai đoán ra…</div>}
        <AnimatePresence initial={false}>
          {v.correctTop.map((a, i) => (
            <motion.div
              key={a.username}
              layout
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex w-1/3 min-w-0 items-center gap-[6px] text-[17px]"
            >
              <Rank i={i} size={24} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate font-semibold">{a.nickname}</div>
                <div className="font-extrabold text-[#fde047]">+{a.points}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Dòng nhắc dưới khung "Nhanh nhất", trên hàng ghế đầu: cách được vào lớp ngồi (đổi câu mỗi 8 giây, viết ngắn)
const SEAT_HINTS = ['⭐ Đoán nhanh, điểm cao được vào lớp ngồi!', '💬 Tương tác nhiều để giữ chỗ trong lớp nha!'];
// đang hỏi: luôn hiện hướng dẫn cố định để người mới lướt vào hiểu ngay (chế độ nhanh 2026-11-04)
const ASK_HINT = '💬 Gõ đáp án vào bình luận · nhanh nhất +10 điểm';
function SeatHint({ now, asking }: { now: number; asking: boolean }) {
  const i = asking ? -1 : Math.floor(now / 8000) % SEAT_HINTS.length;
  return (
    <div className="pointer-events-none absolute left-[397px] top-[722px] z-[9] flex w-[460px] justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="whitespace-nowrap rounded-full border border-white/15 bg-[#0f1328]/80 px-4 py-[2px] text-[18px] font-bold text-[#e0e7ff] shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
        >
          {i < 0 ? ASK_HINT : SEAT_HINTS[i]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------- Học sinh ----------
function studentPose(s: StageView['seats'][number], v: StageView, rank: number, now: number): KidPose {
  if (v.clapping) return 'vui';
  if (now - s.joinedAt < 3000) return 'chao';
  const asking = v.phase === 'question' || v.phase === 'bonus';
  if (s.answered === 'right') return 'vui';
  if (s.answered === 'wrong') return asking ? 'buon' : 'ngac';
  if (asking) return now - s.lastActive < 2500 ? 'tay' : 'nghi';
  if ((v.phase === 'results' || v.phase === 'praise') && rank < 3 && s.score > 0) return 'vui';
  if (now - (s.desk[s.desk.length - 1]?.at ?? 0) < 3000) return 'vui'; // vừa được cô tặng quà
  return now - s.lastActive < 2500 ? 'tay' : 'dung';
}

/** Vị trí ghế thứ i (khung nửa trên người ngồi, toạ độ stage) */
function seatBox(i: number) {
  const ri = SEAT_ROW[i] ?? ROWS.length - 1;
  const row = ROWS[ri];
  const k = i - SEAT_ROW.indexOf(ri); // thứ tự trong dãy
  const scale = row.s * KID;
  const w = SPRITE_H * 0.47 * scale;
  const h = SPRITE_H * scale;
  const show = h * SHOW;
  const cx = row.x1 + ((k + 0.5) * (row.x2 - row.x1)) / Math.max(1, row.n);
  const x = cx * K - w / 2;
  const y = (row.y + 0.64 * (row.b - row.y)) * K - show; // ngồi trên ghế băng, lưng quay ra khán giả
  return { scale, w, h, show, x, y, ri, k, gap: ((row.x2 - row.x1) * K) / Math.max(1, row.n) };
}

/** Bàn dài + ghế băng của 1 dãy (che hẳn dãy bàn lẻ vẽ sẵn trong ảnh nền) */
function LongDesk({ ri }: { ri: number }) {
  const r = ROWS[ri];
  const h = r.b - r.y;
  const [x1, x2] = [r.x1 - 6, r.x2 + 6];
  const Y = (f: number) => r.y + f * h;
  const nLegs = Math.max(2, Math.floor((r.n || 8) / 2) + 1);
  const legs = Array.from({ length: nLegs }, (_, j) => x1 + 22 + (j * (x2 - x1 - 44)) / (nLegs - 1));
  // bàn kiểu mới: mặt gỗ sáng, tấm chắn xanh than, chân kim loại. Tông tối vừa phải để tên và quà trên bàn dễ đọc
  // (chủ kênh chỉnh 2026-11-04: bàn sáng quá thì tên và quà khó nhìn)
  const line = { stroke: '#0f172a', strokeWidth: 2.5, strokeLinejoin: 'round' as const };
  return (
    <svg className="pointer-events-none absolute left-0 top-0" width={1080} height={1920} viewBox="0 0 941 1672" style={{ zIndex: 9 + ri }}>
      {/* bóng dưới bàn ghế */}
      <rect x={x1 - 2} y={Y(0.5)} width={x2 - x1 + 4} height={h * 0.52} rx={12} fill="#3b2a3a" opacity={0.35} />
      {/* chân bàn 2 đầu */}
      <rect x={x1 + 8} y={Y(0.34)} width={10} height={h * 0.62} rx={3} fill="#334155" {...line} />
      <rect x={x2 - 18} y={Y(0.34)} width={10} height={h * 0.62} rx={3} fill="#334155" {...line} />
      {/* tấm chắn trước bàn + mặt bàn + cạnh trước */}
      <rect x={x1 + 14} y={Y(0.36)} width={x2 - x1 - 28} height={h * 0.26} fill="#3b4c80" {...line} />
      <rect x={x1 + 14} y={Y(0.36) + h * 0.2} width={x2 - x1 - 28} height={h * 0.06} fill="#22d3ee" opacity={0.5} />
      <polygon points={`${x1 + 8},${r.y} ${x2 - 8},${r.y} ${x2},${Y(0.28)} ${x1},${Y(0.28)}`} fill="#d9b88a" {...line} />
      <polygon points={`${x1 + 14},${r.y + 3} ${x2 - 14},${r.y + 3} ${x2 - 10},${Y(0.1)} ${x1 + 10},${Y(0.1)}`} fill="#fff" opacity={0.12} />
      <rect x={x1} y={Y(0.28)} width={x2 - x1} height={h * 0.08} rx={3} fill="#b8915f" {...line} />
      {/* ghế băng */}
      {legs.map((lx) => (
        <rect key={lx} x={lx - 4} y={Y(0.74)} width={8} height={h * 0.24} rx={2} fill="#1e293b" />
      ))}
      <rect x={x1 + 16} y={Y(0.6)} width={x2 - x1 - 32} height={h * 0.1} rx={6} fill="#c9a274" {...line} />
      <rect x={x1 + 16} y={Y(0.7)} width={x2 - x1 - 32} height={h * 0.06} rx={3} fill="#9c7a52" {...line} />
    </svg>
  );
}

function Students({ v, now }: { v: StageView; now: number }) {
  const asking = v.phase === 'question' || v.phase === 'bonus';
  const first = asking ? v.correctTop[0]?.username : undefined;
  return (
    <>
      {ROWS.map((_, ri) => (
        <LongDesk key={ri} ri={ri} />
      ))}
      {v.seats.map((s, i) => {
        const { scale, w, h, show, x, y, ri, k, gap } = seatBox(i);
        // bảng tên so le: bạn thứ 2, 4, 6... trong dãy tên thấp xuống 1 tầng, nên 2 tên cùng tầng cách nhau 2 ghế, hiện đủ tên dài hơn
        const low = k % 2 === 1;
        const pose = studentPose(s, v, i, now);
        const g = s.girl ? 'nu' : 'nam';
        const hd = HEAD[g];
        const called = v.recess?.game === 'callup' && v.recess.callUser === s.username;
        // đang lên bục (tặng hoa / bị phạt): ghế trống, nhân vật vẽ ở chỗ khác
        const away = s.standing || v.walk?.username === s.username;
        return (
          <motion.div
            key={s.username}
            initial={{ opacity: 0, left: x, top: y + 40 }}
            // bạn đúng đầu tiên: nhảy lên vui mừng
            animate={{ opacity: away ? 0 : 1, left: x, top: s.username === first ? [y, y - 34, y, y - 18, y] : y }}
            transition={s.username === first ? { top: { duration: 0.9 } } : { type: 'spring', stiffness: 120, damping: 18 }}
            className={`absolute ${called ? 'called-up' : ''}`}
            style={{ width: w, height: show, zIndex: 10 + ri }}
          >
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute left-0 top-0" style={{ width: w, height: h }}>
                <KidBack pose={pose} girl={s.girl} />
              </div>
              <div className="absolute" style={{ left: hd.x * w, top: hd.y * h, width: hd.w * w, height: hd.h * h }}>
                <Hair username={s.username} girl={s.girl} />
              </div>
            </div>
            {s.answered === 'right' && <div className="badge bg-[#16a34a]">✓</div>}
            {s.answered === 'right' && s.gain > 0 && (
              <motion.div
                key={`gain${v.qNo}`}
                initial={{ y: 0, opacity: 1, scale: 0.6 }}
                animate={{ y: -90, opacity: [1, 1, 0], scale: 1.2 }}
                transition={{ duration: 1.8, ease: 'easeOut' }}
                className="pointer-events-none absolute left-1/2 top-0 z-40 -translate-x-1/2 whitespace-nowrap font-extrabold text-[#fde047] [text-shadow:0_2px_0_#7a2e0e,0_0_6px_#000]"
                style={{ fontSize: 34 * scale }}
              >
                +{s.gain}
              </motion.div>
            )}
            {s.answered === 'wrong' && <div className="badge bg-[#dc2626]">✗</div>}
            <DeskGifts desk={s.desk} x={x} y={y} w={w} show={show} scale={scale} />
            {s.sleeping && !s.bubble && (
              <motion.div
                animate={{ y: [0, -14, 0], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                className="pointer-events-none absolute -top-[46px] right-0 text-[34px]"
                style={{ fontSize: 34 * scale }}
              >
                💤
              </motion.div>
            )}
            {s.bubble && <ChatBubble text={s.bubble} scale={scale} />}
            <div className="nametag" style={{ fontSize: 19 * scale, maxWidth: 2 * gap - 8, bottom: low ? `calc(100% - ${4 + 27 * scale}px)` : undefined, zIndex: low ? 2 : 1 }}>
              {s.team > 0 && (
                <span className="mr-1 shrink-0 rounded-full px-[5px] font-extrabold text-white" style={{ background: TEAM_COLOR[s.team - 1] }}>
                  {s.team}
                </span>
              )}
              {i < 5 && s.score > 0 && <span className="rank">{i + 1}</span>}
              {s.title && <span className="mr-1">{s.title === 'lop-truong' ? '👑' : '⭐'}</span>}
              {s.showIcons && <span className="mr-1 whitespace-nowrap">{s.showIcons}</span>}
              {called && <span className="mr-1">📢</span>}
              {s.days >= 2 && <span className="mr-1 whitespace-nowrap">🎒{s.days}</span>}
              {/* học bạ: lớp mấy (lớp 1 thì khỏi hiện cho gọn), tốt nghiệp đội mũ */}
              {s.grade >= 2 && (
                <span className="mr-1 shrink-0 rounded-full bg-[#2563eb] px-[5px] font-extrabold text-white">{s.grade > 12 ? '🎓' : `L${s.grade}`}</span>
              )}
              <span className="truncate">{s.nickname}</span>
              {s.score > 0 && <b className="ml-1 text-[#c2410c]">{s.score}</b>}
            </div>
          </motion.div>
        );
      })}
    </>
  );
}

// Bong bóng chat trên đầu (đã lọc: không có câu trả lời, không có từ cấm)
function ChatBubble({ text, scale }: { text: string; scale: number }) {
  return (
    <motion.div
      key={text}
      initial={{ opacity: 0, y: 10, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="pointer-events-none absolute bottom-[calc(100%+30px)] left-1/2 z-30 max-w-[200px] -translate-x-1/2 truncate rounded-[16px] bg-white px-3 py-1 font-semibold text-[#3b2a14] shadow-md"
      style={{ fontSize: 18 * scale }}
    >
      {text}
      <div className="absolute -bottom-[7px] left-1/2 h-[14px] w-[14px] -translate-x-1/2 rotate-45 bg-white" />
    </motion.div>
  );
}

// Tặng hoa: bạn nhỏ đứng dậy đi lên bục đưa hoa cho cô, rồi đi về chỗ (bạn không có ghế thì đi từ cửa lớp)
const PODIUM: [number, number] = [372, 690]; // chỗ đứng đưa hoa, cạnh tay cô (toạ độ góc trên trái nhân vật)
function FlowerWalk({ v }: { v: StageView }) {
  const w = v.walk;
  if (!w) return null;
  const i = v.seats.findIndex((s) => s.username === w.username);
  const H = 210;
  const from: [number, number] = i >= 0 ? [seatBox(i).x, seatBox(i).y - 40] : [990, 760];
  return (
    <motion.div
      key={w.at}
      initial={{ left: from[0], top: from[1], opacity: 0 }}
      animate={{ left: [from[0], PODIUM[0], PODIUM[0], from[0]], top: [from[1], PODIUM[1], PODIUM[1], from[1]], opacity: [1, 1, 1, 0] }}
      transition={{ duration: GAME.walkMs / 1000, times: [0, 0.35, 0.65, 1], ease: 'easeInOut' }}
      className="pointer-events-none absolute z-30"
      style={{ width: H * 0.47, height: H }}
    >
      <KidFront username={w.username} girl={w.girl} pose="vui" />
      {/* bó hoa to nhỏ theo bậc quà */}
      <div className="absolute -right-4 top-[70px] leading-none" style={{ fontSize: 40 * GAME.giftTiers[w.tier].size }}>
        {w.icon}
      </div>
      <div className="nametag" style={{ fontSize: 16, bottom: 'calc(100% - 4px)' }}>
        <span className="truncate">{w.nickname}</span>
      </div>
    </motion.div>
  );
}

// Học sinh cá biệt: bị cô phạt đứng cạnh bảng (bên phải), đeo bảng tên đỏ
// gõ sai: đứng phạt 3 câu ở khoảng sàn trống giữa cô giáo và dãy bàn đầu (chủ kênh khoanh chỗ, 2026-11-05),
// xếp 1 hàng từ cạnh cô sang phải. Hình phạt (chủ kênh chốt): giơ tay đứng phạt, nhún lên xuống
const STAND_SPOTS = [420, 492, 564, 636, 708, 780];
const STAND_FEET = 880;
function Punished({ v }: { v: StageView }) {
  return (
    <>
      {v.punished.slice(0, STAND_SPOTS.length).map((s, i) => {
        const H = 120;
        return (
          <motion.div
            key={s.username}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute z-30"
            style={{ left: STAND_SPOTS[i] - (H * 0.47) / 2, top: STAND_FEET - H, width: H * 0.47, height: H }}
          >
            <motion.div
              animate={{ y: [0, 10, 0], scaleY: [1, 0.94, 1] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
              style={{ transformOrigin: 'bottom center' }}
              className="h-full w-full"
            >
              <KidFront username={s.username} girl={s.girl} pose="tay" />
            </motion.div>
            {/* chỉ hiện tên bạn đang đứng (chủ kênh bỏ chữ "Gõ sai · còn N câu", 2026-11-05) */}
            <div className="nametag" style={{ fontSize: 15, maxWidth: 76 }}>
              <span className="truncate">{s.nickname}</span>
            </div>
          </motion.div>
        );
      })}
    </>
  );
}

// Bình hoa trên bàn cô: hoa các bạn tặng cắm vào, càng nhiều hoa càng đầy bình
const VASE_SPOTS: [number, number][] = [
  [0, 0], [-22, 8], [22, 8], [-12, -18], [12, -18], [0, -30], [-30, -10], [30, -10], [-20, -36], [20, -36], [-36, 14], [36, 14],
];
function Vase({ v }: { v: StageView }) {
  const n = Math.min(v.flowers, VASE_SPOTS.length);
  return (
    <div className="pointer-events-none absolute left-[150px] top-[585px] z-[9]">
      {VASE_SPOTS.slice(0, n).map(([dx, dy], i) => (
        <motion.div
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i === n - 1 ? GAME.walkMs / 2000 : 0, type: 'spring' }}
          className="absolute text-[30px]"
          style={{ left: dx, top: dy }}
        >
          {['🌸', '🌷', '🌹', '🌼'][i % 4]}
        </motion.div>
      ))}
    </div>
  );
}

// Quà cô thưởng: bay từ tay cô giáo xuống, đặt lên mặt bàn 2 bên người bạn nhỏ
const TEACHER_HAND: [number, number] = [300, 640]; // px stage
function DeskGifts({ desk, x, y, w, show, scale }: { desk: StageView['seats'][number]['desk']; x: number; y: number; w: number; show: number; scale: number }) {
  const size = 34 * scale;
  const deskTop = show - 72 * K + 44 * scale; // mặt bàn: mép trên bàn (ROWS.y) lùi xuống, tính trong khung học sinh
  // chỗ trống trên mặt bàn 2 bên đầu bạn nhỏ (lệch so với tâm bàn): trái, phải, trái ngoài, phải ngoài
  const SPOTS = [-40, 40, -58, 58];
  return (
    <>
      {desk.map((g, i) => {
        const left = w / 2 + SPOTS[i % SPOTS.length] * scale - size / 2;
        const top = deskTop - size + (i >= 2 ? 3 : 0) * scale;
        return (
          <motion.div
            key={g.at + g.icon}
            // quà cũ (mở lại trang, đổi chỗ ngồi) thì nằm sẵn trên bàn, không bay lại
            initial={Date.now() - g.at < 2000 ? { x: TEACHER_HAND[0] - (x + left), y: TEACHER_HAND[1] - (y + top), scale: 2.2, rotate: -30, opacity: 0 } : false}
            animate={{ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
            transition={{ duration: 1.1, ease: [0.3, 1.4, 0.5, 1], opacity: { duration: 0.2 } }}
            className="pointer-events-none absolute drop-shadow-[0_4px_2px_rgba(0,0,0,0.35)]"
            style={{ left, top, fontSize: size, lineHeight: 1, zIndex: 5 }}
          >
            {g.icon}
          </motion.div>
        );
      })}
    </>
  );
}

// Bên phải, trên hàng ghế đầu: top tương tác hôm nay (cách tính không hiện ra màn hình)
function TalkTop({ v }: { v: StageView }) {
  const rows = (v.talkTop ?? []).slice(0, 5);
  return (
    <div className="glass absolute left-[842px] top-[640px] z-[8] w-[232px] px-3 pb-2 pt-2">
      <div className="panel-title text-[16px]" style={{ ['--dot' as string]: '#38bdf8' }}>Top tương tác</div>
      {rows.length === 0 && <div className="py-2 text-center text-[17px] text-[#a5b4fc]">Bình luận để lên bảng nha!</div>}
      <div className="mt-[6px] space-y-[4px]">
        {rows.map((r, i) => (
          <motion.div key={r.username} layout className="flex items-center gap-2 text-[21px] leading-[27px]">
            <Rank i={i} size={24} />
            <span className="min-w-0 flex-1 truncate font-semibold">{r.nickname}</span>
            {/* hiện điểm tương tác, không ghi cách tính (chủ kênh đổi 2026-11-04) */}
            <b className="tabular-nums text-[#7dd3fc]">{r.points}</b>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Bảng khẩu hiệu đỏ trên bảng đen
function Motto() {
  return (
    <div className="motto absolute left-1/2 top-[172px] -translate-x-1/2 whitespace-nowrap px-10 py-[5px] text-[36px] font-extrabold tracking-wide">
      NGHE HẾT ĐỀ – GÕ MỚI ĂN ĐIỂM
    </div>
  );
}

function GiftBanner({ gift, now }: { gift: GameState['lastGift']; now: number }) {
  const show = gift && now - gift.at < 4000;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={gift.at}
          initial={{ opacity: 0, y: -30, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          className="absolute left-[24px] top-[470px] z-50 max-w-[560px] rounded-full border-2 border-white/70 bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] px-6 py-3 text-[30px] font-bold text-white shadow-[0_14px_40px_rgba(236,72,153,0.5)]"
        >
          {giftOf(gift.giftName)?.icon ?? '💐'} <span className="inline-block max-w-[300px] truncate align-bottom">{gift.nickname}</span> tặng cô {gift.repeatCount > 1 ? `${gift.repeatCount} × ` : ''}
          {giftOf(gift.giftName)?.say ?? gift.giftName}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// "Ai yêu cô thì gõ số 1": mỗi bạn gõ là một trái tim bay lên cạnh cô, kèm số đếm
function LoveHearts({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <div className="pointer-events-none absolute left-[60px] top-[330px] z-40 h-[520px] w-[340px]">
      {Array.from({ length: Math.min(n, 30) }, (_, i) => (
        <motion.div
          key={i}
          initial={{ y: 480, opacity: 0, scale: 0.6 }}
          animate={{ y: -20, opacity: [0, 1, 0], scale: 1.2 }}
          transition={{ duration: 2.4, delay: (i % 6) * 0.15, repeat: Infinity, repeatDelay: 0.4 }}
          className="absolute text-[54px]"
          style={{ left: ((i * 67) % 280) + 10 }}
        >
          {i % 3 === 0 ? '💕' : '❤️'}
        </motion.div>
      ))}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-white/70 bg-gradient-to-r from-[#ec4899] to-[#f43f5e] px-5 py-1 text-[30px] font-bold text-white shadow-[0_10px_30px_rgba(236,72,153,0.5)]">
        💕 {n} bạn yêu cô
      </div>
    </div>
  );
}

// Bình chọn vui ("miền Bắc gõ B..."): thẻ đếm phiếu cạnh cô trong 15 giây
function PollCard({ v }: { v: StageView }) {
  return (
    <AnimatePresence>
      {v.poll && (
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          className="glass absolute left-[16px] top-[640px] z-40 w-[330px] px-4 py-3"
        >
          <div className="panel-title justify-center text-[18px] text-white" style={{ ['--dot' as string]: '#38bdf8' }}>Gõ chữ để chọn nha!</div>
          {v.poll.map((o) => (
            <div key={o.key} className="flex items-center gap-2 text-[24px] leading-[34px]">
              <b className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gradient-to-br from-[#38bdf8] to-[#6366f1] text-white">{o.key.toUpperCase()}</b>
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              <b>{o.n}</b>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Chúc mừng sinh nhật: biểu ngữ trên đầu lớp, bánh kem đã đặt lên bàn bạn nhỏ
function BirthdayBanner({ v }: { v: StageView }) {
  return (
    <AnimatePresence>
      {v.birthday && (
        <motion.div
          key={v.birthday.at}
          initial={{ opacity: 0, y: -40, scale: 0.7 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          className="absolute left-1/2 top-[620px] z-50 w-[900px] -translate-x-1/2 rounded-[32px] border-2 border-white/70 shadow-[0_20px_60px_rgba(236,72,153,0.45)] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-400 px-6 py-4 text-center font-extrabold text-white shadow-2xl"
        >
          <div className="text-[46px] leading-tight">🎉 Chúc mừng sinh nhật 🎂</div>
          <div className="mt-1 truncate text-[54px] leading-tight drop-shadow">{v.birthday.nickname}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Nút "Chào tạm biệt" ở trang điều khiển (chủ kênh bấm trước khi xuống live): biểu ngữ tan lớp
function GoodbyeBanner({ v }: { v: StageView }) {
  return (
    <AnimatePresence>
      {v.goodbye && (
        <motion.div
          key={v.goodbye.at}
          initial={{ opacity: 0, y: -40, scale: 0.7 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          className="absolute left-1/2 top-[620px] z-50 w-[900px] -translate-x-1/2 rounded-[32px] border-2 border-white/70 shadow-[0_20px_60px_rgba(236,72,153,0.45)] bg-gradient-to-r from-sky-500 via-indigo-500 to-pink-500 px-6 py-4 text-center font-extrabold text-white shadow-2xl"
        >
          <motion.div animate={{ rotate: [-12, 12, -12] }} transition={{ duration: 1, repeat: Infinity }} className="inline-block text-[64px] leading-none">
            👋
          </motion.div>
          <div className="mt-1 whitespace-nowrap text-[44px] leading-tight drop-shadow">Tan lớp rồi! Hẹn gặp lại cả lớp nha 💕</div>
          <div className="mt-2 text-[30px] font-bold leading-tight">Nhớ theo dõi kênh để không lỡ buổi học sau</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Claps() {
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {Array.from({ length: 14 }, (_, i) => (
        <motion.div
          key={i}
          initial={{ y: 1500, opacity: 0 }}
          animate={{ y: 700, opacity: [0, 1, 0] }}
          transition={{ duration: 2.2, delay: (i % 7) * 0.25, repeat: Infinity }}
          className="absolute text-[70px]"
          style={{ left: 60 + i * 70 }}
        >
          👏
        </motion.div>
      ))}
    </div>
  );
}
