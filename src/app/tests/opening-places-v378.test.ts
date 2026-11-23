import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { Mesh, PerspectiveCamera, Scene } from "three";
import { createSurroundingCity, type SurroundingCityManifest } from "../src/SurroundingCity";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import { createOpeningCastleV378, createWestLakesV194 } from "../src/WestLakesV194";

const cityFiles = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
const castleId = "tegel-landscape-schloss--13_-17";
const squareIds = ["ring182-6_7","ring182-7_6","ring182-6_6"];
const cases = [
  { name: "Schloss Tegel", position: [-6206,25,-8567], target: [-6251,9,-8624],
    fov: 43, ids: [castleId], meshName: "Vermessene Landschaft v378 · schloss" },
  { name: "Hermannplatz", position: [3576,82,3710], target: [3541,3,3610],
    fov: 51, ids: squareIds, meshName: "Hermannplatz setts, survey mosaics and Neukölln traffic islands" },
];

for (const native of [false,true]) {
  test("the opening castle transfers to a reserved west lake group without recooking its geometry, native="+native, () => {
    const scene = new Scene();
    const castle = createOpeningCastleV378(native);
    const first = castle.children.filter((part): part is Mesh => part instanceof Mesh).map(mesh => mesh.geometry);
    scene.add(castle);
    const lakes = createWestLakesV194(native, true);
    expect(lakes.userData.reservedCastleV378).toBe(true);
    expect(lakes.children.filter(o => o.userData.siteKey === "schloss-tegel")).toHaveLength(0);
    scene.add(lakes);
    lakes.add(castle);
    expect(castle.parent).toBe(lakes);
    expect(scene.children).toEqual([lakes]);
    expect(first.length).toBeGreaterThan(0);
    for (const mesh of castle.children) if (mesh instanceof Mesh) expect(first).toContain(mesh.geometry);
    expect(lakes.children.filter(o => o.userData.siteKey === "schloss-tegel")).toEqual([castle]);
    disposeSurroundingCityRoot(lakes);
  });
  for (const place of cases) test("the streaming controller admits visible source geometry at "+place.name+", native="+native, async () => {
    const camera = new PerspectiveCamera(place.fov, 1.54, .1, 36000);
    camera.position.set(...place.position as [number,number,number]);
    camera.lookAt(...place.target as [number,number,number]);
    const full: SurroundingCityManifest = JSON.parse(await readFile(new URL("manifest.json",cityFiles),"utf8"));
    const manifest = {...full, chunks:full.chunks.filter(row => squareIds.includes(row.id))};
    let admit!: (id: string) => void;
    let fail!: (error: Error) => void;
    const admission = new Promise<string>((resolve,reject) => { admit=resolve; fail=reject; });
    const issues: string[] = [];
    const published: string[] = [];
    const city = createSurroundingCity({ camera, mode:native?"minecraft":"day", berlinDetailsV378:true,
      manifestUrl:new URL("https://example.test/manifest.json"),
      fetch:(async(input) => {
        const name = new URL(String(input)).pathname.slice(1);
        if (name === "manifest.json") return Response.json(manifest);
        return new Response(await readFile(new URL(name,cityFiles)));
      }) as typeof fetch,
      openingPlaceV378:{ x:place.target[0],z:place.target[2], required:place.ids, meshName:place.meshName,
        pending:()=>true, onGeometry:admit },
      onAttach: root => published.push(root.name),
      onError: message=>{issues.push(message); fail(new Error(message));},
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await city.ready;
      const id = await Promise.race([admission,new Promise<never>((_,reject)=>{
        timer=setTimeout(()=>reject(new Error("No source surface: "+published.join(", "))),10000);
      })]);
      expect(place.ids).toContain(id);
      expect(city.root.getObjectByName(place.meshName)).toBeDefined();
      expect(issues).toHaveLength(0);
    } finally {
      clearTimeout(timer); city.dispose();
    }
  },15000);
}
