import { expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { Color, Mesh, PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import { createCafeNeuerSeeV164, createMinecraftCafeNeuerSeeV164 } from "../src/CafeNeuerSeeV164";
import { createSchlossEastStreets } from "../src/SchlossEastStreets";
import { correctedSchlossRowsV362 } from "../src/MitteGardenRoutesV362";

const meshFile = new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url);
const reference = new URL("../../../geo_data/regierungsviertel/mitte-garden-routes-v362-source.json.gz", import.meta.url);
const proof = JSON.parse(gunzipSync(await Bun.file(reference).arrayBuffer()).toString());
const ground = await Bun.file(meshFile).json();

for (const native of [false, true]) {
  test(`photo-marked crossings and Lustgarten lawns survive normal street construction, native=${native}`, () => {
    const world = createSchlossEastStreets(ground, native);
    world.updateMatrixWorld(true);
    const routes = world.getObjectByName("Lustgarten forecourt, cross paths and Schloßplatz paint") as Mesh;
    expect(routes).toBeInstanceOf(Mesh);
    const ray = new Raycaster(new Vector3(), new Vector3(0,-1,0), 0, 2);
    const hits = (x: number, z: number) => {
      ray.ray.origin.set(x, 6, z);
      return ray.intersectObject(routes, false);
    };
    // Three crossing points visible in the source photograph and the apron
    // in front of Altes Museum. No raised curb closes these walking axes.
    for (const [x,z] of [[1897.5,49.4],[1924.97,71.15],[1880,12]]) expect(hits(x,z).length, `${x}/${z}`).toBeGreaterThan(0);
    for (const [x,z] of [[1871,47],[1909,24],[1929,100],[1926,50],[1886,74],[1903,110],[1950,82],
                         [1915,77],[1880.1,19.33],[1973.3,130.4]]) expect(hits(x,z)).toHaveLength(0);

    const tone = new Color(0xe1ded1);
    for (const owner of proof.roadMarkings) {
      for (const [[ax,az],[bx,bz]] of owner.photoStripeCentreLines) {
        const x = (ax+bx)/2, z = (az+bz)/2;
        const hit = hits(x,z)[0];
        expect(hit?.face).toBeTruthy();
        expect(routes.geometry.getAttribute("color").getX(hit.face!.a)).toBeCloseTo(tone.r,5);
        // Any earlier inferred median on these same source points must yield.
        expect(ray.intersectObject(world, true)[0].object).toBe(routes);
      }
    }
  });
}

test("oblique rays meet the paved kerb outside the road surface at the Dom", () => {
  const world = createSchlossEastStreets(ground);
  world.updateMatrixWorld(true);
  const camera = new PerspectiveCamera(50, 1280/800, 0.055, 100000);
  camera.position.set(1797,135,186);
  camera.lookAt(1911,7,62);
  camera.updateMatrixWorld();
  const ray = new Raycaster();
  for (const [x,y] of [[490,277],[490,278],[544,285]]) {
    ray.setFromCamera(new Vector2(2*(x+0.5)/1280-1, 1-2*(y+0.5)/800), camera);
    const hit = ray.intersectObject(world,true).find(hit => hit.object instanceof Mesh);
    expect(hit?.object.name).toBe("Lustgarten forecourt, cross paths and Schloßplatz paint");
    expect(hit?.point.y).toBeCloseTo(5.265,3);
  }
  ray.setFromCamera(new Vector2(2*490.5/1280-1, 1-2*273.5/800), camera);
  expect(ray.intersectObject(world,true).find(hit => hit.object instanceof Mesh)?.object.name).toBe("District asphalt carriageways");
});

test("compacted café paths meet the existing garden floor in both styles", () => {
  for (const root of [createCafeNeuerSeeV164(), createMinecraftCafeNeuerSeeV164()]) {
    root.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(), new Vector3(0,-1,0), 0, .08);
    for (const [x,z] of [[-1864.37,856.79],[-1825.75,893.81],[-1866.73,891.56]]) {
      ray.ray.origin.set(x, 5.36, z);
      const hit = ray.intersectObject(root, true)[0];
      expect(hit?.point.y).toBeCloseTo(5.325,3);
    }
  }
});

test("refuses a curb correction if the previous complete row has changed", () => {
  const input = [[8,2,9,2],[0,2,7,2]];
  const changed = correctedSchlossRowsV362(input, [{ index: 1, original: [0,2,8,2], outside: [] }]);
  expect(changed).toBe(input);
});
