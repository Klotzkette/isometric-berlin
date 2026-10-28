import { expect } from "bun:test";
import { Color, InstancedMesh, Matrix4, type Object3D, Vector3 } from "three";
import receipt from "../../src/data/feuerwacheKreuzbergV267PreviousProfiles.json";
import source from "../../src/data/southKiezV185.json";
import nativeSource from "../../src/data/southKiezV185Native.json";

/** Exact old false-cap correction, independent of the earlier v210 cornice. */
export function restoreSouthKiezPreviousV267(root: Object3D, native: boolean): () => void {
  const name = native ? "Native source street/path contours, facade profiles and mapped park benches"
    : "Connected source kerbs, park path edges, 113 shallow facade profiles and 39 mapped wooden benches";
  const candidates: Object3D[] = []; root.traverse(node => { if (node.name === name) candidates.push(node); });
  expect(candidates).toHaveLength(1); expect(candidates[0]).toBeInstanceOf(InstancedMesh);
  const mesh = candidates[0] as InstancedMesh, saved = mesh.instanceMatrix, projected = saved.clone();
  const rows = native ? nativeSource.nativeRows : source.boxes;
  expect(mesh.count).toBe(rows.length); expect(receipt.owner).toBe("DEBE02YY40000Avj");
  const matrix = new Matrix4(), scale = new Vector3(), color = new Color();
  const transform = (row: number[]) => {
    if (native) matrix.makeScale(row[3], row[4], row[5]);
    else matrix.makeRotationY(row[6]).scale(scale.set(row[3], row[4], row[5]));
    return matrix.setPosition(row[0], row[1], row[2]).elements.map(Math.fround);
  };
  const records = receipt.records.filter(record => record.native === native);
  expect(records.length).toBeGreaterThan(0);
  for (const record of records) {
    expect(record.owner).toBe(receipt.owner); expect(rows[record.index]).toEqual(record.before);
    expect(Array.from(saved.array.slice(record.index * 16, record.index * 16 + 16))).toEqual(transform(record.after));
    expect(Array.from(mesh.instanceColor!.array.slice(record.index * 3, record.index * 3 + 3)))
      .toEqual(color.setHex(record.after[native ? 6 : 7]).toArray().map(Math.fround));
    expect(record.before[native ? 6 : 7]).toBe(record.after[native ? 6 : 7]);
    projected.array.set(transform(record.before), record.index * 16);
  }
  mesh.instanceMatrix = projected;
  return () => { mesh.instanceMatrix = saved; };
}
