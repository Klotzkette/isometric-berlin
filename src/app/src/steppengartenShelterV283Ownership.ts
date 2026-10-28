import data from './data/steppengartenShelterV283.json';

type Prism = { id?: unknown; ring?: unknown; holes?: unknown; y0_dm?: unknown;
  h_dm?: unknown; class?: unknown; roof?: unknown; tone?: unknown };
const fingerprint = (p: Prism) => JSON.stringify([p.id, p.ring, p.holes,
  p.y0_dm, p.h_dm, p.class, p.roof, p.tone]);
const original = fingerprint(data.previousPrisms[0]);

export function isSteppengartenShelterSourceV283(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' &&
    (value as Prism).id === data.sourceId && fingerprint(value as Prism) === original);
}

/** Exact complete native tuples, gated by one unchanged prism and no new neighbour. */
export function createSteppengartenShelterColumnTesterV283(prisms: readonly unknown[] | undefined, cell: number) {
  const no = (_x: number, _z: number, _low: number, _high: number, _kind: number) => false;
  if (!prisms || cell !== data.cellM) return no;
  const matches = prisms.filter(p => (p as Prism)?.id === data.sourceId);
  if (matches.length !== 1 || !isSteppengartenShelterSourceV283(matches[0])) return no;
  const foreign = prisms.flatMap(raw => {
    if (!raw || typeof raw !== 'object' || isSteppengartenShelterSourceV283(raw)) return [];
    const p = raw as Prism;
    if (!Array.isArray(p.ring)) return [];
    const ring = p.ring as number[][];
    return [{ minX: Math.min(...ring.map(v => v[0])) / 10,
      maxX: Math.max(...ring.map(v => v[0])) / 10,
      minZ: Math.min(...ring.map(v => v[1])) / 10,
      maxZ: Math.max(...ring.map(v => v[1])) / 10 }];
  });
  const tuples = new Set(data.columns.filter(([x, z]) => !foreign.some(b =>
    b.maxX >= x * cell && b.minX <= (x + 1) * cell &&
    b.maxZ >= z * cell && b.minZ <= (z + 1) * cell,
  )).map(row => row.join('/')));
  return (x: number, z: number, low: number, high: number, kind: number) =>
    tuples.has([x, z, low, high, kind].join('/'));
}
