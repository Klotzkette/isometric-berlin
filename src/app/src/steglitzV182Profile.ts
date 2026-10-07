import navigation from "./data/steglitzV182Navigation.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

/** Complete physical source footprints, including mapped holes and separate parts. */
export const STEGLITZ_V182_PARTS = navigation.buildings;
export const STEGLITZ_V182_FOCUS = [-3632.2, 45, 6932.52] as const;

export function steglitzV182RoofAt(x: number, z: number, minecraft = false): number | null {
  if (x < -4000 || x > -3100 || z < 6600 || z > 7400) return null;
  let height: number | null = null;
  for (const [a,b,c] of navigation.roofTriangles) {
    const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if (Math.abs(d)<1e-9) continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
    if (u<-.000001 || v<-.000001 || u+v>1.000001) continue;
    const y=u*a[1]+v*b[1]+(1-u-v)*c[1];
    height=Math.max(height??-Infinity,minecraft?Math.floor(y)+1:y);
  }
  // The narrow memorial and its nine panels are separate from the full square.
  const wall=navigation.buildings.find(p=>p.id==="way/775632534")!;
  if (pointInWorldRing(x,z,wall.ring as unknown as WorldRing)) height=Math.max(height??-Infinity,wall.topY);
  return height;
}
