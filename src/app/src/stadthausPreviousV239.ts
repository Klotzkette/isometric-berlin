import receipt from "./data/stadthausV239Replacement.json";
const boxes = new Map(receipt.boxes.map(r => [r.index, r.row]));
const segments = new Map(receipt.segments.map(r => [r.index, r.row]));
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
/** Exact old display tower rows only; every measured roof edge and window stays. */
export function keepStadthausBoxV182V239(row: readonly number[], index: number): boolean {
  const old = boxes.get(index); return !old || !same(old, row);
}
export function keepStadthausSegmentV182V239(row: readonly number[], index: number): boolean {
  const old = segments.get(index); return !old || !same(old, row);
}
