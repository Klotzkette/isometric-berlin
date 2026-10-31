import ownership from './data/berlinHistoricCoreV288Ownership.json';

export const BERLIN_HISTORIC_DOM_V288_IDS = ownership.legacyPrisms.map(p => p.id);

/** Own data descriptors only: a foreign getter is never called by admission. */
function own(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== 'object') return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d?.enumerable && 'value' in d ? d.value : undefined;
}
function plain(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return typeof value !== 'function' && typeof value !== 'symbol' && value !== undefined;
  const proto = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    if (proto !== Array.prototype) return false;
    const length = Object.getOwnPropertyDescriptor(value, 'length');
    if (!length || !('value' in length) || !Number.isSafeInteger(length.value)) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length.value + 1) return false;
    for (let i = 0; i < length.value; i++) {
      const d = Object.getOwnPropertyDescriptor(value, String(i));
      if (!d?.enumerable || !('value' in d) || !plain(d.value)) return false;
    }
    return true;
  }
  if (proto !== Object.prototype && proto !== null) return false;
  for (const key of Reflect.ownKeys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !d?.enumerable || !('value' in d) || !plain(d.value)) return false;
  }
  return true;
}
function equal(a: unknown, b: unknown): boolean {
  if (!plain(a)) return false;
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  return ak.length === bk.length && bk.every(k => ak.includes(k) && equal(own(a, k), own(b, k)));
}
const expectedPrisms = new Map(ownership.nearbyPrisms.map(p => [p.id, p]));
const bounds = ownership.bounds;

/** All eight surrounding owners are receipted, including both complete old court holes. */
export function matchesBerlinHistoricDomOwnersV288(prisms: unknown): boolean {
  try {
  if (!Array.isArray(prisms)) return false;
  const seen = new Set<string>();
  const length = Object.getOwnPropertyDescriptor(prisms, 'length');
  if (!length || !('value' in length) || Reflect.ownKeys(prisms).length !== length.value + 1) return false;
  for (let i = 0; i < length.value; i++) {
    const p = own(prisms, String(i));
    const id = own(p, 'id'), ring = own(p, 'ring');
    if (typeof id !== 'string' || !Array.isArray(ring)) return false;
    if (!plain(ring)) return false;
    if (!ring.every(v => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite))) return false;
    const x = ring.map(v => v[0] / 10), z = ring.map(v => v[1] / 10);
    const overlaps = Math.max(...x) >= bounds[0] && Math.min(...x) <= bounds[2] &&
      Math.max(...z) >= bounds[1] && Math.min(...z) <= bounds[3];
    if (!overlaps && !expectedPrisms.has(id)) continue;
    const expected = expectedPrisms.get(id);
    if (!expected || seen.has(id) || !equal(p, expected)) return false;
    seen.add(id);
  }
  return seen.size === expectedPrisms.size;
  } catch { return false; }
}

const nativeTuples = new Set(ownership.nativeColumns.map(r => r.join('/')));
/** Exact tuples only; call after both owner and complete native-payload admission. */
export function isBerlinHistoricDomColumnV288(x: number, z: number, low: number, high: number, kind: number): boolean {
  return nativeTuples.has([x, z, low, high, kind].join('/'));
}

/** Complete nearby native source receipt; unrelated rows are never retired. */
export function matchesBerlinHistoricDomNativeV288(payload: unknown): boolean {
  try {
  if (own(payload, 'schema_version') !== ownership.nativeSchema || own(payload, 'cell_m') !== 4 || !equal(own(payload, 'classes'), ownership.classes)) return false;
  const grid = own(payload, 'grid');
  if (own(grid, 'min_x_idx') !== ownership.gridOrigin[0] || own(grid, 'min_z_idx') !== ownership.gridOrigin[1]) return false;
  const rows = own(payload, 'building_rows');
  if (!Array.isArray(rows)) return false;
  const expected = new Set(ownership.nativeNearbyColumns.map(r => r.join('/'))), found = new Set<string>();
  const minZ = Math.floor(bounds[1] / 4), maxZ = Math.floor(bounds[3] / 4);
  for (let z = minZ; z <= maxZ; z++) {
    const row = own(rows, String(z - ownership.gridOrigin[1]));
    if (!Array.isArray(row) || !plain(row)) return false;
    for (const run of row) {
      if (!Array.isArray(run) || run.length !== 5 || !run.every(Number.isFinite)) return false;
      const [start, count, low, high, kind] = run;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count) || count < 1) return false;
      for (let x = Math.max(start + ownership.gridOrigin[0], Math.floor(bounds[0] / 4));
        x < Math.min(start + ownership.gridOrigin[0] + count, Math.floor(bounds[2] / 4) + 1); x++) {
        const key = [x, z, low, high, kind].join('/');
        if (!expected.has(key) || found.has(key)) return false;
        found.add(key);
      }
    }
  }
  return found.size === expected.size;
  } catch { return false; }
}


/** Exact old record, including all optional keys and original court rings. */
export function isBerlinHistoricDomOldCoreV288(part: unknown): boolean {
  try {
    const id = own(part, 'id');
    const expected = ownership.legacyPrisms.find(p => p.id === id);
    return Boolean(expected && equal(part, expected));
  } catch { return false; }
}
