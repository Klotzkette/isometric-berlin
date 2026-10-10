import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { createCentralCivicDetails } from "../src/CentralCivicDetails";
import { createIsometricCityCore, CHARITE_BETTENHOCHHAUS_IDS, CHARITE_CAMPUS_BRIDGE_ID, type PrismPayload } from "../src/IsometricCityWorld";
import { staticGeometryAudit, disposeStaticAudit } from "./helpers/staticGeometryAudit";
import receipt from "./fixtures/civic-charite-v206-preservation-v207.json";

const baseline = receipt.baseline;
const payloadPath = new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url);
const scenePath = new URL("../public/mesh/regierungsviertel/scene.json", import.meta.url);
const payload = await Bun.file(payloadPath).json() as PrismPayload;
const scene = await Bun.file(scenePath).json();
const sha = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const selected = payload.buildings.filter(p => baseline.chariteIds.includes(p.id));
const audit = (root: ReturnType<typeof createIsometricCityCore>) => {
  try { return staticGeometryAudit(root); }
  finally { disposeStaticAudit(root); }
};

test("v207 owner inventory starts from unchanged immutable v106 source records", async () => {
  expect(baseline.commit).toBe("6bd9693555e6ffb4350375c3fda49cb586c69614");
  expect([...CHARITE_BETTENHOCHHAUS_IDS].sort()).toEqual(baseline.chariteIds);
  expect(selected).toHaveLength(16);
  expect(sha(JSON.stringify(selected))).toBe(baseline.chariteSourceSha256);
  expect(CHARITE_CAMPUS_BRIDGE_ID).toBe(baseline.bridgeId);
  for (const [path, url] of [
    ["src/app/public/mesh/regierungsviertel/lod2-prisms.json", payloadPath],
    ["src/app/public/mesh/regierungsviertel/scene.json", scenePath],
  ] as const) expect(sha(new Uint8Array(await Bun.file(url).arrayBuffer())))
    .toBe(baseline.sourceSha256[path]);
});

for (const profile of ["full", "mobile"] as const) {
  test(`${profile}: historical civic recipe and exact non-ministry complement stay byte-identical`, () => {
    expect(audit(createCentralCivicDetails(scene.landmarks, profile)))
      .toEqual(baseline.civic[profile].complete);
    const retained = scene.landmarks.filter((p: { name: string }) => p.name !== baseline.ministryName);
    // The education ministry remains present: the first local block is the only
    // authorized ministry replacement, never the complete shared function.
    expect(retained.some((p: { name: string }) => p.name === baseline.educationName)).toBeTrue();
    expect(audit(createCentralCivicDetails(retained, profile)))
      .toEqual(baseline.civic[profile].retainedWithoutMinistry);
    expect(audit(createCentralCivicDetails(scene.landmarks, profile, {
      includeLegacyResearchMinistry: false,
    }))).toEqual(baseline.civic[profile].retainedWithoutMinistry);
  });

  test(`${profile}: every original Charité owner and the separate bridge remain independently reproducible`, () => {
    const core = (buildings: PrismPayload["buildings"]) => audit(createIsometricCityCore(
      { ...payload, buildings }, null, null, null, { detailProfile: profile },
    ));
    expect(core(selected)).toEqual(baseline.charite[profile].complete);
    for (const owner of selected) expect(core([owner]))
      .toEqual(baseline.charite[profile].byOwner[owner.id as keyof typeof baseline.charite.full.byOwner]);
    expect(core(payload.buildings.filter(p => p.id === CHARITE_CAMPUS_BRIDGE_ID)))
      .toEqual(baseline.charite[profile].bridge);
    expect(core(selected.map(p => ({ ...p, id: `v207-control-${p.id}` }))))
      .toEqual(baseline.charite[profile].foreignIdsSameGeometry);
  });

  test(`${profile}: production facade opt-out keeps every exact source body and cannot spread to another owner`, () => {
    const core = (buildings: PrismPayload["buildings"]) => audit(createIsometricCityCore(
      { ...payload, buildings }, null, null, null,
      { detailProfile: profile, includeLegacyChariteFacade: false },
    ));
    const retained = receipt.retainedChariteWithoutInferredFacade[profile];
    expect(core(selected)).toEqual(retained.complete);
    for (const owner of selected) expect(core([owner]))
      .toEqual(retained.byOwner[owner.id as keyof typeof retained.byOwner]);
    expect(core(payload.buildings.filter(p => p.id === CHARITE_CAMPUS_BRIDGE_ID)))
      .toEqual(baseline.charite[profile].bridge);
    expect(core(selected.map(p => ({ ...p, id: `v207-control-${p.id}` }))))
      .toEqual(baseline.charite[profile].foreignIdsSameGeometry);
  });
}
