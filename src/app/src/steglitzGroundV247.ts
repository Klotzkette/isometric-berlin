import floors from "./data/steglitzGroundV247.json";

type Ring = readonly (readonly number[])[];

function inside(x: number, z: number, ring: Ring): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) result = !result;
  }
  return result;
}

/** Fixed finite surface lookup, with no renderer imports or decoded model cache. */
export function steglitzGroundV247At(x: number, z: number, minecraft = false): number | null {
  const [minX, minZ, maxX, maxZ] = floors.bounds;
  if (!Number.isFinite(x) || !Number.isFinite(z) || x < minX || x > maxX || z < minZ || z > maxZ) return null;
  if (minecraft) {
    for (const [x0, z0, x1, z1, y] of floors.native) {
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return y;
    }
  } else {
    for (const surface of floors.drawn) {
      if (inside(x, z, surface.ring) && !surface.holes.some(hole => inside(x, z, hole))) return surface.topY;
    }
  }
  return null;
}
