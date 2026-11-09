/** Pin original assets and the actual old local preparers without loading a city. */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  prepareSurroundingQuarterPredecessorV303,
  type SurroundingCityChunk,
  type SurroundingOwnershipOptions,
} from "../src/SurroundingCityGeometry";
import { ubahnCandidatesV326 } from "../src/UbahnGroundRuntimeV326";

const options: SurroundingOwnershipOptions = {
  schlossplatzV239: true, staatsoperV240: true, architectureV241: true, mitteEnsembleV281: true,
  prenzlbergV264: true, chariteBridgesV265: true, operaTheatresV274: true, northernSitesV266: true,
  golgathaV270: true, tachelesFrontsV270: true, southFidelityV294: true, littenStadthausV297: true,
  wallGalleryV298: true, stralauSisyphosV299: true, neighbourhoodV300: true, westKiezV302: true,
  sourceQuartersV303: true, neukoellnLandmarksV305: true, northFidelityV309: true,
  treptowWaterfrontV317: true, governmentOfficesV321: true, universitiesV322: true,
  wilhelmHousingV324: true, wilhelmStreetFrontsV325: true, southWestSitesV326: true,
};
function fnv(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash;
}
function lineGuard(packet: SurroundingCityChunk): number | null {
  return packet.lines ? fnv(packet.lines.positions + (packet.lines.colors ?? "")) : null;
}
type Input = readonly [key: string, file: string];
const input = JSON.parse(await Bun.stdin.text());
if (Bun.argv.includes("--ubahn-bounds")) {
  const descriptors = input as readonly { id: string; bounds: readonly number[] }[];
  process.stdout.write(JSON.stringify(descriptors.filter(d => ubahnCandidatesV326(d.bounds).length).map(d => d.id)));
  process.exit(0);
}
const inputs = input as readonly Input[];
const { SOURCE_QUARTER_CATALOGUE_V309 } = await import("../src/SourceQuarterCatalogueV309");
const oldPlanCounts = new Map<string, number>();
for (const entry of SOURCE_QUARTER_CATALOGUE_V309) {
  if (entry.kind.endsWith("-v329")) continue;
  for (const key of entry.keys) oldPlanCounts.set(key, (oldPlanCounts.get(key) ?? 0) + 1);
}
for (const [key, path] of inputs) {
  const split = key.indexOf(":");
  const mode = key.slice(0, split);
  const id = key.slice(split + 1);
  const original = JSON.parse(gunzipSync(readFileSync(path)).toString()) as SurroundingCityChunk;
  const work = prepareSurroundingQuarterPredecessorV303(structuredClone(original), id, mode === "minecraft", options);
  let step = work.next();
  while (!step.done) step = work.next();
  const prepared = step.value;
  // Older ordinary append plans (and late Cluster/Senate) may all be present.
  // Keep a slot for each catalogue owner, plus the unrelated two V329 layers.
  if (prepared.meshes.length + (oldPlanCounts.get(key) ?? 0) + 5 > 16) {
    process.stdout.write(JSON.stringify([key, null]) + "\n");
    continue;
  }
  const rawRecords = original.meshes.map((part, mesh) => ({
    mesh, kind: part.kind, fingerprint: fnv(part.positions + part.colors + part.indices),
  }));
  const differs = original.meshes.some((part, i) => {
    const p = prepared.meshes[i];
    return !p || p.kind !== part.kind || p.positions !== part.positions || p.colors !== part.colors || p.indices !== part.indices;
  });
  if (differs) {
    process.stdout.write(JSON.stringify([key, null]) + "\n");
    continue;
  }
  process.stdout.write(JSON.stringify([key, {
    records: rawRecords,
    navGuard: fnv(JSON.stringify(original.nav)), lineGuard: lineGuard(original),
    preparedNavGuard: fnv(JSON.stringify(prepared.nav)), preparedLineGuard: lineGuard(prepared),
  }]) + "\n");
}
