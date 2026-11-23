import { expect, test } from "bun:test";
import { Group, Mesh } from "three";
import { attachRetailV378 } from "../src/retailV378";
import { retailHostsV378, retailViewsV378 } from "../src/retailV378Index";
import type { SurroundingChunkGeometry } from "../src/SurroundingCityGeometry";

function entry(): SurroundingChunkGeometry {
  return {
    root: new Group(),
    origin: [310, 0, -200],
    geometryBytes: 0,
    bufferCount: 0,
    nav: {
      ground: [],
      roads: [],
      water: [],
      buildings: [],
      bridges: [],
      groundY: 3,
    },
  };
}

test("every qualified shop has finite visible geometry, registered index bounds, and a searchable entrance view in each style", async () => {
  expect(retailHostsV378).toHaveLength(47);
  expect(
    Object.keys(retailViewsV378).filter((n) => n.startsWith("IKEA Berlin-")),
  ).toHaveLength(4);
  expect(
    Object.keys(retailViewsV378).filter((n) =>
      n.startsWith("IKEA Planungsstudio"),
    ),
  ).toHaveLength(3);
  for (const host of retailHostsV378) {
    for (const native of [false, true]) {
      const e = entry();
      await attachRetailV378(e, host.id, native, new AbortController().signal);
      expect(e.root.userData.retailSiteV378).toBe(host.id);
      expect(e.geometryBytes).toBeGreaterThan(0);
      let count = 0;
      e.root.traverse((obj) => {
        if (obj instanceof Mesh) {
          count++;
          expect(obj.geometry.index.count).toBeGreaterThan(0);
          expect(Number.isFinite(obj.geometry.boundingSphere.radius)).toBe(
            true,
          );
          expect(obj.userData.keepInMinecraft).toBe(true);
        }
      });
      expect(count).toBe(1);
    }
  }
  for (const view of Object.values(retailViewsV378)) {
    expect(
      view.position.every(Number.isFinite) &&
        view.target.every(Number.isFinite),
    ).toBe(true);
    expect(view.fov).toBeGreaterThan(10);
  }
});

test("new IKEA warehouses have surveyed shell, ground and collision; the two v377 warehouses keep their previous bodies", async () => {
  for (const [source, area, vertexLimit] of [
    ["89793912", 29325, 4500],
    ["23492662", 16344, 400],
  ] as const) {
    const e = entry();
    await attachRetailV378(
      e,
      "retail-v378-way-" + source,
      false,
      new AbortController().signal,
    );
    const building = e.nav.buildings.find(
      (b) => b.sourceId === "retail-v378:way/" + source,
    )!;
    const planar =
      Math.abs(
        building.ring.reduce((sum, a, i) => {
          const b = building.ring[(i + 1) % building.ring.length];
          return sum + a[0] * b[1] - b[0] * a[1];
        }, 0),
      ) / 2;
    expect(Math.abs(planar - area)).toBeLessThan(1);
    expect(e.nav.ground.length).toBeGreaterThan(0);
    expect(e.nav.roads?.length).toBeGreaterThan(0);
    expect(e.geometryBytes).toBeGreaterThan(vertexLimit);
    const worldX = building.ring[0][0] + e.origin[0];
    expect(worldX).toBeGreaterThan(9000);
  }
  for (const source of ["23490165", "23492513"]) {
    const e = entry();
    await attachRetailV378(
      e,
      "retail-v378-way-" + source,
      false,
      new AbortController().signal,
    );
    expect(e.nav.buildings).toHaveLength(0);
    expect(e.nav.ground.length).toBeGreaterThan(0);
  }
});

test("cancelled requests do not attach partial furniture, collision or material state", async () => {
  const e = entry(),
    abort = new AbortController();
  abort.abort();
  await expect(
    attachRetailV378(e, retailHostsV378[0].id, false, abort.signal),
  ).rejects.toThrow();
  expect(e.geometryBytes).toBe(0);
  expect(e.root.children).toHaveLength(0);
});

test("existing central LoD2 bodies do not receive a second retail shell", async () => {
  for (const id of [
    "retail-v378-node-422779946",
    "retail-v378-node-2476789173",
    "retail-v378-way-1088827579",
  ]) {
    for (const native of [false, true]) {
      const e = entry();
      await attachRetailV378(e, id, native, new AbortController().signal);
      expect(e.root.userData.retailSiteV378).toBe(id);
      expect(e.nav.buildings).toHaveLength(0);
    }
  }
});
