import { describe, expect, test } from "bun:test";
import {
  Box3, BufferGeometry, Color, Group, InstancedMesh, LineSegments, Matrix4,
  Mesh, Raycaster, Texture, Vector3,
} from "three";
import {
  createMinecraftZollpackhofDetails, createZollpackhofDetails,
} from "../src/ZollpackhofDetails";
import {
  ZOLLPACKHOF_PARTS, ZOLLPACKHOF_PROFILE, zollpackhofContains,
} from "../src/zollpackhofProfile";
import { pointInWorldRing } from "../src/chancelleryExtensionProfile";
import { PRISM_SUPPRESSED_IDS } from "../src/IsometricCityWorld";
import { isCompleteRecognitionVoxelColumn } from "../src/MinecraftVoxelWorld";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";

function geometryBudget(root: Group) {
  let draws = 0, bytes = 0, instances = 0;
  const geometries = new Set<BufferGeometry>();
  root.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    draws += 1;
    if (!geometries.has(object.geometry)) {
      geometries.add(object.geometry);
      for (const attribute of Object.values(object.geometry.attributes)) {
        bytes += attribute.array.byteLength;
        expect(Array.from(attribute.array).every(Number.isFinite)).toBeTrue();
      }
      bytes += object.geometry.index?.array.byteLength ?? 0;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      expect(Object.values(material).some((value) => value instanceof Texture)).toBeFalse();
    }
    if (object instanceof InstancedMesh) {
      instances += object.count;
      bytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
      const matrix = new Matrix4();
      const scale = new Vector3();
      for (let i = 0; i < object.count; i += 1) {
        object.getMatrixAt(i, matrix);
        expect(matrix.elements.every(Number.isFinite)).toBeTrue();
        scale.setFromMatrixScale(matrix);
        expect(Math.min(scale.x, scale.y, scale.z)).toBeGreaterThan(0);
      }
    }
  });
  return { draws, bytes, instances };
}

function pointSegmentDistance(x: number, z: number, a: readonly number[], b: readonly number[]) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

describe("Zollpackhof source-bound restaurant and remise", () => {
  test("retains both complete official plans and records the height conflict explicitly", () => {
    expect(ZOLLPACKHOF_PROFILE.parentGmlId).toBe("DEBE01YYK0002Tak");
    expect(ZOLLPACKHOF_PROFILE.restaurantOsmNode).toBe(269676264);
    expect(ZOLLPACKHOF_PROFILE.gardenOsmWay).toBe(422205278);
    expect(ZOLLPACKHOF_PROFILE.checkedSourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(ZOLLPACKHOF_PROFILE.geometryStatus).toContain("non-surveyed display estimates");
    expect(ZOLLPACKHOF_PARTS.map(({ sourceHeightM }) => sourceHeightM)).toEqual([26.046, 17.639]);
    expect(ZOLLPACKHOF_PARTS.map(({ wallHeightM, roofRiseM }) => wallHeightM + roofRiseM)).toEqual([8.4, 7.7]);
    for (const part of ZOLLPACKHOF_PARTS) {
      const source = prisms.buildings.find(({ id }) => id === part.id)!;
      expect(part.ring).toEqual(source.ring.map((point) => point.map((value) => value / 10)));
      expect(source.holes).toHaveLength(0);
      expect(part.groundY).toBe(source.y0_dm / 10);
      expect(Math.round(part.sourceHeightM * 10)).toBe(source.h_dm);
      expect(part.wallHeightM + part.roofRiseM).toBeLessThan(part.sourceHeightM);
      expect(PRISM_SUPPRESSED_IDS.has(part.id)).toBeTrue();
    }
  });

  test("replaces only the restaurant footprints, keeping the garden and river outside", () => {
    for (const part of ZOLLPACKHOF_PARTS) {
      const x = part.ring.reduce((sum, p) => sum + p[0], 0) / part.ring.length;
      const z = part.ring.reduce((sum, p) => sum + p[1], 0) / part.ring.length;
      expect(zollpackhofContains(x, z)).toBeTrue();
      expect(isCompleteRecognitionVoxelColumn(x, z)).toBeTrue();
    }
    for (const [x, z] of [[-295, -250], [-285, -266], [-320, -284], [-270, -245]]) {
      expect(zollpackhofContains(x, z)).toBeFalse();
    }
  });

  for (const [name, build, maxBytes, draws] of [
    ["drawn", createZollpackhofDetails, 260_000, 2],
    ["Minecraft", createMinecraftZollpackhofDetails, 55_000, 1],
  ] as const) {
    test(`${name} preserves the low roof silhouette and texture-free bounded batches`, () => {
      const root = build();
      const stats = geometryBudget(root);
      expect(stats.draws).toBe(draws);
      expect(stats.bytes).toBeGreaterThan(0);
      expect(stats.bytes).toBeLessThan(maxBytes);
      if (name === "Minecraft") expect(stats.instances).toBeLessThan(700);
      expect(root.userData.detailCounts).toEqual({
        archedEntrance: 1, archedWindows: 23, dormers: 3, lamps: 2, sourceParts: 2,
      });
      const bounds = new Box3().setFromObject(root);
      expect(bounds.min.x).toBeGreaterThan(-327);
      expect(bounds.max.x).toBeLessThan(-292);
      expect(bounds.min.z).toBeGreaterThan(-286);
      expect(bounds.max.z).toBeLessThan(-252);
      expect(bounds.min.y).toBeCloseTo(5.4, 4);
      expect(bounds.max.y).toBeGreaterThan(13.5);
      expect(bounds.max.y).toBeLessThan(14);
    });

    test(`${name} has roof surfaces over the interior instead of a perforated roof grid`, () => {
      const root = build();
      root.updateMatrixWorld(true);
      const meshes: Mesh[] = [];
      root.traverse((object) => { if (object instanceof Mesh) meshes.push(object); });
      const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
      let samples = 0;
      for (const part of ZOLLPACKHOF_PARTS) {
        const xs = part.ring.map(([x]) => x), zs = part.ring.map(([, z]) => z);
        for (let x = Math.min(...xs); x < Math.max(...xs); x += 0.8) {
          for (let z = Math.min(...zs); z < Math.max(...zs); z += 0.8) {
            if (!pointInWorldRing(x, z, part.ring)) continue;
            const clearance = Math.min(...part.ring.map((p, i) => pointSegmentDistance(x, z, p, part.ring[(i + 1) % part.ring.length])));
            // Half-cells at the exact historic boundary are deliberately stepped;
            // the uninterrupted occupied roof interior must still be covered.
            if (clearance < 1.3) continue;
            ray.ray.origin.set(x, 30, z);
            const hits = ray.intersectObjects(meshes, false);
            expect(hits.length).toBeGreaterThan(0);
            expect(hits[0].point.y).toBeGreaterThan(part.groundY + part.wallHeightM + 0.1);
            samples += 1;
          }
        }
      }
      expect(samples).toBeGreaterThan(200);
    });

    test(`${name} exposes the side window panes in front of the wall shell`, () => {
      const root = build();
      root.updateMatrixWorld(true);
      const meshes: Mesh[] = [];
      root.traverse((object) => { if (object instanceof Mesh) meshes.push(object); });
      const glass = new Color(0x31454b);
      for (const part of ZOLLPACKHOF_PARTS) {
        // Edge 0 of the restaurant lies against the remise's source plan;
        // probe an exposed wall instead of their internal meeting seam.
        const a = part.ring[3], b = part.ring[4];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ux = (b[0] - a[0]) / length, uz = (b[1] - a[1]) / length;
        const area = part.ring.reduce((sum, p, i) => {
          const q = part.ring[(i + 1) % part.ring.length];
          return sum + p[0] * q[1] - q[0] * p[1];
        }, 0);
        const nx = uz * Math.sign(area), nz = -ux * Math.sign(area);
        const bays = Math.max(1, Math.floor((length - 1.5) / 3.35));
        const along = length / bays / 2 + 0.25;
        const origin = new Vector3(a[0] + ux * along + nx * 3, part.groundY + 1.3, a[1] + uz * along + nz * 3);
        const hit = new Raycaster(origin, new Vector3(-nx, 0, -nz)).intersectObjects(meshes, false)[0];
        expect(hit).toBeDefined();
        const color = new Color();
        if (hit.object instanceof InstancedMesh) hit.object.getColorAt(hit.instanceId!, color);
        else {
          const attribute = (hit.object as Mesh).geometry.getAttribute("color");
          color.setRGB(attribute.getX(hit.face!.a), attribute.getY(hit.face!.a), attribute.getZ(hit.face!.a));
        }
        expect(color.r).toBeCloseTo(glass.r, 2);
        expect(color.g).toBeCloseTo(glass.g, 2);
        expect(color.b).toBeCloseTo(glass.b, 2);
        expect(hit.distance).toBeLessThan(3);
      }
    });
  }
});
