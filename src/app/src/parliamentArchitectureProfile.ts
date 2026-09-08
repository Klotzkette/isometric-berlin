/** Step 10: architectural reading, separated from the delivered LoD2 survey. */
export const PARLIAMENT_ARCHITECTURE_PROFILE = {
  source: "Geoportal Berlin LoD2; existing decimetre prism payload",
  geometryStatus:
    "Original source records are retained. The missing Jakob-Kaiser northeast upper wing uses a documented 22 m eaves display estimate on the exact existing eastern U plan. Bay rhythms, frame sections, glazing colours and the shallow library crown are non-surveyed visual reconstruction.",
  checked: "2026-09-08",
  photographsBundled: false,
  jakobKaiserHaus: {
    parents: ["DEBE01YYK00001Li", "DEBE01YYK00003Y9"],
    sourceIds: [
      "5ITeMfv2", "ZnvQ4nLq", "9RhopAvB", "8Xin7PqI", "8bMtIR4M",
      "1IAjmM1x", "BJBxg2ub", "kslsuKgM", "x6GjEpRH", "N7uX3bj2",
      "QjNLvnGq", "xXWDOUCs", "FAoRPGwK",
    ],
    sources: [
      "https://www.bundestag.de/besuche/architektur/kaiserhaus/architektur/architektur-198866",
      "https://www.gmp.de/de/projekte/398/jakob-kaiser-haus-abgeordnetenburos-des-deutschen-bundestages-hauser-4-und-8",
    ],
    visualReferences: [
      "https://commons.wikimedia.org/wiki/File:Jakob-Kaiser-Haus-2025-06-msu-6595.jpg",
      "https://commons.wikimedia.org/wiki/File:Jakob-Kaiser-Haus-2025-06-msu-6620.jpg",
    ],
    materialReading: "Separate house facades; limestone, glass/metal and the eastern houses' cedar sun-shading",
  },
  marieElisabethLuedersHaus: {
    parent: "DEBE01YYK00003Ey",
    sourceIds: [
      "m9aqs23l", "K0001x35", "1W6TCvFV", "LndEOGy0", "2tV0001a",
      "2tV0001Q", "2tV0001R", "zt00006S", "zt00006R", "K0001xIC",
      "K0001xhz", "oEUJRwjv", "1i200023",
    ],
    sources: ["https://www.bundestag.de/besuche/architektur/luedershaus/architektur"],
    visualReferences: [
      "https://commons.wikimedia.org/wiki/File:Lueders-haus.jpg",
      "https://commons.wikimedia.org/wiki/File:M_E_Lueders_Haus.jpg",
    ],
    librarySourceId: "K0001x35",
    libraryCrown: {
      centreWorld: [406, -139],
      radiusM: 16.5,
      baseY: 32.7,
      glazingHeightM: 1.15,
      capHeightM: 0.38,
      note: "Retained library centre/radius; photo-proportioned roof clerestory replaces the former unsupported 34 m opaque drum. It is not a surveyed cylinder.",
    },
    protectedSourceReading: "Comb-shaped office wings; source courts remain open. Existing circular hearing-room opening, canopy, two bridges and widening public stair retain their independent source-bound models.",
  },
} as const;

export const PARLIAMENT_ARCHITECTURE_IDS: ReadonlySet<string> = new Set([
  ...PARLIAMENT_ARCHITECTURE_PROFILE.jakobKaiserHaus.sourceIds,
  ...PARLIAMENT_ARCHITECTURE_PROFILE.marieElisabethLuedersHaus.sourceIds,
]);

export const PARLIAMENT_ARCHITECTURE_GROUP = "Parliament source-bound architecture";
export const MINECRAFT_PARLIAMENT_ARCHITECTURE_GROUP = "Minecraft parliament source-bound architecture";

/** The source reports only the 4.325 m podium, also in the 2026 CityGML.
 * The outline below is its exact intersection with x >= 535 m; it adds no
 * new occupied plan. The official 22 m eaves statement is a display estimate,
 * not an invented surveyed height for this individual missing wing. */
export const JAKOB_KAISER_EAST_UPPER_PROFILE = {
  sourcePrismId: "9RhopAvB",
  displayPrismId: "jkh-east-upper-display",
  sourceParent: "DEBE01YYK00001Li",
  sourceCreated: "2026-03-02",
  sourceUrl: "https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5819.zip",
  sourceSha256: "86084bf012830c373bbcb4ac1ca2814153430bb9a1eb6d8271b1f7fc8ccecd17",
  sourcePodiumHeightM: 4.325,
  sourceBaseY: 4.6,
  bottomY: 8.9,
  eavesHeightDisplayM: 22,
  topY: 26.6,
  exactClipX: 535,
  footprintWorld: [
    [537.4, 99.5], [537.3, 98.5], [542.3, 98.1], [542.6, 100.9],
    [585.4, 97.1], [585.3, 95.3], [585.5, 95.3], [588.4, 95],
    [588.5, 96.8], [596.2, 96.1], [594.4, 94.6], [593.9, 89.5],
    [595.6, 89.3], [591.7, 45.5], [590, 45.7], [589.5, 39.3],
    [591.1, 39.1], [589.5, 20.2], [570.9, 21.9], [572.6, 40.8],
    [543.6, 43.3], [541.7, 21.1], [535.6, 21.7], [535.8, 23.9],
    [535, 23.96666666666666], [535, 99.71448382126349],
  ],
  courtyardWorld: [[573.2, 47.2], [576.4, 83.3], [547.4, 85.9], [544.2, 49.7]],
  status: "bounded source-gap display reconstruction; original source podium remains",
} as const;
