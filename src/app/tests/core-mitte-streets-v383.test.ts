import {expect, test} from "bun:test";
import {readFileSync, statSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {Group, Mesh, Raycaster, Vector3} from "three";
import {attachCoreMitteStreetsV383, createCoreMitteStreetsV383} from "../src/coreMitteStreetsV383";
import {coreMitteStreetsHostsV383 as hosts} from "../src/coreMitteStreetsIndexV383";
import type {SurroundingChunkGeometry} from "../src/SurroundingCityGeometry";

const packetPath = (id: string) => new URL("../src/data/coreMitteStreetsV383/" +
  id.slice("mitte383-street-".length) + ".json", import.meta.url);

test("the seven district packets keep surveyed raised, lowered and flush kerbs in both models", () => {
  const source = JSON.parse(gunzipSync(readFileSync(new URL(
    "../../../geo_data/regierungsviertel/core-mitte-streets-v383-source.json.gz", import.meta.url))).toString());
  const official = new Map(source.layers.bd_bordstein.map(([id, tags]: [string, {bor: number}]) => [id,tags.bor]));
  const samples = [
    ["bd_bordstein.465701",1,850.90,775.07,5.69], // Wilhelmstraße / Anton-Wilhelm-Amo-Straße
    ["bd_bordstein.466138",1,1394.23,477.26,5.69], // edge of the Gendarmenmarkt
    ["bd_bordstein.466305",1,1239.66,576.90,5.69], // Friedrichstadt
    ["bd_bordstein.232105",1,1648.28,657.74,5.69], // Hausvogteiplatz
    ["bd_bordstein.246452",1,1824.83,421.56,5.69], // Werderscher Markt
    ["bd_bordstein.217772",2,1524.23,753.39,5.58],
    ["bd_bordstein.217773",2,1674.90,741.71,5.58],
    ["bd_bordstein.216915",3,1777.65,525.83,5.57],
    ["bd_bordstein.216916",3,1842.15,673.68,5.57],
  ] as const;
  expect(hosts).toHaveLength(7);
  expect(hosts.reduce((bytes, host) => bytes + statSync(packetPath(host.id)).size, 0)).toBeLessThan(510_000);
  for (const native of [false, true]) {
    const groups = hosts.map(({id}) => createCoreMitteStreetsV383(JSON.parse(readFileSync(packetPath(id), "utf8")), native));
    const ray = new Raycaster(new Vector3(), new Vector3(0,-1,0));
    function hit(x: number, z: number) {
      ray.ray.origin.set(x, 20, z);
      return ray.intersectObjects(groups)[0];
    }
    for (const [id, code, x, z, height] of samples) {
      expect(official.get(id)).toBe(code);
      expect(hit(x,z)?.point.y).toBeCloseTo(height, 2);
    }
    for (const [x,z,y] of [[855.2,773.83,5.56],[846.12,774.39,5.67],[843.29,752.68,5.63],
      [886.31,816.75,5.62],[1405.83,470.23,5.56],[1647.25,662.37,5.56],[1654.28,655.71,5.67]]) {
      expect(hit(x,z)?.point.y).toBeCloseTo(y,2);
    }
    // South/west/north/east palace and two separately mapped fine-gravel parts of the boulevard.
    for (const [x,z,finish] of [[2102.13,288.73,.91],[1934.77,265.4,.91],[1989.54,155.94,.91],
      [2133.65,194.44,.91],[1120.94,245.34,1],[769.35,272.72,1],[1688.29,699.27,.16]]) {
      const location=hit(x,z);
      const mesh=location.object as Mesh;
      expect(mesh.geometry.getAttribute("jointSize").getX(location.face!.a)).toBeCloseTo(finish,2);
    }
    // Existing Hausvogteiplatz stairs, inner Gendarmenmarkt and the palace building.
    for (const [x,z] of [[1698,673.62],[1408,622],[2040,250]]) expect(hit(x,z)).toBeUndefined();
  }
});

test("aborted street arrivals leave a clean entry and the next arrival owns exactly one surface", async () => {
  const entry = {origin: [1024,0,512], root: new Group(), geometryBytes: 0, bufferCount: 0} as SurroundingChunkGeometry;
  const id = "mitte383-street-2_1";
  await expect(attachCoreMitteStreetsV383(entry,id,false,AbortSignal.abort())).rejects.toThrow();
  expect(entry.root.children).toHaveLength(0);
  await attachCoreMitteStreetsV383(entry,id,false);
  expect(entry.root.children).toHaveLength(1);
  expect(entry.geometryBytes).toBeGreaterThan(100_000);
  expect(entry.bufferCount).toBe(5);
});
