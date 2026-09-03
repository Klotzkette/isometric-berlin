import { BoxGeometry, BufferGeometry, EdgesGeometry, Group } from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  type Builder,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";

/**
 * Source-bounded recognition facades for the five civic buildings on Pariser
 * Platz. The official LoD2 bodies remain the massing authority: this module
 * only supplies the facade depth, cadence and roof-line cues that a plain
 * LoD2 extrusion cannot express. No photograph or downloaded texture ships
 * with the viewer.
 */

export const PARISER_PLATZ_ARCHITECTURE_PROFILE = {
  geometryStatus:
    "Berlin LoD2 front edges and heights; current OSM identities; primary-source facade systems; code-native recognition detail",
  sourceCheckedOn: "2026-09-03",
  performance: {
    drawCallBudget: 15,
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
    europeanHouse: {
      address: "Unter den Linden 78",
      architect: "Hans Kollhoff",
      facadeCenterWorldM: [597.746, 4.85, 255.313] as const,
      facadeSourceEdgeWorldM: [
        [587.024, 256.22],
        [608.468, 254.406],
      ] as const,
      facadeHeightM: 26.385,
      roofHeightM: 34.46,
      facadeWidthM: 21.520588560724782,
      outwardSign: 1,
      rotationYRad: 0.08439151100635693,
      westReturn: {
        centerWorldM: [586.4055, 4.85, 249.262] as const,
        widthM: 13.970870588478038,
        rotationYRad: -1.4821388605632353,
      },
      lod2ParentId: "DEBE01YYK00005TM",
      lod2PrismIds: [
        "DEBE3DmVyyFpdPDu",
        "DEBE3Dubti8G9AB9",
        "DEBE3DvzY85jDxuR",
      ] as const,
      osmNodeIds: [514881066, 11816495166] as const,
      sourceUrls: [
        "https://germany.representation.ec.europa.eu/uber-uns/europaisches-haus_de",
      ] as const,
      visualQa: {
        license: "CC BY-SA 4.0",
        photoBundled: false,
        referenceUrl:
          "https://commons.wikimedia.org/wiki/File:Europ%C3%A4isches_Haus,_Unter_den_Linden_78,_24-05-2025.jpg",
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
  europeanHouse: "Europäisches Haus source-bounded facade",
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
const EUROPE_FRAME: FacadeFrame = {
  center:
    PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.europeanHouse
      .facadeCenterWorldM,
  outwardSign: 1,
  rotationY:
    PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.europeanHouse.rotationYRad,
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
const EU_BLUE = 0x2855a3;
const GILT = 0xd8bc68;
const PATINATED_COPPER = 0x6e8579;

const FACADE_GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  K: ["101", "101", "110", "101", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
  O: ["010", "101", "101", "101", "010"],
  P: ["110", "101", "110", "100", "100"],
  R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
};

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

// Small relief lettering is merged into the existing facade, with no canvas,
// texture, extra material or per-frame work.
function addFacadeWordmark(
  builder: Builder,
  frame: FacadeFrame,
  text: string,
  color: number,
  centerU: number,
  centerY: number,
  depth: number,
  pixelM: number,
): void {
  const columns = [...text].reduce(
    (sum, letter) => sum + (letter === " " ? 3 : 4),
    -1,
  );
  let cursor = (-columns * pixelM) / 2;
  for (const letter of text) {
    const glyph = FACADE_GLYPHS[letter];
    glyph?.forEach((row, y) => {
      [...row].forEach((pixel, x) => {
        if (pixel !== "1") return;
        addFacadeBox(
          builder,
          frame,
          color,
          centerU + cursor + (x + 0.5) * pixelM,
          centerY + (2 - y) * pixelM,
          depth,
          pixelM * 0.86,
          pixelM * 0.86,
          0.055,
          { inked: false },
        );
      });
    });
    cursor += (letter === " " ? 3 : 4) * pixelM;
  }
}

function addEuropeanFlag(
  builder: Builder,
  frame: FacadeFrame,
  u: number,
  y: number,
): void {
  addFacadeBox(builder, frame, STEEL, u, y, 1.4, 0.07, 3.2, 0.07, {
    inked: false,
  });
  addFacadeBox(
    builder,
    frame,
    EU_BLUE,
    u + 0.78,
    y + 0.55,
    1.42,
    1.5,
    1.05,
    0.06,
    { inked: false },
  );
  for (let star = 0; star < 12; star += 1) {
    const angle = (star * Math.PI) / 6;
    addFacadeBox(
      builder,
      frame,
      GILT,
      u + 0.78 + Math.sin(angle) * 0.33,
      y + 0.55 + Math.cos(angle) * 0.33,
      1.47,
      0.085,
      0.085,
      0.04,
      { inked: false },
    );
  }
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

  for (let joint = -25; joint <= 25; joint += 2.8) {
    if (Math.abs(joint - passageU) < 3.5) continue;
    addFacadeBox(
      builder,
      FRANCE_FRAME,
      LIGHT_STONE,
      joint,
      2.12,
      1.025,
      0.055,
      4.1,
      0.045,
      { inked: false },
    );
  }
  for (const u of [-3.72, -0.78]) {
    addFacadeBox(
      builder,
      FRANCE_FRAME,
      GLASS,
      u,
      2.25,
      1.11,
      2.72,
      4.05,
      0.06,
      { inked: false },
    );
    addFacadeBox(
      builder,
      FRANCE_FRAME,
      LIGHT_STONE,
      u + 0.55,
      1.55,
      1.17,
      0.045,
      0.68,
      0.05,
      { inked: false },
    );
  }
  for (const u of tallBays) {
    addFacadeBox(
      builder,
      FRANCE_FRAME,
      LIGHT_STONE,
      u,
      5.43,
      0.97,
      3.72,
      0.2,
      0.82,
      { inked: false },
    );
    addFacadeBox(
      builder,
      FRANCE_FRAME,
      DARK_STEEL,
      u,
      6.14,
      1.18,
      3.48,
      0.065,
      0.065,
      { inked: false },
    );
    for (const offset of [-1.5, 0, 1.5]) {
      addFacadeBox(
        builder,
        FRANCE_FRAME,
        DARK_STEEL,
        u + offset,
        5.81,
        1.18,
        0.045,
        0.7,
        0.065,
        { inked: false },
      );
    }
  }
  addFacadeWordmark(
    builder,
    FRANCE_FRAME,
    "AMBASSADE DE FRANCE",
    GILT,
    passageU,
    8.35,
    1.12,
    0.12,
  );
  addEuropeanFlag(builder, FRANCE_FRAME, 2.0, 5.65);
  addFacadeBox(
    builder,
    FRANCE_FRAME,
    STEEL,
    -7.05,
    5.65,
    1.4,
    0.07,
    3.2,
    0.07,
    { inked: false },
  );
  [EU_BLUE, 0xf4f1e9, 0xc34948].forEach((color, stripe) => {
    addFacadeBox(
      builder,
      FRANCE_FRAME,
      color,
      -6.8 + stripe * 0.5,
      6.2,
      1.42,
      0.5,
      1.05,
      0.06,
      { inked: false },
    );
  });

  return finaliseFacade(builder, PARISER_PLATZ_FACADE_NAMES.france, {
    composition:
      "roughened base, double-height Bel Etage and covered Rue de France",
    facadeWidthM: profile.facadeWidthM,
    geometryAnchor: `${profile.lod2ParentId} / OSM relation ${profile.osmRelationId}`,
    primarySources: profile.sourceUrls,
    rueDeFranceWidthM: 6.15,
    recognitionCues: [
      "jointed rough base",
      "recessed paired entrance doors",
      "Bel Etage balcony rails",
      "French tricolour and European flag",
      "relief embassy lettering",
    ],
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
      addSlopedFacadeBar(
        builder,
        ADK_FRAME,
        STEEL,
        u,
        y + 0.52,
        0.82,
        8.0,
        0.07,
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

  addFacadeBox(builder, ADK_FRAME, DARK_REVEAL, 0, 1.9, 1.12, 11.9, 3.6, 0.12, {
    inked: false,
  });
  for (const u of [-4.6, -2.3, 0, 2.3, 4.6]) {
    addFacadeBox(builder, ADK_FRAME, GLASS, u, 1.85, 1.21, 2.14, 3.3, 0.08, {
      inked: false,
      lamp: u === 0,
    });
    addFacadeBox(
      builder,
      ADK_FRAME,
      LIGHT_STONE,
      u + 0.99,
      1.85,
      1.28,
      0.075,
      3.42,
      0.075,
      { inked: false },
    );
    addFacadeBox(
      builder,
      ADK_FRAME,
      LIGHT_STONE,
      u + 0.5,
      1.42,
      1.31,
      0.045,
      0.65,
      0.055,
      { inked: false },
    );
  }
  addFacadeBox(builder, ADK_FRAME, STEEL, 0, 3.72, 1.24, 13.7, 0.18, 1.45, {
    inked: false,
  });
  addFacadeWordmark(
    builder,
    ADK_FRAME,
    "AKADEMIE DER KUENSTE",
    PALE_STONE,
    0,
    4.28,
    1.38,
    0.15,
  );
  for (const y of [8.2, 12.0, 15.75]) {
    addFacadeBox(
      builder,
      ADK_FRAME,
      LIGHT_STONE,
      -0.8,
      y,
      0.9,
      25.0,
      0.24,
      0.2,
      { inked: false },
    );
    addFacadeBox(
      builder,
      ADK_FRAME,
      STEEL,
      -0.8,
      y + 0.85,
      0.94,
      25.0,
      0.06,
      0.06,
      { inked: false },
    );
    for (let u = -12.5; u < 12; u += 2.8) {
      addFacadeBox(
        builder,
        ADK_FRAME,
        STEEL,
        u,
        y + 0.45,
        0.94,
        0.045,
        0.84,
        0.065,
        { inked: false },
      );
    }
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
      "five glazed entrance doors and thin canopy",
      "relief academy lettering and open gallery balustrades",
    ],
  });
}

function createEuropeanHouseFacade(): Group {
  const builder = createBuilder();
  const profile = PARISER_PLATZ_ARCHITECTURE_PROFILE.buildings.europeanHouse;
  addFacadeBox(
    builder,
    EUROPE_FRAME,
    PALE_STONE,
    0,
    13.16,
    0.16,
    21.42,
    26.25,
    0.38,
  );
  for (const y of [0.38, 4.8, 8.15, 11.5, 14.85, 18.2, 21.55, 25.6, 26.25]) {
    addFacadeBox(
      builder,
      EUROPE_FRAME,
      LIGHT_STONE,
      0,
      y,
      0.48,
      21.58,
      y > 25 ? 0.3 : 0.18,
      0.48,
      { inked: false },
    );
  }
  for (let floor = 0; floor < 6; floor += 1) {
    for (let bay = 0; bay < 7; bay += 1) {
      const u = -8.85 + bay * 2.95;
      const y = 6.43 + floor * 3.35;
      const lit = (floor + bay * 3) % 11 === 2;
      addFacadeBox(
        builder,
        EUROPE_FRAME,
        DARK_REVEAL,
        u,
        y,
        0.41,
        1.96,
        2.76,
        0.16,
        { inked: false },
      );
      addFacadeBox(
        builder,
        EUROPE_FRAME,
        lit ? NIGHT_GLASS : GLASS,
        u,
        y,
        0.52,
        1.67,
        2.53,
        0.08,
        { inked: false, lamp: lit },
      );
      addFacadeBox(
        builder,
        EUROPE_FRAME,
        LIGHT_STONE,
        u,
        y,
        0.59,
        0.065,
        2.58,
        0.065,
        { inked: false },
      );
      addFacadeBox(
        builder,
        EUROPE_FRAME,
        DARK_STEEL,
        u,
        y - 0.8,
        0.64,
        1.72,
        0.055,
        0.08,
        { inked: false },
      );
      if (floor < 4 && (bay + floor * 2) % 3 === 0) {
        addFacadeBox(
          builder,
          EUROPE_FRAME,
          EU_BLUE,
          u,
          y + 1.22,
          0.87,
          1.92,
          0.2,
          0.85,
          { inked: false },
        );
      }
    }
  }
  for (let bay = 0; bay < 7; bay += 1) {
    const u = -8.85 + bay * 2.95;
    addFacadeBox(
      builder,
      EUROPE_FRAME,
      GLASS,
      u,
      2.25,
      0.54,
      2.28,
      3.95,
      0.12,
      { inked: false, lamp: bay === 5 },
    );
    addFacadeBox(
      builder,
      EUROPE_FRAME,
      DARK_STEEL,
      u,
      2.25,
      0.66,
      0.08,
      4.02,
      0.08,
      { inked: false },
    );
  }
  addFacadeWordmark(
    builder,
    EUROPE_FRAME,
    "EUROPAEISCHES HAUS",
    GILT,
    0,
    4.67,
    0.83,
    0.13,
  );
  addEuropeanFlag(builder, EUROPE_FRAME, 4.6, 5.9);
  addFacadeBox(
    builder,
    EUROPE_FRAME,
    EU_BLUE,
    5.9,
    4.23,
    0.95,
    5.1,
    0.18,
    1.35,
    { inked: false },
  );

  const westFrame: FacadeFrame = {
    center: profile.westReturn.centerWorldM,
    outwardSign: 1,
    rotationY: profile.westReturn.rotationYRad,
  };
  addFacadeBox(
    builder,
    westFrame,
    PALE_STONE,
    0,
    13.16,
    0.16,
    profile.westReturn.widthM,
    26.25,
    0.38,
  );
  for (const y of [0.38, 4.8, 8.15, 11.5, 14.85, 18.2, 21.55, 25.6, 26.25]) {
    addFacadeBox(
      builder,
      westFrame,
      LIGHT_STONE,
      0,
      y,
      0.48,
      profile.westReturn.widthM,
      0.2,
      0.48,
      { inked: false },
    );
  }
  for (let floor = 0; floor < 7; floor += 1) {
    for (let bay = 0; bay < 4; bay += 1) {
      const u = -4.8 + bay * 3.2;
      const y = floor === 0 ? 2.25 : 6.43 + (floor - 1) * 3.35;
      addFacadeBox(
        builder,
        westFrame,
        GLASS,
        u,
        y,
        0.52,
        floor === 0 ? 2.3 : 1.67,
        floor === 0 ? 3.95 : 2.53,
        0.12,
        { inked: false, lamp: floor === 2 && bay === 1 },
      );
      addFacadeBox(
        builder,
        westFrame,
        LIGHT_STONE,
        u,
        y,
        0.63,
        0.07,
        floor === 0 ? 3.95 : 2.53,
        0.06,
        { inked: false },
      );
      if (floor > 0 && floor < 5 && (bay + floor) % 3 === 0) {
        addFacadeBox(
          builder,
          westFrame,
          EU_BLUE,
          u,
          y + 1.22,
          0.87,
          1.92,
          0.2,
          0.85,
          { inked: false },
        );
      }
    }
  }

  // A shallow roof skin follows the eaves and the highest retained LoD2
  // part; it does not fill the courtyard or replace the surveyed roof mass.
  const [roofX, roofZ] = worldPoint(EUROPE_FRAME, 0, -1.9);
  const roof = new BoxGeometry(21.2, 8.6, 0.24);
  roof.rotateX(-0.46);
  roof.rotateY(EUROPE_FRAME.rotationY);
  roof.translate(roofX, EUROPE_FRAME.center[1] + 30.25, roofZ);
  addFacadeGeometry(builder, roof, PATINATED_COPPER);
  for (const u of [-7.5, -3.75, 0, 3.75, 7.5]) {
    addFacadeBox(
      builder,
      EUROPE_FRAME,
      LIGHT_STONE,
      u,
      28.76,
      -0.55,
      1.66,
      2.0,
      0.55,
    );
    addFacadeBox(
      builder,
      EUROPE_FRAME,
      DARK_REVEAL,
      u,
      28.7,
      -0.22,
      1.15,
      1.45,
      0.09,
      { inked: false },
    );
  }
  return finaliseFacade(builder, PARISER_PLATZ_FACADE_NAMES.europeanHouse, {
    facadeWidthM: profile.facadeWidthM,
    geometryAnchor: `${profile.lod2ParentId} / OSM nodes ${profile.osmNodeIds.join(", ")}`,
    primarySources: profile.sourceUrls,
    recognitionCues: [
      "pale natural-stone window grid",
      "blue sunshades",
      "European flag and gilt house lettering",
      "green pitched roof and dormers",
      "short Wilhelmstrasse return with the courtyard left open",
    ],
    dimensionPolicy:
      "surveyed frontage and heights; local window, awning and roof subdivisions are display approximations",
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
  group.add(createEuropeanHouseFacade());
  return group;
}
