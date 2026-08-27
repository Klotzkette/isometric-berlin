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
    facadeBayCount: 9,
    facadeBandCount: 4,
    heightM: 26.347,
    lengthM: 79.81,
    mainSourcePartId: "DEBE3DbyaJ0e8oAr",
    rotationY: (-17.17 * Math.PI) / 180,
    roofFacetCueCount: 7,
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
    facadeBayCount: 11,
    facadeBandCount: 4,
    heightM: 35.665,
    lengthM: 106.21,
    mainSourcePartId: "DEBE3DTtXzEkeXsu",
    rotationY: (-13.45 * Math.PI) / 180,
    roofFacetCueCount: 9,
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

/**
 * OSM-bounded lawn sculpture of Tilla-Durieux-Park.
 *
 * The park is not a pair of stacked landscape boxes. Its two grass lobes form
 * one long strip, split only by the central seesaw court, and twist in opposite
 * directions around the longitudinal axis. Scene coordinates below are the
 * two mapped grass polygons (OSM ways 840814492/840814493) transformed from
 * EPSG:25833 around the committed (389500, 5820000) origin.
 */
export const TILLA_DURIEUX_PROFILE = {
  centralCourtWorldM: [204.04, 1434.7] as const,
  centralCourtWidthM: 30,
  centralCourtLengthM: 16,
  geometryStatus:
    "OSM-bounded grass lobes with source-described 4.5 m counter-twist; presentation heights are not a surveyed terrain surface",
  groundY: 5.2,
  lawnWidthM: 30,
  maxHeightM: 4.5,
  northLawn: {
    areaM2: 6913,
    centerEastWorldM: [225.263, 1422.502] as const,
    centerWestWorldM: [196.256, 1411.333] as const,
    courtHeightsM: { east: 1.7, west: 1.3 } as const,
    endEastWorldM: [304.927, 1205.59] as const,
    endHeightsM: { east: 4.5, west: 0.55 } as const,
    endWestWorldM: [268.729, 1219.275] as const,
    osmWayId: "840814492",
  },
  osmRelationId: "11518845",
  seesawCount: 5,
  seesawLengthM: 21,
  terrainBuryM: 0.55,
  southLawn: {
    areaM2: 5082,
    centerEastWorldM: [212.158, 1457.805] as const,
    centerWestWorldM: [182.215, 1446.57] as const,
    courtHeightsM: { east: 0.7, west: 2.2 } as const,
    endEastWorldM: [150.353, 1619.457] as const,
    endHeightsM: { east: 0.55, west: 4.5 } as const,
    endWestWorldM: [130.403, 1582.386] as const,
    osmWayId: "840814493",
  },
  sources: [
    "https://www.openstreetmap.org/relation/11518845",
    "https://www.berlin.de/sen/uvk/_assets/natur-gruen/stadtgruen/peter-joseph-lenne-preis/2026/lenne-preis-aufgabe-a-2026-de.pdf",
    "https://commons.wikimedia.org/wiki/File:Tilla-Durieux-Park.jpg",
  ] as const,
  surfaceForm:
    "single grass strip with two counter-twisted lobes and one central court",
} as const;

/** Open-data anchors for the requested Potsdamer/Wilhelmstrasse details. */
export const POTSDAMER_DETAIL_PROFILE = {
  bahnTower: {
    facadeArcWorldM: [
      [247.417, 1031.771],
      [243.481, 1036.071],
      [238.89, 1039.665],
      [231.987, 1043.178],
      [224.537, 1045.074],
      [217.331, 1045.354],
      [210.039, 1044.07],
      [203.752, 1041.604],
      [198.078, 1037.959],
      [193.775, 1033.935],
      [190.353, 1029.484],
      [187.68, 1024.546],
    ] as const,
    facadeBandCount: 12,
    geometryStatus:
      "Berlin LoD2 curved facade ring and measured height with coarsened procedural mullion/belt recognition detail; not a component survey",
    groundY: 5.4,
    measuredHeightM: 103.192,
    parentBuildingId: "DEBE01YYK0002KhX",
    sourcePartIds: [
      "DEBE3DalNKE26iHe",
      "DEBE3DSUVHDXBTJj",
      "DEBE3DlYxpXBjoqL",
    ] as const,
    sources: [
      "https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin",
      "https://www.berlin.de/sen/uvk/_assets/natur-gruen/stadtgruen/peter-joseph-lenne-preis/2026/lenne-preis-aufgabe-a-2026-de.pdf",
      "https://www.berlin.de/sen/stadtentwicklung/_assets/planung/hochhausleitbild/hochhausleitbild-fuer-berlin_sensw.pdf",
    ] as const,
  },
  czechEmbassyWorldM: [854.635, 848.762] as const,
  georgElser: {
    artist: "Ulrich Klages",
    geometryStatus:
      "OSM sculpture node and material; published 17 m height; Geoportal-derived local ground sample; owner-photo-bounded profile, lamination and pavement-plaque reconstruction",
    groundYM: 5.02,
    heightM: 17,
    informationNodeId: "11395350229",
    inscription:
      "Ich habe den Krieg verhindern wollen. / Georg Elser, Ende November 1939",
    layerCount: 3,
    material: "steel",
    osmNodeId: "1986458966",
    plaqueDepthM: 0.78,
    plaqueWidthM: 4.45,
    rotationY: Math.PI / 2,
    sourceEpsg25833: [390249.614475, 5819250.155827] as const,
    sourceUrls: [
      "https://www.openstreetmap.org/node/1986458966",
      "https://www.berlin.de/sehenswuerdigkeiten/3561913-3558930-georg-elser-denkmal.html",
      "https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/index.php/detail/2334",
    ] as const,
    worldM: [749.614475, 749.844173] as const,
  },
  // Kept as a compatibility alias for consumers written before the measured
  // memorial profile was introduced.
  georgElserWorldM: [749.614475, 749.844173] as const,
  mallSouthFacadeOffsetM: -59.5,
  northKoreanEmbassyWorldM: [946.346, 832.865] as const,
  potsdamerStationWorldM: [291.008, 1091.994] as const,
  stationEntranceHalls: {
    geometryStatus:
      "Berlin LoD2 footprint rings and heights anchor two inset steel-glass frame reconstructions; grid, open fronts, stairs and braces are source-bounded presentation detail, not a component survey",
    halls: [
      {
        centerWorldM: [281.832837, 1014.305612] as const,
        entranceNodeId: "2491824683",
        footprintAreaM2: 689.235,
        footprintRingWorldM: [
          [292.607, 999.955],
          [293.496, 999.86],
          [296.275, 1025.964],
          [295.386, 1026.059],
          [270.187, 1028.757],
          [267.376, 1002.652],
        ] as const,
        footprintSizeM: [26.2688, 26.2559] as const,
        frontSide: 1,
        groundY: 5.4,
        key: "north",
        officialHeightM: 9.414,
        rotationY: 0.106488,
        sourceBuildingId: "DEBE01YYK0002SCt",
      },
      {
        centerWorldM: [295.739475, 1138.368472] as const,
        entranceNodeId: "1576240058",
        footprintAreaM2: 689.298,
        footprintRingWorldM: [
          [291.364, 1152.024],
          [284.06, 1152.795],
          [281.679, 1130.281],
          [281.405, 1127.687],
          [281.297, 1126.694],
          [282.429, 1126.576],
          [302.768, 1124.432],
          [307.417, 1123.942],
          [309.676, 1145.274],
          [310.181, 1150.042],
        ] as const,
        footprintSizeM: [26.2777, 26.2468] as const,
        frontSide: -1,
        groundY: 5.4,
        key: "south",
        officialHeightM: 14.696,
        rotationY: 0.105006,
        sourceBuildingId: "DEBE01YYK0000BRX",
      },
    ] as const,
    roofBayCountAcross: 10,
    roofBayCountDepth: 6,
    sources: [
      "https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin",
      "https://www.hoe-architects.com/projekte/regionalbahnhof-potsdamer-platz-berlin/",
      "https://behringer-ingenieure.de/projekte/details/47/bahnhof-potsdamer-platz-berlin",
      "https://www.openstreetmap.org/node/2491824683",
      "https://www.openstreetmap.org/node/1576240058",
      "https://commons.wikimedia.org/wiki/File:N%C3%B6rdlicher_Eingang_zum_Bahnhof_Potsdamer_Platz,_Berlin-1785.jpg",
      "https://commons.wikimedia.org/wiki/File:S%C3%BCdlicher_Eingang_zum_Bahnhof_Potsdamer_Platz-1746.jpg",
    ] as const,
    wallPanelRows: 3,
  },
  sonyCenterForumRoof: {
    axisDegrees: 29.465,
    geometryStatus:
      "OSM 24-panel plan with published Arup ring dimensions and support height; membrane curvature is a bounded presentation reconstruction",
    groundY: 5.1,
    kingpostLengthM: 42.5,
    kingpostTiltDegrees: 8,
    membraneTranslucencyPercent: 17.5,
    openingCenterWorldM: [120.075, 1003.859] as const,
    openingRadiusM: 13.6,
    outerRingCenterWorldM: [111.415, 999.258] as const,
    outerRingSizeM: [102, 78] as const,
    peakHeightAboveGroundM: 67,
    segmentCount: 24,
    sourceOsmWayIds: [
      13655225, 13655226, 13655227, 13655230, 13655231, 13655236,
      191513708, 191513710, 191513711, 191513713, 191513714,
      191513716, 191513717, 191513719, 191513720, 191513722,
      191513724, 191513725, 191513727, 191513728, 191513730,
      191513732, 191513733, 191513735,
    ] as const,
    sources: [
      "https://www.arup.com/globalassets/downloads/arup-journal/the-arup-journal-2000-issue-2.pdf",
      "https://www.openstreetmap.org/way/13655225",
      "https://www.berlin.de/en/attractions-and-sights/3560868-3104052-sony-center.en.html",
    ] as const,
    supportCount: 7,
    supportHeightAboveGroundM: 41,
  },
  spielbankWorldM: [10.472, 1250.269] as const,
  // Exact centroid of LoD2 parent DEBE01YYK00009eV. Kept as a compatibility
  // alias; the component-bound façade now lives in LeipzigerPlatzDetails.
  taylorWessingWorldM: [376.463, 885.086] as const,
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
    centerWorldM: [-218, -1120] as const,
    detailEnvelopeLocalM: {
      maxX: 23,
      maxZ: 57,
      minX: -23,
      minZ: -49,
    } as const,
    deliveredRoadSurfaceClearanceM: 2.55,
    drivableRoadOsmWayIds: [
      "25359021",
      "431664605",
      "37995742",
      "4389561",
      "37995740",
      "431664589",
      "431664590",
      "1412995432",
    ] as const,
    eventDates: ["2026-07-23", "2026-09-20"] as const,
    eventListingWorldM: [-140.167, -1134.842] as const,
    entranceDomeHeightM: 8.3,
    entranceDomeWidthM: 19.2,
    entranceHoardingPanelCount: 6,
    footprintLengthM: 96,
    footprintWidthM: 44,
    geometryStatus:
      "temporary 2026 presentation object; address and event-listing anchors locate the venue, while the 4,000 m2 footprint is fitted inside the free Wunderland lot between the delivered OSM-derived Heidestrasse, Minna-Cauer-Strasse and Doeberitzer-Strasse asphalt surfaces rather than treating a road geocode as the park centre",
    groundY: 4.2,
    maxFeatureHeightM: 9,
    osmAddressNodeId: "7029312961",
    ownerReferenceCount: 2,
    rotationY: 1.57,
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
    cemeteryOsmWayId: "51804411",
    cemeteryRingWorldM: [
      [-74.721, -1566.112],
      [-41.65, -1586.386],
      [-19.159, -1544.727],
      [-13.469, -1516.602],
      [61.398, -1518.851],
      [84.215, -1477.152],
      [112.156, -1427.927],
      [52.163, -1393.794],
      [8.507, -1376.007],
      [-9.369, -1363.958],
      [-50.351, -1465.534],
      [-95.951, -1551.569],
    ] as const,
    graveWorldM: [
      [-20.9, -1416.207],
      [-23.914, -1427.871],
      [-9.316, -1404.796],
      [39.153, -1416.009],
      [56.008, -1420.725],
      [15.239, -1423.548],
      [63.067, -1424.405],
      [38.597, -1425.035],
      [55.248, -1425.561],
      [46.179, -1429.315],
      [30.23, -1429.853],
      [3.457, -1430.09],
      [36.596, -1433.193],
      [31.318, -1435.07],
      [64.418, -1437.673],
      [47.797, -1438.504],
      [35.991, -1441.274],
      [22.578, -1442.322],
      [41.639, -1442.571],
      [21.578, -1443.725],
      [49.858, -1445.0],
      [39.237, -1446.798],
      [46.012, -1448.092],
      [-10.535, -1448.767],
      [49.102, -1453.619],
      [16.244, -1464.443],
      [52.292, -1466.878],
      [38.862, -1478.599],
      [41.312, -1480.713],
      [53.195, -1481.936],
      [23.311, -1490.155],
      [50.859, -1497.189],
      [5.657, -1505.621],
      [-20.276, -1527.126],
    ] as const,
    geometryStatus:
      "OSM cemetery, path and tomb anchors with official distinction between the 1902 canal brick boundary and preserved Hinterlandmauer concrete segments",
    groundY: 5.65,
    hinterlandWallOsmWayIds: ["1504490299", "1504490297"] as const,
    hinterlandWallSegmentsWorldM: [
      [
        [4.338, -1419.811],
        [8.082, -1412.805],
      ],
      [
        [-72.423, -1564.503],
        [-70.398, -1557.424],
        [-33.166, -1489.394],
      ],
    ] as const,
    canalBrickWallWorldM: [
      [-74.721, -1566.112],
      [-95.951, -1551.569],
      [-56.444, -1479.092],
      [-50.351, -1465.534],
      [-25.898, -1407.362],
      [-9.369, -1363.958],
    ] as const,
    osmNodeId: "3346038362",
    sources: [
      "https://www.berlin.de/mauer/orte/mauerreste/artikel.151178.php",
      "https://www.berlin.de/landesdenkmalamt/denkmale/highlight-berliner-mauer/mauer-denkmale/invalidenfriedhof-648151.php",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09010206",
    ] as const,
  },
  pankeMouth: {
    centerWorldM: [-281.0, -1954.0] as const,
    fishPassDropM: 2,
    flowDirection: "east-to-west-into-the-Nordhafen-forebasin",
    geometryStatus:
      "official side-mouth/fish-passage corridor; bounded recognition detail over the mapped OSM water polygon",
    osmWaterPolygonAreaM2: 2_197,
    sourceUrl:
      "https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/infrastruktur/wasserbau/ausbau-von-gewaessern/panke/",
  },
  scharnhorstSubstation: {
    centerWorldM: [-228.433, -2061.27] as const,
    geometryStatus:
      "OSM relation envelope with official monument facade description",
    osmRelationId: "2728348",
  },
} as const;

/**
 * Surveyed glass envelope of the Konrad-Adenauer-Haus.
 *
 * OSM way 25999445 supplies the exact plan and glass material. Published
 * building descriptions establish six storeys, the four-storey transparent
 * winter garden, 18 m glass eaves and the elliptical ship-like inner volume.
 * The latter remains a bounded recognition form rather than a surveyed
 * interior model.
 */
export const KONRAD_ADENAUER_HAUS_PROFILE = {
  atticStoreys: 2,
  buildingStoreys: 6,
  eavesHeightM: 18,
  footprintWorldM: [
    [-1424.516, 1299.21],
    [-1379.496, 1332.109],
    [-1379.4, 1335.371],
    [-1378.764, 1357.764],
    [-1378.957, 1379.604],
    [-1436.888, 1337.274],
  ] as const,
  geometryStatus:
    "exact OSM rhomboid plan; source-described four-storey transparent climate-buffer envelope and six-storey elliptical ship body",
  glassEnvelopeStoreys: 4,
  groundY: 5.35,
  innerBodyCenterWorldM: [-1405.0, 1338.0] as const,
  innerBodyDepthM: 30,
  innerBodyLengthM: 54,
  innerBodyLowerHeightM: 15.6,
  innerBodyRotationY: (-53.84 * Math.PI) / 180,
  osmWayId: "25999445",
  publishedUsableAreaM2: 6_300,
  signageRendered: false,
  travertinePlinthHeightM: 0.65,
  upperDeckStoreys: 2,
  winterGardenRole: "transparent climate buffer",
  sources: [
    "https://www.openstreetmap.org/way/25999445",
    "https://www.konrad-adenauer.de/seite/gebaeude/",
    "https://www.cdu.de/aktuelles/cdu-deutschlands/das-konrad-adenauer-haus-feiert-den-25-geburtstag/",
    "https://archiv.cdu.de/node/1151",
    "https://www.bauhaus.de/files/01_BHA_Auslobung.pdf",
  ] as const,
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
    entranceCanopyWidthM: 13.2,
    floorCount: 22,
    footprintDepthM: 24.77,
    footprintLengthM: 42.59,
    geometryStatus:
      "Berlin LoD2 metric shell with source-described facade-screen overlay",
    dgmSceneGroundY: 5.51,
    groundY: 5.6,
    measuredHeightM: 83.794,
    ownerReferenceCount: 1,
    parentBuildingId: "DEBE01AL2TJ0000u",
    primaryFinEveryBays: 4,
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
    completedState:
      "facade complete; DKB handover scheduled for March 2026",
    facadeBayPitchM: 1.45,
    facadeMaterial:
      "fine vertically fluted champagne-silver anodised aluminium over floor-to-ceiling glazing",
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
      "current OSM footprint with published height/storeys, DGM1 terrain datum, completed 2026 facade state and plan-derived tier clips",
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
 * Published dimensions and bounded presentation pose of Berlin's WELT balloon.
 *
 * The operator supplies the FK-5500/STU dimensions, gondola capacity and cable
 * diameter. The landmark/OSM record fixes the ground anchor. Its 91 m envelope
 * centre is the deliberately frozen viewer pose, not a claim that the balloon
 * always flies at that altitude; the real installation can ascend to 150 m.
 */
export const WELT_BALLOON_PROFILE = {
  displayCableStrokeM: 0.06,
  envelopeCenterAboveGroundM: 91,
  envelopeDiameterM: 22.67,
  envelopeVolumeM3: 6_100,
  geometryStatus:
    "OSM-ground-anchored FK-5500/STU dimensions with owner-specified white-and-black livery; cable net and ground station are bounded presentation detail",
  gondolaDiameterM: 5.9,
  gondolaPassengerCapacity: 30,
  maxAscentM: 150,
  model: "FK-5500/STU",
  repeatedWordCount: 4,
  tetherDiameterM: 0.022,
  totalHeightM: 34,
  sources: [
    "https://berlinhelicopter.de/weltballon-mehr-erfahren/",
    "https://www.openstreetmap.org/way/1250081894",
    "https://commons.wikimedia.org/wiki/File:Germany-04441_-_Berlin%E2%80%99s_Hi-Flyer_(30250209001).jpg",
    "https://commons.wikimedia.org/wiki/File:Die_Welt_balloon_at_Wilhelmstr.jpg",
  ] as const,
  visualReferences: [
    {
      artist: "Dennis G. Jarvis",
      license: "CC BY-SA 2.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0",
      title: "Germany-04441 - Berlin's Hi-Flyer (30250209001).jpg",
      url: "https://commons.wikimedia.org/wiki/File:Germany-04441_-_Berlin%E2%80%99s_Hi-Flyer_(30250209001).jpg",
    },
    {
      artist: "Orderinchaos",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      title: "Die Welt balloon at Wilhelmstr.jpg",
      url: "https://commons.wikimedia.org/wiki/File:Die_Welt_balloon_at_Wilhelmstr.jpg",
    },
  ] as const,
} as const;
