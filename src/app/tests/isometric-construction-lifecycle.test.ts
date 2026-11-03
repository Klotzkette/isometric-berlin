import { parkStaticGeometrySteps, parkStaticInstancesSteps } from "../src/losslessStaticStorage";
import { interleaveStaticGeometry, interleaveStaticGeometrySteps } from "../src/interleaveStaticGeometry";
import { expect, test } from "bun:test";
import ts from "typescript";
import {
  BoxGeometry, BufferAttribute, BufferGeometry, Group, InstancedMesh, Line, LineBasicMaterial, LineSegments, Material, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, Points, Scene, Texture,
} from "three";
import { completeCooperatively } from "../src/cooperativeWork";
import { compactStaticGeometrySteps } from "../src/compactStaticGeometry";
import { objectMaterialsIncludingTransferredAlternates } from "../src/transferableObject3D";
import { createZooAnimalRuntimeV282 } from "../src/ZooAnimalsV282";
import { createHbfStationRuntimeV291, hbfLiftFloorAtV291, markHbfMotionFrameV291, markHbfMovingMeshV291 } from "../src/HbfStationMotionV291";
import { admitsChancelleryCanopyLegacyV289, setChancelleryCanopyLegacyV289 } from "../src/ChancelleryCanopySourceV289";
import { matchesBerlinHistoricDomOwnersV288, matchesBerlinHistoricDomNativeV288 } from "../src/BerlinHistoricCoreV288Ownership";
import { admitsPotsdamerCorridorCoreV288, admitsPotsdamerCorridorNativeV288 } from "../src/PotsdamerCorridorV288Ownership";
import { admitsChancelleryCanopySourceV289, admitsChancelleryCanopyNativeV289 } from "../src/ChancelleryCanopySourceV289Ownership";
import { admitsMoabitMitteV300Core, admitsMoabitMitteV300Native } from "../src/MoabitMitteV300Ownership";
import { admitsWestKiezV302Core, admitsWestKiezV302Native } from "../src/WestKiezV302CoreOwnership";
import moabitOwners from "../src/data/moabitMitteV300Owners.json";
import westOwners from "../src/data/westKiezV302CoreOwners.json";
import { diningOriginalPrismV296, PARLIAMENTARY_DINING_V296 } from "../src/parliamentaryDiningV296Profile";
import { waterfrontOriginalPrismV296, WATERFRONT_ARCADE_RECEIPT_V296 } from "../src/waterfrontV296Profile";
import { parliamentSourceOwnersAdmittedV295 } from "../src/ParliamentRetainedEnvelopeV295";
import { applyWaterfrontAuthoredOpeningsV296 } from "../src/WaterfrontFidelityV296";
import historicOwners from "../src/data/berlinHistoricCoreV288Ownership.json";
import corridorOwners from "../src/data/potsdamerCorridorV288Owners.json";
import canopyOwners from "../src/data/chancelleryCanopyV289.json";
import canopyLegacy from "../src/data/chancelleryCanopyLegacyV289.json";
import diningOwners from "../src/data/parliamentaryDiningV296.json";
import type { ProgressiveWorldWorkerInput } from "../src/progressiveWorld";
import { canReplacePotsdamerSouthStationPhoto, POTSDAMER_SOUTH_STATION_PHOTO_RECEIPT, POTSDAMER_STATION_PHOTO_STRIP_RECEIPT } from "../src/potsdamerStationPhotoOwnership";
import {
  createMinecraftMaterialState, releaseMinecraftMaterialBindings,
} from "../src/visual-modes/minecraft/materialMode";

const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
const names = ["ensureIsoWorld", "captureMutableRootSnapshots", "rollbackMutableRoots", "disposeObject3D", "setDiningLegacyVisibilityV296"];
const parsed = ts.createSourceFile("ThreeViewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = names.map(name => {
  const node = parsed.statements.find(entry => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
  if (!node) throw new Error(`Missing production function ${name}`);
  return node.getText(parsed).replace(/^export\s+/, "")
    .replace(/import\("(\.\/[^\"]+)"\)/g, "loadAddon(\"$1\")")
    .replaceAll("import.meta.env.DEV", "false");
});
const fidelitySource = await Bun.file(new URL("../src/RequiredFidelityV288.ts", import.meta.url)).text();
const fidelityParsed=ts.createSourceFile("RequiredFidelityV288.ts",fidelitySource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const fidelityDeclarations=["constructUnpublishedFidelityV288","prepareRequiredFidelityV288"].map(name=>{
  const node=fidelityParsed.statements.find(entry=>ts.isFunctionDeclaration(entry)&&entry.name?.text===name);
  if(!node)throw Error(`Missing production fidelity transaction ${name}`);
  return node.getText(fidelityParsed).replace(/^export\s+/,"");
});
const compiled = ts.transpileModule([...declarations,...fidelityDeclarations].join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const parliamentIds=new Set(["UbQkgNZe","ycOYQRVL","K0002MCN","eaCxS2u2"]);
const parliamentPrisms=(await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url)).json()).buildings.filter((p:{id:string})=>parliamentIds.has(p.id));
const completeOwnerPrisms=[...new Map([...historicOwners.nearbyPrisms,...corridorOwners.oldPrisms,...corridorOwners.retainedPrisms,
  ...canopyOwners.oldPrisms,...canopyOwners.retainedPrisms,...diningOwners.originalPrisms,WATERFRONT_ARCADE_RECEIPT_V296.prism,...parliamentPrisms].map(p=>[p.id,p])).values()];
const unconditionalFidelityNames=["Required Litten-Stadthaus v297","Required wall-gallery v298","Required courts and park v293","Required southern districts v294",
  "Required parliamentary dining v296","Required waterfront v296","Required Mitte DDR v288","Required DPRK embassy v288"];
const neighbourhoodOwnerPrisms=[...new Map([...moabitOwners.oldPrisms,...moabitOwners.retainedPrisms,...westOwners.oldPrisms].map(p=>[p.id,p])).values()];
function retainedCanopyFixture(){
  const pose=(object:Object3D,receipt:{matrix:number[];pose:number[];matrixAutoUpdate:boolean})=>{
    object.position.fromArray(receipt.pose,0);object.quaternion.fromArray(receipt.pose,3);object.scale.fromArray(receipt.pose,7);
    object.matrix.fromArray(receipt.matrix);object.matrixAutoUpdate=receipt.matrixAutoUpdate;
  };
  const root=new Group();root.name=canopyLegacy.legacyRoot.name;pose(root,canopyLegacy.legacyRoot);
  for(const receipt of canopyLegacy.legacy){
    const geometry=new BufferGeometry();
    for(const[key,value]of Object.entries(receipt.attributes))geometry.setAttribute(key,new BufferAttribute(new Float32Array(value.values),value.itemSize,value.normalized));
    geometry.setIndex(receipt.index.length?receipt.index:null);geometry.groups=receipt.groups.map(g=>({...g}));geometry.setDrawRange(receipt.drawRange.start,receipt.drawRange.count??Infinity);
    const material=receipt.material.type==="LineBasicMaterial"?new LineBasicMaterial({color:receipt.color}):new MeshStandardMaterial({color:receipt.color});
    Object.assign(material,receipt.material,{opacity:receipt.opacity,transparent:receipt.transparent});
    if("ink"in receipt)material.userData={...receipt.ink};
    const object=receipt.material.type==="LineBasicMaterial"?new LineSegments(geometry,material):new Mesh(geometry,material);
    object.name=receipt.name;pose(object,receipt);root.add(object);
  }
  expect(admitsChancelleryCanopyLegacyV289(root)).toBe(true);return root;
}

// Execute the production transaction and disposal. Only model constructors,
// downloading and unrelated presentation hooks are replaced by bounded fixtures.
function host(options: { stopAtTask?: number; stopAfterModel?: string; modeAtTask?: number; failCommit?: boolean; failHungarianImport?: boolean; failRequiredSitesImport?: boolean; failStationPhotoImport?: boolean; failStationPhotoConstruction?: boolean; stationSource?: "missing" | "changed" | "duplicate"; stationStripSource?: "missing" | "changed" | "duplicate"; progressiveDistrict?: boolean; initialWater?: boolean; hbfFixtures?: boolean; existingHbfSignature?: "drawn" | "native"; sourceOwners?:"complete"|"changed"|"missing"; neighbourhoodOwners?:"complete"|"changed"|"missing"; failFidelityModel?:string; incompleteFidelityModel?:string; missingDiningFacade?:boolean; parliamentSignature?:boolean; canopyLegacy?:boolean } = {}) {
  const built: Mesh[] = [];
  // Required source families have their own bounded fixture inventory. Keep all
  // historical legacy-stage assertions and additionally audit every allocation
  // in the actual new required-owner construction/admission transaction.
  const fidelityBuilt: Mesh[] = [];
  // New required-site fixture allocations are separately audited, preserving
  // every historical legacy-stage inventory/order assertion below.
  const neukoellnFidelityBuiltV305: Mesh[] = [];
  const fidelityOwners=new Map<string,WeakSet<Group>>();
  const disposed = new Map<Mesh, number>();
  const warnings: string[] = [];
  const stationRegistrations: Object3D[] = [], stationReleases: Object3D[] = [];
  const existing = new Group(); existing.name = "existing signature";
  if(options.existingHbfSignature) {
    existing.add(new Mesh(new BoxGeometry(),new MeshBasicMaterial()));
    markHbfMotionFrameV291(existing,options.existingHbfSignature==="native");
  }
  const circulationCalls: {phase:"core"|"coverage";value:boolean|undefined}[]=[];
  const fidelityCalls:{phase:"core"|"coverage";historicDomV288?:boolean;potsdamerCorridorV288?:boolean;chancelleryCanopySourceV289?:boolean;parliamentaryDiningV296?:boolean;waterfrontV296?:boolean;parliamentInteriorsV295?:boolean}[]=[];
  const neighbourhoodCalls:{phase:"core"|"coverage";moabitMitteV300?:boolean;westKiezV302?:boolean}[]=[];
  const legacyDining=new Group();legacyDining.name="Marie-Elisabeth-Lüders-Haus Spree facade";
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
    sceneRootUrl: "https://local.invalid/",
    worldFailureReported: false, isoWorldState: "idle", coarsePointer: true,
    lightingMode: "schwellenraum", nightLightsOn: true, underside: false,
    scene: new Scene(), isoWorld: null as Group | null,
    hbfStationV291: undefined as ReturnType<typeof createHbfStationRuntimeV291> | undefined,
    schwellenraumTowerSteam: null as Mesh | null, schwellenraumTowerSteamElapsedSeconds: 4.75,
    signatures: new Group(), centralDetails:new Group(), cityStaffage: new Group(), undergroundNetwork: new Group(),
    tramCatenary: new Group(), schwellenraumPraesentation: new Group(),
    schwellenraumWorldDetailsInstaller: null, tunnelPortalCourse: null,
    controls: { target: { x: 0, z: 0 } }, camera: {},
    pedestrian: { environment: null, requested: false },
    minecraftMaterialState: createMinecraftMaterialState(),
    progressiveWorldBatches: [], progressiveWorldState: "idle", progressiveWorldInput: undefined as ProgressiveWorldWorkerInput | undefined,
    reportCoreProgress: () => {}, startDeferredDetails: () => {},
    reportWorldFailure: () => { reported++; },
    gpuWarmup: { release: () => { releaseCount++; } },
  };
  runtime.centralDetails.add(legacyDining);
  if(options.parliamentSignature)Object.assign(existing.userData,{parliamentInteriorsV295:true,native:false});
  runtime.signatures.add(existing);
  const retainedCanopy=options.canopyLegacy?retainedCanopyFixture():undefined;
  if(retainedCanopy)runtime.signatures.add(retainedCanopy);
  runtime.scene.add(runtime.signatures, runtime.cityStaffage, runtime.undergroundNetwork,
    runtime.tramCatenary, runtime.schwellenraumPraesentation);
  function model(name: string, inventory=built) {
    const group = new Group(); group.name = name;
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    mesh.name = name;
    mesh.geometry.userData.exactIndexPending = true;
    mesh.geometry.addEventListener("dispose", () => disposed.set(mesh, (disposed.get(mesh) ?? 0) + 1));
    inventory.push(mesh); group.add(mesh);
    if (options.hbfFixtures && name === "core") {
      markHbfMotionFrameV291(group, false);
      markHbfMovingMeshV291(mesh, { kind: "lift", shaftIndexes: [0], initialFloors: [hbfLiftFloorAtV291(0, 0)] });
    }
    return group;
  }
  const family=(name:string,inventory=fidelityBuilt)=>{
    if(name===options.failFidelityModel)throw Error(`Required fidelity constructor failed: ${name}`);
    const root=model(name,inventory),owners=fidelityOwners.get(name)??new WeakSet<Group>();
    owners.add(root);fidelityOwners.set(name,owners);return root;
  };
  const complete=(name:string)=>(root:Group)=>name!==options.incompleteFidelityModel&&fidelityOwners.get(name)?.has(root)===true&&root.children.length===1;
  const fidelityFactories={
    createNeukoellnLandmarksV305:()=>family("Required Neukoelln v305",neukoellnFidelityBuiltV305),hasCompleteNeukoellnLandmarksV305:complete("Required Neukoelln v305"),
    createMoabitMitteV300Core:()=>family("Required Moabit-Mitte v300"),hasCompleteMoabitMitteV300Core:complete("Required Moabit-Mitte v300"),
    createWestKiezV302Core:()=>family("Required West-Kiez v302"),hasCompleteWestKiezV302Core:complete("Required West-Kiez v302"),
    createLittenStadthausV297:()=>family("Required Litten-Stadthaus v297"),hasCompleteLittenStadthausV297:complete("Required Litten-Stadthaus v297"),
    createWallGalleryV298:()=>family("Required wall-gallery v298"),hasCompleteWallGalleryV298:complete("Required wall-gallery v298"),
    createCourtsParkV293:()=>family("Required courts and park v293"),
    createSouthFidelityV294:()=>family("Required southern districts v294"),hasCompleteSouthFidelityV294:complete("Required southern districts v294"),
    createParliamentaryDiningV296:()=>family("Required parliamentary dining v296"),
    createWaterfrontFidelityV296:()=>family("Required waterfront v296"),
    createBerlinHistoricDomV288:()=>family("Required historic Dom v288"),hasCompleteBerlinHistoricDomV288:complete("Required historic Dom v288"),
    createPotsdamerCorridorCoreV288:()=>family("Required Potsdamer corridor v288"),hasCompletePotsdamerCorridorCoreV288:complete("Required Potsdamer corridor v288"),
    createMitteDdrV288:()=>family("Required Mitte DDR v288"),
    createDprkEmbassyV288:()=>family("Required DPRK embassy v288"),
    createChancelleryCanopySourceV289:()=>family("Required Chancellery canopy v289"),hasCompleteChancelleryCanopySourceV289:complete("Required Chancellery canopy v289"),
  };
  const factoryNames=[...fidelityDeclarations[1].matchAll(/group[=:](?:\w+=)?(create\w+)\(/g)].map(m=>m[1]);
  expect(factoryNames.sort()).toEqual(Object.keys(fidelityFactories).filter(k=>k.startsWith("create")).sort());
  const coreSpreeBridgeFactory = () => model("Source-bound core Spree bridges");
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
    "./NorthCorridorV208": { createHungarianEnvelopeV208: () => model("Complete Hungarian measured envelope v208") },
    "./PotsdamerStationDrawn": { createPotsdamerSouthStationPhotoDrawn: () => {
      if (options.failStationPhotoConstruction) throw new Error("Required south hall construction failed");
      return model("Required Potsdamer south hall");
    } },
    "./RequiredSiteEnvelopesV209": { addRequiredSiteEnvelopesV209Steps: function* (root: Group) {
      for (const name of ["Required Volksbuehne v209", "Required Helmholtz v209", "Required prison sites v209"]) {
        root.add(model(name)); yield;
      }
    } },
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
    canReplacePotsdamerSouthStationPhoto,
    ...fidelityFactories,
    matchesBerlinHistoricDomOwnersV288,matchesBerlinHistoricDomNativeV288,
    admitsPotsdamerCorridorCoreV288,admitsPotsdamerCorridorNativeV288,
    admitsChancelleryCanopySourceV289,admitsChancelleryCanopyNativeV289,
    admitsMoabitMitteV300Core,admitsMoabitMitteV300Native,
    admitsWestKiezV302Core,admitsWestKiezV302Native,
    diningOriginalPrismV296,PARLIAMENTARY_DINING_V296,waterfrontOriginalPrismV296,
    parliamentSourceOwnersAdmittedV295,applyWaterfrontAuthoredOpeningsV296,
    // This harness has no actual v227 Neukölln profile. Unknown/missing source
    // replacements therefore cannot authorize any legacy fitting retirement.
    applyNeukoellnLegacyV227V305:()=>false,
    admitsChancelleryCanopyLegacyV289,setChancelleryCanopyLegacyV289,
    prepareViewerDiningFacadeV296:(_runtime:unknown,enabled:boolean)=>{
      if(!enabled||options.missingDiningFacade)return null;
      expect(runtime.isoWorld).toBeNull();
      return{group:family("Required retained dining facade v296")};
    },
    createHbfStationRuntimeV291: () => {
      const motion = createHbfStationRuntimeV291();
      return {
        register(root: Object3D) {
          expect(root.parent).toBe(runtime.scene);
          expect(runtime.isoWorld?.parent).toBe(runtime.scene);
          stationRegistrations.push(root);
          motion.register(root);
        },
        release(root: Object3D) { stationReleases.push(root); motion.release(root); },
        update: motion.update, dispose: motion.dispose,
        get size() { return motion.size; },
        get elapsedSeconds() { return motion.elapsedSeconds; },
      };
    },
    createZooAnimalRuntimeV282,
    createCoreSpreeBridgesV242: coreSpreeBridgeFactory,
    parkStaticGeometrySteps, parkStaticInstancesSteps,
    interleaveStaticGeometry,
    interleaveStaticGeometrySteps,
    completedPedestrianWater: () => {},
    Group, BufferGeometry, Mesh, InstancedMesh, Line, LineSegments, Material, Points, Texture,
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
      expect(stationRegistrations).toHaveLength(0);
      expect(runtime.signatures.children.every(child => child === existing || child === concurrent || child===retainedCanopy)).toBeTrue();
      pose++;
      if (taskCount === 2) runtime.signatures.add(concurrent);
      if (taskCount === options.stopAtTask ||
          (options.stopAfterModel && [...built,...fidelityBuilt].some(mesh => mesh.name === options.stopAfterModel))) {
        runtime.disposed = true;
        runtime.worldFailureReported = true;
        loadController.abort();
      }
      if (taskCount === options.modeAtTask) runtime.lightingMode = "minecraft";
    },
    yieldStartupPaintV309: async () => {},
    loadAddon: (path: keyof typeof modules) => {
      if (options.failStationPhotoImport && path === "./PotsdamerStationDrawn") return Promise.reject(new Error("Required south hall import failed"));
      if (options.failRequiredSitesImport && path === "./RequiredSiteEnvelopesV209") return Promise.reject(new Error("Required sites import failed"));
      if (options.failHungarianImport && path === "./NorthCorridorV208") return Promise.reject(new Error("Hungarian envelope import failed"));
      if (!modules[path]) throw new Error(`Missing lifecycle fixture for production addon ${path}`);
      return Promise.resolve(modules[path]);
    },
    fetchPrismPayload: async () => {
      const source = POTSDAMER_SOUTH_STATION_PHOTO_RECEIPT.previousPrism;
      const strip = POTSDAMER_STATION_PHOTO_STRIP_RECEIPT.previousPrism;
      const hallSources = options.stationSource === "missing" ? [] :
        options.stationSource === "changed" ? [{ ...source, h_dm: source.h_dm + 1 }] :
        options.stationSource === "duplicate" ? [source, source] : [source];
      const stripSources = options.stationStripSource === "missing" ? [] :
        options.stationStripSource === "changed" ? [{ ...strip, h_dm: strip.h_dm + 1 }] :
        options.stationStripSource === "duplicate" ? [strip, strip] : [strip];
      const owners=options.sourceOwners==="complete"?completeOwnerPrisms:options.sourceOwners==="changed"?completeOwnerPrisms.map(p=>({...p,h_dm:p.h_dm+1})):[];
      const neighbourhood=options.neighbourhoodOwners==="complete"?neighbourhoodOwnerPrisms:options.neighbourhoodOwners==="changed"?neighbourhoodOwnerPrisms.map(p=>({...p,h_dm:p.h_dm+1})):[];
      return { buildings: [...hallSources, ...stripSources,...owners,...neighbourhood] };
    },
    fetchGroundPayload: async () => null, fetchStreetPayload: async () => null,
    fetchSurfacePayload: async () => null, fetchRailPayload: async () => null,
    isoWorldIntentActive: () => runtime.lightingMode !== "minecraft",
    createSchwellenraumMemorialProtectionIndex: () => ({}),
    splitProgressiveBuildings: () => ({ initial: [], remaining: options.progressiveDistrict ? [[]] : [], omitted: [] }),
    buildingDetailProfile: () => ({ batchSize: 240 }),
    buildingDetailDistricts: () => [], selectBuildingDetailDistricts: () => [], buildingDetailViewPoints: () => [],
    createIsometricCityStepsV309: function* (_prisms: unknown, _ground: unknown, _tunnel: unknown, _surfaces: unknown, buildOptions: { includeAltMitteCoreV169: boolean; coreSpreeBridgeFactoryV242: unknown; potsdamerStationPhoto?: boolean; hbfCirculationV291?:boolean }, onCreate?: (root: Group) => void) {
      expect(buildOptions.includeAltMitteCoreV169).toBe(false);
      expect(buildOptions.coreSpreeBridgeFactoryV242).toBe(coreSpreeBridgeFactory);
      expect(buildOptions.potsdamerStationPhoto).toBe(options.stationSource === undefined && options.stationStripSource === undefined);
      circulationCalls.push({phase:"core",value:buildOptions.hbfCirculationV291});
      neighbourhoodCalls.push({phase:"core",moabitMitteV300:(buildOptions as Record<string,unknown>).moabitMitteV300 as boolean,westKiezV302:(buildOptions as Record<string,unknown>).westKiezV302 as boolean});
      fidelityCalls.push({phase:"core",...Object.fromEntries(["historicDomV288","potsdamerCorridorV288","chancelleryCanopySourceV289","parliamentaryDiningV296","waterfrontV296","parliamentInteriorsV295"].map(k=>[k,(buildOptions as Record<string,unknown>)[k]]))});
      const city = model("core"); city.add(model("drawn bridge structures")); onCreate?.(city); return city;
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
    createProgressiveBuildingCoverage: (_prisms: unknown, _partition: unknown, buildOptions: { potsdamerStationPhoto?: boolean; hbfCirculationV291?:boolean }) => {
      expect(buildOptions.potsdamerStationPhoto).toBe(options.stationSource === undefined && options.stationStripSource === undefined);
      circulationCalls.push({phase:"coverage",value:buildOptions.hbfCirculationV291});
      neighbourhoodCalls.push({phase:"coverage",moabitMitteV300:(buildOptions as Record<string,unknown>).moabitMitteV300 as boolean,westKiezV302:(buildOptions as Record<string,unknown>).westKiezV302 as boolean});
      fidelityCalls.push({phase:"coverage",...Object.fromEntries(["historicDomV288","potsdamerCorridorV288","chancelleryCanopySourceV289","parliamentaryDiningV296","waterfrontV296","parliamentInteriorsV295"].map(k=>[k,(buildOptions as Record<string,unknown>)[k]]))});
      return model("coverage");
    },
    setWeidendammerBridgePresentation: () => {}, setSandkrugBridgePresentation: () => {},
    setCoreBridgeRoadPresentationV242: () => {}, setCoreSpreeBridgePresentationV242: () => {},
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
    PRISM_WORLD_FILE: "prisms", GROUND_CONTEXT_FILE: "ground", SURFACE_WORLD_FILE: "surfaces",
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
  const auditedFinished=finished.then(()=>{
    for(const mesh of [...fidelityBuilt,...neukoellnFidelityBuiltV305]){
      if(runtime.isoWorld){expect(disposed.has(mesh)).toBeFalse();expect(runtime.isoWorld.getObjectById(mesh.id)).toBe(mesh);}
      else expect(disposed.get(mesh)).toBe(1);
    }
  });
  return { finished:auditedFinished, runtime, built, fidelityBuilt, disposed, warnings, existing, concurrent, legacyDining, retainedCanopy, stationRegistrations, stationReleases, circulationCalls, fidelityCalls, neighbourhoodCalls,
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
    "core", "drawn bridge structures", "Required Potsdamer south hall", "Complete Hungarian measured envelope v208", "Required Volksbuehne v209", "Required Helmholtz v209", "Required prison sites v209", "Gendarmenmarkt shells", "Gendarmenmarkt architecture",
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

for(const existingHbfSignature of[undefined,"drawn","native"] as const) {
  test(`production world admission propagates only completed drawn Hauptbahnhof circulation (${existingHbfSignature??"unmarked"})`,async()=>{
    const h=host({progressiveDistrict:true,existingHbfSignature});await h.finished;
    const admitted=existingHbfSignature==="drawn";
    expect(h.warnings).toHaveLength(0);expect(h.ready).toBe(1);
    expect(h.runtime.isoWorld?.parent).toBe(h.runtime.scene);
    expect(h.existing.parent).toBe(h.runtime.signatures);
    expect(h.circulationCalls).toEqual([{phase:"core",value:admitted},{phase:"coverage",value:admitted}]);
    expect(h.built.filter(mesh=>mesh.name==="core")).toHaveLength(1);
    expect(h.built.filter(mesh=>mesh.name==="coverage")).toHaveLength(1);
    expect(h.runtime.progressiveWorldInput).toBeDefined();
    expect(h.runtime.progressiveWorldInput?.detailProfile).toBe("mobile");
    expect(h.runtime.progressiveWorldInput?.hbfCirculationV291).toBe(admitted);
    if(existingHbfSignature)expect(h.existing.userData.hbfMotionFrameV291.native).toBe(existingHbfSignature==="native");
    else expect(h.existing.userData.hbfMotionFrameV291).toBeUndefined();
    h.disposeScene();
  });
}

test("completed world publication registers the real station runtime and scene disposal releases its moving owner", async () => {
  const h = host({ hbfFixtures: true });
  await h.finished;
  expect(h.warnings).toHaveLength(0);
  expect(h.stationRegistrations).toEqual([h.runtime.signatures, h.runtime.isoWorld!]);
  const station = h.runtime.hbfStationV291!;
  expect(station.size).toBe(1);
  const cabin = h.built.find(mesh => mesh.name === "core")!;
  const initialY = cabin.position.y;
  const camera = new PerspectiveCamera(60, 1, .1, 1000);
  camera.position.set(0, 3, 20);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  for (let frame = 0; frame <= 120; frame++) station.update(frame * 50, camera, false, false, false);
  expect(station.elapsedSeconds).toBeCloseTo(6, 6);
  expect(cabin.position.y).toBeGreaterThan(initialY + 1);
  h.disposeScene();
  expect(h.stationReleases).toContain(h.runtime.scene);
  expect(station.size).toBe(0);
  expect(h.disposed.get(cabin)).toBe(1);
});

test("a failed complete-world commit releases the station owner registered during that same transaction", async () => {
  const h = host({ hbfFixtures: true, failCommit: true });
  await h.finished;
  expect(h.stationRegistrations).toHaveLength(2);
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.runtime.hbfStationV291?.size).toBe(0);
  expect(h.stationReleases).toContain(h.stationRegistrations[1]);
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual(h.built.map(() => 1));
  expect(h.reported).toBe(1);
});

test("cancelled provisional station fixtures never register with the moving runtime", async () => {
  const h = host({ hbfFixtures: true, stopAfterModel: "core" });
  await h.finished;
  expect(h.built.some(mesh => mesh.userData.hbfMovingFixtureV291)).toBeTrue();
  expect(h.stationRegistrations).toHaveLength(0);
  expect(h.runtime.hbfStationV291).toBeUndefined();
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual(h.built.map(() => 1));
  expect(h.runtime.isoWorld).toBeNull();
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


test("required Hungarian source replacement is owned and disposed before any optional facade phase", async () => {
  const h = host({ stopAfterModel: "Complete Hungarian measured envelope v208" });
  await h.finished;
  expect(h.built.map(mesh => mesh.name)).toEqual(["core", "drawn bridge structures", "Required Potsdamer south hall", "Complete Hungarian measured envelope v208"]);
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual([1, 1, 1, 1]);
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.ready).toBe(0);
});

test("required Potsdamer south hall belongs to the unpublished city before its first yield", async () => {
  const h = host({ stopAfterModel: "Required Potsdamer south hall" });
  await h.finished;
  expect(h.built.map(mesh => mesh.name)).toEqual(["core", "drawn bridge structures", "Required Potsdamer south hall"]);
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual([1, 1, 1]);
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.ready).toBe(0);
  expect(h.warnings).toHaveLength(0);
});

test("failed required south-hall import preserves the earlier scene without allocating a replacement city", async () => {
  const h = host({ failStationPhotoImport: true });
  await h.finished;
  expect(h.built).toHaveLength(0);
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.runtime.isoWorldState).toBe("failed");
  expect(h.runtime.signatures.children).toEqual([h.existing]);
  expect(h.reported).toBe(1);
});

test("failed required south-hall construction disposes the provisional core without exposing a source hole", async () => {
  const h = host({ failStationPhotoConstruction: true });
  await h.finished;
  expect(h.built.map(mesh => mesh.name)).toEqual(["core", "drawn bridge structures"]);
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual([1, 1]);
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.runtime.isoWorldState).toBe("failed");
  expect(h.runtime.signatures.children).toEqual([h.existing]);
  expect(h.reported).toBe(1);
});

for (const stationSource of ["missing", "changed", "duplicate"] as const) {
  test(`${stationSource} south-station source keeps its fallback without constructing a duplicate required model`, async () => {
    const h = host({ stationSource });
    await h.finished;
    expect(h.runtime.isoWorld?.parent).toBe(h.runtime.scene);
    expect(h.ready).toBe(1);
    expect(h.built.some(mesh => mesh.name === "Required Potsdamer south hall")).toBeFalse();
    expect(h.runtime.isoWorld?.userData.potsdamerStationPhoto).not.toBeTrue();
    expect(h.warnings).toHaveLength(0);
    h.disposeScene();
  });
}

for (const stationStripSource of ["missing", "changed", "duplicate"] as const) {
  test(`${stationStripSource} station-edge source retains both owners without constructing a partial station replacement`, async () => {
    const h = host({ stationStripSource });
    await h.finished;
    expect(h.runtime.isoWorld?.parent).toBe(h.runtime.scene);
    expect(h.ready).toBe(1);
    expect(h.built.some(mesh => mesh.name === "Required Potsdamer south hall")).toBeFalse();
    expect(h.runtime.isoWorld?.userData.potsdamerStationPhoto).not.toBeTrue();
    expect(h.warnings).toHaveLength(0);
    h.disposeScene();
  });
}

for (const admitted of [false, true]) {
  test(`the published worker request carries completed two-owner station admission (${admitted})`, async () => {
    const h = host({ progressiveDistrict: true, ...(admitted ? {} : { stationStripSource: "missing" as const }) });
    await h.finished;
    expect(h.runtime.isoWorld?.parent).toBe(h.runtime.scene);
    expect(h.runtime.progressiveWorldInput?.potsdamerStationPhoto).toBe(admitted);
    expect(h.runtime.isoWorld?.userData.potsdamerStationPhoto === true).toBe(admitted);
    h.disposeScene();
  });
}

test("a failed required Hungarian import cannot publish a city with an empty embassy site", async () => {
  const h = host({ failHungarianImport: true });
  await h.finished;
  expect(h.built).toHaveLength(0);
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.runtime.isoWorldState).toBe("failed");
  // This hook also reports terminal failure; it does not imply a published city.
  expect(h.ready).toBe(1);
  expect(h.reported).toBe(1);
  expect(h.warnings).toHaveLength(1);
  expect(h.runtime.signatures.children).toEqual([h.existing]);
});

for (const name of ["Required Volksbuehne v209", "Required Helmholtz v209", "Required prison sites v209"]) test(`${name} cancellation never exposes a transferred-owner hole`, async () => {
  const h = host({ stopAfterModel: name }); await h.finished;
  expect(h.built.some(mesh => mesh.name === name)).toBeTrue();
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual(h.built.map(() => 1));
  expect(h.runtime.isoWorld).toBeNull(); expect(h.ready).toBe(0);
});
test("a failed required v209 import preserves the presentation gate", async () => {
  const h = host({ failRequiredSitesImport: true }); await h.finished;
  expect(h.built).toHaveLength(0); expect(h.runtime.isoWorld).toBeNull();
  expect(h.runtime.isoWorldState).toBe("failed"); expect(h.reported).toBe(1);
});

for(const sourceOwners of["complete","changed","missing"]as const)test(`real source-owner admission propagates ${sourceOwners} fidelity through core, coverage and worker publication`,async()=>{
  const h=host({sourceOwners,parliamentSignature:true,progressiveDistrict:true});await h.finished;
  const admitted=sourceOwners==="complete";
  expect(h.warnings).toHaveLength(0);expect(h.ready).toBe(1);expect(h.runtime.isoWorld?.parent).toBe(h.runtime.scene);
  const flags={historicDomV288:admitted,potsdamerCorridorV288:admitted,chancelleryCanopySourceV289:false,
    parliamentaryDiningV296:admitted,waterfrontV296:admitted,parliamentInteriorsV295:admitted};
  expect(h.fidelityCalls).toEqual([{phase:"core",...flags},{phase:"coverage",...flags}]);
  for(const[key,value]of Object.entries(flags))expect((h.runtime.progressiveWorldInput as unknown as Record<string,unknown>)[key],key).toBe(value);
  const names=admitted?[...unconditionalFidelityNames.slice(0,6),"Required historic Dom v288","Required Potsdamer corridor v288",...unconditionalFidelityNames.slice(6),"Required retained dining facade v296"]:unconditionalFidelityNames;
  expect(h.fidelityBuilt.map(m=>m.name)).toEqual(names);
  for(const key of["courtsParkV293","southFidelityV294","littenStadthausV297","wallGalleryV298"])expect(h.runtime.isoWorld?.userData[key],key).toBe(true);
  expect(h.runtime.isoWorld?.userData.parliamentaryDiningFacadeV296).toBe(admitted);
  expect(h.legacyDining.visible).toBe(!admitted);
  // Even exact source prisms cannot retire the old canopy without its matching
  // authored predecessor. The real source and legacy admitters both run here.
  expect(h.fidelityBuilt.some(m=>m.name==="Required Chancellery canopy v289")).toBe(false);
  h.disposeScene();
  expect(h.fidelityBuilt.map(m=>h.disposed.get(m))).toEqual(h.fidelityBuilt.map(()=>1));
});

test("valid parliament source owners alone cannot open an absent interior family",async()=>{
  const h=host({sourceOwners:"complete",progressiveDistrict:true});await h.finished;
  expect(h.warnings).toHaveLength(0);expect(h.fidelityCalls.every(c=>c.parliamentInteriorsV295===false)).toBe(true);
  expect(h.runtime.progressiveWorldInput?.parliamentInteriorsV295).toBe(false);
  h.disposeScene();
});

test("complete new source families are already transaction-owned before the first cancellation task",async()=>{
  const h=host({stopAfterModel:"Required wall-gallery v298"});await h.finished;
  expect(h.taskCount).toBe(1);expect(h.built).toHaveLength(0);
  expect(h.fidelityBuilt.map(m=>m.name)).toEqual(unconditionalFidelityNames);
  expect(h.fidelityBuilt.map(m=>h.disposed.get(m))).toEqual(h.fidelityBuilt.map(()=>1));
  expect(h.runtime.isoWorld).toBeNull();expect(h.runtime.signatures.children).toEqual([h.existing]);
  expect(h.ready).toBe(0);expect(h.reported).toBe(0);expect(h.warnings).toHaveLength(0);
});

for(const name of unconditionalFidelityNames)test(`a failed ${name} constructor releases every earlier required family before any legacy city allocation`,async()=>{
  const h=host({failFidelityModel:name});await h.finished;
  expect(h.built).toHaveLength(0);expect(h.fidelityBuilt.map(m=>m.name)).toEqual(unconditionalFidelityNames.slice(0,unconditionalFidelityNames.indexOf(name)));
  expect(h.fidelityBuilt.map(m=>h.disposed.get(m))).toEqual(h.fidelityBuilt.map(()=>1));
  expect(h.runtime.isoWorld).toBeNull();expect(h.runtime.isoWorldState).toBe("failed");
  expect(h.runtime.signatures.children).toEqual([h.existing]);expect(h.legacyDining.visible).toBe(true);
  expect(h.reported).toBe(1);expect(h.warnings).toHaveLength(1);
});

for(const name of["Required Litten-Stadthaus v297","Required wall-gallery v298","Required southern districts v294"])test(`an incomplete ${name} receipt disposes the rejected owner too`,async()=>{
  const h=host({incompleteFidelityModel:name});await h.finished;
  expect(h.built).toHaveLength(0);expect(h.fidelityBuilt.at(-1)?.name).toBe(name);
  expect(h.fidelityBuilt.map(m=>h.disposed.get(m))).toEqual(h.fidelityBuilt.map(()=>1));
  expect(h.runtime.isoWorld).toBeNull();expect(h.reported).toBe(1);expect(h.warnings).toHaveLength(1);
});

test("missing retained dining facade cannot publish an admitted room or retire the visible legacy owner",async()=>{
  const h=host({sourceOwners:"complete",missingDiningFacade:true});await h.finished;
  expect(h.built.map(m=>m.name)).toEqual(["core","drawn bridge structures"]);
  expect(h.fidelityBuilt.some(m=>m.name==="Required retained dining facade v296")).toBe(false);
  expect(h.runtime.isoWorld).toBeNull();expect(h.legacyDining.visible).toBe(true);
  expect([...h.built,...h.fidelityBuilt].map(m=>h.disposed.get(m))).toEqual([...h.built,...h.fidelityBuilt].map(()=>1));
  expect(h.reported).toBe(1);expect(h.warnings).toHaveLength(1);
});

test("failed publication restores the dining predecessor and disposes every complete source-owned family once",async()=>{
  const h=host({sourceOwners:"complete",failCommit:true});await h.finished;
  expect(h.fidelityBuilt.some(m=>m.name==="Required retained dining facade v296")).toBe(true);
  expect(h.runtime.isoWorld).toBeNull();expect(h.legacyDining.visible).toBe(true);
  expect([...h.built,...h.fidelityBuilt].map(m=>h.disposed.get(m))).toEqual([...h.built,...h.fidelityBuilt].map(()=>1));
  expect(h.runtime.signatures.children).toEqual([h.existing,h.concurrent]);
  expect(h.reported).toBe(1);expect(h.warnings).toHaveLength(1);
});

for(const failCommit of[false,true])test(`exact retained canopy admission survives real commit/rollback (${failCommit}) without changing its source geometry`,async()=>{
  const h=host({sourceOwners:"complete",canopyLegacy:true,progressiveDistrict:true,failCommit});await h.finished;
  expect(h.fidelityBuilt.some(m=>m.name==="Required Chancellery canopy v289")).toBe(true);
  expect(h.fidelityCalls.every(c=>c.chancelleryCanopySourceV289===true)).toBe(true);
  expect(admitsChancelleryCanopyLegacyV289(h.runtime.signatures)).toBe(true);
  expect(h.retainedCanopy?.children).toHaveLength(canopyLegacy.legacy.length);
  for(const leaf of h.retainedCanopy!.children)expect(leaf.visible).toBe(failCommit);
  if(failCommit){
    expect(h.runtime.isoWorld).toBeNull();expect(h.runtime.signatures.children).toEqual([h.existing,h.retainedCanopy!,h.concurrent]);
    expect([...h.built,...h.fidelityBuilt].map(m=>h.disposed.get(m))).toEqual([...h.built,...h.fidelityBuilt].map(()=>1));
    expect(h.reported).toBe(1);expect(h.warnings).toHaveLength(1);
  }else{
    expect(h.warnings).toHaveLength(0);expect(h.runtime.progressiveWorldInput?.chancelleryCanopySourceV289).toBe(true);h.disposeScene();
  }
});

for(const neighbourhoodOwners of ["missing","changed","complete"] as const)test(`v300/v302 exact source admission reaches core, coverage and worker without altering the older required family (${neighbourhoodOwners})`,async()=>{
  const h=host({neighbourhoodOwners,progressiveDistrict:true});await h.finished;
  const admitted=neighbourhoodOwners==="complete";
  expect(h.warnings).toHaveLength(0);expect(h.runtime.isoWorld?.parent).toBe(h.runtime.scene);
  expect(h.neighbourhoodCalls).toEqual([{phase:"core",moabitMitteV300:admitted,westKiezV302:admitted},{phase:"coverage",moabitMitteV300:admitted,westKiezV302:admitted}]);
  for(const key of ["moabitMitteV300","westKiezV302"] as const){
    expect(h.runtime.isoWorld?.userData[key]).toBe(admitted);
    expect(h.runtime.progressiveWorldInput?.[key]).toBe(admitted);
  }
  const prefix=admitted?["Required Moabit-Mitte v300","Required West-Kiez v302"]:[];
  expect(h.fidelityBuilt.map(m=>m.name)).toEqual([...prefix,...unconditionalFidelityNames]);
  h.disposeScene();expect(h.fidelityBuilt.map(m=>h.disposed.get(m))).toEqual(h.fidelityBuilt.map(()=>1));
});

for(const name of ["Required Moabit-Mitte v300","Required West-Kiez v302"]) {
  for(const incomplete of [false,true])test(`the new ${name} ${incomplete?"incomplete receipt":"constructor failure"} preserves the old scene and releases every earlier new family`,async()=>{
    const h=host({neighbourhoodOwners:"complete",...(incomplete?{incompleteFidelityModel:name}:{failFidelityModel:name})});await h.finished;
    const order=["Required Moabit-Mitte v300","Required West-Kiez v302"],count=order.indexOf(name)+(incomplete?1:0);
    expect(h.fidelityBuilt.map(m=>m.name)).toEqual(order.slice(0,count));
    expect(h.fidelityBuilt.map(m=>h.disposed.get(m))).toEqual(h.fidelityBuilt.map(()=>1));
    expect(h.built).toHaveLength(0);expect(h.runtime.isoWorld).toBeNull();expect(h.runtime.isoWorldState).toBe("failed");
    expect(h.runtime.signatures.children).toEqual([h.existing]);expect(h.reported).toBe(1);expect(h.warnings).toHaveLength(1);
  });
  test(`cancellation after the complete new ${name} never publishes any partially admitted owner`,async()=>{
    const h=host({neighbourhoodOwners:"complete",stopAfterModel:name});await h.finished;
    expect(h.taskCount).toBe(1);expect(h.built).toHaveLength(0);
    expect(h.fidelityBuilt.map(m=>m.name)).toEqual(["Required Moabit-Mitte v300","Required West-Kiez v302",...unconditionalFidelityNames]);
    expect(h.fidelityBuilt.map(m=>h.disposed.get(m))).toEqual(h.fidelityBuilt.map(()=>1));
    expect(h.runtime.isoWorld).toBeNull();expect(h.runtime.signatures.children).toEqual([h.existing]);
    expect(h.ready).toBe(0);expect(h.reported).toBe(0);expect(h.warnings).toHaveLength(0);
  });
}
