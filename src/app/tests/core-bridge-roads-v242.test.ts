import { afterAll, describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Raycaster, Vector3 } from "three";
import { BRIDGE_PROFILES, createBridgeStructures } from "../src/IsometricCityWorld";
import { createPedestrianBridgeGround } from "../src/PedestrianBridgeGround";
import { setCoreBridgeRoadPresentationV242 } from "../src/CoreBridgeRoadDetailsV242";
import type { VoxelPayload } from "../src/terrainPayload";
import type { VisualMode } from "../src/visualMode";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

const ground = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
const root = createBridgeStructures(ground, "full", true)!;
const fittings = root.getObjectByName("Core bridge road fittings v242")!;
const drawn = root.getObjectByName("Core bridge road fittings v242 drawn") as InstancedMesh;
const native = root.getObjectByName("Core bridge road fittings v242 native") as InstancedMesh;
root.updateMatrixWorld(true);
afterAll(() => disposeSurroundingCityRoot(root));

function point(name: string, fraction: number, lateral: number): [number, number] {
  const p = BRIDGE_PROFILES.find(p => p.name === name)!;
  const length = Math.hypot(...p.axis!), ax = p.axis![0] / length, az = p.axis![1] / length;
  const u = fraction * p.surveyedDeck!.halfLengthM;
  const curve = (p.curveSagittaM ?? 0) * (1 - fraction ** 2);
  const slope = -2 * (p.curveSagittaM ?? 0) * u / p.surveyedDeck!.halfLengthM ** 2;
  const tx = ax - az * slope, tz = az + ax * slope, norm = Math.hypot(tx, tz);
  return [p.world[0] + ax * u - az * curve - tz / norm * lateral,
    p.world[1] + az * u + ax * curve + tx / norm * lateral];
}

describe("source-bound core bridge road fittings v242", () => {
  test("uses two compact static families and leaves authored railings and sculptures present", () => {
    expect(fittings.children.length).toBe(2);
    expect(drawn.count).toBeGreaterThan(300);
    expect(drawn.count).toBeLessThan(500);
    expect(native.count).toBeLessThan(4500);
    expect(drawn.instanceMatrix.array.byteLength + drawn.instanceColor!.array.byteLength +
      native.instanceMatrix.array.byteLength + native.instanceColor!.array.byteLength).toBeLessThan(400_000);
    expect(root.getObjectByName("Moltkebrücke ornamental stone bodies")).toBeDefined();
    expect(root.getObjectByName("Weidendammer bridge neo-Baroque railing lamps and Prussian eagles")).toBeDefined();
    expect(root.getObjectByName("Sandkrugbrücke drawn architecture")).toBeDefined();
    const matrix = new Matrix4();
    for (let i = 0; i < native.count; i++) {
      native.getMatrixAt(i, matrix);
      for (const j of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[j]).toBe(0);
      expect(matrix.elements.every(Number.isFinite)).toBeTrue();
    }
  });

  test("mode changes select one family, including cold native and restoration", () => {
    for (const mode of ["minecraft", "night", "snowstorm", "flood", "schwellenraum", "day"] as const) {
      setCoreBridgeRoadPresentationV242(root, mode);
      expect(drawn.visible).toBe(mode !== "minecraft");
      expect(native.visible).toBe(mode === "minecraft");
    }
  });

  test("visible raised footways and curb tops agree with walking in both families", () => {
    let mode: VisualMode = "day";
    const support = createPedestrianBridgeGround(ground, () => mode, .2);
    for (mode of ["day", "minecraft"]) {
      const mesh = mode === "minecraft" ? native : drawn;
      setCoreBridgeRoadPresentationV242(root, mode);
      for (const [name, curb, pavement] of [
        ["Moltkebrücke", 8.71, 10.5],
        ["Hugo-Preuß-Brücke", 6.885, 8.9],
        ["Weidendammer Brücke", 6.91, 8.8],
      ] as const) {
        for (const fraction of [-.65, -.22, .18, .61]) {
          for (const side of [-1, 1]) {
            for (const lateral of mode === "minecraft" ? [pavement] : [curb, pavement]) {
              const [x, z] = point(name, fraction, lateral * side);
              const y = support(x, z)!;
              const hits = new Raycaster(new Vector3(x, y + .3, z), new Vector3(0, -1, 0), 0, .5)
                .intersectObject(mesh);
              expect(hits.length).toBeGreaterThan(0);
              expect(Math.abs(hits[0].point.y - y)).toBeLessThan(.003);
            }
          }
        }
      }
    }
  });
});
