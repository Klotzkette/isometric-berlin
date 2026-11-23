import { expect, test } from "bun:test";
import { nativeRoofCellLookup, nativeRoofRunLookup } from "../src/nativeRoofLookup";

test("native roof cells are indexed on first use and preserve the last surveyed value", () => {
  let reads = 0;
  const getHeight = nativeRoofCellLookup(() => {
    reads++;
    return [[-1.5, 3.5, 17.625], [-0.1, 2.5, -0], [0, 2, 14]];
  }, 2);
  expect(reads).toBe(0);
  expect(Object.is(getHeight(-1, 1), -0)).toBe(true);
  expect(getHeight(0, 1)).toBe(14);
  expect(getHeight(1, 1)).toBeNull();
  expect(reads).toBe(1);

  const indexed = nativeRoofCellLookup(() => [[-12, 19, 20.25]]);
  expect(indexed(-12, 19)).toBe(20.25);
  expect(indexed(-6, 9)).toBeNull();
});

test("overlapping roof runs retain their final occupied cells and terrain heights", () => {
  const samples: number[][] = [];
  const getHeight = nativeRoofRunLookup(
    () => [[-2, 2, 9, 20], [-1, 1, 9, 4], [2, 3, 7, 12]],
    (x, z) => {
      samples.push([x, z]);
      return x + z;
    },
  );
  expect(samples).toHaveLength(0);
  expect(getHeight(-3, 9)).toBeNull();
  expect(getHeight(-2, 9)).toBe(28);
  expect(getHeight(-1, 9)).toBe(13);
  expect(getHeight(0, 9)).toBe(14);
  expect(getHeight(1, 9)).toBe(31);
  expect(getHeight(2, 9)).toBeNull();
  expect(getHeight(2, 7)).toBe(22);
  expect(samples).toEqual([[-1.5, 9.5], [-0.5, 9.5], [0.5, 9.5], [1.5, 9.5], [2.5, 7.5]]);
});
