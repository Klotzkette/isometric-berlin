import { expect, test } from "bun:test";
import { InstancedMesh } from "three";
import { createRailStationsV190 } from "../src/RailStationsV190";
import source from "../src/data/railStationsV190.json";
import receipt from "./fixtures/outline-warschauer-v225.json";
import { outlineSignature } from "./helpers/outlineConstructionSignature";
import { restoreWarschauerRoofAccentV225ForTest } from "./helpers/outlinePreservationV225";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";
import { restoreWeddingStationPreviousV229 } from "./helpers/weddingStationPreviousV229";

test("v225 obsolete roof receipt retains the exact immutable source record and complete rail inputs", async () => {
  expect(receipt.releasedBase).toBe("ee082a820c45e1b7ae3057915f1f4473c0e8ace1");
  expect(source.roofs.filter(roof => roof.id === "way/297153147")).toEqual([receipt.removedRoof]);
  expect(receipt.removedRoof.station).toBe("Warschauer Straße");
  expect(receipt.removedRoof.y).toBe(6);
  for (const name of ["railStationsV190", "ringStationDetailsV205"]) {
    const path = `src/app/src/data/${name}.json` as keyof typeof receipt.inputs;
    const bytes = await Bun.file(`${import.meta.dir}/../src/data/${name}.json`).arrayBuffer();
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(receipt.inputs[path]);
  }
});

for (const mode of ["day", "minecraft"] as const) {
  test(`${mode}: exact roof span recovers the complete v124 rail hash and restores current attributes`, () => {
    const root = createRailStationsV190(mode === "minecraft"), record = receipt.modes[mode];
    const restoreWedding = restoreWeddingStationPreviousV229(root);
    try {
      expect(outlineSignature(root)).toEqual(record.after);
      const mesh = root.getObjectByName(record.meshName) as InstancedMesh;
      const matrix = mesh.instanceMatrix, color = mesh.instanceColor, count = mesh.count;
      const restore = restoreWarschauerRoofAccentV225ForTest(root, mode === "minecraft");
      try {
        expect(outlineSignature(root)).toEqual(record.before);
        expect(mesh.count - count).toBe(mode === "day" ? 18 : 115);
        expect(record.before.bytes - record.after.bytes).toBe(record.removedCount * 19 * 4);
      } finally { restore(); }
      expect(mesh.instanceMatrix).toBe(matrix);
      expect(mesh.instanceColor).toBe(color);
      expect(mesh.count).toBe(count);
      expect(outlineSignature(root)).toEqual(record.after);
    } finally { restoreWedding(); disposeStaticAudit(root); }
  });

  test(`${mode}: the roof exception still rejects a changed unrelated station byte`, () => {
    const root = createRailStationsV190(mode === "minecraft");
    const restoreWedding = restoreWeddingStationPreviousV229(root);
    try {
      let other: InstancedMesh | undefined;
      root.traverse(object => {
        if (!other && object instanceof InstancedMesh && object.name !== receipt.modes[mode].meshName) other = object;
      });
      expect(other).toBeDefined();
      const mesh = other!, matrix = mesh.instanceMatrix, value = matrix.array[12];
      matrix.array[12] += 1;
      try { expect(() => restoreWarschauerRoofAccentV225ForTest(root, mode === "minecraft")).toThrow(); }
      finally { matrix.array[12] = value; }
      expect(mesh.instanceMatrix).toBe(matrix);
      expect(outlineSignature(root)).toEqual(receipt.modes[mode].after);
    } finally { restoreWedding(); disposeStaticAudit(root); }
  });
}
