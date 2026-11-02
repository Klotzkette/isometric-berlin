/** Step 10: finite, byte-identical decoded alternatives for 96 old packets.
 * No runtime codec, source coordinate, index, colour or navigation change.
 * Defaults to external dry output; --apply requires all original source pins.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { gzipAsync } from "@gfx/zopfli";
import sources from "../losslessSurroundingV194Sources.json";

const hash=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
const apply=process.argv.includes("--apply");
const output=resolve(process.argv.find(a=>a.startsWith("--out="))?.slice(6)??"/tmp/isometric-berlin-lossless-v194");
mkdirSync(output,{recursive:true});
const base=resolve(import.meta.dir,"../public/mesh/surrounding-berlin-v159");
const inputs=sources.map(s=>{
  const bytes=readFileSync(resolve(base,s.file));
  const raw=gunzipSync(bytes);
  if(bytes.length!==s.gzipBytes||hash(bytes)!==s.gzipSha256||raw.length!==s.decodedBytes||hash(raw)!==s.decodedSha256)throw Error(`Changed original lossless source ${s.file}`);
  return s;
});
const rows=[];
for(const s of inputs){
  const raw=gunzipSync(readFileSync(resolve(base,s.file)));
  // A previous dry output is reusable only after an exact bounded full-byte
  // roundtrip against this freshly pinned source. It is never a live cache.
  const cached=resolve(output,s.file);
  const compressed=existsSync(cached)?readFileSync(cached):await gzipAsync(raw,{numiterations:1});
  if(!gunzipSync(compressed,{maxOutputLength:raw.length}).equals(raw)||compressed.length>=s.gzipBytes)throw Error(`Invalid lossless result ${s.file}`);
  writeFileSync(resolve(output,s.file),compressed);
  rows.push({...s,newGzipBytes:compressed.length,newGzipSha256:hash(compressed),savedBytes:s.gzipBytes-compressed.length});
  console.log(`${s.file}: ${s.gzipBytes-compressed.length} bytes saved`);
}
// All transformations finish and verify before the first source file changes.
if(apply)for(const s of inputs){const bytes=readFileSync(resolve(base,s.file));if(hash(bytes)!==s.gzipSha256)throw Error(`Source changed during preparation ${s.file}`);}
if(apply)for(const row of rows)writeFileSync(resolve(base,row.file),readFileSync(resolve(output,row.file)));
writeFileSync(resolve(output,"receipt.json"),JSON.stringify({step:10,applied:apply,method:"Zopfli one iteration; exact decompressed bytes verified",savedBytes:rows.reduce((n,r)=>n+r.savedBytes,0),rows},null,2)+"\n");
