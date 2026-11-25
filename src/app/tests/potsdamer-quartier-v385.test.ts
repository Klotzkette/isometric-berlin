import { expect, test } from "bun:test";
import { Group, Mesh } from "three";
import { berlinRegionLoaderV380 } from "../src/berlinRegionsV380";
import { berlinPlaceViewsV378 } from "../src/berlinPlaceViewsV378";
import { openingSiteOwnerV379 } from "../src/openingSiteOwnerV379";
import { potsdamerPlatzViewsV385 } from "../src/potsdamerPlatzViewsV385";
import { potsdamerWallBoxesV385, potsdamerWallExhibitsV385 } from "../src/potsdamerWallExhibitsV385";
import { findSightBySlug, sightSlug } from "../src/viewNavigation";
import { loadBerlinPlaceViewsV378, startupFlightView, startupFlightCamera } from "../src/startupView";
import type { SurroundingChunkGeometry } from "../src/SurroundingCityGeometry";

const district = (): SurroundingChunkGeometry => ({
  root: new Group(), origin: [0, 0, 512], nav: { ground: [], buildings: [], water: [], groundY: 5 },
  bufferCount: 0, geometryBytes: 0,
});
test.each([false, true])("the live district adds its Potsdamer details once and accounts for their geometry, native=%s", async native => {
  const load = (await berlinRegionLoaderV380("0_1")!());
  const entry = district(), signal = new AbortController().signal;
  await Promise.all([load(entry, "0_1", native, signal), load(entry, "0_1", native, signal)]);
  expect(entry.root.children).toHaveLength(1);
  const group = entry.root.getObjectByName("Potsdamer und Leipziger Platz")!;
  expect(group.children).toHaveLength(native ? 5 : 2);
  for (const part of group.children) {
    let count = 0;
    part.traverse(o => { if (o instanceof Mesh) count++; });
    expect(count).toBeGreaterThan(0);
  }
  expect(entry.geometryBytes).toBeGreaterThan(0);
  const bytes = entry.geometryBytes;
  await load(entry, "0_1", native, signal);
  expect(entry.geometryBytes).toBe(bytes);
  const secondary = district();
  await load(secondary, "0_2", native, signal);
  expect(secondary.root.children).toHaveLength(native ? 1 : 0);
  const cancelled = district(), controller = new AbortController();
  const pending = load(cancelled, "0_1", native, controller.signal);
  controller.abort();
  await expect(pending).rejects.toThrow();
  expect(cancelled.geometryBytes).toBe(0);
  expect(cancelled.root.children).toHaveLength(0);
});
test("all ten public links use their canonical views and wait for the correct resident district", () => {
  const sights = Object.keys(berlinPlaceViewsV378).map(name => ({name}));
  expect(Object.keys(potsdamerPlatzViewsV385)).toHaveLength(10);
  for (const [name, view] of Object.entries(potsdamerPlatzViewsV385)) {
    expect(berlinPlaceViewsV378[name]).toBe(view);
    expect(findSightBySlug(sights, sightSlug(name))?.name).toBe(name);
    const host = openingSiteOwnerV379(name, view.target[0], view.target[2]);
    expect(host.waitForAll).toBe(true);
    expect(host.required).toEqual(["Potsdamer Platz","Ritz-Carlton am Potsdamer Platz","Mauersegmente am Potsdamer Platz",
      "Kanadische Botschaft am Leipziger Platz","Taylor Wessing an der Ebertstraße","Telekom – Magenta Mitte"].includes(name) ? ["0_1"] : []);
  }
});
test("native public links frame the three street facades around the existing voxel tree crowns", async () => {
  await loadBerlinPlaceViewsV378();
  for (const [name, view] of Object.entries(potsdamerPlatzViewsV385)) {
    for (const native of [false, true]) {
      const wanted = native && view.native ? view.native : view;
      expect(startupFlightView(name, native)).toEqual({ landmarkName: name, fov: wanted.fov,
        pose: { position: wanted.position, target: wanted.target } });
      expect(startupFlightCamera(name, native).target_world).toEqual(wanted.target);
    }
  }
});
test("the station exhibit and the two relocated pairs have ten original wall slabs", () => {
  const areas = potsdamerWallExhibitsV385.map(site => potsdamerWallBoxesV385(site));
  expect(areas.map(boxes => boxes.filter(([, , , , , h]) => h === 3.60).length)).toEqual([6,2,2]);
  expect(areas.map(boxes => boxes.filter(([colour]) => colour === 0x696b67).length)).toEqual([5,0,0]);
});
