import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh, MeshBasicMaterial, Group, Matrix4 } from "three";
import { createAlexanderStationsV183, createMinecraftAlexanderStationsV183 } from "../src/AlexanderStationsV183";
import source from "../src/data/alexanderStationsV183Source.json";
import nav from "../src/data/alexanderStationsV183Navigation.json";
import { ALEXANDER_STATIONS_V183_OUTER_SOURCE_IDS, alexanderStationsV183SolidAt, alexanderStationsV183SourceColumn } from "../src/alexanderStationsV183Profile";
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import { createSchlossEastOutlines } from "../src/SchlossEastOutlines";

function meshes(root: Group): Mesh[] { const result: Mesh[] = []; root.traverse(o => { if (o instanceof Mesh) result.push(o); }); return result; }
function dispose(root: Group): void { root.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); for (const k of ["dayMaterial", "nightMaterial"]) o.userData[k]?.dispose(); } }); }

describe("v183 Alexander architecture and station hall contracts", () => {
  test("all requested architecture owners are metric sources and replacement is narrowly scoped", () => {
    expect(source.profiles.map(p => p.key)).toEqual(["alexa", "lehrer", "alexanderhaus", "berolinahaus", "jannowitz", "alexanderStation"]);
    expect(ALEXANDER_STATIONS_V183_OUTER_SOURCE_IDS.size).toBe(4);
    expect(ALEXANDER_STATIONS_V183_OUTER_SOURCE_IDS.has("DEBE00YYy600004g")).toBe(false);
    expect(source.profiles.find(p => p.key === "alexanderhaus")!.parts.length).toBe(7);
    expect(nav.friedrichstrasseAnchor).toEqual([1057.6888517069747, 8, -118.71125632151961]);
  });
  test("drawn geometry keeps opaque roofs, transparent glass and open truss members at a bounded budget", () => {
    const a = createAlexanderStationsV183(), m = meshes(a), instances = m.filter(o => o instanceof InstancedMesh) as InstancedMesh[];
    expect(m.length).toBe(7);
    expect(instances.length).toBe(2);
    expect(instances[1].userData.roles).toContain("Alexander-longitudinal-purlin");
    expect(instances[0].count).toBeLessThan(14000);
    const glass = m.find(o => o.userData.glass)!;
    expect((glass.material as MeshBasicMaterial).opacity).toBeLessThan(.2);
    expect((glass.material as MeshBasicMaterial).depthWrite).toBe(false);
    expect(instances[0].userData.roles).toContain("Friedrichstrasse-recessed-Tudor-rib");
    expect(instances[0].userData.roles).toContain("Jannowitz-basilical-monitor-frame");
    expect(instances[0].userData.roles).toContain("Alexanderplatz-round-arch-rib");
    expect(m.every(o => !o.geometry.getAttribute("uv"))).toBe(true);
    const mobile = createAlexanderStationsV183(true);
    expect(mobile.userData.instanceCount).toBe(a.userData.instanceCount);
    console.log("v183 smooth", { draws: m.length, instances: a.userData.instanceCount });
    dispose(a); dispose(mobile);
  });
  test("native uses three orthogonal surface batches with genuine transparent glazing", () => {
    const a = createMinecraftAlexanderStationsV183(), m = meshes(a), matrix = new Matrix4();
    expect(m.length).toBe(3);
    expect(a.userData.instanceCount).toBeLessThan(90000);
    for (const mesh of m as InstancedMesh[]) {
      expect(mesh.userData.blockNative).toBe(true);
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix); const v = matrix.elements;
        expect([v[1], v[2], v[4], v[6], v[8], v[9]].every(n => Math.abs(n) < 1e-7)).toBe(true);
        expect(v.every(Number.isFinite)).toBe(true);
      }
    }
    expect(m.some(o => o.userData.glass && (o.material as MeshBasicMaterial).opacity < .2)).toBe(true);
    console.log("v183 native", { draws: m.length, instances: a.userData.instanceCount }); dispose(a);
  });
  test("station bodies do not create full-footprint pedestrian blockers", () => {
    for (const p of source.profiles.filter(p => ["jannowitz", "alexanderStation"].includes(p.key))) {
      for (const y of [4.6, 14.8, 20]) expect(alexanderStationsV183SolidAt(p.frame.x, y, p.frame.z)).toBe(false);
    }
    const p = source.profiles.find(p => p.key === "lehrer")!;
    expect(alexanderStationsV183SolidAt(p.frame.x, 20, p.frame.z)).toBe(true);
    expect(alexanderStationsV183SolidAt(p.frame.x, 60, p.frame.z)).toBe(false);
  });
  test("replacement masks retain Alexander's station base and reject different-height source owners", () => {
    for (const native of [false, true]) {
      const previous = createSchlossEastOutlines(native, ["stationHall", "stationBase"]);
      expect(previous.userData.profiles).toEqual(["stationBase"]);
      dispose(previous);
    }
    const owner = nav.outerOwners.find(p => p.id === "DEBE01YYK00003SW")!;
    const f = nav.profiles.find(p => p.key === "lehrer")!.frame;
    expect(alexanderStationsV183SourceColumn(f.x, f.z, 3 + owner.minHeight, 3 + owner.nativeHeight)).toBe(true);
    expect(alexanderStationsV183SourceColumn(f.x, f.z, 3 + owner.minHeight, 20 + owner.nativeHeight)).toBe(false);
  });
  test("compiled navigation keeps hall approaches open while platforms and actual piers remain solid", () => {
    const obstacles = compilePedestrianObstacles({ buildings: [] });
    for (const p of nav.profiles.filter(p => ["jannowitz", "alexanderStation"].includes(p.key))) {
      const f = p.frame, alex = p.key === "alexanderStation", half = f.width / 2 - .12;
      const platform = alex ? 13.38 : 10.95, length = f.length - (alex ? .18 : 1.5);
      const point = (u: number, v: number) => [f.x + f.dx * u - f.dz * v, f.z + f.dz * u + f.dx * v];
      for (const end of [-1, 1]) {
        const [x, z] = point(end * (length / 2 + 1.5), 0);
        expect(pedestrianPointIsBlocked(x, z, platform, obstacles)).toBe(false);
      }
      const [px, pz] = point(0, alex ? half * .48 : 0);
      expect(pedestrianPointIsBlocked(px, pz, platform - .5, obstacles)).toBe(true);
      expect(pedestrianPointIsBlocked(px, pz, platform, obstacles)).toBe(false);
      if (!alex) {
        expect(pedestrianPointIsBlocked(f.x, f.z, 3, obstacles)).toBe(false);
        const [x, z] = point(-length / 2 + 8, half - .45);
        expect(pedestrianPointIsBlocked(x, z, 3, obstacles)).toBe(true);
      }
    }
  });
});
