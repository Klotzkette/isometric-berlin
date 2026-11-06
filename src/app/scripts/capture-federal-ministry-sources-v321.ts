/** Reproduce real complete constructors; output is always a new external tree.
 * Native runs are deliberately sequential and dispose each city before the next.
 * No source, packet, profile, receipt, ref or published asset is written. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync}from"node:fs";
import{resolve,dirname,isAbsolute,relative}from"node:path";
import{spawnSync}from"node:child_process";
import{createHash}from"node:crypto";
import templates from"./federal-ministry-capture-templates-v321.json";
const repo=resolve(import.meta.dir,"../../.."),requested=process.argv[2],kind=process.argv[3]??"all";
if(!requested||!isAbsolute(requested)||requested.split("/").includes(".."))throw Error("Explicit absolute new external output required");
const output=resolve(requested),inside=relative(repo,output);
if(!inside.startsWith("..")||existsSync(output)||!existsSync(dirname(output)))throw Error("Fresh external output and existing parent required");
for(let parent=dirname(output);;parent=dirname(parent)){if(lstatSync(parent).isSymbolicLink())throw Error("Symlink output parent rejected");if(parent===dirname(parent))break;}
const selected=kind==="all"?Object.keys(templates):[kind];if(selected.some(k=>!Object.hasOwn(templates,k)))throw Error("Unknown constructor scope");
mkdirSync(output);const report:any[]=[];
for(const key of selected){
 const folder=resolve(output,({drawn:"core-bounded-r4",native:"native-full-r3",preview:"preview-r1",central:"central-r2"}as Record<string,string>)[key]);mkdirSync(folder);
 const entry=folder+"/entry.ts",text=templates[key as keyof typeof templates].replaceAll("__REPO__",repo.replaceAll("'","\\'")).replaceAll("__OUTPUT__",folder.replaceAll("'","\\'"));writeFileSync(entry,text,{flag:"wx"});
 const build=await Bun.build({entrypoints:[entry],target:"node",format:"esm",outdir:folder+"/bundle",plugins:[{name:"actual-constructor-assets",setup(b){
  b.onLoad({filter:/northRuntimeActualV310\.ts$/},a=>({loader:"ts",contents:readFileSync(a.path,"utf8").replace('new URL("../../src/ThreeViewer.tsx",import.meta.url)',JSON.stringify(repo+"/src/app/src/ThreeViewer.tsx"))}));
  b.onResolve({filter:/\?(raw|url)$/},a=>({path:resolve(a.resolveDir,a.path),namespace:"source-asset"}));
  b.onLoad({filter:/.*/,namespace:"source-asset"},a=>{const i=a.path.lastIndexOf("?");return{loader:"js",contents:"export default "+JSON.stringify(a.path.slice(i+1)==="raw"?readFileSync(a.path.slice(0,i),"utf8"):a.path.slice(0,i))};});
 }}]});if(!build.success)throw Error(String(build.logs));
 const jobs=key==="native"?[["bun","full"],["bun","mobile"],["node","full"],["node","mobile"]]:[["node",""],["bun",""]];
 for(const[engine,mode]of jobs){const name=mode?engine+"-"+mode:engine,result=spawnSync(engine,[folder+"/bundle/entry.js",name,mode],{encoding:"utf8",maxBuffer:20*1024*1024});writeFileSync(folder+"/"+name+".log",result.stdout+result.stderr,{flag:"wx"});if(result.status!==0)throw Error(`Actual ${key}/${name} failed: ${result.stderr.slice(-1200)}`);const bytes=readFileSync(folder+"/"+name+".json");report.push({key,name,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});console.log(JSON.stringify(report.at(-1)));}
}
writeFileSync(output+"/capture-receipt.json",JSON.stringify({schemaVersion:1,scope:kind,constructors:report})+"\n",{flag:"wx"});
