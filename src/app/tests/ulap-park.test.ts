import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { BufferGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import { createUlapPark, ULAP_SOURCE as source } from "../src/UlapPark";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import parkPayload from "../public/mesh/regierungsviertel/park-details.json";

const ground = (x: number, z: number) => 4.3 + (x + 450) * .007 + (z + 470) * .012;
function measure(root: Group) {
  const hash = createHash("sha256"), seen = new Set<BufferGeometry>();
  let bytes = 0, draws = 0, instances = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    draws++;
    expect(object.matrixAutoUpdate).toBeFalse();
    expect(object.userData.dayMaterial.map).toBeNull();
    expect(object.userData.nightMaterial.map).toBeNull();
    if (!seen.has(object.geometry)) {
      seen.add(object.geometry);
      for (const attribute of Object.values(object.geometry.attributes)) {
        expect(Array.from(attribute.array).every(Number.isFinite)).toBeTrue();
        bytes += attribute.array.byteLength;
        hash.update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
      }
      bytes += object.geometry.index?.array.byteLength ?? 0;
    }
    if (object instanceof InstancedMesh) {
      instances += object.count;
      bytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
      expect(Array.from(object.instanceMatrix.array).every(Number.isFinite)).toBeTrue();
      hash.update(new Uint8Array(object.instanceMatrix.array.buffer));
    }
  });
  return { bytes, draws, instances, hash: hash.digest("hex") };
}

test("ULAP is bounded, texture-free and uses identical complete drawn geometry on touch", () => {
  const drawn = measure(createUlapPark(ground));
  expect(measure(createUlapPark(ground))).toEqual(drawn);
  const native = createUlapPark(ground, true), n = measure(native);
  expect(drawn.draws).toBe(4);
  expect(n.draws).toBe(4);
  expect(drawn.bytes).toBeLessThan(160_000);
  expect(n.bytes).toBeLessThan(160_000);
  expect(native.userData.blockNative).toBeTrue();
  for (const mesh of native.children.filter(child => child instanceof InstancedMesh)) {
    expect(mesh.geometry.getAttribute("position").count).toBe(24);
    expect(mesh.userData.hiddenSolidInfill).toBeFalse();
  }
  expect(new Set(source.benches.map(bench => bench.id)).size).toBe(31);
  expect(source.benches.filter(bench => (bench.tags as { material?: string }).material === "concrete")).toHaveLength(2);
  console.log("ULAP budgets", { drawn, native: n });
});

test("fine gravel remains wholly inside the mapped park and off its planted bank", () => {
  const root = createUlapPark(ground), mesh = root.children[0] as Mesh;
  const points = mesh.geometry.getAttribute("position");
  const ring = source.parkRing.slice(0, -1);
  const area = ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0);
  expect(points.count).toBeGreaterThan(1000);
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), z = points.getZ(i);
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j], b = ring[(j + 1) % ring.length];
      const distance = Math.sign(area) * ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
      expect(distance).toBeGreaterThan(-.001);
    }
    expect((98 * (z + 479) - 35 * (x + 484))).toBeLessThan(.01);
    expect(points.getY(i)).toBeCloseTo(ground(x, z) + .16, 4);
  }
});

test("mapped landings fill both historic stair breaks while original trunks stay open", () => {
  const root = createUlapPark(() => 4.3);
  root.updateMatrixWorld(true);
  const stone = root.getObjectByName("ULAP mapped stair flights and concrete details")!;
  const hitsAt = (x: number, z: number) => new Raycaster(new Vector3(x, 6, z), new Vector3(0, -1, 0), 0, 3).intersectObject(stone, false);
  for (const id of [1395945052, 1395945054, 1395945055, 342098505, 361460040]) {
    const path = source.stairsAndLandings.find(path => path.id === id)!;
    for (let i = 0; i + 1 < path.points.length; i++) {
      const a = path.points[i], b = path.points[i + 1];
      expect(hitsAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2).length).toBeGreaterThan(0);
    }
  }
  for (const tree of source.stairTrees.records) {
    expect(parkPayload.trees.some(original => original.tr === tree.trunkRadius && original.position.every((p, i) => p === tree.position[i]))).toBeTrue();
    expect(hitsAt(tree.position[0], tree.position[2])).toHaveLength(0);
  }
});

test("western handrails follow the supplied grade and warm bench lights switch reversibly", () => {
  const root = createUlapPark(ground), stone = root.children[1] as InstancedMesh;
  const matrix = new Matrix4(), scale = new Vector3(), center = new Vector3();
  let pitchedRails = 0;
  for (let i = 0; i < stone.count; i++) {
    stone.getMatrixAt(i, matrix);
    scale.setFromMatrixScale(matrix);
    if (Math.abs(scale.x - .065) < 1e-5 && Math.abs(scale.y - .065) < 1e-5) {
      center.setFromMatrixPosition(matrix);
      expect(Math.abs(matrix.elements[9])).toBeGreaterThan(.0001);
      expect(matrix.elements[9]).toBeCloseTo(.007 * matrix.elements[8] + .012 * matrix.elements[10], 6);
      // The transverse tread stays level across its 2.8 m width; rails use
      // its axis grade, with at most this small cross-slope difference.
      expect(Math.abs(center.y - ground(center.x, center.z) - 1.13)).toBeLessThan(.025);
      pitchedRails++;
    }
  }
  expect(pitchedRails).toBe(16);
  const lamps = root.getObjectByName("ULAP recessed warm bench lights") as InstancedMesh;
  expect(lamps.count).toBe(29);
  setIsoNightPresentation(root, true, true, "night");
  const material = lamps.material as MeshStandardMaterial;
  expect(material).toBe(lamps.userData.nightMaterial);
  expect(material.emissiveIntensity).toBe(.85);
  setIsoNightPresentation(root, true, false, "night");
  expect(material.emissiveIntensity).toBeLessThan(.2);
  setIsoNightPresentation(root, true, true, "night");
  expect(material.emissiveIntensity).toBe(.85);
  setIsoNightPresentation(root, false, true, "day");
  expect(lamps.material).toBe(lamps.userData.dayMaterial);
});
