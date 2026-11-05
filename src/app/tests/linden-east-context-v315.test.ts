import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { InstancedMesh, Matrix4, Mesh } from "three";
import encoded from "../src/data/lindenEastContextV315.json";
import { createLindenEastContextV315 } from "../src/LindenEastContextV315";
import { decodeLosslessGzipJson } from "../src/losslessGzipBase85";

test("the small v315 wire recipe restores every authored Float32 word", () => {
  const raw = JSON.stringify(decodeLosslessGzipJson(encoded.payload));
  expect(Buffer.byteLength(raw)).toBe(190936);
  expect(createHash("sha256").update(raw).digest("hex")).toBe(encoded.decodedSha256);
  expect(encoded.decodedSha256).toBe("0da66c375eb3ce6f66c477f0ab0ef4b87de5f1c1e3334d731ce5b0cf203bafce");
  expect(Buffer.byteLength(JSON.stringify(encoded))).toBeLessThan(45000);
});

test("three retained owners get independent cardinal native detail, full static touch quality and bounded buffers", () => {
  const allMeshes: Mesh[] = [];
  for (const native of [false, true, false]) {
    const root = createLindenEastContextV315(native);
    expect(root.matrixAutoUpdate).toBe(false);
    expect(root.userData.sourceGeometryRetained).toBe(true);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.nativeMinecraft).toBe(native);
    const batches = root.children.filter((child): child is InstancedMesh => child instanceof InstancedMesh);
    expect(batches.map(m => m.name)).toEqual([
      "Komische Oper functional building", "Hackesches Quartier diagonal corner", "Mohrenstrasse 67-69 folded frontage",
    ]);
    expect(batches.map(m => m.count)).toEqual(native ? [1191, 1841, 363] : [396, 504, 83]);
    let bytes = 0, renderables = 0;
    root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      allMeshes.push(object); renderables++;
      expect(object.matrixAutoUpdate).toBe(false);
      expect(object.geometry.getAttribute("uv")).toBeUndefined();
      expect(object.userData.dayMaterial.map).toBeNull();
      expect(object.userData.nightMaterial.map).toBeNull();
      for (const attribute of Object.values(object.geometry.attributes)) bytes += attribute.array.byteLength;
      bytes += object.geometry.index?.array.byteLength ?? 0;
      if (object instanceof InstancedMesh) {
        bytes += object.instanceMatrix.array.byteLength + object.instanceColor!.array.byteLength;
        if (native) {
          const matrix = new Matrix4();
          for (let i = 0; i < object.count; i++) {
            object.getMatrixAt(i, matrix);
            expect([1, 2, 4, 6, 8, 9].every(k => matrix.elements[k] === 0)).toBe(true);
          }
        }
      }
    });
    expect(renderables).toBe(native ? 3 : 4);
    expect(bytes).toBeLessThan(native ? 270000 : 110000);
  }
  expect(new Set(allMeshes.map(m => m.geometry)).size).toBe(allMeshes.length);
  expect(new Set(allMeshes.flatMap(m => [m.userData.dayMaterial, m.userData.nightMaterial])).size).toBe(allMeshes.length * 2);
  for (const mesh of allMeshes) {
    mesh.geometry.dispose(); mesh.userData.dayMaterial.dispose(); mesh.userData.nightMaterial.dispose();
  }
});
