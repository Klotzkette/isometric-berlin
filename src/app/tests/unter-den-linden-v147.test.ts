import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import source from "../src/unterDenLindenSource.json";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import { UNTER_DEN_LINDEN_DETAILS_PROFILE } from "../src/unterDenLindenProfiles";
import { createUnterDenLindenEntrances, createMinecraftUnterDenLindenEntrances } from "../src/UnterDenLindenEntrances";
import { UNTER_DEN_LINDEN_ENTRANCE_OPENINGS, UNTER_DEN_LINDEN_ENTRANCE_REGIONS,
  UNTER_DEN_LINDEN_ENTRANCE_RUNS, UNTER_DEN_LINDEN_ENTRANCE_SOURCE,
  pointInUnterDenLindenEntranceRegion, unterDenLindenEntranceFloorAt } from "../src/unterDenLindenEntrancesProfile";
import { createKomischeOperSourceGeometry, createMinecraftKomischeOperSourceGeometry,
  KOMISCHE_OPER_SOURCE_PART, komischeOperRoofTopAt, isKomischeOperReplacementCell } from "../src/KomischeOperSourceGeometry";
import { staticGeometryAudit } from "./helpers/staticGeometryAudit";

describe("v147 exact Linden geometry correction", () => {
  test("keeps all 21 original LoD2 parts and moves decoration onto source front edges", () => {
    expect(source.profiles.map(p => [p.key, p.parts.length])).toEqual([
      ["russianEmbassy", 16], ["aeroflot", 1], ["einstein", 3], ["komischeOper", 1],
    ]);
    const b = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings;
    for (const [key, axes] of [
      ["russianEmbassy", b.russianEmbassy.frontageAxes],
      ["aeroflot", [b.aeroflot.streetFacade]],
      ["einstein", [b.einstein.streetFacade, b.einstein.westFacade]],
    ] as const) {
      const points = source.profiles.find(p => p.key === key)!.parts.flatMap(p => p.ring);
      for (const axis of axes) for (const point of [axis.startWorldXZ, axis.endWorldXZ])
        expect(Math.min(...points.map(p => Math.hypot(p[0] - point[0], p[1] - point[1])))).toBeLessThan(.002);
    }
    expect(b.russianEmbassy.streetFacade.startWorldXZ[1]).toBeLessThan(330);
    expect(b.russianEmbassy.previousRearAxis.startWorldXZ[1]).toBeGreaterThan(400);
    expect(b.aeroflot.streetFacade.startWorldXZ[1]).toBeLessThan(290);
    expect(prisms.buildings.some(p => p.id === "K00001Ih")).toBeTrue();
    for (const part of source.profiles.flatMap(p => p.parts)) expect(prisms.buildings.some(p => p.id === part.id.slice(-8))).toBeTrue();
  });
  test("retains every Komische sheet and its lower front / higher rear source roof", () => {
    const root = createKomischeOperSourceGeometry();
    expect(KOMISCHE_OPER_SOURCE_PART.surfaces).toHaveLength(51);
    expect(root.userData.verticalTranslationM).toBeCloseTo(2.961, 6);
    const box = new Box3().setFromObject(root);
    expect(box.min.y).toBeCloseTo(5.2, 5);
    expect(box.max.y).toBeCloseTo(28.007, 5);
    expect(komischeOperRoofTopAt(1050, 385)).toBeLessThan(22);
    expect(komischeOperRoofTopAt(1040, 340)).toBeGreaterThan(22);
    expect(isKomischeOperReplacementCell(1050, 350, 4)).toBeTrue();
    expect(isKomischeOperReplacementCell(1100, 350, 4)).toBeFalse();
    const budget = staticGeometryAudit(root).budget;
    expect(budget.draws).toBe(2);
    const native = createMinecraftKomischeOperSourceGeometry();
    expect(native.children).toHaveLength(1);
    expect((native.children[0] as InstancedMesh).count).toBe(6252);
    expect(native.userData.hiddenSolidInfill).toBeFalse();
  });
});

describe("five mapped U-Bahn mouths and two distinct lifts", () => {
  test("retains OSM anchors, measured step tags and source orientation conflicts", () => {
    expect(UNTER_DEN_LINDEN_ENTRANCE_SOURCE.stairs.map(s => s.ref)).toEqual(["A", "B", "C", "D", "E"]);
    expect(UNTER_DEN_LINDEN_ENTRANCE_SOURCE.stairs.map(s => s.stepCount)).toEqual([30, 24, 33, 30, 30]);
    expect(UNTER_DEN_LINDEN_ENTRANCE_SOURCE.stairs[0].top).toEqual([1155.038, 238.981]);
    expect(UNTER_DEN_LINDEN_ENTRANCE_SOURCE.stairs[4].top).toEqual([1176.775, 353.903]);
    expect(UNTER_DEN_LINDEN_ENTRANCE_SOURCE.lifts).toHaveLength(2);
    expect(UNTER_DEN_LINDEN_ENTRANCE_OPENINGS).toHaveLength(8);
    expect(UNTER_DEN_LINDEN_ENTRANCE_SOURCE.displayStatus).toContain("conflicting incline");
  });
  test("cuts open descending stairs without capping them with local replacement paving", () => {
    const root = createUnterDenLindenEntrances(); root.updateMatrixWorld(true);
    const paving = root.children.find(c => c instanceof Mesh && !(c instanceof InstancedMesh))!;
    for (const run of UNTER_DEN_LINDEN_ENTRANCE_RUNS) {
      const x = run.top[0] + run.ux * run.length * .55, z = run.top[1] + run.uz * run.length * .55;
      const ray = new Raycaster(new Vector3(x, 20, z), new Vector3(0, -1, 0));
      expect(ray.intersectObject(paving)).toHaveLength(0);
      const hit = ray.intersectObject(root, true)[0];
      expect(hit).toBeDefined();
      expect(hit.point.y).toBeLessThan(3.2);
      expect(unterDenLindenEntranceFloorAt(x, z)).toBeCloseTo(hit.point.y, 1);
      expect(pointInUnterDenLindenEntranceRegion(x, z)).toBeTrue();
      expect(unterDenLindenEntranceFloorAt(run.top[0], run.top[1])).toBeCloseTo(5.52, 5);
    }
    const b = new Box3().setFromObject(root); expect(b.min.y).toBeLessThan(1);
  });
  test("bounds every replacement to disjoint cell-aligned regions and finite batches", () => {
    for (const region of UNTER_DEN_LINDEN_ENTRANCE_REGIONS) {
      for (const value of [region.minX, region.maxX, region.minZ, region.maxZ]) expect(value % 4).toBe(0);
      for (const other of UNTER_DEN_LINDEN_ENTRANCE_REGIONS) {
        if (region === other) continue;
        const overlap = Math.min(region.maxX, other.maxX) - Math.max(region.minX, other.minX);
        const overlapZ = Math.min(region.maxZ, other.maxZ) - Math.max(region.minZ, other.minZ);
        expect(overlap > 0 && overlapZ > 0).toBeFalse();
      }
    }
    const drawn = createUnterDenLindenEntrances(), native = createMinecraftUnterDenLindenEntrances();
    expect(drawn.children).toHaveLength(2); expect(native.children).toHaveLength(1);
    expect((native.children[0] as InstancedMesh).count).toBe(2857);
    const matrix = new Matrix4();
    for (const root of [drawn, native]) root.traverse(o => {
      expect(o.matrixAutoUpdate).toBeFalse();
      if (!(o instanceof InstancedMesh)) return;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, matrix); expect(matrix.elements.every(Number.isFinite)).toBeTrue(); }
    });
    expect(staticGeometryAudit(createUnterDenLindenEntrances())).toEqual(staticGeometryAudit(drawn));
  });
});
