import source from "./data/iccV199Navigation.json";

function inside(x: number, z: number, ring: readonly number[][]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

/** The complete measured building volumes replace only their former coarse owners. */
export function iccV199SolidAt(x: number, y: number, z: number, radius = 0): boolean {
  if (x < -6370 - radius || x > -6140 + radius || z < 1290 - radius || z > 1660 + radius) return false;
  for (const p of source.buildings) {
    if (y < p.groundY || y > p.topY) continue;
    for (const [dx, dz] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]) {
      if (inside(x + dx, z + dz, p.ring) && !p.holes.some(h => inside(x + dx, z + dz, h))) return true;
    }
  }
  return false;
}
