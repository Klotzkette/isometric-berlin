import { describe, expect, test } from "bun:test";
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createEuropacityArchitecture, europacityArchitectureWalls, europacityPrismContains, type EuropacityBlock } from "../src/EuropacityArchitecture";
import { EUROPACITY_ARCHITECTURE_SOURCE as S, EUROPACITY_ARCHITECTURE_IDS } from "../src/europacityArchitectureProfile";
import { createIsometricCity, type PrismPayload } from "../src/IsometricCityWorld";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxelJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";
const source = prismJson as unknown as PrismPayload, voxels = voxelJson;
const nearby = source.buildings.map(p => ({ p, x0: Math.min(...p.ring.map(a => a[0])) / 10, x1: Math.max(...p.ring.map(a => a[0])) / 10, z0: Math.min(...p.ring.map(a => a[1])) / 10, z1: Math.max(...p.ring.map(a => a[1])) / 10 })).filter(q => q.x1 >= -725 && q.x0 <= -50 && q.z1 >= -1960 && q.z0 <= -880);
function detail(minecraft = false, mobileLike = false): Group { return createEuropacityArchitecture({ sourcePrisms: source.buildings, voxels: minecraft ? voxels : undefined, minecraft, mobileLike, diagnostics: true }); }
function sourceCells(): InstancedMesh {
  const columns: number[][] = [];
  voxels.building_rows.forEach((row, zi) => {
    const z = (voxels.grid.min_z_idx + zi + .5) * voxels.cell_m;
    if (z < -1965 || z > -875) return;
    for (const [x, n, lo, hi] of row) for (let i = 0; i < n; i++) { const cx = (voxels.grid.min_x_idx + x + i + .5) * voxels.cell_m; if (cx >= -730 && cx <= -45 && hi > lo) columns.push([cx, z, lo / 10, hi / 10]); }
  });
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), columns.length), matrix = new Matrix4();
  columns.forEach(([x, z, lo, hi], i) => mesh.setMatrixAt(i, matrix.makeScale(voxels.cell_m, hi - lo, voxels.cell_m).setPosition(x, (lo + hi) / 2, z)));
  mesh.computeBoundingSphere(); return mesh;
}
describe("Heidestraße and Otto-Weidt-Platz architecture", () => {
  test("retains every selected source body and courtyard with outward facade normals", () => {
    expect(S.prisms).toHaveLength(140); expect(EUROPACITY_ARCHITECTURE_IDS.size).toBe(140); expect(S.profiles).toHaveLength(21);
    for (const p of S.prisms) expect(p).toEqual(source.buildings.find(q => q.id === p.id));
    for (const w of europacityArchitectureWalls()) {
      expect(Math.hypot(w.nx, w.nz)).toBeCloseTo(1, 8);
      const x = w.a[0] + w.dx * w.length / 2, z = w.a[1] + w.dz * w.length / 2;
      expect(europacityPrismContains(w.part, x + w.nx * .02, z + w.nz * .02)).toBeFalse();
    }
    const einz = S.profiles.find(p => p.style === "einz-podium")!;
    expect(einz.ids).toContain("buS0Za6I"); expect(einz.ids).not.toContain("JUgwVTiy");
    expect(S.osmBindings.some(b => b.id === 7433644 && b.prismIds.includes("3E9uXA7Z"))).toBeTrue();
  });
  test("each family has exposed details below the retained roof eaves", () => {
    const plan = detail().userData.blocks as EuropacityBlock[], panes = plan.filter(b => b.glass);
    for (const profile of S.profiles) expect(panes.some(b => profile.ids.includes(b.sourceId)), profile.name).toBeTrue();
    for (const p of plan) { expect(p.position[1] + p.size[1] / 2).toBeLessThanOrEqual((S.facadeTops as Record<string, number>)[p.sourceId] + .04); expect(p.size[2]).toBeLessThanOrEqual(.82); }
    for (const b of panes) {
      const [x, y, z] = b.position;
      expect(nearby.find(q => q.p.id !== b.sourceId && x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1 && y >= q.p.y0_dm / 10 && y < (q.p.y0_dm + q.p.h_dm) / 10 && europacityPrismContains(q.p, x, z))?.p.id, b.sourceId).toBeUndefined();
    }
    for (const role of ["graded concrete and anodised frame", "rhythmic limestone pilaster", "triangular loggia return", "dark green ceramic spandrel", "folded concrete reveal"]) expect(plan.some(b => b.role === role), role).toBeTrue();
  });
  for (const minecraft of [false, true]) test(`${minecraft ? "Minecraft" : "smooth"} representative glass is visible outside actual source shells`, () => {
    const d = detail(minecraft), root = new Group();
    root.add(minecraft ? sourceCells() : createIsometricCity({ ...source, buildings: nearby.map(q => q.p) }, null, null, null, { includeContext: false }));
    root.add(d); root.updateMatrixWorld(true);
    const meshes: Mesh[] = []; root.traverse(o => { if (o instanceof Mesh) meshes.push(o); });
    const panes = (d.userData.blocks as EuropacityBlock[]).filter(b => b.glass);
    for (const profile of S.profiles) for (const fraction of [.29, .73]) {
      const candidates = panes.filter(b => profile.ids.includes(b.sourceId)); expect(candidates.length, profile.name).toBeGreaterThan(0);
      const b = candidates[Math.floor(candidates.length * fraction)], normal = new Vector3(b.normal[0], 0, b.normal[1]); let visible = false;
      for (const [fx, fy] of [[.28, .2], [-.28, .31], [.3, .05], [-.3, -.22]]) {
        const target = new Vector3(...b.position).add(new Vector3(Math.cos(b.yaw), 0, -Math.sin(b.yaw)).multiplyScalar(b.size[0] * fx)); target.y += b.size[1] * fy;
        const hits = new Raycaster(target.addScaledVector(normal, .32), normal.clone().negate(), 0, .48).intersectObjects(meshes, false);
        if (hits[0]?.object.name === "Europacity framed glazing") { visible = true; break; }
      }
      expect(visible, `${profile.name} ${b.sourceId} ${b.position.join(",")}`).toBeTrue();
    }
  });
  test("full/mobile retain the complete corridor within instanced memory budgets", () => {
    for (const minecraft of [false, true]) for (const mobileLike of [false, true]) {
      const root = detail(minecraft, mobileLike), arrays = new Set<ArrayBufferView>(); let count = 0;
      expect(root.children).toHaveLength(2);
      for (const object of root.children) {
        const m = object as InstancedMesh; count += m.count; expect(m.geometry.getAttribute("uv")).toBeUndefined();
        for (const a of Object.values(m.geometry.attributes)) arrays.add(a.array);
        if (m.geometry.index) arrays.add(m.geometry.index.array);
        arrays.add(m.instanceMatrix.array); arrays.add(m.instanceColor!.array); expect(Array.from(m.instanceMatrix.array).every(Number.isFinite)).toBeTrue();
      }
      expect(count).toBe(minecraft ? mobileLike ? 31751 : 43181 : mobileLike ? 47072 : 82545);
      expect([...arrays].reduce((sum, a) => sum + a.byteLength, 0)).toBeLessThan(minecraft ? mobileLike ? 2_415_000 : 3_290_000 : mobileLike ? 3_580_000 : 6_280_000);
    }
  });
});
