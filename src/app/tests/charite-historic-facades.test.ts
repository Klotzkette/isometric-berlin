import { describe, expect, test } from "bun:test";
import { BoxGeometry, InstancedMesh, Mesh, MeshBasicMaterial, Raycaster, ShapeUtils, Vector2, Vector3 } from "three";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import {
  createChariteHistoricFacades, createMinecraftChariteHistoricFacades,
  chariteHistoricFacadeExposure, chariteHistoricFacadeTop,
} from "../src/ChariteHistoricFacades";
import {
  CHARITE_HISTORIC_FACADE_IDS, CHARITE_HISTORIC_FACADE_PROFILES, CHARITE_THEATRE_REPLACEMENT_IDS,
} from "../src/chariteHistoricFacadeProfiles";
import { HISTORIC_CHARITE_IDS, chariteRingWalls } from "../src/HistoricChariteCampus";
import { fitRectangle, roofRise, ROOF_MIN_RECTANGULARITY } from "../src/IsometricCityWorld";
import { createChariteHistoricFacadeColumnTester, MINECRAFT_CHARITE_HISTORIC_SHELL_IDS } from "../src/MinecraftChariteHistoricShells";
import { decodeVoxelBuildingColumns, type VoxelPayload } from "../src/MinecraftVoxelWorld";

function stats(root: ReturnType<typeof createChariteHistoricFacades>) {
  let bytes = 0, calls = 0, instances = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    calls++;
    for (const attribute of Object.values(object.geometry.attributes)) bytes += attribute.array.byteLength;
    bytes += object.geometry.index?.array.byteLength ?? 0;
    if (object instanceof InstancedMesh) {
      instances += object.count;
      bytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
      expect(object.geometry.getAttribute("position").count).toBe(24);
    }
    expect(object.geometry.getAttribute("uv")).toBeUndefined();
  });
  return { bytes, calls, instances };
}
describe("individual historic Charite campus facade coverage", () => {
  test("retains 146 west parts and adds35 east parts across seventeen named families without duplicating old refinements", () => {
    expect(CHARITE_HISTORIC_FACADE_IDS.size).toBe(181);
    expect(CHARITE_HISTORIC_FACADE_PROFILES.length).toBe(17);
    const existing = new Set(prisms.buildings.map(b => b.id));
    for (const id of CHARITE_HISTORIC_FACADE_IDS) {
      expect(existing.has(id)).toBe(true); expect(HISTORIC_CHARITE_IDS.has(id)).toBe(false);
    }
    for (const p of CHARITE_HISTORIC_FACADE_PROFILES) {
      expect(p.address.length).toBeGreaterThan(5); expect(/^(09011080,T,|090550)/.test(p.monumentId)).toBe(true);
      expect(p.parts.every(part => p.lod2Parents.includes(part.parent))).toBe(true);
    }
    expect(CHARITE_HISTORIC_FACADE_PROFILES.find(p => p.key === "kitchen")!.lod2Parents).toEqual(["DEBE01YYK00007YT"]);
    expect(CHARITE_HISTORIC_FACADE_PROFILES.find(p => p.key === "workshops")!.lod2Parents).toEqual(["DEBE01YYK00004Nb", "DEBE01YYK00008nj"]);
  });
  test("retains every previously delivered western facade record byte-for-byte", () => {
    const westIds=new Set(CHARITE_HISTORIC_FACADE_PROFILES.slice(0,11).flatMap(p=>p.parts.map(part=>part.id)));
    const addedRoles=new Set(["masonry-pier","brick-bond-course","eaves-dentil"]);
    const root=createChariteHistoricFacades(prisms,"full",true);
    const records=root.userData.facadeRecords.filter((r:{sourceId:string;role:string})=>westIds.has(r.sourceId)&&!addedRoles.has(r.role));
    expect(westIds.size).toBe(146);expect(records.length).toBe(39067);
    const serialized=JSON.stringify(records.map((r:unknown)=>JSON.stringify(r)).sort());
    expect(new Bun.CryptoHasher("sha256").update(serialized).digest("hex")).toBe("0264798a4ff48a176aa4c6126844e919e1cc3d5b499d518445b19339c55043f5");
    expect(root.userData.sourceRecordsRetained).toBe(true);
    expect(new Set(root.userData.sourceEnvelopeExceptions)).toEqual(CHARITE_THEATRE_REPLACEMENT_IDS);
  });
  test("keeps source bytes unchanged and cornices at the established drawn roof fit", () => {
    const parts = prisms.buildings.filter(b => CHARITE_HISTORIC_FACADE_IDS.has(b.id));
    const before = JSON.stringify(parts);
    createChariteHistoricFacades({ buildings: parts }); createMinecraftChariteHistoricFacades({ buildings: parts });
    expect(JSON.stringify(parts)).toBe(before);
    for (const p of parts) {
      const rect = fitRectangle(p.ring.map(([x, z]) => [x / 10, z / 10]));
      const rise = rect && rect.rectangularity >= ROOF_MIN_RECTANGULARITY && [2100, 3100, 3200, 3500].includes(p.roof ?? 0) ? roofRise(rect, p.h_dm / 10) : 0;
      expect(chariteHistoricFacadeTop(p)).toBeCloseTo((p.y0_dm + p.h_dm) / 10 - rise, 6);
    }
  });
  test("adjacent source parts suppress full opening extents in both ring orientations", () => {
    for (const reversed of [false, true]) {
      const ring = [[0, 0], [100, 0], [100, 100], [0, 100]];
      const part = { id: "subject", ring: reversed ? ring.reverse() : ring, y0_dm: 0, h_dm: 100 };
      const wall = chariteRingWalls(part.ring)[0];
      const cx = wall.x1 + wall.dirX * 5 + wall.nx * .38, cz = wall.z1 + wall.dirZ * 5 + wall.nz * .38;
      const blocker = { id: "modern-neighbour", ring: [[cx - 1, cz - 1], [cx + 1, cz - 1], [cx + 1, cz + 1], [cx - 1, cz + 1]].map(([x, z]) => [x * 10, z * 10]), y0_dm: 0, h_dm: 100 };
      expect(chariteHistoricFacadeExposure([part])(part, wall, 5, 4, 1.6, 2.6)).toBe(true);
      expect(chariteHistoricFacadeExposure([part, blocker])(part, wall, 5, 4, 1.6, 2.6)).toBe(false);
    }
  });
  test("courts stay empty and missing-source fallback creates no invented details", () => {
    const part = { id: [...CHARITE_HISTORIC_FACADE_IDS][0], ring: [[0, 0], [300, 0], [300, 300], [0, 300]], holes: [[[60, 60], [240, 60], [240, 240], [60, 240]]], y0_dm: 0, h_dm: 150 };
    for (const constructor of [createChariteHistoricFacades, createMinecraftChariteHistoricFacades]) {
      const root = constructor({ buildings: [part] }); root.updateMatrixWorld(true);
      expect(new Raycaster(new Vector3(15, 30, 15), new Vector3(0, -1, 0)).intersectObject(root, true).length).toBe(0);
      expect(constructor({ buildings: [] }).children.length).toBe(0);
    }
  });
  test("drawn touch and pointer geometry is identical, while complete native skins stay bounded", () => {
    const full = createChariteHistoricFacades(prisms), mobile = createChariteHistoricFacades(prisms, "mobile");
    expect(stats(full)).toEqual(stats(mobile));
    expect((full.children[0] as InstancedMesh).instanceMatrix.array).toEqual((mobile.children[0] as InstancedMesh).instanceMatrix.array);
    expect(full.userData.detailCounts).toEqual({ sourcePrisms: 181, windows: 3090, portals: 18, loggias: 72, families: 17 });
    expect(stats(full).calls).toBe(4); expect(stats(full).bytes).toBeLessThan(5_500_000);
    const native = createMinecraftChariteHistoricFacades(prisms);
    expect(stats(native).calls).toBe(6); expect(stats(native).bytes).toBeLessThan(8_600_000);
    expect(native.userData.detailCounts.sourcePrisms).toBe(187);
    expect(full.userData.facadeRecords).toBeUndefined(); expect(native.userData.facadeRecords).toBeUndefined();
  });
  test("native roofs retain the complete source footprint area and 185 clinic source identities plus the separately modeled theatre", () => {
    const root = createMinecraftChariteHistoricFacades(prisms);
    const shell = root.getObjectByName("Charite source-bound native wall and roof skins")!;
    const clinicIds = new Set([...MINECRAFT_CHARITE_HISTORIC_SHELL_IDS].filter(id => !CHARITE_THEATRE_REPLACEMENT_IDS.has(id)));
    expect(new Set(shell.userData.sourcePrismIds)).toEqual(clinicIds);
    expect(root.getObjectByName("Block-native Tieranatomisches Theater")!.userData.sourceIds).toEqual([...CHARITE_THEATRE_REPLACEMENT_IDS]);
    // Match the source extrusion's triangulator: two delivered decimetre
    // rings self-intersect, so their signed shoelace area is not rendered area.
    const area = (part: typeof prisms.buildings[number]) => {
      const ring = part.ring.map(([x, z]) => new Vector2(x / 10, z / 10));
      const holes = (part.holes ?? []).map(h => h.map(([x, z]) => new Vector2(x / 10, z / 10)));
      const faces = ShapeUtils.triangulateShape(ring, holes), p = [...ring, ...holes.flat()];
      return faces.reduce((sum, [a, b, c]) => sum + Math.abs((p[b].x - p[a].x) * (p[c].y - p[a].y) -
        (p[b].y - p[a].y) * (p[c].x - p[a].x)) / 2, 0);
    };
    const expected = prisms.buildings.filter(p => clinicIds.has(p.id))
      .reduce((sum, p) => sum + area(p), 0);
    const roof = root.getObjectByName("Charite clipped native stepped roofs") as Mesh;
    const p = roof.geometry.getAttribute("position"), index = roof.geometry.index!;
    let projected = 0;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      if (p.getY(a) !== p.getY(b) || p.getY(a) !== p.getY(c)) continue;
      projected += Math.abs((p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a)) -
        (p.getZ(b) - p.getZ(a)) * (p.getX(c) - p.getX(a))) / 2;
    }
    expect(projected).toBeCloseTo(expected, 1);
    expect(shell.userData.roofFootprintArea).toBeCloseTo(expected, 6);
    expect(createChariteHistoricFacadeColumnTester([])(420, -530)).toBe(false);
  });
  test("actual former voxel columns no longer swallow the native source-plane windows", async () => {
    const voxel = await Bun.file(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json", import.meta.url)).json() as VoxelPayload;
    const replaces = createChariteHistoricFacadeColumnTester(prisms.buildings);
    const columns = decodeVoxelBuildingColumns(voxel).filter(([x, z]) => replaces((x + .5) * voxel.cell_m, (z + .5) * voxel.cell_m));
    const root = createMinecraftChariteHistoricFacades(prisms, "full", true); root.updateMatrixWorld(true);
    const records = root.userData.facadeRecords as Array<{ sourceId: string; role: string; position: [number, number, number] }>;
    const windows = records.filter(r => r.role === "window-glass");
    const swallowed = windows.filter(r => columns.some(([x, z, a, b]) => r.position[0] > x * voxel.cell_m + .06 &&
      r.position[0] < (x + 1) * voxel.cell_m - .06 && r.position[2] > z * voxel.cell_m + .06 &&
      r.position[2] < (z + 1) * voxel.cell_m - .06 && r.position[1] > a / 10 && r.position[1] < b / 10));
    expect(swallowed.length).toBeGreaterThan(1000);
    const target = swallowed.find(r => r.sourceId === "7BbVl2qU")!;
    const part = prisms.buildings.find(p => p.id === target.sourceId)!;
    const wall = chariteRingWalls(part.ring).sort((a, b) => {
      const distance = (w: typeof a) => Math.abs((target.position[0] - w.x1) * w.nx + (target.position[2] - w.z1) * w.nz);
      return distance(a) - distance(b);
    })[0];
    const col = columns.find(([x, z, a, b]) => target.position[0] > x * voxel.cell_m + .06 && target.position[0] < (x + 1) * voxel.cell_m - .06 &&
      target.position[2] > z * voxel.cell_m + .06 && target.position[2] < (z + 1) * voxel.cell_m - .06 && target.position[1] > a / 10 && target.position[1] < b / 10)!;
    const before = new Mesh(new BoxGeometry(voxel.cell_m - .12, (col[3] - col[2]) / 10, voxel.cell_m - .12), new MeshBasicMaterial());
    before.position.set((col[0] + .5) * voxel.cell_m, (col[2] + col[3]) / 20, (col[1] + .5) * voxel.cell_m); before.updateMatrixWorld(true);
    const normal = new Vector3(wall.nx, 0, wall.nz);
    const ray = new Raycaster(new Vector3(...target.position).addScaledVector(normal, 6), normal.clone().negate());
    const former = ray.intersectObject(before)[0], current = ray.intersectObject(root, true)[0];
    expect(former.distance).toBeLessThan(5.96);
    expect(current.distance).toBeCloseTo(5.96, 3);
    expect(records[current.instanceId!].role).toBe("window-glass");
    expect(replaces((col[0] + .5) * voxel.cell_m, (col[1] + .5) * voxel.cell_m)).toBe(true);
  });
  test("every diagnostic instance stays shallow and within its source height", () => {
    const root = createChariteHistoricFacades(prisms, "full", true);
    const byId = new Map(prisms.buildings.map(b => [b.id, b]));
    for (const r of root.userData.facadeRecords as Array<{ sourceId: string; position: number[]; size: number[] }>) {
      const p = byId.get(r.sourceId)!;
      expect(r.size[2]).toBeLessThanOrEqual(.28);
      expect(r.position.every(Number.isFinite)).toBe(true);
      expect(r.position[1] + r.size[1] / 2).toBeLessThanOrEqual(chariteHistoricFacadeTop(p) + .001);
      let nearest = Infinity;
      for (const wall of chariteRingWalls(p.ring)) {
        const dx = r.position[0] - wall.x1, dz = r.position[2] - wall.z1;
        const u = Math.max(0, Math.min(wall.length, dx * wall.dirX + dz * wall.dirZ));
        nearest = Math.min(nearest, Math.hypot(dx - u * wall.dirX, dz - u * wall.dirZ));
      }
      // Current selected source parts have no courtyard-hole openings; the
      // synthetic hole contract above checks that path independently.
      expect(nearest).toBeLessThanOrEqual(.52);
    }
  });
});
