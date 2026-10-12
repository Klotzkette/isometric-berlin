import navigation from "./data/springerV215Navigation.json";
import profile from "./data/springerV215Profile.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const SPRINGER_V215_PROFILE = profile;
export const SPRINGER_V215_OWNER = /*#__PURE__*/ (() => profile.owner)();
export const SPRINGER_V215_CURRENT_OWNER = /*#__PURE__*/ (() => profile.currentOwner)();
export const SPRINGER_V215_ANCHOR = /*#__PURE__*/ (() => profile.anchor)();
const contains = (x: number, z: number, ring: number[][]) =>
  pointInWorldRing(x, z, ring as unknown as WorldRing);

type Part = {
  id: string; sourceId?: string; ring: readonly (readonly number[])[];
  holes: readonly (readonly (readonly number[])[])[]; groundY: number; topY: number;
};

/** Replace only the identified predecessor's physical footprint. Its old prism
 * remains in the independent coarse-voxel removal predicate, preventing ghosts. */
export function correctedSpringerPartsV215<T extends Part>(parts: readonly T[]): T[] {
  return parts.map(part => part.id !== SPRINGER_V215_OWNER ? part : {
    ...part, sourceId: SPRINGER_V215_CURRENT_OWNER,
    ring: navigation.ring, holes: navigation.holes,
    groundY: navigation.groundY, topY: navigation.roofY + .12,
  });
}

function drawnRoofAt(x: number, z: number): number | null {
  let highest: number | null = null;
  for (const [a,b,c] of navigation.roofTriangles) {
    const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if (Math.abs(d)<1e-9) continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
    if (u < -1e-6 || v < -1e-6 || u+v > 1+1e-6) continue;
    const y=u*a[1]+v*b[1]+(1-u-v)*c[1];
    highest=highest===null?y:Math.max(highest,y);
  }
  return highest;
}

let nativeCells: Map<number, Map<number, (number | null)[]>> | undefined;
/** Read only compact actual roof faces/cells, never the rendering payload. */
export function correctedSpringerRoofAtV215(
  x: number, z: number, native: boolean, original: number | null,
): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(z) || x < -130 || x > -60 || z < -1745 || z > -1685) return original;
  if (native) {
    if (!nativeCells) {
      nativeCells=new Map();
      for (const [cx,cz,oldY,newY] of navigation.nativeChangedRoofCells) {
        let column=nativeCells.get(cx!);
        if (!column) nativeCells.set(cx!,column=new Map());
        column.set(cz!,[oldY,newY]);
      }
    }
    const changed=nativeCells.get(Math.floor(x))?.get(Math.floor(z));
    if (!changed) return original;
    const [oldY,newY]=changed;
    if (original === oldY || (original !== null && oldY !== null && Math.abs(original-oldY)<.02)) return newY;
    return newY===null?original:Math.max(original??-Infinity,newY);
  }
  const current=drawnRoofAt(x,z);
  if (contains(x,z,navigation.oldRing) && original!==null && Math.abs(original-navigation.oldRoofY)<.02) return current;
  return current===null?original:Math.max(original??-Infinity,current);
}
