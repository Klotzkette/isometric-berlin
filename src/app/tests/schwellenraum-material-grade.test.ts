import { describe, expect, test } from "bun:test";
import { Group, MeshBasicMaterial, MeshStandardMaterial } from "three";

import {
  SCHWELLENRAUM_MATERIAL_GRADE,
  schwellenraumGradeFragmentShaderForTest,
  schwellenraumMaterialFor,
  setSchwellenraumStandardMaterialTone,
} from "../src/visual-modes/schwellenraum/materialGrade";

describe("Schwellenraum material-integrated colour grade", () => {
  test("keeps the grade restrained and free of an extra render pass", () => {
    expect(SCHWELLENRAUM_MATERIAL_GRADE.saturation).toBeGreaterThan(0.25);
    expect(SCHWELLENRAUM_MATERIAL_GRADE.saturation).toBeLessThan(0.4);
    expect(SCHWELLENRAUM_MATERIAL_GRADE.strength).toBeLessThanOrEqual(0.85);
    const source = "vec3 outgoingLight = diffuseColor.rgb;\n#include <opaque_fragment>";
    const patched = schwellenraumGradeFragmentShaderForTest(source);
    expect(patched).toContain("schwellenraumLuma");
    expect(patched).toContain("schwellenraumTinted");
    expect(patched).toContain("#include <opaque_fragment>");
  });

  test("creates one cached clone without changing the exact Day material", () => {
    const object = new Group();
    const day = new MeshBasicMaterial({ color: 0xc8a884 });
    const first = schwellenraumMaterialFor(object, day);
    const second = schwellenraumMaterialFor(object, day);
    expect(first).toBe(second);
    expect(first).not.toBe(day);
    expect(day.color.getHex()).toBe(0xc8a884);
    expect(first.userData.schwellenraumMaterialGrade).toBeTrue();
  });

  test("losslessly restores ordinary lit material colour", () => {
    const material = new MeshStandardMaterial({ color: 0x5f8d4e });
    setSchwellenraumStandardMaterialTone(material, "schwellenraum");
    expect(material.color.getHex()).not.toBe(0x5f8d4e);
    setSchwellenraumStandardMaterialTone(material, "day");
    expect(material.color.getHex()).toBe(0x5f8d4e);
  });
});
