import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import edges from "../src/data/mainStreetEdgesV254.json";
import signals from "../src/data/mainStreetSignalsV254.json";
import retained from "../src/data/altMitteTransportV206.json";
import street from "../public/mesh/regierungsviertel/street-details.json";
import { prepareMainStreetEdgesV254, type MainStreetEdgesSourceV254 } from "../src/MainStreetEdgesV254";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { altMitteSignalPayloadV206, withAltMitteTrafficV206 } from "../src/AltMitteTransportV206";
import { createTrafficSignals, type StreetDetailsPayload } from "../src/TrafficSignals";

const root = path.resolve(import.meta.dir, "../../..");
const evidence = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,
  "geo_data/regierungsviertel/main-streets-v254-evidence.json.gz"))).toString());
const source = edges as MainStreetEdgesSourceV254;
function fixture(key: string): SurroundingCityChunk {
  const bytes = fs.readFileSync(path.join(root, evidence.packets[key].url));
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(evidence.packets[key].sha256);
  return JSON.parse(zlib.gunzipSync(bytes).toString());
}
function finish<T>(iterator: Generator<void, T>): T {
  let result = iterator.next();
  while (!result.done) result = iterator.next();
  return result.value;
}

describe("bounded source-supported main streets v254", () => {
  test("all real edge packets decode with complete old geometry, navigation and lines", () => {
    expect(source.ids).toHaveLength(32);
    expect(source.ids.filter(k => k.startsWith("drawn:"))).toHaveLength(17);
    expect(source.ids.filter(k => k.startsWith("minecraft:"))).toHaveLength(15);
    for (const key of source.ids) {
      const [family, id] = key.split(":"), native = family === "minecraft";
      const before = fixture(key), snapshot = JSON.stringify(before);
      const after = finish(prepareMainStreetEdgesV254(before, id, native));
      expect(after.meshes.length).toBe(before.meshes.length + 1);
      expect(after.meshes.slice(0, -1)).toEqual(before.meshes);
      expect(after.meshes.at(-1)).toBe(source.packets[key].mesh);
      expect(after.nav).toBe(before.nav);
      expect(after.lines).toBe(before.lines);
      expect(JSON.stringify(before)).toBe(snapshot);
      expect(finish(prepareMainStreetEdgesV254(after, id, native))).toBe(after);
      const built = finish(buildSurroundingCityChunk(after, id, native));
      expect(built.geometryBytes).toBeLessThan(12 * 1024 * 1024);
      expect(built.root.userData.sourceKinds).toContain("main-street-edges-v254");
      expect(built.root.userData.nativeMinecraft).toBe(native);
      disposeSurroundingCityRoot(built.root);
    }
  }, 60_000);

  test("ground/origin drift, unrelated identity, wrong family and cancellation fail closed", () => {
    const descriptor = Object.getOwnPropertyDescriptor(source, "packets")!;
    const key = source.ids[0], [family, id] = key.split(":"), native = family === "minecraft";
    const before = fixture(key);
    Object.defineProperty(source, "packets", { configurable: true,
      get() { throw new Error("unrelated packet touched packed data"); } });
    try { expect(finish(prepareMainStreetEdgesV254(before, "unrelated", native))).toBe(before); }
    finally { Object.defineProperty(source, "packets", descriptor); }
    for (const mutation of ["origin", "groundY", "ring"] as const) {
      const changed = structuredClone(before);
      if (mutation === "origin") changed.origin[0] += 1;
      else if (mutation === "groundY") changed.nav.groundY += .01;
      else changed.nav.ground[0].ring[0][0] += .01;
      expect(finish(prepareMainStreetEdgesV254(changed, id, native))).toBe(changed);
    }
    const onlyThisFamily = { ...source, packets: { [key]: source.packets[key] } };
    expect(finish(prepareMainStreetEdgesV254(before, id, !native, onlyThisFamily))).toBe(before);
    const snapshot = JSON.stringify(before), iterator = prepareMainStreetEdgesV254(before, id, native);
    expect(iterator.next().done).toBe(false);
    iterator.return(before);
    expect(iterator.next().done).toBe(true);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  test("native edge triangles remain independently orthogonal", () => {
    let vertical = 0, horizontal = 0;
    for (const key of source.ids.filter(k => k.startsWith("minecraft:"))) {
      const mesh = source.packets[key].mesh;
      const p = Buffer.from(mesh.positions, "base64"), indices = Buffer.from(mesh.indices, "base64");
      for (let offset = 0; offset < indices.length; offset += 12) {
        const tri = [0, 4, 8].map(j => indices.readUInt32LE(offset + j));
        const fixed = [0, 1, 2].filter(axis => tri.every(index =>
          p.readUInt16LE(index * 6 + axis * 2) === p.readUInt16LE(tri[0] * 6 + axis * 2)));
        expect(fixed.length).toBeGreaterThan(0);
        if (fixed.includes(1)) horizontal++; else vertical++;
      }
    }
    expect(horizontal).toBeGreaterThan(100);
    expect(vertical).toBeGreaterThan(100);
  });

  test("signals merge exactly once by source identity while every older placement survives", () => {
    const original = street as unknown as StreetDetailsPayload, snapshot = JSON.stringify(original);
    const payload = altMitteSignalPayloadV206(), merged = withAltMitteTrafficV206(original);
    const added = new Set(signals.signals.map(s => s.osm_key));
    expect(added.size).toBe(28);
    expect(retained.signals.every(s => !added.has(s.osm_key))).toBe(true);
    expect(original.traffic_signal_placements!.every(s => !added.has(s.osm_key))).toBe(true);
    expect(payload.traffic_signal_placements).toHaveLength(retained.signals.length + added.size);
    expect(merged.traffic_signal_placements).toHaveLength(1496 + added.size);
    expect(new Set(merged.traffic_signal_placements!.map(s => s.osm_key)).size)
      .toBe(merged.traffic_signal_placements!.length);
    expect(merged.traffic_signals_dm.slice(0, original.traffic_signals_dm.length)).toEqual(original.traffic_signals_dm);
    const scoped = new Map(payload.traffic_signal_placements!.map(s => [s.osm_key, s]));
    for (const old of retained.signals) {
      const next = scoped.get(old.osm_key)!;
      expect(next.position_dm).toEqual(old.position_dm);
      expect(next.source_dm).toEqual(old.source_dm);
      expect(next.heading_rad).toBe(old.heading_rad);
    }
    for (const addedSignal of signals.signals) expect(scoped.get(addedSignal.osm_key)).toEqual(addedSignal);
    expect(withAltMitteTrafficV206(merged)).toEqual(merged);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  test("actual new signals retain grounded positions and an orthogonal native reading", () => {
    const selected = altMitteSignalPayloadV206();
    const keys = new Set(signals.signals.map(s => s.osm_key));
    selected.traffic_signal_placements = selected.traffic_signal_placements!.filter(s => keys.has(s.osm_key));
    selected.traffic_signals_dm = selected.traffic_signal_placements.map(s => s.source_dm);
    // Distinct sentinel heights verify family selection even where the real
    // pavement heights happen to agree for both representations.
    selected.traffic_signal_placements[0] = { ...selected.traffic_signal_placements[0],
      ground_y_m: 4.25, native_ground_y_m: 6.75 };
    for (const native of [false, true]) {
      const built = createTrafficSignals(selected, null, { native })!;
      const poles = built.getObjectByName("traffic signal poles") as InstancedMesh;
      const heads = built.getObjectByName("traffic signal heads") as InstancedMesh;
      const hoods = built.getObjectByName("traffic signal visor hoods v206") as InstancedMesh;
      expect(poles.count).toBe(28);
      expect(heads.count).toBe(28);
      expect(hoods.count).toBe(28 * 5);
      expect(built.children).toHaveLength(4);
      expect(built.userData.sourceDm).toEqual(selected.traffic_signals_dm);
      const matrix = new Matrix4();
      for (const [index, signal] of selected.traffic_signal_placements.entries()) {
        poles.getMatrixAt(index, matrix);
        const ground = native ? signal.native_ground_y_m! : signal.ground_y_m!;
        expect(matrix.elements[12]).toBeCloseTo(signal.position_dm[0] / 10, 3);
        expect(matrix.elements[14]).toBeCloseTo(signal.position_dm[1] / 10, 3);
        expect(matrix.elements[13]).toBeCloseTo(ground + 1.8, 5);
        heads.getMatrixAt(index, matrix);
        const heading = native ? Math.round(signal.heading_rad! / (Math.PI / 2)) * Math.PI / 2 : signal.heading_rad!;
        expect(matrix.elements[0]).toBeCloseTo(Math.cos(heading), 6);
        expect(matrix.elements[8]).toBeCloseTo(Math.sin(heading), 6);
        if (native) for (const axis of [0, 2, 8, 10])
          expect(matrix.elements[axis]).toBeCloseTo(Math.round(matrix.elements[axis]), 6);
      }
      built.traverse(object => {
        const mesh = object as InstancedMesh;
        if (mesh.geometry) mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material?.dispose();
        if (mesh.isInstancedMesh) mesh.dispose();
      });
    }
  });

  test("every signal base meets the final prepared pavement independently in both families", () => {
    const directory = path.join(root, "src/app/public/mesh/surrounding-berlin-v159");
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
    const byPacket = Map.groupBy(signals.signals, signal =>
      `${Math.floor(signal.position_dm[0] / 5120)}_${Math.floor(signal.position_dm[1] / 5120)}`);
    for (const [id, placements] of byPacket) {
      const entry = manifest.chunks.find((chunk: { id: string }) => chunk.id === id);
      expect(entry).toBeDefined();
      for (const native of [false, true]) {
        const packet = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(directory,
          entry[native ? "minecraft" : "drawn"].url))).toString());
        const built = finish(buildSurroundingCityChunk(packet, id, native));
        built.root.updateMatrixWorld(true);
        for (const signal of placements) {
          const ground = native ? signal.native_ground_y_m : signal.ground_y_m;
          const ray = new Raycaster(new Vector3(signal.position_dm[0] / 10,
            ground + .5, signal.position_dm[1] / 10), new Vector3(0, -1, 0), 0, 1);
          // Ink lines have a raycasting tolerance and cannot support a pole.
          const hits = ray.intersectObject(built.root, true).filter(hit => (hit.object as Mesh).isMesh);
          expect(hits.length).toBeGreaterThan(0);
          expect(hits[0].point.y).toBeCloseTo(ground, 2);
        }
        disposeSurroundingCityRoot(built.root);
      }
    }
  }, 60_000);
});
