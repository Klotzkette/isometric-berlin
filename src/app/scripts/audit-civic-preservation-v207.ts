/** Bounded, read-only reconstruction of the immutable v106 civic/Charité baseline. */
import { plugin } from "bun";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { relative } from "node:path";
import { staticGeometryAudit, disposeStaticAudit } from "../tests/helpers/staticGeometryAudit";

const commit = "6bd9693555e6ffb4350375c3fda49cb586c69614";
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const withoutChariteFacade = process.argv.includes("--without-charite-facade");
const hashes: Record<string, string> = {};
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
function before(path: string): string {
  const result = Bun.spawnSync(["git", "show", `${commit}:${path}`], { cwd: repo });
  if (result.exitCode) throw new Error(`Cannot load ${commit}:${path}`);
  hashes[path] = sha(result.stdout);
  return result.stdout.toString();
}
function replaceOnce(source: string, from: string, to: string): string {
  if (source.split(from).length !== 2) throw new Error("Historical audit guard is not unique");
  return source.replace(from, to);
}
plugin({ name: "immutable-v106-bounded-civic-audit", setup(build) {
  build.onLoad({ filter: /\/(CentralCivicDetails|IsometricCityWorld)\.ts$/ }, args => {
    const path = relative(repo, args.path);
    let source = before(path);
    if (path.endsWith("CentralCivicDetails.ts")) {
      // Test-only access to one existing private recipe; production is untouched.
      source += `\nexport function auditGreenFederalCampusV207(landmarks) {
        const builder = createBuilder();
        addGreenFederalCampus(builder, new Map(landmarks.map(p => [p.name,p])));
        return finishDrawnGroup(builder, {name:"Legacy green federal campus audit",lampEmissive:0xffd68a,lampEmissiveIntensity:0.85});
      }\n`;
    } else if (withoutChariteFacade) {
      // Remove only these two inferred facade recipes, preserving all shells,
      // roofs, roof/edge ink, other owners and the separate campus bridge.
      source = replaceOnce(source,
        "if (CHARITE_BETTENHOCHHAUS_IDS.has(building.id)) {\n      const baseHeight",
        "if (false && CHARITE_BETTENHOCHHAUS_IDS.has(building.id)) {\n      const baseHeight");
      source = replaceOnce(source,
        "if (CHARITE_BETTENHOCHHAUS_IDS.has(building.id)) {\n            const profile",
        "if (CHARITE_BETTENHOCHHAUS_IDS.has(building.id)) {\n            continue;\n            const profile");
    }
    return { contents: source, loader: "ts" };
  });
} });

const payloadPath = "src/app/public/mesh/regierungsviertel/lod2-prisms.json";
const landmarksPath = "src/app/public/mesh/regierungsviertel/scene.json";
const payload = JSON.parse(before(payloadPath));
const landmarks = JSON.parse(before(landmarksPath)).landmarks;
const ministryName = "Bundesministerium für Forschung, Technologie und Raumfahrt";
const educationName = "Bundesministerium für Bildung, Familie, Senioren, Frauen und Jugend";
const civic = await import("../src/CentralCivicDetails") as any;
const city = await import("../src/IsometricCityWorld");
const ids = [...city.CHARITE_BETTENHOCHHAUS_IDS].sort();
const buildings = payload.buildings.filter((p: any) => ids.includes(p.id));
if (buildings.length !== 16) throw new Error("The exact Charité source inventory changed");
const audit = (root: any) => {
  try { return staticGeometryAudit(root); }
  finally { disposeStaticAudit(root); }
};
const result: any = {
  commit, withoutChariteFacade, sourceSha256: hashes,
  ministryName, educationName,
  chariteIds: ids, chariteSourceSha256: sha(JSON.stringify(buildings)),
  bridgeId: city.CHARITE_CAMPUS_BRIDGE_ID, civic: {}, charite: {},
};
for (const profile of ["full", "mobile"] as const) {
  result.civic[profile] = {
    complete: audit(civic.createCentralCivicDetails(landmarks, profile)),
    retainedWithoutMinistry: audit(civic.createCentralCivicDetails(landmarks.filter((p: any) => p.name !== ministryName), profile)),
    ministryRecipe: audit(civic.auditGreenFederalCampusV207(landmarks.filter((p: any) => p.name === ministryName))),
    educationRecipe: audit(civic.auditGreenFederalCampusV207(landmarks.filter((p: any) => p.name === educationName))),
  };
  const core = (parts: any[]) => audit(city.createIsometricCityCore(
    { ...payload, buildings: parts }, null, null, null, { detailProfile: profile },
  ));
  result.charite[profile] = {
    complete: core(buildings),
    byOwner: Object.fromEntries(buildings.map((p: any) => [p.id, core([p])])),
    bridge: core(payload.buildings.filter((p: any) => p.id === city.CHARITE_CAMPUS_BRIDGE_ID)),
    // Same exact footprints with foreign IDs catch accidental spatial filters.
    foreignIdsSameGeometry: core(buildings.map((p: any) => ({ ...p, id: `v207-control-${p.id}` }))),
  };
}
console.log(JSON.stringify(result, null, 2));
