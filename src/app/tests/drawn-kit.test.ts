import { describe, expect, test } from "bun:test";
import { BoxGeometry, Color } from "three";

import { paintGeometry } from "../src/drawnKit";

describe("drawn geometry palette storage", () => {
  test("stores the visible 8-bit palette without Float32 colour ballast", () => {
    const geometry = new BoxGeometry(1, 1, 1);
    const tone = 0xc8a45a;
    paintGeometry(geometry, tone);

    const attribute = geometry.getAttribute("color");
    const expected = new Color(tone);
    expect(attribute.array).toBeInstanceOf(Uint8Array);
    expect(attribute.normalized).toBe(true);
    expect(attribute.getX(0)).toBeCloseTo(expected.r, 2);
    expect(attribute.getY(0)).toBeCloseTo(expected.g, 2);
    expect(attribute.getZ(0)).toBeCloseTo(expected.b, 2);
    expect(geometry.hasAttribute("normal")).toBe(false);
    expect(geometry.hasAttribute("uv")).toBe(false);

    geometry.dispose();
  });
});
