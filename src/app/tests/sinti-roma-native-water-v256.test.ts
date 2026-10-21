import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial } from "three";
import { tintSintiRomaNativeWaterV256 } from "../src/SintiRomaNativeWaterV256";
import source from "../src/data/sintiRomaNativeWaterV256.json";

test("only exact source pool runs change colour, preserving all ground/water transforms and source files", () => {
  for (const [path, expected] of [[source.sourceFile, source.sourceSha256], [source.surfaceFile, source.surfaceSha256]]) {
    expect(createHash("sha256").update(readFileSync(new URL(`../../../${path}`, import.meta.url))).digest("hex")).toBe(expected);
  }
  expect(source.sourcePool.area_m2).toBe(113);
  expect(source.runs).toHaveLength(3);
  const runs = [...source.runs, [330, 186, 12, 4]];
  const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), runs.length);
  for (let i = 0; i < runs.length; i++) {
    const [x, z, width, depth] = runs[i];
    const matrix = new Matrix4().makeScale(width, 3, depth).setPosition(x, 3.5, z);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, new Color(0x3f76e4));
  }
  const matrices = Array.from(mesh.instanceMatrix.array);
  const outside = Array.from(mesh.instanceColor!.array.slice(9, 12));
  expect(tintSintiRomaNativeWaterV256(mesh)).toBe(3);
  expect(Array.from(mesh.instanceMatrix.array)).toEqual(matrices);
  expect(mesh.count).toBe(4);
  expect(Array.from(mesh.instanceColor!.array.slice(9, 12))).toEqual(outside);
  const paint = new Color();
  for (let i = 0; i < 3; i++) {
    mesh.getColorAt(i, paint);
    expect(paint.getHex()).toBe(source.displayColor);
  }
  expect(mesh.instanceMatrix.version).toBe(0);
  mesh.geometry.dispose();
  (mesh.material as MeshBasicMaterial).dispose();
});
