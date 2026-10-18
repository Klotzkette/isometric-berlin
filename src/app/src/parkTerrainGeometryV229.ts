import changes from "./data/parkTerrainV229Changes.json";

type Cell = { id: string; positions: number[]; colors: number[]; indices: number[]; boxes: number[][] };
/** Apply only audited source slots before typed buffers, bounds, parking or upload.
 * The input stays immutable; every outside triangle and every old X/Z survives.
 * The weak JSON field is touched locally, never retained by a module-level map.
 */
export function correctParkTerrainV229(cell: Cell, native: boolean): Cell {
  const p = changes.cells.find(p => p.native === native && p.id === cell.id);
  if (!p) return cell;
  if (p.sourceCounts[0] !== cell.positions.length || p.sourceCounts[1] !== cell.indices.length || p.sourceCounts[2] !== cell.boxes.length)
    throw new Error("Schönholzer Heide source receipt mismatch");
  const positions = cell.positions.concat(p.positions), colors = cell.colors.concat(p.colors);
  for (const [id, oldY, newY] of p.vertexY) {
    if (positions[id * 3 + 1] !== oldY) throw new Error("Schönholzer Heide tree receipt mismatch");
    positions[id * 3 + 1] = newY;
  }
  const boxes = cell.boxes.slice();
  for (const [id, oldY, newY] of p.boxY) {
    if (boxes[id][1] !== oldY) throw new Error("Schönholzer Heide fitting receipt mismatch");
    boxes[id] = boxes[id].slice(); boxes[id][1] = newY;
  }
  const indices = new Array<number>(cell.indices.length - p.remove.length * 3 + p.indices.length);
  let source = 0, target = 0;
  for (const offset of p.remove) {
    for (; source < offset; source++) indices[target++] = cell.indices[source];
    source += 3;
  }
  for (; source < cell.indices.length; source++) indices[target++] = cell.indices[source];
  const base = cell.positions.length / 3;
  for (const index of p.indices) indices[target++] = base + index;
  return { id: cell.id, positions, colors, indices, boxes };
}
