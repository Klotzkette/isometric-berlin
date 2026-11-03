/** Offline actual production loop, identical bundle under V8 and JSC. */
import{readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync}from'node:fs';
import{spawnSync}from'node:child_process';
import{resolve}from'node:path';
import ts from'typescript';
const R=resolve(import.meta.dir,'../../..'),E=process.argv[2];if(!E)throw Error('Explicit fresh external capture directory required');if(existsSync(E)&&readdirSync(E).length)throw Error('Preserve prior captures; output directory must be new or empty');mkdirSync(E,{recursive:true});
const text=readFileSync(R+'/src/app/src/progressiveWorld.worker.ts','utf8'),ast=ts.createSourceFile('worker.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),f=new Map<string,string>();for(const n of ast.statements)if(ts.isFunctionDeclaration(n)&&n.name)f.set(n.name.text,n.getText(ast));
const code=`import{readFileSync,writeFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{Group,Mesh,Line,Points}from'${R}/src/app/node_modules/three';
import{createSmoothSurfaces}from'${R}/src/app/src/IsometricCityWorld';
import{smoothGroundTopSampler,WATER_TOP_Y}from'${R}/src/app/src/terrainPayload';
import{splitParkSurfaceFamily,surfaceFamilyPayload}from'${R}/src/app/src/progressiveWorld';
import{createRestoredRoadSurfaceBatches}from'${R}/src/app/src/restoredRoadSurfaces';
import{compactStaticGeometry}from'${R}/src/app/src/compactStaticGeometry';
import{serializeObject3DForTransfer,deserializeTransferredObject3D}from'${R}/src/app/src/transferableObject3D';
import{cutRosenthalerPresentationV228}from'${R}/src/app/src/RosenthalerSurfaceAperturesV228';
import{cutUbahnPresentationV261}from'${R}/src/app/src/UbahnSurfaceAperturesV261';
import{cutUbahnPresentationV281}from'${R}/src/app/src/UbahnSurfaceAperturesV281';
const B='${R}/src/app/public/mesh/regierungsviertel/',E='${E}',prefix=process.argv[2]??'node-v8-park1';
const hash=(a:ArrayBufferView)=>{let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619)>>>0;return h;};
const file=(suffix:string,a:ArrayBufferView)=>{const b=Buffer.from(a.buffer,a.byteOffset,a.byteLength);writeFileSync(E+'/'+prefix+suffix,b);return{bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),hash:hash(a)};};
const loadJsonResponse=async(url:string)=>new Response(readFileSync(B+url));
const attachedBatchResolvers=new Map<string,()=>void>(),attachedBatchPromises=new Map<string,Promise<void>>(),stages:any[]=[];
const workerScope={postMessage(message:any,transfers:ArrayBuffer[]){const source=structuredClone(message.object,{transfer:transfers}),root=deserializeTransferredObject3D(source)as Group;const collect=(stage:string)=>{const q=root.children.find(q=>q.name==='smooth parkland lawns')as Mesh;stages.push({stage,positions:q.geometry.getAttribute('position').count,indices:q.geometry.index?.count,positionHash:hash(q.geometry.getAttribute('position').array),indexHash:q.geometry.index?hash(q.geometry.index.array):null});};collect('actual-transfer');cutRosenthalerPresentationV228(root,false);cutUbahnPresentationV261(root,false);cutUbahnPresentationV281(root,false);collect('actual-client-cuts');const q=root.children.find(q=>q.name==='smooth parkland lawns')as Mesh;const pos=file('.positions.bin',q.geometry.getAttribute('position').array),ix=file('.indices.bin',q.geometry.index!.array);writeFileSync(E+'/'+prefix+'.json',JSON.stringify({engine:process.versions,stages,pos,ix},null,2));attachedBatchResolvers.get(message.id)!();root.clear();}};
const yieldWorker=async()=>{};const waitForAttachedBatches=async()=>{};
${f.get('removeEmptyGroups')}
${f.get('postBatch')}
${f.get('buildSurfaceFamilies')}
globalThis.fetch=(async()=>new Response(readFileSync('${R}/src/app/src/data/restoredRoadSurfaces.ndjson.txt')))as typeof fetch;
await buildSurfaceFamilies({groundUrl:'ground-context.json',surfacesUrl:'surface-polygons.json',detailProfile:'full',parliamentaryDiningV296:true,waterfrontV296:true}as any,{has:(id:string)=>id!=='surface-parks-1'}as any);
console.log(JSON.stringify(stages));`;
writeFileSync(E+'/worker-park1-v8-entry.ts',code);
const result=await Bun.build({entrypoints:[E+'/worker-park1-v8-entry.ts'],target:'node',format:'esm',outdir:E+'/node-v8-bundle',minify:false,plugins:[{name:'exact-source-raw-url',setup(build){build.onResolve({filter:/\?(raw|url)$/},args=>({path:resolve(args.resolveDir,args.path),namespace:'qa-source-asset'}));build.onLoad({filter:/.*/,namespace:'qa-source-asset'},args=>{const at=args.path.lastIndexOf('?'),path=args.path.slice(0,at),kind=args.path.slice(at+1);return{loader:'js',contents:'export default '+JSON.stringify(kind==='raw'?readFileSync(path,'utf8'):path)};});}}]});if(!result.success){console.log(result.logs);process.exit(1);}console.log(result.outputs.map(o=>[o.path,o.size]));

for(const[engine,prefix]of[['node','node-v8-park1'],['bun','bun-jsc-park1']]){const run=spawnSync(engine,[E+'/node-v8-bundle/worker-park1-v8-entry.js',prefix],{encoding:'utf8'});writeFileSync(E+'/'+prefix+'.log',run.stdout+run.stderr);if(run.status!==0)throw Error('Actual production engine capture failed: '+engine);console.log(engine,run.stdout.trim());}
