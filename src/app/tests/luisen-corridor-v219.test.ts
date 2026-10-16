import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { BoxGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createLuisenCorridorArchitecture, luisenCorridorWalls, luisenPrismContains, planLuisenCorridor, type LuisenBlock } from "../src/LuisenCorridorArchitecture";
import { LUISEN_CORRIDOR_SOURCE as S, LUISEN_STREET_REFINEMENTS_V218, LUISEN_STREET_REFINEMENTS_V219 } from "../src/luisenCorridorProfile";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxelJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const context = { sourcePrisms: prismJson.buildings, voxels: voxelJson };
const edge = LUISEN_STREET_REFINEMENTS_V219[0];
const wall = luisenCorridorWalls().find(w => w.part.id === edge.sourceId && w.a[0] === edge.a[0] && w.a[1] === edge.a[1])!;
const selected = (b: LuisenBlock) => b.sourceId === edge.sourceId && Math.abs(b.normal[0] - wall.nx) < 1e-8 && Math.abs(b.normal[1] - wall.nz) < 1e-8;

describe("v219 Mori-Ogai photographed corner correction", () => {
  test("only the one exposed corner edge changes; every other block retains its v218 bytes", () => {
    expect(LUISEN_STREET_REFINEMENTS_V219).toHaveLength(1);
    expect(wall.street).toBeTrue();
    expect(wall.length).toBeCloseTo(2.3086792761230543, 10);
    expect(LUISEN_STREET_REFINEMENTS_V218.some(e => e.sourceId === (edge.sourceId as string))).toBeFalse();
    const before = JSON.stringify(S);
    for (const minecraft of [false, true]) {
      const plan = planLuisenCorridor({ ...context, minecraft });
      const untouched = plan.filter(b => !selected(b));
      // Independently captured before v219; includes every v218 street fitting,
      // courtyard, adjoining owner, ground window and source-occlusion result.
      expect(createHash("sha256").update(JSON.stringify(untouched)).digest("hex")).toBe(minecraft
        ? "8bb35803b96ac410c6faec56595e762357a6f37d65afc27fe07c339cc50f2e7a"
        : "bed3b84cfd3231ce21b70a2bdaf3ca3e666e8dbff4f184e05912711069fa1c97");
      expect(planLuisenCorridor({ ...context, minecraft, mobileLike: true })).toEqual(plan);
      const corner = plan.filter(selected), bands = corner.filter(b => b.role === "Mori39 brick corner band");
      expect(bands).toHaveLength(minecraft ? 16 : 32);
      expect(new Set(bands.map(b => b.color)).size).toBe(2);
      expect(corner.filter(b => b.glass)).toHaveLength(1);
      expect(corner.find(b => b.glass)!.role).toBe("street shop glazing");
      expect(corner.filter(b => b.role === "Mori39 plain corner belt")).toHaveLength(3);
      expect(corner.filter(b => b.role === "eaves dentil")).toHaveLength(0);
      expect(plan.filter(b => b.role.startsWith("Mori39")).every(selected)).toBeTrue();
      for (const b of bands) {
        expect(b.position[1] - b.size[1] / 2).toBeGreaterThan(15);
        expect(b.position[1] + b.size[1] / 2).toBeLessThanOrEqual(S.facadeTops.K6XkZ7CC);
        expect(prismJson.buildings.some(p => p.id !== b.sourceId && b.position[1] >= p.y0_dm / 10
          && b.position[1] < (p.y0_dm + p.h_dm) / 10 && luisenPrismContains(p, b.position[0], b.position[2]))).toBeFalse();
      }
    }
    expect(JSON.stringify(S)).toBe(before);
  });

  test("native brick fields remain in front of the actual delivered source cells", () => {
    const columns: number[][] = [], v = voxelJson;
    v.building_rows.forEach((row, zi) => {
      const z = v.grid.min_z_idx + zi;
      if (z * v.cell_m < -320 || z * v.cell_m > -300) return;
      for (const [x, n, lo, hi] of row) for (let i = 0; i < n; i++) {
        const cx = (v.grid.min_x_idx + x + i + .5) * v.cell_m;
        if (cx > 570 && cx < 590) columns.push([cx, (z + .5) * v.cell_m, lo / 10, hi / 10]);
      }
    });
    const cells = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), columns.length), matrix = new Matrix4();
    columns.forEach(([x, z, lo, hi], i) => { matrix.makeScale(v.cell_m, hi - lo, v.cell_m).setPosition(x, (lo + hi) / 2, z); cells.setMatrixAt(i, matrix); });
    cells.computeBoundingSphere(); cells.updateMatrixWorld(true);
    const root = createLuisenCorridorArchitecture({ ...context, minecraft: true, diagnostics: true });
    root.updateMatrixWorld(true);
    const bands = (root.userData.blocks as LuisenBlock[]).filter(b => b.role === "Mori39 brick corner band");
    for (const b of bands) {
      const normal = new Vector3(...[b.normal[0], 0, b.normal[1]] as [number, number, number]);
      const ray = new Raycaster(new Vector3(...b.position).addScaledVector(normal, .35), normal.negate(), 0, .55);
      expect(ray.intersectObjects([...root.children as Mesh[], cells], false)[0]?.object).toBe(root.children[0]);
    }
  });

  test("two shared-cube batches remain within the existing storage ceilings", () => {
    for (const minecraft of [false, true]) {
      const root = createLuisenCorridorArchitecture({ ...context, minecraft });
      const arrays = new Set<ArrayBufferView>(); let instances = 0;
      expect(root.children).toHaveLength(2);
      for (const mesh of root.children as InstancedMesh[]) {
        instances += mesh.count;
        for (const a of Object.values(mesh.geometry.attributes)) arrays.add(a.array);
        arrays.add(mesh.geometry.index!.array); arrays.add(mesh.instanceMatrix.array); arrays.add(mesh.instanceColor!.array);
        expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
        expect(mesh.geometry).toBe((root.children[0] as InstancedMesh).geometry);
      }
      const bytes = [...arrays].reduce((sum, a) => sum + a.byteLength, 0);
      expect(instances).toBe(minecraft ? 11_293 : 24_020);
      expect(bytes).toBe(minecraft ? 858_916 : 1_826_168);
      expect(bytes).toBeLessThan(minecraft ? 860_000 : 1_840_000);
    }
  });
});
