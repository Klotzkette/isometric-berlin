import source from "./potsdamerMinistrySource.json";
import { bebelplatzPartRoofAt } from "./bebelplatzBuildingProfile";
export const POTSDAMER_MINISTRY_SOURCE = source;
export const POTSDAMER_MINISTRY_BUILDINGS = source.buildings;
export type PotsdamerMinistryBuilding = typeof source.buildings[number];
/** Source elevations retain one explicit terrain registration per complete family. */
export function potsdamerMinistryRoofAt(building: PotsdamerMinistryBuilding, x:number,z:number):number|null {
  let top:number|null=null;
  for(const p of building.officialParts){const h=bebelplatzPartRoofAt(p,x,z);if(h!==null)top=Math.max(top??-Infinity,h+building.displayYTranslationM);}
  return top;
}
