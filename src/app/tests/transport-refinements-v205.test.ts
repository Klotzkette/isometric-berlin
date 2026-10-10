import { expect, test } from "bun:test";
import { InstancedMesh, LineSegments, Material, Mesh, Texture } from "three";
import { createBerAirportV205 } from "../src/BerAirportV205";
import { createWesternMotorwaysV205 } from "../src/WesternMotorwaysV205";
import { createRailStationsV190 } from "../src/RailStationsV190";
import { terrainGroundAt } from "../src/weinbergTerrainV176";
import motorways from "../src/data/westernMotorwaysV205.json";

function inspect(root: ReturnType<typeof createBerAirportV205>, native: boolean): { bytes: number; draws: number } {
  let bytes = 0, draws = 0;
  root.traverse(object => {
    expect(object.matrixAutoUpdate).toBe(false);
    if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
    draws++;
    expect(object.frustumCulled).toBe(true);
    expect(object.geometry.getAttribute("uv")).toBeUndefined();
    expect(object.geometry.boundingSphere).not.toBeNull();
    for (const a of Object.values(object.geometry.attributes)) {
      bytes += a.array.byteLength;
      expect(Array.from(a.array).every(Number.isFinite)).toBe(true);
    }
    if (object instanceof InstancedMesh) {
      bytes += object.instanceMatrix.array.byteLength + object.instanceColor!.array.byteLength;
      for (let i = 0; i < object.count; i++) if (native)
        for (const j of [1, 2, 4, 6, 8, 9]) expect(object.instanceMatrix.array[i * 16 + j]).toBe(0);
    }
    expect(object.userData.dayMaterial).toBeInstanceOf(Material);
    expect(object.userData.nightMaterial).toBeInstanceOf(Material);
    expect(object.userData.dayMaterial).not.toBe(object.userData.nightMaterial);
    for (const material of [object.userData.dayMaterial, object.userData.nightMaterial])
      expect(Object.values(material).some(v => v instanceof Texture)).toBe(false);
  });
  return { bytes, draws };
}
function release(root: ReturnType<typeof createBerAirportV205>): void {
  root.traverse(object => {
    if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
    object.geometry.dispose(); object.userData.dayMaterial?.dispose(); object.userData.nightMaterial?.dispose();
  });
}

for (const native of [false, true]) test(`BER v205 ${native ? "native" : "drawn"} has finite independent bounded texture-free resources`, () => {
  const root = createBerAirportV205(native);
  const metrics = inspect(root, native);
  expect(root.userData.fullStaticDetailOnTouch).toBe(true);
  expect(metrics.draws).toBe(native ? 1 : 4);
  expect(metrics.bytes).toBeLessThan(2 * 1024 * 1024);
  console.log("BER v205", { native, ...metrics });
  release(root);
  const repeat = createBerAirportV205(native);
  expect((repeat.children[0] as Mesh).geometry).not.toBe((root.children[0] as Mesh).geometry);
  expect(inspect(repeat, native)).toEqual(metrics);
  release(repeat);
});

test("western motorway overlays retain terrain-relative cartographic grades in both modes", () => {
  for (const native of [false, true]) {
    const root = createWesternMotorwaysV205(native), metrics = inspect(root, native);
    expect(metrics.draws).toBe(motorways.groups.length);
    expect(metrics.draws).toBeLessThan(25);
    expect(metrics.bytes).toBeLessThan(150_000);
    root.children.forEach((object, i) => {
      const line = object as LineSegments, input = new Float32Array(motorways.groups[i].positions);
      const positions = line.geometry.getAttribute("position");
      for (let j = 0; j < positions.count; j++) {
        expect(positions.getX(j)).toBe(input[j * 3]); expect(positions.getZ(j)).toBe(input[j * 3 + 2]);
        expect(positions.getY(j)).toBe(Math.fround(input[j * 3 + 1] + terrainGroundAt(input[j * 3], input[j * 3 + 2], 3, false) - 3));
      }
      expect(Boolean(line.geometry.getAttribute("lineDistance"))).toBe(motorways.groups[i].kind === "tunnel");
    });
    release(root);
  }
});

test("all 27 Ring stations receive detail while hero groups remain present", () => {
  for (const native of [false, true]) {
    const root = createRailStationsV190(native);
    expect(root.children.filter(c => c.userData.ringRefinementV205)).toHaveLength(27);
    expect(root.children).toHaveLength(36);
    expect(root.userData.preservedHeroNames).toEqual(["Zoologischer Garten", "Hauptbahnhof", "Friedrichstraße", "Alexanderplatz", "Jannowitzbrücke"]);
    release(root);
  }
});
