import source from "./data/monbijouV231Navigation.json";
import nativeData from "./data/monbijouV231Native.json";

interface Bridge {
  key: string; ring: Float64Array; bounds: number[]; cx: number; cz: number;
  ux: number; uz: number; half: number; groundY: number; rails: Float32Array;
}
let bridges: Bridge[] | null = null;
function drawn(): Bridge[] {
  return bridges ??= source.bridges.map(b => {
    const a = b.axis[0], c = b.axis[b.axis.length - 1], length = Math.hypot(c[0] - a[0], c[1] - a[1]);
    return { key: b.key, ring: Float64Array.from(b.ring.flat()), bounds: b.bounds.slice(),
      cx: (a[0] + c[0]) / 2, cz: (a[1] + c[1]) / 2, ux: (c[0] - a[0]) / length,
      uz: (c[1] - a[1]) / length, half: b.half, groundY: b.groundY,
      rails: Float32Array.from(b.railBoxes.flatMap(r => r.slice(0, 7))) };
  });
}
function inside(r: Float64Array, x: number, z: number): boolean {
  let yes = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2)
    if ((r[i + 1] > z) !== (r[j + 1] > z) && x < (r[j] - r[i]) * (z - r[i + 1]) / (r[j + 1] - r[i + 1]) + r[i]) yes = !yes;
  return yes;
}
function bounded(b: number[], x: number, z: number, r = 0): boolean {
  return x >= b[0] - r && x <= b[2] + r && z >= b[1] - r && z <= b[3] + r;
}
function levels(b: Bridge, x: number, z: number): [number, number] {
  const t = (x - b.cx) * b.ux + (z - b.cz) * b.uz;
  const s = Math.max(0, Math.cos(Math.PI / 2 * Math.min(1, Math.abs(t) / b.half)));
  const top = b.groundY + .34 * s;
  return [b.key === "north" ? top - (2.3 - .4 * s) : Math.abs(t) < 9 ? .25 + 4.1 * Math.sqrt(Math.max(0, 1 - (t / 9) ** 2)) : -1.4, top];
}

// Native navigation copies only actual final box bounds once, never decoded
// colour/geometry payloads. Small spatial buckets avoid scanning both bridges.
interface NativeIndex { bounds: number[]; boxes: Float32Array; bodyCount: number; cells: Map<string, Uint32Array> }
let nativeIndex: NativeIndex[] | null = null;
function natives(): NativeIndex[] {
  return nativeIndex ??= nativeData.sites.filter(s => s.key !== "park").map(site => {
    const boxes = new Float32Array((site.body.length + site.fittings.length) * 6);
    const cells = new Map<string, number[]>(), bounds = [Infinity, Infinity, -Infinity, -Infinity];
    let i = 0;
    for (const rows of [site.body, site.fittings]) for (const [x, y, z, w, h, d] of rows) {
      const x0 = x - w / 2, z0 = z - d / 2, x1 = x + w / 2, z1 = z + d / 2;
      boxes.set([x0, y - h / 2, z0, x1, y + h / 2, z1], i * 6);
      bounds[0] = Math.min(bounds[0], x0); bounds[1] = Math.min(bounds[1], z0);
      bounds[2] = Math.max(bounds[2], x1); bounds[3] = Math.max(bounds[3], z1);
      for (let gx = Math.floor(x0 / 4); gx <= Math.floor(x1 / 4); gx++)
        for (let gz = Math.floor(z0 / 4); gz <= Math.floor(z1 / 4); gz++) {
          const key = `${gx}:${gz}`, found = cells.get(key);
          if (found) found.push(i * 6); else cells.set(key, [i * 6]);
        }
      i++;
    }
    return { bounds, boxes, bodyCount: site.body.length, cells: new Map([...cells].map(([k, v]) => [k, Uint32Array.from(v)])) };
  });
}

/** Exact represented bridge deck, also used as the water-crossing override. */
export function monbijouV231DeckAt(x: number, z: number, native = false): number | null {
  if (native) {
    let top: number | null = null;
    for (const s of natives()) if (bounded(s.bounds, x, z)) {
      const a = s.boxes;
      for (const i of s.cells.get(`${Math.floor(x / 4)}:${Math.floor(z / 4)}`) ?? [])
        if (i < s.bodyCount * 6 && x >= a[i] && x <= a[i + 3] && z >= a[i + 2] && z <= a[i + 5]) top = Math.max(top ?? -Infinity, a[i + 4]);
    }
    return top;
  }
  for (const b of drawn()) if (bounded(b.bounds, x, z) && inside(b.ring, x, z)) return levels(b, x, z)[1];
  return null;
}
export function monbijouV231GroundAt(x: number, z: number, feet: number, native = false): number | null {
  const top = monbijouV231DeckAt(x, z, native);
  return top !== null && top <= feet + .45 ? top : null;
}
export function monbijouV231SolidAt(x: number, y: number, z: number, radius = 0, native = false): boolean {
  if (native) {
    for (const s of natives()) if (bounded(s.bounds, x, z, radius)) {
      const a = s.boxes;
      for (let gx = Math.floor((x - radius) / 4); gx <= Math.floor((x + radius) / 4); gx++)
        for (let gz = Math.floor((z - radius) / 4); gz <= Math.floor((z + radius) / 4); gz++)
          for (const i of s.cells.get(`${gx}:${gz}`) ?? []) {
            if (y <= a[i + 1] || y >= a[i + 4]) continue;
            const dx = Math.max(a[i] - x, 0, x - a[i + 3]), dz = Math.max(a[i + 2] - z, 0, z - a[i + 5]);
            if (dx * dx + dz * dz <= radius * radius) return true;
          }
    }
    return false;
  }
  for (const b of drawn()) if (bounded(b.bounds, x, z, radius + 1)) {
    const [low, top] = levels(b, x, z);
    if (y > low && y < top && inside(b.ring, x, z)) return true;
    const a = b.rails;
    for (let i = 0; i < a.length; i += 7) {
      if (y <= a[i + 1] - a[i + 4] / 2 || y >= a[i + 1] + a[i + 4] / 2) continue;
      const dx = x - a[i], dz = z - a[i + 2], c = Math.cos(a[i + 6]), s = Math.sin(a[i + 6]);
      const u = Math.max(Math.abs(c * dx - s * dz) - a[i + 3] / 2, 0), v = Math.max(Math.abs(s * dx + c * dz) - a[i + 5] / 2, 0);
      if (u * u + v * v <= radius * radius) return true;
    }
  }
  return false;
}
