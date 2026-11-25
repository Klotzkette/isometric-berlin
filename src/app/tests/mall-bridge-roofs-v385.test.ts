import { expect, test } from "bun:test";
import type { PrismPayload } from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/terrainPayload";
import { ALT_MITTE_V169_PARTS, altMitteV169RoofAt, preloadAltMitteV169NativeNavigation } from "../src/altMitteV169Profile";
import { MALL_PIAZZA_LOD2_PARENT, retainedMallNativeRoofV385 } from "../src/mallBridgeNavigationV385";
import { createPedestrianEnvironment, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import source from "../src/data/mallBridgeRoofsV385.json";

test("the two genuine Mall bridge openings leave both retained wings, their roofs and both public deck levels intact", async () => {
  await preloadAltMitteV169NativeNavigation();
  const data = new URL("../public/mesh/regierungsviertel/", import.meta.url);
  const ground: VoxelPayload = await Bun.file(new URL("ground-context.json", data)).json();
  const prisms: PrismPayload = await Bun.file(new URL("lod2-prisms.json", data)).json();
  const parts = new Set(["MeoMBUqM", "ANtdjIMa", "f8929NwV", "ZSDXhJGe"]);
  const buildings = prisms.buildings.filter(b => parts.has(b.id));
  expect(buildings.length).toBe(4);
  const environment = createPedestrianEnvironment(ground, { water: [] }, null, { buildings });
  expect(ALT_MITTE_V169_PARTS.filter(p => p.sourceId === MALL_PIAZZA_LOD2_PARENT).map(p => p.id).sort())
    .toEqual(["DEBE3DAAMeoMBUqM", "DEBE3DyiZSDXhJGe"]);

  for (const native of [false, true]) {
    environment.visualMode = () => native ? "minecraft" : "day";
    const blocked = (x: number, z: number, y: number) => pedestrianPointIsBlocked(x, z, y, environment.obstacles, environment);
    // Independent source interior points in the two retired LoD2 envelopes.
    for (const [x, z] of [[631.609, 928.646], [635.583, 978.844]]) {
      expect(altMitteV169RoofAt(x, z, native)).toBeNull();
      expect(blocked(x, z, environment.groundAt(x, z)!)).toBe(false);
    }
    // Interval below each gallery remains walkable; its two deck slabs still collide.
    for (const [x, z] of [[631.685, 930.615], [635.35, 977.525]]) {
      expect(blocked(x, z, environment.groundAt(x, z)!)).toBe(false);
      expect(blocked(x, z, 8.7)).toBe(true);
      expect(blocked(x, z, 14)).toBe(true);
      expect(blocked(x, z, 18)).toBe(false);
    }
    for (const [x, z, drawnRoof, blockRoof] of [[643.429, 944.421, 29.24955773359773, 31], [623.281, 957.24, 25.40559851670824, 27]]) {
      expect(altMitteV169RoofAt(x, z, native)).toBeCloseTo(native ? blockRoof : drawnRoof, 8);
      expect(blocked(x, z, 6)).toBe(true);
    }
  }
  expect(source.drawn).toHaveLength(16);
  expect(source.native).toHaveLength(164);
  for (const [x, z, oldY] of source.native) {
    expect(altMitteV169RoofAt(x! + .5, z! + .5, true)).toBeNull();
    // A later higher source surface at the same cell must stay available.
    expect(retainedMallNativeRoofV385(x!, z!, oldY! + 2)).toBe(oldY! + 2);
  }
});
