import { describe, expect, test } from "bun:test";
import { Color, Group, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { groundRangeShaderSafeV383 } from "../src/groundRangeShaderProvenanceV383";

import {
  SCHWELLENRAUM_MATERIAL_GRADE,
  schwellenraumGradeFragmentShaderForTest,
  schwellenraumMaterialFor,
  setSchwellenraumStandardMaterialTone,
} from "../src/visual-modes/schwellenraum/materialGrade";

describe("Schwellenraum material-integrated colour grade", () => {
  test("keeps the grade restrained and free of an extra render pass", () => {
    expect(SCHWELLENRAUM_MATERIAL_GRADE.saturation).toBeLessThan(1);
    expect(SCHWELLENRAUM_MATERIAL_GRADE.strength).toBeLessThanOrEqual(0.85);
    expect(SCHWELLENRAUM_MATERIAL_GRADE.tint[2]).toBeGreaterThan(
      SCHWELLENRAUM_MATERIAL_GRADE.tint[0],
    );
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
    expect(groundRangeShaderSafeV383(first)).toBe(true);
  });

  test("retains Berlin's red brick, green leaves and legible grey midtones", () => {
    function grade(hex: number) {
      const m = new MeshStandardMaterial({color: hex});
      setSchwellenraumStandardMaterialTone(m, "schwellenraum");
      return m.color;
    }
    const stone = grade(0xc8a884), brick = grade(0x974c38), leaves = grade(0x5f8d4e);
    expect(brick.r - brick.g).toBeGreaterThan(0.13);
    expect(leaves.g - leaves.r).toBeGreaterThan(0.13);
    expect(stone.r - stone.b).toBeGreaterThan(0.2);
    const neutral = new Color(0x808080), graded = grade(0x808080);
    const luma = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    expect(Math.abs(luma(graded) - luma(neutral))).toBeLessThan(0.025);
  });

  test("retains displaced third-party materials on their complete drawing path", () => {
    class Displaced extends MeshBasicMaterial {
      override onBeforeCompile = (shader: Parameters<MeshBasicMaterial["onBeforeCompile"]>[0]) => {
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
          "#include <begin_vertex>\ntransformed.x += float(gl_InstanceID);");
      };
    }
    const graded = schwellenraumMaterialFor(new Group(), new Displaced());
    expect(groundRangeShaderSafeV383(graded)).toBe(false);
  });

  test("losslessly restores ordinary lit material colour", () => {
    const material = new MeshStandardMaterial({ color: 0x5f8d4e });
    setSchwellenraumStandardMaterialTone(material, "schwellenraum");
    expect(material.color.getHex()).not.toBe(0x5f8d4e);
    setSchwellenraumStandardMaterialTone(material, "day");
    expect(material.color.getHex()).toBe(0x5f8d4e);
    material.color.setRGB(0.1781, 0.2487, 0.3913);
    const source = material.color.clone();
    setSchwellenraumStandardMaterialTone(material, "schwellenraum");
    setSchwellenraumStandardMaterialTone(material, "schwellenraum");
    setSchwellenraumStandardMaterialTone(material, "day");
    expect(material.color.equals(source)).toBe(true);
  });

  test("separates warm stone highlights from cool shadows without flattening their contrast", () => {
    const highlight = new MeshStandardMaterial({ color: 0xe3e3e3 });
    const shadow = new MeshStandardMaterial({ color: 0x303030 });
    setSchwellenraumStandardMaterialTone(highlight, "schwellenraum");
    setSchwellenraumStandardMaterialTone(shadow, "schwellenraum");
    expect(highlight.color.r).toBeGreaterThan(highlight.color.b);
    expect(shadow.color.b).toBeGreaterThan(shadow.color.r);
    expect(highlight.color.r - shadow.color.r).toBeGreaterThan(0.65);

    const first = highlight.color.getHex();
    setSchwellenraumStandardMaterialTone(highlight, "schwellenraum");
    expect(highlight.color.getHex()).toBe(first);
    setSchwellenraumStandardMaterialTone(highlight, "night");
    expect(highlight.color.getHex()).toBe(0xe3e3e3);
  });
});
