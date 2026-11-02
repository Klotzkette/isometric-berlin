import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import receipt from "../../../geo_data/regierungsviertel/lossless-packets-v193.json";
import manifest from "../public/mesh/surrounding-berlin-v159/manifest.json";
import {verifiedPriorPacketShaV193} from "./helpers/losslessPacketsV193";
const directory=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
test("24 finite current assets retain complete decoded source bytes and exact old gzip lineage while saving 4940271 bytes",()=>{
 expect(receipt.rows).toHaveLength(24);let savings=0;
 for(const row of receipt.rows){
  const url=new URL(row.file,directory),bytes=readFileSync(url),asset=manifest.chunks.flatMap(c=>[c.drawn,c.minecraft]).find(a=>a.url===row.file)!;
  expect(asset).toBeDefined();expect(asset.sha256).toBe(row.newGzipSha256);expect(asset.bytes).toBe(bytes.length);expect(asset.decodedBytes).toBe(row.decodedBytes);
  expect(verifiedPriorPacketShaV193(url,bytes)).toBe(row.gzipSha256);savings+=row.gzipBytes-row.newGzipBytes;
 }
 expect(savings).toBe(4940271);expect(savings).toBe(receipt.savedBytes);
});
test("a forged same-name path and changed compressed bytes cannot pass a historical hash",()=>{
 const row=receipt.rows[0],url=new URL(row.file,directory),bytes=readFileSync(url),changed=Buffer.from(bytes);changed[9]^=1;
 expect(()=>verifiedPriorPacketShaV193(url,changed)).toThrow("Changed current gzip");
 const other=new URL(`../${row.file}`,directory);
 expect(verifiedPriorPacketShaV193(other,bytes)).toBe(createHash("sha256").update(bytes).digest("hex"));
 expect(verifiedPriorPacketShaV193(other,bytes)).not.toBe(row.gzipSha256);
});
