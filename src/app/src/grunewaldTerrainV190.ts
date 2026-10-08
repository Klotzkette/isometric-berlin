import field from "./data/grunewaldTerrainV190.json";

type Profile = { support: number[]; stepM: number; offsets: number[][] };
function sample(profile: Profile, x: number, z: number): number {
  const [west, north, east, south] = profile.support;
  if (x <= west || x >= east || z <= north || z >= south) return 0;
  const u = (x-west)/profile.stepM, v = (z-north)/profile.stepM;
  const ix = Math.floor(u), iz = Math.floor(v), a = u-ix, b = v-iz;
  const nw = profile.offsets[iz][ix], ne = profile.offsets[iz][ix+1];
  const sw = profile.offsets[iz+1][ix], se = profile.offsets[iz+1][ix+1];
  return a >= b ? nw*(1-a)+ne*(a-b)+se*b : nw*(1-b)+sw*(b-a)+se*a;
}

/** Same measured piecewise planes and native8m terraces as prepared packets. */
export function grunewaldTerrainOffset(x: number, z: number, native = false): number {
  if (native) { x = Math.floor(x/8)*8+4; z = Math.floor(z/8)*8+4; }
  for (let i = field.profiles.length-1; i > 0; i--) {
    const profile = field.profiles[i], [west,north,east,south] = profile.support;
    if (x > west && x < east && z > north && z < south) return sample(profile,x,z);
  }
  return sample(field.profiles[0],x,z);
}

export function grunewaldGroundAt(x: number, z: number, baseline = 3, native = false): number {
  return baseline + grunewaldTerrainOffset(x,z,native);
}
