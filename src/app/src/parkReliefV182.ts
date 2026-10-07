import relief from "./data/parkReliefV182.json";

/** Same 10m official DGM triangles as the offline park packet splitter. */
export function parkReliefAt(x: number, z: number, baseline = 3, native = false): number {
  for (const profile of relief.profiles) {
    const [west, north, east, south] = profile.support;
    if (x <= west || x >= east || z <= north || z >= south) continue;
    if (native) { x = Math.floor(x / 4) * 4 + 2; z = Math.floor(z / 4) * 4 + 2; }
    if (x <= west || x >= east || z <= north || z >= south) return baseline;
    const u = (x - west) / profile.stepM, v = (z - north) / profile.stepM;
    const ix = Math.floor(u), iz = Math.floor(v), a = u - ix, b = v - iz;
    const sample = (values: number[][]) => {
      const nw = values[iz][ix], ne = values[iz][ix+1], sw = values[iz+1][ix], se = values[iz+1][ix+1];
      return a >= b ? nw*(1-a)+ne*(a-b)+se*b : nw*(1-b)+sw*(b-a)+se*a;
    };
    return baseline + sample(profile.offsets) + (3-baseline)*sample(profile.weights);
  }
  return baseline;
}

const coreRelief = relief.profiles.find(p => p.name === "Volkspark Humboldthain")!.support;
export function coreParkReliefContains(x: number, z: number): boolean {
  return x >= coreRelief[0] - 16 && x <= coreRelief[2] + 16 && z >= coreRelief[1] - 16 && z <= coreRelief[3] + 16;
}
