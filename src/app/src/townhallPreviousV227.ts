import receipt from "./data/townhallV227Previous.json";

const boxes = new Map(receipt.boxes.map(row => [row.index, row.row]));
const segments = new Map(receipt.segments.map(row => [row.index, row.row]));
const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** Only exact recorded display-estimate rows yield to the required new model.
 * Reordered or changed source rows fail open; every measured edge stays. */
export function keepTownhallBoxV182V227(row: readonly number[], originalIndex: number): boolean {
  const old = boxes.get(originalIndex);
  return !old || !same(old, row);
}
export function keepTownhallSegmentV182V227(row: readonly number[], originalIndex: number): boolean {
  const old = segments.get(originalIndex);
  return !old || !same(old, row);
}
