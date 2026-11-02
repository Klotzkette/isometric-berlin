import {createHash} from "node:crypto";
import {gunzipSync} from "node:zlib";
import {resolve,relative} from "node:path";
import {fileURLToPath} from "node:url";
import receipt from "../../../../geo_data/regierungsviertel/lossless-packets-v193.json";

const sha=(b:Uint8Array|string)=>createHash("sha256").update(b).digest("hex");
if(receipt.rows.length!==24||sha(JSON.stringify(receipt.rows))!=="29b228ac4935662000238d1b640a80e6be29fb68083c425e42bff248d57468aa")throw Error("Changed finite v193 gzip receipt");
const directory=resolve(import.meta.dir,"../../public/mesh/surrounding-berlin-v159");
const rows=new Map(receipt.rows.map(row=>[row.file,row]));

/** Historical tests retain their original gzip pins. Only these 24 independently
 * receipted wire encodings may differ, after the entire decoded source has been
 * proved identical. No product path imports this test-only verifier. */
export function verifiedPriorPacketShaV193(path:string|URL,bytes:Uint8Array):string {
 const filename=relative(directory,resolve(path instanceof URL?fileURLToPath(path):path)),row=rows.get(filename),actual=sha(bytes);
 if(!row)return actual;
 if(actual!==row.newGzipSha256||bytes.byteLength!==row.newGzipBytes)throw Error(`Changed current gzip ${filename}`);
 const raw=gunzipSync(bytes,{maxOutputLength:row.decodedBytes});
 if(raw.byteLength!==row.decodedBytes||sha(raw)!==row.decodedSha256)throw Error(`Changed decoded source ${filename}`);
 return row.gzipSha256;
}
