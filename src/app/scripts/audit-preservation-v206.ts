/** Read-only captures of the released v205 baseline or independent new construction. */
import { plugin } from "bun";
import { fileURLToPath } from "node:url";
import { relative } from "node:path";
import { geometryPreservationV206, outlineUraniaSubstitutionKeysV206, retainedOutlineManifestV206 } from "../tests/helpers/geometryPreservationV206";
import { outlineSignature, preservedOutlineSignature } from "../tests/helpers/outlineConstructionSignature";
import { staticGeometryAudit, disposeStaticAudit } from "../tests/helpers/staticGeometryAudit";
import previousLayout from "../tests/fixtures/outline-landmarks-v204-preserved-layout.json";
import previousSignature from "../tests/fixtures/outline-landmarks-v203-baseline.json";

const commit = "8838ad4862941a6e09d8180066e1a68330029f06";
const baseline = process.argv.includes("--baseline");
const mode = process.argv.includes("--minecraft") ? "minecraft" : "day";
const repo = fileURLToPath(new URL("../../..", import.meta.url));
if (baseline) plugin({ name: "immutable-v205-preservation-capture", setup(build) {
  build.onLoad({ filter: /\/(OutlineLandmarksV182|CityWestDetails|UraniaLuetzowV188)\.ts$|\/data\/uraniaLuetzowV188\.json$/ }, args => {
    const path = relative(repo, args.path);
    const before = Bun.spawnSync(["git", "show", `${commit}:${path}`], { cwd: repo });
    if (before.exitCode) throw new Error(`Cannot read historical ${path}: ${before.stderr}`);
    return path.endsWith(".json")
      ? { contents: `export default ${before.stdout.toString()}`, loader: "js" }
      : { contents: before.stdout.toString(), loader: "ts" };
  });
} });
const { createOutlineLandmarksV182, disposeOutlineConstruction } = await import("../src/OutlineLandmarksV182");
const { createCityWestDetails } = await import("../src/CityWestDetails");
const root = createOutlineLandmarksV182(mode), cityWest = createCityWestDetails("full");
try {
  const prior = baseline ? preservedOutlineSignature(root, previousLayout[mode]) : null;
  if (baseline && JSON.stringify(prior) !== JSON.stringify(previousSignature[mode]))
    throw new Error("Immutable baseline failed to reproduce the complete frozen v203 hash");
  console.log(JSON.stringify({ commit: baseline ? commit : null, mode,
    outline: { signature: outlineSignature(root), records: geometryPreservationV206(root) },
    cityWest: { signature: outlineSignature(cityWest), staticAudit: staticGeometryAudit(cityWest), records: geometryPreservationV206(cityWest) },
    v203: baseline ? { complete: prior,
      retained: preservedOutlineSignature(root, retainedOutlineManifestV206(previousLayout[mode], mode)),
      substitutedKeys: outlineUraniaSubstitutionKeysV206(mode) } : null,
  }));
} finally { disposeOutlineConstruction(root); disposeStaticAudit(cityWest); }
