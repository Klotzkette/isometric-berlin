import { expect, test } from "bun:test";
import { createExpandedCityDetails, type ExpandedLandmark } from "../src/ExpandedCityDetails";
import scene from "../public/mesh/regierungsviertel/scene.json";
import receipt from "./fixtures/nationalgalerie-v221-obsolete-archer.json";
import { geometryPreservationV206 } from "./helpers/geometryPreservationV206";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";
import { createTiergartenMonuments } from "../src/TiergartenMonuments";
import type { StreetDetailsPayload } from "../src/TrafficSignals";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import streetData from "../public/mesh/regierungsviertel/street-details.json";
import groundData from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import { withExpandedRetentionV281 } from "./helpers/expandedRetentionV281";
import { withTiergartenBeforeLaterChangesV281 } from "./helpers/tiergartenV281Replay";

for (const detailProfile of ["full", "mobile"] as const) test(`${detailProfile}: replacing the obsolete Archer preserves every other expanded-city byte`, () => {
  expect(receipt.releasedBase).toBe("d7b7a3a7a452fc330950f2cfbc5034e441c59915");
  const landmarks = scene.landmarks as ExpandedLandmark[];
  expect(landmarks.filter(landmark => landmark.name === receipt.removedLandmark.name)).toEqual([receipt.removedLandmark]);
  // Live construction receives the full shipped catalogue, including Archer.
  // Only the independently captured obsolete torus contribution may disappear.
  const root = createExpandedCityDetails(landmarks, { detailProfile });
  try {
    const before = receipt.profiles[detailProfile].complete;
    const expected = receipt.profiles[detailProfile].withoutExactObsoleteArcher;
    withExpandedRetentionV281(root, "expanded", () => {
    const records = geometryPreservationV206(root);
    expect(staticGeometryAudit(root)).toEqual(expected.static);
    expect(records).toHaveLength(expected.objects);
    expect(new Bun.CryptoHasher("sha256").update(JSON.stringify(records)).digest("hex"))
      .toBe(expected.allRecordsSha256);
    expect(before.objects).toBe(expected.objects);
    expect(before.static.budget.draws).toBe(expected.static.budget.draws);
    expect(before.static.budget.instances).toBe(expected.static.budget.instances);
    expect(before.static.budget.bytes - expected.static.budget.bytes).toBe(12_975);
    expect(before.static.budget.vertices - expected.static.budget.vertices).toBe(641);
    });
  } finally { disposeStaticAudit(root); }
});

test("both exact OSM artworks leave the generic monument pass while all unrelated geometry remains byte-identical", () => {
  const street = streetData as unknown as StreetDetailsPayload, ground = groundData as unknown as VoxelPayload;
  const keys = receipt.tiergarten.removedKeys;
  const owned = street.monuments!.filter(entry => keys.includes(entry.osm_key));
  expect(owned).toEqual(receipt.tiergarten.removedEntries);
  expect(owned).toHaveLength(2);
  for (const entry of owned) {
    expect(createTiergartenMonuments({ ...street, monuments: [entry] }, ground)).toBeNull();
    // Suppression follows source identity, never a broad place/name filter.
    const neighbour = createTiergartenMonuments({ ...street, monuments: [{ ...entry, osm_key: "node/unrelated-v221-control" }] }, ground);
    expect(neighbour).not.toBeNull();
    disposeStaticAudit(neighbour!);
  }
  const root = createTiergartenMonuments(street, ground)!;
  try {
    withTiergartenBeforeLaterChangesV281(root, street, ground, () => {
    const expected = receipt.tiergarten.withoutExactObsoleteProxies;
    const records = geometryPreservationV206(root);
    expect(staticGeometryAudit(root)).toEqual(expected.static);
    expect(records).toHaveLength(expected.objects);
    expect(new Bun.CryptoHasher("sha256").update(JSON.stringify(records)).digest("hex"))
      .toBe(expected.allRecordsSha256);
    expect(root.userData.externallyModelledSourceKeys).toEqual(expected.externallyModelledSourceKeys);
    expect(expected.static.budget.draws).toBe(receipt.tiergarten.complete.static.budget.draws);
    expect(expected.objects).toBe(receipt.tiergarten.complete.objects);
    });
  } finally { disposeStaticAudit(root); }
});
