import { BufferAttribute, BufferGeometry, Color } from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { decodeBase64Bytes } from "./decodeBase64Bytes";

export type SurveyMeshPacket = {origin:number[]; n:number; f:number; p:string; c:string; i:string; palette:number[][]};

function inflate(field:string,length:number) {
  const bytes=gunzipSync(decodeBase64Bytes(field),{out:new Uint8Array(length)});
  if (bytes.length!==length) throw new RangeError("Unvollständiges Kreuzberger Geometriepaket");
  return bytes;
}

function restore(field:string,count:number) {
  const data=inflate(field,count*2),words=new Uint16Array(count);
  let last=0;
  for (let i=0;i<count;i++) {
    last=(last+data[i]+256*data[count+i])&65535;
    words[i]=last;
  }
  return words;
}

export function createMeasuredPlaceGeometry(packet:SurveyMeshPacket) {
  const {n,f}=packet;
  if (!Number.isInteger(n)||n<1||n>65535||!Number.isInteger(f)||f<1||f>100000) throw new RangeError("Ungültiger Platzumfang");
  const words=restore(packet.p,n*3), xyz=new Int16Array(n*3);
  for (let i=0;i<n;i++) for (let axis=0;axis<3;axis++) xyz[3*i+axis]=words[n*axis+i];
  const colors=packet.palette.length>256?restore(packet.c,n):inflate(packet.c,n);
  const rgb=new Uint8Array(n*3);
  const palette=packet.palette.map(([r,g,b])=>{
    const color=new Color((r<<16)|(g<<8)|b);
    return [color.r,color.g,color.b].map(c=>Math.round(255*c));
  });
  for (let i=0;i<n;i++) rgb.set(palette[colors[i]],3*i);
  const indices=restore(packet.i,3*f);
  for (const index of indices) if (index>=n) throw new RangeError("Ungültiger Platzindex");
  const g=new BufferGeometry();
  g.setAttribute("position",new BufferAttribute(xyz,3));
  g.setAttribute("color",new BufferAttribute(rgb,3,true));
  g.setIndex(new BufferAttribute(indices,1));
  g.computeBoundingBox();g.computeBoundingSphere();
  return g;
}

