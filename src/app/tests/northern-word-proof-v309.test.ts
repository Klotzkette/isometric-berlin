import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { decodeLosslessWordPlanesV309 } from "../src/losslessWordStreamV309";
const sha=(text:string|Uint8Array)=>createHash("sha256").update(text).digest("hex");
for(const[name,field,receiptName,before]of[
  ["coreTerrainContactV307","meshes","core-words-v309-evidence","a592ae53e15bf7527b2ae03da5026f2cc24c21c368523e7bb2c696d1a5b35658"],
  ["railSseArchitectureV307","models","rail-words-v309-evidence","8769ea8e7b619d4313ce82b06cf0be43dda4eeaf79852071ef7ed53aec37e081"],
])test(`${name} reconstructs every original word and preserves all remaining model/source fields`,()=>{
  const bytes=readFileSync(new URL(`../src/data/${name}.json`,import.meta.url)),data=JSON.parse(bytes.toString());
  const receipt=JSON.parse(readFileSync(new URL(`../../../geo_data/regierungsviertel/${receiptName}.json`,import.meta.url),"utf8"));
  expect(receipt.beforeSha256).toBe(before);expect(sha(bytes)).toBe(receipt.afterSha256);
  expect(receipt.words.length).toBe(data[field].length*2);
  const expected=new Set<string>();
  for(const word of receipt.words){
    const matches=data[field].filter((m:{key:string})=>m.key===word.mesh);expect(matches.length).toBe(1);const mesh=matches[0];
    const key=word.mesh+":"+word.field;expect(expected.has(key)).toBeFalse();expected.add(key);
    expect(["positions","indices"].includes(word.field)).toBeTrue();expect(word.stride).toBe(word.field==="positions"?3:1);
    expect(mesh[`${word.field}Codec`]).toBe(`u32-delta-byteplanes-stride${word.stride}-v1`);
    expect(word.count).toBe((word.field==="positions"?mesh.vertices:mesh.triangles)*3);
    const packed=Buffer.from(mesh[word.field],"base64");expect(sha(packed)).toBe(word.packedSha256);
    const decoded=decodeLosslessWordPlanesV309(mesh[word.field],word.count,word.stride);
    expect(decoded.byteLength).toBe(word.decodedBytes);expect(sha(new Uint8Array(decoded.buffer))).toBe(word.decodedSha256);
  }
  const modelFields=JSON.stringify(data[field].map((mesh:Record<string,unknown>)=>Object.fromEntries(Object.entries(mesh).filter(([key])=>!["positions","indices","positionsCodec","indicesCodec"].includes(key)))));
  expect(sha(modelFields)).toBe(receipt.unchangedMeshFieldsSha256);
  if(field==="meshes")expect(sha(JSON.stringify(data.variants))).toBe(receipt.unchangedVariantsSha256);
  else expect(sha(JSON.stringify(Object.fromEntries(Object.entries(data).filter(([key])=>key!==field))))).toBe(receipt.unchangedComplementSha256);
});


test("the separate native plane correction changes only its two new inside words",()=>{
  const oldBytes=readFileSync(new URL("../../../geo_data/regierungsviertel/core-words-v309-pre-plane-evidence.json",import.meta.url));
  expect(sha(oldBytes)).toBe("3b06490feaa044a459f28a4d774471d9eaa0f4905b8807cd978f123e9a5e4f7f");
  const old=JSON.parse(oldBytes.toString()),delta=JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/core-native-plane-v309-evidence.json",import.meta.url),"utf8"));
  expect(old.beforeSha256).toBe("e7556eee87721c4c81dd29488244115399dd3a13780eda37bede4e735b943806");
  expect(delta.originalRawSha256).toBe(old.beforeSha256);expect(delta.deltas.length).toBe(2);
  const data=JSON.parse(readFileSync(new URL("../src/data/coreTerrainContactV307.json",import.meta.url),"utf8"));
  for(const proof of old.words){
    const mesh=data.meshes.find((m:{key:string})=>m.key===proof.mesh),words=decodeLosslessWordPlanesV309(mesh[proof.field],proof.count,proof.stride);
    if(proof.field==="positions")for(const d of delta.deltas.filter((d:{meshKey:string})=>d.meshKey===proof.mesh)){
      expect(words[d.wordOrdinal]).toBe(d.afterUInt32);expect(d.afterUInt32).toBe(1099497472);expect(d.beforeUInt32).toBe(1099497473);words[d.wordOrdinal]=d.beforeUInt32;
    }
    expect(sha(new Uint8Array(words.buffer))).toBe(proof.decodedSha256);
  }
  expect(sha(JSON.stringify(data.variants))).toBe(delta.unchangedVariantsSha256);
  expect(sha(JSON.stringify(data.meshes.map((m:Record<string,unknown>)=>Object.fromEntries(Object.entries(m).filter(([k])=>!["positions","indices","positionsCodec","indicesCodec"].includes(k))))))).toBe(old.unchangedMeshFieldsSha256);
});
