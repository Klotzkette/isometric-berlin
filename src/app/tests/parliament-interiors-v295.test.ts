import { preloadAltMitteNativeV169Source } from "../src/AltMitteNativeCoreV169";
import { createMinecraftVoxelWorld, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import {MINECRAFT_PALETTE} from "../src/visual-modes/minecraft/palette";
import { describe, expect, test } from "bun:test";
import { BoxGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, LineSegments, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createArchitecturalSignature } from "../src/ArchitecturalLandmarks";
import { createAbgeordnetenhausDetails, createMinecraftAbgeordnetenhausDetails, ABGEORDNETENHAUS_DETAIL_BUDGETS as AB } from "../src/AbgeordnetenhausDetails";
import { createMinecraftArchitecturalLandmarks, isMinecraftArchitecturalReplacementColumn, minecraftArchitecturalVoxelTopAt } from "../src/MinecraftArchitecturalLandmarks";
import { createIsometricCityCore, createDistantBuildingShells, type PrismPayload } from "../src/IsometricCityWorld";
import { createParliamentInteriorsV295, parliamentInteriorMembersV295, parliamentWalkableInteriorV295, parliamentGroundAtV295, parliamentSolidAtV295, parliamentDomePortalAirV295, PARLIAMENT_INTERIORS_BUDGET_V295 as B } from "../src/ParliamentInteriorsV295";
import { parliamentSourceOwnersAdmittedV295, parliamentRetainedOpeningsV295 } from "../src/ParliamentRetainedEnvelopeV295";
import { PARLIAMENT_FLIGHTS_V295 as FLIGHTS, PARLIAMENT_INTERIORS_V295 as P, parliamentWorldPointV295 as W, parliamentNativeAirBoxesV295 } from "../src/parliamentInteriorsV295Profile";
import { PARLIAMENT_NATIVE_COLUMN_RECEIPTS_V295 as receipts, parliamentNativeColumnAdmittedV295, parliamentNativeColumnComplementV295 } from "../src/ParliamentNativeColumnsV295";
import { compilePedestrianObstacles, pedestrianPointIsBlocked, createPedestrianEnvironment, createPedestrianState, stepPedestrian, PEDESTRIAN_WALK_SPEED_MPS, type PedestrianState, type PedestrianEnvironment } from "../src/pedestrianNavigation";
import { ABGEORDNETENHAUS_PROFILE as A, abgeordnetenhausMainContains } from "../src/abgeordnetenhausProfile";
import { minecraftHeroSolidAt } from "../src/MinecraftHeroNavigation";
import { reichstagRampPoints } from "../src/ReichstagDome";
import { createSchwellenraumInteriors, schwellenraumInteriorSolidAt } from "../src/SchwellenraumInteriors";
const source = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const scene = await Bun.file(new URL("../public/mesh/regierungsviertel/scene.json", import.meta.url)).json();
const voxels = await Bun.file(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json", import.meta.url)).json();
const relevant = source.buildings.filter(b => (P.reichstag.sourceIds as readonly string[]).includes(b.id)), payload = { ...source, buildings: relevant };
function ray(root: Group, from: readonly number[], to: readonly number[]) { root.updateMatrixWorld(true); const a = new Vector3(from[0], from[1], from[2]), b = new Vector3(to[0], to[1], to[2]), r = new Raycaster(a, b.clone().sub(a).normalize(), .02, a.distanceTo(b) - .02); return r.intersectObjects(root.children, true).filter(h => h.object instanceof Mesh); }
function drawnAssembly(open = true, distant = false) {
  const root = new Group();
  root.add(distant ? createDistantBuildingShells(payload, relevant, { parliamentInteriorsV295: open }) : createIsometricCityCore(payload, null, null, null, { includeContext: false, parliamentInteriorsV295: open }));
  for (const s of scene.architectural_signatures.filter((s: {
    id: string;
  }) => s.id === "reichstag-model" || s.id === "reichstag-dome")) {
    const g = createArchitecturalSignature(s, { parliamentInteriorsV295: open });
    if (g)
      root.add(g);
  }
  root.add(createAbgeordnetenhausDetails("full", { parliamentInteriorsV295: open }));
  if (open)
    root.add(createParliamentInteriorsV295());
  return root;
}
function nativeSource() {
  const root = new Group(), material = new MeshBasicMaterial({ side: DoubleSide });
  const append = (b: {
    min: readonly number[];
    max: readonly number[];
  }) => {
    const size = b.min.map((n, i) => b.max[i] - n), p = b.min.map((n, i) => (n + b.max[i]) / 2), m = new Mesh(new BoxGeometry(...size as [
      number,
      number,
      number
    ]), material);
    m.position.set(...p as [
      number,
      number,
      number
    ]);
    m.name = "Actual source voxel course";
    root.add(m);
  };
  for (let zi = 0; zi < voxels.building_rows.length; zi++) {
    const zz = voxels.grid.min_z_idx + zi;
    if (zz < -2 || zz > 21)
      continue;
    for (const [start, n, y0, y1, cl] of voxels.building_rows[zi])
      for (let j = 0; j < n; j++) {
        const xx = voxels.grid.min_x_idx + start + j;
        if (xx < 62 || xx > 87)
          continue;
        const x = (xx + .5) * 4, z = (zz + .5) * 4;
        if (isMinecraftArchitecturalReplacementColumn(x, z))
          continue;
        const top = minecraftArchitecturalVoxelTopAt(x, z, y1 / 10), h = Math.max(4, top - y0 / 10), cap = h > 5 ? 1 : 0, base = h > 8 ? 1 : 0, body = h - cap - base, count = Math.max(1, Math.ceil(body / 4));
        const add = (lo: number, hi: number) => {
          const b = { min: [x - 2, lo, z - 2] as const, max: [x + 2, hi, z + 2] as const };
          for (const p of parliamentNativeColumnComplementV295(b, xx, zz, y0, y1, cl, true))
            append(p);
        };
        if (base)
          add(y0 / 10, y0 / 10 + base);
        for (let k = 0; k < count; k++) {
          const mid = y0 / 10 + base + (k + .5) * body / count, hh = count > 1 ? Math.max(.08, body / count - .08) : body / count;
          add(mid - hh / 2, mid + hh / 2);
        }
        if (cap)
          add(y0 / 10 + h - cap, y0 / 10 + h);
      }
  }
  return root;
}
function nativeAssembly() { const g = new Group(); g.add(nativeSource(), createMinecraftArchitecturalLandmarks({ hbfRetailV292: true, parliamentInteriorsV295: true }), createMinecraftAbgeordnetenhausDetails("full", { parliamentInteriorsV295: true }), createParliamentInteriorsV295({ native: true })); return g; }
await preloadAltMitteNativeV169Source();
const obstacles = compilePedestrianObstacles(source);
function walk(site: "reichstag" | "abgeordnetenhaus", points: number[][], mode: string) {
  for (const p of points) {
    const w = W(site, p), blocked = pedestrianPointIsBlocked(w[0], w[2], p[1], obstacles, { walkableInteriorAt: parliamentWalkableInteriorV295, interiorSolidAt: (x, y, z) => parliamentSolidAtV295(mode, x, y, z, 0), visualMode: () => mode as "day" });
    expect(blocked, `${mode} ${site} capsule ${p}`).toBe(false);
  }
}
function navigate(state: PedestrianState, target: readonly number[], environment: PedestrianEnvironment): PedestrianState {
  for (let i = 0; i < 150; i++) {
    const dx = target[0] - state.x, dz = target[2] - state.z, d = Math.hypot(dx, dz);
    if (d < .015)
      return state;
    state = stepPedestrian({ ...state, yaw: Math.atan2(dx, -dz) }, { forward: .75, strafe: 0, turn: 0, look: 0, sprint: false }, Math.min(.035, d / (PEDESTRIAN_WALK_SPEED_MPS * .75)), environment).state;
  }
  throw new Error(`Walk blocked at ${[state.x, state.groundY, state.z]} toward ${target}`);
}
function realEnvironment(mode: string) { const e = createPedestrianEnvironment(voxels, { water: [] }, null, source); e.walkableInteriorAt = parliamentWalkableInteriorV295; e.interiorGroundAt = (x, z, h) => parliamentGroundAtV295(mode, x, z, h); e.interiorSolidAt = (x, y, z) => parliamentSolidAtV295(mode, x, y, z, 0) || (mode === "minecraft" && !parliamentDomePortalAirV295(x, y, z) && minecraftHeroSolidAt(x, y, z, 0)); return e; }
describe("Source-admitted parliament rooms v295", () => {
  test("rejects changed/foreign owners, retains closed defaults and other six legacy native models bytewise", () => {
    expect(parliamentSourceOwnersAdmittedV295(source.buildings)).toBe(true);
    const changed = structuredClone(source.buildings);
    changed.find(b => b.id === relevant[0].id)!.h_dm++;
    expect(parliamentSourceOwnersAdmittedV295(changed)).toBe(false);
    for (const b of relevant) {
      expect(parliamentRetainedOpeningsV295(b)).toHaveLength(0);
      expect(parliamentRetainedOpeningsV295(b, true).length).toBeGreaterThan(0);
      expect(parliamentRetainedOpeningsV295({ ...b, h_dm: b.h_dm + 1 }, true)).toHaveLength(0);
    }
    const a = createMinecraftArchitecturalLandmarks({ hbfRetailV292: true }), b = createMinecraftArchitecturalLandmarks({ hbfRetailV292: true, parliamentInteriorsV295: true });
    expect(b.children.reduce((s, m) => s + (m as InstancedMesh).count, 0)).toBeLessThanOrEqual(5500);
    for (let i = 1; i < 7; i++) {
      const x = a.children[i] as InstancedMesh, y = b.children[i] as InstancedMesh;
      expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);
      expect(x.instanceColor!.array).toEqual(y.instanceColor!.array);
    }
    expect(createSchwellenraumInteriors().getObjectByName("Schwellenraum Reichstag interior")).toBeDefined();
    expect(createSchwellenraumInteriors({ parliamentInteriorsV295: true }).getObjectByName("Schwellenraum Reichstag interior")).toBeUndefined();
  });
  test("has one bounded texture-free batch per family and independent cardinal native geometry", () => {
    for (const native of [false, true]) {
      const g = createParliamentInteriorsV295({ native }), m = g.children[0] as InstancedMesh;
      expect(g.children).toHaveLength(1);
      expect(m.count).toBeLessThanOrEqual(native ? B.nativeInstances : B.drawnInstances);
      expect(m.geometry.getAttribute("uv")).toBeUndefined();
      expect(g.userData.fullStaticDetailOnTouch).toBe(true);
      expect(g.userData.counts["panorama viewing lectern"]).toBeGreaterThanOrEqual(8);
      const matrix = new Matrix4();
      for (let i = 0; i < m.count; i++) {
        m.getMatrixAt(i, matrix);
        expect(matrix.elements.every(Number.isFinite)).toBe(true);
        if (native)
          for (const j of [1, 2, 4, 6, 8, 9])
            expect(matrix.elements[j]).toBe(0);
      }
    }
    expect(parliamentInteriorMembersV295().filter(m=>m.role==="slender chamber column")).toHaveLength(12);
    for(const member of parliamentInteriorMembersV295(true))expect((MINECRAFT_PALETTE as readonly number[]).includes(member.color)).toBe(true);
    expect(parliamentInteriorMembersV295().filter(m => m.role === "reichstag seat cushion").length).toBeGreaterThanOrEqual(630);
    expect(parliamentNativeAirBoxesV295("reichstag").length).toBeLessThan(40);
  });
  test("native cell proof rejects unknown and altered tuples and preserves default/outside columns", () => {
    expect(receipts).toHaveLength(356);
    for (const t of receipts) {
      expect(parliamentNativeColumnAdmittedV295(...t)).toBe(true);
      expect(parliamentNativeColumnAdmittedV295(t[0], t[1], t[2], t[3] + 1, t[4])).toBe(false);
    }
    const b = { min: [250, 5, 30] as const, max: [254, 33, 34] as const };
    expect(parliamentNativeColumnComplementV295(b, 1, 2, 3, 4, 5, true)).toEqual([b]);
    expect(parliamentNativeColumnComplementV295(b, ...receipts[0])).toEqual([b]);
  });
  test("actual source+authored facade assembly clears west portal in detailed and distant shells", () => {
    for (const distant of [false, true]) {
      const a = W("reichstag", [-59, 9.2, 0]), b = W("reichstag", [-22, 9.2, 0]);
      expect(ray(drawnAssembly(false, distant), a, b).length).toBeGreaterThan(0);
      expect(ray(drawnAssembly(true, distant), a, b).map(h => [h.object.name, h.distance])).toEqual([]);
    }
  });
  test("actual source-column+legacy native assembly clears both public entrance routes", () => {
    const g = nativeAssembly();
    for (const [site, a, b] of [["reichstag", [-59, 9.2, 0], [-22, 9.2, 0]], ["abgeordnetenhaus", [0, 7.6, 4], [0, 7.6, -15]]] as const)
      expect(ray(g, W(site, a), W(site, b)).map(h => [h.object.name, h.distance])).toEqual([]);
  });
  test("every represented stair has real rendered support and pedestrian body clearance in both families", () => {
    for (const mode of ["day", "minecraft"]) {
      const root = mode === "day" ? drawnAssembly() : nativeAssembly();
      for (const f of FLIGHTS) {
        const points: number[][] = [];
        for (let i = 1; i < f.steps; i++) {
          const t = (i + .45) / f.steps, u = f.from[0] + (f.to[0] - f.from[0]) * t, v = f.from[2] + (f.to[2] - f.from[2]) * t, y = f.from[1] + (i + 1) / f.steps * (f.to[1] - f.from[1]), w = W(f.site, [u, y, v]);
          expect(ray(root, [w[0], y + .08, w[2]], [w[0], y - .18, w[2]]).length, `${mode} ${f.id} tread ${i}`).toBeGreaterThan(0);
          expect(ray(root, [w[0], y + .35, w[2]], [w[0], y + 1.85, w[2]]).map(h => [h.object.name, h.point.toArray()]), `${mode} ${f.id} headroom ${i}`).toEqual([]);
          points.push([u, y, v]);
        }
        walk(f.site, points, mode);
      }
    }
  });
  test("plenary central approaches stay capsule-clear, with real Agh portal opening", () => {
    for (const mode of ["day", "minecraft"]) {
      walk("reichstag", Array.from({ length: 90 }, (_, i) => [-58 + i * .45, 7.595, 0]), mode);
      walk("abgeordnetenhaus", Array.from({ length: 20 }, (_, i) => [0, 6, 2 - i * .8]), mode);
      walk("abgeordnetenhaus", Array.from({ length: 35 }, (_, i) => [0, 13, -17 - i]), mode);
    }
    expect(ray(drawnAssembly(), W("abgeordnetenhaus", [0, 7.6, 4]), W("abgeordnetenhaus", [0, 7.6, -15])).map(h => [h.object.name, h.distance])).toEqual([]);
    const p = W("reichstag", [-27, 9.7, 6.15]);
    expect(schwellenraumInteriorSolidAt(...p, 0, true)).toBe(false);
  });
  test("both retained complete 230m dome routes retain support past the retired source roof", () => {
    const env = createPedestrianEnvironment(voxels, { water: [] }, null, source);
    env.walkableInteriorAt = parliamentWalkableInteriorV295;
    env.interiorSolidAt = (x, y, z) => parliamentSolidAtV295("day", x, y, z, 0);
    env.interiorGroundAt = (x, z, hint) => parliamentGroundAtV295("day", x, z, hint);
    for (const mode of ["day", "minecraft"])
      for (const phase of [0, Math.PI]) {
        const route = reichstagRampPoints(phase);
        for (let i = 2; i < route.length - 1; i++) {
          const p = route[i], x = P.reichstag.anchor[0] + p.x, z = P.reichstag.anchor[2] + p.z, y = P.reichstag.terrace + p.y, h = parliamentGroundAtV295(mode, x, z, y);
          expect(h).not.toBeNull();
          expect(Math.abs(h! - y)).toBeLessThan(.2);
          expect(parliamentSolidAtV295(mode, x, y + 1.5, z, 0)).toBe(false);
          if (i % 20 === 0) {
            const state = createPedestrianState(env, { x, z, yaw: 0, groundYHint: y });
            expect(Math.abs(state.groundY - y)).toBeLessThan(.25);
          }
        }
      }
  });
  test("whole rendered dome assemblies have headroom above both retained public ramps", () => {
    for (const mode of ["day", "minecraft"]) {
      const root = mode === "day" ? drawnAssembly() : nativeAssembly();
      for (const phase of [0, Math.PI])
        for (let i = 2; i < 159; i++) {
          const p = reichstagRampPoints(phase)[i], x = P.reichstag.anchor[0] + p.x, z = P.reichstag.anchor[2] + p.z, y = P.reichstag.terrace + p.y;
          expect(ray(root, [x, y + .35, z], [x, y + 1.85, z]).map(h => [h.object.name, h.point.toArray()]), `${mode} dome ${phase} segment ${i}`).toEqual([]);
          expect(ray(root, [x, y + .16, z], [x, y - .34, z]).length, `${mode} ramp support ${i}`).toBeGreaterThan(0);
          if (mode === "minecraft")
            expect(minecraftHeroSolidAt(x, y + 1.5, z, 0), `native shell collision segment ${i}`).toBe(false);
        }
    }
  }, 30000);
  test("continuous dome ascent chooses its own reachable ribbon, not the floor below or a neighbouring turn", () => {
    for (const mode of ["day", "minecraft"])
      for (const phase of [0, Math.PI]) {
        let height = P.reichstag.terrace;
        const route = reichstagRampPoints(phase);
        for (let i = 1; i < route.length; i++) {
          const p = route[i], x = P.reichstag.anchor[0] + p.x, z = P.reichstag.anchor[2] + p.z, y = P.reichstag.terrace + p.y;
          const next = parliamentGroundAtV295(mode, x, z, height);
          expect(next).not.toBeNull();
          expect(Math.abs(next! - y)).toBeLessThan(.2);
          expect(next!).toBeGreaterThanOrEqual(height - .001);
          height = next!;
        }
        expect(height).toBeCloseTo(P.reichstag.terrace + 16.7, 3);
      }
  });
  test("expanded estimated glazed hall roof remains within source central strip and leaves all six measured courts open", () => {
    for (const [u, v] of [[-20, -80], [20, -80], [20, -44], [-20, -44], [0, -62]]) {
      const p = W("abgeordnetenhaus", [u, 0, v]);
      expect(abgeordnetenhausMainContains(p[0], p[2])).toBe(true);
    }
    for (const build of [createAbgeordnetenhausDetails, createMinecraftAbgeordnetenhausDetails])
      for (const profile of ["full", "mobile"] as const) {
        const root = build(profile, { parliamentInteriorsV295: true });
        for (const court of A.courtyardHolesWorldM) {
          const x = court.reduce((sum, p) => sum + p[0], 0) / court.length, z = court.reduce((sum, p) => sum + p[1], 0) / court.length;
          expect(ray(root, [x, 60, z], [x, 5, z]).map(h => h.object.name)).toEqual([]);
        }
      }
  });
  test("actual walker reaches the Berlin hall and visitor gallery through connected stairs on real terrain", () => {
    for (const mode of ["day", "minecraft"]) {
      const e = realEnvironment(mode), start = W("abgeordnetenhaus", [0, 4.89, 8]);
      let state = createPedestrianState(e, { x: start[0], z: start[2], yaw: 0, groundYHint: 4.89 });
      for (const point of [[0, 6, 2], [0, 6, -16], [-5, 6, -16], [-5, 9.5, -30], [5, 9.5, -30], [5, 13, -16], [0, 13, -16], [0, 13, -46], [-17.6, 13, -46], [-17.6, 18, -61]]) {
        state = navigate(state, W("abgeordnetenhaus", point), e);
        expect(Math.abs(state.groundY - point[1]), `${mode} Agh waypoint ${point}`).toBeLessThan(.2);
      }
    }
  });
  test("actual walker follows complete dome ascent with the retained source cap and native shell collision enabled", () => {
    for (const mode of ["day", "minecraft"])
      for (const phase of [0, Math.PI]) {
        const e = realEnvironment(mode), route = reichstagRampPoints(phase), start = route[0];
        let state = createPedestrianState(e, { x: P.reichstag.anchor[0] + start.x, z: P.reichstag.anchor[2] + start.z, yaw: 0, groundYHint: P.reichstag.terrace });
        for (let i = 1; i < route.length; i++) {
          const p = route[i], target = [P.reichstag.anchor[0] + p.x, P.reichstag.terrace + p.y, P.reichstag.anchor[2] + p.z];
          state = navigate(state, target, e);
          expect(Math.abs(state.groundY - target[1]), `${mode} actual dome ${phase} segment ${i}`).toBeLessThan(.2);
        }
      }
  });
  test("actual west-portal walker reaches the Reichstag chamber and roof terrace by every switchback", () => {
    for (const mode of ["day", "minecraft"]) {
      const e = realEnvironment(mode), start = W("reichstag", [-66, 5, 0]);
      let state = createPedestrianState(e, { x: start[0], z: start[2], yaw: 0, groundYHint: 5 });
      for (const p of [[-58, 7.595, 0], [-46, 7.595, 0], [-22, 7.595, 0], [-46, 7.595, 0], [-46, 7.595, -8], [-44, 7.595, -8]])
        state = navigate(state, W("reichstag", p), e);
      for (let i = 0; i < 8; i++) {
        const f = FLIGHTS.find(f => f.id === `reichstag-foyer-stair-${i}`)!, x = f.to[0], y = f.to[1], z = f.to[2], outer = x + (x === -28 ? .8 : -.8);
        state = navigate(state, W("reichstag", f.to), e);
        state = navigate(state, W("reichstag", [outer, y, z]), e);
        if (i < 7) {
          const next = FLIGHTS.find(f => f.id === `reichstag-foyer-stair-${i + 1}`)!;
          state = navigate(state, W("reichstag", [outer, y, next.from[2]]), e);
          state = navigate(state, W("reichstag", next.from), e);
        }
      }
      state = navigate(state, W("reichstag", [-44.8, 27.595, -6.6]), e);
      state = navigate(state, W("reichstag", [-19, 27.595, -6.6]), e);
      expect(state.groundY).toBeCloseTo(27.595, 3);
    }
  });
  test("real native world publishes identical complete room detail and open source courses on full and mobile", () => {
    const local = { ...voxels, ground_rows: [], tree_rows: [], building_rows: voxels.building_rows.map((row: number[][], zi: number) => {
        const zz = voxels.grid.min_z_idx + zi;
        if (zz < -2 || zz > 21)
          return [];
        return row.flatMap(([start, count, lo, hi, kind]) => { const a = Math.max(start, 63 - voxels.grid.min_x_idx), b = Math.min(start + count, 87 - voxels.grid.min_x_idx); return b > a ? [[a, b - a, lo, hi, kind]] : []; });
      }) } as VoxelPayload;
    let detail: number | undefined;
    for (const profile of ["full", "mobile"] as const) {
      const g = createMinecraftVoxelWorld(local, null, null, { sourcePrisms: source.buildings, parliamentInteriorsV295: true, detailProfile: profile });
      expect(g.userData.parliamentInteriorsV295).toBe(true);
      const columns = g.getObjectByName("Voxel building columns") as InstancedMesh, rooms = g.getObjectByName("Parliament public rooms and circulation v295 native") as Group;
      expect(columns.userData.parliamentOpenColumnCountV295).toBeGreaterThan(100);
      expect(rooms).toBeDefined();
      const count = (rooms.children[0] as InstancedMesh).count;
      if (detail === undefined)
        detail = count;
      else
        expect(count).toBe(detail);
      expect(ray(g, W("reichstag", [-59, 9.2, 0]), W("reichstag", [-22, 9.2, 0])).map(h => [h.object.name, h.distance])).toEqual([]);
    }
  }, 60000);
  test("opened facade owners keep the existing draw/instance/byte allowances, including mobile", () => { for (const profile of ["full", "mobile"] as const)
    for (const native of [false, true]) {
      const root = (native ? createMinecraftAbgeordnetenhausDetails : createAbgeordnetenhausDetails)(profile, { parliamentInteriorsV295: true });
      let bytes = 0, draws = 0, instances = 0;
      root.traverse(o => { if (!(o instanceof Mesh || o instanceof LineSegments))
        return; draws++; bytes += Object.values(o.geometry.attributes).reduce((s, a) => s + a.array.byteLength, 0) + (o.geometry.index?.array.byteLength ?? 0); if (o instanceof InstancedMesh) {
        instances += o.count;
        bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
      } });
      expect(draws).toBe(native ? AB.minecraftRenderables : AB.drawnRenderables);
      expect(instances).toBeLessThan(native ? AB[profile].minecraftBlocks : AB[profile].drawnInstances);
      expect(bytes).toBeLessThan(native ? (profile === "full" ? 270000 : 220000) : AB[profile].drawnBytes);
    } });
  test("the full existing 360-mirror dome and both ramp buffers remain identical outside the exact platform owner", () => { const s = scene.architectural_signatures.find((s: {
    id: string;
  }) => s.id === "reichstag-dome"), old = createArchitecturalSignature(s)!, open = createArchitecturalSignature(s, { parliamentInteriorsV295: true })!; old.traverse(o => { if (!(o instanceof Mesh) || o.name === "Reichstag open observation platform")
    return; const n = open.getObjectByName(o.name) as Mesh; expect(n).toBeDefined(); for (const key of Object.keys(o.geometry.attributes))
    expect(n.geometry.getAttribute(key).array).toEqual(o.geometry.getAttribute(key).array); expect(n.geometry.index?.array).toEqual(o.geometry.index?.array); if (o instanceof InstancedMesh) {
    expect((n as InstancedMesh).instanceMatrix.array).toEqual(o.instanceMatrix.array);
    expect((n as InstancedMesh).count).toBe(o.count);
  } }); });
  test("only the real central Berlin portal admits source collision at the front wall", () => { const e = realEnvironment("day"), p = W("abgeordnetenhaus", [5, 6, 1]); expect(pedestrianPointIsBlocked(p[0], p[2], p[1], e.obstacles, e)).toBe(true); expect(parliamentWalkableInteriorV295(...W("reichstag", [0, 10, 0]), "foreign")).toBe(false); const changed = structuredClone(source.buildings); changed.find(b => b.id === "eaCxS2u2")!.h_dm++; expect(parliamentSourceOwnersAdmittedV295(changed)).toBe(false); });
  test("complete native observation ring supports its previously missing diagonal walks at the shared exact top",()=>{
    const closed=createMinecraftArchitecturalLandmarks({hbfRetailV292:true}).children[0] as InstancedMesh;
    const opened=createMinecraftArchitecturalLandmarks({hbfRetailV292:true,parliamentInteriorsV295:true});
    const batch=opened.children[0] as InstancedMesh,top=P.reichstag.terrace+16.7;
    expect(closed.userData.cueCounts["open block observation platform"]).toBe(10);
    expect(batch.userData.cueCounts["open block observation platform"]).toBeUndefined();
    expect(batch.userData.cueCounts["complete cardinal public observation ring"]).toBeGreaterThan(0);
    expect(batch.userData.rotationYByCue["complete cardinal public observation ring"]).toEqual([0]);
    expect(opened.children.reduce((n,o)=>n+(o as InstancedMesh).count,0)).toBeLessThanOrEqual(5500);
    const root=new Group();root.add(batch);
    for(let i=0;i<360;i++){const a=i*Math.PI/180,x=P.reichstag.anchor[0]+Math.cos(a)*9,z=P.reichstag.anchor[2]+Math.sin(a)*9,hits=ray(root,[x,top+.08,z],[x,top-.4,z]);expect(hits.length,`ring surface at ${i} degrees`).toBeGreaterThan(0);expect(hits[0].point.y).toBeCloseTo(top,4);expect(parliamentGroundAtV295("minecraft",x,z,top)).toBeCloseTo(top,4);}
  });

});
