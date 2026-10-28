import source from './data/moabitCoalV281.json';

export type CoalPointV281 = [number, number, number];
export type CoalMemberV281 = { a: CoalPointV281; b: CoalPointV281; width: number; depth: number; tone: number; role: string };
export type CoalBoxV281 = [number, number, number, number, number, number, number];
export type CoalFacetV281 = [CoalPointV281, CoalPointV281, CoalPointV281];
export const MOABIT_COAL_V281 = Object.freeze({
  ...source, groundY: 5.2, nativeCell: 2,
  cranePositionFraction: .65, bridgeBottomHeight: 15, bridgeDepth: 4.2,
  sourceUrls: ['https://www.openstreetmap.org/way/26624547', 'https://www.openstreetmap.org/way/896589831', 'https://www.openstreetmap.org/way/896589832'],
  interpretation: 'Mapped heap, crane travel envelope and conveyors; machine pose, stockpiles and every unmeasured vertical/member dimension are display estimates. No prior source owner is retired.',
});
const P = MOABIT_COAL_V281, G = P.groundY;
const STEEL = 0x74816b, DARK = 0x414b43, RAIL = 0x525c55, BELT = 0x313834, GLASS = 0x526968;

export function moabitCoalInsideV281(x: number, z: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Independent source frame: the OSM portal ring is the travel area, not a roof. */
export function moabitCoalFrameV281() {
  const [ne, se, sw, nw] = P.craneTravel.ring;
  const width = Math.hypot(ne[0] - nw[0], ne[1] - nw[1]);
  const length = Math.hypot(sw[0] - nw[0], sw[1] - nw[1]);
  const u = [(ne[0] - nw[0]) / width, (ne[1] - nw[1]) / width];
  const v = [(sw[0] - nw[0]) / length, (sw[1] - nw[1]) / length];
  const at = (x: number, y: number, z: number): CoalPointV281 => [nw[0] + u[0] * x + v[0] * z, G + y, nw[1] + u[1] * x + v[1] * z];
  return { width, length, u, v, at, opposite: se };
}

/** A bounded recognition recipe, reused by rendering and collision. All gaps
 * between the narrow posts/trusses remain open, especially the public road. */
export function moabitCoalMembersV281(): CoalMemberV281[] {
  const out: CoalMemberV281[] = [], f = moabitCoalFrameV281();
  const add = (a: CoalPointV281, b: CoalPointV281, width: number, depth = width, tone = STEEL, role = 'steel') => out.push({ a, b, width, depth, tone, role });
  const line = (a: CoalPointV281, b: CoalPointV281, w: number, d = w, c = STEEL, role = 'steel') => add(f.at(...a), f.at(...b), w, d, c, role);
  const x = f.width * P.cranePositionFraction, length = f.length, lo = P.bridgeBottomHeight, hi = lo + P.bridgeDepth;
  // Two actual travel rails, each spanning the mapped operating area.
  for (const z of [0, length]) {
    line([0, .18, z], [f.width, .18, z], .2, .2, RAIL, 'travel-rail');
    for (const dx of [-3.3, 3.3]) {
      line([x + dx, .65, z], [x + dx, 1.25, z], 1.6, 1.2, DARK, 'wheel-bogie');
      line([x + dx, 1.25, z], [x + dx * .48, lo, z + (z ? -1.4 : 1.4)], .58, .7, STEEL, 'portal-leg');
    }
    line([x - 4.5, 1.45, z], [x + 4.5, 1.45, z], .65, .75, STEEL, 'bogie-beam');
    line([x - 3.3, 2, z], [x + 1.6, lo - .4, z], .25, .25, STEEL, 'portal-brace');
    line([x + 3.3, 2, z], [x - 1.6, lo - .4, z], .25, .25, STEEL, 'portal-brace');
  }
  // Long, open lattice bridge. No solid rectangular gantry envelope.
  for (const side of [-1, 1]) {
    const bx = x + side * 2.05;
    for (const y of [lo, hi]) line([bx, y, -1.6], [bx, y, length + 1.6], .38, .45, STEEL, 'bridge-chord');
    const bays = 15, step = (length + 3.2) / bays;
    for (let i = 0; i <= bays; i++) {
      const z = -1.6 + i * step;
      line([bx, lo, z], [bx, hi, z], .22, .26, STEEL, 'lattice-upright');
      if (i < bays) line([bx, i % 2 ? hi : lo, z], [bx, i % 2 ? lo : hi, z + step], .24, .24, STEEL, 'lattice-diagonal');
    }
    line([bx + side * .5, hi + .12, -1.6], [bx + side * .5, hi + .12, length + 1.6], .1, .12, DARK, 'maintenance-walkway');
    line([bx + side * .8, hi + 1.05, -1.6], [bx + side * .8, hi + 1.05, length + 1.6], .075, .075, STEEL, 'handrail');
    for (let z = 0; z <= length; z += 5) line([bx + side * .8, hi + .12, z], [bx + side * .8, hi + 1.05, z], .075, .075, STEEL, 'rail-post');
  }
  for (let z = -1.6; z <= length + 1.6; z += 5) {
    line([x - 2.05, lo, z], [x + 2.05, lo, z], .26, .3, STEEL, 'cross-girder');
    line([x - 2.05, hi, z], [x + 2.05, hi, z], .18, .18, STEEL, 'top-girder');
  }
  // Suspended travelling trolley/cabin and two-jaw grab in a static pose.
  const trolley = length * .29;
  line([x, hi + .65, trolley - 2], [x, hi + .65, trolley + 2], 3.5, 1.3, DARK, 'trolley');
  line([x + 4.1, hi - .2, trolley - 1.7], [x + 4.1, hi - .2, trolley + 1.7], 2.4, 2.5, STEEL, 'cab');
  line([x + 5.32, hi, trolley - 1.38], [x + 5.32, hi, trolley + 1.38], .05, 1.05, GLASS, 'cab-window');
  for (const dx of [-.52, .52]) line([x + dx, lo - .3, trolley], [x + dx, 10.1, trolley], .075, .075, DARK, 'grab-cable');
  line([x - .7, 10, trolley], [x + .7, 10, trolley], .4, .5, DARK, 'grab-head');
  for (const side of [-1, 1]) {
    line([x, 9.9, trolley], [x + side * 1.65, 8.6, trolley], .25, .25, STEEL, 'grab-link');
    line([x + side * 1.65, 8.6, trolley - 1.2], [x + side * 1.65, 8.6, trolley + 1.2], .45, 1.05, DARK, 'grab-jaw');
    line([x + side * 1.65, 8.6, trolley], [x + side * .1, 8.05, trolley], .27, 2.4, DARK, 'grab-bucket');
  }
  // Two full OSM rings and the explicitly estimated DOP north-yard continuation.
  for (const [role, item] of [['quay-conveyor', P.quayConveyor], ['road-conveyor', P.roadConveyor], ['yard-conveyor', P.yardConveyor]] as const) {
    const r = item.ring;
    const a: CoalPointV281 = [(r[0][0] + r[3][0]) / 2, G + 7.8, (r[0][1] + r[3][1]) / 2];
    const b: CoalPointV281 = [(r[1][0] + r[2][0]) / 2, G + 7.8, (r[1][1] + r[2][1]) / 2];
    const dx = b[0] - a[0], dz = b[2] - a[2], distance = Math.hypot(dx, dz), nx = dz / distance, nz = -dx / distance;
    const offset = (p: CoalPointV281, side: number, y: number): CoalPointV281 => [p[0] + nx * side, p[1] + y, p[2] + nz * side];
    add(a, b, 2.6, .24, BELT, role + '-belt');
    for (const side of [-1.52, 1.52]) {
      add(offset(a, side, -.55), offset(b, side, -.55), .18, .18, STEEL, role + '-chord');
      add(offset(a, side, .85), offset(b, side, .85), .18, .18, STEEL, role + '-chord');
    }
    const bays = Math.ceil(distance / 5);
    for (let i = 0; i <= bays; i++) {
      const p: CoalPointV281 = [a[0] + dx * i / bays, a[1], a[2] + dz * i / bays];
      add(offset(p, -1.52, -.55), offset(p, 1.52, -.55), .16, .16, STEEL, role + '-roller');
      for (const side of [-1.52, 1.52]) add(offset(p, side, -.55), offset(p, side, .85), .12, .12, STEEL, role + '-frame');
    }
    // Road crossing has end supports only: no column in Friedrich-Krause-Ufer.
    const supports = role === 'road-conveyor' ? [0, 1] : [0, .25, .5, .75, 1];
    for (const t of supports) for (const side of [-1.35, 1.35]) {
      const p: CoalPointV281 = [a[0] + dx * t + nx * side, G, a[2] + dz * t + nz * side];
      add(p, [p[0], G + 7.2, p[2]], .32, .32, STEEL, role + '-support');
    }
  }
  // Open waterside ship-unloading portal at its distinct mapped narrow ring.
  const r = P.shipUnloader.ring, shore = [(r[2][0] + r[3][0]) / 2, (r[2][1] + r[3][1]) / 2];
  const end = [(r[0][0] + r[1][0]) / 2, (r[0][1] + r[1][1]) / 2];
  const dx = end[0] - shore[0], dz = end[1] - shore[1], distance = Math.hypot(dx, dz), ux = dx / distance, uz = dz / distance;
  const quay = (x: number, y: number, z: number): CoalPointV281 => [shore[0] + uz * x + ux * z, G + y, shore[1] - ux * x + uz * z];
  for (const side of [-2.6, 2.6]) {
    for (const z of [0, 7]) add(quay(side, 0, z), quay(side, 13, z), .48, .48, STEEL, 'ship-portal-leg');
    for (const y of [10.4, 13]) add(quay(side, y, -1), quay(side, y, distance), .32, .38, STEEL, 'ship-boom-chord');
    for (let z = 0; z < distance; z += 4) add(quay(side, 10.4, z), quay(side, 13, Math.min(z + 4, distance)), .2, .2, STEEL, 'ship-boom-brace');
  }
  for (const z of [0, 7, distance]) add(quay(-2.6, 13, z), quay(2.6, 13, z), .3, .3, STEEL, 'ship-crossbar');
  add(quay(0, 10.2, 4), quay(0, 10.2, 7), 4, 1.8, DARK, 'ship-hopper');
  for (const side of [-.45, .45]) add(quay(side, 11, 21), quay(side, 3.7, 21), .075, .075, DARK, 'ship-grab-cable');
  for (const side of [-1, 1]) add(quay(side * 1.2, 3.6, 21), quay(side * .15, 2.75, 21), .32, 2.2, DARK, 'ship-grab-jaw');
  return out;
}

/** Faceted piles are illustrative inventory, strictly inside the mapped heap. */
export function moabitCoalFacetsV281(): CoalFacetV281[] {
  const f = moabitCoalFrameV281(), out: CoalFacetV281[] = [];
  const piles = [[22, 19, 18, 13, 6.2], [49, 22, 21, 16, 8], [77, 19, 17, 13, 6.8], [25, 49, 19, 15, 6.9], [56, 49, 21, 15, 7.6], [81, 48, 13, 13, 4.8]];
  for (const [u, v, ru, rv, h] of piles) {
    const top = f.at(u + 1.3, h, v - .7), n = 14;
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * i / n, b = 2 * Math.PI * (i + 1) / n;
      out.push([top, f.at(u + Math.cos(a) * ru, .045, v + Math.sin(a) * rv), f.at(u + Math.cos(b) * ru, .045, v + Math.sin(b) * rv)]);
    }
  }
  return out;
}

function facetTop(triangle: CoalFacetV281, x: number, z: number): number | null {
  const [a, b, c] = triangle, det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(det) < 1e-10) return null;
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
  const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
  return Math.min(u, v, 1 - u - v) >= -1e-7 ? u * a[1] + v * b[1] + (1 - u - v) * c[1] : null;
}
const FACETS = moabitCoalFacetsV281();
function drawnTop(x: number, z: number): number | null {
  if (!moabitCoalInsideV281(x, z, P.heap.ring)) return null;
  let y = G + .045;
  for (const facet of FACETS) y = Math.max(y, facetTop(facet, x, z) ?? G);
  return y;
}
export function moabitCoalFloorV281At(x: number, z: number, native = false): number | null {
  if (x < -1574 || x > -1460 || z < -2148 || z > -2063) return null;
  if (!native) return drawnTop(x, z);
  const step = P.nativeCell, cx = (Math.floor(x / step) + .5) * step, cz = (Math.floor(z / step) + .5) * step;
  const h = step / 2 - .001;
  if (!moabitCoalInsideV281(cx - h, cz - h, P.heap.ring) || !moabitCoalInsideV281(cx + h, cz - h, P.heap.ring)
    || !moabitCoalInsideV281(cx - h, cz + h, P.heap.ring) || !moabitCoalInsideV281(cx + h, cz + h, P.heap.ring)) return null;
  const top = drawnTop(cx, cz);
  return top === null ? null : G + Math.max(.045, Math.ceil((top - G) * 4) / 4);
}

/** World-cardinal staircase construction with no rotated native matrices. */
export function moabitCoalNativeMembersV281(): CoalBoxV281[] {
  const rows: CoalBoxV281[] = [];
  for (const p of moabitCoalMembersV281()) {
    const dx = p.b[0] - p.a[0], dy = p.b[1] - p.a[1], dz = p.b[2] - p.a[2];
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / 1.15));
    const horizontal = Math.hypot(dx, dz), sx = horizontal ? Math.abs(dz / horizontal) : 1, sz = horizontal ? Math.abs(dx / horizontal) : 0;
    const length = Math.hypot(dx, dy, dz), vx = length ? Math.abs(dy / length) * sz : 0, vz = length ? Math.abs(dy / length) * sx : 0;
    const wy = length ? horizontal / length * p.depth : p.depth;
    for (let i = 0; i < n; i++) rows.push([
      p.a[0] + dx * (i + .5) / n, p.a[1] + dy * (i + .5) / n, p.a[2] + dz * (i + .5) / n,
      Math.max(.075, Math.abs(dx / n) + sx * p.width + vx * p.depth), Math.max(.075, Math.abs(dy / n) + wy),
      Math.max(.075, Math.abs(dz / n) + sz * p.width + vz * p.depth), p.tone,
    ]);
  }
  return rows;
}

let nativeCollision: Float32Array | undefined;
let drawnCollision: Float64Array | undefined;
function compiledMembers(): Float64Array {
  const result: number[] = [];
  for (const p of moabitCoalMembersV281()) {
    const d = p.b.map((v, i) => v - p.a[i]), length = Math.hypot(...d), horizontal = Math.hypot(d[0], d[2]);
    const along = d.map(v => v / length), side = horizontal ? [d[2] / horizontal, 0, -d[0] / horizontal] : [1, 0, 0];
    const depth = [-along[1] * side[2], along[0] * side[2] - along[2] * side[0], along[1] * side[0]];
    result.push(...p.a.map((v, i) => (v + p.b[i]) / 2), ...side, ...along, ...depth, p.width / 2, length / 2, p.depth / 2);
  }
  return new Float64Array(result);
}
/** Granular solids only; this does not close the site boundary or the canal. */
export function moabitCoalBodyBlockedV281(x: number, z: number, bottom: number, top: number, radius = .3, native = false): boolean {
  if (x < -1615 || x > -1458 || z < -2207 || z > -2059) return false;
  const pile = moabitCoalFloorV281At(x, z, native);
  if (pile !== null && top > G && bottom < pile - .04) return true;
  if (native) {
    const data = nativeCollision ??= new Float32Array(moabitCoalNativeMembersV281().flat());
    for (let i = 0; i < data.length; i += 7) if (Math.abs(x - data[i]) < data[i + 3] / 2 + radius && Math.abs(z - data[i + 2]) < data[i + 5] / 2 + radius
      && top > data[i + 1] - data[i + 4] / 2 && bottom < data[i + 1] + data[i + 4] / 2) return true;
    return false;
  }
  const data = drawnCollision ??= compiledMembers();
  for (let p = 0; p < data.length; p += 15) {
    let enter = 0, exit = 1;
    for (let i = 0; i < 3; i++) {
      const offset = p + 3 + i * 3, ax = data[offset], ay = data[offset + 1], az = data[offset + 2];
      const a = (x - data[p]) * ax + (bottom - data[p + 1]) * ay + (z - data[p + 2]) * az;
      const delta = (top - bottom) * ay, bound = data[p + 12 + i] + radius * Math.hypot(ax, az);
      if (Math.abs(delta) < 1e-9) { if (Math.abs(a) > bound) { enter = 2; break; } }
      else { const lo = (-bound - a) / delta, hi = (bound - a) / delta; enter = Math.max(enter, Math.min(lo, hi)); exit = Math.min(exit, Math.max(lo, hi)); }
    }
    if (enter <= exit) return true;
  }
  return false;
}
