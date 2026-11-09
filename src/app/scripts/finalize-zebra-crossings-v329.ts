import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { prepareSurroundingQuarterPredecessorV303, type SurroundingCityChunk, type SurroundingOwnershipOptions } from "../src/SurroundingCityGeometry";

const baseline = "d79f97dacf5aa5ad00f310af57fa181c3a8a284c";
const kind = "zebra-crossings-v329";
const app = resolve(import.meta.dir, "..");
const repo = resolve(app, "../..");
const publicDir = "src/app/public/mesh/surrounding-berlin-v159";
const data = resolve(app, "src/data");
const check = Bun.argv[2] === "--check";
const ownership: SurroundingOwnershipOptions = {
  tachelesFrontsV270: true, southFidelityV294: true, littenStadthausV297: true,
  wallGalleryV298: true, stralauSisyphosV299: true, neighbourhoodV300: true, westKiezV302: true,
};
const manifest = JSON.parse(execFileSync("git", ["show", `${baseline}:${publicDir}/manifest.json`], {
  cwd: repo, maxBuffer: 8 * 1024 * 1024,
}).toString()) as {
  chunks: { id: string; drawn: { url: string; sha256: string }; minecraft: { url: string; sha256: string } }[];
};
const byId = new Map(manifest.chunks.map(d => [d.id, d]));
const index = JSON.parse(readFileSync(resolve(data, "zebraCrossingsV329Index.json"), "utf8")) as {
  schemaVersion: number; sources: { file: string; keys: string[] }[];
};
function drain<T>(generator: Generator<void, T>): T {
  for (;;) {
    const result = generator.next();
    if (result.done) return result.value;
  }
}
function hash(text: string) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
  return value;
}
const seen = new Set<string>();
let preparedNavPins = 0, preparedLinePins = 0;
for (const { file, keys } of index.sources) {
  assert(/^zebraCrossingsV329Packets[0-9]+\.json$/.test(file));
  const path = resolve(data, file);
  const recipe = JSON.parse(readFileSync(path, "utf8")) as NeighbourhoodSourceV300;
  assert.deepEqual(recipe.keys, keys);
  assert.deepEqual(Object.keys(recipe.packets), keys);
  for (const key of keys) {
    assert(!seen.has(key), `Duplicate packet ${key}`);
    seen.add(key);
    const [mode, id] = key.split(":");
    assert(mode === "drawn" || mode === "minecraft");
    const desc = byId.get(id)?.[mode];
    assert(desc);
    const bytes = readFileSync(resolve(repo, publicDir, desc.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), desc.sha256);
    const raw = JSON.parse((desc.url.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString()) as SurroundingCityChunk;
    const before = JSON.stringify(raw);
    const navGuard = hash(JSON.stringify(raw.nav));
    const plan = recipe.packets[key];
    if (check) assert.equal(plan.navGuard, navGuard);
    else plan.navGuard = navGuard;
    // This is the complete legacy pre-preparation. Later SourceQuarter, V320
    // and V321 tickets append parts and stage their nav/ink edits for decode.
    const prepared = drain(prepareSurroundingQuarterPredecessorV303(raw, id, mode === "minecraft", ownership));
    const preparedNavGuard = hash(JSON.stringify(prepared.nav));
    const preparedLineGuard = prepared.lines ? hash(prepared.lines.positions + (prepared.lines.colors ?? "")) : null;
    if (check) {
      assert.equal(plan.preparedNavGuard ?? plan.navGuard, preparedNavGuard);
      assert.equal(plan.preparedLineGuard === undefined ? plan.lineGuard : plan.preparedLineGuard, preparedLineGuard);
    } else {
      if (preparedNavGuard !== navGuard) plan.preparedNavGuard = preparedNavGuard;
      if (preparedLineGuard !== plan.lineGuard) plan.preparedLineGuard = preparedLineGuard;
    }
    if (preparedNavGuard !== navGuard) preparedNavPins++;
    if (preparedLineGuard !== plan.lineGuard) preparedLinePins++;
    assert.equal(plan.retire.length, 0);
    const ticket = drain(captureNeighbourhoodPacketV300(raw, id, mode === "minecraft", true, recipe, kind));
    assert(ticket, `Exact raw packet admission failed: ${key}`);
    const result = drain(ticket(prepared));
    assert.equal(result.meshes.length, prepared.meshes.length + 1);
    assert(result.meshes.slice(0, -1).every((part, i) => part === prepared.meshes[i]));
    assert.equal(result.meshes.at(-1)?.indices, plan.append.indices);
    assert.equal(result.nav, prepared.nav);
    assert.equal(result.lines, prepared.lines);
    assert.equal(JSON.stringify(raw), before);
  }
  if (!check) writeFileSync(path, JSON.stringify(recipe) + "\n");
}
console.log(JSON.stringify({ checked: seen.size, sources: index.sources.length, noRetirements: true, preparedNavPins, preparedLinePins }));
