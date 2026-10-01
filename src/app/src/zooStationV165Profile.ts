import source from "./data/zooStationV165Navigation.json";
export const ZOO_STATION_V165_PRISM_IDS:ReadonlySet<string>=new Set(source.legacyPrisms.map(p=>p.id));
export const ZOO_STATION_V165_PARENT_IDS:ReadonlySet<string>=new Set(source.parts.map(p=>p.parentId));
export const ZOO_STATION_V165_PARTS=source.parts;
function inRing(x:number,z:number,ring:readonly number[][],scale=1):boolean{
  let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];if((a[1]/scale>z)!==(b[1]/scale>z)&&x<(b[0]-a[0])*(z-a[1]/scale)/(b[1]-a[1])+a[0]/scale)inside=!inside;
  }return inside;
}
function contains(x:number,z:number,p:{ring:number[][];holes:number[][][]}):boolean{return inRing(x,z,p.ring)&&!p.holes.some(h=>inRing(x,z,h));}
export function zooStationV165SourceColumn(x:number,z:number,baseY:number,topY:number):boolean{
  if(x< -2880||x> -2550||z<1000||z>1370)return false;
  return source.legacyPrisms.some(p=>Math.abs(baseY-p.y0_dm/10)<.11&&Math.abs(topY-baseY-Math.ceil(p.h_dm/40)*4)<.11&&inRing(x,z,p.ring,10)&&!p.holes.some(h=>inRing(x,z,h,10)));
}
/** Open elevated station envelope; fine solids are handled separately. */
export function zooStationV165PassageAt(x:number,y:number,z:number,sourceId?:string):boolean{
  if(x< -2805||x> -2550||z<1030||z>1375||y<4.5||y>32)return false;
  if(sourceId&&!ZOO_STATION_V165_PRISM_IDS.has(sourceId)&&!ZOO_STATION_V165_PARENT_IDS.has(sourceId)&&!source.parts.some(p=>p.id===sourceId))return false;
  return source.stationFootprint.some(p=>contains(x,z,p));
}
/** The public concourse and platforms are not closed building-box colliders. */
export function zooStationV165SolidAt(x:number,y:number,z:number,radius=0):boolean{
  if(x< -2805||x> -2550||z<1030||z>1375)return false;
  return source.colliders.some(p=>y>=p.low&&y<=p.high&&Math.hypot(x-p.x,z-p.z)<p.radius+radius);
}
/** A height-aware floor callback lets a visitor stay under the elevated tracks. */
export function zooStationV165FloorAt(x:number,z:number,currentY=5.2):number|null{
  if(currentY>11.4&&source.platforms.some(p=>p.polygons.some(poly=>contains(x,z,poly))))return 13.96;
  if(!source.stationFootprint.some(p=>contains(x,z,p)))return null;
  for(const s of source.stairs){const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],length2=dx*dx+dz*dz,t=((x-s.a[0])*dx+(z-s.a[1])*dz)/length2;
    if(t<0||t>1)continue;const distance=Math.abs(dx*(z-s.a[1])-dz*(x-s.a[0]))/Math.sqrt(length2);if(distance>s.width/2)continue;
    const y=s.low+(s.high-s.low)*t;if(Math.abs(currentY-y)<2.3)return y;
  }
  if(currentY>11.4&&source.platforms.some(p=>p.polygons.some(poly=>contains(x,z,poly))))return 13.96;
  return currentY>11.4?13.2:5.25;
}
const nativeRoofs=new Map(source.nativeRoofCells.map(([x,z,y])=>[`${Math.floor(x/2)},${Math.floor(z/2)}`,y]));
export function zooStationV165RoofAt(x:number,z:number,minecraft=false):number|null{
  if(minecraft)return nativeRoofs.get(`${Math.floor(x/2)},${Math.floor(z/2)}`)??null;
  let result:number|null=null;
  for(const [a,b,c] of source.roofTriangles){const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-8)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
    if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001){const y=u*a[1]+v*b[1]+(1-u-v)*c[1];result=result===null?y:Math.max(result,y);}}
  return result;
}
