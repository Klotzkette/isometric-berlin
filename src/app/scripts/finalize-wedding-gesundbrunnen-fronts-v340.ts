/** Resolve raw and prepared guards with the same loader and preparers as the viewer. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { createSourceQuarterRecipeLoaderV309, SOURCE_QUARTER_CATALOGUE_V309 } from "../src/SourceQuarterCatalogueV309";
import { captureSourceQuarterPacketV303 } from "../src/SourceQuarterPacketV303";
import { prepareSurroundingQuarterPredecessorV303, type SurroundingCityChunk, type SurroundingOwnershipOptions } from "../src/SurroundingCityGeometry";
import { weddingGesundbrunnenFrontsV340 } from "../src/WeddingGesundbrunnenFrontsV340";

const [recipePath, receiptPath] = process.argv.slice(2);
if (!recipePath || !receiptPath) throw Error("Supply temporary recipe and receipt paths");
const source = JSON.parse(readFileSync(recipePath, "utf8")) as NeighbourhoodSourceV300;
const receipt = JSON.parse(gunzipSync(readFileSync(receiptPath)).toString());
const root = resolve(import.meta.dir, "../../..", "src/app/public/mesh/surrounding-berlin-v159");
const descriptors = new Map(JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8")).chunks.map((row: any) => [row.id, row]));
const loadPredecessors = createSourceQuarterRecipeLoaderV309(
  SOURCE_QUARTER_CATALOGUE_V309.filter(entry => entry.kind !== weddingGesundbrunnenFrontsV340.kind),
);
const settings: SurroundingOwnershipOptions = {
  neighbourhoodV300: true, westKiezV302: true, stralauSisyphosV299: true,
  sourceQuartersV303: true, northFidelityV309: true, treptowWaterfrontV317: true,
  neukoellnLandmarksV305: true, southFidelityV294: true, tachelesFrontsV270: true,
  littenStadthausV297: true, wallGalleryV298: true,
};
function drain<T>(steps: Generator<void, T>): T {
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}
function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
  return value;
}
const lineGuard = (packet: SurroundingCityChunk) => packet.lines ? hash(packet.lines.positions + (packet.lines.colors ?? "")) : null;
const reports = [];
for (const key of source.keys) {
  const [mode, id] = key.split(":"), native = mode === "minecraft", plan = source.packets[key];
  const descriptor = descriptors.get(id) as Record<string, { url: string }> | undefined;
  if (!descriptor?.[mode]) throw Error(`Missing original packet ${key}`);
  const raw = JSON.parse(gunzipSync(readFileSync(resolve(root, descriptor[mode].url))).toString()) as SurroundingCityChunk;
  plan.navGuard = hash(JSON.stringify(raw.nav));
  plan.lineGuard = lineGuard(raw);
  const recipes = await loadPredecessors(id, native);
  const tickets = recipes.map(entry => entry.source.packets[key]?.preparedRecords
    ? drain(captureSourceQuarterPacketV303(raw, id, native, true, entry.source, entry.kind, entry.requiredReplacement))
    : drain(captureNeighbourhoodPacketV300(raw, id, native, true, entry.source as unknown as NeighbourhoodSourceV300, entry.kind)));
  let prepared = drain(prepareSurroundingQuarterPredecessorV303(raw, id, native, { ...settings, sourceQuarterSourcesV303: recipes }));
  for (const ticket of tickets) if (ticket) prepared = drain(ticket(prepared));
  plan.preparedNavGuard = hash(JSON.stringify(prepared.nav));
  plan.preparedLineGuard = lineGuard(prepared);
  const ticket = drain(captureNeighbourhoodPacketV300(raw, id, native, true, source, weddingGesundbrunnenFrontsV340.kind));
  if (!ticket || !drain(ticket(prepared)).meshes.some(part => part.kind === weddingGesundbrunnenFrontsV340.kind)) {
    throw Error(`The complete recipe did not admit on ${key}`);
  }
  reports.push({
    key, rawNavGuard: plan.navGuard, preparedNavGuard: plan.preparedNavGuard,
    rawLineGuard: plan.lineGuard, preparedLineGuard: plan.preparedLineGuard,
    preparedParts: prepared.meshes.length, preparedKinds: prepared.meshes.map(part => part.kind),
  });
}
receipt.pendingBunPrimaryGuards = [];
receipt.actualPreparedGuards = reports;
writeFileSync(recipePath, JSON.stringify(source) + "\n");
writeFileSync(receiptPath, gzipSync(JSON.stringify(receipt) + "\n"));
