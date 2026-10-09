import field from "./data/northParksV198Terrain.json";

type Footprint = {ring:number[][];holes:number[][][]};
function inRing(ring:number[][],x:number,z:number):boolean {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [ax,az]=ring[j],[bx,bz]=ring[i],dx=bx-ax,dz=bz-az;
    if(Math.abs((x-ax)*dz-(z-az)*dx)<1e-7*Math.hypot(dx,dz)&&x>=Math.min(ax,bx)-1e-7&&x<=Math.max(ax,bx)+1e-7&&z>=Math.min(az,bz)-1e-7&&z<=Math.max(az,bz)+1e-7)return true;
    if((az>z)!==(bz>z)&&x<ax+(z-az)*dx/dz)inside=!inside;
  }return inside;
}
function index(polygons:Footprint[]):Map<string,Footprint[]>{
  const cells=new Map<string,Footprint[]>();
  for(const p of polygons){
    let w=Infinity,n=Infinity,e=-Infinity,s=-Infinity;
    for(const [x,z]of p.ring){w=Math.min(w,x);n=Math.min(n,z);e=Math.max(e,x);s=Math.max(s,z);}
    for(let z=Math.floor(n/256);z<=Math.floor(s/256);z++)for(let x=Math.floor(w/256);x<=Math.floor(e/256);x++){const key=`${x}:${z}`;const a=cells.get(key)??[];a.push(p);cells.set(key,a);}
  }return cells;
}
const scope=index(field.scope),water=index(field.waters);
const contains=(cells:Map<string,Footprint[]>,x:number,z:number)=>cells.get(`${Math.floor(x/256)}:${Math.floor(z/256)}`)?.some(p=>inRing(p.ring,x,z)&&!p.holes.some(h=>inRing(h,x,z)))??false;
/** Compact sampler only: importing navigation never imports park render arrays. */
export function northParksV198TerrainAt(x:number,z:number,native=false,wet=false):number {
  if(native){x=Math.floor(x/16)*16+8;z=Math.floor(z/16)*16+8;}
  const heights=wet?field.waterHeights:field.heights;
  const [w,n]=field.bounds,u=(x-w)/32,v=(z-n)/32;
  const ix=Math.max(0,Math.min(heights[0].length-2,Math.floor(u))),iz=Math.max(0,Math.min(heights.length-2,Math.floor(v))),a=Math.max(0,Math.min(1,u-ix)),b=Math.max(0,Math.min(1,v-iz));
  const nw=heights[iz][ix],ne=heights[iz][ix+1],sw=heights[iz+1][ix],se=heights[iz+1][ix+1];
  return a>=b?nw*(1-a)+ne*(a-b)+se*b:nw*(1-b)+sw*(b-a)+se*a;
}
const paths=new Map<string,(number|boolean)[][]>();
for(const row of field.paths){const [ax,az,bx,bz,r]=row as number[];for(let z=Math.floor((Math.min(az,bz)-r)/256);z<=Math.floor((Math.max(az,bz)+r)/256);z++)for(let x=Math.floor((Math.min(ax,bx)-r)/256);x<=Math.floor((Math.max(ax,bx)+r)/256);x++){const key=`${x}:${z}`,a=paths.get(key)??[];a.push(row);paths.set(key,a);}}
/** Exact new-footprint hit, null throughout every retained city polygon. */
export function northParksV198GroundAt(x:number,z:number,native=false):number|null {
  const [w,n,e,s]=field.bounds;if(x<w||x>e||z<n||z>s||!contains(scope,x,z))return null;
  const y=northParksV198TerrainAt(x,z,native),wet=contains(water,x,z);
  for(const r of paths.get(`${Math.floor(x/256)}:${Math.floor(z/256)}`)??[]){
    const [ax,az,bx,bz,width,offset]=r as number[],dx=bx-ax,dz=bz-az,length=dx*dx+dz*dz;
    const t=length?((x-ax)*dx+(z-az)*dz)/length:0;
    if(t>=0&&t<=1&&Math.hypot(x-ax-dx*t,z-az-dz*t)<=width&&(!wet||r[6]))return y+offset;
  }
  return wet?northParksV198TerrainAt(x,z,native,true):y;
}

import buildings from "./data/northParksV198Buildings.json";
/** Source water polygons only; the old city retains its existing water handler. */
export function northParksV198WaterAt(x:number,z:number,native=false):number|null {
  return contains(water,x,z)?northParksV198TerrainAt(x,z,native,true):null;
}
function touches(ring:number[][],x:number,z:number,radius:number):boolean {
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [ax,az]=ring[j],[bx,bz]=ring[i],dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l)):0;
    if(Math.hypot(x-ax-dx*t,z-az-dz*t)<=radius)return true;
  }return false;
}
const inside=(footprints:Footprint[],x:number,z:number,radius=0)=>footprints.some(p=>(inRing(p.ring,x,z)||touches(p.ring,x,z,radius))&&!p.holes.some(h=>inRing(h,x,z)&&!touches(h,x,z,radius)));
function roofAt(triangles:number[][][],x:number,z:number):number|null {
  let result:number|null=null;
  for(const [a,b,c]of triangles){const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-9)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
    if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7){const y=u*a[1]+v*b[1]+(1-u-v)*c[1];result=result===null?y:Math.max(result,y);}
  }return result;
}
const bounded=(b:number[],x:number,z:number,r:number)=>x>=b[0]-r&&x<=b[2]+r&&z>=b[1]-r&&z<=b[3]+r;
/** New source houses only; two gatehouse footprints never close their opening. */
export function northParksV198SolidAt(x:number,y:number,z:number,radius=0,native=false):boolean {
  for(const b of buildings.context){
    if(!bounded(b.bounds,x,z,radius+(native?2:0)))continue;
    const base=native?b.nativeBase:b.base;if(y<base||y>base+b.height+(native?.24:0))continue;
    if(!native){if(inside(b.footprint,x,z,radius))return true;continue;}
    for(let qz=Math.floor((z-radius)/2)*2;qz<=Math.floor((z+radius)/2)*2;qz+=2)for(let qx=Math.floor((x-radius)/2)*2;qx<=Math.floor((x+radius)/2)*2;qx+=2)
      if(inside(b.footprint,qx+1,qz+1))return true;
  }
  for(const b of buildings.heroes){
    if(!bounded(b.bounds,x,z,radius+(native?1:0))||y<b.base-(native?1:0)||y>b.top+(native?1:0))continue;
    if(native){
      // This small native collision array is first touched by an actual nearby
      // native query; Day startup never materialises it or either render file.
      for(const r of buildings.nativeHeroBoxes)if(Math.abs(x-r[0])<=r[3]/2+radius&&Math.abs(y-r[1])<=r[4]/2&&Math.abs(z-r[2])<=r[5]/2+radius)return true;
    }else if(inside(b.footprint,x,z,radius)&&y<=(roofAt(b.roofs,x,z)??b.top))return true;
  }
  const o=buildings.obelisk,base=native?o.nativeBase:o.base,dy=y-base;
  if(dy>=0&&dy<=o.height){const half=dy<=1?5:dy<=2.2?3.9:dy<=4.8?2.75:dy<=31.4?1.825-(dy-4.8)/26.6*.875:Math.max(.06,.95*(33.5-dy)/2.1);
    if(Math.abs(x-o.point[0])<=half+radius&&Math.abs(z-o.point[1])<=half+radius)return true;}
  return false;
}
