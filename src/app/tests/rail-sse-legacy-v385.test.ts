import { expect, test } from "bun:test";
import { Group, InstancedMesh } from "three";
import { createRailStationsV190 } from "../src/RailStationsV190";
import { applyRailSseLegacyV307, hasRaisedRailCarsV385 } from "../src/RailSseLegacyV307";
import { createRailSseArchitectureV307 } from "../src/RailSseArchitectureV307";
import { createRailTerrainContactV307 } from "../src/RailTerrainContactV307";

for (const native of [false, true]) test(`authenticates the old station prefix and every appended v378 row (${native})`, () => {
  const source = createRailStationsV190(native);
  const model = createRailSseArchitectureV307(native);
  const ground = createRailTerrainContactV307(native);
  const world = new Group().add(source, model, ground);
  const cases = ["Gesundbrunnen", "Landsberger Allee"].map(name => {
    const station = source.children.find(o => o.userData.stationName === name)!;
    const mesh = station.children.find(o => o instanceof InstancedMesh) as InstancedMesh;
    const {start, count} = mesh.userData.transportRingSpanV378;
    return { station, mesh, start, count, matrix:mesh.instanceMatrix, color:mesh.instanceColor! };
  });
  const toggle = (on:boolean) => applyRailSseLegacyV307(world,native,on,model,ground);
  expect(hasRaisedRailCarsV385(world,native)).toBe(false);
  for (const {matrix,color,start,mesh} of cases) {
    for (const [array,offset] of [[matrix.array,12], [matrix.array,start*16+12], [color.array,start*3]] as const) {
      const original = array[offset];
      array[offset] = original + 0.125;
      expect(toggle(true)).toBe(false);
      expect(cases.every(c=>c.mesh.visible)).toBe(true);
      expect(hasRaisedRailCarsV385(world,native)).toBe(false);
      array[offset] = original;
    }
    const span = mesh.userData.transportRingSpanV378;
    mesh.userData.transportRingSpanV378 = {...span,start:start-1};
    expect(toggle(true)).toBe(false);
    mesh.userData.transportRingSpanV378 = span;
  }
  expect(toggle(true)).toBe(true);
  expect(toggle(true)).toBe(true);
  expect(hasRaisedRailCarsV385(world,native)).toBe(true);
  for (const {mesh,station,start,count} of cases) {
    expect(mesh.visible).toBe(false);
    const holder = station.children.find(o => o.name.endsWith("retained Ringbahn transport"));
    expect(holder?.children.length).toBe(1);
    const remainder = holder?.children[0] as InstancedMesh;
    expect(remainder.count).toBeGreaterThanOrEqual(count);
    expect(mesh.count).toBe(start+count);
  }
  expect(toggle(false)).toBe(false);
  expect(hasRaisedRailCarsV385(world,native)).toBe(false);
  for(const {mesh,station,matrix,color,start} of cases) {
    expect(mesh.visible).toBe(true);
    expect(mesh.instanceMatrix).toBe(matrix);
    expect(mesh.instanceColor).toBe(color);
    expect(station.children.some(o=>o.name.endsWith("retained Ringbahn transport"))).toBe(false);
    // Recreate the full v307 source captured before v378 appended any rows.
    mesh.instanceMatrix = matrix.clone();
    mesh.instanceMatrix.array = matrix.array.slice(0,start*16);
    mesh.instanceColor = color.clone();
    mesh.instanceColor.array = color.array.slice(0,start*3);
    mesh.count = start;
    delete mesh.userData.transportRingSpanV378;
  }
  expect(toggle(true)).toBe(true);
  expect(hasRaisedRailCarsV385(world,native)).toBe(false);
  expect(toggle(false)).toBe(false);
});
