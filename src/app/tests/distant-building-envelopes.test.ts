import { describe, expect, test } from "bun:test";
import { Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import {
  createDistantBuildingShells, createIsometricCity, setIsoNightPresentation,
  ROOF_GABLED, ROOF_HIPPED, ROOF_SHED, ROOF_TENT,
  type PrismBuilding, type PrismPayload,
} from "../src/IsometricCityWorld";
import { deserializeTransferredObject3D, serializeObject3DForTransfer } from "../src/transferableObject3D";
import { resolveHumboldthafenPrism } from "../src/humboldthafenCourtyardProfile";
import { potsdamerPanoramaMaterialFor } from "../src/potsdamerPanoramaPalette";
import { HUMBOLDTHAFEN_BUILDING_IDS } from "../src/HumboldthafenBuildings";

const source = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const fixture = (changes: Partial<PrismBuilding> = {}): PrismBuilding => ({
  id: "envelope-fixture", class: 0, y0_dm: 37, h_dm: 200, roof: 1000,
  ring: [[20000, 20000], [20200, 20000], [20200, 20100], [20000, 20100]], ...changes,
});
function build(building: PrismBuilding): [Group, Mesh] {
  const group = createDistantBuildingShells(source, [building]);
  group.updateMatrixWorld(true);
  return [group, group.children[0] as Mesh];
}
function roofAt(mesh: Mesh, x: number, z: number): number | undefined {
  return new Raycaster(new Vector3(x, 500, z), new Vector3(0, -1, 0)).intersectObject(mesh, false)[0]?.point.y;
}
function bytes(mesh: Mesh): number {
  return Object.values(mesh.geometry.attributes).reduce((total, attribute) => total + attribute.array.byteLength, 0)
    + (mesh.geometry.index?.array.byteLength ?? 0);
}

describe("complete distant building source envelopes", () => {
  test("keeps concave outlines, open courtyards and exact height instead of enclosing boxes", () => {
    const [group, mesh] = build(fixture({
      ring: [[20000, 20000], [20200, 20000], [20200, 20050], [20060, 20050], [20060, 20150], [20000, 20150]],
      holes: [[[20010, 20070], [20040, 20070], [20040, 20110], [20010, 20110]]],
    }));
    expect(group.userData.openCourtyardCount).toBe(1);
    expect(roofAt(mesh, 2010, 2010)).toBeUndefined();
    expect(roofAt(mesh, 2002, 2009)).toBeUndefined();
    expect(roofAt(mesh, 2005, 2009)).toBeCloseTo(23.7, 5);
    expect(roofAt(mesh, 2015, 2002)).toBeCloseTo(23.7, 5);
    expect(mesh.geometry.boundingBox!.min.y).toBeCloseTo(3.7, 5);
    expect(mesh.geometry.boundingBox!.max.y).toBeCloseTo(23.7, 5);
  });

  test("colors roof separately and keeps isometric wall directions before detail arrives", () => {
    const [, mesh] = build(fixture({ id: "AOI6FuOL" }));
    const normals = mesh.geometry.getAttribute("normal"), colors = mesh.geometry.getAttribute("color");
    const directions = new Map<string, Color>();
    for (let i = 0; i < colors.count; i += 1) directions.set(
      [normals.getX(i), normals.getY(i), normals.getZ(i)].join(),
      new Color().setRGB(colors.getX(i), colors.getY(i), colors.getZ(i)));
    expect(directions.size).toBe(5);
    expect(directions.get("0,0,1")!.r).not.toBe(directions.get("0,0,-1")!.r);
    expect(directions.get("1,0,0")!.r).not.toBe(directions.get("-1,0,0")!.r);
    const wall = directions.get("1,0,0")!, roof = directions.get("0,1,0")!;
    expect(wall.r).toBeGreaterThan(wall.b * 2);
    const expectedRoof = new Color(potsdamerPanoramaMaterialFor("AOI6FuOL")!.roof);
    expect(roof.r).toBeCloseTo(expectedRoof.r, 2);
    expect(roof.g).toBeCloseTo(expectedRoof.g, 2);
    expect(roof.b).toBeCloseTo(expectedRoof.b, 2);
    expect((mesh.material as MeshBasicMaterial).vertexColors).toBeTrue();
    expect(normals.array).toBeInstanceOf(Int8Array);
  });

  for (const roof of [ROOF_GABLED, ROOF_HIPPED, ROOF_SHED, ROOF_TENT]) {
    test(`roof code ${roof} preserves the detailed pass ridge and eave silhouette`, () => {
      const building = fixture({ roof });
      const [group, mesh] = build(building);
      expect(group.userData.pitchedRoofCount).toBe(1);
      expect(mesh.geometry.boundingBox!.max.y).toBeCloseTo(23.7, 5);
      const full = createIsometricCity(source, null, null, null, { buildings: [building], includeContext: false });
      const body = full.getObjectByName("LoD2 prism buildings") as Mesh;
      full.updateMatrixWorld(true);
      for (const [x, z] of [[2002, 2002], [2010, 2005], [2018, 2008]]) {
        // Legacy source-code roofs contain mixed winding. Ray both sides here
        // to compare the geometric roof planes, not that old rasterisation flaw.
        (body.material as MeshBasicMaterial).side = 2;
        expect(roofAt(mesh, x, z)).toBeCloseTo(roofAt(body, x, z)!, 4);
      }
    });
  }

  test("does not cover a mapped courtyard with a fitted pitched rectangle", () => {
    const [group, mesh] = build(fixture({ roof: ROOF_GABLED,
      holes: [[[20080, 20030], [20120, 20030], [20120, 20070], [20080, 20070]]],
    }));
    expect(group.userData.pitchedRoofCount).toBe(0);
    expect(roofAt(mesh, 2010, 2005)).toBeUndefined();
  });

  test("real harbour courts and source footprint corners survive the initial envelope", () => {
    const courtyards = source.buildings.filter(b => HUMBOLDTHAFEN_BUILDING_IDS.has(b.id))
      .map(resolveHumboldthafenPrism).filter(b => b.holes?.length);
    expect(courtyards.length).toBeGreaterThan(0);
    for (const courtyard of courtyards) {
      const [group, mesh] = build(courtyard);
      expect(group.userData.openCourtyardCount).toBe(courtyard.holes!.length);
      const positions = mesh.geometry.getAttribute("position");
      for (const [x, z] of courtyard.ring) {
        let represented = false;
        for (let i = 0; i < positions.count; i += 1) {
          if (Math.abs(positions.getX(i) - x / 10) < .001 && Math.abs(positions.getZ(i) - z / 10) < .001) { represented = true; break; }
        }
        expect(represented).toBeTrue();
      }
    }
  });

  test("mode switches and worker transfer preserve nonwhite colored vertices", () => {
    const [group, mesh] = build(fixture({ id: "AOI6FuOL" }));
    const before = Array.from(mesh.geometry.getAttribute("color").array);
    for (const mode of ["night", "snowstorm", "schwellenraum", "day"] as const) {
      setIsoNightPresentation(group, mode === "night", true, mode);
      expect((mesh.material as MeshBasicMaterial).vertexColors).toBeTrue();
      expect(Array.from(mesh.geometry.getAttribute("color").array)).toEqual(before);
    }
    expect(mesh.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);
    const packed = serializeObject3DForTransfer(group);
    const restored = deserializeTransferredObject3D(structuredClone(packed.object, { transfer: packed.transfers })) as Group;
    const restoredMesh = restored.children[0] as Mesh;
    expect(Array.from(restoredMesh.geometry.getAttribute("color").array)).toEqual(before);
    expect(restoredMesh.geometry.getAttribute("color").normalized).toBeTrue();
    expect(restoredMesh.geometry.getAttribute("normal").normalized).toBeTrue();
    expect((restoredMesh.material as MeshBasicMaterial).vertexColors).toBeTrue();
  });

  test("complete committed city stays in a bounded compact envelope budget", () => {
    let retained = 0, vertices = 0, triangles = 0, visible = 0, courtyards = 0;
    for (let start = 0; start < source.buildings.length; start += 240) {
      const group = createDistantBuildingShells(source, source.buildings.slice(start, start + 240));
      expect(group.children.length).toBeLessThanOrEqual(1);
      visible += group.userData.visibleBuildingCount; courtyards += group.userData.openCourtyardCount;
      if (!group.children.length) continue;
      const mesh = group.children[0] as Mesh;
      retained += bytes(mesh); vertices += mesh.geometry.getAttribute("position").count;
      triangles += mesh.geometry.index!.count / 3;
      mesh.geometry.dispose();
    }
    expect(visible).toBeGreaterThan(28_000);
    expect(courtyards).toBeGreaterThan(600);
    expect(retained).toBeLessThan(30 * 1024 * 1024);
    expect(vertices).toBeLessThan(1_300_000);
    expect(triangles).toBeLessThan(800_000);
  });
});
