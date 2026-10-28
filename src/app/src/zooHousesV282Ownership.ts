import data from './data/zooHousesV282Ownership.json';

type Prism = { id?: unknown; ring?: unknown; holes?: unknown; y0_dm?: unknown;
  h_dm?: unknown; class?: unknown; roof?: unknown; tone?: unknown };
const fingerprint = (p: Prism) => JSON.stringify([p.id, p.ring, p.holes, p.y0_dm, p.h_dm, p.class, p.roof, p.tone]);
const originals = new Map(data.previousPrisms.map(p => [p.id, fingerprint(p)]));
const neighbours = new Map((data.neighbours as Prism[]).map(p => [p.id, fingerprint(p)]));

/** Only after construction of the required complete four-part Penguin shell. */
export function isZooHouseSourceV282(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const p = value as Prism;
  return typeof p.id === 'string' && originals.get(p.id) === fingerprint(p);
}

/** Exact retained full column tuples, not a bounding-box erasure. */
export function createZooHouseColumnTesterV282(prisms: readonly unknown[] | undefined, cell: number) {
  const no = (_x: number, _z: number, _low: number, _high: number, _kind: number) => false;
  if (!prisms || cell !== data.cellM) return no;
  for (const original of data.previousPrisms) {
    const matches = prisms.filter(p => (p as Prism)?.id === original.id);
    if (matches.length !== 1 || !isZooHouseSourceV282(matches[0])) return no;
  }
  const foreign = prisms.flatMap(raw => {
    if (!raw || typeof raw !== 'object' || isZooHouseSourceV282(raw)) return [];
    const p = raw as Prism;
    if (!Array.isArray(p.ring)) return [];
    if (typeof p.id === 'string' && neighbours.get(p.id) === fingerprint(p)) return [];
    const ring = p.ring as number[][];
    return [{ x0: Math.min(...ring.map(p => p[0])) / 10, x1: Math.max(...ring.map(p => p[0])) / 10,
      z0: Math.min(...ring.map(p => p[1])) / 10, z1: Math.max(...ring.map(p => p[1])) / 10 }];
  });
  const keys = new Set(data.columns.filter(c => !foreign.some(b =>
    b.x1 >= c[0] * cell && b.x0 <= (c[0] + 1) * cell &&
    b.z1 >= c[1] * cell && b.z0 <= (c[1] + 1) * cell)).map(c => c.join('/')));
  return (x: number, z: number, low: number, high: number, kind: number) => keys.has([x, z, low, high, kind].join('/'));
}
