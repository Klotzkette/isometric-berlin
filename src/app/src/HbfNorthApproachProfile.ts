import source from './data/hbfNorthApproachSources.json';
export const HBF_NORTH_APPROACH_SOURCE = source;
export type HbfNorthPoint = readonly [number, number];
const rings = source.cut.map(p => p.ring);
const bounds = rings.map(r => ({minX:Math.min(...r.map(p=>p[0])),maxX:Math.max(...r.map(p=>p[0])),minZ:Math.min(...r.map(p=>p[1])),maxZ:Math.max(...r.map(p=>p[1]))}));
export function hbfNorthPointInRing(x:number,z:number,ring:readonly (readonly number[])[]):boolean {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function pointInHbfNorthRailCut(x:number,z:number,pad=0):boolean {
  return rings.some((r,i)=>{
    const b=bounds[i];if(x<b.minX-pad||x>b.maxX+pad||z<b.minZ-pad||z>b.maxZ+pad)return false;
    if(hbfNorthPointInRing(x,z,r))return true;
    if(pad<=0)return false;
    for(let k=0;k<r.length-1;k++){
      const a=r[k],q=r[k+1],dx=q[0]-a[0],dz=q[1]-a[1],l=dx*dx+dz*dz;
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(l||1)));
      if(Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<=pad)return true;
    }
    return false;
  });
}
/** Floor grades are display estimates. OSM gives plan position, not elevation. */
export function hbfNorthRailFloorAt(x:number,z:number,family:'mainline'|'s21'='mainline'):number {
  if(family==='s21'){
    const dx=-.596,dz=-.803,s=(x+283.156)*dx+(z+1159.452)*dz;
    return -3.3+Math.max(0,Math.min(1,s/241))*8.5;
  }
  const p=source.profile,s=(x-p.origin[0])*p.outward[0]+(z-p.origin[1])*p.outward[1];
  return p.floor_y_m+Math.max(0,Math.min(1,s/p.length_m))*8.5;
}
/** Null outside the real open cut; park and public-road navigation stay intact. */
export function hbfNorthRailGroundAt(x:number,z:number):number|null {
  for(let i=0;i<source.cuts.length;i++)if(hbfNorthPointInRing(x,z,source.cuts[i].ring))return hbfNorthRailFloorAt(x,z,i===1?'s21':'mainline')+.05;
  return null;
}
