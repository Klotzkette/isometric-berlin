import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {gunzipSync,gzipSync} from "node:zlib";
import {resolve} from "node:path";
import receipt from "../../../geo_data/regierungsviertel/lossless-packets-v196.json";
import manifest from "../public/mesh/surrounding-berlin-v159/manifest.json";
import {verifiedPriorPacketShaV196} from "./helpers/losslessPacketsV196";
import {verifiedPriorPacketShaV195} from "./helpers/losslessPacketsV195";
import {verifiedPriorPacketShaV193} from "./helpers/losslessPacketsV193";
const directory=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
test("1280 finite gzip alternatives retain every full decoded Git-original byte and old hash through193→196",()=>{
 expect(receipt.rows).toHaveLength(1280);let savings=0;
 for(const row of receipt.rows){const url=new URL(row.file,directory),bytes=readFileSync(url),asset=manifest.chunks.flatMap(c=>[c.drawn,c.minecraft]).find(a=>a.url===row.file)!;
  expect(asset.sha256).toBe(row.newGzipSha256);expect(asset.bytes).toBe(bytes.length);expect(asset.decodedBytes).toBe(row.decodedBytes);
  const before=execFileSync("git",["show",`9727870f79db9c6a6e9d6437668e5ac13229522f:src/app/public/mesh/surrounding-berlin-v159/${row.file}`],{cwd:resolve(import.meta.dir,"../../.."),maxBuffer:16*1024*1024});
  expect(gunzipSync(bytes).equals(gunzipSync(before))).toBe(true);expect(verifiedPriorPacketShaV196(url,bytes)).toBe(row.gzipSha256);expect(verifiedPriorPacketShaV195(url,bytes)).toBe(row.gzipSha256);expect(verifiedPriorPacketShaV193(url,bytes)).toBe(row.gzipSha256);savings+=row.gzipBytes-row.newGzipBytes;
 }expect(savings).toBe(receipt.savedBytes);
},60000);
test("same decoded JSON in unknown wire encodings, changed headers and outside paths cannot claim old fingerprints",()=>{
 const row=receipt.rows[0],url=new URL(row.file,directory),bytes=readFileSync(url),bad=Buffer.from(bytes);bad[9]^=1;
 for(const altered of [bad,gzipSync(gunzipSync(bytes))])expect(()=>verifiedPriorPacketShaV196(url,altered)).toThrow("Changed current v196 gzip");
 const outside=new URL(`../${row.file}`,directory);expect(verifiedPriorPacketShaV196(outside,bytes)).toBe(createHash("sha256").update(bytes).digest("hex"));expect(verifiedPriorPacketShaV196(outside,bytes)).not.toBe(row.gzipSha256);
});
