import { describe, expect, it } from "bun:test";
import { InstancedMesh, Matrix4 } from "three";
import previous from "../src/data/altMitteEdgesV186.json";
import source from "../src/data/leipzigerMuenzeV257.json";
import { altMitteEdgesV186Batches, nativeContourRows } from "../src/altMitteEdgesV186Batches";
import { LEIPZIGER_MUENZE_V257, leipzigerMuenzeV257Rows } from "../src/leipzigerMuenzeV257";

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

  it("keeps the exact old instance prefix and the existing draw-call count", () => {
    const snapshot = JSON.stringify(previous);
    for (const native of [false, true]) {
      const root = altMitteEdgesV186Batches(previous.cells, native);
      expect(root.children.length).toBe(previous.cells.length);
      let bytes = 0, beforeBytes = 0, geometryBytes = 0;
      for (let i = 0; i < previous.cells.length; i++) {
        const old = previous.cells[i];
        const rows = native ? nativeContourRows(old.rows) : old.rows;
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
        });
        bytes += mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0);
        beforeBytes += rows.length * 76;
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
