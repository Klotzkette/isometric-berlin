/** Offline compilation against the actual preceding Drawn and Native scene. */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { captureNeighbourhoodPacketV300, type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { captureSourceQuarterPacketV303 } from "../src/SourceQuarterPacketV303";
import { createSourceQuarterRecipeLoaderV309, SOURCE_QUARTER_CATALOGUE_V309 } from "../src/SourceQuarterCatalogueV309";
import {
  groundOverlayKindsV329,
  prepareSurroundingQuarterPredecessorV303,
  type SurroundingCityChunk,
  type SurroundingOwnershipOptions,
} from "../src/SurroundingCityGeometry";
import { surroundingPacketFingerprint } from "../src/surroundingPacketFingerprint";
import { plateClearV350, drain } from "./civic-facility-support-v350";
import { productionSupportV350, proveProductionV350 } from "./civic-production-proof-v350";
import {
  VENUE_FRONTS_KIND_V355,
  VENUE_FRONTS_KIND_V356,
  VENUE_FRONTS_KIND_V357,
  venueFrontSourceV355,
  type VenueFrontPlan,
  type VenueFrontRecipes,
  type VenuePlate,
  type VenuePanel,
} from "../src/VenueFrontMeshV355";

type Mode = "drawn" | "minecraft";
type Job = {
  host: string;
  modes: Record<Mode, {
    path: string;
    sites: Record<string, { owner: string; options: [VenuePlate, { length: number }, boolean][]; panels?: { reference: string; index: number; panel: VenuePanel }[] }>;
  }>;
};
const flags: SurroundingOwnershipOptions = {
  schlossplatzV239:true, staatsoperV240:true, architectureV241:true, mitteEnsembleV281:true,
  prenzlbergV264:true, chariteBridgesV265:true, operaTheatresV274:true, northernSitesV266:true,
  golgathaV270:true, tachelesFrontsV270:true, southFidelityV294:true, littenStadthausV297:true,
  wallGalleryV298:true, stralauSisyphosV299:true, neighbourhoodV300:true, westKiezV302:true,
  sourceQuartersV303:true, neukoellnLandmarksV305:true, northFidelityV309:true,
  treptowWaterfrontV317:true, governmentOfficesV321:true, universitiesV322:true,
  wilhelmHousingV324:true, wilhelmStreetFrontsV325:true, southWestSitesV326:true,
};
const [jobsPath, resultPath, kind = VENUE_FRONTS_KIND_V355] = process.argv.slice(2);
if (!jobsPath || !resultPath || ![VENUE_FRONTS_KIND_V355, VENUE_FRONTS_KIND_V356, VENUE_FRONTS_KIND_V357].includes(kind)) {
  throw new Error("Expected jobs path, result path and optionally a venue layer kind");
}
const older = createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(
  entry => !groundOverlayKindsV329.has(entry.kind) && entry.kind !== VENUE_FRONTS_KIND_V357 &&
    (entry.kind !== VENUE_FRONTS_KIND_V356 || kind === VENUE_FRONTS_KIND_V357) && entry.kind !== kind,
));
const ground = createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(
  entry => groundOverlayKindsV329.has(entry.kind),
));
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}
const lineHash = (p: SurroundingCityChunk) => p.lines ? hash(p.lines.positions + (p.lines.colors ?? "")) : null;

async function inspect(job: Job, mode: Mode) {
  const native = mode === "minecraft";
  const key = mode + ":" + job.host;
  const packet = job.modes[mode];
  const raw = JSON.parse(gunzipSync(readFileSync(packet.path)).toString()) as SurroundingCityChunk;
  const before = await older(job.host, native);
  const all = [...before, ...await ground(job.host, native)];
  let prepared = drain(prepareSurroundingQuarterPredecessorV303(structuredClone(raw), job.host, native, flags));
  for (const entry of before) {
    const ticket = entry.source.packets[key]?.preparedRecords
      ? drain(captureSourceQuarterPacketV303(raw, job.host, native, true, entry.source, entry.kind, entry.requiredReplacement))
      : drain(captureNeighbourhoodPacketV300(raw, job.host, native, true, entry.source as unknown as NeighbourhoodSourceV300, entry.kind));
    if (ticket) prepared = drain(ticket(prepared));
  }
  const actual = await productionSupportV350(raw, job.host, native, flags, all);
  const owners = new Set(actual.nav.buildings.map(building => building.sourceId));
  const available = new Map<string, { owner: string; plate?: VenuePlate; mappedEntrance: boolean;
    panels: Map<number, { reference: string; panel: VenuePanel }> }>();
  for (const [id, site] of Object.entries(packet.sites)) {
    if (!owners.has(site.owner)) continue;
    const panels = new Map<number, { reference: string; panel: VenuePanel }>();
    for (const { index, panel, reference } of site.panels ?? []) {
      if (!panels.has(index) && plateClearV350(actual.meshes, panel.anchor, panel.height / 2 + 2)) {
        panels.set(index, { reference, panel });
      }
    }
    let plateChoice: { plate: VenuePlate; mappedEntrance: boolean } | undefined;
    for (const [option, face, mappedEntrance] of site.options) {
      for (const verticalDelta of [0, 28, -35, 55, 82]) {
        const plate = [...option] as VenuePlate;
        plate[1] += verticalDelta;
        if (plate[1] >= 65510 || plate[1] < 22 || face.length * 100 < plate[7] + 10) continue;
        const conflicts = [...available.values()].some(({ plate: old }) =>
          old && Math.abs(old[1] - plate[1]) < 45 &&
          Math.hypot(old[0] - plate[0], old[2] - plate[2]) < (old[7] + plate[7]) / 2 + 12,
        );
        if (!conflicts && plateClearV350(actual.meshes, plate)) {
          plateChoice = { plate, mappedEntrance };
          break;
        }
      }
      if (plateChoice) break;
    }
    if (plateChoice || panels.size) {
      available.set(id, { owner: site.owner, mappedEntrance: false, ...plateChoice, panels });
    }
  }
  const plan = {
    origin: raw.origin,
    navGuard: hash(JSON.stringify(raw.nav)),
    preparedNavGuard: hash(JSON.stringify(prepared.nav)),
    lineGuard: lineHash(raw),
    preparedLineGuard: lineHash(prepared),
    records: raw.meshes.map((part, mesh) => ({
      mesh, kind: part.kind, fingerprint: drain(surroundingPacketFingerprint(part)),
    })),
    retire: [],
  };
  const start = prepared.meshes.reduce((count, mesh) => count + atob(mesh.positions).length / 6, 0);
  return { available, raw, all, key, plan, start };
}

const jobs = JSON.parse(readFileSync(jobsPath, "utf8")) as Job[];
const packets: VenueFrontRecipes["packets"] = {};
const admitted: Record<string, { host: string; owner: string; entranceEvidenceBothModes: boolean; plate: boolean; facadeReferences: string[] }> = {};
const rejected: { host: string; reason: unknown }[] = [];
for (const job of jobs) {
  try {
    const drawn = await inspect(job, "drawn");
    const native = await inspect(job, "minecraft");
    const shared = [...drawn.available.keys()].flatMap(id => {
      const d = drawn.available.get(id)!, n = native.available.get(id);
      if (!n || admitted[id]) return [];
      const panelIndices = [...d.panels.keys()].filter(index => n.panels.has(index));
      const plate = !!d.plate && !!n.plate;
      return plate || panelIndices.length ? [{ id, plate, panelIndices }] : [];
    });
    const both = shared.map(row => row.id);
    if (!both.length) {
      rejected.push({ host: job.host, reason: "no-visible-wall-in-both-families" });
      continue;
    }
    const plans: VenueFrontRecipes["packets"] = {};
    let accepted = true;
    for (const result of [drawn, native]) {
      const selected = shared.map(row => ({ ...row, ...result.available.get(row.id)!, showPlate: row.plate }));
      const key = result.key;
      const plan: VenueFrontPlan = {
        ...result.plan,
        owners: [...new Set(selected.map(row => row.owner))],
        plates: selected.flatMap(row => row.showPlate ? [row.plate!] : []),
        panels: selected.flatMap(row => row.panelIndices.map(i => row.panels.get(i)!.panel)),
      };
      const source = venueFrontSourceV355({ schemaVersion: 1, keys: [key], packets: { [key]: plan } }, kind);
      const proof = await proveProductionV350(result.raw, job.host, key.startsWith("minecraft:"),
        flags, result.all, source, result.start, plan.plates);
      if (!proof.valid) {
        accepted = false;
        rejected.push({ host: job.host, reason: proof.reason });
        break;
      }
      plans[key] = plan;
    }
    if (accepted) {
      Object.assign(packets, plans);
      for (const { id, plate, panelIndices } of shared) {
        const d = drawn.available.get(id)!, n = native.available.get(id)!;
        admitted[id] = { host: job.host, owner: d.owner, plate, entranceEvidenceBothModes: plate && d.mappedEntrance && n.mappedEntrance,
          facadeReferences: [...new Set(panelIndices.map(index => d.panels.get(index)!.reference))] };
      }
      console.log(job.host, "added", both.length);
    }
  } catch (error) {
    rejected.push({ host: job.host, reason: String(error) });
  } finally {
    Bun.gc(true);
  }
}
const recipes: VenueFrontRecipes = { schemaVersion: 1, keys: Object.keys(packets).sort(), packets };
writeFileSync(resultPath, JSON.stringify({ recipes, admitted, rejected }) + "\n");
console.log(Object.keys(admitted).length, "visible sites", recipes.keys.length / 2, "hosts", rejected.length, "declined hosts");
