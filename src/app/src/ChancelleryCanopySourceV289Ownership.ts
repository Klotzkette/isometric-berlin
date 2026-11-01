import data from "./data/chancelleryCanopyV289.json";

const oldIds = new Set(data.oldPrisms.map(p => p.id));
const columnKeys = new Set(data.native.exclusiveColumns.map(c => c.join(",")));
function ring(value: unknown): number[][] | null {
  if (!Array.isArray(value)) return null;
  const n = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isSafeInteger(n) || n < 3 || n > 10000 || Reflect.ownKeys(value).length !== n + 1) return null;
  const result: number[][] = [];
  for (let i = 0; i < n; i++) {
    const point = own(value, String(i)); if (!Array.isArray(point) || point.length !== 2) return null;
    const x = own(point, "0"), z = own(point, "1");
    if (typeof x !== "number" || typeof z !== "number" || !Number.isFinite(x) || !Number.isFinite(z)) return null;
    result.push([x / 10, z / 10]);
  }
  return result;
}
function clippedArea(points: number[][], ix: number, iz: number): number {
  let polygon = points;
  for (const [axis, limit, sign] of [[0, ix * 4, 1], [0, (ix + 1) * 4, -1], [1, iz * 4, 1], [1, (iz + 1) * 4, -1]]) {
    const next: number[][] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], ain = sign * (a[axis] - limit) >= 0, bin = sign * (b[axis] - limit) >= 0;
      if (ain) next.push(a);
      if (ain !== bin) { const t = (limit - a[axis]) / (b[axis] - a[axis]); next.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
    }
    polygon = next;
  }
  return Math.abs(polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
}
function touchesRetiredColumn(part: object): boolean {
  const points = ring(own(part, "ring")); if (!points) return true;
  const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0])), minZ = Math.min(...points.map(p => p[1])), maxZ = Math.max(...points.map(p => p[1]));
  if (maxX < -124 || minX > -108 || maxZ < -156 || minZ > -132) return false;
  const holesValue = own(part, "holes"), holes: number[][][] = [];
  if (holesValue !== undefined) {
    if (!Array.isArray(holesValue)) return true;
    for (let i = 0; i < holesValue.length; i++) { const hole = ring(own(holesValue, String(i))); if (!hole) return true; holes.push(hole); }
  }
  return data.native.exclusiveColumns.some(([ix, iz]) => clippedArea(points, ix, iz) - holes.reduce((sum, h) => sum + clippedArea(h, ix, iz), 0) > 1e-7);
}
function own(value: object, key: PropertyKey): unknown {
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d?.enumerable && "value" in d ? d.value : undefined;
}
function exact(value: unknown, expected: unknown): boolean {
  if (!expected || typeof expected !== "object") return value === expected;
  if (!value || typeof value !== "object" || Array.isArray(value) !== Array.isArray(expected)) return false;
  const keys = Reflect.ownKeys(expected), actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some(k => !keys.includes(k))) return false;
  return keys.every(k => k === "length" && Array.isArray(expected)
    ? Object.getOwnPropertyDescriptor(value, k)?.value === expected.length : exact(own(value, k), own(expected, k)));
}

/** The old closed prisms may yield only after the required replacement exists. */
export function isChancelleryCanopyOldPrismV289(value: unknown): boolean {
  try {
    if (!value || typeof value !== "object") return false;
    const id = own(value, "id");
    return typeof id === "string" && oldIds.has(id) && exact(value, data.oldPrisms.find(p => p.id === id));
  } catch { return false; }
}

/** Include all neighbouring retained owners in this bounded admission. */
export function admitsChancelleryCanopySourceV289(payload: unknown): boolean {
  try {
    if (!payload || typeof payload !== "object") return false;
    const parts = own(payload, "buildings");
    if (!Array.isArray(parts)) return false;
    const length = Object.getOwnPropertyDescriptor(parts, "length")?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > 100_000) return false;
    const expected = [...data.oldPrisms, ...data.retainedPrisms], ids = new Set(expected.map(p => p.id)), seen = new Set<string>();
    for (let i = 0; i < length; i++) {
      const part = own(parts, String(i));
      if (!part || typeof part !== "object") continue;
      const id = own(part, "id");
      if (typeof id !== "string" || !ids.has(id)) { if (touchesRetiredColumn(part)) return false; continue; }
      if (seen.has(id) || !exact(part, expected.find(p => p.id === id))) return false;
      seen.add(id);
    }
    return seen.size === ids.size;
  } catch { return false; }
}

export function admitsChancelleryCanopyNativeV289(payload: unknown): boolean {
  try {
    if (!payload || typeof payload !== "object" || own(payload, "schema_version") !== data.native.schema ||
      own(payload, "cell_m") !== data.native.cellM || !exact(own(payload, "grid"), data.native.grid) || !exact(own(payload, "classes"), data.native.classes)) return false;
    const rows = own(payload, "building_rows");
    if (!Array.isArray(rows)) return false;
    const found: number[][] = [], b = data.native.bounds;
    for (let iz = b.minZIdx; iz <= b.maxZIdx; iz++) {
      const row = own(rows, String(iz - data.native.grid.min_z_idx));
      if (!Array.isArray(row)) return false;
      const length = Object.getOwnPropertyDescriptor(row, "length")?.value;
      if (!Number.isSafeInteger(length) || length < 0 || length > 10000 || Reflect.ownKeys(row).length !== length + 1) return false;
      for (let i = 0; i < length; i++) {
        const run = own(row, String(i));
        if (!Array.isArray(run) || run.length !== 5 || Reflect.ownKeys(run).length !== 6) return false;
        const values = Array.from({ length: 5 }, (_, k) => own(run, String(k)));
        if (!values.every(v => typeof v === "number" && Number.isSafeInteger(v))) return false;
        const [offset, n, low, high, kind] = values as number[];
        if (n <= 0 || n > 10000 || high < low || kind < 0 || kind >= data.native.classes.length) return false;
        const start = data.native.grid.min_x_idx + offset;
        for (let ix = Math.max(b.minXIdx, start); ix < Math.min(b.maxXIdx + 1, start + n); ix++) found.push([ix, iz, low, high, kind]);
      }
    }
    return exact(found, data.native.columns);
  } catch { return false; }
}

/** Exact full-column tuples; the one mixed leadership/vestibule cell stays. */
export function isChancelleryCanopyOldColumnV289(row: readonly number[]): boolean {
  return row.length === 5 && columnKeys.has(row.join(","));
}
