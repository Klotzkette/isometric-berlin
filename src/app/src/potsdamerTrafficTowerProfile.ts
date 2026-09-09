/** Source facts and openly labelled display choices for the present-day replica. */
export const POTSDAMER_TRAFFIC_TOWER_PROFILE = {
  name: "Verkehrsturm am Potsdamer Platz",
  osmKey: "way/241572310",
  // Centroid of the retained EPSG:25833 polygon, before decimetre packaging.
  worldXZ: [302.4015680925, 1081.7137531834] as const,
  wgs84: [13.3762592648, 52.5092345129] as const,
  sourceRingXZ: [
    [301.5157497058, 1082.262777968],
    [301.6242013381, 1081.06342331],
    [302.1678143236, 1080.741818732],
    [303.2707413508, 1081.211734751],
    [303.4062786338, 1081.826807959],
    [302.6186770262, 1082.732694131],
  ] as const,
  // Bilinear top sample from the packaged official ground; the old voxel top is 5.4.
  groundYM: 5.2,
  heightM: 8.5,
  faces: 5,
  replicaInstalledHere: "2000-09-29",
  // Local subdivisions are photographed recognition dimensions, not a survey.
  platformTopM: 0.36,
  clockBottomM: 4.85,
  clockTopM: 6.18,
  windowTopM: 7.62,
  signalCentreM: 7.89,
  eaveBottomM: 8.13,
  eaveTopM: 8.27,
  frameRadiusM: 1,
  roofRadiusM: 1.3,
  firstFaceYaw: 0.4229,
  geometryStatus:
    "Exact retained OSM centroid and original footprint; published 8.50 m total height, five supports/clocks and horizontal signals. Local widths, member sizes and pentagonal orientation are procedural estimates from credited external photographs.",
  signalStatus:
    "Present replica displays changing lights. Exact controller timing and face assignments are not published in the inspected sources; this slow demonstration cycle is an approximation, not a live feed or a surveyed program.",
  sources: [
    "https://www.openstreetmap.org/way/241572310",
    "https://www.berlin.de/sen/uvk/presse/pressemitteilungen/2024/pressemitteilung.1512202.php",
    "https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/verkehrsmanagement/ampeln-und-co/",
    "https://bildhauerei-in-berlin.de/bildwerk/verkehrsturm-7891/",
    "https://www.potsdamerplatz.de/de/explore/verkehrsturm-ampel/",
    "https://de.wikipedia.org/wiki/Verkehrsturm_am_Potsdamer_Platz",
  ],
} as const;

export const POTSDAMER_TOWER_DRAWN_NAME = "Potsdamer traffic tower drawn";
export const POTSDAMER_TOWER_MINECRAFT_NAME = "Potsdamer traffic tower Minecraft";
export const POTSDAMER_TOWER_ROOT_NAME = "Potsdamer Platz historical traffic tower";

/** A quiet illustrative cycle. Not asserted to be the replica's actual timings. */
export const POTSDAMER_TOWER_SIGNAL_CYCLE = {
  red: 16,
  redAmber: 2,
  green: 14,
  amber: 4,
} as const;
export const POTSDAMER_TOWER_CYCLE_SECONDS = 36;
export const POTSDAMER_TOWER_FACE_OFFSETS = [0, 18, 0, 18, 18] as const;
export type PotsdamerTowerPhase = 0 | 1 | 2 | 3;

export function potsdamerTowerPhase(seconds: number, face = 0): PotsdamerTowerPhase {
  const safeTime = Number.isFinite(seconds) ? seconds : 0;
  const offset = POTSDAMER_TOWER_FACE_OFFSETS[((face % 5) + 5) % 5];
  const t = ((safeTime + offset) % POTSDAMER_TOWER_CYCLE_SECONDS +
    POTSDAMER_TOWER_CYCLE_SECONDS) % POTSDAMER_TOWER_CYCLE_SECONDS;
  if (t < 16) return 0;
  if (t < 18) return 1;
  if (t < 32) return 2;
  return 3;
}

/** Horizontal order, viewed from outside: red, amber, green. */
export function potsdamerTowerLamps(phase: PotsdamerTowerPhase): readonly boolean[] {
  return phase === 0 ? [true, false, false]
    : phase === 1 ? [true, true, false]
      : phase === 2 ? [false, false, true] : [false, true, false];
}
