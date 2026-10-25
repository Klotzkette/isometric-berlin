import data from "./data/coreHouseColoursV273.json";

export type CoreHousePartV273 = {
  id?: string;
  y0_dm?: number;
  h_dm?: number;
  class?: number;
  roof?: number;
  tone?: readonly number[];
  ring: readonly (readonly number[])[];
  holes?: readonly (readonly (readonly number[])[])[];
};
export type CoreHousePaintV273 = readonly [number, number, number, number, number, number];
type Receipts = Readonly<Record<string, readonly CoreHousePaintV273[]>>;

/** Exact existing source identity and complete geometry/sample guards. Never
 * classify a facade merely because it looks grey; the offline receipt requires
 * positive residential use and excludes mapped/authored material families. */
export function coreHousePaintV273(part: CoreHousePartV273): CoreHousePaintV273 | undefined {
  const rows = part.id ? (data.owners as unknown as Receipts)[part.id] : undefined;
  if (!rows || part.y0_dm === undefined || part.h_dm === undefined || part.class === undefined) return;
  let a = 2166136261, b = 2246822519;
  const feed = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      a = Math.imul(a ^ text.charCodeAt(i), 16777619) >>> 0;
      b = Math.imul(b ^ text.charCodeAt(i), 16777619) >>> 0;
    }
  };
  feed(`${part.y0_dm},${part.h_dm},${part.class},${part.roof ?? 0};`);
  for (const ring of [part.ring, ...part.holes ?? []]) {
    feed("[");
    for (const [x, z] of ring) feed(`${x},${z};`);
    feed("]");
  }
  feed(`;${part.tone?.join(",") ?? ""}`);
  return rows.find(row => row[0] === a && row[1] === b);
}
