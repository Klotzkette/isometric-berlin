/** Capture independent synchronous construction; never writes production files. */
import { plugin } from "bun";
import { fileURLToPath } from "node:url";
import { outlineManifest, outlineSignature } from "../tests/helpers/outlineConstructionSignature";

const legacy = process.argv.includes("--legacy");
const mode = process.argv.includes("--minecraft") ? "minecraft" : "day";
const repo = fileURLToPath(new URL("../../..", import.meta.url));
if (legacy) plugin({ name: "immutable-v204-outline-capture", setup(build) {
  build.onLoad({ filter: /\/(OutlineLandmarksV182|RailStationsV190|RegionOutlinesV200|SchoolsV185|PublicPlacesV185)\.ts$/ }, args => {
    const path = `src/app/src/${args.path.split("/").at(-1)}`;
    const before = Bun.spawnSync(["git", "show", `cca429f:${path}`], { cwd: repo });
    if (before.exitCode) throw new Error(`Cannot read historical ${path}`);
    return { contents: before.stdout.toString(), loader: "ts" };
  });
} });
const { createOutlineLandmarksV182, disposeOutlineConstruction } = await import("../src/OutlineLandmarksV182");
const root = createOutlineLandmarksV182(mode);
try {
  console.log(JSON.stringify(outlineSignature(root), null, 2));
  if (legacy) await Bun.write(`/tmp/v205-outline-legacy-${mode}.manifest.json`, JSON.stringify(outlineManifest(root)) + "\n");
} finally { disposeOutlineConstruction(root); }
