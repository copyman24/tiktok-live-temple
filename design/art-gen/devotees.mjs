// Generates the devotee pose sprites (back view, Vietnamese áo tràng) for the prayer stage.
// 8 looks (4 robe colours × bun / short hair) × 8 poses, so the 40-seat hall is a mixed crowd.
// Output:
//   public/assets/devotees/<variant>/<pose>.webp   every variant (used by the stage)
//   public/assets/devotee*.png                      the default look (grey-blue, bun), kept for older pages
//   bun design/art-gen/devotees.mjs [--out dir] [--sheet sheet.png] [--only variant]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spline, profile, svgDoc, f } from './lib.mjs';
import { withRasterizer } from './render.mjs';

const W = 280;
const H = 380;
const CX = 140;

// Robe colours. Each needs enough range (hi → lo) for the fold shading to read on a red carpet.
export const PALETTES = {
  lam: { // grey-blue áo tràng lam (the original look)
    hi: '#cfc9c4', mid: '#8a93a5', lo: '#4f5870', seam: '#3d455a', line: '#2a3142',
    sash: ['#6b7891', '#465169'], knot: '#56627a', collar: '#5d6a82', shade: ['#1b2133', '#141826'],
    pants: ['#3a404f', '#434a5b', '#3f4656'], sheen: '#f4efe8'
  },
  nau: { // brown
    hi: '#dcc6a6', mid: '#9c7752', lo: '#5a3e27', seam: '#47301e', line: '#2e1f14',
    sash: ['#7a5a3c', '#4e3622'], knot: '#68492e', collar: '#6e5034', shade: ['#2a1a0f', '#1f130a'],
    pants: ['#3d2f24', '#47372a', '#42342a'], sheen: '#f6e9d6'
  },
  trang: { // white / cream, grey-blue sash for contrast
    hi: '#fdfbf6', mid: '#e6e0d5', lo: '#aaa295', seam: '#8f877a', line: '#6b6458',
    sash: ['#8a93a5', '#5d6680'], knot: '#6f7890', collar: '#cdc5b6', shade: ['#4a4438', '#3a352c'],
    pants: ['#5a5650', '#66625b', '#5f5b54'], sheen: '#ffffff'
  },
  vang: { // light yellow
    hi: '#fcf2cc', mid: '#e4cb80', lo: '#a98a40', seam: '#8a6f30', line: '#5a4318',
    sash: ['#a8742a', '#7a5018'], knot: '#8f6020', collar: '#c9a352', shade: ['#4a3810', '#3a2c0c'],
    pants: ['#4a4030', '#544836', '#4e4433'], sheen: '#fff8e2'
  }
};

// <robe>-<hair>: nu = bun (women), nam = short hair (men)
export const VARIANTS = Object.keys(PALETTES).flatMap((robe) => [`${robe}-nu`, `${robe}-nam`]);
export const DEFAULT_VARIANT = 'lam-nu';

const HAIR = { hi: '#4a3b33', lo: '#110c0a' };
const SKIN = { hi: '#ecc2a3', lo: '#b07e62', sole: '#c89a7c' };

// Current look while drawing one sprite (set by poseSvg).
let ROBE = PALETTES.lam;
let HAIR_STYLE = 'bun';

const defs = () => `
  <linearGradient id="robe" gradientUnits="userSpaceOnUse" x1="70" y1="10" x2="230" y2="372">
    <stop offset="0" stop-color="${ROBE.hi}"/><stop offset="0.45" stop-color="${ROBE.mid}"/><stop offset="1" stop-color="${ROBE.lo}"/>
  </linearGradient>
  <radialGradient id="ao" cx="0.42" cy="0.32" r="0.78">
    <stop offset="0" stop-color="#ffe6c4" stop-opacity="0.3"/>
    <stop offset="0.5" stop-color="#fff3e2" stop-opacity="0"/>
    <stop offset="0.82" stop-color="${ROBE.shade[0]}" stop-opacity="0.18"/>
    <stop offset="1" stop-color="${ROBE.shade[1]}" stop-opacity="0.5"/>
  </radialGradient>
  <radialGradient id="hair" cx="0.38" cy="0.3" r="0.8">
    <stop offset="0" stop-color="${HAIR.hi}"/><stop offset="0.6" stop-color="#211915"/><stop offset="1" stop-color="${HAIR.lo}"/>
  </radialGradient>
  <radialGradient id="skin" cx="0.4" cy="0.35" r="0.8">
    <stop offset="0" stop-color="${SKIN.hi}"/><stop offset="1" stop-color="${SKIN.lo}"/>
  </radialGradient>
  <linearGradient id="sash" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${ROBE.sash[0]}"/><stop offset="1" stop-color="${ROBE.sash[1]}"/>
  </linearGradient>
  <filter id="cloth" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.55 0.09" numOctaves="3" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="g"/>
    <feComposite in="SourceGraphic" in2="g" operator="arithmetic" k1="0.24" k2="0.89" k3="0" k4="0" result="t"/>
    <feComposite in="t" in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="soft"><feGaussianBlur stdDeviation="1.1"/></filter>
  <filter id="shadow" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="7"/></filter>`;

let clipId = 0;

// A cloth panel: gradient fill, ambient-occlusion overlay, thread texture, and fold strokes clipped inside.
function cloth(d, folds = [], { fill = 'url(#robe)', highlights = [] } = {}) {
  const id = `c${clipId++}`;
  const foldPaths = folds.map((p) => `<path d="${spline(p, false)}" fill="none" stroke="${ROBE.seam}" stroke-opacity="0.42" stroke-width="3.2" stroke-linecap="round"/>`).join('');
  const hiPaths = highlights.map((p) => `<path d="${spline(p, false)}" fill="none" stroke="${ROBE.sheen}" stroke-opacity="0.28" stroke-width="2.4" stroke-linecap="round"/>`).join('');
  return `<clipPath id="${id}"><path d="${d}"/></clipPath>
    <g filter="url(#cloth)"><path d="${d}" fill="${fill}"/><path d="${d}" fill="url(#ao)"/>
      <g clip-path="url(#${id})"><g filter="url(#soft)">${foldPaths}${hiPaths}</g></g>
    </g>
    <path d="${d}" fill="none" stroke="${ROBE.line}" stroke-opacity="0.55" stroke-width="1.4"/>`;
}

function shadow(cx, cy, rx, ry) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#120c08" fill-opacity="0.55" filter="url(#shadow)"/>`;
}

function skin(d) {
  return `<path d="${d}" fill="url(#skin)" stroke="#7a5241" stroke-opacity="0.5" stroke-width="1.1"/>`;
}

function ellipsePath(cx, cy, rx, ry, rot = 0) {
  const pts = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = rx * Math.cos(a), y = ry * Math.sin(a);
    const r = (rot * Math.PI) / 180;
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return spline(pts);
}

// Back of head with bun and wooden hairpin. `bunDy` moves the bun relative to the head
// (negative = on top, ~0 = facing camera when bowing). Short hair (HAIR_STYLE 'short') has no bun.
function head({ cx = CX, cy, rx, ry, bunDy = -ry * 0.95, bunR = rx * 0.56, ears = true }) {
  const earL = ears ? skin(ellipsePath(cx - rx + 2, cy + ry * 0.12, 5.5, 10, -8)) : '';
  const earR = ears ? skin(ellipsePath(cx + rx - 2, cy + ry * 0.12, 5.5, 10, 8)) : '';
  if (HAIR_STYLE === 'short') return shortHairHead({ cx, cy, rx, ry, earL, earR, ears });
  const hair = ellipsePath(cx, cy, rx, ry);
  const nape = `<path d="${spline([[cx - rx * 0.55, cy + ry * 0.72], [cx, cy + ry * 1.04], [cx + rx * 0.55, cy + ry * 0.72], [cx, cy + ry * 0.86]])}" fill="#2a1f1a"/>`;
  const strands = [-0.5, -0.2, 0.15, 0.45]
    .map((k) => `<path d="${spline([[cx + rx * k * 0.6, cy + bunDy + bunR * 0.9], [cx + rx * k * 0.95, cy], [cx + rx * k * 0.7, cy + ry * 0.85]], false)}" fill="none" stroke="#5a4a40" stroke-opacity="0.22" stroke-width="1.1"/>`)
    .join('');
  const by = cy + bunDy;
  const bun = ellipsePath(cx, by, bunR, bunR * 0.92);
  const coil = `<path d="${spline([[cx - bunR * 0.6, by + 2], [cx - bunR * 0.1, by - bunR * 0.55], [cx + bunR * 0.55, by - bunR * 0.1], [cx + bunR * 0.15, by + bunR * 0.5], [cx - bunR * 0.25, by + bunR * 0.1]], false)}" fill="none" stroke="#5b4a3f" stroke-opacity="0.7" stroke-width="1.6"/>`;
  const pin = `<path d="M${f(cx - bunR * 1.5)},${f(by + bunR * 0.35)} L${f(cx + bunR * 1.45)},${f(by - bunR * 0.25)}" stroke="#7a4a26" stroke-width="3" stroke-linecap="round"/><circle cx="${f(cx + bunR * 1.45)}" cy="${f(by - bunR * 0.25)}" r="2.6" fill="#c9973d"/>`;
  const shine = `<path d="${spline([[cx - rx * 0.62, cy - ry * 0.25], [cx - rx * 0.3, cy - ry * 0.7], [cx + rx * 0.05, cy - ry * 0.78]], false)}" fill="none" stroke="#9c8676" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round" filter="url(#soft)"/>`;
  return `${earL}${earR}<path d="${hair}" fill="url(#hair)"/>${strands}${nape}${shine}
    <path d="${bun}" fill="url(#hair)" stroke="#0c0807" stroke-opacity="0.6" stroke-width="1"/>${coil}${pin}`;
}

// Short men's haircut seen from behind: skin at the nape, hair cut in a soft line above it,
// a little fuller at the crown. Bowing poses (no ears) show mostly the crown.
function shortHairHead({ cx, cy, rx, ry, earL, earR, ears }) {
  const scalp = skin(ellipsePath(cx, cy, rx * 0.96, ry * 0.98));
  // Upright: hair stops above the ears and tapers down to a rounded nape, so skin shows around the
  // ears and the neck (a bob-like flat cut read as a woman's hairstyle). Bowing (no ears): mostly crown.
  const side = ears ? -0.08 : 0.35; // hairline at the temples (fraction of ry from centre)
  const nape = ears ? 0.74 : 0.8;
  const hair = spline([
    [cx - rx * 0.99, cy + ry * side], [cx - rx * 1.0, cy - ry * 0.4], [cx - rx * 0.62, cy - ry * 0.97],
    [cx, cy - ry - 2.5], [cx + rx * 0.62, cy - ry * 0.97], [cx + rx * 1.0, cy - ry * 0.4],
    [cx + rx * 0.99, cy + ry * side], [cx + rx * 0.72, cy + ry * (side + 0.3)], [cx + rx * 0.4, cy + ry * (nape - 0.06)],
    [cx, cy + ry * nape], [cx - rx * 0.4, cy + ry * (nape - 0.06)], [cx - rx * 0.72, cy + ry * (side + 0.3)]
  ]);
  const strands = [-0.6, -0.28, 0, 0.28, 0.6]
    .map((k) => `<path d="${spline([[cx + rx * k * 0.45, cy - ry * 0.9], [cx + rx * k * 0.8, cy - ry * 0.15], [cx + rx * k * 0.55, cy + ry * (nape - 0.12)]], false)}" fill="none" stroke="#5a4a40" stroke-opacity="0.24" stroke-width="1.1"/>`)
    .join('');
  // soft fade where the clipper cut meets the skin
  const fade = `<path d="${spline([[cx - rx * 0.78, cy + ry * (side + 0.22)], [cx - rx * 0.38, cy + ry * (nape - 0.04)], [cx, cy + ry * (nape + 0.04)], [cx + rx * 0.38, cy + ry * (nape - 0.04)], [cx + rx * 0.78, cy + ry * (side + 0.22)]], false)}" fill="none" stroke="#3a2c24" stroke-opacity="0.3" stroke-width="2.6" filter="url(#soft)"/>`;
  const shine = `<path d="${spline([[cx - rx * 0.6, cy - ry * 0.3], [cx - rx * 0.28, cy - ry * 0.74], [cx + rx * 0.08, cy - ry * 0.82]], false)}" fill="none" stroke="#9c8676" stroke-opacity="0.32" stroke-width="3" stroke-linecap="round" filter="url(#soft)"/>`;
  return `${scalp}<path d="${hair}" fill="url(#hair)" stroke="#0c0807" stroke-opacity="0.35" stroke-width="0.8"/>${strands}${fade}${shine}${earL}${earR}`;
}

function neck(cx, top, bottom, hw) {
  return skin(spline([[cx - hw, top], [cx + hw, top], [cx + hw + 2, bottom], [cx, bottom + 3], [cx - hw - 2, bottom]]));
}

function collar(cx, y, hw) {
  return `<path d="${spline([[cx - hw, y + 2], [cx, y - 5], [cx + hw, y + 2], [cx + hw - 4, y + 11], [cx, y + 5], [cx - hw + 4, y + 11]])}" fill="${ROBE.collar}" stroke="${ROBE.line}" stroke-opacity="0.6" stroke-width="1.2"/>`;
}

function sash(cx, y, hw, tail = 34) {
  const band = spline([[cx - hw, y - 4], [cx, y - 6], [cx + hw, y - 4], [cx + hw, y + 5], [cx, y + 4], [cx - hw, y + 5]]);
  const tails = `<path d="${spline([[cx - 4, y], [cx - 11, y + tail * 0.5], [cx - 9, y + tail], [cx - 2, y + tail * 0.95], [cx - 1, y + tail * 0.4]])}" fill="url(#sash)" stroke="${ROBE.line}" stroke-opacity="0.5"/>
    <path d="${spline([[cx + 4, y], [cx + 12, y + tail * 0.55], [cx + 11, y + tail * 1.05], [cx + 3, y + tail], [cx + 1, y + tail * 0.4]])}" fill="url(#sash)" stroke="${ROBE.line}" stroke-opacity="0.5"/>
    <ellipse cx="${cx}" cy="${y}" rx="8" ry="6" fill="${ROBE.knot}" stroke="${ROBE.line}" stroke-opacity="0.6"/>`;
  return `<path d="${band}" fill="url(#sash)" stroke="${ROBE.line}" stroke-opacity="0.5"/>${tails}`;
}

function mirror(points) {
  return points.map(([x, y]) => [2 * CX - x, y]);
}

function sole(cx, cy, rot) {
  const outer = ellipsePath(cx, cy, 15, 10, rot);
  return `<path d="${outer}" fill="${SKIN.sole}" stroke="#6e4a3a" stroke-opacity="0.6" stroke-width="1.1"/>
    <path d="${ellipsePath(cx, cy + 1.5, 9, 5, rot)}" fill="#e2bda2" fill-opacity="0.55"/>`;
}

// ---------- poses ----------

function seizaLower(dy = 0, widen = 0) {
  const rows = [[226, 50], [250, 66 + widen * 0.5], [286, 86 + widen], [326, 95 + widen], [352, 97 + widen], [362, 90 + widen]].map(([y, w]) => [y + dy, w]);
  return cloth(profile(CX, rows, 8), [
    [[112, 252 + dy], [100, 300 + dy], [88, 352 + dy]],
    [[128, 258 + dy], [122, 310 + dy], [118, 362 + dy]],
    [[152, 258 + dy], [158, 310 + dy], [162, 362 + dy]],
    [[168, 252 + dy], [180, 300 + dy], [192, 352 + dy]],
  ], { highlights: [[[100, 262 + dy], [84, 310 + dy], [64, 346 + dy]]] });
}

function kneelTorso(dy = 0) {
  const rows = [[126, 38], [134, 56], [150, 60], [192, 55], [226, 48], [238, 50]].map(([y, w]) => [y + dy, w]);
  return cloth(profile(CX, rows), [
    [[CX, 134 + dy], [CX + 1, 180 + dy], [CX, 228 + dy]],
    [[100, 150 + dy], [114, 190 + dy], [122, 226 + dy]],
    [[180, 150 + dy], [166, 190 + dy], [158, 226 + dy]],
  ], { highlights: [[[96, 142 + dy], [92, 180 + dy], [96, 220 + dy]]] });
}

function hangingSleeves(dy = 0) {
  const left = [[86, 134], [73, 160], [66, 202], [72, 236], [92, 250], [105, 238], [100, 192], [98, 150]].map(([x, y]) => [x, y + dy]);
  const fold = [[[80, 170 + dy], [78, 210 + dy], [88, 244 + dy]]];
  return cloth(spline(left), fold) + cloth(spline(mirror(left)), fold.map(mirror));
}

const poses = {
  kneel() {
    return [
      shadow(CX, 364, 112, 14),
      sole(118, 360, -12), sole(162, 360, 12),
      seizaLower(),
      kneelTorso(),
      hangingSleeves(),
      sash(CX, 232, 53),
      neck(CX, 104, 126, 13),
      collar(CX, 126, 30),
      head({ cy: 80, rx: 31, ry: 35 }),
    ].join('');
  },
  kneelDown() {
    const lowerRows = [[212, 50], [238, 64], [276, 80], [322, 90], [352, 92], [362, 86]];
    return [
      shadow(CX, 364, 98, 13),
      sole(114, 362, -14),
      `<path d="${spline([[160, 330], [182, 332], [186, 366], [174, 372], [160, 368]])}" fill="${ROBE.pants[2]}"/>`,
      skin(ellipsePath(173, 364, 12, 9, 0)),
      cloth(profile(CX, lowerRows, 8), [[[116, 240], [104, 300], [96, 352]], [[160, 240], [170, 300], [176, 350]]], { highlights: [[[104, 250], [92, 300], [80, 340]]] }),
      kneelTorso(-14),
      hangingSleeves(-14),
      sash(CX, 218, 52),
      neck(CX, 90, 112, 13),
      collar(CX, 112, 30),
      head({ cy: 66, rx: 31, ry: 35 }),
    ].join('');
  },
  forehead() {
    const left = [[94, 130], [72, 134], [54, 150], [50, 178], [56, 214], [72, 226], [86, 206], [98, 166]];
    const fold = [[[64, 154], [62, 190], [70, 220]]];
    return [
      shadow(CX, 364, 112, 14),
      sole(118, 360, -12), sole(162, 360, 12),
      seizaLower(),
      kneelTorso(4),
      sash(CX, 236, 53),
      cloth(spline(left), fold) + cloth(spline(mirror(left)), fold.map(mirror)),
      neck(CX, 112, 132, 13),
      collar(CX, 130, 30),
      head({ cy: 90, rx: 31, ry: 34 }),
    ].join('');
  },
  bowMid() {
    const torso = [[152, 46], [160, 70], [184, 76], [216, 70], [240, 58], [250, 58]];
    const left = [[86, 160], [64, 176], [56, 214], [64, 250], [84, 258], [98, 236], [96, 190]];
    const fold = [[[72, 186], [68, 220], [76, 250]]];
    return [
      shadow(CX, 360, 118, 18),
      sole(118, 360, -12), sole(162, 360, 12),
      head({ cy: 146, rx: 30, ry: 27, bunDy: -8, bunR: 15, ears: false }),
      seizaLower(4, 4),
      cloth(profile(CX, torso), [[[CX, 162], [CX, 204], [CX, 240]], [[104, 170], [116, 206], [124, 240]], [[176, 170], [164, 206], [156, 240]]], { highlights: [[[90, 170], [86, 200], [92, 232]]] }),
      collar(CX, 156, 28),
      sash(CX, 246, 56),
      cloth(spline(left), fold) + cloth(spline(mirror(left)), fold.map(mirror)),
    ].join('');
  },
  prostrate() {
    return prostrateFrame({ headCy: 196, palmY: 192, palmX: 50, back: [[186, 34], [196, 62], [218, 78], [248, 82], [272, 78]] });
  },
  prostrateDeep() {
    return prostrateFrame({ headCy: 178, palmY: 168, palmX: 58, back: [[172, 34], [184, 64], [210, 82], [246, 86], [276, 80]], lift: 8 });
  },
  walk1() {
    return walkFrame(1);
  },
  walk2() {
    return walkFrame(-1);
  },
};

function prostrateFrame({ headCy, palmY, palmX, back, lift = 0 }) {
  const palm = (x, side) => {
    const d = spline([[x - 13, palmY + 4], [x - 9, palmY - 8 - lift], [x + 1, palmY - 11 - lift], [x + 11, palmY - 6 - lift], [x + 13, palmY + 6], [x, palmY + 10]]);
    const lines = [-6, -1, 4].map((k) => `<path d="M${f(x + k)},${f(palmY - 8 - lift)} L${f(x + k * 0.8)},${f(palmY - 1)}" stroke="#8a5d48" stroke-opacity="0.45" stroke-width="1"/>`).join('');
    return skin(d) + lines;
  };
  const lx = CX - palmX - 30, rx = CX + palmX + 30;
  const sleeve = [[lx - 10, palmY + 6], [lx + 18, palmY - 2], [CX - 52, back[2][0] - 6], [CX - 62, back[3][0] + 10], [CX - 86, back[3][0] + 8], [lx - 12, palmY + 30]];
  const fold = [[[lx + 6, palmY + 12], [CX - 74, back[2][0] + 10]]];
  return [
    shadow(CX, 330, 124, 34),
    sole(118, 360, -12), sole(162, 360, 12),
    palm(lx, -1), palm(rx, 1),
    cloth(spline(sleeve), fold) + cloth(spline(mirror(sleeve)), fold.map(mirror)),
    head({ cy: headCy, rx: 29, ry: 24, bunDy: -2, bunR: 15, ears: false }),
    cloth(profile(CX, back), [[[CX, back[0][0] + 8], [CX, back[4][0] - 4]], [[106, back[1][0] + 10], [100, back[3][0]]], [[174, back[1][0] + 10], [180, back[3][0]]]], { highlights: [[[102, back[1][0] + 6], [94, back[2][0] + 12]]] }),
    collar(CX, back[0][0] + 6, 26),
    cloth(profile(CX, [[back[4][0] - 6, 76], [back[4][0] + 16, 88], [318, 96], [350, 98], [362, 92]], 8), [[[114, 290], [100, 352]], [[166, 290], [180, 352]]], { highlights: [[[98, 292], [76, 340]]] }),
    sash(CX, back[4][0] - 4, 74, 24),
  ].join('');
}

function walkFrame(dir) {
  // dir 1: left foot forward (further away), right foot behind with sole showing
  const near = dir === 1 ? 160 : 120;
  const far = dir === 1 ? 122 : 158;
  const hemL = dir === 1 ? 70 : 76;
  const hemR = dir === 1 ? 76 : 70;
  const robeRows = [[176, 42], [214, 52, 52], [270, 62 + dir, 62 - dir], [320, hemL - 4, hemR - 4], [342, hemL, hemR]];
  const sleeve = [[98, 96], [84, 110], [76, 160], [72, 214], [82, 244], [100, 242], [108, 198], [106, 132]];
  const sway = dir * 1.5;
  return [
    shadow(CX, 364, 64, 11),
    `<path d="${spline([[far - 9, 330], [far + 9, 330], [far + 8, 356], [far - 8, 356]])}" fill="${ROBE.pants[0]}"/>`,
    `<path d="${ellipsePath(far, 354, 10, 6, 0)}" fill="#2a2522"/>`,
    `<path d="${spline([[near - 10, 334], [near + 10, 334], [near + 10, 360], [near - 10, 360]])}" fill="${ROBE.pants[1]}"/>`,
    sole(near, 364, dir * 8),
    cloth(profile(CX + sway, robeRows, 6), [[[118, 190], [108, 270], [98, 338]], [[CX, 196], [CX + dir * 4, 270], [CX + dir * 2, 340]], [[162, 190], [172, 270], [182, 338]]], { highlights: [[[110, 200], [96, 280], [86, 330]]] }),
    cloth(profile(CX, [[92, 34], [100, 50], [130, 50], [168, 42], [182, 42]]), [[[CX, 100], [CX, 176]], [[110, 108], [118, 172]], [[170, 108], [162, 172]]], { highlights: [[[104, 104], [100, 150]]] }),
    cloth(spline(sleeve.map(([x, y]) => [x - dir * 2, y])), [[[88, 130], [84, 190], [90, 236]]]),
    cloth(spline(mirror(sleeve).map(([x, y]) => [x - dir * 2, y])), [[[192, 130], [196, 190], [190, 236]]]),
    sash(CX, 180, 42, 30),
    neck(CX, 64, 88, 11),
    collar(CX, 90, 25),
    head({ cy: 46, rx: 25, ry: 29 }),
  ].join('');
}

const FILES = {
  walk1: 'devotee_walk.png',
  walk2: 'devotee_walk_2.png',
  kneelDown: 'devotee_kneel_down.png',
  kneel: 'devotee.png',
  forehead: 'devotee_bow.png',
  bowMid: 'devotee_bow_mid.png',
  prostrate: 'devotee_prostrate.png',
  prostrateDeep: 'devotee_prostrate_deep.png',
};

export function poseSvg(key, variant = DEFAULT_VARIANT) {
  const [robe, hair] = variant.split('-');
  if (!PALETTES[robe] || !['nu', 'nam'].includes(hair)) throw new Error(`Unknown devotee variant: ${variant}`);
  ROBE = PALETTES[robe];
  HAIR_STYLE = hair === 'nam' ? 'short' : 'bun';
  clipId = 0;
  return svgDoc(W, H, defs(), poses[key]());
}

const ORDER = ['walk1', 'walk2', 'kneelDown', 'kneel', 'forehead', 'bowMid', 'prostrate', 'prostrateDeep'];

// Inline one rendered pose into a bigger SVG (unique clip / gradient ids per cell).
function cell(key, variant, i, x, y) {
  const body = poseSvg(key, variant).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
    .replace(/id="([a-z]+\d*)"/g, `id="$1_${i}"`).replace(/url\(#([a-z]+\d*)\)/g, `url(#$1_${i})`);
  return `<g transform="translate(${x} ${y})">${body}</g>`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const out = arg('--out') || join(root, 'public', 'assets');
  const sheet = arg('--sheet');
  const only = arg('--only');
  const variants = only ? [only] : VARIANTS;
  mkdirSync(out, { recursive: true });
  await withRasterizer(async (rasterize) => {
    for (const variant of variants) {
      const dir = join(out, 'devotees', variant);
      mkdirSync(dir, { recursive: true });
      for (const key of ORDER) {
        writeFileSync(join(dir, `${key}.webp`), await rasterize(poseSvg(key, variant), { width: W, height: H, scale: 3, type: 'image/webp', quality: 0.9 }));
      }
      console.log('wrote', dir);
    }
    // The default look also keeps the original PNG names (index.html and older pages use them).
    if (variants.includes(DEFAULT_VARIANT)) {
      for (const [key, file] of Object.entries(FILES)) {
        writeFileSync(join(out, file), await rasterize(poseSvg(key, DEFAULT_VARIANT), { width: W, height: H, scale: 3 }));
      }
      console.log('wrote', join(out, 'devotee*.png'));
    }
    if (sheet) {
      // One row per variant, poses left to right.
      let i = 0;
      const rows = variants.map((variant, r) => ORDER.map((key, c) => cell(key, variant, i++, c * W, r * H)).join('')).join('');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 8}" height="${H * variants.length}"><rect width="100%" height="100%" fill="#5a3a2a"/>${rows}</svg>`;
      writeFileSync(sheet, await rasterize(svg, { width: W * 8, height: H * variants.length, scale: 1 }));
      console.log('wrote', sheet);
    }
  });
}
