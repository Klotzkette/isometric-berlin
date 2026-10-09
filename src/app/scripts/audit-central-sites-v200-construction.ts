/** Read-only synchronous counterfactual capture; never rewrites production files. */
import { plugin } from "bun";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const phase = process.argv.find((arg) => arg.startsWith("--phase="))?.slice(8) ?? "current";
if (!["legacy", "station", "current"].includes(phase)) throw new Error("Unknown audit phase");
const profile = process.argv.includes("--mobile") ? "mobile" : "full";
const writeBuffers = process.argv.includes("--write-buffers");
const prefix = process.env.V200_AUDIT_PREFIX ?? `/tmp/v200-native-${phase}-${profile}`;
const benchmark = fileURLToPath(new URL("./benchmark-minecraft-world.ts", import.meta.url));
const predicates = [
  "      !isCentralSitesV200FalseColumn(worldXAbs(xIdx), worldZAbs(zIdx), y0dm / 10, y1dm / 10) &&",
  "      !isCentralSitesV200ReplacedColumn(worldXAbs(xIdx), worldZAbs(zIdx), y0dm / 10, y1dm / 10) &&",
];

plugin({
  name: "v200-bounded-native-counterfactual",
  setup(build) {
    build.onLoad({ filter: /\/MinecraftVoxelWorld\.ts$/ }, (args) => {
      let contents = readFileSync(args.path, "utf8");
      for (const [index, line] of predicates.entries()) {
        if (contents.split(line).length !== 2) throw new Error(`Expected one predicate: ${line}`);
        if (phase === "legacy" || (phase === "station" && index === 1))
          contents = contents.replace(line, "      true && /* audit counterfactual only */");
      }
      return { contents, loader: "ts" };
    });
    build.onLoad({ filter: /\/benchmark-minecraft-world\.ts$/ }, (args) => {
      const contents = readFileSync(args.path, "utf8") + `
// Capture independent per-mesh hashes and the two potentially changed batches.
const objectReceipts = [];
const pendingWrites = [];
world.traverse((object) => {
  if (!(object instanceof Mesh)) return;
  const meshHash = createHash("sha256");
  meshHash.update(JSON.stringify([object.name, object.matrix.elements]));
  const geometryHash = createHash("sha256");
  for (const attribute of [object.geometry.index, ...Object.values(object.geometry.attributes)]) {
    if (!attribute || !("array" in attribute)) continue;
    const { array } = attribute;
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    geometryHash.update(bytes); meshHash.update(bytes);
  }
  const item = {
    name: object.name,
    instances: object instanceof InstancedMesh ? object.count : 0,
    geometrySha256: geometryHash.digest("hex"),
  };
  if (object instanceof InstancedMesh) {
    meshHash.update(JSON.stringify([object.count, object.instanceMatrix.count]));
    for (const key of ["instanceMatrix", "instanceColor"]) {
      const attribute = object[key];
      if (!attribute) continue;
      const { array } = attribute;
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      item[key + "Sha256"] = createHash("sha256").update(bytes).digest("hex");
      item[key + "Bytes"] = bytes.byteLength;
      meshHash.update(bytes);
      if (${writeBuffers} && ["Voxel building columns", "Voxel facade windows"].includes(object.name)) {
        const path = ${JSON.stringify(prefix)} + "-" + object.name.replaceAll(" ", "_") + "-" + key + ".bin";
        item[key + "Path"] = path;
        pendingWrites.push(Bun.write(path, bytes));
      }
    }
  }
  item.sha256 = meshHash.digest("hex");
  objectReceipts.push(item);
});
await Promise.all(pendingWrites);
await Bun.write(${JSON.stringify(`${prefix}.objects.json`)}, JSON.stringify(objectReceipts, null, 2) + "\\n");
`;
      return { contents, loader: "ts" };
    });
  },
});

// No --cooperative flag: this independently captures the synchronous constructor.
if (process.argv.includes("--cooperative")) throw new Error("Audit requires synchronous construction");
await import(benchmark);
