import { DISTRICT_STREET_SCOPE_RINGS_M } from "./districtStreetScopeData";

const SCOPE_EDGE_BIN_M = 64;
const scopeBounds = DISTRICT_STREET_SCOPE_RINGS_M.map((ring) => {
  const pending = new Map<number, number[]>();
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    // A horizontal edge never crosses the original strict horizontal ray.
    if (az === bz) continue;
    const first = Math.floor(Math.min(az, bz) / SCOPE_EDGE_BIN_M);
    const last = Math.floor(Math.max(az, bz) / SCOPE_EDGE_BIN_M);
    for (let bin = first; bin <= last; bin++) {
      let edges = pending.get(bin);
      if (!edges) pending.set(bin, edges = []);
      edges.push(ax, az, bx, bz);
    }
  }
  // Float64 keeps the original JavaScript coordinate bits. Bins only reject
  // impossible Z intervals; endpoint tests and ray arithmetic stay unchanged.
  // The private lookup is built once and is immutable during all queries.
  const bins: ReadonlyMap<number, Float64Array> = new Map(
    [...pending].map(([bin, edges]) => [bin, new Float64Array(edges)]),
  );
  return {
    bins,
    minX: Math.min(...ring.map(([x]) => x)),
    maxX: Math.max(...ring.map(([x]) => x)),
    minZ: Math.min(...ring.map(([, z]) => z)),
    maxZ: Math.max(...ring.map(([, z]) => z)),
  };
});

/** Source-derived park envelope, including only its immediate street margin. */
export function pointInDistrictStreetScope(x: number, z: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const bin = Math.floor(z / SCOPE_EDGE_BIN_M);
  for (const bounds of scopeBounds) {
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) continue;
    const edges = bounds.bins.get(bin);
    if (!edges) continue;
    let inside = false;
    for (let i = 0; i < edges.length; i += 4) {
      const ax = edges[i], az = edges[i + 1], bx = edges[i + 2], bz = edges[i + 3];
      if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}
