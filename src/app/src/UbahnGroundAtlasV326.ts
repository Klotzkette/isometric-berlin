/** Finite numeric aperture data, never image pixels. Original terrain buffers
 * and every outside fragment remain unchanged. Main-thread access runtime only. */
import {ClampToEdgeWrapping,DataTexture,FloatType,NearestFilter,NoColorSpace,RGBAFormat,Vector4} from 'three';
import type {UbahnAccessOpeningV326} from './UbahnAccessV326';

type P=readonly[number,number];
type Rectangle=readonly[number,number,number,number];
type Shape={opening:UbahnAccessOpeningV326;bounds:Rectangle;rectangles:Rectangle[]};
const CELL=64,WIDTH=256,MAX_GRID_CELLS=65536,MAX_MEMBERS=16,MAX_RING=128;

/** Merge only identical quarter-metre occupied cells; the union stays exact. */
export function mergeUbahnNativeCellsV326(cells:readonly P[]):Rectangle[]{
 const rows=new Map<number,number[]>(),seen=new Set<string>();
 for(const[x,z]of cells){
  if(!Number.isFinite(x)||!Number.isFinite(z)||x*4!==Math.round(x*4)||z*4!==Math.round(z*4))throw Error('Non-cardinal U-Bahn source cell');
  const key=`${x},${z}`;if(seen.has(key))throw Error('Duplicate U-Bahn source cell');seen.add(key);
  const row=rows.get(z)??[];row.push(x);rows.set(z,row);
 }
 const result:Rectangle[]=[],active=new Map<string,number>();let previous=-Infinity;
 for(const[z,xs]of[...rows].sort((a,b)=>a[0]-b[0])){
  if(z!==previous+.25)active.clear();previous=z;xs.sort((a,b)=>a-b);
  const next=new Map<string,number>();let start=xs[0],end=start+.25;
  const append=()=>{const key=`${start},${end}`,old=active.get(key);if(old!==undefined){const r=result[old];result[old]=[r[0],r[1],r[2],z+.25];next.set(key,old);}else{next.set(key,result.length);result.push([start,z,end,z+.25]);}};
  for(let i=1;i<=xs.length;i++){if(i<xs.length&&xs[i]===end){end+=.25;continue;}append();start=xs[i];end=start+.25;}
  active.clear();for(const[k,v]of next)active.set(k,v);
 }
 return result;
}

const containsRing=(x:number,z:number,ring:readonly P[])=>{
 let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;
 }return yes;
};
export type UbahnGroundAtlasV326={
 texture:DataTexture;grid:Vector4;layout:Vector4;native:boolean;bytes:number;
 complete:()=>boolean;contains:(x:number,y:number,z:number)=>boolean;dispose:()=>void;
};

/** The caller must obtain these immutable DTOs from admitted private models.
 * This pure builder owns no scene and cannot authorize a terrain edit itself. */
export function createUbahnGroundAtlasV326(openings:readonly UbahnAccessOpeningV326[],native:boolean):UbahnGroundAtlasV326|null{
 if(!openings.length||openings.length>512||new Set(openings.map(o=>o.id)).size!==openings.length)return null;
 const shapes:Shape[]=[];
 for(const o of openings){
  if(o.native!==native||!Object.isFrozen(o)||!Object.isFrozen(o.ring)||o.ring.length<3||o.ring.length>MAX_RING||!o.ring.every(p=>p.length===2&&p.every(Number.isFinite))||!Number.isFinite(o.surfaceY)||!Number.isFinite(o.bottomY)||o.bottomY>=o.surfaceY)return null;
  let rectangles:Rectangle[]=[];
  try{if(native){if(o.cellM!==.25||!o.nativeCells?.length)return null;rectangles=mergeUbahnNativeCellsV326(o.nativeCells);if(rectangles.length>MAX_RING)return null;}}catch{return null;}
  shapes.push({opening:o,rectangles,bounds:[Math.min(...o.ring.map(p=>p[0])),Math.min(...o.ring.map(p=>p[1])),Math.max(...o.ring.map(p=>p[0])),Math.max(...o.ring.map(p=>p[1]))]});
 }
 const minX=Math.floor(Math.min(...shapes.map(s=>s.bounds[0]))/CELL)*CELL,minZ=Math.floor(Math.min(...shapes.map(s=>s.bounds[1]))/CELL)*CELL;
 const cols=Math.floor((Math.max(...shapes.map(s=>s.bounds[2]))-minX)/CELL)+1,rows=Math.floor((Math.max(...shapes.map(s=>s.bounds[3]))-minZ)/CELL)+1;
 if(cols*rows>MAX_GRID_CELLS)return null;
 const members:Array<number[]>=Array.from({length:cols*rows},()=>[]),data:number[][]=[];
 for(const s of shapes){
  const h=data.length;data.push([...s.bounds],[s.opening.surfaceY,s.opening.bottomY,0,0]);
  data[h+1][2]=data.length;data[h+1][3]=native?-s.rectangles.length:s.opening.ring.length;
  if(native)data.push(...s.rectangles.map(r=>[...r]));else data.push(...s.opening.ring.map(p=>[p[0],p[1],0,0]));
  const b=s.bounds;
  for(let z=Math.floor((b[1]-minZ)/CELL);z<=Math.floor((b[3]-minZ)/CELL);z++)for(let x=Math.floor((b[0]-minX)/CELL);x<=Math.floor((b[2]-minX)/CELL);x++)members[z*cols+x].push(h);
 }
 if(members.some(m=>m.length>MAX_MEMBERS))return null;
 const gridOffset=data.length;for(const _ of members)data.push([0,0,0,0]);
 for(let i=0;i<members.length;i++){data[gridOffset+i]=[data.length,members[i].length,0,0];data.push(...members[i].map(h=>[h,0,0,0]));}
 const height=Math.max(1,Math.ceil(data.length/WIDTH)),values=new Float32Array(WIDTH*height*4);data.forEach((r,i)=>values.set(r,i*4));
 if(values.byteLength>2*1024*1024)return null;
 let backing:Float32Array|null=values;
 const readData=()=>backing?new Float32Array(backing):new Float32Array(0);
 const immutableImage=Object.freeze({width:WIDTH,height,get data(){return readData();}});
 const texture=new DataTexture(undefined,WIDTH,height,RGBAFormat,FloatType);texture.image=immutableImage;
 const source=texture.source,mipmaps=texture.mipmaps;
 Object.defineProperty(source,'data',{value:immutableImage,writable:false,configurable:false,enumerable:true});
 texture.minFilter=NearestFilter;texture.magFilter=NearestFilter;texture.generateMipmaps=false;texture.flipY=false;texture.needsUpdate=true;
 const grid=Object.freeze(new Vector4(minX,minZ,cols,rows))as Vector4,layout=Object.freeze(new Vector4(WIDTH,height,gridOffset,CELL))as Vector4;
 let disposed=false;texture.addEventListener('dispose',()=>{disposed=true;backing=null;});
 const complete=()=>!disposed&&backing!==null&&texture.source===source&&source.data===immutableImage&&source.dataReady&&texture.image===immutableImage&&texture.type===FloatType&&texture.format===RGBAFormat&&texture.internalFormat===null&&texture.colorSpace===NoColorSpace&&texture.minFilter===NearestFilter&&texture.magFilter===NearestFilter&&texture.wrapS===ClampToEdgeWrapping&&texture.wrapT===ClampToEdgeWrapping&&texture.flipY===false&&texture.generateMipmaps===false&&texture.premultiplyAlpha===false&&texture.unpackAlignment===1&&texture.mipmaps===mipmaps&&mipmaps.length===0;
 return{texture,grid,layout,native,bytes:values.byteLength,complete,
  contains(x,y,z){if(disposed)return false;return shapes.some(s=>{const o=s.opening;if(x<s.bounds[0]||x>s.bounds[2]||z<s.bounds[1]||z>s.bounds[3]||y<o.bottomY-.015||y>o.surfaceY+.35)return false;if(!native)return containsRing(x,z,o.ring);const xx=Math.floor(x*4)*.25,zz=Math.floor(z*4)*.25;return s.rectangles.some(r=>xx>=r[0]&&xx<r[2]&&zz>=r[1]&&zz<r[3]);});},
  dispose(){if(disposed)return;disposed=true;backing=null;texture.dispose();},
 };
}

/** Each fragment consults only its64m source cell. Large city bounds never
 * cause an all-stations fragment loop. Native uses exact precomputed cells. */
export const UBAHN_GROUND_GLSL_V326=`
uniform sampler2D uUbahnApertureDataV326;
uniform vec4 uUbahnApertureGridV326;
uniform vec4 uUbahnApertureLayoutV326;
uniform float uUbahnApertureEnabledV326;
varying vec3 vUbahnApertureWorldV326;
vec4 ubahnReadV326(float at) {
 vec2 uv=(vec2(mod(at,uUbahnApertureLayoutV326.x),floor(at/uUbahnApertureLayoutV326.x))+.5)/uUbahnApertureLayoutV326.xy;
 return texture2D(uUbahnApertureDataV326,uv);
}
bool ubahnRingV326(vec2 p,float first,float count) {
 bool inside=false;vec2 a=ubahnReadV326(first+count-1.).xy;
 for(int n=0;n<128;n++){if(float(n)>=count)break;vec2 b=ubahnReadV326(first+float(n)).xy;
  if((a.y>p.y)!=(b.y>p.y)){float x=(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x;if(p.x<x)inside=!inside;}a=b;
 }return inside;
}
bool ubahnCutV326(vec3 p) {
 if(uUbahnApertureEnabledV326<.5)return false;
 vec2 cell=floor((p.xz-uUbahnApertureGridV326.xy)/uUbahnApertureLayoutV326.w);
 if(cell.x<0.||cell.y<0.||cell.x>=uUbahnApertureGridV326.z||cell.y>=uUbahnApertureGridV326.w)return false;
 vec4 entry=ubahnReadV326(uUbahnApertureLayoutV326.z+cell.y*uUbahnApertureGridV326.z+cell.x);
 for(int k=0;k<16;k++){if(float(k)>=entry.y)break;float h=ubahnReadV326(entry.x+float(k)).x;vec4 b=ubahnReadV326(h),s=ubahnReadV326(h+1.);
  if(p.x<b.x||p.z<b.y||p.x>b.z||p.z>b.w||p.y<s.y-.015||p.y>s.x+.35)continue;
  if(s.w>0.){if(ubahnRingV326(p.xz,s.z,s.w))return true;}
  else {vec2 q=floor(p.xz*4.)*.25;for(int n=0;n<128;n++){if(float(n)>=-s.w)break;vec4 r=ubahnReadV326(s.z+float(n));if(q.x>=r.x&&q.y>=r.y&&q.x<r.z&&q.y<r.w)return true;}}
 }return false;
}
`;

export function patchUbahnGroundShaderV326(vertex:string,fragment:string):{vertex:string;fragment:string}{
 if(!vertex.includes('#include <project_vertex>')||!fragment.includes('void main()'))throw Error('Unsupported actual ground shader');
 const position=`
 vec4 ubahnLocalV326=vec4(transformed,1.0);
 #ifdef USE_INSTANCING
 ubahnLocalV326=instanceMatrix*ubahnLocalV326;
 #endif
 vUbahnApertureWorldV326=(modelMatrix*ubahnLocalV326).xyz;
 `;
 return{vertex:'varying vec3 vUbahnApertureWorldV326;\n'+vertex.replace('#include <project_vertex>',position+'\n#include <project_vertex>'),
  fragment:UBAHN_GROUND_GLSL_V326+'\n'+fragment.replace('void main()', 'void main()').replace(/void\s+main\s*\(\s*\)\s*\{/,'$&\nif(ubahnCutV326(vUbahnApertureWorldV326))discard;')};
}
