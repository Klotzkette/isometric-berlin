/** Exact raw/prepared guards from the actual retained baseline200 pipeline.
 * This creates no scene and writes only the two new V321 derivatives. */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import path from "node:path";
import { prepareSurroundingQuarterPredecessorV303, type SurroundingCityChunk,
  type SurroundingOwnershipOptions } from "../src/SurroundingCityGeometry";
import { captureNeighbourhoodPacketV300, prepareNeighbourhoodPacketV300,
  type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { captureSourceQuarterPacketV303, prepareSourceQuarterPacketV303,
  type SourceQuarterTicketV303, type SourceQuarterSourceV303 } from "../src/SourceQuarterPacketV303";
import { loadSourceQuarterRecipesV309 } from "../src/SourceQuarterCatalogueV309";
import clusterData from "../src/data/clusterFacadesV320.json";

const repo = path.resolve(import.meta.dir, "../../..");
const runtimePath = path.join(repo, "src/app/src/data/federalMinistriesV321Packets.json");
const proofPath = path.join(repo, "geo_data/regierungsviertel/federal-ministries-v321-packets-evidence.json.gz");
const publicDir = path.join(repo, "src/app/public/mesh/surrounding-berlin-v159");
const source = JSON.parse(readFileSync(runtimePath, "utf8")) as SourceQuarterSourceV303;
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
  const recipes = (await loadSourceQuarterRecipesV309(id, native)).filter(e => e.kind!=="federal-ministries-v321");
  const ownership: SurroundingOwnershipOptions = { neighbourhoodV300: true, westKiezV302: true,
    stralauSisyphosV299: true, sourceQuartersV303: true, sourceQuarterSourcesV303: recipes,
    northFidelityV309: true, treptowWaterfrontV317: true, neukoellnLandmarksV305: true,
    southFidelityV294: true, tachelesFrontsV270: true, littenStadthausV297: true, wallGalleryV298: true };
  const tickets: SourceQuarterTicketV303[] = [];
  for (const entry of recipes) {
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
  plan.preparedRecords = prepared.meshes.map((p, mesh) => ({mesh,kind:p.kind,fingerprint:fnv([p.positions,p.colors,p.indices])}));
  const ticket = drain(captureSourceQuarterPacketV303(raw, id, native, true, source, "federal-ministries-v321", true));
  if (!ticket) throw Error(`New complete source admission failed ${key}`);
  const result = drain(prepareSourceQuarterPacketV303(prepared, ticket));
  if (result === prepared || result.meshes.length !== prepared.meshes.length ||
    JSON.stringify(result.nav) !== JSON.stringify(prepared.nav) || result.lines !== prepared.lines) throw Error(`Incomplete final predecessor admission ${key}`);
  reports.push({ key, preparedKinds: prepared.meshes.map(p => p.kind),
    rawNavGuard: plan.navGuard, preparedNavGuard: plan.preparedNavGuard,
    rawLineGuard: plan.lineGuard, preparedLineGuard: plan.preparedLineGuard,
    priorClusterTicket: !!clusterTicket, priorSourceQuarterTickets: tickets.length });
}
proof.preparedGuardsFinalized = true;
proof.actualPreparedGuards = reports;
writeFileSync(runtimePath, JSON.stringify(source) + "\n");
writeFileSync(proofPath, gzipSync(JSON.stringify(proof) + "\n", { mtime: 0 } as any));
console.log(JSON.stringify({ packets: reports.length, preparedGuards: reports }));

const profilePath=path.join(repo,"src/app/src/data/federalMinistriesV321.json"),previousPath=path.join(repo,"src/app/src/data/federalMinistriesV321Previous.json");
const profile=JSON.parse(readFileSync(profilePath,"utf8")),previous=JSON.parse(readFileSync(previousPath,"utf8"));
const controls=Object.fromEntries(Object.entries(previous.plans).map(([key,plan])=>[key,fnv([JSON.stringify(plan)])]));
const factoryPath=path.join(repo,"src/app/src/FederalMinistriesV321.ts"),previousModule=path.join(repo,"src/app/src/federalMinistryPreviousV321.ts");
writeFileSync(factoryPath,readFileSync(factoryPath,"utf8").replace(/const EXPECTED_PROFILE_CONTROL(?:: number)? = \d+;/,`const EXPECTED_PROFILE_CONTROL: number = ${fnv([JSON.stringify(profile)])};`));
writeFileSync(previousModule,readFileSync(previousModule,"utf8").replace(/const controls = \{[^;]+;/,`const controls = ${JSON.stringify(controls)};`));
console.log(JSON.stringify({profileControl:fnv([JSON.stringify(profile)]),controls}));
