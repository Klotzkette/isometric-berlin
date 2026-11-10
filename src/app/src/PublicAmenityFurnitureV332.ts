/** Local centre offsets and dimensions in metres, followed by packed sRGB. */
export type AmenityBoxV332 = readonly [
  dx: number, dy: number, dz: number,
  width: number, height: number, depth: number, color: number,
];

type Profile = readonly AmenityBoxV332[];

function profile(boxes: AmenityBoxV332[]): Profile {
  return Object.freeze(boxes.map(box => Object.freeze(box)));
}

const EMPTY = profile([]);
const POST_YELLOW = 0xffc828;
const PIN_GREEN = 0x71ab47;
const STEEL = 0xaeb0a9;
const FRAME = 0x565952;
const DARK = 0x333733;
const PANEL = 0xd4d8cf;

// Recognition dimensions are estimated. The measured source supplies only the
// site point. The stand is the ordinary Deutsche Post street-box form; PIN's
// published street-box photo shows a green cabinet extending to the pavement.
const POST_DRAWN = profile([
  [0, 0.44, 0, 0.12, 0.88, 0.14, FRAME],
  [0, 0.045, 0, 0.29, 0.09, 0.26, FRAME],
  [0, 1.13, 0, 0.53, 0.57, 0.40, POST_YELLOW],
  [0, 1.413, 0, 0.55, 0.075, 0.43, POST_YELLOW],
  [0, 1.255, 0.206, 0.38, 0.052, 0.025, DARK],
  [0, 1.077, 0.209, 0.21, 0.11, 0.025, PANEL],
]);
const POST_NATIVE = profile([
  [0, 0.4375, 0, 0.125, 0.875, 0.125, FRAME],
  [0, 0.0625, 0, 0.25, 0.125, 0.25, FRAME],
  [0, 1.125, 0, 0.50, 0.625, 0.375, POST_YELLOW],
  [0, 1.4375, 0, 0.5625, 0.0625, 0.4375, POST_YELLOW],
  [0, 1.25, 0.20, 0.375, 0.0625, 0.03125, DARK],
  [0, 1.0625, 0.203, 0.25, 0.125, 0.03125, PANEL],
]);
const PIN_DRAWN = profile([
  [0, 0.04, 0, 0.52, 0.08, 0.45, DARK],
  [0, 0.75, 0, 0.57, 1.43, 0.50, PIN_GREEN],
  [0, 1.465, 0, 0.61, 0.09, 0.54, PIN_GREEN],
  [0, 1.25, 0.262, 0.39, 0.060, 0.035, DARK],
  [0, 0.84, 0.261, 0.26, 0.18, 0.030, PANEL],
]);
const PIN_NATIVE = profile([
  [0, 0.0625, 0, 0.50, 0.125, 0.50, DARK],
  [0, 0.75, 0, 0.5625, 1.375, 0.50, PIN_GREEN],
  [0, 1.4375, 0, 0.625, 0.125, 0.5625, PIN_GREEN],
  [0, 1.25, 0.265, 0.375, 0.0625, 0.039, DARK],
  [0, 0.875, 0.265, 0.25, 0.1875, 0.039, PANEL],
]);

function toiletProfile(
  cabins: 1 | 2, extension: "none" | "urinals" | "kiosk", native: boolean,
): Profile {
  // The Senate's reference shows silver cladding, a dark service bay and an
  // information panel. Its variant field establishes the installed modules,
  // not surveyed dimensions, fixture position or azimuth.
  const moduleWidth = native ? 2.5 : 2.45;
  const extensionWidth = extension === "none" ? 0 : native ? 1.75 : 1.65;
  const width = cabins * moduleWidth + extensionWidth;
  const depth = native ? 2.75 : 2.70;
  const front = depth / 2;
  const boxes: AmenityBoxV332[] = [
    [0, 0.08, 0, width - 0.06, 0.16, depth - 0.06, DARK],
    [0, 1.28, 0, width, 2.44, depth, STEEL],
    [0, 2.51, 0, width + 0.10, 0.14, depth + 0.10, FRAME],
  ];
  for (let i = 0; i < cabins; i++) {
    const x = -width / 2 + (i + 0.5) * moduleWidth;
    boxes.push(
      [x - 0.36, 1.16, front + 0.013, 1.08, 2.12, 0.036, FRAME],
      [x - 0.35, 1.17, front + 0.036, 0.86, 2.04, 0.038, DARK],
      [x + 0.45, 1.38, front + 0.023, 0.31, 0.73, 0.055, FRAME],
      [x + 0.45, 1.40, front + 0.055, 0.25, 0.65, 0.020, PANEL],
    );
  }
  if (extension !== "none") {
    const x = width / 2 - extensionWidth / 2;
    if (extension === "urinals") {
      boxes.push(
        [x, 1.17, front + 0.022, 1.20, 2.08, 0.05, DARK],
        [x, 1.17, front + 0.06, 0.14, 2.04, 0.14, STEEL],
      );
    } else {
      boxes.push(
        [x, 1.40, front + 0.022, 1.12, 1.12, 0.05, 0x586764],
        [x, 0.83, front + 0.05, 1.16, 0.09, 0.10, FRAME],
      );
    }
  }
  return profile(boxes);
}

const TOILET_VARIANTS = new Map<string, readonly [Profile, Profile]>(
  ([
    ["Berliner Toilette mit 1 Platz", 1, "none"],
    ["Berliner Toilette 1 Platz mit 2 Pissoirs", 1, "urinals"],
    ["Berliner Toilette mit 2 Plätzen", 2, "none"],
    ["Berliner Toilette 2 Plätze mit 2 Pissoirs", 2, "urinals"],
    ["Berliner Toilette 1 Platz mit Kiosk", 1, "kiosk"],
  ] as const).map(([variant, cabins, extension]) => [
    variant, Object.freeze([
      toiletProfile(cabins, extension, false), toiletProfile(cabins, extension, true),
    ]),
  ]),
);

/** A point model only. The caller verifies public access and actual ground support. */
export function amenityFurnitureV332(
  kind: string, model: string, variant: string, native: boolean,
): Profile {
  if (kind === "postbox") {
    // A mapped wall mounting needs an actual façade, not a freestanding prop.
    if (variant === "wall") return EMPTY;
    if (model === "deutsche-post") return native ? POST_NATIVE : POST_DRAWN;
    if (model === "pin-mail") return native ? PIN_NATIVE : PIN_DRAWN;
  }
  if (kind === "toilet" && model === "berliner-toilette") {
    return TOILET_VARIANTS.get(variant)?.[native ? 1 : 0] ?? EMPTY;
  }
  return EMPTY;
}
