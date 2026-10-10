/** Derive exact facade-only complements from the immutable released v107 code. */
import { plugin } from "bun";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { relative } from "node:path";
import { staticGeometryAudit, disposeStaticAudit } from "../tests/helpers/staticGeometryAudit";

const commit = "edcde0e7d05552d1e8900c9c87e1da9b40e02f76";
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const complement = process.argv.includes("--complement");
const hashes: Record<string, string> = {};
function before(path: string): string {
  const result = Bun.spawnSync(["git", "show", `${commit}:${path}`], { cwd: repo });
  if (result.exitCode) throw new Error(`Cannot read immutable ${path}`);
  hashes[path] = createHash("sha256").update(result.stdout).digest("hex");
  return result.stdout.toString();
}
function once(source: string, from: string, to: string): string {
  if (source.split(from).length !== 2) throw new Error(`Ambiguous historical recipe: ${from}`);
  return source.replace(from, to);
}
plugin({ name: "immutable-v107-frontage-recipes", setup(build) {
  build.onLoad({ filter: /\/(CentralCivicDetails|GendarmenmarktPerimeterFacades|UnterDenLindenDetails|MinecraftUnterDenLindenDetails|IsometricCityWorld)\.ts$/ }, args => {
    const path = relative(repo, args.path);
    let source = before(path);
    if (complement) {
      if (path.endsWith("CentralCivicDetails.ts")) {
        source = once(source, "  // Hungarian Embassy, Adam Sylvester:", "  return; // v208 audit: only the final Hungarian recipe yields.\n  // Hungarian Embassy, Adam Sylvester:");
      } else if (path.endsWith("GendarmenmarktPerimeterFacades.ts")) {
        source = once(source, "  for (const building of source.buildings) {", "  for (const building of source.buildings) {\n    if (building.key === \"quartier206\") continue;");
      } else if (path.endsWith("MinecraftUnterDenLindenDetails.ts")) {
        source = once(source, "  addAeroflot(builder);", "  // v208 audit: only the inaccurate eight-axis Aeroflot recipe yields.");
      } else if (path.endsWith("UnterDenLindenDetails.ts")) {
        source = once(source, "  addAeroflot(specs[1].structure, specs[1].fine);", "  // v208 audit: only the inaccurate eight-axis Aeroflot recipe yields.");
      }
    }
    return { contents: source, loader: "ts" };
  });
} });

const scene = JSON.parse(before("src/app/public/mesh/regierungsviertel/scene.json"));
const { createCentralCivicDetails } = await import("../src/CentralCivicDetails");
const { createGendarmenmarktPerimeterFacades } = await import("../src/GendarmenmarktPerimeterFacades");
const { createUnterDenLindenDetails } = await import("../src/UnterDenLindenDetails");
const { createMinecraftUnterDenLindenDetails } = await import("../src/MinecraftUnterDenLindenDetails");
const { createIsometricCityCore } = await import("../src/IsometricCityWorld");
function audit(root: ReturnType<typeof createCentralCivicDetails>) {
  try { return staticGeometryAudit(root); }
  finally { disposeStaticAudit(root); }
}
const civic = Object.fromEntries((["full", "mobile"] as const).map(profile => [profile,
  audit(createCentralCivicDetails(scene.landmarks, profile, { includeLegacyResearchMinistry: false })),
]));
const gendarmenmarkt = Object.fromEntries(([false, true] as const).map(native => [native ? "minecraft" : "day",
  audit(createGendarmenmarktPerimeterFacades(native)),
]));
const linden = { day: audit(createUnterDenLindenDetails()), minecraft: audit(createMinecraftUnterDenLindenDetails()) };
const payload = JSON.parse(before("src/app/public/mesh/regierungsviertel/lod2-prisms.json"));
const hungaryIds = ["YDxshLdM", "cyb33NJD", "dVaNVYh5", "dxdP8ZV2", "j66nu4dr", "mN0gGHof"];
const parts = payload.buildings.filter((b: { id: string }) => hungaryIds.includes(b.id));
if (parts.length !== 6) throw new Error("Hungarian source inventory changed");
const core = (buildings: typeof parts) => audit(createIsometricCityCore({ ...payload, buildings }, null, null, null, { includeContext: false }));
const hungary = { ids: hungaryIds, sourceSha256: createHash("sha256").update(JSON.stringify(parts)).digest("hex"),
  complete: core(parts), empty: core([]),
  byOwner: Object.fromEntries(parts.map((b: { id: string }) => [b.id, core([b])])),
  foreignIdsSameGeometry: core(parts.map((b: { id: string }) => ({ ...b, id: `v208-control-${b.id}` }))),
};
console.log(JSON.stringify({ commit, complement, sourceSha256: hashes, civic, gendarmenmarkt, linden, hungary }, null, 2));
