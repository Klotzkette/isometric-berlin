import { describe, expect, test } from "bun:test";
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createLuisenCorridorArchitecture, luisenCorridorWalls, luisenPrismContains, type LuisenBlock } from "../src/LuisenCorridorArchitecture";
import { LUISEN_CORRIDOR_SOURCE as S, LUISEN_CORRIDOR_IDS, LUISEN_CORRIDOR_GROUP } from "../src/luisenCorridorProfile";
import { createIsometricCity, fitRectangle, roofRise, ROOF_MIN_RECTANGULARITY, ROOF_GABLED, ROOF_HIPPED, ROOF_TENT, ROOF_SHED, buildRoofGeometry, type PrismPayload } from "../src/IsometricCityWorld";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxelJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const source = prismJson as unknown as PrismPayload, voxels = voxelJson;
const nearby = source.buildings.map(p => ({ p, x0: Math.min(...p.ring.map(a => a[0])) / 10, x1: Math.max(...p.ring.map(a => a[0])) / 10,
  z0: Math.min(...p.ring.map(a => a[1])) / 10, z1: Math.max(...p.ring.map(a => a[1])) / 10 }))
  .filter(q => q.x1 > 475 && q.x0 < 1130 && q.z1 > -685 && q.z0 < -45);
function detail(minecraft = false, mobileLike = false): Group {
  return createLuisenCorridorArchitecture({ sourcePrisms: source.buildings, voxels: voxels as never, minecraft, mobileLike, diagnostics: true });
}
function sourceCells(): InstancedMesh {
  const columns: number[][] = [];
  voxels.building_rows.forEach((row, zi) => {
    const z = voxels.grid.min_z_idx + zi;
    if (z * voxels.cell_m < -690 || z * voxels.cell_m > -40) return;
    for (const [x, n, lo, hi] of row) for (let i = 0; i < n; i++) {
      const cx = (voxels.grid.min_x_idx + x + i + .5) * voxels.cell_m;
      if (cx > 470 && cx < 1135) columns.push([cx, (z + .5) * voxels.cell_m, lo / 10, hi / 10]);
    }
  });
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), columns.length), matrix = new Matrix4();
  columns.forEach(([x, z, lo, hi], i) => { matrix.makeScale(voxels.cell_m, hi - lo, voxels.cell_m).setPosition(x, (lo + hi) / 2, z); mesh.setMatrixAt(i, matrix); });
  mesh.name = "all actual coarse corridor source cells"; mesh.computeBoundingSphere(); return mesh;
}

describe("Luisenstraße and Reinhardtstraße source-bound facade refinement", () => {
  test("all 120 parts remain exact and all wall normals point outside their source body", () => {
    expect(S.prisms).toHaveLength(120); expect(LUISEN_CORRIDOR_IDS.size).toBe(120); expect(S.profiles).toHaveLength(25); expect(S.roads).toHaveLength(65);
    for (const part of S.prisms) {
      expect(part).toEqual(source.buildings.find(p => p.id === part.id));
      const top = (part.y0_dm + part.h_dm) / 10;
      let eaves = top;
      const rect = fitRectangle(part.ring.map(([x, z]) => [x / 10, z / 10]));
      if (rect && rect.rectangularity >= ROOF_MIN_RECTANGULARITY && [ROOF_GABLED, ROOF_HIPPED, ROOF_TENT, ROOF_SHED].includes(part.roof)) {
        const rise = roofRise(rect, part.h_dm / 10);
        if (rise > 0 && buildRoofGeometry(rect, top - rise, top, part.roof)) eaves -= rise;
      }
      expect((S.facadeTops as Record<string, number>)[part.id]).toBeLessThanOrEqual(eaves + .001);
    }
    const walls = luisenCorridorWalls(); expect(walls).toHaveLength(584);
    for (const w of walls) {
      expect(Math.hypot(w.nx, w.nz)).toBeCloseTo(1, 8);
      expect(w.dx * w.nx + w.dz * w.nz).toBeCloseTo(0, 8);
      const x = w.a[0] + w.dx * w.length / 2, z = w.a[1] + w.dz * w.length / 2;
      expect(luisenPrismContains(w.part, x + w.nx * .03, z + w.nz * .03)).toBeFalse();
    }
  });

  test("complete neighbouring source context removes hidden partywall panes without changing source geometry", () => {
    const before = JSON.stringify(S.prisms), root = detail(), plan = root.userData.blocks as LuisenBlock[];
    const panes = plan.filter(b => b.glass); expect(panes).toHaveLength(3151);
    for (const b of panes) {
      const [x, y, z] = b.position;
      const occluder = nearby.find(q => q.p.id !== b.sourceId && x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1 && y >= q.p.y0_dm / 10 && y < (q.p.y0_dm + q.p.h_dm) / 10 && luisenPrismContains(q.p, x, z));
      expect(occluder?.p.id, b.sourceId).toBeUndefined();
      expect(y + b.size[1] / 2).toBeLessThanOrEqual((S.facadeTops as Record<string, number>)[b.sourceId] + .06);
    }
    for (const profile of S.profiles) expect(panes.some(b => profile.ids.includes(b.sourceId)), profile.name).toBeTrue();
    expect(plan.some(b => b.role === "silver external sun louvre")).toBeTrue();
    expect(plan.some(b => b.role === "Patentamt arch stone")).toBeTrue();
    expect(plan.some(b => b.role === "bowed balcony front")).toBeTrue();
    expect(JSON.stringify(S.prisms)).toBe(before);
  });

  test("Minecraft glass and reveals keep their designed relative planes after a shared source-cell displacement", () => {
    const root = detail(true), blocks = root.userData.blocks as LuisenBlock[];
    let pairs = 0;
    for (let i = 1; i < blocks.length; i++) {
      const pane = blocks[i], reveal = blocks[i - 1];
      if (!pane.glass || reveal.role !== "window reveal" || reveal.sourceId !== pane.sourceId || reveal.position[1] !== pane.position[1]) continue;
      const delta = new Vector3(...pane.position).sub(new Vector3(...reveal.position));
      expect(delta.dot(new Vector3(pane.normal[0], 0, pane.normal[1]))).toBeCloseTo(.095, 6);
      expect(delta.dot(new Vector3(Math.cos(pane.yaw), 0, -Math.sin(pane.yaw)))).toBeCloseTo(0, 6);
      pairs++;
    }
    expect(pairs).toBeGreaterThan(2000);
  });

  for (const minecraft of [false, true]) test(`${minecraft ? "Minecraft" : "drawn"} panes are visible through actual geometry rays for every facade profile`, () => {
    const d = detail(minecraft), root = new Group();
    if (minecraft) root.add(sourceCells());
    else {
      const body = createIsometricCity({ ...source, buildings: nearby.map(q => q.p) }, null, null, null, { includeContext: false });
      body.getObjectByName(LUISEN_CORRIDOR_GROUP)?.removeFromParent(); root.add(body);
    }
    root.add(d); root.updateMatrixWorld(true);
    const meshes: Mesh[] = []; root.traverse(o => { if (o instanceof Mesh) meshes.push(o); });
    const panes = (d.userData.blocks as LuisenBlock[]).filter(b => b.glass), selected = new Set<LuisenBlock>();
    for (const profile of S.profiles) {
      const candidates = panes.filter(b => profile.ids.includes(b.sourceId));
      expect(candidates.length, profile.name).toBeGreaterThan(0);
      for (const fraction of [0, .24, .49, .74, .99]) selected.add(candidates[Math.floor(fraction * candidates.length)]);
    }
    // Known oblique four-metre-cell failures from the independent initial audit.
    for (const id of ["BICGBgOW", "nTDFvP2Z", "pg7QUvEX", "P4H4H93H", "flQPX5nK", "DYyUGdzA", "W1bhRdH2", "QFYHSdf4", "Tg8zhPCn"]) {
      const candidates = panes.filter(b => b.sourceId === id);
      if (candidates.length) selected.add(candidates[Math.floor(candidates.length / 2)]);
    }
    expect(selected.size).toBeGreaterThan(100); expect(selected.size).toBeLessThan(160);
    for (const b of selected) {
      const normal = new Vector3(b.normal[0], 0, b.normal[1]);
      let visible = false;
      // Avoid intentional mullions, sun louvres, balconies and upper transoms.
      for (const [fx, fy] of [[.28, -.19], [-.28, .31], [.3, .05], [-.3, -.32]]) {
        const target = new Vector3(...b.position).add(new Vector3(Math.cos(b.yaw), 0, -Math.sin(b.yaw)).multiplyScalar(b.size[0] * fx));
        target.y += b.size[1] * fy;
        const hits = new Raycaster(target.addScaledVector(normal, .35), normal.clone().negate(), 0, .55).intersectObjects(meshes, false);
        if (hits[0]?.object.name === d.children[1].name) { visible = true; break; }
      }
      expect(visible, `${b.sourceId} ${b.role} ${b.position.join(",")}`).toBeTrue();
    }
  });

  test("full and mobile stay finite and texture-free within measured buffer budgets", () => {
    for (const minecraft of [false, true]) for (const mobileLike of [false, true]) {
      const root = detail(minecraft, mobileLike), arrays = new Set<ArrayBufferView>(); let count = 0;
      expect(root.children).toHaveLength(2);
      for (const object of root.children) {
        const mesh = object as InstancedMesh; count += mesh.count;
        expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
        expect((mesh.material as MeshBasicMaterial).vertexColors).toBeFalse();
        for (const a of Object.values(mesh.geometry.attributes)) arrays.add(a.array);
        if (mesh.geometry.index) arrays.add(mesh.geometry.index.array);
        arrays.add(mesh.instanceMatrix.array); arrays.add(mesh.instanceColor!.array);
        expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBeTrue();
        expect(Array.from(mesh.instanceColor!.array).every(Number.isFinite)).toBeTrue();
      }
      const bytes = [...arrays].reduce((sum, a) => sum + a.byteLength, 0);
      expect(count).toBe(minecraft ? 11_251 : mobileLike ? 20_614 : 24_038);
      expect(bytes).toBe(minecraft ? 855_724 : mobileLike ? 1_567_312 : 1_827_536);
      expect(bytes).toBeLessThan(minecraft ? 860_000 : mobileLike ? 1_580_000 : 1_840_000);
      expect(root.userData).toMatchObject({ textureFree: true, runtimeAssets: [], sourcePartCount: 120 });
    }
  });
});
