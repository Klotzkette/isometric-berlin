import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {facilityPathSourceV350} from '../src/FacilityPathsV350';
const root=resolve(import.meta.dir,'../../..'),data=resolve(root,'src/app/src/data');
const index=JSON.parse(readFileSync(resolve(data,'facilityPathsV350Index.json'),'utf8'));
const meshes:Record<string,unknown>={},times:number[]=[];let maxVertices=0,maxBytes=0;
for(const module of index.sources){
 const source=facilityPathSourceV350({schemaVersion:1,keys:module.keys,decodedBytes:module.decodedBytes,compressed:new Uint8Array(readFileSync(resolve(data,module.file)))});
 for(const key of source.keys){
  const start=performance.now(),mesh=source.packets[key].append;
  times.push(performance.now()-start);meshes[key]=mesh;
  maxVertices=Math.max(maxVertices,Buffer.from(mesh.positions,'base64').length/6);maxBytes=Math.max(maxBytes,Buffer.from(mesh.positions,'base64').length+Buffer.from(mesh.colors,'base64').length+Buffer.from(mesh.indices,'base64').length);
 }
}
times.sort((a,b)=>a-b);
const counts={plans:times.length,medianMs:times[Math.floor(times.length*.5)],p95Ms:times[Math.floor(times.length*.95)],maxMs:times.at(-1),maxVertices,maxDecodedMeshBytes:maxBytes};
writeFileSync(resolve(root,'geo_data/regierungsviertel/raw/facility-paths-v350/expanded-meshes.json.gz'),gzipSync(JSON.stringify(meshes)));
writeFileSync(resolve(root,'geo_data/regierungsviertel/education-v350-paths-expansion.json'),JSON.stringify(counts,null,2)+'\n');
console.log(counts);
