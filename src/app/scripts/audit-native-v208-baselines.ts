/** Test-only whole-world receipt from immutable v107; never rewrites runtime sources. */
import { plugin } from "bun";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";

const commit = "edcde0e7d05552d1e8900c9c87e1da9b40e02f76";
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const complement = process.argv.includes("--complement");
const sourceSha256: Record<string, string> = {};
if (process.argv.includes("--cooperative")) throw new Error("Historical audit is independently synchronous");
function immutable(path: string): string {
  const result = Bun.spawnSync(["git", "show", `${commit}:${path}`], { cwd: repo, maxBuffer: 128 * 1024 * 1024 });
  if (result.exitCode) throw new Error(`Cannot read immutable ${path}`);
  sourceSha256[path] = createHash("sha256").update(result.stdout).digest("hex");
  return result.stdout.toString();
}
function once(source: string, from: string, to: string): string {
  if (source.split(from).length !== 2) throw new Error(`Ambiguous immutable recipe: ${from}`);
  return source.replace(from, to);
}
// Benchmark reads these via Bun.file. Prove they are still the exact immutable
// blobs before construction; do not keep a second multi-MB parsed source copy.
for (const name of ["minecraft-voxels.json", "lod2-prisms.json", "scene.json"]) {
  const path = `src/app/public/mesh/regierungsviertel/${name}`;
  const expected = Bun.spawnSync(["git", "rev-parse", `${commit}:${path}`], { cwd: repo });
  const actual = Bun.spawnSync(["git", "hash-object", path], { cwd: repo });
  if (expected.exitCode || actual.exitCode || expected.stdout.toString() !== actual.stdout.toString())
    throw new Error(`Changed immutable world payload: ${path}`);
  sourceSha256[path] = createHash("sha256").update(readFileSync(`${repo}/${path}`)).digest("hex");
}
plugin({ name: "immutable-v107-whole-native-world", setup(build) {
  build.onLoad({ filter: /\/src\/app\/src\/.*\.(ts|json)$/ }, args => {
    const path = relative(repo, args.path);
    if (process.env.NATIVE_AUDIT_DEBUG) console.error(path);
    let source = immutable(path);
    if (complement && path.endsWith("MinecraftUnterDenLindenDetails.ts"))
      source = once(source, "  addAeroflot(builder);", "  // Test-only: yield only the eight-axis Aeroflot facade recipe.");
    if (complement && path.endsWith("GendarmenmarktPerimeterFacades.ts"))
      source = once(source, "  for (const building of source.buildings) {", "  for (const building of source.buildings) {\n    if (building.key === \"quartier206\") continue;");
    if (path.endsWith(".json")) {
      const keys = Object.keys(JSON.parse(source)).filter(key => /^[A-Za-z_$][\w$]*$/.test(key));
      return { contents: `const payload = ${source}; export default payload; ${keys.map(key => `export const ${key} = payload[${JSON.stringify(key)}];`).join("\n")}`, loader: "js" };
    }
    return { contents: source, loader: "ts" };
  });
  build.onLoad({ filter: /\/benchmark-minecraft-world\.ts$/ }, args => {
    const source = once(immutable(relative(repo, args.path)), "console.log(", "const auditSummary = ((value: string) => value)(");
    return { loader: "ts", contents: source + `
const objects = [];
world.traverse(object => {
  if (!(object instanceof Mesh)) return;
  const h = createHash('sha256');
  h.update(JSON.stringify([object.name, object.matrix.elements]));
  const attributes = [object.geometry.index, ...Object.values(object.geometry.attributes)];
  if (object instanceof InstancedMesh) {
    h.update(JSON.stringify([object.count, object.instanceMatrix.count]));
    attributes.push(object.instanceMatrix, object.instanceColor);
  }
  for (const a of attributes) if (a && ('array' in a))
    h.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength));
  objects.push({ name: object.name, instances: object instanceof InstancedMesh ? object.count : 0, sha256: h.digest('hex') });
});
(globalThis as any).__nativeV208Capture = { summary: JSON.parse(auditSummary), objects };
` };
  });
} });
await import("./benchmark-minecraft-world");
const capture = (globalThis as any).__nativeV208Capture;
const { detailProfile, instances, renderables, bufferBytes, sha256 } = capture.summary;
console.log(JSON.stringify({ commit, complement, sourceSha256: Object.fromEntries(Object.entries(sourceSha256).sort(([a], [b]) => a.localeCompare(b))),
  result: { detailProfile, instances, renderables, bufferBytes, sha256 }, objects: capture.objects }, null, 2));
