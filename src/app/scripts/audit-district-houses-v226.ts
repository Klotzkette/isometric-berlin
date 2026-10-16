/** Read-only Step 10 audit. No city factory, build, packet rewrite or new geometry. */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Color } from "three";
import { DISTRICT_HOUSE_REGIONS_V226, DISTRICT_HOUSE_ROOF_V226, districtHouseRegionV226, shadeDistrictHousePanesV226 } from "../src/districtHousePresentationV226";
import { districtHouseOwnerV225 } from "../src/districtHousePresentationV225";
import { surroundingColourOwners } from "../src/surroundingCityColourV184";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const directory = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", directory), "utf8"));
const roof = new Color(0x9d978c).toArray().map(value => Math.round(value * 255));
const regions = DISTRICT_HOUSE_REGIONS_V226.map(region => ({ name: region.name, drawnOwners: new Set<string>(), nativeOwners: new Set<string>(), drawnRoofVertices: 0, nativeRoofVertices: 0, drawnPanes: 0, nativePanes: 0, example: "" }));
let packets = 0, maxMs = 0, maxPacket = "", maxVertices = 0, ownerMs = 0, paneMs = 0;
let largestNew: { id: string; family: string; url: string; vertices: number } | undefined;
const inputs: { id: string; family: string; sha256: string }[] = [];
for (const descriptor of manifest.chunks) {
  const [x0, z0, x1, z1] = descriptor.bounds;
  if (!DISTRICT_HOUSE_REGIONS_V226.some(region => x0 <= region.bounds[2] && x1 >= region.bounds[0] && z0 <= region.bounds[3] && z1 >= region.bounds[1])) continue;
  for (const family of ["drawn", "minecraft"] as const) {
    const asset = descriptor[family], raw = readFileSync(new URL(asset.url, directory));
    const packet = JSON.parse(gunzipSync(raw).toString()) as SurroundingCityChunk;
    if (!packet.meshes.some(part => ["city", "district-facades-v188", "kiez-facades-v209"].includes(part.kind))) continue;
    const sha256 = new Bun.CryptoHasher("sha256").update(raw).digest("hex");
    if (sha256 !== asset.sha256) throw new Error(`Source packet differs from retained manifest: ${descriptor.id}/${family}`);
    inputs.push({ id: descriptor.id, family, sha256 }); packets++;
    const started = performance.now();
    const steps = surroundingColourOwners(packet.nav.buildings, packet.nav.groundY, packet.origin[1], packet.origin[0], packet.origin[2]);
    let next = steps.next(); while (!next.done) next = steps.next(); const owners = next.value;
    ownerMs += performance.now() - started;
    let processingMs = performance.now() - started, count = 0, newlyChanged = false;
    for (const part of packet.meshes) {
      if (!["city", "district-facades-v188", "kiez-facades-v209"].includes(part.kind)) continue;
      const pos = Uint16Array.from(new Uint16Array(Uint8Array.from(Buffer.from(part.positions, "base64")).buffer));
      const colors = Buffer.from(part.colors, "base64"); count += pos.length / 3;
      if (part.kind === "city") {
        for (let at = 0; at < pos.length; at += 3) {
          if (colors[at] !== roof[0] || colors[at + 1] !== roof[1] || colors[at + 2] !== roof[2]) continue;
          const owner = owners.get(pos[at] * 65536 + pos[at + 2]);
          if (owner?.palette.roof !== DISTRICT_HOUSE_ROOF_V226) continue;
          const region = districtHouseRegionV226(packet.origin[0] + pos[at] / 100, packet.origin[2] + pos[at + 2] / 100);
          if (region < 0) throw new Error("Outside roof correction");
          newlyChanged ||= region >= 5;
          const item = regions[region]; item.example ||= descriptor.id;
          if (family === "drawn") { item.drawnOwners.add(owner.sourceId); item.drawnRoofVertices++; }
          else { item.nativeOwners.add(owner.sourceId); item.nativeRoofVertices++; }
        }
      } else {
        const values = new Uint16Array(pos.length * 2);
        for (let at = 0; at < pos.length; at += 3) for (let c = 0; c < 3; c++) { values[at * 2 + c] = pos[at + c]; values[at * 2 + c + 3] = colors[at + c] * 257; }
        const indices = new Uint32Array(Uint8Array.from(Buffer.from(part.indices, "base64")).buffer);
        const before = performance.now(), shading = shadeDistrictHousePanesV226(part.kind, values, indices, 0, indices.length, packet.origin[0], packet.origin[2], family === "minecraft");
        while (!shading.next().done) {} const elapsed = performance.now() - before; paneMs += elapsed; processingMs += elapsed;
        for (let v = 0; v < pos.length / 3; v += 4) {
          if (values[v * 6 + 3] === colors[v * 3] * 257) continue;
          const region = districtHouseRegionV226(packet.origin[0] + pos[v * 3] / 100, packet.origin[2] + pos[v * 3 + 2] / 100);
          newlyChanged ||= region >= 5;
          if (family === "drawn") regions[region].drawnPanes++; else regions[region].nativePanes++;
        }
      }
    }
    if (processingMs > maxMs) { maxMs = processingMs; maxPacket = `${descriptor.id}/${family}`; maxVertices = count; }
    if (newlyChanged && count > (largestNew?.vertices ?? 0)) largestNew = { id: descriptor.id, family, url: asset.url, vertices: count };
  }
}
const counts = regions.map(region => ({ ...region, drawnOwners: region.drawnOwners.size, nativeOwners: region.nativeOwners.size }));
const previous = JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/district-houses-v225-audit.json", import.meta.url), "utf8"));
if (JSON.stringify(counts.slice(0, 5)) !== JSON.stringify(previous.regions)) throw new Error("A frozen v225 region result changed");
const previousInputs = new Map(previous.inputs.map((input: { id: string; family: string; sha256: string }) => [`${input.id}/${input.family}`, input.sha256]));
for (const [key, sha] of previousInputs) if (!inputs.some(input => `${input.id}/${input.family}` === key && input.sha256 === sha)) throw new Error(`Previous input changed: ${key}`);
if (!largestNew) throw new Error("No actual new-area colour changes");
const benchmarkPacket = JSON.parse(gunzipSync(readFileSync(new URL(largestNew.url, directory))).toString()) as SurroundingCityChunk;
function sample(prior: boolean): { elapsed: number; maxSlice: number } {
  const started = performance.now(), packet = benchmarkPacket;
  const steps = surroundingColourOwners(packet.nav.buildings, packet.nav.groundY, packet.origin[1], packet.origin[0], packet.origin[2], prior ? districtHouseOwnerV225 : undefined);
  let maxSlice = 0;
  for (;;) { const before = performance.now(), next = steps.next(); maxSlice = Math.max(maxSlice, performance.now() - before); if (next.done) break; }
  return { elapsed: performance.now() - started, maxSlice };
}
for (let i = 0; i < 10; i++) { sample(true); sample(false); }
const before = [], after = []; let worstSlice = 0;
for (let i = 0; i < 30; i++) { before.push(sample(true).elapsed); const current = sample(false); after.push(current.elapsed); worstSlice = Math.max(worstSlice, current.maxSlice); }
const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
const result = { schemaVersion: 1, policy: "Immutable original packets; actual generic source-corner roof colour cells and exact existing pane recipes only. No source packet or geometry changes.",
  regions: counts, previousAudit: "district-houses-v225-audit.json", previousRegionsExact: true, previousInputHashesExact: previous.inputs.length,
  packets, maxPacket, maxVertices, maxColourWorkMs: maxMs, totalOwnerWorkMs: ownerMs, totalPaneWorkMs: paneMs,
  benchmark: { ...largestNew, sourceParts: benchmarkPacket.nav.buildings.length, warmedPasses: 30, beforeMedianMs: median(before), afterMedianMs: median(after), worstAfterSliceMs: worstSlice },
  inputs: inputs.filter(input => !previousInputs.has(`${input.id}/${input.family}`)) };
writeFileSync(new URL("../../../geo_data/regierungsviertel/district-houses-v226-audit.json", import.meta.url), JSON.stringify(result) + "\n");
console.log(JSON.stringify({ ...result, inputs: undefined }, null, 2));
