import { describe, expect, test } from "bun:test";
import { BUNDESRAT_IDS } from "../src/bundesratProfile";
import { ROHWEDDER_HAUS_IDS, ROHWEDDER_HAUS_SOURCE } from "../src/rohwedderHausProfile";
import { TOPOGRAPHY_TERROR_IDS, TOPOGRAPHY_TERROR_SOURCE, topographySiteSurfaceAt } from "../src/topographyTerrorProfile";
import { topographyAuthoredSolids } from "../src/TopographyTerrorArchitecture";
import { createPedestrianEnvironment, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import { splitProgressiveBuildings, DESKTOP_INITIAL_BUILDING_COUNT, MOBILE_INITIAL_BUILDING_COUNT } from "../src/progressiveWorld";
import { PRISM_SUPPRESSED_IDS, type PrismPayload } from "../src/IsometricCityWorld";
import { SCHWELLENRAUM_PROTECTED_VOLUMES, schwellenraumProtectedVolumeAt } from "../src/SchwellenraumInteriors";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import sourceJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import groundJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";
const source = sourceJson as unknown as PrismPayload;
const ground = groundJson as unknown as VoxelPayload;
const ids = new Set([...BUNDESRAT_IDS, ...ROHWEDDER_HAUS_IDS, ...TOPOGRAPHY_TERROR_IDS]);
const subset = { buildings: source.buildings.filter(p => ids.has(p.id)) };

describe("Rohwedder, Bundesrat and Topography production integration", () => {
  for (const count of [MOBILE_INITIAL_BUILDING_COUNT, DESKTOP_INITIAL_BUILDING_COUNT]) {
    test(`all 30 source parts arrive in the initial ${count}-building shell budget`, () => {
      const partition = splitProgressiveBuildings(source.buildings, count);
      const initial = new Set(partition.initial.map(p => p.id));
      expect(ids.size).toBe(30);
      for (const id of ids) expect(initial.has(id)).toBeTrue();
      expect(partition.initial).toHaveLength(count);
      expect(partition.initial.length + partition.remaining.flat().length + partition.omitted.length).toBe(source.buildings.length);
    });
  }
  test("replaces Topography bodies while retaining ministry and Bundesrat envelopes", () => {
    for (const id of TOPOGRAPHY_TERROR_IDS) expect(PRISM_SUPPRESSED_IDS.has(id)).toBeTrue();
    for (const id of [...BUNDESRAT_IDS, ...ROHWEDDER_HAUS_IDS]) expect(PRISM_SUPPRESSED_IDS.has(id)).toBeFalse();
  });
  test("site platforms support walking without filling the court or blocking open grounds", () => {
    const env = createPedestrianEnvironment(ground, { water: [] }, null, subset);
    expect(topographySiteSurfaceAt(850, 1380)).toBeCloseTo(5.6);
    expect(env.groundAt(850, 1380)).toBeCloseTo(5.6);
    expect(pedestrianPointIsBlocked(850, 1380, 5.6, env.obstacles)).toBeFalse();
    expect(topographySiteSurfaceAt(800, 1380)).toBeNull();
    expect(env.groundAt(800, 1380)).toBeCloseTo(3.525);
    expect(pedestrianPointIsBlocked(800, 1380, 3.4, env.obstacles)).toBeFalse();
    expect(pedestrianPointIsBlocked(780, 1370, 6, env.obstacles)).toBeTrue();
  });
  test("entrance fence and surviving Wall have finite matching collision", () => {
    const env = createPedestrianEnvironment(ground, { water: [] }, null, subset);
    const [a,b] = ROHWEDDER_HAUS_SOURCE.entranceFence.points;
    const x = (a[0]+b[0])/2, z = (a[1]+b[1])/2;
    expect(pedestrianPointIsBlocked(x,z,5.2,env.obstacles)).toBeTrue();
    expect(pedestrianPointIsBlocked(x,z,10,env.obstacles)).toBeFalse();
    const panel = topographyAuthoredSolids().find(s => s.role === "preserved concrete Wall panel")!;
    expect(panel).toBeDefined();
    expect(pedestrianPointIsBlocked(panel.x,panel.z,panel.y-panel.height/2+.1,env.obstacles)).toBeTrue();
    expect(pedestrianPointIsBlocked(panel.x,panel.z,panel.y+panel.height/2+.4,env.obstacles)).toBeFalse();
  });
  test("the protected memorial area follows the entire mapped site", () => {
    const volume = SCHWELLENRAUM_PROTECTED_VOLUMES.find(v => v.id === "protected-topography-of-terror");
    expect(volume).toMatchObject({ shape: "polygon", ringWorldM: TOPOGRAPHY_TERROR_SOURCE.site.ring });
    expect(schwellenraumProtectedVolumeAt(840,6,1400)?.id).toBe(volume?.id);
    expect(schwellenraumProtectedVolumeAt(930,6,1490)?.id).toBe(volume?.id);
    expect(schwellenraumProtectedVolumeAt(680,6,1490)?.id).not.toBe(volume?.id);
  });
});
