import { expect, test } from "bun:test";
import { LineSegments, Mesh } from "three";
import { createOuterThinOutlines } from "../src/OuterThinOutlines";
import { outlineNavigationEnvelopeBounds } from "../src/outlineNavigationEnvelope";
import data from "../src/data/outerThinOutlines.json";
import { PRESENTATION_BACKDROP_BOUNDS, extrapolatedEnvelopeBounds } from "../src/worldEnvelope";

test("thin outer context uses two bounded batches and never solid landmark bodies", () => {
  const root = createOuterThinOutlines("day");
  expect(root.children).toHaveLength(2);
  const lines = root.children[0] as LineSegments;
  expect(lines.isLineSegments).toBeTrue();
  expect(lines.geometry.getAttribute("position").array.byteLength).toBeLessThan(200_000);
  expect((lines.material as any).linewidth).toBe(1);
  expect(root.children[1] instanceof Mesh).toBeTrue();
  expect(root.children[1].name).not.toContain("building");
  const positions = lines.geometry.getAttribute("position");
  for (const mode of ["night", "snowstorm", "schwellenraum", "flood", "minecraft", "day"]) {
    root.userData.setMode(mode);
    expect(lines.geometry.getAttribute("position")).toBe(positions);
    expect(root.children).toHaveLength(2);
    expect((lines.material as any).map).toBeNull();
    const paper = (root.children[1] as Mesh).geometry;
    const vertices = paper.getAttribute("position");
    const existing = mode === "minecraft" ? extrapolatedEnvelopeBounds() : PRESENTATION_BACKDROP_BOUNDS;
    for (let v = 0; v < paper.drawRange.count; v += 3) {
      const xs = [0, 1, 2].map(offset => vertices.getX(v + offset));
      const zs = [0, 1, 2].map(offset => vertices.getZ(v + offset));
      expect(Math.max(...xs) <= existing.minX || Math.min(...xs) >= existing.maxX ||
        Math.max(...zs) <= existing.minZ || Math.min(...zs) >= existing.maxZ).toBeTrue();
    }
  }
  for (const child of root.children as (LineSegments | Mesh)[]) {
    child.geometry.dispose(); (child.material as any).dispose();
  }
});

test("every source vertex including the AVUS end fits the camera envelope", () => {
  const bounds = outlineNavigationEnvelopeBounds();
  for (let i = 0; i < data.positions.length; i += 3) {
    expect(data.positions[i]).toBeGreaterThanOrEqual(bounds.minX);
    expect(data.positions[i]).toBeLessThanOrEqual(bounds.maxX);
    expect(data.positions[i + 2]).toBeGreaterThanOrEqual(bounds.minZ);
    expect(data.positions[i + 2]).toBeLessThanOrEqual(bounds.maxZ);
  }
  expect(bounds.minX).toBeLessThan(-12_000);
  expect(bounds.maxZ).toBeGreaterThan(9_000);
});
