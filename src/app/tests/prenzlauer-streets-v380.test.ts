import {expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {Group, InstancedMesh, Matrix4, Mesh, Vector3} from "three";
import {attachPrenzlauerStreetsV380} from "../src/prenzlauerStreetsV380";
import {prenzlauerStreetsIdsV380} from "../src/prenzlauerStreetsIndexV380";
import {prenzlauerStreetsViewsV380} from "../src/prenzlauerStreetsViewsV380";
import type {SurroundingChunkGeometry} from "../src/SurroundingCityGeometry";

const source = JSON.parse(gunzipSync(readFileSync(new URL(
  "../../../geo_data/regierungsviertel/prenzlauer-streets-v380-source.json.gz", import.meta.url))).toString());
type Tree = [string,string,number,number,number,number,number];
function entry(tx: number, tz: number): SurroundingChunkGeometry {
  const origin: [number,number,number] = [tx*512,-10,tz*512];
  const root = new Group();
  root.position.fromArray(origin);
  return {root,origin,geometryBytes:0,bufferCount:0,nav:{groundY:3,buildings:[],ground:[],water:[]}};
}

test("both normal street families attach every unique source tree at its own survey stem", async () => {
  expect(source.trees).toHaveLength(202);
  expect(prenzlauerStreetsIdsV380.size).toBe(5);
  for (const native of [false,true]) {
    let total = 0;
    for (const id of prenzlauerStreetsIdsV380) {
      const [tx,tz] = id.split("_").map(Number), chunk = entry(tx,tz);
      await attachPrenzlauerStreetsV380(chunk,id,native);
      chunk.root.updateMatrixWorld(true);
      const trees:Tree[] = source.trees.filter((t:Tree) => Math.floor(t[5]/512)===tx && Math.floor(t[6]/512)===tz);
      const wood = chunk.root.getObjectByName("Katasterstämme und Äste") as InstancedMesh|undefined;
      const expected = trees.length;
      expect(wood?.count ?? 0).toBe(expected * (native ? 1 : 4));
      let i = 0;
      for (const [,,,,,x,z] of trees) {
        const m = new Matrix4(); wood!.getMatrixAt(i*(native ? 1 : 4),m);
        const stem = new Vector3().setFromMatrixPosition(m).applyMatrix4(wood!.matrixWorld);
        expect(stem.x).toBeCloseTo(x,2);
        expect(stem.z).toBeCloseTo(z,2);
        i++;
      }
      const surface = chunk.root.getObjectByName(
        "Kastanienallee und Oderberger Straße – Straßenbefahrung, Gleise und historische Fronten") as Mesh;
      const positions = surface.geometry.getAttribute("position"), index = surface.geometry.index!;
      expect(index.count % 3).toBe(0);
      expect(Math.max(...index.array.subarray(0,100))).toBeLessThan(positions.count);
      for (const n of index.array) if (n >= positions.count) throw Error("Dangling surface triangle");
      expect(surface.geometry.getAttribute("jointSize").count).toBe(positions.count);
      expect(chunk.geometryBytes).toBeGreaterThan(0);
      expect(chunk.bufferCount).toBeGreaterThan(3);
      total += expected;
    }
    expect(total).toBe(202);
  }
});

test("street survey retains both end junctions, tram gauge and four approach cameras", () => {
  expect(new Set(source.axes.map((r:[number,string])=>r[1]))).toEqual(new Set(["Oderberger Straße","Kastanienallee"]));
  expect(source.layers.cm_fahrbahn).toHaveLength(57);
  expect(source.layers.cl_gehweg).toHaveLength(478);
  expect(source.layers.bd_bordstein).toHaveLength(365);
  expect(source.cycleRoutes).toHaveLength(25);
  expect(source.rails.every((r:[number,number])=>r[1]===1435)).toBe(true);
  expect(Object.keys(prenzlauerStreetsViewsV380)).toEqual(["Kastanienallee","Oderberger Straße","Lichtblick-Kino","Berliner Prater"]);
});

test("cancellation creates no street objects before publication", async () => {
  const controller = new AbortController(), chunk = entry(4,-4);
  controller.abort();
  await expect(attachPrenzlauerStreetsV380(chunk,"4_-4",false,controller.signal)).rejects.toThrow();
  expect(chunk.root.children).toHaveLength(0);
  expect(chunk.geometryBytes).toBe(0);
});
