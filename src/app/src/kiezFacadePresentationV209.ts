/** Finite presentation rectangles, not new geographic coverage. The already
 * existing generic facade-axis material is the only caller of this hook. */
export const KIEZ_FACADE_DISPLAY_ZONES_V209 = [
  [-4030, 184, -2575, 188], // Whole Moabit; same existing v188 display boundary.
  [2100, 3000, -2360, -1020], // Weinbergsweg / Kastanienallee.
  [2850, 3700, -2450, -1610], // Kollwitzkiez.
  [3100, 3550, -2900, -2430], // Helmholtzplatz immediate perimeter.
] as const;

/** Slightly strengthen retained source axes; preserve stronger earlier emphasis,
 * all vertex topology, source paint, named hero materials and mobile detail. */
export function kiezFacadeInkShaderV209(vertexShader: string, fragmentShader: string): { vertexShader: string; fragmentShader: string } {
  if (vertexShader.includes("vKiezFacadeV209")) return { vertexShader, fragmentShader };
  const ranges = KIEZ_FACADE_DISPLAY_ZONES_V209.map(([x0, x1, z0, z1]) =>
    `step(${x0.toFixed(1)}, urbanXZ.x) * step(urbanXZ.x, ${x1.toFixed(1)}) * step(${z0.toFixed(1)}, urbanXZ.y) * step(urbanXZ.y, ${z1.toFixed(1)})`).join(" + ");
  return {
    vertexShader: `varying float vKiezFacadeV209;\n${vertexShader}`.replace(
      "vUrbanFacadeEmphasis = min(1.0,",
      `vKiezFacadeV209 = min(1.0, ${ranges});\nvUrbanFacadeEmphasis = min(1.0,`,
    ),
    fragmentShader: `varying float vKiezFacadeV209;\n${fragmentShader}`.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\nfloat kiezEmphasisV209 = vKiezFacadeV209 * (1.0 - vUrbanFacadeEmphasis);\ndiffuseColor.rgb *= mix(1.0, 0.82, kiezEmphasisV209);\ndiffuseColor.a = min(1.0, diffuseColor.a * mix(1.0, 1.12, kiezEmphasisV209));",
    ),
  };
}
