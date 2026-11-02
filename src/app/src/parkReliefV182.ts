import relief from "./data/parkReliefV182.json";
import fritz from "./data/parkReliefV183.json";

import { WALL_GALLERY_HILL_BOUNDS_V298, wallGalleryHillContainsV298, wallGalleryHillGroundAtV298 } from "./wallGalleryV298Profile";

const profiles = [...relief.profiles, ...fritz.profiles];
export const coreParkReliefSupports = [
  relief.profiles.find(p => p.name === "Volkspark Humboldthain")!.support,
  ...fritz.profiles.map(p => p.support),
  WALL_GALLERY_HILL_BOUNDS_V298,
];

/** Same 10m official DGM triangles as the offline park packet splitter. */
export function parkReliefAt(x: number, z: number, baseline = 3, native = false): number {
  const mauerpark = wallGalleryHillGroundAtV298(x, z, native, baseline);
  if (mauerpark !== null) return mauerpark;
  for (const profile of profiles) {
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

export function coreParkReliefContains(x: number, z: number): boolean {
  return wallGalleryHillContainsV298(x, z) || coreParkReliefSupports.slice(0, -1).some(support => x >= support[0] - 16 && x <= support[2] + 16 &&
    z >= support[1] - 16 && z <= support[3] + 16);
}
