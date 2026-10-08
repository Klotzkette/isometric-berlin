import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Color, Mesh, InterleavedBufferAttribute } from "three";
import { createSurroundingCityChunk, createSurroundingCityChunkCooperatively, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { shadeAltMitteFacadeV186 } from "../src/altMitteFacadeReliefV186";

const encode = (a: Uint8Array | Uint16Array | Uint32Array) => Buffer.from(a.buffer).toString("base64");
function fixture(): SurroundingCityChunk {
  const positions: number[] = [], colours: number[] = [], indices: number[] = [];
  // Four exact pre-existing facade recipes, one same-colour source wall and
  // one arbitrary authored quad that must not be inferred as a window.
  for (const [width, height, hex] of [[152,203,0xddd8c8],[125,179,0x526c73],[8,178,0x5b5c57],[163,11,0xddd8c8],[800,203,0xddd8c8],[125,179,0xbb7755]]) {
    const i = positions.length / 3, x = i * 100;
    positions.push(x,1000,0,x+width,1000,0,x+width,1000+height,0,x,1000+height,0);
    const c = new Color(hex).toArray().map(n => Math.round(n*255));
    for (let j=0;j<4;j++) colours.push(...c);
    indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  return {schemaVersion:1,origin:[512,-10,-512],nav:{groundY:3,ground:[],water:[],buildings:[]},
    meshes:[{kind:"alt-mitte-v169",positionType:"u16cm",positions:encode(new Uint16Array(positions)),
      colors:encode(new Uint8Array(colours)),indices:encode(new Uint32Array(indices))}]};
}
const data = (result: ReturnType<typeof createSurroundingCityChunk>) => ((result.root.children[0] as Mesh).geometry.getAttribute("color") as InterleavedBufferAttribute).data.array;

test("only existing Alt-Mitte window recipes gain relief; geometry and source payload stay equal", () => {
  const chunk=fixture(), original=JSON.stringify(chunk);
  const drawn=createSurroundingCityChunk(chunk,"2_-1");
  const native=createSurroundingCityChunk(chunk,"2_-1",true);
  const resident=createSurroundingCityChunk(chunk,"alt-mitte-v169-2_-1");
  try {
    expect(drawn.root.userData.altMitteWindowRelief).toBe(4);
    const changed=data(drawn), before=data(native);
    expect(data(resident)).toEqual(before);
    expect(drawn.geometryBytes).toBe(native.geometryBytes);
    expect(drawn.bufferCount).toBe(2);
    expect(drawn.nav).toBe(chunk.nav);
    for(let i=0;i<changed.length;i++) {
      if(i%6<3 || i>=16*6) expect(changed[i]).toBe(before[i]);
    }
    expect((drawn.root.children[0] as Mesh).geometry.index!.array).toEqual((native.root.children[0] as Mesh).geometry.index!.array);
    expect(Array.from(changed.slice(3,6))).not.toEqual(Array.from(changed.slice(15,18)));
    expect(JSON.stringify(chunk)).toBe(original);
    chunk.meshes[0].kind="authored-model";
    const protectedModel=createSurroundingCityChunk(chunk,"2_-1");
    try { expect(data(protectedModel)).toEqual(before); } finally { disposeSurroundingCityRoot(protectedModel.root); }
  } finally { for(const result of [drawn,native,resident]) disposeSurroundingCityRoot(result.root); }
});

test("cooperative decode preserves the same result; repeat shading is idempotent", async () => {
  const chunk=fixture();
  const sync=createSurroundingCityChunk(chunk,"2_-1");
  let yields=0;
  const coop=await createSurroundingCityChunkCooperatively(chunk,"2_-1",false,{budgetMs:0,yield:async()=>{yields++;}});
  try {
    expect(yields).toBeGreaterThan(0); expect(data(coop)).toEqual(data(sync));
    const values=data(sync) as Uint16Array, before=values.slice();
    const indices=(sync.root.children[0] as Mesh).geometry.index!.array as Uint16Array;
    const iterator=shadeAltMitteFacadeV186(values,indices,0,indices.length);
    let next=iterator.next(); while(!next.done) next=iterator.next();
    expect(next.value).toBe(0); expect(values).toEqual(before);
  } finally { disposeSurroundingCityRoot(sync.root);disposeSurroundingCityRoot(coop.root); }
});

test("large non-window packets still yield rather than blocking the decode", () => {
  const vertices=new Uint16Array(18), indices=new Uint16Array(30_000);
  const iterator=shadeAltMitteFacadeV186(vertices,indices,0,indices.length);
  let yields=0,next=iterator.next(); while(!next.done){yields++;next=iterator.next();}
  expect(yields).toBeGreaterThanOrEqual(7);expect(next.value).toBe(0);
});

test("actual packed directional shades are recognized without touching source coordinates", () => {
  const path=new URL("../public/mesh/surrounding-berlin-v159/2_-4.drawn.json.gz",import.meta.url);
  const chunk=JSON.parse(gunzipSync(readFileSync(path)).toString()) as SurroundingCityChunk;
  const result=createSurroundingCityChunk(chunk,"2_-4");
  try {
    expect(result.root.userData.altMitteWindowRelief).toBe(2753);
    const values=data(result);let at=0;
    for(const part of chunk.meshes) {
      const raw=Buffer.from(part.positions,"base64");
      const original=new Uint16Array(raw.buffer,raw.byteOffset,raw.byteLength/2);
      for(let i=0;i<original.length;i+=3,at+=6) for(let axis=0;axis<3;axis++) expect(values[at+axis]).toBe(original[i+axis]);
    }
  } finally {disposeSurroundingCityRoot(result.root);}
});
