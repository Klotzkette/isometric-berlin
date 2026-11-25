import source from "./leipzigerPlatzSource.json";
import { bebelplatzPartContains, bebelplatzPartRoofAt, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";

export const LEIPZIGER_SOURCE_PROFILES = Object.values(source.profiles);
export const LEIPZIGER_SOURCE_PRISM_IDS = new Set(
  LEIPZIGER_SOURCE_PROFILES.flatMap(profile => profile.replaced_prism_ids),
);
// Two bare CityGML bridge envelopes were extruded to street level by the
// original footprint converter. Two public gallery decks replace each one.
export const MALL_PIAZZA_BRIDGE_PRISMS = new Set(["ANtdjIMa", "f8929NwV"]);
export const MALL_PIAZZA_GALLERY_CORNERS = [[623.44,978.45],[619.78,931.54],[643.59,929.69],[647.26,976.60]];
// OSM area:highway=footway, covered=yes, way 194066305, projected in EPSG:25833.
// The narrow arms are the paved approaches to Voßstraße and Leipziger Straße.
export const mallPiazzaFootwayV385 = [
  [646.53,1013.76],[630.36,1015.17],[630.27,1013.92],[628.58,991.48],[627.9,983.05],
  [623.74,983.31],[623.44,978.45],[619.78,931.54],[619.34,925.09],[623.75,924.74],
  [623.09,916.51],[622.08,897.92],[629.7,897.37],[637.29,896.75],[638.47,915.29],
  [639.19,924.41],[643.06,924.1],[643.59,929.69],[644.79,945.1],[647.26,976.6],
  [647.73,981.6],[644.2,981.88],[644.74,988.63],[644.86,990.2],[644.98,991.91],[646.42,1012.66],
];

// The original grass runs are graded at their midpoints, often well
// outside this footway. Their tops reach 5.40 m at Voßstraße and remain
// at 5.00 m all the way to z=968. Grade the paved surface over those two
// changes without moving any surrounding sidewalk or building.
export const mallPiazzaPavingProfileV385 = [
  [896,5.45],[900,5.45],[908,5.33],[962.5,5.33],[970.5,4.93],[1016,4.93],
];
export function mallPiazzaPavingHeightV385(z: number): number {
  for (let i=1; i<mallPiazzaPavingProfileV385.length; i++) {
    const [end,endY]=mallPiazzaPavingProfileV385[i];
    if (z > end) continue;
    const [start,startY]=mallPiazzaPavingProfileV385[i-1];
    return startY + (endY-startY) * Math.max(0,(z-start)/(end-start));
  }
  return 4.93;
}
export const MALL_PIAZZA_DECK_Y = [10.25, 15.58];
export function mallPiazzaCrossingRingV385(id: string): number[][] {
  const i = id === "ANtdjIMa" ? 3 : 1;
  const a = MALL_PIAZZA_GALLERY_CORNERS[i], b = MALL_PIAZZA_GALLERY_CORNERS[(i + 1) % 4];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = 1.175 * (b[1] - a[1]) / length, nz = 1.175 * (a[0] - b[0]) / length;
  return [[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]];
}
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
