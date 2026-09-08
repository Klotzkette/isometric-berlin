import { describe, expect, test } from "bun:test";
import { Group } from "three";
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
const payload = source as unknown as PrismPayload;

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
      expect(top).toBeCloseTo(out === -62 ? 37.44 : 25.4, 6);
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
