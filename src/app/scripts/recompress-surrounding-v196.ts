/** Finite read-only dry run against immutable published v195 Git blobs.
 * Never writes live packets, manifest or historical helpers/pins. */
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync,mkdirSync,existsSync} from "node:fs";
import {resolve} from "node:path";
import {execFileSync} from "node:child_process";
import {gunzipSync} from "node:zlib";
import {gzipAsync} from "@gfx/zopfli";
import defaultSources from "../losslessSurroundingV196Sources.json";

const anchor="9727870f79db9c6a6e9d6437668e5ac13229522f";
const sourcePath=process.argv.find(a=>a.startsWith("--sources="))?.slice(10);
const sources=sourcePath?JSON.parse(readFileSync(sourcePath,"utf8")) as typeof defaultSources:defaultSources;
if(process.argv.includes("--apply"))throw Error("v196 preparation is read-only; release integration requires separate authorization");
const output=resolve(process.argv.find(a=>a.startsWith("--out="))?.slice(6)??"/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/release-plan-v196/lossless-v196");
mkdirSync(output,{recursive:true});
const base=resolve(import.meta.dir,"../public/mesh/surrounding-berlin-v159"),repo=resolve(import.meta.dir,"../../..");
const hash=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
const git=(name:string)=>execFileSync("git",["show",`${anchor}:src/app/public/mesh/surrounding-berlin-v159/${name}`],{cwd:repo,maxBuffer:16*1024*1024});
const start=performance.now();
for(const s of sources) {
  const live=readFileSync(resolve(base,s.file)),original=git(s.file),raw=gunzipSync(original);
  if(!live.equals(original)||original.length!==s.gzipBytes||hash(original)!==s.gzipSha256||raw.length!==s.decodedBytes||hash(raw)!==s.decodedSha256)throw Error(`Changed complete Git source ${s.file}`);
}
const rows=[];
for(const s of sources) {
  const original=git(s.file),raw=gunzipSync(original),cache=resolve(output,s.file);
  const compressed=existsSync(cache)?readFileSync(cache):await gzipAsync(raw,{numiterations:1});
  if(!gunzipSync(compressed,{maxOutputLength:raw.length}).equals(raw)||compressed.length>=original.length)throw Error(`Invalid full-byte lossless alternative ${s.file}`);
  writeFileSync(cache,compressed);
  rows.push({...s,newGzipBytes:compressed.length,newGzipSha256:hash(compressed),savedBytes:original.length-compressed.length});
  console.log(`${rows.length}/${sources.length} ${s.file}: ${original.length-compressed.length} bytes saved`);
}
const manifest=JSON.parse(git("manifest.json").toString()),delta=[];
for(const row of rows) {
 const descriptor=manifest.chunks.find((c:{id:string})=>c.id===row.chunkId),old=descriptor?.[row.mode];
 if(!old||old.url!==row.file||old.bytes!==row.gzipBytes||old.sha256!==row.gzipSha256||old.decodedBytes!==row.decodedBytes)throw Error(`Changed original descriptor ${row.file}`);
 delta.push({id:row.chunkId,mode:row.mode,before:old,after:{...old,bytes:row.newGzipBytes,sha256:row.newGzipSha256}});
}
for(const s of sources)if(!readFileSync(resolve(base,s.file)).equals(git(s.file)))throw Error(`Live packet changed during dry run ${s.file}`);
const elapsedMs=Math.round(performance.now()-start);
writeFileSync(resolve(output,"receipt.json"),JSON.stringify({step:10,applied:false,anchor,method:"Zopfli one iteration; every full decompression equals immutable Git original",savedBytes:rows.reduce((n,r)=>n+r.savedBytes,0),elapsedMs,rows},null,2)+"\n");
writeFileSync(resolve(output,"manifest-delta.json"),JSON.stringify({anchor,applied:false,onlyFields:["bytes","sha256"],rows:delta},null,2)+"\n");
console.log(JSON.stringify({savedBytes:rows.reduce((n,r)=>n+r.savedBytes,0),elapsedMs}));
