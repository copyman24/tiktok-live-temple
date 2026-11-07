/**
 * The classroom, drawn in SVG at stage size (1080×1920). Replaces public/assets/bg/lop.webp but keeps its layout:
 * the board, the teacher's desk, the floor line and the desk rows sit where the panels and seats expect them.
 */
import { memo, type ReactElement } from 'react';

const W = 1080;
const H = 1920;
const FLOOR = 757;
const VP = [540, 300] as const; // vanishing point of the floor planks

function Planks() {
  const lines: ReactElement[] = [];
  // boards running towards the board wall
  for (let i = -14; i <= 14; i++) {
    const xb = 540 + i * 92;
    const t = (FLOOR - VP[1]) / (H - VP[1]);
    const xt = VP[0] + (xb - VP[0]) * t;
    lines.push(<line key={`v${i}`} x1={xt} y1={FLOOR} x2={xb} y2={H} />);
  }
  // board ends, spaced wider towards the camera
  let y = FLOOR + 22;
  let k = 0;
  while (y < H) {
    const t = (y - VP[1]) / (H - VP[1]);
    const step = 92 * t;
    const off = (k % 2) * step * 2.2;
    for (let x = -off; x < W; x += step * 4.4) {
      lines.push(<line key={`h${k}-${x}`} x1={x} y1={y} x2={x + step * 2.6} y2={y} />);
    }
    y += 26 + 70 * t;
    k++;
  }
  return <g stroke="#7a4524" strokeOpacity="0.28" strokeWidth="2">{lines}</g>;
}

function Window({ x, flip }: { x: number; flip?: boolean }) {
  const w = 120;
  return (
    <g transform={flip ? `translate(${x + w} 0) scale(-1 1)` : `translate(${x} 0)`}>
      <rect x="0" y="92" width={w} height={FLOOR - 92 + 30} fill="url(#sky)" />
      {/* city + trees outside */}
      <path d="M0 560 L0 470 L26 470 L26 430 L54 430 L54 500 L80 500 L80 452 L104 452 L104 520 L120 520 L120 560 Z" fill="#3b2f6b" opacity="0.75" />
      {[[20, 520], [70, 540], [110, 510]].map(([cx, cy]) => (
        <g key={cx}>
          <circle cx={cx} cy={cy} r="34" fill="#2f5d50" />
          <circle cx={cx + 14} cy={cy - 18} r="24" fill="#3c7564" />
        </g>
      ))}
      <rect x="0" y="560" width={w} height={FLOOR - 560 + 30} fill="#244a40" />
      {/* frame + mullions */}
      <g fill="none" stroke="#0b1022" strokeWidth="10">
        <rect x="0" y="92" width={w} height={FLOOR - 92 + 30} />
        <line x1="0" y1="330" x2={w} y2="330" />
        <line x1={w / 2} y1="92" x2={w / 2} y2={FLOOR + 30} />
      </g>
      <rect x={w - 8} y="88" width="14" height={FLOOR - 70} fill="#0f172a" />
      <path d={`M14 110 L44 110 L10 300 Z`} fill="#fff" opacity="0.08" />
    </g>
  );
}

export const Classroom = memo(function Classroom() {
  return (
    <svg className="pointer-events-none absolute left-0 top-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#151b36" />
          <stop offset="1" stopColor="#262f57" />
        </linearGradient>
        <radialGradient id="halo" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#7c6cff" stopOpacity="0.38" />
          <stop offset="1" stopColor="#7c6cff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d5cff" />
          <stop offset="0.45" stopColor="#ff7eb3" />
          <stop offset="0.8" stopColor="#ffb88c" />
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9794a" />
          <stop offset="0.35" stopColor="#cf9462" />
          <stop offset="1" stopColor="#a8673c" />
        </linearGradient>
        <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe7a8" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffe7a8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="board" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#123c3a" />
          <stop offset="1" stopColor="#0b2828" />
        </linearGradient>
        <linearGradient id="rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.5" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#f472b6" />
        </linearGradient>
        <linearGradient id="sun" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffd9a8" stopOpacity="0.32" />
          <stop offset="1" stopColor="#ffd9a8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="vignette" cx="0.5" cy="0.35" r="0.85">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0 L0 0 0 40" fill="none" stroke="#9ff5e6" strokeOpacity="0.05" strokeWidth="1.5" />
        </pattern>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      {/* wall + ceiling */}
      <rect width={W} height={FLOOR} fill="url(#wall)" />
      <rect width={W} height="96" fill="#0d1229" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <rect key={i} x={136 + i * 100} y="104" width="4" height={FLOOR - 220} fill="#ffffff" opacity="0.025" />
      ))}
      <rect y="640" width={W} height={FLOOR - 640} fill="#2e386a" />
      <rect y="636" width={W} height="8" fill="#3d4884" />
      <ellipse cx="540" cy="440" rx="560" ry="330" fill="url(#halo)" />

      {/* floor */}
      <rect y={FLOOR} width={W} height={H - FLOOR} fill="url(#floor)" />
      <Planks />
      <path d={`M120 ${FLOOR} L360 ${FLOOR} L120 1500 L0 1700 L0 ${FLOOR} Z`} fill="url(#sun)" />
      <rect y={FLOOR} width={W} height="14" fill="#1b2142" opacity="0.5" />

      <Window x={0} />
      <Window x={W - 120} flip />
      {/* warm LED strip along the ceiling edge, light falling on the wall */}
      <path d={`M120 96 L960 96 L1060 ${FLOOR} L20 ${FLOOR} Z`} fill="url(#cone)" />
      <rect x="120" y="92" width="840" height="6" rx="3" fill="#ffe7a8" filter="url(#glow)" />
      <rect x="120" y="93" width="840" height="3" rx="1.5" fill="#fff4d6" />

      {/* smart board */}
      <rect x="150" y="226" width="780" height="416" rx="24" fill="#070b18" />
      <rect x="150" y="226" width="780" height="416" rx="24" fill="none" stroke="url(#rim)" strokeWidth="6" filter="url(#glow)" opacity="0.8" />
      <rect x="150" y="226" width="780" height="416" rx="24" fill="none" stroke="url(#rim)" strokeWidth="3" />
      <rect x="166" y="242" width="748" height="384" rx="14" fill="url(#board)" />
      <rect x="166" y="242" width="748" height="384" rx="14" fill="url(#grid)" />
      <path d="M166 242 L520 242 L330 626 L166 626 Z" fill="#fff" opacity="0.025" />
      <rect x="200" y="642" width="680" height="10" rx="5" fill="#cbd5e1" />
      <rect x="610" y="634" width="46" height="9" rx="4" fill="#f472b6" />
      <rect x="664" y="634" width="46" height="9" rx="4" fill="#38bdf8" />

      {/* teacher's desk with a glass vase (flowers from viewers grow in it) and books */}
      <ellipse cx="202" cy="830" rx="112" ry="12" fill="#000" opacity="0.22" />
      <rect x="120" y="698" width="164" height="128" rx="8" fill="#e8edf5" stroke="#0b1022" strokeWidth="3" />
      <rect x="120" y="742" width="164" height="12" fill="#22b3a6" />
      <rect x="106" y="682" width="192" height="20" rx="8" fill="#e9cfa6" stroke="#0b1022" strokeWidth="3" />
      <path d="M148 636 Q140 676 152 684 L176 684 Q188 676 180 636 Z" fill="#bfe9ff" fillOpacity="0.55" stroke="#0b1022" strokeWidth="2.5" />
      <path d="M150 660 Q148 676 154 682 L174 682 Q180 676 178 660 Z" fill="#7dd3fc" fillOpacity="0.5" />
      <g stroke="#0b1022" strokeWidth="2.5">
        <rect x="206" y="666" width="56" height="10" rx="2" fill="#f472b6" />
        <rect x="210" y="656" width="50" height="10" rx="2" fill="#38bdf8" />
        <rect x="204" y="646" width="54" height="10" rx="2" fill="#fbbf24" />
      </g>

      <rect width={W} height={H} fill="url(#vignette)" />
    </svg>
  );
});
