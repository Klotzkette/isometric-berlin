/** Offline, finite v307 predecessor capture. Never imported by the viewer. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {prepareSurroundingQuarterPredecessorV303,buildSurroundingCityChunk} from '../src/SurroundingCityGeometry';
import {createRailStationsV190} from '../src/RailStationsV190';
import {Group,Mesh,InstancedMesh} from 'three';

const here=dirname(fileURLToPath(import.meta.url)),app=resolve(here,'..');
const output=process.argv[2],ids=process.argv.slice(3);
if(!output||!ids.length||ids.some(id=>!/^[A-Za-z0-9_-]+$/.test(id)))throw Error('External output directory and finite explicit packet IDs required');
mkdirSync(output,{recursive:true});
const done=<T>(g:Generator<void,T>):T=>{let r=g.next();while(!r.done)r=g.next();return r.value};
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const fingerprint=(q:any)=>hash(q.positions+q.colors+q.indices);
const pins=(q:any)=>({records:q.meshes.map((m:any,mesh:number)=>({mesh,kind:m.kind,fingerprint:fingerprint(m)})),nav:hash(JSON.stringify(q.nav)),lines:q.lines?hash(q.lines.positions+(q.lines.colors??'')):null});
const b64=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
const flags={golgathaV270:true,operaTheatresV274:true,mitteEnsembleV281:true,cityWestTransportV281:true,schlossplatzV239:true,staatsoperV240:true,architectureV241:true,prenzlbergV264:true,chariteBridgesV265:true,northernSitesV266:true,moabitLandmarksV269:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true};
for(const id of ids)for(const native of [false,true]){
 const mode=native?'minecraft':'drawn',path=resolve(app,'public/mesh/surrounding-berlin-v159',`${id}.${mode}.json.gz`);
 const raw=JSON.parse(gunzipSync(readFileSync(path)).toString());
 const prepared=done(prepareSurroundingQuarterPredecessorV303(structuredClone(raw),id,native,flags));
 const result=done(buildSurroundingCityChunk(structuredClone(raw),id,native,false,flags));
 const body=result.root.children.find(c=>c instanceof Mesh) as Mesh|undefined;
 const geometry=body?.geometry,p=geometry?.getAttribute('position'),c=geometry?.getAttribute('color');
 if(!p||!c||!geometry?.index)throw Error('Complete predecessor geometry missing');
 const positions=new Uint16Array(p.count*3),colors=new Uint16Array(c.count*3);
 for(let i=0;i<p.count;i++){positions.set([p.getX(i),p.getY(i),p.getZ(i)],i*3);colors.set([Math.round(c.getX(i)*65535),Math.round(c.getY(i)*65535),Math.round(c.getZ(i)*65535)],i*3);}
 const indices=Uint32Array.from(geometry.index.array),parts=[];let vo=0,io=0;
 for(let mesh=0;mesh<prepared.meshes.length;mesh++){
  const q=prepared.meshes[mesh],vertices=Buffer.from(q.positions,'base64').length/6,count=Buffer.from(q.indices,'base64').length/4;
  parts.push({mesh,kind:q.kind,vertexStart:vo,vertexCount:vertices,indexStart:io,indexCount:count});vo+=vertices;io+=count;
 }
 if(vo!==p.count||io!==indices.length)throw Error('An unrelated late aperture changed the finite predecessor inventory');
 const line=result.root.children.find(q=>q.type==='LineSegments') as Mesh|undefined;
 const lp=line?.geometry.getAttribute('position'),lc=line?.geometry.getAttribute('color');
 const lines=lp?{positions:b64('data' in lp?lp.data.array:lp.array),stride:'data' in lp?lp.data.stride:3,colors:!!lc}:null;
 writeFileSync(resolve(output,`${id}.${mode}.json`),JSON.stringify({raw,prepared,pins:{raw:pins(raw),prepared:pins(prepared)},nav:result.nav,origin:result.origin,parts,mesh:{positions:b64(positions),colors:b64(colors),indices:b64(indices)},lines}));
 result.root.traverse(q=>{if(q instanceof Mesh){q.geometry.dispose();for(const m of Array.isArray(q.material)?q.material:[q.material])m.dispose();}});
 console.log(id,mode,p.count,indices.length);
}
for(const native of [false,true]){
 const root=createRailStationsV190(native),stations:unknown[]=[];
 root.traverse(q=>{if(q instanceof Group&&['Wedding','Gesundbrunnen','Landsberger Allee'].includes(q.userData.stationName)){
  stations.push({name:q.name,stationName:q.userData.stationName,anchor:q.userData.anchorOsmId,platformIds:q.userData.platformIds,position:q.position.toArray(),children:q.children.map(child=>{
   if(!(child instanceof Mesh))throw Error('Unexpected legacy station child');
   const g=child.geometry;return{name:child.name,attributes:Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{array:b64(a.array),type:a.array.constructor.name,itemSize:a.itemSize,count:a.count,normalized:a.normalized}])),index:g.index?{array:b64(g.index.array),type:g.index.array.constructor.name,count:g.index.count}:null,position:child.position.toArray(),scale:child.scale.toArray(),instanceCount:child instanceof InstancedMesh?child.count:null,matrix:child instanceof InstancedMesh?b64(child.instanceMatrix.array):null,color:child instanceof InstancedMesh&&child.instanceColor?b64(child.instanceColor.array):null};
  })});
 }});
 writeFileSync(resolve(output,`legacy.${native?'minecraft':'drawn'}.json`),JSON.stringify(stations));
 root.traverse(q=>{if(q instanceof Mesh){q.geometry.dispose();for(const m of Array.isArray(q.material)?q.material:[q.material])m.dispose();}});
}
