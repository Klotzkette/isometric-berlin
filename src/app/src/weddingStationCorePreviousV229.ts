import { isWeddingRoofCoreV229 } from "./weddingMoabitV229Profile";
import receipt from "./data/weddingStationCorePreviousV229.json";

type Prism = { id: string; ring: number[][]; holes?: number[][][]; y0_dm: number; h_dm: number };
const originals = new Map(receipt.owners.map(owner => [owner.prism.id, owner]));

function bounds(prism: Prism): number[] {
  const xs = prism.ring.map(p => p[0]), zs = prism.ring.map(p => p[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
}
function inside(ring: number[][], x: number, z: number): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i], dx = b[0] - a[0], dz = b[1] - a[1];
    if (Math.abs((x - a[0]) * dz - (z - a[1]) * dx) < 1e-7 &&
      x >= Math.min(a[0], b[0]) && x <= Math.max(a[0], b[0]) && z >= Math.min(a[1], b[1]) && z <= Math.max(a[1], b[1])) return true;
    if ((a[1] > z) !== (b[1] > z) && x < dx * (z - a[1]) / dz + a[0]) result = !result;
  }
  return result;
}
function contains(prism: Prism, x: number, z: number): boolean {
  return inside(prism.ring, x, z) && !(prism.holes ?? []).some(hole => inside(hole, x, z));
}

/** Exact native row receipt, activated only by the matching original owner.
 * Neighbours remain protected even if a later source adds an overlapping body. */
export function createWeddingRoofCoreColumnTesterV229(prisms: readonly Prism[] = [], cellM = 4):
  (xIndex: number, zIndex: number, bottomDm: number, topDm: number, classId: number) => boolean {
  if (cellM !== receipt.cellM) return () => false;
  const columns = new Map<number, Map<number, { row: number[]; neighbours: Prism[] }[]>>();
  for (const prism of prisms) {
    if (!isWeddingRoofCoreV229(prism)) continue;
    const box = bounds(prism), owner = originals.get(prism.id)!;
    const neighbours = prisms.filter(other => {
      if (other === prism) return false;
      const b = bounds(other);
      return b[0] <= box[2] && b[2] >= box[0] && b[1] <= box[3] && b[3] >= box[1];
    });
    for (const row of owner.columns) {
      const xRows = columns.get(row[0]) ?? new Map(), values = xRows.get(row[1]) ?? [];
      values.push({ row, neighbours }); xRows.set(row[1], values); columns.set(row[0], xRows);
    }
  }
  return (x, z, bottom, top, kind) => columns.get(x)?.get(z)?.some(({ row, neighbours }) =>
    row[2] === bottom && row[3] === top && row[4] === kind &&
    !neighbours.some(other => contains(other, (x + .5) * cellM * 10, (z + .5) * cellM * 10))) ?? false;
}
