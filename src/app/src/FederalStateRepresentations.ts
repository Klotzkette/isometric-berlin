import {
  Box3,
  BoxGeometry,
  EdgesGeometry,
  Group,
  Mesh,
  Shape,
  ShapeGeometry,
} from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  type Builder,
  addBox,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";

type WorldPoint2 = readonly [number, number];

export type FederalStateCode =
  | "BB"
  | "BW"
  | "BY"
  | "HB"
  | "HE"
  | "HH"
  | "NI"
  | "NW"
  | "RP"
  | "SH"
  | "SL"
  | "SN"
  | "ST"
  | "TH"
  | "MV";

export type FederalFacadeRun = {
  bayCount?: number;
  endWorldM: WorldPoint2;
  groundYM: number;
  measuredHeightM: number;
  sourcePartId: string;
  startWorldM: WorldPoint2;
  storeys: number;
};

export type FederalStateRepresentationProfile = {
  address: string;
  architecture: ReadonlyArray<string>;
  centerWorldM: WorldPoint2;
  facadeRuns: ReadonlyArray<FederalFacadeRun>;
  footprint: {
    areaM2: number;
    axisAlignedBboxSizeM: WorldPoint2;
    heightRangeM: readonly [number, number];
  };
  geometryStatus: string;
  id: string;
  lod2: null | {
    parentId: string;
    partIds: ReadonlyArray<string>;
  };
  manualMassing?: {
    footprintRingWorldM: ReadonlyArray<WorldPoint2>;
    solidProbeWorldM: readonly [number, number, number];
    zones: ReadonlyArray<{
      bottomYM: number;
      id: string;
      ringWorldM: ReadonlyArray<WorldPoint2>;
      sourceStatus: string;
      topYM: number;
    }>;
  };
  name: string;
  osm: {
    buildingWayIds: ReadonlyArray<string>;
    poiNodeIds: ReadonlyArray<string>;
  };
  sources: ReadonlyArray<{
    label: string;
    url: string;
  }>;
  stateCodes: ReadonlyArray<FederalStateCode>;
  states: ReadonlyArray<string>;
};

const run = (
  sourcePartId: string,
  startWorldM: WorldPoint2,
  endWorldM: WorldPoint2,
  measuredHeightM: number,
  groundYM: number,
  storeys: number,
  bayCount?: number,
): FederalFacadeRun => ({
  ...(bayCount === undefined ? {} : { bayCount }),
  endWorldM,
  groundYM,
  measuredHeightM,
  sourcePartId,
  startWorldM,
  storeys,
});

/**
 * Source and metric registry for all 15 Länder at their 13 Berlin houses.
 *
 * The official Berlin LoD2 shell remains authoritative wherever one exists.
 * Those eleven entries receive only shallow, component-bound recognition
 * detail. Bremen and Saxony have no matching official LoD2 survey in the
 * committed source set: their entries state that explicitly and use the exact
 * OSM outline plus source-described storey organisation instead of pretending
 * the display-fallback height is a measurement.
 */
export const FEDERAL_STATE_REPRESENTATIONS = [
  {
    address: "Tiergartenstraße 15, 10785 Berlin",
    architecture: [
      "white geometric cube",
      "open funnel-shaped entrance arms",
      "roof terrace",
    ],
    centerWorldM: [-616.723, 1055.911],
    facadeRuns: [
      run("DEBE3DS0jLpDAWqy", [-586.452, 1029.674], [-613.129, 1095.822], 15.19, 5.2, 4),
      run("DEBE3Dyrg2hPfL9e", [-646.996, 1082.129], [-620.32, 1016.011], 15.23, 5.2, 4),
      run("DEBE3DeDfp99EPGl", [-613.129, 1095.822], [-646.996, 1082.129], 15.08, 5.2, 4),
      run("DEBE3DTney4EiPtf", [-620.32, 1016.011], [-586.452, 1029.674], 15.21, 5.2, 4),
    ],
    footprint: { areaM2: 2604.2, axisAlignedBboxSizeM: [36.53, 71.33], heightRangeM: [15.08, 16.34] },
    geometryStatus: "official LoD2-parent-bound thin façade and roof-edge overlays",
    id: "baden-wuerttemberg",
    lod2: {
      parentId: "DEBE01YYK0002QWd",
      partIds: [
        "DEBE3DS0jLpDAWqy", "DEBE3DpoaMWP36lQ", "DEBE3DS3ecE1exs6",
        "DEBE3DxOLDkBFRNk", "DEBE3DvQBRHLlFcX", "DEBE3DjXD4N04uCn",
        "DEBE3DaJX2TzA4q0", "DEBE3DlZu5LdnRSy", "DEBE3Dv1Yep2pHLt",
        "DEBE3DeDfp99EPGl", "DEBE3Dyrg2hPfL9e", "DEBE3DTney4EiPtf",
        "DEBE3DPJ2O6IuYmp",
      ],
    },
    name: "Vertretung des Landes Baden-Württemberg beim Bund",
    osm: { buildingWayIds: ["24034716"], poiNodeIds: [] },
    sources: [
      { label: "Land Baden-Württemberg – Unser Haus", url: "https://stm.baden-wuerttemberg.de/de/vertretung-beim-bund/service-und-presse/unser-haus" },
    ],
    stateCodes: ["BW"],
    states: ["Baden-Württemberg"],
  },
  {
    address: "Behrenstraße 21/22, 10117 Berlin",
    architecture: ["1896 bank palazzo", "stone cornices", "historic stair and hall"],
    centerWorldM: [1089.223, 431.708],
    facadeRuns: [
      run("DEBE3DBn6XtimJyh", [1073.952, 451.948], [1070.902, 409.542], 25.16, 5.2, 6),
      run("DEBE3DBn6XtimJyh", [1104.457, 416.371], [1107.717, 447.861], 25.16, 5.2, 6),
      run("DEBE3DBn6XtimJyh", [1103.287, 455.236], [1081.325, 457.058], 25.16, 5.2, 6),
      run("DEBE3DBn6XtimJyh", [1077.505, 408.495], [1097.063, 406.88], 25.16, 5.2, 6),
    ],
    footprint: { areaM2: 1354.1, axisAlignedBboxSizeM: [33.99, 49.21], heightRangeM: [3.14, 25.16] },
    geometryStatus: "official LoD2-parent-bound historic façade overlays",
    id: "bayern",
    lod2: { parentId: "DEBE01YYK0000Dr4", partIds: ["DEBE3Dz6wXIIoce8", "DEBE3DBn6XtimJyh"] },
    name: "Vertretung des Freistaates Bayern beim Bund",
    osm: { buildingWayIds: ["5886330"], poiNodeIds: ["542439167"] },
    sources: [
      { label: "Bayerische Staatskanzlei – Bayern in Berlin", url: "https://www.bayern.de/staatskanzlei/bayern-in-berlin/" },
    ],
    stateCodes: ["BY"],
    states: ["Bayern"],
  },
  {
    address: "In den Ministergärten 3, 10117 Berlin",
    architecture: ["offset L-shaped wings", "slate-panel façades", "shared multistorey glass hall"],
    centerWorldM: [505.326, 778.666],
    facadeRuns: [
      run("DEBE3DVt0YtelPX3", [522.698, 798.163], [509.43, 799.17], 18.55, 5.2, 5),
      run("DEBE3DZHLWwxiHl9", [494.056, 759.491], [507.296, 758.423], 18.46, 5.2, 5),
      run("DEBE3DuFiURsGiDU", [496.341, 788.122], [483.153, 789.161], 7.3, 5.2, 2),
      run("DEBE3DVt0YtelPX3", [509.43, 799.17], [508.5, 787.114], 18.55, 5.2, 5),
      run("DEBE3DZHLWwxiHl9", [495.027, 771.519], [494.056, 759.491], 18.46, 5.2, 5),
      run("DEBE3Dr22FltGNYQ", [523.528, 769.261], [524.822, 785.894], 7.16, 5.2, 2),
    ],
    footprint: { areaM2: 1079.9, axisAlignedBboxSizeM: [41.82, 40.81], heightRangeM: [7.16, 22.58] },
    geometryStatus: "official LoD2-parent-bound shared-house façade overlays",
    id: "brandenburg-mecklenburg-vorpommern",
    lod2: {
      parentId: "DEBE01YYK00001YS",
      partIds: ["DEBE3DmYlDuZ36CW", "DEBE3DRRpMFMUidY", "DEBE3DuFiURsGiDU", "DEBE3DVt0YtelPX3", "DEBE3DmyW94W9nMC", "DEBE3Dr22FltGNYQ", "DEBE3DZHLWwxiHl9"],
    },
    name: "Gemeinsame Landesvertretung Brandenburg und Mecklenburg-Vorpommern",
    osm: { buildingWayIds: ["43238686"], poiNodeIds: ["542544152", "542545627"] },
    sources: [
      { label: "Land Brandenburg – Landesvertretung und Gebäude", url: "https://www.brandenburg.de/cms/detail.php?gsid=bb1.c.463293.de" },
      { label: "Berlin.de – Landesvertretungen", url: "https://www.berlin.de/sehenswuerdigkeiten/3560695-3558930-landesvertretungen.html" },
    ],
    stateCodes: ["BB", "MV"],
    states: ["Brandenburg", "Mecklenburg-Vorpommern"],
  },
  {
    address: "Hiroshimastraße 24, 10785 Berlin",
    architecture: ["eight-storey head and guesthouse", "four-storey villa", "red rendered façades"],
    centerWorldM: [-989.403, 1235.006],
    facadeRuns: [
      run("OSM-way-24045937:head", [-962.6, 1231.5], [-968.1, 1247.0], 27.2, 5.2, 8),
      run("OSM-way-24045937:head", [-968.1, 1247.0], [-962.6, 1248.9], 27.2, 5.2, 8),
      run("OSM-way-24045937:head", [-962.6, 1248.9], [-964.8, 1255.3], 27.2, 5.2, 8),
      run("OSM-way-24045937:villa", [-999.6, 1242.9], [-1017.3, 1240.8], 14.2, 5.2, 4),
      run("OSM-way-24045937:villa", [-1017.3, 1240.8], [-1009.3, 1217.3], 14.2, 5.2, 4),
      run("OSM-way-24045937:villa", [-997.2, 1217.6], [-972.9, 1226.1], 14.2, 5.2, 4),
      run("OSM-way-24045937:link", [-972.9, 1226.1], [-962.6, 1231.5], 14.2, 5.2, 4),
    ],
    footprint: { areaM2: 1262.0, axisAlignedBboxSizeM: [54.7, 38.2], heightRangeM: [14.2, 27.2] },
    geometryStatus: "exact OSM way 24045937 outline; source-bounded manual eight-/four-storey mass organisation; no official LoD2 measurement available",
    id: "bremen",
    lod2: null,
    manualMassing: {
      footprintRingWorldM: [
        [-962.6, 1231.5],
        [-968.1, 1247.0],
        [-962.6, 1248.9],
        [-964.8, 1255.3],
        [-999.6, 1242.9],
        [-1000.9, 1246.6],
        [-1017.3, 1240.8],
        [-1009.3, 1217.3],
        [-1004.2, 1218.9],
        [-1003.7, 1217.1],
        [-997.8, 1219.3],
        [-997.2, 1217.6],
        [-972.9, 1226.1],
        [-973.4, 1227.8],
      ],
      solidProbeWorldM: [-970.0, 25.0, 1235.0],
      zones: [
        {
          bottomYM: 5.2,
          id: "four-storey-villa-and-link",
          ringWorldM: [
            [-962.6, 1231.5],
            [-968.1, 1247.0],
            [-962.6, 1248.9],
            [-964.8, 1255.3],
            [-999.6, 1242.9],
            [-1000.9, 1246.6],
            [-1017.3, 1240.8],
            [-1009.3, 1217.3],
            [-1004.2, 1218.9],
            [-1003.7, 1217.1],
            [-997.8, 1219.3],
            [-997.2, 1217.6],
            [-972.9, 1226.1],
            [-973.4, 1227.8],
          ],
          sourceStatus:
            "exact OSM footprint; four-storey height is architecture-source-bounded, not LoD2 surveyed",
          topYM: 19.4,
        },
        {
          bottomYM: 19.4,
          id: "eight-storey-head-upper-volume",
          ringWorldM: [
            [-962.6, 1231.5],
            [-968.1, 1247.0],
            [-962.6, 1248.9],
            [-964.8, 1255.3],
            [-980.0, 1249.884],
            [-980.0, 1223.617],
            [-972.9, 1226.1],
            [-973.4, 1227.8],
          ],
          sourceStatus:
            "source-described eight-storey head/guesthouse; plan split is bounded inside exact OSM footprint, not LoD2 surveyed",
          topYM: 32.4,
        },
      ],
    },
    name: "Vertretung der Freien Hansestadt Bremen beim Bund",
    osm: { buildingWayIds: ["24045937"], poiNodeIds: [] },
    sources: [
      { label: "Freie Hansestadt Bremen – Geschichte des Hauses", url: "https://www.diebevollmaechtigte.bremen.de/landesvertretung/geschichte-der-landesvertretung-von-bremen-29381" },
      { label: "Léon Wohlhage Wernik – Bremer Landesvertretung", url: "https://www.leonwohlhage.de/files/pdf/Projekte/LW_Bremer_Landesvertretung_de.pdf" },
      { label: "Pichler Ingenieure – Landesvertretung Bremen", url: "https://pichleringenieure.com/Projekte/Typ/Neubau/Landesvertretung-Bremen.html" },
    ],
    stateCodes: ["HB"],
    states: ["Bremen"],
  },
  {
    address: "Jägerstraße 1–3, 10117 Berlin",
    architecture: ["Jägerstraße 1 house of 1875", "Jägerstraße 2–3 palazzo of 1892", "1999–2000 connecting intervention"],
    centerWorldM: [943.608, 638.634],
    facadeRuns: [
      run("DEBE3DCs8gO1Ag64", [936.981, 648.732], [934.678, 618.692], 23.78, 5.2, 6),
      run("DEBE3DCs8gO1Ag64", [953.549, 631.139], [955.101, 654.898], 23.78, 5.2, 6),
      run("DEBE3DCs8gO1Ag64", [934.678, 618.692], [952.653, 617.428], 23.78, 5.2, 6),
      run("DEBE3DCs8gO1Ag64", [943.734, 655.611], [929.729, 656.972], 23.78, 5.2, 6),
      run("DEBE3De2xbR2MSqi", [929.729, 656.972], [928.023, 649.603], 17.22, 5.2, 4),
    ],
    footprint: { areaM2: 693.7, axisAlignedBboxSizeM: [26.68, 37.97], heightRangeM: [17.22, 23.78] },
    geometryStatus: "complete Jägerstraße 1–3 LoD2 parent with shallow historic/connector overlays",
    id: "hamburg",
    lod2: { parentId: "DEBE01YYK00003Lc", partIds: ["DEBE3DCs8gO1Ag64", "DEBE3De2xbR2MSqi"] },
    name: "Vertretung der Freien und Hansestadt Hamburg beim Bund",
    osm: { buildingWayIds: ["32699537"], poiNodeIds: ["2497234679", "609711392"] },
    sources: [
      { label: "Freie und Hansestadt Hamburg – Haus Jägerstraße", url: "https://www.hamburg.de/politik-und-verwaltung/behoerden/senatskanzlei/einrichtungen/landesvertretung-hamburg/haus-jaegerstrasse-263680" },
    ],
    stateCodes: ["HH"],
    states: ["Hamburg"],
  },
  {
    address: "In den Ministergärten 5, 10117 Berlin",
    architecture: ["interlocked cuboids", "Friedewald quartz sandstone", "cantilevered glass conference volume and green roofs"],
    centerWorldM: [455.937, 780.79],
    facadeRuns: [
      run("DEBE3Dotgan5FSR9", [436.887, 799.64], [434.317, 766.514], 17.9, 4.8, 5),
      run("DEBE3DBCHY1TT4YA", [475.621, 768.77], [477.795, 796.409], 10.66, 4.8, 3),
      run("DEBE3DjlcNUdMKjp", [451.54, 762.632], [471.598, 761.054], 21.19, 4.8, 6),
      run("DEBE3DrQ425WrVpq", [451.878, 798.451], [436.887, 799.64], 22.23, 4.8, 6),
      run("DEBE3DBCHY1TT4YA", [477.795, 796.409], [464.266, 797.472], 10.66, 4.8, 3),
      run("DEBE3Dhpq2jU4JIx", [464.048, 794.769], [454.32, 795.54], 22.09, 4.8, 6),
    ],
    footprint: { areaM2: 1375.0, axisAlignedBboxSizeM: [41.04, 38.21], heightRangeM: [10.66, 22.23] },
    geometryStatus: "official LoD2-parent-bound sandstone/glass surface articulation; replaces the old opaque presentation double",
    id: "hessen",
    lod2: {
      parentId: "DEBE01YYK00002M9",
      partIds: ["DEBE3DNqo7qQOmrZ", "DEBE3Dhpq2jU4JIx", "DEBE3DBCHY1TT4YA", "DEBE3DtbW8iPAMdp", "DEBE3Dp3Jlz48u2O", "DEBE3Dotgan5FSR9", "DEBE3DbV1X48Chfl", "DEBE3DrQ425WrVpq", "DEBE3DFmR0JsJUZn", "DEBE3DjlcNUdMKjp"],
    },
    name: "Vertretung des Landes Hessen beim Bund",
    osm: { buildingWayIds: ["32359420"], poiNodeIds: ["542538366"] },
    sources: [
      { label: "Hessische Staatskanzlei – Architektur", url: "https://staatskanzlei.hessen.de/berlin-europa-und-die-welt/hessen-in-berlin/was-macht-die-hessische-landesvertretung-in-berlin/von-bonn-nach-berlin/architektur" },
      { label: "Hessische Landesvertretung – Hausbroschüre", url: "https://staatskanzlei.hessen.de/sites/staatskanzlei.hessen.de/files/2023-12/2023_hlv_berlin_broschuere_download.pdf" },
    ],
    stateCodes: ["HE"],
    states: ["Hessen"],
  },
  {
    address: "In den Ministergärten 8–10, 10117 Berlin",
    architecture: ["two parallel office wings", "wood-steel-glass façades", "shared glazed hall and two courts"],
    centerWorldM: [420.496, 712.956],
    facadeRuns: [
      run("DEBE3DFHhCReTf1G", [394.792, 694.938], [443.041, 691.126], 20.86, 4.4, 5),
      run("DEBE3DS5Wf6fiyrc", [446.192, 730.976], [397.964, 734.795], 20.82, 4.4, 5),
      run("DEBE3DeX6Gw8ft8F", [397.964, 734.795], [394.792, 694.938], 20.94, 4.4, 5),
      run("DEBE3DeX6Gw8ft8F", [443.041, 691.126], [446.192, 730.976], 20.94, 4.4, 5),
    ],
    footprint: { areaM2: 1934.5, axisAlignedBboxSizeM: [48.4, 39.99], heightRangeM: [20.82, 20.94] },
    geometryStatus: "official LoD2-parent-bound shared-house glass/wood overlays",
    id: "niedersachsen-schleswig-holstein",
    lod2: { parentId: "DEBE01YYK00002Rc", partIds: ["DEBE3DeX6Gw8ft8F", "DEBE3DS5Wf6fiyrc", "DEBE3DFHhCReTf1G"] },
    name: "Gemeinsame Landesvertretung Niedersachsen und Schleswig-Holstein",
    osm: { buildingWayIds: ["32359422"], poiNodeIds: ["542522840", "542514749"] },
    sources: [
      { label: "Niedersächsische Staatskanzlei – Geschichte und Haus", url: "https://www.stk.niedersachsen.de/startseite/die_staatskanzlei/niedersachsische_landesvertretung_beim_bund/geschichte_und_haus_der_landesvertretung/die-niedersachsische-landesvertretung-in-berlin-243362.html" },
      { label: "Schleswig-Holstein – Geschichte des Gebäudes", url: "https://www.schleswig-holstein.de/DE/landesregierung/ministerien-behoerden/LVB/Gebaeude/geschichte_mehr" },
    ],
    stateCodes: ["NI", "SH"],
    states: ["Niedersachsen", "Schleswig-Holstein"],
  },
  {
    address: "Hiroshimastraße 12–16, 10785 Berlin",
    architecture: ["four-storey transparent pavilion", "wood-glass-steel envelope", "parabolic façade grid"],
    centerWorldM: [-961.774, 1149.344],
    facadeRuns: [
      run("DEBE01YYK0002MFj", [-941.065, 1176.767], [-995.053, 1157.982], 17.18, 5.2, 4),
      run("DEBE01YYK0002MFj", [-982.448, 1121.904], [-928.51, 1140.719], 17.18, 5.2, 4),
      run("DEBE01YYK0002MFj", [-995.053, 1157.982], [-982.448, 1121.904], 17.18, 5.2, 4),
      run("DEBE01YYK0002MFj", [-928.51, 1140.719], [-941.065, 1176.767], 17.18, 5.2, 4),
    ],
    footprint: { areaM2: 2182.3, axisAlignedBboxSizeM: [57.16, 38.22], heightRangeM: [17.18, 17.18] },
    geometryStatus: "official single LoD2 building with transparent shallow grid overlay",
    id: "nordrhein-westfalen",
    lod2: { parentId: "DEBE01YYK0002MFj", partIds: ["DEBE01YYK0002MFj"] },
    name: "Vertretung des Landes Nordrhein-Westfalen beim Bund",
    osm: { buildingWayIds: ["24045952"], poiNodeIds: [] },
    sources: [
      { label: "German Architects – Petzinka Pink project", url: "https://www.german-architects.com/de/zweipink-dusseldorf/project/vertretung-des-landes-nordrhein-westfalen-beim-bund-in-berlin" },
      { label: "Landtag Nordrhein-Westfalen – Landesvertretung", url: "https://www.landtag.nrw.de/portal/WWW/dokumentenarchiv/Dokument/ZLANIN9910.pdf" },
    ],
    stateCodes: ["NW"],
    states: ["Nordrhein-Westfalen"],
  },
  {
    address: "In den Ministergärten 6, 10117 Berlin",
    architecture: ["strict cube", "offset window bands", "glazed entry and roof Skygarden"],
    centerWorldM: [474.466, 708.455],
    facadeRuns: [
      run("DEBE3DBWDju1rVCX", [487.555, 700.172], [489.595, 725.829], 19.69, 4.7, 5),
      run("DEBE3Dgl0Dw02VxO", [459.833, 717.753], [457.857, 692.308], 9.91, 4.7, 2),
      run("DEBE3Dgfp7Ri581o", [487.824, 727.687], [463.507, 729.642], 19.75, 4.7, 5),
      run("DEBE3DB5YG98L1mv", [477.451, 677.312], [485.703, 676.659], 19.68, 4.7, 5),
      run("DEBE3Dqcm56iJsLH", [463.507, 729.642], [462.557, 717.545], 23.34, 4.7, 6),
      run("DEBE3DPHfShYNPRm", [457.857, 692.308], [469.284, 691.395], 9.57, 4.7, 2),
    ],
    footprint: { areaM2: 1033.8, axisAlignedBboxSizeM: [29.04, 51.07], heightRangeM: [9.57, 24.09] },
    geometryStatus: "official LoD2-parent-bound offset-band and roof-terrace overlays",
    id: "rheinland-pfalz",
    lod2: { parentId: "DEBE01YYK000042N", partIds: ["DEBE3DB5YG98L1mv", "DEBE3DJA4sx1JbAo", "DEBE3Dgl0Dw02VxO", "DEBE3DCGSbC753nm", "DEBE3DBWDju1rVCX", "DEBE3DIiWR58Gqov", "DEBE3Dnh9AooWGZT", "DEBE3Dqcm56iJsLH", "DEBE3DMFjxEZrMzy", "DEBE3DPHfShYNPRm", "DEBE3DLr56su3dyp", "DEBE3Dgfp7Ri581o"] },
    name: "Vertretung des Landes Rheinland-Pfalz beim Bund",
    osm: { buildingWayIds: ["417537172"], poiNodeIds: [] },
    sources: [
      { label: "Heinle, Wischer und Partner – Landesvertretung Rheinland-Pfalz", url: "https://www.heinlewischer.de/projekte/detail/vertretung-des-landes-rheinland-pfalz-beim-bund-und-der-europaeischen-union-in-berlin-neubau/" },
    ],
    stateCodes: ["RP"],
    states: ["Rheinland-Pfalz"],
  },
  {
    address: "In den Ministergärten 4, 10117 Berlin",
    architecture: ["square front block", "glass-roofed atrium", "full-height rear pergola grid"],
    centerWorldM: [508.078, 706.612],
    facadeRuns: [
      run("DEBE3DKSN8UAbHd4", [516.856, 688.971], [519.747, 725.173], 20.03, 4.9, 5),
      run("DEBE3DRRx1zXW0Vn", [499.489, 726.757], [496.617, 690.575], 20.05, 4.9, 5),
      run("DEBE3DKSN8UAbHd4", [519.747, 725.173], [499.489, 726.757], 20.03, 4.9, 5),
      run("DEBE3DuksbyHt0Lt", [500.279, 686.265], [512.556, 685.299], 20.03, 4.9, 5),
    ],
    footprint: { areaM2: 786.8, axisAlignedBboxSizeM: [20.32, 40.33], heightRangeM: [19.91, 20.05] },
    geometryStatus: "official LoD2-parent-bound atrium/pergola overlays",
    id: "saarland",
    lod2: { parentId: "DEBE01YYK00002pf", partIds: ["DEBE3DuksbyHt0Lt", "DEBE3DKSN8UAbHd4", "DEBE3DRRx1zXW0Vn", "DEBE3DpawW8p9NmH"] },
    name: "Vertretung des Saarlandes beim Bund",
    osm: { buildingWayIds: ["32359423"], poiNodeIds: [] },
    sources: [
      { label: "Berlin Mitte – Die sieben Landesvertretungen", url: "https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/id-2514_die-7-vertretungen.pdf" },
      { label: "Berlin.de – Landesvertretungen", url: "https://www.berlin.de/sehenswuerdigkeiten/3560695-3558930-landesvertretungen.html" },
    ],
    stateCodes: ["SL"],
    states: ["Saarland"],
  },
  {
    address: "Luisenstraße 18, 10117 Berlin",
    architecture: ["1827–28 city house", "1874 historic exterior", "bay, halls and iron gallery"],
    centerWorldM: [548.267, -320.508],
    facadeRuns: [
      run("DEBE3DSR5WQW7BjX", [528.207, -330.922], [560.926, -333.489], 18.21, 4.0, 4),
      run("DEBE3DlK7c76Dz9u", [562.863, -309.704], [530.158, -307.15], 18.27, 4.0, 4),
      run("DEBE3DfrmIgrCTOY", [560.926, -333.489], [562.863, -309.704], 19.03, 4.0, 4),
      run("DEBE3DSR5WQW7BjX", [549.183, -326.558], [528.705, -324.923], 18.21, 4.0, 4),
    ],
    footprint: { areaM2: 552.4, axisAlignedBboxSizeM: [32.89, 23.87], heightRangeM: [18.21, 19.03] },
    geometryStatus: "official LoD2-parent-bound protected historic façade overlays",
    id: "sachsen-anhalt",
    lod2: { parentId: "DEBE01YYK00002dn", partIds: ["DEBE3DlK7c76Dz9u", "DEBE3DDbT3KBPJfQ", "DEBE3DSR5WQW7BjX", "DEBE3DfrmIgrCTOY"] },
    name: "Vertretung des Landes Sachsen-Anhalt beim Bund",
    osm: { buildingWayIds: ["105352786"], poiNodeIds: ["539193551"] },
    sources: [
      { label: "Landesdenkmalamt Berlin – Luisenstraße 18", url: "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095966" },
    ],
    stateCodes: ["ST"],
    states: ["Sachsen-Anhalt"],
  },
  {
    address: "Anton-Wilhelm-Amo-Straße 64, 10117 Berlin",
    architecture: ["stone city-house cube", "street colonnade and punched windows", "transparent courtyard block and terrace"],
    centerWorldM: [939.003, 762.887],
    facadeRuns: [
      run("DEBE3DxFpn8tRhUM", [942.247, 742.681], [952.362, 774.679], 30.42, 5.2, 7),
      run("DEBE3DxFpn8tRhUM", [933.906, 763.499], [928.681, 746.961], 30.42, 5.2, 7),
      run("DEBE3DLpK7g1Fa0s", [931.542, 780.562], [926.921, 765.638], 25.31, 5.2, 6),
      run("DEBE3DLpK7g1Fa0s", [952.362, 774.679], [938.66, 778.551], 25.31, 5.2, 6),
    ],
    footprint: { areaM2: 587.9, axisAlignedBboxSizeM: [21.63, 33.56], heightRangeM: [24.85, 30.42] },
    geometryStatus: "official LoD2-parent-bound stone/colonnade and glass overlays",
    id: "thueringen",
    lod2: { parentId: "DEBE01YYK00004h2", partIds: ["DEBE3DJvFrR7Rz8l", "DEBE3DLpK7g1Fa0s", "DEBE3DxFpn8tRhUM", "DEBE3DGnVEfJ0mxA"] },
    name: "Vertretung des Freistaates Thüringen beim Bund",
    osm: { buildingWayIds: ["43350503"], poiNodeIds: [] },
    sources: [
      { label: "Architektenkammer Thüringen – Landesvertretung Berlin", url: "https://architekten-thueringen.de/aft/projekte/p/thueringer_landesvertretung_berl-4229.html" },
      { label: "Freistaat Thüringen – Staatlicher Hochbau", url: "https://bau-verkehr.thueringen.de/media/tmil_la_bau_verkehr/Service/Publikationen/2018_Staatlicher_Hochbau.pdf" },
    ],
    stateCodes: ["TH"],
    states: ["Thüringen"],
  },
  {
    address: "Brüderstraße 11/12, 10178 Berlin",
    architecture: ["four high storeys", "seven-axis neobaroque sandstone façade", "historic Berlinische Feuer-Versicherung house"],
    centerWorldM: [2096.494, 571.04],
    facadeRuns: [
      run("OSM-way-23075521:street", [2087.6, 596.3], [2072.1, 577.6], 18.2, 5.2, 4, 7),
      run("OSM-way-23075521:side", [2072.1, 577.6], [2092.6, 561.0], 18.2, 5.2, 4),
      run("OSM-way-23075521:rear", [2092.6, 561.0], [2106.3, 550.7], 18.2, 5.2, 4),
      run("OSM-way-23075521:side", [2121.0, 568.1], [2109.1, 578.1], 18.2, 5.2, 4),
      run("OSM-way-23075521:street-return", [2084.1, 579.9], [2094.0, 590.9], 18.2, 5.2, 4),
    ],
    footprint: { areaM2: 740.6, axisAlignedBboxSizeM: [48.9, 45.6], heightRangeM: [18.2, 18.2] },
    geometryStatus: "exact OSM way 23075521 outline; 18.2 m presentation height is source-bounded from the official four-high-storey/seven-axis description, not an available LoD2 survey",
    id: "sachsen",
    lod2: null,
    manualMassing: {
      footprintRingWorldM: [
        [2087.6, 596.3],
        [2072.1, 577.6],
        [2092.6, 561.0],
        [2092.9, 561.4],
        [2093.5, 561.0],
        [2106.3, 550.7],
        [2121.0, 568.1],
        [2109.1, 578.1],
        [2100.6, 568.4],
        [2099.2, 569.6],
        [2097.4, 569.4],
        [2097.2, 569.1],
        [2085.6, 578.7],
        [2084.1, 579.9],
        [2094.0, 590.9],
      ],
      solidProbeWorldM: [2110.0, 10.0, 570.0],
      zones: [
        {
          bottomYM: 5.2,
          id: "four-storey-neobaroque-house",
          ringWorldM: [
            [2087.6, 596.3],
            [2072.1, 577.6],
            [2092.6, 561.0],
            [2092.9, 561.4],
            [2093.5, 561.0],
            [2106.3, 550.7],
            [2121.0, 568.1],
            [2109.1, 578.1],
            [2100.6, 568.4],
            [2099.2, 569.6],
            [2097.4, 569.4],
            [2097.2, 569.1],
            [2085.6, 578.7],
            [2084.1, 579.9],
            [2094.0, 590.9],
          ],
          sourceStatus:
            "exact OSM footprint; four high storeys / 18.2 m are source-bounded, not LoD2 surveyed",
          topYM: 23.4,
        },
      ],
    },
    name: "Vertretung des Freistaates Sachsen beim Bund",
    osm: { buildingWayIds: ["23075521"], poiNodeIds: [] },
    sources: [
      { label: "Freistaat Sachsen – Das Gebäude", url: "https://www.landesvertretung.sachsen.de/gebaeude.html" },
      { label: "Berlin – Bebauungsplan I-218, Brüderstraße", url: "https://www.berlin.de/sen/stadtentwicklung/_assets/staedtebau/berliner-mitte/breite-strasse/begrundung-bebauungsplan-i-218_pdf.pdf?ts=1683912062" },
    ],
    stateCodes: ["SN"],
    states: ["Sachsen"],
  },
] as const satisfies ReadonlyArray<FederalStateRepresentationProfile>;

export const FEDERAL_STATE_REPRESENTATION_SOURCE_REGISTRY = Object.fromEntries(
  FEDERAL_STATE_REPRESENTATIONS.map((site) => [
    site.id,
    {
      lod2ParentId: site.lod2?.parentId ?? null,
      lod2PartIds: site.lod2?.partIds ?? [],
      osmBuildingWayIds: site.osm.buildingWayIds,
      osmPoiNodeIds: site.osm.poiNodeIds,
      sources: site.sources,
      stateCodes: site.stateCodes,
    },
  ]),
) as Readonly<Record<string, unknown>>;

export const FEDERAL_STATE_REPRESENTATION_FALLBACK_SUPPRESSION_IDS = [
  "24045937",
  "23075521",
] as const;

type SiteStyle = {
  accent: number;
  bayPitchM: number;
  frame: number;
  glass: number;
  stone: number;
  windowHeightM: number;
};

const SITE_STYLES: Record<string, SiteStyle> = {
  "baden-wuerttemberg": { accent: 0xf5f3ec, bayPitchM: 4.2, frame: 0x777b78, glass: 0x719095, stone: 0xe9e7df, windowHeightM: 2.15 },
  bayern: { accent: 0xc9aa82, bayPitchM: 3.4, frame: 0x6a6156, glass: 0x75878a, stone: 0xd8c3a3, windowHeightM: 2.15 },
  "brandenburg-mecklenburg-vorpommern": { accent: 0xc5ced0, bayPitchM: 3.25, frame: 0x4f5b5d, glass: 0x78989d, stone: 0x6f7473, windowHeightM: 2.25 },
  bremen: { accent: 0xe4c1ac, bayPitchM: 3.2, frame: 0x6f5149, glass: 0x738b8e, stone: 0xb86e5a, windowHeightM: 2.25 },
  hamburg: { accent: 0xdac7aa, bayPitchM: 3.25, frame: 0x675e54, glass: 0x74888b, stone: 0xd1bea0, windowHeightM: 2.15 },
  hessen: { accent: 0xe6ded0, bayPitchM: 4.1, frame: 0x52686b, glass: 0x71979b, stone: 0xcfc4b0, windowHeightM: 2.35 },
  "niedersachsen-schleswig-holstein": { accent: 0xa17d5b, bayPitchM: 3.4, frame: 0x6c5946, glass: 0x779a9e, stone: 0xc8c4b9, windowHeightM: 2.45 },
  "nordrhein-westfalen": { accent: 0xb38a61, bayPitchM: 3.7, frame: 0x725b43, glass: 0x75999e, stone: 0xb5b6ad, windowHeightM: 2.55 },
  "rheinland-pfalz": { accent: 0xe5e1d5, bayPitchM: 3.4, frame: 0x59696a, glass: 0x78979a, stone: 0xd6d0c2, windowHeightM: 2.25 },
  saarland: { accent: 0xded9ca, bayPitchM: 3.5, frame: 0x606765, glass: 0x78989b, stone: 0xcfc9ba, windowHeightM: 2.35 },
  "sachsen-anhalt": { accent: 0xc2a47e, bayPitchM: 3.25, frame: 0x665d52, glass: 0x748789, stone: 0xd8c8ad, windowHeightM: 2.15 },
  thueringen: { accent: 0xd9d2c5, bayPitchM: 3.45, frame: 0x5f6461, glass: 0x759599, stone: 0xbeb8ab, windowHeightM: 2.3 },
  sachsen: { accent: 0xe2c69d, bayPitchM: 3.2, frame: 0x665a4a, glass: 0x718488, stone: 0xd4b98f, windowHeightM: 2.2 },
};

type RunFrame = {
  axis: WorldPoint2;
  lengthM: number;
  midpoint: WorldPoint2;
  outward: WorldPoint2;
  rotationY: number;
};

function runFrame(runValue: FederalFacadeRun, center: WorldPoint2): RunFrame {
  const dx = runValue.endWorldM[0] - runValue.startWorldM[0];
  const dz = runValue.endWorldM[1] - runValue.startWorldM[1];
  const lengthM = Math.hypot(dx, dz);
  const axis: WorldPoint2 = [dx / lengthM, dz / lengthM];
  const midpoint: WorldPoint2 = [
    (runValue.startWorldM[0] + runValue.endWorldM[0]) / 2,
    (runValue.startWorldM[1] + runValue.endWorldM[1]) / 2,
  ];
  const left: WorldPoint2 = [-axis[1], axis[0]];
  const centerToMid: WorldPoint2 = [midpoint[0] - center[0], midpoint[1] - center[1]];
  const outward: WorldPoint2 =
    left[0] * centerToMid[0] + left[1] * centerToMid[1] >= 0
      ? left
      : [-left[0], -left[1]];
  return { axis, lengthM, midpoint, outward, rotationY: Math.atan2(outward[0], outward[1]) };
}

function addRunBox(
  builder: Builder,
  runValue: FederalFacadeRun,
  center: WorldPoint2,
  color: number,
  alongM: number,
  centerY: number,
  outwardM: number,
  widthM: number,
  heightM: number,
  depthM: number,
  inked = false,
): void {
  const frame = runFrame(runValue, center);
  addBox(
    builder,
    color,
    frame.midpoint[0] + frame.axis[0] * alongM + frame.outward[0] * outwardM,
    centerY,
    frame.midpoint[1] + frame.axis[1] * alongM + frame.outward[1] * outwardM,
    widthM,
    heightM,
    depthM,
    frame.rotationY,
    inked,
  );
}

function addHorizontalCap(
  builder: Builder,
  ringWorldM: ReadonlyArray<WorldPoint2>,
  y: number,
  color: number,
  facesUp: boolean,
): void {
  const shape = new Shape();
  ringWorldM.forEach(([x, z], index) => {
    const shapeZ = facesUp ? -z : z;
    if (index === 0) shape.moveTo(x, shapeZ);
    else shape.lineTo(x, shapeZ);
  });
  shape.closePath();
  const geometry = new ShapeGeometry(shape);
  geometry.rotateX(facesUp ? -Math.PI / 2 : Math.PI / 2);
  geometry.translate(0, y, 0);
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  builder.edges.push(
    new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
  );
}

function addClosedMassingZone(
  builder: Builder,
  zone: NonNullable<FederalStateRepresentationProfile["manualMassing"]>["zones"][number],
  color: number,
): void {
  const center: WorldPoint2 = [
    zone.ringWorldM.reduce((sum, point) => sum + point[0], 0) /
      zone.ringWorldM.length,
    zone.ringWorldM.reduce((sum, point) => sum + point[1], 0) /
      zone.ringWorldM.length,
  ];
  const heightM = zone.topYM - zone.bottomYM;
  for (let index = 0; index < zone.ringWorldM.length; index += 1) {
    const startWorldM = zone.ringWorldM[index];
    const endWorldM = zone.ringWorldM[(index + 1) % zone.ringWorldM.length];
    const wallRun: FederalFacadeRun = {
      endWorldM,
      groundYM: zone.bottomYM,
      measuredHeightM: heightM,
      sourcePartId: zone.id,
      startWorldM,
      storeys: 1,
    };
    addRunBox(
      builder,
      wallRun,
      center,
      color,
      0,
      zone.bottomYM + heightM / 2,
      0,
      Math.hypot(
        endWorldM[0] - startWorldM[0],
        endWorldM[1] - startWorldM[1],
      ) + 0.08,
      heightM,
      0.3,
      true,
    );
  }
  addHorizontalCap(builder, zone.ringWorldM, zone.bottomYM, color, false);
  addHorizontalCap(builder, zone.ringWorldM, zone.topYM, color, true);
}

function addRunDiagonal(
  builder: Builder,
  runValue: FederalFacadeRun,
  center: WorldPoint2,
  color: number,
  alongM: number,
  centerY: number,
  widthM: number,
  riseM: number,
): void {
  const frame = runFrame(runValue, center);
  const length = Math.hypot(widthM, riseM);
  const geometry = new BoxGeometry(length, 0.16, 0.16);
  geometry.rotateZ(Math.atan2(riseM, widthM));
  geometry.rotateY(frame.rotationY);
  geometry.translate(
    frame.midpoint[0] + frame.axis[0] * alongM + frame.outward[0] * 0.25,
    centerY,
    frame.midpoint[1] + frame.axis[1] * alongM + frame.outward[1] * 0.25,
  );
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  builder.edges.push(new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES));
}

function addEntranceFrame(
  builder: Builder,
  site: FederalStateRepresentationProfile,
  runValue: FederalFacadeRun,
  style: SiteStyle,
  alongM: number,
  widthM: number,
): void {
  const heightM = Math.min(4.8, Math.max(3.6, runValue.measuredHeightM * 0.23));
  for (const side of [-1, 1] as const) {
    addRunBox(builder, runValue, site.centerWorldM, style.accent, alongM + side * widthM / 2, runValue.groundYM + heightM / 2, 0.27, 0.28, heightM, 0.22, true);
  }
  addRunBox(builder, runValue, site.centerWorldM, style.accent, alongM, runValue.groundYM + heightM, 0.27, widthM + 0.28, 0.28, 0.22, true);
}

function addFacadeGrid(
  builder: Builder,
  site: FederalStateRepresentationProfile,
  runValue: FederalFacadeRun,
  runIndex: number,
  style: SiteStyle,
): void {
  const frame = runFrame(runValue, site.centerWorldM);
  const bayCount = runValue.bayCount ?? Math.max(2, Math.min(18, Math.round(frame.lengthM / style.bayPitchM)));
  const pitch = frame.lengthM / bayCount;
  const floorHeight = Math.min(3.75, Math.max(2.7, (runValue.measuredHeightM - 0.8) / runValue.storeys));
  const entryWidth = Math.min(5.2, Math.max(3.2, pitch * 1.2));
  const entryAlong = runIndex === 0 ? 0 : Number.POSITIVE_INFINITY;

  for (let floor = 0; floor < runValue.storeys; floor += 1) {
    const y = runValue.groundYM + 1.65 + floor * floorHeight;
    for (let bay = 0; bay < bayCount; bay += 1) {
      const along = -frame.lengthM / 2 + pitch * (bay + 0.5);
      if (floor === 0 && Math.abs(along - entryAlong) < entryWidth * 0.58) continue;
      addRunBox(
        builder,
        runValue,
        site.centerWorldM,
        style.glass,
        along,
        y,
        0.22,
        Math.max(0.85, pitch - 0.62),
        Math.min(style.windowHeightM, floorHeight - 0.48),
        0.12,
      );
    }
    addRunBox(builder, runValue, site.centerWorldM, floor % 2 === 0 ? style.stone : style.accent, 0, runValue.groundYM + 0.3 + (floor + 1) * floorHeight, 0.15, frame.lengthM, 0.22, 0.18);
  }
  for (let bay = 0; bay <= bayCount; bay += 1) {
    const along = -frame.lengthM / 2 + pitch * bay;
    addRunBox(builder, runValue, site.centerWorldM, style.frame, along, runValue.groundYM + runValue.measuredHeightM / 2, 0.24, 0.14, Math.max(3, runValue.measuredHeightM - 0.8), 0.14);
  }
  addRunBox(builder, runValue, site.centerWorldM, style.accent, 0, runValue.groundYM + runValue.measuredHeightM - 0.25, 0.18, frame.lengthM, 0.5, 0.22, true);
  if (runIndex === 0) addEntranceFrame(builder, site, runValue, style, entryAlong, entryWidth);
}

function addCharacterDetails(
  builder: Builder,
  site: FederalStateRepresentationProfile,
  style: SiteStyle,
): void {
  const primary = site.facadeRuns[0];
  if (!primary) return;
  const frame = runFrame(primary, site.centerWorldM);
  switch (site.id) {
    case "baden-wuerttemberg":
      for (const side of [-1, 1] as const) {
        addRunDiagonal(builder, primary, site.centerWorldM, style.accent, side * 5.2, primary.groundYM + 4.0, 5.5, side * 3.5);
      }
      break;
    case "bayern":
    case "hamburg":
    case "sachsen-anhalt":
    case "sachsen":
      for (let course = 1; course <= 3; course += 1) {
        addRunBox(builder, primary, site.centerWorldM, style.accent, 0, primary.groundYM + primary.measuredHeightM - course * 0.42, 0.25, frame.lengthM, 0.16, 0.24);
      }
      break;
    case "brandenburg-mecklenburg-vorpommern":
    case "niedersachsen-schleswig-holstein":
      addRunBox(builder, primary, site.centerWorldM, style.glass, 0, primary.groundYM + primary.measuredHeightM * 0.48, 0.3, Math.min(9.5, frame.lengthM * 0.3), primary.measuredHeightM * 0.78, 0.16, true);
      break;
    case "hessen":
      addRunBox(builder, primary, site.centerWorldM, style.glass, -frame.lengthM * 0.18, primary.groundYM + primary.measuredHeightM * 0.72, 0.5, Math.min(12, frame.lengthM * 0.48), 4.8, 0.3, true);
      break;
    case "nordrhein-westfalen":
      for (let along = -frame.lengthM * 0.38; along <= frame.lengthM * 0.38; along += 7.2) {
        addRunDiagonal(builder, primary, site.centerWorldM, style.accent, along, primary.groundYM + primary.measuredHeightM / 2, 7.2, primary.measuredHeightM - 1.6);
        addRunDiagonal(builder, primary, site.centerWorldM, style.accent, along, primary.groundYM + primary.measuredHeightM / 2, 7.2, -(primary.measuredHeightM - 1.6));
      }
      break;
    case "rheinland-pfalz":
      for (const runValue of site.facadeRuns.slice(0, 3)) {
        const roofFrame = runFrame(runValue, site.centerWorldM);
        for (let along = -roofFrame.lengthM / 2 + 1; along < roofFrame.lengthM / 2; along += 3.2) {
          addRunBox(builder, runValue, site.centerWorldM, 0x718d6d, along, runValue.groundYM + runValue.measuredHeightM + 0.55, 0.12, 0.11, 1.05, 0.11);
        }
      }
      break;
    case "saarland":
      for (let along = -frame.lengthM / 2 + 0.5; along < frame.lengthM / 2; along += 2.3) {
        addRunBox(builder, primary, site.centerWorldM, style.frame, along, primary.groundYM + primary.measuredHeightM / 2, 0.42, 0.17, primary.measuredHeightM, 0.18);
      }
      break;
    case "thueringen":
      for (let along = -frame.lengthM / 2 + 1.2; along < frame.lengthM / 2; along += 3.2) {
        addRunBox(builder, primary, site.centerWorldM, style.accent, along, primary.groundYM + 3.7, 0.32, 0.44, 7.0, 0.28, true);
      }
      break;
    case "bremen":
      // The open surface frames already carry the source-described split:
      // three 8-storey head runs and four 4-storey villa/link runs.
      break;
  }
}

function buildSite(site: FederalStateRepresentationProfile): Group {
  const builder = createBuilder();
  const style = SITE_STYLES[site.id];
  if (site.manualMassing) {
    for (const zone of site.manualMassing.zones) {
      addClosedMassingZone(builder, zone, style.stone);
    }
  }
  for (const [index, facade] of site.facadeRuns.entries()) {
    addFacadeGrid(builder, site, facade, index, style);
  }
  addCharacterDetails(builder, site, style);
  const group = finishDrawnGroup(builder, {
    name: `Federal state representation ${site.id}`,
  });
  if (!group) throw new Error(`Empty federal-state representation: ${site.id}`);
  group.userData.profile = site;
  group.userData.collisionPolicy =
    site.manualMassing === undefined
      ? "thin recognition overlay; retain named LoD2 obstacle and leave the entrance aperture visually open"
      : "closed source-bounded manual shell; collision is exported for the full authored height";
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.userData.federalStateRepresentation = true;
    object.userData.federalStateRepresentationId = site.id;
    object.userData.stateCodes = site.stateCodes;
  });
  return group;
}

function pointInRing(
  x: number,
  z: number,
  ringWorldM: ReadonlyArray<WorldPoint2>,
): boolean {
  let inside = false;
  for (
    let index = 0, previous = ringWorldM.length - 1;
    index < ringWorldM.length;
    previous = index++
  ) {
    const [x1, z1] = ringWorldM[index];
    const [x2, z2] = ringWorldM[previous];
    if (
      z1 > z !== z2 > z &&
      x < ((x2 - x1) * (z - z1)) / (z2 - z1 || Number.EPSILON) + x1
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function squaredDistanceToSegment(
  x: number,
  z: number,
  start: WorldPoint2,
  end: WorldPoint2,
): number {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  const progress =
    lengthSquared <= Number.EPSILON
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((x - start[0]) * dx + (z - start[1]) * dz) / lengthSquared,
          ),
        );
  return (
    (x - (start[0] + dx * progress)) ** 2 +
    (z - (start[1] + dz * progress)) ** 2
  );
}

/**
 * Full-height collision for the only two houses whose false OSM display
 * prisms are visually suppressed. Good LoD2 sites deliberately stay out of
 * this hook because their authoritative obstacle polygons remain active.
 */
export function federalStateRepresentationSolidAt(
  x: number,
  y: number,
  z: number,
  radiusM = 0,
): boolean {
  const padding = Math.max(0, radiusM);
  for (const siteValue of FEDERAL_STATE_REPRESENTATIONS) {
    const site: FederalStateRepresentationProfile = siteValue;
    if (!site.manualMassing) continue;
    for (const zone of site.manualMassing.zones) {
      if (y + padding < zone.bottomYM || y - padding > zone.topYM) continue;
      if (pointInRing(x, z, zone.ringWorldM)) return true;
      if (padding === 0) continue;
      for (let index = 0; index < zone.ringWorldM.length; index += 1) {
        if (
          squaredDistanceToSegment(
            x,
            z,
            zone.ringWorldM[index],
            zone.ringWorldM[(index + 1) % zone.ringWorldM.length],
          ) <=
          padding * padding
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/** Build all 13 source-bound houses for the 15 Länder. */
export function createFederalStateRepresentations(): Group {
  const root = new Group();
  root.name = "Federal state representations source-bound details";
  root.userData.profile = FEDERAL_STATE_REPRESENTATIONS;
  root.userData.sourceRegistry = FEDERAL_STATE_REPRESENTATION_SOURCE_REGISTRY;
  root.userData.collisionPolicy =
    "eleven visual overlays retain LoD2 obstacles; Bremen and Saxony export closed full-height manual solids because their false OSM display prisms are suppressed";
  for (const site of FEDERAL_STATE_REPRESENTATIONS) root.add(buildSite(site));
  const bounds = new Box3().setFromObject(root);
  root.userData.metricBounds = {
    max: bounds.max.toArray(),
    min: bounds.min.toArray(),
  };
  return root;
}
