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
  detailRevised: "2026-09-30",
  windowDetailStatus: "v1.0.47 corrects rear-facing embassy and Aeroflot overlays to exact retained street-facing LoD2 edges. Original envelopes remain untouched. Bays, reveals and ornament are procedural visual subdivisions, not surveyed dimensions.",
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
        startWorldXZ: [775.221, 326.504],
        endWorldXZ: [833.054, 321.592],
        outwardSide: 1,
      } satisfies FacadeAxis,
      previousRearAxis: { startWorldXZ: [792.5, 410.5], endWorldXZ: [862.0, 401.6], outwardSide: -1 } satisfies FacadeAxis,
      frontageAxes: [
        { startWorldXZ: [751.861, 306.257], endWorldXZ: [776.098, 304.169], outwardSide: 1 },
        { startWorldXZ: [775.221, 326.504], endWorldXZ: [795.044, 324.82], outwardSide: 1 },
        { startWorldXZ: [794.628, 320.211], endWorldXZ: [813.301, 318.697], outwardSide: 1 },
        { startWorldXZ: [813.788, 323.228], endWorldXZ: [833.054, 321.592], outwardSide: 1 },
        { startWorldXZ: [829.27, 299.461], endWorldXZ: [853.256, 297.429], outwardSide: 1 },
      ] satisfies readonly FacadeAxis[],
      officialMonumentId: "09075006",
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
        startWorldXZ: [926.231, 288.437],
        endWorldXZ: [958.331, 285.567],
        outwardSide: 1,
      } satisfies FacadeAxis,
      previousRearAxis: { startWorldXZ: [927.927, 307.404], endWorldXZ: [960.027, 304.534], outwardSide: -1 } satisfies FacadeAxis,
      sourceHeightM: 19.606,
    },
    einstein: {
      name: "Haus Pietzsch / Cafe Einstein Unter den Linden",
      address: "Unter den Linden 42",
      osmKey: "node/1412218896",
      lod2Parent: "DEBE01YYK0000A6r",
      anchorWorldM: [979.333, 5.2, 221.424] as const,
      streetFacade: {
        startWorldXZ: [974.801, 222.73],
        endWorldXZ: [990.454, 221.468],
        outwardSide: -1,
      } satisfies FacadeAxis,
      westFacade: {
        startWorldXZ: [976.138, 221.168],
        endWorldXZ: [972.903, 177.813],
        outwardSide: 1,
      } satisfies FacadeAxis,
      frontWindowBays: 3,
      glassAtriumWidthM: 2.55,
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
      northFacade: {
        startWorldXZ: [1166.54, 54.59],
        endWorldXZ: [1210.703, 49.839],
        outwardSide: 1,
      } satisfies FacadeAxis,
      modernUpperFloors: 4,
      arcadeHeightM: 8.2,
      historicReturnFloors: 4,
      sourceHeightM: 32.411,
    },
    komischeOper: {
      name: "Komische Oper Berlin, existing Behrenstraße house",
      address: "Behrenstraße 54-57",
      lod2Parent: "DEBE01YYK00001Ih",
      officialMonumentId: "09065009",
      anchorWorldM: [1040, 5.2, 350] as const,
      streetFacade: {
        startWorldXZ: [1018.269, 390.666],
        endWorldXZ: [1084.167, 385.807],
        outwardSide: -1,
      } satisfies FacadeAxis,
      entranceRisalit: {
        startWorldXZ: [1030.764, 390.426],
        endWorldXZ: [1043.543, 389.563],
        outwardSide: -1,
      } satisfies FacadeAxis,
      westFacade: {
        startWorldXZ: [1016.824, 370.638],
        endWorldXZ: [1012.107, 370.988],
        outwardSide: -1,
      } satisfies FacadeAxis,
      sourceHeightM: 22.808,
      state: "Existing 1966-67 sandstone, glass and copper facade. Renovation in progress; unbuilt extension omitted.",
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
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075006",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065009",
    "https://www.komische-oper-berlin.de/entdecken/sanierung/",
  ],
  geometryStatus:
    "Berlin LoD2 remains the metric envelope. OSM fixes names and entrances; repeated bays, stone courses, porticoes, signs and colour fields are bounded procedural recognition subdivisions derived from current freely licensed or official visual references.",
  photographsBundled: false,
  textureFree: true,
  catalogueAddition: false,
} as const;
