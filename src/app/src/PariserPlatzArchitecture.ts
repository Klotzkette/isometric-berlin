import { BoxGeometry, BufferGeometry, EdgesGeometry, Group } from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  type Builder,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";

/**
 * Source-bounded recognition facades for the four civic buildings on Pariser
 * Platz. The official LoD2 bodies remain the massing authority: this module
 * only supplies the facade depth, cadence and roof-line cues that a plain
 * LoD2 extrusion cannot express. No photograph or downloaded texture ships
 * with the viewer.
 */

export const PARISER_PLATZ_ARCHITECTURE_PROFILE = {
  geometryStatus:
    "Berlin LoD2 front edges and heights; current OSM identities; primary-source facade systems; code-native recognition detail",
  sourceCheckedOn: "2026-08-21",
  performance: {
    drawCallBudget: 12,
    mobileCompatible: true,
    photoTexturesBundled: false,
    staticGeometry: true,
  },
  surfaceModes: ["day", "night", "snow", "schwellenraum"] as const,
  minecraftMode: "separate block-native signature",
  buildings: {
    maxLiebermannHaus: {
      address: "Pariser Platz 7",
      architect:
        "Josef Paul Kleihues, critical reconstruction after August Stüler",
      facadeCenterWorldM: [435.276, 4.82, 253.195] as const,
      facadeHeightM: 19.791,
      facadeWidthM: 28.08,
      outwardSign: -1,
      rotationYRad: -1.4814,
      lod2ParentId: "DEBE01YYK0000765",
      lod2PrismIds: ["DEBE3DqrWBrffcWT", "DEBE3DR4UJpsABDn"] as const,
      osmWayId: 131487807,
      sourceUrl: "https://stiftungbrandenburgertor.de/max-liebermann-haus/",
      visualQa: {
        license: "CC BY-SA 4.0",
        photoBundled: false,
        referenceUrl:
          "https://commons.wikimedia.org/wiki/File:Max-Liebermann-Haus_und_Palais_am_Pariser_Platz,_24-05-2025.jpg",
      },
    },
    frenchEmbassy: {
      address: "Pariser Platz 5",
      architect: "Christian de Portzamparc",
      facadeCenterWorldM: [518.712, 4.7, 231.25] as const,
      facadeHeightM: 19.936,
      facadeWidthM: 52.75,
      outwardSign: 1,
      rotationYRad: 0.0872,
      lod2ParentId: "DEBE01YYK00009wl",
      lod2PrismIds: ["DEBE3DvO9qerwgls", "DEBE3DfljI5jm0e2"] as const,
      osmRelationId: 3203772,
      sourceUrls: [
        "https://www.2portzamparc.com/en/projects/french-embassy-berlin/",
        "https://www.borgert-architekten.de/projekte/franzosische-botschaft",
      ] as const,
      visualQa: {
        license: "CC BY-SA 4.0",
        photoBundled: false,
        referenceUrl:
          "https://commons.wikimedia.org/wiki/File:Franz%C3%B6sische_Botschaft_Berlin.jpg",
      },
    },
    usEmbassy: {
      address: "Pariser Platz 2",
      architect: "Moore Ruble Yudell with Gruen Associates",
      facadeCenterWorldM: [461.062, 4.82, 359.499] as const,
      facadeHeightM: 21.414,
      facadeWidthM: 42.02,
      outwardSign: -1,
      rotationYRad: 0.0875,
      lod2ParentId: "DEBE01YYK00000k5",
      lod2PrismIds: [
        "DEBE3DCJHq6phC2X",
        "DEBE3Dp5ECflMBPo",
        "DEBE3DatQoVnhWDT",
        "DEBE3DyEJBgIbqVe",
      ] as const,
      osmWayId: 195257482,
      sourceUrl:
        "https://www.moorerubleyudell.com/project/united-states-embassy-berlin/",
      visualQa: {
        license: "Public domain",
        photoBundled: false,
        referenceUrl:
          "https://commons.wikimedia.org/wiki/File:US_Amerikanische_Botschaft_Berlin_Embassy_of_the_United_States_in_Berlin.JPG",
      },
    },
    akademieDerKuenste: {
      address: "Pariser Platz 4",
      architect: "Günter Behnisch with Werner Durth",
      facadeCenterWorldM: [541.352, 4.75, 351.599] as const,
      facadeHeightM: 20.211,
      facadeWidthM: 35.87,
      outwardSign: -1,
      rotationYRad: 0.0873,
      lod2ParentId: "DEBE01YYK00007H6",
      lod2PrismIds: ["DEBE3DwVkk7y3QJ9", "DEBE3DvasfSwCikJ"] as const,
      osmWayId: 237816189,
      sourceUrls: [
        "https://adk.de/besuch/veranstaltungsorte/pariser-platz",
        "https://adk.de/ueber-uns/akademie-geschichte",
        "https://www.baunetzwissen.de/fassade/objekte/kultur-bildung/akademie-der-kuenste-in-berlin-70588",
      ] as const,
      visualQa: {
        license: "CC BY-SA 3.0",
        photoBundled: false,
        referenceUrl:
          "https://commons.wikimedia.org/wiki/File:Akademie_der_Kuenste_Berlin_2.jpg",
      },
    },
  },
} as const;

export const PARISER_PLATZ_ARCHITECTURE_GROUP_NAME =
  "Pariser Platz source-bounded civic architecture";

export const PARISER_PLATZ_FACADE_NAMES = {
  akademie: "Akademie der Künste source-bounded facade",
  france: "French Embassy source-bounded facade",
  maxLiebermann: "Max-Liebermann-Haus source-bounded facade",
  usa: "US Embassy source-bounded facade",
} as const;

type FacadeFrame = {
  center: readonly [number, number, number];
  /** Positive local depth is the public-square side of the facade. */
  outwardSign: -1 | 1;
  rotationY: number;
};

type FacadeBoxOptions = {
  inked?: boolean;
  lamp?: boolean;
  rotationOffsetY?: number;
};

const MAX_FRAME: FacadeFrame = {
  center:
    PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.maxLiebermannHaus
      .facadeCenterWorldM,
  outwardSign: -1,
  rotationY:
    PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.maxLiebermannHaus.rotationYRad,
};
const FRANCE_FRAME: FacadeFrame = {
  center:
    PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.frenchEmbassy
      .facadeCenterWorldM,
  outwardSign: 1,
  rotationY:
    PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.frenchEmbassy.rotationYRad,
};
const USA_FRAME: FacadeFrame = {
  center:
    PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.usEmbassy.facadeCenterWorldM,
  outwardSign: -1,
  rotationY:
    PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.usEmbassy.rotationYRad,
};
const ADK_FRAME: FacadeFrame = {
  center:
    PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.akademieDerKuenste
      .facadeCenterWorldM,
  outwardSign: -1,
  rotationY:
    PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.akademieDerKuenste
      .rotationYRad,
};

const PALE_STONE = 0xe5e0d5;
const LIGHT_STONE = 0xd7d1c4;
const LIMESTONE = 0xcfc7b5;
const ROUGH_CONCRETE = 0xb9b5aa;
const DARK_REVEAL = 0x344249;
const GLASS = 0x7195a0;
const NIGHT_GLASS = 0xcaa976;
const STEEL = 0x56666b;
const DARK_STEEL = 0x39474c;
const LEAF_GLASS = 0x91ae92;

function worldPoint(
  frame: FacadeFrame,
  localU: number,
  localDepth: number,
): [number, number] {
  const cosine = Math.cos(frame.rotationY);
  const sine = Math.sin(frame.rotationY);
  const depth = localDepth * frame.outwardSign;
  return [
    frame.center[0] + localU * cosine + depth * sine,
    frame.center[2] - localU * sine + depth * cosine,
  ];
}

function addFacadeGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  options: FacadeBoxOptions = {},
): void {
  paintGeometry(geometry, color);
  (options.lamp ? builder.lamps : builder.parts).push(geometry);
  if (options.inked !== false) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function addFacadeBox(
  builder: Builder,
  frame: FacadeFrame,
  color: number,
  localU: number,
  centerAboveGround: number,
  localDepth: number,
  width: number,
  height: number,
  depth: number,
  options: FacadeBoxOptions = {},
): void {
  const [x, z] = worldPoint(frame, localU, localDepth);
  const geometry = new BoxGeometry(width, height, depth);
  geometry.rotateY(frame.rotationY + (options.rotationOffsetY ?? 0));
  geometry.translate(x, frame.center[1] + centerAboveGround, z);
  addFacadeGeometry(builder, geometry, color, options);
}

function addSlopedFacadeBar(
  builder: Builder,
  frame: FacadeFrame,
  color: number,
  localU: number,
  centerAboveGround: number,
  localDepth: number,
  length: number,
  thickness: number,
  angleZ: number,
): void {
  const [x, z] = worldPoint(frame, localU, localDepth);
  const geometry = new BoxGeometry(length, thickness, 0.12);
  geometry.rotateZ(angleZ);
  geometry.rotateY(frame.rotationY);
  geometry.translate(x, frame.center[1] + centerAboveGround, z);
  addFacadeGeometry(builder, geometry, color, { inked: false });
}

function finaliseFacade(
  builder: Builder,
  name: string,
  metadata: Record<string, unknown>,
): Group {
  const group = finishDrawnGroup(builder, {
    lampEmissive: 0xffd29a,
    lampEmissiveIntensity: 0.72,
    name,
  });
  if (!group) throw new Error(`${name} unexpectedly contains no geometry`);
  group.userData = {
    ...metadata,
    detailRole: "LoD2 facade recognition overlay",
    fadeClass: "fine-detail",
    photoTexturesBundled: false,
  };
  return group;
}

function createMaxLiebermannFacade(): Group {
  const builder = createBuilder();
  const profile =
    PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.maxLiebermannHaus;

  // The reconstructed Stüler elevation remains deliberately calm and
  // three-storey: pale ashlar, narrow punched windows, a heavy cornice and a
  // recessed roof/atelier zone that stays below the Brandenburg Gate.
  addFacadeBox(
    builder,
    MAX_FRAME,
    PALE_STONE,
    0,
    9.72,
    0.18,
    27.92,
    19.35,
    0.44,
  );
  addFacadeBox(
    builder,
    MAX_FRAME,
    LIGHT_STONE,
    0,
    0.32,
    0.46,
    28.16,
    0.64,
    0.66,
  );
  for (const height of [3.95, 8.72, 13.46, 17.92]) {
    addFacadeBox(
      builder,
      MAX_FRAME,
      height === 17.92 ? DARK_STEEL : LIGHT_STONE,
      0,
      height,
      0.48,
      height === 17.92 ? 28.45 : 28.08,
      height === 17.92 ? 0.34 : 0.2,
      height === 17.92 ? 0.72 : 0.56,
      { inked: false },
    );
  }
  for (const height of [0.92, 1.62, 2.32, 3.02]) {
    addFacadeBox(
      builder,
      MAX_FRAME,
      LIGHT_STONE,
      0,
      height,
      0.5,
      28.0,
      0.08,
      0.58,
      {
        inked: false,
      },
    );
  }

  const bayCenters = [-11.35, -8.1, -4.85, -1.6, 1.65, 4.9, 8.15, 11.4];
  for (let floor = 0; floor < 3; floor += 1) {
    const y = [2.45, 6.65, 11.25][floor];
    const height = [2.75, 3.15, 3.2][floor];
    for (let bay = 0; bay < bayCenters.length; bay += 1) {
      const isEntrance = floor === 0 && bay === 4;
      addFacadeBox(
        builder,
        MAX_FRAME,
        isEntrance
          ? DARK_REVEAL
          : (bay + floor) % 5 === 0
            ? NIGHT_GLASS
            : DARK_REVEAL,
        bayCenters[bay],
        isEntrance ? 2.05 : y,
        0.54,
        isEntrance ? 1.9 : floor === 0 ? 1.55 : 1.48,
        isEntrance ? 3.85 : height,
        0.18,
        { inked: false, lamp: !isEntrance && (bay + floor) % 5 === 0 },
      );
      if (!isEntrance) {
        addFacadeBox(
          builder,
          MAX_FRAME,
          LIGHT_STONE,
          bayCenters[bay],
          y,
          0.65,
          0.11,
          height + 0.18,
          0.12,
          {
            inked: false,
          },
        );
      }
    }
  }
  // The small reconstructed balcony and restrained attic windows are the
  // clearest near-gate recognition cues in the current Commons reference.
  addFacadeBox(
    builder,
    MAX_FRAME,
    DARK_STEEL,
    1.65,
    8.6,
    0.83,
    3.15,
    0.14,
    0.95,
  );
  for (const u of [0.25, 1.18, 2.12, 3.05]) {
    addFacadeBox(
      builder,
      MAX_FRAME,
      DARK_STEEL,
      u,
      9.05,
      0.94,
      0.06,
      0.9,
      0.08,
      {
        inked: false,
      },
    );
  }
  for (const u of [-9.8, -3.3, 3.2, 9.7]) {
    addFacadeBox(
      builder,
      MAX_FRAME,
      DARK_REVEAL,
      u,
      15.68,
      0.53,
      1.45,
      1.85,
      0.16,
      {
        inked: false,
      },
    );
  }
  for (const u of [-12, -8, -4, 0, 4, 8, 12]) {
    addFacadeBox(
      builder,
      MAX_FRAME,
      PALE_STONE,
      u,
      18.65,
      0.45,
      0.66,
      1.2,
      0.58,
    );
  }

  return finaliseFacade(builder, PARISER_PLATZ_FACADE_NAMES.maxLiebermann, {
    facadeStoreys: 3,
    facadeWidthM: profile.facadeWidthM,
    geometryAnchor: `${profile.lod2ParentId} / OSM way ${profile.osmWayId}`,
    primarySource: profile.sourceUrl,
    reconstruction: "critical reconstruction after the sober 1844 Stüler house",
  });
}

function createFrenchEmbassyFacade(): Group {
  const builder = createBuilder();
  const profile = PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.frenchEmbassy;

  addFacadeBox(
    builder,
    FRANCE_FRAME,
    LIMESTONE,
    0,
    10.0,
    0.18,
    52.6,
    19.7,
    0.46,
  );
  // Roughened Béton éclaté base, kept as alternating deep courses rather than
  // a smooth generic sandstone wall.
  addFacadeBox(
    builder,
    FRANCE_FRAME,
    ROUGH_CONCRETE,
    0,
    2.15,
    0.52,
    52.75,
    4.3,
    0.72,
  );
  for (const y of [0.72, 1.42, 2.12, 2.82, 3.52]) {
    addFacadeBox(
      builder,
      FRANCE_FRAME,
      y % 1.4 < 0.2 ? LIGHT_STONE : LIMESTONE,
      0,
      y,
      0.88,
      52.65,
      0.12,
      0.28,
      {
        inked: false,
      },
    );
  }

  // The six-metre Rue de France is an actual dark, covered cut through the
  // seven-building complex, not a centred office-door decal.
  const passageU = -2.25;
  addFacadeBox(
    builder,
    FRANCE_FRAME,
    DARK_REVEAL,
    passageU,
    4.0,
    0.88,
    6.15,
    7.8,
    0.24,
  );
  for (const u of [-4.55, -2.25, 0.05]) {
    addFacadeBox(
      builder,
      FRANCE_FRAME,
      STEEL,
      u,
      4.05,
      1.05,
      0.16,
      7.55,
      0.12,
      {
        inked: false,
      },
    );
  }
  addFacadeBox(
    builder,
    FRANCE_FRAME,
    GLASS,
    passageU,
    7.35,
    1.06,
    5.7,
    0.62,
    0.14,
    {
      inked: false,
      lamp: true,
    },
  );

  const tallBays = [-22.7, -17.0, -11.3, 5.0, 10.7, 16.4, 22.1];
  for (let index = 0; index < tallBays.length; index += 1) {
    const u = tallBays[index];
    addFacadeBox(
      builder,
      FRANCE_FRAME,
      index % 4 === 1 ? NIGHT_GLASS : GLASS,
      u,
      9.2,
      0.63,
      3.45,
      7.3,
      0.18,
      { inked: false, lamp: index % 4 === 1 },
    );
    for (const mullion of [-1.13, 0, 1.13]) {
      addFacadeBox(
        builder,
        FRANCE_FRAME,
        STEEL,
        u + mullion,
        9.2,
        0.76,
        0.08,
        7.36,
        0.1,
        {
          inked: false,
        },
      );
    }
    addFacadeBox(builder, FRANCE_FRAME, STEEL, u, 9.1, 0.77, 3.35, 0.1, 0.1, {
      inked: false,
    });
  }
  for (const y of [4.48, 13.0, 17.25, 19.15]) {
    addFacadeBox(
      builder,
      FRANCE_FRAME,
      LIGHT_STONE,
      0,
      y,
      0.58,
      52.9,
      y > 18 ? 0.42 : 0.24,
      0.62,
      {
        inked: false,
      },
    );
  }
  // A tighter upper register and the high parapet restore Portzamparc's
  // horizontal layering without pretending that the seven buildings are one
  // uniform office slab.
  for (let bay = 0; bay < 12; bay += 1) {
    const u = -23.85 + bay * 4.32;
    addFacadeBox(
      builder,
      FRANCE_FRAME,
      bay % 5 === 2 ? NIGHT_GLASS : DARK_REVEAL,
      u,
      15.05,
      0.64,
      2.9,
      2.35,
      0.16,
      {
        inked: false,
        lamp: bay % 5 === 2,
      },
    );
    addFacadeBox(
      builder,
      FRANCE_FRAME,
      LIMESTONE,
      u - 1.8,
      15.05,
      0.7,
      0.2,
      3.0,
      0.2,
      {
        inked: false,
      },
    );
  }
  for (const u of [-18.5, -9.3, 3.6, 12.8, 22.0]) {
    addFacadeBox(
      builder,
      FRANCE_FRAME,
      LIMESTONE,
      u,
      19.6,
      0.4,
      0.5,
      0.75,
      0.62,
    );
  }

  return finaliseFacade(builder, PARISER_PLATZ_FACADE_NAMES.france, {
    composition:
      "roughened base, double-height Bel Etage and covered Rue de France",
    facadeWidthM: profile.facadeWidthM,
    geometryAnchor: `${profile.lod2ParentId} / OSM relation ${profile.osmRelationId}`,
    primarySources: profile.sourceUrls,
    rueDeFranceWidthM: 6.15,
  });
}

function createUsEmbassyFacade(): Group {
  const builder = createBuilder();
  const profile = PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.usEmbassy;

  addFacadeBox(
    builder,
    USA_FRAME,
    LIMESTONE,
    -2.2,
    10.65,
    0.18,
    37.45,
    21.1,
    0.5,
  );
  addFacadeBox(
    builder,
    USA_FRAME,
    LIGHT_STONE,
    18.55,
    10.5,
    -0.2,
    4.35,
    20.7,
    0.5,
  );
  // Deep-set, four-level limestone grid on the western portion of the square
  // front. The openings are wider than the former generic eleven-bay screen.
  const gridBays = [-17.0, -12.2, -7.4, -2.6, 2.2, 7.0];
  for (let floor = 0; floor < 4; floor += 1) {
    for (let bay = 0; bay < gridBays.length; bay += 1) {
      const lit = (floor * 3 + bay) % 7 === 2;
      addFacadeBox(
        builder,
        USA_FRAME,
        lit ? NIGHT_GLASS : DARK_REVEAL,
        gridBays[bay],
        3.0 + floor * 4.35,
        0.59,
        3.05,
        2.45,
        0.2,
        { inked: false, lamp: lit },
      );
      addFacadeBox(
        builder,
        USA_FRAME,
        LIGHT_STONE,
        gridBays[bay],
        3.0 + floor * 4.35,
        0.72,
        0.12,
        2.55,
        0.12,
        {
          inked: false,
        },
      );
    }
  }
  for (const y of [0.58, 5.05, 9.4, 13.75, 18.1, 20.72]) {
    addFacadeBox(
      builder,
      USA_FRAME,
      LIGHT_STONE,
      -2.1,
      y,
      0.6,
      38.1,
      y === 20.72 ? 0.56 : 0.22,
      0.62,
      {
        inked: false,
      },
    );
  }

  // Seven stone facets describe the official architects' cylindrical entry
  // niche. The glass-roofed rotunda remains legible in oblique/isometric view
  // but uses boxes only, so it also survives low-end mobile GPUs cleanly.
  const nicheCenterU = 12.65;
  for (let segment = -3; segment <= 3; segment += 1) {
    const angle = (segment / 6) * Math.PI * 0.78;
    const u = nicheCenterU + Math.sin(angle) * 4.15;
    const outward = 0.45 + Math.cos(angle) * 1.55;
    addFacadeBox(
      builder,
      USA_FRAME,
      LIMESTONE,
      u,
      10.6,
      outward,
      1.35,
      20.6,
      0.8,
      {
        rotationOffsetY: -angle * 0.42,
      },
    );
  }
  addFacadeBox(
    builder,
    USA_FRAME,
    DARK_REVEAL,
    nicheCenterU,
    4.0,
    2.25,
    5.45,
    7.55,
    0.3,
  );
  for (const u of [10.65, 12.65, 14.65]) {
    addFacadeBox(builder, USA_FRAME, STEEL, u, 4.05, 2.48, 0.16, 7.2, 0.12, {
      inked: false,
    });
  }
  for (const u of [11.65, 13.65]) {
    addFacadeBox(builder, USA_FRAME, GLASS, u, 4.05, 2.5, 1.7, 6.6, 0.1, {
      inked: false,
      lamp: true,
    });
  }
  // Shallow three-part glass canopy, stepped into a low arch.
  for (let step = -3; step <= 3; step += 1) {
    const lift = 7.75 + (3 - Math.abs(step)) * 0.24;
    addFacadeBox(
      builder,
      USA_FRAME,
      GLASS,
      nicheCenterU + step * 1.05,
      lift,
      3.25,
      1.12,
      0.22,
      2.1,
      {
        inked: false,
        lamp: Math.abs(step) <= 1,
      },
    );
  }
  // The rooftop State Room lantern is explicitly documented by the architect
  // as a softly glowing crown above the courtyard.
  addFacadeBox(builder, USA_FRAME, STEEL, 2.0, 21.55, -3.6, 10.5, 0.45, 4.4);
  for (const u of [-1.45, 1.0, 3.45, 5.9]) {
    addFacadeBox(builder, USA_FRAME, GLASS, u, 23.25, -3.6, 2.0, 3.0, 3.7, {
      inked: false,
      lamp: true,
    });
  }
  addFacadeBox(builder, USA_FRAME, STEEL, 2.25, 24.85, -3.6, 10.8, 0.28, 4.4);

  return finaliseFacade(builder, PARISER_PLATZ_FACADE_NAMES.usa, {
    facadeWidthM: profile.facadeWidthM,
    geometryAnchor: `${profile.lod2ParentId} / OSM way ${profile.osmWayId}`,
    primarySource: profile.sourceUrl,
    recognitionCues: [
      "north-facing limestone grid",
      "cylindrical entrance niche and glass canopy",
      "softly lit rooftop State Room lantern",
    ],
  });
}

function createAkademieFacade(): Group {
  const builder = createBuilder();
  const profile =
    PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.akademieDerKuenste;

  // A cool glass field sits just outside the surveyed head-building. Steel
  // mullions and visible ramps supply depth; the retained historic rooms stay
  // in the LoD2 mass behind this public passage frontage.
  addFacadeBox(
    builder,
    ADK_FRAME,
    DARK_REVEAL,
    0,
    10.0,
    0.08,
    35.75,
    19.85,
    0.34,
  );
  for (let floor = 0; floor < 5; floor += 1) {
    for (let bay = 0; bay < 9; bay += 1) {
      const lit = (bay + floor * 2) % 8 === 3;
      addFacadeBox(
        builder,
        ADK_FRAME,
        lit ? NIGHT_GLASS : floor === 4 ? LEAF_GLASS : GLASS,
        -15.85 + bay * 3.96,
        2.0 + floor * 3.72,
        0.42,
        3.55,
        3.25,
        0.12,
        { inked: false, lamp: lit },
      );
    }
  }
  for (let bay = 0; bay <= 9; bay += 1) {
    addFacadeBox(
      builder,
      ADK_FRAME,
      STEEL,
      -17.83 + bay * 3.96,
      10.0,
      0.58,
      0.13,
      19.7,
      0.16,
      {
        inked: false,
      },
    );
  }
  for (const y of [0.38, 3.68, 7.4, 11.12, 14.84, 18.56, 19.88]) {
    addFacadeBox(builder, ADK_FRAME, STEEL, 0, y, 0.58, 35.8, 0.13, 0.16, {
      inked: false,
    });
  }

  // Behnisch's publicly visible circulation becomes two fine zigzags behind
  // the curtain wall. The bars are code-native structural hints, not an
  // invented opaque facade pattern.
  for (const direction of [-1, 1]) {
    for (let flight = 0; flight < 4; flight += 1) {
      const y = 3.15 + flight * 3.75;
      const u = direction * 5.9 + (flight % 2 === 0 ? -2.0 : 2.0);
      addSlopedFacadeBar(
        builder,
        ADK_FRAME,
        LIGHT_STONE,
        u,
        y,
        0.76,
        8.0,
        0.25,
        (flight % 2 === 0 ? 1 : -1) * 0.43,
      );
      addFacadeBox(
        builder,
        ADK_FRAME,
        LIGHT_STONE,
        direction * 5.9,
        y + 1.75,
        0.76,
        4.15,
        0.2,
        0.12,
        {
          inked: false,
        },
      );
    }
  }

  // The suspended pipe frame sits about 40 cm in front of the glass and
  // traces the lost Palais elevation, as documented by the facade specialist.
  for (const u of [-13.4, -6.7, 0, 6.7, 13.4]) {
    addFacadeBox(
      builder,
      ADK_FRAME,
      LIGHT_STONE,
      u,
      10.2,
      0.96,
      0.15,
      19.0,
      0.15,
      {
        inked: false,
      },
    );
  }
  for (const y of [1.1, 6.15, 11.2, 16.25, 19.6]) {
    addFacadeBox(
      builder,
      ADK_FRAME,
      LIGHT_STONE,
      0,
      y,
      0.96,
      31.4,
      0.15,
      0.15,
      {
        inked: false,
      },
    );
  }
  addFacadeBox(
    builder,
    ADK_FRAME,
    LEAF_GLASS,
    0,
    20.22,
    -1.45,
    35.6,
    0.32,
    4.5,
    {
      inked: false,
    },
  );
  for (const u of [-14, -7, 0, 7, 14]) {
    addFacadeBox(builder, ADK_FRAME, STEEL, u, 20.4, -1.45, 0.16, 0.42, 4.7, {
      inked: false,
    });
  }

  return finaliseFacade(builder, PARISER_PLATZ_FACADE_NAMES.akademie, {
    facadeWidthM: profile.facadeWidthM,
    geometryAnchor: `${profile.lod2ParentId} / OSM way ${profile.osmWayId}`,
    primarySources: profile.sourceUrls,
    recognitionCues: [
      "glass curtain wall",
      "publicly visible circulation",
      "suspended 0.4 m pipe-frame trace",
      "leaf-toned glass roof",
    ],
  });
}

export function createPariserPlatzArchitecture(): Group {
  const group = new Group();
  group.name = PARISER_PLATZ_ARCHITECTURE_GROUP_NAME;
  group.userData = {
    ...PARISER_PLATZ_ARCHITECTURE_PROFILE,
    underlyingLoD2Retained: true,
    collisionRole: "visual-only; surveyed LoD2 remains navigation authority",
  };
  group.add(createMaxLiebermannFacade());
  group.add(createFrenchEmbassyFacade());
  group.add(createUsEmbassyFacade());
  group.add(createAkademieFacade());
  return group;
}
