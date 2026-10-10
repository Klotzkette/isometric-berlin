/** Small exact delta capture; no production file or historical fixture is rewritten. */
import { plugin } from "bun";
import navigation from "../src/data/uraniaArcV206Navigation.json";
import baseline from "../tests/fixtures/minecraft-payload-only-v202.json";
import { InstancedMesh } from "three";

const before = process.argv.includes("--before");
const profile = process.argv.includes("--mobile") ? "mobile" : "full";
if (before) plugin({ name: "counterfactual-before-exact-urania-substitution", setup(build) {
  build.onLoad({ filter: /\/MinecraftVoxelWorld\.ts$/ }, async args => {
    const source = await Bun.file(args.path).text();
    const guard = "!uraniaArcV206SourceColumn(worldXAbs(xIdx), worldZAbs(zIdx), y0dm / 10, y1dm / 10) &&";
    if (source.split(guard).length !== 2) throw new Error("Urania source-column guard is not unique");
    return { contents: source.replace(guard, "true &&"), loader: "ts" };
  });
} });
const { preloadAltMitteNativeV169Source } = await import("../src/AltMitteNativeCoreV169");
await preloadAltMitteNativeV169Source();
const { createMinecraftVoxelWorld } = await import("../src/MinecraftVoxelWorld");
const payload = (await import("../public/mesh/regierungsviertel/minecraft-voxels.json")).default;
const root = createMinecraftVoxelWorld(payload as any, null, null, { detailProfile: profile });
const local = new Set<string>();
for (const [x, z] of navigation.legacyVoxelColumns)
  for (const [dx, dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) local.add(`${x+dx},${z+dz}`);
const meshes: Record<string, unknown> = {};
for (const name of Object.keys(baseline[profile])) {
  const mesh = root.getObjectByName(name) as InstancedMesh | undefined;
  if (!mesh) { meshes[name] = null; continue; }
  const matrices = mesh.instanceMatrix.array, colors = mesh.instanceColor?.array;
  if (!colors) throw new Error(`Missing colors for ${name}`);
  const hash = new Bun.CryptoHasher("sha256").update(matrices).update(colors).digest("hex");
  const records: { index: number; data: string }[] = [];
  if (name === "Voxel building columns" || name === "Voxel facade windows") {
    const pane = name === "Voxel facade windows";
    for (let i = 0; i < mesh.count; i++) {
      const at = i * 16;
      const x = Math.round((matrices[at+12] - (pane ? matrices[at+8] * 2.08 : 0)) / 4 - .5);
      const z = Math.round((matrices[at+14] - (pane ? matrices[at+10] * 2.08 : 0)) / 4 - .5);
      if (!local.has(`${x},${z}`)) continue;
      const row = new Float32Array(19);
      row.set(matrices.subarray(at, at+16)); row.set(colors.subarray(i*3, i*3+3), 16);
      records.push({ index: i, data: Buffer.from(row.buffer).toString("base64") });
    }
  }
  meshes[name] = { count: mesh.count, sha256: hash, records };
}
console.log(JSON.stringify({ before, profile, sourceColumns: navigation.legacyVoxelColumns, meshes }));
