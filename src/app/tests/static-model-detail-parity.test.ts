import { describe, expect, test } from "bun:test";
import type { Group } from "three";
import parkDetails from "../public/mesh/regierungsviertel/park-details.json";
import { createLenneOak, isLenneOakTree } from "../src/LenneOak";
import { decodeTrees, type ParkDetailsPayload } from "../src/ParkDetails";
import { createPotsdamerTrafficTower } from "../src/PotsdamerTrafficTower";
import { POTSDAMER_TOWER_DRAWN_NAME } from "../src/potsdamerTrafficTowerProfile";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import budgets from "./fixtures/static-model-full-budgets-v141.json";
import hashes from "./fixtures/static-model-full-hashes-v141.json";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

const profileEntries = [
  "BendlerblockDetails", "DiplomaticAndRobertKochDetails", "SocialCourtDetails",
  "CityWestDetails", "WilhelmStresemannDetails", "PotsdamerPlatzPublicRealm",
  "MoabitPrisonMemorialPark", "WeidendammerBridgeDetails",
  "KrolloperSculptureEnsemble", "FriedrichstadtPalast", "GropiusBauDetails",
  "AbgeordnetenhausDetails",
];
const payloadEntries = [
  "BellevueArchitecture", "BundesratArchitecture", "BoellStiftungArchitecture",
  "DeutschesTheater", "HumboldthafenBuildingDetails", "MuseumLenneArchitecture",
  "RohwedderHausArchitecture",
];
const optionEntries = [
  "BismarckMoltkeMonuments", "DbTowerArchitecture", "DomAltesMuseum",
  "EuropacityArchitecture", "FiftyHertzArchitecture", "FriedrichstrasseArchitecture",
  "LuisenCorridorArchitecture", "LitfinWatchtower", "MuseumTriadArchitecture",
  "TopographyTerrorArchitecture", "SachsenAnhaltFacade", "FederalStateRepresentations",
];
const moduleNames: Record<string, string> = {
  KrolloperSculptureEnsemble: "KrolloperSculptures",
  FriedrichstadtPalast: "FriedrichstadtPalastDetails",
  HumboldthafenBuildingDetails: "HumboldthafenBuildings",
};

describe("all devices retain the full authored static city detail", () => {
  test("Lenné-Eiche retains the full bark, foliage, plaque and snow geometry on touch", () => {
    const payload = parkDetails as unknown as ParkDetailsPayload;
    const tree = decodeTrees(payload.trees, payload.tree_vocabulary).find(isLenneOakTree)!;
    const full = createLenneOak(tree, "full"), mobile = createLenneOak(tree, "mobile");
    expect(staticGeometryAudit(mobile)).toEqual(staticGeometryAudit(full));
    disposeStaticAudit(full); disposeStaticAudit(mobile);
  });
  test("the traffic tower retains all full drawn subdivisions on touch", () => {
    const full = createPotsdamerTrafficTower(0, { mobileLike: false });
    const mobile = createPotsdamerTrafficTower(0, { mobileLike: true });
    expect(staticGeometryAudit(mobile.getObjectByName(POTSDAMER_TOWER_DRAWN_NAME)!))
      .toEqual(staticGeometryAudit(full.getObjectByName(POTSDAMER_TOWER_DRAWN_NAME)!));
    disposeStaticAudit(full); disposeStaticAudit(mobile);
  });
  for (const name of [...profileEntries, ...payloadEntries, ...optionEntries, "HistoricChariteCampus", "ParliamentArchitecture"]) {
    test(`${name}: touch matches every full vertex, instance, colour and world transform`, async () => {
      const module = await import(`../src/${moduleNames[name] ?? name}.ts`);
      const factory = module[`create${name}`];
      const make = (profile: "full" | "mobile"): Group => {
        const options = { mobileLike: profile === "mobile" };
        if (profileEntries.includes(name)) return factory(profile);
        if (payloadEntries.includes(name)) return factory(undefined, options);
        if (name === "HistoricChariteCampus") return factory(prisms, profile);
        if (name === "ParliamentArchitecture") return factory(prisms, options);
        return factory(options);
      };
      const full = make("full");
      const expected = staticGeometryAudit(full);
      const baseline = budgets[name as keyof typeof budgets];
      // These counts were measured from pre-restoration full geometry; matching
      // two equally simplified profiles would not satisfy this regression.
      expect(baseline).toBeDefined();
      expect(expected.budget).toEqual(baseline);
      expect(expected.hash).toBe(hashes[name as keyof typeof hashes]);
      expect(expected.budget.draws).toBeGreaterThan(0);
      disposeStaticAudit(full);
      const mobile = make("mobile");
      expect(staticGeometryAudit(mobile)).toEqual(expected);
      disposeStaticAudit(mobile);
    });
  }
});
