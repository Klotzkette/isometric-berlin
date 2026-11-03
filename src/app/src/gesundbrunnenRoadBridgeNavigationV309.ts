/** Actual delivered centimetre caps and paint planes, with an open underpass. */
import source from './data/gesundbrunnenRoadBridgesV309Profile.json';
import type {Group} from 'three';
import {gesundbrunnenBridgeApproachNavigationV309,hasCompleteGesundbrunnenRoadBridgesV309} from './GesundbrunnenRoadBridgesV309';
type RecordV309={native:boolean;key:string;role?:string;thickness:number;ring:number[][];low:number;high:number;triangle:number[][]};
const records=source.navigation as RecordV309[];
function inside(ring:readonly number[][],x:number,z:number):boolean{let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
function topAt(triangle:readonly number[][],x:number,z:number):number|null {
 const[a,b,c]=triangle,d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-9)return null;
 const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
 return Math.min(u,v,1-u-v)>=-1e-7?u*a[1]+v*b[1]+(1-u-v)*c[1]:null;
}
/** Activate only with the full paired root. No solid fills the cutting. */
export function gesundbrunnenRoadBridgeSolidsV309(native=false){return records.filter(r=>r.native===native).map((r,i)=>({sourceId:`gesundbrunnen-road-bridge-v309-${i}`,parentId:r.key,ring:r.ring,holes:[],minY:r.low,maxY:r.high,low:r.low,high:r.high,topAt:(x:number,z:number)=>topAt(r.triangle,x,z),bottomAt:(x:number,z:number)=>{const y=topAt(r.triangle,x,z);return y===null?null:y-r.thickness;}}));}
/** Exact new body footprint. This never activates a terrain height. */
export function gesundbrunnenRoadBridgeContainsV309(x:number,z:number,native=false):boolean {
 if(native){x=Math.floor(x)+.5;z=Math.floor(z)+.5;}
 return source.sites.some(s=>{const polygons=s.domain.type==='Polygon'?[s.domain.coordinates as number[][][]]:s.domain.coordinates as unknown as number[][][][];return polygons.some(p=>inside(p[0],x,z)&&!p.slice(1).some(h=>inside(h,x,z)));});
}
const indices=new Map<boolean,Map<string,RecordV309[]>>();
function index(native:boolean){let map=indices.get(native);if(map)return map;map=new Map();for(const r of records){if(r.native!==native)continue;const xs=r.ring.map(p=>p[0]),zs=r.ring.map(p=>p[1]);for(let x=Math.floor(Math.min(...xs)/16);x<=Math.floor(Math.max(...xs)/16);x++)for(let z=Math.floor(Math.min(...zs)/16);z<=Math.floor(Math.max(...zs)/16);z++){const key=x+','+z,list=map.get(key)??[];list.push(r);map.set(key,list);}}indices.set(native,map);return map;}
/** Highest actual delivered floor; ordinary walking uses the shared solids. */
export function gesundbrunnenRoadBridgeAtV309(x:number,z:number,native=false):number|null {
 if(!gesundbrunnenRoadBridgeContainsV309(x,z,native))return null;
 let high=-Infinity;for(const r of index(native).get(Math.floor(x/16)+','+Math.floor(z/16))??[]){const y=topAt(r.triangle,x,z);if(y!==null)high=Math.max(high,y);}return Number.isFinite(high)?high:null;
}

/** Exact lower visible floor only; bridge roofs never raise terrain. */
export function gesundbrunnenRoadGroundAtV309(x:number,z:number,native=false):number|null {
 let high=-Infinity;
 for(const r of index(native).get(Math.floor(x/16)+','+Math.floor(z/16))??[]){if(r.role!=='lower-rail-floor')continue;const y=topAt(r.triangle,x,z);if(y!==null)high=Math.max(high,y);}
 return Number.isFinite(high)?high:null;
}

/** Full production bridge/approach navigation; every provider is privately bound. */
export function createGesundbrunnenRoadBridgeNavigationV309(root:Group,native=false){
 const approach=gesundbrunnenBridgeApproachNavigationV309(root,native);if(!approach)throw Error('Missing complete required bridge approach');
 return {solids:[...gesundbrunnenRoadBridgeSolidsV309(native),...approach.solids],groundAt(x:number,z:number):number|null{if(!hasCompleteGesundbrunnenRoadBridgesV309(root,native))return null;return approach.groundAt(x,z)??gesundbrunnenRoadGroundAtV309(x,z,native);}};
}
