import {createHash} from "node:crypto";
import {gunzipSync} from "node:zlib";
import {resolve,relative} from "node:path";
import {fileURLToPath} from "node:url";
import receipt from "../../../../geo_data/regierungsviertel/lossless-packets-v195.json";
const sha=(b:Uint8Array|string)=>createHash("sha256").update(b).digest("hex");
if(receipt.rows.length!==96||!receipt.applied||receipt.savedBytes!==5203540||sha(JSON.stringify(receipt.rows))!=="9a150d51740fcf802d59cf4c80535787956bce52675af9f902b306ffd79ae678")throw Error("Changed finite v195 lossless receipt");
const directory=resolve(import.meta.dir,"../../public/mesh/surrounding-berlin-v159");
const rows=new Map(receipt.rows.map(row=>[row.file,row]));
/** No product path imports this verifier. All decoded bytes, including source
 * JSON whitespace, survive the finite wire-only change. */
export function verifiedPriorPacketShaV195(path:string|URL,bytes:Uint8Array):string {
 const filename=relative(directory,resolve(path instanceof URL?fileURLToPath(path):path)),row=rows.get(filename),actual=sha(bytes);
 if(!row)return actual;
 if(actual!==row.newGzipSha256||bytes.byteLength!==row.newGzipBytes)throw Error(`Changed current v195 gzip ${filename}`);
 const raw=gunzipSync(bytes,{maxOutputLength:row.decodedBytes});
 if(raw.byteLength!==row.decodedBytes||sha(raw)!==row.decodedSha256)throw Error(`Changed decoded v195 source ${filename}`);
 return row.gzipSha256;
}
