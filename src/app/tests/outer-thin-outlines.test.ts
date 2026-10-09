import { expect, test } from "bun:test";
import { LineSegments, Mesh } from "three";
import { createOuterThinOutlines } from "../src/OuterThinOutlines";
import { outlineNavigationEnvelopeBounds } from "../src/outlineNavigationEnvelope";
import data from "../src/data/outerThinOutlines.json";
import { PRESENTATION_BACKDROP_BOUNDS, extrapolatedEnvelopeBounds } from "../src/worldEnvelope";

test("thin outer context retains its bounded hairlines beside the requested v182 landmarks", () => {
  const root = createOuterThinOutlines("day");
  expect(root.children).toHaveLength(4);
  const lines = root.children[0] as LineSegments;
  expect(lines.isLineSegments).toBeTrue();
  expect(lines.geometry.getAttribute("position").array.byteLength).toBeLessThan(1_000_000);
  expect((lines.material as any).linewidth).toBe(1);
  expect(root.children[1] instanceof Mesh).toBeTrue();
  expect(root.children[1].name).not.toContain("building");
  const positions = lines.geometry.getAttribute("position");
  const rail = root.children[2] as LineSegments;
  expect(rail.geometry.getAttribute("position")).toBe(positions);
  expect((rail.material as any).depthTest).toBeFalse();
  expect((lines.material as any).depthTest).toBeTrue();
  // v199's measured ICC owns only the former ICC wire envelope. Its old
  // skyway cannot remain above the corrected source bridge. All other source
  // vertices still belong to exactly one retained line index.
  const retiredIcc = data.features.filter(feature => feature.name === "ICC");
  expect(retiredIcc).toHaveLength(1);
  expect(rail.geometry.index!.count + lines.geometry.index!.count).toBe(
    positions.count - retiredIcc[0].vertexCount);
  expect(root.getObjectByName("ICC Berlin measured shell and high-tech facade v199")).toBeDefined();
  expect(positions.array.byteLength + rail.geometry.index!.array.byteLength + lines.geometry.index!.array.byteLength).toBeLessThan(1_000_000);
  const railVertices = new Set(Array.from(rail.geometry.index!.array));
  const streetVertices = new Set(Array.from(lines.geometry.index!.array));
  for (const feature of data.features) {
    const isRail = feature.kind === "rail" || feature.kind.startsWith("station-");
    for (let v = feature.firstVertex; v < feature.firstVertex + feature.vertexCount; v++) {
      expect(railVertices.has(v)).toBe(isRail);
      expect(streetVertices.has(v)).toBe(!isRail && feature.name !== "ICC");
    }
  }
  for (const mode of ["night", "snowstorm", "schwellenraum", "flood", "minecraft", "day"]) {
    root.userData.setMode(mode);
    expect(lines.geometry.getAttribute("position")).toBe(positions);
    expect(root.children).toHaveLength(4);
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
  root.traverse(object => {
    const child = object as Mesh;
    child.geometry?.dispose();
    if (child.material) (child.material as any).dispose();
  });
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
