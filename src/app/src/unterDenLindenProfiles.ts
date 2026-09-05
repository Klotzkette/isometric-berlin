export type FacadeAxis = {
  endWorldXZ: readonly [number, number];
  outwardSide: -1 | 1;
  startWorldXZ: readonly [number, number];
};

export const UNTER_DEN_LINDEN_DETAILS_GROUP_NAME =
  "Source-bound Unter den Linden facade details";
export const UNTER_DEN_LINDEN_FINE_LAYER_NAME =
  "Unter den Linden signs mullions and masonry detail";
export const MINECRAFT_UNTER_DEN_LINDEN_GROUP_NAME =
  "Block-native Unter den Linden facade details";

export const UNTER_DEN_LINDEN_DETAILS_PROFILE = {
  name: UNTER_DEN_LINDEN_DETAILS_GROUP_NAME,
  sourceCreated: "2026-09-03",
  detailRevised: "2026-09-05",
  windowDetailStatus: "Shallow paired stone reveals and transoms are procedural visual subdivisions, not surveyed dimensions; all LoD2 envelopes and facade axes remain unchanged.",
  buildings: {
    britishEmbassy: {
      name: "British Embassy",
      address: "Wilhelmstrasse 70/71",
      osmKey: "relation/24516",
      lod2Parent: "DEBE01YYK00001KP",
      lod2MainPart: "DEBE3DzLVkos5eqV",
      anchorWorldM: [622.283, 4.6, 381.283] as const,
      sourceHeightM: 25.937,
    },
    russianEmbassy: {
      name: "Embassy of the Russian Federation",
      address: "Unter den Linden 55-65",
      osmKey: "node/514864739",
      lod2Parent: "DEBE01YYK00003En",
      lod2PartIds: [
        "DEBE3DmaCMlAOled",
        "DEBE3DG5tW72sH3e",
        "DEBE3DNhcOXxn5Ad",
        "DEBE3DRmxpzAyUPr",
      ] as const,
      anchorWorldM: [793.37, 5.2, 331.555] as const,
      streetFacade: {
        startWorldXZ: [792.5, 410.5],
        endWorldXZ: [862.0, 401.6],
        outwardSide: -1,
      } satisfies FacadeAxis,
      towerWorldXZ: [797.78, 357.151] as const,
      sourceHeightM: 30.318,
    },
    aeroflot: {
      name: "Aeroflot office and Russian Trade Mission",
      address: "Unter den Linden 51-53",
      osmKey: "way/195071820",
      lod2Parent: "DEBE01YYK00001vY",
      anchorWorldM: [946.023, 5.2, 294.816] as const,
      streetFacade: {
        startWorldXZ: [927.927, 307.404],
        endWorldXZ: [960.027, 304.534],
        outwardSide: -1,
      } satisfies FacadeAxis,
      sourceHeightM: 19.606,
    },
    einstein: {
      name: "Haus Pietzsch / Cafe Einstein Unter den Linden",
      address: "Unter den Linden 42",
      osmKey: "node/1412218896",
      lod2Parent: "DEBE01YYK0000A6r",
      anchorWorldM: [979.333, 5.2, 221.424] as const,
      streetFacade: {
        startWorldXZ: [974.805, 222.787],
        endWorldXZ: [990.465, 221.618],
        outwardSide: -1,
      } satisfies FacadeAxis,
      sourceHeightM: 28.178,
    },
    dussmann: {
      name: "Dussmann das KulturKaufhaus",
      address: "Friedrichstrasse 90",
      osmKey: "node/1665158255",
      lod2Parent: "DEBE01YYK00002Es",
      adjoiningLod2Parents: [
        "DEBE01YYK0000Dy3",
        "DEBE01YYK0000Cqp",
      ] as const,
      anchorWorldM: [1185.34, 5.2, 55.65] as const,
      eastFacade: {
        startWorldXZ: [1210.703, 49.839],
        endWorldXZ: [1215.288, 108.057],
        outwardSide: 1,
      } satisfies FacadeAxis,
      southFacade: {
        startWorldXZ: [1170.911, 111.551],
        endWorldXZ: [1215.288, 108.057],
        outwardSide: -1,
      } satisfies FacadeAxis,
      sourceHeightM: 32.411,
    },
  },
  sourceUrls: [
    "https://www.openstreetmap.org/relation/24516",
    "https://www.openstreetmap.org/node/514864739",
    "https://www.openstreetmap.org/way/195071820",
    "https://www.openstreetmap.org/node/1412218896",
    "https://www.openstreetmap.org/node/1665158255",
    "https://www.einstein-udl.com/",
    "https://www.kulturkaufhaus.de/de/service/impressum",
  ],
  geometryStatus:
    "Berlin LoD2 remains the metric envelope. OSM fixes names and entrances; repeated bays, stone courses, porticoes, signs and colour fields are bounded procedural recognition subdivisions derived from current freely licensed or official visual references.",
  photographsBundled: false,
  textureFree: true,
  catalogueAddition: false,
} as const;
