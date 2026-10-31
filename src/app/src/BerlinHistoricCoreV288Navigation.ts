import profiles from './data/berlinHistoricCoreV288Navigation.json';

function inside(x: number, z: number, ring: number[][]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function contains(x: number, z: number, ring: number[][], holes: number[][][]): boolean {
  return inside(x, z, ring) && !holes.some(r => inside(x, z, r));
}

/** Lightweight resident navigation: no constructor, wall sheets, source-parts
 * object or geometry recipe is captured by these closures. Viewer Y is frozen. */
export function berlinHistoricDomSolidsV288() {
  return profiles.map(profile => ({
    sourceId: profile.id, ring: profile.ring, holes: profile.holes, minY: profile.ground, maxY: profile.top,
    topAt(x: number, z: number): number | null {
      if (!contains(x, z, profile.ring, profile.holes)) return null;
      let top: number | null = null;
      for (const roof of profile.roofs) {
        if (!contains(x, z, roof.rings[0], roof.rings.slice(1))) continue;
        const [nx, ny, nz] = roof.normal, a = roof.a;
        top = Math.max(top ?? -Infinity, Math.min(profile.top, a[1] - (nx * (x - a[0]) + nz * (z - a[2])) / ny));
      }
      return top ?? profile.top;
    },
  }));
}
