import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import data from "../src/data/roofHouseV233.json";
import {
  prepareRoofHouseV233, applyRoofHouseV233Triangles, applyRoofHouseV233Lines,
  type RoofHouseSourceV233,
} from "../src/roofHouseV233";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

function finish<T>(generator: Generator<void, T>): T {
  let result = generator.next();
  while (!result.done) result = generator.next();
  return result.value;
}
function packet(key: string): SurroundingCityChunk {
  const [family, tile] = key.split(":");
  return JSON.parse(gunzipSync(readFileSync(new URL(
    `../public/mesh/surrounding-berlin-v159/${tile}.${family}.json.gz`, import.meta.url,
  ))).toString());
}
function indices(text: string): Uint32Array {
  const bytes = Buffer.from(text, "base64"), values = new Uint32Array(bytes.length / 4);
  for (let i = 0; i < values.length; i++) values[i] = bytes.readUInt32LE(i * 4);
  return values;
}

test("every roof transaction retains all packed source identities and retires only audited indices", () => {
  let transactions = 0;
  for (const [key, receipt] of Object.entries(data.packets)) {
    const original = packet(key), snapshot = JSON.stringify(original), [mode, id] = key.split(":");
    const prepared = finish(prepareRoofHouseV233(original, id, mode === "minecraft"));
    expect(prepared).not.toBe(original);
    expect(prepared.nav).toBe(original.nav);
    expect(prepared.lines).toBe(original.lines);
    expect(prepared.meshes.length).toBe(original.meshes.length + 1);
    expect(prepared.meshes.at(-1)).toEqual(receipt.replacement);
    for (let i = 0; i < original.meshes.length; i++) {
      // Existing appearance and exact-owner guards must still see original bytes.
      expect(prepared.meshes[i]).toBe(original.meshes[i]);
      const record = receipt.records.find(r => r.mesh === i), before = indices(original.meshes[i].indices);
      const values = before.slice(), expected = before.slice();
      for (const t of record?.triangles ?? []) expected[t * 3 + 1] = expected[t * 3 + 2] = expected[t * 3];
      expect(finish(applyRoofHouseV233Triangles(prepared, i, values, 0))).toBe(record?.triangles.length ?? 0);
      expect(values).toEqual(expected);
      const untouched = before.slice();
      expect(finish(applyRoofHouseV233Triangles(original, i, untouched, 0))).toBe(0);
      expect(untouched).toEqual(before);
    }
    expect(finish(prepareRoofHouseV233(prepared, id, mode === "minecraft"))).toBe(prepared);
    expect(JSON.stringify(original)).toBe(snapshot);
    transactions++;
  }
  expect(transactions).toBe(206);
});

test("flat roof ink changes only in the final copied line buffer", () => {
  const key = Object.keys(data.packets).find(k => data.packets[k as keyof typeof data.packets].segments.length)!;
  const [mode,id] = key.split(":"), original = packet(key), receipt = data.packets[key as keyof typeof data.packets];
  const prepared = finish(prepareRoofHouseV233(original,id,mode === "minecraft"));
  for (const stride of [3,6]) {
    const input = Buffer.from(original.lines!.positions,"base64"), values = new Uint16Array(input.length / 6 * stride);
    for(let i=0;i<input.length/6;i++)for(let axis=0;axis<3;axis++) values[i*stride+axis]=input.readUInt16LE(i*6+axis*2);
    if(stride===6)for(let i=0;i<values.length;i++)if(i%stride>=3)values[i]=21021;
    const expected=values.slice();
    for(const segment of receipt.segments) for(let axis=0;axis<3;axis++)expected[segment*2*stride+stride+axis]=expected[segment*2*stride+axis];
    expect(finish(applyRoofHouseV233Lines(prepared,values,stride))).toBe(receipt.segments.length);
    expect(values).toEqual(expected);
  }
});

test("changed packets, wrong origins and malformed receipts fail closed without any replacement", () => {
  const key=Object.keys(data.packets)[0],[mode,id]=key.split(":"), original=packet(key);
  const receipt=data.packets[key as keyof typeof data.packets], mesh=receipt.records[0].mesh;
  for(const field of ["positions","colors","indices"] as const) {
    const changed=structuredClone(original),text=changed.meshes[mesh][field];
    changed.meshes[mesh][field]=(text[0]==="A"?"B":"A")+text.slice(1);
    expect(finish(prepareRoofHouseV233(changed,id,mode==="minecraft"))).toBe(changed);
  }
  const moved={...original,origin:[original.origin[0]+1,...original.origin.slice(1)] as [number,number,number]};
  expect(finish(prepareRoofHouseV233(moved,id,mode==="minecraft"))).toBe(moved);
  expect(finish(prepareRoofHouseV233(original,"missing",false))).toBe(original);
  const wrong=structuredClone(data) as RoofHouseSourceV233;
  wrong.packets[key].records[0].triangles.push(Number.MAX_SAFE_INTEGER);
  expect(finish(prepareRoofHouseV233(original,id,mode==="minecraft",wrong))).toBe(original);
});

test("cooperative cancellation leaves the complete original visible and consumes no live resource", () => {
  const key=Object.keys(data.packets)[0],[mode,id]=key.split(":"),original=packet(key),before=JSON.stringify(original);
  const work=prepareRoofHouseV233(original,id,mode==="minecraft");
  expect(work.next().done).toBe(false);
  work.return(original);
  expect(JSON.stringify(original)).toBe(before);
  const indicesBefore=indices(original.meshes[0].indices);
  expect(finish(applyRoofHouseV233Triangles(original,0,indicesBefore,0))).toBe(0);
});
