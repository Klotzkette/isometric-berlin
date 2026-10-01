import { afterAll, describe, expect, test } from "bun:test";
import { BufferGeometry, Group, InstancedMesh, Material, Mesh, Raycaster, Texture, Vector3 } from "three";
import { createBikiniBerlin } from "../src/BikiniBerlin";
import { BIKINI_SOURCE, isBikiniReplacementCell } from "../src/bikiniProfile";
import type { PrismPayload } from "../src/IsometricCityWorld";
import {
  compilePedestrianObstacles, createPedestrianState, pedestrianPointIsBlocked,
  PEDESTRIAN_IDLE_INPUT, stepPedestrian, type PedestrianEnvironment,
} from "../src/pedestrianNavigation";

const drawn = createBikiniBerlin();
const native = createBikiniBerlin(true);
const stairPoint = [-2483.3738, 1408.6466] as const;
const stairY = 10.788235;
const glassPoint = [-2429.67546, 1413.367] as const;
const terracePoint = [-2456.685, 1411.971] as const;

function casts(root: Group, point: readonly number[], opaqueOnly = false): number[] {
  root.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(point[0], 50, point[1]), new Vector3(0, -1, 0));
  const targets = root.children.filter(child => child instanceof Mesh &&
    (!opaqueOnly || [child.material].flat().every(material => !material.transparent)));
  return ray.intersectObjects(targets, true).map(hit => hit.point.y);
}

function resources(root: Group): { renderables: number; vertices: number; instances: number; bytes: number } {
  let renderables = 0, vertices = 0, instances = 0, bytes = 0;
  const geometries = new Set<BufferGeometry>();
  root.traverse(object => {
    expect(object.matrixAutoUpdate).toBe(false);
    if (!(object instanceof Mesh)) return;
    renderables++;
    const materials = [object.material, object.userData.dayMaterial, object.userData.nightMaterial]
      .flat().filter((material): material is Material => material instanceof Material);
    for (const material of materials) {
      expect(Object.values(material).some(value => value instanceof Texture)).toBe(false);
    }
    if (object instanceof InstancedMesh) {
      instances += object.count;
      bytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
      expect(Array.from(object.instanceMatrix.array).every(Number.isFinite)).toBe(true);
      expect(object.count).toBe(object.instanceMatrix.count);
    }
    if (geometries.has(object.geometry)) return;
    geometries.add(object.geometry);
    vertices += object.geometry.getAttribute("position").count;
    for (const attribute of Object.values(object.geometry.attributes)) {
      bytes += attribute.array.byteLength;
      expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
    }
    bytes += object.geometry.index?.array.byteLength ?? 0;
  });
  return { renderables, vertices, instances, bytes };
}

afterAll(() => {
  const geometry = new Set<BufferGeometry>(), material = new Set<Material>();
  for (const root of [drawn, native]) root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    geometry.add(object.geometry);
    for (const item of [object.material, object.userData.dayMaterial, object.userData.nightMaterial].flat()) {
      if (item instanceof Material) material.add(item);
    }
  });
  geometry.forEach(item => item.dispose()); material.forEach(item => item.dispose());
});

describe("Bikini Berlin source rendering and walking", () => {
  test("both representations expose the real stair cut instead of the former mall cap", () => {
    for (const root of [drawn, native]) {
      const heights = casts(root, stairPoint);
      expect(heights.length).toBeGreaterThan(0);
      expect(heights[0]).toBeCloseTo(stairY, 4);
      expect(heights.some(y => Math.abs(y - 12.2) < .03)).toBe(false);
    }
  });

  test("the glass roof opening has no opaque grass cap, while the terrace stays low", () => {
    const opaque = casts(drawn, glassPoint, true);
    expect(opaque.length).toBeGreaterThan(0);
    expect(opaque.some(y => Math.abs(y - 13.2) < .03)).toBe(false);
    expect(casts(drawn, glassPoint).some(y => Math.abs(y - 13.2) < .03)).toBe(true);
    // Native glazing uses a coloured block roof surface rather than transparency.
    expect(casts(native, glassPoint)[0]).toBeCloseTo(13.212, 3);
    for (const root of [drawn, native]) {
      expect(casts(root, terracePoint)[0]).toBeCloseTo(12.212, 3);
      expect(casts(root, terracePoint).some(y => y > 12.23)).toBe(false);
    }
  });

  test("grass roofs have one finish surface without a competing concrete cap", () => {
    const grassSamples = [
      [-2470.205737, 1410.89], // Planted roof way 364868132.
      [-2526.341228, 1399.7485], // Planted roof way 364868138.
      [-2423.705917, 1420.2785], // Relation 5424774 / structural member 364868139.
    ];
    for (const root of [drawn, native]) for (const point of grassSamples) {
      const heights = casts(root, point, true);
      expect(heights.filter(y => Math.abs(y - 13.212) < .002)).toHaveLength(1);
      expect(heights.some(y => Math.abs(y - 13.2) < .002)).toBe(false);
    }

    // Removing a duplicate top cap must preserve the original source walls.
    const slab = BIKINI_SOURCE.parts.find(part => part.id === "364457336")!;
    const edges = slab.ring.slice(0, -1).map((a, i) => ({ a, b: slab.ring[i + 1] }))
      .sort((left, right) => Math.hypot(right.b[0] - right.a[0], right.b[1] - right.a[1]) -
        Math.hypot(left.b[0] - left.a[0], left.b[1] - left.a[1]));
    const { a, b } = edges[0], dx = b[0] - a[0], dz = b[1] - a[1];
    const area = slab.ring.slice(0, -1).reduce((sum, point, i) =>
      sum + point[0] * slab.ring[i + 1][1] - slab.ring[i + 1][0] * point[1], 0);
    const sign = Math.sign(area), length = Math.hypot(dx, dz);
    const normal = new Vector3(sign * dz / length, 0, -sign * dx / length);
    const centre = new Vector3((a[0] + b[0]) / 2, 20.9, (a[1] + b[1]) / 2);
    const ray = new Raycaster(centre.clone().addScaledVector(normal, 2), normal.clone().negate(), 0, 3);
    const walls = drawn.children.filter(child => child.name === "Bikini complete mapped building parts");
    expect(walls).toHaveLength(1);
    expect(ray.intersectObjects(walls, false)[0].distance).toBeCloseTo(2, 3);
  });

  test("all source parts remain represented in finite, texture-free bounded batches", () => {
    for (const root of [drawn, native]) {
      expect(root.userData.sourcePartIds).toEqual(BIKINI_SOURCE.parts.map(part => part.id));
      expect(root.userData.sourcePartIds).toHaveLength(103);
      expect(root.userData.textureFree).toBe(true);
      expect(root.userData.sourceEnvelopeRetained).toBe(true);
    }
    const smooth = resources(drawn), block = resources(native);
    expect(smooth.renderables).toBe(3);
    expect(smooth.vertices).toBeLessThanOrEqual(32_000);
    // Added v165 terrace blades / timber caps and mapped glass-roof frames.
    expect(smooth.instances).toBeLessThanOrEqual(6_000);
    expect(smooth.bytes).toBeLessThan(850_000);
    expect(block.renderables).toBe(2);
    expect(block.vertices).toBeLessThanOrEqual(9_000);
    expect(block.instances).toBeLessThanOrEqual(24_000);
    expect(block.bytes).toBeLessThan(1_950_000);
    expect(native.userData.nativeMinecraft).toBe(true);
  });

  test("the photographed terrace balustrade and glazing frames stay in both styles", () => {
    for (const root of [drawn, native]) {
      expect(root.userData.recognitionFeatures).toEqual({ terraceRailFields: 223, glassRoofFrames: 126 });
    }
    expect(drawn.userData.detailInstances).toBe(5835);
    expect(native.userData.detailInstances).toBe(23271);
  });

  test("native ownership removes every exclusive column and preserves every shared one", () => {
    for (const [x, z] of BIKINI_SOURCE.native.exclusiveOccupiedCells) {
      expect(isBikiniReplacementCell(x, z, 4)).toBe(true);
    }
    for (const [x, z] of BIKINI_SOURCE.native.mixedOccupiedCells) {
      expect(isBikiniReplacementCell(x, z, 4)).toBe(false);
    }
    for (const size of [0, -4, 2, NaN, Infinity]) {
      expect(isBikiniReplacementCell(-2440, 1420, size)).toBe(false);
    }
    expect(isBikiniReplacementCell(-2441, 1420, 4)).toBe(false);
    expect(isBikiniReplacementCell(-2440, 1421, 4)).toBe(false);
    expect(isBikiniReplacementCell(0, 0, 4)).toBe(false);
    const owned = new Set(BIKINI_SOURCE.native.exclusiveOccupiedCells.map(cell => cell.join(",")));
    for (const [x, z] of BIKINI_SOURCE.native.exclusiveOccupiedCells) {
      const expected = [[x, z], [x + 4, z], [x, z + 4], [x + 4, z + 4]]
        .every(cell => owned.has(cell.join(",")));
      expect(isBikiniReplacementCell(x, z, 8)).toBe(expected);
    }
  });

  test("collision lands on the visible stair and terrace rather than duplicate parent volumes", () => {
    const buildings = BIKINI_SOURCE.previousDisplayPrisms as PrismPayload["buildings"];
    expect(buildings.map(building => building.id)).toEqual(["-5419303", "64457341"]);
    for (const mode of ["day", "night", "snowstorm", "minecraft", "schwellenraum"] as const) {
      const obstacles = compilePedestrianObstacles({ buildings }, () => mode);
      const duplicate = compilePedestrianObstacles({ buildings: [...buildings, ...buildings] }, () => mode);
      expect(duplicate.obstacleCount).toBe(obstacles.obstacleCount);
      const environment: PedestrianEnvironment = {
        bounds: { minX: -2600, maxX: -2300, minZ: 1320, maxZ: 1490 },
        groundAt: () => 5.2, obstacles, water: [], visualMode: () => mode,
      };
      for (const [point, top] of [[stairPoint, stairY], [terracePoint, 12.2]] as const) {
        const [x, z] = point;
        const state = createPedestrianState(environment, {
          x, z, yaw: 0, groundYHint: 45, preserveHorizontalPosition: true,
        });
        expect(state.x).toBe(x); expect(state.z).toBe(z);
        expect(state.groundY).toBeCloseTo(top, 4);
        expect(stepPedestrian(state, PEDESTRIAN_IDLE_INPUT, .04, environment).state.groundY).toBeCloseTo(top, 4);
        expect(pedestrianPointIsBlocked(x, z, top, obstacles)).toBe(false);
        expect(pedestrianPointIsBlocked(x, z, top - .5, obstacles)).toBe(true);
      }
    }
  });
});
