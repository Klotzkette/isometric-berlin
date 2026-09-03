import { pointInWorldRing } from "./chancelleryExtensionProfile";

// These 71 high parts of the Ti0000Bu..Ti0000CH roof objects describe the
// suspended Forum canopy, not occupied ground-to-roof buildings. Retain their
// source records; the existing OSM/Arup-bound roof supplies the visible canopy.
// The two low source parts and every neighbouring building remain untouched.
// OSM way 13648222 is the elevated central roof disc (building=roof, layer=1).
export const SONY_CENTER_ROOF_PRISM_IDS: ReadonlySet<string> = new Set([
  "Ti0000Bw",
  "Ti0000Bx",
  "Ti0000C2",
  "13648222",
  "0AtYx8DR",
  "0HqXRym3",
  "0fq0HwZ6",
  "24c60eLz",
  "3Mz9fc2S",
  "5ITWxCmq",
  "72y6xvJr",
  "7buH79Fg",
  "7uww4nv5",
  "8HzIstBy",
  "9elDVJHU",
  "Cx4EuxYK",
  "DiOSHVza",
  "DvbIgZPx",
  "FJhQ5npV",
  "GYVL1m3u",
  "HEmXToaS",
  "HOVzVsb2",
  "HgBAAftm",
  "HqqxD8E0",
  "IXvqIY3Z",
  "JHEPpGSY",
  "KGffCwdi",
  "KJxIffBV",
  "KxV0Hd9v",
  "MYXaomfk",
  "Ma213WcC",
  "Mloy0UAh",
  "NW134Ai3",
  "S5xfalZO",
  "S8d5hzds",
  "SoFkvG7L",
  "UR3WH3CJ",
  "UsLHIhrp",
  "WX909mwm",
  "ZPsbcS8s",
  "Zh3985Oe",
  "ZoruZpYW",
  "Zwyarl9P",
  "ad7uC6lp",
  "caJQIj97",
  "didMFUlR",
  "e4mDCdIH",
  "eflnQQf6",
  "gsloOu25",
  "hV5nRPzT",
  "iYueLH8X",
  "im45RMKJ",
  "ioPtWSTA",
  "jgIRnKGx",
  "kEogyarF",
  "kGB5NcuV",
  "kGpb9aZG",
  "kQ81hT0f",
  "n4zQ1vuV",
  "naohAVzF",
  "qRx8oGCn",
  "r81jYxyl",
  "t0VEOafy",
  "tSxjD0Xl",
  "v5EOhsyE",
  "vNgy0ibG",
  "wA5hQCj1",
  "xJNjumRS",
  "xVdTxtzy",
  "ymWchfNx",
  "zDgV1Lrc",
  "zOi4c3Rw",
]);

export type SonyRoofSourcePrism = {
  id: string;
  ring: number[][];
  holes?: number[][][];
  y0_dm: number;
  h_dm: number;
};

function contains(
  prism: SonyRoofSourcePrism,
  xDm: number,
  zDm: number,
): boolean {
  return (
    pointInWorldRing(xDm, zDm, prism.ring as Array<[number, number]>) &&
    !(prism.holes ?? []).some((hole) =>
      pointInWorldRing(xDm, zDm, hole as Array<[number, number]>),
    )
  );
}

/** One-time voxel correction from already-loaded LoD2, with no extra payload. */
export function createSonyRoofColumnTopAt(
  prisms: readonly SonyRoofSourcePrism[] = [],
): (x: number, z: number, groundY: number, sourceTopY: number) => number {
  const roofs = prisms.filter((prism) =>
    SONY_CENTER_ROOF_PRISM_IDS.has(prism.id),
  );
  if (!roofs.length) return (_x, _z, _ground, top) => top;
  const points = roofs.flatMap(({ ring }) => ring);
  const minX = Math.min(...points.map(([x]) => x));
  const maxX = Math.max(...points.map(([x]) => x));
  const minZ = Math.min(...points.map(([, z]) => z));
  const maxZ = Math.max(...points.map(([, z]) => z));
  const neighbours = prisms.filter((prism) => {
    if (SONY_CENTER_ROOF_PRISM_IDS.has(prism.id)) return false;
    let left = Infinity,
      right = -Infinity,
      near = Infinity,
      far = -Infinity;
    for (const [x, z] of prism.ring) {
      left = Math.min(left, x);
      right = Math.max(right, x);
      near = Math.min(near, z);
      far = Math.max(far, z);
    }
    return right >= minX && left <= maxX && far >= minZ && near <= maxZ;
  });
  return (x, z, groundY, sourceTopY) => {
    const xDm = x * 10,
      zDm = z * 10;
    if (
      sourceTopY - groundY < 40 ||
      xDm < minX ||
      xDm > maxX ||
      zDm < minZ ||
      zDm > maxZ ||
      !roofs.some((roof) => contains(roof, xDm, zDm))
    )
      return sourceTopY;
    let retainedTopY = groundY;
    for (const neighbour of neighbours) {
      if (contains(neighbour, xDm, zDm)) {
        retainedTopY = Math.max(
          retainedTopY,
          (neighbour.y0_dm + neighbour.h_dm) / 10,
        );
      }
    }
    return Math.min(sourceTopY, retainedTopY);
  };
}
