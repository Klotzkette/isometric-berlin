import { plugin } from "bun";
import { resolve } from "node:path";
import { InstancedMesh, type Group } from "three";
import { outlineSignature } from "./helpers/outlineConstructionSignature";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

// Reproduce from the immutable v124 factory AND all its project dependencies.
// Only the unique old roof source record is withheld in the second control.
const repo = resolve(import.meta.dir, "../../..");
const releasedBase = "ee082a820c45e1b7ae3057915f1f4473c0e8ace1";
const inputs: Record<string, string> = {};
const sha256 = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const git = (path: string) => {
  const result = Bun.spawnSync(["git", "show", `${releasedBase}:${path}`], { cwd: repo });
  if (result.exitCode) throw Error(result.stderr.toString());
  const text = result.stdout.toString(); inputs[path] = sha256(text); return text;
};
plugin({ name: "immutable v124 rail source", setup(build) {
  build.onLoad({ filter: /\/src\/app\/src\/.*\.(ts|json)$/ }, args => {
    const contents = git(args.path.slice(repo.length + 1));
    return { contents: args.path.endsWith(".json") ? `export default ${contents}` : contents,
      loader: args.path.endsWith(".json") ? "js" : "ts", resolveDir: resolve(args.path, "..") };
  });
}});
const { createRailStationsV190 } = await import("../src/RailStationsV190");
const { default: source } = await import("../src/data/railStationsV190.json");
const target = source.roofs.filter(roof => roof.id === "way/297153147");
if (target.length !== 1 || target[0].station !== "Warschauer Straße" || target[0].y !== 6)
  throw Error("Historical Warschauer roof identity changed");
const index = source.roofs.indexOf(target[0]);
const meshName = "Warschauer Straße platform edges, source-roof frames and name sign";
const meshAt = (root: Group) => {
  const mesh = root.getObjectByName(meshName);
  if (!(mesh instanceof InstancedMesh) || !mesh.instanceColor) throw Error("Missing rail instance batch");
  return mesh;
};
const bytes = (array: Float32Array, start: number, count: number) =>
  Buffer.from(array.buffer, array.byteOffset + start * 4, count * 4);
const modes: Record<string, unknown> = {};
for (const mode of ["day", "minecraft"]) {
  const before = createRailStationsV190(mode === "minecraft");
  source.roofs.splice(index, 1);
  const after = createRailStationsV190(mode === "minecraft");
  source.roofs.splice(index, 0, target[0]);
  try {
    const oldMesh = meshAt(before), nextMesh = meshAt(after);
    const oldMatrix = oldMesh.instanceMatrix.array as Float32Array;
    const nextMatrix = nextMesh.instanceMatrix.array as Float32Array;
    const oldColor = oldMesh.instanceColor!.array as Float32Array;
    const nextColor = nextMesh.instanceColor!.array as Float32Array;
    const removedCount = oldMesh.count - nextMesh.count;
    if (removedCount <= 0) throw Error("Roof removal did not shorten the exact batch");
    let start = 0;
    while (start < nextMesh.count && bytes(oldMatrix, start * 16, 16).equals(bytes(nextMatrix, start * 16, 16)) &&
      bytes(oldColor, start * 3, 3).equals(bytes(nextColor, start * 3, 3))) start++;
    for (const [oldArray, nextArray, stride] of [[oldMatrix, nextMatrix, 16], [oldColor, nextColor, 3]] as const) {
      if (!bytes(oldArray, (start + removedCount) * stride, (nextMesh.count - start) * stride)
        .equals(bytes(nextArray, start * stride, (nextMesh.count - start) * stride)))
        throw Error("The source-only control changed bytes beyond one contiguous roof span");
    }
    const complement = outlineSignature(after);
    const matrix = nextMesh.instanceMatrix, color = nextMesh.instanceColor, count = nextMesh.count;
    nextMesh.instanceMatrix = oldMesh.instanceMatrix;
    nextMesh.instanceColor = oldMesh.instanceColor;
    nextMesh.count = oldMesh.count;
    if (JSON.stringify(outlineSignature(after)) !== JSON.stringify(outlineSignature(before)))
      throw Error("The source-only control changed another rail object");
    nextMesh.instanceMatrix = matrix; nextMesh.instanceColor = color; nextMesh.count = count;
    modes[mode] = {
      before: outlineSignature(before), after: complement, meshName,
      beforeMesh: outlineSignature(oldMesh), afterMesh: outlineSignature(nextMesh),
      start, removedCount, matrixHex: bytes(oldMatrix, start * 16, removedCount * 16).toString("hex"),
      colorHex: bytes(oldColor, start * 3, removedCount * 3).toString("hex"),
    };
  } finally { disposeStaticAudit(before); disposeStaticAudit(after); }
}
const receipt = {
  releasedBase,
  method: "Immutable v124 rail factory and transitive project modules/data from Git. The second control withholds only the unique Warschauer Straße roof way/297153147 at y=6. A single deleted instance span reproduces the complete original rail hash when restored; all other live buffers, headers and nodes must match the source-only complement. Frozen historical outline fixtures remain unchanged.",
  inputs: Object.fromEntries(Object.entries(inputs).sort(([a], [b]) => a.localeCompare(b))),
  removedRoof: target[0], modes,
};
await Bun.write(resolve(import.meta.dir, "fixtures/outline-warschauer-v225.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(Object.fromEntries(Object.entries(modes).map(([mode, value]) => {
  const record = value as { start: number; removedCount: number };
  return [mode, { start: record.start, removedCount: record.removedCount }];
}))));
