import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Color, Group, Mesh, OrthographicCamera, Raycaster, Vector3 } from "three";
import { createSurroundingCity } from "../src/SurroundingCity";
import { loadSourceQuarterRecipesV309 } from "../src/SourceQuarterCatalogueV309";
import {
  createSouthWestSitesV326, disposeSouthWestSitesV326, hasSouthWestSitesRuntimeV326,
} from "../src/SouthWestSitesV326";
import { createWestLakesV194 } from "../src/WestLakesV194";

const directory = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const probes = [
  { id: "outer187--34_17", x: -17043.47, z: 8998.91, expected: "bbb39a" },
  { id: "outer187--34_18", x: -17224.367, z: 9419.383, expected: "9d9a92" },
];

async function waitFor(check: () => boolean) {
  const end = Date.now() + 20000;
  while (!check() && Date.now() < end) await Bun.sleep(15);
  expect(check()).toBe(true);
}
function firstSurface(world: Group, x: number, z: number) {
  world.updateMatrixWorld(true);
  const hits = new Raycaster(new Vector3(x, 18, z), new Vector3(0, -1, 0))
    .intersectObjects(world.children, true)
    .filter(hit => hit.object instanceof Mesh && hit.face && hit.point.y < 4);
  const hit = hits[0];
  if (!hit?.face) throw Error("No island ground at probe");
  const obj = hit.object as Mesh;
  const color = new Color().fromBufferAttribute(obj.geometry.getAttribute("color"), hit.face.a);
  return { y: hit.point.y, rgb: color.getHexString(), node: obj.name };
}

test("the island path network admits and withdraws path-only streamed tiles with its real V326 owner", async () => {
  const world = new Group();
  const authored = createSouthWestSitesV326(false)!;
  const island = createWestLakesV194(false);
  world.add(island);
  const current = JSON.parse(readFileSync(new URL("manifest.json", directory), "utf8"));
  current.chunks = current.chunks.filter((c: {id: string}) => probes.some(p => p.id === c.id));
  const camera = new OrthographicCamera(-480, 480, 480, -480, 1, 1500);
  camera.position.set(-17134, 180, 9210);
  camera.up.set(0, 0, -1);
  camera.lookAt(-17134, 3, 9210);
  camera.updateMatrixWorld();
  const city = createSurroundingCity({
    camera, mode: "day", manifestUrl: new URL("https://island.test/manifest.json"),
    sourceQuartersV303: true, loadSourceQuarterSourcesV309: loadSourceQuarterRecipesV309,
    southWestSitesV326: native => hasSouthWestSitesRuntimeV326(world, authored, native),
    fetch: (async input => {
      const url = new URL(String(input));
      return url.pathname.endsWith("manifest.json")
        ? new Response(JSON.stringify(current))
        : new Response(readFileSync(new URL(url.pathname.split("/").pop()!, directory)));
    }) as typeof fetch,
  });
  world.add(city.root);
  const streamed = () => city.root.children.filter(tile => tile.userData.sourceKinds?.includes("surveyed-paving-v368")).length;
  try {
    await city.ready;
    await waitFor(() => city.residentChunkCount === 2 && !city.pending);
    expect(streamed()).toBe(0);
    world.add(authored);
    const before = probes.map(p => firstSurface(world, p.x, p.z));
    city.refresh();
    await waitFor(() => city.residentChunkCount === 2 && !city.pending && streamed() === 2);
    const after = probes.map(p => firstSurface(world, p.x, p.z));
    for (let i = 0; i < probes.length; i++) {
      expect(before[i].y).toBeCloseTo(3.12, 3);
      expect(before[i].rgb).toBe("c9bea2");
      expect(after[i].y).toBeCloseTo(3.14, 3);
      expect(after[i].rgb).toBe(probes[i].expected);
    }
    world.remove(authored);
    city.refresh();
    await waitFor(() => city.residentChunkCount === 2 && !city.pending && streamed() === 0);

  } finally {
    city.dispose();
    disposeSouthWestSitesV326(authored);
    world.clear();
  }
}, 30000);
