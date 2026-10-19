import source from "./data/fountainNavigationV248.json";

type Ring = readonly (readonly number[])[];
function inside(x: number, z: number, ring: Ring): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) result = !result;
  }
  return result;
}
function near(x: number, z: number, radius = 0): boolean {
  const [x0, z0, x1, z1] = source.bounds;
  return Number.isFinite(x) && Number.isFinite(z) && x + radius >= x0 && x - radius <= x1 && z + radius >= z0 && z - radius <= z1;
}
function touchesRing(x: number, z: number, radius: number, ring: Ring): boolean {
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j], dx = bx - ax, dz = bz - az;
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared));
    if ((x - ax - t * dx) ** 2 + (z - az - t * dz) ** 2 <= radius * radius) return true;
  }
  return false;
}

/** Full vertical capsule overlap also detects a low rim between foot/midpoint samples. */
export function fountainBodyBlockedV248(x: number, z: number, bottomY: number, topY: number, radius: number, native = false): boolean {
  if (!near(x, z, radius) || !Number.isFinite(bottomY) || !Number.isFinite(topY)) return false;
  if (native) {
    for (const [x0, z0, x1, z1, low, high] of source.native) {
      if (bottomY >= high - .02 || topY <= low + .02) continue;
      const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
      if (dx * dx + dz * dz <= radius * radius) return true;
    }
  } else {
    for (const p of source.drawn) {
      if (bottomY >= p.topY - .02 || topY <= p.lowY + .02) continue;
      if (inside(x, z, p.ring) && !p.holes.some(hole => inside(x, z, hole))) return true;
      if (touchesRing(x, z, radius, p.ring) || p.holes.some(hole => touchesRing(x, z, radius, hole))) return true;
    }
  }
  return false;
}

/** Tops support descent only once the feet reach them; never step a visitor up onto the rim. */
export function fountainFloorV248At(x: number, z: number, footY: number | undefined, native = false): number | null {
  if (!near(x, z) || !Number.isFinite(footY)) return null;
  let top: number | null = null;
  if (native) {
    for (const [x0, z0, x1, z1, , high] of source.native) {
      if (footY! + .05 >= high && x >= x0 && x <= x1 && z >= z0 && z <= z1) top = Math.max(top ?? -Infinity, high);
    }
  } else {
    for (const p of source.drawn) {
      if (footY! + .05 >= p.topY && inside(x, z, p.ring) && !p.holes.some(hole => inside(x, z, hole))) top = Math.max(top ?? -Infinity, p.topY);
    }
  }
  return top;
}
