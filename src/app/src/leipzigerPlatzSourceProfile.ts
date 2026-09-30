import source from "./leipzigerPlatzSource.json";
import { bebelplatzPartContains, bebelplatzPartRoofAt, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";

export const LEIPZIGER_SOURCE_PROFILES = Object.values(source.profiles);
export const LEIPZIGER_SOURCE_PRISM_IDS = new Set(
  LEIPZIGER_SOURCE_PROFILES.flatMap(profile => profile.replaced_prism_ids),
);
export const LEIPZIGER_SOURCE_GROUP_NAME = "Complete Leipziger Platz and Mall source envelopes";

/** Original JSON stays untouched; all parts of one parent share one rigid shift. */
export function leipzigerTranslatedPart(part: BebelplatzSourcePart, shift: number): BebelplatzSourcePart {
  return {
    ...part,
    ground_y_m: part.ground_y_m + shift,
    top_y_m: part.top_y_m + shift,
    surfaces: part.surfaces.map(surface => ({
      ...surface,
      rings: surface.rings.map(ring => ring.map(([x, y, z]) => [x, y + shift, z])),
    })),
  };
}
export const LEIPZIGER_SOURCE_PARTS: BebelplatzSourcePart[] = LEIPZIGER_SOURCE_PROFILES.flatMap(
  profile => profile.parts.map(part => leipzigerTranslatedPart(part, profile.display_y_translation_m)),
);
export const LEIPZIGER_VOSSPALAIS_PROFILE = {
  parentId: source.profiles.vosspalais.parent_id,
  partIds: source.profiles.vosspalais.parts.map(part => part.id),
  osmIdentity: "way/503373675",
  front: [[675.561, 892.023], [691.126, 887.49]] as const,
  rearSetback: [[676.005, 899.179], [693.126, 894.227]] as const,
  groundY: 5.4,
  frontHeight: 20.001,
  maximumHeight: 26.099,
  sandstone: 0xa66b54,
  geometryStatus: "Complete five-part official envelope; four street window axes, projecting central pair, arch and ornament dimensions are source-bounded visual interpretation",
} as const;
export function leipzigerSourceRoofAt(part: BebelplatzSourcePart, x: number, z: number): number | null {
  return bebelplatzPartRoofAt(part, x, z);
}

export const LEIPZIGER_MALL_PASSAGE_PART = LEIPZIGER_SOURCE_PARTS.find(part => part.id === "DEBE00YY1mc0004E")!;
export function leipzigerPartSolidBase(part: BebelplatzSourcePart): number {
  if (part.id === "DEBE00YY1mc0004E" || !part.surfaces.some(s => s.kind === "WallSurface")) {
    return Math.min(...part.surfaces.filter(s => s.kind === "RoofSurface").flatMap(s => s.rings.flat().map(p => p[1]))) - .2;
  }
  return part.ground_y_m;
}
/** Only columns under the roof: cells touching neighbouring Mall bodies remain. */
export function isLeipzigerMallPassageColumn(x: number, z: number, halfCell = 0): boolean {
  const p = LEIPZIGER_MALL_PASSAGE_PART;
  if (x < 619 || x > 649 || z < 915 || z > 992) return false;
  return bebelplatzPartContains(p, x, z) && [-halfCell, halfCell].every(dx => [-halfCell, halfCell].every(dz =>
    !LEIPZIGER_SOURCE_PARTS.some(other => other !== p && bebelplatzPartContains(other, x + dx, z + dz)),
  ));
}
/** Sample the exact roof intersection for the authored transverse steel ribs. */
export function leipzigerMallRoofRib(along: number): [number, number, number][] {
  const origin = [633.506, 953.597], axis = [.07865, .9969], cross = [axis[1], -axis[0]], ring = LEIPZIGER_MALL_PASSAGE_PART.ring;
  const xs: number[] = [];
  for (let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length];
    const da=(a[0]-origin[0])*axis[0]+(a[1]-origin[1])*axis[1]-along;
    const db=(b[0]-origin[0])*axis[0]+(b[1]-origin[1])*axis[1]-along;
    if((da<0)===(db<0))continue;
    const t=da/(da-db),x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
    xs.push((x-origin[0])*cross[0]+(z-origin[1])*cross[1]);
  }
  if(xs.length<2)return [];
  const lo=Math.min(...xs)+.015,hi=Math.max(...xs)-.015;
  const points: [number,number,number][]=[];
  for(let i=0;i<=16;i++){
    const crossDistance=lo+(hi-lo)*i/16,x=origin[0]+axis[0]*along+cross[0]*crossDistance,z=origin[1]+axis[1]*along+cross[1]*crossDistance;
    const y=leipzigerSourceRoofAt(LEIPZIGER_MALL_PASSAGE_PART,x,z);
    if(y!==null)points.push([x,y+.04,z]);
  }
  return points;
}
