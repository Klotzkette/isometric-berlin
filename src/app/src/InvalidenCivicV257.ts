import source from './data/invalidenCivicV257.json';
import { letteringStrokePaths } from './drawnLettering';
import { invalidenEntryTreadsV257 } from './invalidenCivicV257Navigation';
type Vec = [number, number, number];
type Face = { a: number[]; b: number[]; normal: number[]; bottom: number; top: number };
interface Parts { native: boolean; box(p: Vec, size: Vec, color: number, yaw?: number): void; }
export const INVALIDEN_CIVIC_V257 = source;
const C = { stone: 0x6d7976, joint: 0x596562, glass: 0x66858b, metal: 0x414d50, pale: 0xd5cdb9, trim: 0xe4dcc8, frame: 0x80765f, silver: 0xb4c2bf };
function length(f: Face) { return Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]); }
function at(f: Face, u: number, y: number, out = 0): Vec { const l = length(f); return [f.a[0] + (f.b[0] - f.a[0]) * u / l + f.normal[0] * out, y, f.a[1] + (f.b[1] - f.a[1]) * u / l + f.normal[1] * out]; }
/** Native world-axis strips are generated independently; never rotate drawn cells. */
function patch(b: Parts, f: Face, u: number, y: number, w: number, h: number, color: number, out = .36, depth = .08) {
  const l = length(f), dx = (f.b[0] - f.a[0]) / l, dz = (f.b[1] - f.a[1]) / l;
  if (!b.native) { b.box(at(f, u, y, out), [w, h, depth], color, -Math.atan2(dz, dx)); return; }
  const n = Math.max(1, Math.ceil(w / 1.1));
  for (let i = 0; i < n; i++) b.box(at(f, u - w / 2 + (i + .5) * w / n, y, out + 1.05), [Math.max(.07, Math.abs(dx) * w / n + Math.abs(f.normal[0]) * depth), h, Math.max(.07, Math.abs(dz) * w / n + Math.abs(f.normal[1]) * depth)], color);
}
function stroke(b: Parts, a: Vec, c: Vec, width: number, color: number) {
  const n = Math.max(1, Math.ceil(Math.hypot(...c.map((v, k) => v - a[k])) / (b.native ? .23 : .11)));
  for (let i = 0; i < n; i++) b.box(a.map((v, k) => v + (c[k] - v) * (i + .5) / n) as Vec, [Math.max(width, Math.abs(c[0] - a[0]) / n), Math.max(width, Math.abs(c[1] - a[1]) / n), Math.max(width, Math.abs(c[2] - a[2]) / n)], color);
}
function label(b: Parts, f: Face, u: number) {
  const paths = letteringStrokePaths('BUNDESMINISTERIUM FUER VERKEHR', .45), pts = paths.flat();
  const mid = (Math.min(...pts.map(p => p[0])) + Math.max(...pts.map(p => p[0]))) / 2;
  for (const p of paths) for (let i = 1; i < p.length; i++) stroke(b, at(f, u + p[i - 1][0] - mid, 10.1 + p[i - 1][1], .75 + (b.native ? 1.05 : 0)), at(f, u + p[i][0] - mid, 10.1 + p[i][1], .75 + (b.native ? 1.05 : 0)), .05, C.metal);
}
function ministry(b: Parts) {
  for (const key of ['historic', 'dudlerC', 'dudlerD'] as const) {
    const historic = key === 'historic';
    for (const f of source.sites[key].faces) {
      const l = length(f), low = f.bottom + .08, top = f.top - .12;
      patch(b, f, l / 2, (low + top) / 2, l - .06, top - low, historic ? C.pale : C.stone);
      const levels = historic ? [8.45, 14, 19.6, 25.1] : [8.3, 12.6, 16.3, 20, 23.7, 27.4];
      const n = Math.max(2, Math.round(l / (historic ? 3.7 : 4.35))), pitch = (l - 1.4) / n;
      for (let row = 0; row < levels.length; row++) for (let i = 0; i < n; i++) {
        const y = levels[row], u = .7 + (i + .5) * pitch, w = historic ? Math.min(1.5, pitch * .55) : pitch * .72, h = historic ? 3 : 2.65;
        if (y + h / 2 + .25 >= top) continue;
        if (key === 'dudlerC' && f.index === 3 && row === 0 && i >= 2 && i <= n - 2) continue;
        patch(b, f, u, y, w + .22, h + .2, historic ? C.frame : C.metal, .48);
        patch(b, f, u, y, w, h, (i + row) % 5 === 0 ? 0x92a8a7 : C.glass, .59);
        patch(b, f, u + w * .15, y, .075, h, historic ? C.frame : C.silver, .70);
        patch(b, f, u, y - h * .12, w, .065, historic ? C.frame : C.silver, .70);
        if (historic) {
          patch(b, f, u, y - h / 2 - .16, w + .4, .19, C.trim, .63, .29);
          patch(b, f, u, y + h / 2 + .16, w + .38, .18, C.trim, .60, .25);
          if (row === 0) for (let j = 0; j < 12; j++) { const a = Math.PI * j / 12, c = Math.PI * (j + 1) / 12; stroke(b, at(f, u + Math.cos(a) * (w / 2 + .22), y + .95 + Math.sin(a) * .8, .72 + (b.native ? 1.05 : 0)), at(f, u + Math.cos(c) * (w / 2 + .22), y + .95 + Math.sin(c) * .8, .72 + (b.native ? 1.05 : 0)), .10, C.trim); }
        }
      }
      for (const y of historic ? [5.6, 11.7, 28.3] : [5.6, top - .15]) if (y < top) patch(b, f, l / 2, y, l - .04, historic ? .26 : .16, historic ? C.trim : C.joint, .55, .22);
      for (let y = historic ? 5.8 : low + 1.3; y < (historic ? 11.5 : top); y += historic ? .65 : 1.3) patch(b, f, l / 2, y, l - .07, .025, historic ? 0xa59c89 : C.joint, .43);
    }
  }
  const f = source.sites.dudlerC.faces.find(f => f.index === 3)!, u = length(f) * .56;
  patch(b, f, u, 8.15, 16.5, 2.8, C.metal, .62);
  for (let i = 0; i < 7; i++) { patch(b, f, u - 6.9 + i * 2.3, 8.2, 2.08, 2.65, C.glass, .73); patch(b, f, u - 5.85 + i * 2.3, 8.2, .08, 2.65, C.silver, .83); }
  label(b, f, u);
  // Low photo-fitted entry treads, without a new enclosing wall or canopy.
  for (const t of invalidenEntryTreadsV257(b.native)) b.box(t.p, t.size, 0xb5b8ac, t.yaw);
}
function plant(b: Parts) {
  for (const f of source.sites.plant.faces) {
    const l = length(f), lo = f.bottom + .08, hi = f.top - .15, h = Math.min(1.7, (hi - lo) * .25), y = hi - h / 2 - .65;
    patch(b, f, l / 2, (lo + hi) / 2, l - .05, hi - lo, 0x7e8c8b, .32);
    for (let u = .5; u < l; u += 1.2) patch(b, f, u, (lo + hi) / 2, .045, hi - lo, 0x657776, .43);
    patch(b, f, l / 2, y, l - 1.8, h, C.glass, .52);
    for (let u = 1.6; u < l - 1.2; u += 2.5) patch(b, f, u, y, .1, h, C.silver, .64);
  }
  for (const stack of source.stacks) {
    const [x, z] = stack.point, bottom = 5.2, r = stack.radiusEstimate;
    if (b.native) {
      b.box([x, bottom + 17.4, z], [3.6, 34.8, 3.6], C.silver);
      b.box([x, bottom + 34.75, z], [3.9, .5, 3.9], 0x7f918f);
      for (const dx of [-.85, .85]) b.box([x + dx, bottom + 34.93, z], [1.25, .14, 2.2], 0x354b4f);
      for (const y of [5.6, 16.8, 28, 39.8]) for (const d of [-1, 1]) { b.box([x + d * 1.88, y, z], [.16, .18, 3.9], 0x7c8c8a); b.box([x, y, z + d * 1.88], [3.9, .18, .16], 0x7c8c8a); }
    } else {
      // Sixteen tangent plates keep circular shafts in the existing box batch.
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; b.box([x + Math.cos(a) * r, bottom + 17.5, z + Math.sin(a) * r], [.76, 35, .16], i % 3 === 0 ? 0xcbd2cc : C.silver, Math.PI / 2 - a); }
      for (const dx of [-.76, .76]) b.box([x + dx, bottom + 34.9, z], [1.2, .1, 1.8], 0x354b4f);
      for (const y of [5.6, 16.8, 28, 39.8]) for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; b.box([x + Math.cos(a) * (r + .06), y, z + Math.sin(a) * (r + .06)], [.83, .14, .18], 0x7c8c8a, Math.PI / 2 - a); }
    }
    for (const dx of [-.24, .24]) b.box([x + dx, bottom + 17.4, z + r + .15], [.07, 34.5, .07], 0x667a7c);
    for (let y = bottom + .5; y < bottom + 34.5; y += .65) b.box([x, y, z + r + .17], [.55, .05, .07], 0x667a7c);
  }
}
export function appendInvalidenCivicV257(b: Parts) {
  ministry(b); plant(b);
  return { sourceOwners: Object.values(source.sites).map(s => s.owner), chimneyNodeIds: source.stacks.map(s => s.osmNode), chimneyHeightM: 35, oldChimneyAlreadyAbsent: true, sourceEnvelopesRetained: true, fullStaticDetailOnTouch: true, nativeOrthogonal: b.native, drawCallsAdded: 0 };
}
