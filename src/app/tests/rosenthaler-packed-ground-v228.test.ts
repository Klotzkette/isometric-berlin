import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Mesh, Raycaster } from "three";
import { cutRosenthalerPackedGroundV228 } from "../src/rosenthalerPackedGroundV228";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { createRosenthalerV228 } from "../src/RosenthalerV228";
import { ROSENTHALER_STAIRS_V228, rosenthalerV228FloorAt } from "../src/rosenthalerV228Profile";
import receipts from "../src/data/rosenthalerV228Ground.json";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

function exhaust<T>(g:Generator<void,T>):T {let next=g.next();while(!next.done)next=g.next();return next.value;}
function sourceArrays(chunk:SurroundingCityChunk){
  const vertices:number[]=[],indices:number[]=[];
  for(const part of chunk.meshes){
    const p=Buffer.from(part.positions,"base64"),c=Buffer.from(part.colors,"base64"),i=Buffer.from(part.indices,"base64"),offset=vertices.length/6;
    for(let j=0;j<p.length/6;j++)vertices.push(p.readUInt16LE(j*6),p.readUInt16LE(j*6+2),p.readUInt16LE(j*6+4),c[j*3]*257,c[j*3+1]*257,c[j*3+2]*257);
    for(let j=0;j<i.length;j+=4)indices.push(i.readUInt32LE(j)+offset);
  }
  return {vertices:new Uint16Array(vertices),indices:new Uint32Array(indices)};
}

test("real 3_-3/4_-3 packets cut only verified ground; all other interleaved bytes and index triples survive",()=>{
  for(const native of [false,true]){
    const roots=[];
    for(const id of ["3_-3","4_-3"]){
      const key=`${id}.${native?"minecraft":"drawn"}` as keyof typeof receipts;
      const compressed=readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${key}.json.gz`,import.meta.url));
      const packet=JSON.parse(gunzipSync(compressed).toString()) as SurroundingCityChunk;
      const receipt=receipts[key],raw=sourceArrays(packet);
      expect(createHash("sha256").update(compressed).digest("hex")).toBe(receipt.sourceSha256);
      const result=exhaust(cutRosenthalerPackedGroundV228(id,native,packet.origin,raw.vertices,raw.indices))!;
      expect(result).not.toBeNull();expect(result.changed).toBe(receipt.triangles.length);
      expect(result.vertices.slice(0,raw.vertices.length)).toEqual(raw.vertices);
      const changed=new Set(receipt.triangles.map(r=>r[0]));let cursor=0;
      for(let i=0;i<raw.indices.length;i+=3){
        if(changed.has(i)){while(cursor<result.indices.length&&result.indices[cursor]>=raw.vertices.length/6)cursor+=3;}
        else {expect(Array.from(result.indices.subarray(cursor,cursor+3))).toEqual(Array.from(raw.indices.subarray(i,i+3)));cursor+=3;}
      }
      expect(cursor).toBe(result.indices.length);
      const built=createSurroundingCityChunk(packet,id,native);roots.push(built.root);
      expect(built.root.userData.rosenthalerGroundTrianglesV228).toBe(receipt.triangles.length);
      let bytes=0,buffers=0;
      built.root.traverse(o=>{if(o instanceof Mesh){const sets=new Set<ArrayBufferLike>();for(const a of Object.values(o.geometry.attributes)){const data="data" in a?a.data.array:a.array;sets.add(data.buffer);}if(o.geometry.index)sets.add(o.geometry.index.array.buffer);for(const b of sets)bytes+=b.byteLength;buffers+=sets.size;}});
      const ink=built.root.children.find(o=>o.type==="LineSegments") as Mesh|undefined;
      if(ink){const p=ink.geometry.getAttribute("position"),data="data" in p?p.data.array:p.array;bytes+=data.byteLength;buffers++;}
      expect(built.geometryBytes).toBe(bytes);expect(built.bufferCount).toBe(buffers);
      expect(exhaust(cutRosenthalerPackedGroundV228("unrelated",native,packet.origin,raw.vertices,raw.indices))).toBeNull();
      const changedSource=raw.vertices.slice();changedSource[receipt.triangles[0][1]*6]++;
      expect(exhaust(cutRosenthalerPackedGroundV228(id,native,packet.origin,changedSource,raw.indices))).toBeNull();
    }
    const stairs=createRosenthalerV228(native);roots.push(stairs);for(const root of roots)root.updateMatrixWorld(true);
    const meshes:Mesh[]=[];for(const root of roots)root.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});
    const ray=new Raycaster();ray.ray.direction.set(0,-1,0);ray.far=10;
    for(const stair of ROSENTHALER_STAIRS_V228)for(const t of [.3,.6,.9]){
      const x=stair.top[0]+stair.ux*stair.length*t,z=stair.top[1]+stair.uz*stair.length*t;
      ray.ray.origin.set(x,(native?stair.nativeSurfaceY:stair.surfaceY)+.4,z);
      const hit=ray.intersectObjects(meshes,false)[0];expect(hit?.object.name).toContain(`stair ${stair.osmWay}:`);
      expect(Math.abs(hit.point.y-rosenthalerV228FloorAt(x,z,native)!)).toBeLessThan(.18);
    }
    for(const root of roots)disposeStaticAudit(root);
  }
});
