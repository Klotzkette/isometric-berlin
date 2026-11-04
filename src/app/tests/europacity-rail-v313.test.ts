import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Raycaster, Vector3 } from "three";
import {
  createEuropacityRailV313,
  EUROPACITY_RAIL_V313,
  perlebergerRoadFloorAtV313,
  replaceEuropacityRailPayloadV313,
} from "../src/EuropacityRailV313";
import { createDkbLetteringV313 } from "../src/DkbLetteringV313";
import { createSapEntranceSignV313, SAP_ENTRANCE_V313 } from "../src/SapEntranceSignV313";
import data from "../src/data/europacityRailV313.json";
import type { RailPayload } from "../src/RailNetwork";
import type { VoxelPayload } from "../src/terrainPayload";

const ground = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
const rail = await Bun.file(new URL("../public/mesh/regierungsviertel/rail-lines.json", import.meta.url)).json() as RailPayload;

describe("Europacity junction v313", () => {
  test("the full current payload admits only the identified flattened owners", () => {
    const transformed = replaceEuropacityRailPayloadV313(rail);
    expect(transformed).not.toBeNull();
    expect(transformed!.viaduct).toEqual(rail.viaduct.filter((_, index) => index !== 1));
    expect(rail.viaduct_tracks.length - transformed!.viaduct_tracks.length).toBe(5);
    expect(transformed!.embankment_tracks.length).toBe(rail.embankment_tracks.length);
    expect(transformed!.embankment_tracks.filter(path => !path.length)).toHaveLength(8);
    expect(transformed!.embankment).toBe(rail.embankment);
    expect(rail.piers.length - transformed!.piers.length).toBe(118);
    const changed = structuredClone(rail);
    changed.viaduct_tracks[12][0][0] += 1;
    expect(replaceEuropacityRailPayloadV313(changed)).toBeNull();
  });

  test("the generated geometry has a walkable deck and retains the lower route", () => {
    expect(EUROPACITY_RAIL_V313.bridgeWidthM).toBe(20.4);
    const [x, z] = [-831, -1976];
    for (const native of [false, true]) {
      const model = createEuropacityRailV313(ground, native);
      model.updateMatrixWorld(true);
      const expected = perlebergerRoadFloorAtV313(x, z, native)!;
      expect(expected).toBeGreaterThan(10);
      expect(expected).toBeLessThan(11.5);
      const ray = new Raycaster(new Vector3(x, 13, z), new Vector3(0, -1, 0));
      const hits = ray.intersectObject(model, true);
      expect(hits[0].point.y).toBeCloseTo(expected, 1);
      expect(perlebergerRoadFloorAtV313(x, z, native, 5.2)).toBeNull();
      expect(perlebergerRoadFloorAtV313(x, z, native, expected - 0.25)).toBe(expected);
      expect(perlebergerRoadFloorAtV313(-650, -1900, native)).toBeNull();
      if (native) {
        const mesh = model.children[0] as InstancedMesh;
        const matrix = new Matrix4();
        expect(mesh.count).toBeLessThan(40_000);
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, matrix);
          const elements = matrix.elements;
          if ([1, 2, 4, 6, 8, 9].some(axis => elements[axis] !== 0)) throw new Error("Native rail members must be cardinal");
        }
      }
    }
  });

  test("the source chains preserve the four railway levels at the road", () => {
    const targets = [
      [data.track[0], -764.17, -2024.45, 16.57, 10.05],
      [data.track[2], -798.88, -1999.23, 19.47, 11.06],
      [data.track[4], -838.83, -1970.05, 5.55, 10.95],
    ] as const;
    for (const [track, x, z, railTop, roadTop] of targets) {
      const projected = track.points.slice(1).map((b, i) => {
        const a = track.points[i];
        const dx = b[0] - a[0], dz = b[2] - a[2];
        const f = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz)));
        return [Math.hypot(x - a[0] - f * dx, z - a[2] - f * dz), a[1] + (b[1] - a[1]) * f];
      }).filter(row => Number.isFinite(row[0])).sort((a, b) => a[0] - b[0])[0];
      expect(projected[0]).toBeLessThan(0.015);
      expect(projected[1]).toBeCloseTo(railTop, 1);
      expect(perlebergerRoadFloorAtV313(x, z, false)!).toBeCloseTo(roadTop, 1);
    }
  });

  test("the SAP fascia mounts only at the photographed Haus A entrance", async () => {
    const actualVoxels = await Bun.file(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json", import.meta.url)).json() as VoxelPayload;
    const drawn = createSapEntranceSignV313()!;
    expect(drawn.userData.entranceNode).toBe(10981934232);
    expect(drawn.userData.lettering).toBe("Welcome to SAP Berlin.");
    expect(drawn.children[0].position.y).toBeCloseTo(8.7);
    const [start, end] = SAP_ENTRANCE_V313.facade;
    const dx = end[0] - start[0], dz = end[1] - start[1];
    const placed = drawn.children[0].position;
    expect(((placed.x - start[0]) * dz - (placed.z - start[1]) * dx) / Math.hypot(dx, dz)).toBeCloseTo(0.21);

    const native = createSapEntranceSignV313(actualVoxels)!;
    expect(native.children[0].position.x).toBeCloseTo(-439.79);
    expect(native.children[0].position.z).toBe(-1522);
    expect(native.children[0].rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(createSapEntranceSignV313({ ...actualVoxels, building_rows: [] })).toBeNull();
    const junction = createEuropacityRailV313(actualVoxels, true);
    expect(junction.children.filter(child => child.name === native.name)).toHaveLength(1);
    expect(createEuropacityRailV313(ground).getObjectByName(drawn.name)).toBeUndefined();
  });

  test("both photo-supported DKB wordmarks have physical letters in both modes", () => {
    for (const native of [false, true]) {
      const signs = createDkbLetteringV313(native);
      expect(signs.children).toHaveLength(2);
      for (const child of signs.children) expect((child as InstancedMesh).count).toBeGreaterThan(12);
    }
  });
});
