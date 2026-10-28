import receipt from "../../src/data/townhallV227Previous.json";
import prior from "../../src/data/westCivicV210Previous.json";
import stadthaus from "../../src/data/stadthausV239Replacement.json";
import staatsoper from "../../src/data/staatsoperV240Previous.json";
import theatres from "../../src/data/operaTheatresV274Ownership.json";
import source from "../../src/data/cityRecognitionV182.json";
import { BufferAttribute, Color, Group, InstancedBufferAttribute, InstancedMesh, LineSegments, Matrix4, Vector3 } from "three";
function combinedRows(kind: "boxes" | "segments"): Map<number, number[]> {
  const result = new Map<number, number[]>();
  const later = kind === "boxes" ? theatres.previousBoxes : theatres.previousSegments;
  const records = [...receipt[kind], ...stadthaus[kind], ...staatsoper[kind],
    ...later.map(([index, row]) => ({ index: index as number, row: row as number[] }))];
  for (const { index, row } of records) {
    if (JSON.stringify(source[kind][index]) !== JSON.stringify(row) ||
        (result.has(index) && JSON.stringify(result.get(index)) !== JSON.stringify(row)))
      throw new Error("Changed exact civic predecessor receipt");
    result.set(index, row);
  }
  return result;
}
const laterBoxes = combinedRows("boxes");
const laterSegments = combinedRows("segments");
const townhallBoxes = new Map(receipt.boxes.map(record => [record.index, record.row]));
const townhallSegments = new Map(receipt.segments.map(record => [record.index, record.row]));
const priorBoxes = new Set(prior.boxes.map(row => row.index));
const priorSegments = new Set(prior.segments.map(row => row.index));

/** Test-only surgical reverse receipt. Copy every current unrelated value;
 * insert only the exactly recorded v227 townhall, v239 Stadthaus, v240
 * Staatsoper and v274 opera/theatre predecessor rows. Preserve the
 * separate pre-existing v210 exclusions and all unrelated live attributes.
 * Reject unexpected layouts rather than recreating an entire legacy family.
 * The caller must run the returned cleanup before disposing the scene. */
export function restoreTownhallPreviousForTestV227(root: Group, native = false, includeLaterCivic = false): () => void {
  const boxes = includeLaterCivic ? laterBoxes : townhallBoxes;
  const segments = includeLaterCivic ? laterSegments : townhallSegments;
  const line = root.children.find(c => c.name === "Measured civic roof lines, floor registers and secondary Funkturm bracing");
  const detail = root.children.find(c => c.name === "Bounded facade windows, blue glass cube stack and Funkturm decks");
  if (!(line instanceof LineSegments) || !(detail instanceof InstancedMesh)) throw new Error("Unexpected v182 civic test family");
  const position = line.geometry.getAttribute("position"), color = line.geometry.getAttribute("color");
  const matrix = detail.instanceMatrix, tint = detail.instanceColor;
  if (!(position instanceof BufferAttribute) || !(color instanceof BufferAttribute) || !tint ||
      position.itemSize !== 3 || color.itemSize !== 3 || matrix.itemSize !== 16 || tint.itemSize !== 3 ||
      position.array.length !== (receipt.sourceRows.segments - prior.segments.length - segments.size) * 6 ||
      color.array.length !== position.array.length ||
      detail.count !== receipt.sourceRows.boxes - prior.boxes.length - boxes.size ||
      matrix.array.length !== detail.count * 16 || tint.array.length !== detail.count * 3 ||
      line.geometry.index || Object.keys(line.geometry.attributes).sort().join() !== "color,position") {
    throw new Error("Unexpected filtered v182 civic buffer layout");
  }
  const p = new Float32Array((receipt.sourceRows.segments - prior.segments.length) * 6), c = new Float32Array(p.length);
  const m = new Float32Array((receipt.sourceRows.boxes - prior.boxes.length) * 16), t = new Float32Array((receipt.sourceRows.boxes - prior.boxes.length) * 3);
  const rgb = new Color(), transform = new Matrix4(), scale = new Vector3();
  for (let i = 0, cursor = 0, output = 0; i < receipt.sourceRows.segments; i++) {
    if (priorSegments.has(i)) continue;
    const row = segments.get(i);
    if (row) { p.set(row.slice(0, 6), output * 6); rgb.setHex(row[6]).toArray(c, output * 6); rgb.toArray(c, output * 6 + 3); }
    else { p.set(position.array.slice(cursor * 6, cursor * 6 + 6), output * 6); c.set(color.array.slice(cursor * 6, cursor * 6 + 6), output * 6); cursor++; }
    output++;
  }
  for (let i = 0, cursor = 0, output = 0; i < receipt.sourceRows.boxes; i++) {
    if (priorBoxes.has(i)) continue;
    const row = boxes.get(i);
    if (row) {
      if (native) {
        const co = Math.abs(Math.cos(row[6])), si = Math.abs(Math.sin(row[6]));
        transform.makeScale(Math.max(.16, row[3] * co + row[5] * si), row[4], Math.max(.16, row[3] * si + row[5] * co));
      } else transform.makeRotationY(row[6]).scale(scale.set(row[3], row[4], row[5]));
      transform.setPosition(row[0], row[1], row[2]).toArray(m, output * 16); rgb.setHex(row[7]).toArray(t, output * 3);
    } else { m.set(matrix.array.slice(cursor * 16, cursor * 16 + 16), output * 16); t.set(tint.array.slice(cursor * 3, cursor * 3 + 3), output * 3); cursor++; }
    output++;
  }
  const old = { count: detail.count, lineBox: line.geometry.boundingBox, lineSphere: line.geometry.boundingSphere,
    box: detail.boundingBox, sphere: detail.boundingSphere };
  line.geometry.setAttribute("position", new BufferAttribute(p, 3, position.normalized).setUsage(position.usage));
  line.geometry.setAttribute("color", new BufferAttribute(c, 3, color.normalized).setUsage(color.usage));
  detail.instanceMatrix = new InstancedBufferAttribute(m, 16, matrix.normalized, matrix.meshPerAttribute).setUsage(matrix.usage);
  detail.instanceColor = new InstancedBufferAttribute(t, 3, tint.normalized, tint.meshPerAttribute).setUsage(tint.usage);
  detail.count = receipt.sourceRows.boxes - prior.boxes.length;
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
