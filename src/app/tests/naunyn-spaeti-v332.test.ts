import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Mesh, Raycaster, Vector3 } from "three";
import { berlinSenateSourceV321 } from "../src/BerlinSenateV321";
import { clusterFacadesSourceV320 } from "../src/ClusterFacadesV320";
import { createNaunynSpaetiV332, NAUNYN_SPAETI_V332 } from "../src/NaunynSpaetiV332";
import { loadSourceQuarterRecipesV309 } from "../src/SourceQuarterCatalogueV309";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { createSurroundingCityChunk } from "../src/SurroundingCityGeometry";

const directory = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const ids = ["6_4", "district188-6_4", "southrail238-6_4"];

test.each([false, true])("storefront fascia fits actual post-recipe wall (native=%s)", async native => {
  const sign = createNaunynSpaetiV332(native);
  expect(sign.name).toBe("Späti 24/7 — Naunynstraße 76");
  const face = sign.children[0] as Mesh;
  expect(sign.children).toHaveLength(1);
  expect(face.userData.lettering).toBe("SPÄTI 24/7");
  expect(face.geometry.getAttribute("position").count).toBeLessThan(1600);
  sign.updateMatrixWorld(true);
  const normal = new Vector3(0, 0, 1).transformDirection(sign.matrixWorld);
  if (native) expect(normal.distanceTo(new Vector3(0, 0, -1))).toBeLessThan(1e-10);
  const family = native ? "minecraft" : "drawn";
  const roots = [];
  try {
    for (const id of ids) {
      const packed = readFileSync(new URL(`${id}.${family}.json.gz`, directory));
      if (id === NAUNYN_SPAETI_V332.tile) {
        expect(createHash("sha256").update(packed).digest("hex")).toBe(
          native ? NAUNYN_SPAETI_V332.nativeSha256 : NAUNYN_SPAETI_V332.drawnSha256,
        );
      }
      const raw = JSON.parse(gunzipSync(packed).toString());
      const recipes = await loadSourceQuarterRecipesV309(id, native);
      const tile = createSurroundingCityChunk(raw, id, native, {
        schlossplatzV239: true, stralauSisyphosV299: true, neighbourhoodV300: true,
        clusterFacadesV320: clusterFacadesSourceV320, berlinSenateV321: berlinSenateSourceV321,
        sourceQuartersV303: true, sourceQuarterSourcesV303: recipes, groundOverlaysV329: false,
        operaTheatresV274: true, staatsoperV240: true, architectureV241: true,
        mitteEnsembleV281: true, northernSitesV266: true, chariteBridgesV265: true,
        golgathaV270: true, tachelesFrontsV270: true,
      });
      if (id === NAUNYN_SPAETI_V332.tile) {
        expect(recipes.map(recipe => recipe.kind)).toEqual(["network-fidelity-v326"]);
        expect(tile.nav.buildings.some(b => b.sourceId === NAUNYN_SPAETI_V332.owner)).toBe(true);
      }
      roots.push(tile.root);
      tile.root.updateMatrixWorld(true);
    }
    const meshes = roots.flatMap(root => root.children.filter(o => o instanceof Mesh));
    const width = native ? 1.6 : 4.8;
    for (let column = 0; column <= 8; column++) {
      for (const y of [-.414, -.08, .36]) {
        const x = width * (column / 8 - .5);
        const origin = new Vector3(x, y, .5).applyMatrix4(sign.matrixWorld);
        const ray = new Raycaster(origin, normal.clone().negate(), 0, .52);
        const wall = ray.intersectObjects(meshes, false)[0];
        expect(wall?.object.parent).toBe(roots[0]);
        expect(wall?.distance).toBeCloseTo(.5, 4);
      }
    }
    const faceRay = new Raycaster(new Vector3(0, 0, .5).applyMatrix4(sign.matrixWorld),
      normal.clone().negate());
    expect(faceRay.intersectObject(face)[0].distance).toBeLessThan(.452);
  } finally {
    roots.forEach(disposeSurroundingCityRoot);
    face.geometry.dispose();
    face.userData.dayMaterial.dispose();
    face.userData.nightMaterial.dispose();
  }
});
