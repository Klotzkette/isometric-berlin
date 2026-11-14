import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";

/** Shallow joinery inside existing panes; this never introduces another window grid.
 * Native receives its own already fitted cardinal pane rows, not rotated Drawn boxes.
 * Fine bead widths and colour are reference-based presentation estimates. */
export function schoolJoineryRowsV341(rows: readonly number[][], native: boolean): number[][] {
  const out: number[][] = [];
  for (const r of rows) {
    const color = r[native ? 6 : 7];
    if (color !== 0x819a9b || r[4] < 1.6 || r[4] > 4.1) continue;
    const axis = native && r[3] < r[5] ? 2 : 0;
    const width = r[axis + 3], depth = r[5 - axis];
    if (width < .34 || width > 1.85 || depth > .16) continue;
    const yaw = native ? 0 : r[6];
    const put = (u: number, y: number, w: number, h: number, rgb: number) => {
      const p = r.slice(0, 3);
      p[1] = y;
      if (native) p[axis] += u;
      else { p[0] += Math.cos(yaw) * u; p[2] -= Math.sin(yaw) * u; }
      // Both outer pane faces are covered by the thin bead, avoiding a guessed
      // outward normal while staying entirely inside the original aperture.
      const size = axis === 0 ? [w, h, depth + .034] : [depth + .034, h, w];
      out.push([...p, ...size, ...(native ? [] : [yaw]), rgb]);
    };
    const edge = width / 2 - .10, half = r[4] / 2 - .12;
    if (edge < .065) continue;
    // Fine inner sash beads leave the broad cream casing and old centre mullion visible.
    for (const sign of [-1, 1]) put(sign * edge, r[1], .025, 2 * half, 0xc6c3b4);
    for (const sign of [-1, 1]) put(0, r[1] + sign * half, 2 * edge, .028, 0xc6c3b4);
    // Lower glass meeting rail is split around the retained central mullion.
    for (const sign of [-1, 1]) put(sign * (edge + .065) / 2, r[1] - .38, edge - .065, .024, 0x626e69);
  }
  return out;
}

export function createSteglitzJoineryV341(rows: readonly number[][], native: boolean) {
  const details = schoolJoineryRowsV341(rows, native);
  if (!details.length) return null;
  const mesh = justicePalaceV183Boxes(details, native);
  mesh.name = "Gymnasium Steglitz — inset historic sash beads v341";
  mesh.userData = { ...mesh.userData, westRefinementV341: "steglitz", fullStaticDetailOnTouch: true, sourceGeometryRetained: true };
  return mesh;
}

/** Existing Tiergarten reveal rows already use measured wall sheets and distinct
 * native support faces. Add a shallow aluminium inner edge to those exact jambs. */
export function createTiergartenJoineryV341(rows: readonly number[][], native: boolean) {
  const out: number[][] = [];
  for (const r of rows) {
    if (r[native ? 6 : 7] !== 0xbbc0b7 || r[4] < 1.8) continue;
    const copy = [...r];
    if (!native) { copy[3] *= .42; copy[5] += .028; }
    else {
      const normalSize = r[3] > r[5] ? 3 : 5;
      copy[normalSize] += .028;
      copy[normalSize === 3 ? 5 : 3] *= .42;
    }
    copy[native ? 6 : 7] = 0xe4e6dd;
    // The new profiles share the actual retained support, with no façade relocation.
    out.push(copy);
  }
  if (!out.length) return null;
  const mesh = justicePalaceV183Boxes(out, native);
  mesh.name = "Gymnasium Tiergarten — renovated aluminium reveal profiles v341";
  mesh.userData = { ...mesh.userData, westRefinementV341: "tiergarten", fullStaticDetailOnTouch: true, sourceGeometryRetained: true };
  return mesh;
}
