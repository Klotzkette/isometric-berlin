/** Main-thread-only, finite actual-packet surface admission for missing stones.
 * The caller supplies only primary descriptors and owns the returned lifetime. */
import {Group,InstancedMesh,Mesh,ShapeUtils,Vector2,type Object3D}from'three';
import index from'./data/publicMonumentsV326Index.json';
import namedProfile from'./data/oberschoeneweideMemorialV326.json';
import {createPublicMonumentsV326Steps,createOberschoeneweideMemorialV326,hasCompletePublicMonumentsV326,disposePublicMonumentsV326}from'./PublicMonumentsV326';
import {collectUbahnGroundSupportV326Steps,subtractUbahnConvexV326}from'./UbahnGroundSupportV326';
import {mergeUbahnNativeCellsV326}from'./UbahnGroundAtlasV326';
import type{UbahnAccessOpeningV326}from'./UbahnAccessV326';
import type{SurroundingNavigation,SurroundingPolygon}from'./SurroundingCityGeometry';
import {freezeStaticSceneTransforms}from'./staticSceneTransforms';

type Point=number[];
export type PublicMonumentsPacketV326={root:Group|null;geometryBytes:number;bufferCount:number;navigation?:SurroundingNavigation;supportedSourceIds:readonly string[];unsupportedSourceIds:readonly string[];complete():boolean;dispose():void};
export type PublicMonumentsPacketOptionsV326={hosts?:readonly Mesh[];openings?:readonly UbahnAccessOpeningV326[]};
const active=new WeakMap<Object3D,{packet:PublicMonumentsPacketV326;id:string;native:boolean;nav:string;origin:string;openingText:string;hosts?:readonly Mesh[]}>();
const area=(p:readonly Point[])=>{if(!p.length)return 0;const o=p[0];return Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+(a[0]-o[0])*(b[2]-o[2])-(b[0]-o[0])*(a[2]-o[2]);},0))/2;};
const square=(x:number,z:number,w=.1,d=.1)=>[[x-w/2,0,z-d/2],[x+w/2,0,z-d/2],[x+w/2,0,z+d/2],[x-w/2,0,z+d/2]];
const bounds=(p:readonly Point[])=>[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[2])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[2]))];
const overlap=(a:number[],b:number[])=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];

/** Full positive area coverage/intersection, including polygon holes. Centre
 * samples cannot authorize a stone hanging into water or crossing a building. */
function navSupport(nav:SurroundingNavigation,origin:readonly[number,number,number]){
 const cache=new Map<SurroundingPolygon,Point[][]>();
 const triangles=(p:SurroundingPolygon):Point[][]=>{const previous=cache.get(p);if(previous)return previous;
  const rings=[p.ring,...p.holes].map(r=>r.map(q=>new Vector2(q[0]+origin[0],q[1]+origin[2]))),indices=ShapeUtils.triangulateShape(rings[0],rings.slice(1)),vertices=rings.flat();
  const tris=indices.map(ids=>ids.map(i=>[vertices[i].x,0,vertices[i].y]));cache.set(p,tris);return tris;};
 const nearby=(polys:readonly SurroundingPolygon[],footprint:Point[])=>{const b=bounds(footprint);return polys.filter(p=>{let minx=Infinity,minz=Infinity,maxx=-Infinity,maxz=-Infinity;for(const q of p.ring){minx=Math.min(minx,q[0]+origin[0]);maxx=Math.max(maxx,q[0]+origin[0]);minz=Math.min(minz,q[1]+origin[2]);maxz=Math.max(maxz,q[1]+origin[2]);}return overlap(b,[minx,minz,maxx,maxz]);});};
 const remains=(polys:readonly SurroundingPolygon[],footprint:Point[])=>{let remainder=[footprint];for(const p of nearby(polys,footprint))for(const t of triangles(p)){remainder=remainder.flatMap(q=>subtractUbahnConvexV326(q,t));if(!remainder.length)return 0;}return remainder.reduce((n,p)=>n+area(p),0);};
 return(x:number,z:number,w=.1,d=.1)=>{const plate=square(x,z,w,d),total=area(plate);return remains(nav.ground,plate)<1e-10&&total-remains(nav.water,plate)<1e-10&&total-remains(nav.buildings,plate)<1e-10;};
}

/** Only current primary chunk roots. Actual whole 10cm top support and current
 * nav ground membership are independently required; unsupported entries skip. */
export function* createPublicMonumentsPacketV326Steps(root:Object3D,id:string,native:boolean,nav:SurroundingNavigation,origin:readonly[number,number,number],options:PublicMonumentsPacketOptionsV326={}):Generator<void,PublicMonumentsPacketV326>{
 const openingText=JSON.stringify(options.openings??[]),current=active.get(root);if(current){if(current.id===id&&current.native===native&&(current.nav===JSON.stringify(nav)||current.packet.navigation===nav)&&current.origin===JSON.stringify(origin)&&current.openingText===openingText&&current.hosts===options.hosts&&current.packet.complete())return current.packet;current.packet.dispose();}
 const empty:PublicMonumentsPacketV326={root:null,geometryBytes:0,bufferCount:0,supportedSourceIds:[],unsupportedSourceIds:[],complete:()=>false,dispose(){}};
 if(!id||origin.length!==3||!origin.every(Number.isFinite)||!Number.isFinite(nav.groundY))return empty;
 const entries=[...index.entries.map(q=>({id:q.id,point:q.point,width:.1,depth:.1,named:false})),{id:namedProfile.id,point:namedProfile.point,width:namedProfile.widthM,depth:namedProfile.depthM,named:true}].filter(q=>q.point[0]-q.width/2>=origin[0]&&q.point[0]+q.width/2<=origin[0]+512&&q.point[1]-q.depth/2>=origin[2]&&q.point[1]+q.depth/2<=origin[2]+512);
 if(!entries.length||entries.length>256)return empty;
 const excluded:SurroundingPolygon[]=[];
 if(options.openings&&options.openings.length>512)return empty;
 for(const o of options.openings??[]){if(o.native!==native||o.ring.length<3||o.ring.length>128)return empty;
  if(native){if(o.cellM!==.25||!o.nativeCells?.length)return empty;let rectangles:ReturnType<typeof mergeUbahnNativeCellsV326>;try{rectangles=mergeUbahnNativeCellsV326(o.nativeCells);}catch{return empty;}for(const r of rectangles)excluded.push({ring:[[r[0]-origin[0],r[1]-origin[2]],[r[2]-origin[0],r[1]-origin[2]],[r[2]-origin[0],r[3]-origin[2]],[r[0]-origin[0],r[3]-origin[2]]],holes:[]});}
  else{if(!o.ring.every(p=>p.length===2&&p.every(Number.isFinite)))return empty;excluded.push({ring:o.ring.map(p=>[p[0]-origin[0],p[1]-origin[2]]),holes:[]});}
 }
 const supportsNav=navSupport({...nav,water:[...nav.water,...excluded]},origin),candidates=entries.filter(q=>supportsNav(q.point[0],q.point[1],q.width,q.depth)),unsupported=entries.filter(q=>!candidates.includes(q)).map(q=>q.id),supported:string[]=[],heights=new Map<string,number>(),hosts:Mesh[]=options.hosts?.slice()??[];
 if(!options.hosts)root.traverse(q=>{if(q instanceof Mesh)hosts.push(q);});
 root.updateMatrixWorld(true);const navText=JSON.stringify(nav),pose=root.matrix.elements.slice(),proofs:Array<()=>boolean>=[],models:Group[]=[];let result:Group|null=null,delivered=false;
 try{
  for(let start=0;start<candidates.length;start+=192){const batch=candidates.slice(start,start+192),support=yield*collectUbahnGroundSupportV326Steps(root,hosts,batch.map(q=>({point:q.point as[number,number],ring:square(q.point[0],q.point[1],q.width,q.depth).map(p=>[p[0],p[2]]as[number,number])})));
   if(!support){unsupported.push(...batch.map(q=>q.id));continue;}proofs.push(support.complete);
   for(const q of batch){const[x,z]=q.point,y=support.topAt(x,z,nav.groundY),ring=square(x,z,q.width,q.depth).map(p=>[p[0],p[2]]as[number,number]);
    // Reject a partial step/ledge even when all four corners land on something.
    const level=y!==null&&ring.every(p=>{const h=support.topAt(p[0],p[1],y);return h!==null&&Math.abs(h-y)<.003;});
    let remainder=[square(x,z,q.width,q.depth)];if(level)for(const c of support.carriers){const[a,b,d]=c.points,det=(b[2]-d[2])*(a[0]-d[0])+(d[0]-b[0])*(a[2]-d[2]);if(Math.abs(det)<1e-12)continue;const u=((b[2]-d[2])*(x-d[0])+(d[0]-b[0])*(z-d[2]))/det,v=((d[2]-a[2])*(x-d[0])+(a[0]-d[0])*(z-d[2]))/det,h=u*a[1]+v*b[1]+(1-u-v)*d[1];if(Math.abs(h-y!)>=.003)continue;remainder=remainder.flatMap(p=>subtractUbahnConvexV326(p,c.points));if(!remainder.length)break;}
    if(!level||remainder.reduce((n,p)=>n+area(p),0)>1e-10){unsupported.push(q.id);continue;}supported.push(q.id);heights.set(q.id,y!);
   }
   if(!support.complete()||JSON.stringify(nav)!==navText) return empty;yield;
  }
  if(!supported.length)return{...empty,unsupportedSourceIds:Object.freeze(unsupported)};
  if(heights.has(namedProfile.id)&&nav.buildings.length>=20000){heights.delete(namedProfile.id);const at=supported.indexOf(namedProfile.id);if(at>=0)supported.splice(at,1);unsupported.push(namedProfile.id);}
  const byPoint=new Map(candidates.filter(q=>heights.has(q.id)).map(q=>[q.point.join(','),heights.get(q.id)!])),stoneIds=supported.filter(id=>id!==namedProfile.id);
  result=new Group();result.name='Source-supported public memorial packet V326';
  if(stoneIds.length){const stones=yield*createPublicMonumentsV326Steps({native,sourceIds:stoneIds,origin,terrainAt:(x,z)=>byPoint.get(x+','+z)??null});if(!stones)return empty;models.push(stones);result.add(stones);}
  const namedY=heights.get(namedProfile.id);if(namedY!==undefined){const named=createOberschoeneweideMemorialV326(native,namedY,origin);if(!named)return empty;models.push(named);result.add(named);}
  if(!models.length||!proofs.every(p=>p())||JSON.stringify(nav)!==navText||JSON.stringify(options.openings??[])!==openingText||!root.matrix.elements.every((n,i)=>Object.is(n,pose[i])))return empty;
  // Keep the factory's local frame unchanged. Parent root is already translated
  // by source origin; the new child remains at its privately receipted zero pose.
  freezeStaticSceneTransforms(result);root.add(result);if(!models.every(m=>hasCompletePublicMonumentsV326(m,native))||!proofs.every(p=>p())||JSON.stringify(nav)!==navText||JSON.stringify(options.openings??[])!==openingText)return empty;
  let bytes=0,buffers=0;result.traverse(q=>{if(!(q instanceof Mesh))return;const seen=new Set<object>();for(const a of[...Object.values(q.geometry.attributes),q.geometry.index,...(q instanceof InstancedMesh?[q.instanceMatrix,q.instanceColor]:[])]){if(!a)continue;const s='data'in a?a.data:a;if(seen.has(s))continue;seen.add(s);bytes+=s.array.byteLength;buffers++;}});
  let disposed=false;const group=result,poseText=()=>JSON.stringify([...group.position.toArray(),...group.quaternion.toArray(),...group.scale.toArray(),...group.matrix.elements,+group.matrixAutoUpdate,+group.matrixWorldAutoUpdate]),groupPose=poseText(),ring=square(namedProfile.point[0]-origin[0],namedProfile.point[1]-origin[2],namedProfile.widthM,namedProfile.depthM).map(p=>[p[0],p[2]]),navigation=namedY===undefined?undefined:{...nav,buildings:[...nav.buildings,{ring,holes:[],sourceId:'monument:'+namedProfile.id+':v326',minHeight:namedY-nav.groundY,height:namedY+namedProfile.heightM-nav.groundY,...(native?{nativeRoofCaps:[[ring[0][0],ring[0][1],ring[2][0],ring[2][1],namedY+namedProfile.heightM-nav.groundY]]}:{roofTriangles:[[[ring[0][0],namedY+2.5-nav.groundY,ring[0][1]],[ring[1][0],namedY+2.5-nav.groundY,ring[1][1]],[ring[2][0],namedY+2.5-nav.groundY,ring[2][1]]],[[ring[0][0],namedY+2.5-nav.groundY,ring[0][1]],[ring[2][0],namedY+2.5-nav.groundY,ring[2][1]],[ring[3][0],namedY+2.5-nav.groundY,ring[3][1]]]]})}]},navigationText=JSON.stringify(navigation);
  const packet:PublicMonumentsPacketV326={root:group,geometryBytes:bytes,bufferCount:buffers,navigation,supportedSourceIds:Object.freeze(supported.slice()),unsupportedSourceIds:Object.freeze(unsupported.slice()),complete:()=>!disposed&&group.visible&&poseText()===groupPose&&group.parent===root&&group.children.length===models.length&&models.every(m=>m.parent===group&&hasCompletePublicMonumentsV326(m,native))&&JSON.stringify(nav)===navText&&JSON.stringify(navigation)===navigationText&&JSON.stringify(options.openings??[])===openingText&&proofs.every(p=>p()),dispose(){if(disposed)return;disposed=true;if(active.get(root)?.packet===packet)active.delete(root);proofs.length=0;for(const model of models)disposePublicMonumentsV326(model);models.length=0;group.removeFromParent();group.clear();}};
  active.set(root,{packet,id,native,nav:navText,origin:JSON.stringify(origin),openingText,hosts:options.hosts});delivered=true;return packet;
 }finally{if(!delivered){for(const model of models)disposePublicMonumentsV326(model);result?.removeFromParent();result?.clear();}}
}
