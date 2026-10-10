/** Test-only synchronous audit. No runtime file is rewritten, no old fixture is edited. */
import { plugin } from "bun";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const phase = process.argv.includes("--legacy-v200") ? "legacy-v200" : "current";
const profile = process.argv.includes("--mobile") ? "mobile" : "full";
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const prefix = `/tmp/v204-native-audit-${phase}-${profile}`;
const legacyMuseum = Bun.spawnSync(["git", "show", "98d1d902:src/app/src/MuseumTriadArchitecture.ts"], { cwd: repo });
if (legacyMuseum.exitCode !== 0) throw new Error("Cannot read immutable pre-v204 MuseumTriad source");
const predicates = [
  "      !isBendlerblockV202ReplacedColumn(worldXAbs(xIdx), worldZAbs(zIdx), y0dm / 10, y1dm / 10) &&",
  "      !isPergamonPanoramaV202ReplacementColumn(worldXAbs(xIdx), worldZAbs(zIdx), y0dm / 10, y1dm / 10) &&",
];
plugin({
  name: "bounded-v202-v204-test-counterfactual",
  setup(build) {
    build.onLoad({ filter: /\/MinecraftVoxelWorld\.ts$/ }, args => {
      let contents = readFileSync(args.path, "utf8");
      const base = Bun.spawnSync(["git", "show", "cca429f:src/app/src/MinecraftVoxelWorld.ts"], { cwd: repo });
      if (base.exitCode || contents !== base.stdout.toString()) throw new Error("Core constructor differs from the released v204 source");
      for (const line of predicates) {
        if (contents.split(line).length !== 2) throw new Error("Expected exactly one source-signature predicate");
        if (phase === "legacy-v200") contents = contents.replace(line, "      true && /* test-only v200 counterfactual */");
      }
      return { contents, loader: "ts" };
    });
    build.onLoad({ filter: /\/MuseumTriadArchitecture\.ts$/ }, args => {
      const current = readFileSync(args.path, "utf8");
      const base = Bun.spawnSync(["git", "show", "cca429f:src/app/src/MuseumTriadArchitecture.ts"], { cwd: repo });
      if (base.exitCode || current !== base.stdout.toString()) throw new Error("Museum constructor differs from the released v204 source");
      return { contents: phase === "legacy-v200" ? legacyMuseum.stdout.toString() : current, loader: "ts" };
    });
    build.onLoad({ filter: /\/(JamesSimonArchitecture|jamesSimonProfile)\.ts$/ }, args => {
      if (phase !== "legacy-v200") return { contents: readFileSync(args.path, "utf8"), loader: "ts" };
      const name = args.path.split("/").at(-1)!;
      const previous = Bun.spawnSync(["git", "show", `73d8c37f:src/app/src/${name}`], { cwd: repo });
      if (previous.exitCode) throw new Error("Cannot read immutable pre-v202 James Simon source");
      return { contents: previous.stdout.toString(), loader: "ts" };
    });
    build.onLoad({ filter: /\/benchmark-minecraft-world\.ts$/ }, args => ({
      loader: "ts",
      contents: readFileSync(args.path, "utf8") + `
const objects = [];
world.traverse(object => {
 if (!(object instanceof Mesh)) return;
 const h = createHash('sha256');
 h.update(JSON.stringify([object.name, object.matrix.elements]));
 const attributes = [object.geometry.index, ...Object.values(object.geometry.attributes)];
 if(object instanceof InstancedMesh){h.update(JSON.stringify([object.count,object.instanceMatrix.count]));attributes.push(object.instanceMatrix,object.instanceColor);}
 for(const a of attributes)if(a&&('array' in a))h.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));
 objects.push({name:object.name,instances:object instanceof InstancedMesh?object.count:0,sha256:h.digest('hex')});
});
await Bun.write(${JSON.stringify(prefix + ".objects.json")},JSON.stringify(objects,null,2)+'\\n');
`,
    }));
  },
});
if (process.argv.includes("--cooperative")) throw new Error("This audit independently measures synchronous construction");
await import("./benchmark-minecraft-world");
