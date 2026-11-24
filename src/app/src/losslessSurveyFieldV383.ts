import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { releaseScratchBuffer } from "./releaseScratchBuffer";
import { decodeLosslessGzipJson as decodeJson } from "./losslessGzipJson";

type PackedSurveyField = readonly [string,number,number,boolean];

function asBase64(raw:Uint8Array) {
  const current=raw as Uint8Array & {toBase64?:()=>string};
  if (typeof current.toBase64==="function") return current.toBase64();
  const pieces:string[]=[];
  // Whole 3-byte groups keep inner chunks unpadded. Spread stays below engine argument limits.
  for(let start=0;start<raw.length;start+=12288){
    pieces.push(btoa(String.fromCharCode(...raw.subarray(start,start+12288))));
  }
  return pieces.join("");
}

export function decodeLosslessGzipJson(input:string|PackedSurveyField): unknown {
  // Future ordinary lazy fields in the same module retain their normal JSON representation.
  if(typeof input==="string") return decodeJson(input);
  const [encoded,length,width,delta]=input;
  if (!Number.isSafeInteger(length) || length<=0 || length>4_000_000 ||
      (width!==4 && width!==8 && width!==24) || length%width || typeof delta!=="boolean")
    throw new RangeError("Invalid surveyed street field dimensions");
  const zipped=decodeBase64Bytes(encoded);
  let scratch:Uint8Array<ArrayBuffer>|undefined;
  let raw:Uint8Array<ArrayBuffer>|undefined;
  try {
    if(zipped.length<18 || new DataView(zipped.buffer,zipped.byteOffset,zipped.byteLength).getUint32(zipped.length-4,true)!==length)
      throw new RangeError("Surveyed street gzip size mismatch");
    scratch=new Uint8Array(length+1);
    const planes=gunzipSync(zipped,{out:scratch});
    if(planes.length!==length) throw new RangeError("Incomplete surveyed street field");
    raw=new Uint8Array(length);
    let j=0;
    for(let lane=0;lane<width;lane++){
      let previous=0;
      for(let i=lane;i<length;i+=width){
        const value=delta ? planes[j++]^previous : planes[j++];
        raw[i]=value;
        previous=value;
      }
    }
    return asBase64(raw);
  } finally {
    releaseScratchBuffer(zipped.buffer);
    releaseScratchBuffer(scratch?.buffer);
    releaseScratchBuffer(raw?.buffer);
  }
}
