import {verifiedPriorPacketShaV195} from "./losslessPacketsV195";
import {createHash} from "node:crypto";
import {gunzipSync} from "node:zlib";
import {resolve,relative} from "node:path";
import {fileURLToPath} from "node:url";
import receipt from "../../../../geo_data/regierungsviertel/lossless-packets-v194.json";
const sha=(b:Uint8Array|string)=>createHash("sha256").update(b).digest("hex");
if(receipt.rows.length!==96||sha(JSON.stringify(receipt.rows))!=="f9516b6d24d24db6fade459732692c6500a72cbd0090dc5ee5df50ef6056868f")throw Error("Changed finite v194 lossless receipt");
const directory=resolve(import.meta.dir,"../../public/mesh/surrounding-berlin-v159");
const rows=new Map(receipt.rows.map(row=>[row.file,row]));
/** All decoded bytes, including JSON whitespace, survive the finite wire change. */
export function verifiedPriorPacketShaV194(path:string|URL,bytes:Uint8Array):string {
 const filename=relative(directory,resolve(path instanceof URL?fileURLToPath(path):path)),row=rows.get(filename),actual=sha(bytes);
 if(!row)return verifiedPriorPacketShaV195(path,bytes);
 if(actual!==row.newGzipSha256||bytes.byteLength!==row.newGzipBytes)throw Error(`Changed current v194 gzip ${filename}`);
 const raw=gunzipSync(bytes,{maxOutputLength:row.decodedBytes});
 if(raw.byteLength!==row.decodedBytes||sha(raw)!==row.decodedSha256)throw Error(`Changed decoded v194 source ${filename}`);
 return row.gzipSha256;
}
