import { afterAll, describe, expect, test } from "bun:test";
import { Mesh, Raycaster, Vector3 } from "three";
import { bridgeClusters, createBridgeStructures } from "../src/IsometricCityWorld";
import { createPedestrianBridgeGround } from "../src/PedestrianBridgeGround";
import { createCoreSpreeBridgeNavigationV242, createCoreSpreeBridgesV242,
  setCoreSpreeBridgePresentationV242 } from "../src/CoreSpreeBridgesV242";
import { spreeBridgeCoreOwnerV242, spreeBridgeCorePacketsV242 } from "../src/SpreeBridgesV242";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import type { VoxelPayload } from "../src/terrainPayload";
import type { VisualMode } from "../src/visualMode";

const ground = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
let mode: VisualMode = "day";
// The actual viewer compiles navigation before publishing the required bridge root.
const nav = createCoreSpreeBridgeNavigationV242(ground, () => mode);
const floor = createPedestrianBridgeGround(ground, () => mode, .2);
const earlyEmpty = nav.floorAt(1380, -364) === null;
const root = createBridgeStructures(ground, "full", true, createCoreSpreeBridgesV242)!;
root.updateMatrixWorld(true);
const mapped = root.getObjectByName("Mapped core Spree bridges v242")!;
const drawn = root.getObjectByName("Mapped core Spree bridges v242 drawn")!;
const native = root.getObjectByName("Mapped core Spree bridges v242 native")!;
afterAll(() => disposeSurroundingCityRoot(root));

describe("complete mapped core Spree bridge replacements v242", () => {
  test("publishes all twelve complete owners in both families with bounded buffers", () => {
    expect(earlyEmpty).toBeTrue();
    expect(mapped.userData.failedOwnersV242).toEqual([]);
    expect(mapped.userData.sourceOwnersV242.length).toBe(12);
    expect(drawn.children.length).toBe(12);
    expect(native.children.length).toBe(12);
    expect(mapped.userData.geometryBytesV242).toBeLessThan(3_000_000);
    let nonOrthogonalNativeFaces = 0;
    for (const family of [drawn, native]) for (const owner of family.children) {
      expect(owner.children.length).toBe(1);
      const mesh = owner.children[0] as Mesh;
      expect(mesh.geometry.index!.count).toBeGreaterThan(0);
      expect(mesh.geometry.boundingBox!.isEmpty()).toBeFalse();
      if (family === native) {
        const p = mesh.geometry.getAttribute("position"), index = mesh.geometry.index!.array;
        const a = new Vector3(), b = new Vector3(), c = new Vector3();
        for (let i = 0; i < index.length; i += 3) {
          a.fromBufferAttribute(p, index[i]); b.fromBufferAttribute(p, index[i + 1]);
          c.fromBufferAttribute(p, index[i + 2]); b.sub(a).cross(c.sub(a));
          if ([b.x, b.y, b.z].filter(n => n !== 0).length > 1) nonOrthogonalNativeFaces++;
        }
      }
    }
    expect(nonOrthogonalNativeFaces).toBe(0);
    for (const next of ["minecraft", "night", "snowstorm", "flood", "schwellenraum", "day"] as const) {
      setCoreSpreeBridgePresentationV242(root, next);
      expect(drawn.visible).toBe(next !== "minecraft");
      expect(native.visible).toBe(next === "minecraft");
    }
  });

  test("actual decoded surfaces agree with late-bound walking and railing collision in both modes", () => {
    for (mode of ["day", "minecraft"]) {
      const family = mode === "minecraft" ? native : drawn;
      for (const packet of spreeBridgeCorePacketsV242(mode === "minecraft")) {
        const owner = family.children.find(o => o.userData.spreeBridgeOwnerV242 === packet.owner)!;
        const mesh = owner.children[0] as Mesh;
        const box = mesh.geometry.boundingBox!;
        let checked = 0;
        // Avoid exact quarter-metre step edges, where either adjacent top is a
        // valid boundary hit depending on floating-point ray intersection order.
        for (let lx = box.min.x * .01 + .3719; lx < box.max.x * .01; lx += 7.1321) {
          for (let lz = box.min.z * .01 + .4147; lz < box.max.z * .01; lz += 6.7313) {
            const x = lx + packet.origin[0], z = lz + packet.origin[2];
            const y = nav.floorAt(x, z);
            if (y === null || nav.solidAt(x, y + .65, z, .2)) continue;
            expect(floor(x, z)).toBe(y);
            const hits = new Raycaster(new Vector3(x, y + .25, z), new Vector3(0, -1, 0), 0, .5).intersectObject(mesh);
            const location = `${mode} ${packet.name} at ${x},${z}; floor ${y}; hit ${hits[0]?.point.y}`;
            expect(hits.length, location).toBeGreaterThan(0);
            expect(Math.abs(hits[0].point.y - y), location).toBeLessThan(.012);
            checked++;
          }
        }
        expect(checked).toBeGreaterThan(1);
        const solid = packet.nav.spreeBridgesV242!.solids[0];
        if (solid) {
          const [a, b] = solid.ring;
          expect(nav.solidAt(packet.origin[0] + (a[0] + b[0]) / 2,
            (solid.low + solid.high) / 2, packet.origin[2] + (a[1] + b[1]) / 2, .1)).toBeTrue();
        }
      }
    }
  });

  test("changed/partial clusters and failed complete packet pairs retain generic ownership", () => {
    const clusters = bridgeClusters(ground);
    const matched = clusters.find(c => spreeBridgeCoreOwnerV242(ground, c))!;
    expect(spreeBridgeCoreOwnerV242(ground, matched.slice(1))).toBeNull();
    expect(spreeBridgeCoreOwnerV242(ground, [...matched, [0, 0]])).toBeNull();
    const changed = { ...ground, water_top_y_m: 40 };
    expect(spreeBridgeCoreOwnerV242(changed, matched)).toBeNull();
    const cloned = { ...ground };
    const owner = spreeBridgeCoreOwnerV242(cloned, matched)!;
    const packet = spreeBridgeCorePacketsV242(true).find(p => p.owner === owner)!;
    const broken = { ...packet, meshes: [{ ...packet.meshes[0], indices: "broken" }] };
    const sourceDrawn = spreeBridgeCorePacketsV242(false);
    const fallback = createCoreSpreeBridgesV242(cloned, native => native ? [broken] : sourceDrawn);
    try {
      expect(fallback.replace(matched)).toBeFalse();
      expect(fallback.root.userData.sourceOwnersV242).toEqual([]);
      expect(fallback.root.children.every(o => o.children.length === 0)).toBeTrue();
      expect(createCoreSpreeBridgeNavigationV242(cloned, () => "day").floorAt(1380, -364)).toBeNull();
    } finally { disposeSurroundingCityRoot(fallback.root); }
  });

  test("cold-native to drawn terrain reuses only the existing successfully built bridge root", () => {
    mode = "day";
    const anotherGround = { ...ground };
    const early = createCoreSpreeBridgeNavigationV242(anotherGround, () => mode);
    expect(early.floorAt(1380, -364)).toBeNull();
    createCoreSpreeBridgeNavigationV242(anotherGround, () => mode, root);
    expect(early.floorAt(1380, -364)).toBe(nav.floorAt(1380, -364));
    expect(early.floorAt(1380, -364)).not.toBeNull();
    mode = "minecraft";
    expect(early.floorAt(1380, -364)).toBe(nav.floorAt(1380, -364));
  });
});
