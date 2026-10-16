import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";
import { createSteglitzMotorwayV226 } from "../src/SteglitzMotorwayV226";
import { steglitzMotorwayV226DeckAt, steglitzMotorwayV226GroundAt, steglitzMotorwayV226SolidAt } from "../src/steglitzMotorwayV226Navigation";
import { createPedestrianState, pedestrianSpawnFromView, stepPedestrian, type PedestrianEnvironment } from "../src/pedestrianNavigation";
import data from "../src/data/steglitzMotorwayV226.json";
import { READONLY_CONSTRUCTION_JSON_FIELDS } from "../losslessJsonData";

test("complete independent motorway families are bounded, texture-free and repeatable", () => {
  expect(READONLY_CONSTRUCTION_JSON_FIELDS["steglitzMotorwayV226.json"]).toEqual(["positions", "colors", "rails", "nativeRows"]);
  expect(READONLY_CONSTRUCTION_JSON_FIELDS["steglitzMotorwayV226Navigation.json"]).toBeUndefined();
  for (const native of [false, true]) {
    const roots = [createSteglitzMotorwayV226(native), createSteglitzMotorwayV226(native)];
    const sizes: number[] = [];
    for (const root of roots) {
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(root.userData.sourceWays).toBe(25);
      let bytes = 0, calls = 0;
      root.traverse(o => {
        expect(o.matrixAutoUpdate).toBe(false);
        if (!(o instanceof Mesh)) return;
        calls++;
        expect(o.geometry.getAttribute("uv")).toBeUndefined();
        expect(o.geometry.boundingSphere).not.toBeNull();
        expect(o.userData.dayMaterial.map).toBeNull();
        expect(o.userData.nightMaterial.map).toBeNull();
        for (const a of Object.values(o.geometry.attributes)) { bytes += a.array.byteLength; expect(Array.from(a.array).every(Number.isFinite)).toBe(true); }
        bytes += o.geometry.index?.array.byteLength ?? 0;
        if (o instanceof InstancedMesh) {
          bytes += o.instanceMatrix.array.byteLength + o.instanceColor!.array.byteLength;
          const m = new Matrix4();
          for (let i = 0; native && i < o.count; i++) {
            o.getMatrixAt(i, m);
            for (const j of [1, 2, 4, 6, 8, 9]) expect(m.elements[j]).toBe(0);
          }
        }
      });
      expect(calls).toBe(native ? 1 : 2);
      expect(bytes).toBeLessThan(190_000);
      sizes.push(bytes);
    }
    expect(sizes[0]).toBe(sizes[1]);
    expect((roots[0].children[0] as Mesh).geometry).not.toBe((roots[1].children[0] as Mesh).geometry);
    console.log("A103 v226 GPU buffer bytes", native, sizes[0]);
    for (const root of roots) root.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); o.userData.dayMaterial.dispose(); o.userData.nightMaterial.dispose(); } });
  }
});

test("both road crossings stay open below the represented deck in both modes", () => {
  for (const native of [false, true]) for (const [x, z] of [[-3443.2057, 6869.0824], [-3295.1105, 6682.8357]]) {
    const y = steglitzMotorwayV226DeckAt(x, z, native)!;
    expect(y).toBeGreaterThan(9);
    expect(steglitzMotorwayV226GroundAt(x, z, 3, native)).toBeNull();
    expect(steglitzMotorwayV226GroundAt(x, z, y, native)).toBe(y);
    expect(steglitzMotorwayV226SolidAt(x, y - .2, z, 0, native)).toBe(true);
    expect(steglitzMotorwayV226SolidAt(x, 5, z, .25, native)).toBe(false);
  }
  for (const row of data.nativeRows.slice(0, 757)) {
    expect(steglitzMotorwayV226DeckAt(row[0], row[2], true)).toBeCloseTo(row[1] + row[4] / 2, 5);
  }
  expect(steglitzMotorwayV226GroundAt(-3415, 6825, NaN)).toBeNull();
  expect(steglitzMotorwayV226DeckAt(-3480, 6800)).toBeNull();
});

test("real walking descent lands on deck, while an underpass visitor stays at ground", () => {
  const idle = { forward: 0, strafe: 0, turn: 0, sprint: false, jump: false };
  for (const native of [false, true]) {
    const x = -3443.2057, z = 6869.0824, deck = steglitzMotorwayV226DeckAt(x, z, native)!;
    const environment: PedestrianEnvironment = {
      bounds: { minX: -3800, maxX: -3000, minZ: 6400, maxZ: 7400 }, groundAt: () => 3, water: [],
      interiorGroundAt: (px, pz, y) => steglitzMotorwayV226GroundAt(px, pz, y ?? 3, native),
      interiorSolidAt: (px, y, pz, r) => steglitzMotorwayV226SolidAt(px, y, pz, r, native),
    };
    for (const [cameraY, expected] of [[30, deck], [7, 3]]) {
      const spawn = pedestrianSpawnFromView(environment, { x, y: 0, z }, { x, y: cameraY, z }, { x: 0, y: -.3, z: -1 })!;
      let state = createPedestrianState(environment, spawn);
      for (let i = 0; i < 600 && !state.grounded; i++) state = stepPedestrian(state, idle, 1 / 60, environment).state;
      expect(state.grounded).toBe(true); expect(state.groundY).toBeCloseTo(expected, 5);
      const start = { x: state.x, z: state.z };
      for (let i = 0; i < 8; i++) state = stepPedestrian(state, { ...idle, strafe: 1 }, 1 / 60, environment).state;
      expect(Math.hypot(state.x - start.x, state.z - start.z)).toBeGreaterThan(.3);
      expect(state.groundY).toBeCloseTo(expected, 5);
    }
  }
});
