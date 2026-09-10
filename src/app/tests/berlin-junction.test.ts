import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, LineSegments, Mesh, Raycaster, Vector3 } from "three";
import {
  BERLIN_JUNCTION_PROFILE as P,
  berlinJunctionPlatePoint, berlinJunctionSolidAt,
  createBerlinJunction, setBerlinJunctionPresentation,
} from "../src/BerlinJunction";
import { worldGroundSampler, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import ground from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const root = createBerlinJunction();
root.updateMatrixWorld(true);
const smooth = root.children[0];
const plates = smooth.children.filter(child => child instanceof Mesh) as Mesh[];
const halfAngle = P.plateLengthM / (2 * (P.middleRadiusM + P.topInwardDisplacementM / 2));
const world = (local: Vector3) => root.localToWorld(local.clone());
const middle = (angle: number, height: number) =>
  berlinJunctionPlatePoint(-1, angle, height).add(berlinJunctionPlatePoint(1, angle, height)).multiplyScalar(0.5);

describe("Richard Serra's photographed Berlin Junction", () => {
  test("keeps the mapped anchor and source height separate from photographic fits", () => {
    expect(P.worldM).toEqual([-201.8, 931.8]);
    expect(root.position.toArray()).toEqual([-201.017, 4, 932.914]);
    expect(worldGroundSampler(ground as unknown as VoxelPayload)(...P.worldM)).toBe(4);
    expect(P.plateHeightM).toBe(3.4);
    expect(P.plateLengthM).toBe(14);
    expect(P.geometryStatus).toContain("thickness");
    expect(P.geometryStatus).toContain("not surveyed");
  });

  test("uses exactly two uninterrupted curved shells with thin, closed edges", () => {
    expect(plates).toHaveLength(2);
    for (const plate of plates) {
      const positions = plate.geometry.getAttribute("position");
      expect(positions.count).toBeLessThan(3200);
      const bounds = new Box3().setFromBufferAttribute(positions);
      expect(bounds.max.y - bounds.min.y).toBeCloseTo(3.4, 1);
      expect(plate.geometry.getAttribute("uv")).toBeUndefined();
      const ink = smooth.children.find(child => child instanceof LineSegments &&
        smooth.children.indexOf(child) === smooth.children.indexOf(plate) + 1) as LineSegments;
      // An arc's perimeter is allowed; the former 18 outlined boxes per plate are not.
      expect(ink.geometry.getAttribute("position").count).toBeLessThan(500);
      for (const angle of [-0.25, 0, 0.25]) {
        const side = plate === plates[0] ? -1 : 1;
        const point = world(berlinJunctionPlatePoint(side, angle, 1.5));
        const direction = new Vector3(-Math.cos(angle), 0, Math.sin(angle)).transformDirection(root.matrixWorld);
        const ray = new Raycaster(point.clone().addScaledVector(direction, 0.3), direction.clone().negate(), 0, 0.6);
        const hits = ray.intersectObject(plate, false);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].distance).toBeGreaterThan(0.26);
        expect(hits[0].distance).toBeLessThan(0.29);
      }
    }
  });

  test("both plates bend the same way and converge above the open walking corridor", () => {
    for (const side of [-1, 1]) {
      const centre = berlinJunctionPlatePoint(side, 0, 0);
      const end = berlinJunctionPlatePoint(side, halfAngle, 0);
      expect(end.x - centre.x).toBeGreaterThan(1.25);
      const top = berlinJunctionPlatePoint(side, 0, P.plateHeightM);
      expect((centre.x - top.x) * side).toBeCloseTo(0.625, 5);
    }
    const highGap = berlinJunctionPlatePoint(1, 0, P.plateHeightM).x -
      berlinJunctionPlatePoint(-1, 0, P.plateHeightM).x;
    expect(highGap).toBeCloseTo(0.5, 5);
  });

  test("a walking capsule can follow the curved passage without crossing rendered triangles", () => {
    const ray = new Raycaster();
    for (let i = 0; i <= 40; i += 1) {
      const angle = -halfAngle + 2 * halfAngle * i / 40;
      for (const height of [0.15, 1, 1.8]) {
        const center = middle(angle, height);
        for (const offset of [-0.42, 0, 0.42]) {
          const point = world(center.clone().add(new Vector3(-Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(offset)));
          expect(berlinJunctionSolidAt(point.x, point.y, point.z)).toBeFalse();
        }
        if (i < 40) {
          const start = world(center), end = world(middle(angle + 2 * halfAngle / 40, height));
          const distance = start.distanceTo(end);
          ray.set(start, end.sub(start).normalize());
          ray.far = distance;
          expect(ray.intersectObjects(plates, false)).toHaveLength(0);
        }
      }
    }
  });

  test("Minecraft substitutes one bounded surface batch, with no smooth double or filled passage", () => {
    const minecraft = root.children.find(child => child instanceof InstancedMesh) as InstancedMesh;
    expect(minecraft.count).toBeLessThan(3200);
    expect(minecraft.count).toBeGreaterThan(1800);
    for (const enabled of [true, false, true, false]) {
      setBerlinJunctionPresentation(root, enabled);
      expect(smooth.visible).toBe(!enabled);
      expect(minecraft.visible).toBe(enabled);
    }
    expect(root.userData.schwellenraumGeschuetzt).toBeTrue();
  });
});
