/** Offline audit bridge only; never imported by the product. */
import {createHash} from "node:crypto";
import {gunzipSync} from "node:zlib";
import {resolve,relative} from "node:path";
import {fileURLToPath} from "node:url";
import receipt from "../../../../geo_data/regierungsviertel/lossless-packets-v196.json";
const sha=(b:Uint8Array|string)=>createHash("sha256").update(b).digest("hex");
if(receipt.rows.length!==1280||!receipt.applied||receipt.savedBytes!==27748130||sha(JSON.stringify(receipt.rows))!=="18adfcef8f07deac696596478a2af633215ba1fce1db93a7f7fc55c60654259f")throw Error("Changed finite v196 lossless receipt");
const directory=resolve(import.meta.dir,"../../public/mesh/surrounding-berlin-v159");
const rows=new Map(receipt.rows.map(row=>[row.file,row]));
export function verifiedPriorPacketShaV196(path:string|URL,bytes:Uint8Array):string {
 const filename=relative(directory,resolve(path instanceof URL?fileURLToPath(path):path)),row=rows.get(filename),actual=sha(bytes);
 if(!row)return actual;
 const old=actual===row.gzipSha256;
 if(actual!==(old?row.gzipSha256:row.newGzipSha256)||bytes.byteLength!==(old?row.gzipBytes:row.newGzipBytes))throw Error(`Changed current v196 gzip ${filename}`);
 const raw=gunzipSync(bytes,{maxOutputLength:row.decodedBytes});
 if(raw.byteLength!==row.decodedBytes||sha(raw)!==row.decodedSha256)throw Error(`Changed decoded v196 source ${filename}`);
 return row.gzipSha256;
}
