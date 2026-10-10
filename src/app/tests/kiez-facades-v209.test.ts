import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";
import { createHelmholtzEnvelopesV209, createKiezFacadesV209 } from "../src/KiezFacadesV209";
import { kiezFacadeInkShaderV209 } from "../src/kiezFacadePresentationV209";
import data from "../src/data/kiezFacadesV209.json";

for (const native of [false, true]) test(`Helmholtz required envelopes and detail have bounded independent static buffers ${native}`, () => {
  const shells = createHelmholtzEnvelopesV209(native), detail = createKiezFacadesV209(native);
  let bytes = 0, instances = 0;
  for (const root of [shells, detail]) {
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.sourceXZPreserved).toBe(true);
    expect(root.userData.correctedHeightIsEstimate).toBe(true);
    expect(root.children.length).toBe(1);
    for (const object of root.children) {
      const mesh = object as Mesh;
      expect(mesh.matrixAutoUpdate).toBe(false);
      expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
      expect(mesh.geometry.boundingBox?.isEmpty()).toBe(false);
      for (const attr of Object.values(mesh.geometry.attributes)) bytes += attr.array.byteLength;
      bytes += mesh.geometry.index?.array.byteLength ?? 0;
      for (const material of [mesh.userData.dayMaterial, mesh.userData.nightMaterial]) expect(material.map).toBeNull();
      if ((mesh as InstancedMesh).isInstancedMesh) {
        const batch = mesh as InstancedMesh;
        expect(batch.instanceMatrix.count).toBe(batch.count);
        expect(batch.instanceColor!.count).toBe(batch.count);
        instances += batch.count;
        bytes += batch.instanceMatrix.array.byteLength + batch.instanceColor!.array.byteLength;
        if (native) {
          const matrix = new Matrix4();
          for (let i = 0; i < batch.count; i++) {
            batch.getMatrixAt(i, matrix);
            for (const j of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[j]).toBe(0);
          }
        }
      }
    }
  }
  expect(instances).toBe(native ? 425 : 118);
  expect(bytes).toBeLessThan(native ? 36_000 : 22_000);
  expect(detail.userData.additiveOnly).toBe(true);
});

test("only the exact Platzhaus height is corrected and its flat top is explicit", () => {
  expect(data.owners.filter(o => o.heightCorrection).map(o => o.id)).toEqual(["DEBE03YY60000DEJ"]);
  const points = data.surfaces.filter(s => s.owner === 2).flatMap(s => s.triangles.flat());
  expect(Math.min(...points.map(p => p[1]))).toBe(3);
  expect(Math.max(...points.map(p => p[1]))).toBe(6.4);
  // The two site footprints are separated by >20m; only the Platzhaus is west
  // of x=3310. Its partial-height native roof cap matches corrected navigation.
  const nativePlatzhaus = data.shellBlocks.filter(b => b[0] < 3310);
  expect(Math.max(...nativePlatzhaus.map(b => b[1] + b[4] / 2))).toBeCloseTo(6.4, 8);
  expect(data.owners.map(o => o.osmId)).toEqual(["way/35605731", "way/35605731", "way/35605732"]);
});

test("existing facade shader receives a finite idempotent contrast refinement", () => {
  const baseVertex = "void main(){vec2 urbanXZ=vec2(0.);vUrbanFacadeEmphasis = min(1.0, 0.0);}";
  const baseFragment = "#include <color_fragment>\n// retained earlier shader";
  const first = kiezFacadeInkShaderV209(baseVertex, baseFragment);
  const second = kiezFacadeInkShaderV209(first.vertexShader, first.fragmentShader);
  expect(second).toEqual(first);
  expect(first.fragmentShader).toContain("(1.0 - vUrbanFacadeEmphasis)");
  expect(first.fragmentShader).toContain("// retained earlier shader");
  expect(first.vertexShader).toContain("step(-4030.0, urbanXZ.x)");
  expect(first.vertexShader).not.toContain("attribute");
});
