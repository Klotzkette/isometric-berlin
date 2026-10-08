import { Group } from "three";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Small final-count batches keep distant 512 m cells independently culled. */
export function altMitteEdgesV186Batches(cells: readonly { cell: string; rows: number[][] }[], native: boolean): Group {
  const root = new Group();
  root.name = native ? "Alt-Mitte independent native facade edges v186" : "Alt-Mitte measured street-wall edge relief v186";
  root.userData = {
    altMitteEdgesV186: true, textureFree: true, additiveOnly: true,
    sourceGeometryRetained: true, fullStaticDetailOnTouch: true,
    keepInMinecraft: native, blockNative: native, independentNativeGeometry: native,
    profileStatus: "Two thin display edge estimates on existing measured street walls; no new window or entrance claims.",
  };
  for (const cell of cells) {
    const mesh = justicePalaceV183Boxes(native ? nativeContourRows(cell.rows) : cell.rows, native);
    mesh.name = `Alt-Mitte source wall edge cell ${cell.cell}`;
    mesh.userData.spatialCell = cell.cell;
    root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}

/** Materialize only the selected mode, one spatial cell at a time. */
export function nativeContourRows(profiles: readonly number[][]): number[][] {
  const rows: number[][] = [];
  for (const r of profiles) {
    const dx = Math.cos(r[6]), dz = -Math.sin(r[6]);
    const nx = -dz * r[8], nz = dx * r[8];
    const offset = 1.15 - r[5] / 2 - .035;
    const count = Math.ceil(r[3] / 2.4), step = r[3] / count;
    for (let i = 0; i < count; i++) {
      const u = (i + .5) * step - r[3] / 2;
      rows.push([
        r[0] + dx * u + nx * offset, r[1], r[2] + dz * u + nz * offset,
        Math.abs(dx) * step + Math.abs(nx) * .36, r[4],
        Math.abs(dz) * step + Math.abs(nz) * .36, r[7],
      ]);
    }
  }
  return rows;
}
