/**
 * Cô Ngân, drawn in SVG (replaces the painted sprites). viewBox 320×490, feet on the bottom edge.
 * Poses keep the old sprite names (01-dung … 16-chi-trai, everest/…, chuong/…) so the stage logic did not change.
 */
import type { ReactNode } from 'react';
import { Arm, pivot, type Bend, type HandKind, type Pt } from './limb';

const LINE = '#3a2a2c';
const SKIN = '#f8d6bf';
const SKIN_SHADE = '#ecb99c';
const HAIR = '#2a1b19';
const HAIR_HI = '#4b312b';
const LIP = '#c2475a';

type Outfit = {
  kind: 'aodai' | 'shirt' | 'jacket';
  main: string; shade: string; trim: string; pants: string; pantsShade: string; shoe: string; motif?: string; hat?: string;
};
const OUTFITS: Record<string, Outfit> = {
  trang: { kind: 'aodai', main: '#fbfaf6', shade: '#e4dfd5', trim: '#d4a85a', pants: '#ffffff', pantsShade: '#e7e3da', shoe: '#7a4b33', motif: '#e2bf7a' },
  'ao-dai-xanh-ngoc': { kind: 'aodai', main: '#25b3a5', shade: '#168478', trim: '#f6d27a', pants: '#f7f4ee', pantsShade: '#e2ddd2', shoe: '#5b3a29', motif: '#a7eee4' },
  'so-mi': { kind: 'shirt', main: '#e4eeff', shade: '#bfd2f2', trim: '#5b7fd0', pants: '#27324f', pantsShade: '#1b2440', shoe: '#1f2937' },
  everest: { kind: 'jacket', main: '#f97316', shade: '#c2410c', trim: '#fde68a', pants: '#334155', pantsShade: '#1e293b', shoe: '#3f2a1d', hat: '#0ea5e9' },
  chuong: { kind: 'aodai', main: '#d42a2a', shade: '#9f1b1b', trim: '#fbbf24', pants: '#fff7e6', pantsShade: '#efdfbd', shoe: '#7a4b33', motif: '#fcd34d' },
};

type Eyes = 'open' | 'happy' | 'closed' | 'wide' | 'wink' | 'up' | 'lookR' | 'lookL';
type Mouth = 'smile' | 'talk' | 'laugh' | 'o' | 'flat' | 'smirk';
type ArmPose = { at: Pt; bend?: Bend; hand?: HandKind; anim?: string };
type Prop = 'bell' | 'flag' | 'map' | null;
type Pose = { L: ArmPose; R: ArmPose; eyes: Eyes; mouth: Mouth; brows?: 'up' | 'tilt'; tilt?: number; blush?: boolean; prop?: Prop; ring?: boolean };

// hand targets in viewBox space; shoulders sit at (126,166) and (194,166)
const restL: ArmPose = { at: [110, 282], bend: 'out' };
const restR: ArmPose = { at: [210, 282], bend: 'out' };
const pose = (p: Partial<Pose>): Pose => ({ L: restL, R: restR, eyes: 'open', mouth: 'smile', ...p });

const BASE: Record<string, Pose> = {
  stand: pose({}),
  present: pose({ R: { at: [250, 232], bend: 'down' }, mouth: 'talk', tilt: 3 }),
  pointR: pose({ R: { at: [298, 138], bend: 'down', hand: 'point' }, eyes: 'lookR', tilt: 5 }),
  pointUp: pose({ R: { at: [262, 52], bend: 'down', hand: 'point' }, eyes: 'up', mouth: 'talk', tilt: 4 }),
  pointL: pose({ L: { at: [22, 138], bend: 'down', hand: 'point' }, eyes: 'lookL', tilt: -5 }),
  wave: pose({ R: { at: [240, 74], bend: 'down', anim: 'tw-wave' }, eyes: 'happy', mouth: 'talk', tilt: 4 }),
  welcome: pose({ L: { at: [44, 196], bend: 'down' }, R: { at: [276, 196], bend: 'down' }, eyes: 'happy', mouth: 'laugh' }),
  laugh: pose({ R: { at: [176, 124], bend: 'out' }, eyes: 'closed', mouth: 'smile', blush: true, tilt: -4 }),
  heart: pose({ L: { at: [154, 204], bend: 'out' }, R: { at: [166, 204], bend: 'out' }, eyes: 'happy', mouth: 'smile', blush: true, tilt: -3 }),
  thumbs: pose({ R: { at: [236, 186], bend: 'down', hand: 'thumb' }, eyes: 'wink', mouth: 'laugh' }),
  cheer: pose({ L: { at: [78, 52], bend: 'out', hand: 'fist', anim: 'tw-pump' }, R: { at: [242, 52], bend: 'out', hand: 'fist', anim: 'tw-pump' }, eyes: 'happy', mouth: 'laugh' }),
  clap: pose({ L: { at: [154, 210], bend: 'down', anim: 'tw-clapL' }, R: { at: [166, 210], bend: 'down', anim: 'tw-clapR' }, eyes: 'happy', mouth: 'laugh' }),
  shrug: pose({ L: { at: [72, 212], bend: 'down' }, R: { at: [248, 212], bend: 'down' }, eyes: 'open', mouth: 'flat', brows: 'up', tilt: -4 }),
  think: pose({ R: { at: [200, 66], bend: 'out' }, eyes: 'up', mouth: 'flat', brows: 'tilt', tilt: 5 }),
  surprised: pose({ L: { at: [128, 116], bend: 'out' }, R: { at: [192, 116], bend: 'out' }, eyes: 'wide', mouth: 'o', brows: 'up' }),
  finger: pose({ R: { at: [226, 118], bend: 'down', hand: 'point' }, eyes: 'wink', mouth: 'smirk', tilt: 3 }),
  hips: pose({ L: { at: [136, 254], bend: 'out' }, R: { at: [184, 254], bend: 'out' }, eyes: 'open', mouth: 'smirk' }),
  fist: pose({ R: { at: [228, 122], bend: 'down', hand: 'fist', anim: 'tw-pump' }, eyes: 'happy', mouth: 'talk' }),
  map: pose({ L: { at: [134, 228], bend: 'out' }, R: { at: [186, 228], bend: 'out' }, eyes: 'lookR', mouth: 'flat', prop: 'map', tilt: 4 }),
  flag: pose({ R: { at: [238, 118], bend: 'down', hand: 'fist' }, L: { at: [136, 254], bend: 'out' }, eyes: 'happy', mouth: 'laugh', prop: 'flag' }),
};

// the original 16 poses of the white/shirt/turquoise outfits
const NAMES: Record<string, keyof typeof BASE> = {
  '01-dung': 'stand', '02-gioi-thieu': 'present', '03-chi-bang': 'pointR', '04-vay-chao': 'wave', '05-dang-tay': 'welcome',
  '06-cuoi': 'laugh', '07-tay-nguc': 'heart', '08-ngon-cai': 'thumbs', '09-mung': 'cheer', '10-vo-tay': 'clap',
  '11-nhun-vai': 'shrug', '12-gai-dau': 'think', '13-ngac-nhien': 'surprised', '14-ngon-tro': 'finger', '15-chong-hong': 'hips', '16-chi-trai': 'pointL',
};
const EVEREST: Record<string, keyof typeof BASE> = {
  '01-dung-san-sang': 'hips', '02-chi-len-dinh': 'pointUp', '03-chi-lo-trinh': 'pointR', '04-chao-doan-leo': 'welcome', '05-doc-ban-do': 'map',
  '06-suy-nghi': 'think', '07-like': 'thumbs', '08-co-vu': 'cheer', '09-bat-ngo': 'surprised', '10-cuoi-vui': 'laugh',
  '11-nhac-nho-an-toan': 'finger', '12-vay-chao': 'wave', '13-cam-co-dinh': 'flag', '14-dong-vien': 'fist', '15-vo-tay': 'clap', '16-tu-tin': 'hips',
};
// Rung Chuông Đồng: the bell is always in her right hand (viewer's right)
const bellReady: ArmPose = { at: [222, 212], bend: 'down', hand: 'fist' };
const bellSide: ArmPose = { at: [268, 168], bend: 'down', hand: 'fist' };
const bellHigh: ArmPose = { at: [240, 62], bend: 'down', hand: 'fist' };
const bell = (R: ArmPose, p: Partial<Pose> = {}): Pose => pose({ R, prop: 'bell', ...p });
const CHUONG: Record<string, Pose> = {
  '01-cam-chuong-san-sang': bell(bellReady),
  '02-rung-chuong-ben': bell(bellSide, { ring: true, eyes: 'happy', mouth: 'laugh' }),
  '03-rung-chuong-cao': bell(bellHigh, { ring: true, eyes: 'happy', mouth: 'laugh' }),
  '04-rung-chuong-hai-tay': bell({ at: [172, 58], bend: 'out', hand: 'fist' }, { L: { at: [150, 62], bend: 'out', hand: 'fist' }, ring: true, eyes: 'happy', mouth: 'laugh' }),
  '05-rung-chuong-nghieng-nguoi': bell(bellSide, { ring: true, tilt: 8, eyes: 'happy', mouth: 'talk' }),
  '06-rung-chuong-cuoi-tuoi': bell(bellReady, { eyes: 'closed', mouth: 'laugh', blush: true }),
  '07-rung-chuong-hao-hung': bell(bellHigh, { ring: true, L: { at: [78, 52], bend: 'out', hand: 'fist', anim: 'tw-pump' }, eyes: 'happy', mouth: 'laugh' }),
  '08-rung-chuong-nghiem-tuc': bell(bellReady, { mouth: 'flat' }),
  '09-bao-hieu-bat-dau': bell(bellHigh, { ring: true, mouth: 'talk' }),
  '10-mung-chien-thang': bell(bellHigh, { ring: true, L: { at: [78, 52], bend: 'out', hand: 'fist', anim: 'tw-pump' }, eyes: 'happy', mouth: 'laugh' }),
  '11-bat-ngo-nghe-chuong': bell(bellReady, { L: { at: [128, 116], bend: 'out' }, eyes: 'wide', mouth: 'o', brows: 'up' }),
  '12-moi-thi-sinh': bell(bellReady, { L: { at: [44, 196], bend: 'down' }, eyes: 'happy', mouth: 'talk' }),
  '13-vay-chao-cam-chuong': bell(bellReady, { L: { at: [80, 74], bend: 'down', anim: 'tw-waveL' }, eyes: 'happy', mouth: 'talk', tilt: -4 }),
  '14-tu-hao-gio-chuong': bell(bellSide, { L: { at: [136, 254], bend: 'out' }, mouth: 'smirk' }),
  '15-chuan-bi-rung': bell(bellSide, { mouth: 'flat', eyes: 'lookR' }),
  '16-nghi-thang-tran': bell(bellReady, { L: { at: [120, 66], bend: 'out' }, eyes: 'up', mouth: 'flat', brows: 'tilt' }),
};

function resolve(outfit: string, name: string): Pose {
  if (outfit === 'chuong') return CHUONG[name] ?? bell(bellReady);
  if (outfit === 'everest') return BASE[EVEREST[name] ?? 'hips'];
  return BASE[NAMES[name] ?? 'stand'];
}

export function Teacher({ outfit, pose: name }: { outfit: string; pose: string }) {
  const o = OUTFITS[outfit] ?? OUTFITS.trang;
  const p = resolve(outfit, name);
  const sleeveW = o.kind === 'jacket' ? 30 : 25;
  const arm = (side: -1 | 1, a: ArmPose, prop?: ReactNode) => (
    <Arm
      s={side < 0 ? [126, 166] : [194, 166]}
      target={a.at}
      bend={a.bend}
      side={side}
      upper={64}
      fore={58}
      width={sleeveW}
      sleeve={o.main}
      sleeveTo={o.kind === 'shirt' ? 0.7 : 1}
      skin={SKIN}
      line={LINE}
      hand={a.hand}
      handR={12}
      anim={a.anim}
      prop={prop}
    />
  );
  const propR = p.prop === 'bell' ? <Bell ring={!!p.ring} /> : p.prop === 'flag' ? <Flag /> : undefined;
  return (
    <svg viewBox="0 0 320 490" className="h-full w-full overflow-visible" aria-label="Cô Ngân">
      <ellipse cx="160" cy="480" rx="78" ry="9" fill="#000" opacity="0.22" />
      <g className="tw-breathe" style={pivot([160, 480])}>
        <Body o={o} />
        {p.prop === 'map' && <MapProp />}
        <g style={{ ...pivot([160, 140]), transform: `rotate(${p.tilt ?? 0}deg)`, transition: 'transform 500ms ease' }}>
          <Head p={p} o={o} />
        </g>
        {/* arms after the head: hands can cover the mouth, touch the cheeks, scratch the head */}
        {arm(-1, p.L)}
        {arm(1, p.R, propR)}
      </g>
    </svg>
  );
}

function Body({ o }: { o: Outfit }) {
  const neck = <path d="M150 120 L170 120 L171 152 L149 152 Z" fill={SKIN_SHADE} stroke={LINE} strokeWidth="2.5" />;
  if (o.kind === 'shirt') {
    return (
      <g stroke={LINE} strokeWidth="3" strokeLinejoin="round">
        <rect x="140" y="370" width="15" height="96" rx="6" fill={SKIN} />
        <rect x="165" y="370" width="15" height="96" rx="6" fill={SKIN} />
        <path d="M134 470 Q148 458 158 470 L158 478 L134 478 Z M162 470 Q172 458 186 470 L186 478 L162 478 Z" fill={o.shoe} />
        <path d="M134 250 L186 250 L194 392 Q160 400 126 392 Z" fill={o.pants} />
        <path d="M160 300 L160 394" stroke={o.pantsShade} strokeWidth="2.5" />
        {neck}
        <path d="M120 170 C120 158 140 150 160 150 C180 150 200 158 200 170 L193 214 C191 236 189 250 189 260 L131 260 C131 250 129 236 127 214 Z" fill={o.main} />
        <path d="M131 254 L189 254" stroke={o.pantsShade} strokeWidth="6" />
        <path d="M146 150 L160 172 L152 178 L140 156 Z M174 150 L160 172 L168 178 L180 156 Z" fill="#fff" strokeWidth="2.2" />
        {[188, 208, 228].map((y) => <circle key={y} cx="160" cy={y} r="2.2" fill={o.trim} strokeWidth="0" />)}
        {/* lanyard + staff card */}
        <path d="M148 154 L156 214 M172 154 L164 214" stroke={o.trim} strokeWidth="2.5" fill="none" />
        <rect x="149" y="212" width="22" height="28" rx="4" fill="#fff" strokeWidth="2.2" />
        <rect x="153" y="217" width="14" height="8" rx="2" fill={o.trim} strokeWidth="0" />
      </g>
    );
  }
  if (o.kind === 'jacket') {
    return (
      <g stroke={LINE} strokeWidth="3" strokeLinejoin="round">
        <path d="M128 286 L130 452 L158 452 L160 330 L162 452 L190 452 L192 286 Z" fill={o.pants} />
        <path d="M124 448 L160 448 L160 480 L120 480 Q118 462 124 448 Z M160 448 L196 448 Q202 462 200 480 L160 480 Z" fill={o.shoe} />
        {neck}
        <path d="M116 172 C116 156 138 148 160 148 C182 148 204 156 204 172 L202 298 Q160 312 118 298 Z" fill={o.main} />
        {[196, 232, 268].map((y) => <path key={y} d={`M119 ${y} Q160 ${y + 9} 201 ${y}`} stroke={o.shade} strokeWidth="2.5" fill="none" />)}
        <path d="M160 152 L160 304" stroke={o.trim} strokeWidth="3" />
        <path d="M138 148 Q160 162 182 148 L180 136 Q160 146 140 136 Z" fill={o.trim} />
      </g>
    );
  }
  // áo dài
  const motif = (x: number, y: number, s = 1) => (
    <g key={`${x}${y}`} transform={`translate(${x} ${y}) scale(${s})`} fill={o.motif} stroke="none">
      {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-5" rx="3" ry="5" transform={`rotate(${a})`} />)}
      <circle r="2.4" fill={o.trim} />
    </g>
  );
  return (
    <g stroke={LINE} strokeWidth="3" strokeLinejoin="round">
      <path d="M126 250 C120 320 115 390 110 446 Q160 456 210 446 C205 390 200 320 194 250 Z" fill={o.shade} />
      <path d="M134 298 L127 466 L158 466 L160 330 L162 466 L193 466 L186 298 Z" fill={o.pants} />
      <path d="M134 298 L130 466 M186 298 L190 466" stroke={o.pantsShade} strokeWidth="2" />
      <ellipse cx="143" cy="472" rx="17" ry="8" fill={o.shoe} />
      <ellipse cx="177" cy="472" rx="17" ry="8" fill={o.shoe} />
      {neck}
      <path d="M121 170 C121 158 140 148 160 148 C180 148 199 158 199 170 L193 214 C191 232 187 244 185 254 L135 254 C133 244 129 232 127 214 Z" fill={o.main} />
      <path d="M135 248 L185 248 C191 320 197 382 200 438 Q160 452 120 438 C123 382 129 320 135 248 Z" fill={o.main} />
      <path d="M140 262 C138 320 134 380 131 432" stroke={o.shade} strokeWidth="2" fill="none" opacity="0.8" />
      {motif(150, 318)}{motif(176, 362, 0.9)}{motif(146, 404, 1.1)}{motif(170, 214, 0.7)}
      {/* raglan seam and mandarin collar: the two lines that make it read as an áo dài */}
      <path d="M171 152 Q184 170 197 178" stroke={o.trim} strokeWidth="2.4" fill="none" />
      <path d="M147 126 L173 126 L174 150 Q160 155 146 150 Z" fill={o.main} />
      <path d="M147 131 L173 131" stroke={o.trim} strokeWidth="2" />
    </g>
  );
}

function Head({ p, o }: { p: Pose; o: Outfit }) {
  const eyeY = 99;
  const ex = p.eyes === 'lookR' ? 2.5 : p.eyes === 'lookL' ? -2.5 : 0;
  const ey = p.eyes === 'up' ? -2.5 : 0;
  const browY = p.brows === 'up' ? -5 : 0;
  const openEye = (cx: number, r = 1) => (
    <g key={cx}>
      <ellipse cx={cx + ex} cy={eyeY + ey} rx={4.4 * r} ry={5.4 * r} fill={HAIR} />
      <circle cx={cx + ex + 1.6} cy={eyeY + ey - 2} r={1.6 * r} fill="#fff" />
    </g>
  );
  const arc = (cx: number, up: boolean) => (
    <path key={cx} d={up ? `M${cx - 6} ${eyeY + 2} Q${cx} ${eyeY - 6} ${cx + 6} ${eyeY + 2}` : `M${cx - 6} ${eyeY - 1} Q${cx} ${eyeY + 5} ${cx + 6} ${eyeY - 1}`} stroke={HAIR} strokeWidth="3" fill="none" strokeLinecap="round" />
  );
  const eyes =
    p.eyes === 'happy' ? [arc(145, true), arc(175, true)]
    : p.eyes === 'closed' ? [arc(145, false), arc(175, false)]
    : p.eyes === 'wink' ? [openEye(145), arc(175, true)]
    : p.eyes === 'wide' ? [openEye(145, 1.2), openEye(175, 1.2)]
    : [openEye(145), openEye(175)];
  const blinks = p.eyes === 'open' || p.eyes === 'lookR' || p.eyes === 'lookL' || p.eyes === 'up';
  const mouth = {
    smile: <path d="M151 116 Q160 124 169 116" stroke={LINE} strokeWidth="2.6" fill="none" strokeLinecap="round" />,
    talk: <path d="M152 114 Q160 126 168 114 Q160 118 152 114 Z" fill={LIP} stroke={LINE} strokeWidth="2" strokeLinejoin="round" />,
    laugh: (
      <g stroke={LINE} strokeWidth="2" strokeLinejoin="round">
        <path d="M148 112 Q160 132 172 112 Z" fill={LIP} />
        <path d="M152 113 L168 113 L166 117 L154 117 Z" fill="#fff" strokeWidth="0" />
      </g>
    ),
    o: <ellipse cx="160" cy="119" rx="4.5" ry="5.5" fill={LIP} stroke={LINE} strokeWidth="2" />,
    flat: <path d="M153 118 Q160 116 167 118" stroke={LINE} strokeWidth="2.6" fill="none" strokeLinecap="round" />,
    smirk: <path d="M152 118 Q162 122 170 113" stroke={LINE} strokeWidth="2.6" fill="none" strokeLinecap="round" />,
  }[p.mouth];
  return (
    <g>
      {/* hair behind the head + bun */}
      <ellipse cx="160" cy="86" rx="43" ry="46" fill={HAIR} stroke={LINE} strokeWidth="3" />
      {!o.hat && (
        <g>
          <circle cx="160" cy="38" r="20" fill={HAIR} stroke={LINE} strokeWidth="3" />
          <path d="M146 30 Q160 22 172 32" stroke={HAIR_HI} strokeWidth="3" fill="none" />
          <path d="M146 54 Q160 60 174 54" stroke={o.trim} strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
      )}
      <ellipse cx="121" cy="100" rx="6" ry="9" fill={SKIN} stroke={LINE} strokeWidth="2.5" />
      <ellipse cx="199" cy="100" rx="6" ry="9" fill={SKIN} stroke={LINE} strokeWidth="2.5" />
      <ellipse cx="160" cy="94" rx="38" ry="41" fill={SKIN} stroke={LINE} strokeWidth="3" />
      <ellipse cx="138" cy="111" rx="7.5" ry="4.2" fill="#f49aa0" opacity={p.blush ? 0.75 : 0.38} />
      <ellipse cx="182" cy="111" rx="7.5" ry="4.2" fill="#f49aa0" opacity={p.blush ? 0.75 : 0.38} />
      <g className={blinks ? 'tw-blink' : undefined} style={pivot([160, eyeY])}>{eyes}</g>
      <path d="M161 104 Q158 109 162 110" stroke={SKIN_SHADE} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {mouth}
      {/* brows */}
      <g style={{ transform: `translateY(${browY}px)`, transition: 'transform 300ms ease' }}>
        <path d="M136 81 Q145 76 153 80" stroke={HAIR} strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d={p.brows === 'tilt' ? 'M167 77 Q176 72 184 78' : 'M167 80 Q175 76 184 81'} stroke={HAIR} strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
      {/* round glasses */}
      <g stroke="#4a3436" strokeWidth="2.6" fill="rgba(255,255,255,0.14)">
        <circle cx="145" cy="99" r="13" />
        <circle cx="175" cy="99" r="13" />
        <path d="M158 98 Q160 95 162 98" fill="none" />
        <path d="M132 97 L124 95 M188 97 L196 95" fill="none" />
      </g>
      <path d="M137 93 L141 89" stroke="#fff" strokeWidth="2" opacity="0.7" strokeLinecap="round" />
      {/* side-swept bangs */}
      <path d="M119 100 C114 60 134 44 162 44 C190 44 207 62 201 102 C196 84 186 72 174 66 C162 82 142 94 119 100 Z" fill={HAIR} stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      <path d="M150 54 Q166 50 186 62" stroke={HAIR_HI} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M121 96 C118 110 120 122 125 131" stroke={HAIR} strokeWidth="5" fill="none" strokeLinecap="round" />
      {o.hat && (
        <g stroke={LINE} strokeWidth="3" strokeLinejoin="round">
          <path d="M116 78 C114 40 136 26 160 26 C184 26 206 40 204 78 Z" fill={o.hat} />
          <rect x="112" y="68" width="96" height="18" rx="9" fill="#e0f2fe" />
          <circle cx="160" cy="22" r="11" fill="#fff" />
        </g>
      )}
    </g>
  );
}

function Bell({ ring }: { ring: boolean }) {
  return (
    <g className={ring ? 'tw-ring' : undefined} style={{ transformOrigin: '0px 0px', transformBox: 'view-box' }}>
      <g stroke={LINE} strokeWidth="2.5" strokeLinejoin="round">
        <rect x="-4" y="-2" width="8" height="16" rx="3" fill="#7c4a1e" />
        <path d="M-16 44 C-16 26 -12 14 0 14 C12 14 16 26 16 44 L20 50 L-20 50 Z" fill="#f2b632" />
        <path d="M-9 24 C-10 30 -10 36 -10 42" stroke="#fde68a" strokeWidth="3" fill="none" />
        <circle cx="0" cy="53" r="4.5" fill="#b7791f" />
      </g>
      {ring && <path d="M24 26 Q30 34 24 42 M-24 26 Q-30 34 -24 42" stroke="#fde047" strokeWidth="3" fill="none" strokeLinecap="round" />}
    </g>
  );
}

function Flag() {
  return (
    <g stroke={LINE} strokeWidth="2.5" strokeLinejoin="round">
      <line x1="0" y1="24" x2="0" y2="-112" stroke="#6b4a2a" strokeWidth="5" />
      <path d="M0 -112 L56 -98 L0 -82 Z" fill="#ef4444" className="tw-flag" style={{ transformOrigin: '0px -97px', transformBox: 'view-box' }} />
      <path d="M18 -100 l3 6 6 1 -5 4 1 6 -5 -3 -5 3 1 -6 -5 -4 6 -1 Z" fill="#fde047" strokeWidth="0" />
    </g>
  );
}

function MapProp() {
  return (
    <g stroke={LINE} strokeWidth="2.5" strokeLinejoin="round">
      <path d="M118 196 L142 188 L178 198 L202 190 L204 250 L180 258 L144 248 L120 256 Z" fill="#fef3c7" />
      <path d="M142 188 L144 248 M178 198 L180 258" stroke="#d6b77a" strokeWidth="2" />
      <path d="M128 236 Q150 210 168 230 T196 210" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="4 4" fill="none" />
      <path d="M190 206 l6 -12 l6 12 Z" fill="#94a3b8" strokeWidth="1.5" />
    </g>
  );
}
