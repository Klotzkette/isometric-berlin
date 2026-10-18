import navigation from "./data/schlossplatzV239PreviousNavigation.json";
import source from "./data/schlossplatzV239Owners.json";

type Prism = { id: string; ring: number[][]; holes?: number[][][]; y0_dm: number; h_dm: number };
const originals = new Map(source.previousPrisms.map(row => [row.id, row]));
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aa = a as Record<string, unknown>, bb = b as Record<string, unknown>;
  const keys = Object.keys(aa);
  return keys.length === Object.keys(bb).length && keys.every(k => Object.hasOwn(bb, k) && equal(aa[k], bb[k]));
}
/** Only the complete immutable source proxy yields to the required measured model. */
export function isSchlossplatzCorePrismV239(prism: Prism): boolean {
  const previous = originals.get(prism.id);
  return previous !== undefined && equal(previous, prism);
}
export const SCHLOSSPLATZ_SOLIDS_V239 = source.navigationSolids;

/** Match the actual snapped native interval and material, never just its footprint. */
export function createSchlossplatzColumnTesterV239(prisms: readonly Prism[] = [], cellM = 4):
  (x: number, z: number, lowDm: number, highDm: number, kind: number) => boolean {
  if (cellM !== 4) return () => false;
  const active = new Set(prisms.filter(isSchlossplatzCorePrismV239).map(p => p.id));
  const columns = new Map(source.previousColumns.filter(c => c.prismIds.every(id => active.has(id)))
    .map(c => [`${c.x},${c.z}`, c]));
  return (x, z, low, high, kind) => {
    const old = columns.get(`${x},${z}`);
    return old !== undefined && old.low === low && old.high === high && old.kind === kind;
  };
}

/** Source parts retire only with the complete exact previous navigation tuple. */
export function isSchlossplatzPreviousPartV239<T extends { id: string }>(part: T): boolean {
  return navigation.parts.some(previous => previous.id === part.id && equal(previous, part));
}
