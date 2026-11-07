import type { CSSProperties, ReactNode } from 'react';

/** Point in the drawing's own viewBox coordinates. */
export type Pt = readonly [number, number];
/** Which way the elbow (or knee) bends when there are two solutions. */
export type Bend = 'down' | 'up' | 'out' | 'in';

const deg = (r: number) => (r * 180) / Math.PI;
/** CSS rotation (degrees) that turns a limb drawn hanging straight down (0, 1) to point along v. */
const angleOf = (vx: number, vy: number) => deg(Math.atan2(-vx, vy));

/**
 * Two-bone inverse kinematics: where the elbow goes so the hand lands on `target`.
 * Returns the shoulder rotation and the elbow rotation (relative to the upper arm), in degrees.
 */
export function solveArm(s: Pt, target: Pt, upper: number, fore: number, bend: Bend, side: -1 | 1) {
  let dx = target[0] - s[0];
  let dy = target[1] - s[1];
  let d = Math.hypot(dx, dy) || 1;
  const max = upper + fore - 0.01;
  const min = Math.abs(upper - fore) + 0.5;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  if (d < min) { dx *= min / d; dy *= min / d; d = min; }
  const ux = dx / d;
  const uy = dy / d;
  const a = (upper * upper - fore * fore + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const px = s[0] + a * ux;
  const py = s[1] + a * uy;
  const c1: Pt = [px - h * uy, py + h * ux];
  const c2: Pt = [px + h * uy, py - h * ux];
  // side: -1 = the limb on the viewer's left, +1 = on the viewer's right ("out" = away from the body)
  const pref: Pt = bend === 'down' ? [0, 1] : bend === 'up' ? [0, -1] : bend === 'out' ? [side, 0] : [-side, 0];
  const score = (c: Pt) => (c[0] - px) * pref[0] + (c[1] - py) * pref[1];
  const e = score(c1) >= score(c2) ? c1 : c2;
  const hx = s[0] + dx;
  const hy = s[1] + dy;
  const a1 = angleOf(e[0] - s[0], e[1] - s[1]);
  const a2 = angleOf(hx - e[0], hy - e[1]);
  return { shoulder: a1, elbow: a2 - a1, total: a2 };
}

export const rot = (p: Pt, a: number, transition = true): CSSProperties => ({
  transform: `rotate(${a}deg)`,
  transformOrigin: `${p[0]}px ${p[1]}px`,
  transformBox: 'view-box',
  transition: transition ? 'transform 460ms cubic-bezier(.34,1.32,.5,1)' : undefined,
});

export const pivot = (p: Pt): CSSProperties => ({ transformOrigin: `${p[0]}px ${p[1]}px`, transformBox: 'view-box' });

export type HandKind = 'open' | 'point' | 'fist' | 'thumb';

/**
 * An arm drawn hanging down from the shoulder, then rotated so the hand reaches `target`.
 * `prop` is drawn at the hand, kept upright whatever the arm does.
 */
export function Arm({
  s, target, bend = 'down', side, upper, fore, width, lineW = 2.5, sleeve, sleeveTo = 1, skin, line, hand = 'open', handR, anim, prop,
}: {
  s: Pt; target: Pt; bend?: Bend; side: -1 | 1; upper: number; fore: number; width: number; lineW?: number;
  sleeve: string; sleeveTo?: number; skin: string; line: string; hand?: HandKind; handR: number;
  anim?: string; prop?: ReactNode;
}) {
  const { shoulder, elbow, total } = solveArm(s, target, upper, fore, bend, side);
  const e: Pt = [s[0], s[1] + upper];
  const w: Pt = [s[0], s[1] + upper + fore];
  const hc: Pt = [s[0], w[1] + handR * 0.55];
  const ow = width + lineW * 2;
  // forearm: sleeve down to `sleeveTo` of its length, then bare skin
  const cut = e[1] + fore * sleeveTo;
  const inner = -side; // the thumb sits on the side facing the body
  return (
    <g style={rot(s, shoulder)}>
      <line x1={s[0]} y1={s[1]} x2={e[0]} y2={e[1]} stroke={line} strokeWidth={ow} strokeLinecap="round" />
      <g style={rot(e, elbow)}>
        <g className={anim} style={pivot(e)}>
          <line x1={e[0]} y1={e[1]} x2={w[0]} y2={w[1]} stroke={line} strokeWidth={ow - lineW * 0.4} strokeLinecap="round" />
          {sleeveTo < 1 && <line x1={e[0]} y1={cut} x2={w[0]} y2={w[1]} stroke={skin} strokeWidth={width * 0.8} strokeLinecap="round" />}
          <line x1={e[0]} y1={e[1]} x2={w[0]} y2={Math.min(cut, w[1])} stroke={sleeve} strokeWidth={width - lineW * 0.4} strokeLinecap="round" />
          <Hand c={hc} r={handR} kind={hand} inner={inner} skin={skin} line={line} upright={-total} sw={lineW} />
          {prop && <g style={rot(hc, -total, false)}><g transform={`translate(${hc[0]} ${hc[1]})`}>{prop}</g></g>}
        </g>
      </g>
      {/* the upper arm is drawn last so the shoulder seam covers the elbow joint */}
      <line x1={s[0]} y1={s[1]} x2={e[0]} y2={e[1]} stroke={sleeve} strokeWidth={width} strokeLinecap="round" />
    </g>
  );
}

function Hand({ c, r, kind, inner, skin, line, upright, sw }: { c: Pt; r: number; kind: HandKind; inner: number; skin: string; line: string; upright: number; sw: number }) {
  const [x, y] = c;
  if (kind === 'point') {
    return (
      <g>
        <rect x={x - r * 0.28} y={y} width={r * 0.56} height={r * 2.1} rx={r * 0.28} fill={skin} stroke={line} strokeWidth={sw} />
        <circle cx={x} cy={y} r={r * 0.92} fill={skin} stroke={line} strokeWidth={sw} />
      </g>
    );
  }
  if (kind === 'thumb') {
    return (
      <g>
        <circle cx={x} cy={y} r={r * 0.95} fill={skin} stroke={line} strokeWidth={sw} />
        <g style={rot(c, upright, false)}>
          <rect x={x - r * 0.3} y={y - r * 2} width={r * 0.6} height={r * 1.4} rx={r * 0.3} fill={skin} stroke={line} strokeWidth={sw} />
        </g>
      </g>
    );
  }
  if (kind === 'fist') return <circle cx={x} cy={y} r={r * 0.95} fill={skin} stroke={line} strokeWidth={sw} />;
  return (
    <g>
      <ellipse cx={x + inner * r * 0.75} cy={y - r * 0.15} rx={r * 0.38} ry={r * 0.6} fill={skin} stroke={line} strokeWidth={sw} />
      <ellipse cx={x} cy={y + r * 0.15} rx={r * 0.85} ry={r * 1.08} fill={skin} stroke={line} strokeWidth={sw} />
    </g>
  );
}
