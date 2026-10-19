import { expect, test } from "bun:test";
import { Box3, InstancedMesh } from "three";
import { createCivicPartyDetailsV246, CIVIC_V246 } from "../src/CivicPartyDetailsV246";
import receipt from "../../../geo_data/regierungsviertel/civic-v246-source.json";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

test("v246 identity and unchanged complete source envelopes are retained", async () => {
  expect(CIVIC_V246.rosa.address).toBe("Straße der Pariser Kommune 8A");
  expect(CIVIC_V246.green.osm).toBe("54672713");
  expect(receipt.sites.map(s => s.osm).sort()).toEqual(Object.values(CIVIC_V246).map(s => s.osm).sort());
  for (const [path, hash] of Object.entries(receipt.unchangedFiles)) {
    const bytes = await Bun.file(`${import.meta.dir}/../../../${path}`).arrayBuffer();
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(hash);
  }
});

for (const native of [false, true]) test(`v246 ${native ? "native" : "drawn"} has three bounded static site batches and no textures`, () => {
  const root = createCivicPartyDetailsV246(native);
  try {
    expect(root.children).toHaveLength(3);
    expect(root.userData.fullStaticDetailOnTouch).toBeTrue();
    expect(root.userData.sourceGeometryRetained).toBeTrue();
    let bytes = 0;
    for (const obj of root.children) {
      const mesh = obj as InstancedMesh;
      expect(mesh.isInstancedMesh).toBeTrue();
      expect(mesh.instanceMatrix.count).toBe(mesh.count);
      expect(mesh.instanceColor!.count).toBe(mesh.count);
      expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
      expect(mesh.userData.dayMaterial.map).toBeNull();
      expect(mesh.userData.nightMaterial.map).toBeNull();
      bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
      const m = mesh.instanceMatrix.array;
      for (const value of m) expect(Number.isFinite(value)).toBeTrue();
      if (native) for (let i = 0; i < mesh.count; i++) {
        for (const j of [1,2,4,6,8,9]) expect(m[i*16+j]).toBe(0);
        expect(m[i*16]).toBe(.5); expect(m[i*16+10]).toBe(.5);
        expect(m[i*16+5] * 2 % 1).toBe(0);
      }
    }
    expect(bytes).toBeLessThan(native ? 1_400_000 : 300_000);
    const green = new Box3().setFromObject(root.children[0]);
    expect(green.max.x).toBeLessThan(557); // Actual western frontage; no centre-grid.
    expect(green.min.y).toBeGreaterThanOrEqual(5);
    expect(green.max.y).toBeLessThan(27.1); // Preserved 31.6m roof is never covered.
    const rosa = new Box3().setFromObject(root.children[2]);
    expect(rosa.min.y).toBeGreaterThanOrEqual(3);
    expect(rosa.max.y).toBeLessThan(39.44); // Delivered roof/top remains exposed.
  } finally { disposeStaticAudit(root); }
});
