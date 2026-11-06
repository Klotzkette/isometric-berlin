/** Real Full/Touch city, combined Gov+university gate, parking and exact rollback.
 * Only external evidence is written; one actual world exists at a time. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync} from "node:fs";
import {resolve,dirname,isAbsolute,relative} from "node:path";
import {spawnSync} from "node:child_process";
import templates from "./federal-ministry-capture-templates-v321.json";
const repo=resolve(import.meta.dir,"../../.."),output=process.argv[2];
if(!output||!isAbsolute(output)||existsSync(output)||!relative(repo,output).startsWith("..")||!existsSync(dirname(output)))throw Error("Fresh absolute external directory required");
for(let p=dirname(output);;p=dirname(p)){if(lstatSync(p).isSymbolicLink())throw Error("Symlink output rejected");if(p===dirname(p))break;}
mkdirSync(output);
let code=templates.native.replaceAll("__REPO__",repo.replaceAll("'","\\'")).replaceAll("__OUTPUT__",output.replaceAll("'","\\'"));
code=code.replace("if(mobile)await run(interleaveStaticGeometrySteps(root),'actual-touch-interleave');await run(parkStaticInstancesSteps(root),'actual-instance-parking');","root.add(createRosengartenMinecraft());");
code=`import{createRosengartenMinecraft}from'${repo}/src/app/src/Rosengarten';import{createGovernmentOfficesV321Steps}from'${repo}/src/app/src/GovernmentOfficesV321';import{prepareFederalMinistryPressQuarterSourceV321}from'${repo}/src/app/src/FederalMinistryPressQuarterV321';import{createHash}from'node:crypto';`+code;
code=code.replace("import{readFileSync,writeFileSync}","import{readFileSync,writeFileSync,appendFileSync}");
code=code.replace("let n=0;for(;;){const s=g.next();if(s.done)break;",`let n=0,maximum=0,result:any;appendFileSync('${output}/phases.ndjson',JSON.stringify({key,name,event:'start',at:Date.now()})+'\\n');for(;;){const t=performance.now(),s=g.next();maximum=Math.max(maximum,performance.now()-t);if(s.done){result=s.value;break;}`);
code=code.replace("stages.push({name,yields:n,ms:performance.now()-start});",`stages.push({name,yields:n,ms:performance.now()-start,maxSliceMs:maximum});appendFileSync('${output}/phases.ndjson',JSON.stringify({key,name,event:'done',yields:n,maxSliceMs:maximum,at:Date.now()})+'\\n');`);
code=code.replace("console.log(key,name,Math.round(performance.now()-start));}","console.log(key,name,Math.round(performance.now()-start));return result;}");
const mark="const raw=(a:any)=>";if(!code.includes(mark))throw Error("Actual capture template moved");
code=code.slice(0,code.indexOf(mark))+`
const sha=(a:any)=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const sources:any[]=[];root.traverse((o:any)=>{if(o.isInstancedMesh&&['Voxel building columns','Voxel facade windows','Independent orthogonal Springer/taz surfaces, artwork and street fronts'].includes(o.name))sources.push({o,matrix:o.instanceMatrix,color:o.instanceColor,hash:sha(o.instanceMatrix.array),colorHash:o.instanceColor?sha(o.instanceColor.array):null});});
if(!sources.some(s=>s.o.name==='Voxel building columns'))throw Error('Actual whole city body host missing');
if(!await prepareFederalMinistryPressQuarterSourceV321(true))throw Error('Original Press source rejected');
const gov=await run(createGovernmentOfficesV321Steps({sourcePrisms:prisms.buildings,voxels,native:true,mobileLike:mobile,includeUniversitiesV322:true}),'complete-combined-factory');if(!gov)throw Error('Combined factory closed');root.add(gov.root);
if(!await run(gov.stagePreviousSteps(root),'combined-actual-source-stage'))throw Error('Actual combined city source rejected');
const press=root.getObjectByName('Press quarter v272 independent native architecture');if(!press||!await run(gov.stagePressQuarterSteps(press),'actual-Press-stage'))throw Error('Actual Press source rejected');
if(!gov.complete()||!gov.universitiesReadyV322?.())throw Error('Complete actual university gate closed');
let changedRows=0,outsideWords=0;
for(const s of sources){const old=s.matrix.array,current=s.o.instanceMatrix.array,ow=new Uint32Array(old.buffer,old.byteOffset,old.length),nw=new Uint32Array(current.buffer,current.byteOffset,current.length);if(ow.length!==nw.length)throw Error('Original whole host length changed');
 for(let row=0;row<ow.length/16;row++){let changed=false;for(let k=0;k<16;k++)if(ow[row*16+k]!==nw[row*16+k])changed=true;if(changed){changedRows++;for(let k=0;k<16;k++){if([0,1,2,4,5,6,8,9,10].includes(k)){if(nw[row*16+k]!==0)throw Error('Nonzero retired scale');}else if(ow[row*16+k]!==nw[row*16+k])throw Error('Retired translation/affine word changed');}}else outsideWords+=16;}
 if(s.colorHash&&sha(s.o.instanceColor.array)!==s.colorHash)throw Error('Original colour words changed');s.matrix.onUploadCallback();s.o.instanceMatrix.onUploadCallback();}
await run(parkStaticInstancesSteps(root),'actual-post-stage-instance-parking');root.traverse((o:any)=>{if(o.isInstancedMesh)o.instanceMatrix.onUploadCallback();});await new Promise(r=>setTimeout(r,0));
(globalThis as any).__universityInflates=0;const completeStart=performance.now();for(let i=0;i<100;i++)if(!gov.complete())throw Error('Post-parking live receipt closed');const complete100Ms=performance.now()-completeStart,completeInflates=(globalThis as any).__universityInflates;
if(completeInflates!==0)throw Error('Normal Complete restored parked CPU views');
gov.rollback();for(const s of sources){if(s.o.instanceMatrix!==s.matrix||s.o.instanceColor!==s.color||sha(s.matrix.array)!==s.hash||s.colorHash&&sha(s.color.array)!==s.colorHash)throw Error('Exact original source rollback failed');}
writeFileSync('${output}/'+key+'.json',JSON.stringify({schemaVersion:1,engine:process.versions,mobile,stages,sourceHosts:sources.map(s=>({name:s.o.name,count:s.o.count,originalSha256:s.hash,colourSha256:s.colorHash})),changedRows,outsideWords,complete100Ms,completeInflates,allOriginalRefsAndWordsRestored:true}));
const resources=new Set<any>();root.traverse((o:any)=>{if(o.isMesh||o.isLine||o.isPoints){if(o.geometry)resources.add(o.geometry);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m?.dispose)resources.add(m);if(o.isInstancedMesh)resources.add(o);}});for(const q of resources)q.dispose();root.clear();console.log(key,'actual combined university gate passed',complete100Ms,changedRows,outsideWords);
`;
writeFileSync(output+"/entry.ts",code,{flag:"wx"});
const build=await Bun.build({entrypoints:[output+"/entry.ts"],target:"bun",outdir:output+"/bundle",plugins:[{name:"actual-assets-and-readonly-inflate-counter",setup(b){
 b.onLoad({filter:/northRuntimeActualV310\.ts$/},a=>({loader:"ts",contents:readFileSync(a.path,"utf8").replace('new URL("../../src/ThreeViewer.tsx",import.meta.url)',JSON.stringify(repo+"/src/app/src/ThreeViewer.tsx"))}));
 b.onLoad({filter:/fflate\.module\.js$/},a=>({loader:"js",contents:readFileSync(a.path,"utf8").replace('export function inflateSync(data, opts) {','export function inflateSync(data, opts) { globalThis.__universityInflates=(globalThis.__universityInflates??0)+1;')}));
 b.onResolve({filter:/\?(raw|url)$/},a=>({path:resolve(a.resolveDir,a.path),namespace:"source-asset"}));
 b.onLoad({filter:/.*/,namespace:"source-asset"},a=>{const i=a.path.lastIndexOf("?");return{loader:"js",contents:"export default "+JSON.stringify(a.path.slice(i+1)==="raw"?readFileSync(a.path.slice(0,i),"utf8"):a.path.slice(0,i))};});
}}]});if(!build.success)throw Error(String(build.logs));
for(const mode of["full","mobile"]){console.log("actual combined university probe starting",mode);const p=spawnSync("bun",[output+"/bundle/entry.js","bun-"+mode,mode],{encoding:"utf8",maxBuffer:4*1024*1024});writeFileSync(output+"/bun-"+mode+".log",p.stdout+p.stderr,{flag:"wx"});if(p.status!==0)throw Error(p.stderr.slice(-3000));console.log(p.stdout.slice(-1500));}
