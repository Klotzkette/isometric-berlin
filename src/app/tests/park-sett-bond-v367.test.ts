import { expect, test } from "bun:test";
import { createParkPathSurfaceTexture } from "../src/ParkDetails";

test("granite setts keep their half-bond across both repeat seams", () => {
  const texture = createParkPathSurfaceTexture("c");
  const { data, width, height } = texture.image;
  const joint = (x: number, y: number) => data[4 * ((y % height) * width + x % width)] === 202;
  for (let row = 0; row < height / 8 + 1; row++) {
    const firstJoint = (row % 2) * 8;
    for (let x = 0; x < 2 * width; x++) {
      expect(joint(x, row * 8)).toBe(true);
      expect(joint(x, row * 8 + 4)).toBe(x % 16 === firstJoint);
    }
  }
  texture.dispose();
});
