export const VISIBLE_RADIUS_M = 3310;
export const EXTRAPOLATED_WEST_M = -3020;
export const EXTRAPOLATED_MARGIN_M = 2020;

export const WEST_PARK_EAST_M = -658;
export const WEST_PARK_NORTH_M = -160;
export const WEST_PARK_SOUTH_M = 960;

export const AXIS_FROM: readonly [number, number] = [372, 292];
export const AXIS_TO: readonly [number, number] = [-1459, 456];

export type EnvelopeBand = readonly [
  centerX: number,
  centerZ: number,
  sizeX: number,
  sizeZ: number,
];

export function extrapolatedMarginBands(): EnvelopeBand[] {
  const previousHorizontalCenter = (WEST_PARK_EAST_M + 1150) / 2 - 245;
  const horizontalOuterEast =
    previousHorizontalCenter + (1150 - EXTRAPOLATED_WEST_M) / 2;
  const horizontalCenter =
    (EXTRAPOLATED_WEST_M + horizontalOuterEast) / 2;
  const horizontalWidth = horizontalOuterEast - EXTRAPOLATED_WEST_M;
  return [
    [
      horizontalCenter,
      -1030 - EXTRAPOLATED_MARGIN_M / 2,
      horizontalWidth,
      EXTRAPOLATED_MARGIN_M,
    ],
    [
      horizontalCenter,
      1451 + EXTRAPOLATED_MARGIN_M / 2,
      horizontalWidth,
      EXTRAPOLATED_MARGIN_M,
    ],
    [
      601 + EXTRAPOLATED_MARGIN_M / 2,
      (1451 - 1030) / 2,
      EXTRAPOLATED_MARGIN_M,
      1451 + 1030,
    ],
  ];
}

export type EnvelopeBounds = {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
};

export function extrapolatedEnvelopeBounds(): EnvelopeBounds {
  const bands = extrapolatedMarginBands();
  return {
    maxX: Math.max(
      WEST_PARK_EAST_M,
      ...bands.map(([x, , width]) => x + width / 2),
    ),
    maxZ: Math.max(
      WEST_PARK_SOUTH_M,
      ...bands.map(([, z, , depth]) => z + depth / 2),
    ),
    minX: Math.min(
      EXTRAPOLATED_WEST_M,
      ...bands.map(([x, , width]) => x - width / 2),
    ),
    minZ: Math.min(
      WEST_PARK_NORTH_M,
      ...bands.map(([, z, , depth]) => z - depth / 2),
    ),
  };
}

function stripUnit(index: number, seed: number): number {
  let value = Math.imul(index + seed, 0x9e3779b1);
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}

function axisZAtX(x: number): number {
  const axisDx = AXIS_TO[0] - AXIS_FROM[0];
  const axisDz = AXIS_TO[1] - AXIS_FROM[1];
  return AXIS_FROM[1] + ((x - AXIS_FROM[0]) * axisDz) / axisDx;
}

function outsideAxis(x: number, z: number): boolean {
  return Math.abs(z - axisZAtX(x)) >= 34;
}

/**
 * Deterministic extrapolated park trees shared by the drawn and voxel worlds.
 * Every published 100 m strip keeps its original positions.
 */
export function extrapolatedTreeSpots(): Array<[number, number]> {
  const spots: Array<[number, number]> = [];
  const v022West = -1720;
  const v023West = -1820;
  const v024West = -1920;
  const v025West = -2020;
  const v026West = -2120;
  const v027West = -2220;
  const v028West = -2320;
  const v029West = -2420;
  const v030West = -2520;
  const v032West = -2620;
  const v033West = -2720;
  const v034West = -2820;
  const v035West = -2920;

  for (let index = 0; index < 720; index += 1) {
    const hx = (Math.imul(index + 1, 2654435761) >>> 9) % 10_000;
    const hz = (Math.imul(index + 7, 40503) >>> 3) % 10_000;
    const x =
      v022West +
      20 +
      ((WEST_PARK_EAST_M - v022West - 40) * hx) / 10_000;
    const z =
      WEST_PARK_NORTH_M +
      20 +
      ((WEST_PARK_SOUTH_M - WEST_PARK_NORTH_M - 40) * hz) / 10_000;
    if (
      !outsideAxis(x, z) ||
      Math.hypot(x - AXIS_TO[0], z - AXIS_TO[1]) < 112
    ) {
      continue;
    }
    spots.push([x, z]);
  }

  const earlyStrips: ReadonlyArray<
    readonly [west: number, east: number, xSeed: number, zSeed: number]
  > = [
    [v023West, v022West, 101, 211],
    [v024West, v023West, 307, 419],
    [v025West, v024West, 523, 631],
  ];
  earlyStrips.forEach(([west, east, xSeed, zSeed], stripIndex) => {
    for (let index = 0; index < 84; index += 1) {
      const xMultiplier =
        stripIndex === 0 ? 2246822519 : stripIndex === 1 ? 668265263 : 1103515245;
      const zMultiplier =
        stripIndex === 0 ? 3266489917 : stripIndex === 1 ? 374761393 : 214013;
      const hx = (Math.imul(index + xSeed, xMultiplier) >>> 8) % 10_000;
      const hz = (Math.imul(index + zSeed, zMultiplier) >>> 7) % 10_000;
      const x = west + 10 + ((east - west - 20) * hx) / 10_000;
      const z =
        WEST_PARK_NORTH_M +
        20 +
        ((WEST_PARK_SOUTH_M - WEST_PARK_NORTH_M - 40) * hz) / 10_000;
      if (outsideAxis(x, z)) {
        spots.push([x, z]);
      }
    }
  });

  const strips: ReadonlyArray<
    readonly [west: number, east: number, xSeed: number, zSeed: number]
  > = [
    [v026West, v025West, 743, 857],
    [v027West, v026West, 1249, 1361],
    [v028West, v027West, 1543, 1667],
    [v029West, v028West, 1901, 2029],
    [v030West, v029West, 2297, 2411],
    [v032West, v030West, 2749, 2861],
    [v033West, v032West, 3163, 3271],
    [v034West, v033West, 3571, 3701],
    [v035West, v034West, 4001, 4127],
    [EXTRAPOLATED_WEST_M, v035West, 4483, 4621],
  ];
  for (const [west, east, xSeed, zSeed] of strips) {
    for (let index = 0; index < 84; index += 1) {
      const x = west + 10 + (east - west - 20) * stripUnit(index, xSeed);
      const z =
        WEST_PARK_NORTH_M +
        20 +
        (WEST_PARK_SOUTH_M - WEST_PARK_NORTH_M - 40) *
          stripUnit(index, zSeed);
      if (outsideAxis(x, z)) {
        spots.push([x, z]);
      }
    }
  }
  return spots;
}

export function extrapolatedLampSpots(): Array<[number, number]> {
  const spots: Array<[number, number]> = [];
  const axisDx = AXIS_TO[0] - AXIS_FROM[0];
  const axisDz = AXIS_TO[1] - AXIS_FROM[1];
  const axisLength = Math.hypot(axisDx, axisDz);
  const axisX = axisDx / axisLength;
  const axisZ = axisDz / axisLength;
  const count = Math.floor(
    Math.abs(AXIS_TO[0] - WEST_PARK_EAST_M) / 42,
  );
  for (let index = 0; index <= count; index += 1) {
    const x =
      WEST_PARK_EAST_M +
      (AXIS_TO[0] - WEST_PARK_EAST_M) * (index / Math.max(1, count));
    const z = axisZAtX(x);
    if (Math.hypot(x - AXIS_TO[0], z - AXIS_TO[1]) < 118) {
      continue;
    }
    spots.push([x - axisZ * 26, z + axisX * 26]);
    spots.push([x + axisZ * 26, z - axisX * 26]);
  }
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    spots.push([
      AXIS_TO[0] + Math.cos(angle) * 112,
      AXIS_TO[1] + Math.sin(angle) * 112,
    ]);
  }
  return spots;
}
