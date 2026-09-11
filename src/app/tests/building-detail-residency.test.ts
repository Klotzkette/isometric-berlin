import { expect, test } from "bun:test";
import { retainedBuildingDetailIds, MOBILE_DETAIL_CACHE_PART_LIMIT } from "../src/buildingDetailResidency";
import type { BuildingDetailDistrict } from "../src/buildingDetailStreaming";

const districts: BuildingDetailDistrict[] = Array.from({ length: 60 }, (_, i) => ({
  id: `buildings-${i + 1}`, previewId: `buildings-preview-${i + 1}`,
  count: 240, center: [i * 100, 0], bounds: [i * 100, 0, i * 100 + 50, 50],
}));

test("return trips keep five uploaded districts and reserve space for all pending detail", () => {
  const attached = districts.slice(0, 15).map(d => d.id);
  const wanted = districts.slice(15, 30).map(d => d.id);
  const lastUsed = new Map(attached.map((id, index) => [id, index]));
  const retained = retainedBuildingDetailIds(districts, wanted, attached, lastUsed);
  expect([...retained]).toEqual(attached.slice(10).reverse());
  expect((wanted.length + retained.size) * 240).toBe(MOBILE_DETAIL_CACHE_PART_LIMIT);
  const returning = retainedBuildingDetailIds(districts, attached, [...retained, ...wanted], lastUsed);
  expect(attached.slice(10).every(id => returning.has(id))).toBeTrue();
  expect(returning.size).toBe(10); // five restored from cache and five return-route spares
});

test("recently viewed cached districts win over older buffers and unknown IDs cannot consume spare slots", () => {
  const attached = districts.slice(0, 15).map(d => d.id);
  const wanted = districts.slice(15, 30).map(d => d.id);
  const lastUsed = new Map([[attached[0], 1000], [attached[1], 999]]);
  const retained = retainedBuildingDetailIds(districts, wanted, [...attached, "surface-water"], lastUsed);
  expect([...retained].slice(0, 2)).toEqual(attached.slice(0, 2));
  expect(retained.size).toBe(5);
  expect(retained.has("surface-water")).toBeFalse();
  const large = districts.map(d => ({...d, count: 900}));
  const bounded = retainedBuildingDetailIds(large, wanted.slice(0, 4), attached, lastUsed);
  expect(bounded.size).toBe(1);
});

test("long travel keeps residency bounded and never excludes attached requested districts", () => {
  let attached: string[] = [];
  const lastUsed = new Map<string, number>();
  for (let step = 0; step < 180; step++) {
    const start = Math.round((Math.sin(step / 20) + 1) * 22);
    const wanted = districts.slice(start, start + 15).map(d => d.id);
    wanted.forEach(id => lastUsed.set(id, step));
    const retained = retainedBuildingDetailIds(districts, wanted, attached, lastUsed);
    expect(attached.filter(id => wanted.includes(id)).every(id => retained.has(id))).toBeTrue();
    attached = [...new Set([...retained, ...wanted])];
    expect(attached.length).toBeLessThanOrEqual(20);
    expect(attached.length * 240).toBeLessThanOrEqual(MOBILE_DETAIL_CACHE_PART_LIMIT);
  }
});

test("desktop reserves its existing 9,000-part detail capacity without accumulating visited districts", () => {
  const full = districts.map(d => ({ ...d, count: 600 }));
  let attached: string[] = [];
  const lastUsed = new Map<string, number>();
  for (let step = 0; step < 150; step++) {
    const start = Math.round((Math.sin(step / 10) + 1) * 22);
    const wanted = full.slice(start, start + 15).map(d => d.id);
    wanted.forEach(id => lastUsed.set(id, step));
    const retained = retainedBuildingDetailIds(full, wanted, [...attached, "surface-water"], lastUsed, "full");
    expect([...retained].every(id => wanted.includes(id))).toBeTrue();
    expect(attached.filter(id => wanted.includes(id)).every(id => retained.has(id))).toBeTrue();
    attached = [...new Set([...retained, ...wanted])];
    expect(attached.length * 600).toBe(9_000);
  }
});
