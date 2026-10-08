import { interleaveStaticGeometry, interleaveStaticGeometrySteps } from "../src/interleaveStaticGeometry";
import { expect, test } from "bun:test";
import ts from "typescript";
import {
  BoxGeometry, Group, InstancedMesh, Line, LineSegments, Material, Mesh,
  MeshBasicMaterial, Points, Scene, Texture,
} from "three";
import { completeCooperatively } from "../src/cooperativeWork";
import { compactStaticGeometrySteps } from "../src/compactStaticGeometry";
import { objectMaterialsIncludingTransferredAlternates } from "../src/transferableObject3D";
import {
  createMinecraftMaterialState, releaseMinecraftMaterialBindings,
} from "../src/visual-modes/minecraft/materialMode";

const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
const names = ["ensureIsoWorld", "captureMutableRootSnapshots", "rollbackMutableRoots", "disposeObject3D"];
const parsed = ts.createSourceFile("ThreeViewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = names.map(name => {
  const node = parsed.statements.find(entry => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
  if (!node) throw new Error(`Missing production function ${name}`);
  return node.getText(parsed).replace(/^export\s+/, "")
    .replace(/import\("(\.\/[^\"]+)"\)/g, "loadAddon(\"$1\")")
    .replaceAll("import.meta.env.DEV", "false");
});
const compiled = ts.transpileModule(declarations.join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

// Execute the production transaction and disposal. Only model constructors,
// downloading and unrelated presentation hooks are replaced by bounded fixtures.
function host(options: { stopAtTask?: number; stopAfterModel?: string; modeAtTask?: number; failCommit?: boolean; initialWater?: boolean } = {}) {
  const built: Mesh[] = [];
  const disposed = new Map<Mesh, number>();
  const warnings: string[] = [];
  const existing = new Group(); existing.name = "existing signature";
  const concurrent = new Group(); concurrent.name = "independently loaded signature";
  let taskCount = 0;
  let ready = 0;
  let reported = 0;
  let pose = 0;
  let savedPose = -1;
  let releaseCount = 0;
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const loadController = new AbortController();
  const runtime = {
    disposed: false, loadSignal: loadController.signal,
    worldFailureReported: false, isoWorldState: "idle", coarsePointer: true,
    lightingMode: "schwellenraum", nightLightsOn: true, underside: false,
    scene: new Scene(), isoWorld: null as Group | null,
    schwellenraumTowerSteam: null as Mesh | null, schwellenraumTowerSteamElapsedSeconds: 4.75,
    signatures: new Group(), cityStaffage: new Group(), undergroundNetwork: new Group(),
    tramCatenary: new Group(), schwellenraumPraesentation: new Group(),
    schwellenraumWorldDetailsInstaller: null, tunnelPortalCourse: null,
    controls: { target: { x: 0, z: 0 } }, camera: {},
    pedestrian: { environment: null, requested: false },
    minecraftMaterialState: createMinecraftMaterialState(),
    progressiveWorldBatches: [], progressiveWorldState: "idle", progressiveWorldInput: undefined,
    reportCoreProgress: () => {}, startDeferredDetails: () => {},
    reportWorldFailure: () => { reported++; },
    gpuWarmup: { release: () => { releaseCount++; } },
  };
  runtime.signatures.add(existing);
  runtime.scene.add(runtime.signatures, runtime.cityStaffage, runtime.undergroundNetwork,
    runtime.tramCatenary, runtime.schwellenraumPraesentation);
  function model(name: string) {
    const group = new Group(); group.name = name;
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    mesh.name = name;
    mesh.geometry.userData.exactIndexPending = true;
    mesh.geometry.addEventListener("dispose", () => disposed.set(mesh, (disposed.get(mesh) ?? 0) + 1));
    built.push(mesh); group.add(mesh);
    return group;
  }
  const modules = {
    "./ConcertHalls": { createConcertHalls: () => model("Kulturforum concert halls") },
    "./KulturforumMuseums": { createKulturforumMuseums: () => model("Kulturforum museums") },
    "./HbfNorthApproach": { createHbfNorthApproach: () => model("Hbf northern railway approach") },
    "./BreitscheidTowers": { createBreitscheidTowers: () => model("Breitscheid towers") },
    "./WestSquaresV163": { createWestSquaresV163: () => model("West squares v163") },
    "./EastSquaresV163": { createEastSquaresV163: () => model("East squares v163") },
    "./HackescherMarktV163": { createHackescherMarktV163: () => model("Hackescher Markt v163") },
    "./CafeNeuerSeeV164": { createCafeNeuerSeeV164: () => model("Cafe Neuer See v164") },
    "./UpbeatV166FacadeDetails": { createUpbeatV166FacadeDetails: () => model("Upbeat facade v166") },
    "./AlexanderNorthV166": { createAlexanderNorthV166: () => model("Alexander north v166") },
    "./CityWestCinemasV166": { createCityWestCinemasV166: () => model("City West cinemas v166") },
    "./MoabitJusticeV166": { createMoabitJusticeV166: () => model("Moabit justice v166") },
    "./MitteHeritageV166": { createMitteHeritageV166: () => model("Mitte heritage v166") },
    "./KosmosV166": { createKosmosV166: () => model("Kosmos v166") },
    "./NeueSynagogeV167": { createNeueSynagogeV167: () => model("Neue Synagoge v167") },
    "./TachelesV167": { createTachelesV167: () => model("Tacheles v167") },
    "./MonbijouBathV167": { createMonbijouBathV167: () => model("Monbijou bath v167") },
    "./HumboldtMainV168Details": { createHumboldtMainV168Details: () => model("HU detail v168") },
    "./TeehausRuinV168": { createTeehausRuinV168: () => model("Teehaus ruin v168") },
    "./TuWaterV168": { createTuWaterV168: () => model("TU water v168") },
    "./AltMitteDrawnCoreV169": {
      buildAltMitteCoreV169Steps: function* () {
        yield;
        return model("Alt-Mitte resident core v169");
      },
    },
    "./BndHeadquartersV174": { createBndHeadquartersV174: () => model("BND headquarters v174") },
    "./WeinbergPlaygroundV174": { createWeinbergPlaygroundV174: () => model("Weinberg playground v174") },
    "./ZionskirchplatzV175": { createZionskirchplatzV175: () => model("Zionskirchplatz frontages v175") },
    "./ZionskircheV174": { createZionskircheV174: () => model("Zionskirche v174") },
    "./BerlinWallMemorialV174": { createBerlinWallMemorialV174: () => model("Berlin Wall memorial v174") },
    "./ZooGroundsV165": { createZooGroundsV165: () => model("Zoo grounds v165") },
    "./KranzlerV165": { createKranzlerV165: () => model("Kranzler v165") },
    "./ZooStationV165": { createZooStationV165: () => model("Zoo station v165") },
    "./HuthmacherHaus": { createHuthmacherHaus: () => model("Huthmacher house v165") },
    "./SpanishEmbassyV164": { createSpanishEmbassyV164: () => model("Spanish embassy v164") },
    "./GrosserSternGatehousesV164": { createGrosserSternGatehousesV164: () => model("Grosser Stern gatehouses v164") },
    "./UlapQuarter": { createUlapQuarter: () => model("ULAP quarter") },
    "./MoabitGuardHouses": { createMoabitGuardHouses: () => model("Moabit officers houses") },
    "./UlapPark": { createUlapPark: () => model("ULAP park") },
    "./BikiniBerlin": { createBikiniBerlin: () => model("Bikini source architecture") },
    "./LeipzigerPlatzSourceShells": { createLeipzigerPlatzSourceShells: () => model("Leipziger source shells") },
    "./LeipzigerPerimeterFacades": { createLeipzigerPerimeterFacades: () => model("Leipziger perimeter facades") },
    "./PotsdamerMinistryArchitecture": { createPotsdamerMinistryArchitecture: () => model("Potsdamer ministry architecture") },
    "./EastCivicArchitecture": { createEastCivicArchitecture: () => model("East civic") },
    "./DhmArchitecture": { createDhmArchitecture: () => model("DHM") },
    "./RussianEmbassySourceGeometry": { createRussianEmbassySourceGeometry: () => model("Russian embassy source") },
    "./SchlossEastOutlines": { createSchlossEastOutlines: () => model("East outlines") },
    "./SchlossEastStreets": { createSchlossEastStreets: () => model("East streets") },
    "./FernsehturmArchitecture": { createFernsehturmArchitecture: () => model("Detailed Fernsehturm") },
    "./AlexanderCivicArchitecture": { createAlexanderCivicArchitecture: () => model("Alexander civic") },
    "./AlexanderPublicRealm": { createAlexanderPublicRealm: () => model("Alexander public realm") },
    "./PalacesAndFriedrich": { createPalacesAndFriedrich: () => model("Eastern palais") },
    "./JamesSimonArchitecture": { createJamesSimonArchitecture: () => model("James-Simon") },
    "./KomischeOperSourceGeometry": { createKomischeOperSourceGeometry: () => model("Komische Oper") },
    "./UnterDenLindenEntrances": { createUnterDenLindenEntrances: () => model("U-Bahn entrances") },
    "./SpreeMuseumDetails": { createSpreeMuseumDetails: () => model("Spree") },
    "./UnterDenLindenDetails": { createUnterDenLindenDetails: () => model("Unter den Linden") },
    "./AbgeordnetenhausDetails": { createAbgeordnetenhausDetails: () => model("Abgeordnetenhaus") },
    "./GropiusBauDetails": { createGropiusBauDetails: () => model("Gropius Bau") },
    "./GendarmenmarktPerimeterShells": {
      createGendarmenmarktPerimeterShells: () => model("Gendarmenmarkt perimeter shells"),
      createGendarmenmarktPerimeterFacades: () => model("Gendarmenmarkt perimeter facades"),
    },
  };
  const expectedImports = [...declarations[0].matchAll(/loadAddon\("([^"]+)"\)/g)].map(match => match[1]);
  expect(Object.keys(modules).sort()).toEqual(expectedImports.sort());
  const bindings = {
    interleaveStaticGeometry,
    interleaveStaticGeometrySteps,
    completedPedestrianWater: () => {},
    Group, Mesh, InstancedMesh, Line, LineSegments, Material, Points, Texture,
    createSchwellenraumTowerSteam: () => model("Tower rose steam").children[0],
    updateSchwellenraumTowerSteam: () => {},
    objectMaterialsIncludingTransferredAlternates, releaseMinecraftMaterialBindings,
    compactStaticGeometrySteps,
    completeCooperatively: (steps: Generator<void, unknown>, config: Parameters<typeof completeCooperatively>[1]) =>
      completeCooperatively(steps, { ...config, budgetMs: 0 }),
    yieldStartupWork: async () => {
      taskCount++;
      // No incomplete geometry or prepared addon is visible between tasks.
      expect(runtime.isoWorld).toBeNull();
      expect(runtime.signatures.children.every(child => child === existing || child === concurrent)).toBeTrue();
      pose++;
      if (taskCount === 2) runtime.signatures.add(concurrent);
      if (taskCount === options.stopAtTask ||
          (options.stopAfterModel && built.some(mesh => mesh.name === options.stopAfterModel))) {
        runtime.disposed = true;
        runtime.worldFailureReported = true;
        loadController.abort();
      }
      if (taskCount === options.modeAtTask) runtime.lightingMode = "minecraft";
    },
    loadAddon: (path: keyof typeof modules) => {
      if (!modules[path]) throw new Error(`Missing lifecycle fixture for production addon ${path}`);
      return Promise.resolve(modules[path]);
    },
    fetchPrismPayload: async () => ({ buildings: [] }),
    fetchGroundPayload: async () => null, fetchStreetPayload: async () => null,
    fetchSurfacePayload: async () => null, fetchRailPayload: async () => null,
    isoWorldIntentActive: () => runtime.lightingMode !== "minecraft",
    createSchwellenraumMemorialProtectionIndex: () => ({}),
    splitProgressiveBuildings: () => ({ initial: [], remaining: [], omitted: [] }),
    buildingDetailProfile: () => ({ batchSize: 240 }),
    buildingDetailDistricts: () => [], selectBuildingDetailDistricts: () => [], buildingDetailViewPoints: () => [],
    createIsometricCity: (_prisms: unknown, _ground: unknown, _tunnel: unknown, _surfaces: unknown, buildOptions: { includeAltMitteCoreV169: boolean }) => {
      expect(buildOptions.includeAltMitteCoreV169).toBe(false);
      const city = model("core"); city.add(model("drawn bridge structures")); return city;
    },
    createInitialDrawnWater: () => options.initialWater ? model("source-bound drawn water") : null,
    createSchlossNaturkundeShells: () => model("Schloss and Naturkunde shells"),
    createSchlossNaturkundeFacades: () => model("Schloss and Naturkunde facades"),
    createGendarmenmarktShells: () => model("Gendarmenmarkt shells"),
    createGendarmenmarktArchitecture: () => model("Gendarmenmarkt architecture"),
    createGorkiBuilding: () => model("Gorki building"),
    createGripsHansaplatz: () => model("GRIPS and Hansaplatz court"),
    createGymnasiumTiergartenNeubau: () => model("Gymnasium Tiergarten Neubau"),
    createBehren42Architecture: () => model("Behrenstrasse 42 architecture"),
    createNeueWache: () => model("Neue Wache"),
    createBebelplatzBuildingShells: () => model("Bebelplatz shells"),
    createProgressiveBuildingCoverage: () => model("coverage"),
    setWeidendammerBridgePresentation: () => {}, setSandkrugBridgePresentation: () => {},
    capturePedestrianAttachment: () => { savedPose = pose; return { underside: false, pose }; },
    restorePedestrianAttachment: (_: unknown, snapshot: { pose: number }) => { pose = snapshot.pose; },
    captureProgressiveWorld: () => ({}), restoreProgressiveWorld: () => {},
    collectFarZoomAntiFlickerTargets: () => {},
    setSceneLighting: () => { if (options.failCommit) throw new Error("commit failed"); },
    markSurfaceInteraction: () => {}, applyProgressiveWorldMode: () => {},
    releaseBuiltWorldPayloads: () => {}, releaseFailedWorldPayloads: () => {},
    notifyPresentationReadyWhenPossible: () => { ready++; },
    invalidateScenePresentation: () => {}, restoreWorldPresentationAfterRollback: () => {},
    performance: { mark: () => {} },
    MOBILE_INITIAL_BUILDING_COUNT: 1, DESKTOP_INITIAL_BUILDING_COUNT: 1,
    MOBILE_DETAIL_BATCH_SIZE: 1, DESKTOP_TOTAL_BUILDING_LIMIT: Infinity,
  };
  // The production loader intentionally returns void. A settled promise task
  // runs after its private chain's success/catch without exposing production APIs.
  const nativeAll = Promise.all.bind(Promise);
  const promise = {
    all: (values: Promise<unknown>[]) => ({
      then: (callback: (values: unknown[]) => unknown) => ({
        catch: (onError: (error: unknown) => void) => {
          void nativeAll(values).then(callback).catch(onError).finally(finish);
        },
      }),
    }),
  };
  const functions = new Function(...Object.keys(bindings), "Promise", `${compiled}; return { start: ensureIsoWorld, dispose: disposeObject3D };`)(
    ...Object.values(bindings), promise,
  );
  functions.start(runtime, (warning: string) => warnings.push(warning));
  return { finished, runtime, built, disposed, warnings, existing, concurrent,
    disposeScene: () => functions.dispose(runtime, runtime.scene),
    get taskCount() { return taskCount; }, get ready() { return ready; },
    get reported() { return reported; }, get pose() { return pose; },
    get savedPose() { return savedPose; }, get releaseCount() { return releaseCount; } };
}

test("drawn construction publishes all staged geometry at the current pose", async () => {
  const h = host(); await h.finished;
  expect(h.taskCount).toBeGreaterThan(6);
  // Explicit names check ownership and duplicate construction, rather than a
  // magic total which could hide a missing recent source-bound layer.
  const expectedNames = [
    "core", "drawn bridge structures", "Gendarmenmarkt shells", "Gendarmenmarkt architecture",
    "Gendarmenmarkt perimeter shells", "Gendarmenmarkt perimeter facades",
    "Leipziger source shells", "Leipziger perimeter facades", "Potsdamer ministry architecture",
    "Bikini source architecture", "Breitscheid towers", "West squares v163", "East squares v163",
    "Hackescher Markt v163", "Cafe Neuer See v164",
    "Upbeat facade v166", "Alexander north v166", "City West cinemas v166",
    "Moabit justice v166", "Mitte heritage v166", "Kosmos v166",
    "Neue Synagoge v167", "Tacheles v167", "Monbijou bath v167", "HU detail v168", "Teehaus ruin v168", "TU water v168", "Alt-Mitte resident core v169",
    "BND headquarters v174", "Weinberg playground v174", "Zionskirchplatz frontages v175", "Zionskirche v174", "Berlin Wall memorial v174",
    "Zoo grounds v165", "Kranzler v165", "Zoo station v165",
    "Huthmacher house v165",
    "Spanish embassy v164", "Grosser Stern gatehouses v164",
    "Moabit officers houses", "ULAP quarter", "Kulturforum concert halls", "Kulturforum museums",
    "Gorki building", "GRIPS and Hansaplatz court", "Gymnasium Tiergarten Neubau",
    "Behrenstrasse 42 architecture", "Neue Wache", "Schloss and Naturkunde shells",
    "Schloss and Naturkunde facades", "Bebelplatz shells", "coverage", "Komische Oper", "East civic",
    "DHM", "Russian embassy source", "East outlines", "Detailed Fernsehturm", "Tower rose steam",
    "Alexander civic", "Alexander public realm", "U-Bahn entrances", "Eastern palais",
    "James-Simon", "Spree", "Unter den Linden", "Abgeordnetenhaus", "Gropius Bau",
  ];
  expect(h.built.map(mesh => mesh.name).sort()).toEqual([...expectedNames].sort());
  // Pin the actual construction order as well as complete ownership. Existing
  // stages retain their relative order around the v165–v168 additions.
  const heroStageOrder = [
    "Breitscheid towers", "West squares v163", "East squares v163",
    "Hackescher Markt v163", "Cafe Neuer See v164", "Upbeat facade v166",
    "Alexander north v166", "City West cinemas v166", "Moabit justice v166",
    "Mitte heritage v166", "Kosmos v166", "Neue Synagoge v167",
    "Tacheles v167", "Monbijou bath v167", "HU detail v168", "Teehaus ruin v168", "TU water v168",
    "BND headquarters v174", "Weinberg playground v174", "Zionskirchplatz frontages v175", "Zionskirche v174", "Berlin Wall memorial v174", "Alt-Mitte resident core v169", "Zoo grounds v165",
    "Kranzler v165", "Zoo station v165", "Huthmacher house v165",
    "Spanish embassy v164", "Grosser Stern gatehouses v164",
  ];
  expect(h.built.map(mesh => mesh.name).filter(name => heroStageOrder.includes(name))).toEqual(heroStageOrder);
  for (const name of expectedNames) {
    const owner = name === "drawn bridge structures" ? h.runtime.signatures : h.runtime.isoWorld;
    expect(owner?.getObjectByName(name)).toBeDefined();
  }
  expect(h.runtime.isoWorld?.getObjectByName("Leipziger source shells")).toBeDefined();
  expect(h.runtime.isoWorld?.getObjectByName("Potsdamer ministry architecture")).toBeDefined();
  expect(h.runtime.isoWorld?.getObjectByName("Bikini source architecture")).toBeDefined();
  expect(h.disposed.size).toBe(0);
  expect(h.runtime.isoWorld?.parent).toBe(h.runtime.scene);
  expect(h.runtime.schwellenraumTowerSteam?.parent).toBe(h.runtime.isoWorld);
  expect(h.runtime.signatures.getObjectByName("drawn bridge structures")).toBeDefined();
  expect(h.runtime.signatures.children).toContain(h.concurrent);
  expect(h.pose).toBe(h.savedPose);
  expect(h.ready).toBe(1); expect(h.warnings).toHaveLength(0);
});

test("context loss cancels later allocations and frees every unpublished buffer", async () => {
  const h = host({ stopAtTask: 4 }); await h.finished;
  expect(h.built.length).toBeGreaterThan(0); expect(h.built.length).toBeLessThan(17);
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.runtime.signatures.children).toEqual([h.existing, h.concurrent]);
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual(h.built.map(() => 1));
  expect(h.releaseCount).toBeGreaterThan(0);
  expect(h.ready).toBe(0); expect(h.reported).toBe(0); expect(h.warnings).toHaveLength(0);
});

test("mobile water is owned before its yield and disposed when construction is cancelled", async () => {
  const h = host({ initialWater: true, stopAfterModel: "source-bound drawn water" });
  await h.finished;
  expect(h.built.some(mesh => mesh.name === "source-bound drawn water")).toBeTrue();
  expect(h.built.some(mesh => mesh.name === "Gendarmenmarkt shells")).toBeFalse();
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual(h.built.map(() => 1));
  expect(h.ready).toBe(0); expect(h.warnings).toHaveLength(0);
});

test("the mobile water phase is published with the complete drawn world", async () => {
  const h = host({ initialWater: true }); await h.finished;
  expect(h.runtime.isoWorld?.getObjectByName("source-bound drawn water")).toBeDefined();
  expect(h.disposed.size).toBe(0);
  expect(h.ready).toBe(1); expect(h.warnings).toHaveLength(0);
});

test("cancellation after school construction releases its staged buffers and stops the next addon", async () => {
  const h = host({ stopAfterModel: "Gymnasium Tiergarten Neubau" }); await h.finished;
  expect(h.built.some(mesh => mesh.name === "Gymnasium Tiergarten Neubau")).toBeTrue();
  expect(h.built.some(mesh => mesh.name === "Behrenstrasse 42 architecture")).toBeFalse();
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual(h.built.map(() => 1));
  expect(h.runtime.signatures.children).toEqual([h.existing, h.concurrent]);
  expect(h.ready).toBe(0); expect(h.reported).toBe(0); expect(h.warnings).toHaveLength(0);
});

test("an already retired context cannot start allocating the drawn city", async () => {
  const h = host({ stopAtTask: 1 }); await h.finished;
  expect(h.built).toHaveLength(0);
  expect(h.runtime.signatures.children).toEqual([h.existing]);
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.ready).toBe(0); expect(h.reported).toBe(0);
});

test("a family change cancels the unpublished city and keeps the newer camera pose", async () => {
  const h = host({ modeAtTask: 4 }); await h.finished;
  expect(h.runtime.isoWorldState).toBe("idle"); expect(h.runtime.isoWorld).toBeNull();
  expect(h.savedPose).toBe(-1); expect(h.pose).toBe(4);
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual(h.built.map(() => 1));
  expect(h.runtime.signatures.children).toEqual([h.existing, h.concurrent]);
  expect(h.reported).toBe(0); expect(h.warnings).toHaveLength(0);
});

test("commit rollback preserves independently loaded siblings and frees moved addons once", async () => {
  const h = host({ failCommit: true }); await h.finished;
  expect(h.runtime.isoWorldState).toBe("failed"); expect(h.runtime.isoWorld).toBeNull();
  expect(h.runtime.signatures.children).toEqual([h.existing, h.concurrent]);
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual(h.built.map(() => 1));
  expect(h.pose).toBe(h.savedPose);
  expect(h.reported).toBe(1); expect(h.warnings).toHaveLength(1);
});

test("cancelled tower construction releases its smoke field without publishing a runtime reference", async () => {
  const h = host({ stopAfterModel: "Tower rose steam" });
  await h.finished;
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.runtime.schwellenraumTowerSteam).toBeNull();
  const steam = h.built.find(mesh => mesh.name === "Tower rose steam");
  expect(steam).toBeDefined();
  expect(h.disposed.get(steam!)).toBe(1);
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual(h.built.map(() => 1));
  expect(h.warnings).toHaveLength(0);
});

test("failed scene publication rolls back the tower steam pointer with its world", async () => {
  const h = host({ failCommit: true });
  await h.finished;
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.runtime.schwellenraumTowerSteam).toBeNull();
  const steam = h.built.find(mesh => mesh.name === "Tower rose steam");
  expect(steam).toBeDefined();
  expect(h.disposed.get(steam!)).toBe(1);
});


test("world release clears the published steam pointer and disposes its buffers once", async () => {
  const h = host();
  await h.finished;
  const steam = h.runtime.schwellenraumTowerSteam!;
  expect(steam).toBeInstanceOf(Mesh);
  let materialDisposals = 0;
  (steam.material as Material).addEventListener("dispose", () => materialDisposals++);
  h.disposeScene();
  expect(h.runtime.schwellenraumTowerSteam).toBeNull();
  expect(h.disposed.get(steam)).toBe(1);
  expect(materialDisposals).toBe(1);
});

// Cancellation is exercised at each added v160–v168 constructor boundary.
// Every fixture owns a real tiny buffer but no full architectural model runs.
for (const [stop, next] of [
  ["Breitscheid towers", "West squares v163"],
  ["West squares v163", "East squares v163"],
  ["East squares v163", "Hackescher Markt v163"],
  ["Hackescher Markt v163", "Cafe Neuer See v164"],
  ["Cafe Neuer See v164", "Upbeat facade v166"],
  ["Upbeat facade v166", "Alexander north v166"],
  ["Alexander north v166", "City West cinemas v166"],
  ["City West cinemas v166", "Moabit justice v166"],
  ["Moabit justice v166", "Mitte heritage v166"],
  ["Mitte heritage v166", "Kosmos v166"],
  ["Kosmos v166", "Neue Synagoge v167"],
  ["Neue Synagoge v167", "Tacheles v167"],
  ["Tacheles v167", "Monbijou bath v167"],
  ["Monbijou bath v167", "HU detail v168"],
  ["HU detail v168", "Teehaus ruin v168"],
  ["Teehaus ruin v168", "TU water v168"],
  ["TU water v168", "BND headquarters v174"],
  ["BND headquarters v174", "Weinberg playground v174"],
  ["Weinberg playground v174", "Zionskirchplatz frontages v175"],
  ["Zionskirchplatz frontages v175", "Zionskirche v174"],
  ["Zionskirche v174", "Berlin Wall memorial v174"],
  ["Berlin Wall memorial v174", "Alt-Mitte resident core v169"],
  ["Alt-Mitte resident core v169", "Zoo grounds v165"],
  ["Zoo grounds v165", "Kranzler v165"],
  ["Kranzler v165", "Zoo station v165"],
  ["Zoo station v165", "Huthmacher house v165"],
  ["Huthmacher house v165", "Spanish embassy v164"],
  ["Spanish embassy v164", "Grosser Stern gatehouses v164"],
  ["Grosser Stern gatehouses v164", "Moabit officers houses"],
  ["Kulturforum concert halls", "Kulturforum museums"],
  ["Kulturforum museums", "Gorki building"],
]) {
  test(`cancellation after ${stop} frees its owned buffers before ${next}`, async () => {
    const h = host({ stopAfterModel: stop }); await h.finished;
    expect(h.built.some(mesh => mesh.name === stop)).toBeTrue();
    expect(h.built.some(mesh => mesh.name === next)).toBeFalse();
    expect(h.runtime.isoWorld).toBeNull();
    expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual(h.built.map(() => 1));
    expect(h.runtime.signatures.children).toEqual([h.existing, h.concurrent]);
    expect(h.ready).toBe(0); expect(h.reported).toBe(0); expect(h.warnings).toHaveLength(0);
  });
}


test("Alt-Mitte resident core is staged once before publication and cancelled ownership is released", async () => {
  const h = host({ stopAfterModel: "Alt-Mitte resident core v169" });
  await h.finished;
  expect(h.built.filter(mesh => mesh.name === "Alt-Mitte resident core v169")).toHaveLength(1);
  expect(h.built.some(mesh => mesh.name === "Zoo grounds v165")).toBeFalse();
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual(h.built.map(() => 1));
  expect(h.ready).toBe(0);
  expect(h.reported).toBe(0);
  expect(h.warnings).toHaveLength(0);
});
