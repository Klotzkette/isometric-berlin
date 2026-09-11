import { describe, expect, test } from "bun:test";
import {
  AdditiveBlending, BufferGeometry, CustomBlending, LineBasicMaterial,
  LineSegments, Material, NoBlending, NormalBlending, Object3D,
} from "three";
import {
  isInkDrawSuppressed, registerInkDrawObject, registerInkRenderObserver,
  registerInkShaderWrapper, restoreInkDrawVisibility, updateInkDrawVisibility,
} from "../src/inkDrawVisibility";

function ink() {
  const material = new LineBasicMaterial({
    transparent: true, opacity: 0, depthWrite: false,
  });
  const line = new LineSegments(new BufferGeometry(), material);
  registerInkDrawObject(line);
  return { line, material };
}

describe("exactly invisible ink draw suppression", () => {
  test("skips zero alpha once and restores the same material as soon as alpha is positive", () => {
    const { line, material } = ink();
    const geometry = line.geometry;
    expect(updateInkDrawVisibility(material)).toBeTrue();
    expect(material.visible).toBeFalse();
    expect(isInkDrawSuppressed(material)).toBeTrue();
    expect(updateInkDrawVisibility(material)).toBeFalse();
    material.opacity = 0.35;
    expect(updateInkDrawVisibility(material)).toBeTrue();
    expect(material.visible).toBeTrue();
    expect(isInkDrawSuppressed(material)).toBeFalse();
    expect(updateInkDrawVisibility(material)).toBeFalse();
    expect(line.material).toBe(material);
    expect(line.geometry).toBe(geometry);
    expect(material.opacity).toBe(0.35);
    material.opacity = 0;
    expect(updateInkDrawVisibility(material)).toBeTrue();
  });

  test("never treats even the smallest positive alpha as zero", () => {
    const { material } = ink();
    for (const opacity of [Number.MIN_VALUE, 1e-12, 1e-7, 0.001, 1]) {
      material.opacity = opacity;
      expect(updateInkDrawVisibility(material)).toBeFalse();
      expect(material.visible).toBeTrue();
    }
    material.opacity = 0;
    updateInkDrawVisibility(material);
    material.opacity = Number.MIN_VALUE;
    expect(updateInkDrawVisibility(material)).toBeTrue();
    expect(material.visible).toBeTrue();
  });

  test("does not acquire or release ownership of authored-hidden materials", () => {
    const { material } = ink();
    material.visible = false;
    expect(updateInkDrawVisibility(material)).toBeFalse();
    expect(isInkDrawSuppressed(material)).toBeFalse();
    expect(restoreInkDrawVisibility(material)).toBeFalse();
    material.opacity = 0.5;
    expect(updateInkDrawVisibility(material)).toBeFalse();
    expect(material.visible).toBeFalse();
  });

  test("explicit restoration releases only the helper's own suppression", () => {
    const { material } = ink();
    expect(restoreInkDrawVisibility(material)).toBeFalse();
    updateInkDrawVisibility(material);
    expect(restoreInkDrawVisibility(material)).toBeTrue();
    expect(material.visible).toBeTrue();
    expect(restoreInkDrawVisibility(material)).toBeFalse();
    material.visible = false;
    material.opacity = 0.8;
    expect(updateInkDrawVisibility(material)).toBeFalse();
    expect(material.visible).toBeFalse();
  });

  test("leaves objects, descendants, geometry and the sibling's material untouched", () => {
    const { line, material } = ink();
    const child = new LineSegments(new BufferGeometry(), new LineBasicMaterial());
    const sibling = new LineSegments(new BufferGeometry(), new LineBasicMaterial());
    const root = new Object3D();
    root.add(line, sibling);
    line.add(child);
    const geometry = line.geometry;
    const childGeometry = child.geometry;
    updateInkDrawVisibility(material);
    const visited: Object3D[] = [];
    root.traverseVisible((object) => visited.push(object));
    expect(visited).toEqual([root, line, child, sibling]);
    expect(child.material.visible).toBeTrue();
    expect(sibling.material.visible).toBeTrue();
    expect(line.geometry).toBe(geometry);
    expect(child.geometry).toBe(childGeometry);
    expect(line.children).toEqual([child]);
  });
});

describe("ink draw safety guards", () => {
  const unsafeStates: Array<[string, (material: LineBasicMaterial) => void]> = [
    ["opaque material", (material) => { material.transparent = false; }],
    ["additive blending", (material) => { material.blending = AdditiveBlending; }],
    ["custom blending", (material) => { material.blending = CustomBlending; }],
    ["disabled blending", (material) => { material.blending = NoBlending; }],
    ["depth writes", (material) => { material.depthWrite = true; }],
    ["stencil writes", (material) => { material.stencilWrite = true; }],
    ["alpha to coverage", (material) => { material.alphaToCoverage = true; }],
    ["custom shader", (material) => { material.onBeforeCompile = () => {}; }],
    ["material render callback", (material) => { material.onBeforeRender = () => {}; }],
  ];

  for (const [name, makeUnsafe] of unsafeStates) {
    test(`preserves ${name}, including when changed after suppression`, () => {
      const untouched = ink().material;
      makeUnsafe(untouched);
      expect(updateInkDrawVisibility(untouched)).toBeFalse();
      expect(untouched.visible).toBeTrue();

      const suppressed = ink().material;
      expect(updateInkDrawVisibility(suppressed)).toBeTrue();
      makeUnsafe(suppressed);
      expect(updateInkDrawVisibility(suppressed)).toBeTrue();
      expect(suppressed.visible).toBeTrue();
      expect(updateInkDrawVisibility(suppressed)).toBeFalse();
    });
  }

  for (const hook of ["onBeforeRender", "onAfterRender"] as const) {
    test(`preserves a registered object's custom ${hook} callback`, () => {
      const { line, material } = ink();
      line[hook] = () => {};
      registerInkDrawObject(line);
      expect(updateInkDrawVisibility(material)).toBeFalse();
      expect(material.visible).toBeTrue();
    });
  }

  test("one callback-bearing object protects a shared material and restores prior suppression", () => {
    const { material } = ink();
    updateInkDrawVisibility(material);
    const other = new LineSegments(new BufferGeometry(), material);
    other.onAfterRender = () => {};
    registerInkDrawObject(other);
    expect(updateInkDrawVisibility(material)).toBeTrue();
    expect(material.visible).toBeTrue();
  });

  test("accepts chains of explicitly registered alpha-preserving wrappers", () => {
    const { material } = ink();
    const first: Material["onBeforeCompile"] = () => {};
    const second: Material["onBeforeCompile"] = () => {};
    registerInkShaderWrapper(Material.prototype.onBeforeCompile, first);
    registerInkShaderWrapper(first, second);
    material.onBeforeCompile = second;
    expect(updateInkDrawVisibility(material)).toBeTrue();
    expect(material.visible).toBeFalse();
  });

  test("does not trust a wrapper around an unknown custom shader", () => {
    const { material } = ink();
    const unknown: Material["onBeforeCompile"] = () => {};
    const wrapper: Material["onBeforeCompile"] = () => {};
    registerInkShaderWrapper(unknown, wrapper);
    material.onBeforeCompile = wrapper;
    expect(updateInkDrawVisibility(material)).toBeFalse();
    expect(material.visible).toBeTrue();
  });

  test("allows registered residency observers only over safe original callbacks", () => {
    const { line, material } = ink();
    const observer: Object3D["onAfterRender"] = () => {};
    registerInkRenderObserver(Object3D.prototype.onAfterRender, observer);
    line.onAfterRender = observer;
    registerInkDrawObject(line);
    expect(updateInkDrawVisibility(material)).toBeTrue();

    const guarded = ink();
    const authored: Object3D["onAfterRender"] = () => {};
    const wrappedAuthored: Object3D["onAfterRender"] = () => {};
    registerInkRenderObserver(authored, wrappedAuthored);
    guarded.line.onAfterRender = wrappedAuthored;
    registerInkDrawObject(guarded.line);
    expect(updateInkDrawVisibility(guarded.material)).toBeFalse();
    expect(guarded.material.visible).toBeTrue();
  });

  test("can resume suppression when a material returns to a safe presentation", () => {
    const { material } = ink();
    material.blending = AdditiveBlending;
    expect(updateInkDrawVisibility(material)).toBeFalse();
    material.blending = NormalBlending;
    expect(updateInkDrawVisibility(material)).toBeTrue();
  });
});
