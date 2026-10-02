import source from "./data/teehausRuinV168Navigation.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
export const TEEHAUS_RUIN_V168_PRISM_IDS: ReadonlySet<string> = new Set(source.legacyPrisms.map(p=>p.id));
export const TEEHAUS_RUIN_V168_WALLS = source.walls;
export function teehausRuinV168SourceColumn(x:number,z:number,base:number,top:number):boolean {
  if(x < -1601 || x > -1562 || z < 146 || z > 173)return false;
  return source.legacyPrisms.some(p=>Math.abs(base-p.y0_dm/10)<.11 && Math.abs(top-base-Math.ceil(p.h_dm/40)*4)<.11 && pointInWorldRing(x*10,z*10,p.ring as unknown as WorldRing) && !p.holes.some(h=>pointInWorldRing(x*10,z*10,h as unknown as WorldRing)));
}
