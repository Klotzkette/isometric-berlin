import { afterAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Box3, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Ray, Raycaster, Vector3 } from "three";
import { createBerlinJunction } from "../src/BerlinJunction";
import { createConcertHalls, createMinecraftConcertHalls } from "../src/ConcertHalls";
import { SIMULATION_START_VIEWS } from "../src/simulationStartViews";
import { startupFlightCamera, startupFlightView } from "../src/startupView";

const NAME = "Berliner Philharmonie";
const physical = SIMULATION_START_VIEWS[NAME];
const target = new Vector3(...physical.target);
const scale = Math.tan(physical.fov * Math.PI / 360) / Math.tan(16 * Math.PI / 360);
const oldPosition = new Vector3(...physical.position).sub(target).multiplyScalar(scale).add(target);
const junction = createBerlinJunction();
const halls = createConcertHalls();
const nativeHalls = createMinecraftConcertHalls();
for (const root of [junction, halls, nativeHalls]) root.updateMatrixWorld(true);
const hallMeshes: Mesh[] = [];
halls.traverse(object => { if (object instanceof Mesh) hallMeshes.push(object); });
const plateMeshes = [-1, 1].map(side => junction.getObjectByName(`Berlin Junction steel plate ${side}`) as Mesh);

function distinctWorldVertices(mesh: Mesh): Vector3[] {
  const position = mesh.geometry.getAttribute("position");
  const points = new Map<string, Vector3>();
  for (let i = 0; i < position.count; i++) {
    const point = new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    points.set(point.toArray().join(","), point);
  }
  return [...points.values()];
}

const plates = plateMeshes.map(distinctWorldVertices);
const nativeSteel = junction.getObjectByName("Berlin Junction Minecraft steel") as InstancedMesh;
const nativePlatePoints: Vector3[] = [];
const transform = new Matrix4();
nativeSteel.geometry.computeBoundingBox();
const steelBounds = nativeSteel.geometry.boundingBox!;
// Test every real native cube corner, including outward rounding beyond the
// smooth shells. Do not infer native visibility from the drawn model alone.
for (let i = 0; i < nativeSteel.count; i++) {
  nativeSteel.getMatrixAt(i, transform);
  transform.premultiply(nativeSteel.matrixWorld);
  for (const x of [steelBounds.min.x, steelBounds.max.x])
    for (const y of [steelBounds.min.y, steelBounds.max.y])
      for (const z of [steelBounds.min.z, steelBounds.max.z])
        nativePlatePoints.push(new Vector3(x, y, z).applyMatrix4(transform));
}

const hallBoxes: Box3[] = [];
nativeHalls.traverse(object => {
  if (!(object instanceof InstancedMesh)) return;
  object.geometry.computeBoundingBox();
  for (let i = 0; i < object.count; i++) {
    object.getMatrixAt(i, transform);
    transform.premultiply(object.matrixWorld);
    hallBoxes.push(object.geometry.boundingBox!.clone().applyMatrix4(transform));
  }
});

function drawnHits(from: Vector3, to: Vector3) {
  return new Raycaster(from, to.clone().sub(from).normalize(), 0, from.distanceTo(to) - .001)
    .intersectObjects(hallMeshes, false);
}

function nativeBlockedPoints(from: Vector3, points: Vector3[]): number {
  // A ray segment stays inside this box, so this exact broad phase excludes
  // distant hall blocks without changing the visibility test.
  const corridor = new Box3().setFromPoints(points).expandByPoint(from);
  const candidates = hallBoxes.filter(box => box.intersectsBox(corridor));
  const ray = new Ray(), hit = new Vector3();
  ray.origin.copy(from);
  let blocked = 0;
  for (const point of points) {
    const distance = from.distanceTo(point);
    ray.direction.copy(point).sub(from).normalize();
    if (candidates.some(box => ray.intersectBox(box, hit) !== null &&
      from.distanceTo(hit) < distance - .001)) blocked++;
  }
  return blocked;
}

test("the previous 16-degree dolly demonstrably intersects the real Philharmonie roof", () => {
  const hits = drawnHits(oldPosition, target);
  expect(hits.length).toBeGreaterThan(0);
  expect(hits[0].object.name).toBe("Concert halls measured shells bodies");
  expect(hits[0].faceIndex).toBe(195);
  expect(hits[0].distance).toBeCloseTo(3.323375274722142, 4);
  expect(drawnHits(new Vector3(...physical.position), target)).toHaveLength(0);
  expect(nativeBlockedPoints(oldPosition, [target])).toBe(1);
});

test("only Serra's flight bearing changes; physical approaches and every other flight stay intact", () => {
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  // Complete v1.0.178 profiles, not expectations calculated by the new helper.
  expect(digest(SIMULATION_START_VIEWS)).toBe("238f90c46c3997a04091f8433a8c5edd43b1ddde58540088bff4284e89990784");
  expect(digest(Object.keys(SIMULATION_START_VIEWS).filter(name => name !== NAME)
    .map(name => startupFlightView(name)))).toBe("850620fc961efe8ba5823200a9334308b33a8aa1eccf680840cd7e245d9519d7");
  const view = startupFlightView(NAME), camera = startupFlightCamera(NAME);
  expect(view.pose.target).toEqual(physical.target);
  expect(view.fov).toBe(16);
  expect(view.pose.position[1]).toBe(oldPosition.y);
  expect(new Vector3(...view.pose.position).distanceTo(target)).toBeCloseTo(oldPosition.distanceTo(target), 10);
  expect(camera.azimuth_degrees).toBeCloseTo(20, 10);
});

test("all actual drawn vertices of both steel plates have a clear concert-hall sightline", () => {
  const from = new Vector3(...startupFlightView(NAME).pose.position);
  for (const points of plates) {
    expect(points.length).toBeGreaterThan(400);
    expect(points.filter(point => drawnHits(oldPosition, point).length > 0).length).toBe(points.length);
    expect(points.filter(point => drawnHits(from, point).length > 0)).toHaveLength(0);
  }
});

test("every actual native steel corner is clear of the independent native concert-hall blocks", () => {
  expect(nativePlatePoints.length).toBe(nativeSteel.count * 8);
  expect(nativePlatePoints.length).toBeGreaterThan(16000);
  expect(hallBoxes.length).toBeGreaterThan(7000);
  expect(nativeBlockedPoints(new Vector3(...startupFlightView(NAME).pose.position), nativePlatePoints)).toBe(0);
});

test("both complete plate models fit desktop and narrow portrait projection", () => {
  const view = startupFlightView(NAME);
  for (const aspect of [16 / 9, 390 / 844]) {
    const camera = new PerspectiveCamera(view.fov, aspect, .1, 10000);
    camera.position.fromArray(view.pose.position);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    for (const point of [...plates.flat(), ...nativePlatePoints]) {
      const projected = point.clone().project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(.9);
      expect(Math.abs(projected.y)).toBeLessThan(.9);
      expect(projected.z).toBeGreaterThan(-1);
      expect(projected.z).toBeLessThan(1);
    }
  }
});

afterAll(() => {
  for (const root of [junction, halls, nativeHalls]) root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
  });
});
