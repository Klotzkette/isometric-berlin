import source from "./data/grosserSternGatehousesV164Source.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const GROSSER_STERN_GATEHOUSES_V164_PROFILE = source.houses;
export const GROSSER_STERN_GATEHOUSES_V164_PRISM_IDS = new Set(source.legacyPrisms.map(p => p.id));
export type GatehouseV164 = typeof source.houses[number];

export function gatehouseV164Local(h: GatehouseV164, x: number, z: number): [number, number] {
  const dx = x - h.center[0], dz = z - h.center[1];
  return [dx * h.right[0] + dz * h.right[1], dx * h.front[0] + dz * h.front[1]];
}
export function gatehouseV164World(h: GatehouseV164, x: number, y: number, z: number): [number, number, number] {
  return [h.center[0] + x * h.right[0] + z * h.front[0], h.groundY + y, h.center[1] + x * h.right[1] + z * h.front[1]];
}
/** Only the eight precisely matched retired prisms, never nearby roads or park. */
export function grosserSternGatehouseSourceColumn(x: number, z: number, base: number, top: number): boolean {
  if (x < -1590 || x > -1330 || z < 400 || z > 511) return false;
  return source.legacyPrisms.some(p => Math.abs(base-p.y0_dm/10) < .11 && Math.abs(top-base-Math.ceil(p.h_dm/40)*4) < .11 && pointInWorldRing(x*10,z*10,p.ring as unknown as WorldRing));
}
/** Physical square piers and enclosing walls; the porch and stair hall stay open. */
export function grosserSternGatehouseSolidAt(x: number, y: number, z: number, radius = 0): boolean {
  if (x < -1590-radius || x > -1330+radius || z < 399-radius || z > 512+radius) return false;
  for (const h of source.houses) {
    const [u,v]=gatehouseV164Local(h,x,z), yy=y-h.groundY, w=h.widthM/2, d=h.bodyDepthM/2;
    if (yy < -3.1 || yy > h.ridgeM + .2) continue;
    if (yy < 0 && Math.abs(u)>2.56-radius && Math.abs(u)<2.78+radius && Math.abs(v)<d+.05) return true;
    if (yy > h.eaveM-.45 && Math.abs(u) < w+.2+radius && v > -d-.2-radius && v < d+h.porticoDepthM+.2+radius) return true;
    if (yy < h.eaveM && Math.abs(u) > w-.42-radius && Math.abs(u) < w+.08+radius && Math.abs(v)<d+radius) return true;
    if (yy < h.eaveM && Math.abs(u)<w+radius && Math.abs(v+d)<.24+radius) return true;
    const pierZ=d+h.porticoDepthM-.42;
    for (const ratio of [-.87,-.29,.29,.87]) if (yy<5.65&&Math.abs(u-ratio*w)<.38+radius&&Math.abs(v-pierZ)<.4+radius) return true;
  }
  return false;
}
export function grosserSternGatehousePassageAt(x:number,y:number,z:number,sourceId?:string):boolean {
  if (sourceId && !GROSSER_STERN_GATEHOUSES_V164_PRISM_IDS.has(sourceId) && !source.parts.some(p=>p.id===sourceId)) return false;
  for (const h of source.houses) {
    const [u,v]=gatehouseV164Local(h,x,z), d=h.bodyDepthM/2;
    if (y>=h.groundY-3.05&&y<h.groundY+5.4&&Math.abs(u)<h.widthM/2-.55&&v>-d+.6&&v<d+h.porticoDepthM+1&&!grosserSternGatehouseSolidAt(x,y,z,.25)) return true;
  }
  return false;
}
export function grosserSternGatehouseRoofAt(x:number,z:number,_minecraft=false):number|null {
  for(const h of source.houses){
    const [u,v]=gatehouseV164Local(h,x,z),w=h.widthM/2+.14,d=h.bodyDepthM/2;
    if(Math.abs(u)>w||v< -d-.15||v>d+h.porticoDepthM+.15)continue;
    if(v>d)return h.groundY+6.1+.85*(1-Math.abs(u)/w);
    const slope=Math.min(1-Math.abs(u)/w,Math.max(0,(v+d)/3.5));
    return h.groundY+h.eaveM+(h.ridgeM-h.eaveM)*Math.max(0,slope);
  }
  return null;
}

/** Source-bound navigation envelopes; corrected roof heights stay explicit. */
export const GROSSER_STERN_GATEHOUSES_V164_PARTS = source.parts.map(p=>{
  const h=source.houses.find(h=>h.bodyId===p.legacyId||h.porticoId===p.legacyId)!;
  const height=p.legacyId===h.bodyId?h.ridgeM:7.1;
  return {id:p.id,parentId:p.id,ring:p.footprint,holes:[],ground_y_m:h.groundY,height_m:height,top_y_m:h.groundY+height};
});
/** Four small stair wells only. Original paths and terrain outside remain intact. */
export const GROSSER_STERN_GATEHOUSES_V164_GROUND_CUTS = source.houses.map(h=>{
  const d=h.bodyDepthM/2;
  return [[-2.58,-d+.42],[2.58,-d+.42],[2.58,d-.34],[-2.58,d-.34]].map(([x,z])=>{const p=gatehouseV164World(h,x,0,z);return [p[0],p[2]] as [number,number];});
});
export function grosserSternGatehouseFloorAt(x:number,z:number):number|null{
  for(const h of source.houses){const [u,v]=gatehouseV164Local(h,x,z),d=h.bodyDepthM/2;
    if(Math.abs(u)>2.54||v< -d+.4||v>d+.12)continue;
    const step=Math.min(15,Math.max(0,Math.round((d-.12-v)/.47)));
    return h.groundY+.115-step*.19;
  }
  return null;
}
