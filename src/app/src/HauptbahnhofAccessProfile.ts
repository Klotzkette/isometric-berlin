/**
 * Public entrance subdivisions of the existing 180 x 42 m station model.
 * The two ground-floor exits and galleries follow DB's station plan. Door
 * leaves and foyer subdivisions are procedural display dimensions, not a
 * new survey: https://www.bahnhof.de/downloads/station-plans/1071.pdf
 */
export const HAUPTBAHNHOF_ACCESS = {
  facadeLocalZ: 90,
  doorCentresLocalX: [-8.725, -5.235, -1.745, 1.745, 5.235, 8.725],
  doorBayWidthM: 3.15,
  doorClearWidthM: 2.3,
  doorHeightM: 4.9,
  floorTopLocalY: 0.25,
  foyerInnerLocalZ: 82,
  foyerOuterLocalZ: 92.2,
  hallHalfWidthM: 20,
  groundAtriumHalfWidthM: 9.5,
  doorApproachDistanceM: 20,
  doorApproachHalfWidthM: 15,
  doorApproachBottomLocalY: -2,
  doorApproachTopLocalY: 12,
  doorOpenSeconds: 0.48,
  doorCloseSeconds: 1.15,
} as const;

export function hauptbahnhofDoorOpeningAt(localX: number): boolean {
  return HAUPTBAHNHOF_ACCESS.doorCentresLocalX.some(
    (centre) => Math.abs(localX - centre) < HAUPTBAHNHOF_ACCESS.doorClearWidthM / 2,
  );
}

/** Camera-local trigger shared by walking, flight and touch navigation. */
export function hauptbahnhofDoorApproachAt(
  localX: number, localY: number, localZ: number, facadeSide: -1 | 1,
): boolean {
  const p = HAUPTBAHNHOF_ACCESS;
  return Number.isFinite(localX) && Number.isFinite(localY) && Number.isFinite(localZ) &&
    Math.abs(localX) <= p.doorApproachHalfWidthM &&
    Math.abs(localZ - facadeSide * p.facadeLocalZ) <= p.doorApproachDistanceM &&
    localY >= p.doorApproachBottomLocalY && localY <= p.doorApproachTopLocalY;
}
