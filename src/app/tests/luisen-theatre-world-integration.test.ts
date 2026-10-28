import { describe, expect, test } from "bun:test";
import { Box3, Group, Matrix4, Ray, Vector3 } from "three";
import { compilePedestrianObstacles, pedestrianPointIsBlocked, createPedestrianState, type PedestrianPolygonObstacle, type PedestrianEnvironment } from "../src/pedestrianNavigation";
import { BOELL_STIFTUNG_LOW_ID, BOELL_STIFTUNG_CORE_ID } from "../src/boellStiftungProfile";
import { FRIEDRICHSTADT_PALAST_PRISM_ID, FRIEDRICHSTADT_PALAST_ROOT_NAME, FRIEDRICHSTADT_PALAST_MINECRAFT_NAME, friedrichstadtPalastTopAt, palastFacadePoint, setFriedrichstadtMinecraftPresentation } from "../src/FriedrichstadtPalastDetails";
import { createFriedrichstadtAndTearPalaces, TEAR_PALACE_ROOT_NAME } from "../src/FriedrichstadtAndTearPalaces";
import { PRISM_SUPPRESSED_IDS, WINDOWS_SUPPRESSED_IDS, GENERIC_FACADE_TRIM_SUPPRESSED_IDS, GENERIC_CHIMNEY_SUPPRESSED_IDS, type PrismPayload } from "../src/IsometricCityWorld";
import { LUISEN_CORRIDOR_IDS } from "../src/luisenCorridorProfile";
import { DEUTSCHES_THEATER_IDS } from "../src/DeutschesTheater";
import { buildColumnToneLookup } from "../src/MinecraftVoxelWorld";
import { LUISEN_CORRIDOR_TONES } from "../src/luisenCorridorProfile";
import source from "../public/mesh/regierungsviertel/lod2-prisms.json";
import { centralTheatreRowsV274 } from "../src/palastStageV274";
const payload = source as unknown as PrismPayload;

// Intersect the actual packed box solids submitted by the two v274 renderers,
// independently of the navigation height function. No world factory is needed.
function stageSurfaceAt(x: number, z: number, native: boolean): number | null {
  const rows = centralTheatreRowsV274(native, "palast");
  const unit = new Box3(new Vector3(-.5, -.5, -.5), new Vector3(.5, .5, .5));
  const ray = new Ray(new Vector3(x, 100, z), new Vector3(0, -1, 0));
  const matrix = new Matrix4(), inverse = new Matrix4(), scale = new Vector3(), hit = new Vector3();
  let top: number | null = null;
  for (let at = 0; at < rows.length; at += 8) {
    matrix.makeRotationY(rows[at + 6]).scale(scale.set(rows[at + 3], rows[at + 4], rows[at + 5]));
    matrix.setPosition(rows[at], rows[at + 1], rows[at + 2]);
    if (ray.clone().applyMatrix4(inverse.copy(matrix).invert()).intersectBox(unit, hit)) {
      top = Math.max(top ?? -Infinity, hit.applyMatrix4(matrix).y);
    }
  }
  return top;
}

describe("Luisen corridor, theatres and foundation world integration", () => {
  test("Minecraft palette uses bounded corridor reference colours without mutating source samples", () => {
    const id = [...LUISEN_CORRIDOR_IDS][0], tone = LUISEN_CORRIDOR_TONES[id];
    const ring = [[0,0],[100,0],[100,100],[0,100]];
    const buildings = [{id,ring,tone:[30,20,10] as [number,number,number]}];
    const before = JSON.stringify(buildings);
    const expected = buildColumnToneLookup({buildings:[{ring,tone:[(tone>>16)&255,(tone>>8)&255,tone&255]}]});
    expect(buildColumnToneLookup({buildings})(5,5)).toBe(expected(5,5));
    expect(JSON.stringify(buildings)).toBe(before);
  });
  test("dedicated facades replace inherited panes and trim while retaining source bodies", () => {
    for (const id of [...LUISEN_CORRIDOR_IDS, ...DEUTSCHES_THEATER_IDS, BOELL_STIFTUNG_CORE_ID]) {
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBeFalse();
      expect(WINDOWS_SUPPRESSED_IDS.has(id)).toBeTrue();
      expect(GENERIC_FACADE_TRIM_SUPPRESSED_IDS.has(id)).toBeTrue();
      expect(GENERIC_CHIMNEY_SUPPRESSED_IDS.has(id)).toBeTrue();
    }
    expect(PRISM_SUPPRESSED_IDS.has(BOELL_STIFTUNG_LOW_ID)).toBeTrue();
    expect(PRISM_SUPPRESSED_IDS.has(FRIEDRICHSTADT_PALAST_PRISM_ID)).toBeTrue();
  });
  for (const mode of ["day", "night", "snowstorm", "minecraft", "schwellenraum"] as const) test(`${mode}: walking agrees with the raised beletage and both Palast roof levels`, () => {
    const obstacles = compilePedestrianObstacles(payload, () => mode);
    const indexed = new Map([...new Set([...obstacles.cells.values()].flat())].filter((o): o is PedestrianPolygonObstacle => o.kind === "polygon").map(o => [o.sourceId, o]));
    const low = indexed.get(BOELL_STIFTUNG_LOW_ID)!;
    expect(low.minY).toBe(8.8); expect(low.maxY).toBe(15.8);
    expect(pedestrianPointIsBlocked(790, -500, 5.2, obstacles)).toBeFalse();
    expect(pedestrianPointIsBlocked(790, -500, 9, obstacles)).toBeTrue();
    expect(pedestrianPointIsBlocked(790, -500, 15.8, obstacles)).toBeFalse();
    const original = payload.buildings.find(b => b.id === FRIEDRICHSTADT_PALAST_PRISM_ID)!;
    expect(original.h_dm).toBe(120);
    expect(indexed.get(original.id)!.ring).toBe(original.ring);
    const environment: PedestrianEnvironment = { obstacles, groundAt: () => 5.2, water: [], bounds: {minX:400,maxX:1400,minZ:-800,maxZ:0} };
    for (const out of [-20, -62]) {
      const [x,,z] = palastFacadePoint(-1.5,0,out), top = friedrichstadtPalastTopAt(x,z)!;
      if (out === -62) {
        // The old 37.44 value was the former full coping slab. V274 retains
        // that rim height only on the corrected stage perimeter; this exact
        // interior point must stand on its rendered roof, not on the rim.
        const surface = stageSurfaceAt(x, z, mode === "minecraft");
        expect(surface).not.toBeNull();
        expect(top).toBeCloseTo(surface!, 4); // Packed Float32 transform precision.
      } else expect(top).toBeCloseTo(25.4, 6);
      expect(pedestrianPointIsBlocked(x,z,20,obstacles)).toBeTrue();
      expect(pedestrianPointIsBlocked(x,z,top,obstacles)).toBeFalse();
      const standing = createPedestrianState(environment,{x,z,yaw:0,groundYHint:top+1,preserveHorizontalPosition:true});
      expect(standing.groundY).toBeCloseTo(top,6);
    }
  });
  test("cold Minecraft and repeated mode switches select exactly one Palast", () => {
    const central = new Group();
    for (const mobile of [false,true]) {
      central.clear(); central.add(createFriedrichstadtAndTearPalaces(mobile ? "mobile" : "full"));
      for (const minecraft of [true,true,false,true,false]) {
        setFriedrichstadtMinecraftPresentation(central,minecraft);
        expect(central.getObjectByName(FRIEDRICHSTADT_PALAST_ROOT_NAME)!.visible).toBe(!minecraft);
        expect(central.getObjectByName(FRIEDRICHSTADT_PALAST_MINECRAFT_NAME)!.visible).toBe(minecraft);
        expect(central.getObjectByName(TEAR_PALACE_ROOT_NAME)!.visible).toBeTrue();
      }
    }
  });
});
