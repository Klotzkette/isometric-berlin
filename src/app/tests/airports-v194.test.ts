import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { AIRPORTS_V194_PROFILE, createAirportsV194 } from "../src/AirportsV194";
import { airportsV194SolidAt, airportsV194NativeSolidAt } from "../src/airportsV194Navigation";
import data from "../src/data/airportsV194.json";

describe("former airports v194", () => {
  test("both complete static modes construct within measured budgets", () => {
    for (const native of [false, true]) {
      const root = createAirportsV194(native);
      expect(root.children.length).toBe(native ? 1 : 2);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(root.userData.sourceGeometryRetained).toBe(true);
      expect(root.userData.blockNative).toBe(native);
      let bytes = 0;
      for (const child of root.children) {
        const mesh = child as Mesh;
        expect(mesh.matrixAutoUpdate).toBe(false);
        expect(mesh.frustumCulled).toBe(true);
        expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
        expect(mesh.userData.dayMaterial).not.toBe(mesh.userData.nightMaterial);
        expect(mesh.userData.textureFree).toBe(true);
        const bounds = mesh instanceof InstancedMesh ? mesh.boundingSphere! : mesh.geometry.boundingSphere!;
        expect(Number.isFinite(bounds.radius)).toBe(true);
        expect(bounds.radius).toBeGreaterThan(1000);
        for (const a of Object.values(mesh.geometry.attributes)) bytes += a.array.byteLength;
        bytes += mesh.geometry.index?.array.byteLength ?? 0;
        if (mesh instanceof InstancedMesh) {
          bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
          expect(mesh.count).toBe(native ? 13550 : 3551);
          if (native) for (let i = 0; i < mesh.count; i++) {
            for (const j of [1, 2, 4, 6, 8, 9]) expect(mesh.instanceMatrix.array[i * 16 + j]).toBe(0);
          }
        }
      }
      expect(bytes).toBe(native ? 1030448 : 1058276);
      expect(bytes).toBeLessThan(AIRPORTS_V194_PROFILE.budgetBytes);
    }
  });

  test("all six Tempelhof courts and the Tegel central court remain open", () => {
    const points = [[-5410,-4078],[1114.689,3952.662],[976.596,4052.891],[1015.711,4112.124],[1171.703,3969.582],[1092.635,4137.877],[1178.579,4071.329]];
    for (const fn of [airportsV194SolidAt, airportsV194NativeSolidAt]) {
      for (const [x,z] of points) expect(fn(x,5,z,.25)).toBe(false);
      expect(fn(0,5,0)).toBe(false);
      expect(fn(100000,5,100000)).toBe(false);
    }
    expect(airportsV194SolidAt(-5208.3184,20,-4098.7154)).toBe(true);
    expect(airportsV194SolidAt(-5208.3184,54,-4098.7154)).toBe(false);
  });

  test("native collision uses the represented final blocks rather than closed envelopes", () => {
    const solids = data.blocks.filter(r => r[1] + r[4] / 2 > 3.2);
    expect(solids.length).toBeGreaterThan(10000);
    for (let i = 0; i < solids.length; i += 29) {
      const r = solids[i];
      expect(airportsV194NativeSolidAt(r[0],r[1],r[2])).toBe(true);
    }
    // The source-native tower is a surface lattice with an open interior.
    expect(airportsV194NativeSolidAt(-5208.3184,5,-4098.7154)).toBe(false);
  });
});
