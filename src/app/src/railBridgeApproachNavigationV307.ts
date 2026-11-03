/** Navigation shares actual privately admitted render buffers, never duplicates. */
import{Group,Mesh}from'three';
import{hasCompleteRailBridgeApproachV307}from'./RailBridgeApproachV307';
import source from'./data/railBridgeApproachV307Navigation.json';
import profile from'./data/railBridgeApproachV307Profile.json';
type Spec={key:string;native:boolean;cells:Record<string,number[][]>;volumes:number[][]};
function inRing(r:readonly number[][],x:number,z:number){let v=false;for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>z)!==(r[j][1]>z)&&x<(r[j][0]-r[i][0])*(z-r[i][1])/(r[j][1]-r[i][1])+r[i][0])v=!v;return v;}
function contains(g:{type:string;coordinates:unknown},x:number,z:number){const ps=g.type==='Polygon'?[g.coordinates as number[][][]]:g.coordinates as number[][][][];return ps.some(p=>inRing(p[0],x,z)&&!p.slice(1).some(h=>inRing(h,x,z)));}
export function railBridgeApproachContainsV307(x:number,z:number,native=false):boolean{if(native){x=Math.floor(x/4)*4+2;z=Math.floor(z/4)*4+2;}return contains(profile.domain,x,z);}
/** Caller activates these providers only with its entire private BridgeRoot. */
export function createRailBridgeApproachNavigationV307(root:Group,native=false){
 if(!hasCompleteRailBridgeApproachV307(root,native))throw Error('Missing complete actual approach root');
 const meshes=new Map(root.children.filter((q):q is Mesh=>q instanceof Mesh).map(q=>[q.name,q]));
 if(source.schemaVersion!==1)throw Error('Invalid finite approach contact index');
 const catalog=source.models as unknown as Spec[];
 if(!Array.isArray(catalog)||new Set(catalog.map(q=>q.key)).size!==catalog.length)throw Error('Duplicate approach index family');
 const specs=catalog.filter(q=>q.native===native).map(s=>{const mesh=meshes.get(s.key);if(!mesh)throw Error('Missing actual approach contact');
 const faces=(mesh.geometry.index?.count??0)/3;
 const ordinal=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<faces;
 if(!s.cells||!s.volumes||Object.values(s.cells).some(runs=>!Array.isArray(runs)||runs.some(r=>r.length!==2||!ordinal(r[0])||!Number.isSafeInteger(r[1])||r[1]<1||r[0]+r[1]>faces))||s.volumes.some(v=>v.length<2||v.some(n=>!ordinal(n))))throw Error('Approach navigation escaped actual admitted render geometry');
 return{s,mesh};});
 const point=(mesh:Mesh,id:number)=>{const a=mesh.geometry.getAttribute('position');return[a.getX(id)*mesh.scale.x+mesh.position.x,a.getY(id)*mesh.scale.y+mesh.position.y,a.getZ(id)*mesh.scale.z+mesh.position.z];};
 const face=(mesh:Mesh,n:number)=>{const ix=mesh.geometry.index!;return[point(mesh,ix.getX(n*3)),point(mesh,ix.getX(n*3+1)),point(mesh,ix.getX(n*3+2))];};
 function at(mesh:Mesh,n:number,x:number,z:number):number|null{const[a,b,c]=face(mesh,n),d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-9)return null;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;return Math.min(u,v,1-u-v)>=-1e-7?u*a[1]+v*b[1]+(1-u-v)*c[1]:null;}
 const gate=()=>hasCompleteRailBridgeApproachV307(root,native);
 const solids:Array<{sourceId:string;parentId:string;role:string;ring:number[][];holes:number[][][];minY:number;maxY:number;low:number;high:number;topAt:(x:number,z:number)=>number|null;bottomAt:(x:number,z:number)=>number|null}>=specs.flatMap(({s,mesh})=>s.volumes.map(([top,...bottoms])=>{const t=face(mesh,top),low=bottoms.flatMap(n=>face(mesh,n)),min=Math.min(...low.map(p=>p[1])),max=Math.max(...t.map(p=>p[1]));return{sourceId:s.key+':'+top,parentId:'rail-bridge-approach-v307',role:'ground',ring:t.map(p=>[p[0],p[2]]),holes:[],minY:min,maxY:max,low:min,high:max,topAt:(x:number,z:number)=>gate()?at(mesh,top,x,z):null,bottomAt:(x:number,z:number)=>{if(!gate())return null;for(const n of bottoms){const y=at(mesh,n,x,z);if(y!==null)return y;}return null;}};}));
 for(const h of source.houses.filter(q=>q.native===native)){
  const nav=h.sourceNav as {groundOffset?:number;nativeRoofCaps?:number[][];roofTriangles?:number[][][]},ground=3+(nav.groundOffset??0);
  const roofAt=(x:number,z:number):number|null=>{
   if(!gate())return null;
   if(nav.nativeRoofCaps){let high=-Infinity;for(const c of nav.nativeRoofCaps)if(x>=c[0]&&x<=c[2]&&z>=c[1]&&z<=c[3])high=Math.max(high,ground+c[4]);return Number.isFinite(high)?high:null;}
   if(nav.roofTriangles){let high=-Infinity;for(const[a,b,c]of nav.roofTriangles){const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-9)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;if(Math.min(u,v,1-u-v)>=-1e-7)high=Math.max(high,ground+u*a[1]+v*b[1]+(1-u-v)*c[1]);}return Number.isFinite(high)?high:null;}
   return h.high;
  };
  solids.push({sourceId:h.key,parentId:'rail-bridge-approach-v307',role:'building',ring:h.ring,holes:h.holes,minY:h.low,maxY:h.high,low:h.low,high:h.high,topAt:roofAt,bottomAt:()=>gate()?h.low:null});
 }
 return{solids,groundAt(x:number,z:number):number|null{if(!gate())return null;let high=-Infinity;const keys=new Set([Math.floor(x/4)+','+Math.floor(z/4)]);if(x%4===0)keys.add((Math.floor(x/4)-1)+','+Math.floor(z/4));if(z%4===0){keys.add(Math.floor(x/4)+','+(Math.floor(z/4)-1));if(x%4===0)keys.add((Math.floor(x/4)-1)+','+(Math.floor(z/4)-1));}for(const{s,mesh}of specs)for(const key of keys)for(const[start,count]of s.cells[key]??[])for(let i=start;i<start+count;i++){const y=at(mesh,i,x,z);if(y!==null)high=Math.max(high,y);}return Number.isFinite(high)?high:null;}};
}
