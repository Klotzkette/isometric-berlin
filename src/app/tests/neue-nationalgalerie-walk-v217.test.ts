import { describe, expect, test } from "bun:test";
import { Raycaster, Vector3 } from "three";
import { createNeueNationalgalerieV183 } from "../src/NeueNationalgalerieV183";
import { NATIONALGALERIE_V183 as P, NATIONALGALERIE_V183_IDS, NATIONALGALERIE_TERRACE_V183, NATIONALGALERIE_TERRACE_RING_V183 } from "../src/neueNationalgalerieV183Profile";
import {
  configureNeueNationalgalerieObstaclesV217, neueNationalgalerieGroundAtV217,
  neueNationalgalerieLocalV217, neueNationalgalerieSolidAtV217,
  neueNationalgalerieStairYV217, neueNationalgalerieWalkableAtV217,
  neueNationalgalerieWorldV217 as world, NNG_ROOM_WALLS_V217, NNG_MARBLE_PIERS_V217,
} from "../src/neueNationalgalerieWalkV217";
import { compilePedestrianObstacles, createPedestrianEnvironment, createPedestrianState, pedestrianPointIsBlocked, stepPedestrian, type PedestrianEnvironment } from "../src/pedestrianNavigation";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import type { VisualMode } from "../src/visualMode";

const modes: VisualMode[] = ["day", "night", "snowstorm", "minecraft", "schwellenraum", "flood"];
const ground = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
const sourceGroundAt = createPedestrianEnvironment(ground, { water: [] }).groundAt;
function environment(mode: VisualMode): PedestrianEnvironment {
  const obstacles = compilePedestrianObstacles(prisms, () => mode);
  configureNeueNationalgalerieObstaclesV217(obstacles);
  return {
    bounds: { minX: -1000, maxX: 1000, minZ: 1000, maxZ: 1600 }, water: [], obstacles,
    visualMode: () => mode, groundAt: sourceGroundAt,
    walkableInteriorAt: neueNationalgalerieWalkableAtV217,
    interiorSolidAt: neueNationalgalerieSolidAtV217,
    interiorGroundAt: (x, z, y) => neueNationalgalerieGroundAtV217(x, z, y ?? 5.2),
  };
}

describe("Neue Nationalgalerie bounded walking v217", () => {
  test("the retained podium base matches shipped ground along every source edge and the stair approach", () => {
    expect(P.groundY).toBe(5.2);
    expect(P.terraceTopY).toBe(9.8);
    expect(NATIONALGALERIE_TERRACE_V183.holes).toHaveLength(0);
    const ring = NATIONALGALERIE_TERRACE_RING_V183;
    for (let i = 0; i < ring.length; i++) for (let sample = 0; sample <= 10; sample++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], t = sample / 10;
      expect(sourceGroundAt(a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))).toBeCloseTo(P.groundY, 8);
    }
    for (const z of [0, 54, 57, 61.6, 62]) {
      const p = world(0, 0, z);
      expect(sourceGroundAt(p[0], p[2])).toBeCloseTo(P.groundY, 8);
    }
  });
  test("all retained stair treads have visible support down to source ground in both representations", () => {
    for (const native of [false, true]) {
      const root = createNeueNationalgalerieV183(native); root.updateMatrixWorld(true);
      for (let i = 0; i < 22; i++) {
        const z = 61.425 - i * .33, top = 5.41 + i * .21;
        for (const y of [P.groundY + .04, (P.groundY + top) / 2]) {
          const a = new Vector3(...world(-17, y, z)), b = new Vector3(...world(0, y, z));
          const hits = new Raycaster(a, b.sub(a).normalize(), 0, 3).intersectObject(root, true);
          expect(hits.length).toBeGreaterThan(0);
          expect(hits[0].point.y).toBeCloseTo(y, 6);
        }
      }
    }
  });
  test("podium and stair supports reject side entry with a capsule while retaining the source recess", () => {
    const inside = world(0, P.groundY, 0), outside = world(35, P.groundY, 45);
    // This must also work before/without the compiled source-owner index.
    expect(pedestrianPointIsBlocked(inside[0], inside[2], inside[1], undefined,
      { interiorSolidAt: neueNationalgalerieSolidAtV217 })).toBeTrue();
    expect(neueNationalgalerieSolidAtV217(...outside, .3)).toBeFalse();
    // The northeast edge now adjoins the exact additive OSM apron. The west
    // edge still tests the unchanged exterior capsule-clearance boundary.
    const [a, b] = [NATIONALGALERIE_TERRACE_RING_V183[5], NATIONALGALERIE_TERRACE_RING_V183[0]];
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = (b[1] - a[1]) / length, nz = -(b[0] - a[0]) / length;
    expect(neueNationalgalerieSolidAtV217(mx + nx * .2, 6, mz + nz * .2, .3)).toBeTrue();
    expect(neueNationalgalerieSolidAtV217(mx + nx * .4, 6, mz + nz * .4, .3)).toBeFalse();
    for (const mode of modes) {
      const env = environment(mode), p = world(18, P.groundY, 57);
      let state = createPedestrianState(env, { x: p[0], z: p[2], yaw: -P.yaw - Math.PI / 2,
        groundYHint: P.groundY, preserveHorizontalPosition: true });
      for (let frame = 0; frame < 50; frame++) state = stepPedestrian(state,
        { forward: 1, strafe: 0, turn: 0, look: 0, sprint: false }, 1 / 60, env).state;
      const [u, v] = neueNationalgalerieLocalV217(state.x, state.z);
      expect(u).toBeGreaterThan(15.29); expect(u).toBeLessThan(16);
      expect(Math.abs(v - 57)).toBeLessThan(.3); expect(state.groundY).toBeCloseTo(P.groundY, 6);
    }
  });
  test("all 22 retained stair surfaces match drawn and native geometry", () => {
    for (const native of [false, true]) {
      const root = createNeueNationalgalerieV183(native); root.updateMatrixWorld(true);
      for (let i = 0; i < 22; i++) {
        const z = 61.425 - i * .33, top = 5.41 + i * .21, p = world(0, 16, z);
        const hit = new Raycaster(new Vector3(...p), new Vector3(0, -1, 0)).intersectObject(root, true)[0];
        expect(hit.point.y).toBeCloseTo(top, 3);
        expect(neueNationalgalerieStairYV217(0, z)).toBeCloseTo(top, 6);
        expect(neueNationalgalerieGroundAtV217(p[0], p[2], top - .21)).toBeCloseTo(top, 6);
      }
    }
  });
  test("full capsule climbs from street and traverses both centered doors in every mode", () => {
    for (const mode of modes) {
      const env = environment(mode), p = world(0, 5.2, 62);
      let state = createPedestrianState(env, { x: p[0], z: p[2], yaw: -P.yaw, groundYHint: 5.2, preserveHorizontalPosition: true });
      for (let frame = 0; frame < 435; frame++) state = stepPedestrian(state,
        { forward: 1, strafe: 0, turn: 0, look: 0, sprint: false }, 1 / 60, env).state;
      const [u, v] = neueNationalgalerieLocalV217(state.x, state.z);
      expect(u).toBeCloseTo(0, 4); expect(v).toBeLessThan(-31); expect(state.groundY).toBeCloseTo(P.floorY, 5);
      expect(pedestrianPointIsBlocked(state.x, state.z, state.groundY, env.obstacles, env)).toBeFalse();
      for (const entryZ of [-7.2, 7.2]) {
        const entry = world(31, P.floorY, entryZ);
        let entering = createPedestrianState(env, { x: entry[0], z: entry[2], yaw: -P.yaw - Math.PI / 2, groundYHint: P.floorY, preserveHorizontalPosition: true });
        for (let frame = 0; frame < 70; frame++) entering = stepPedestrian(entering,
          { forward: 1, strafe: 0, turn: 0, look: 0, sprint: false }, 1 / 60, env).state;
        const [enteredX, enteredZ] = neueNationalgalerieLocalV217(entering.x, entering.z);
        expect(enteredX).toBeLessThan(17); expect(enteredZ).toBeCloseTo(entryZ, 5);
        expect(entering.groundY).toBeCloseTo(P.floorY, 5);
      }
      const exit = world(0, P.floorY, 50);
      let leaving = createPedestrianState(env, { x: exit[0], z: exit[2], yaw: -P.yaw + Math.PI,
        groundYHint: P.floorY, preserveHorizontalPosition: true });
      for (let frame = 0; frame < 80; frame++) leaving = stepPedestrian(leaving,
        { forward: 1, strafe: 0, turn: 0, look: 0, sprint: false }, 1 / 60, env).state;
      expect(neueNationalgalerieLocalV217(leaving.x, leaving.z)[1]).toBeGreaterThan(65);
      expect(leaving.groundY).toBeCloseTo(P.groundY, 6);
    }
  });
  test("street-side twin doors admit capsules; glazing, room walls, piers and exterior columns remain solid", () => {
    const env = environment("day");
    const blocked = (u: number, v: number) => { const p = world(u, P.floorY, v); return pedestrianPointIsBlocked(p[0], p[2], p[1], env.obstacles, env); };
    for (const v of [-7.2, 7.2]) for (const u of [24.7, 25.2, 25.7]) expect(blocked(u, v)).toBeFalse();
    expect(blocked(25.2, 0)).toBeTrue(); expect(blocked(-25.2, 7.2)).toBeTrue(); expect(blocked(7, 25.2)).toBeTrue();
    for (const box of [...NNG_ROOM_WALLS_V217, ...NNG_MARBLE_PIERS_V217]) expect(blocked(box.x, box.z)).toBeTrue();
    expect(blocked(-10, 12)).toBeFalse(); expect(blocked(-15, 12)).toBeFalse();
    expect(blocked(14.4, 28.8)).toBeTrue(); expect(blocked(28.8, -14.4)).toBeTrue();
  });
  test("rendered doorway centers contain no remaining glass or mullion across the walking route", () => {
    for (const native of [false, true]) {
      const root = createNeueNationalgalerieV183(native); root.updateMatrixWorld(true);
      for (const [x0, z0, x1, z1] of [[0, 27, 0, 23], [0, -27, 0, -23], [27, 7.2, 23, 7.2], [27, -7.2, 23, -7.2]]) {
        const a = new Vector3(...world(x0, P.floorY + 1, z0)), b = new Vector3(...world(x1, P.floorY + 1, z1));
        expect(new Raycaster(a, b.sub(a).normalize(), 0, 4).intersectObject(root, true)).toHaveLength(0);
      }
    }
  });
  test("only exact retained owners are opened and support does not teleport visitors", () => {
    const p = world(0, P.floorY, 0);
    for (const id of NATIONALGALERIE_V183_IDS) expect(neueNationalgalerieWalkableAtV217(...p, id)).toBeTrue();
    expect(neueNationalgalerieWalkableAtV217(...p, "unrelated")).toBeFalse();
    expect(neueNationalgalerieWalkableAtV217(...p)).toBeFalse();
    expect(neueNationalgalerieGroundAtV217(p[0], p[2], 5.2)).toBeNull();
    expect(neueNationalgalerieGroundAtV217(p[0], p[2], 20.02)).toBeNull();
    const outside = world(35, 9.82, 45);
    expect(neueNationalgalerieGroundAtV217(outside[0], outside[2], 9.82)).toBeNull();
    const index = compilePedestrianObstacles(prisms);
    const unique = new Set([...index.cells.values()].flat());
    const neighbours = [...unique].filter(o => !o.sourceId || !NATIONALGALERIE_V183_IDS.has(o.sourceId));
    const previousTops = neighbours.map(o => o.maxY);
    configureNeueNationalgalerieObstaclesV217(index);
    expect(neighbours.map(o => o.maxY)).toEqual(previousTops);
    const museum = [...unique].filter(o => o.sourceId && NATIONALGALERIE_V183_IDS.has(o.sourceId));
    expect(museum).toHaveLength(8);
    for (const obstacle of museum) expect(obstacle.maxY).toBeCloseTo(obstacle.sourceId === "MSMgX8rD" ? 9.82 : 20.02, 6);
  });
});
