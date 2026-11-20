// Existing pier footprints in the Radbahn plan, pp. 9 and 16–19. Registration
// against the retained Mariannenstraße crossing is approximate, as are heights.
export const SKALITZER_PILOT_V369 = {
  west: 3372.5,
  east: 3592.0,
  pierPairs: [
    [3372.6, 5.50], [3390.6, 5.50], [3413.8, 5.50],
    ...Array.from({ length: 15 }, (_, i) => [3423.2 + 12 * i, 4.18]),
  ],
} as const;

type Course = { points: readonly (readonly number[])[] };
type Section = {
  x: number; z: number; dx: number; dz: number; separation: number;
};

/** Intersect a section with both retained track courses. Their centre gives
 * the bridge axis; the projected separation handles the curve at Wrangelstraße. */
export function skalitzerSectionV369(tracks: readonly Course[], x: number): Section | null {
  const hits: { z: number; slope: number }[] = [];
  for (const track of tracks) {
    for (let i = 1; i < track.points.length; i++) {
      const a = track.points[i - 1], b = track.points[i];
      if (x < Math.min(a[0], b[0]) || x > Math.max(a[0], b[0]) || a[0] === b[0]) continue;
      const slope = (b[1] - a[1]) / (b[0] - a[0]);
      const z = a[1] + (x - a[0]) * slope;
      if (!hits.some(hit => Math.abs(hit.z - z) < 0.01)) hits.push({ z, slope });
      break;
    }
  }
  if (hits.length !== 2) return null;
  const slope = (hits[0].slope + hits[1].slope) / 2;
  const dx = 1 / Math.hypot(1, slope);
  return { x, z: (hits[0].z + hits[1].z) / 2, dx, dz: dx * slope, separation: Math.abs(hits[1].z - hits[0].z) * dx };
}
