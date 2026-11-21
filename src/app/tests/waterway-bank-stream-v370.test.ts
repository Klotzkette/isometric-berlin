import { expect, test } from "bun:test";
import { Group, Mesh, OrthographicCamera } from "three";
import { createSurroundingCity } from "../src/SurroundingCity";
import type { SurroundingChunkGeometry } from "../src/SurroundingCityGeometry";
import { attachWaterwayBanksV370 } from "../src/WaterwayBankPacketV370";
import directory from "../src/data/waterwayBankHostsV370.json";
import central from "../src/data/waterwayBanksV370Central.json";

function host(): SurroundingChunkGeometry {
  return { root: new Group(), origin: [3072, -10, 512], geometryBytes: 0, bufferCount: 0,
    nav: { groundY: 3, ground: [], water: [], buildings: [] } };
}

test("the five surveyed Spree faces attach once in packet coordinates in either family", async () => {
  for (const native of [false, true]) {
    const entry = host();
    await attachWaterwayBanksV370(entry, "6_1", native, new AbortController().signal);
    expect(entry.root.children[0].position.toArray()).toEqual([-3072, 10, -512]);
    const ids = new Set<string>();
    entry.root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      expect(object.userData.blockNative).toBe(native);
      object.userData.bankIds.forEach((id: string) => ids.add(id));
    });
    expect([...ids].sort()).toEqual(["1", "3", "4a", "4b", "5"].map(i => "spree-rungestrasse-" + i));
    expect(entry.geometryBytes).toBeGreaterThan(0);
    expect(entry.bufferCount).toBeGreaterThan(0);
  }
  const abandoned = host();
  await expect(attachWaterwayBanksV370(abandoned, "6_1", false, AbortSignal.abort())).rejects.toThrow();
  expect(abandoned.root.children.length).toBe(0);
});

test("the Humboldthafen banks stream across a style change without adding navigation surfaces", async () => {
  const index = central.records.findIndex(r => r.id === "humboldthafen-west-hafenhals");
  const owner = Object.entries(directory.sections).find(([, value]) => 'Central' in value && value.Central.includes(index))![0];
  const [x0, z0, x1, z1] = directory.bounds[owner as keyof typeof directory.bounds];
  const x = (x0+x1)/2, z = (z0+z1)/2;
  const camera = new OrthographicCamera(-70, 70, 70, -70, .5, 400);
  camera.position.set(x, 90, z);
  camera.up.set(0, 0, -1);
  camera.lookAt(x, 0, z);
  const requests: string[] = [];
  const city = createSurroundingCity({ camera, mode: "day", waterwayBanksV370: true,
    manifestUrl: new URL("https://water.test/manifest.json"),
    fetch: (async input => {
      requests.push(String(input));
      return new Response(JSON.stringify({ schemaVersion: 1, groundY: 3, footprint: [], chunks: [] }));
    }) as typeof fetch,
  });
  async function waitForWall(native: boolean): Promise<Mesh> {
    for (let i=0; i<600; i++) {
      let found: Mesh | undefined;
      city.root.traverse(object => {
        if (object instanceof Mesh && object.userData.blockNative === native &&
            object.userData.bankIds?.includes("humboldthafen-west-hafenhals")) found = object;
      });
      if (found && !city.pending) return found;
      await Bun.sleep(10);
    }
    throw Error("Humboldthafen bank did not become resident");
  }
  try {
    await city.ready;
    const wall = await waitForWall(false);
    let released = false;
    wall.geometry.addEventListener("dispose", () => { released = true; });
    city.setMode("minecraft");
    await waitForWall(true);
    expect(released).toBe(true);
    expect(requests).toEqual(["https://water.test/manifest.json"]);
    expect(city.navigationTiles).toHaveLength(0);
  } finally {
    city.dispose();
  }
}, 20000);
