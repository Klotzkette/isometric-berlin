type Outline = { ring: number[][]; holes?: number[][][] };

function inRing(ring: number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    // Keep the original arithmetic and strict boundary comparisons. Direct
    // indexing avoids iterators for every edge of every facade sample.
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Construction-scoped predicate: no persistent cache or copied source rings. */
export function preparePrismContainment(part: Outline): (x: number, z: number) => boolean {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of part.ring) {
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
    z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]);
  }
  return (x, z) => {
    x *= 10; z *= 10;
    if (x < x0 || x > x1 || z < z0 || z > z1 || !inRing(part.ring, x, z)) return false;
    for (const hole of part.holes ?? []) if (inRing(hole, x, z)) return false;
    return true;
  };
}
