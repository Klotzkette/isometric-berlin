import { describe, expect, it } from "bun:test";
import { BufferGeometry, InstancedMesh, Mesh, Object3D } from "three";
import { createConcertHalls, createMinecraftConcertHalls, CONCERT_HALL_RENDER_BUDGET } from "../src/ConcertHalls";
import { concertHallContains, concertHallRoofAt, concertHallSourceColumn, CONCERT_HALL_PRISM_IDS, CONCERT_HALL_PROFILE } from "../src/concertHallsProfile";
import source from "../src/data/concertHallsSource.json";
import nav from "../src/data/concertHallsNavigation.json";

function budget(root: Object3D) {
  let drawCalls = 0, vertices = 0, bytes = 0;
  root.traverse((object) => {
    const renderable = object as Mesh;
    if (!renderable.geometry) return;
    drawCalls++;
    const geometry = renderable.geometry as BufferGeometry;
    vertices += geometry.getAttribute("position").count;
    for (const attribute of Object.values(geometry.attributes)) bytes += attribute.array.byteLength;
    if (geometry.index) bytes += geometry.index.array.byteLength;
    if (object instanceof InstancedMesh) {
      bytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
    }
  });
  return { drawCalls, vertices, bytes };
}

describe("source-bound Philharmonie and Kammermusiksaal", () => {
  it("retains every official parent part and separates the adjacent museum and entry canopy", () => {
    expect(CONCERT_HALL_PRISM_IDS.size).toBe(27);
    expect(source.parts.filter((p) => p.building === "Philharmonie")).toHaveLength(7);
    expect(source.parts.filter((p) => p.building === "Kammermusiksaal")).toHaveLength(18);
    expect(CONCERT_HALL_PRISM_IDS.has("K0003VMd")).toBe(false);
    expect(CONCERT_HALL_PRISM_IDS.has("K0003U62")).toBe(true);
    expect(CONCERT_HALL_PRISM_IDS.has("K0003TqC")).toBe(true);
    expect(source.parts.find((p) => p.shortId === "K0003TqC")?.solidBaseY).toBe(8.904);
    expect(source.canopyWallEvidence).toHaveLength(62);
    expect(source.foyerWindows).toHaveLength(92);
    expect(CONCERT_HALL_RENDER_BUDGET.sourceTriangles).toBe(846);
    expect(source.parts.find((p) => p.shortId === "XzEkeXsu")?.heightM).toBe(35.665);
    expect(source.parts.find((p) => p.shortId === "aJ0e8oAr")?.heightM).toBe(26.347);
  });

  it("uses the actual sloping roofs for drawn walking and cell tops for native walking", () => {
    let minRoof = Infinity, maxRoof = -Infinity;
    for (const triangle of nav.roofTriangles) {
      const x = triangle.reduce((sum, p) => sum + p[0], 0) / 3;
      const z = triangle.reduce((sum, p) => sum + p[2], 0) / 3;
      const expected = triangle.reduce((sum, p) => sum + p[1], 0) / 3;
      const actual = concertHallRoofAt(x, z);
      expect(actual).not.toBeNull();
      expect(actual!).toBeGreaterThanOrEqual(expected - .001);
      minRoof = Math.min(minRoof, actual!); maxRoof = Math.max(maxRoof, actual!);
    }
    expect(maxRoof - minRoof).toBeGreaterThan(22);
    for (const [x, z, y] of nav.nativeRoofCells) expect(concertHallRoofAt(x, z, true)).toBe(y);
    expect(concertHallRoofAt(-500, 1000)).toBeNull();
    expect(concertHallRoofAt(-500, 1000, true)).toBeNull();
    expect(concertHallContains(-139, 989)).toBe(true);
    expect(concertHallSourceColumn(-139, 989, 4.1, 40.1)).toBe(true);
    expect(concertHallSourceColumn(-139, 989, 4.1, 100)).toBe(false);
  });

  it("keeps exact wall-clipped detail on mobile without per-panel draw calls", () => {
    const group = createConcertHalls();
    const measured = budget(group);
    expect(measured.drawCalls).toBe(6);
    expect(measured.vertices).toBeLessThan(32000);
    expect(measured.bytes).toBeLessThan(600000);
    for (const text of ["PHILHARMONIE", "KAMMERMUSIKSAAL"]) {
      const sign = group.getObjectByName(`${text} entrance lettering`)!;
      expect(sign.userData.lettering).toBe(text);
      expect(sign.userData.kulturforumEntrance).toBe(true);
      expect(sign.position.x).toBeLessThan(-185);
    }
    expect(CONCERT_HALL_PROFILE.mainEntrances.map((e) => e.osmNode)).toEqual([247854384, 3100521550]);
  });

  it("builds one independent surface-only native batch, with no smooth double", () => {
    const native = createMinecraftConcertHalls();
    const measured = budget(native);
    expect(measured.drawCalls).toBe(1);
    expect(measured.vertices).toBe(24);
    expect(measured.bytes).toBeLessThan(550000);
    const mesh = native.children[0] as InstancedMesh;
    expect(mesh.userData.blockNative).toBe(true);
    expect(mesh.count).toBe(CONCERT_HALL_RENDER_BUDGET.nativeBlocks);
    expect(mesh.count).toBeLessThan(7500);
  });
});
