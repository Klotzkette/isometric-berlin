import { expect, test } from "bun:test";
import { Mesh, Raycaster, Vector3 } from "three";
import { createBerAirportV205 } from "../src/BerAirportV205";
import old from "../src/data/berAirportV205.json";
import patch from "../src/data/berAirportRoofPatchV236.json";

for (const native of [false, true]) test(`BER ${native ? "native" : "drawn"} no high cap over either elevated T2 bridge`, () => {
  const original = JSON.stringify(old);
  const root = createBerAirportV205(native);
  root.updateMatrixWorld(true);
  expect(root.userData.scopedRoofCorrectionV236).toBe("way/1083495102");
  expect(patch.bridgeIds).toEqual(["way/999966725", "way/999966726"]);
  expect(patch.bridgeChecks).toHaveLength(2);
  for (const position of patch.bridgeChecks) {
    const [x, z] = native ? position.minecraft : position.drawn;
    // The actual replacement bridge reaches y=12. An erroneous old y=18 cap
    // would be hit in this interval, even when it appears only in native mode.
    const ray = new Raycaster(new Vector3(x, 20, z), new Vector3(0, -1, 0), 0, 7.5);
    expect(ray.intersectObject(root, true)).toHaveLength(0);
  }
  expect(JSON.stringify(old)).toBe(original);
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    object.userData.dayMaterial?.dispose();
    object.userData.nightMaterial?.dispose();
  });
});
