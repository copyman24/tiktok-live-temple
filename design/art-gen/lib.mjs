// Shared helpers for the procedural art generators.
// Shapes are closed Catmull-Rom splines through point lists, so body parts and
// architecture can be described as a handful of profile points.

export function spline(points, closed = true) {
  const n = points.length;
  const at = (i) => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(points[0][0])},${f(points[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}

// Symmetric (or skewed) body from a vertical profile: [[y, halfWidthLeft, halfWidthRight?], ...]
export function profile(cx, rows, bottomBulge = 0) {
  const right = rows.map(([y, l, r = l]) => [cx + r, y]);
  const left = rows.map(([y, l]) => [cx - l, y]).reverse();
  const top = rows[0][0];
  const bottom = rows[rows.length - 1][0];
  const pts = [[cx, top - 2], ...right];
  if (bottomBulge) pts.push([cx, bottom + bottomBulge]);
  pts.push(...left);
  return spline(pts);
}

export function f(n) {
  return Math.round(n * 100) / 100;
}

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function svgDoc(w, h, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
}
