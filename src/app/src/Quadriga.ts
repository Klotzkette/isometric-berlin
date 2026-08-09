/**
 * Johann Gottfried Schadow's Quadriga on the Brandenburg Gate, built at
 * the finest granularity anything in this drawing gets: four horses with
 * modelled heads down to the nostrils, a Greek chariot on spoked wheels,
 * Victoria with her wings and draped robe, and Schinkel's 1814 standard —
 * oak wreath, Iron Cross, Prussian eagle.
 *
 * ## Frame
 *
 * Local coordinates, so the caller places the group without touching any
 * dimension in here:
 *
 *   - origin at the centre of the chariot's axle line,
 *   - `y = 0` at the plinth the team stands on (the gate's attic top),
 *   - the team drives toward **+X**, horses abreast along **Z**.
 *
 * ## Accuracy
 *
 * The Iron Cross outline is exact and pinned by test — a cross pattée is
 * a defined figure, so it is generated from ratios in `quadrigaProfile.ts`
 * rather than faked with two crossed boxes. Everything else is
 * reference-derived presentation geometry at documented overall
 * dimensions (about 6 m high, about 6 m long, horses over life size), and
 * says so in `userData.geometryStatus`. Nothing here is claimed as
 * surveyed measurement.
 *
 * ## Modes
 *
 * One geometry, three vertex-colour buffers: `day`, `night` and `winter`.
 * Day is flat unlit bronze paint, matching the drawn city's convention;
 * night is cool patina under the gate's warm floodlighting; winter cools
 * the bronze and switches on a separate cap mesh so snow lies on the
 * upward faces only. Wind is prepared too: the mane, tail and robe are
 * their own meshes with their pivots at the attachment, so a wind system
 * can rotate them without touching the static body.
 */

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  TorusGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { ironCrossOutline, oakWreathLeaves } from "./quadrigaProfile";

export const QUADRIGA_GEOMETRY_STATUS =
  "Reference-derived presentation geometry at the documented overall dimensions of Schadow's Quadriga (about 6 m high, about 6 m long, over-life-size horses); the Iron Cross outline is an exact cross pattée from pinned ratios. No part of this is surveyed measurement.";

export type QuadrigaMode = "day" | "night" | "winter";

export type QuadrigaPalette = {
  /** Main bronze body of horses, chariot and figure. */
  bronze: number;
  /** Upward faces, catching more light than the flanks. */
  bronzeLit: number;
  /** Undersides and the inside of the chariot. */
  bronzeShadow: number;
  /** Green oxidation in the sheltered folds. */
  patina: number;
  /** Straps, bits, reins, tyres — worn smooth, so darker and harder. */
  harness: number;
  hoof: number;
  eye: number;
  mane: number;
  tail: number;
  robe: number;
  robeFold: number;
  wingUpper: number;
  wingLower: number;
  wreath: number;
  crossIron: number;
  crossRim: number;
  eagle: number;
  /** Snow lying on upward faces. Only used by the winter cap mesh. */
  snow: number;
  snowShadow: number;
  /** Ink for the drawn contour lines. */
  ink: number;
};

/**
 * The Quadriga is bronze. In daylight it reads as a mid-dark warm metal
 * with green oxidation in the folds — dark enough to stand off the pale
 * sandstone attic, light enough not to become a silhouette. The Iron
 * Cross and the wreath stay inside the bronze family (they are cast in
 * the same metal) but each takes its own tonal step, so the emblem still
 * reads as an emblem at distance instead of dissolving into the staff.
 *
 * `QUADRIGA_HISTORIC_CROSS` offers the heraldic black-and-silver reading
 * for anyone who wants the cross to answer its own colours instead; it is
 * deliberately NOT the default, because the sculpture on the gate is one
 * material throughout.
 */
export const QUADRIGA_PALETTES: Record<QuadrigaMode, QuadrigaPalette> = {
  day: {
    bronze: 0x8eaa95,
    bronzeLit: 0xb0c3b2,
    bronzeShadow: 0x6a8573,
    patina: 0x95b19b,
    harness: 0x5d7768,
    hoof: 0x4b6356,
    eye: 0x2f2b25,
    mane: 0x708a78,
    tail: 0x698270,
    robe: 0x98ad99,
    robeFold: 0x758d7a,
    wingUpper: 0xa3b6a4,
    wingLower: 0x7c9481,
    wreath: 0x8da681,
    crossIron: 0x534d43,
    crossRim: 0xb9c5b3,
    eagle: 0x98ab99,
    snow: 0xf2f5f7,
    snowShadow: 0xdbe2e8,
    ink: 0x4f5f54,
  },
  night: {
    bronze: 0x2f3542,
    bronzeLit: 0x6b5a3f,
    bronzeShadow: 0x232936,
    patina: 0x2c3a3a,
    harness: 0x232833,
    hoof: 0x1c202a,
    eye: 0x14171e,
    mane: 0x2a3040,
    tail: 0x282e3d,
    robe: 0x7d6540,
    robeFold: 0x4a3f2c,
    wingUpper: 0x8a6f45,
    wingLower: 0x39404c,
    wreath: 0x3a4038,
    crossIron: 0x1b1f27,
    crossRim: 0x7d6c4c,
    eagle: 0x6f5c3b,
    snow: 0x9fb0c2,
    snowShadow: 0x63748a,
    ink: 0x8ea3bd,
  },
  winter: {
    bronze: 0x646b70,
    bronzeLit: 0x767d82,
    bronzeShadow: 0x515760,
    patina: 0x64726b,
    harness: 0x4b515a,
    hoof: 0x3d434b,
    eye: 0x272c33,
    mane: 0x5a6167,
    tail: 0x565d63,
    robe: 0x757c82,
    robeFold: 0x5f666d,
    wingUpper: 0x798086,
    wingLower: 0x666d74,
    wreath: 0x66705f,
    crossIron: 0x454b53,
    crossRim: 0x8d949b,
    eagle: 0x6d747a,
    snow: 0xf4f7fa,
    snowShadow: 0xd9e2ea,
    ink: 0x6b727a,
  },
};

/** Heraldic reading of the cross, if the emblem should answer in its own colours. */
export const QUADRIGA_HISTORIC_CROSS = {
  crossIron: 0x1d1d1c,
  crossRim: 0xd8d8d2,
} as const;

/**
 * Overall dimensions the model is laid out to, in metres. Documented
 * figures for the group, not a survey: the Quadriga is about six metres
 * high and about six metres long, with over-life-size horses.
 */
export const QUADRIGA_DIMENSIONS = {
  /**
   * The model's own plinth-to-eagle height. Callers scale by this, so it
   * has to be what the geometry actually measures, not the rounded
   * reference: the documented figure for the sculpture is "about six
   * metres", and scaling by 6.0 left the eagle 18 cm over the gate's
   * published total height.
   */
  totalHeight: 6.19,
  /** Chariot tail to the horses' noses. */
  totalLength: 6.0,
  /** Outer flank to outer flank across the four-horse team. */
  totalWidth: 4.14,
  wheelRadius: 0.92,
  chariotFloorY: 1.06,
  horseWithersY: 2.6,
  victoriaHeadY: 4.58,
  ironCrossSpan: 0.86,
  horseCount: 4,
  /** Centre-to-centre spacing of the four horses across the team. */
  horseSpacingZ: 1.12,
} as const;

// --- builder -----------------------------------------------------------

type Slot = "body" | "mane" | "tail" | "robe" | "snow";

type Builder = {
  edges: BufferGeometry[];
  /** Day / night / winter colour per pushed geometry, kept in step. */
  parts: Array<{ colours: [number, number, number]; geometry: BufferGeometry; slot: Slot }>;
};

function createBuilder(): Builder {
  return { edges: [], parts: [] };
}

type Placement = {
  rotation?: [number, number, number];
  /** Which sub-mesh the part belongs to; body is the static merge. */
  slot?: Slot;
  /** Draw a contour line around this part. */
  inked?: boolean;
};

/**
 * Push a geometry with its per-mode colours. Colours are chosen by NAME
 * from the palette so all three modes stay in step: a part can never end
 * up bronze by day and snow-white at night by accident.
 */
function push(
  builder: Builder,
  geometry: BufferGeometry,
  tone: keyof QuadrigaPalette,
  position: [number, number, number],
  placement: Placement = {},
): void {
  geometry.deleteAttribute("uv");
  if (placement.rotation) {
    geometry.applyMatrix4(
      new Matrix4().makeRotationFromEuler(new Euler(...placement.rotation)),
    );
  }
  geometry.translate(...position);
  // Box/cylinder geometries are indexed, icosahedra and extrusions are
  // not, and mergeGeometries refuses a mixture. Everything is normalised
  // to non-indexed here so a new primitive can never silently drop the
  // whole merge — which is exactly what an ExtrudeGeometry did the first
  // time the Iron Cross was added.
  const flattened = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flattened !== geometry) {
    geometry.dispose();
  }
  builder.parts.push({
    colours: [
      QUADRIGA_PALETTES.day[tone] as number,
      QUADRIGA_PALETTES.night[tone] as number,
      QUADRIGA_PALETTES.winter[tone] as number,
    ],
    geometry: flattened,
    slot: placement.slot ?? "body",
  });
  if (placement.inked !== false) {
    builder.edges.push(new EdgesGeometry(flattened, 26));
  }
}

function box(
  builder: Builder,
  tone: keyof QuadrigaPalette,
  position: [number, number, number],
  size: [number, number, number],
  placement: Placement = {},
): void {
  push(builder, new BoxGeometry(...size), tone, position, placement);
}

function cylinder(
  builder: Builder,
  tone: keyof QuadrigaPalette,
  position: [number, number, number],
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  placement: Placement = {},
): void {
  push(
    builder,
    new CylinderGeometry(radiusTop, radiusBottom, height, segments),
    tone,
    position,
    placement,
  );
}

function blob(
  builder: Builder,
  tone: keyof QuadrigaPalette,
  position: [number, number, number],
  radius: number,
  scale: [number, number, number],
  placement: Placement = {},
): void {
  const geometry = new IcosahedronGeometry(radius, 1);
  geometry.scale(...scale);
  push(builder, geometry, tone, position, placement);
}

// --- the horses --------------------------------------------------------

/**
 * One horse of the team, built nose to tail. The head is where the
 * granularity has to live: at the zoom this model is meant for, a horse
 * without a modelled muzzle, nostrils, eyes and ears reads as a dog.
 *
 * `lane` runs −1.5 … +1.5 across the team; the outer pair turn their
 * heads slightly outward, which is how Schadow posed them.
 */
function buildHorse(builder: Builder, lane: number): void {
  const z = lane * QUADRIGA_DIMENSIONS.horseSpacingZ;
  // Outer horses turn out; inner horses look straight down the axis.
  const turn = (Math.abs(lane) > 1 ? Math.sign(lane) : 0) * 0.22;
  const inked = true;

  // Barrel, chest and croup. Three masses, not one box: a horse narrows
  // sharply behind the ribs and that taper is what reads as an animal.
  blob(builder, "bronze", [1.62, 2.02, z], 0.5, [1.45, 0.9, 0.78], { inked });
  blob(builder, "bronze", [2.42, 2.06, z], 0.42, [0.9, 0.95, 0.86], { inked });
  blob(builder, "bronzeShadow", [0.86, 2.0, z], 0.44, [1.0, 0.92, 0.8], { inked });

  // Neck: two tapered segments rising to the poll, so the arch is real.
  cylinder(builder, "bronze", [2.95, 2.42, z + turn * 0.18], 0.24, 0.36, 0.86, 10, {
    rotation: [0, 0, -0.62],
    inked,
  });
  cylinder(builder, "bronze", [3.32, 2.78, z + turn * 0.34], 0.19, 0.25, 0.52, 10, {
    rotation: [0, 0, -0.5],
    inked,
  });

  const headX = 3.62;
  const headY = 2.94;
  const headZ = z + turn * 0.5;
  // Skull, then the long face, then the muzzle — three tapering masses.
  blob(builder, "bronze", [headX, headY, headZ], 0.2, [1.1, 1.0, 0.86], { inked });
  blob(builder, "bronze", [headX + 0.27, headY - 0.12, headZ], 0.15, [1.3, 0.9, 0.8], {
    inked,
  });
  const muzzleX = headX + 0.5;
  const muzzleY = headY - 0.2;
  blob(builder, "bronze", [muzzleX, muzzleY, headZ], 0.115, [1.0, 0.95, 0.95], {
    inked,
  });
  // NOSTRILS — the detail the whole close-up hangs on. Two flared pits in
  // the muzzle front, set apart and angled outward like the real thing.
  for (const side of [-1, 1]) {
    blob(
      builder,
      "eye",
      [muzzleX + 0.085, muzzleY + 0.015, headZ + side * 0.05],
      0.031,
      [0.85, 1.25, 1.0],
      { inked: false },
    );
  }
  // Mouth line, cut just under the muzzle.
  box(builder, "eye", [muzzleX + 0.05, muzzleY - 0.075, headZ], [0.11, 0.018, 0.13], {
    inked: false,
  });
  // Eyes, set wide on the skull where a horse actually carries them.
  for (const side of [-1, 1]) {
    blob(
      builder,
      "eye",
      [headX + 0.09, headY + 0.05, headZ + side * 0.155],
      0.043,
      [1.0, 1.1, 0.7],
      { inked: false },
    );
  }
  // Ears, pricked forward.
  for (const side of [-1, 1]) {
    push(
      builder,
      new CylinderGeometry(0.005, 0.052, 0.2, 6),
      "bronze",
      [headX - 0.1, headY + 0.24, headZ + side * 0.1],
      { rotation: [side * 0.3, 0, -0.24], inked },
    );
  }
  // Bridle: cheek strap and the noseband over the muzzle.
  box(builder, "harness", [headX + 0.16, headY - 0.06, headZ], [0.3, 0.035, 0.31], {
    inked: false,
  });
  box(builder, "harness", [headX + 0.02, headY + 0.02, headZ], [0.035, 0.3, 0.3], {
    inked: false,
  });

  // Mane: its own slot, so wind can lift it off the static body. Tufts
  // along the crest from poll to withers, shortening forward.
  for (let index = 0; index < 7; index += 1) {
    const t = index / 6;
    box(
      builder,
      "mane",
      [3.34 - t * 1.0, 2.78 - t * 0.12 + 0.16, z + turn * (0.34 - t * 0.3)],
      [0.14, 0.2 + t * 0.1, 0.1],
      { rotation: [0, 0, -0.35 + t * 0.2], slot: "mane", inked: false },
    );
  }
  // Forelock, falling between the ears.
  box(builder, "mane", [headX - 0.02, headY + 0.19, headZ], [0.12, 0.17, 0.13], {
    rotation: [0, 0, 0.3],
    slot: "mane",
    inked: false,
  });

  // Tail: dock plus three flowing lengths, in the wind slot.
  cylinder(builder, "tail", [0.42, 2.12, z], 0.08, 0.06, 0.3, 8, {
    rotation: [0, 0, 0.9],
    slot: "tail",
    inked: false,
  });
  for (let index = 0; index < 3; index += 1) {
    box(
      builder,
      "tail",
      [0.2 - index * 0.16, 1.86 - index * 0.34, z + (index % 2 === 0 ? 0.04 : -0.04)],
      [0.24, 0.42, 0.12],
      { rotation: [0, 0, 0.32 + index * 0.12], slot: "tail", inked: false },
    );
  }

  // Legs. Fore and hind, each shoulder → forearm → cannon → fetlock →
  // hoof, with the near pair stepping forward so the team reads as moving.
  const legs: Array<{ lead: number; x: number }> = [
    { lead: 0.16, x: 2.5 },
    { lead: -0.1, x: 0.94 },
  ];
  for (const { lead, x } of legs) {
    for (const side of [-1, 1]) {
      const legZ = z + side * 0.26;
      const stride = lead * side;
      cylinder(builder, "bronze", [x + stride * 0.4, 1.62, legZ], 0.15, 0.11, 0.72, 8, {
        rotation: [0, 0, -stride * 0.5],
        inked,
      });
      cylinder(
        builder,
        "bronze",
        [x + stride * 0.85, 1.0, legZ],
        0.09,
        0.07,
        0.58,
        8,
        { rotation: [0, 0, -stride * 0.75], inked },
      );
      cylinder(
        builder,
        "bronze",
        [x + stride * 1.15, 0.5, legZ],
        0.065,
        0.075,
        0.44,
        8,
        { rotation: [0, 0, -stride * 0.35], inked },
      );
      // Fetlock joint, then the hoof: a horse's foot is not a stick end.
      blob(builder, "bronze", [x + stride * 1.28, 0.24, legZ], 0.08, [1, 0.9, 1], {
        inked: false,
      });
      cylinder(builder, "hoof", [x + stride * 1.3, 0.09, legZ], 0.1, 0.115, 0.18, 8, {
        inked,
      });
    }
  }

  // Harness on the body: collar over the shoulders, girth round the barrel.
  push(
    builder,
    new TorusGeometry(0.4, 0.045, 6, 14),
    "harness",
    [2.62, 2.2, z],
    { rotation: [0, Math.PI / 2, 0.3], inked: false },
  );
  push(
    builder,
    new TorusGeometry(0.46, 0.035, 6, 14),
    "harness",
    [1.7, 2.0, z],
    { rotation: [0, Math.PI / 2, 0], inked: false },
  );
  // Rein from the bit back to the driver's hand.
  box(builder, "harness", [2.2, 2.55, z], [3.0, 0.03, 0.03], {
    rotation: [0, 0, 0.12],
    inked: false,
  });
}

// --- chariot -----------------------------------------------------------

function buildChariot(builder: Builder): void {
  const floorY = QUADRIGA_DIMENSIONS.chariotFloorY;
  // Floor and the curved front breastwork the driver stands behind.
  box(builder, "bronzeShadow", [-0.62, floorY, 0], [1.5, 0.12, 1.6]);
  box(builder, "bronze", [0.1, floorY + 0.52, 0], [0.16, 1.04, 1.62]);
  for (const side of [-1, 1]) {
    box(builder, "bronze", [-0.4, floorY + 0.4, side * 0.79], [1.2, 0.8, 0.14], {
      rotation: [0, 0, 0.06],
    });
  }
  // Relief band along the car side, the way the real chariot carries one.
  for (const side of [-1, 1]) {
    for (let index = 0; index < 4; index += 1) {
      box(
        builder,
        "patina",
        [-0.9 + index * 0.34, floorY + 0.52, side * 0.87],
        [0.2, 0.26, 0.03],
        { inked: false },
      );
    }
  }
  // Top rail, so the car reads as a vehicle from directly above.
  box(builder, "bronzeLit", [-0.4, floorY + 0.82, 0], [1.3, 0.08, 1.66]);

  // Axle and the two spoked wheels, set outboard of the body or they
  // never show at all.
  const wheelRadius = QUADRIGA_DIMENSIONS.wheelRadius;
  cylinder(builder, "harness", [-0.5, wheelRadius, 0], 0.07, 0.07, 2.1, 8, {
    rotation: [Math.PI / 2, 0, 0],
    inked: false,
  });
  for (const side of [-1, 1]) {
    const wheelZ = side * 1.02;
    push(
      builder,
      new TorusGeometry(wheelRadius, 0.075, 8, 26),
      "bronze",
      [-0.5, wheelRadius, wheelZ],
      { rotation: [Math.PI / 2, 0, 0] },
    );
    // Hub.
    cylinder(builder, "harness", [-0.5, wheelRadius, wheelZ], 0.13, 0.13, 0.24, 10, {
      rotation: [Math.PI / 2, 0, 0],
      inked: false,
    });
    // Eight spokes — a Greek racing wheel, not a disc.
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      box(
        builder,
        "bronze",
        [
          -0.5 + Math.cos(angle) * wheelRadius * 0.5,
          wheelRadius + Math.sin(angle) * wheelRadius * 0.5,
          wheelZ,
        ],
        [wheelRadius * 0.92, 0.05, 0.05],
        { rotation: [0, 0, angle], inked: false },
      );
    }
  }
  // Draught pole running forward under the team, and the yoke across it.
  box(builder, "bronze", [1.7, floorY - 0.16, 0], [3.6, 0.1, 0.12], {
    rotation: [0, 0, 0.03],
  });
  box(builder, "harness", [2.9, floorY + 0.02, 0], [0.12, 0.1, 2.1], {
    inked: false,
  });
}

// --- Victoria ----------------------------------------------------------

function buildVictoria(builder: Builder): void {
  const feetY = QUADRIGA_DIMENSIONS.chariotFloorY + 0.06;
  const x = -0.55;
  // Torso and hips.
  blob(builder, "robe", [x, feetY + 1.62, 0], 0.34, [0.82, 1.15, 0.72]);
  blob(builder, "robe", [x, feetY + 2.36, 0], 0.28, [0.9, 0.95, 0.8]);
  // Draped robe to the ankles, with vertical fold ridges. The folds are
  // their own slot: in wind they lift, the body does not.
  cylinder(builder, "robe", [x, feetY + 0.78, 0], 0.42, 0.56, 1.56, 12);
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * Math.PI * 2;
    box(
      builder,
      "robeFold",
      [
        x + Math.cos(angle) * 0.5,
        feetY + 0.72,
        Math.sin(angle) * 0.5,
      ],
      [0.09, 1.45, 0.09],
      { rotation: [0, -angle, 0.02], slot: "robe", inked: false },
    );
  }
  // Head with its bound hair and diadem.
  blob(builder, "robe", [x, feetY + 2.86, 0], 0.19, [0.9, 1.05, 0.88]);
  blob(builder, "mane", [x - 0.14, feetY + 2.95, 0], 0.13, [0.9, 0.85, 0.95], {
    inked: false,
  });
  push(
    builder,
    new TorusGeometry(0.17, 0.022, 6, 14),
    "wreath",
    [x, feetY + 2.94, 0],
    { rotation: [Math.PI / 2, 0, 0.12], inked: false },
  );
  // Arms: the right reaches forward to the standard, the left holds the reins.
  cylinder(builder, "robe", [x + 0.42, feetY + 2.1, -0.24], 0.085, 0.075, 1.0, 8, {
    rotation: [0, 0, -0.95],
  });
  cylinder(builder, "robe", [x + 0.3, feetY + 1.86, 0.3], 0.085, 0.075, 0.86, 8, {
    rotation: [0, 0, -0.5],
  });

  // Wings. Three feather courses each, stepping outward and back — the
  // silhouette that says "Victoria" from a kilometre away.
  for (const side of [-1, 1]) {
    const rows: Array<[number, number, number, number]> = [
      [-0.18, 2.5, 0.62, 1.15],
      [-0.42, 2.16, 0.86, 1.5],
      [-0.66, 1.78, 1.02, 1.75],
    ];
    rows.forEach(([dx, dy, dz, span], index) => {
      box(
        builder,
        index === 0 ? "wingUpper" : "wingLower",
        [x + dx, feetY + dy, side * dz],
        [0.7 + index * 0.2, 0.16, span],
        { rotation: [side * 0.24, 0, 0.16 + index * 0.1] },
      );
      // Feather separations, so the wing is not a slab.
      for (let feather = 0; feather < 5; feather += 1) {
        box(
          builder,
          "bronzeShadow",
          [
            x + dx - 0.2 + feather * 0.12,
            feetY + dy + 0.09,
            side * (dz + 0.1 + feather * 0.09),
          ],
          [0.5, 0.03, 0.06],
          { rotation: [side * 0.24, 0, 0.16], inked: false },
        );
      }
    });
  }
}

// --- the standard: staff, oak wreath, Iron Cross, eagle ----------------

function buildStandard(builder: Builder): void {
  const x = -0.13;
  const baseY = QUADRIGA_DIMENSIONS.chariotFloorY + 1.5;
  // The lance Victoria holds.
  cylinder(builder, "harness", [x, baseY + 1.2, -0.24], 0.045, 0.05, 2.6, 8, {
    inked: false,
  });

  const crossY = baseY + 2.42;
  const crossZ = -0.24;
  const span = QUADRIGA_DIMENSIONS.ironCrossSpan;

  // Oak wreath around the cross: a bound ring plus a real leaf at every
  // anchor, alternately tipped out of plane. A smooth torus alone reads
  // as a washer at this zoom.
  push(
    builder,
    new TorusGeometry(span * 0.66, 0.045, 8, 26),
    "wreath",
    [x, crossY, crossZ],
    { rotation: [0, Math.PI / 2, 0], inked: false },
  );
  for (const leaf of oakWreathLeaves(span * 0.66)) {
    box(
      builder,
      "wreath",
      [
        x,
        crossY + Math.sin(leaf.angle) * leaf.radius,
        crossZ + Math.cos(leaf.angle) * leaf.radius,
      ],
      [0.05, 0.15, 0.075],
      { rotation: [leaf.angle, leaf.tilt, 0], inked: false },
    );
  }

  // THE IRON CROSS. Extruded from the exact cross-pattée outline, with a
  // slightly larger, thinner plate behind it for the raised rim. This is
  // the one shape in the whole drawing that is generated from ratios
  // rather than judged by eye.
  const crossShape = new Shape();
  ironCrossOutline(span).forEach(([px, py], index) => {
    if (index === 0) {
      crossShape.moveTo(px, py);
    } else {
      crossShape.lineTo(px, py);
    }
  });
  const crossCore = new ExtrudeGeometry(crossShape, {
    bevelEnabled: false,
    depth: 0.075,
  });
  push(builder, crossCore, "crossIron", [x, crossY, crossZ], {
    rotation: [0, Math.PI / 2, 0],
  });
  const rimShape = new Shape();
  ironCrossOutline(span * 1.1).forEach(([px, py], index) => {
    if (index === 0) {
      rimShape.moveTo(px, py);
    } else {
      rimShape.lineTo(px, py);
    }
  });
  const crossRim = new ExtrudeGeometry(rimShape, {
    bevelEnabled: false,
    depth: 0.045,
  });
  push(builder, crossRim, "crossRim", [x, crossY, crossZ - 0.02], {
    rotation: [0, Math.PI / 2, 0],
  });

  // The Prussian eagle standing on the wreath.
  const eagleY = crossY + span * 0.78;
  blob(builder, "eagle", [x, eagleY + 0.2, crossZ], 0.15, [0.75, 1.25, 0.7]);
  blob(builder, "eagle", [x, eagleY + 0.46, crossZ], 0.085, [0.85, 0.95, 0.8], {
    inked: false,
  });
  // Beak.
  push(
    builder,
    new CylinderGeometry(0.004, 0.032, 0.11, 6),
    "eagle",
    [x + 0.09, eagleY + 0.46, crossZ],
    { rotation: [0, 0, -1.35], inked: false },
  );
  // Spread wings, three feather steps each.
  for (const side of [-1, 1]) {
    for (let index = 0; index < 3; index += 1) {
      box(
        builder,
        "eagle",
        [x, eagleY + 0.3 - index * 0.11, crossZ + side * (0.2 + index * 0.16)],
        [0.09, 0.19 - index * 0.03, 0.34],
        { rotation: [side * 0.22, 0, 0], inked: index === 0 },
      );
    }
  }
  // Tail fan.
  box(builder, "eagle", [x, eagleY - 0.02, crossZ], [0.08, 0.24, 0.2], {
    rotation: [0, 0, 0.2],
    inked: false,
  });
}

// --- snow --------------------------------------------------------------

/**
 * Snow caps for the winter mode. Only upward faces catch snow, so the
 * caps are placed by hand on the parts a real snowfall settles on: the
 * horses' croups and heads, the chariot rail, Victoria's shoulders and
 * the upper wing courses, the wreath's top arc and the cross's upper arms.
 */
function buildSnow(builder: Builder): void {
  const cap: Placement = { slot: "snow", inked: false };
  for (let lane = -1.5; lane <= 1.5; lane += 1) {
    const z = lane * QUADRIGA_DIMENSIONS.horseSpacingZ;
    box(builder, "snow", [1.62, 2.5, z], [1.35, 0.055, 0.66], cap);
    box(builder, "snow", [2.42, 2.52, z], [0.72, 0.05, 0.72], cap);
    box(builder, "snowShadow", [3.62, 3.16, z], [0.4, 0.045, 0.32], cap);
  }
  box(builder, "snow", [-0.4, QUADRIGA_DIMENSIONS.chariotFloorY + 0.88, 0], [1.3, 0.05, 1.66], cap);
  const feetY = QUADRIGA_DIMENSIONS.chariotFloorY + 0.06;
  box(builder, "snow", [-0.55, feetY + 2.66, 0], [0.5, 0.05, 0.5], cap);
  for (const side of [-1, 1]) {
    box(builder, "snowShadow", [-0.73, feetY + 2.6, side * 0.62], [0.72, 0.045, 1.1], cap);
  }
  const crossY = QUADRIGA_DIMENSIONS.chariotFloorY + 1.5 + 2.42;
  box(builder, "snow", [-0.13, crossY + QUADRIGA_DIMENSIONS.ironCrossSpan * 0.52, -0.24], [0.1, 0.04, 0.34], cap);
}

// --- assembly ----------------------------------------------------------

function mergeSlot(
  builder: Builder,
  slot: Slot,
): { colours: Float32Array[]; geometry: BufferGeometry } | null {
  const entries = builder.parts.filter((part) => part.slot === slot);
  if (entries.length === 0) {
    return null;
  }
  const merged = mergeGeometries(
    entries.map((entry) => entry.geometry),
    false,
  );
  if (!merged) {
    return null;
  }
  const total = merged.getAttribute("position").count;
  const colours = [0, 1, 2].map(() => new Float32Array(total * 3));
  let offset = 0;
  const paint = new Color();
  for (const entry of entries) {
    const count = entry.geometry.getAttribute("position").count;
    for (let mode = 0; mode < 3; mode += 1) {
      paint.setHex(entry.colours[mode]);
      for (let index = 0; index < count; index += 1) {
        colours[mode][(offset + index) * 3] = paint.r;
        colours[mode][(offset + index) * 3 + 1] = paint.g;
        colours[mode][(offset + index) * 3 + 2] = paint.b;
      }
    }
    offset += count;
  }
  merged.setAttribute("color", new Float32BufferAttribute(colours[0], 3));
  return { colours, geometry: merged };
}

const SLOT_MESH_NAME: Record<Slot, string> = {
  body: "Quadriga bodies",
  mane: "Quadriga manes",
  robe: "Quadriga robe folds",
  snow: "Quadriga snow caps",
  tail: "Quadriga tails",
};

/**
 * How far a wind system may swing each sway slot, and about which axis.
 * The pivot is the slot's own attachment, so a rotation looks like hair
 * lifting rather than a block sliding.
 */
export const QUADRIGA_WIND_SLOTS = {
  mane: { axis: "z" as const, maxDegrees: 11, pivot: [3.0, 2.7, 0] as const },
  robe: { axis: "z" as const, maxDegrees: 7, pivot: [-0.55, 2.3, 0] as const },
  tail: { axis: "z" as const, maxDegrees: 16, pivot: [0.42, 2.12, 0] as const },
} as const;

export type QuadrigaOptions = {
  mode?: QuadrigaMode;
};

/**
 * Build the Quadriga. The returned group carries one static body mesh,
 * three sway meshes (mane, tail, robe), a snow-cap mesh that is only
 * visible in winter, and the ink lines. Call `setQuadrigaMode` to switch
 * palettes; nothing is rebuilt.
 */
export function createQuadriga(options: QuadrigaOptions = {}): Group {
  const builder = createBuilder();
  for (let lane = -1.5; lane <= 1.5; lane += 1) {
    buildHorse(builder, lane);
  }
  buildChariot(builder);
  buildVictoria(builder);
  buildStandard(builder);
  buildSnow(builder);

  const group = new Group();
  group.name = "Quadriga mit Victoria";
  group.userData.geometryStatus = QUADRIGA_GEOMETRY_STATUS;
  group.userData.windSlots = QUADRIGA_WIND_SLOTS;

  for (const slot of ["body", "mane", "tail", "robe", "snow"] as Slot[]) {
    const merged = mergeSlot(builder, slot);
    if (!merged) {
      continue;
    }
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0.35,
      roughness: 0.6,
      vertexColors: true,
    });
    const mesh = new Mesh(merged.geometry, dayMaterial);
    mesh.name = SLOT_MESH_NAME[slot];
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.userData.modeColours = merged.colours;
    if (slot === "snow") {
      mesh.visible = false;
    }
    if (slot !== "body" && slot !== "snow") {
      mesh.userData.windSlot = slot;
    }
    group.add(mesh);
  }

  const ink = mergeGeometries(builder.edges, false);
  if (ink) {
    const lines = new LineSegments(
      ink,
      new LineBasicMaterial({ color: QUADRIGA_PALETTES.day.ink }),
    );
    lines.name = "Quadriga ink lines";
    lines.renderOrder = 2;
    group.add(lines);
  }
  for (const part of builder.parts) {
    part.geometry.dispose();
  }
  for (const edge of builder.edges) {
    edge.dispose();
  }

  setQuadrigaMode(group, options.mode ?? "day");
  return group;
}

/** Swap the whole group to a mode: colours, materials, snow visibility. */
export function setQuadrigaMode(group: Group, mode: QuadrigaMode): void {
  const index = mode === "day" ? 0 : mode === "night" ? 1 : 2;
  group.traverse((object) => {
    if (object instanceof Mesh && object.userData.modeColours) {
      const colours = object.userData.modeColours as Float32Array[];
      const attribute = object.geometry.getAttribute("color");
      (attribute.array as Float32Array).set(colours[index]);
      attribute.needsUpdate = true;
      object.material =
        mode === "night"
          ? (object.userData.nightMaterial as MeshStandardMaterial)
          : (object.userData.dayMaterial as MeshBasicMaterial);
      if (object.name === SLOT_MESH_NAME.snow) {
        object.visible = mode === "winter";
      }
    }
    if (object instanceof LineSegments) {
      (object.material as LineBasicMaterial).color.setHex(
        QUADRIGA_PALETTES[mode].ink,
      );
    }
  });
  group.userData.mode = mode;
}
