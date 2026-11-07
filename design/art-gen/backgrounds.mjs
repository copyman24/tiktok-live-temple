// Nền sân khấu vẽ bằng code (1080 x 1920), cùng bố cục với /assets/amitabha_stage.webp để hào quang, lư hương,
// đệm VIP, hàng người quỳ và thảm đỏ của sân khấu vẫn khớp:
//   đầu Phật (540, 262) · đài sen trên tay (540, 510) · lư hương (540, 900–1010) · 6 đệm VIP y 1188
//   thảm đỏ: mép trên y 1262 (x 445–635), loe ra hết bề ngang ở đáy.
// Chạy: bun design/art-gen/backgrounds.mjs  ->  public/assets/backgrounds/dem-hoa-dang.webp
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withRasterizer } from './render.mjs';

const W = 1080;
const H = 1920;
const f = (n) => Math.round(n * 10) / 10;

// Số ngẫu nhiên cố định (ảnh ra giống nhau mỗi lần chạy).
function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function stars(rand) {
  let out = '';
  for (let i = 0; i < 140; i++) {
    const x = rand() * W;
    const y = rand() * 760;
    const r = rand() < 0.08 ? 2.4 : 0.6 + rand() * 1.3;
    out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#fff7dc" opacity="${f(0.35 + rand() * 0.6)}"/>`;
  }
  return out;
}

function skyLanterns(rand) {
  let out = '';
  const spots = [[90, 520], [200, 640], [130, 760], [300, 590], [960, 560], [860, 690], [990, 780], [760, 610], [60, 380], [1020, 400]];
  for (const [x0, y0] of spots) {
    const s = 0.7 + rand() * 0.6;
    const x = x0 + (rand() - 0.5) * 30;
    const y = y0 + (rand() - 0.5) * 30;
    out += `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})">
      <circle r="34" fill="url(#lanternGlow)"/>
      <path d="M-11 -15 L11 -15 L14 13 L-14 13 Z" fill="url(#skyLantern)"/>
      <rect x="-9" y="13" width="18" height="3" fill="#ffd27a"/>
    </g>`;
  }
  return out;
}

function pagoda(cx, baseY, flip) {
  // Chùa nhiều tầng mái cong, cửa sổ sáng đèn.
  let out = `<g transform="translate(${cx} 0) scale(${flip ? -1 : 1} 1)">`;
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const w = 190 - i * 28;
    const yTop = baseY - 120 - i * 112;
    const bodyH = 70;
    out += `<rect x="${-w / 2 + 18}" y="${yTop + 34}" width="${w - 36}" height="${bodyH}" fill="#3b1410"/>`;
    for (let k = 0; k < 3; k++) {
      const wx = -w / 2 + 34 + k * ((w - 68) / 2) - 9;
      out += `<rect x="${f(wx)}" y="${yTop + 52}" width="18" height="30" rx="8" fill="#ffc861" opacity="0.92"/>`;
    }
    const eave = w / 2 + 34;
    out += `<path d="M${-eave} ${yTop + 30} Q${-w / 2} ${yTop + 22} ${-w / 2 + 20} ${yTop + 6} L${w / 2 - 20} ${yTop + 6} Q${w / 2} ${yTop + 22} ${eave} ${yTop + 30} Q${w / 2} ${yTop + 40} ${w / 2 - 6} ${yTop + 38} L${-w / 2 + 6} ${yTop + 38} Q${-w / 2} ${yTop + 40} ${-eave} ${yTop + 30} Z" fill="#5a1a12" stroke="#e8b24a" stroke-width="3"/>`;
    out += `<path d="M${-eave} ${yTop + 30} q-8 -14 -2 -24" fill="none" stroke="#e8b24a" stroke-width="4" stroke-linecap="round"/>`;
    out += `<path d="M${eave} ${yTop + 30} q8 -14 2 -24" fill="none" stroke="#e8b24a" stroke-width="4" stroke-linecap="round"/>`;
  }
  const topY = baseY - 120 - (tiers - 1) * 112;
  out += `<path d="M0 ${topY - 70} L-6 ${topY + 8} L6 ${topY + 8} Z" fill="#e8b24a"/>`;
  out += `<circle cx="0" cy="${topY - 74}" r="7" fill="#ffe39a"/>`;
  out += `<rect x="-110" y="${baseY - 50}" width="220" height="50" fill="#2a0e0a" stroke="#c48a2c" stroke-width="2"/>`;
  out += '</g>';
  return out;
}

function lotusPetal(x, y, w, h, fill) {
  return `<path d="M${f(x)} ${f(y + h)} Q${f(x - w * 0.62)} ${f(y + h * 0.35)} ${f(x)} ${f(y)} Q${f(x + w * 0.62)} ${f(y + h * 0.35)} ${f(x)} ${f(y + h)} Z" fill="${fill}" stroke="#b8741c" stroke-width="2"/>`;
}

function lotusThrone() {
  let out = '';
  // Hàng cánh sau
  for (let i = 0; i < 9; i++) {
    const x = 300 + i * 60;
    out += lotusPetal(x, 660, 92, 120, 'url(#petalBack)');
  }
  // Hàng cánh trước
  for (let i = 0; i < 10; i++) {
    const x = 262 + i * 61.8;
    out += lotusPetal(x, 720, 100, 128, 'url(#petalFront)');
  }
  out += `<path d="M232 840 Q540 878 848 840 L860 870 Q540 912 220 870 Z" fill="url(#gold)" stroke="#8a5512" stroke-width="2"/>`;
  return out;
}

function buddha() {
  return `
  <g id="buddha">
    <!-- hào quang sau lưng -->
    <circle cx="540" cy="300" r="350" fill="url(#aureole)"/>
    <circle cx="540" cy="300" r="300" fill="none" stroke="#ffd36a" stroke-width="5" opacity="0.65"/>
    <circle cx="540" cy="262" r="150" fill="url(#headHalo)"/>
    <!-- chân xếp bằng -->
    <path d="M292 612 Q540 560 788 612 Q820 668 770 700 Q540 736 310 700 Q260 668 292 612 Z" fill="url(#gold)" stroke="#8a5512" stroke-width="3"/>
    <path d="M330 660 Q540 630 750 660" fill="none" stroke="#a86a18" stroke-width="3" opacity="0.7"/>
    <!-- thân, áo cà sa -->
    <path d="M372 430 Q540 372 708 430 Q744 520 738 612 Q540 650 342 612 Q336 520 372 430 Z" fill="url(#gold)" stroke="#8a5512" stroke-width="3"/>
    <path d="M412 440 Q470 520 452 610 M668 440 Q610 520 628 610 M470 410 Q540 480 610 410" fill="none" stroke="#a86a18" stroke-width="3" opacity="0.65"/>
    <path d="M708 430 Q600 470 560 560" fill="none" stroke="#a86a18" stroke-width="4" opacity="0.6"/>
    <!-- tay kết ấn thiền -->
    <path d="M372 440 Q318 520 380 574 Q450 590 500 548" fill="url(#gold)" stroke="#8a5512" stroke-width="3"/>
    <path d="M708 440 Q762 520 700 574 Q630 590 580 548" fill="url(#gold)" stroke="#8a5512" stroke-width="3"/>
    <ellipse cx="540" cy="552" rx="82" ry="28" fill="url(#goldLight)" stroke="#8a5512" stroke-width="3"/>
    <!-- đài sen nhỏ trên tay -->
    ${lotusPetal(512, 480, 34, 62, '#ffd6e0')}${lotusPetal(568, 480, 34, 62, '#ffd6e0')}${lotusPetal(540, 468, 38, 74, '#ffe6ec')}
    <!-- cổ -->
    <path d="M506 330 L574 330 L582 392 Q540 404 498 392 Z" fill="url(#goldLight)" stroke="#8a5512" stroke-width="2"/>
    <path d="M512 360 Q540 368 568 360 M508 378 Q540 388 572 378" fill="none" stroke="#a86a18" stroke-width="2"/>
    <!-- tai -->
    <ellipse cx="461" cy="282" rx="15" ry="48" fill="url(#goldLight)" stroke="#8a5512" stroke-width="2"/>
    <ellipse cx="619" cy="282" rx="15" ry="48" fill="url(#goldLight)" stroke="#8a5512" stroke-width="2"/>
    <!-- mặt -->
    <ellipse cx="540" cy="266" rx="76" ry="90" fill="url(#face)" stroke="#8a5512" stroke-width="2"/>
    <!-- tóc xoắn ốc + nhục kế -->
    <path d="M462 248 Q462 168 540 164 Q618 168 618 248 Q600 214 540 210 Q480 214 462 248 Z" fill="#2c2347"/>
    <circle cx="540" cy="160" r="30" fill="#2c2347"/>
    <circle cx="540" cy="128" r="9" fill="#ffd36a"/>
    ${Array.from({ length: 26 }, (_, i) => {
      const a = Math.PI * (0.08 + (i % 13) * 0.07);
      const ring = i < 13 ? 64 : 46;
      const cy = i < 13 ? 236 : 222;
      return `<circle cx="${f(540 - Math.cos(a) * ring)}" cy="${f(cy - Math.sin(a) * ring * 0.55)}" r="5" fill="#463a6b"/>`;
    }).join('')}
    <circle cx="540" cy="236" r="5" fill="#ffefb0"/>
    <!-- mắt khép, chân mày, mũi, miệng -->
    <path d="M492 252 Q512 240 530 250 M550 250 Q568 240 588 252" fill="none" stroke="#6b4210" stroke-width="3" stroke-linecap="round"/>
    <path d="M498 270 Q513 278 528 270 M552 270 Q567 278 582 270" fill="none" stroke="#4a2c0c" stroke-width="3" stroke-linecap="round"/>
    <path d="M540 262 L534 300 Q540 306 546 300" fill="none" stroke="#9a6418" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M522 322 Q540 332 558 322" fill="none" stroke="#9a3c20" stroke-width="3" stroke-linecap="round"/>
    <!-- chữ Vạn trên ngực -->
    <g transform="translate(540 452)" stroke="#b87a1e" stroke-width="5" fill="none" stroke-linecap="square">
      <path d="M-12 -12 L-12 0 L12 0 L12 12 M0 -12 L0 12 M-12 12 L0 12 M0 -12 L12 -12"/>
    </g>
  </g>`;
}

function vase(cx) {
  let flowers = '';
  const spots = [[-56, -150], [-20, -190], [22, -176], [58, -140], [-80, -96], [80, -90], [0, -120], [-40, -60], [42, -58]];
  for (const [dx, dy] of spots) {
    flowers += `<path d="M${cx} 820 Q${cx + dx * 0.4} ${740 + dy * 0.3} ${cx + dx} ${820 + dy + 40}" fill="none" stroke="#2f6b3a" stroke-width="4"/>`;
    flowers += `<ellipse cx="${cx + dx + (dx > 0 ? 18 : -18)}" cy="${820 + dy + 52}" rx="26" ry="12" fill="#3f8a4a" transform="rotate(${dx > 0 ? 20 : -20} ${cx + dx} ${820 + dy + 52})"/>`;
    flowers += lotusPetal(cx + dx - 11, 820 + dy, 22, 40, '#ff9fbc') + lotusPetal(cx + dx + 11, 820 + dy, 22, 40, '#ff9fbc') + lotusPetal(cx + dx, 820 + dy - 8, 24, 48, '#ffc3d4');
  }
  return `${flowers}
    <path d="M${cx - 44} 820 Q${cx - 62} 870 ${cx - 40} 920 L${cx + 40} 920 Q${cx + 62} 870 ${cx + 44} 820 Z" fill="url(#gold)" stroke="#8a5512" stroke-width="3"/>
    <rect x="${cx - 48}" y="812" width="96" height="14" rx="5" fill="#ffd36a" stroke="#8a5512" stroke-width="2"/>`;
}

function altar() {
  const lamp = (x) => `<g transform="translate(${x} 948)">
      <circle r="60" fill="url(#lanternGlow)"/>
      ${lotusPetal(-14, -34, 30, 46, '#ffe08a')}${lotusPetal(14, -34, 30, 46, '#ffe08a')}${lotusPetal(0, -44, 32, 56, '#fff2b8')}
      <rect x="-26" y="12" width="52" height="12" rx="4" fill="url(#gold)"/>
    </g>`;
  const fruit = (x) => `<g transform="translate(${x} 950)">
      <ellipse cx="0" cy="18" rx="44" ry="10" fill="url(#gold)" stroke="#8a5512" stroke-width="2"/>
      ${[[-22, 4], [0, 4], [22, 4], [-11, -14], [11, -14], [0, -30]].map(([dx, dy]) => `<circle cx="${dx}" cy="${dy}" r="13" fill="#e2483a" stroke="#9c2a20" stroke-width="2"/>`).join('')}
    </g>`;
  return `
    <!-- bàn thờ -->
    <rect x="96" y="968" width="888" height="22" fill="url(#gold)" stroke="#8a5512" stroke-width="2"/>
    <rect x="110" y="990" width="860" height="86" fill="url(#wood)" stroke="#c48a2c" stroke-width="3"/>
    ${Array.from({ length: 6 }, (_, i) => `<rect x="${130 + i * 140}" y="1004" width="120" height="58" rx="6" fill="none" stroke="#d9a646" stroke-width="2" opacity="0.8"/><circle cx="${190 + i * 140}" cy="1033" r="14" fill="none" stroke="#d9a646" stroke-width="2" opacity="0.8"/>`).join('')}
    ${lamp(178)}${lamp(902)}${fruit(300)}${fruit(780)}
    <!-- nến -->
    ${[392, 688].map((x) => `<g transform="translate(${x} 900)"><circle cy="-8" r="40" fill="url(#lanternGlow)"/><rect x="-9" y="0" width="18" height="66" fill="#fff0d4"/><path d="M0 -24 Q8 -10 0 -2 Q-8 -10 0 -24 Z" fill="#ffc34a"/><rect x="-18" y="62" width="36" height="8" fill="url(#gold)"/></g>`).join('')}
    <!-- lư hương đồng -->
    <g transform="translate(540 0)">
      <ellipse cx="0" cy="1000" rx="120" ry="16" fill="#000" opacity="0.35"/>
      <path d="M-96 905 Q-110 980 -60 995 L60 995 Q110 980 96 905 Z" fill="url(#bronze)" stroke="#5c3a10" stroke-width="3"/>
      <rect x="-106" y="896" width="212" height="16" rx="6" fill="url(#gold)" stroke="#5c3a10" stroke-width="2"/>
      <path d="M-96 920 q-26 4 -22 30 M96 920 q26 4 22 30" fill="none" stroke="#c99a3a" stroke-width="7" stroke-linecap="round"/>
      <path d="M-60 995 l-12 22 M60 995 l12 22 M0 998 l0 20" stroke="#5c3a10" stroke-width="8" stroke-linecap="round"/>
      <circle cx="0" cy="950" r="20" fill="none" stroke="#ffe39a" stroke-width="3" opacity="0.8"/>
    </g>`;
}

function cushion(x) {
  return `<g transform="translate(${x} 1188)">
    <ellipse cx="0" cy="12" rx="70" ry="10" fill="#000" opacity="0.35"/>
    <rect x="-62" y="-30" width="124" height="40" rx="10" fill="url(#cushion)" stroke="#e8b24a" stroke-width="3"/>
    <ellipse cx="0" cy="-12" rx="22" ry="9" fill="none" stroke="#ffd36a" stroke-width="2.5"/>
    <path d="M-62 4 L62 4" stroke="#ffd36a" stroke-width="2" stroke-dasharray="4 5"/>
  </g>`;
}

function carpet() {
  // Hình thang phối cảnh, viền vàng, các ô hoa sen dọc giữa.
  const top = 1262;
  const L = (y) => 445 - (y - top) * ((445 + 90) / (H - top));
  const R = (y) => 635 + (y - top) * ((1170 - 635) / (H - top));
  const inset = (y, k) => [L(y) + (R(y) - L(y)) * k, R(y) - (R(y) - L(y)) * k];
  const band = (k1, k2, fill) => {
    const [a1] = inset(top, k1);
    const [a2] = inset(H, k1);
    const [b1] = inset(top, k2);
    const [b2] = inset(H, k2);
    const [, c1] = inset(top, k1);
    const [, c2] = inset(H, k1);
    const [, d1] = inset(top, k2);
    const [, d2] = inset(H, k2);
    return `<path d="M${f(a1)} ${top} L${f(b1)} ${top} L${f(b2)} ${H} L${f(a2)} ${H} Z" fill="${fill}"/><path d="M${f(d1)} ${top} L${f(c1)} ${top} L${f(c2)} ${H} L${f(d2)} ${H} Z" fill="${fill}"/>`;
  };
  let medallions = '';
  for (const [y, s] of [[1330, 0.32], [1460, 0.5], [1640, 0.75], [1860, 1.05]]) {
    medallions += `<g transform="translate(540 ${y}) scale(${s} ${s * 0.42})">
      <circle r="190" fill="none" stroke="#e8b24a" stroke-width="10"/>
      <circle r="150" fill="none" stroke="#e8b24a" stroke-width="4"/>
      ${Array.from({ length: 8 }, (_, i) => `<path d="M0 0 Q-40 -70 0 -130 Q40 -70 0 0 Z" fill="#f0c45a" transform="rotate(${i * 45})"/>`).join('')}
      <circle r="26" fill="#ffd36a"/>
    </g>`;
  }
  return `
    <path d="M${f(L(top))} ${top} L${f(R(top))} ${top} L${f(R(H))} ${H} L${f(L(H))} ${H} Z" fill="url(#carpet)"/>
    ${band(0.02, 0.07, '#e2ac45')}${band(0.1, 0.12, '#c88d2e')}
    ${medallions}`;
}

function floorTiles() {
  let lines = '';
  for (let i = -12; i <= 12; i++) {
    const xb = 540 + i * 130;
    lines += `<line x1="${540 + i * 22}" y1="1240" x2="${xb}" y2="${H}" stroke="#7a5640" stroke-width="2" opacity="0.35"/>`;
  }
  for (const y of [1268, 1306, 1356, 1420, 1500, 1600, 1720, 1860]) {
    lines += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#7a5640" stroke-width="2" opacity="0.32"/>`;
  }
  return `<rect x="0" y="1240" width="${W}" height="${H - 1240}" fill="url(#floor)"/>${lines}
    <ellipse cx="540" cy="1300" rx="520" ry="70" fill="#ffcf7a" opacity="0.10"/>`;
}

function stoneLantern(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="0" cy="-84" r="70" fill="url(#lanternGlow)"/>
    <rect x="-22" y="-20" width="44" height="20" fill="#6b6370"/>
    <rect x="-10" y="-62" width="20" height="44" fill="#77707d"/>
    <rect x="-30" y="-108" width="60" height="44" fill="#77707d"/>
    <rect x="-16" y="-100" width="32" height="28" fill="#ffd27a"/>
    <path d="M-48 -108 Q0 -150 48 -108 Z" fill="#5e5664"/>
    <circle cx="0" cy="-138" r="7" fill="#5e5664"/>
  </g>`;
}

function hangingLanterns() {
  const one = (x, y, len) => `<line x1="${x}" y1="0" x2="${x}" y2="${y - 40}" stroke="#c48a2c" stroke-width="3"/>
    <g transform="translate(${x} ${y})">
      <circle r="70" fill="url(#lanternGlow)"/>
      <ellipse rx="34" ry="42" fill="url(#redLantern)" stroke="#ffcf6b" stroke-width="2"/>
      <path d="M-34 0 Q0 8 34 0 M-28 -22 Q0 -14 28 -22 M-28 22 Q0 30 28 22" fill="none" stroke="#ffcf6b" stroke-width="1.6" opacity="0.8"/>
      <rect x="-14" y="-48" width="28" height="8" fill="#ffcf6b"/><rect x="-14" y="40" width="28" height="8" fill="#ffcf6b"/>
      <line x1="0" y1="48" x2="0" y2="${48 + len}" stroke="#ffcf6b" stroke-width="3"/>
    </g>`;
  return one(44, 330, 40) + one(1036, 330, 40) + one(150, 210, 30) + one(930, 210, 30);
}

export function demHoaDangSvg() {
  const rand = prng(20261107);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#070823"/><stop offset="0.42" stop-color="#1d1446"/>
      <stop offset="0.74" stop-color="#5a2350"/><stop offset="1" stop-color="#c2603a"/>
    </linearGradient>
    <radialGradient id="aureole"><stop offset="0" stop-color="#fff4c2" stop-opacity="0.9"/><stop offset="0.45" stop-color="#ffcf5a" stop-opacity="0.45"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
    <radialGradient id="headHalo"><stop offset="0.5" stop-color="#fff6cc" stop-opacity="0.95"/><stop offset="1" stop-color="#ffd36a" stop-opacity="0"/></radialGradient>
    <radialGradient id="moonGlow"><stop offset="0.35" stop-color="#fff8e1" stop-opacity="0.95"/><stop offset="0.5" stop-color="#ffe9b0" stop-opacity="0.35"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></radialGradient>
    <radialGradient id="lanternGlow"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.75"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
    <linearGradient id="skyLantern" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset="1" stop-color="#ff8a2a"/></linearGradient>
    <radialGradient id="redLantern" cx="0.4" cy="0.35"><stop offset="0" stop-color="#ff8a5a"/><stop offset="0.6" stop-color="#d4261c"/><stop offset="1" stop-color="#7a0e0a"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset="0.35" stop-color="#f3c54e"/><stop offset="0.75" stop-color="#c88a22"/><stop offset="1" stop-color="#8a5512"/></linearGradient>
    <linearGradient id="goldLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c8"/><stop offset="1" stop-color="#e6b040"/></linearGradient>
    <radialGradient id="face" cx="0.45" cy="0.4"><stop offset="0" stop-color="#fff6d2"/><stop offset="0.7" stop-color="#f4cc62"/><stop offset="1" stop-color="#d49a32"/></radialGradient>
    <linearGradient id="petalBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd0dc"/><stop offset="1" stop-color="#e2557c"/></linearGradient>
    <linearGradient id="petalFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe4ec"/><stop offset="0.55" stop-color="#f28aa6"/><stop offset="1" stop-color="#e8b24a"/></linearGradient>
    <linearGradient id="bronze" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6b4513"/><stop offset="0.45" stop-color="#e2b24c"/><stop offset="1" stop-color="#6b4513"/></linearGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a1a12"/><stop offset="1" stop-color="#3a0b07"/></linearGradient>
    <linearGradient id="cushion" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d0322a"/><stop offset="1" stop-color="#7a1210"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a36"/><stop offset="1" stop-color="#2a1b22"/></linearGradient>
    <linearGradient id="carpet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e1512"/><stop offset="1" stop-color="#b3201a"/></linearGradient>
    <linearGradient id="platform" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4652"/><stop offset="1" stop-color="#3a2c36"/></linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${stars(rand)}
  <circle cx="190" cy="330" r="150" fill="url(#moonGlow)"/>
  <circle cx="190" cy="330" r="58" fill="#fff6dc"/>
  <circle cx="172" cy="318" r="10" fill="#efe2bf" opacity="0.7"/><circle cx="206" cy="346" r="7" fill="#efe2bf" opacity="0.7"/>
  ${skyLanterns(rand)}

  <!-- núi xa, núi gần -->
  <path d="M0 860 L120 780 L230 840 L360 760 L470 830 L610 770 L740 840 L860 760 L980 820 L1080 790 L1080 1100 L0 1100 Z" fill="#2b1d4a"/>
  <path d="M0 930 L150 870 L300 920 L440 880 L560 930 L700 880 L860 930 L1000 890 L1080 910 L1080 1100 L0 1100 Z" fill="#1c1430"/>

  ${pagoda(118, 1050, false)}${pagoda(962, 1050, true)}
  ${hangingLanterns()}

  ${buddha()}
  ${lotusThrone()}
  ${vase(150)}${vase(930)}

  <!-- bục đá -->
  <rect x="0" y="1076" width="${W}" height="164" fill="url(#platform)"/>
  <rect x="0" y="1076" width="${W}" height="10" fill="#c48a2c" opacity="0.8"/>
  <rect x="0" y="1218" width="${W}" height="22" fill="#2a1f28"/>
  ${altar()}
  ${[140, 268, 392, 688, 812, 940].map(cushion).join('')}

  ${floorTiles()}
  ${carpet()}
  ${stoneLantern(70, 1420, 1.0)}${stoneLantern(1010, 1420, 1.0)}${stoneLantern(36, 1760, 1.35)}${stoneLantern(1044, 1760, 1.35)}
</svg>`;
}

// ---------------------------------------------------------------------------
// "Đại điện": chánh điện sâu, tượng Phật nhỏ cuối điện + hai tượng Bồ Tát đứng, hai hàng cột gỗ, đèn lồng,
// sàn đá bóng, thảm đỏ dài. Lư hương là đỉnh đồng lớn giữa sàn, ĐÚNG chỗ lư hương của nền gốc (540, 900–1010)
// để que hương / khói của sân khấu vẫn khớp. Hào quang lớn của sân khấu tự ẩn với nền này (bố cục "hall").
// ---------------------------------------------------------------------------
const VP = { x: 540, y: 700 }; // điểm tụ phối cảnh

function hallPillar(x, top, bottom, w) {
  return `<g>
    <rect x="${f(x - w / 2)}" y="${top}" width="${f(w)}" height="${bottom - top}" fill="url(#pillar)"/>
    <rect x="${f(x - w / 2 - w * 0.18)}" y="${f(bottom - w * 0.5)}" width="${f(w * 1.36)}" height="${f(w * 0.5)}" fill="#6b4a2a"/>
    <rect x="${f(x - w / 2 - w * 0.1)}" y="${f(bottom - w * 0.62)}" width="${f(w * 1.2)}" height="${f(w * 0.14)}" fill="#d9a646"/>
    <rect x="${f(x - w / 2)}" y="${f(top + (bottom - top) * 0.06)}" width="${f(w)}" height="${f(w * 0.12)}" fill="#d9a646" opacity="0.85"/>
  </g>`;
}

function palaceLantern(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <line x1="0" y1="-400" x2="0" y2="-52" stroke="#5a3a1a" stroke-width="3"/>
    <circle r="78" fill="url(#lanternGlow)"/>
    <path d="M-30 -48 L30 -48 L40 -30 L40 30 L30 48 L-30 48 L-40 30 L-40 -30 Z" fill="url(#lanternBody)" stroke="#d9a646" stroke-width="3"/>
    <path d="M-40 -30 L40 -30 M-40 30 L40 30 M0 -48 L0 48 M-20 -48 L-20 48 M20 -48 L20 48" stroke="#8a5a1c" stroke-width="2" opacity="0.6"/>
    <path d="M-46 -48 L46 -48 L32 -64 L-32 -64 Z" fill="#5a1a12" stroke="#d9a646" stroke-width="2"/>
    <path d="M-46 48 L46 48 L32 62 L-32 62 Z" fill="#5a1a12" stroke="#d9a646" stroke-width="2"/>
    <line x1="0" y1="62" x2="0" y2="96" stroke="#c4302a" stroke-width="5"/>
  </g>`;
}

function latticeWindow(x1, y1, x2, y2, x3, y3, x4, y4) {
  // Ô cửa song gỗ sáng đèn (tứ giác phối cảnh).
  let grid = '';
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    grid += `<line x1="${f(x1 + (x2 - x1) * t)}" y1="${f(y1 + (y2 - y1) * t)}" x2="${f(x4 + (x3 - x4) * t)}" y2="${f(y4 + (y3 - y4) * t)}" stroke="#4a2410" stroke-width="3"/>`;
    grid += `<line x1="${f(x1 + (x4 - x1) * t)}" y1="${f(y1 + (y4 - y1) * t)}" x2="${f(x2 + (x3 - x2) * t)}" y2="${f(y2 + (y3 - y2) * t)}" stroke="#4a2410" stroke-width="3"/>`;
  }
  return `<path d="M${x1} ${y1} L${x2} ${y2} L${x3} ${y3} L${x4} ${y4} Z" fill="url(#windowGlow)" stroke="#2e1408" stroke-width="5"/>${grid}`;
}

function smallBuddha() {
  return `<g>
    <path d="M540 255 Q640 300 650 470 Q650 600 540 640 Q430 600 430 470 Q440 300 540 255 Z" fill="url(#mandorla)" stroke="#e8b24a" stroke-width="3"/>
    <circle cx="540" cy="420" r="70" fill="url(#headHalo)"/>
    <!-- chân + đài sen -->
    <path d="M462 538 Q540 520 618 538 Q630 566 610 578 Q540 590 470 578 Q450 566 462 538 Z" fill="url(#gold)" stroke="#8a5512" stroke-width="2"/>
    ${Array.from({ length: 7 }, (_, i) => lotusPetal(480 + i * 20, 566, 30, 40, 'url(#petalFront)')).join('')}
    <rect x="452" y="604" width="176" height="16" rx="5" fill="url(#gold)" stroke="#8a5512" stroke-width="2"/>
    <path d="M470 620 L610 620 L622 690 L458 690 Z" fill="#6a1a12" stroke="#d9a646" stroke-width="3"/>
    <!-- thân -->
    <path d="M492 456 Q540 440 588 456 Q600 500 598 540 Q540 552 482 540 Q480 500 492 456 Z" fill="url(#gold)" stroke="#8a5512" stroke-width="2"/>
    <ellipse cx="540" cy="526" rx="30" ry="10" fill="url(#goldLight)" stroke="#8a5512" stroke-width="1.5"/>
    <path d="M510 440 L570 440 L566 460 Q540 466 514 460 Z" fill="url(#goldLight)"/>
    <!-- đầu -->
    <ellipse cx="511" cy="422" rx="5" ry="15" fill="url(#goldLight)"/><ellipse cx="569" cy="422" rx="5" ry="15" fill="url(#goldLight)"/>
    <ellipse cx="540" cy="420" rx="26" ry="30" fill="url(#face)" stroke="#8a5512" stroke-width="1.5"/>
    <path d="M514 414 Q514 388 540 386 Q566 388 566 414 Q556 402 540 401 Q524 402 514 414 Z" fill="#2c2347"/>
    <circle cx="540" cy="382" r="10" fill="#2c2347"/>
    <path d="M528 420 Q533 423 538 420 M542 420 Q547 423 552 420" fill="none" stroke="#5a3410" stroke-width="1.5" stroke-linecap="round"/>
  </g>`;
}

function standingBodhisattva(x) {
  return `<g>
    <circle cx="${x}" cy="470" r="30" fill="url(#headHalo)"/>
    <path d="M${x - 22} 498 Q${x} 486 ${x + 22} 498 L${x + 30} 640 Q${x} 650 ${x - 30} 640 Z" fill="url(#robeWhiteGold)" stroke="#8a5512" stroke-width="2"/>
    <path d="M${x - 10} 520 Q${x} 540 ${x + 10} 520 M${x - 20} 580 Q${x} 600 ${x + 20} 580" fill="none" stroke="#b8862a" stroke-width="2" opacity="0.7"/>
    <ellipse cx="${x}" cy="532" rx="9" ry="12" fill="url(#goldLight)"/>
    <ellipse cx="${x}" cy="474" rx="13" ry="16" fill="url(#face)" stroke="#8a5512" stroke-width="1.2"/>
    <path d="M${x - 14} 470 Q${x - 14} 450 ${x} 448 Q${x + 14} 450 ${x + 14} 470 Q${x + 8} 460 ${x} 459 Q${x - 8} 460 ${x - 14} 470 Z" fill="#f2e6c8"/>
    <path d="M${x - 8} 452 L${x} 436 L${x + 8} 452 Z" fill="#e8b24a"/>
    ${lotusPetal(x - 14, 636, 22, 26, 'url(#petalFront)')}${lotusPetal(x, 632, 24, 30, 'url(#petalFront)')}${lotusPetal(x + 14, 636, 22, 26, 'url(#petalFront)')}
    <rect x="${x - 34}" y="660" width="68" height="40" fill="#5a1a12" stroke="#d9a646" stroke-width="2"/>
  </g>`;
}

function floorCenser() {
  // Đỉnh đồng lớn giữa sàn, miệng đỉnh ở y ~ 900 (que hương của sân khấu cắm vào đây).
  return `<g transform="translate(540 0)">
    <ellipse cx="0" cy="1040" rx="150" ry="22" fill="#000" opacity="0.45"/>
    <path d="M-74 1000 L74 1000 L92 1038 L-92 1038 Z" fill="#4a4048" stroke="#8a7f88" stroke-width="2"/>
    <path d="M-100 905 Q-118 985 -64 1000 L64 1000 Q118 985 100 905 Z" fill="url(#bronze)" stroke="#4a2e0c" stroke-width="3"/>
    <rect x="-112" y="894" width="224" height="18" rx="6" fill="url(#gold)" stroke="#4a2e0c" stroke-width="2"/>
    <path d="M-100 918 q-30 2 -26 34 M100 918 q30 2 26 34" fill="none" stroke="#c99a3a" stroke-width="8" stroke-linecap="round"/>
    <path d="M-50 930 Q0 950 50 930 M-60 965 Q0 985 60 965" fill="none" stroke="#f5d27a" stroke-width="3" opacity="0.6"/>
    <circle cx="0" cy="952" r="18" fill="none" stroke="#ffe39a" stroke-width="3" opacity="0.8"/>
  </g>`;
}

function hallCarpet() {
  const top = 880;
  const L = (y) => 505 - (y - top) * ((505 - 300) / (H - top));
  const R = (y) => 575 + (y - top) * ((780 - 575) / (H - top));
  let border = '';
  for (const k of [0.05, 0.11]) {
    const lt = L(top) + (R(top) - L(top)) * k;
    const lb = L(H) + (R(H) - L(H)) * k;
    const rt = R(top) - (R(top) - L(top)) * k;
    const rb = R(H) - (R(H) - L(H)) * k;
    border += `<line x1="${f(lt)}" y1="${top}" x2="${f(lb)}" y2="${H}" stroke="#d9a646" stroke-width="${k < 0.08 ? 6 : 3}"/>`;
    border += `<line x1="${f(rt)}" y1="${top}" x2="${f(rb)}" y2="${H}" stroke="#d9a646" stroke-width="${k < 0.08 ? 6 : 3}"/>`;
  }
  return `<path d="M${L(top)} ${top} L${R(top)} ${top} L${R(H)} ${H} L${L(H)} ${H} Z" fill="url(#hallCarpet)"/>${border}`;
}

function hallFloor() {
  let lines = '';
  for (let i = -14; i <= 14; i++) {
    lines += `<line x1="${VP.x + i * 20}" y1="880" x2="${VP.x + i * 160}" y2="${H}" stroke="#6b5040" stroke-width="2" opacity="0.4"/>`;
  }
  let y = 892;
  let step = 14;
  while (y < H) {
    lines += `<line x1="0" y1="${f(y)}" x2="${W}" y2="${f(y)}" stroke="#6b5040" stroke-width="2" opacity="0.32"/>`;
    y += step;
    step *= 1.28;
  }
  // phản chiếu ánh đèn trên sàn bóng
  const glows = [[110, 1180], [970, 1180], [200, 1020], [880, 1020], [540, 920]]
    .map(([x, gy]) => `<ellipse cx="${x}" cy="${gy}" rx="70" ry="160" fill="url(#floorGlow)"/>`).join('');
  return `<path d="M0 1250 L250 880 L830 880 L1080 1250 L1080 ${H} L0 ${H} Z" fill="url(#hallFloor)"/>${lines}${glows}`;
}

export function daiDienSvg() {
  const pillars = [[70, 0, 1300, 66], [148, 118, 1088, 42], [198, 190, 984, 30], [230, 228, 922, 21]];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="ceiling" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0a06"/><stop offset="1" stop-color="#3a1a0e"/></linearGradient>
    <linearGradient id="sideWallL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1008"/><stop offset="1" stop-color="#4a1e10"/></linearGradient>
    <linearGradient id="sideWallR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#2a1008"/><stop offset="1" stop-color="#4a1e10"/></linearGradient>
    <linearGradient id="backWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a1a0e"/><stop offset="1" stop-color="#2e0e08"/></linearGradient>
    <linearGradient id="pillar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a0f08"/><stop offset="0.45" stop-color="#8a2a18"/><stop offset="1" stop-color="#2a0a05"/></linearGradient>
    <linearGradient id="lanternBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c0"/><stop offset="1" stop-color="#f0a040"/></linearGradient>
    <linearGradient id="windowGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd890"/><stop offset="1" stop-color="#e09040"/></linearGradient>
    <radialGradient id="lanternGlow"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.75"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
    <radialGradient id="mandorla" cx="0.5" cy="0.45"><stop offset="0" stop-color="#fff2c0"/><stop offset="0.55" stop-color="#f0bf50"/><stop offset="1" stop-color="#a8701c"/></radialGradient>
    <radialGradient id="headHalo"><stop offset="0.45" stop-color="#fff6cc" stop-opacity="0.95"/><stop offset="1" stop-color="#ffd36a" stop-opacity="0"/></radialGradient>
    <radialGradient id="niche" cx="0.5" cy="0.45"><stop offset="0" stop-color="#ffcf70" stop-opacity="0.55"/><stop offset="1" stop-color="#ffb040" stop-opacity="0"/></radialGradient>
    <radialGradient id="floorGlow"><stop offset="0" stop-color="#ffcf7a" stop-opacity="0.32"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset="0.35" stop-color="#f3c54e"/><stop offset="0.75" stop-color="#c88a22"/><stop offset="1" stop-color="#8a5512"/></linearGradient>
    <linearGradient id="goldLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c8"/><stop offset="1" stop-color="#e6b040"/></linearGradient>
    <radialGradient id="face" cx="0.45" cy="0.4"><stop offset="0" stop-color="#fff6d2"/><stop offset="0.7" stop-color="#f4cc62"/><stop offset="1" stop-color="#d49a32"/></radialGradient>
    <linearGradient id="robeWhiteGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf3df"/><stop offset="1" stop-color="#e2c27a"/></linearGradient>
    <linearGradient id="petalFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe4ec"/><stop offset="0.55" stop-color="#f28aa6"/><stop offset="1" stop-color="#e8b24a"/></linearGradient>
    <linearGradient id="bronze" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a3a10"/><stop offset="0.45" stop-color="#e2b24c"/><stop offset="1" stop-color="#5a3a10"/></linearGradient>
    <linearGradient id="hallFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a26"/><stop offset="1" stop-color="#5a4038"/></linearGradient>
    <linearGradient id="hallCarpet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a0e0a"/><stop offset="1" stop-color="#8e1a14"/></linearGradient>
    <linearGradient id="cushion" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d0322a"/><stop offset="1" stop-color="#7a1210"/></linearGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.4" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
  </defs>

  <!-- trần, hai vách bên, vách hậu -->
  <path d="M0 0 L${W} 0 L830 250 L250 250 Z" fill="url(#ceiling)"/>
  ${[60, 130, 185, 222].map((d) => `<path d="M${d} ${d * 0.98} L${W - d} ${d * 0.98}" stroke="#6b3a1a" stroke-width="${Math.max(3, 14 - d / 20)}"/>`).join('')}
  <path d="M0 0 L250 250 L250 880 L0 1250 Z" fill="url(#sideWallL)"/>
  <path d="M${W} 0 L830 250 L830 880 L${W} 1250 Z" fill="url(#sideWallR)"/>
  ${latticeWindow(18, 300, 120, 352, 120, 820, 18, 900)}${latticeWindow(170, 380, 214, 400, 214, 760, 170, 800)}
  ${latticeWindow(1062, 300, 960, 352, 960, 820, 1062, 900)}${latticeWindow(910, 380, 866, 400, 866, 760, 910, 800)}
  <rect x="250" y="250" width="580" height="630" fill="url(#backWall)"/>
  <rect x="262" y="262" width="556" height="606" fill="none" stroke="#d9a646" stroke-width="3" opacity="0.7"/>
  ${[300, 360, 720, 780].map((x) => `<rect x="${x - 18}" y="300" width="36" height="520" rx="4" fill="none" stroke="#b8862a" stroke-width="2" opacity="0.55"/>`).join('')}
  <ellipse cx="540" cy="520" rx="260" ry="330" fill="url(#niche)"/>

  ${smallBuddha()}
  ${standingBodhisattva(400)}${standingBodhisattva(680)}

  <!-- bàn thờ + hàng nến -->
  <rect x="356" y="690" width="368" height="16" fill="url(#gold)" stroke="#8a5512" stroke-width="2"/>
  <rect x="366" y="706" width="348" height="66" fill="#5a140c" stroke="#d9a646" stroke-width="2"/>
  ${[400, 680].map((x) => `<g>${lotusPetal(x - 10, 650, 20, 30, '#ff9fbc')}${lotusPetal(x + 10, 650, 20, 30, '#ff9fbc')}${lotusPetal(x, 644, 22, 36, '#ffc3d4')}<rect x="${x - 14}" y="676" width="28" height="16" fill="url(#gold)"/></g>`).join('').replace(/^/, '')}
  <rect x="380" y="800" width="320" height="10" fill="#d9a646" opacity="0.85"/>
  ${Array.from({ length: 13 }, (_, i) => {
    const x = 392 + i * 24.7;
    return `<g><circle cx="${f(x)}" cy="778" r="16" fill="url(#lanternGlow)"/><rect x="${f(x - 4)}" y="780" width="8" height="22" fill="#fff0d0"/><path d="M${f(x)} 766 Q${f(x + 4)} 774 ${f(x)} 780 Q${f(x - 4)} 774 ${f(x)} 766 Z" fill="#ffc34a"/></g>`;
  }).join('')}

  ${hallFloor()}
  ${hallCarpet()}

  ${pillars.map(([x, t, b, w]) => hallPillar(x, t, b, w) + hallPillar(W - x, t, b, w)).join('')}
  ${palaceLantern(112, 470, 1.0)}${palaceLantern(176, 470, 0.66)}${palaceLantern(216, 470, 0.45)}
  ${palaceLantern(968, 470, 1.0)}${palaceLantern(904, 470, 0.66)}${palaceLantern(864, 470, 0.45)}

  ${floorCenser()}
  ${[140, 268, 392, 688, 812, 940].map(cushion).join('')}
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
</svg>`;
}

if (import.meta.main) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const outDir = join(root, 'public', 'assets', 'backgrounds');
  mkdirSync(outDir, { recursive: true });
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '';
  const jobs = { 'dem-hoa-dang': demHoaDangSvg, 'dai-dien': daiDienSvg };
  await withRasterizer(async (rasterize) => {
    for (const [name, draw] of Object.entries(jobs)) {
      if (only && only !== name) continue;
      writeFileSync(join(outDir, `${name}.webp`), await rasterize(draw(), { width: W, height: H, scale: 2, type: 'image/webp', quality: 0.9 }));
      console.log(`Đã vẽ public/assets/backgrounds/${name}.webp`);
    }
  });
}
