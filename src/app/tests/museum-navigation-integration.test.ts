import { describe, expect, test } from "bun:test";
import type { PrismPayload } from "../src/IsometricCityWorld";
import { PRISM_SUPPRESSED_IDS } from "../src/IsometricCityWorld";
import { compilePedestrianObstacles, createPedestrianState, pedestrianPointIsBlocked, pedestrianSpawnFromView, PEDESTRIAN_EYE_HEIGHT_M, type PedestrianEnvironment, type PedestrianPolygonObstacle } from "../src/pedestrianNavigation";
import { MUSEUM_TRIAD_SOURCES, MUSEUM_TRIAD_PRISM_IDS, MUSEUM_TRIAD_SOURCE, NATIONALGALERIE_FRAME, museumTriadPartRoofAt, nationalgaleriePorticoWalkableAt, nationalgaleriePorticoSolidAt, nationalgalerieWalkSurfaceAt } from "../src/museumTriadProfile";
import { DOM_ALTES_SOURCE, DOM_PROFILE, domRoofAt, domWorld, altesWorld, ALTES_PROFILE, domAltesExtraSolidAt, domAltesExtraGroundAt } from "../src/domAltesMuseumProfile";
import { DOM_ALTES_PRISM_IDS, DOM_ALTES_ARTWORK_KEYS } from "../src/domAltesMuseumIds";
import { createTiergartenMonuments } from "../src/TiergartenMonuments";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import type { StreetDetailsPayload } from "../src/TrafficSignals";

const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const obstacles = compilePedestrianObstacles(payload);
const polygons = [...new Set([...obstacles.cells.values()].flat())].filter((o): o is PedestrianPolygonObstacle => o.kind === "polygon");
const indexed = new Map(polygons.map(o => [o.sourceId, o]));
const sources = [...MUSEUM_TRIAD_SOURCES, DOM_ALTES_SOURCE.dom, DOM_ALTES_SOURCE.altes];
function gallery(u: number, v: number): [number, number] {
  const p = NATIONALGALERIE_FRAME, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return [p.x + c*u + s*v, p.z - s*u + c*v];
}
function environment(mode: "day"|"night"|"snowstorm"|"minecraft"|"schwellenraum"): PedestrianEnvironment {
  return { bounds: { minX: 1500, maxX: 2200, minZ: -400, maxZ: 200 }, groundAt: () => 5.2,
    obstacles, water: [], visualMode: () => mode,
    walkableInteriorAt: nationalgaleriePorticoWalkableAt,
    interiorSolidAt: (x,y,z,radius) => nationalgaleriePorticoSolidAt(x,z,y) || domAltesExtraSolidAt(x,y,z,radius),
    interiorGroundAt: (x,z,hint) => domAltesExtraGroundAt(x,z,hint ?? 5.2) ?? nationalgalerieWalkSurfaceAt(x,z),
  };
}
describe("new Museum Island architecture uses the real pedestrian index", () => {
  test("replaces the five coarse obstacles with every original measured part exactly once", () => {
    for (const id of [...MUSEUM_TRIAD_PRISM_IDS, ...DOM_ALTES_PRISM_IDS]) {
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBeTrue();
      expect(indexed.has(id)).toBeFalse();
    }
    for (const source of sources) for (const part of source.parts) {
      const obstacle = indexed.get(part.id)!;
      expect(obstacle).toBeDefined();
      expect(polygons.filter(p => p.sourceId === part.id)).toHaveLength(1);
      expect(obstacle.ring).toBe(part.ring);
      expect(obstacle.holes).toBe(part.holes);
      expect(obstacle.coordinateScale).toBe(1);
      expect(obstacle.topAt).toBeDefined();
    }
  });
  for (const mode of ["day","night","snowstorm","minecraft","schwellenraum"] as const) {
    test(`${mode}: open gallery portico and Altes colonnade keep their structural columns solid`, () => {
      const env = environment(mode);
      const between = gallery(-12.93,32.3), column = gallery(-15,32.3);
      expect(pedestrianPointIsBlocked(...between,13.54,obstacles,env)).toBeFalse();
      expect(pedestrianPointIsBlocked(...column,13.54,obstacles,env)).toBeTrue();
      const state = createPedestrianState(env,{x:between[0],z:between[1],yaw:0,groundYHint:13.54,preserveHorizontalPosition:true});
      expect(state.groundY).toBeCloseTo(13.54,4);
      const [x,,z] = altesWorld(-37.45,0,2.6), [cx,,cz] = altesWorld(-39.8,0,2.6);
      expect(pedestrianPointIsBlocked(x,z,ALTES_PROFILE.deck,obstacles,env)).toBeFalse();
      expect(pedestrianPointIsBlocked(cx,cz,ALTES_PROFILE.deck,obstacles,env)).toBeTrue();
    });
    test(`${mode}: switching from flight lands on the represented roof above the open portico`, () => {
      const env = environment(mode), [x,z] = gallery(-12.93,31.2);
      const top = museumTriadPartRoofAt(MUSEUM_TRIAD_SOURCE.nationalgalerie.parts[0],x,z)!;
      const spawn = pedestrianSpawnFromView(env,{x,y:5.2,z},{x,y:top+PEDESTRIAN_EYE_HEIGHT_M+.1,z},{x:0,y:0,z:-1});
      expect(spawn).not.toBeNull();
      const state = createPedestrianState(env,spawn!);
      expect(state.groundY).toBeCloseTo(top,3);
      expect(state.groundY).toBeGreaterThan(29);
      const [dx,,dz] = domWorld(DOM_PROFILE.domeLocal[0]+10,0,DOM_PROFILE.domeLocal[1]);
      const dome = indexed.get(DOM_ALTES_SOURCE.dom.parent_id)!;
      expect(dome.topAt!(dx,dz)).toBeCloseTo(domRoofAt(dx,dz)!,5);
      expect(dome.maxY).toBe(DOM_PROFILE.top);
    });
  }
  test("the dedicated bowl and riders replace their old generic artwork markers", async () => {
    const street = await Bun.file(new URL("../public/mesh/regierungsviertel/street-details.json",import.meta.url)).json() as StreetDetailsPayload;
    const ground = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json",import.meta.url)).json() as VoxelPayload;
    const monuments = street.monuments!.filter(p => DOM_ALTES_ARTWORK_KEYS.has(p.osm_key));
    expect(monuments).toHaveLength(3);
    expect(createTiergartenMonuments({...street,monuments},ground)).toBeNull();
  });
});
