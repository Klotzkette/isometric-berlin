import source from "./data/westernStadiumV187Navigation.json";

type Ring = readonly (readonly number[])[];
function inside(x: number, z: number, ring: Ring): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
function inPolygon(x: number, z: number, rings: Ring[]): boolean {
  return inside(x, z, rings[0]) && !rings.slice(1).some(r => inside(x, z, r));
}
const cutout = source.cutout.coordinates;
const track = source.trackOuter.coordinates[0];
const gap = source.marathonOpening.type === "Polygon"
  ? [source.marathonOpening.coordinates as unknown as Ring[]]
  : source.marathonOpening.coordinates as unknown as Ring[][];

/** Only this exact ground opening: undefined leaves the existing terrain policy. */
export function westernStadiumGroundYV187(x: number, z: number): number | undefined {
  const b = source.bounds;
  if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) return undefined;
  if (!cutout.some(p => inPolygon(x, z, p))) return undefined;
  if (inside(x, z, track) || gap.some(p => inPolygon(x, z, p))) return source.pitchY;
  const edge = cutout[0][0];
  let edgeDistance = Infinity;
  for (let i = 1; i < edge.length; i++) {
    const a = edge[i - 1], b = edge[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    edgeDistance = Math.min(edgeDistance, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
  }
  if (edgeDistance <= source.rimWidthM) return source.rimY;
  let nearest = Infinity;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1], b = track[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const d2 = dx * dx + dz * dz;
    const t = d2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / d2)) : 0;
    nearest = Math.min(nearest, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
  }
  const s = source.seating;
  const row = Math.floor((nearest - s.firstOffsetM) / s.rowDepthM);
  return row >= 0 && row < s.rows ? source.pitchY + s.firstRiseM + (row + 1) * s.risePerRowM : source.pitchY;
}
