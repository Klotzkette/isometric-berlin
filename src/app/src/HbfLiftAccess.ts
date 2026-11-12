import { HBF_CIRCULATION_V291, hbfLocalToWorldV291 } from "./HbfCirculationV291";

const { frame, levels, shafts } = HBF_CIRCULATION_V291;
const boardingDistance = 1.35;
const landingOffset = 3.3;

export type HbfLiftLanding = { shaftIndex: number; levelIndex: number };

/** Both model families have open floor on the outward side of each shaft. */
export function hbfLiftLanding(shaftIndex: number, levelIndex: number): [number, number, number] {
  const shaft = shafts[shaftIndex];
  return hbfLocalToWorldV291([shaft.x + Math.sign(shaft.x) * landingOffset, levels[levelIndex].topLocalY, shaft.z]);
}

export const hbfLiftLandings = shafts.flatMap((_, shaftIndex) =>
  levels.map((_, levelIndex) => ({
    shaftIndex, levelIndex, point: hbfLiftLanding(shaftIndex, levelIndex),
  })),
);

export function hbfLiftLandingNear(x: number, y: number, z: number): HbfLiftLanding | null {
  if (Math.abs(x - frame.anchorWorld[0]) > 28 || Math.abs(z - frame.anchorWorld[2]) > 28 ||
    y < frame.anchorWorld[1] + levels[4].topLocalY - .4 || y > frame.anchorWorld[1] + levels[0].topLocalY + .4) return null;
  return hbfLiftLandings.find(({ point }) =>
    Math.abs(y - point[1]) <= .35 && (x - point[0]) ** 2 + (z - point[2]) ** 2 <= boardingDistance ** 2,
  ) ?? null;
}

export function hbfLiftCabinPosition(shaftIndex: number, localY: number): [number, number, number] {
  const shaft = shafts[shaftIndex];
  return hbfLocalToWorldV291([shaft.x, localY + .16, shaft.z]);
}
