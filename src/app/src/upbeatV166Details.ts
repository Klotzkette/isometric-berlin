import { EUROPACITY_PROFILE } from "./expandedCityProfiles";

export type UpbeatDetailBox = { color:number; position:[number,number,number]; size:[number,number,number]; yaw:number; role:"flute"|"spandrel"|"rail"|"entry" };
type Ring=readonly (readonly[number,number])[];
function clipEast(ring:Ring,cut:number):Ring{
  const result:[number,number][]=[];
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],ain=a[0]>=cut,bin=b[0]>=cut;if(ain)result.push([a[0],a[1]]);if(ain!==bin){const t=(cut-a[0])/(b[0]-a[0]);result.push([cut,a[1]+t*(b[1]-a[1])]);}}
  return result;
}
/** Same footprint, three tiers and height; only documented facade relief added. */
export function upbeatV166DetailBoxes():UpbeatDetailBox[]{
  const p=EUROPACITY_PROFILE.upbeat,rows:UpbeatDetailBox[]=[];
  const rings=[p.footprintWorldM,clipEast(p.footprintWorldM,p.midTierEastClipWorldX),clipEast(p.footprintWorldM,p.towerTierEastClipWorldX)];
  let low:number=p.groundY,previousFloors=0;
  rings.forEach((ring,tier)=>{
    const top=p.groundY+p.tierTopHeightsM[tier],floors=p.storeyTiers[tier]-previousFloors,pitch=(top-low)/floors;
    const area=ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
    for(let edge=0;edge<ring.length;edge++){
      const a=ring[edge],b=ring[(edge+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.7)continue;
      const ux=dx/len,uz=dz/len,nx=(area>0?uz:-uz),nz=(area>0?-ux:ux),yaw=-Math.atan2(dz,dx),bays=Math.max(1,Math.round(len/p.facadeBayPitchM));
      const at=(u:number,y:number,out:number):[number,number,number]=>[a[0]+ux*u+nx*out,y,a[1]+uz*u+nz*out];
      for(let bay=0;bay<=bays;bay++)for(const shift of [-.05,.05])rows.push({color:shift<0?0xA9A591:0xE1D8C2,position:at(len*bay/bays+shift,(low+top)/2,.19),size:[.028,top-low-.16,.09],yaw,role:"flute"});
      for(let floor=0;floor<floors;floor++)for(let bay=0;bay<bays;bay++)rows.push({color:0x3E5157,position:at(len*(bay+.5)/bays,low+(floor+.83)*pitch,.17),size:[Math.max(.2,len/bays-.23),.48,.065],yaw,role:"spandrel"});
      // Guardrails occur on the exposed lower terraces only. Upper tier walls
      // do not receive a second rail, and the published tower cap stays at 82 m.
      const cut=tier===0?p.midTierEastClipWorldX:p.towerTierEastClipWorldX;
      if(tier<2&&a[0]<cut-.1&&b[0]<cut-.1){
        rows.push({color:0xB9B8AB,position:at(len/2,top+1.1,-.18),size:[len,.075,.10],yaw,role:"rail"});
        for(let u=.35;u<len;u+=1.5)rows.push({color:0xB1B6AC,position:at(u,top+.67,-.18),size:[.065,.86,.07],yaw,role:"rail"});
      }
    }
    previousFloors=p.storeyTiers[tier];low=top;
  });
  const yaw=-.44,c=Math.cos(yaw),s=-Math.sin(yaw);
  for(const u of [-3.3,-1.1,1.1,3.3])rows.push({color:0xD9D4C3,position:[-625.8+c*u,p.groundY+2.1,-1954.8+s*u+.25],size:[.10,3.9,.16],yaw,role:"entry"});
  return rows;
}
/** Small orthogonal blocks sampled only from the new exterior details. */
export function upbeatV166NativeAccents():{color:number;position:[number,number,number];size:[number,number,number]}[]{
  const cells=new Map<string,{color:number;position:[number,number,number];size:[number,number,number]}>(),cell=.65;
  for(const r of upbeatV166DetailBoxes()){
    if(r.role==="flute")continue;
    // Terrace rails and opaque upper-window spandrels retain the fine exterior
    // reading; the unchanged original native body remains the owner below them.
    for(let u=-r.size[0]/2+cell/2;u<r.size[0]/2;u+=cell)for(let v=-r.size[1]/2+Math.min(cell/2,r.size[1]/2);v<=r.size[1]/2;v+=cell){
      const x=Math.round((r.position[0]+Math.cos(r.yaw)*u)/cell)*cell,y=Math.round((r.position[1]+v)/cell)*cell,z=Math.round((r.position[2]-Math.sin(r.yaw)*u)/cell)*cell;
      if(y+cell/2>EUROPACITY_PROFILE.upbeat.groundY+82)continue;
      const key=[x,y,z].join(',');cells.set(key,{color:r.color,position:[x,y,z],size:[cell,cell,cell]});
    }
  }
  return [...cells.values()];
}
