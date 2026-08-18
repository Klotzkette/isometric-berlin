import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  Mesh,
} from "three";

import {
  type Builder,
  addBox,
  addCone,
  addCylinder,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";
import { ADLER_BRIDGE_PROFILE } from "./AdlerBridge";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";

type RectProfile = {
  centreWorldM: readonly [number, number];
  depthM: number;
  geometryStatus: string;
  heightM: number;
  name: string;
  rotationY: number;
  sourceUrls: readonly string[];
  widthM: number;
};

const IVORY = 0xeee9dc;
const IVORY_LIGHT = 0xf8f4e9;
const SANDSTONE = 0xd8c5a0;
const SANDSTONE_LIGHT = 0xeadcc1;
const WINDOW = 0x668493;
const WINDOW_LIGHT = 0xa7c0c5;
const INK_METAL = 0x434b4b;
const BRONZE = 0x49675d;
const GOLD = 0xd7ae43;
const ROOF_RED = 0x985342;
const WATER = 0x7eb3bf;
export const CITY_RECOGNITION_SMALL_WATER_MESH_NAME =
  "Tritonbrunnen and Hansabibliothek authored water";
const GREEN = 0x729d62;
const FLOWER_RED = 0xc75c67;
const FLOWER_GOLD = 0xe1b84d;
const SHOP_RED = 0xd62f31;
const SHOP_BLUE = 0x315c96;

export const CITY_REFINEMENT_PROFILES = {
  aldiInvalidenstrasse: {
    centreWorldM: [-487.42, -598.58],
    depthM: 29.39,
    geometryStatus:
      "OSM footprint; storefront presentation from the mapped shop use",
    heightM: 5.1,
    name: "ALDI Nord Invalidenstrasse",
    rotationY: -1.1293,
    sourceUrls: ["https://www.openstreetmap.org/way/142947685"],
    widthM: 56.18,
  },
  hansabibliothek: {
    centreWorldM: [-1954.83, 154.53],
    depthM: 33.3,
    geometryStatus: "OSM footprint with documented four-wing reading courtyard",
    heightM: 4.2,
    name: "Hansabibliothek",
    rotationY: 0.106,
    sourceUrls: [
      "https://www.openstreetmap.org/way/35437963",
      "https://hansaviertel.berlin/bauwerke/altonaer-strasse-15-stadtteilbibliothek-w-duettmann/",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050387",
    ],
    widthM: 33.5,
  },
  motelOneHauptbahnhof: {
    centreWorldM: [-372.85, -770.21],
    depthM: 45.6,
    geometryStatus:
      "OSM footprint and level count; facade rhythm is reference-based",
    heightM: 40.3,
    name: "Motel One Berlin-Hauptbahnhof",
    rotationY: -1.124,
    sourceUrls: ["https://www.openstreetmap.org/way/25557953"],
    widthM: 50.59,
  },
  parisMoskau: {
    centreWorldM: [-466.16, -420.08],
    depthM: 8.2,
    geometryStatus:
      "OSM footprint plus Landesdenkmalamt architectural description",
    heightM: 6.6,
    name: "Restaurant Paris-Moskau",
    rotationY: -0.231,
    sourceUrls: [
      "https://www.openstreetmap.org/way/181479019",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050226",
    ],
    widthM: 12.1,
  },
  presidentialOffice: {
    centreWorldM: [-1383.58, 259.87],
    depthM: 40.96,
    geometryStatus:
      "OSM footprint envelope with official three-storey elliptical description",
    heightM: 13.2,
    name: "Bundespraesidialamt am Schloss Bellevue",
    rotationY: -0.4738,
    sourceUrls: [
      "https://www.bundespraesident.de/DE/amt-und-aufgaben/bundespraesidialamt/gebaeude/gebaeude_node.html",
    ],
    widthM: 82.82,
  },
  reweHeidestrasse: {
    centreWorldM: [-333.13, -1497.19],
    depthM: 0.7,
    geometryStatus: "OSM shop node; shallow storefront insert only",
    heightM: 4.0,
    name: "REWE Heidestrasse",
    rotationY: 0,
    sourceUrls: ["https://www.openstreetmap.org/node/8367158861"],
    widthM: 16,
  },
  tourTotal: {
    centreWorldM: [-106.99, -1067.47],
    depthM: 23.85,
    geometryStatus:
      "Current OSM footprint with published 68.8 m height and 17 floors",
    heightM: 68.8,
    name: "Tour TotalEnergies / Jean-Monnet-Tower",
    rotationY: -1.0455,
    sourceUrls: [
      "https://www.openstreetmap.org/way/137219540",
      "https://totalenergies.de/ueber-uns/standorte/tour-totalenergies",
      "https://www.skyscrapercenter.com/berlin/tour-total/15345/",
    ],
    widthM: 53.56,
  },
  walterGropiusHaus: {
    centreWorldM: [-2145.04, 304.62],
    depthM: 19.13,
    geometryStatus:
      "Berlin LoD2 footprint and height with documented curved facade accents",
    heightM: 28.08,
    name: "Walter-Gropius-Haus Haendelallee",
    rotationY: 0.079,
    sourceUrls: [
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050387",
      "https://commons.wikimedia.org/wiki/File:H%C3%A4ndelallee_3-9_-_Walter_Gropius_2.jpg",
    ],
    widthM: 80.52,
  },
} as const satisfies Record<string, RectProfile>;

export const BRIDGE_REFINEMENT_PROFILES = {
  adlerbruecke: {
    centreWorldM: ADLER_BRIDGE_PROFILE.centreWorldM,
    lengthM: ADLER_BRIDGE_PROFILE.inventory.lengthM,
    name: "Adlerbruecke im Grossen Tiergarten",
    rotationY: -Math.atan2(
      ADLER_BRIDGE_PROFILE.axis[1],
      ADLER_BRIDGE_PROFILE.axis[0],
    ),
    sourceUrls: ADLER_BRIDGE_PROFILE.sourceUrls,
    widthM: ADLER_BRIDGE_PROFILE.inventory.widthM,
  },
  lutherbruecke: {
    centreWorldM: [-1131.79, 118.32] as const,
    lengthM: 75.23,
    name: "Lutherbruecke",
    rotationY: 1.3375,
    sourceUrls: [
      "https://www.openstreetmap.org/way/222755815",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050382",
    ],
    widthM: 28.67,
  },
} as const;

export const MEMORIAL_REFINEMENT_PROFILES = {
  karlLiebknecht: {
    name: "Karl-Liebknecht-Denkmal am Neuen See",
    sourceUrls: [
      "https://www.openstreetmap.org/node/276945581",
      "https://www.berlin.de/ba-mitte/ueber-den-bezirk/sehenswertes/denkmaeler/denkmaeler-suchen/",
    ],
    worldM: [-2063.32, 668.98] as const,
  },
  rosaLuxemburg: {
    name: "Rosa-Luxemburg-Denkmal am Neuen See",
    sourceUrls: [
      "https://www.openstreetmap.org/node/276945671",
      "https://www.berlin.de/ba-mitte/ueber-den-bezirk/sehenswertes/denkmaeler/denkmaeler-suchen/",
    ],
    worldM: [-1930.77, 1065.34] as const,
  },
  tritonbrunnen: {
    name: "Tritonbrunnen am John-Foster-Dulles-Allee",
    sourceUrls: [
      "https://www.openstreetmap.org/node/1167444879",
      "https://bildhauerei-in-berlin.de/bildwerk/tritonbrunnen-4957/",
    ],
    worldM: [-833.99, 184.99] as const,
  },
} as const;

export const DETAIL_COVERAGE = {
  "Adlerbruecke im Tiergarten": "AdlerBridge",
  "ALDI Nord Invalidenstrasse": "CityRecognitionRefinements",
  "Bismarck-Nationaldenkmal": "IsometricCityWorld/createSiegessaeule",
  "Englischer Garten": "OSM park polygons plus current Teehaus presentation",
  "Erweiterungsbaustelle des Kanzleramts": "ChancelleryExtension",
  Europacity: "ExpandedCityDetails plus CityRecognitionRefinements",
  "Flora-Denkmal": "TiergartenMonuments",
  "Gymnasium Tiergarten": "IsometricCityWorld/createGymnasiumTiergarten",
  Hansabibliothek: "CityRecognitionRefinements",
  Kanzleramt: "ArchitecturalLandmarks and ChancelleryExtension",
  "Leipziger Platz": "CityRecognitionRefinements plus OSM surfaces",
  "Liebknecht- und Luxemburg-Denkmaeler": "CityRecognitionRefinements",
  "Lortzing-Denkmal": "TiergartenMonuments",
  Luiseninsel: "TiergartenMonuments and OSM park polygons",
  Lutherbruecke: "CityRecognitionRefinements",
  "Motel One Hauptbahnhof": "CityRecognitionRefinements",
  "Paris-Moskau": "CityRecognitionRefinements",
  "Platz der Republik": "OSM surfaces and landmark hedges",
  "REWE Heidestrasse": "CityRecognitionRefinements",
  Rosengarten: "OSM garden polygons and TiergartenMonuments",
  "Schloss Bellevue und Bundespraesidialamt":
    "LoD2 plus CityRecognitionRefinements",
  Sozialgericht: "ExpandedCityDetails",
  "Tilla-Durieux-Park": "ExpandedCityDetails/Tilla-Durieux lawn sculpture",
  "Tour TotalEnergies": "CityRecognitionRefinements",
  Tritonbrunnen: "CityRecognitionRefinements",
  "Walter-Gropius-Haus": "CityRecognitionRefinements",
  Wilhelmstrasse: "CentralCivicDetails and LoD2",
  Zollpackhof: "RiversideVenues",
} as const;

function at(
  profile: RectProfile,
  localX: number,
  localZ: number,
): readonly [number, number] {
  const cosine = Math.cos(profile.rotationY);
  const sine = Math.sin(profile.rotationY);
  return [
    profile.centreWorldM[0] + localX * cosine + localZ * sine,
    profile.centreWorldM[1] - localX * sine + localZ * cosine,
  ];
}

function localBox(
  builder: Builder,
  profile: RectProfile,
  color: number,
  localX: number,
  centerY: number,
  localZ: number,
  width: number,
  height: number,
  depth: number,
  inked = true,
): void {
  const [x, z] = at(profile, localX, localZ);
  addBox(
    builder,
    color,
    x,
    centerY,
    z,
    width,
    height,
    depth,
    profile.rotationY,
    inked,
  );
}

function roofSlope(
  builder: Builder,
  profile: RectProfile,
  color: number,
  groundY: number,
  riseM: number,
): void {
  const halfDepth = profile.depthM / 2;
  const slopeLength = Math.hypot(halfDepth, riseM);
  const angle = Math.atan2(riseM, halfDepth);
  for (const side of [-1, 1]) {
    const geometry = new BoxGeometry(
      profile.widthM + 0.7,
      0.34,
      slopeLength + 0.4,
    );
    geometry.rotateX(side * angle);
    geometry.rotateY(profile.rotationY);
    const [x, z] = at(profile, 0, side * halfDepth * 0.5);
    geometry.translate(x, groundY + profile.heightM + riseM * 0.5, z);
    paintGeometry(geometry, color);
    builder.parts.push(geometry);
    builder.edges.push(new EdgesGeometry(geometry, 24));
  }
}

function addParisMoskau(builder: Builder, groundY: number): void {
  const profile = CITY_REFINEMENT_PROFILES.parisMoskau;
  localBox(builder, profile, IVORY, 0, groundY + 1.6, 0, 12.5, 3.2, 8.6);
  localBox(
    builder,
    profile,
    SANDSTONE_LIGHT,
    0,
    groundY + 4.7,
    0,
    12.2,
    3.0,
    8.3,
  );
  roofSlope(builder, profile, ROOF_RED, groundY, 3.4);

  // Landesdenkmalamt: Fachwerk upper floor, central loggia and decorated
  // gables. The dark frame is raised off the plaster to avoid coplanar shimmer.
  for (const side of [-1, 1]) {
    const z = side * (profile.depthM / 2 + 0.16);
    for (let bay = -2; bay <= 2; bay += 1) {
      localBox(
        builder,
        profile,
        INK_METAL,
        bay * 2.15,
        groundY + 4.7,
        z,
        0.16,
        2.7,
        0.16,
        false,
      );
    }
    for (const y of [groundY + 3.35, groundY + 5.95]) {
      localBox(builder, profile, INK_METAL, 0, y, z, 11.4, 0.15, 0.16, false);
    }
  }
  localBox(
    builder,
    profile,
    WINDOW,
    0,
    groundY + 4.65,
    profile.depthM / 2 + 0.22,
    3.0,
    2.25,
    0.16,
  );
  for (const side of [-1, 1]) {
    localBox(
      builder,
      profile,
      SANDSTONE,
      side * 5.1,
      groundY + 4.8,
      0,
      0.34,
      3.4,
      profile.depthM + 0.5,
    );
  }
}

function addStorefronts(
  builder: Builder,
  groundAt: (x: number, z: number) => number,
): void {
  const aldi = CITY_REFINEMENT_PROFILES.aldiInvalidenstrasse;
  const aldiGround = groundAt(...aldi.centreWorldM);
  localBox(
    builder,
    aldi,
    IVORY_LIGHT,
    0,
    aldiGround + 2.55,
    0,
    aldi.widthM + 0.4,
    5.1,
    aldi.depthM + 0.4,
  );
  for (const side of [-1, 1]) {
    localBox(
      builder,
      aldi,
      WINDOW,
      side * 11,
      aldiGround + 1.7,
      aldi.depthM / 2 + 0.24,
      9.2,
      2.6,
      0.18,
      false,
    );
  }
  localBox(
    builder,
    aldi,
    SHOP_BLUE,
    0,
    aldiGround + 3.72,
    aldi.depthM / 2 + 0.3,
    13.5,
    1.05,
    0.2,
  );
  localBox(
    builder,
    aldi,
    SHOP_RED,
    0,
    aldiGround + 3.72,
    aldi.depthM / 2 + 0.42,
    2.4,
    0.58,
    0.12,
    false,
  );
  localBox(
    builder,
    aldi,
    GOLD,
    0,
    aldiGround + 3.72,
    aldi.depthM / 2 + 0.49,
    1.55,
    0.3,
    0.08,
    false,
  );

  const rewe = CITY_REFINEMENT_PROFILES.reweHeidestrasse;
  const reweGround = groundAt(...rewe.centreWorldM);
  localBox(builder, rewe, WINDOW, 0, reweGround + 1.7, 0, 15.8, 3.2, 0.35);
  for (let bay = -3; bay <= 3; bay += 1) {
    localBox(
      builder,
      rewe,
      IVORY,
      bay * 2.25,
      reweGround + 1.7,
      -0.25,
      0.15,
      3.25,
      0.18,
      false,
    );
  }
  localBox(builder, rewe, SHOP_RED, 0, reweGround + 3.55, 0.05, 8.8, 0.85, 0.3);
  localBox(
    builder,
    rewe,
    IVORY_LIGHT,
    0,
    reweGround + 3.55,
    0.24,
    5.6,
    0.34,
    0.08,
    false,
  );
}

function addFacadeGrid(
  builder: Builder,
  profile: RectProfile,
  groundY: number,
  floors: number,
  bays: number,
  facadeColor: number,
  glassColor: number,
): void {
  localBox(
    builder,
    profile,
    facadeColor,
    0,
    groundY + profile.heightM / 2,
    0,
    profile.widthM + 0.5,
    profile.heightM,
    profile.depthM + 0.5,
  );
  const storey = profile.heightM / floors;
  for (let floor = 0; floor < floors; floor += 1) {
    const y = groundY + (floor + 0.53) * storey;
    for (const side of [-1, 1]) {
      localBox(
        builder,
        profile,
        glassColor,
        0,
        y,
        side * (profile.depthM / 2 + 0.31),
        profile.widthM - 1.2,
        storey * 0.58,
        0.18,
        false,
      );
    }
  }
  for (let bay = 1; bay < bays; bay += 1) {
    const x = -profile.widthM / 2 + (bay / bays) * profile.widthM;
    for (const side of [-1, 1]) {
      localBox(
        builder,
        profile,
        facadeColor,
        x,
        groundY + profile.heightM / 2,
        side * (profile.depthM / 2 + 0.42 + (bay % 2) * 0.12),
        0.34,
        profile.heightM - 0.6,
        0.24,
        false,
      );
    }
  }
  for (let floor = 1; floor < floors; floor += 1) {
    const y = groundY + floor * storey;
    localBox(
      builder,
      profile,
      facadeColor,
      0,
      y,
      profile.depthM / 2 + 0.43,
      profile.widthM + 0.2,
      0.23,
      0.24,
      false,
    );
    localBox(
      builder,
      profile,
      facadeColor,
      0,
      y,
      -profile.depthM / 2 - 0.43,
      profile.widthM + 0.2,
      0.23,
      0.24,
      false,
    );
  }
}

function addStationDistrictBuildings(
  builder: Builder,
  groundAt: (x: number, z: number) => number,
): void {
  const total = CITY_REFINEMENT_PROFILES.tourTotal;
  const totalGround = groundAt(...total.centreWorldM);
  addFacadeGrid(builder, total, totalGround, 17, 13, IVORY_LIGHT, WINDOW_LIGHT);
  // Barkow Leibinger's shifting precast relief: alternating fins step proud
  // of the otherwise calm envelope.
  for (let bay = 0; bay < 12; bay += 1) {
    const x = -total.widthM / 2 + ((bay + 0.5) / 12) * total.widthM;
    const offset = bay % 2 === 0 ? 0.58 : 0.24;
    localBox(
      builder,
      total,
      IVORY,
      x,
      totalGround + 34,
      total.depthM / 2 + offset,
      0.65,
      66.5,
      0.3,
      false,
    );
  }
  localBox(
    builder,
    total,
    IVORY_LIGHT,
    11,
    totalGround + 65.2,
    total.depthM / 2 + 0.82,
    16.2,
    2.55,
    0.28,
  );
  for (const [color, x] of [
    [0x4d5db3, 4.8],
    [0x55a9be, 10.4],
    [0xcf4f72, 15.9],
  ] as const) {
    localBox(
      builder,
      total,
      color,
      x,
      totalGround + 65.2,
      total.depthM / 2 + 1.0,
      4.4,
      0.62,
      0.12,
      false,
    );
  }

  const motel = CITY_REFINEMENT_PROFILES.motelOneHauptbahnhof;
  const motelGround = groundAt(...motel.centreWorldM);
  addFacadeGrid(builder, motel, motelGround, 13, 10, IVORY, WINDOW);
  localBox(
    builder,
    motel,
    0x4f8290,
    0,
    motelGround + 4.1,
    motel.depthM / 2 + 0.66,
    18,
    1.2,
    0.24,
  );
  localBox(
    builder,
    motel,
    IVORY_LIGHT,
    0,
    motelGround + motel.heightM + 0.35,
    0,
    motel.widthM + 0.8,
    0.7,
    motel.depthM + 0.8,
  );
}

function addBridgeDetails(
  builder: Builder,
  groundAt: (x: number, z: number) => number,
): void {
  const luther = BRIDGE_REFINEMENT_PROFILES.lutherbruecke;
  const lutherGround = groundAt(...luther.centreWorldM) + 0.65;
  const lutherRect: RectProfile = {
    centreWorldM: luther.centreWorldM,
    depthM: luther.widthM,
    geometryStatus: "OSM outline and Berlin monument description",
    heightM: 1,
    name: luther.name,
    rotationY: luther.rotationY,
    sourceUrls: luther.sourceUrls,
    widthM: luther.lengthM,
  };
  for (const side of [-1, 1]) {
    localBox(
      builder,
      lutherRect,
      INK_METAL,
      0,
      lutherGround + 1.35,
      side * 13.1,
      66,
      0.18,
      0.18,
      false,
    );
    for (let along = -31; along <= 31; along += 3.1) {
      localBox(
        builder,
        lutherRect,
        INK_METAL,
        along,
        lutherGround + 1.0,
        side * 13.1,
        0.12,
        1.55,
        0.12,
        false,
      );
    }
  }
  for (const localX of [-33.2, 33.2]) {
    for (const localZ of [-12.4, 12.4]) {
      const [x, z] = at(lutherRect, localX, localZ);
      addBox(
        builder,
        SANDSTONE,
        x,
        lutherGround + 1.45,
        z,
        1.65,
        2.9,
        1.65,
        luther.rotationY,
      );
      addCone(
        builder,
        SANDSTONE_LIGHT,
        x,
        lutherGround + 3.35,
        z,
        0.72,
        1.2,
        4,
      );
      addCone(builder, GOLD, x, lutherGround + 4.25, z, 0.5, 0.72, 5);
    }
  }
}

function addMemorialDetails(
  builder: Builder,
  waterBuilder: Builder,
  groundAt: (x: number, z: number) => number,
): void {
  for (const [index, profile] of [
    MEMORIAL_REFINEMENT_PROFILES.karlLiebknecht,
    MEMORIAL_REFINEMENT_PROFILES.rosaLuxemburg,
  ].entries()) {
    const ground = groundAt(profile.worldM[0], profile.worldM[1]);
    const rotation = index === 0 ? 0.42 : -0.3;
    addBox(
      builder,
      SANDSTONE,
      profile.worldM[0],
      ground + 0.18,
      profile.worldM[1],
      3.4,
      0.36,
      2.2,
      rotation,
    );
    addBox(
      builder,
      INK_METAL,
      profile.worldM[0],
      ground + 1.25,
      profile.worldM[1],
      2.8,
      1.9,
      0.24,
      rotation,
    );
    addBox(
      builder,
      IVORY_LIGHT,
      profile.worldM[0],
      ground + 1.45,
      profile.worldM[1],
      1.9,
      0.12,
      0.28,
      rotation,
      false,
    );
    addBox(
      builder,
      FLOWER_RED,
      profile.worldM[0] - 0.55,
      ground + 0.42,
      profile.worldM[1] + 0.75,
      0.6,
      0.24,
      0.6,
      rotation,
      false,
    );
    addBox(
      builder,
      FLOWER_GOLD,
      profile.worldM[0] + 0.5,
      ground + 0.42,
      profile.worldM[1] + 0.72,
      0.6,
      0.24,
      0.6,
      rotation,
      false,
    );
  }

  const triton = MEMORIAL_REFINEMENT_PROFILES.tritonbrunnen;
  const ground = groundAt(...triton.worldM);
  addCylinder(
    builder,
    SANDSTONE_LIGHT,
    triton.worldM[0],
    ground + 0.22,
    triton.worldM[1],
    4.4,
    0.44,
    32,
  );
  addCylinder(
    waterBuilder,
    WATER,
    triton.worldM[0],
    ground + 0.47,
    triton.worldM[1],
    3.75,
    0.12,
    32,
  );
  addCylinder(
    builder,
    SANDSTONE,
    triton.worldM[0],
    ground + 0.95,
    triton.worldM[1],
    1.25,
    1.0,
    12,
  );
  addCylinder(
    builder,
    BRONZE,
    triton.worldM[0],
    ground + 2.0,
    triton.worldM[1],
    0.48,
    1.7,
    8,
  );
  addCone(
    builder,
    BRONZE,
    triton.worldM[0],
    ground + 3.1,
    triton.worldM[1],
    0.62,
    0.85,
    8,
  );
  for (const side of [-1, 1]) {
    addBox(
      builder,
      BRONZE,
      triton.worldM[0] + side * 0.78,
      ground + 2.2,
      triton.worldM[1],
      1.3,
      0.22,
      0.32,
      side * 0.35,
      false,
    );
  }
}

function addHansaviertelDetails(
  builder: Builder,
  waterBuilder: Builder,
  groundAt: (x: number, z: number) => number,
): void {
  const library = CITY_REFINEMENT_PROFILES.hansabibliothek;
  const libraryGround = groundAt(...library.centreWorldM);
  const courtyard = 18;
  for (const side of [-1, 1]) {
    localBox(
      builder,
      library,
      IVORY_LIGHT,
      0,
      libraryGround + 2.1,
      side * 13.6,
      33.5,
      4.2,
      6.0,
    );
    localBox(
      builder,
      library,
      IVORY_LIGHT,
      side * 13.6,
      libraryGround + 2.1,
      0,
      6.0,
      4.2,
      courtyard + 0.2,
    );
  }
  for (const side of [-1, 1]) {
    localBox(
      builder,
      library,
      WINDOW_LIGHT,
      0,
      libraryGround + 2.1,
      side * 10.45,
      26.5,
      2.35,
      0.18,
      false,
    );
  }
  localBox(
    waterBuilder,
    library,
    WATER,
    10.5,
    libraryGround + 0.18,
    10.2,
    8.5,
    0.16,
    4.5,
    false,
  );
  localBox(
    builder,
    library,
    GREEN,
    0,
    libraryGround + 0.13,
    0,
    courtyard - 1,
    0.16,
    courtyard - 1,
    false,
  );

  const gropius = CITY_REFINEMENT_PROFILES.walterGropiusHaus;
  const gropiusGround = groundAt(...gropius.centreWorldM);
  // Nine short bays follow the documented gentle bend instead of treating
  // the 80 m slab as one featureless wall.
  const segments = 9;
  const segmentWidth = gropius.widthM / segments;
  for (let index = 0; index < segments; index += 1) {
    const localX = -gropius.widthM / 2 + (index + 0.5) * segmentWidth;
    const bow = Math.sin((index / (segments - 1)) * Math.PI) * 1.2;
    localBox(
      builder,
      gropius,
      IVORY,
      localX,
      gropiusGround + gropius.heightM / 2,
      bow,
      segmentWidth + 0.12,
      gropius.heightM,
      gropius.depthM,
    );
    for (let floor = 0; floor < 8; floor += 1) {
      localBox(
        builder,
        gropius,
        WINDOW,
        localX,
        gropiusGround + 2.1 + floor * 3.15,
        gropius.depthM / 2 + bow + 0.22,
        segmentWidth * 0.56,
        1.55,
        0.16,
        false,
      );
    }
  }
  for (const side of [-1, 1]) {
    localBox(
      builder,
      gropius,
      side < 0 ? 0xd6a44f : 0x76a7a0,
      side * 35,
      gropiusGround + 16,
      gropius.depthM / 2 + 1.45,
      4.2,
      22,
      1.8,
    );
  }

  const office = CITY_REFINEMENT_PROFILES.presidentialOffice;
  const officeGround = groundAt(...office.centreWorldM);
  const shell = new CylinderGeometry(1, 1, office.heightM, 64);
  shell.scale(office.widthM / 2, 1, office.depthM / 2);
  shell.rotateY(office.rotationY);
  shell.translate(
    office.centreWorldM[0],
    officeGround + office.heightM / 2,
    office.centreWorldM[1],
  );
  paintGeometry(shell, 0x4d5658);
  builder.parts.push(shell);
  builder.edges.push(new EdgesGeometry(shell, 18));
  for (const floor of [1, 2]) {
    const ring = new CylinderGeometry(1.005, 1.005, 0.24, 64, 1, true);
    ring.scale(office.widthM / 2, 1, office.depthM / 2);
    ring.rotateY(office.rotationY);
    ring.translate(
      office.centreWorldM[0],
      officeGround + floor * (office.heightM / 3),
      office.centreWorldM[1],
    );
    paintGeometry(ring, WINDOW_LIGHT);
    builder.parts.push(ring);
  }
  for (let bay = 0; bay < 28; bay += 1) {
    const angle = (bay / 28) * Math.PI * 2;
    const localX = Math.cos(angle) * (office.widthM / 2 + 0.14);
    const localZ = Math.sin(angle) * (office.depthM / 2 + 0.14);
    const [x, z] = at(office, localX, localZ);
    addBox(
      builder,
      bay % 3 === 0 ? WINDOW_LIGHT : 0x6b7475,
      x,
      officeGround + office.heightM / 2,
      z,
      0.32,
      office.heightM - 1.0,
      0.32,
      office.rotationY - angle,
      false,
    );
  }
}

function addSquareDetails(
  builder: Builder,
  groundAt: (x: number, z: number) => number,
): void {
  // Exact mapped S/U entrances around Leipziger Platz. Only the stair mouths
  // are authored; trees and kerbs remain sourced from the OSM/official layers.
  for (const [x, z, rotation] of [
    [412.7, 1112.1, -0.13],
    [430.3, 1042.0, 0.05],
    [457.3, 1039.8, 0.04],
  ] as const) {
    const ground = groundAt(x, z);
    addBox(
      builder,
      SANDSTONE_LIGHT,
      x,
      ground + 0.16,
      z,
      6.4,
      0.28,
      3.3,
      rotation,
    );
    addBox(
      builder,
      INK_METAL,
      x,
      ground + 0.82,
      z,
      5.7,
      0.12,
      2.75,
      rotation,
      false,
    );
    for (const side of [-1, 1]) {
      addBox(
        builder,
        INK_METAL,
        x + side * 2.7,
        ground + 0.85,
        z,
        0.12,
        1.4,
        2.75,
        rotation,
        false,
      );
    }
    for (let step = 0; step < 6; step += 1) {
      addBox(
        builder,
        0x8e9290,
        x,
        ground + 0.14 - step * 0.11,
        z + 0.9 - step * 0.38,
        4.7,
        0.12,
        0.34,
        rotation,
        false,
      );
    }
  }

  // Current Teehaus state: a low, partly roofless 1952 garden pavilion after
  // the documented 2024 fire, not an invented intact reconstruction.
  const teaHouse = { x: -1582.0, z: 175.1 };
  const ground = groundAt(teaHouse.x, teaHouse.z);
  addBox(
    builder,
    IVORY,
    teaHouse.x,
    ground + 1.65,
    teaHouse.z,
    24,
    3.3,
    11,
    0.08,
  );
  addBox(
    builder,
    0x4d5658,
    teaHouse.x,
    ground + 1.75,
    teaHouse.z + 5.62,
    18,
    2.1,
    0.2,
    0.08,
    false,
  );
  // Open roof frame communicates the current loss of the roof without a dark
  // floating slab above the English Garden.
  for (const side of [-1, 1]) {
    addBox(
      builder,
      SANDSTONE_LIGHT,
      teaHouse.x,
      ground + 3.65,
      teaHouse.z + side * 4.9,
      24,
      0.22,
      0.22,
      0.08,
      false,
    );
  }
  for (let bay = -5; bay <= 5; bay += 1) {
    addBox(
      builder,
      SANDSTONE_LIGHT,
      teaHouse.x + bay * 2.1,
      ground + 3.65,
      teaHouse.z,
      0.18,
      0.18,
      10,
      0.08,
      false,
    );
  }
}

function addBatch(
  parent: Group,
  name: string,
  builder: Builder,
  profileNames: readonly string[],
): void {
  const group = finishDrawnGroup(builder, {
    lampEmissive: 0xffd69a,
    lampEmissiveIntensity: 0.55,
    name,
  });
  if (!group) return;
  group.userData.profileNames = profileNames;
  parent.add(group);
}

function addSmallWaterBatch(parent: Group, builder: Builder): void {
  const groupName = "Tritonbrunnen and Hansabibliothek authored water detail";
  const group = finishDrawnGroup(builder, { name: groupName });
  if (!group) return;
  const waterMesh = group.getObjectByName(`${groupName} bodies`);
  if (waterMesh instanceof Mesh) {
    waterMesh.name = CITY_RECOGNITION_SMALL_WATER_MESH_NAME;
    waterMesh.userData.schwellenraumWaterSurface = true;
  }
  parent.add(group);
}

export function createCityRecognitionRefinements(ground: VoxelPayload): Group {
  const root = new Group();
  root.name = "Open-data city recognition refinements";
  root.userData.geometryStatus =
    "Metric anchors from Berlin LoD2/OSM; facade and monument micro-detail is source-referenced presentation geometry, not a 10 cm survey";
  root.userData.coverage = DETAIL_COVERAGE;
  root.userData.sourceUrls = [
    ...Object.values(CITY_REFINEMENT_PROFILES).flatMap(
      (profile) => profile.sourceUrls,
    ),
    ...Object.values(BRIDGE_REFINEMENT_PROFILES).flatMap(
      (profile) => profile.sourceUrls,
    ),
    ...Object.values(MEMORIAL_REFINEMENT_PROFILES).flatMap(
      (profile) => profile.sourceUrls,
    ),
    "https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2025/pressemitteilung.1600836.php",
  ];
  const sample = worldGroundSampler(ground);
  const groundAt = (x: number, z: number): number => sample(x, z) ?? 5.2;
  const smallWater = createBuilder();

  const north = createBuilder();
  addParisMoskau(
    north,
    groundAt(...CITY_REFINEMENT_PROFILES.parisMoskau.centreWorldM),
  );
  addStorefronts(north, groundAt);
  addStationDistrictBuildings(north, groundAt);
  addBatch(root, "Hauptbahnhof and Europacity fine details", north, [
    "Restaurant Paris-Moskau",
    "ALDI Nord Invalidenstrasse",
    "REWE Heidestrasse",
    "Motel One Berlin-Hauptbahnhof",
    "Tour TotalEnergies / Jean-Monnet-Tower",
  ]);

  const tiergarten = createBuilder();
  addBridgeDetails(tiergarten, groundAt);
  addMemorialDetails(tiergarten, smallWater, groundAt);
  addBatch(root, "Tiergarten bridge and memorial fine details", tiergarten, [
    "Lutherbruecke",
    "Karl-Liebknecht-Denkmal",
    "Rosa-Luxemburg-Denkmal",
    "Tritonbrunnen",
  ]);

  const west = createBuilder();
  addHansaviertelDetails(west, smallWater, groundAt);
  addBatch(root, "Bellevue and Hansaviertel fine details", west, [
    "Bundespraesidialamt",
    "Hansabibliothek",
    "Walter-Gropius-Haus",
  ]);

  const squares = createBuilder();
  addSquareDetails(squares, groundAt);
  addBatch(root, "Leipziger Platz and English Garden fine details", squares, [
    "Leipziger Platz subway entrances",
    "Teehaus im Englischen Garten",
  ]);
  addSmallWaterBatch(root, smallWater);

  root.userData.batchCount = root.children.length;
  return root;
}
