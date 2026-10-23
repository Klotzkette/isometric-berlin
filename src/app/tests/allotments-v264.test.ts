import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import data from "../src/data/allotmentsV264.json";
import { allotmentNavigationGuardV264, prepareAllotmentsV264, type AllotmentSourceV264 } from "../src/AllotmentsV264";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const root = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const source = data as AllotmentSourceV264;
const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8"));
const descriptors = new Map<string, any>(manifest.chunks.map((entry: any) => [entry.id, entry]));
function packet(id: string, native = false): SurroundingCityChunk {
  const path = descriptors.get(id)[native ? "minecraft" : "drawn"].url;
  return JSON.parse(gunzipSync(readFileSync(new URL(path, root))).toString());
}
function finish<T>(steps: Generator<void,T>): T {
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}
function decoded(encoded: string): Uint16Array {
  const bytes = Uint8Array.fromBase64(encoded);
  return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}

describe("v264 mapped allotment cultivation illustrations", () => {
  test("every accepted packet keeps all prior geometry/navigation and stays in its tile budget", () => {
    let groups = 0;
    for (const [id, modes] of Object.entries(source.chunks)) {
      for (const native of [false, true]) {
        const plan = modes[native ? "minecraft" : "drawn"];
        if (!plan) continue;
        const original = packet(id, native), snapshot = JSON.stringify(original);
        expect(allotmentNavigationGuardV264(original.nav)).toBe(plan.guard);
        const result = finish(prepareAllotmentsV264(original, id, native));
        expect(result).not.toBe(original);
        expect(result.nav).toBe(original.nav);
        expect(result.origin).toBe(original.origin);
        expect(result.lines).toBe(original.lines);
        expect(result.meshes.slice(0,-1)).toEqual(original.meshes);
        expect(JSON.stringify(original)).toBe(snapshot);
        const part = result.meshes.at(-1)!;
        expect(part.kind).toBe("allotments-v264");
        const vertices = decoded(part.positions);
        const expectedCount = plan.groups.length * (native ? 25 : 19) * 4;
        expect(vertices.length).toBe(expectedCount * 3);
        expect(Uint8Array.fromBase64(part.colors).length).toBe(vertices.length);
        const ib = Uint8Array.fromBase64(part.indices);
        const indices = new Uint32Array(ib.buffer, ib.byteOffset, ib.length / 4);
        expect(Math.max(...indices)).toBe(expectedCount - 1);
        let contained = true;
        const perGroup = (native ? 25 : 19) * 4;
        for (let index = 0; index < vertices.length; index += 3) {
          const [x,y,z,dx,dz] = plan.groups[Math.floor(index / 3 / perGroup)];
          const px = vertices[index]/100-x, pz = vertices[index+2]/100-z;
          const u = px*dx+pz*dz, v = -px*dz+pz*dx, h = vertices[index+1]/100-y;
          if (Math.abs(u)>4.208 || Math.abs(v)>3.208 || h<.062 || h>.628) contained = false;
        }
        expect(contained).toBe(true);
        expect(finish(prepareAllotmentsV264(result, id, native))).toBe(result);
        groups += plan.groups.length;
      }
    }
    expect(groups).toBeGreaterThan(1000);
  });

  test("unknown tiles exit before reading navigation or decoding geometry", () => {
    const chunk = { get nav() { throw new Error("unknown tile inspected"); }, get meshes() { throw new Error("unknown tile decoded"); } } as unknown as SurroundingCityChunk;
    expect(finish(prepareAllotmentsV264(chunk, "outside-current-coverage"))).toBe(chunk);
    const prepared = { meshes: [{ kind:"allotments-v264" }] } as SurroundingCityChunk;
    const parked = { schemaVersion:1, get chunks() { throw new Error("already prepared source decoded"); } } as AllotmentSourceV264;
    expect(finish(prepareAllotmentsV264(prepared,"known-id",false,parked))).toBe(prepared);
  });

  test("changed paths, water, ground and huts reject stale placement", () => {
    const id = Object.keys(source.chunks).find(id => source.chunks[id].drawn)!;
    for (const key of ["roads", "water", "ground", "buildings"] as const) {
      const chunk = packet(id);
      chunk.nav[key] = [...(chunk.nav[key] ?? [])];
      if (key === "buildings") chunk.nav.buildings.push({ ring:[[1,1],[10,1],[10,10]], holes:[],sourceId:"new-hut",minHeight:0,height:3 });
      else chunk.nav[key]!.push({ring:[[1,1],[10,1],[10,10]],holes:[]});
      expect(finish(prepareAllotmentsV264(chunk,id))).toBe(chunk);
    }
  });

  test("cancelled preparation publishes nothing and retries reproduce exact bytes", () => {
    const id = Object.keys(source.chunks).find(id => (source.chunks[id].drawn?.groups.length ?? 0) >= 4)!;
    const chunk = packet(id), snapshot = JSON.stringify(chunk);
    const steps = prepareAllotmentsV264(chunk,id);
    expect(steps.next().done).toBe(false);
    steps.return(chunk);
    expect(JSON.stringify(chunk)).toBe(snapshot);
    expect(finish(prepareAllotmentsV264(chunk,id))).toEqual(finish(prepareAllotmentsV264(chunk,id)));
  });
});
