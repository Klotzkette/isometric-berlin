/** Source-shaped collision for the independently complete northern ensemble. */
export type NorthernSolidV309 = {
  ring: readonly number[][];
  holes?: readonly number[][][];
  minY: number;
  maxY: number;
  topAt?: (x: number, z: number) => number | null;
  bottomAt?: (x: number, z: number) => number | null;
};
function inside(ring: readonly number[][], x: number, z: number): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function nearest(ring: readonly number[][], x: number, z: number): [number, number, number] {
  let best: [number, number, number] = [Infinity, x, z];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    const px = a[0] + dx * t, pz = a[1] + dz * t, distance = Math.hypot(x - px, z - pz);
    if (distance < best[0]) best = [distance, px, pz];
  }
  return best;
}
function contact(s: NorthernSolidV309, x: number, z: number, radius: number): [number, number] | null {
  if (inside(s.ring, x, z)) {
    for (const hole of s.holes ?? []) if (inside(hole, x, z)) {
      const edge = nearest(hole, x, z);
      return edge[0] < radius ? [edge[1], edge[2]] : null;
    }
    return [x, z];
  }
  const edge = nearest(s.ring, x, z);
  return edge[0] < radius ? [edge[1], edge[2]] : null;
}

/** Small strong spatial index; geometry and its huge construction recipes are
 * never retained here. The caller's private gate is checked on every query. */
export function createNorthernNavigationV309(solids: readonly NorthernSolidV309[], complete: () => boolean, groundAt?: (x: number, z: number) => number | null) {
  const buckets = new Map<string, NorthernSolidV309[]>(), side = 32;
  for (const solid of solids) {
    if (!solid.ring.length || !Number.isFinite(solid.minY) || !Number.isFinite(solid.maxY)) throw Error("Invalid complete northern navigation");
    const xs = solid.ring.map(p => p[0]), zs = solid.ring.map(p => p[1]);
    for (let x = Math.floor((Math.min(...xs) - 1) / side); x <= Math.floor((Math.max(...xs) + 1) / side); x++)
      for (let z = Math.floor((Math.min(...zs) - 1) / side); z <= Math.floor((Math.max(...zs) + 1) / side); z++) {
        const key = `${x},${z}`, list = buckets.get(key) ?? []; list.push(solid); buckets.set(key, list);
      }
  }
  const candidates = (x: number, z: number, radius = 0): Set<NorthernSolidV309> => {
    const found = new Set<NorthernSolidV309>();
    for (let i = Math.floor((x - radius) / side); i <= Math.floor((x + radius) / side); i++)
      for (let j = Math.floor((z - radius) / side); j <= Math.floor((z + radius) / side); j++)
        for (const solid of buckets.get(`${i},${j}`) ?? []) found.add(solid);
    return found;
  };
  return {
    solidAt(x: number, y: number, z: number, radius = 0): boolean {
      if (!complete()) return false;
      for (const solid of candidates(x, z, radius)) {
        if (y < solid.minY || y > solid.maxY) continue;
        const point = contact(solid, x, z, radius); if (!point) continue;
        const top = solid.topAt ? solid.topAt(...point) : solid.maxY;
        const bottom = solid.bottomAt ? solid.bottomAt(...point) : solid.minY;
        if (top !== null && bottom !== null && y >= bottom && y <= top) return true;
      }
      return false;
    },
    floorAt(x: number, z: number, current: number): number | null {
      if (!complete()) return null;
      const ground = groundAt?.(x, z);
      // A lower source platform can sit below the final measured terrain.
      // Choose the highest actual support in the same walking step window.
      let top = ground !== undefined && ground !== null && ground >= current - 1 && ground <= current + .65 ? ground : -Infinity;
      for (const solid of candidates(x, z)) {
        if (!contact(solid, x, z, 0)) continue;
        const y = solid.topAt ? solid.topAt(x, z) : solid.maxY;
        if (y !== null && y >= current - 1 && y <= current + .65) top = Math.max(top, y);
      }
      return Number.isFinite(top) ? top : null;
    },
  };
}
