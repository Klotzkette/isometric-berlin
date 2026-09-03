export type SonyFacadePoint = readonly [number, number];
export type SonyFacadeRun = Readonly<{
  prismId: string;
  groundY: number;
  heightM: number;
  chain: readonly SonyFacadePoint[];
}>;
export type SonyFacadeStyle =
  | "filmhaus"
  | "curtain-wall"
  | "esplanade"
  | "forum-apartments"
  | "art-deco"
  | "stone-office"
  | "marriott"
  | "parkside";
export type SonySurroundingBuilding = Readonly<{
  id: string;
  name: string;
  parentId: string;
  style: SonyFacadeStyle;
  tone: number;
  floorPitchM: number;
  firstFloorM: number;
  tonePrismIds?: readonly string[];
  runs: readonly SonyFacadeRun[];
}>;

export const SONY_SURROUNDINGS_GROUP_NAME =
  "Sony Center source-bounded surrounding facades";
export const MINECRAFT_SONY_SURROUNDINGS_GROUP_NAME =
  "Minecraft Sony Center surrounding facades";

// Chains are consecutive exterior vertices of the committed decimetre LoD2
// prisms, in their original winding. Window/balcony subdivisions are visual
// approximations, not survey measurements or a second building envelope.
export const SONY_SURROUNDING_BUILDINGS: readonly SonySurroundingBuilding[] = [
  {
    id: "filmhaus",
    name: "Filmhaus",
    parentId: "DEBE01YYK0002Kau",
    style: "filmhaus",
    tone: 0xb9b4ae,
    floorPitchM: 3.65,
    firstFloorM: 4.2,
    tonePrismIds: ["CcFDdt3S", "fg93s0oZ", "AnSKFI6b", "y45xvhYD"],
    runs: [
      {
        prismId: "ORetJTt6",
        groundY: 5.1,
        heightM: 42,
        chain: [
          [167.8, 1042.6],
          [73.8, 1052.6],
        ],
      },
    ],
  },
  {
    id: "west-office",
    name: "Ben-Gurion-Strasse office",
    parentId: "DEBE01YYK0002Kfp",
    style: "curtain-wall",
    tone: 0xa7b9bb,
    floorPitchM: 3.65,
    firstFloorM: 4.1,
    tonePrismIds: ["zJk1E4E5", "t3wpbzwr"],
    runs: [
      {
        prismId: "NxreoulJ",
        groundY: 4.4,
        heightM: 34.9,
        chain: [
          [10.3, 1053.9],
          [-1.9, 962.9],
        ],
      },
      {
        prismId: "buyDLWGH",
        groundY: 4.2,
        heightM: 41.6,
        chain: [
          [54.7, 1054.6],
          [14.6, 1058.9],
        ],
      },
    ],
  },
  {
    id: "kemperplatz",
    name: "Kemperplatz office",
    parentId: "DEBE01YYK0002MgI",
    style: "curtain-wall",
    tone: 0xa3b3b8,
    floorPitchM: 3.8,
    firstFloorM: 4.1,
    tonePrismIds: ["lxRlzBVD", "d2kXS5EB", "MH4JItVw"],
    runs: [
      {
        prismId: "vfRWreMo",
        groundY: 4.5,
        heightM: 42.7,
        chain: [
          [-12.8, 881.6],
          [-5.5, 883.1],
          [1.6, 884.8],
          [8.1, 886.7],
          [14.5, 888.9],
        ],
      },
      {
        prismId: "vfRWreMo",
        groundY: 4.5,
        heightM: 42.7,
        chain: [
          [29.5, 895.3],
          [33.1, 897.2],
          [43.7, 903.5],
          [50.4, 908.1],
          [56.9, 913.1],
          [63.2, 918.5],
          [69.2, 924.3],
        ],
      },
      {
        prismId: "5QXWqu76",
        groundY: 4.3,
        heightM: 32.9,
        chain: [
          [-4.4, 944.2],
          [-10.7, 897.7],
        ],
      },
    ],
  },
  {
    id: "bellevue",
    name: "Bellevuestrasse curved office",
    parentId: "DEBE01YYK0002Lgg",
    style: "curtain-wall",
    tone: 0x9cbbbd,
    floorPitchM: 3.7,
    firstFloorM: 4.5,
    tonePrismIds: ["K59EqDZD", "XycsT3DU", "yrMoN8ct"],
    runs: [
      {
        prismId: "VcJslliG",
        groundY: 4.7,
        heightM: 42.9,
        chain: [
          [42.8, 962.3],
          [46.8, 956.3],
          [51.9, 951.2],
          [55.6, 948.2],
          [59.8, 945.7],
          [64.1, 943.7],
          [68.7, 942.2],
          [73.7, 941],
          [78.8, 940.2],
          [86.2, 939.6],
          [94, 939.8],
          [102.6, 941],
          [111, 943.2],
          [116.5, 945.3],
          [124.3, 949.2],
          [131.1, 953.7],
          [136.7, 958.3],
        ],
      },
    ],
  },
  {
    id: "esplanade",
    name: "Esplanade Residence",
    parentId: "DEBE01YYK0002MZY",
    style: "esplanade",
    tone: 0xa8b9b8,
    floorPitchM: 3.35,
    firstFloorM: 12.5,
    tonePrismIds: ["HMu89A0R", "N9pz5SKS"],
    runs: [
      {
        prismId: "1Zji3JHg",
        groundY: 5,
        heightM: 42.2,
        chain: [
          [151.1, 964.4],
          [199.9, 992.3],
        ],
      },
    ],
  },
  {
    id: "forum-apartments",
    name: "Forum Apartments",
    parentId: "DEBE01YYK0002LXT",
    style: "forum-apartments",
    tone: 0xabbabb,
    floorPitchM: 3.45,
    firstFloorM: 10.4,
    tonePrismIds: ["u6tzZd0J", "xKyzSH0w"],
    runs: [
      {
        prismId: "uFYFanhj",
        groundY: 4.9,
        heightM: 40.1,
        chain: [
          [67.8, 1035],
          [63.7, 1032],
          [58.5, 1027.4],
          [54.9, 1023.6],
          [51.6, 1019.6],
          [50.8, 1020.2],
          [46.6, 1014],
          [44.1, 1009.7],
          [40.9, 1002.8],
          [39.2, 998.1],
          [37.9, 993.2],
          [37, 988.2],
          [37.9, 988.1],
          [37.6, 982.9],
          [37.8, 979.5],
          [38.5, 975],
          [39.6, 970.7],
          [41.2, 966.5],
          [43.2, 962.6],
        ],
      },
    ],
  },
  {
    id: "ritz-carlton",
    name: "Ritz-Carlton and Tower Apartments",
    parentId: "DEBE01YYK0002R6G",
    style: "art-deco",
    tone: 0xe0ded7,
    floorPitchM: 3.75,
    firstFloorM: 5.5,
    tonePrismIds: [
      "kOaYs7Fs",
      "CrueifO0",
      "JN5i7BZW",
      "TFCTX4Id",
      "oVWSbM2X",
      "kKOl3d2K",
      "vqREatoK",
      "e1PTH7PY",
      "UadGrHNz",
      "AtufoplB",
      "9PZgrbj4",
      "Jh0L3FSw",
      "4LVT530Z",
    ],
    runs: [
      {
        prismId: "AyaY6CC9",
        groundY: 5.4,
        heightM: 73.3,
        chain: [
          [265.7, 942.2],
          [268.9, 975.1],
          [253.5, 976.6],
          [250.2, 943.8],
        ],
      },
    ],
  },
  {
    id: "beisheim-office",
    name: "Potsdamer Platz 3 office",
    parentId: "DEBE01YYK0002Mbg",
    style: "stone-office",
    tone: 0xd7d6cb,
    floorPitchM: 3.8,
    firstFloorM: 4.7,
    tonePrismIds: ["CwZCB4v0", "gAwitON0", "8G7U9gI6", "ST1EtXTK", "rzn9m3GV"],
    runs: [
      {
        prismId: "sGugsVX0",
        groundY: 5.5,
        heightM: 66.9,
        chain: [
          [307.5, 932.8],
          [305.4, 973.2],
          [288.2, 974.9],
          [290.4, 931.9],
        ],
      },
    ],
  },
  {
    id: "marriott",
    name: "Berlin Marriott",
    parentId: "DEBE01YYK0000ARl",
    style: "marriott",
    tone: 0xd6d5ce,
    floorPitchM: 3.55,
    firstFloorM: 4.2,
    tonePrismIds: ["pCB7XBGk"],
    runs: [
      {
        prismId: "ToYLAQ4P",
        groundY: 4.8,
        heightM: 40.9,
        chain: [
          [288.3, 907.7],
          [286.4, 887.7],
          [279.4, 888.5],
          [275.8, 851.5],
          [295.8, 849.5],
        ],
      },
      {
        prismId: "ToYLAQ4P",
        groundY: 4.8,
        heightM: 40.9,
        chain: [
          [336, 831.5],
          [324.6, 904.2],
          [288.3, 907.7],
        ],
      },
    ],
  },
  {
    id: "parkside",
    name: "Parkside Apartments",
    parentId: "DEBE01YYK0002KqR",
    style: "parkside",
    tone: 0xd9dbd4,
    floorPitchM: 3.65,
    firstFloorM: 4.6,
    runs: [
      {
        prismId: "sOrvOgK3",
        groundY: 4.1,
        heightM: 40,
        chain: [
          [160.7, 877.4],
          [139, 847.2],
          [138.8, 846.5],
          [139, 845.9],
          [139.5, 845.5],
          [162.1, 837.2],
        ],
      },
      {
        prismId: "qI1oHXRs",
        groundY: 5,
        heightM: 41.2,
        chain: [
          [179.5, 903.1],
          [178.9, 902.6],
          [164.1, 882],
        ],
      },
      {
        prismId: "qI1oHXRs",
        groundY: 5,
        heightM: 41.2,
        chain: [
          [198.2, 901.5],
          [180.3, 903.3],
          [179.5, 903.1],
        ],
      },
    ],
  },
];

export const SONY_SURROUNDINGS_PROFILE = {
  geometrySource:
    "Geoportal Berlin LoD2, committed lod2-prisms.json; dl-de/zero-2-0",
  sourceUrls: [
    "https://jahn.studio/work/sony-center/",
    "https://www.beisheim-center.de/de/background",
    "https://www.beisheim-center.de/de/living/tower-apartments",
    "https://www.beisheim-center.de/de/living/parkside-apartments",
  ],
  visualReferenceStatus:
    "External licensed photographs only; no image or texture bundled",
  subdivisionStatus:
    "Procedural facade recognition; not surveyed window or balcony dimensions",
  underlyingLoD2Retained: true,
  performance: {
    drawnDrawCalls: 10,
    minecraftDrawCalls: 1,
    drawnInstanceBudget: 7000,
    minecraftInstanceBudget: 4000,
    photoTexturesBundled: false,
    perFrameWork: false,
  },
} as const;

export const SONY_SURROUNDINGS_PRISM_TONES: Readonly<Record<string, number>> =
  Object.fromEntries(
    SONY_SURROUNDING_BUILDINGS.flatMap((building) =>
      [
        ...building.runs.map(({ prismId }) => prismId),
        ...(building.tonePrismIds ?? []),
      ].map((prismId) => [prismId, building.tone]),
    ),
  );
