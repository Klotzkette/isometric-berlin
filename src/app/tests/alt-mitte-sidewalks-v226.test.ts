import { expect, test } from "bun:test";
import { Mesh } from "three";
import { createAltMitteSidewalksV226 } from "../src/AltMitteSidewalksV226";
import { altMitteTransportGroundV206 } from "../src/AltMitteTransportV206";
import data from "../src/data/altMitteSidewalksV226.json";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

for (const native of [false, true]) test(`${native ? "native" : "drawn"} source sidewalks keep exact terrain, bounded buffers and independent disposal`, () => {
  const root = createAltMitteSidewalksV226(native), second = createAltMitteSidewalksV226(native);
  try {
    const audit = staticGeometryAudit(root);
    expect(audit.budget.bytes).toBe(native ? 99900 : 29556);
    expect(audit.budget.draws).toBe(native ? 7 : 8);
    expect(audit).toEqual(staticGeometryAudit(second));
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.sourceGeometryRetained).toBe(true);
    expect(root.userData.nativeMinecraft).toBe(native);
    for (const [index, child] of root.children.entries()) {
      const mesh = child as Mesh;
      expect(mesh.matrixAutoUpdate).toBe(false);
      expect(mesh.geometry).not.toBe((second.children[index] as Mesh).geometry);
      expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
      expect(mesh.userData.dayMaterial.map).toBeNull();
      expect(mesh.userData.nightMaterial.map).toBeNull();
      const cell = data.cells.find(c => mesh.name.endsWith(c.cell.join(":")))!;
      const positions = mesh.geometry.getAttribute("position");
      if (native) {
        expect(positions.count).toBe(cell.nativeRuns.length * 4);
        for (const [i, [ix, iz, count]] of cell.nativeRuns.entries()) {
          const x = ix / 4, z = iz / 4, end = (ix + count) / 4;
          const y = Math.fround(altMitteTransportGroundV206((x + end) / 2, z + .125, true) + .025);
          expect(Array.from((positions.array as Float32Array).slice(i * 12, i * 12 + 12)))
            .toEqual([x,y,z,end,y,z,end,y,z+.25,x,y,z+.25]);
        }
      } else {
        expect(positions.count).toBe(cell.positions.length / 2);
        expect(Array.from(mesh.geometry.index!.array)).toEqual(cell.indices);
        for (let i = 0; i < positions.count; i++) {
          const x = cell.positions[i * 2], z = cell.positions[i * 2 + 1];
          expect([positions.getX(i), positions.getY(i), positions.getZ(i)])
            .toEqual([Math.fround(x), Math.fround(altMitteTransportGroundV206(x, z) + .1), Math.fround(z)]);
        }
      }
    }
    disposeStaticAudit(root);
    expect(staticGeometryAudit(second)).toEqual(audit);
  } finally { disposeStaticAudit(root); disposeStaticAudit(second); }
});
