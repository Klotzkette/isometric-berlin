import { expect } from "bun:test";
import { Color, InstancedBufferAttribute, InstancedMesh, Matrix4, type Object3D, Vector3 } from "three";
import source from "../../src/data/suhrkampPfefferbergV189.json";
import evidence from "../../src/data/northCultureV274Source.json";
import { suhrkampCoreV274 } from "../../src/SuhrkampV274";

/** Two evidenced west facets only. Retain the backing and every byte belonging
 * to all other Suhrkamp/Pfefferberg faces, in their original order. */
export function restoreSuhrkampPreviousV274(root: Object3D, native: boolean): () => void {
  const candidates: Object3D[] = [];
  root.traverse(node => { if (node.name === "Suhrkamp aluminium ribbons, fixed glazing and concrete stair core") candidates.push(node); });
  expect(candidates).toHaveLength(1);
  const mesh = candidates[0] as InstancedMesh;
  expect(mesh).toBeInstanceOf(InstancedMesh);
  const saved = { matrix: mesh.instanceMatrix, color: mesh.instanceColor!, count: mesh.count };
  const ranges = mesh.userData.sourceFaceRanges as { faceIndex: number; first: number; skinCount: number; count: number }[];
  const west = evidence.suhrkampFaces.filter(face => face.normal[0] < -.9);
  expect(west).toHaveLength(2);
  const changes = west.map(receipt => {
    const faceIndex = source.faces.findIndex(f => JSON.stringify(f.a) === JSON.stringify(receipt.a) && JSON.stringify(f.b) === JSON.stringify(receipt.b));
    expect(faceIndex).toBeGreaterThanOrEqual(0);
    const f = source.faces[faceIndex], range = ranges.find(r => r.faceIndex === faceIndex)!;
    expect(range).toBeDefined();
    const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], length = Math.hypot(dx, dz), height = f.top - f.bottom;
    const tx = dx / length, tz = dz / length;
    const old: number[][] = [], current: number[][] = [];
    const put = (rows: number[][]) => (u: number, y: number, w: number, h: number, d: number, color: number, out: number) => {
      const x = f.a[0] + tx * u + f.normal[0] * (out + .52), z = f.a[1] + tz * u + f.normal[1] * (out + .52);
      if (!native) { rows.push([x, y, z, w, h, d, -Math.atan2(tz, tx), color]); return; }
      const count = Math.max(1, Math.ceil(w / .8));
      for (let i = 0; i < count; i++) {
        const along = (i + .5) * w / count - w / 2;
        rows.push([x + tx * along, y, z + tz * along,
          Math.max(.09, Math.abs(tx) * w / count + Math.abs(tz) * d), h,
          Math.max(.09, Math.abs(tz) * w / count + Math.abs(tx) * d), color]);
      }
    };
    expect(suhrkampCoreV274(f, put(current))).toBeTrue();
    expect(range.count - range.skinCount).toBe(current.length);
    const member = put(old), floors = height > 22 ? 7 : height > 15 ? 5 : height > 8 ? 3 : 2, floor = height / floors;
    member(length / 2, (f.bottom + f.top) / 2, length - .12, height - .12, .055, 0xb5b5a7, .13);
    for (let level = 1; level < floors; level++) member(length / 2, f.bottom + level * floor, length - .1, .045, .08, 0x929c95, .18);
    member(length * .16, (f.bottom + f.top) / 2, Math.min(1.7, length * .26), height - 1.2, .06, 0x739198, .19);
    return { first: range.first + range.skinCount, current, old };
  }).sort((a, b) => a.first - b.first);
  const count = saved.count + changes.reduce((n, change) => n + change.old.length - change.current.length, 0);
  const matrices = new Float32Array(count * 16), colors = new Float32Array(count * 3);
  const matrix = new Matrix4(), scale = new Vector3(), color = new Color();
  const transform = (row: number[]) => {
    if (native) matrix.makeScale(row[3], row[4], row[5]);
    else matrix.makeRotationY(row[6]).scale(scale.set(row[3], row[4], row[5]));
    return matrix.setPosition(row[0], row[1], row[2]).elements.map(Math.fround);
  };
  const tint = (row: number[]) => color.setHex(row[native ? 6 : 7]).toArray().map(Math.fround);
  let cursor = 0, output = 0;
  for (const change of changes) {
    const kept = change.first - cursor;
    matrices.set(saved.matrix.array.slice(cursor * 16, change.first * 16), output * 16);
    colors.set(saved.color.array.slice(cursor * 3, change.first * 3), output * 3); output += kept;
    change.current.forEach((row, i) => {
      const at = change.first + i;
      expect(Array.from(saved.matrix.array.slice(at * 16, at * 16 + 16))).toEqual(transform(row));
      expect(Array.from(saved.color.array.slice(at * 3, at * 3 + 3))).toEqual(tint(row));
    });
    change.old.forEach(row => { matrices.set(transform(row), output * 16); colors.set(tint(row), output * 3); output++; });
    cursor = change.first + change.current.length;
  }
  matrices.set(saved.matrix.array.slice(cursor * 16), output * 16); colors.set(saved.color.array.slice(cursor * 3), output * 3);
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16, saved.matrix.normalized, saved.matrix.meshPerAttribute).setUsage(saved.matrix.usage);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3, saved.color.normalized, saved.color.meshPerAttribute).setUsage(saved.color.usage); mesh.count = count;
  return () => { mesh.instanceMatrix = saved.matrix; mesh.instanceColor = saved.color; mesh.count = saved.count; };
}
