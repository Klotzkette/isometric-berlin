import source from "./data/stationDetailsV192.json";
type P = [number,number,number];
export const ZOO_ENTRANCE_V192_SOURCE = source.zoo;
/** Interpolates the full, slightly skewed mapped four-corner roof. */
export function zooEntrancePointV192(u:number,v:number,y:number):P {
  const [a,b,c,d]=source.zoo.roof.points,t=(v+1)/2;
  return [(a[0]*(1-t)+b[0]*t)*(1-u)+(d[0]*(1-t)+c[0]*t)*u,y,(a[1]*(1-t)+b[1]*t)*(1-u)+(d[1]*(1-t)+c[1]*t)*u];
}
export const ZOO_ENTRANCE_V192_POSTS = [0,.5,1].flatMap(u=>[-1,1].map(v=>zooEntrancePointV192(u,v,source.zoo.groundY)));
export const ZOO_ENTRANCE_V192_PART = {
  id:"OSM-way-157658318-open-canopy",parentId:"OSM-way-157658318",name:"Hardenbergplatz U entrance O",
  rings:[source.zoo.roof.points],holes:[[] as number[][][]],groundY:source.zoo.groundY,topY:source.zoo.groundY+source.zoo.height,
};
const g=source.zoo.groundY,eave=g+source.zoo.eaveHeightEstimate,top=g+source.zoo.height;
const triangles=[-1,1].flatMap(side=>{
  const a=zooEntrancePointV192(0,0,top),b=zooEntrancePointV192(1,0,top),c=zooEntrancePointV192(1,side,eave),d=zooEntrancePointV192(0,side,eave);
  return [[a,b,c],[a,c,d]];
});
export function zooEntranceRoofAtV192(x:number,z:number):number|null {
  for(const [a,b,c] of triangles){
    const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
    if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)return u*a[1]+v*b[1]+(1-u-v)*c[1];
  }
  return null;
}
export function zooEntranceSolidAtV192(x:number,y:number,z:number,radius=0):boolean {
  if(y<g||y>top+.1)return false;
  if(y<=eave&&ZOO_ENTRANCE_V192_POSTS.some(p=>Math.abs(x-p[0])<=.19+radius&&Math.abs(z-p[2])<=.19+radius))return true;
  const roof=zooEntranceRoofAtV192(x,z);
  return roof!==null&&Math.abs(y-roof)<.08;
}
