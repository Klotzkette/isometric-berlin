import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CRISPNESS_PROFILES } from "../src/crispnessProfile";

const crispFragment = readFileSync(
  join(import.meta.dir, "..", "src", "crisp.frag"),
  "utf-8",
);

describe("isometric crispness profile", () => {
  test("pins the settled sharpening and edge strengths per mode", () => {
    expect(CRISPNESS_PROFILES.day.strength).toBe(0.48);
    expect(CRISPNESS_PROFILES.night.strength).toBe(0.4);
    expect(CRISPNESS_PROFILES.day.edgeStrength).toBe(0.25);
    expect(CRISPNESS_PROFILES.night.edgeStrength).toBe(0.35);
    // Minecraft bypasses the crisp pass; its edgeStrength feeds the
    // edgeMix uniform of the minecraft postprocess shader (v0.5.3).
    expect(CRISPNESS_PROFILES.minecraft.edgeStrength).toBe(0.85);
    expect(CRISPNESS_PROFILES.minecraft.strength).toBe(0);
  });

  test("crisp shader draws the isometric edge and spares vegetation", () => {
    expect(crispFragment).toContain("uniform float edgeStrength");
    expect(crispFragment).toContain("greenDominance");
    expect(crispFragment).toContain("mix(colour, edgeColour, edge * edgeStrength)");
  });

  test("post-processing is strictly screen-space (accuracy contract)", () => {
    // The crisp pass must never displace geometry: it may only sample
    // tDiffuse in the fragment stage. Any gl_Position or vertex-stage
    // manipulation here would break the <= 1 px landmark-centre contract.
    expect(crispFragment).not.toContain("gl_Position");
    expect(crispFragment).not.toContain("modelViewMatrix");
    const samplerUses = crispFragment.match(/texture2D\(tDiffuse/g) ?? [];
    expect(samplerUses.length).toBeGreaterThanOrEqual(5);
  });
});
