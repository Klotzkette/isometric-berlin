/** Same measured floor planes and actual compiled architectural contacts. */
import terrain from './data/railSseTerrainV307.json';
import source from './data/railSseNavigationV307.json';
function inRing(x:number,z:number,ring:readonly number[][]):boolean{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function contains(geometry:{type:string;coordinates:unknown},x:number,z:number):boolean{const polygons=geometry.type==='Polygon'?[geometry.coordinates as number[][][]]:geometry.coordinates as number[][][][];return polygons.some(p=>inRing(x,z,p[0])&&!p.slice(1).some(h=>inRing(x,z,h)));}
function sample(profile:typeof terrain.profiles[number],x:number,z:number):number{
 const [w,n,e,s]=profile.bounds;if(x<w||x>=e||z<n||z>=s)return 0;const u=(x-w)/4,v=(z-n)/4,i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,r=profile.offsets;return a>=b?r[j][i]*(1-a)+r[j][i+1]*(a-b)+r[j+1][i+1]*b:r[j][i]*(1-b)+r[j+1][i]*(b-a)+r[j+1][i+1]*a;
}
/** Activate only with the complete shared v309 required ensemble. Native cells
 * select their true4m centres; no smooth or random-residency alternate exists. */
function rawGroundAtV307(x:number,z:number,native=false):number|null{
 if(native){x=Math.floor(x/4)*4+2;z=Math.floor(z/4)*4+2;}
 for(const p of terrain.profiles){if(!contains(p.domain,x,z))continue;const delta=sample(p,x,z);return native&&delta?Math.ceil((3+delta)*8)/8:3+delta;}return null;
}
/** UInt16 centimetre transport uses nearest, ties-to-even after the exact
 * eighth-metre cell selection. Match that final rendered horizontal plane. */
export function quantizeNativeTerrainHeightV307(height:number):number{const value=height*100,low=Math.floor(value),fraction=value-low;return (fraction<.5?low:fraction>.5?low+1:low%2===0?low:low+1)/100;}
export function railSseGroundAtV307(x:number,z:number,native=false):number|null{const y=rawGroundAtV307(x,z,native);return y===null?null:native?quantizeNativeTerrainHeightV307(y):y;}
/** Architectural Float32 platform rows retain the unquantized field delta. */
export function railSseGroundOffsetV307(x:number,z:number,native=false):number{return (rawGroundAtV307(x,z,native)??3)-3;}
function roofAt(triangles:readonly number[][][],x:number,z:number):number|null{let high=-Infinity;for(const[a,b,c]of triangles){const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-9)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;if(Math.min(u,v,1-u-v)>=-1e-7)high=Math.max(high,u*a[1]+v*b[1]+(1-u-v)*c[1]);}return Number.isFinite(high)?high:null;}
type RecordV307={key:string;native:boolean;role:string;ring?:number[][];holes?:number[][][];geometry?:{type:string;coordinates:unknown};low?:number;high?:number;roofTriangles?:number[][][];field?:string;baseY?:number;centre?:number[];size?:number[];yaw?:number};
/** Full actual native row footprints and stair treads, rather than one filled
 * station bounding prism. Open tracks and space under roofs remain navigable. */
export function railSseArchitectureV307Solids(native=false){
 return (source.records as RecordV307[]).filter(r=>r.native===native).flatMap(r=>{
  let polygons:number[][][][]=[];
  if(r.geometry)polygons=r.geometry.type==='Polygon'?[r.geometry.coordinates as number[][][]]:r.geometry.coordinates as number[][][][];
  else if(r.ring)polygons=[[r.ring,...r.holes??[]]];
  else if(r.centre&&r.size){const[x,,z]=r.centre,[w,,d]=r.size,a=r.yaw??0,c=Math.cos(a),s=-Math.sin(a);polygons=[[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[x+c*u-s*v,z+s*u+c*v])].map(ring=>[ring]);}
  const low=r.low??(r.centre&&r.size?r.centre[1]-r.size[1]/2:3),high=r.high??(r.centre&&r.size?r.centre[1]+r.size[1]/2:(r.baseY??3)+30);
  return polygons.map((p,i)=>({sourceId:r.key+'-'+i,parentId:'rail-sse-v307',ring:p[0],holes:p.slice(1),minY:low,maxY:high,low,high,topAt:(x:number,z:number)=>r.role==='graded-platform'?(r.baseY??3)+(railSseGroundOffsetV307(x,z,native)):r.roofTriangles?roofAt(r.roofTriangles,x,z):high}));
 });
}
