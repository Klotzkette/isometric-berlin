const PITCH_COLOR = 9993839;
export const WEINBERG_PITCH_SEPARATION_V255 = 0.02;
const bounds = [2193, -1536, 2228, -1492] as const;

function withinPitchBounds(x0: number, z0: number, x1: number, z1: number): boolean {
  return x0 >= bounds[0] && z0 >= bounds[1] && x1 <= bounds[2] && z1 <= bounds[3];
}

/** Four retained pitch sheets share the playground's old 3.23 m baseline.
 * Separate only their display layers; retain every source point and DGM slope.
 */
export function separateWeinbergPitchSheetV255<
  T extends { kind: string; color: number; triangles: number[][][] },
>(sheet: T): T {
  if (sheet.kind !== "pitch" || sheet.color !== PITCH_COLOR ||
      !sheet.triangles.every(t => t.every(p =>
        Math.abs(p[1] - 3.23) < 1e-8 && withinPitchBounds(p[0], p[2], p[0], p[2])))) return sheet;
  return {
    ...sheet,
    triangles: sheet.triangles.map(t =>
      t.map(p => [p[0], p[1] + WEINBERG_PITCH_SEPARATION_V255, p[2]])),
  };
}

/** The corresponding 47 native runs keep their complete orthogonal volumes. */
export function separateWeinbergPitchRowV255(row: number[]): number[] {
  const [x, y, z, w, h, d, color] = row;
  if (color !== PITCH_COLOR || Math.abs(y + h / 2 - 3.23) > 1e-8 ||
      !withinPitchBounds(x - w / 2, z - d / 2, x + w / 2, z + d / 2)) return row;
  return [x, y + WEINBERG_PITCH_SEPARATION_V255, z, w, h, d, color];
}
