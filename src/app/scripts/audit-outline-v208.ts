/** Independent synchronous capture; --baseline verifies immutable v107 first. */
import { plugin } from "bun";
import { fileURLToPath } from "node:url";
import { outlineSignature } from "../tests/helpers/outlineConstructionSignature";
import released from "../tests/fixtures/outline-landmarks-v207-synchronous.json";

const commit = "edcde0e7d05552d1e8900c9c87e1da9b40e02f76";
const historical = process.argv.includes("--baseline");
const repo = fileURLToPath(new URL("../../..", import.meta.url));
if (historical) plugin({ name: "immutable-v107-outline-audit", setup(build) {
  build.onLoad({ filter: /\/OutlineLandmarksV182\.ts$/ }, () => {
    const result = Bun.spawnSync(["git", "show", `${commit}:src/app/src/OutlineLandmarksV182.ts`], { cwd: repo });
    if (result.exitCode) throw new Error("Cannot load immutable v107 outline constructor");
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
      throw new Error(`Immutable ${mode} construction no longer reproduces the frozen v207 signature`);
    signatures[mode] = signature;
  } finally { disposeOutlineConstruction(root); }
}
console.log(JSON.stringify(signatures, null, 2));
