/** Finite display rectangles enclosing the seven requested ALKIS districts.
 * They affect existing generic facade strokes only, including already covered
 * adjoining blocks at rectangular margins. They are not administrative borders
 * and cannot add buildings, extend residency or create a window survey. */
export const DISTRICT_FACADE_DISPLAY_ZONES_V188 = [
  [-4665, 282, -5121, -1873], // Covered Wedding; no completion of the whole district.
  [-4030, 184, -2575, 188], // Moabit.
  [-2832, 394, -432, 2242], // Tiergarten.
  [-283, 5506, 1102, 4071], // Kreuzberg.
  [3294, 8071, -1243, 3818], // Friedrichshain.
  [-6172, -2073, -1584, 2125], // Charlottenburg.
  [-2518, 270, 1514, 7141], // Schöneberg.
] as const;

/** Called only through the existing `LoD2 facade axes` material shader hook.
 * Earlier emphasis wins, preserving its exact result. Hero materials, source
 * surface colours, glass, line topology and every view distance stay intact. */
export function districtFacadeInkShaderV188(vertexShader: string, fragmentShader: string): { vertexShader: string; fragmentShader: string } {
  if (vertexShader.includes("vDistrictFacadeV188")) return { vertexShader, fragmentShader };
  const ranges = DISTRICT_FACADE_DISPLAY_ZONES_V188.map(([x0,x1,z0,z1]) =>
    `step(${x0.toFixed(1)}, urbanXZ.x) * step(urbanXZ.x, ${x1.toFixed(1)}) * step(${z0.toFixed(1)}, urbanXZ.y) * step(urbanXZ.y, ${z1.toFixed(1)})`).join(" + ");
  return {
    vertexShader: `varying float vDistrictFacadeV188;\n${vertexShader}`.replace(
      "vUrbanFacadeEmphasis = min(1.0,",
      `vDistrictFacadeV188 = min(1.0, ${ranges});\nvUrbanFacadeEmphasis = min(1.0,`,
    ),
    fragmentShader: `varying float vDistrictFacadeV188;\n${fragmentShader}`.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\nfloat districtEmphasisV188 = vDistrictFacadeV188 * (1.0 - vUrbanFacadeEmphasis);\ndiffuseColor.rgb *= mix(1.0, 0.78, districtEmphasisV188);\ndiffuseColor.a = min(1.0, diffuseColor.a * mix(1.0, 1.18, districtEmphasisV188));",
    ),
  };
}
