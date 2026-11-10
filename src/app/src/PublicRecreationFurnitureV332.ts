/** Finite source-type silhouettes. Each position is a box centre in metres. */
export type RecreationBoxV332 = readonly [
  dx: number, dy: number, dz: number,
  width: number, height: number, depth: number, color: number,
];

type Boxes = readonly RecreationBoxV332[];
const EMPTY: Boxes = Object.freeze([]);
const STEEL = 0x7d918c;
const DARK = 0x475753;
const BLUE = 0x3f718e;
const WARM = 0xc59756;
const RED = 0xab5b48;
const WOOD = 0x997650;
const SAND = 0xcbb179;
const CONCRETE = 0xa39d8e;

// Actual mapped equipment types. Location and type come from the OSM record;
// dimensions, colours and orientation are ordinary display interpretations.
const SWING: Boxes = [
  [-1.34, .54, -.56, .11, 1.08, .12, STEEL],
  [-1.34, .54, .56, .11, 1.08, .12, STEEL],
  [1.34, .54, -.56, .11, 1.08, .12, STEEL],
  [1.34, .54, .56, .11, 1.08, .12, STEEL],
  [-1.34, 1.47, -.35, .11, .86, .34, STEEL],
  [-1.34, 1.47, .35, .11, .86, .34, STEEL],
  [1.34, 1.47, -.35, .11, .86, .34, STEEL],
  [1.34, 1.47, .35, .11, .86, .34, STEEL],
  [0, 1.95, 0, 2.92, .14, .47, BLUE],
  [-.31, 1.24, 0, .035, 1.32, .035, DARK],
  [.31, 1.24, 0, .035, 1.32, .035, DARK],
  [0, .54, 0, .76, .10, .32, DARK],
];

const SLIDE: Boxes = [
  [-.75, .73, -.30, .08, 1.46, .08, STEEL],
  [-.75, .73, .30, .08, 1.46, .08, STEEL],
  [-.75, .29, 0, .14, .07, .66, STEEL],
  [-.75, .56, 0, .14, .07, .66, STEEL],
  [-.75, .83, 0, .14, .07, .66, STEEL],
  [-.75, 1.10, 0, .14, .07, .66, STEEL],
  [-.47, 1.42, 0, .52, .11, .72, RED],
  [-.05, 1.26, 0, .42, .28, .56, WARM],
  [.30, 1.01, 0, .42, .28, .56, WARM],
  [.65, .76, 0, .42, .28, .56, WARM],
  [1.00, .51, 0, .42, .28, .56, WARM],
  [1.37, .26, 0, .48, .28, .62, WARM],
];

const SEESAW: Boxes = [
  [0, .18, 0, .59, .36, .49, CONCRETE],
  [0, .44, 0, .20, .30, .27, STEEL],
  [0, .64, 0, 2.74, .16, .21, WOOD],
  [-1.11, .76, 0, .42, .10, .37, RED],
  [1.11, .76, 0, .42, .10, .37, RED],
  [-.82, .85, 0, .08, .22, .09, DARK],
  [.82, .85, 0, .08, .22, .09, DARK],
  [-.82, .97, 0, .08, .06, .24, DARK],
  [.82, .97, 0, .08, .06, .24, DARK],
];

const SANDBOX: Boxes = [
  [0, .045, 0, 2.32, .09, 1.80, SAND],
  [0, .12, -1.02, 2.80, .24, .24, WOOD],
  [0, .12, 1.02, 2.80, .24, .24, WOOD],
  [-1.28, .12, 0, .24, .24, 1.80, WOOD],
  [1.28, .12, 0, .24, .24, 1.80, WOOD],
];

const CLIMBING: Boxes = [
  [-.78, .98, -.55, .13, 1.96, .13, BLUE],
  [-.78, .98, .55, .13, 1.96, .13, BLUE],
  [.78, .98, -.55, .13, 1.96, .13, BLUE],
  [.78, .98, .55, .13, 1.96, .13, BLUE],
  [0, 1.91, -.55, 1.65, .11, .11, STEEL],
  [0, 1.91, .55, 1.65, .11, .11, STEEL],
  [-.78, .42, 0, .12, .085, 1.12, WARM],
  [-.78, .81, 0, .12, .085, 1.12, WARM],
  [-.78, 1.20, 0, .12, .085, 1.12, WARM],
  [-.78, 1.59, 0, .12, .085, 1.12, WARM],
  [-.39, 1.91, 0, .08, .08, 1.15, STEEL],
  [0, 1.91, 0, .08, .08, 1.15, STEEL],
  [.39, 1.91, 0, .08, .08, 1.15, STEEL],
  [.78, 1.91, 0, .08, .08, 1.15, STEEL],
];

const SPRINGY: Boxes = [
  [0, .07, 0, .46, .14, .42, CONCRETE],
  [0, .29, 0, .14, .37, .14, DARK],
  [0, .18, 0, .27, .06, .23, STEEL],
  [0, .29, 0, .27, .06, .23, STEEL],
  [0, .40, 0, .27, .06, .23, STEEL],
  [0, .51, 0, .54, .18, .31, RED],
  [.20, .66, 0, .20, .20, .26, RED],
  [.26, .77, 0, .10, .07, .42, DARK],
];

const COBALT = 0x254c76;
const BRASS = 0xb09a60;
const ALLOY = 0x9ea9a7;
const FAUCET = 0xc8cdca;

// Kaiser has its characteristic blue segmented column and brass fitting.
// Bituma's cantilever leaves clear approach space below the stainless basin.
// The BWB Botsch sheet gives a 1.05 m body and approximately 0.50 m basin.
// Photographic references and producer drawings remain external.
const KAISER: Boxes = [
  [0, .045, 0, .42, .09, .35, COBALT],
  [0, .505, 0, .27, .90, .25, COBALT],
  [0, .23, 0, .31, .055, .28, BLUE],
  [0, .43, 0, .31, .055, .28, BLUE],
  [0, .63, 0, .31, .055, .28, BLUE],
  [0, .83, 0, .31, .055, .28, BLUE],
  [0, .83, .18, .43, .075, .28, COBALT],
  [0, .878, .19, .32, .025, .18, DARK],
  [0, .991, .07, .085, .14, .085, BRASS],
  [0, 1.067, .09, .10, .05, .16, BRASS],
];

const BITUMA: Boxes = [
  [0, .47, -.255, .43, .94, .38, CONCRETE],
  [0, .94, 0, .43, .19, .90, CONCRETE],
  [0, 1.045, .11, .30, .028, .50, ALLOY],
  [0, 1.062, -.075, .30, .033, .025, FAUCET],
  [0, 1.062, .338, .30, .033, .025, FAUCET],
  [-.138, 1.062, .13, .025, .033, .42, FAUCET],
  [.138, 1.062, .13, .025, .033, .42, FAUCET],
  [0, 1.084, -.03, .045, .04, .06, FAUCET],
];

const BOTSCH: Boxes = [
  [0, .075, -.06, .19, .15, .31, ALLOY],
  [0, .55, -.08, .15, .90, .23, ALLOY],
  [0, .225, .046, .12, .022, .025, DARK],
  [0, .422, .046, .12, .022, .025, DARK],
  [0, .620, .046, .12, .022, .025, DARK],
  [0, .817, .046, .12, .022, .025, DARK],
  [0, .896, .085, .50, .075, .44, ALLOY],
  [0, .941, .09, .37, .020, .31, DARK],
  [0, 1.023, .018, .065, .054, .087, FAUCET],
];

type Profile = Readonly<{ drawn: Boxes; native: Boxes }>;

function profile(boxes: Boxes): Profile {
  const grid = 32;
  function edges(center: number, size: number): readonly [number, number] {
    const a = Math.round((center - size / 2) * grid);
    const b = Math.max(a + 1, Math.round((center + size / 2) * grid));
    return [(a + b) / (2 * grid), (b - a) / grid];
  }
  return {
    drawn: Object.freeze(boxes.map(row => Object.freeze(row))),
    native: Object.freeze(boxes.map(([x, y, z, w, h, d, color]) => {
      const [cx, width] = edges(x, w), [cy, height] = edges(y, h), [cz, depth] = edges(z, d);
      return Object.freeze([cx, cy, cz, width, height, depth, color] as const);
    })),
  };
}

const sandbox = profile(SANDBOX);
const climbing = profile(CLIMBING);
const PLAY = new Map<string, Profile>([
  ["swing", profile(SWING)], ["slide", profile(SLIDE)], ["seesaw", profile(SEESAW)],
  ["sandbox", sandbox], ["sandpit", sandbox], ["climbingframe", climbing],
  ["climbing_frame", climbing], ["springy", profile(SPRINGY)],
]);
const DRINKING = new Map<string, Profile>([
  ["kaiser", profile(KAISER)], ["bituma", profile(BITUMA)], ["botsch", profile(BOTSCH)],
]);

export function recreationFurnitureV332(kind: string, model: string, native: boolean): Boxes {
  const models = kind === "playground" ? PLAY : kind === "drinking" ? DRINKING : undefined;
  const value = models?.get(model.trim().toLowerCase());
  return value ? (native ? value.native : value.drawn) : EMPTY;
}
