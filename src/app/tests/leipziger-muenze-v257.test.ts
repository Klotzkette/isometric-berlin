import { describe, expect, it } from "bun:test";
import { Color, InstancedMesh, Matrix4 } from "three";
import previous from "../src/data/altMitteEdgesV186.json";
import source from "../src/data/leipzigerMuenzeV257.json";
import cinemas from "../src/data/eastCinemasV260.json";
import { altMitteEdgesV186Batches, nativeContourRows } from "../src/altMitteEdgesV186Batches";
import { LEIPZIGER_MUENZE_V257, leipzigerMuenzeV257Rows } from "../src/leipzigerMuenzeV257";

// Released in 323d85f8, after this v257 test: only the exact old cinema edge
// crossing its source-bound nine-metre recess is shortened. Reconstruct its
// retained endpoint segment independently; do not call the production filter.
const cinemaEdge = [3520.206, 3.3, -111.545, 37.243, .25, .16, -2.047788, 11644834, -1];
function retainedV260Profiles(cell: { cell: string; rows: number[][] }): number[][] {
  if (cell.cell !== "6:-1") return cell.rows;
  expect(cell.rows[49]).toEqual(cinemaEdge);
  const face = cinemas.sites.international;
  expect(face.frontA).toEqual([3476.469, -103.914]);
  expect(face.inward).toEqual([0.4598258755046059, -0.8880091014265691]);
  expect(face.cantileverM).toBe(9);
  const r = cell.rows[49], dx = Math.cos(r[6]), dz = -Math.sin(r[6]);
  const a = [r[0] - dx * r[3] / 2, r[2] - dz * r[3] / 2];
  const b = [r[0] + dx * r[3] / 2, r[2] + dz * r[3] / 2];
  const depth = (p: number[]) => (p[0] - face.frontA[0]) * face.inward[0] + (p[1] - face.frontA[1]) * face.inward[1];
  expect(depth(a)).toBeGreaterThan(9); expect(depth(b)).toBeLessThan(9);
  const t = (9 - depth(a)) / (depth(b) - depth(a));
  const cut = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const kept = Math.hypot(cut[0] - a[0], cut[1] - a[1]);
  const corrected = [(a[0] + cut[0]) / 2, r[1], (a[1] + cut[1]) / 2, kept, ...r.slice(4)];
  expect(depth(cut)).toBeCloseTo(9, 9);
  expect(r[3] - kept).toBeGreaterThan(0); expect(r[3] - kept).toBeLessThan(1);
  expect(corrected[0] - dx * kept / 2).toBeCloseTo(a[0], 9);
  expect(corrected[2] - dz * kept / 2).toBeCloseTo(a[1], 9);
  return cell.rows.map((row, i) => i === 49 ? corrected : row);
}

describe("v257 Alte Münze and Leipziger Straße", () => {
  it("uses only existing spatial cells and independent finite surface rows", () => {
    const existing = new Set(previous.cells.map(cell => cell.cell));
    let drawn = 0, native = 0;
    for (const [id, packed] of Object.entries(source.cells)) {
      expect(existing.has(id)).toBe(true);
      for (const mode of [false, true]) {
        const rows = leipzigerMuenzeV257Rows(id, mode);
        expect(rows.length).toBe(mode ? packed.native.length : packed.drawn.length);
        for (const row of rows) {
          expect(row.length).toBe(mode ? 7 : 8);
          expect(row.every(Number.isFinite)).toBe(true);
          expect(row.slice(3, 6).every(value => value > 0)).toBe(true);
          expect(Math.floor(row[0] / 512) + ":" + Math.floor(row[2] / 512)).toBe(id);
        }
        if (mode) native += rows.length; else drawn += rows.length;
      }
    }
    expect(drawn).toBe(LEIPZIGER_MUENZE_V257.drawnRows);
    expect(native).toBe(LEIPZIGER_MUENZE_V257.nativeRows);
    expect(native).toBeGreaterThan(drawn);
    expect(leipzigerMuenzeV257Rows("missing", false)).toEqual([]);
  });

  it("keeps the old prefix except the exact v260 cinema recess and retains the draw-call count", () => {
    const snapshot = JSON.stringify(previous);
    expect(previous.cells.flatMap(c => c.rows).filter(r => r.length === cinemaEdge.length && r.every((v,i) => v === cinemaEdge[i]))).toHaveLength(1);
    for (const native of [false, true]) {
      const root = altMitteEdgesV186Batches(previous.cells, native);
      expect(root.children.length).toBe(previous.cells.length);
      let bytes = 0, beforeBytes = 0, geometryBytes = 0;
      for (let i = 0; i < previous.cells.length; i++) {
        const old = previous.cells[i];
        const profiles = retainedV260Profiles(old);
        const originalRows = native ? nativeContourRows(old.rows) : old.rows;
        const rows = native ? nativeContourRows(profiles) : profiles;
        expect(rows.length).toBe(originalRows.length);
        const mesh = root.children[i] as InstancedMesh;
        expect(mesh.count).toBe(rows.length + leipzigerMuenzeV257Rows(old.cell, native).length);
        const actual = new Matrix4(), expected = new Matrix4();
        rows.forEach((r, j) => {
          mesh.getMatrixAt(j, actual);
          expected.makeRotationY(native ? 0 : r[6]);
          expected.elements[0] *= r[3]; expected.elements[1] *= r[3]; expected.elements[2] *= r[3];
          expected.elements[4] *= r[4]; expected.elements[5] *= r[4]; expected.elements[6] *= r[4];
          expected.elements[8] *= r[5]; expected.elements[9] *= r[5]; expected.elements[10] *= r[5];
          expected.setPosition(r[0], r[1], r[2]);
          expect(actual.elements.map(value => value || 0)).toEqual(Array.from(new Float32Array(expected.elements), value => value || 0));
          expect(Array.from(mesh.instanceColor!.array.slice(j * 3, j * 3 + 3)))
            .toEqual(Array.from(new Float32Array(new Color(r[native ? 6 : 7]).toArray())));
        });
        bytes += mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0);
        beforeBytes += originalRows.length * 76;
        geometryBytes += Object.values(mesh.geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0) + (mesh.geometry.index?.array.byteLength ?? 0);
        mesh.geometry.dispose();
        for (const key of ["dayMaterial", "nightMaterial"]) mesh.userData[key]?.dispose();
      }
      // Unchanged existing residency policy; this is the exact constructor
      // footprint, not a request to enlarge any live limit.
      expect(bytes - beforeBytes).toBe((native ? LEIPZIGER_MUENZE_V257.nativeRows : LEIPZIGER_MUENZE_V257.drawnRows) * 76);
      console.info(`v186 ${native ? "native" : "drawn"} total instance bytes: ${beforeBytes} -> ${bytes}`);
      console.info(`v186 ${native ? "native" : "drawn"} complete geometry/instance bytes: ${beforeBytes + geometryBytes} -> ${bytes + geometryBytes}; draw calls ${root.children.length}`);
    }
    expect(JSON.stringify(previous)).toBe(snapshot);
  });
});
