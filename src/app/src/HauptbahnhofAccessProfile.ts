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
} as const;

export function hauptbahnhofDoorOpeningAt(localX: number): boolean {
  return HAUPTBAHNHOF_ACCESS.doorCentresLocalX.some(
    (centre) => Math.abs(localX - centre) < HAUPTBAHNHOF_ACCESS.doorClearWidthM / 2,
  );
}
