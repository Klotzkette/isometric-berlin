import {expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {Mesh, PerspectiveCamera, Raycaster, Vector3} from "three";
import {attachBerlinDetailsV378} from "../src/berlinDetailSitesV378";
import {disposeSurroundingCityRoot} from "../src/disposeSurroundingCityRootV323";
import {rykeBasilicaViewsV381} from "../src/rykeBasilicaViewsV381";
import {loadSourceQuarterRecipesV309} from "../src/SourceQuarterCatalogueV309";
import {createSurroundingCityChunk, type SurroundingCityChunk} from "../src/SurroundingCityGeometry";

const host = "6_-4";
const view = rykeBasilicaViewsV381["Synagoge Rykestraße"];

// Midpoint of surveyed south wall 45. Ornament projects up to 30 cm from its masonry.
const rose = new Vector3(3226.7095, 18.3, -1740.267);
const normal = new Vector3(-0.5516745, 0, 0.8340595);
const alongWall = new Vector3(-normal.z, 0, normal.x);
const masonryPoint = (u: number, y: number) =>
  rose.clone().setY(y).addScaledVector(alongWall, u).addScaledVector(normal, 0.50);

const probes = [
  masonryPoint(0, rose.y),
  ...Array.from({length: 12}, (_, i) => {
    const angle = i * Math.PI / 6;
    return masonryPoint(2.7 * Math.cos(angle), rose.y + 2.7 * Math.sin(angle));
  }),
  masonryPoint(-6.1, 14.6), masonryPoint(6.1, 14.6),
  masonryPoint(-6.1, 21.5), masonryPoint(6.1, 21.5), masonryPoint(0, 25.8),
];

for (const native of [false, true]) {
  const mode = native ? "minecraft" : "drawn";
  test("the Rykestraße opening shows the rosette and gable past the neighbouring roof, " + mode, async () => {
    const packet = new URL(`../public/mesh/surrounding-berlin-v159/${host}.${mode}.json.gz`, import.meta.url);
    const chunk: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(packet)).toString());
    const entry = createSurroundingCityChunk(chunk, host, native, {
      sourceQuartersV303: true, sourceQuarterSourcesV303: await loadSourceQuarterRecipesV309(host, native),
      groundOverlaysV329: false,
    });
    try {
      await attachBerlinDetailsV378(entry, host, native, new AbortController().signal);
      entry.root.updateMatrixWorld(true);
      const solids: Mesh[] = [];
      entry.root.traverseVisible(object => { if (object instanceof Mesh) solids.push(object); });
      const neighbour = solids.find(object => object.name.endsWith("mapped surfaces and massing"))!;
      expect(neighbour).toBeDefined();
      expect(solids.some(object => object.userData.rykeBasilicaV381)).toBe(true);
      const ray = new Raycaster();
      const obstructed = (eye: Vector3, point: Vector3, objects: Mesh[]) => {
        const direction = point.clone().sub(eye);
        // Mesh quantisation and the block facade may occupy the final half metre.
        ray.far = direction.length() - 0.60;
        ray.set(eye, direction.normalize());
        return ray.intersectObjects(objects, false).length > 0;
      };
      // Verify the original foreground roof is resident and really crosses the old sightline.
      expect(obstructed(new Vector3(3196, 38, -1687), probes[0], [neighbour])).toBe(true);
      for (const aspect of [390 / 640, 1366 / 864]) {
        const camera = new PerspectiveCamera(view.fov, aspect, 0.25, 9500);
        camera.position.fromArray(view.position);
        camera.lookAt(...view.target);
        camera.updateMatrixWorld();
        for (const point of probes) {
          expect(obstructed(camera.position, point, solids)).toBe(false);
          const ndc = point.clone().project(camera);
          expect(Math.abs(ndc.x)).toBeLessThan(0.94);
          expect(ndc.y).toBeGreaterThan(-0.83);
          expect(ndc.y).toBeLessThan(0.76);
        }
      }
    } finally {
      disposeSurroundingCityRoot(entry.root);
    }
  }, 30000);
}
