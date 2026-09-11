import type { Object3D } from "three";
import { POTSDAMER_TOWER_MINECRAFT_NAME } from "../../src/potsdamerTrafficTowerProfile";
import prisms from "../../public/mesh/regierungsviertel/lod2-prisms.json";

export const nativeModelCases = [
  ["AbgeordnetenhausDetails", "createMinecraftAbgeordnetenhausDetails", "profile"],
  ["GropiusBauDetails", "createMinecraftGropiusBauDetails", "profile"],
  ["MoabitPrisonMemorialPark", "createMoabitPrisonMemorialParkMinecraft", "profile"],
  ["WeidendammerBridgeDetails", "createWeidendammerBridgeMinecraft", "profile"],
  ["FriedrichstadtPalastDetails", "createMinecraftFriedrichstadtPalast", "profile"],
  ["BellevueArchitecture", "createMinecraftBellevueArchitecture", "payload"],
  ["BundesratArchitecture", "createMinecraftBundesratArchitecture", "payload"],
  ["BoellStiftungArchitecture", "createMinecraftBoellStiftungArchitecture", "payload"],
  ["DeutschesTheater", "createMinecraftDeutschesTheater", "payload"],
  ["HumboldthafenBuildings", "createHumboldthafenBuildingDetails", "payload"],
  ["MuseumLenneArchitecture", "createMinecraftMuseumLenneArchitecture", "payload"],
  ["RohwedderHausArchitecture", "createMinecraftRohwedderHausArchitecture", "payload"],
  ["BismarckMoltkeMonuments", "createMinecraftBismarckMoltkeMonuments", "options"],
  ["DbTowerArchitecture", "createMinecraftDbTowerArchitecture", "options"],
  ["DomAltesMuseum", "createMinecraftDomAltesMuseum", "options"],
  ["EuropacityArchitecture", "createEuropacityArchitecture", "options"],
  ["FiftyHertzArchitecture", "createMinecraftFiftyHertzArchitecture", "options"],
  ["FriedrichstrasseArchitecture", "createMinecraftFriedrichstrasseArchitecture", "options"],
  ["LuisenCorridorArchitecture", "createLuisenCorridorArchitecture", "options"],
  ["LitfinWatchtower", "createMinecraftLitfinWatchtower", "options"],
  ["MuseumTriadArchitecture", "createMinecraftMuseumTriadArchitecture", "options"],
  ["TopographyTerrorArchitecture", "createMinecraftTopographyTerrorArchitecture", "options"],
  ["SachsenAnhaltFacade", "createMinecraftSachsenAnhaltFacade", "options"],
  ["ParliamentArchitecture", "createMinecraftParliamentArchitecture", "prisms"],
  ["PotsdamerTrafficTower", "createPotsdamerTrafficTower", "traffic"],
] as const;

export function createNativeAuditModel(
  module: Record<string, any>, entry: typeof nativeModelCases[number],
  profile: "full" | "mobile",
): Object3D {
  const factory = module[entry[1]];
  const options = { mobileLike: profile === "mobile", minecraft: true };
  if (entry[2] === "profile") return factory(profile);
  if (entry[2] === "payload") return factory(undefined, options);
  if (entry[2] === "prisms") return factory(prisms, options);
  if (entry[2] === "traffic") {
    const root = factory(0, options);
    root.updateMatrixWorld(true);
    return root.getObjectByName(POTSDAMER_TOWER_MINECRAFT_NAME)!;
  }
  return factory(options);
}
