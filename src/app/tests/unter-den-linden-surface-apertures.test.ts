import { expect, test } from "bun:test";
import { BufferGeometry, Float32BufferAttribute, Mesh, Raycaster, Vector3 } from "three";
import surfaces from "../public/mesh/regierungsviertel/surface-polygons.json";
import { createSmoothSurfaces, type SurfacePayload } from "../src/IsometricCityWorld";
import { cutUnterDenLindenSurfaceApertures } from "../src/UnterDenLindenSurfaceApertures";
import { createUnterDenLindenEntrances } from "../src/UnterDenLindenEntrances";
import { UNTER_DEN_LINDEN_ENTRANCE_REGIONS, UNTER_DEN_LINDEN_ENTRANCE_RUNS } from "../src/unterDenLindenEntrancesProfile";

test("the streamed source metal family cannot cap any new descending entrance", () => {
  const source = surfaces as SurfacePayload;
  const original = JSON.stringify(source.roads);
  const root = createSmoothSurfaces({ ...source, roads: source.roads!.filter(p => p.kind === "metal"),
    water: [], parks: [], scrub_points: [], sunken_walls: [], lane_markings: [] }, 0, 5.2, () => 5.2);
  expect(root.children.filter(p => p.name === "smooth metal paths and steps")).toHaveLength(1);
  root.add(createUnterDenLindenEntrances()); root.updateMatrixWorld(true);
  for (const run of UNTER_DEN_LINDEN_ENTRANCE_RUNS) {
    for (const u of [.2, .5, .8]) {
      const x = run.top[0] + run.ux * run.length * u;
      const z = run.top[1] + run.uz * run.length * u;
      const ray = new Raycaster(new Vector3(x, 12, z), new Vector3(0, -1, 0));
      expect(ray.intersectObject(root.children[0])).toHaveLength(0);
      const hit = ray.intersectObject(root, true)[0];
      expect(hit).toBeDefined();
      expect(hit.point.y).toBeLessThan(5.0);
    }
  }
  expect(JSON.stringify(source.roads)).toBe(original);
  root.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); });
});

test("exact clipping retains the entire outside source area and interpolated terrain height", () => {
  const r = UNTER_DEN_LINDEN_ENTRANCE_REGIONS[0];
  const x0 = r.minX - 2, x1 = r.maxX + 2, z0 = r.minZ - 2, z1 = r.maxZ + 2;
  const height = (x: number, z: number) => x * .01 + z * .02;
  const a = [x0, height(x0, z0), z0], b = [x1, height(x1, z0), z0];
  const c = [x1, height(x1, z1), z1], d = [x0, height(x0, z1), z1];
  const source = new BufferGeometry();
  source.setAttribute("position", new Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  const old = Array.from(source.getAttribute("position").array);
  const result = cutUnterDenLindenSurfaceApertures(source);
  const p = result.getAttribute("position"); let area = 0;
  for (let i = 0; i < p.count; i += 3) {
    area += Math.abs((p.getX(i+1) - p.getX(i)) * (p.getZ(i+2) - p.getZ(i))
      - (p.getZ(i+1) - p.getZ(i)) * (p.getX(i+2) - p.getX(i))) / 2;
  }
  expect(area).toBeCloseTo((x1 - x0) * (z1 - z0) - (r.maxX - r.minX) * (r.maxZ - r.minZ), 4);
  for (let i = 0; i < p.count; i++) expect(p.getY(i)).toBeCloseTo(height(p.getX(i), p.getZ(i)), 5);
  expect(Array.from(source.getAttribute("position").array)).toEqual(old);
  const far = source.clone().translate(1000, 0, 0);
  expect(cutUnterDenLindenSurfaceApertures(far)).toBe(far);
  source.dispose(); result.dispose(); far.dispose();
});
