/** Full real native constructors, one at a time, bounded output before parking. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync} from "node:fs";
import {resolve,dirname,isAbsolute,relative} from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import templates from "./federal-ministry-capture-templates-v321.json";

const repo=resolve(import.meta.dir,"../../.."),output=process.argv[2],engine=process.argv[3]??'bun';
if(!['bun','node'].includes(engine)||!output||!isAbsolute(output)||existsSync(output)||!relative(repo,output).startsWith('..')||!existsSync(dirname(output)))throw Error('Fresh absolute external output and known engine required');
for(let p=dirname(output);;p=dirname(p)){if(lstatSync(p).isSymbolicLink())throw Error('Symlink output parent rejected');if(p===dirname(p))break;}
mkdirSync(output);
let code=templates.native.replaceAll('__REPO__',repo.replaceAll("'","\\'")).replaceAll('__OUTPUT__',output.replaceAll("'","\\'"));
const pattern=/sites=\[.*?\];const load=/s;if([...code.matchAll(new RegExp(pattern.source,'gs'))].length!==1)throw Error('Native source template changed');
code=code.replace(pattern,'sites='+JSON.stringify([{key:'bht',bounds:[-1510,-3100,-900,-2600]},{key:'tu',bounds:[-3550,250,-2700,1100]},{key:'hu',bounds:[1200,-250,1520,40]}])+';const load=');
// Current production stages the university/government source before immutable
// instance parking. Never repeatedly inflate an entire world to capture rows.
code=code.replace("if(mobile)await run(interleaveStaticGeometrySteps(root),'actual-touch-interleave');await run(parkStaticInstancesSteps(root),'actual-instance-parking');",'root.add(createRosengartenMinecraft());');
code="import{createRosengartenMinecraft}from'"+repo+"/src/app/src/Rosengarten';"+code;
code=code.replace("import{readFileSync,writeFileSync}","import{readFileSync,writeFileSync,appendFileSync}");
code=code.replace("async function run(g:any,name:string){let n=0;",`async function run(g:any,name:string){appendFileSync('${output}/phases.ndjson',JSON.stringify({key,name,event:'start',at:Date.now()})+'\\n');let n=0;`);
code=code.replace("stages.push({name,yields:n,ms:performance.now()-start});",`stages.push({name,yields:n,ms:performance.now()-start});appendFileSync('${output}/phases.ndjson',JSON.stringify({key,name,event:'done',yields:n,ms:performance.now()-start,at:Date.now()})+'\\n');`);
writeFileSync(output+'/entry.ts',code,{flag:'wx'});
const build=await Bun.build({entrypoints:[output+'/entry.ts'],target:'node',format:'esm',outdir:output+'/bundle',plugins:[{name:'actual-native-assets',setup(b){
 b.onLoad({filter:/northRuntimeActualV310\.ts$/},a=>({loader:'ts',contents:readFileSync(a.path,'utf8').replace('new URL("../../src/ThreeViewer.tsx",import.meta.url)',JSON.stringify(repo+'/src/app/src/ThreeViewer.tsx'))}));
 b.onResolve({filter:/\?(raw|url)$/},a=>({path:resolve(a.resolveDir,a.path),namespace:'source-asset'}));
 b.onLoad({filter:/.*/,namespace:'source-asset'},a=>{const i=a.path.lastIndexOf('?');return{loader:'js',contents:'export default '+JSON.stringify(a.path.slice(i+1)==='raw'?readFileSync(a.path.slice(0,i),'utf8'):a.path.slice(0,i))};});
}}]});if(!build.success)throw Error(String(build.logs));
const captures:unknown[]=[];
for(const mode of['full','mobile']){
 console.log('starting',engine,mode);
 const key=engine+'-'+mode,result=spawnSync(engine,[output+'/bundle/entry.js',key,mode],{encoding:'utf8',maxBuffer:8*1024*1024});writeFileSync(output+'/'+key+'.log',result.stdout+result.stderr,{flag:'wx'});if(result.status!==0)throw Error(key+': '+result.stderr.slice(-1500));
 const bytes=readFileSync(output+'/'+key+'.json');const item={engine,mode,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};captures.push(item);console.log(JSON.stringify(item));
}
writeFileSync(output+'/receipt.json',JSON.stringify({schemaVersion:1,scope:'actual complete native constructor, required sites, Neukoelln source pass and Rosengarten; bounded output before optional government stage/parking',captures})+'\n',{flag:'wx'});
