import { describe, expect, test } from "bun:test";
import { Mesh, MeshBasicMaterial } from "three";
import { altMittePaintHeightV206, altMitteSignalPayloadV206, altMitteTransportGroundV206,
  createAltMitteTransportV206, withAltMitteTrafficV206 } from "../src/AltMitteTransportV206";
import street from "../public/mesh/regierungsviertel/street-details.json";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import { smoothGroundTopSampler, type VoxelPayload, worldGroundSampler } from "../src/MinecraftVoxelWorld";
import type { StreetDetailsPayload } from "../src/TrafficSignals";
import { terrainGroundAt } from "../src/weinbergTerrainV176";

describe("Alt-Mitte source-tagged transport v206", () => {
  test("merges by stable identity and retains original arrays and unrelated placements", () => {
    const original = street as unknown as StreetDetailsPayload;
    const snapshot = JSON.stringify(original);
    const merged = withAltMitteTrafficV206(original);
    const scoped = altMitteSignalPayloadV206();
    expect(scoped.traffic_signal_placements).toHaveLength(430);
    expect(merged.traffic_signal_placements).toHaveLength(1496);
    expect(merged.traffic_signals_dm.slice(0, 1328)).toEqual(original.traffic_signals_dm);
    expect(JSON.stringify(original)).toBe(snapshot);
    const keys = new Set(scoped.traffic_signal_placements!.map(p => p.osm_key));
    for (let i = 0; i < 1328; i++) {
      const old = original.traffic_signal_placements![i];
      const next = merged.traffic_signal_placements![i];
      if (!keys.has(old.osm_key)) expect(next).toBe(old);
      expect(next.position_dm).toEqual(old.position_dm);
      expect(next.source_dm).toEqual(old.source_dm);
    }
    expect(withAltMitteTrafficV206(merged)).toEqual(merged);
  });

  test("uses actual core grade and the same outer Weinberg field in both representations", () => {
    const payload = ground as unknown as VoxelPayload;
    const smooth = smoothGroundTopSampler(payload);
    const block = worldGroundSampler(payload);
    // Friedrichstraße core and Rosenthaler Straße / Weinberg outer coverage.
    const x = 1190, z = -400;
    expect(altMitteTransportGroundV206(x, z)).toBeCloseTo(smooth(x / ground.cell_m - ground.grid.min_x_idx, z / ground.cell_m - ground.grid.min_z_idx), 8);
    expect(altMitteTransportGroundV206(x, z, true)).toBe(block(x, z)!);
    for (const native of [false, true]) {
      expect(altMitteTransportGroundV206(2200, -1500, native)).toBe(terrainGroundAt(2200, -1500, 3, native));
      expect(altMitteTransportGroundV206(2200, -1500, native)).toBeGreaterThan(3);
    }
    for (const signal of altMitteSignalPayloadV206().traffic_signal_placements!) {
      expect(Number.isFinite(signal.ground_y_m!)).toBeTrue();
      expect(Number.isFinite(signal.native_ground_y_m!)).toBeTrue();
      expect(signal.refined_v206).toBeTrue();
    }
  });

  for (const native of [false, true]) test(`bounded indexed ${native ? "native" : "drawn"} paint retains every cell and terrain contact`, () => {
    const root = createAltMitteTransportV206(native);
    expect(root.children).toHaveLength(49);
    expect(root.matrixAutoUpdate).toBeFalse();
    let bytes = 0, vertices = 0;
    for (const object of root.children) {
      expect(object).toBeInstanceOf(Mesh);
      const mesh = object as Mesh;
      expect(mesh.matrixAutoUpdate).toBeFalse();
      expect(mesh.frustumCulled).toBeTrue();
      expect(mesh.userData.dayMaterial).toBeInstanceOf(MeshBasicMaterial);
      expect(mesh.userData.dayMaterial.map).toBeNull();
      const geometry = mesh.geometry, p = geometry.getAttribute("position");
      vertices += p.count;
      bytes += Object.values(geometry.attributes).reduce((n, a) => n + a.array.byteLength, 0) + geometry.index!.array.byteLength;
      expect(geometry.boundingSphere!.radius).toBeLessThan(420);
      for (let i = 0; i < p.count; i += 4) {
        if (native) {
          expect(p.getZ(i)).toBe(p.getZ(i + 1));
          expect(p.getX(i + 1)).toBe(p.getX(i + 2));
          expect(p.getY(i)).toBe(p.getY(i + 3));
        } else {
          for (let j = 0; j < 4; j++) expect(p.getY(i+j)).toBeCloseTo(altMittePaintHeightV206(p.getX(i+j), p.getZ(i+j)), 3);
        }
      }
    }
    expect(vertices).toBe(native ? 118248 : 66180);
    expect(bytes).toBeLessThan(native ? 2_200_000 : 1_200_000);
  });
});
