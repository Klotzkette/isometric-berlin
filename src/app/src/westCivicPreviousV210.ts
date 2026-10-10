import receipt from "./data/westCivicV210Previous.json";
import { BufferAttribute, Color, Group, InstancedBufferAttribute, InstancedMesh, LineSegments, Matrix4, Vector3 } from "three";

const boxes = new Map(receipt.boxes.map(r => [r.index, r.row]));
const segments = new Map(receipt.segments.map(r => [r.index, r.row]));
const equal = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((n, i) => n === b[i]);

/** Exact authored estimate rows only. Changed/reordered data fails open and
 * stays visible; no source owner, coordinate radius or semantic name filter. */
export function keepCivicBoxV182V210(row: readonly number[], index: number): boolean {
  const old = boxes.get(index);
  return !old || !equal(old, row);
}
export function keepCivicSegmentV182V210(row: readonly number[], index: number): boolean {
  const old = segments.get(index);
  return !old || !equal(old, row);
}

/** Test-only surgical reverse receipt. Copy every current unrelated value;
 * insert only the authorized 10/100 retired rows at their original indices.
 * Reject unexpected layouts rather than recreating an entire legacy family.
 * The caller must run the returned cleanup before disposing the scene. */
export function restoreWestCivicPreviousForTestV210(root: Group, native = false): () => void {
  const line = root.children.find(c => c.name === "Measured civic roof lines, floor registers and secondary Funkturm bracing");
  const detail = root.children.find(c => c.name === "Bounded facade windows, blue glass cube stack and Funkturm decks");
  if (!(line instanceof LineSegments) || !(detail instanceof InstancedMesh)) throw new Error("Unexpected v182 civic test family");
  const position = line.geometry.getAttribute("position"), color = line.geometry.getAttribute("color");
  const matrix = detail.instanceMatrix, tint = detail.instanceColor;
  if (!(position instanceof BufferAttribute) || !(color instanceof BufferAttribute) || !tint ||
      position.itemSize !== 3 || color.itemSize !== 3 || matrix.itemSize !== 16 || tint.itemSize !== 3 ||
      position.array.length !== (receipt.sourceRows.segments - receipt.segments.length) * 6 ||
      color.array.length !== position.array.length ||
      detail.count !== receipt.sourceRows.boxes - receipt.boxes.length ||
      matrix.array.length !== detail.count * 16 || tint.array.length !== detail.count * 3 ||
      line.geometry.index || Object.keys(line.geometry.attributes).sort().join() !== "color,position") {
    throw new Error("Unexpected filtered v182 civic buffer layout");
  }
  const p = new Float32Array(receipt.sourceRows.segments * 6), c = new Float32Array(p.length);
  const m = new Float32Array(receipt.sourceRows.boxes * 16), t = new Float32Array(receipt.sourceRows.boxes * 3);
  const rgb = new Color(), transform = new Matrix4(), scale = new Vector3();
  for (let i = 0, cursor = 0; i < receipt.sourceRows.segments; i++) {
    const row = segments.get(i);
    if (row) { p.set(row.slice(0, 6), i * 6); rgb.setHex(row[6]).toArray(c, i * 6); rgb.toArray(c, i * 6 + 3); }
    else { p.set(position.array.slice(cursor * 6, cursor * 6 + 6), i * 6); c.set(color.array.slice(cursor * 6, cursor * 6 + 6), i * 6); cursor++; }
  }
  for (let i = 0, cursor = 0; i < receipt.sourceRows.boxes; i++) {
    const row = boxes.get(i);
    if (row) {
      if (native) {
        const co = Math.abs(Math.cos(row[6])), si = Math.abs(Math.sin(row[6]));
        transform.makeScale(Math.max(.16, row[3] * co + row[5] * si), row[4], Math.max(.16, row[3] * si + row[5] * co));
      } else transform.makeRotationY(row[6]).scale(scale.set(row[3], row[4], row[5]));
      transform.setPosition(row[0], row[1], row[2]).toArray(m, i * 16); rgb.setHex(row[7]).toArray(t, i * 3);
    } else { m.set(matrix.array.slice(cursor * 16, cursor * 16 + 16), i * 16); t.set(tint.array.slice(cursor * 3, cursor * 3 + 3), i * 3); cursor++; }
  }
  const old = { count: detail.count, lineBox: line.geometry.boundingBox, lineSphere: line.geometry.boundingSphere,
    box: detail.boundingBox, sphere: detail.boundingSphere };
  line.geometry.setAttribute("position", new BufferAttribute(p, 3, position.normalized).setUsage(position.usage));
  line.geometry.setAttribute("color", new BufferAttribute(c, 3, color.normalized).setUsage(color.usage));
  detail.instanceMatrix = new InstancedBufferAttribute(m, 16, matrix.normalized, matrix.meshPerAttribute).setUsage(matrix.usage);
  detail.instanceColor = new InstancedBufferAttribute(t, 3, tint.normalized, tint.meshPerAttribute).setUsage(tint.usage);
  detail.count = receipt.sourceRows.boxes;
  line.geometry.boundingBox = null; line.geometry.boundingSphere = null;
  detail.boundingBox = null; detail.boundingSphere = null;
  line.geometry.computeBoundingBox(); line.geometry.computeBoundingSphere(); detail.computeBoundingBox(); detail.computeBoundingSphere();
  return () => {
    line.geometry.setAttribute("position", position); line.geometry.setAttribute("color", color);
    detail.instanceMatrix = matrix; detail.instanceColor = tint; detail.count = old.count;
    line.geometry.boundingBox = old.lineBox; line.geometry.boundingSphere = old.lineSphere;
    detail.boundingBox = old.box; detail.boundingSphere = old.sphere;
  };
}
