/** Small independent terrain helper; importing it never loads the park geometry. */
export const EAST_PARKS_V198_MOUND = {
  x: 6740.976, z: 3791.879, radius: 29, plateauRadius: 29 * (1 - 16 / 19),
  groundY: 3, plateauY: 11,
  // Source axis from Der Befreier node to Mutter Heimat node.
  frontX: -0.792159, frontZ: -0.610315,
} as const;

/** Published 30 m ensemble, with explicitly illustrative 8 m mound subdivision. */
export function eastParksV198GroundAt(x: number, z: number): number | null {
  const m=EAST_PARKS_V198_MOUND,dx=x-m.x,dz=z-m.z,r=Math.hypot(dx,dz);
  if(r>m.radius)return null;
  const u=-m.frontZ*dx+m.frontX*dz,v=m.frontX*dx+m.frontZ*dz;
  const terrain=Math.min(m.plateauY,m.groundY+(m.radius-r)*8/(m.radius-m.plateauRadius));
  if(Math.abs(u)<=4&&v>=5&&v<=29){
    const step=Math.min(35,Math.floor((v-5)/(24/36)));
    return Math.max(terrain,11-(step+.5)*8/36+.20);
  }
  return terrain;
}
