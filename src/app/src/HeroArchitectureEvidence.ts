/** Published facts; subdivision, relief poses and block sizes remain display geometry. */
export const REICHSTAG_DOME_EVIDENCE = {
  sourceUrl: "https://www.bundestag.de/besuche/architektur/reichstag/kuppel",
  mirrorRows: 30,
  mirrorsPerRow: 12,
  openingDiameterM: 10,
  platformHeightAboveTerraceM: 40.7 - 24,
  platformAreaM2: 200,
  rampLengthM: 230,
  rampStartSeparationRadians: Math.PI,
} as const;

export const BRANDENBURG_GATE_RELIEF_EVIDENCE = {
  metopeSourceUrl: "https://bildhauerei-in-berlin.de/bildwerk/metopen-triglyphenfries-10441/",
  atticSourceUrl: "https://bildhauerei-in-berlin.de/bildwerk/zug-der-friedensgoettin-10442/",
  metopeCount: 32,
  metopeSizeM: 1,
  atticLengthM: 7.63,
  atticHeightM: 1.51,
  atticFace: "east",
} as const;
