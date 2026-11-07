/**
 * Students, drawn in SVG (replaces the painted sprites). viewBox 47×100, the same proportions as the old sprites,
 * so seat sizes and the head box used by <Hair> (HEAD in GameStage) did not change.
 */
import { Arm, pivot, type Bend, type Pt } from './limb';
import { hairColor, hashName } from '../Hair';

const LINE = '#334155';
const SKIN = '#f6d2b6';
const SHIRT = '#f8fafc';
const SHIRT_SHADE = '#dbe3ee';
const SCARF = '#e11d48';
const NAVY = '#1e3a8a';

export type KidPose = 'dung' | 'tay' | 'nghi' | 'vui' | 'buon' | 'ngac' | 'chao';
type A = { at: Pt; bend?: Bend; anim?: string; hand?: 'open' | 'fist' };

// back view: shoulders at (10,37) and (37,37)
const DOWN_L: A = { at: [8, 66], bend: 'out' };
const DOWN_R: A = { at: [39, 66], bend: 'out' };
const BACK: Record<KidPose, { L: A; R: A; drop?: number }> = {
  dung: { L: DOWN_L, R: DOWN_R },
  tay: { L: DOWN_L, R: { at: [41, 3], bend: 'out' } },
  nghi: { L: DOWN_L, R: { at: [34, 12], bend: 'out' } },
  vui: { L: { at: [3, 8], bend: 'out', anim: 'kid-pump', hand: 'fist' }, R: { at: [44, 8], bend: 'out', anim: 'kid-pump', hand: 'fist' } },
  buon: { L: DOWN_L, R: DOWN_R, drop: 3 },
  ngac: { L: { at: [4, 22], bend: 'down' }, R: { at: [43, 22], bend: 'down' } },
  chao: { L: DOWN_L, R: { at: [43, 6], bend: 'down', anim: 'kid-wave' } },
};

const limb = (side: -1 | 1, a: A, s: Pt) => (
  <Arm s={s} target={a.at} bend={a.bend} side={side} upper={13} fore={12} width={7} lineW={1.1} sleeve={SHIRT} sleeveTo={0.15} skin={SKIN} line={LINE} hand={a.hand ?? 'open'} handR={3.4} anim={a.anim} />
);

/** Seen from behind, sitting at a desk (only the top half shows). The head comes from <Hair>. */
export function KidBack({ pose, girl }: { pose: KidPose; girl: boolean }) {
  const p = BACK[pose];
  return (
    <svg viewBox="0 0 47 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
      <g style={{ transform: `translateY(${p.drop ?? 0}px)`, transition: 'transform 400ms ease' }}>
        <rect x="19.5" y="22" width="8" height="12" rx="3" fill={SKIN} stroke={LINE} strokeWidth="1.2" />
        <path d="M3 46 C3 35 11 30.5 23.5 30.5 C36 30.5 44 35 44 46 L45 100 L2 100 Z" fill={SHIRT} stroke={LINE} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M23.5 36 L23.5 100" stroke={SHIRT_SHADE} strokeWidth="1.2" />
        <path d="M15 31.5 Q23.5 35 32 31.5 L23.5 46 Z" fill={SCARF} stroke={LINE} strokeWidth="1" strokeLinejoin="round" />
        {girl && <path d="M12 33 Q23.5 40 35 33" stroke={NAVY} strokeWidth="2" fill="none" />}
        {limb(-1, p.L, [10, 37])}
        {limb(1, p.R, [37, 37])}
      </g>
    </svg>
  );
}

/** Seen from the front, standing (walking up with flowers, or standing for a wrong answer). */
export function KidFront({ username, girl, pose }: { username: string; girl: boolean; pose: 'vui' | 'tay' }) {
  const hair = hairColor(username);
  const h = hashName(username);
  const ribbon = ['#ec4899', '#f59e0b', '#22c55e', '#3b82f6'][(h >> 3) % 4];
  const arms = pose === 'tay'
    ? { L: { at: [7, 2], bend: 'out' } as A, R: { at: [40, 2], bend: 'out' } as A }
    : { L: { at: [8, 62], bend: 'out' } as A, R: { at: [45, 42], bend: 'down' } as A };
  return (
    <svg viewBox="0 0 47 100" className="h-full w-full overflow-visible">
      <ellipse cx="23.5" cy="98.5" rx="14" ry="2" fill="#000" opacity="0.2" />
      <g stroke={LINE} strokeWidth="1.3" strokeLinejoin="round">
        <rect x="15" y="72" width="6" height="22" rx="2.5" fill={SKIN} />
        <rect x="26" y="72" width="6" height="22" rx="2.5" fill={SKIN} />
        <path d="M13 95 Q18 91 22 95 L22 98 L13 98 Z M25 95 Q29 91 34 95 L34 98 L25 98 Z" fill="#1f2937" />
        {girl
          ? <path d="M13 60 L34 60 L38 76 L9 76 Z" fill={NAVY} />
          : <path d="M13 60 L34 60 L35 75 L25 75 L23.5 68 L22 75 L12 75 Z" fill={NAVY} />}
        <path d="M11 38 C11 31 16 29 23.5 29 C31 29 36 31 36 38 L35 62 L12 62 Z" fill={SHIRT} />
        <path d="M17 30 L23.5 44 L30 30 Z" fill={SCARF} />
        <circle cx="23.5" cy="16" r="12" fill={SKIN} />
        {/* front hair: a cap with a fringe, plus pigtails for girls */}
        {girl && <><circle cx="10" cy="16" r="4.5" fill={hair} /><circle cx="37" cy="16" r="4.5" fill={hair} /></>}
        <path d="M11.5 17 C10 6 17 3 23.5 3 C30 3 37 6 35.5 17 C33 12 29 10 26 9 C22 13 16 14 11.5 17 Z" fill={hair} />
        {girl && <circle cx="33" cy="7" r="2.6" fill={ribbon} />}
      </g>
      <circle cx="19" cy="18" r="1.4" fill="#1f2937" />
      <circle cx="28" cy="18" r="1.4" fill="#1f2937" />
      <path d={pose === 'tay' ? 'M21 23.5 Q23.5 22 26 23.5' : 'M20.5 22 Q23.5 25.5 26.5 22'} stroke="#1f2937" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <ellipse cx="16" cy="21.5" rx="2.2" ry="1.3" fill="#f49aa0" opacity="0.6" />
      <ellipse cx="31" cy="21.5" rx="2.2" ry="1.3" fill="#f49aa0" opacity="0.6" />
      <g style={pivot([23.5, 50])}>
        {limb(-1, arms.L, [13, 34])}
        {limb(1, arms.R, [34, 34])}
      </g>
    </svg>
  );
}
