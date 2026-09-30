import source from "./leipzigerPlatzSource.json";
import { bebelplatzPartContains, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";
import { leipzigerTranslatedPart } from "./leipzigerPlatzSourceProfile";

export const LEIPZIGER_PERIMETER_KEYS = ["northWest", "mosse", "northEast", "west", "southWest", "southMiddleWest", "southMiddleWestLowerFront", "southMiddleWestUpperFront", "southMiddleEast", "southEast", "eastChamfer", "east"] as const;
export type LeipzigerPerimeterKey = typeof LEIPZIGER_PERIMETER_KEYS[number];
export type PerimeterRun = { key: LeipzigerPerimeterKey; partId: string; a: [number, number]; b: [number, number]; normal: [number, number]; length: number; bottom: number; top: number; ground: number; wallIndex: number };
export const LEIPZIGER_PERIMETER_EVIDENCE = {
  northWest: "Conservative pale stone/window grid from Commons panorama; no unverified tenant sign",
  mosse: "Modern Mosse-Palais: warm stone, grouped windows, central glazed bay and curved roof retained in LoD2",
  northEast: "Conservative pale stone/window grid from Commons panorama; no unverified tenant sign",
  west: "TRION: deep precast frame and near-square glazing above tall glazed base",
  southWest: "Leipziger Platz 1–3: vertical Torhaus, limestone Stadtpalais, three bronze/black-glass Kontorhaus fields",
  southMiddleWest: "Source-bound southern frontage; conservative stone/window grid, no guessed tenant sign",
  southMiddleWestLowerFront: "LP7 separately identified official projecting lower facade strip; preserve its full source planes",
  southMiddleWestUpperFront: "LP7 separately identified official upper facade strip; preserve its full source planes",
  southMiddleEast: "Leipziger Platz 8: sandstone grid and tall bronze foyer; exact stepped source roof retained",
  southEast: "Classicon / Leipziger Platz 9 (Spionagemuseum address anchor): horizontal glazed and bronze-toned facade fields",
  eastChamfer: "Photo-observed projecting rectangular window frames; no unverified tenant sign",
  east: "Photo-observed pale stone grid, larger lower panes and retained upper setbacks",
} as const;
const profiles = source.profiles as Record<string, { parts: BebelplatzSourcePart[]; display_y_translation_m: number }>;
export const LEIPZIGER_PERIMETER_PARTS = LEIPZIGER_PERIMETER_KEYS.flatMap(key => (profiles[key]?.parts ?? []).map(p => ({ key, part: leipzigerTranslatedPart(p, profiles[key].display_y_translation_m) })));
const plaza = [451, 1042] as const;
export function perimeterPoint(run: PerimeterRun, u: number, out = .2): [number, number] {
  return [run.a[0] + (run.b[0]-run.a[0])*u/run.length + run.normal[0]*out, run.a[1] + (run.b[1]-run.a[1])*u/run.length + run.normal[1]*out];
}
/** Select genuine source wall planes, never a bounding rectangle through a court. */
function sourceRuns(): PerimeterRun[] {
  const runs: PerimeterRun[]=[];
  for (const {key, part} of LEIPZIGER_PERIMETER_PARTS) {
    const ground = Math.min(...LEIPZIGER_PERIMETER_PARTS.filter(p=>p.key===key).map(p=>p.part.ground_y_m));
    part.surfaces.forEach((surface,wallIndex)=>{
      if(surface.kind!=="WallSurface")return;
      const ring=surface.rings[0]; let pair:[number[],number[]]|null=null, length=0;
      for(const p of ring)for(const q of ring){const l=Math.hypot(p[0]-q[0],p[2]-q[2]);if(l>length){length=l;pair=[p,q];}}
      if(!pair||length<1.05)return;
      const a:[number,number]=[pair[0][0],pair[0][2]],b:[number,number]=[pair[1][0],pair[1][2]];
      const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],normal:[number,number]=[(b[1]-a[1])/length,-(b[0]-a[0])/length];
      if(bebelplatzPartContains(part,mid[0]+normal[0]*.05,mid[1]+normal[1]*.05)){normal[0]*=-1;normal[1]*=-1;}
      const delta=[plaza[0]-mid[0],plaza[1]-mid[1]],dot=normal[0]*delta[0]+normal[1]*delta[1];
      if(dot<Math.hypot(...delta)*.35)return;
      // This is an additive square-facing relief pass. Backyard/court windows are
      // deliberately not invented. Existing full source walls remain untouched.
      if((key==="northWest"||key==="mosse"||key==="northEast")&&mid[1]<948)return;
      if(key==="west"&&mid[0]<357)return;
      if(key==="southWest"&&mid[1]>1130)return;
      if((key.startsWith("southMiddleWest")||key==="southMiddleEast"||key==="southEast")&&mid[1]>1128)return;
      if(key==="eastChamfer"&&(mid[0]>542||mid[1]>1107))return;
      if(key==="east"&&mid[0]>541)return;
      const bottom=Math.min(...ring.map(p=>p[1])),top=Math.max(...ring.map(p=>p[1]));
      if(top-bottom<1.2)return;
      runs.push({key,partId:part.id,a,b,normal,length,bottom,top,ground,wallIndex});
    });
  }
  return runs;
}
export const LEIPZIGER_PERIMETER_RUNS = sourceRuns();
/** Prevent an internal wall's glazing being drawn through another source solid. */
export function perimeterExposed(run: PerimeterRun,u: number,y: number): boolean {
  const p=perimeterPoint(run,u,.35);
  return !LEIPZIGER_PERIMETER_PARTS.some(({part})=>part.id!==run.partId&&part.ground_y_m<y+.1&&part.top_y_m>y-.1&&bebelplatzPartContains(part,p[0],p[1]));
}
