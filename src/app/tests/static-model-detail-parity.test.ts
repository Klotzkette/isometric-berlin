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
import overridesV148 from "./fixtures/static-model-full-overrides-v148.json";
import overridesV151 from "./fixtures/static-model-full-overrides-v151.json";
import overridesV153 from "./fixtures/static-model-full-overrides-v153.json";
import overridesV154 from "./fixtures/static-model-full-overrides-v154.json";
import overridesV155 from "./fixtures/static-model-full-overrides-v155.json";
import overridesV157 from "./fixtures/static-model-full-overrides-v157.json";
import overridesV164 from "./fixtures/static-model-full-overrides-v164.json";
import overridesV147 from "./fixtures/static-model-full-overrides-v147.json";
import overridesV146 from "./fixtures/static-model-full-overrides-v146.json";
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
      // Keep v141 frozen. The source-verified v146 correction replaces the
      // wrongly attributed postwar Virology grid with the historic Ruska facade.
      // v147 adds the requested museum ornament while preserving source shells.
      // v148 refines only the Altes Ionic order and two bronze groups; older
      // fixtures stay frozen and every unrelated model retains its previous hash.
      // v151 refines the Czech Embassy and HIT Ullrich only. All earlier
      // fixtures remain frozen; every unrelated model keeps its previous hash.
      // v153 refines only the requested Gedächtniskirche ensemble. Its new
      // full/mobile hashes were measured independently; older fixtures stay frozen.
      // v154 corrects the same church's silhouette and actual openings; exact
      // deduplication changes storage without removing any authored surface.
      // v155 adds clock numerals, capitals and copper joints to this church;
      // all earlier fixtures remain frozen and unrelated hashes still match.
      // v157 refines the requested Moabit memorial park and opens two mapped
      // entrances previously closed by its continuous source-wall polyline.
      // v164 records the already-released v160 MuseumLenneArchitecture and v161
      // CityWestDetails additions omitted from this older audit. Their factories
      // and runtime dependencies are byte-identical to HEAD; no v164 geometry
      // change is accepted here. Keep every earlier fixture frozen. See the
      // independent source/hash audit in docs/static-model-v164-baseline.md.
      const override = overridesV164[name as keyof typeof overridesV164] ?? overridesV157[name as keyof typeof overridesV157] ?? overridesV155[name as keyof typeof overridesV155] ?? overridesV154[name as keyof typeof overridesV154] ?? overridesV153[name as keyof typeof overridesV153] ?? overridesV151[name as keyof typeof overridesV151] ?? overridesV148[name as keyof typeof overridesV148] ?? overridesV147[name as keyof typeof overridesV147] ?? overridesV146[name as keyof typeof overridesV146];
      const baseline = override?.budget ?? budgets[name as keyof typeof budgets];
      // These counts were measured from pre-restoration full geometry; matching
      // two equally simplified profiles would not satisfy this regression.
      expect(baseline).toBeDefined();
      expect(expected.budget).toEqual(baseline);
      expect(expected.hash).toBe(override?.hash ?? hashes[name as keyof typeof hashes]);
      expect(expected.budget.draws).toBeGreaterThan(0);
      disposeStaticAudit(full);
      const mobile = make("mobile");
      expect(staticGeometryAudit(mobile)).toEqual(expected);
      disposeStaticAudit(mobile);
    });
  }
});
