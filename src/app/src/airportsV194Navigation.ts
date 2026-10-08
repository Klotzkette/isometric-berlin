import source from "./data/airportsV194.json";
type Ring=readonly (readonly number[])[];
function inside(x:number,z:number,r:Ring):boolean {
  let value=false;for(let i=0,j=r.length-1;i<r.length;j=i++) {
    const a=r[i],b=r[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])value=!value;
  }return value;
}
function airportBounds(x:number,z:number,radius=0):boolean {
  return (x>=912-radius&&x<=1796+radius&&z>=3874-radius&&z<=4675+radius)||(x>=-7075-radius&&x<=-3973+radius&&z>=-4911-radius&&z<=-3753+radius);
}
const cellM=64, index=new Map<string,number[]>();
source.navigation.forEach((p,i)=>{
  const ring=p.rings[0],xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
  for(let x=Math.floor(Math.min(...xs)/cellM);x<=Math.floor(Math.max(...xs)/cellM);x++)
    for(let z=Math.floor(Math.min(...zs)/cellM);z<=Math.floor(Math.max(...zs)/cellM);z++) {
      const key=`${x}:${z}`,a=index.get(key)??[];a.push(i);index.set(key,a);
    }
});
function candidates(x:number,z:number){return index.get(`${Math.floor(x/cellM)}:${Math.floor(z/cellM)}`)??[];}
function contains(i:number,x:number,z:number):boolean {
  const p=source.navigation[i];return inside(x,z,p.rings[0])&&!p.rings.slice(1).some(h=>inside(x,z,h));
}
/** Thin measured wall/roof solids plus Tegel source-bound terminal/tower volumes. */
export function airportsV194SolidAt(x:number,y:number,z:number,radius=0):boolean {
  if(!airportBounds(x,z,radius))return false;
  for(const [dx,dz]of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]])
    for(const i of candidates(x+dx,z+dz)){const p=source.navigation[i];if(y>=p.minY&&y<=p.maxY&&contains(i,x+dx,z+dz))return true;}
  return false;
}
/** Optional height ceiling avoids snapping a walker below a canopy onto its roof. */
export function airportsV194RoofAt(x:number,z:number,maxY=Infinity):number|null {
  let highest:number|null=null;for(const i of candidates(x,z)){const p=source.navigation[i];if(p.maxY<=maxY&&contains(i,x,z))highest=Math.max(highest??-Infinity,p.maxY);}return highest;
}

const nativeIndex=new Map<string,number[]>();
let nativeReady=false;
function prepareNative():void {
  if(nativeReady)return;nativeReady=true;
  source.blocks.forEach((r,i)=>{
    if(r[1]+r[4]/2<=3.2)return;
    for(let x=Math.floor((r[0]-r[3]/2)/cellM);x<=Math.floor((r[0]+r[3]/2)/cellM);x++)
      for(let z=Math.floor((r[2]-r[5]/2)/cellM);z<=Math.floor((r[2]+r[5]/2)/cellM);z++){
        const key=`${x}:${z}`,rows=nativeIndex.get(key)??[];rows.push(i);nativeIndex.set(key,rows);
      }
  });
}
/** Minecraft collision uses exactly the represented final block extents. */
export function airportsV194NativeSolidAt(x:number,y:number,z:number,radius=0):boolean {
  if(!airportBounds(x,z,radius))return false;
  prepareNative();const found=new Set<number>();
  for(let cx=Math.floor((x-radius)/cellM);cx<=Math.floor((x+radius)/cellM);cx++)
    for(let cz=Math.floor((z-radius)/cellM);cz<=Math.floor((z+radius)/cellM);cz++)
      for(const i of nativeIndex.get(`${cx}:${cz}`)??[])found.add(i);
  for(const i of found){const r=source.blocks[i];if(Math.abs(x-r[0])<=r[3]/2+radius&&Math.abs(z-r[2])<=r[5]/2+radius&&Math.abs(y-r[1])<=r[4]/2)return true;}return false;
}
