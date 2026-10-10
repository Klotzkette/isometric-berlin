/** Independent synchronous capture; --baseline verifies immutable v109 first. */
import { plugin } from "bun";
import { fileURLToPath } from "node:url";
import { outlineSignature } from "../tests/helpers/outlineConstructionSignature";
import released from "../tests/fixtures/outline-landmarks-v209-synchronous.json";

const commit = "b2f70b7d7def147b0b1189667bce19fe6f04af3f";
const historical = process.argv.includes("--baseline");
const repo = fileURLToPath(new URL("../../..", import.meta.url));
if (historical) plugin({ name: "immutable-v109-outline-audit", setup(build) {
  build.onLoad({ filter: /\/(OutlineLandmarksV182|CityRecognitionV182)\.ts$/ }, (args) => {
    const result = Bun.spawnSync(["git", "show", `${commit}:src/app/src/${args.path.split("/").at(-1)}`], { cwd: repo });
    if (result.exitCode) throw new Error("Cannot load immutable v109 outline constructor");
    return { contents: result.stdout.toString(), loader: "ts" };
  });
} });
const { createOutlineLandmarksV182, disposeOutlineConstruction } = await import("../src/OutlineLandmarksV182");
const signatures: Partial<typeof released> = {};
for (const mode of ["day", "minecraft"] as const) {
  const root = createOutlineLandmarksV182(mode);
  try {
    const signature = outlineSignature(root);
    if (historical && JSON.stringify(signature) !== JSON.stringify(released[mode]))
      throw new Error(`Immutable ${mode} construction no longer reproduces the frozen v209 signature`);
    signatures[mode] = signature;
  } finally { disposeOutlineConstruction(root); }
}
console.log(JSON.stringify(signatures, null, 2));
