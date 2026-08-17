import {
  BoxGeometry,
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  TorusGeometry,
} from "three";

import {
  HAUPTBAHNHOF_ANCHOR_WORLD,
  HAUPTBAHNHOF_ROTATION_Y_DEGREES,
} from "./ArchitecturalLandmarks";
import {
  MOABIT_PRISON_PARK_PROFILE,
  POTSDAMER_DETAIL_PROFILE,
} from "./expandedCityProfiles";

type WorldPoint2 = readonly [number, number];
type WorldPoint3 = readonly [number, number, number];

export type SchwellenraumFloorProfile =
  | {
      kind: "flat";
      yM: number;
    }
  | {
      axis: "local-x" | "local-z";
      fromM: number;
      fromYM: number;
      kind: "linear";
      toM: number;
      toYM: number;
    };

/**
 * A deliberately narrow opening through an otherwise solid city shell.
 *
 * The boxes are navigation contracts, not claims about surveyed rooms. Their
 * world anchors reuse the existing metric landmark models while stairs,
 * corridors and rooms are bounded presentation reconstructions.
 */
export type SchwellenraumAccessibleVolume = {
  centerWorldM: WorldPoint3;
  floor: SchwellenraumFloorProfile;
  geometryStatus: string;
  id: string;
  kind: "portal" | "ramp" | "stair" | "interior" | "sublevel";
  landmark: string;
  rotationY: number;
  sizeM: WorldPoint3;
  /** Optional exact LoD2 ids whose collision may be opened by this volume. */
  sourceBuildingIds?: ReadonlyArray<string>;
};

export type SchwellenraumProtectedVolume =
  | {
      centerWorldM: WorldPoint2;
      id: string;
      maxYM: number;
      minYM: number;
      name: string;
      radiusM: number;
      shape: "circle";
    }
  | {
      centerWorldM: WorldPoint2;
      id: string;
      maxYM: number;
      minYM: number;
      name: string;
      rotationY: number;
      shape: "box";
      sizeM: WorldPoint2;
    }
  | {
      id: string;
      maxYM: number;
      minYM: number;
      name: string;
      ringWorldM: ReadonlyArray<WorldPoint2>;
      shape: "polygon";
    };

export type SchwellenraumInteriorSolid =
  | {
      centerWorldM: WorldPoint3;
      id: string;
      rotationY: number;
      shape: "box";
      sizeM: WorldPoint3;
    }
  | {
      centerWorldM: WorldPoint3;
      halfHeightM: number;
      id: string;
      innerRadiusM: number;
      outerRadiusM: number;
      shape: "ring";
    }
  | {
      fromWorldM: WorldPoint3;
      id: string;
      radiusM: number;
      shape: "segment";
      toWorldM: WorldPoint3;
    };

const PRESENTATION_GEOMETRY_STATUS =
  "Existing open-data shell anchor with a mode-only presentation reconstruction of an accessible threshold; interior dimensions and routes are not surveyed geometry";

const REICHSTAG = {
  anchor: [317.729, 3.595, 40.477] as const,
  rotationY: (-1.676 * Math.PI) / 180,
};
const CHANCELLERY = {
  anchor: [-220.236, 1.554, -145.806] as const,
  rotationY: (-1.337 * Math.PI) / 180,
};
const HAUPTBAHNHOF = {
  anchor: [
    HAUPTBAHNHOF_ANCHOR_WORLD[0],
    4.575,
    HAUPTBAHNHOF_ANCHOR_WORLD[1],
  ] as const,
  rotationY: (HAUPTBAHNHOF_ROTATION_Y_DEGREES * Math.PI) / 180,
};
const POTSDAMER = {
  anchor: [
    POTSDAMER_DETAIL_PROFILE.potsdamerStationWorldM[0],
    5.4,
    POTSDAMER_DETAIL_PROFILE.potsdamerStationWorldM[1],
  ] as const,
  rotationY: 0.106,
};
const CHARITE = {
  // Centre of the existing Friedrich-Althoff-Haus entrance ensemble.
  anchor: [492.4, 5.1, -500.5] as const,
  rotationY: -0.24,
};

function localToWorld(
  anchor: WorldPoint3,
  rotationY: number,
  local: WorldPoint3,
): [number, number, number] {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [
    anchor[0] + cosine * local[0] + sine * local[2],
    anchor[1] + local[1],
    anchor[2] - sine * local[0] + cosine * local[2],
  ];
}

function accessibleVolume(
  site: { anchor: WorldPoint3; rotationY: number },
  profile: Omit<
    SchwellenraumAccessibleVolume,
    "centerWorldM" | "geometryStatus" | "rotationY"
  > & { centerLocalM: WorldPoint3 },
): SchwellenraumAccessibleVolume {
  return {
    centerWorldM: localToWorld(
      site.anchor,
      site.rotationY,
      profile.centerLocalM,
    ),
    floor: profile.floor,
    geometryStatus: PRESENTATION_GEOMETRY_STATUS,
    id: profile.id,
    kind: profile.kind,
    landmark: profile.landmark,
    rotationY: site.rotationY,
    sizeM: profile.sizeM,
    sourceBuildingIds: profile.sourceBuildingIds,
  };
}

const REICHSTAG_SOURCE_IDS = ["K0002MCN", "UbQkgNZe", "ycOYQRVL"] as const;
const CHANCELLERY_SOURCE_IDS = [
  "XCNI3jr6",
  "n02sJgK0",
  "3Gfqy8sI",
  "ttJFXdbg",
  "SDUXI5wB",
  "bP7AjElp",
  "kJtNoSnl",
  "MLwG4KW9",
  "X6sFDl1v",
  "xIEMuFtk",
  "JC1pzD9P",
  "DV754o6F",
  "wgTapoMe",
] as const;
const HAUPTBAHNHOF_SOURCE_IDS = [
  "K0002KiE",
  "663NhxsM",
  "iiRhAlr6",
  "5gArGdou",
] as const;
const POTSDAMER_SOURCE_IDS = ["K0002SCt", "K0000BRX"] as const;
const CHARITE_SOURCE_IDS = [
  "f4N7OZJI",
  "t76KCSEh",
  "KztaII44",
  "50yMshCk",
  "YxDLPnmj",
  "a8CyAsQj",
] as const;

/**
 * Only these volumes may override a LoD2 footprint collision. Keeping this
 * list explicit prevents a broad "walk through buildings" exception.
 */
export const SCHWELLENRAUM_ACCESSIBLE_VOLUMES: ReadonlyArray<SchwellenraumAccessibleVolume> =
  [
    accessibleVolume(REICHSTAG, {
      centerLocalM: [-58, 2.1, 0],
      floor: {
        axis: "local-x",
        fromM: -10,
        fromYM: REICHSTAG.anchor[1] + 0.2,
        kind: "linear",
        toM: 10,
        toYM: REICHSTAG.anchor[1] + 4,
      },
      id: "reichstag-west-stair",
      kind: "stair",
      landmark: "Reichstagsgebäude",
      sizeM: [24, 9, 13],
      sourceBuildingIds: REICHSTAG_SOURCE_IDS,
    }),
    accessibleVolume(REICHSTAG, {
      centerLocalM: [-49, 7.2, 0],
      floor: { kind: "flat", yM: REICHSTAG.anchor[1] + 4 },
      id: "reichstag-west-portal",
      kind: "portal",
      landmark: "Reichstagsgebäude",
      sizeM: [9, 11, 12],
      sourceBuildingIds: REICHSTAG_SOURCE_IDS,
    }),
    accessibleVolume(REICHSTAG, {
      centerLocalM: [-25, 7.2, 0],
      floor: { kind: "flat", yM: REICHSTAG.anchor[1] + 4 },
      id: "reichstag-plenary-approach",
      kind: "interior",
      landmark: "Reichstagsgebäude",
      sizeM: [44, 11, 13],
      sourceBuildingIds: REICHSTAG_SOURCE_IDS,
    }),
    accessibleVolume(REICHSTAG, {
      centerLocalM: [8, 9, 0],
      floor: { kind: "flat", yM: REICHSTAG.anchor[1] + 4 },
      id: "reichstag-plenary-hall",
      kind: "interior",
      landmark: "Reichstagsgebäude",
      sizeM: [54, 18, 58],
      sourceBuildingIds: REICHSTAG_SOURCE_IDS,
    }),

    accessibleVolume(HAUPTBAHNHOF, {
      centerLocalM: [0, 3.3, -91],
      floor: { kind: "flat", yM: HAUPTBAHNHOF.anchor[1] },
      id: "hauptbahnhof-europaplatz-portal",
      kind: "portal",
      landmark: "Berlin Hauptbahnhof",
      sizeM: [22, 9, 28],
      sourceBuildingIds: HAUPTBAHNHOF_SOURCE_IDS,
    }),
    accessibleVolume(HAUPTBAHNHOF, {
      centerLocalM: [0, 3.3, 91],
      floor: { kind: "flat", yM: HAUPTBAHNHOF.anchor[1] },
      id: "hauptbahnhof-washingtonplatz-portal",
      kind: "portal",
      landmark: "Berlin Hauptbahnhof",
      sizeM: [22, 9, 28],
      sourceBuildingIds: HAUPTBAHNHOF_SOURCE_IDS,
    }),
    accessibleVolume(HAUPTBAHNHOF, {
      centerLocalM: [0, 2.5, 0],
      floor: { kind: "flat", yM: HAUPTBAHNHOF.anchor[1] },
      id: "hauptbahnhof-concourse",
      kind: "interior",
      landmark: "Berlin Hauptbahnhof",
      sizeM: [40, 12, 154],
      sourceBuildingIds: HAUPTBAHNHOF_SOURCE_IDS,
    }),
    ...([-12, 12] as const).flatMap((localX) =>
      ([-1, 1] as const).map((direction) =>
        accessibleVolume(HAUPTBAHNHOF, {
          centerLocalM: [localX, -5.4, direction * 17],
          floor: {
            axis: "local-z",
            fromM: -18,
            fromYM:
              direction < 0
                ? HAUPTBAHNHOF.anchor[1]
                : HAUPTBAHNHOF.anchor[1] - 14.5,
            kind: "linear",
            toM: 18,
            toYM:
              direction < 0
                ? HAUPTBAHNHOF.anchor[1] - 14.5
                : HAUPTBAHNHOF.anchor[1],
          },
          id: `hauptbahnhof-deep-ramp-${localX}-${direction}`,
          kind: "ramp",
          landmark: "Berlin Hauptbahnhof",
          sizeM: [6, 19, 39],
          sourceBuildingIds: HAUPTBAHNHOF_SOURCE_IDS,
        }),
      ),
    ),
    accessibleVolume(HAUPTBAHNHOF, {
      centerLocalM: [0, -9.5, 0],
      floor: { kind: "flat", yM: HAUPTBAHNHOF.anchor[1] - 14.5 },
      id: "hauptbahnhof-deep-platform-hall",
      kind: "sublevel",
      landmark: "Berlin Hauptbahnhof",
      sizeM: [81, 14, 168],
      sourceBuildingIds: HAUPTBAHNHOF_SOURCE_IDS,
    }),

    accessibleVolume(CHANCELLERY, {
      centerLocalM: [101, 2.2, 0],
      floor: {
        axis: "local-x",
        fromM: 10,
        fromYM: CHANCELLERY.anchor[1] + 0.15,
        kind: "linear",
        toM: -10,
        toYM: CHANCELLERY.anchor[1] + 1.2,
      },
      id: "chancellery-east-ramp",
      kind: "ramp",
      landmark: "Bundeskanzleramt",
      sizeM: [24, 8, 12],
      sourceBuildingIds: CHANCELLERY_SOURCE_IDS,
    }),
    accessibleVolume(CHANCELLERY, {
      centerLocalM: [92, 6.2, 0],
      floor: { kind: "flat", yM: CHANCELLERY.anchor[1] + 1.2 },
      id: "chancellery-east-portal",
      kind: "portal",
      landmark: "Bundeskanzleramt",
      sizeM: [10, 12, 13],
      sourceBuildingIds: CHANCELLERY_SOURCE_IDS,
    }),
    accessibleVolume(CHANCELLERY, {
      centerLocalM: [66.4, 8.7, 0],
      floor: { kind: "flat", yM: CHANCELLERY.anchor[1] + 1.2 },
      id: "chancellery-leadership-hall",
      kind: "interior",
      landmark: "Bundeskanzleramt",
      sizeM: [50, 23, 48],
      sourceBuildingIds: CHANCELLERY_SOURCE_IDS,
    }),

    accessibleVolume(POTSDAMER, {
      centerLocalM: [-1.8, -4.5, -50],
      floor: {
        axis: "local-z",
        fromM: -20,
        fromYM: POTSDAMER.anchor[1],
        kind: "linear",
        toM: 20,
        toYM: POTSDAMER.anchor[1] - 9,
      },
      id: "potsdamer-north-descent",
      kind: "stair",
      landmark: "Bahnhof Potsdamer Platz",
      sizeM: [18, 16, 43],
      sourceBuildingIds: POTSDAMER_SOURCE_IDS,
    }),
    accessibleVolume(POTSDAMER, {
      centerLocalM: [0.8, -4.5, 30],
      floor: {
        axis: "local-z",
        fromM: 20,
        fromYM: POTSDAMER.anchor[1],
        kind: "linear",
        toM: -20,
        toYM: POTSDAMER.anchor[1] - 9,
      },
      id: "potsdamer-south-descent",
      kind: "stair",
      landmark: "Bahnhof Potsdamer Platz",
      sizeM: [18, 16, 43],
      sourceBuildingIds: POTSDAMER_SOURCE_IDS,
    }),
    accessibleVolume(POTSDAMER, {
      centerLocalM: [0, -3.5, 0],
      floor: { kind: "flat", yM: POTSDAMER.anchor[1] - 9 },
      id: "potsdamer-cellar-concourse",
      kind: "sublevel",
      landmark: "Bahnhof Potsdamer Platz",
      sizeM: [94, 12, 112],
      sourceBuildingIds: POTSDAMER_SOURCE_IDS,
    }),

    accessibleVolume(CHARITE, {
      centerLocalM: [0, 2.2, -16],
      floor: {
        axis: "local-z",
        fromM: -9,
        fromYM: CHARITE.anchor[1],
        kind: "linear",
        toM: 9,
        toYM: CHARITE.anchor[1] + 0.55,
      },
      id: "charite-althoff-ramp",
      kind: "ramp",
      landmark: "Charité Campus Mitte",
      sizeM: [12, 8, 22],
      sourceBuildingIds: CHARITE_SOURCE_IDS,
    }),
    accessibleVolume(CHARITE, {
      centerLocalM: [0, 5.1, -7],
      floor: { kind: "flat", yM: CHARITE.anchor[1] + 0.55 },
      id: "charite-althoff-portal",
      kind: "portal",
      landmark: "Charité Campus Mitte",
      sizeM: [12, 10, 9],
      sourceBuildingIds: CHARITE_SOURCE_IDS,
    }),
    accessibleVolume(CHARITE, {
      centerLocalM: [0, 4.7, 8],
      floor: { kind: "flat", yM: CHARITE.anchor[1] + 0.55 },
      id: "charite-althoff-corridor",
      kind: "interior",
      landmark: "Charité Campus Mitte",
      sizeM: [13, 9, 34],
      sourceBuildingIds: CHARITE_SOURCE_IDS,
    }),
  ] as const;

function interiorSolidBox(
  site: { anchor: WorldPoint3; rotationY: number },
  id: string,
  centerLocalM: WorldPoint3,
  sizeM: WorldPoint3,
): SchwellenraumInteriorSolid {
  return {
    centerWorldM: localToWorld(site.anchor, site.rotationY, centerLocalM),
    id,
    rotationY: site.rotationY,
    shape: "box",
    sizeM,
  };
}

function interiorPortalSolids(
  site: { anchor: WorldPoint3; rotationY: number },
  id: string,
  position: WorldPoint3,
  openingWidth: number,
  openingHeight: number,
  axis: "x" | "z",
): SchwellenraumInteriorSolid[] {
  const jambSize: WorldPoint3 =
    axis === "x" ? [0.65, openingHeight, 0.5] : [0.5, openingHeight, 0.65];
  const halfOpening = openingWidth / 2;
  const jambOffset = halfOpening + 0.25;
  const sideOffset = (side: number): WorldPoint3 =>
    axis === "x" ? [0, 0, side * jambOffset] : [side * jambOffset, 0, 0];
  return [
    ...([-1, 1] as const).map((side) => {
      const offset = sideOffset(side);
      return interiorSolidBox(
        site,
        `${id}-side-${side}`,
        [
          position[0] + offset[0],
          position[1] + offset[1],
          position[2] + offset[2],
        ],
        jambSize,
      );
    }),
    interiorSolidBox(
      site,
      `${id}-lintel`,
      [position[0], position[1] + openingHeight / 2, position[2]],
      axis === "x"
        ? [0.65, 0.6, openingWidth + 1]
        : [openingWidth + 1, 0.6, 0.65],
    ),
  ];
}

function interiorSolidRing(
  site: { anchor: WorldPoint3; rotationY: number },
  id: string,
  centerLocalM: WorldPoint3,
  innerRadiusM: number,
  outerRadiusM: number,
  halfHeightM: number,
): SchwellenraumInteriorSolid {
  return {
    centerWorldM: localToWorld(site.anchor, site.rotationY, centerLocalM),
    halfHeightM,
    id,
    innerRadiusM,
    outerRadiusM,
    shape: "ring",
  };
}

function interiorSolidSegment(
  site: { anchor: WorldPoint3; rotationY: number },
  id: string,
  fromLocalM: WorldPoint3,
  toLocalM: WorldPoint3,
  radiusM: number,
): SchwellenraumInteriorSolid {
  return {
    fromWorldM: localToWorld(site.anchor, site.rotationY, fromLocalM),
    id,
    radiusM,
    shape: "segment",
    toWorldM: localToWorld(site.anchor, site.rotationY, toLocalM),
  };
}

/**
 * Collision primitives for the authored jambs, walls, rails and furnishings.
 * Floors and ramps are deliberately absent: they belong to the walk-surface
 * sampler below and must support a visitor rather than block one.
 */
export const SCHWELLENRAUM_INTERIOR_SOLIDS: ReadonlyArray<SchwellenraumInteriorSolid> =
  [
    ...interiorPortalSolids(
      REICHSTAG,
      "reichstag-west-portal",
      [-49.2, 8.5, 0],
      10,
      9,
      "x",
    ),
    ...([-6.15, 6.15] as const).map((z) =>
      interiorSolidBox(
        REICHSTAG,
        `reichstag-approach-wall-${z}`,
        [-27, 6.1, z],
        [43, 4.4, 0.18],
      ),
    ),
    interiorSolidBox(
      REICHSTAG,
      "reichstag-plenary-lectern",
      [22, 4.55, 0],
      [4.8, 1.25, 2.2],
    ),
    interiorSolidBox(
      REICHSTAG,
      "reichstag-plenary-presidium",
      [25.5, 4.75, 0],
      [2.8, 1.7, 16],
    ),
    ...Array.from({ length: 7 }, (_, tier) =>
      interiorSolidRing(
        REICHSTAG,
        `reichstag-plenary-seat-ring-${tier + 1}`,
        [8, 4.35 + tier * 0.28, 2],
        8.55 + tier * 2.6,
        9.45 + tier * 2.6,
        0.48,
      ),
    ),

    ...([-1, 1] as const).flatMap((direction) =>
      interiorPortalSolids(
        HAUPTBAHNHOF,
        `hauptbahnhof-hall-portal-${direction}`,
        [0, 4.5, direction * 88.5],
        20,
        9,
        "z",
      ),
    ),
    ...([-15.5, 15.5] as const).map((x) =>
      interiorSolidBox(
        HAUPTBAHNHOF,
        `hauptbahnhof-guide-wall-${x}`,
        [x * 0.68, 2.3, 0],
        [0.16, 4.5, 144],
      ),
    ),
    ...([-12, 12] as const).flatMap((x) =>
      ([-1, 1] as const).flatMap((direction) =>
        ([-1, 1] as const).map((railSide) =>
          interiorSolidSegment(
            HAUPTBAHNHOF,
            `hauptbahnhof-escalator-rail-${x}-${direction}-${railSide}`,
            [x + railSide * 2.1, 1.15, direction * 34],
            [x + railSide * 2.1, -13.35, 0],
            0.22,
          ),
        ),
      ),
    ),
    ...([-10.1, -5.2, -0.3, 4.6] as const).map((y) =>
      interiorSolidRing(
        HAUPTBAHNHOF,
        `hauptbahnhof-daylight-ring-${y}`,
        [0, y, 0],
        11.5,
        12.15,
        0.16,
      ),
    ),

    ...interiorPortalSolids(
      CHANCELLERY,
      "chancellery-leadership-portal",
      [93.5, 6.8, 0],
      11,
      11.2,
      "x",
    ),
    ...([-21, 21] as const).map((z) =>
      interiorSolidBox(
        CHANCELLERY,
        `chancellery-hall-wall-${z}`,
        [66.4, 10.2, z],
        [47, 18, 0.18],
      ),
    ),
    ...([45, 55.5, 66, 76.5, 87] as const).flatMap((x) =>
      interiorPortalSolids(
        CHANCELLERY,
        `chancellery-light-gate-${x}`,
        [x, 7.8, 0],
        14,
        12,
        "x",
      ),
    ),

    ...([-69, 49] as const).flatMap((z) =>
      interiorPortalSolids(
        POTSDAMER,
        `potsdamer-station-gate-${z}`,
        [z < 0 ? -1.8 : 0.8, 4.7, z],
        15,
        9.4,
        "z",
      ),
    ),
    ...([-39, -19.5, 0, 19.5, 39] as const).flatMap((x) =>
      interiorPortalSolids(
        POTSDAMER,
        `potsdamer-cellar-bay-${x}`,
        [x, -4.2, 0],
        13,
        9.4,
        "z",
      ),
    ),
    ...([-45, 45] as const).map((z) =>
      interiorSolidBox(
        POTSDAMER,
        `potsdamer-cellar-end-wall-${z}`,
        [0, -4.8, z],
        [90, 8.5, 0.16],
      ),
    ),

    ...interiorPortalSolids(
      CHARITE,
      "charite-entrance-gate",
      [0, 5.2, -8],
      10,
      9.3,
      "z",
    ),
    ...([-1, 7, 15, 23] as const).flatMap((z) =>
      interiorPortalSolids(
        CHARITE,
        `charite-corridor-door-${z}`,
        [0, 4.55, z],
        7,
        8,
        "z",
      ),
    ),
    ...([-6, 6] as const).map((x) =>
      interiorSolidBox(
        CHARITE,
        `charite-corridor-wall-${x}`,
        [x, 4.45, 8],
        [0.16, 7.8, 33],
      ),
    ),
  ] as const;

/**
 * Names are checked independently from coordinates because memorial detail
 * groups may be replaced or refined without moving their public anchor.
 */
export const SCHWELLENRAUM_PROTECTED_NAMES: ReadonlySet<string> = new Set([
  "Denkmal für die ermordeten Juden Europas",
  "Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas",
  "Denkmal für die im Nationalsozialismus verfolgten Homosexuellen",
  "Mahnmal für verfolgte Zeugen Jehovas",
  "Gedenkort für Polen 1939-1945",
  "Sowjetisches Ehrenmal Tiergarten",
  "Denkzeichen Georg Elser",
  "Skulpturen gegen Krieg und Gewalt am ehemaligen Krolloperplatz",
  "Parlament der Bäume gegen Krieg und Gewalt",
  "Queer Rainbow Memorial Berlin",
  "Topographie des Terrors",
  "Geschichtspark Ehemaliges Zellengefängnis Moabit",
  "Karl-Liebknecht-Denkmal am Neuen See",
  "Rosa-Luxemburg-Denkmal am Neuen See",
  // Source-side protection deliberately treats every historic memorial
  // conservatively. These three recognition models replace protected OSM
  // records in other scene batches, so they inherit the same exact-Day rule.
  "Beethoven-Haydn-Mozart-Denkmal",
  "Goethe-Denkmal",
  "Siegessäule and Bismarck-Nationaldenkmal",
]);

const PROTECTED_NAME_MARKERS = [
  "holocaust memorial",
  "sinti and roma memorial",
  "memorial to persecuted homosexuals",
  "jehovah",
  "soviet memorial",
  "georg elser",
  "gedenkort für polen",
  "krolloper sculpture",
  "krieg und gewalt",
  "moabit prison",
  "polish memorial",
  "queer rainbow memorial",
  "topographie des terrors",
  "zellengefängnis",
  "bismarck-nationaldenkmal",
] as const;

export function isSchwellenraumProtectedObjectName(name: string): boolean {
  if (SCHWELLENRAUM_PROTECTED_NAMES.has(name)) {
    return true;
  }
  const normalized = name.toLocaleLowerCase("de-DE");
  return PROTECTED_NAME_MARKERS.some((marker) => normalized.includes(marker));
}

/**
 * Navigation exclusion volumes. They do not add, hide or recolour geometry;
 * they only guarantee that the mode cannot create a doorway into these sites.
 */
export const SCHWELLENRAUM_PROTECTED_VOLUMES: ReadonlyArray<SchwellenraumProtectedVolume> =
  [
    {
      centerWorldM: [462.88128157681786, 557.3677023872733],
      id: "protected-memorial-stele-field",
      maxYM: 14,
      minYM: -6,
      name: "Denkmal für die ermordeten Juden Europas",
      rotationY: 0,
      shape: "box",
      sizeM: [206, 101],
    },
    {
      centerWorldM: [307.700225593755, 186.2301389835775],
      id: "protected-sinti-roma-memorial",
      maxYM: 14,
      minYM: -6,
      name: "Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas",
      radiusM: 32,
      shape: "circle",
    },
    {
      centerWorldM: [304.16310529829934, 634.0641316818073],
      id: "protected-homosexual-memorial",
      maxYM: 15,
      minYM: -6,
      name: "Denkmal für die im Nationalsozialismus verfolgten Homosexuellen",
      radiusM: 11,
      shape: "circle",
    },
    {
      centerWorldM: [-112.55317433911841, 648.4968814877793],
      id: "protected-jehovah-memorial",
      maxYM: 14,
      minYM: -6,
      name: "Mahnmal für verfolgte Zeugen Jehovas",
      radiusM: 10,
      shape: "circle",
    },
    {
      centerWorldM: [50.72236387064913, 20.5249551711604],
      id: "protected-polish-memorial",
      maxYM: 16,
      minYM: -6,
      name: "Gedenkort für Polen 1939-1945",
      radiusM: 14,
      shape: "circle",
    },
    {
      // Includes the full axial ensemble: colonnade/soldier as well as both
      // T-34s and both ML-20 howitzers south of the former narrow box.
      centerWorldM: [31, 265],
      id: "protected-soviet-war-memorial",
      maxYM: 32,
      minYM: -6,
      name: "Sowjetisches Ehrenmal Tiergarten",
      rotationY: 0,
      shape: "box",
      sizeM: [104, 108],
    },
    {
      centerWorldM: [749.614475, 749.844173],
      id: "protected-georg-elser-memorial",
      maxYM: 27,
      minYM: -6,
      name: "Denkzeichen Georg Elser",
      radiusM: 10,
      shape: "circle",
    },
    ...[
      [-179.6, 55.7],
      [-189.2, 64.8],
      [-202.3, 24.7],
      [-231.2, 33.8],
    ].map((centerWorldM, index): SchwellenraumProtectedVolume => ({
      centerWorldM: centerWorldM as [number, number],
      id: `protected-krolloper-sculpture-${index + 1}`,
      maxYM: 18,
      minYM: -6,
      name: "Skulpturen gegen Krieg und Gewalt am ehemaligen Krolloperplatz",
      radiusM: 9,
      shape: "circle",
    })),
    {
      centerWorldM: [412.76297902391525, -254.22104062885046],
      id: "protected-parliament-of-trees",
      maxYM: 20,
      minYM: -6,
      name: "Parlament der Bäume gegen Krieg und Gewalt",
      rotationY: 0,
      shape: "box",
      sizeM: [61, 76],
    },
    {
      centerWorldM: [40.64670310379006, 660.0102302879095],
      id: "protected-rainbow-memorial",
      maxYM: 32,
      minYM: -6,
      name: "Queer Rainbow Memorial Berlin",
      radiusM: 9,
      shape: "circle",
    },
    {
      centerWorldM: [829.8579813517281, 1426.930023255758],
      id: "protected-topography-of-terror",
      maxYM: 30,
      minYM: -12,
      name: "Topographie des Terrors",
      rotationY: -0.01,
      shape: "box",
      sizeM: [174, 112],
    },
    {
      id: "protected-moabit-prison-memorial-park",
      maxYM: 20,
      minYM: -8,
      name: "Geschichtspark Ehemaliges Zellengefängnis Moabit",
      ringWorldM: MOABIT_PRISON_PARK_PROFILE.parkRingWorldM,
      shape: "polygon",
    },
    {
      centerWorldM: [-2063.32, 668.98],
      id: "protected-karl-liebknecht-memorial",
      maxYM: 18,
      minYM: -6,
      name: "Karl-Liebknecht-Denkmal am Neuen See",
      radiusM: 10,
      shape: "circle",
    },
    {
      centerWorldM: [-1930.77, 1065.34],
      id: "protected-rosa-luxemburg-memorial",
      maxYM: 18,
      minYM: -6,
      name: "Rosa-Luxemburg-Denkmal am Neuen See",
      radiusM: 10,
      shape: "circle",
    },
  ] as const;

function pointInRing(
  x: number,
  z: number,
  ring: ReadonlyArray<WorldPoint2>,
): boolean {
  let inside = false;
  for (
    let current = 0, previous = ring.length - 1;
    current < ring.length;
    previous = current, current += 1
  ) {
    const [currentX, currentZ] = ring[current];
    const [previousX, previousZ] = ring[previous];
    const crosses =
      currentZ > z !== previousZ > z &&
      x <
        ((previousX - currentX) * (z - currentZ)) / (previousZ - currentZ) +
          currentX;
    if (crosses) inside = !inside;
  }
  return inside;
}

function worldToVolumeLocal(
  volume: Pick<SchwellenraumAccessibleVolume, "centerWorldM" | "rotationY">,
  x: number,
  z: number,
): [number, number] {
  const dx = x - volume.centerWorldM[0];
  const dz = z - volume.centerWorldM[2];
  const cosine = Math.cos(volume.rotationY);
  const sine = Math.sin(volume.rotationY);
  return [cosine * dx - sine * dz, sine * dx + cosine * dz];
}

export function schwellenraumAccessibleVolumeAt(
  x: number,
  y: number,
  z: number,
): SchwellenraumAccessibleVolume | null {
  for (const volume of SCHWELLENRAUM_ACCESSIBLE_VOLUMES) {
    const [localX, localZ] = worldToVolumeLocal(volume, x, z);
    if (
      Math.abs(localX) <= volume.sizeM[0] / 2 &&
      Math.abs(y - volume.centerWorldM[1]) <= volume.sizeM[1] / 2 &&
      Math.abs(localZ) <= volume.sizeM[2] / 2
    ) {
      return volume;
    }
  }
  return null;
}

/** True only inside one of the explicit building-opening contracts. */
export function schwellenraumInteriorAt(
  x: number,
  y: number,
  z: number,
): boolean {
  return schwellenraumAccessibleVolumeAt(x, y, z) !== null;
}

function squaredDistanceToSegment3(
  x: number,
  y: number,
  z: number,
  from: WorldPoint3,
  to: WorldPoint3,
): number {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  const progress =
    lengthSquared < 1e-12
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((x - from[0]) * dx + (y - from[1]) * dy + (z - from[2]) * dz) /
              lengthSquared,
          ),
        );
  return (
    (x - (from[0] + dx * progress)) ** 2 +
    (y - (from[1] + dy * progress)) ** 2 +
    (z - (from[2] + dz * progress)) ** 2
  );
}

/** Collision test for mode-authored walls, jambs, rails and furnishings. */
export function schwellenraumInteriorSolidAt(
  x: number,
  y: number,
  z: number,
  radiusM = 0,
): boolean {
  const padding = Math.max(0, radiusM);
  for (const solid of SCHWELLENRAUM_INTERIOR_SOLIDS) {
    if (solid.shape === "segment") {
      if (
        squaredDistanceToSegment3(x, y, z, solid.fromWorldM, solid.toWorldM) <=
        (solid.radiusM + padding) ** 2
      ) {
        return true;
      }
      continue;
    }
    if (solid.shape === "ring") {
      const distance = Math.hypot(
        x - solid.centerWorldM[0],
        z - solid.centerWorldM[2],
      );
      if (
        Math.abs(y - solid.centerWorldM[1]) <= solid.halfHeightM + padding &&
        distance >= Math.max(0, solid.innerRadiusM - padding) &&
        distance <= solid.outerRadiusM + padding
      ) {
        return true;
      }
      continue;
    }
    const [localX, localZ] = worldToVolumeLocal(solid, x, z);
    if (
      Math.abs(localX) <= solid.sizeM[0] / 2 + padding &&
      Math.abs(y - solid.centerWorldM[1]) <= solid.sizeM[1] / 2 + padding &&
      Math.abs(localZ) <= solid.sizeM[2] / 2 + padding
    ) {
      return true;
    }
  }
  return false;
}

export function schwellenraumProtectedVolumeAt(
  x: number,
  y: number,
  z: number,
): SchwellenraumProtectedVolume | null {
  for (const volume of SCHWELLENRAUM_PROTECTED_VOLUMES) {
    if (y < volume.minYM || y > volume.maxYM) continue;
    if (volume.shape === "circle") {
      if (
        Math.hypot(x - volume.centerWorldM[0], z - volume.centerWorldM[1]) <=
        volume.radiusM
      ) {
        return volume;
      }
      continue;
    }
    if (volume.shape === "polygon") {
      if (pointInRing(x, z, volume.ringWorldM)) return volume;
      continue;
    }
    const dx = x - volume.centerWorldM[0];
    const dz = z - volume.centerWorldM[1];
    const cosine = Math.cos(volume.rotationY);
    const sine = Math.sin(volume.rotationY);
    const localX = cosine * dx - sine * dz;
    const localZ = sine * dx + cosine * dz;
    if (
      Math.abs(localX) <= volume.sizeM[0] / 2 &&
      Math.abs(localZ) <= volume.sizeM[1] / 2
    ) {
      return volume;
    }
  }
  return null;
}

export function schwellenraumProtectedAt(
  x: number,
  y: number,
  z: number,
): boolean {
  return schwellenraumProtectedVolumeAt(x, y, z) !== null;
}

/**
 * Combined LoD2-opening hook. Memorial protection always wins; an optional
 * source id narrows surveyed landmark shells further where exact ids exist.
 */
export function schwellenraumNavigationOverrideAt(
  x: number,
  y: number,
  z: number,
  obstacleId?: string,
): boolean {
  if (schwellenraumProtectedAt(x, y, z)) return false;
  const volume = schwellenraumAccessibleVolumeAt(x, y, z);
  if (!volume) return false;
  return (
    obstacleId === undefined ||
    volume.sourceBuildingIds === undefined ||
    volume.sourceBuildingIds.includes(obstacleId)
  );
}

/**
 * Resolve the authored floor under a visitor. This is optional for flight but
 * lets pedestrian navigation follow the same ramps and cellar descents.
 */
export function schwellenraumWalkSurfaceYAt(
  x: number,
  yHint: number,
  z: number,
): number | null {
  const candidates = SCHWELLENRAUM_ACCESSIBLE_VOLUMES.flatMap((volume) => {
    const [localX, localZ] = worldToVolumeLocal(volume, x, z);
    if (
      Math.abs(localX) > volume.sizeM[0] / 2 ||
      Math.abs(localZ) > volume.sizeM[2] / 2
    ) {
      return [];
    }
    if (volume.floor.kind === "flat") return [volume.floor.yM];
    const along = volume.floor.axis === "local-x" ? localX : localZ;
    const denominator = volume.floor.toM - volume.floor.fromM;
    const progress =
      Math.abs(denominator) < 1e-9
        ? 0
        : Math.max(0, Math.min(1, (along - volume.floor.fromM) / denominator));
    return [
      volume.floor.fromYM +
        (volume.floor.toYM - volume.floor.fromYM) * progress,
    ];
  });
  return candidates.reduce<number | null>((nearest, candidate) => {
    if (nearest === null) return candidate;
    return Math.abs(candidate - yHint) < Math.abs(nearest - yHint)
      ? candidate
      : nearest;
  }, null);
}

/** Name-compatible pedestrian hook with the current height as a hint. */
export function schwellenraumInteriorGroundAt(
  x: number,
  z: number,
  currentY = 0,
): number | null {
  return schwellenraumWalkSurfaceYAt(x, currentY, z);
}

function solidBox(
  parent: Group,
  name: string,
  size: WorldPoint3,
  position: WorldPoint3,
  material: MeshStandardMaterial | MeshPhysicalMaterial,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.schwellenraumSolid = true;
  parent.add(mesh);
  return mesh;
}

function addPortalFrame(
  parent: Group,
  name: string,
  position: WorldPoint3,
  openingWidth: number,
  openingHeight: number,
  axis: "x" | "z",
  material: MeshStandardMaterial,
  outward: -1 | 1 = 1,
  maskOpacity = 0.72,
): Group {
  const frame = new Group();
  frame.name = name;
  frame.position.set(...position);
  const jambSize: WorldPoint3 =
    axis === "x" ? [0.65, openingHeight, 0.5] : [0.5, openingHeight, 0.65];
  const halfOpening = openingWidth / 2;
  for (const side of [-1, 1]) {
    const jambPosition: WorldPoint3 =
      axis === "x"
        ? [0, 0, side * (halfOpening + 0.25)]
        : [side * (halfOpening + 0.25), 0, 0];
    solidBox(frame, `${name} side ${side}`, jambSize, jambPosition, material);
  }
  solidBox(
    frame,
    `${name} lintel`,
    axis === "x"
      ? [0.65, 0.6, openingWidth + 1]
      : [openingWidth + 1, 0.6, 0.65],
    [0, openingHeight / 2, 0],
    material,
  );
  if (maskOpacity > 0) {
    const mask = new Mesh(
      new PlaneGeometry(openingWidth, openingHeight),
      new MeshStandardMaterial({
        color: 0x25373b,
        depthTest: false,
        depthWrite: false,
        emissive: 0x1b3338,
        emissiveIntensity: 0.42,
        opacity: maskOpacity,
        roughness: 0.58,
        side: FrontSide,
        transparent: true,
      }),
    );
    mask.name = `${name} outward visual opening mask`;
    if (axis === "x") {
      mask.rotation.y = outward * (Math.PI / 2);
    } else if (outward < 0) {
      mask.rotation.y = Math.PI;
    }
    mask.renderOrder = 30;
    mask.userData.schwellenraumPortalMask = true;
    mask.userData.schwellenraumSolid = false;
    frame.add(mask);
    frame.userData.visualOpeningMaskCount = 1;
  } else {
    frame.userData.visualOpeningMaskCount = 0;
  }
  frame.userData.openingWidthM = openingWidth;
  frame.userData.openingHeightM = openingHeight;
  parent.add(frame);
  return frame;
}

function addStair(
  parent: Group,
  name: string,
  from: WorldPoint3,
  to: WorldPoint3,
  width: number,
  count: number,
  axis: "x" | "z",
  material: MeshStandardMaterial,
): void {
  for (let index = 0; index < count; index += 1) {
    const progress = (index + 0.5) / count;
    const nextProgress = (index + 1) / count;
    const x = from[0] + (to[0] - from[0]) * progress;
    const z = from[2] + (to[2] - from[2]) * progress;
    const topY = from[1] + (to[1] - from[1]) * nextProgress;
    const baseY = Math.min(from[1], to[1]) - 0.2;
    const run = Math.hypot(to[0] - from[0], to[2] - from[2]) / count + 0.08;
    solidBox(
      parent,
      `${name} step ${index + 1}`,
      axis === "x" ? [run, topY - baseY, width] : [width, topY - baseY, run],
      [x, baseY + (topY - baseY) / 2, z],
      material,
    );
  }
}

function addRamp(
  parent: Group,
  name: string,
  from: WorldPoint3,
  to: WorldPoint3,
  width: number,
  axis: "x" | "z",
  material: MeshStandardMaterial,
): Mesh {
  const run = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const rise = to[1] - from[1];
  const ramp = solidBox(
    parent,
    name,
    axis === "x" ? [run, 0.32, width] : [width, 0.32, run],
    [
      (from[0] + to[0]) / 2,
      (from[1] + to[1]) / 2 - 0.16,
      (from[2] + to[2]) / 2,
    ],
    material,
  );
  if (axis === "x") ramp.rotation.z = Math.atan2(rise, run);
  else ramp.rotation.x = -Math.atan2(rise, run);
  return ramp;
}

function createSite(
  name: string,
  site: { anchor: WorldPoint3; rotationY: number },
): Group {
  const group = new Group();
  group.name = name;
  group.position.set(...site.anchor);
  group.rotation.y = site.rotationY;
  group.userData.geometryStatus = PRESENTATION_GEOMETRY_STATUS;
  return group;
}

function createReichstagInterior(
  stone: MeshStandardMaterial,
  glow: MeshStandardMaterial,
  blue: MeshStandardMaterial,
): Group {
  const site = createSite("Schwellenraum Reichstag interior", REICHSTAG);
  addStair(
    site,
    "Reichstag west threshold",
    [-68, 0.15, 0],
    [-49, 4, 0],
    12,
    11,
    "x",
    stone,
  );
  addPortalFrame(
    site,
    "Reichstag open west portal",
    [-49.2, 8.5, 0],
    10,
    9,
    "x",
    glow,
    -1,
    0.86,
  );
  solidBox(
    site,
    "Reichstag plenary approach floor",
    [43, 0.34, 12],
    [-27, 3.83, 0],
    stone,
  );
  for (const z of [-6.15, 6.15]) {
    solidBox(
      site,
      "Reichstag plenary approach light wall",
      [43, 4.4, 0.18],
      [-27, 6.1, z],
      glow,
    );
  }
  solidBox(
    site,
    "Reichstag plenary chamber floor",
    [52, 0.38, 56],
    [8, 3.81, 0],
    stone,
  );
  for (let tier = 0; tier < 7; tier += 1) {
    const seats = new Mesh(
      new TorusGeometry(9 + tier * 2.6, 0.38, 6, 58, Math.PI * 1.62),
      blue,
    );
    seats.name = `Reichstag plenary seating arc ${tier + 1}`;
    seats.rotation.x = Math.PI / 2;
    seats.rotation.z = Math.PI * 0.69;
    seats.position.set(8, 4.35 + tier * 0.28, 2);
    seats.userData.schwellenraumSolid = true;
    site.add(seats);
  }
  solidBox(
    site,
    "Reichstag plenary lectern",
    [4.8, 1.25, 2.2],
    [22, 4.55, 0],
    glow,
  );
  solidBox(
    site,
    "Reichstag plenary presidium",
    [2.8, 1.7, 16],
    [25.5, 4.75, 0],
    stone,
  );
  return site;
}

function createHauptbahnhofInterior(
  stone: MeshStandardMaterial,
  glass: MeshPhysicalMaterial,
  glow: MeshStandardMaterial,
): Group {
  const site = createSite("Schwellenraum Hauptbahnhof interior", HAUPTBAHNHOF);
  for (const direction of [-1, 1] as const) {
    addPortalFrame(
      site,
      `Hauptbahnhof open hall portal ${direction}`,
      [0, 4.5, direction * 88.5],
      20,
      9,
      "z",
      glow,
      direction,
      0.1,
    );
  }
  for (const x of [-15.5, 15.5]) {
    solidBox(
      site,
      "Hauptbahnhof concourse side floor",
      [9, 0.3, 150],
      [x, 0, 0],
      stone,
    );
    solidBox(
      site,
      "Hauptbahnhof floating glass guide wall",
      [0.16, 4.5, 144],
      [x * 0.68, 2.3, 0],
      glass,
    );
  }
  for (const x of [-12, 12]) {
    for (const direction of [-1, 1]) {
      const from: WorldPoint3 = [x, 0.05, direction * 34];
      const to: WorldPoint3 = [x, -14.45, 0];
      addRamp(
        site,
        `Hauptbahnhof deep escalator ${x}:${direction}`,
        from,
        to,
        4.2,
        "z",
        stone,
      );
      for (const railSide of [-1, 1]) {
        const rail = addRamp(
          site,
          `Hauptbahnhof deep escalator luminous rail ${x}:${direction}:${railSide}`,
          [from[0] + railSide * 2.1, from[1] + 1.1, from[2]],
          [to[0] + railSide * 2.1, to[1] + 1.1, to[2]],
          0.16,
          "z",
          glow,
        );
        rail.userData.schwellenraumSolid = true;
      }
    }
  }
  for (const y of [-10.1, -5.2, -0.3, 4.6]) {
    const ring = new Mesh(new RingGeometry(11.5, 12.15, 64), glass);
    ring.name = `Hauptbahnhof daylight well ring ${y}`;
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = y;
    ring.userData.schwellenraumSolid = true;
    site.add(ring);
  }
  return site;
}

function createChancelleryInterior(
  stone: MeshStandardMaterial,
  glass: MeshPhysicalMaterial,
  glow: MeshStandardMaterial,
): Group {
  const site = createSite("Schwellenraum Chancellery interior", CHANCELLERY);
  addRamp(
    site,
    "Chancellery open approach ramp",
    [114, 0.15, 0],
    [92, 1.2, 0],
    11,
    "x",
    stone,
  );
  addPortalFrame(
    site,
    "Chancellery open leadership portal",
    [93.5, 6.8, 0],
    11,
    11.2,
    "x",
    glow,
    1,
    0.78,
  );
  solidBox(
    site,
    "Chancellery leadership hall floor",
    [50, 0.35, 48],
    [66.4, 1.03, 0],
    stone,
  );
  for (const z of [-21, 21]) {
    solidBox(
      site,
      "Chancellery leadership hall translucent wall",
      [47, 18, 0.18],
      [66.4, 10.2, z],
      glass,
    );
  }
  for (const x of [45, 55.5, 66, 76.5, 87]) {
    addPortalFrame(
      site,
      "Chancellery leadership hall light gate",
      [x, 7.8, 0],
      14,
      12,
      "x",
      glow,
      1,
      0.1,
    );
  }
  return site;
}

function createPotsdamerInterior(
  stone: MeshStandardMaterial,
  glass: MeshPhysicalMaterial,
  glow: MeshStandardMaterial,
): Group {
  const site = createSite("Schwellenraum Potsdamer Platz cellar", POTSDAMER);
  addStair(
    site,
    "Potsdamer north descent",
    [-1.8, 0, -70],
    [-1.8, -9, -30],
    16,
    24,
    "z",
    stone,
  );
  addStair(
    site,
    "Potsdamer south descent",
    [0.8, 0, 50],
    [0.8, -9, 10],
    16,
    24,
    "z",
    stone,
  );
  for (const z of [-69, 49]) {
    addPortalFrame(
      site,
      `Potsdamer open station gate ${z}`,
      [z < 0 ? -1.8 : 0.8, 4.7, z],
      15,
      9.4,
      "z",
      glow,
      z < 0 ? -1 : 1,
      0.12,
    );
  }
  solidBox(
    site,
    "Potsdamer cellar concourse floor",
    [92, 0.42, 110],
    [0, -9.2, 0],
    stone,
  );
  for (const x of [-39, -19.5, 0, 19.5, 39]) {
    addPortalFrame(
      site,
      `Potsdamer cellar open bay ${x}`,
      [x, -4.2, 0],
      13,
      9.4,
      "z",
      glow,
      1,
      0.08,
    );
  }
  for (const z of [-45, 45]) {
    solidBox(
      site,
      "Potsdamer cellar opaline end wall",
      [90, 8.5, 0.16],
      [0, -4.8, z],
      glass,
    );
  }
  return site;
}

function createChariteInterior(
  stone: MeshStandardMaterial,
  glass: MeshPhysicalMaterial,
  glow: MeshStandardMaterial,
): Group {
  const site = createSite("Schwellenraum Charite interior", CHARITE);
  addRamp(
    site,
    "Charite open entrance ramp",
    [0, 0, -27],
    [0, 0.55, -8],
    10,
    "z",
    stone,
  );
  addPortalFrame(
    site,
    "Charite open entrance gate",
    [0, 5.2, -8],
    10,
    9.3,
    "z",
    glow,
    -1,
    0.8,
  );
  solidBox(
    site,
    "Charite entrance corridor floor",
    [12, 0.32, 34],
    [0, 0.39, 8],
    stone,
  );
  for (const z of [-1, 7, 15, 23]) {
    addPortalFrame(
      site,
      `Charite open corridor doorway ${z}`,
      [0, 4.55, z],
      7,
      8,
      "z",
      glow,
      1,
      0,
    );
  }
  for (const x of [-6, 6]) {
    solidBox(
      site,
      "Charite translucent corridor wall",
      [0.16, 7.8, 33],
      [x, 4.45, 8],
      glass,
    );
  }
  return site;
}

/**
 * Build only mode-specific thresholds. The group starts hidden so adding it to
 * the standard world cannot alter that mode before presentation is selected.
 */
export function createSchwellenraumInteriors(): Group {
  const stone = new MeshStandardMaterial({
    color: 0xc9d0cb,
    emissive: 0x1a2027,
    emissiveIntensity: 0.18,
    metalness: 0.05,
    roughness: 0.78,
  });
  const glow = new MeshStandardMaterial({
    color: 0xe1ddc3,
    emissive: 0x9cb9b4,
    emissiveIntensity: 0.76,
    metalness: 0.08,
    roughness: 0.4,
  });
  const blue = new MeshStandardMaterial({
    color: 0x758a98,
    emissive: 0x293947,
    emissiveIntensity: 0.34,
    roughness: 0.72,
  });
  const glass = new MeshPhysicalMaterial({
    color: 0xabc7c2,
    depthWrite: false,
    metalness: 0.03,
    opacity: 0.24,
    roughness: 0.18,
    side: DoubleSide,
    transparent: true,
    transmission: 0.38,
  });
  const root = new Group();
  root.name = "Schwellenraum accessible architecture";
  root.visible = false;
  root.add(
    createReichstagInterior(stone, glow, blue),
    createHauptbahnhofInterior(stone, glass, glow),
    createChancelleryInterior(stone, glass, glow),
    createPotsdamerInterior(stone, glass, glow),
    createChariteInterior(stone, glass, glow),
  );
  root.userData.accessibleVolumeIds = SCHWELLENRAUM_ACCESSIBLE_VOLUMES.map(
    ({ id }) => id,
  );
  root.userData.geometryStatus = PRESENTATION_GEOMETRY_STATUS;
  root.userData.presentationEnabled = false;
  root.userData.protectedPolicy = {
    geometry: "inherit unchanged from the standard presentation",
    navigation: "no access override and no mode portal",
    protectedVolumeCount: SCHWELLENRAUM_PROTECTED_VOLUMES.length,
  };
  return root;
}

export function setSchwellenraumInteriorsPresentation(
  root: Group,
  enabled: boolean,
): void {
  root.visible = enabled;
  root.userData.presentationEnabled = enabled;
}
