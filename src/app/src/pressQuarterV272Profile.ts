import source from "./data/pressQuarterV272Navigation.json";
export const PRESS_QUARTER_V272_PRISM_IDS:ReadonlySet<string>=new Set(source.legacyPrisms.map(p=>p.id));
export const PRESS_QUARTER_V272_PARENT_IDS:ReadonlySet<string>=new Set(source.parents.map(p=>p.id));
export const PRESS_QUARTER_V272_PARTS=source.parts;
export const PRESS_QUARTER_V272_PROFILE=Object.freeze({parents:source.parents,parts:source.parts,names:["Axel-Springer Goldturm","Axel-Springer Silberflügel","Ehemaliges taz-Haus","taz Friedrichstraße 21"],sourceStatus:"Complete selected official LoD2 parts; metalwork and Peter Lenk relief are documented display estimates."});
export const PRESS_QUARTER_V272_SOURCE_BOUNDS=source.parts.map(part=>({part,topY:part.topY,minX:Math.min(...part.polygons.flatMap(p=>p.ring.map(v=>v[0]))),maxX:Math.max(...part.polygons.flatMap(p=>p.ring.map(v=>v[0]))),minZ:Math.min(...part.polygons.flatMap(p=>p.ring.map(v=>v[1]))),maxZ:Math.max(...part.polygons.flatMap(p=>p.ring.map(v=>v[1])))}));
function inRing(x:number,z:number,ring:readonly number[][],scale=1):boolean{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]/scale>z)!==(b[1]/scale>z)&&x<(b[0]-a[0])*(z-a[1]/scale)/(b[1]-a[1])+a[0]/scale)inside=!inside;}return inside;}
export function pressQuarterV272Contains(x:number,z:number):boolean{return PRESS_QUARTER_V272_SOURCE_BOUNDS.some(b=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ&&b.part.polygons.some(p=>inRing(x,z,p.ring)&&!p.holes.some(h=>inRing(x,z,h))));}
/** Exact legacy ring, courtyard, base and quantized top; no radius suppression. */
export function pressQuarterV272SourceColumn(x:number,z:number,baseY:number,topY:number):boolean{return source.legacyPrisms.some(p=>Math.abs(baseY-p.y0_dm/10)<.11&&Math.abs(topY-baseY-Math.ceil(p.h_dm/40)*4)<.11&&inRing(x,z,p.ring,10)&&!p.holes.some(h=>inRing(x,z,h,10)));}
const nativeRoofs=new Map(source.nativeRoofCells.map(([x,z,y])=>[`${Math.floor(x/2)},${Math.floor(z/2)}`,y]));
export function pressQuarterV272RoofAt(x:number,z:number,minecraft=false):number|null{
  if(minecraft)return nativeRoofs.get(`${Math.floor(x/2)},${Math.floor(z/2)}`)??null;
  if(!PRESS_QUARTER_V272_SOURCE_BOUNDS.some(b=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ))return null;
  let roof:number|null=null;for(const[a,b,c]of source.roofTriangles){const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-8)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001){const y=u*a[1]+v*b[1]+(1-u-v)*c[1];roof=roof===null?y:Math.max(roof,y);}}return roof;
}
