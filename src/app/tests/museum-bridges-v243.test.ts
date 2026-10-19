import { afterAll, describe, expect, test } from "bun:test";
import { Mesh, Raycaster, Vector3 } from "three";
import { bridgeClusters, createBridgeStructures } from "../src/IsometricCityWorld";
import { createCoreSpreeBridgesV242, createCoreSpreeBridgeNavigationV242, setCoreSpreeBridgePresentationV242 } from "../src/CoreSpreeBridgesV242";
import { museumBridgeOwnerV243, museumBridgePacketsV243 } from "../src/MuseumBridgesV243";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import type { VoxelPayload } from "../src/terrainPayload";
import type { VisualMode } from "../src/visualMode";
import previous from "../src/data/museumBridgePreviousV243.json";

const ground = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
const clusters = bridgeClusters(ground);
const accepted = clusters.filter(c => museumBridgeOwnerV243(ground, c));
let mode: VisualMode = "day";
const nav = createCoreSpreeBridgeNavigationV242(ground, () => mode);
const initiallyEmpty = nav.floorAt(1834, 182) === null;
const factory = createCoreSpreeBridgesV242(ground);
for (const cluster of accepted) factory.replace(cluster);
const root = factory.finish(); root.updateMatrixWorld(true);
afterAll(() => disposeSurroundingCityRoot(root));

describe("museum bridge source replacements v243", () => {
  test("accepts exactly three complete owners and keeps existing twelve-owner data separate", () => {
    expect(initiallyEmpty).toBeTrue();
    expect(accepted.length).toBe(3);
    expect(new Set(root.userData.sourceOwnersV243)).toEqual(new Set(["339201179", "339201216", "339201218"]));
    expect(root.userData.sourceOwnersV242).toEqual([]);
    expect(root.userData.failedOwnersV243).toEqual([]);
    expect(root.userData.geometryBytesV243).toBeLessThan(1_000_000);
    for (const next of ["minecraft", "night", "snowstorm", "flood", "schwellenraum", "day"] as const) {
      setCoreSpreeBridgePresentationV242(root, next);
      expect(root.getObjectByName("Museum bridges v243 drawn")!.visible).toBe(next !== "minecraft");
      expect(root.getObjectByName("Museum bridges v243 native")!.visible).toBe(next === "minecraft");
    }
  });

  test("every sampled actual road and footway top agrees with walking in both families", () => {
    for (mode of ["day", "minecraft"]) {
      const family = root.getObjectByName(mode === "minecraft" ? "Museum bridges v243 native" : "Museum bridges v243 drawn")!;
      for (const packet of museumBridgePacketsV243(mode === "minecraft")) {
        const owner = family.children.find(c => c.userData.spreeBridgeOwnerV242 === packet.owner)!;
        expect(owner.children.length).toBe(1);
        const mesh = owner.children[0] as Mesh;
        const bounds = mesh.geometry.boundingBox!;
        let checked = 0;
        for (let lx = bounds.min.x * .01 + .3817; lx < bounds.max.x * .01; lx += 1.7931) {
          for (let lz = bounds.min.z * .01 + .4123; lz < bounds.max.z * .01; lz += 1.6997) {
            const x = lx + packet.origin[0], z = lz + packet.origin[2], y = nav.floorAt(x, z);
            if (y === null || nav.solidAt(x, y + .6, z, .2)) continue;
            const hits = new Raycaster(new Vector3(x, y + .2, z), new Vector3(0, -1, 0), 0, .4).intersectObject(mesh);
            expect(hits.length, `${packet.name} ${mode} ${x},${z}`).toBeGreaterThan(0);
            expect(Math.abs(hits[0].point.y - y)).toBeLessThan(.012);
            checked++;
          }
        }
        expect(checked).toBeGreaterThan(10);
        const rail = packet.nav.spreeBridgesV242!.solids[0];
        const [a, b] = rail.ring;
        expect(nav.solidAt(packet.origin[0] + (a[0] + b[0]) / 2,
          (rail.low + rail.high) / 2, packet.origin[2] + (a[1] + b[1]) / 2, .1)).toBeTrue();
        if (mode === "minecraft") {
          const p = mesh.geometry.getAttribute("position"), ix = mesh.geometry.index!.array;
          let oblique = 0;
          const a = new Vector3(), b = new Vector3(), c = new Vector3();
          for (let i = 0; i < ix.length; i += 3) {
            a.fromBufferAttribute(p, ix[i]); b.fromBufferAttribute(p, ix[i + 1]); c.fromBufferAttribute(p, ix[i + 2]);
            b.sub(a).cross(c.sub(a));
            if ([b.x, b.y, b.z].filter(v => v !== 0).length > 1) oblique++;
          }
          expect(oblique).toBe(0);
        }
      }
    }
  });

  test("changed cells/datum or incomplete native construction retain the whole old bridge", () => {
    const cluster = accepted[0];
    expect(museumBridgeOwnerV243(ground, cluster.slice(1))).toBeNull();
    expect(museumBridgeOwnerV243(ground, [...cluster, [0, 0]])).toBeNull();
    expect(museumBridgeOwnerV243({ ...ground, water_top_y_m: 40 }, cluster)).toBeNull();
    const copy = { ...ground };
    const failed = createCoreSpreeBridgesV242(copy, undefined, native => native ? [] : museumBridgePacketsV243());
    try {
      expect(failed.replace(cluster)).toBeFalse();
      expect(failed.root.userData.sourceOwnersV243).toEqual([]);
      expect(failed.root.children.every(c => c.children.length === 0)).toBeTrue();
      const center = previous.records.find(r => r.sourceId === museumBridgeOwnerV243(ground, cluster))!.center;
      expect(createCoreSpreeBridgeNavigationV242(copy, () => "day").floorAt(center[0], center[1])).toBeNull();
    } finally { disposeSurroundingCityRoot(failed.root); }
  });

  test("cold native to drawn navigation rebinds to the actually retained root", () => {
    const other = { ...ground };
    const rebound = createCoreSpreeBridgeNavigationV242(other, () => mode, root);
    for (mode of ["minecraft", "day"]) for (const { center } of previous.records) {
      expect(rebound.floorAt(center[0], center[1])).toBe(nav.floorAt(center[0], center[1]));
      expect(rebound.floorAt(center[0], center[1])).not.toBeNull();
    }
  });

  test("the regular bridge constructor publishes a source-only trio without generic parts", () => {
    const bridgeClass = ground.classes.indexOf("bridge");
    const byRow = new Map<number, Array<[number, number, number]>>();
    for (const [x, z] of accepted.flat()) {
      const row = byRow.get(z) ?? [];
      row.push([x, 1, bridgeClass]); byRow.set(z, row);
    }
    const only = { ...ground, ground_rows: ground.ground_rows.map((_, z) => byRow.get(z) ?? []) };
    const published = createBridgeStructures(only, "full", true, createCoreSpreeBridgesV242);
    expect(published).not.toBeNull();
    try {
      expect(published!.getObjectByName("bridge structure bodies")).toBeUndefined();
      expect(published!.getObjectByName("Museum bridges v243 drawn")!.children.length).toBe(3);
    } finally { if (published) disposeSurroundingCityRoot(published); }
  });
});
