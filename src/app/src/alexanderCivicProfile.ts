import source from "./alexanderCivicSource.json";
import { bebelplatzPartContains, bebelplatzPartRoofAt, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const ALEXANDER_CIVIC_SOURCE = source;
export const ALEXANDER_CIVIC_SOURCES = Object.values(source.profiles);
export const ALEXANDER_CIVIC_PARTS = ALEXANDER_CIVIC_SOURCES.flatMap(s => s.parts);
export const ALEXANDER_CIVIC_PRISM_IDS = new Set(ALEXANDER_CIVIC_SOURCES.flatMap(s => s.replaced_prism_ids));
export const ALEXANDER_CIVIC_GROUP_NAME = "Rotes Rathaus and St. Marien source-bound architecture";
export const MINECRAFT_ALEXANDER_CIVIC_GROUP_NAME = "Block-native Rotes Rathaus and St. Marien architecture";
export const MARIEN_TOWER_PART_IDS = new Set(["DEBE3Dm03ICrhanR", "DEBE3DdD31Y72ErY"]);
export const RATHAUS_TOWER_PLATFORM = 77.46;
export const RATHAUS_TERMINAL = {x:2495.891,z:99.061,base:77.6,top:97.46,radius:2.8} as const;
export const RATHAUS_TOWER_ID = "DEBE3DgmfpurHZfT";
/** Footprint/height anchors are source values; intermediate subdivisions are photo fits. */
export const MARIEN_TOWER = {
  x:2397.5675,z:-131.4865,yaw:.054,
  groundY:4.607,masonryTop:42.4,clockTop:55.3,
  lanternBase:56.2,lanternSpring:65.9,lanternTop:70.5,
  spireTop:83.072,finialTop:87.4,
  stoneWidth:13,clockWidth:10.2,lanternRadius:4.75,
} as const;
export function isAlexanderCivicReplacementColumn(x:number,z:number):boolean {
  if(x<2388||x>2585||z< -151||z>193)return false;
  return ALEXANDER_CIVIC_SOURCES.some(s=>s.parts.some(p=>bebelplatzPartContains(p,x,z)) || (s.previous_display_prisms as {ring:number[][];holes:number[][][]}[]).some(p=>pointInWorldRing(x*10,z*10,p.ring as unknown as WorldRing)&&!p.holes.some(h=>pointInWorldRing(x*10,z*10,h as unknown as WorldRing))));
}
export function alexanderCivicPartRoofAt(part:BebelplatzSourcePart,x:number,z:number):number|null {
  if(part.id===RATHAUS_TOWER_ID && bebelplatzPartContains(part,x,z))return RATHAUS_TOWER_PLATFORM;
  return bebelplatzPartRoofAt(part,x,z);
}
export function marienTowerLocal(x:number,z:number):[number,number] {
  const dx=x-MARIEN_TOWER.x,dz=z-MARIEN_TOWER.z,c=Math.cos(MARIEN_TOWER.yaw),s=Math.sin(MARIEN_TOWER.yaw);
  return [c*dx-s*dz,s*dx+c*dz];
}
/** Exclude both original tower part IDs from coarse prisms and use these represented solids. */
export function alexanderCivicTowerSolidAt(x:number,z:number,footY:number,height=1.8):boolean {
  const p=MARIEN_TOWER,[u,v]=marienTowerLocal(x,z),max=footY+height;
  if(max<p.groundY||footY>p.finialTop||Math.hypot(u,v)>10)return false;
  if(footY<p.masonryTop && max>p.groundY && Math.abs(u)<6.65 && Math.abs(v)<6.65)return true;
  if(footY<p.lanternBase && max>p.masonryTop && Math.abs(u)<5.35 && Math.abs(v)<5.35)return true;
  if(footY<p.lanternTop && max>p.lanternBase){
    for(let i=0;i<8;i++){const t=i*Math.PI/4;if(Math.hypot(u-Math.cos(t)*p.lanternRadius,v-Math.sin(t)*p.lanternRadius)<.35)return true;}
    if(max>p.lanternSpring && Math.hypot(u,v)>3.55 && Math.hypot(u,v)<5.1)return true;
  }
  if(max>p.lanternTop && footY<p.spireTop){const y=Math.max(footY,p.lanternTop);if(Math.hypot(u,v)<marienSpireRadius(y))return true;}
  return max>p.spireTop && Math.hypot(u,v)<.8;
}
export function alexanderCivicWalkableAt(x:number,y:number,z:number,sourceId?:string):boolean {
  if(sourceId&&!MARIEN_TOWER_PART_IDS.has(sourceId)&&sourceId!=="474111581")return false;
  return y>=MARIEN_TOWER.lanternBase+.3 && y<MARIEN_TOWER.lanternSpring && Math.hypot(x-MARIEN_TOWER.x,z-MARIEN_TOWER.z)<4.3 && !alexanderCivicTowerSolidAt(x,z,y,.01);
}

export function alexanderCivicPartBaseAt(part:BebelplatzSourcePart):number { return Math.max(5.2,part.ground_y_m); }

export function marienSpireRadius(y:number):number {
  const t=Math.max(0,Math.min(1,(y-MARIEN_TOWER.lanternTop)/(MARIEN_TOWER.spireTop-MARIEN_TOWER.lanternTop))),profile=[[0,1],[.15,.8],[.38,.34],[.85,.24],[1,.08]];
  for(let i=1;i<profile.length;i++)if(t<=profile[i][0]){const [a,r]=profile[i-1],[b,s]=profile[i];return 4.8*(r+(s-r)*(t-a)/(b-a));}
  return .384;
}
export function rathausTerminalSolidAt(x:number,z:number,footY:number,height=1.8):boolean {
  const p=RATHAUS_TERMINAL;if(footY+height<p.base||footY>p.top)return false;
  const dx=x-p.x,dz=z-p.z;if(Math.hypot(dx,dz)<.16)return true;
  const a=Math.max(footY,p.base),b=Math.min(footY+height,p.top-3.1);if(a>b)return false;
  const near=(p.top-3.1-b)/(p.top-3.1-p.base)*1.8,far=(p.top-3.1-a)/(p.top-3.1-p.base)*1.8;
  return Math.abs(Math.abs(dx)-Math.abs(dz))<.27 && Math.abs(dx)>near-.16 && Math.abs(dx)<far+.16;
}
