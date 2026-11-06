/** Finite real Core/preview captures in both available JS engines.
 * Outputs are new external directories only; original source files stay intact. */
import { readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync } from "node:fs";
import { resolve,dirname,isAbsolute,relative } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import templates from "./federal-ministry-capture-templates-v321.json";

const repo=resolve(import.meta.dir,"../../.."),output=process.argv[2];
if(!output||!isAbsolute(output)||existsSync(output)||!relative(repo,output).startsWith("..")||!existsSync(dirname(output)))throw Error("Fresh absolute external output required");
for(let p=dirname(output);;p=dirname(p)){if(lstatSync(p).isSymbolicLink())throw Error("Symlink output parent rejected");if(p===dirname(p))break;}
const ids=["90009970","27420066","51007654","92578126","35629332","25681062","20021549","-1577820","20021548","-5718719","43174774","47293194","86200232","96687355","03989044","40451892","23517691","40451510","40451513","500004Xm","32510898","n-395094"];
mkdirSync(output);const report:unknown[]=[];
for(const kind of["drawn","preview"]as const){
 const folder=resolve(output,kind);mkdirSync(folder);
 let code=templates[kind].replaceAll("__REPO__",repo.replaceAll("'","\\'")).replaceAll("__OUTPUT__",folder.replaceAll("'","\\'"));
 const pattern=/ids=\[[^\]]*\]/g;if([...code.matchAll(pattern)].length!==1)throw Error("Historical constructor template changed");
 code=code.replace(pattern,"ids="+JSON.stringify(ids));
 if(kind==='drawn')code=code.replace(',moabitMitteV300:false,westKiezV302:false','');
 writeFileSync(folder+'/entry.ts',code,{flag:'wx'});
 const build=await Bun.build({entrypoints:[folder+'/entry.ts'],target:'node',format:'esm',outdir:folder+'/bundle',plugins:[{name:'actual-source-assets',setup(b){
  b.onLoad({filter:/northRuntimeActualV310\.ts$/},a=>({loader:'ts',contents:readFileSync(a.path,'utf8').replace('new URL("../../src/ThreeViewer.tsx",import.meta.url)',JSON.stringify(repo+'/src/app/src/ThreeViewer.tsx'))}));
  b.onResolve({filter:/\?(raw|url)$/},a=>({path:resolve(a.resolveDir,a.path),namespace:'source-asset'}));
  b.onLoad({filter:/.*/,namespace:'source-asset'},a=>{const i=a.path.lastIndexOf('?');return{loader:'js',contents:'export default '+JSON.stringify(a.path.slice(i+1)==='raw'?readFileSync(a.path.slice(0,i),'utf8'):a.path.slice(0,i))};});
 }}]});if(!build.success)throw Error(String(build.logs));
 for(const engine of['node','bun']){
  const result=spawnSync(engine,[folder+'/bundle/entry.js',engine],{encoding:'utf8',maxBuffer:8*1024*1024});writeFileSync(folder+'/'+engine+'.log',result.stdout+result.stderr,{flag:'wx'});if(result.status!==0)throw Error(kind+'/'+engine+': '+result.stderr.slice(-1500));
  const bytes=readFileSync(folder+'/'+engine+'.json');const item={kind,engine,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};report.push(item);console.log(JSON.stringify(item));
 }
}
writeFileSync(output+'/receipt.json',JSON.stringify({schemaVersion:1,scope:'real bounded complete Core and distant preview source; actual production option evaluator',owners:ids,templateSha256:createHash('sha256').update(readFileSync(resolve(import.meta.dir,'federal-ministry-capture-templates-v321.json'))).digest('hex'),captures:report})+'\n',{flag:'wx'});
