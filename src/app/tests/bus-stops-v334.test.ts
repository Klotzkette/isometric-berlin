import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { InstancedMesh, Matrix4, PerspectiveCamera } from "three";
import { buildBusStopMastV334, createBusStopsV334, parseBusStopsV334 } from "../src/BusStopsV334";
import receipt from "../src/data/busStopsV334Receipt.json";
import evidence from "../../../geo_data/regierungsviertel/bus-stops-v334-evidence.json";

const packed = readFileSync(new URL(`../public/mesh/regierungsviertel/${receipt.file}`, import.meta.url));
const index = parseBusStopsV334(gunzipSync(packed));

describe("VBB Berlin bus platforms and low-distance representative signs", () => {
  test("keeps every supported source identity and all cross-operator bus berth locations", () => {
    expect(packed.byteLength).toBe(receipt.packedBytes);
    expect(createHash("sha256").update(packed).digest("hex")).toBe(receipt.sha256);
    expect(evidence.product).toEqual(receipt);
    expect(evidence.bvgUndisturbedNetworkPoints).toBe(6456);
    expect(evidence.gtfs.retainedFootprint).toBe(2783);
    const stops = Object.values(index.cells).flat();
    expect(stops.length).toBe(6327);
    expect(stops.filter(row => row[5]).length).toBe(32);
    expect(new Set(stops.map(row => row[0])).size).toBe(stops.length);
    expect(stops.find(row => row[0] === "de:11000:900056104::4")?.slice(2, 4)).toEqual([-655.71, 2363.3]);
    expect(stops.filter(row => index.names[row[1]] === "Berlin, Schmöckwitzwerder")).toHaveLength(2);
    expect(stops.filter(row => index.names[row[1]] === "U Hausvogteiplatz (Berlin)")).toHaveLength(0);
  });

  test("Native masts are cardinal and both sides show the same sign colors", () => {
    const drawn = buildBusStopMastV334(false), native = buildBusStopMastV334(true);
    for (const geometry of [drawn, native]) {
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.min.y).toBeCloseTo(0, 5);
      expect(geometry.boundingBox!.max.y).toBeLessThan(3);
      expect(geometry.boundingBox!.min.z).toBeCloseTo(-geometry.boundingBox!.max.z, 6);
      expect(geometry.attributes.color.count).toBe(geometry.attributes.position.count);
    }
    const normal = native.attributes.normal;
    for (let i = 0; i < normal.count; i++) {
      expect(Math.abs(normal.getX(i)) + Math.abs(normal.getY(i)) + Math.abs(normal.getZ(i))).toBe(1);
    }
    drawn.dispose();
    native.dispose();
  });

  test("bounded positions mount only on dry retained free terrain and update on mode or residency change", () => {
    const layer = createBusStopsV334({
      cellMeters: 220,
      names: ["Fixture"],
      cells: { "0_0": [
        ["free", 0, 8, 10, "", 0],
        ["duplicate", 0, 8, 10, "", 0],
        ["water", 0, 13, 10, "", 0],
        ["blocked", 0, 21, 10, "", 0],
        ["absent", 0, 32, 10, "", 0],
        ["replacement", 0, 42, 10, "", 1],
      ], "50_50": [["far", 0, 11000, 11000, "", 0]] },
    });
    const pool = layer.root.children[0] as InstancedMesh;
    const camera = new PerspectiveCamera(30, 1, .1, 1000);
    camera.position.set(15, 10, 90);
    camera.lookAt(10, 2, 10);
    camera.updateMatrixWorld();
    const groundRequests = new Set<number>();
    const support = {
      ground: (x: number) => { groundRequests.add(x); return x === 32 ? null : 4.5; },
      water: (x: number) => x === 13,
      blocked: (x: number) => x === 21,
    };
    expect(layer.refresh(0, camera, 15, 10, false, false, "de", 0, support)).toBe(true);
    expect([...groundRequests].sort()).toEqual([13, 21, 32, 8]);
    expect(pool.count).toBe(1);
    const matrix = new Matrix4();
    pool.getMatrixAt(0, matrix);
    expect(matrix.elements.slice(12, 15)).toEqual([8, 4.5, 10]);
    const drawn = pool.geometry;
    expect(layer.refresh(300, camera, 15, 10, false, false, "de", 0, support)).toBe(false);
    expect(layer.refresh(600, camera, 15, 10, true, false, "de", 1, support)).toBe(true);
    expect(pool.geometry).not.toBe(drawn);
    expect(pool.count).toBe(1);
    expect(layer.refresh(900, camera, 15, 10, true, false, "de", 2, { ...support, ground: () => null })).toBe(true);
    expect(pool.count).toBe(0);
    layer.dispose();
    expect(layer.root.children).toHaveLength(0);
  });
});
