import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import data from "../src/data/boulevardArchitectureV235.json";
import { prepareBoulevardArchitectureV235, type BoulevardArchitectureSourceV235 } from "../src/boulevardArchitectureV235";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
function finish<T>(work: Generator<void, T>): T { let r = work.next(); while (!r.done) r = work.next(); return r.value; }
function original(key: string): SurroundingCityChunk {
  const [mode, id] = key.split(":");
  return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`, import.meta.url))).toString());
}
function u16(s: string) { const b = Buffer.from(s, "base64"); return Array.from({ length: b.length / 2 }, (_, i) => b.readUInt16LE(i * 2)); }

test("all boulevard refinements preserve original geometry/nav/lines and fit the existing packet budget", () => {
  for (const [key, plan] of Object.entries(data.packets)) {
    const [mode, id] = key.split(":"), before = original(key), snapshot = JSON.stringify(before);
    const result = finish(prepareBoulevardArchitectureV235(before, id, mode === "minecraft"));
    expect(result).not.toBe(before);
    expect(result.nav).toBe(before.nav); expect(result.lines).toBe(before.lines);
    expect(result.meshes.length).toBe(before.meshes.length + 1);
    for (let i = 0; i < before.meshes.length; i++) expect(result.meshes[i]).toBe(before.meshes[i]);
    const part = result.meshes.at(-1)!;
    const xyz = u16(part.positions);
    expect(xyz.length / 3).toBe(plan.fields.length * 36);
    expect(result.meshes.reduce((n,p) => n + Buffer.from(p.positions,"base64").length / 6,0)).toBeLessThan(400000);
    expect(result.meshes.length).toBeLessThanOrEqual(16);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(finish(prepareBoulevardArchitectureV235(result,id,mode === "minecraft"))).toBe(result);
    if (mode === "minecraft") {
      for (let at = 0; at < xyz.length; at += 12) {
        const coplanarAxes = [0,1,2].filter(axis => [1,2,3].every(i => xyz[at+axis] === xyz[at+i*3+axis]));
        expect(coplanarAxes.length).toBeGreaterThanOrEqual(1);
      }
    }
  }
});

test("changed source identities, origins or invalid plans fail atomically; cancellation leaves the original", () => {
  const key = data.ids[0], [mode,id] = key.split(":"), before=original(key), plan=data.packets[key as keyof typeof data.packets];
  for (const field of ["positions","colors","indices"] as const) {
    const changed=structuredClone(before), part=changed.meshes[plan.guards[0].mesh], text=part[field];
    part[field]=(text[0]==="A"?"B":"A")+text.slice(1);
    expect(finish(prepareBoulevardArchitectureV235(changed,id,mode==="minecraft"))).toBe(changed);
  }
  const moved={...before,origin:[before.origin[0]+1,before.origin[1],before.origin[2]] as [number,number,number]};
  expect(finish(prepareBoulevardArchitectureV235(moved,id,mode==="minecraft"))).toBe(moved);
  const invalid=structuredClone(data) as BoulevardArchitectureSourceV235; invalid.packets[key].fields[0][7]=-1;
  expect(finish(prepareBoulevardArchitectureV235(before,id,mode==="minecraft",invalid))).toBe(before);
  expect(finish(prepareBoulevardArchitectureV235(before,"unrelated",false))).toBe(before);
  const snapshot=JSON.stringify(before), task=prepareBoulevardArchitectureV235(before,id,mode==="minecraft");
  expect(task.next().done).toBe(false); task.return(before); expect(JSON.stringify(before)).toBe(snapshot);
});
