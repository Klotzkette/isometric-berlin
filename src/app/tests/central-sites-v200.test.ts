import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import data from "../src/data/centralSitesV200.json";
import navigation from "../src/data/centralSitesV200Navigation.json";
import replacements from "../src/data/centralSitesV200Replacement.json";
import { createCentralSitesV200, CENTRAL_SITES_V200_OWNER_OFFSETS } from "../src/CentralSitesV200";
import { centralSitesV200SolidAt, centralSitesV200RoofAt, centralSitesV200NavigationForPrism } from "../src/centralSitesV200Navigation";
import { CENTRAL_SITES_V200_REPLACED_PRISM_IDS, isCentralSitesV200ReplacedColumn } from "../src/centralSitesV200ReplacementProfile";
import { buildingTerrainOffset } from "../src/weinbergTerrainV176";

describe("measured central sites v200", () => {
  test("both modes retain all owner datums and bounded independent static batches", () => {
    for (const native of [false, true]) {
      const root = createCentralSitesV200(native);
      expect(root.children.length).toBe(native ? 1 : 2);
      expect(root.userData.sourceGeometryRetained).toBe(true);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(root.userData.newCourtWalls).toBe(false);
      let bytes = 0;
      for (const child of root.children) {
        const mesh = child as Mesh;
        expect(mesh.matrixAutoUpdate).toBe(false);
        expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
        expect(mesh.userData.dayMaterial.map).toBeNull();
        expect(mesh.userData.nightMaterial.map).toBeNull();
        for (const a of Object.values(mesh.geometry.attributes)) bytes += a.array.byteLength;
        bytes += mesh.geometry.index?.array.byteLength ?? 0;
        if (mesh instanceof InstancedMesh) bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
      }
      expect(bytes).toBeLessThan(native ? 2_000_000 : 1_150_000);
      const mesh = root.children.at(-1) as InstancedMesh;
      const rows = native ? data.blocks : data.boxes;
      expect(mesh.count).toBe(rows.length);
      rows.forEach((r, i) => {
        const oi = r[native ? 8 : 11], owner = data.owners[oi];
        expect(CENTRAL_SITES_V200_OWNER_OFFSETS[oi]).toBe(buildingTerrainOffset(owner.id, owner.anchor[0], owner.anchor[1], owner.groundY));
        expect(mesh.instanceMatrix.array[i * 16 + 13]).toBeCloseTo(r[1] + CENTRAL_SITES_V200_OWNER_OFFSETS[oi], 4);
        if (native) for (const j of [1, 2, 4, 6, 8, 9]) expect(mesh.instanceMatrix.array[i * 16 + j]).toBe(0);
      });
    }
  });
  test("mode roots never share disposable geometries or material owners", () => {
    const meshes = [createCentralSitesV200(), createCentralSitesV200(true), createCentralSitesV200()].flatMap(r => r.children as Mesh[]);
    expect(new Set(meshes.map(m => m.geometry)).size).toBe(meshes.length);
    expect(new Set(meshes.flatMap(m => [m.userData.dayMaterial, m.userData.nightMaterial])).size).toBe(meshes.length * 2);
  });
  test("five placeholders match only their 99 frozen cells and heights", () => {
    expect(CENTRAL_SITES_V200_REPLACED_PRISM_IDS.size).toBe(5);
    expect(CENTRAL_SITES_V200_REPLACED_PRISM_IDS.has("99124892")).toBe(false);
    expect(CENTRAL_SITES_V200_REPLACED_PRISM_IDS.has("43088813")).toBe(false);
    for (const p of replacements.replacements) for (const [x,z,bottom,top] of p.columns) {
      expect(isCentralSitesV200ReplacedColumn(x,z,bottom,top)).toBe(true);
      expect(isCentralSitesV200ReplacedColumn(x,z,bottom,top+4)).toBe(false);
      expect(isCentralSitesV200ReplacedColumn(x+.01,z,bottom,top)).toBe(false);
      expect(isCentralSitesV200ReplacedColumn(x,z,bottom+.1,top)).toBe(false);
    }
    expect(centralSitesV200NavigationForPrism("99124892").length).toBe(2);
    expect(centralSitesV200NavigationForPrism("43088813").length).toBe(3);
    expect(centralSitesV200NavigationForPrism("-5759915").length).toBe(1);
    expect(centralSitesV200NavigationForPrism("unrelated")).toEqual([]);
  });
  test("collision ends at actual roof planes and retains open courts", () => {
    let checked = 0;
    for (const p of navigation.buildings) {
      const lift = buildingTerrainOffset(p.id,p.anchor[0],p.anchor[1],p.groundY);
      for (const t of p.roofTriangles) {
        const x=t.reduce((s,v)=>s+v[0],0)/3, z=t.reduce((s,v)=>s+v[2],0)/3;
        const top=centralSitesV200RoofAt(x,z);
        if (top===null) continue;
        expect(centralSitesV200SolidAt(x,top-.1,z)).toBe(true);
        expect(centralSitesV200SolidAt(x,top+.1,z)).toBe(false);
        expect(centralSitesV200SolidAt(x,p.groundY+lift-.1,z)).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
    for (const [x,z] of [[1546,-700],[1558,-726],[1558,-759],[1496,75],[1518.9904,299.9489]]) {
      expect(centralSitesV200SolidAt(x,7,z)).toBe(false);
      expect(centralSitesV200RoofAt(x,z)).toBeNull();
    }
  });
});

test("actual core obstacle compiler installs source roofs early and preserves Heckmann holes", async () => {
  const { compilePedestrianObstacles, pedestrianPointIsBlocked } = await import("../src/pedestrianNavigation");
  const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json();
  const ids = new Set(["-5759915", "99124892", "43088813", "65316158"]);
  const buildings = payload.buildings.filter((p: {id: string}) => ids.has(p.id));
  for (const mode of ["day", "night", "minecraft"] as const) {
    const index = compilePedestrianObstacles({ buildings }, () => mode);
    const duplicate = compilePedestrianObstacles({ buildings: [...buildings, ...buildings] }, () => mode);
    const unique = [...new Set([...index.cells.values()].flat())];
    const duplicateUnique = [...new Set([...duplicate.cells.values()].flat())];
    const central = unique.filter(p => p.sourceId?.startsWith("DEBE01YYK000") && navigation.buildings.some(b => b.id === p.sourceId));
    const centralDuplicate = duplicateUnique.filter(p => p.sourceId?.startsWith("DEBE01YYK000") && navigation.buildings.some(b => b.id === p.sourceId));
    expect(central.length).toBeGreaterThanOrEqual(6);
    expect(centralDuplicate.length).toBe(central.length);
    expect(unique.some(p => p.sourceId === "-5759915")).toBe(false);
    expect(unique.some(p => p.sourceId === "99124892")).toBe(true);
    expect(unique.some(p => p.sourceId === "43088813")).toBe(true);
    for (const [x,z] of [[1537.1758,-665.418],[1473.4227,-605.346]]) {
      const top = centralSitesV200RoofAt(x,z)!;
      expect(top).toBeGreaterThan(24);
      expect(pedestrianPointIsBlocked(x,z,top-2,index)).toBe(true);
      expect(pedestrianPointIsBlocked(x,z,top+.2,index)).toBe(false);
      const source = central.find(p => p.kind === "polygon" && p.topAt?.(x,z) !== null);
      expect(source?.kind).toBe("polygon");
      if (source?.kind === "polygon") expect(source.topAt?.(x,z)).toBeCloseTo(top,6);
    }
    expect(pedestrianPointIsBlocked(1527.9041,-662.592,5.3,index)).toBe(false);
    expect(pedestrianPointIsBlocked(1546,-700,5.3,index)).toBe(false);
  }
});
