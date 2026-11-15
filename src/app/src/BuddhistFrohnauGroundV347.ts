/** The finite new Frohnau parcel uses the same measured terrain before and after
 * streaming. No generic prefix, rectangular area expansion or alternate datum. */
import data from './data/buddhistFrohnauGroundV347.json';
import {decodeGardenTerrainV330,gardenTerrainGroundAtV330} from './GardenTerrainV330';

type Poly={ring:number[][];holes:number[][][]};
const ringContains=(ring:number[][],x:number,z:number)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const inside=(p:Poly,x:number,z:number)=>ringContains(p.ring,x,z)&&!p.holes.some(h=>ringContains(h,x,z));
let drawn:DataView|undefined,native:DataView|undefined;
export function buddhistFrohnauContainsV347(x:number,z:number):boolean{
 const b=data.worldBounds;return x>=b[0]&&z>=b[1]&&x<=b[2]&&z<=b[3]&&data.footprint.some(p=>inside(p,x,z));
}
export function buddhistFrohnauGroundAtV347(x:number,z:number,minecraft=false):number|null{
 if(!Number.isFinite(x)||!Number.isFinite(z)||!buddhistFrohnauContainsV347(x,z))return null;
 const lx=x-data.origin[0],lz=z-data.origin[2],mode=minecraft?'minecraft':'drawn';
 let top:number|null=null;
 for(const p of data.stairs[mode])if(inside(p,lx,lz))top=Math.max(top??-Infinity,p.y);
 if(top!==null)return top;
 const grid=minecraft?(native??=decodeGardenTerrainV330(data.grids.minecraft,true)):(drawn??=decodeGardenTerrainV330(data.grids.drawn,false));
 return gardenTerrainGroundAtV330(grid,lx,lz,minecraft);
}
