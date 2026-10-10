import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { createCentralCivicDetails } from "../src/CentralCivicDetails";
import { createGendarmenmarktPerimeterFacades } from "../src/GendarmenmarktPerimeterFacades";
import { createUnterDenLindenDetails } from "../src/UnterDenLindenDetails";
import { createMinecraftUnterDenLindenDetails } from "../src/MinecraftUnterDenLindenDetails";
import { createIsometricCityCore, type PrismPayload } from "../src/IsometricCityWorld";
import { HUNGARIAN_EMBASSY_V208_PROXY_IDS } from "../src/hungarianEmbassyOwnershipV208";
import { staticGeometryAudit, disposeStaticAudit } from "./helpers/staticGeometryAudit";
import receipt from "./fixtures/frontage-preservation-v208.json";

const sceneUrl = new URL("../public/mesh/regierungsviertel/scene.json", import.meta.url);
const scene = await Bun.file(sceneUrl).json();
function audit(root: ReturnType<typeof createCentralCivicDetails>) {
  try { return staticGeometryAudit(root); }
  finally { disposeStaticAudit(root); }
}
test("v208 facade complements are derived from released v107 with the same source scene", async () => {
  expect(receipt.baseline.commit).toBe("edcde0e7d05552d1e8900c9c87e1da9b40e02f76");
  expect(receipt.retained.commit).toBe(receipt.baseline.commit);
  expect(receipt.baseline.complement).toBe(false);
  expect(receipt.retained.complement).toBe(true);
  expect(receipt.retained.sourceSha256).toEqual(receipt.baseline.sourceSha256);
  expect(createHash("sha256").update(new Uint8Array(await Bun.file(sceneUrl).arrayBuffer())).digest("hex"))
    .toBe(receipt.baseline.sourceSha256["src/app/public/mesh/regierungsviertel/scene.json"]);
});
for (const profile of ["full", "mobile"] as const) test(`${profile}: Hungarian replacement keeps every other civic recipe`, () => {
  expect(audit(createCentralCivicDetails(scene.landmarks, profile, { includeLegacyResearchMinistry: false })))
    .toEqual(receipt.baseline.civic[profile]);
  expect(audit(createCentralCivicDetails(scene.landmarks, profile, {
    includeLegacyResearchMinistry: false, includeLegacyHungarianFacade: false,
  }))).toEqual(receipt.retained.civic[profile]);
});
for (const native of [false, true]) test(`${native ? "minecraft" : "day"}: only Quartier206's old decorative family yields`, () => {
  const key = native ? "minecraft" : "day";
  expect(audit(createGendarmenmarktPerimeterFacades(native))).toEqual(receipt.baseline.gendarmenmarkt[key]);
  expect(audit(createGendarmenmarktPerimeterFacades(native, { includeLegacyQuartier206Facade: false })))
    .toEqual(receipt.retained.gendarmenmarkt[key]);
});
test("Aeroflot replacement preserves every other complete Linden facade in both representations", () => {
  expect(audit(createUnterDenLindenDetails())).toEqual(receipt.baseline.linden.day);
  expect(audit(createMinecraftUnterDenLindenDetails())).toEqual(receipt.baseline.linden.minecraft);
  expect(audit(createUnterDenLindenDetails({ includeLegacyAeroflot: false }))).toEqual(receipt.retained.linden.day);
  expect(audit(createMinecraftUnterDenLindenDetails({ includeLegacyAeroflot: false }))).toEqual(receipt.retained.linden.minecraft);
});
test("only six Hungarian extrusions yield; source input and same-place foreign owners stay intact", async () => {
  const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
  const saved = receipt.baseline.hungary;
  expect([...HUNGARIAN_EMBASSY_V208_PROXY_IDS]).toEqual(saved.ids);
  const parts = payload.buildings.filter(b => saved.ids.includes(b.id));
  expect(parts).toHaveLength(6);
  expect(createHash("sha256").update(JSON.stringify(parts)).digest("hex")).toBe(saved.sourceSha256);
  const core = (buildings: PrismPayload["buildings"], includeLegacyHungarianEnvelope = true) => audit(createIsometricCityCore(
    { ...payload, buildings }, null, null, null, { includeContext: false, includeLegacyHungarianEnvelope },
  ));
  expect(core(parts)).toEqual(saved.complete);
  expect(core(parts, false)).toEqual(saved.empty);
  for (const part of parts) {
    expect(core([part])).toEqual(saved.byOwner[part.id as keyof typeof saved.byOwner]);
    expect(core([part], false)).toEqual(saved.empty);
  }
  expect(core(parts.map(p => ({ ...p, id: `v208-control-${p.id}` })), false)).toEqual(saved.foreignIdsSameGeometry);
});


test("the measured Hungarian replacement is required before publishing the drawn city", async () => {
  const viewer = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
  const worker = await Bun.file(new URL("../src/progressiveWorld.worker.ts", import.meta.url)).text();
  expect(viewer).toContain('const northCorridorDetails = import("./NorthCorridorV208")');
  expect(viewer).toContain('zionFrontagesV175Details, northCorridorDetails,');
  expect(viewer).toContain('zionFrontagesV175, northCorridorV208, sitesV209]) =>');
  const replacement = viewer.indexOf('isoWorld.add(northCorridorV208.createHungarianEnvelopeV208())');
  expect(replacement).toBeGreaterThan(viewer.indexOf('provisionalIsoWorld = isoWorld;'));
  expect(replacement).toBeLessThan(viewer.indexOf('yield* compactStaticGeometrySteps(isoWorld)', replacement));
  expect(worker).toContain('includeLegacyHungarianEnvelope: false');
});
