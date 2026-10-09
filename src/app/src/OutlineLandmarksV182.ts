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
import type { VisualMode } from "./visualMode";

/** One representation at a time, including when the surrounding mode changes. */
export function createOutlineLandmarksV182(
  initialMode: VisualMode,
  beforeRelease?: (root: Group) => void,
): Group {
  const root = new Group();
  root.name = "Berlin outline landmark additions v182";
  let native: boolean | undefined;
  let kites: Group | undefined;
  root.userData.update = (timestamp: number, camera: import("three").Camera, reducedMotion = false) =>
    kites?.userData.update(timestamp, camera, reducedMotion) ?? false;
  root.userData.setMode = (mode: VisualMode) => {
    const nextNative = mode === "minecraft";
    if (native !== nextNative) {
      // Disposal releases GPU handles, but the viewer's residency/warmup maps
      // intentionally retain CPU owners for re-upload. Unregister the old
      // family while all its children are still reachable, before rebuilding.
      if (root.children.length) beforeRelease?.(root);
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
      root.add(nextNative ? createMinecraftSteglitzV182() : createSteglitzV182());
      root.add(createCityRecognitionV182(nextNative));
      root.add(nextNative ? createMinecraftJusticePalaceV183() : createJusticePalaceV183());
      root.add(createNeueNationalgalerieV183(nextNative));
      root.add(nextNative ? createMinecraftAlexanderStationsV183() : createAlexanderStationsV183());
      root.add(createSpreeLandmarksV183(nextNative));
      root.add(nextNative ? createMinecraftScheunenFacadesV183() : createScheunenFacadesV183());
      root.add(createSchoolsV185(nextNative));
      root.add(createPublicPlacesV185(nextNative));
      root.add(createNorthV185(nextNative));
      root.add(nextNative ? createMinecraftSouthKiezV185() : createSouthKiezV185());
      root.add(nextNative ? createMinecraftAltMitteEdgesV186() : createAltMitteEdgesV186());
      root.add(nextNative ? createMinecraftWesternLandmarksV187() : createWesternLandmarksV187());
      root.add(createSouthWestLandmarksV187(nextNative));
      root.add(nextNative ? createMinecraftEastLandmarksV187() : createEastLandmarksV187());
      root.add(createUraniaLuetzowV188(nextNative));
      root.add(createVolksbuehneV189(nextNative));
      root.add(createSuhrkampPfefferbergV189(nextNative));
      root.add(createAlexanderplatzV189(nextNative));
      root.add(createParkSitesV190(nextNative));
      root.add(nextNative ? createMinecraftNorthSitesV190() : createNorthSitesV190());
      root.add(createGrunewaldLandmarksV190(nextNative));
      root.add(createRailStationsV190(nextNative));
      root.add(createCentreAccessV192(nextNative));
      root.add(createZionskirchplatzV193(nextNative));
      root.add(createArkonaplatzV193(nextNative));
      root.add(createTegelMotorwayV194(nextNative));
      root.add(createViktoriaparkV194(nextNative));
      root.add(createAirportsV194(nextNative));
      root.add(createWestLakesV194(nextNative));
      root.add(createTeufelsbergStationV195(nextNative));
      root.add(createDrachenbergLawnV195(nextNative));
      root.add(createLindenCorridorV197(nextNative));
      root.add(createTegelSpandauV198(nextNative));
      root.add(createEastParksV198(nextNative));
      root.add(createNorthParksV198(nextNative));
      root.add(createIccV199(nextNative));
      root.add(createFunkturmV199(nextNative));
      root.add(createCemeteryGrunewaldV199(nextNative));
      root.add(createCentralSitesV200(nextNative));
      root.add(createLibrariesV202(nextNative));
      root.add(createPergamonPanoramaV202({ minecraft: nextNative }));
      if (nextNative) root.add(createBendlerblockV202(true));
      root.add(createRegionOutlinesV200(nextNative));
      root.add(createBerlinBoundariesV200(nextNative));
      if (nextNative) root.add(createMinecraftCharlottenburgerTorV201());
      root.add(createWuhlheideV201(nextNative));
      root.add(createWaldbuehneV201(nextNative));
      kites = createDrachenbergKitesV195(nextNative);
      root.add(kites);
      for (const child of root.children) child.userData.nativeMinecraft = nextNative;
      native = nextNative;
    }
    root.traverse(object => {
      const mesh = object as Mesh;
      const material = object.userData[mode === "night" ? "nightMaterial" : "dayMaterial"];
      if (material) mesh.material = material;
    });
  };
  root.userData.setMode(initialMode);
  return root;
}
