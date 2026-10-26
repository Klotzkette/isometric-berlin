import data from "./data/tiergartenWerkhofV275Ownership.json";

type Prism = {
  id?: unknown;
  ring?: unknown;
  holes?: unknown;
  y0_dm?: unknown;
  h_dm?: unknown;
  class?: unknown;
  roof?: unknown;
  tone?: unknown;
};
const fingerprint = (p: Prism) => JSON.stringify([
  p.id, p.ring, p.holes, p.y0_dm, p.h_dm, p.class, p.roof, p.tone,
]);
const originals = new Map(data.previousPrisms.map(p => [p.id, fingerprint(p)]));
const neighbours = new Map((data.neighbours as Prism[]).map(p => [p.id, fingerprint(p)]));

/** Activation belongs to the required complete model transaction. Unknown or
 * changed records keep every original facade, roof, height and collision. */
export function isTiergartenWerkhofSourceV275(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const part = value as Prism;
  if (typeof part.id !== "string") return false;
  const original = originals.get(part.id);
  return original !== undefined && original === fingerprint(part);
}

/** No rectangle is erased: every candidate is a complete source column tuple.
 * All twenty owners must still be present exactly once. A changed or newly
 * overlapping neighbour preserves its cells even if the old receipt was exclusive. */
export function createTiergartenWerkhofColumnTesterV275(
  prisms: readonly unknown[] | undefined,
  cell: number,
) {
  const no = (_x: number, _z: number, _low: number, _high: number, _kind: number) => false;
  if (!prisms || cell !== data.cellM) return no;
  for (const original of data.previousPrisms) {
    const matches = prisms.filter(p => (p as Prism)?.id === original.id);
    if (matches.length !== 1 || !isTiergartenWerkhofSourceV275(matches[0])) return no;
  }
  const foreign = prisms.flatMap(raw => {
    if (!raw || typeof raw !== "object" || isTiergartenWerkhofSourceV275(raw)) return [];
    const part = raw as Prism;
    if (!Array.isArray(part.ring)) return [];
    const ring = part.ring as number[][];
    const bounds = {
      minX: Math.min(...ring.map(p => p[0])) / 10,
      maxX: Math.max(...ring.map(p => p[0])) / 10,
      minZ: Math.min(...ring.map(p => p[1])) / 10,
      maxZ: Math.max(...ring.map(p => p[1])) / 10,
    };
    if (bounds.maxX < data.bounds[0] - cell || bounds.minX > data.bounds[2] + cell ||
      bounds.maxZ < data.bounds[1] - cell || bounds.minZ > data.bounds[3] + cell ||
      (typeof part.id === "string" && neighbours.get(part.id) === fingerprint(part))) return [];
    return [bounds];
  });
  const keys = new Set(data.columns.filter(c => !foreign.some(b =>
    b.maxX >= c[0] * cell && b.minX <= (c[0] + 1) * cell &&
    b.maxZ >= c[1] * cell && b.minZ <= (c[1] + 1) * cell,
  )).map(c => c.join("/")));
  return (x: number, z: number, low: number, high: number, kind: number) =>
    keys.has([x, z, low, high, kind].join("/"));
}
