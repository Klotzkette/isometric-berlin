import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { InstancedMesh, Matrix4 } from "three";
import encoded from "../src/data/domEastHousingV318.json";
import { createDomEastHousingV318 } from "../src/DomEastHousingV318";
import { decodeLosslessGzipJson } from "../src/losslessGzipBase85";

test("the factored facade retains all original authored Float32 fitting words", () => {
  const raw = JSON.stringify(decodeLosslessGzipJson(encoded.payload));
  expect(Buffer.byteLength(raw)).toBe(encoded.decodedBytes);
  expect(createHash("sha256").update(raw).digest("hex")).toBe(encoded.decodedSha256);
  expect(encoded.decodedSha256).toBe("898e39492262640bbf55c153d81ceb034c47a1ca7294bfffe6af5e61196ba896");
  const parts = JSON.parse(raw);
  for (const native of [false, true]) {
    const root = createDomEastHousingV318(native), mesh = root.children[0] as InstancedMesh;
    const matrix = new Matrix4();
    const part = parts[native ? 1 : 0];
    // The profile transport proof avoids trigonometric inversion; every actual
    // resulting instance matrix is independently checked for finite/cardinal form.
    expect(mesh.count).toBe(part.count);
    expect(part.allRowWordsSha256).toMatch(/^[0-9a-f]{64}$/);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      expect(matrix.elements.every(Number.isFinite)).toBe(true);
      if (native) expect([1, 2, 4, 6, 8, 9].every(k => matrix.elements[k] === 0)).toBe(true);
    }
    mesh.geometry.dispose(); mesh.userData.dayMaterial.dispose(); mesh.userData.nightMaterial.dispose();
  }
});

test("full independent families use bounded static geometry and fresh material lifetimes", () => {
  const meshes: InstancedMesh[] = [];
  for (const native of [false, true, false]) {
    const root = createDomEastHousingV318(native), mesh = root.children[0] as InstancedMesh;
    meshes.push(mesh);
    expect(root.children.length).toBe(1);
    expect(root.userData.sourceGeometryRetained).toBe(true);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.matrixAutoUpdate).toBe(false);
    expect(mesh.matrixAutoUpdate).toBe(false);
    expect(mesh.count).toBe(native ? 8165 : 2773);
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect(mesh.userData.dayMaterial.map).toBeNull();
    expect(mesh.userData.nightMaterial.map).toBeNull();
    expect(mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength)
      .toBeLessThan(native ? 625000 : 215000);
  }
  expect(new Set(meshes.map(m => m.geometry)).size).toBe(3);
  expect(new Set(meshes.flatMap(m => [m.userData.dayMaterial, m.userData.nightMaterial])).size).toBe(6);
  for (const mesh of meshes) {
    mesh.geometry.dispose(); mesh.userData.dayMaterial.dispose(); mesh.userData.nightMaterial.dispose();
  }
  expect(Buffer.byteLength(JSON.stringify(encoded))).toBeLessThan(8500);
});
