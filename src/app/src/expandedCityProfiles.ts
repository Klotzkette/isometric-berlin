/**
 * LoD2-anchored front of the Hamburger Bahnhof.
 *
 * The landmark point lies inside the former train hall, not on the entrance
 * facade. The two 26 m LoD2 tower parts fix the facade line and its 30 degree
 * bearing; keeping the offset here prevents a generic point marker from
 * rotating or translating the whole historic head building again.
 */
export const HAMBURGER_BAHNHOF_PROFILE = {
  facadeAxis: [0.8673, -0.4978] as const,
  facadeNormal: [0.4978, 0.8673] as const,
  facadeOffsetFromLandmarkM: [-2.399, 24.148] as const,
  facadeRotationY: Math.PI / 6,
  facadeWidthM: 62,
  forecourtTreatment: "axial-path-and-rondel",
  grounded: true,
  lowerArchCount: 2,
  roofForm: "flat-cornice",
  sourceTowerIds: ["DEBE3DIkXt8PMip6", "DEBE3DlXyRYPJvcY"] as const,
  towerCentresM: [-11.43, 11.43] as const,
  towerHeightM: 26.25,
  upperArcadeCount: 6,
} as const;

/** LoD2-derived envelope of the protected 1960s Rieckhallen freight hall. */
export const RIECKHALLEN_PROFILE = {
  centerOffsetFromLandmarkM: [-2.1326, -1.5085] as const,
  centerWorldM: [-72.289693, -1218.65614] as const,
  crossAxis: [0.931102, -0.364759] as const,
  lengthM: 281.279,
  longAxis: [0.364759, 0.931102] as const,
  measuredHeightM: 9.364,
  minecraftRoofTopY: 17.2,
  roofBandCount: 3,
  roofForm: "flat-mixed-with-low-longitudinal-bands",
  rotationY: 0.373374,
  sourceBuildingId: "DEBE01YYK0002SQl",
  widthM: 16.244,
} as const;

/**
 * Published planning envelope for berlin modern (Museum des 20. Jahrhunderts).
 *
 * The museum is still under construction, so this is deliberately not labelled
 * surveyed as-built geometry. Dimensions come from Herzog & de Meuron's project
 * data; the site axis follows the committed OSM construction boundary.
 */
export const BERLIN_MODERN_PROFILE = {
  bodyHeightM: 11,
  centerWorldM: [-228.499208, 1197.491703] as const,
  footprintLengthM: 120,
  footprintWidthM: 71,
  geometryStatus: "planning-envelope-not-surveyed-as-built",
  groundY: 8,
  grounded: true,
  levelCount: 3,
  roofForm: "north-south-gable-with-photovoltaics",
  roofRiseM: 7,
  rotationY: (-19.74 * Math.PI) / 180,
  source: "Herzog & de Meuron project data and OSM construction-boundary axis",
  totalHeightM: 18,
} as const;

/**
 * LoD2 parts and official monument description for St. Matthaeus.
 *
 * The main footprint supplies the 19.7 degree site bearing. Berlin LoD2
 * separately records the nave, apses and 41.65 m tower, while the monument
 * database documents the three parallel gables, dark-red horizontal brick
 * bands, arcaded tower gallery, octagonal upper stage and copper spire.
 */
export const ST_MATTHAEUS_PROFILE = {
  apsePartIds: [
    "DEBE3DPsKasbHism",
    "DEBE3DMkX1TTal7W",
    "DEBE3DHn5IFj7sZX",
  ] as const,
  footprintLengthM: 32.4,
  footprintWidthM: 20.8,
  geometryStatus:
    "LoD2-part-anchored with official monument facade description",
  groundY: 8,
  mainPartHeightM: 16.567,
  mainPartId: "DEBE3DkIiO30Sz4V",
  rotationY: (-19.55 * Math.PI) / 180,
  source:
    "Berlin LoD2 and Landesdenkmalamt object 09050277; facade detail is not a photogrammetric texture",
  towerHeightM: 41.65,
  towerPartId: "DEBE3DNKPmfUJcjM",
} as const;

/** Metric upper pavilion of Mies van der Rohe's Neue Nationalgalerie. */
export const NEUE_NATIONALGALERIE_PROFILE = {
  columnCount: 8,
  glassInsetM: 7.2,
  glassWidthM: 50.4,
  geometryStatus: "LoD2 footprint axis with published pavilion dimensions",
  groundY: 8,
  roofGridM: 3.6,
  roofWidthM: 64.8,
  rotationY: (-19.58 * Math.PI) / 180,
  source:
    "Berlin LoD2 and Landesdenkmalamt: square gridded roof carried by eight anthracite steel columns",
} as const;

/**
 * Metric Kulturforum register derived from the named Berlin LoD2 parts.
 * World coordinates use the committed scene origin (389500, 5820000).
 * The Gemäldegalerie navigation POI sits near the shared entrance; its metric
 * building centre below deliberately remains independent from that POI.
 */
export const KULTURFORUM_PROFILE = {
  gemaldegalerie: {
    centerWorldM: [-473.956, 1138.208] as const,
    heightM: 23.269,
    lengthM: 135.66,
    sourceBuildingIds: ["DEBE01YYK0002V5W", "DEBE01YYK0002Sq5"] as const,
    widthM: 98.8,
    rotationY: (-16.82 * Math.PI) / 180,
  },
  kammermusiksaal: {
    centerWorldM: [-190.028, 1056.839] as const,
    heightM: 26.347,
    lengthM: 79.81,
    rotationY: (-17.17 * Math.PI) / 180,
    sourcePartCount: 18,
    widthM: 73.23,
  },
  kunstbibliothek: {
    centerWorldM: [-352.437, 1157.775] as const,
    heightM: 20.141,
    lengthM: 61.51,
    rotationY: (-16.65 * Math.PI) / 180,
    sourcePartCount: 15,
    widthM: 61.46,
  },
  kunstgewerbemuseum: {
    centerWorldM: [-301.106, 1009.605] as const,
    heightM: 21.013,
    lengthM: 79.27,
    rotationY: (-25.49 * Math.PI) / 180,
    sourceBuildingId: "DEBE01YYK0002QYw",
    widthM: 76.46,
  },
  philharmonie: {
    centerWorldM: [-139.863, 988.177] as const,
    heightM: 35.665,
    lengthM: 106.21,
    rotationY: (-13.45 * Math.PI) / 180,
    sourcePartCount: 7,
    widthM: 84.48,
  },
  piazzetta: {
    centerWorldM: [-331.0, 1091.5] as const,
    geometryStatus:
      "bounded presentation ramp between LoD2 museum envelopes; not surveyed paving",
    lengthM: 82,
    riseM: 5.4,
    rotationY: (-17 * Math.PI) / 180,
    widthM: 38,
  },
  staatsbibliothek: {
    centerWorldM: [-86.883, 1304.211] as const,
    heightM: 46.651,
    lengthM: 279.65,
    rotationY: (-13.81 * Math.PI) / 180,
    sourcePartCount: 56,
    widthM: 150.01,
  },
  geometryStatus:
    "named Berlin LoD2 envelopes with source-described presentation details",
  sources: [
    "https://www.smb.museum/museen-einrichtungen/kulturforum/museumsgebaeude-sammlungen/ueberblick/",
    "https://www.berliner-philharmoniker.de/en/about-us/philharmonie/architecture/",
    "https://staatsbibliothek-berlin.de/die-staatsbibliothek/die-gebaeude/potsdamer-strasse/baugeschichte",
  ] as const,
} as const;

/** Open-data anchors for the requested Potsdamer/Wilhelmstrasse details. */
export const POTSDAMER_DETAIL_PROFILE = {
  czechEmbassyWorldM: [854.635, 848.762] as const,
  georgElserWorldM: [745.129, 750.639] as const,
  hessenRepresentationWorldM: [455.937, 780.79] as const,
  mallSouthFacadeOffsetM: -59.5,
  northKoreanEmbassyWorldM: [946.346, 832.865] as const,
  potsdamerStationWorldM: [291.008, 1091.994] as const,
  spielbankWorldM: [10.472, 1250.269] as const,
  taylorWessingWorldM: [368.684, 890.551] as const,
  trafficTowerWorldM: [302.391, 1081.736] as const,
  alterDessauerWorldM: [812.54, 838.495] as const,
  geometryStatus:
    "OSM/LoD2 anchored presentation details; underground station layout is schematic",
} as const;

/** OSM/official anchors for the northern corridor recognition layer. */
export const NORTHERN_CITY_PROFILE = {
  annaLindhHouse: {
    centerWorldM: [-171.393, -992.811] as const,
    floorCount: 7,
    geometryStatus: "OSM construction footprint with published project storeys",
    osmWayId: "1283287449",
  },
  bayerSchering: {
    centerWorldM: [-270.888, -2570.283] as const,
    geometryStatus: "OSM campus anchor with presentation facade register",
    osmNodeId: "9848575363",
  },
  bundeswehrHelipad: {
    centerWorldM: [-78.275, -1773.907] as const,
    geometryStatus:
      "OSM mobility-hub polygon; aircraft are presentation staffage",
    osmWayId: "1469416747",
  },
  erikaHess: {
    hallWorldM: [-60.301, -2075.04] as const,
    outdoorRinkWorldM: [-106.705, -2028.517] as const,
    osmHallWayId: "16183708",
    osmRinkWayId: "32979869",
  },
  funbox: {
    addressAnchorWorldM: [-102.823, -1189.993] as const,
    centerWorldM: [-165, -1128] as const,
    eventDates: ["2026-07-23", "2026-09-20"] as const,
    eventListingWorldM: [-140.167, -1134.842] as const,
    footprintLengthM: 96,
    footprintWidthM: 44,
    geometryStatus:
      "temporary 2026 presentation object; address and event-listing anchors with footprint placed southwest on the free Wunderland lot shown by the user-supplied location plan",
    groundY: 4.2,
    maxFeatureHeightM: 9,
    osmAddressNodeId: "7029312961",
    rotationY: 0.59,
    sourceAreaM2: 4_000,
    sourceZoneCount: 10,
    sources: [
      "https://www.visitberlin.de/de/event/funbox",
      "https://www.visitberlin.de/de/blog/top-11-neueroeffnungen-berlin-im-august",
      "https://www.berliner-freizeit-tipps.de/huepfburgen-sprungpark-funbox-auf-dem-wunderland-festplatz-am-hauptbahnhof/",
    ] as const,
  },
  invalidenfriedhof: {
    boardWorldM: [80.888, -1466.868] as const,
    geometryStatus:
      "OSM board anchor with official cemetery and Wall interpretation",
    osmNodeId: "3346038362",
  },
  pankeMouth: {
    centerWorldM: [-281.0, -1954.0] as const,
    geometryStatus:
      "official mouth/fish-passage corridor; bounded visual approximation",
  },
  scharnhorstSubstation: {
    centerWorldM: [-228.433, -2061.27] as const,
    geometryStatus:
      "OSM relation envelope with official monument facade description",
    osmRelationId: "2728348",
  },
} as const;

/**
 * Metric recognition register for Europacity's three northern skyline anchors.
 *
 * EINZ/KPMG and 50Hertz retain their complete Berlin LoD2 shells. Their
 * entries below only describe lightweight facade screens. Upbeat is newer
 * than the committed LoD2 cut, so its current OSM outline is the horizontal
 * anchor while the published 5/11/19-storey composition fixes its vertical
 * steps. Berlin DGM1 samples establish the cross-site elevation differences
 * in the scene's DHHN2016-minus-30 m vertical datum. The two clipping lines
 * are a bounded interpretation of the architects' plan and renders, not
 * surveyed tier outlines.
 */
export const EUROPACITY_PROFILE = {
  lehrterCampus: {
    craneMastHeightM: 46,
    craneWorldM: [-259.5, -716.5] as const,
    currentScaffoldTopM: 10.8,
    currentSlabTopM: 5.15,
    currentState:
      "ground-floor concrete frame, formwork, scaffolding and tower crane observed in the owner's August 2026 photograph; the planned full-height envelope is deliberately not rendered",
    footprintWorldM: [
      [-273, -747],
      [-248, -746],
      [-244, -733],
      [-251, -696],
      [-264, -681],
      [-276, -689],
    ] as const,
    geometryStatus:
      "bounded current-state presentation reconstruction constrained by the OSM Edge Grand Central east facade, the OSM Tiergartentunnel north approach and the official ground-floor plan proportions; not a surveyed construction-stage scan",
    groundY: 5.35,
    observedOn: "2026-08",
    plannedEnvelopeHeightM: 35.5,
    plannedStoreyCount: 9,
    siteUse: "office-and-hotel MK2 under construction",
  },
  einz: {
    basePartIds: [
      "DEBE3DkE869uphiB",
      "DEBE3DY9gOlqzSfm",
      "DEBE3DMnbuS0Za6I",
      "DEBE3DThjS2NFDB6",
    ] as const,
    centerWorldM: [-119.51, -946.392] as const,
    facadeBayCounts: [32, 18] as const,
    facadeGridM: 1.35,
    facadeMaterial: "silver-aluminium-grid-over-calm-blue-grey-glass-shell",
    floorCount: 22,
    footprintDepthM: 24.77,
    footprintLengthM: 42.59,
    geometryStatus:
      "Berlin LoD2 metric shell with source-described facade-screen overlay",
    dgmSceneGroundY: 5.51,
    groundY: 5.6,
    measuredHeightM: 83.794,
    parentBuildingId: "DEBE01AL2TJ0000u",
    podium: {
      centerWorldM: [-141.536, -926.346] as const,
      floorCount: 6,
      footprintDepthM: 28.359,
      footprintLengthM: 50.535,
      measuredHeightM: 26.426,
      sourcePartId: "DEBE3DMnbuS0Za6I",
    },
    rotationY: (51.06 * Math.PI) / 180,
    sourceTowerPartId: "DEBE3De9JUgwVTiy",
  },
  europaplatzNorth: {
    centerWorldM: [-116, -1002] as const,
    constructionZoneCount: 2,
    currentState:
      "temporary 2026 forecourt between the completed EINZ tower and Invalidenstrasse; permanent landscape competition remains unbuilt",
    footprintDepthM: 64,
    footprintLengthM: 112,
    geometryStatus:
      "OSM/LoD2-aligned presentation reconstruction from owner photographs and the official current-state competition documentation",
    groundY: 5.58,
    lampCount: 8,
    observedOn: "2026-08",
    rotationY: -0.43,
    youngTreeCount: 14,
  },
  fiftyHertz: {
    centerWorldM: [-38.748, -1037.844] as const,
    facadeMaterial: "silver-exposed-diagrid",
    floorCount: 13,
    footprintDepthM: 24.56,
    footprintLengthM: 37.47,
    geometryStatus:
      "Berlin LoD2 metric shell with official exposed-structure overlay",
    dgmSceneGroundY: 4.57,
    groundY: 4.7,
    measuredHeightM: 54.975,
    parentBuildingId: "DEBE00YY1AT000Ab",
    rotationY: (21.35 * Math.PI) / 180,
    sourceTowerPartId: "DEBE3Dyir4lZjw1O",
    storeyTiers: [7, 13] as const,
  },
  upbeat: {
    centerWorldM: [-676.632229, -1973.543399] as const,
    facadeMaterial: "warm-brick-grid-with-floor-to-ceiling-glazing",
    footprintWorldM: [
      [-703.63, -1960.28],
      [-697.41, -1969.98],
      [-695.92, -1971.35],
      [-694.1, -1972.19],
      [-675.7, -1971.26],
      [-674.01, -1970.67],
      [-672.57, -1969.31],
      [-665.88, -1961.67],
      [-665.65, -1959.91],
      [-665.75, -1957.3],
      [-670.09, -1950.6],
      [-670.5, -1948.95],
      [-669.81, -1947.05],
      [-668.82, -1945.46],
      [-659.85, -1939.43],
      [-657.97, -1939.02],
      [-655.47, -1939.37],
      [-654.16, -1940.31],
      [-650.02, -1946.57],
      [-648.42, -1947.63],
      [-646.06, -1948.07],
      [-644.37, -1947.76],
      [-629.73, -1943.02],
      [-627.49, -1942.69],
      [-625.78, -1942.93],
      [-624.05, -1943.9],
      [-623.38, -1944.75],
      [-619.79, -1955.11],
      [-619.71, -1956.67],
      [-620.22, -1958.6],
      [-621.84, -1960.21],
      [-624.08, -1961.26],
      [-645.1, -1968.08],
      [-647.5, -1969.62],
      [-662.95, -1987.05],
      [-663.99, -1988.17],
      [-665.53, -1989.09],
      [-667.13, -1989.76],
      [-692.89, -1991.45],
      [-694.24, -1992.35],
      [-695.61, -1993.71],
      [-705.55, -2013.79],
      [-706.8, -2015.29],
      [-709.18, -2016.17],
      [-711.21, -2016.03],
      [-720.99, -2011.2],
      [-722.39, -2010.04],
      [-723.18, -2008.04],
      [-723.13, -2006.11],
      [-712.64, -1985.37],
      [-712.4, -1983.9],
      [-712.53, -1982.15],
      [-712.93, -1980.78],
      [-719.7, -1970.56],
      [-720.1, -1969.01],
      [-719.86, -1967.34],
      [-719, -1965.21],
      [-709.1, -1958.93],
      [-707.72, -1958.71],
      [-706.34, -1958.77],
      [-704.76, -1959.29],
    ] as const,
    geometryStatus:
      "current OSM footprint with published height/storeys, DGM1 terrain datum and plan-derived tier clips",
    groundY: 2.92,
    heightM: 82,
    midTierEastClipWorldX: -670,
    osmWayId: "1214009386",
    storeyTiers: [5, 11, 19] as const,
    terrainDgm1: {
      dhhn2016MedianM: 32.92,
      sampleCount: 2905,
      sceneRangeM: [1.62, 7.07] as const,
      verticalOriginM: 30,
    },
    tierTopHeightsM: [21.579, 47.474, 82] as const,
    towerTierEastClipWorldX: -655,
  },
  sources: [
    "https://www.berlin.de/sen/stadtentwicklung/staedtebau/umfeld-hauptbahnhof/europacity/",
    "https://www.caimmo.com/de/presse/news/artikel/ca-immo-stellt-hochhaus-am-europaplatz-in-berlin-fertig/",
    "https://www.allmannwappner.com/de/projekte/11953/hochhaus-am-europaplatz-berlin",
    "https://www.zwp.de/de/projekte/buerogebaeude/hochhaus-am-europaplatz-berlin/",
    "https://mein.berlin.de/projekte/neugestaltung-europaplatz-nord/information/",
    "https://lehrter-campus.de/",
    "https://www.aukett-heese.de/de/aukett-heese-lehrter-campus-grundsteinlegung-in-berlin/",
    "https://transumed.de/immoreferenzen/hauptbahnhof-mk-ii/",
    "https://www.entwicklungsstadt.de/lehrter-campus-am-hauptbahnhof-baustelle-kommt-kaum-voran/",
    "https://www.openstreetmap.org/way/126125230",
    "https://www.openstreetmap.org/way/42103707",
    "https://www.caimmo.com/de/portfolio/projekt/upbeat/",
    "https://kleihues.com/hochhaus-am-nordhafen-berlin/?lang=en",
    "https://www.50hertz.com/Portals/1/Dokumente/Medien/Pressemitteilungen/2023/20230510-50Hertz-PM-Spatenstich-in-der-Europacity-DE.pdf",
    "https://gdi.berlin.de/data/dgm1/docs/dgm1.pdf",
  ] as const,
} as const;

/**
 * Surveyed Kollhoff-Tower shell and source-backed facade register.
 *
 * Berlin LoD2 splits the one stepped tower into 16 building parts under the
 * same parent id. The published 103 m / 25-storey figures and the ceramic
 * facade material come from Berlin.de; the small clinker bond below is a
 * screen-legible visual inference from the referenced facade photographs,
 * not a surveyed masonry schedule.
 */
export const KOLLHOFF_TOWER_PROFILE = {
  clinkerCourseM: 0.32,
  clinkerModuleM: 0.64,
  clinkerTone: 0xa6533f,
  minecraftClinkerTone: 0xb9684f,
  facadeMaterial: "red-ceramic-cladding",
  facadeStatus:
    "LoD2 metric shell; published height/storeys/material; inferred clinker bond",
  floorPitchM: 103 / 25,
  lod2MaxHeightM: 101.44,
  mortarTone: 0xd2ad99,
  officialHeightM: 103,
  parentBuildingId: "DEBE01YYK0002KM6",
  payloadIds: [
    "gCPv6VJo",
    "3MHnJM2V",
    "DMYCgmHD",
    "SEYrXCfh",
    "6YHth8G0",
    "5dgyjJOD",
    "vkG81ZBV",
    "WtTpo3vD",
    "fu7WNAI1",
    "t2xCWJL4",
    "FanY3Jik",
    "k2aYpkCT",
    "glsd3lgz",
    "ayPyDdQN",
    "OImLDEpb",
    "Jvj6kGqp",
  ] as const,
  sourceBuildingIds: [
    "DEBE3DESgCPv6VJo",
    "DEBE3DvL3MHnJM2V",
    "DEBE3DVJDMYCgmHD",
    "DEBE3DpdSEYrXCfh",
    "DEBE3DeC6YHth8G0",
    "DEBE3DpN5dgyjJOD",
    "DEBE3DkxvkG81ZBV",
    "DEBE3DjvWtTpo3vD",
    "DEBE3DE2fu7WNAI1",
    "DEBE3DuAt2xCWJL4",
    "DEBE3DzsFanY3Jik",
    "DEBE3DJ4k2aYpkCT",
    "DEBE3DwNglsd3lgz",
    "DEBE3DzoayPyDdQN",
    "DEBE3DzEOImLDEpb",
    "DEBE3DY8Jvj6kGqp",
  ] as const,
  storeyCount: 25,
  windowBayPitchM: 3.15,
  windowHeightM: 2.45,
  windowWidthM: 1.08,
} as const;

/**
 * Survey-anchored facade register of Hotel AMANO Grand Central.
 *
 * The footprint and axis are OSM way 237687062; the height and shell remain
 * Berlin LoD2 building part DEBE3DLXM9FjJbtp. Tchoban Voss supplies the
 * six-storey plus setback-storey composition, clinker tone, glazed ground
 * floor and staggered window character.
 */
export const AMANO_GRAND_CENTRAL_PROFILE = {
  centerWorldM: [-51.580233, -927.88822] as const,
  facadeMaterial: "beige-grey changing clinker",
  footprintDepthM: 25.734,
  footprintLengthM: 42.394,
  geometryStatus:
    "OSM footprint and LoD2 height with source-described facade overlay",
  glazedGroundFloorHeightM: 3.6,
  groundY: 5.8,
  officialHeightM: 27.819,
  osmWayId: "237687062",
  parentBuildingId: "DEBE01YYK0002L88",
  rotationY: -1.1968,
  sourceBuildingPartId: "DEBE3DLXM9FjJbtp",
  storeysBelowSetback: 6,
  windowBaysLongFacade: 11,
} as const;

/**
 * Present-day Geschichtspark envelope and the official interpretive plan.
 *
 * The park extent/axis is OSM way 498278335. Internal traces are a documented
 * landscape-architecture reconstruction (not surviving prison geometry): the
 * official Berlin description identifies three five-metre walls, three
 * entrances, four star wings, the central panopticon cube, three circular
 * exercise yards, blood-beech hedges and one walk-in cell.
 */
export const MOABIT_PRISON_PARK_PROFILE = {
  centerWorldM: [-329.097233, -906.302474] as const,
  circularYardCount: 3,
  entranceCount: 3,
  geometryStatus:
    "OSM park envelope with official interpretive-plan reconstruction",
  groundY: 5.9,
  preservedWallHeightM: 5,
  reconstructedCellCount: 1,
  rotationY: 2.019,
  sourceParkWayId: "498278335",
  wallSideCount: 3,
} as const;
