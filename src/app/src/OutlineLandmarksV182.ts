import { BufferGeometry, Group, Material, Mesh } from "three";
import { createSteglitzV182, createMinecraftSteglitzV182 } from "./SteglitzV182";
import { createCityRecognitionV182 } from "./CityRecognitionV182";
import { createJusticePalaceV183 } from "./JusticePalaceV183";
import { createMinecraftJusticePalaceV183 } from "./MinecraftJusticePalaceV183";
import { createNeueNationalgalerieV183 } from "./NeueNationalgalerieV183";
import { createAlexanderStationsV183, createMinecraftAlexanderStationsV183 } from "./AlexanderStationsV183";
import { createSpreeLandmarksV183 } from "./SpreeLandmarksV183";
import { createScheunenFacadesV183 } from "./ScheunenFacadesV183";
import { createMinecraftScheunenFacadesV183 } from "./MinecraftScheunenFacadesV183";
import { createSchoolsV185 } from "./SchoolsV185";
import { createPublicPlacesV185 } from "./PublicPlacesV185";
import { createNorthV185 } from "./NorthV185";
import { createSouthKiezV185 } from "./SouthKiezV185";
import { createMinecraftSouthKiezV185 } from "./MinecraftSouthKiezV185";
import { createAltMitteEdgesV186 } from "./AltMitteEdgesV186";
import { createMinecraftAltMitteEdgesV186 } from "./MinecraftAltMitteEdgesV186";
import { createWesternLandmarksV187, createMinecraftWesternLandmarksV187 } from "./WesternLandmarksV187";
import { createSouthWestLandmarksV187 } from "./SouthWestLandmarksV187";
import { createEastLandmarksV187 } from "./EastLandmarksV187";
import { createMinecraftEastLandmarksV187 } from "./MinecraftEastLandmarksV187";
import { createUraniaLuetzowV188 } from "./UraniaLuetzowV188";
import { createVolksbuehneV189 } from "./VolksbuehneV189";
import { createSuhrkampPfefferbergV189 } from "./SuhrkampPfefferbergV189";
import { createAlexanderplatzV189 } from "./AlexanderplatzV189";
import { createParkSitesV190 } from "./ParkSitesV190";
import { createNorthSitesV190 } from "./NorthSitesV190";
import { createMinecraftNorthSitesV190 } from "./MinecraftNorthSitesV190";
import { createGrunewaldLandmarksV190 } from "./GrunewaldLandmarksV190";
import { createRailStationsV190 } from "./RailStationsV190";
import { createCentreAccessV192 } from "./CentreAccessV192";
import { createZionskirchplatzV193 } from "./ZionskirchplatzV193";
import { createArkonaplatzV193 } from "./ArkonaplatzV193";
import { createTegelMotorwayV194 } from "./TegelMotorwayV194";
import { createViktoriaparkV194 } from "./ViktoriaparkV194";
import { createAirportsV194 } from "./AirportsV194";
import { createWestLakesV194 } from "./WestLakesV194";
import { createDrachenbergKitesV195 } from "./DrachenbergKitesV195";
import { createTeufelsbergStationV195 } from "./TeufelsbergStationV195";
import { createDrachenbergLawnV195 } from "./DrachenbergLawnV195";
import { createLindenCorridorV197 } from "./LindenCorridorV197";
import { createTegelSpandauV198 } from "./TegelSpandauV198";
import { createEastParksV198 } from "./EastParksV198";
import { createNorthParksV198 } from "./NorthParksV198";
import { createIccV199 } from "./IccV199";
import { createFunkturmV199 } from "./FunkturmV199";
import { createCemeteryGrunewaldV199 } from "./CemeteryGrunewaldV199";
import { createCentralSitesV200 } from "./CentralSitesV200";
import { createBerlinBoundariesV200 } from "./BerlinBoundariesV200";
import { createRegionOutlinesV200 } from "./RegionOutlinesV200";
import { createMinecraftCharlottenburgerTorV201 } from "./MinecraftCharlottenburgerTorV201";
import { createWuhlheideV201 } from "./WuhlheideV201";
import { createWaldbuehneV201 } from "./WaldbuehneV201";
import { createLibrariesV202 } from "./LibrariesV202";
import { createPergamonPanoramaV202 } from "./PergamonPanoramaV202";
import { createBendlerblockV202 } from "./BendlerblockV202";
import { createKudammTreesV205 } from "./KudammTreesV205";
import { createWesternMotorwaysV205 } from "./WesternMotorwaysV205";
import { createReligiousSitesV205 } from "./ReligiousSitesV205";
import { createUraniaArcV206 } from "./UraniaArcV206";
import { createChariteBettenhausV207 } from "./ChariteBettenhausV207";
import { createMinistrySpreeV207 } from "./MinistrySpreeV207";
import { createNorthCorridorV208 } from "./NorthCorridorV208";
import { createEmbassiesV208 } from "./EmbassiesV208";
import { createLabourQuartierV208 } from "./LabourQuartierV208";
import { createPrisonsMemorialsV209 } from "./PrisonsMemorialsV209";
import { createKiezFacadesV209 } from "./KiezFacadesV209";
import { createVolksbuehneOrankeseeV209 } from "./VolksbuehneOrankeseeV209";
import { createAltMitteTransportV206, altMitteSignalPayloadV206 } from "./AltMitteTransportV206";
import { createTrafficSignals, updateVisibleTrafficSignals } from "./TrafficSignals";
import type { VisualMode } from "./visualMode";

/** One representation at a time, including when the surrounding mode changes. */
export function* createOutlineLandmarksV182Steps(
  initialMode: VisualMode,
  beforeRelease?: (root: Group) => void,
): Generator<void, Group> {
  const root = new Group();
  root.name = "Berlin outline landmark additions v182";
  let native: boolean | undefined;
  let kites: Group | undefined;
  let nativeSignals: Group | null | undefined;
  root.userData.update = (timestamp: number, camera: import("three").Camera, reducedMotion = false) =>
    kites?.userData.update(timestamp, camera, reducedMotion) ?? false;
  root.userData.updateTrafficSignals = (timestamp: number, camera: import("three").Camera, reducedMotion = false, lightsOn = true) =>
    nativeSignals ? updateVisibleTrafficSignals(nativeSignals, camera, timestamp, reducedMotion, lightsOn) : false;
  function* setModeSteps(mode: VisualMode): Generator<void> {
    const nextNative = mode === "minecraft";
    if (native !== nextNative) {
      // Disposal releases GPU handles, but the viewer's residency/warmup maps
      // intentionally retain CPU owners for re-upload. Unregister the old
      // family while all its children are still reachable, before rebuilding.
      if (root.children.length) beforeRelease?.(root);
      disposeOutlineConstruction(root);
      root.add(nextNative ? createMinecraftSteglitzV182() : createSteglitzV182());
      yield;
      root.add(createCityRecognitionV182(nextNative));
      yield;
      root.add(nextNative ? createMinecraftJusticePalaceV183() : createJusticePalaceV183());
      yield;
      root.add(createNeueNationalgalerieV183(nextNative));
      yield;
      root.add(nextNative ? createMinecraftAlexanderStationsV183() : createAlexanderStationsV183());
      yield;
      root.add(createSpreeLandmarksV183(nextNative));
      yield;
      root.add(nextNative ? createMinecraftScheunenFacadesV183() : createScheunenFacadesV183());
      yield;
      root.add(createSchoolsV185(nextNative));
      yield;
      root.add(createPublicPlacesV185(nextNative));
      yield;
      root.add(createKudammTreesV205(nextNative));
      yield;
      root.add(createWesternMotorwaysV205(nextNative));
      yield;
      root.add(createReligiousSitesV205(nextNative));
      yield;
      root.add(createNorthV185(nextNative));
      yield;
      root.add(nextNative ? createMinecraftSouthKiezV185() : createSouthKiezV185());
      yield;
      root.add(nextNative ? createMinecraftAltMitteEdgesV186() : createAltMitteEdgesV186());
      yield;
      root.add(nextNative ? createMinecraftWesternLandmarksV187() : createWesternLandmarksV187());
      yield;
      root.add(createSouthWestLandmarksV187(nextNative));
      yield;
      root.add(nextNative ? createMinecraftEastLandmarksV187() : createEastLandmarksV187());
      yield;
      root.add(createUraniaLuetzowV188(nextNative, false));
      yield;
      root.add(createVolksbuehneV189(nextNative));
      yield;
      root.add(createSuhrkampPfefferbergV189(nextNative));
      yield;
      root.add(createAlexanderplatzV189(nextNative));
      yield;
      root.add(createParkSitesV190(nextNative));
      yield;
      root.add(nextNative ? createMinecraftNorthSitesV190() : createNorthSitesV190());
      yield;
      root.add(createGrunewaldLandmarksV190(nextNative));
      yield;
      root.add(createRailStationsV190(nextNative));
      yield;
      root.add(createCentreAccessV192(nextNative));
      yield;
      root.add(createZionskirchplatzV193(nextNative));
      yield;
      root.add(createArkonaplatzV193(nextNative));
      yield;
      root.add(createTegelMotorwayV194(nextNative));
      yield;
      root.add(createViktoriaparkV194(nextNative));
      yield;
      root.add(createAirportsV194(nextNative));
      yield;
      root.add(createWestLakesV194(nextNative));
      yield;
      root.add(createTeufelsbergStationV195(nextNative));
      yield;
      root.add(createDrachenbergLawnV195(nextNative));
      yield;
      root.add(createLindenCorridorV197(nextNative));
      yield;
      root.add(createTegelSpandauV198(nextNative));
      yield;
      root.add(createEastParksV198(nextNative));
      yield;
      root.add(createNorthParksV198(nextNative));
      yield;
      root.add(createIccV199(nextNative));
      yield;
      root.add(createFunkturmV199(nextNative));
      yield;
      root.add(createCemeteryGrunewaldV199(nextNative));
      yield;
      root.add(createCentralSitesV200(nextNative));
      yield;
      root.add(createLibrariesV202(nextNative));
      yield;
      root.add(createPergamonPanoramaV202({ minecraft: nextNative }));
      yield;
      if (nextNative) root.add(createBendlerblockV202(true));
      yield;
      root.add(createRegionOutlinesV200(nextNative));
      yield;
      root.add(createBerlinBoundariesV200(nextNative));
      yield;
      if (nextNative) root.add(createMinecraftCharlottenburgerTorV201());
      yield;
      root.add(createWuhlheideV201(nextNative));
      yield;
      root.add(createWaldbuehneV201(nextNative));
      yield;
      root.add(createChariteBettenhausV207(nextNative));
      yield;
      root.add(createMinistrySpreeV207(nextNative));
      yield;
      root.add(createNorthCorridorV208(nextNative));
      yield;
      root.add(createEmbassiesV208(nextNative));
      yield;
      root.add(createLabourQuartierV208(nextNative));
      yield;
      root.add(createPrisonsMemorialsV209(nextNative));
      yield;
      root.add(createKiezFacadesV209(nextNative));
      yield;
      root.add(createVolksbuehneOrankeseeV209(nextNative));
      yield;
      root.add(createUraniaArcV206(nextNative));
      yield;
      root.add(createAltMitteTransportV206(nextNative));
      yield;
      nativeSignals = nextNative ? createTrafficSignals(altMitteSignalPayloadV206(), null, { native: true }) : undefined;
      if (nativeSignals) root.add(nativeSignals);
      yield;
      kites = createDrachenbergKitesV195(nextNative);
      root.add(kites);
      yield;
      for (const child of root.children) child.userData.nativeMinecraft = nextNative;
      native = nextNative;
    }
    root.traverse(object => {
      const mesh = object as Mesh;
      const material = object.userData[mode === "night" ? "nightMaterial" : "dayMaterial"];
      if (material) mesh.material = material;
    });
  }
  root.userData.setMode = (mode: VisualMode) => {
    for (const _step of setModeSteps(mode)) { /* Existing synchronous mode API. */ }
  };
  let completed = false;
  try {
    yield* setModeSteps(initialMode);
    completed = true;
    return root;
  } finally {
    if (!completed) disposeOutlineConstruction(root);
  }
}

/** Release unpublished partial work as well as completed mode families. */
export function disposeOutlineConstruction(root: Group): void {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
  root.traverse(object => {
    const mesh = object as Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    for (const value of [mesh.material, object.userData.dayMaterial, object.userData.nightMaterial]) {
      for (const material of Array.isArray(value) ? value : [value]) if (material instanceof Material) materials.add(material);
    }
    // Three retains per-instance GPU attributes separately from geometry.
    if ((mesh as Mesh & { isInstancedMesh?: boolean }).isInstancedMesh) (mesh as Mesh & { dispose(): void }).dispose();
  });
  root.clear();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

/** Synchronous callers keep identical geometry and ordering. */
export function createOutlineLandmarksV182(initialMode: VisualMode, beforeRelease?: (root: Group) => void): Group {
  const steps = createOutlineLandmarksV182Steps(initialMode, beforeRelease);
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}
