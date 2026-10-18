import type { Group } from "three";
import raw from "./data/weddingMoabitV229.json?raw";
type Source=typeof import("./data/weddingMoabitV229.json");
let cache:WeakRef<Source>|undefined;
/** Raw compact source survives module lifetime; decoded trees are weak only. */
export function weddingMoabitSourceV229():Source {let s=cache?.deref();if(!s){s=JSON.parse(raw) as Source;cache=new WeakRef(s);}return s;}
export const WEDDING_PLATFORM_Y_V229=10.46;
export const WEDDING_GROUND_Y_V229=5.2;
export const WEDDING_ROOF_BOTTOM_Y_V229=14.84;
export const WEDDING_ROOF_TOP_Y_V229=14.96;
let previousRoofSignatures:string[]|undefined;
/** Full original row receipt: never retire a same-ID changed source. */
export function isWeddingRoofCoreV229(prism:{id:string}):boolean {
 if(!["26556185","73863640","65379920"].includes(prism.id))return false;
 previousRoofSignatures??=weddingMoabitSourceV229().stationCorrection.previousCoreRoofs.map(p=>JSON.stringify(p));
 return previousRoofSignatures.includes(JSON.stringify(prism));
}
let roofCache:number[][][]|undefined;
export function weddingRoofV229():number[][][]{return roofCache??=weddingMoabitSourceV229().roofRings.map(r=>r.map(p=>[...p]));}
/** Exactly the same 1.5m cells and clipped final row as both native decks. */
export function weddingFootprintContainsV229(rings:number[][][],x:number,z:number,native=false):boolean {
 if(native){const ring=rings[0],minX=Math.min(...ring.map(p=>p[0])),minZ=Math.min(...ring.map(p=>p[1])),maxX=Math.max(...ring.map(p=>p[0])),maxZ=Math.max(...ring.map(p=>p[1]));
  if(x<minX||x>maxX||z<minZ||z>maxZ)return false;
  const x0=minX+Math.floor((x-minX)/1.5)*1.5,z0=minZ+Math.floor((z-minZ)/1.5)*1.5;x=x0+Math.min(1.5,maxX-x0)/2;z=z0+Math.min(1.5,maxZ-z0)/2;
 }
 return inWeddingRingV229(rings[0],x,z)&&!rings.slice(1).some(r=>inWeddingRingV229(r,x,z));
}

export function applyWeddingStationHeightV229(root:Group):void {
  root.traverse(object=>{
    if(object.userData.stationName!=="Wedding"||object.userData.anchorOsmId!=="node/614445865"||!object.userData.platformIds?.includes("relation/5559039")||object.userData.weddingHeightV229)return;
    object.position.y+=6.5;object.updateMatrix();object.userData.weddingHeightV229=true;
  });
}
export type WeddingStairV229={id:string;a:number[];b:number[];low:number;high:number;width:number;steps:number};
let stairCache:WeddingStairV229[]|undefined;
export function weddingStairsV229():WeddingStairV229[] {
  if(stairCache)return stairCache;
  return stairCache= weddingMoabitSourceV229().stairs.map(s=>{
    const levels=s.tags.level.replace(",",".").split(";").map(Number);const low=5.2+5.26*levels[0],high=5.2+5.26*(levels[1]??levels[0]);
    return{id:s.id,a:[...s.points[0]],b:[...s.points.at(-1)!],low,high,width:2.35,steps:Math.max(1,Number("step_count" in s.tags?s.tags.step_count:0)||Math.round((high-low)/.175))};
  });
}
export function inWeddingRingV229(ring:readonly number[][],x:number,z:number):boolean {
  let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;
}
/** Height-sensitive support cannot teleport a ground pedestrian to a viaduct.
 * Root passes current feet Y. Stair rises follow the exact horizontal OSM run. */
export function weddingStationFloorAtV229(x:number,z:number,feetY:number,native=false):number|null {
  for(const s of weddingStairsV229()) {
    const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
    const u=(x-s.a[0])*ux+(z-s.a[1])*uz,v=-(x-s.a[0])*uz+(z-s.a[1])*ux;
    // Shared mapped endpoints can project a few ulps outside their segment.
    // The retained native deck need not cover that exact landing-edge point.
    if(u<-.000001||u>length+.000001||Math.abs(v)>s.width/2-.05)continue;
    const y=s.low+(Math.min(s.steps-1,Math.max(0,Math.floor(u/length*s.steps)))+1)*(s.high-s.low)/s.steps;
    // A 100ms normal walking frame covers 1.3m. On the steepest mapped
    // flight that is .58m plus one .175m tread; descent keeps the frame's
    // starting feet height while collision substeps advance down the stair.
    if(Math.abs(y-feetY)<.8)return y;
  }
  // Source platform support is supplied by the retained polygon, including
  // its exact stair hole. The small native cap follows the v190 1.5m grid.
  if(Math.abs(feetY-WEDDING_PLATFORM_Y_V229)<.6&&weddingPlatformContainsV229(x,z,native))return WEDDING_PLATFORM_Y_V229;
  for(const roof of weddingRoofsV229()){const top=weddingRoofTopV229(roof,x,z,native);if(feetY>=top-.15&&weddingFootprintContainsV229(roof.rings,x,z,native))return top;}return null;
}
let platformCache:number[][][]|undefined;
export function weddingPlatformV229():number[][][]{return platformCache??=weddingMoabitSourceV229().platformRings.map(r=>r.map(p=>[...p]));}
/** Construction-time sample of exact delivered ground samples, not a second
 * independent DGM. The native nearest-cell and drawn bilinear paths match core. */
export function weddingMoabitGroundV229(x:number,z:number,native=false):number {
  for(const g of weddingMoabitSourceV229().grounds){let u=(x-g.origin[0])/g.step,v=(z-g.origin[1])/g.step;if(u<1||v<1||u>=g.heights[0].length-1||v>=g.heights.length-1)continue;if(native)return g.heights[Math.floor(v)][Math.floor(u)]/10;u-=.5;v-=.5;const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,r=g.heights;return((r[j][i]*(1-a)+r[j][i+1]*a)*(1-b)+(r[j+1][i]*(1-a)+r[j+1][i+1]*a)*b)/10;}return 5.2;
}
/** Only the represented stair-side rails; open approaches remain traversable. */
export function weddingStationSolidAtV229(x:number,y:number,z:number,radius=0,native=false):boolean {
  if(y>WEDDING_PLATFORM_Y_V229-.3&&y<WEDDING_PLATFORM_Y_V229&&weddingPlatformContainsV229(x,z,native))return true;
  for(const roof of weddingRoofsV229()){const top=weddingRoofTopV229(roof,x,z,native);if(y>top-.12&&y<top&&weddingFootprintContainsV229(roof.rings,x,z,native))return true;}
  for(const s of weddingStairsV229()){
    const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
    const u=(x-s.a[0])*ux+(z-s.a[1])*uz,v=-(x-s.a[0])*uz+(z-s.a[1])*ux;
    if(u<-.03-radius||u>length+.03+radius||Math.abs(Math.abs(v)-(s.width/2+.03))>.035+radius+(native?.03:0))continue;
    const top=s.low+(s.high-s.low)*Math.max(0,Math.min(1,u/length));if(y>top+.15&&y<top+1.05)return true;
  }return false;
}

let transitionCache:number[][]|undefined;
/** Small independent native infill at source stair/landing joins. The old
 * 1.5m deck grid can widen a source hole beyond the upper stair by one cell. */
export function weddingPlatformTransitionCellsV229():number[][] {
 if(transitionCache)return transitionCache;const cells:number[][]=[],seen=new Set<string>(),rings=weddingPlatformV229();
 for(const s of weddingStairsV229().filter(s=>s.high===WEDDING_PLATFORM_Y_V229))for(const p of [s.a,s.b])
  for(let z=Math.floor((p[1]-1.5)*4)/4;z<p[1]+1.5;z+=.25)for(let x=Math.floor((p[0]-1.5)*4)/4;x<p[0]+1.5;x+=.25){
   const key=x+","+z,cx=x+.125,cz=z+.125;if(seen.has(key)||!weddingFootprintContainsV229(rings,cx,cz)||weddingFootprintContainsV229(rings,cx,cz,true))continue;
   seen.add(key);cells.push([x,z,x+.25,z+.25]);
  }return transitionCache=cells;
}
export function weddingPlatformContainsV229(x:number,z:number,native=false):boolean {
 return weddingFootprintContainsV229(weddingPlatformV229(),x,z,native)||native&&weddingPlatformTransitionCellsV229().some(b=>x>=b[0]&&x<=b[2]&&z>=b[1]&&z<=b[3]);
}

export type WeddingRoofV229={id:string;rings:number[][][]};
let roofsCache:WeddingRoofV229[]|undefined;
export function weddingRoofsV229():WeddingRoofV229[]{return roofsCache??=weddingMoabitSourceV229().stationCorrection.previousCoreRoofs.map(p=>({id:p.id,rings:p.id==='26556185'?weddingRoofV229():[p.ring.map(([x,z])=>[x/10,z/10]),...(p.holes as number[][][]).map(r=>r.map(([x,z])=>[x/10,z/10]))]}));}
/** Source-bound access roof grade is an explicit display estimate. */
export function weddingRoofTopV229(roof:WeddingRoofV229,x:number,z:number,native=false):number {
 if(roof.id==='26556185')return WEDDING_ROOF_TOP_Y_V229;
 if(native){const r=roof.rings[0],x0=Math.min(...r.map(p=>p[0])),z0=Math.min(...r.map(p=>p[1])),xe=Math.max(...r.map(p=>p[0])),ze=Math.max(...r.map(p=>p[1]));
 const cx=x0+Math.floor((x-x0)/1.5)*1.5,cz=z0+Math.floor((z-z0)/1.5)*1.5;x=cx+Math.min(1.5,xe-cx)/2;z=cz+Math.min(1.5,ze-cz)/2;}
 const a=weddingStairsV229().find(s=>s.id==='way/47908978')!.a,b=weddingStairsV229().find(s=>s.id==='way/363581647')!.a;const dx=b[0]-a[0],dz=b[1]-a[1];
 return 8.8+5.26*((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz);
}
