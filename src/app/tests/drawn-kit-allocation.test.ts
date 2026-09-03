import { describe, expect, test } from "bun:test";
import { BoxGeometry, EdgesGeometry } from "three";
import { addBox, createBuilder, paintGeometry } from "../src/drawnKit";
import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "../src/architecturalInk";

describe("lossless drawn box construction", () => {
  test("matches legacy positions, indices, colours and ink byte for byte", () => {
    for (let i = 0; i < 80; i += 1) {
      const sx = i === 0 ? 0 : i === 1 ? -2 : 0.003 + (i * 7.317) % 84;
      const sy = 0.019 + (i * 2.891) % 32, sz = 0.05 + (i * 3.621) % 7;
      const x = 5500.125 - i * 63.763, y = i * 1.37, z = -1400.36 + i * 17.619;
      const yaw = i % 5 === 0 ? 0 : i * 0.0783, color = 0xb2ac87;
      const old = new BoxGeometry(sx, sy, sz);
      if (yaw !== 0) old.rotateY(yaw);
      old.translate(x, y, z);
      paintGeometry(old, color);
      const oldEdges = new EdgesGeometry(old, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES);
      const builder = createBuilder();
      addBox(builder, color, x, y, z, sx, sy, sz, yaw);
      const actual = builder.parts[0];
      for (const key of Object.keys(old.attributes))
        expect(Buffer.from(actual.getAttribute(key).array.buffer)).toEqual(Buffer.from(old.getAttribute(key).array.buffer));
      expect(actual.index?.array).toEqual(old.index?.array);
      expect(builder.edges[0].getAttribute("position").array).toEqual(oldEdges.getAttribute("position").array);
      expect(actual.getAttribute("normal")).toBeUndefined();
      expect(actual.getAttribute("uv")).toBeUndefined();
      old.dispose(); oldEdges.dispose(); actual.dispose(); builder.edges[0].dispose();
    }
  });

  test("owns mutable buffers independently across repeated parts", () => {
    const builder = createBuilder();
    addBox(builder, 0xffffff, 0, 0, 0, 1, 2, 3);
    addBox(builder, 0xffffff, 0, 0, 0, 1, 2, 3);
    const [a, b] = builder.parts;
    expect(a.index?.array).not.toBe(b.index?.array);
    expect(a.getAttribute("position").array).not.toBe(b.getAttribute("position").array);
    a.index!.setX(0, 7);
    expect(b.index!.getX(0)).not.toBe(7);
  });
});
