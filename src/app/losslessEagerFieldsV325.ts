/** Finite ordinary eager source objects; same exact strong ownership. */
import {createHash} from "node:crypto";
const pins:Readonly<Record<string,{raw:string;fields:Readonly<Record<string,string>>}>>={
  "data/wilhelmHousingV324Sources.json":{
    raw:"6ef07b2c543f50e34128d614c7be7c4ea0c95983b1a981c7f4db4c6f833b42b4",
    fields:{nativeVoxels:"4969cbdd59321571cd09fe89747e13de3a2dc2aaf074cf07a46093bb480abc6e"},
  },
  "data/wilhelmStreetFrontsV325Sources.json":{
    raw:"fae9cd302e96bb5e902fc640810634ec39ae7e188f5caa32705bf8f8a9945fc7",
    fields:{nativeVoxels:"4109f6ab2e12016c844cd067ebf5869ecb1556c193fc079280913bb10763a9aa"},
  },
  "data/wilhelmStreetFrontsV325.json":{
    raw:"90dd3914dd4941594e182afef772ce3ca035f56666e71ba7974b72a366a62cb4",
    fields:{runs:"7325032972787c089329829d5e96c6db8e03bee7d5ed59793e925068b2e6e036"},
  },
  "data/altMitteV169Native/packet-062.json":{
    raw:"29fe2a2a8664edb2976f76d336f0af99b7589430f5d708dd49128011a853934d",
    fields:{meshes:"d6a38e00b449a085d228f9971869364ae39eb96998502a1b3508fdd426808ab2"},
  },
};
const sha=(text:string)=>createHash("sha256").update(text).digest("hex");
export function exactEagerFieldsV325(path:string,source:string):readonly string[]{
  const pin=pins[path];if(!pin)return[];
  if(sha(source)!==pin.raw)throw Error("Changed exact strong Wilhelm source object");
  return Object.keys(pin.fields);
}
export function assertEagerFieldV325(path:string,key:string,value:string):void{
  const pin=pins[path];
  if(!pin||!Object.hasOwn(pin.fields,key)||sha(value)!==pin.fields[key])throw Error("Changed exact strong Wilhelm voxel field");
}
