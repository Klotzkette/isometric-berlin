import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Raycaster, Scene, Vector3, Mesh } from "three";
import { bridgeClusters } from "../src/IsometricCityWorld";
import {
  prepareLandwehrClustersV378,
  coreCrossingsV378,
} from "../src/waterwayReplacementV378";
import {
  createWaterwaysV378,
  type WaterwayPacketV378,
} from "../src/waterwaysV378";
import {
  registerLandwehrFloorsV378,
  landwehrDeckFloorV378,
} from "../src/waterwayFloorsV378";
import { crossingProfileV378 } from "../src/waterwayBridgeGeometryV378";
import { waterwayViewsV378 } from "../src/waterwayViewsV378";
import type { VoxelPayload } from "../src/terrainPayload";
const base = new URL("../src/data/waterwaysV378/", import.meta.url);
const lookup = new Map<string, WaterwayPacketV378>();
for (const file of readdirSync(base)) {
  const rows = JSON.parse(readFileSync(new URL(file, base), "utf8")) as Record<
    string,
    WaterwayPacketV378
  >;
  for (const [host, packet] of Object.entries(rows)) lookup.set(host, packet);
}
const spans = [
  ...coreCrossingsV378,
  ...[...lookup.values()].flatMap((p) => p.bridges),
];
const byId = (id: string) => spans.find((r) => r.id === id)!;
const core = new URL(
  "../public/mesh/regierungsviertel/ground-context.json",
  import.meta.url,
);
const ground = JSON.parse(readFileSync(core, "utf8")) as VoxelPayload;
const source = JSON.parse(
  gunzipSync(
    readFileSync(
      new URL(
        "../../../geo_data/regierungsviertel/landwehr-crossing-survey-v378.json.gz",
        import.meta.url,
      ),
    ),
  ).toString(),
);
const empty = () =>
  ({ lines: [], gates: [], core: [], bridges: [] }) as WaterwayPacketV378;

describe("Berlin shore corridor and Landwehrkanal", () => {
  test("complete station list, side arms, both pipe spans and independent lock passages", () => {
    expect(spans.length).toBe(41);
    expect(new Set(spans.map((r) => r.id)).size).toBe(41);
    expect(spans.filter((r) => r.openings.length).length).toBe(37);
    expect(spans.filter((r) => r.role === "utility").length).toBe(2);
    expect(source.lockWorks).toHaveLength(5);
    expect(byId("w659058363").openings.length).toBe(2);
    expect(byId("w659050176").form).toBe("open-arch");
    expect(byId("w659050176").lamps).toHaveLength(6);
    expect(byId("w549205856").form).toBe("frame");
    expect(Object.keys(waterwayViewsV378)).toHaveLength(46);
  });
  test("core replaces only exact memberships and keeps individual approach cells", () => {
    const clusters = bridgeClusters(ground),
      result = prepareLandwehrClustersV378(ground, clusters);
    expect(result.root?.userData.waterwaysV378.length).toBe(30);
    const oldCount = clusters.reduce((n, c) => n + c.length, 0),
      remaining = result.clusters.reduce((n, c) => n + c.length, 0);
    expect(remaining).toBeGreaterThan(0);
    expect(oldCount - remaining).toBeGreaterThan(650);
    const altered = { ...ground, cell_m: ground.cell_m + 1 };
    expect(prepareLandwehrClustersV378(altered, clusters)).toEqual({
      clusters,
      root: null,
    });
    const missing = prepareLandwehrClustersV378(
      ground,
      clusters.map((c) => c.slice(1)).filter((c) => c.length),
    );
    expect(missing.root).toBeNull();
  });
  test("both styles leave a physically open channel through every measured WSA gauge", () => {
    for (const native of [false, true]) {
      for (const r of spans) {
        const root = createWaterwaysV378(
          { ...empty(), bridges: [r] },
          "water378-0_0",
          native,
        );
        root.updateMatrixWorld(true);
        expect(root.children.length).toBe(1);
        for (const [mid, width, left, centre, right] of r.openings) {
          for (const [s, h] of [
            [mid, centre],
            [mid - width * 0.499, left],
            [mid + width * 0.499, right],
          ]) {
            const x = r.center[0] + r.course[0] * s,
              z = r.center[1] + r.course[1] * s;
            const hits = new Raycaster(
              new Vector3(x, -1.15, z),
              new Vector3(0, 1, 0),
            ).intersectObject(root, true);
            expect(hits[0]?.distance).toBeGreaterThan(h - 0.04);
            expect(hits[0]?.distance).toBeLessThan(h + 0.07);
          }
        }
      }
    }
  });
  test("resident walking follows real decks, excludes track and service pipes and retires on removal", () => {
    const scene = new Scene(),
      bridge = byId("w659050176"),
      pipe = byId("w1109709649"),
      rail = byId("w725780505");
    const packet = { ...empty(), bridges: [bridge, pipe, rail] };
    const root = createWaterwaysV378(packet, "water378-0_0", false);
    const [x, z] = bridge.center;
    const top = crossingProfileV378(bridge, false).top(0);
    registerLandwehrFloorsV378(root, packet.bridges, false);
    expect(landwehrDeckFloorV378(x, z)).toBeNull();
    scene.add(root);
    expect(landwehrDeckFloorV378(x, z)).toBeCloseTo(top, 3);
    for (const r of [pipe, rail])
      expect(landwehrDeckFloorV378(r.center[0], r.center[1])).toBeNull();
    expect(landwehrDeckFloorV378(x, z, true)).toBeNull();
    scene.remove(root);
    expect(landwehrDeckFloorV378(x, z)).toBeNull();
    scene.add(root);
    (root.children[0] as Mesh).geometry.dispose();
    expect(landwehrDeckFloorV378(x, z)).toBeNull();
  });
  test("individual shoreline entries have bounded draw submissions, coordinates and GPU memory", () => {
    for (const [host, packet] of lookup) {
      for (const native of [false, true]) {
        const root = createWaterwaysV378(packet, host, native);
        expect(root.children.length).toBeLessThanOrEqual(2);
        let bytes = 0;
        for (const part of root.children as Mesh[]) {
          expect(Number.isFinite(part.geometry.boundingSphere?.radius)).toBe(
            true,
          );
          for (const attribute of Object.values(part.geometry.attributes))
            bytes += attribute.array.byteLength;
          bytes += part.geometry.index?.array.byteLength ?? 0;
        }
        expect(bytes).toBeLessThan(1024 ** 2);
      }
    }
  });
});
