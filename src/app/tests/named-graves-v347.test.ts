import { describe, expect, test } from "bun:test";
import { Group, Mesh } from "three";
import { createNamedGravesV347, NAMED_GRAVE_SITES_V347, namedGraveGeometryV347, type NamedGraveSupportV347 } from "../src/NamedGravesV347";
import { worldGroundSampler, type VoxelPayload } from "../src/terrainPayload";

const support = (y = 12.345): NamedGraveSupportV347 => ({ ground: () => y, water: () => false, blocked: () => false });
function setup() {
  const controller = createNamedGravesV347();
  const owner = new Group();
  owner.add(controller.root);
  return { controller, owner };
}

describe("V347 two mapped graves use actual visible terrain", () => {
  test("both real retained Core terrain families support both exact mapped anchors", async () => {
    for (const [file, native] of [["ground-context.json", false], ["minecraft-voxels.json", true]] as const) {
      const payload = await Bun.file(new URL(`../public/mesh/regierungsviertel/${file}`, import.meta.url)).json() as VoxelPayload;
      const ground = worldGroundSampler(payload);
      for (const site of NAMED_GRAVE_SITES_V347) {
        const { controller } = setup();
        const [x, z] = site.anchor;
        expect(ground(x, z)).toBe(5.2);
        expect(controller.refresh(x, z, native, { ...support(), ground })).toBe(true);
        const mesh = controller.root.children[0] as Mesh;
        expect(mesh.position.y + mesh.geometry.boundingBox!.min.y * .01).toBeCloseTo(ground(x, z)!, 6);
        controller.dispose();
      }
    }
  });
  for (const site of NAMED_GRAVE_SITES_V347) for (const native of [false, true]) {
    test(`${site.key} ${native ? "Native" : "Drawn"}: exact floor, solid matching and release`, () => {
      const { controller } = setup();
      const [x, z] = site.anchor;
      const y = 12.345;
      expect(controller.refresh(x, z, native, support(y))).toBe(true);
      const mesh = controller.root.children[0] as Mesh;
      expect(controller.root.children.length).toBe(1);
      expect(mesh.position.y + mesh.geometry.boundingBox!.min.y * .01).toBeCloseTo(y, 6);
      const model = site.models[native ? "minecraft" : "drawn"];
      const solid = model.solids[0];
      const sx = solid.ring.reduce((n, p) => n + p[0], 0) / solid.ring.length;
      const sz = solid.ring.reduce((n, p) => n + p[1], 0) / solid.ring.length;
      expect(controller.solidAt(x + sx, y + (solid.low + solid.high) / 2, z + sz, 0, native)).toBe(true);
      expect(controller.solidAt(x + sx, y + 3, z + sz, 0, native)).toBe(false);
      expect(controller.solidAt(x + sx, y + .5, z + sz, 0, !native)).toBe(false);
      expect(controller.refresh(x, z, native, support(y))).toBe(false);
      expect(controller.root.children[0]).toBe(mesh);
      // Calling the real nav callback during admission must not make the grave
      // reject its own stone on its second and subsequent refresh.
      const recursiveSupport = { ...support(y), blocked: (a: number, b: number, c: number) => controller.solidAt(a, b + .5, c, 0, native) };
      expect(controller.refresh(x, z, native, recursiveSupport)).toBe(false);
      let geometries = 0, materials = 0;
      mesh.geometry.addEventListener("dispose", () => geometries++);
      (mesh.material as { addEventListener: (kind: string, fn: () => void) => void }).addEventListener("dispose", () => materials++);
      expect(controller.refresh(x + 181, z, native, support(y))).toBe(true);
      expect(controller.root.children.length).toBe(0);
      expect(geometries).toBe(1);
      expect(materials).toBe(1);
      expect(controller.solidAt(x + sx, y + .5, z + sz, .1, native)).toBe(false);
      controller.dispose();
    });
  }

  test("missing, wet, blocked and discontinuous terrain keep every grave absent", () => {
    const [x, z] = NAMED_GRAVE_SITES_V347[0].anchor;
    for (const native of [false, true]) for (const bad of [
      { ...support(), ground: () => null },
      { ...support(), ground: () => NaN },
      { ...support(), water: () => true },
      { ...support(), blocked: () => true },
      { ...support(), ground: (sx: number) => sx < x - .2 ? null : 12.345 },
      { ...support(), ground: (sx: number) => sx < x - .2 ? 12.8 : 12.345 },
    ]) {
      const { controller } = setup();
      expect(controller.refresh(x, z, native, bad)).toBe(false);
      expect(controller.root.children.length).toBe(0);
      controller.dispose();
    }
  });

  test("ground invalidation and renderer switch release the exact prior family", () => {
    const { controller, owner } = setup();
    const [x, z] = NAMED_GRAVE_SITES_V347[1].anchor;
    controller.refresh(x, z, false, support(17));
    const before = controller.root.children[0] as Mesh;
    let disposed = 0;
    before.geometry.addEventListener("dispose", () => disposed++);
    expect(controller.refresh(x, z, true, support(17))).toBe(true);
    expect(disposed).toBe(1);
    expect(controller.root.children[0]).not.toBe(before);
    expect(controller.root.children[0].userData.nativeMinecraft).toBe(true);
    owner.visible = false;
    expect(controller.solidAt(x, 17.4, z, 5, true)).toBe(false);
    owner.visible = true;
    expect(controller.refresh(x, z, true, { ...support(17), ground: () => null })).toBe(true);
    expect(controller.root.children.length).toBe(0);
    expect(controller.release()).toBe(false);
    controller.dispose();
    expect(controller.root.parent).toBeNull();
  });

  test("Native geometry and its collision faces are independently cardinal and bounded", () => {
    for (const site of NAMED_GRAVE_SITES_V347) {
      const model = site.models.minecraft;
      const geometry = namedGraveGeometryV347(model);
      const p = geometry.getAttribute("position"), ix = geometry.index!;
      expect(p.count).toBeLessThan(30000);
      expect(ix.count).toBeLessThan(120000);
      for (let i = 0; i < ix.count; i += 3) {
        const a = ix.getX(i), b = ix.getX(i + 1), c = ix.getX(i + 2);
        expect(["getX", "getY", "getZ"].some(axis => {
          const get = p[axis as "getX"].bind(p);
          return get(a) === get(b) && get(b) === get(c);
        })).toBe(true);
      }
      for (const solid of model.solids) for (let i = 0; i < solid.ring.length; i++) {
        const a = solid.ring[i], b = solid.ring[(i + 1) % solid.ring.length];
        expect(a[0] === b[0] || a[1] === b[1]).toBe(true);
      }
      const bounds = geometry.boundingBox!;
      expect(model.bounds).toEqual([bounds.min.x * .01 - 4, bounds.min.z * .01 - 4, bounds.max.x * .01 - 4, bounds.max.z * .01 - 4].map(n => Math.round(n * 100) / 100));
      geometry.dispose();
    }
  });
});
