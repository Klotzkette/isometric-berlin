import { expect, test } from "bun:test";
import { Group, Mesh, InstancedMesh, PerspectiveCamera, Vector3 } from "three";
import { createRailStationsV190 } from "../src/RailStationsV190";
import { attachTransportRingStationsV378 } from "../src/transportV378Ring";
import { attachTransportV378 } from "../src/transportV378";
import {
  hasTransportV378,
  transportExteriorHasGroundV378,
  transportExteriorTilesV378,
} from "../src/transportV378Index";
import { TRANSPORT_AIRPORT_TILES_V378 } from "../src/transportV378Airports";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import { surroundingPolygonContains, type SurroundingChunkGeometry } from "../src/SurroundingCityGeometry";
import { transportViewsV378 } from "../src/transportViewsV378";

const empty = (): SurroundingChunkGeometry => ({
  root: new Group(),
  geometryBytes: 0,
  bufferCount: 0,
  origin: [0, 0, 0],
  nav: { groundY: 0, ground: [], water: [], buildings: [] },
});

test("each local road/rail packet builds on both production paths, keeps support inside its ribbon and retires normally", async () => {
  expect(transportExteriorTilesV378.length).toBeGreaterThan(120);
  for (const id of TRANSPORT_AIRPORT_TILES_V378) expect(hasTransportV378(id)).toBe(true);
  expect(hasTransportV378("wrong-tile")).toBe(false);
  const signal = new AbortController().signal;
  for (const native of [false, true]) {
    let meshes = 0,
      maxBytes = 0,
      all = 0,
      grounds = 0;
    for (const { id, bounds } of transportExteriorTilesV378) {
      const entry = empty();
      await attachTransportV378(entry, id, native, signal);
      if (!entry.root.children.length) continue; // A few physical paint matches exist in a single model family.
      expect(entry.root.userData.transportV378).toBe(true);
      const first = entry.geometryBytes;
      await attachTransportV378(entry, id, native, signal);
      expect(entry.geometryBytes).toBe(first);
      expect(entry.bufferCount).toBeGreaterThan(0);
      all += first;
      maxBytes = Math.max(first, maxBytes);
      entry.root.updateMatrixWorld(true);
      entry.root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        meshes++;
        const p = object.geometry.getAttribute("position");
        expect(p.count).toBeGreaterThan(0);
        for (const i of [0, Math.floor(p.count / 2), p.count - 1]) {
          const v = new Vector3().fromBufferAttribute(p, i).applyMatrix4(object.matrixWorld);
          expect(v.x).toBeGreaterThanOrEqual(bounds[0] - 0.01);
          expect(v.x).toBeLessThanOrEqual(bounds[2] + 0.01);
          expect(v.z).toBeGreaterThanOrEqual(bounds[1] - 0.01);
          expect(v.z).toBeLessThanOrEqual(bounds[3] + 0.01);
        }
      });
      if (entry.nav.ground.length) {
        grounds++;
        expect(transportExteriorHasGroundV378(id)).toBe(true);
        const ring = entry.nav.ground[0].ring,
          mid = ring.reduce((p, v) => [p[0] + v[0] / ring.length, p[1] + v[1] / ring.length], [0, 0]);
        expect(surroundingPolygonContains(entry.nav.ground[0], mid[0], mid[1])).toBe(true);
        expect(surroundingPolygonContains(entry.nav.ground[0], mid[0] + 800, mid[1] + 800)).toBe(false);
      }
      disposeSurroundingCityRoot(entry.root);
    }
    expect(grounds).toBeGreaterThan(50);
    expect(meshes).toBeGreaterThan(120);
    expect(maxBytes).toBeLessThan(2 * 1024 * 1024);
    console.info(JSON.stringify({ native, meshes, grounds, all, maxBytes }));
  }
}, 30000);

test("the actual BER tower owns the beacon callback; cancelled admission does not publish partial scenery", async () => {
  const controller = new AbortController(),
    id = "ber236-16_34";
  const entry = empty();
  await attachTransportV378(entry, id, false, controller.signal);
  expect(typeof entry.root.userData.updateTransportV378).toBe("function");
  const camera = new PerspectiveCamera(45, 1, 0.1, 3000);
  const pose = transportViewsV378["Flughafen BER – Tower"];
  camera.position.set(...pose.position);
  camera.lookAt(...pose.target);
  camera.updateMatrixWorld();
  const visible = new Set();
  for (let t = 0; t < 3600; t += 110) visible.add(entry.root.userData.updateTransportV378(t, camera, false));
  expect(visible.has(true)).toBe(true);
  disposeSurroundingCityRoot(entry.root);
  controller.abort();
  const cancelled = empty();
  await expect(
    attachTransportV378(cancelled, transportExteriorTilesV378[0].id, false, controller.signal),
  ).rejects.toThrow();
  expect(cancelled.root.children.length).toBe(0);
});

test("the five Ringbahn examples fit their registered local station hosts, reuse the previous batch, and survive re-entry", () => {
  for (const native of [false, true]) {
    const root = createRailStationsV190(native);
    attachTransportRingStationsV378(root, native);
    const buildings = new Map();
    let trainCars = 0,
      total = 0,
      patch = 0,
      draws = 0;
    root.traverse((o) => {
      if (o instanceof InstancedMesh) {
        draws++;
        total += o.count;
        const span = o.userData.transportRingSpanV378;
        if (!span) return;
        expect(span.start + span.count).toBe(o.count);
        expect(span.start).toBeGreaterThan(0);
        patch += span.count;
        if (o.userData.carsV378) {
          trainCars += o.userData.carsV378;
          buildings.set(o.parent!.userData.stationName, o.userData.stationAnchorV378);
        }
      }
    });
    expect([...buildings.keys()].sort()).toEqual(
      ["Gesundbrunnen", "Ostkreuz", "Südkreuz", "Wedding", "Westkreuz"].sort(),
    );
    expect(trainCars).toBe(16);
    expect(total).toBeLessThan(native ? 95000 : 14000);
    attachTransportRingStationsV378(root, native);
    let again = 0;
    root.traverse((o) => {
      if (o instanceof InstancedMesh) again += o.count;
    });
    expect(again).toBe(total);
    console.info(JSON.stringify({ native, patch, draws, total }));
    disposeSurroundingCityRoot(root);
  }
});
