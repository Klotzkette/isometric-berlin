/**
 * Exact committed LoD2 identities and the outer socle footprint, in decimetres.
 * Source: public/mesh/regierungsviertel/lod2-prisms.json (Geoportal Berlin,
 * dl-de/zero-2-0). The three concentric source parts are already suppressed in
 * the drawn viewer; their voxel counterparts must not cover the authored model.
 */
export const SIEGESSAEULE_SOURCE = {
  baseYDm: 52,
  parts: [
    { id: "3wUufHpn", heightDm: 250 },
    { id: "iHbVUwP0", heightDm: 182 },
    { id: "xzlowEa3", heightDm: 84 },
  ],
  outerFootprintDm: [
    [-14721, 4445], [-14688, 4442], [-14690, 4426], [-14528, 4412],
    [-14527, 4427], [-14494, 4424], [-14491, 4457], [-14476, 4456],
    [-14461, 4617], [-14476, 4619], [-14473, 4651], [-14506, 4654],
    [-14505, 4670], [-14667, 4684], [-14668, 4669], [-14701, 4672],
    [-14704, 4639], [-14719, 4641], [-14733, 4479], [-14718, 4478],
  ],
} as const;

/**
 * Match the monument's source columns, not a broad landmark-radius clearing.
 * The voxelizer rounds each retained source height upwards by its cell size.
 * Unrelated heights, neighbours and the surrounding island remain untouched.
 */
export function isSiegessaeuleSourceVoxelColumn(
  x: number,
  z: number,
  bottomY: number,
  topY: number,
  cellM: number,
): boolean {
  if (x < -1473.3 || x > -1446.1 || z < 441.2 || z > 468.4) return false;
  if (Math.abs(bottomY - SIEGESSAEULE_SOURCE.baseYDm / 10) > 0.001 || cellM <= 0) return false;
  if (!SIEGESSAEULE_SOURCE.parts.some(({ heightDm }) =>
    Math.abs(topY - bottomY - Math.ceil(heightDm / 10 / cellM) * cellM) < 0.001)) return false;
  const ring = SIEGESSAEULE_SOURCE.outerFootprintDm;
  const px = x * 10, pz = z * 10;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > pz) !== (zj > pz) && px < (xj - xi) * (pz - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
