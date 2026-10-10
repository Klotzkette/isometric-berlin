/** Combine four independent synchronous captures; refuse drift in any older fixture. */
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import legacy from "../tests/fixtures/minecraft-world-synchronous-v206.json";

type MeshRow = { name: string; instances: number; sha256: string };
type Capture = { commit: string; complement: boolean; sourceSha256: Record<string, string>; result: typeof legacy.full; objects: MeshRow[] };
const captures: Record<string, Capture> = {};
for (const profile of ["full", "mobile"] as const) for (const phase of ["baseline", "complement"] as const)
  captures[`${profile}-${phase}`] = await Bun.file(`/tmp/v208-native-${profile}-${phase}.json`).json();
const first = captures["full-baseline"];
const profiles: Record<string, unknown> = {}, current: Record<string, unknown> = {};
const hash = (rows: MeshRow[]) => createHash("sha256").update(JSON.stringify(rows)).digest("hex");
function difference(a: MeshRow[], b: MeshRow[]) {
  const remaining = new Map<string, number>();
  for (const r of b) remaining.set(r.sha256, (remaining.get(r.sha256) ?? 0) + 1);
  const common: MeshRow[] = [], changed: MeshRow[] = [];
  for (const r of a) {
    const count = remaining.get(r.sha256) ?? 0;
    if (count) { common.push(r); remaining.set(r.sha256, count - 1); }
    else changed.push(r);
  }
  return { common, changed };
}
for (const profile of ["full", "mobile"] as const) {
  const before = captures[`${profile}-baseline`], after = captures[`${profile}-complement`];
  for (const capture of [before, after]) {
    if (capture.commit !== first.commit || !isDeepStrictEqual(capture.sourceSha256, first.sourceSha256))
      throw new Error("Independent captures did not use identical immutable inputs");
  }
  if (before.complement || !after.complement) throw new Error("Incorrect capture phases");
  if (!isDeepStrictEqual(before.result, legacy[profile])) throw new Error(`Historical ${profile} baseline no longer reproduced`);
  const removed = difference(before.objects, after.objects), replacement = difference(after.objects, before.objects);
  if (!isDeepStrictEqual(removed.common, replacement.common)) throw new Error("Retained meshes changed order or contents");
  if (before.result.instances - after.result.instances !== 1305 || before.result.bufferBytes - after.result.bufferBytes !== 99828 || before.result.renderables - after.result.renderables !== 2)
    throw new Error("Changes exceed the exact two documented facade recipes");
  profiles[profile] = { legacy: before.result, current: after.result, unchangedMeshCount: removed.common.length,
    unchangedOrderedMeshSha256: hash(removed.common), beforeChanged: removed.changed, afterChanged: replacement.changed };
  current[profile] = after.result;
}
const audit = { schemaVersion: 1, releasedBase: first.commit, historicalBaseline: "minecraft-world-synchronous-v206.json",
  method: "All recorded imported source modules/data blobs loaded from immutable released v107. Public voxel/prism/scene payloads verified against exact v107 Git blobs. Synchronous baseline reproduces frozen v206 full-world hashes. Independent complement changes only addAeroflot(builder) and the exact quartier206 entry in GendarmenmarktPerimeterFacades. All remaining ordered mesh byte hashes stay identical; no production constructor or old fixture rewritten.",
  sourceSha256: first.sourceSha256, profiles };
await Bun.write(new URL("../tests/fixtures/minecraft-world-v208-baseline-audit.json", import.meta.url), JSON.stringify(audit, null, 2) + "\n");
await Bun.write(new URL("../tests/fixtures/minecraft-world-synchronous-v208.json", import.meta.url), JSON.stringify(current, null, 2) + "\n");
console.log(JSON.stringify(profiles, null, 2));
