import { describe, expect, test } from "bun:test";

import { civicDetailsVisible } from "../src/ThreeViewer";

const viewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
).text();

describe("idle-frame anti-flicker contract", () => {
  test("preserves the last settled WebGL frame for Safari compositing", () => {
    expect(viewerSource).toContain("preserveDrawingBuffer: true");
    expect(viewerSource).toContain("if (!renderRequired)");
  });

  test("keeps authored civic flags in every above-ground visual mode", () => {
    for (const mode of ["day", "night", "minecraft"] as const) {
      expect(civicDetailsVisible(false), mode).toBe(true);
    }
    expect(civicDetailsVisible(true)).toBe(false);
  });
});
