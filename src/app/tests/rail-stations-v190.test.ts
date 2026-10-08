import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh, Texture } from "three";
import { createRailStationsV190, RAIL_STATIONS_V190_INVENTORY, railStationLabelV190 } from "../src/RailStationsV190";
import source from "../src/data/ostkreuzV190.json";
import { letteringLayout } from "../src/drawnLettering";
import { createOstkreuzV190 } from "../src/OstkreuzV190";

describe("complete Ring and Stadtbahn inventory", () => {
  test("all 39 names validate, including Messe Nord / ZOB and umlauts", () => {
    expect(RAIL_STATIONS_V190_INVENTORY).toHaveLength(39);
    for (const station of RAIL_STATIONS_V190_INVENTORY)
      expect(letteringLayout(railStationLabelV190(station.name), .32).totalWidthM).toBeGreaterThan(0);
  });
  for (const native of [false, true]) test(native ? "independent orthogonal native geometry" : "complete drawn geometry", () => {
    const root = createRailStationsV190(native);
    expect(root.children).toHaveLength(36);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.preservedHeroNames).toHaveLength(5);
    let count = 0, bytes = 0, batches = 0;
    root.traverse(object => {
      expect(object.matrixAutoUpdate).toBe(false);
      if (!(object instanceof Mesh)) return;
      batches++;
      expect(object.geometry.getAttribute("uv")).toBeUndefined();
      for (const attribute of Object.values(object.geometry.attributes)) {
        bytes += attribute.array.byteLength;
        for (const value of attribute.array) expect(Number.isFinite(value)).toBe(true);
      }
      if (object instanceof InstancedMesh) {
        count += object.count;
        bytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
        for (let i = 0; i < object.count; i++) {
          const values = object.instanceMatrix.array;
          for (let j = 0; j < 16; j++) expect(Number.isFinite(values[i * 16 + j])).toBe(true);
          if (native) for (const j of [1, 2, 4, 6, 8, 9]) expect(values[i * 16 + j]).toBe(0);
        }
      }
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) for (const value of Object.values(material)) expect(value instanceof Texture).toBe(false);
    });
    expect(bytes).toBeLessThan(native ? 7_500_000 : 1_500_000);
    expect(count).toBeLessThan(native ? 95_000 : 14_000);
    expect(batches).toBeLessThan(80);
    console.log(JSON.stringify({ native, batches, count, bytes }));
    root.traverse(object => { if (object instanceof Mesh) { object.geometry.dispose(); object.userData.dayMaterial?.dispose(); object.userData.nightMaterial?.dispose(); } });
  });
  test("Ostkreuz separates published hall height, upper tracks, lower roofs and open deck", () => {
    const hall = source.roofs.find(r => r.hall)!;
    expect(hall.top - hall.floor).toBe(15);
    expect(source.ownerIds).toHaveLength(4);
    expect(source.tracks.filter(t => t.high).every(t => t.sourceTags.level === "1")).toBe(true);
    for (const roof of source.roofs.filter(r => r.floor < 10)) expect(roof.top).toBeLessThan(10.9);
    for (const track of source.tracks.filter(t => !t.high)) for (const p of track.points) expect(p[1]).toBe(3.15);
    expect(source.navigation.filter(n => n.id.endsWith("-deck")).every(n => n.minY === 10.9)).toBe(true);
    expect(source.supports.length).toBeGreaterThan(0);
  });
  test("Ostkreuz end glazing reaches the barrel crown while keeping the rail mouth open", () => {
    const root = createOstkreuzV190(false);
    const glass = root.getObjectByName("Ostkreuz translucent side and upper end glazing with open rail mouths") as Mesh;
    const positions = glass.geometry.getAttribute("position");
    const hall = source.roofs.find(r => r.hall)!, f = hall.frame;
    let maxY = -Infinity;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      maxY = Math.max(maxY, y);
      if (Math.abs(y - (hall.floor + .12)) < .001 || Math.abs(y - (hall.floor + 6.2)) < .001) continue;
      const v = -(x - f.x) * f.dz + (z - f.z) * f.dx;
      const expected = hall.top - 3.5 * (v / (f.width / 2)) ** 2;
      expect(Math.abs(y - expected)).toBeLessThan(.001);
    }
    expect(maxY).toBeGreaterThan(hall.top - .1);
    root.traverse(object => { if (object instanceof Mesh) { object.geometry.dispose(); object.userData.dayMaterial?.dispose(); object.userData.nightMaterial?.dispose(); } });
  });
});
