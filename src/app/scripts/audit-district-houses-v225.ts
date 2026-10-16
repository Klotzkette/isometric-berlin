/** Read-only Step 10 audit. No city factory, build, packet rewrite or new geometry. */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Color } from "three";
import { DISTRICT_HOUSE_REGIONS_V225, DISTRICT_HOUSE_ROOF_V225, districtHouseRegionV225, shadeDistrictHousePanesV225 } from "../src/districtHousePresentationV225";
import { surroundingColourOwners } from "../src/surroundingCityColourV184";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const directory = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", directory), "utf8"));
const roof = new Color(0x9d978c).toArray().map(value => Math.round(value * 255));
const regions = DISTRICT_HOUSE_REGIONS_V225.map(region => ({ name: region.name, drawnOwners: new Set<string>(), nativeOwners: new Set<string>(), drawnRoofVertices: 0, nativeRoofVertices: 0, drawnPanes: 0, nativePanes: 0, example: "" }));
let packets = 0, maxMs = 0, maxPacket = "", maxVertices = 0, ownerMs = 0, paneMs = 0;
const inputs: { id: string; family: string; sha256: string }[] = [];
for (const descriptor of manifest.chunks) {
  const [x0, z0, x1, z1] = descriptor.bounds;
  if (!DISTRICT_HOUSE_REGIONS_V225.some(region => x0 <= region.bounds[2] && x1 >= region.bounds[0] && z0 <= region.bounds[3] && z1 >= region.bounds[1])) continue;
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
    let processingMs = performance.now() - started, count = 0;
    for (const part of packet.meshes) {
      if (!["city", "district-facades-v188", "kiez-facades-v209"].includes(part.kind)) continue;
      const pos = Uint16Array.from(new Uint16Array(Uint8Array.from(Buffer.from(part.positions, "base64")).buffer));
      const colors = Buffer.from(part.colors, "base64"); count += pos.length / 3;
      if (part.kind === "city") {
        for (let at = 0; at < pos.length; at += 3) {
          if (colors[at] !== roof[0] || colors[at + 1] !== roof[1] || colors[at + 2] !== roof[2]) continue;
          const owner = owners.get(pos[at] * 65536 + pos[at + 2]);
          if (owner?.palette.roof !== DISTRICT_HOUSE_ROOF_V225) continue;
          const region = districtHouseRegionV225(packet.origin[0] + pos[at] / 100, packet.origin[2] + pos[at + 2] / 100);
          if (region < 0) throw new Error("Outside roof correction");
          const item = regions[region]; item.example ||= descriptor.id;
          if (family === "drawn") { item.drawnOwners.add(owner.sourceId); item.drawnRoofVertices++; }
          else { item.nativeOwners.add(owner.sourceId); item.nativeRoofVertices++; }
        }
      } else {
        const values = new Uint16Array(pos.length * 2);
        for (let at = 0; at < pos.length; at += 3) for (let c = 0; c < 3; c++) { values[at * 2 + c] = pos[at + c]; values[at * 2 + c + 3] = colors[at + c] * 257; }
        const indices = new Uint32Array(Uint8Array.from(Buffer.from(part.indices, "base64")).buffer);
        const before = performance.now(), shading = shadeDistrictHousePanesV225(part.kind, values, indices, 0, indices.length, packet.origin[0], packet.origin[2], family === "minecraft");
        while (!shading.next().done) {} const elapsed = performance.now() - before; paneMs += elapsed; processingMs += elapsed;
        for (let v = 0; v < pos.length / 3; v += 4) {
          if (values[v * 6 + 3] === colors[v * 3] * 257) continue;
          const region = districtHouseRegionV225(packet.origin[0] + pos[v * 3] / 100, packet.origin[2] + pos[v * 3 + 2] / 100);
          if (family === "drawn") regions[region].drawnPanes++; else regions[region].nativePanes++;
        }
      }
    }
    if (processingMs > maxMs) { maxMs = processingMs; maxPacket = `${descriptor.id}/${family}`; maxVertices = count; }
  }
}
const result = { schemaVersion: 1, policy: "Immutable original packets; actual generic source-corner roof colour cells and exact existing pane recipes only. No source packet or geometry changes.",
  regions: regions.map(region => ({ ...region, drawnOwners: region.drawnOwners.size, nativeOwners: region.nativeOwners.size })),
  packets, maxPacket, maxVertices, maxColourWorkMs: maxMs, totalOwnerWorkMs: ownerMs, totalPaneWorkMs: paneMs, inputs };
writeFileSync(new URL("../../../geo_data/regierungsviertel/district-houses-v225-audit.json", import.meta.url), JSON.stringify(result) + "\n");
console.log(JSON.stringify({ ...result, inputs: undefined }, null, 2));
