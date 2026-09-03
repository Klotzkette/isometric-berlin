import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  Box3,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import {
  createSonyCenterSurroundings,
  createMinecraftSonyCenterSurroundings,
} from "../src/SonyCenterSurroundings";
import {
  SONY_SURROUNDING_BUILDINGS,
  SONY_SURROUNDINGS_PRISM_TONES,
  SONY_SURROUNDINGS_PROFILE,
  SONY_SURROUNDINGS_GROUP_NAME,
  MINECRAFT_SONY_SURROUNDINGS_GROUP_NAME,
} from "../src/sonyCenterSurroundingsProfile";
import {
  FINE_DETAIL_LAYER_NAMES,
  readDetailFadeRangeM,
} from "../src/fineDetailFade";
import { applyMinecraftVisibility } from "../src/MinecraftVisibility";
import {
  HERO_PRISM_TONES,
  PRISM_SUPPRESSED_IDS,
  createDistantBuildingShells,
  type PrismPayload,
} from "../src/IsometricCityWorld";
import {
  SONY_CENTER_ROOF_PRISM_IDS,
  createSonyRoofColumnTopAt,
} from "../src/sonyCenterRoofSource";
import { compilePedestrianObstacles } from "../src/pedestrianNavigation";

const prisms = JSON.parse(
  readFileSync(
    new URL(
      "../public/mesh/regierungsviertel/lod2-prisms.json",
      import.meta.url,
    ),
    "utf8",
  ),
).buildings as {
  id: string;
  ring: [number, number][];
  y0_dm: number;
  h_dm: number;
}[];
const byId = new Map(prisms.map((prism) => [prism.id, prism]));

describe("Sony Center surrounding architecture", () => {
  test("keeps the suspended canopy out of solid coverage and pedestrian obstacles", () => {
    expect(SONY_CENTER_ROOF_PRISM_IDS.size).toBe(72);
    const roofParts = prisms.filter(({ id }) =>
      SONY_CENTER_ROOF_PRISM_IDS.has(id),
    );
    expect(roofParts).toHaveLength(72);
    for (const part of roofParts) {
      expect(PRISM_SUPPRESSED_IDS.has(part.id)).toBe(true);
      expect(part.h_dm).toBeGreaterThan(400);
    }
    const payload = {
      buildings: roofParts,
      schema_version: 1,
      classes: ["concrete"],
    } as PrismPayload;
    expect(
      createDistantBuildingShells(payload, payload.buildings).children,
    ).toHaveLength(0);
    expect(compilePedestrianObstacles(payload).buildingCount).toBe(0);
    for (const building of SONY_SURROUNDING_BUILDINGS) {
      for (const { prismId } of building.runs)
        expect(PRISM_SUPPRESSED_IDS.has(prismId)).toBe(false);
    }
    expect(SONY_CENTER_ROOF_PRISM_IDS.has("FutkZPlg")).toBe(false);
    expect(SONY_CENTER_ROOF_PRISM_IDS.has("Y51VVu2v")).toBe(false);
  });

  test("removes only false voxel height while preserving underlying measured neighbours", () => {
    const topAt = createSonyRoofColumnTopAt(prisms);
    expect(topAt(100, 1000, 5, 70)).toBe(5);
    expect(topAt(110, 995, 5, 70)).toBe(5);
    expect(topAt(113.8, 1002.2, 5.2, 72.2)).toBe(5.2);
    expect(topAt(70, 954, 4.7, 70)).toBe(47.6);
    expect(topAt(100, 1035, 5.1, 70)).toBe(47.1);
    expect(topAt(100, 1000, 5, 15)).toBe(15);
    expect(topAt(400, 1000, 5, 70)).toBe(70);
    expect(topAt(100, 1200, 5, 70)).toBe(70);
    expect(createSonyRoofColumnTopAt()(100, 1000, 5, 70)).toBe(70);
    const viewer = readFileSync(
      new URL("../src/ThreeViewer.tsx", import.meta.url),
      "utf8",
    );
    expect(viewer).toContain("sourcePrisms: prisms?.buildings");
    const voxel = readFileSync(
      new URL("../src/MinecraftVoxelWorld.ts", import.meta.url),
      "utf8",
    );
    expect(voxel).toContain("createSonyRoofColumnTopAt(options.sourcePrisms)");
  });

  test("keeps ten distinct buildings on consecutive measured exterior edges", () => {
    expect(SONY_SURROUNDING_BUILDINGS).toHaveLength(10);
    expect(
      new Set(SONY_SURROUNDING_BUILDINGS.map(({ style }) => style)).size,
    ).toBe(8);
    for (const building of SONY_SURROUNDING_BUILDINGS) {
      expect(building.parentId).toStartWith("DEBE01");
      for (const run of building.runs) {
        const prism = byId.get(run.prismId)!;
        expect(prism).toBeDefined();
        expect(run.groundY).toBe(prism.y0_dm / 10);
        expect(run.heightM).toBe(prism.h_dm / 10);
        let twiceArea = 0;
        prism.ring.forEach((p, i) => {
          const q = prism.ring[(i + 1) % prism.ring.length];
          twiceArea += p[0] * q[1] - q[0] * p[1];
        });
        expect(twiceArea).toBeGreaterThan(0);
        for (let i = 0; i < run.chain.length - 1; i += 1) {
          const p = run.chain[i];
          const q = run.chain[i + 1];
          const index = prism.ring.findIndex(
            ([x, z]) => x / 10 === p[0] && z / 10 === p[1],
          );
          expect(index).toBeGreaterThanOrEqual(0);
          expect(
            prism.ring[(index + 1) % prism.ring.length].map((v) => v / 10),
          ).toEqual(q);
        }
      }
    }
    for (const [id, tone] of Object.entries(SONY_SURROUNDINGS_PRISM_TONES)) {
      expect(byId.has(id)).toBe(true);
      expect(HERO_PRISM_TONES[id]).toBe(tone);
    }
    for (const historic of ["6ZvK3IfU", "RYwMAXsA", "sdLwiqUZ"]) {
      expect(SONY_SURROUNDINGS_PRISM_TONES[historic]).toBeUndefined();
    }
  });

  test("shares one untextured cube and two materials across ten bounded batches", () => {
    const group = createSonyCenterSurroundings();
    expect(group.children).toHaveLength(10);
    expect(group.userData.instanceCount).toBe(6508);
    expect(group.userData.instanceCount).toBeLessThanOrEqual(
      SONY_SURROUNDINGS_PROFILE.performance.drawnInstanceBudget,
    );
    expect(group.userData.instanceBufferBytes).toBeLessThan(500_000);
    expect(group.userData.underlyingLoD2Retained).toBe(true);
    const meshes = group.children as InstancedMesh[];
    expect(new Set(meshes.map((mesh) => mesh.geometry)).size).toBe(1);
    expect(new Set(meshes.map((mesh) => mesh.material)).size).toBe(1);
    expect(
      new Set(meshes.map((mesh) => mesh.userData.nightMaterial)).size,
    ).toBe(1);
    const matrix = new Matrix4();
    const pos = new Vector3();
    const scale = new Vector3();
    const rotation = new Quaternion();
    meshes.forEach((mesh, i) => {
      expect(mesh).toBeInstanceOf(InstancedMesh);
      expect(mesh.frustumCulled).toBe(true);
      expect(mesh.instanceColor?.count).toBe(mesh.count);
      expect(mesh.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
      expect(mesh.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);
      for (const material of [
        mesh.userData.dayMaterial,
        mesh.userData.nightMaterial,
      ]) {
        expect(material.map).toBeNull();
        expect(material.vertexColors).toBe(false);
        expect(material.color.getHex()).toBe(0xffffff);
      }
      const building = SONY_SURROUNDING_BUILDINGS[i];
      for (let instance = 0; instance < mesh.count; instance += 1) {
        mesh.getMatrixAt(instance, matrix);
        expect(matrix.elements.every(Number.isFinite)).toBe(true);
        matrix.decompose(pos, rotation, scale);
        expect(Math.max(scale.x, scale.y, scale.z)).toBeGreaterThan(0);
        expect(scale.z).toBeLessThan(0.7);
        // A thin exterior overlay, never an occupied replacement building.
        const onFace = building.runs.some((run) =>
          run.chain.slice(0, -1).some((p, segment) => {
            const q = run.chain[segment + 1];
            const dx = q[0] - p[0],
              dz = q[1] - p[1];
            const len = Math.hypot(dx, dz);
            const outward = ((pos.x - p[0]) * dz - (pos.z - p[1]) * dx) / len;
            const along = ((pos.x - p[0]) * dx + (pos.z - p[1]) * dz) / len;
            return (
              outward > 0.15 &&
              outward < 1.1 &&
              along >= -0.01 &&
              along <= len + 0.01 &&
              pos.y - scale.y / 2 >= run.groundY - 0.01 &&
              pos.y + scale.y / 2 < run.groundY + run.heightM + 0.01
            );
          }),
        );
        expect(onFace).toBe(true);
      }
    });
    const bounds = new Box3().setFromObject(group);
    expect(bounds.min.x).toBeGreaterThan(-15);
    expect(bounds.max.x).toBeLessThan(338);
    expect(bounds.min.z).toBeGreaterThan(828);
    expect(bounds.max.z).toBeLessThan(1061);
  });

  test("keeps all ten Minecraft readings in one bounded block batch", () => {
    const group = createMinecraftSonyCenterSurroundings();
    expect(group.children).toHaveLength(1);
    expect(group.userData.buildingCount).toBe(10);
    expect(group.userData.blockNative).toBe(true);
    expect(group.userData.instanceCount).toBeLessThanOrEqual(
      SONY_SURROUNDINGS_PROFILE.performance.minecraftInstanceBudget,
    );
    const mesh = group.children[0] as InstancedMesh;
    const matrix = new Matrix4();
    const scale = new Vector3();
    for (let i = 0; i < mesh.count; i += 1) {
      mesh.getMatrixAt(i, matrix);
      scale.setFromMatrixScale(matrix);
      expect(Math.max(scale.x, scale.y, scale.z)).toBeLessThanOrEqual(5.501);
      expect(Math.min(scale.x, scale.y, scale.z)).toBeGreaterThan(0);
    }
  });

  test("fades fine detail without removing source mass and has no smooth voxel double", () => {
    const drawn = createSonyCenterSurroundings();
    for (const name of [
      SONY_SURROUNDINGS_GROUP_NAME,
      MINECRAFT_SONY_SURROUNDINGS_GROUP_NAME,
    ]) {
      expect(FINE_DETAIL_LAYER_NAMES).toContain(name);
    }
    expect(readDetailFadeRangeM(drawn.userData.detailFadeM)).toEqual([
      1350, 1750,
    ]);
    const roots = {
      centralDetails: new Group(),
      civicDetails: new Group(),
      signatures: new Group(),
      cityStaffage: new Group(),
    };
    roots.civicDetails.add(drawn);
    applyMinecraftVisibility(roots, true);
    expect(drawn.visible).toBe(false);
    applyMinecraftVisibility(roots, false);
    expect(drawn.visible).toBe(true);
  });
});
