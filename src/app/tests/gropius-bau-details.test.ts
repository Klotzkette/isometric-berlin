import { describe, expect, test } from "bun:test";
import {
  Box3, BufferGeometry, InstancedMesh, LineSegments, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Raycaster, Vector3,
} from "three";
import {
  createGropiusBauDetails, createMinecraftGropiusBauDetails,
  GROPIUS_BAU_DETAIL_BUDGETS, gropiusBauDetailPlan,
} from "../src/GropiusBauDetails";
import {
  GROPIUS_BAU_FACADES, GROPIUS_BAU_PRISM_IDS,
  GROPIUS_BAU_PROFILE, GROPIUS_BAU_SOURCE_RING_DM,
} from "../src/gropiusBauProfile";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";

const prismPayload = await Bun.file(new URL(
  "../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url,
)).json() as { buildings: { id: string; ring: number[][]; holes: number[][][];
  y0_dm: number; h_dm: number; roof: number }[] };
const voxelPayload = await Bun.file(new URL(
  "../public/mesh/regierungsviertel/minecraft-voxels.json", import.meta.url,
)).json() as VoxelPayload;
const source = prismPayload.buildings.find(({ id }) => id === GROPIUS_BAU_PROFILE.mainSourceId)!;

function geometryBytes(geometry: BufferGeometry): number {
  return Object.values(geometry.attributes).reduce(
    (sum, attribute) => sum + attribute.array.byteLength, 0,
  ) + (geometry.index?.array.byteLength ?? 0);
}

describe("Gropius Bau source-bound facade refinement", () => {
  test("pins the actual delivered outline, four source parts and authoritative 7/8-axis order", () => {
    expect(source.ring).toEqual(GROPIUS_BAU_SOURCE_RING_DM);
    expect(source.holes).toHaveLength(2);
    expect(source.y0_dm / 10).toBe(GROPIUS_BAU_PROFILE.groundYM);
    expect(source.h_dm / 10).toBe(GROPIUS_BAU_PROFILE.deliveredHeightM);
    expect(source.roof).toBe(5000);
    for (const id of GROPIUS_BAU_PRISM_IDS) {
      expect(prismPayload.buildings.filter((part) => part.id === id)).toHaveLength(1);
    }
    expect(GROPIUS_BAU_FACADES.map(({ bays }) => bays)).toEqual([7, 8, 7, 8]);
    for (const facade of GROPIUS_BAU_FACADES) {
      for (const point of [facade.start, facade.end]) {
        expect(source.ring.some(([x, z]) => x / 10 === point[0] && z / 10 === point[1])).toBeTrue();
      }
    }
  });

  test("keeps every three-part main window, mezzanine bay and pediment in full/mobile and both styles", () => {
    for (const profile of ["full", "mobile"] as const) {
      for (const minecraft of [false, true]) {
        const plan = gropiusBauDetailPlan(profile, minecraft);
        expect(plan.counts["three-part main windows"]).toBe(180);
        expect(plan.counts["mezzanine triplets"]).toBe(90);
        expect(plan.counts["gold mosaic frames"]).toBe(34);
        expect(plan.counts["north portal piers"]).toBe(2);
        expect(plan.counts[minecraft ? "stepped triangular pediments" : "flat triangular pediments"])
          .toBe(minecraft ? 90 : 60);
        expect(plan.parts.every((part) => part.size.every((size) => size > 0))).toBeTrue();
        expect(plan.parts.every((part) => part.size[2] <= 1.5)).toBeTrue();
      }
    }
    expect(gropiusBauDetailPlan("mobile")).toEqual(gropiusBauDetailPlan("full"));
  });

  test("never adds a filled roof, envelope or geometry through the source courts/central atrium", () => {
    for (const creator of [createGropiusBauDetails, createMinecraftGropiusBauDetails]) {
      const root = creator("full");
      expect(root.userData.facadeOnly).toBeTrue();
      // Interior points of both exact source holes plus the roofed central atrium.
      for (const [x, z] of [[660, 1353], [700, 1353], [682, 1373]]) {
        const ray = new Raycaster(new Vector3(x, 60, z), new Vector3(0, -1, 0));
        expect(ray.intersectObject(root, true)).toHaveLength(0);
      }
      const bounds = new Box3().setFromObject(root);
      expect(bounds.min.y).toBeCloseTo(4.8, 4);
      expect(bounds.max.y).toBeLessThanOrEqual(creator === createGropiusBauDetails ? 34.1 : 36.8);
    }
  });

  test("Minecraft windows and their frames clear the actual source column volumes, including the south stair return", () => {
    const cell = voxelPayload.cell_m;
    const columns: Array<[number, number, number, number]> = [];
    voxelPayload.building_rows!.forEach((row, zOffset) => {
      const z = zOffset + voxelPayload.grid.min_z_idx;
      if (z * cell <= 1324 || z * cell >= 1412) return;
      for (const [xOffset, run, y0, y1] of row) {
        if (y1 <= 250) continue;
        for (let step = 0; step < run; step += 1) {
          const x = xOffset + step + voxelPayload.grid.min_x_idx;
          if (x * cell > 637 && x * cell < 724) columns.push([x, z, y0, y1]);
        }
      }
    });
    expect(columns.length).toBeGreaterThan(250);
    for (const profile of ["full", "mobile"] as const) {
      const intersections: string[] = [];
      for (const part of gropiusBauDetailPlan(profile, true).parts) {
        if (!/window|pediment|mezzanine/.test(part.cue)) continue;
        const [x, y, z] = part.position;
        const hw = part.size[0] / 2;
        const hh = part.size[1] / 2;
        const hd = part.size[2] / 2;
        const c = Math.cos(part.yaw);
        const s = Math.sin(part.yaw);
        const cellProjection = cell / 2 * (Math.abs(c) + Math.abs(s));
        const hit = columns.some(([ix, iz, y0, y1]) => {
          if (y + hh <= y0 / 10 || y - hh >= y1 / 10) return false;
          const dx = (ix + 0.5) * cell - x;
          const dz = (iz + 0.5) * cell - z;
          // Four SAT axes: both world cell axes and both facade-box axes.
          return Math.abs(dx) < cell / 2 + Math.abs(c) * hw + Math.abs(s) * hd &&
            Math.abs(dz) < cell / 2 + Math.abs(s) * hw + Math.abs(c) * hd &&
            Math.abs(dx * c - dz * s) < hw + cellProjection &&
            Math.abs(dx * s + dz * c) < hd + cellProjection;
        });
        if (hit) intersections.push(`${part.cue}: ${part.position.join(",")}`);
      }
      expect(intersections).toEqual([]);
    }
  });

  test("retains reversible day/night materials, civic mode markers and explicit full/mobile budgets", () => {
    for (const profile of ["full", "mobile"] as const) {
      const budget = GROPIUS_BAU_DETAIL_BUDGETS[profile];
      for (const minecraft of [false, true]) {
        const root = (minecraft ? createMinecraftGropiusBauDetails : createGropiusBauDetails)(profile);
        let bytes = 0;
        let calls = 0;
        root.traverse((object) => {
          if (!(object instanceof Mesh || object instanceof LineSegments)) return;
          calls += 1;
          bytes += geometryBytes(object.geometry);
          expect(object.geometry.getAttribute("uv")).toBeUndefined();
          if (object instanceof Mesh) {
            expect(object.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
            expect(object.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);
            expect(object.userData.civicBuildingDetail).toBeTrue();
            expect(object.material).toBe(object.userData.dayMaterial);
            expect(object.userData.dayMaterial.map).toBeNull();
            object.material = object.userData.nightMaterial;
            object.material = object.userData.dayMaterial;
          }
          if (object instanceof InstancedMesh) {
            bytes += object.instanceMatrix.array.byteLength + object.instanceColor!.array.byteLength;
            expect(object.geometry.getAttribute("position").count).toBe(24);
          }
        });
        expect(calls).toBe(minecraft ? 1 : 2);
        expect(root.userData.primitiveCount).toBeLessThanOrEqual(
          minecraft ? budget.minecraftBlocks : budget.drawnParts,
        );
        expect(bytes).toBeLessThanOrEqual(minecraft ? 110_000 : budget.drawnBytes);
      }
    }
  });

  test("mirrors the licensed, non-bundled visual-reference credit", async () => {
    const geo = await Bun.file(new URL("../../../geo_data/regierungsviertel/wikimedia_references.json", import.meta.url)).json();
    const published = await Bun.file(new URL("../public/dzi/regierungsviertel/wikimedia_attribution.json", import.meta.url)).json();
    const record = geo.records.find((item: { landmark_id: string }) => item.landmark_id === "gropius_bau");
    expect(record.photo_bundled).toBeFalse();
    expect(record.artist).toBe("Manfred Brückels");
    expect(record.license).toBe("CC BY-SA 3.0");
    expect(published.records.find((item: { landmark_id: string }) => item.landmark_id === "gropius_bau")).toEqual(record);
  });
});
