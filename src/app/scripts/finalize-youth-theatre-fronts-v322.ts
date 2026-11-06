/** Exact raw/prepared guards from the actual retained baseline200 pipeline.
 * This creates no scene and writes only the two new V321 derivatives. */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import path from "node:path";
import { prepareSurroundingQuarterPredecessorV303, type SurroundingCityChunk,
  type SurroundingOwnershipOptions } from "../src/SurroundingCityGeometry";
import { captureNeighbourhoodPacketV300, prepareNeighbourhoodPacketV300,
  neighbourhoodPacketAdmittedV300, type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { captureSourceQuarterPacketV303, prepareSourceQuarterPacketV303,
  type SourceQuarterTicketV303 } from "../src/SourceQuarterPacketV303";
import { loadSourceQuarterRecipesV309 } from "../src/SourceQuarterCatalogueV309";
import clusterData from "../src/data/clusterFacadesV320.json";

const repo = path.resolve(import.meta.dir, "../../..");
const runtimePath = path.join(repo, "src/app/src/data/youthTheatreFrontsV322Packets.json");
const proofPath = path.join(repo, "geo_data/regierungsviertel/youth-theatre-fronts-v322-evidence.json.gz");
const publicDir = path.join(repo, "src/app/public/mesh/surrounding-berlin-v159");
const source = JSON.parse(readFileSync(runtimePath, "utf8")) as NeighbourhoodSourceV300;
const proof = JSON.parse(gunzipSync(readFileSync(proofPath)).toString());
const descriptors = new Map(JSON.parse(readFileSync(path.join(publicDir, "manifest.json"), "utf8")).chunks.map((c: any) => [c.id, c]));
const clusters = clusterData as unknown as NeighbourhoodSourceV300;
function drain<T>(steps: Generator<void, T>): T { for (;;) { const r = steps.next(); if (r.done) return r.value; } }
const fnv = (texts: string[]) => { let h = 2166136261; for (const s of texts) for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; };
const reports = [];
for (const key of source.keys) {
  const colon = key.indexOf(":"), mode = key.slice(0, colon), id = key.slice(colon + 1);
  const native = mode === "minecraft", descriptor = descriptors.get(id) as any;
  if (!descriptor?.[mode]) throw Error(`Missing exact descriptor ${key}`);
  const raw = JSON.parse(gunzipSync(readFileSync(path.join(publicDir, descriptor[mode].url))).toString()) as SurroundingCityChunk;
  const plan = source.packets[key];
  plan.navGuard = fnv([JSON.stringify(raw.nav)]);
  plan.lineGuard = raw.lines ? fnv([raw.lines.positions, raw.lines.colors ?? ""]) : null;
  const clusterTicket = drain(captureNeighbourhoodPacketV300(raw, id, native, true, clusters, "cluster-facades-v320"));
  const recipes = await loadSourceQuarterRecipesV309(id, native);
  const ownership: SurroundingOwnershipOptions = { neighbourhoodV300: true, westKiezV302: true,
    stralauSisyphosV299: true, sourceQuartersV303: true, sourceQuarterSourcesV303: recipes,
    northFidelityV309: true, treptowWaterfrontV317: true, neukoellnLandmarksV305: true,
    southFidelityV294: true, tachelesFrontsV270: true, littenStadthausV297: true, wallGalleryV298: true };
  const tickets: SourceQuarterTicketV303[] = [];
  for (const entry of recipes) {
    if(entry.kind === "youth-theatres-v322")continue;
    const prior = entry.source.packets[key];
    if (!prior) continue;
    const ticket = prior.preparedRecords
      ? drain(captureSourceQuarterPacketV303(raw, id, native, true, entry.source, entry.kind, entry.requiredReplacement))
      : drain(captureNeighbourhoodPacketV300(raw, id, native, true, entry.source as unknown as NeighbourhoodSourceV300, entry.kind));
    if (ticket) tickets.push(ticket);
  }
  let prepared = drain(prepareSurroundingQuarterPredecessorV303(raw, id, native, ownership));
  for (const ticket of tickets) prepared = drain(prepareSourceQuarterPacketV303(prepared, ticket));
  prepared = drain(prepareNeighbourhoodPacketV300(prepared, clusterTicket));
  plan.preparedNavGuard = fnv([JSON.stringify(prepared.nav)]);
  plan.preparedLineGuard = prepared.lines ? fnv([prepared.lines.positions, prepared.lines.colors ?? ""]) : null;
  const ticket = drain(captureNeighbourhoodPacketV300(raw, id, native, true, source, "youth-theatres-v322"));
  if (!ticket) throw Error(`New complete source admission failed ${key}`);
  const result = drain(prepareNeighbourhoodPacketV300(prepared, ticket));
  if (!neighbourhoodPacketAdmittedV300(result) || result.meshes.length !== prepared.meshes.length + 1 ||
    JSON.stringify(result.nav) !== JSON.stringify(prepared.nav) || result.lines !== prepared.lines) throw Error(`Incomplete final predecessor admission ${key}`);
  reports.push({ key, preparedKinds: prepared.meshes.map(p => p.kind),
    rawNavGuard: plan.navGuard, preparedNavGuard: plan.preparedNavGuard,
    rawLineGuard: plan.lineGuard, preparedLineGuard: plan.preparedLineGuard,
    priorClusterTicket: !!clusterTicket, priorSourceQuarterTickets: tickets.length });
}
proof.requiredPreparedGuardFinalization = false;
proof.actualPreparedGuards = reports;
writeFileSync(runtimePath, JSON.stringify(source) + "\n");
writeFileSync(proofPath, gzipSync(JSON.stringify(proof) + "\n", { mtime: 0 } as any));
console.log(JSON.stringify({ packets: reports.length, preparedGuards: reports }));
