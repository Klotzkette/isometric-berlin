/** Frozen eager fields in the already changed v270 main chunks.
 * Source encoding only: retain eager evaluation, strong identity, descriptors
 * and pure per-field tree shaking. Never apply this to lazy/weak fields.
 */
export const LOSSLESS_EAGER_FIELDS_V270: Readonly<Record<string, readonly string[]>> = {
  "data/aegCampusV241CorePrevious.json": [
    "owners"
  ],
  "data/aegCampusV241Navigation.json": [
    "sites"
  ],
  "data/albrechtstrasseV248Details.json": [
    "boxes",
    "nativeRows"
  ],
  "data/alexanderStationsV183Source.json": [
    "conflicts",
    "outerOwners"
  ],
  "data/alexanderplatzV189.json": [
    "boxes"
  ],
  "data/allotmentsV264.json": [
    "keys"
  ],
  "data/altMitteAppearanceV213.json": [
    "palette"
  ],
  "data/altMitteDrawnV169Source.json": [
    "chunkFiles"
  ],
  "data/altMitteGroundSeamsV206.json": [
    "spans_u32",
    "tops_f32"
  ],
  "data/altMitteTransportCorrectionsV206.json": [
    "corrections"
  ],
  "data/altMitteV169Ownership.json": [
    "prismIds"
  ],
  "data/arenaStationV225Navigation.json": [
    "owners",
    "roofTriangles"
  ],
  "data/arenaStationV225Ownership.json": [
    "navigationRecords",
    "records"
  ],
  "data/arenaStationV225Profile.json": [
    "arena"
  ],
  "data/arkonaplatzV193.json": [
    "benches",
    "pavingRings",
    "stalls",
    "trees"
  ],
  "data/auguststrasseMuralV270Profile.json": [
    "nativeFootprints"
  ],
  "data/bendlerblockV202Navigation.json": [
    "columns",
    "nativeRoofFaces",
    "parts"
  ],
  "data/berAirportRoofPatchV236.json": [
    "nativeRings",
    "nativeRows"
  ],
  "data/berAirportV205.json": [
    "buildings"
  ],
  "data/berlinWallMemorialV174Navigation.json": [
    "buildings",
    "posts",
    "roofTriangles",
    "solids"
  ],
  "data/bndHeadquartersV174Navigation.json": [
    "upperParts"
  ],
  "data/botanicalV230Navigation.json": [
    "groundLayers",
    "nativeWater",
    "water"
  ],
  "data/breitscheidTowersNavigation.json": [
    "nativeRoofCells",
    "parts",
    "roofTriangles"
  ],
  "data/bundeswehrHospitalV215Drawn.json": [
    "lines",
    "meshes"
  ],
  "data/bundeswehrHospitalV215Navigation.json": [
    "nativeChangedRoofCells",
    "newFamilyRoofs",
    "oldTargetRoofs"
  ],
  "data/bundeswehrHospitalV215Ownership.json": [
    "records"
  ],
  "data/cafeNeuerSeeV164Navigation.json": [
    "legacyPrisms",
    "nativeRoofCells",
    "parts",
    "roofTriangles"
  ],
  "data/campusNordV266.json": [
    "mensa",
    "neighbours",
    "rhoda"
  ],
  "data/campusNordV266AltMittePrevious.json": [
    "records"
  ],
  "data/cemeteryGrunewaldV199Drawn.json": [
    "colors",
    "positions"
  ],
  "data/cemeteryGrunewaldV199Navigation.json": [
    "drawn",
    "native"
  ],
  "data/centralNamedV230Envelopes.json": [
    "sites"
  ],
  "data/centralNamedV230Native.json": [
    "sites"
  ],
  "data/centralNamedV230Navigation.json": [
    "sites"
  ],
  "data/centralNamedV230Ownership.json": [
    "navigationRecords",
    "records"
  ],
  "data/centralSitesV200.json": [
    "owners"
  ],
  "data/centralSitesV200Correction.json": [
    "native",
    "ownershipAudit",
    "rawOsmEvidence"
  ],
  "data/centralSitesV200Navigation.json": [
    "buildings"
  ],
  "data/centralSitesV200Replacement.json": [
    "replacements"
  ],
  "data/chariteBettenhausV207.json": [
    "nightBoxes",
    "nightNativeBlocks",
    "walls"
  ],
  "data/chariteBridgesV265.json": [
    "sites"
  ],
  "data/chariteBridgesV265AltMittePrevious.json": [
    "records"
  ],
  "data/chariteBridgesV265RetainedNative.json": [
    "triangles"
  ],
  "data/chariteCampusV265.json": [
    "parts"
  ],
  "data/chariteRailV261.json": [
    "parts"
  ],
  "data/charlottenburgerTorV201Navigation.json": [
    "nativeColumns",
    "primitives"
  ],
  "data/citadelCrownV230Previous.json": [
    "drawnVertices"
  ],
  "data/cityCoverageScopeV183.json": [
    "footprint"
  ],
  "data/cityRecognitionV182.json": [
    "features"
  ],
  "data/cityStreetsV249.json": [
    "ids"
  ],
  "data/cityWestCinemasV166Navigation.json": [
    "legacyPrisms",
    "parents",
    "parts"
  ],
  "data/citywestStreetsV235.json": [
    "packets"
  ],
  "data/civicV246NativeFaces.json": [
    "green",
    "rosa",
    "spd"
  ],
  "data/colonnadesCorePreviousV231.json": [
    "owners"
  ],
  "data/colonnadesV231Navigation.json": [
    "columns",
    "passageSamples",
    "rings",
    "roofTriangles"
  ],
  "data/columbiahalleV257.json": [
    "drawn"
  ],
  "data/danzigerTramV249.json": [
    "boxes",
    "nativeBoxes",
    "rails",
    "solids"
  ],
  "data/districtCourtsV229CorePrevious.json": [
    "owners"
  ],
  "data/districtCourtsV229Navigation.json": [
    "sites"
  ],
  "data/districtCourtsV229Ownership.json": [
    "navigationRecords",
    "records"
  ],
  "data/dorotheenstadtV266.json": [
    "drawn",
    "graves",
    "minecraft",
    "profile"
  ],
  "data/dorotheenstadtV266Previous.json": [
    "records"
  ],
  "data/drachenbergLawnV195.json": [
    "drawn",
    "native"
  ],
  "data/eastCinemasV260Navigation.json": [
    "nativeShellCells"
  ],
  "data/eastCinemasV260Ownership.json": [
    "records"
  ],
  "data/eastParksV198.json": [
    "benches",
    "buildings",
    "cenotaphs",
    "memorial",
    "park"
  ],
  "data/elevatedCoreOwnersV238.json": [
    "navigationSolids",
    "previousColumns",
    "previousPrisms"
  ],
  "data/embassiesV208.json": [
    "cylinders",
    "faces"
  ],
  "data/eurefTransfersV262.json": [
    "packets"
  ],
  "data/eurefV262.json": [
    "buildings",
    "gasometer"
  ],
  "data/feuerwacheKreuzbergV267.json": [
    "packets"
  ],
  "data/feuerwacheKreuzbergV267PreviousProfiles.json": [
    "records"
  ],
  "data/floodExtensionV205.json": [
    "chunks"
  ],
  "data/fountainNavigationV248.json": [
    "drawn",
    "native"
  ],
  "data/friedrichshainV266.json": [
    "chunks"
  ],
  "data/fritzRodelbahnV229.json": [
    "models"
  ],
  "data/fritzRodelbahnV229Navigation.json": [
    "footprint"
  ],
  "data/gendarmenBndContextV214Source.json": [
    "buildings"
  ],
  "data/gipsKoppenV252.json": [
    "boxes",
    "rods"
  ],
  "data/golgathaV270.json": [
    "drawn"
  ],
  "data/golgathaV270Colours.json": [
    "packets"
  ],
  "data/golgathaV270Previous.json": [
    "records"
  ],
  "data/golgathaV270Profile.json": [
    "nativeColumns",
    "nativeFootprints",
    "roofTriangles"
  ],
  "data/greyFacadesV263.json": [
    "packets"
  ],
  "data/grunewaldLandmarksV190Native.json": [
    "sites"
  ],
  "data/hackescherMarktV163Navigation.json": [
    "legacyPrisms",
    "nativeRoofCells",
    "parts",
    "roofTriangles"
  ],
  "data/hansaLibraryV237.json": [
    "parts"
  ],
  "data/hbfDrawnTerrainBoundaryV252.json": [
    "cells_u32",
    "edges_f32",
    "triangles_f32"
  ],
  "data/hbfNorthRailTerrainBoundary.json": [
    "cells_u32",
    "edges_f32",
    "triangles_f32"
  ],
  "data/hermannEhlersFountainV248.json": [
    "boxes",
    "nativeRows",
    "surfaces"
  ],
  "data/hermannEhlersV247Details.json": [
    "nativeRows",
    "surfaces"
  ],
  "data/hospitalV228Navigation.json": [
    "sites"
  ],
  "data/houseCurbsV233.json": [
    "ids"
  ],
  "data/houseDoorsV233.json": [
    "ids"
  ],
  "data/huthmacherNavigation.json": [
    "nativeRoofCells",
    "parts",
    "roofTriangles"
  ],
  "data/iccV199Navigation.json": [
    "buildings"
  ],
  "data/ihzV241Previous.json": [
    "records"
  ],
  "data/jamesSimonTerrainBoundary.json": [
    "cells_u32",
    "edges_f32",
    "triangles_f32"
  ],
  "data/justicePalaceV183.json": [
    "estimatedWallSkins",
    "features"
  ],
  "data/kalkscheuneFacadesV218.json": [
    "walls"
  ],
  "data/kalkscheuneOwnershipV218.json": [
    "records"
  ],
  "data/kiezFacadesV209.json": [
    "blocks",
    "boxes",
    "shellBlocks",
    "surfaces"
  ],
  "data/kiezSitesOwnershipV209.json": [
    "coarseOwners",
    "records"
  ],
  "data/kosmosV166Navigation.json": [
    "nativeRoofCells",
    "parts",
    "roofTriangles"
  ],
  "data/kraftwerkBerlinV268.json": [
    "profile"
  ],
  "data/kranzlerV165Navigation.json": [
    "legacyPrisms",
    "parts",
    "roofTriangles"
  ],
  "data/kreuzbergStreetsV267.json": [
    "chunks"
  ],
  "data/kudammTreesV205.json": [
    "sourceIds",
    "trees"
  ],
  "data/labourQuartierV208.json": [
    "owners",
    "surfaces"
  ],
  "data/lennonV250.json": [
    "boxes",
    "rods"
  ],
  "data/librariesV202.json": [
    "owners"
  ],
  "data/lindenCorridorV197.json": [
    "owners"
  ],
  "data/litfinNeighboursV215Source.json": [
    "buildings"
  ],
  "data/littenInstanzV257.json": [
    "missingCourtFaces",
    "references"
  ],
  "data/mainStreetSignalsV254.json": [
    "signals"
  ],
  "data/marzahnScopeV230.json": [
    "footprint"
  ],
  "data/mierendorffV269.json": [
    "profile"
  ],
  "data/ministrySpreeV207.json": [
    "owners",
    "surfaces"
  ],
  "data/moabitHousesCoreV269.json": [
    "core",
    "native"
  ],
  "data/moabitJusticeV166Navigation.json": [
    "legacyPrisms",
    "parts"
  ],
  "data/museumBridgePreviousV243.json": [
    "records"
  ],
  "data/neueNationalgalerieV183Source.json": [
    "parts"
  ],
  "data/neueSynagogeV167Navigation.json": [
    "parts",
    "roofTriangles"
  ],
  "data/neukoellnPlacesV210Navigation.json": [
    "owners",
    "roofTriangles"
  ],
  "data/neukoellnPlacesV210Ownership.json": [
    "coarseOwners",
    "legacyDetailRecords",
    "lineRecords",
    "navigationRecords",
    "records"
  ],
  "data/nordMauerparkV266.json": [
    "chunks"
  ],
  "data/nordicAndKasV246.json": [
    "copper",
    "faces",
    "nativeCells"
  ],
  "data/northCityScopeV190.json": [
    "footprint"
  ],
  "data/northParksV198Buildings.json": [
    "heroes",
    "nativeHeroBoxes"
  ],
  "data/northParksV198Terrain.json": [
    "waters"
  ],
  "data/northV185.json": [
    "beds",
    "faces",
    "owners"
  ],
  "data/olympicGroundsV201.json": [
    "gatewayOffsets"
  ],
  "data/orankeseeMarginV209.json": [
    "drawn",
    "native"
  ],
  "data/orankeseeV209.json": [
    "sand",
    "shoreline"
  ],
  "data/ostkreuzV190.json": [
    "navigation",
    "roofs",
    "tracks"
  ],
  "data/outerFacadesV262.json": [
    "packets"
  ],
  "data/outerMaterialsV232.json": [
    "packets"
  ],
  "data/outerMaterialsV254.json": [
    "packets"
  ],
  "data/outerMaterialsV263.json": [
    "packets"
  ],
  "data/pankeNativeBanksV229.json": [
    "banks"
  ],
  "data/panoramaFacadeV202.json": [
    "records"
  ],
  "data/parkSitesV190.json": [
    "basins",
    "benches",
    "edges",
    "woodlandTrees"
  ],
  "data/parkTerrainV229Profile.json": [
    "offsets"
  ],
  "data/playgroundsV255.json": [
    "packetSites",
    "sites"
  ],
  "data/potsdamerContextV214Profile.json": [
    "owners"
  ],
  "data/potsdamerWestV266.json": [
    "colors",
    "nativeRoofBlocks",
    "nativeSurfaceColumns",
    "positions"
  ],
  "data/prenzlbergV264Native.json": [
    "sites"
  ],
  "data/prenzlbergV264Ownership.json": [
    "lineRecords",
    "navigationRecords",
    "records"
  ],
  "data/prisonsMemorialsOwnershipV209.json": [
    "lineRecords",
    "navigationRecords",
    "records",
    "retainedOwners"
  ],
  "data/prisonsMemorialsV209Envelopes.json": [
    "sourceIds"
  ],
  "data/prisonsMemorialsV209Navigation.json": [
    "barriers",
    "gates",
    "sites"
  ],
  "data/publicPlacesV185.json": [
    "boxes",
    "rods"
  ],
  "data/publicPlacesV185Native.json": [
    "boxes"
  ],
  "data/quartier207V241Previous.json": [
    "records"
  ],
  "data/railStationsV190.json": [
    "routes",
    "stations"
  ],
  "data/ringCityScopeV182.json": [
    "footprint"
  ],
  "data/ringStationDetailsV205.json": [
    "stations"
  ],
  "data/ringStationsV232.json": [
    "sites"
  ],
  "data/roofHouseV233.json": [
    "keys"
  ],
  "data/rosenthalerV228.json": [
    "facades"
  ],
  "data/rosenthalerV228Ground.json": [
    "3_-3.drawn",
    "3_-3.minecraft",
    "4_-3.drawn",
    "4_-3.minecraft"
  ],
  "data/scheunenFacadesV183.json": [
    "boxes"
  ],
  "data/scheunenV265.json": [
    "chunks"
  ],
  "data/schlesischesTorV267.json": [
    "ring",
    "roofs"
  ],
  "data/schlossEastNavigation.json": [
    "footprint",
    "native_runs"
  ],
  "data/schlossplatzV239AltMittePrevious.json": [
    "lineRecords",
    "previousNavigationParts"
  ],
  "data/schlossplatzV239Owners.json": [
    "navigationSolids",
    "previousColumns"
  ],
  "data/schlossplatzV239PreviousNavigation.json": [
    "parts"
  ],
  "data/schlossstrasseV247Details.json": [
    "boxes",
    "nativeRows",
    "surfaces"
  ],
  "data/schoolsPlacesV205.json": [
    "places"
  ],
  "data/schoolsV185.json": [
    "boxes",
    "nativeRows"
  ],
  "data/sintiRomaPavingV256.json": [
    "shards"
  ],
  "data/spanishEmbassyV164Navigation.json": [
    "legacyPrisms",
    "nativeRoofCells",
    "parts",
    "roofTriangles"
  ],
  "data/spreeBridgeCorePreviousV242.json": [
    "records"
  ],
  "data/spreeBridgesV242.json": [
    "packets"
  ],
  "data/spreeFacadesV231.json": [
    "sites"
  ],
  "data/spreeFacadesV231Ownership.json": [
    "appearance",
    "records"
  ],
  "data/spreeLandmarksV183Source.json": [
    "features"
  ],
  "data/spreeRailings.json": [
    "rails"
  ],
  "data/springerV215Drawn.json": [
    "meshes"
  ],
  "data/springerV215Navigation.json": [
    "nativeChangedRoofCells",
    "roofTriangles"
  ],
  "data/springerV215Ownership.json": [
    "records"
  ],
  "data/staatsbibliothekV241Previous.json": [
    "blocks",
    "boxes",
    "lineRecords",
    "surfaces"
  ],
  "data/staatsoperV240Previous.json": [
    "boxes",
    "records",
    "segments"
  ],
  "data/stadthausV239Replacement.json": [
    "boxes",
    "segments"
  ],
  "data/steglitzCourtGroundV251.json": [
    "boxes",
    "nativeRows",
    "rods"
  ],
  "data/steglitzCourtGroundV251Floor.json": [
    "native"
  ],
  "data/steglitzCourtyardV251.json": [
    "boxes",
    "nativeColors",
    "removeSourceBoxes",
    "rods"
  ],
  "data/steglitzGroundV247.json": [
    "drawn",
    "native"
  ],
  "data/steglitzMotorwayV226.json": [
    "colors",
    "positions"
  ],
  "data/steglitzMotorwayV226Navigation.json": [
    "polygons"
  ],
  "data/steglitzSchoolV250.json": [
    "boxes",
    "nativeColors",
    "remove",
    "rods"
  ],
  "data/steglitzV182Navigation.json": [
    "buildings"
  ],
  "data/steglitzV246Details.json": [
    "boxes",
    "nativeRows"
  ],
  "data/suhrkampPfefferbergV189.json": [
    "faces"
  ],
  "data/surroundingCityScope.json": [
    "footprint"
  ],
  "data/tachelesFrontsV270Profile.json": [
    "sites"
  ],
  "data/tachelesFrontsV270Receipts.json": [
    "packets"
  ],
  "data/tachelesV167Navigation.json": [
    "nativeRoofCells",
    "parts",
    "roofTriangles",
    "sourceParts"
  ],
  "data/teehausRuinV168Navigation.json": [
    "legacyPrisms",
    "parts",
    "walls"
  ],
  "data/tegelMotorwayV194.json": [
    "positions"
  ],
  "data/tegelSpandauV198Navigation.json": [
    "nativeWaterPolygons",
    "waterPolygons"
  ],
  "data/tempelhofV261.json": [
    "blocks"
  ],
  "data/teufelsbergStationV195.json": [
    "navigation"
  ],
  "data/townhallV227CorePrevious.json": [
    "owners"
  ],
  "data/townhallV227Ownership.json": [
    "blocked",
    "lineRecords",
    "navigationRecords"
  ],
  "data/townhallV227Previous.json": [
    "features"
  ],
  "data/tuWaterV168Navigation.json": [
    "legacyPrisms",
    "parts",
    "sourceParts",
    "structureNativeBands",
    "structureNativeFineBands"
  ],
  "data/ubahnEntrancesV261.json": [
    "stairs"
  ],
  "data/unterDenLindenBlockStreets.json": [
    "runs"
  ],
  "data/uraniaArcV206Navigation.json": [
    "legacyVoxelColumns",
    "parts"
  ],
  "data/uraniaLuetzowV188.json": [
    "beds",
    "park",
    "paths"
  ],
  "data/viktoriaparkV194.json": [
    "features",
    "points",
    "surfaces",
    "waterRings"
  ],
  "data/volksbuehneEnvelopeV209.json": [
    "drawn",
    "rings",
    "volumes"
  ],
  "data/volksbuehneV189.json": [
    "building"
  ],
  "data/volksbuehneV209Navigation.json": [
    "flatVolumes"
  ],
  "data/waldbuehneV201Navigation.json": [
    "deck",
    "floorTriangles",
    "roofTriangles"
  ],
  "data/weddingSitesV210Envelopes.json": [
    "barriers",
    "blocks",
    "surfaces"
  ],
  "data/weddingStationCorePreviousV229.json": [
    "owners"
  ],
  "data/westCivicV210Navigation.json": [
    "volumes"
  ],
  "data/westCivicV210Previous.json": [
    "boxes",
    "segments"
  ],
  "data/westIndustrialV230Ownership.json": [
    "authorizedOwners",
    "lineRecords",
    "replacementParents"
  ],
  "data/westLakesV194Navigation.json": [
    "buildings",
    "drawn"
  ],
  "data/westSquaresV163Navigation.json": [
    "legacyPrisms",
    "nativeRoofCells",
    "parts",
    "roofTriangles"
  ],
  "data/westVenuesV260.json": [
    "ribSegments",
    "sourceColors",
    "sourcePartIds"
  ],
  "data/westVenuesV260Navigation.json": [
    "legacyPrisms",
    "nativeRoofCells",
    "parts"
  ],
  "data/westernStadiumV187Navigation.json": [
    "cutout",
    "trackOuter"
  ],
  "data/windkanalV261.json": [
    "blocks"
  ],
  "data/zionskirchplatzV193.json": [
    "owners",
    "surfaces"
  ],
  "data/zionskirchplatzV193Evidence.json": [
    "selectedFaces"
  ],
  "data/zooGroundsV165Navigation.json": [
    "legacyPrisms",
    "parts"
  ],
  "data/zooPalastV260.json": [
    "nativeOccupiedCells",
    "studs"
  ],
  "data/zooStationV165Navigation.json": [
    "legacyPrisms",
    "parts",
    "platforms",
    "roofTriangles",
    "stairs",
    "stationFootprint"
  ],
  "pergamonPanoramaV202Source.json": [
    "native_replacement_columns"
  ]
};
