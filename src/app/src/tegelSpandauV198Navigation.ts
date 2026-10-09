import data from "./data/tegelSpandauV198Navigation.json";

function contains(ring: readonly number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

/** Lazy outline callback: actual new deck only, never a filled water/island box. */
export function tegelSpandauV198GroundAt(x: number, z: number, minecraft = false): number | null {
  const [minX, minZ, maxX, maxZ] = data.bridgeBounds;
  if (x < minX || x > maxX || z < minZ || z > maxZ) return null;
  if (minecraft) {
    for (const r of data.nativeDeck) {
      if (Math.abs(z - r[2]) <= r[5] / 2 && Math.abs(x - r[0]) <= r[3] / 2) return r[1] + r[4] / 2;
    }
    return null;
  }
  return contains(data.bridgeRing, x, z) && !data.bridgeHoles.some(r => contains(r, x, z)) ? data.deckY : null;
}

/** Small source-bound harbour completion; the main lake remains the v194 owner. */
export function tegelSpandauV198WaterAt(x: number, z: number, minecraft = false): number | null {
  const [minX, minZ, maxX, maxZ] = minecraft ? data.nativeWaterBounds : data.waterBounds;
  if (x < minX || x > maxX || z < minZ || z > maxZ) return null;
  for (const polygon of minecraft ? data.nativeWaterPolygons : data.waterPolygons) {
    if (contains(polygon[0], x, z) && !polygon.slice(1).some(r => contains(r, x, z))) return -1.15;
  }
  return null;
}
