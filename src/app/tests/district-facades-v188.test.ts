import { expect, test } from "bun:test";
import { ShaderLib } from "three";
import { readFileSync } from "node:fs";
import { districtFacadeInkShaderV188, DISTRICT_FACADE_DISPLAY_ZONES_V188 } from "../src/districtFacadePresentationV188";
import { urbanFacadeInkShader } from "../src/urbanFacadePresentation";

test("seven finite display rectangles refine existing axes without new geometry", () => {
  expect(DISTRICT_FACADE_DISPLAY_ZONES_V188).toHaveLength(7);
  const source = ShaderLib.dashed;
  const result = urbanFacadeInkShader(source.vertexShader, source.fragmentShader);
  expect(result.vertexShader).toContain("vUrbanFacadeEmphasis = min(1.0,");
  expect(result.vertexShader).toContain("vDistrictFacadeV188 = min(1.0,");
  expect(result.fragmentShader).toContain("vDistrictFacadeV188 * (1.0 - vUrbanFacadeEmphasis)");
  expect(result.fragmentShader).toContain("mix(1.0, 0.78, districtEmphasisV188)");
  expect(result.fragmentShader).toContain("mix(1.0, 0.6, vUrbanFacadeEmphasis)");
  expect(urbanFacadeInkShader(result.vertexShader, result.fragmentShader)).toEqual(result);
  expect(districtFacadeInkShaderV188(result.vertexShader, result.fragmentShader)).toEqual(result);
  // ShaderLib and every other material shader remain immutable.
  expect(ShaderLib.dashed.vertexShader).toBe(source.vertexShader);
  expect(ShaderLib.basic.vertexShader).not.toContain("vDistrictFacadeV188");
});

test("the existing material gate remains specific to LoD2 facade axes", () => {
  const city = readFileSync(new URL("../src/IsometricCityWorld.ts", import.meta.url), "utf8");
  expect(city.match(/\.userData\.urbanFacadeContrast = true/g)).toHaveLength(1);
  expect(city).toContain('axes.name = "LoD2 facade axes";\n    axes.material.userData.urbanFacadeContrast = true;');
  const viewer = readFileSync(new URL("../src/ThreeViewer.tsx", import.meta.url), "utf8");
  expect(viewer).toContain("if (urbanContrast) Object.assign(shader, urbanFacadeInkShader(shader.vertexShader, shader.fragmentShader));");
});
