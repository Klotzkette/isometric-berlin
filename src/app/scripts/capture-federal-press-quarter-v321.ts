/** Capture the actual retained V272 constructors in JSC and V8, externally. */
import{readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync}from"node:fs";
import{resolve,dirname,isAbsolute,relative}from"node:path";
import{spawnSync}from"node:child_process";
import{createHash}from"node:crypto";
import template from"./federal-press-quarter-capture-v321.json";
const repo=resolve(import.meta.dir,"../../.."),requested=process.argv[2];
if(!requested||!isAbsolute(requested)||requested.split("/").includes(".."))throw Error("Fresh absolute external output required");
const output=resolve(requested);if(!relative(repo,output).startsWith("..")||existsSync(output)||!existsSync(dirname(output)))throw Error("New output outside repository required");
for(let p=dirname(output);;p=dirname(p)){if(lstatSync(p).isSymbolicLink())throw Error("Symlink parent rejected");if(p===dirname(p))break;}
mkdirSync(output);const entry=output+"/entry.ts";writeFileSync(entry,template.entry.replaceAll("__REPO__",repo.replaceAll("'","\\'")).replaceAll("__OUTPUT__",output.replaceAll("'","\\'")),{flag:"wx"});
const built=await Bun.build({entrypoints:[entry],target:"node",format:"esm",outdir:output+"/bundle",plugins:[{name:"actual-constructor-assets",setup(b){b.onResolve({filter:/\?(raw|url)$/},a=>({path:resolve(a.resolveDir,a.path),namespace:"asset"}));b.onLoad({filter:/.*/,namespace:"asset"},a=>{const i=a.path.lastIndexOf("?");return{loader:"js",contents:"export default "+JSON.stringify(a.path.slice(i+1)==="raw"?readFileSync(a.path.slice(0,i),"utf8"):a.path.slice(0,i))};});}}]});
if(!built.success)throw Error(String(built.logs));const results=[];
for(const engine of["bun","node"]){const result=spawnSync(engine,[output+"/bundle/entry.js",engine],{encoding:"utf8",maxBuffer:1024*1024});writeFileSync(output+"/"+engine+".log",result.stdout+result.stderr,{flag:"wx"});if(result.status!==0)throw Error("Actual constructor failed "+result.stderr);const bytes=readFileSync(output+"/"+engine+".json");results.push({engine,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});}
writeFileSync(output+"/capture-receipt.json",JSON.stringify({schemaVersion:1,results})+"\n",{flag:"wx"});console.log(JSON.stringify(results));
