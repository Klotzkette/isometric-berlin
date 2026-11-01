import { describe, expect, test } from "bun:test";
import { Group, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createArchitecturalSignature, type HauptbahnhofModelSignature } from "../src/ArchitecturalLandmarks";
import { createMinecraftArchitecturalLandmarks } from "../src/MinecraftArchitecturalLandmarks";
import { createHbfInteriorV291 } from "../src/HbfInteriorV291";
import { HBF_CIRCULATION_V291, hbfLocalToWorldV291 } from "../src/HbfCirculationV291";

const scene = await Bun.file(new URL("../public/mesh/regierungsviertel/scene.json", import.meta.url)).json() as { architectural_signatures: HauptbahnhofModelSignature[] };
const signature = scene.architectural_signatures.find(s => s.kind === "hauptbahnhof_model")!;

/** Check actual complete fixture geometry, independently of navigation's
 * analytic floor/solid predicates. Moving caps sit below the sole; all shell,
 * deck, glass, shop and guard surfaces participate in these body-height rays. */
describe("whole Hauptbahnhof circulation geometry v291", () => {
  for (const native of [false, true]) test(`${native ? "native" : "drawn"}: each connected flight has real body clearance`, () => {
    const root = new Group();
    if (native) {
      const architecture = createMinecraftArchitecturalLandmarks();
      const station = architecture.getObjectByName("Minecraft Berlin Hauptbahnhof block signature") as InstancedMesh;
      expect(station.count).toBeLessThanOrEqual(5500);
      root.add(station, createHbfInteriorV291({ native: true, ...HBF_CIRCULATION_V291.frame }));
    } else root.add(createArchitecturalSignature(signature)!);
    root.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    root.traverse(o => { if (o instanceof Mesh) meshes.push(o); });
    const blockers: {flight:string;t:number;name:string;instance?:number;distance:number}[] = [];
    for (const f of HBF_CIRCULATION_V291.flights) for (let i = 1; i < 24; i++) {
      const t = i / 24;
      const p = f.from.map((v,j) => v + (f.to[j] - v) * t) as [number,number,number];
      p[1] += .26;
      const ray = new Raycaster(new Vector3(...hbfLocalToWorldV291(p)), new Vector3(0,1,0), 0, 1.65);
      const hits = ray.intersectObjects(meshes, false);
      for (const hit of hits) blockers.push({ flight:f.id,t,name:hit.object.name,instance:hit.instanceId,distance:hit.distance });
    }
    expect(blockers.slice(0,30)).toEqual([]);
  }, 60_000);
});
