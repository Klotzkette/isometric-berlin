import data from "./data/colonnadesV231Navigation.json";
import construction from "./data/colonnadesV231.json";

const CELL = 8;
type NativeIndex = { bounds: number[]; boxes: Float32Array; cells: Map<string, Uint32Array> };
let blocks: NativeIndex | null = null;

/** Only compact collision bounds survive construction; weak render rows do not. */
function nativeIndex(): NativeIndex {
  if (blocks) return blocks;
  const rows = construction.sites[0].nativeRows, boxes = new Float32Array(rows.length * 6);
  const bounds = [Infinity, Infinity, -Infinity, -Infinity], staging = new Map<string, number[]>();
  rows.forEach(([x, y, z, w, h, d], i) => {
    const a = [x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2];
    boxes.set(a, i * 6);
    bounds[0] = Math.min(bounds[0], a[0]); bounds[1] = Math.min(bounds[1], a[2]);
    bounds[2] = Math.max(bounds[2], a[3]); bounds[3] = Math.max(bounds[3], a[5]);
    for (let gz = Math.floor(a[2] / CELL); gz <= Math.floor(a[5] / CELL); gz++)
      for (let gx = Math.floor(a[0] / CELL); gx <= Math.floor(a[3] / CELL); gx++) {
        const key = `${gx},${gz}`, offsets = staging.get(key);
        if (offsets) offsets.push(i * 6); else staging.set(key, [i * 6]);
      }
  });
  const cells = new Map<string, Uint32Array>();
  for (const [key, offsets] of staging) cells.set(key, Uint32Array.from(offsets));
  return blocks = { bounds, boxes, cells };
}
function inBounds(bounds: number[], x: number, z: number, radius = 0): boolean {
  return x >= bounds[0] - radius && x <= bounds[2] + radius && z >= bounds[1] - radius && z <= bounds[3] + radius;
}
function inside(ring: number[][], x: number, z: number): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
function floorContains(x: number, z: number): boolean {
  return data.rings.some(p => inside(p.ring, x, z) && !p.holes.some(h => inside(h, x, z)));
}
function sourceRoofAt(x: number, z: number): number | null {
  let y: number | null = null;
  for (const [a, b, c] of data.roofTriangles) {
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-9) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    if (u >= -1e-7 && v >= -1e-7 && u + v <= 1.0000001)
      y = Math.max(y ?? -Infinity, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
  }
  return y;
}
function drawnRoofAt(x: number, z: number): number | null {
  let top = sourceRoofAt(x, z);
  for (const [cx, y, cz, r, rise] of data.domes) {
    const q = ((x - cx) ** 2 + (z - cz) ** 2) / (r * r);
    if (q < 1) top = Math.max(top ?? -Infinity, y + rise * Math.sqrt(1 - q));
  }
  return top;
}
function nativeSupportAt(x: number, z: number, limit: number): number | null {
  const index = nativeIndex(); if (!inBounds(index.bounds, x, z)) return null;
  const offsets = index.cells.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
  if (!offsets) return null;
  let top: number | null = null; const b = index.boxes;
  for (const i of offsets) if (x >= b[i] && x <= b[i + 3] && z >= b[i + 2] && z <= b[i + 5] && b[i + 4] <= limit && b[i + 4] > (top ?? -Infinity)) {
    const y = b[i + 4];
    if (!offsets.some(j => b[j + 1] <= y && b[j + 4] > y && x >= b[j] && x <= b[j + 3] && z >= b[j + 2] && z <= b[j + 5])) top = y;
  }
  return top;
}

export function museumColonnadesV231RoofAt(x: number, z: number, native = false): number | null {
  if (native) return nativeSupportAt(x, z, Infinity);
  return inBounds(data.bounds, x, z) ? drawnRoofAt(x, z) : null;
}
/** The floor and the roof are distinct supports. Entering below never lifts a
 * walker onto the canopy, even after switching modes inside a column bay. */
export function museumColonnadesV231GroundAt(x: number, z: number, feet: number, native = false): number | null {
  if (!Number.isFinite(feet)) return null;
  if (native) return nativeSupportAt(x, z, feet + .45);
  if (!inBounds(data.bounds, x, z)) return null;
  const roof = drawnRoofAt(x, z);
  if (roof !== null && feet >= roof - .45) return roof;
  return feet >= data.floor - .45 && floorContains(x, z) ? data.floor : null;
}
/** Exact replacement collision is limited to thin overhead roofs and separate
 * columns. No polygon-wide lower volume or invisible entrance wall is created. */
export function museumColonnadesV231SolidAt(x: number, y: number, z: number, radius = 0, native = false): boolean {
  if (native) {
    const index = nativeIndex(); if (!inBounds(index.bounds, x, z, radius)) return false;
    const b = index.boxes;
    for (let gz = Math.floor((z - radius) / CELL); gz <= Math.floor((z + radius) / CELL); gz++)
      for (let gx = Math.floor((x - radius) / CELL); gx <= Math.floor((x + radius) / CELL); gx++) {
        const offsets = index.cells.get(`${gx},${gz}`); if (!offsets) continue;
        for (const i of offsets) {
          if (y <= b[i + 1] || y >= b[i + 4]) continue;
          const dx = Math.max(b[i] - x, 0, x - b[i + 3]), dz = Math.max(b[i + 2] - z, 0, z - b[i + 5]);
          if (dx * dx + dz * dz <= radius * radius) return true;
        }
      }
    return false;
  }
  if (!inBounds(data.bounds, x, z, radius)) return false;
  if (y > data.floor - .2 && y < data.floor && floorContains(x, z)) return true;
  for (const [cx, cz, low, high, r] of data.columns)
    if (y > low && y < high && Math.hypot(x - cx, z - cz) < r + radius) return true;
  const roof = sourceRoofAt(x, z);
  if (roof !== null && y > roof - data.canopyThickness && y < roof) return true;
  for (const [cx, bottom, cz, r, rise] of data.domes)
    if (y > bottom && y < bottom + rise && ((x - cx) ** 2 + (z - cz) ** 2) / (r * r) + ((y - bottom) / rise) ** 2 < 1) return true;
  return false;
}
