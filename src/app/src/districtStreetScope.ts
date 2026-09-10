import { DISTRICT_STREET_SCOPE_RINGS_M } from "./districtStreetScopeData";
const scopeBounds = DISTRICT_STREET_SCOPE_RINGS_M.map((ring) => ({
  ring,
  minX: Math.min(...ring.map(([x]) => x)),
  maxX: Math.max(...ring.map(([x]) => x)),
  minZ: Math.min(...ring.map(([, z]) => z)),
  maxZ: Math.max(...ring.map(([, z]) => z)),
}));

/** Source-derived park envelope, including only its immediate street margin. */
export function pointInDistrictStreetScope(x: number, z: number): boolean {
  for (const bounds of scopeBounds) {
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) continue;
    let inside = false;
    const ring = bounds.ring;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[j];
      if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

