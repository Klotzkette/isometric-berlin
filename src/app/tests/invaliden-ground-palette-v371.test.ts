import { expect, test } from "bun:test";
import { createInvalidenGroundV371 } from "../src/InvalidenGroundV371";
import { createInvalidenParkGroundV371 } from "../src/InvalidenParkGroundV371";

test("local ground passes daylight palette values to the drawn compositor exactly once", () => {
  const swatches = (mesh: ReturnType<typeof createInvalidenGroundV371>) => {
    const colors = mesh.geometry.getAttribute("color");
    const values = new Set<number>();
    for (let i = 0; i < colors.count; i++) {
      const rgb = [colors.getX(i), colors.getY(i), colors.getZ(i)].map(value => Math.round(255 * value));
      values.add((rgb[0] << 16) | (rgb[1] << 8) | rgb[2]);
    }
    return values;
  };
  const roads = swatches(createInvalidenGroundV371(() => 5));
  const park = swatches(createInvalidenParkGroundV371(() => 5));
  expect(roads.has(0x646966)).toBe(true);
  expect(roads.has(0x809569)).toBe(true);
  expect(park.has(0x809569)).toBe(true);
  expect(park.has(0xadaaa2)).toBe(true);
});
