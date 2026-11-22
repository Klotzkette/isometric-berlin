import { expect, test } from "bun:test";
import { Group, Mesh, Raycaster, Vector3 } from "three";
import { createSmoothSurfaces, type SurfacePayload } from "../src/IsometricCityWorld";
import { splitParkSurfaceFamily } from "../src/progressiveWorld";
import { applyMittePathLawnV375, loadMittePathLawnsV375 } from "../src/MittePathLawnV375";
import { districtStreetTerrainSampler } from "../src/DistrictStreets";
import { type VoxelPayload } from "../src/terrainPayload";
import { serializeObject3DForTransfer, deserializeTransferredObject3D } from "../src/transferableObject3D";
import packets from "../src/data/mittePathLawnV375.json";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import surfaces from "../public/mesh/regierungsviertel/surface-polygons.json";

const terrain = districtStreetTerrainSampler(ground as VoxelPayload);
const batches = splitParkSurfaceFamily(surfaces as unknown as SurfacePayload);
const count = [5198, 195, 55, 37, 4, 3, 1];
const options = { invalidenGroundV371: true, parliamentaryDiningV296: true, waterfrontV296: true };
function actualBatch(i: number) {
  return createSmoothSurfaces(batches[i], 0, 5.35, terrain, options);
}
function groundAt(mesh: Mesh, x: number, z: number) {
  mesh.updateMatrixWorld(true);
  return new Raycaster(new Vector3(x, 20, z), new Vector3(0, -1, 0))
    .intersectObject(mesh, true).map(hit => hit.point.y);
}

test("all seven real worker lawn batches keep their original GPU buffers and both day and night materials", () => {
  for (let i = 0; i < batches.length; i++) {
    const root = actualBatch(i);
    const lawn = root.getObjectByName("smooth parkland lawns") as Mesh;
    const { position } = lawn.geometry.attributes;
    const index = lawn.geometry.index!;
    applyMittePathLawnV375(root, packets);
    expect(lawn.geometry.userData.mittePathLawnV375).toBe(count[i]);
    expect(lawn.geometry.attributes.position).toBe(position);
    expect(lawn.geometry.index).toBe(index);
    expect(lawn.children).toHaveLength(1);
    const remaining = lawn.children[0] as Mesh;
    expect(remaining.material).toBe(lawn.material);
    expect(remaining.userData.nightMaterial).toBe(lawn.userData.nightMaterial);
    expect(remaining.userData.groundFinishV348).toBe(lawn.userData.groundFinishV348);
    applyMittePathLawnV375(root, packets);
    expect(lawn.children).toHaveLength(1);
  }
}, 60_000);

test("a worker transfer opens the mapped way and keeps the adjacent original lawn's true slope", () => {
  const root = actualBatch(6);
  const lawn = root.getObjectByName("smooth parkland lawns") as Mesh;
  const x = -634.86986, z = 753.34882, expected = 3.315121;
  const besideX = -631.77963, besideZ = 756.05478, adjacent = 3.471553;
  expect(groundAt(lawn, x, z).some(y => Math.abs(y - expected) < .0001)).toBeTrue();
  expect(groundAt(lawn, besideX, besideZ).some(y => Math.abs(y - adjacent) < .0001)).toBeTrue();

  applyMittePathLawnV375(root, packets);
  const transfer = serializeObject3DForTransfer(root);
  const received = deserializeTransferredObject3D(transfer.object) as Group;
  const finalLawn = received.getObjectByName(lawn.name) as Mesh;
  expect(groundAt(finalLawn, x, z).some(y => Math.abs(y - expected) < .0001)).toBeFalse();
  expect(groundAt(finalLawn, besideX, besideZ).some(y => Math.abs(y - adjacent) < .0001)).toBeTrue();
});

test("a changed original height at the only affected face rejects the entire patch", () => {
  const root = actualBatch(6);
  const lawn = root.getObjectByName("smooth parkland lawns") as Mesh;
  const index = lawn.geometry.index!, position = lawn.geometry.attributes.position;
  const at = index.getX(324 * 3);
  position.setY(at, position.getY(at) + .01);
  const before = index.array.slice();
  applyMittePathLawnV375(root, packets);
  expect(index.array).toEqual(before);
  expect(lawn.children).toHaveLength(0);
});

test("an unavailable lawn asset preserves the original park and allows a later batch to retry", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  try {
    globalThis.fetch = (async () => {
      requests++;
      return requests === 1 ? new Response(null, { status: 503 }) : Response.json(packets);
    }) as typeof fetch;
    const root = actualBatch(6);
    const lawn = root.getObjectByName("smooth parkland lawns") as Mesh;
    applyMittePathLawnV375(root, await loadMittePathLawnsV375());
    expect(lawn.children).toHaveLength(0);
    const [first, again] = await Promise.all([loadMittePathLawnsV375(), loadMittePathLawnsV375()]);
    expect(requests).toBe(2);
    expect(again).toBe(first);
    applyMittePathLawnV375(root, first);
    expect(lawn.children).toHaveLength(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
