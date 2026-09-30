import source from "./unterDenLindenEntranceSource.json";

export const UNTER_DEN_LINDEN_ENTRANCE_SOURCE = source;
export const UNTER_DEN_LINDEN_ENTRANCE_DESCENT_M = 4.8;
export const UNTER_DEN_LINDEN_ENTRANCE_SURFACE_Y = 5.52;
export const UNTER_DEN_LINDEN_ENTRANCE_GROUP_NAME = "Unter den Linden five mapped U-Bahn entrances and two lifts";
export const MINECRAFT_UNTER_DEN_LINDEN_ENTRANCE_GROUP_NAME = "Block-native Unter den Linden U-Bahn entrances and lifts";
export const UNTER_DEN_LINDEN_ENTRANCE_RUNS = [...source.stairs, ...source.escalators].map(run => {
  const dx = run.bottom[0] - run.top[0], dz = run.bottom[1] - run.top[1];
  const length = Math.hypot(dx, dz), ux = dx / length, uz = dz / length;
  return { ...run, length, ux, uz, nx: -uz, nz: ux };
});
export const UNTER_DEN_LINDEN_ENTRANCE_OPENINGS = UNTER_DEN_LINDEN_ENTRANCE_RUNS.map(run => {
  const p = (u: number, v: number): [number, number] => [run.top[0] + run.ux * u + run.nx * v,
    run.top[1] + run.uz * u + run.nz * v];
  return { sourceId: run.osmWay, ring: [p(0, -run.width / 2), p(run.length, -run.width / 2),
    p(run.length, run.width / 2), p(0, run.width / 2)] };
});

/** Paired stair/escalator rectangles are merged by exit to avoid overlapping refill. */
export const UNTER_DEN_LINDEN_ENTRANCE_REGIONS = ["A", "B", "C", "D", "E"].map(ref => {
  const runs = UNTER_DEN_LINDEN_ENTRANCE_RUNS.filter(run => run.ref === ref);
  const openings = UNTER_DEN_LINDEN_ENTRANCE_OPENINGS.filter(opening => runs.some(run => run.osmWay === opening.sourceId));
  const points = openings.flatMap(opening => opening.ring);
  const minX = Math.floor((Math.min(...points.map(p => p[0])) - .5) / 4) * 4;
  const maxX = Math.ceil((Math.max(...points.map(p => p[0])) + .5) / 4) * 4;
  const minZ = Math.floor((Math.min(...points.map(p => p[1])) - .5) / 4) * 4;
  const maxZ = Math.ceil((Math.max(...points.map(p => p[1])) + .5) / 4) * 4;
  return { ref, minX, maxX, minZ, maxZ, openings };
});
export function pointInUnterDenLindenEntranceRegion(x: number, z: number): boolean {
  return UNTER_DEN_LINDEN_ENTRANCE_REGIONS.some(r => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
}
export function isUnterDenLindenEntranceReplacementCell(x: number, z: number, size: number): boolean {
  return UNTER_DEN_LINDEN_ENTRANCE_REGIONS.some(r => x < r.maxX && x + size > r.minX && z < r.maxZ && z + size > r.minZ);
}

export function unterDenLindenOpeningIntersectsCell(x: number, z: number, size: number): boolean {
  return UNTER_DEN_LINDEN_ENTRANCE_RUNS.some(run => {
    // Separating axes for the source-oriented rectangular mouth and native cell.
    const dx = x + size / 2 - (run.top[0] + run.bottom[0]) / 2;
    const dz = z + size / 2 - (run.top[1] + run.bottom[1]) / 2;
    return Math.abs(dx) < Math.abs(run.ux) * run.length / 2 + Math.abs(run.nx) * run.width / 2 + size / 2
      && Math.abs(dz) < Math.abs(run.uz) * run.length / 2 + Math.abs(run.nz) * run.width / 2 + size / 2
      && Math.abs(dx * run.ux + dz * run.uz) < run.length / 2 + size / 2 * (Math.abs(run.ux) + Math.abs(run.uz))
      && Math.abs(dx * run.nx + dz * run.nz) < run.width / 2 + size / 2 * (Math.abs(run.nx) + Math.abs(run.nz));
  });
}

export function unterDenLindenEntranceAt(x: number, z: number) {
  for (const run of UNTER_DEN_LINDEN_ENTRANCE_RUNS) {
    const dx = x - run.top[0], dz = z - run.top[1];
    const u = dx * run.ux + dz * run.uz, v = dx * run.nx + dz * run.nz;
    if (u >= 0 && u <= run.length && Math.abs(v) <= run.width / 2) return { run, u, v };
  }
  return null;
}

/** Source-positioned steps, with explicitly schematic vertical descent. */
export function unterDenLindenEntranceFloorAt(x: number, z: number, surfaceY = UNTER_DEN_LINDEN_ENTRANCE_SURFACE_Y): number | null {
  const hit = unterDenLindenEntranceAt(x, z);
  if (!hit) return null;
  return surfaceY - Math.min(hit.run.stepCount, Math.floor(hit.u / hit.run.length * hit.run.stepCount))
    * UNTER_DEN_LINDEN_ENTRANCE_DESCENT_M / hit.run.stepCount;
}

/** Only represented side walls and the back wall collide; the upper approach is open. */
export const UNTER_DEN_LINDEN_ENTRANCE_BARRIERS = UNTER_DEN_LINDEN_ENTRANCE_OPENINGS.flatMap(({ ring, sourceId }) =>
  [[ring[0], ring[1]], [ring[1], ring[2]], [ring[2], ring[3]]].map(([a, b]) => ({ a, b, radius: .13, sourceId })));
