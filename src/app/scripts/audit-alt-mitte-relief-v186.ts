/** Offline exact packet preservation and bounded decode measurement. */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { shadeAltMitteFacadeV186 } from '../src/altMitteFacadeReliefV186';
const root=resolve(dirname(fileURLToPath(import.meta.url)), '../../..')+'/';
const pub=root+'src/app/public/mesh/surrounding-berlin-v159/';
const app=root+'src/app/src/data/';
const hash=(x: Uint8Array|string)=>createHash('sha256').update(x).digest('hex');
const codeBefore=hash(readFileSync(root+'src/app/src/altMitteFacadeReliefV186.ts'));
const manifest=JSON.parse(readFileSync(pub+'manifest.json','utf8'));
let total=0,parts=0,triangles=0,verticesChanged=0,totalMs=0,maxSliceMs=0,slices=0,residentMatches=0,residentParts=0;
const rows:any[]=[];
function measure(mesh:any){
 const ps=Buffer.from(mesh.positions,'base64'), cs=Buffer.from(mesh.colors,'base64'), is=Buffer.from(mesh.indices,'base64');
 const p=new Uint16Array(ps.buffer,ps.byteOffset,ps.byteLength/2), indices=new Uint32Array(is.buffer,is.byteOffset,is.byteLength/4);
 const v=new Uint16Array(p.length*2);for(let i=0;i<p.length/3;i++)for(let c=0;c<3;c++){v[i*6+c]=p[i*3+c];v[i*6+c+3]=cs[i*3+c]*257;}
 const before=hash(is), iter=shadeAltMitteFacadeV186(v,indices,0,indices.length);let next:any;let ms=0,peak=0,yields=0;
 do {const t=performance.now();next=iter.next();const d=performance.now()-t;ms+=d;peak=Math.max(peak,d);yields++;} while(!next.done);
 let changed=0;for(let i=0;i<p.length/3;i++){let diff=false;for(let c=0;c<3;c++){if(v[i*6+c]!==p[i*3+c])throw new Error('Position changed');if(v[i*6+c+3]!==cs[i*3+c]*257)diff=true;}if(diff)changed++;}
 if(hash(is)!==before)throw new Error('Index changed');
 return {matches:next.value,changedVertices:changed,triangles:indices.length/3,ms,peakSliceMs:peak,yields};
}
const start=performance.now();
for(const d of manifest.chunks){
 const buf=readFileSync(pub+d.drawn.url);if(hash(buf)!==d.drawn.sha256)throw new Error('Stored manifest hash mismatch '+d.drawn.url);
 const packet=JSON.parse(gunzipSync(buf).toString());const selected=packet.meshes.filter((m:any)=>m.kind==='alt-mitte-v169');if(!selected.length)continue;
 let count=0,ms=0;for(const part of selected){const r=measure(part);parts++;count+=r.matches;total+=r.matches;triangles+=r.triangles;verticesChanged+=r.changedVertices;totalMs+=r.ms;ms+=r.ms;maxSliceMs=Math.max(maxSliceMs,r.peakSliceMs);slices+=r.yields;}
 rows.push({id:d.id,sha256:d.drawn.sha256,parts:selected.length,matches:count,reliefMs:ms});
 if(hash(readFileSync(pub+d.drawn.url))!==d.drawn.sha256)throw new Error('Stored packet changed');
}
const resident=JSON.parse(readFileSync(app+'altMitteDrawnV169Source.json','utf8'));
for(const c of resident.chunkFiles){const packet=JSON.parse(readFileSync(app+c.file,'utf8'));for(const part of packet.meshes){if(part.kind!=='alt-mitte-v169')continue;residentParts++;residentMatches+=measure(part).matches;}}
const result={codeSha256:codeBefore,codeUnchanged:codeBefore===hash(readFileSync(root+'src/app/src/altMitteFacadeReliefV186.ts')),liveManifestSha256:hash(readFileSync(pub+'manifest.json')),streamedPacketCount:rows.length,streamedPartCount:parts,streamedTriangles:triangles,matchedWindowQuads:total,changedVertices:verticesChanged,reliefCpuMs:totalMs,maxGeneratorSliceMs:maxSliceMs,generatorSlices:slices,wallMs:performance.now()-start,residentShellPartsTested:residentParts,residentShellRoleMatches:residentMatches,positionAndIndexBytesPreserved:true,storedPacketHashesPreserved:true,packets:rows};
writeFileSync(process.argv[2] ?? '/tmp/v186-relief-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,packets:undefined},null,2));
