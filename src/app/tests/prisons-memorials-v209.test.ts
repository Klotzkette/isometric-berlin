import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import { createPrisonsMemorialsEnvelopesV209, createPrisonsMemorialsV209, PRISONS_MEMORIALS_V209_SOURCE_IDS } from "../src/PrisonsMemorialsV209";
import { prisonsMemorialsV209GroundAt, prisonsMemorialsV209SolidAt } from "../src/prisonsMemorialsV209Navigation";
import data from "../src/data/prisonsMemorialsV209Envelopes.json";
import { refineStasiEntranceScreen } from "../src/StasiSiteEntrances";

function bytes(root: ReturnType<typeof createPrisonsMemorialsV209>): number {
  let n = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    for (const a of Object.values(object.geometry.attributes)) n += a.array.byteLength;
    n += object.geometry.index?.array.byteLength ?? 0;
    if (object instanceof InstancedMesh) n += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
  });
  return n;
}

describe("v209 Tegel and distinct Lichtenberg/Hohenschoenhausen sites", () => {
  test("complete required envelopes and optional exterior detail have fixed budgets", () => {
    expect(PRISONS_MEMORIALS_V209_SOURCE_IDS).toHaveLength(118);
    for (const native of [false, true]) {
      const shells = createPrisonsMemorialsEnvelopesV209(native), details = createPrisonsMemorialsV209(native);
      expect(shells.children).toHaveLength(native ? 5 : 3);
      expect(details.children).toHaveLength(3);
      expect(bytes(shells)).toBe(native ? 1166768 : 1026108);
      expect(bytes(details)).toBe(native ? 3463696 : 2560360);
      for (const root of [shells, details]) {
        expect(root.userData.sourceGeometryRetained).toBe(true);
        expect(root.userData.fullStaticDetailOnTouch).toBe(true);
        expect(root.userData.jvaMoabitAndLehrterMemorialUnchanged).toBe(true);
        for (const mesh of root.children as Mesh[]) {
          expect(mesh.matrixAutoUpdate).toBe(false);
          expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
          expect(mesh.userData.dayMaterial.map).toBeNull();
          expect(mesh.userData.nightMaterial.map).toBeNull();
        }
      }
    }
  });

  test("native envelope and all visible details are independently orthogonal", () => {
    const m = new Matrix4();
    for (const root of [createPrisonsMemorialsEnvelopesV209(true), createPrisonsMemorialsV209(true)])
      for (const mesh of root.children) {
        if (!(mesh instanceof InstancedMesh)) continue;
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m);
          for (const k of [1, 2, 4, 6, 8, 9]) expect(m.elements[k]).toBe(0);
        }
      }
  });

  test("one closed Haus 1 sheet yields and every other source triangle is retained", () => {
    const root = createPrisonsMemorialsEnvelopesV209();
    const siteFor = ([x, , z]: number[]) => x < 0 ? "tegel" : z < 0 ? "hsh" : "hq";
    let replacements = 0;
    for (const [index, site] of data.sites.entries()) {
      const mesh = root.children[index] as Mesh;
      const positions = mesh.geometry.getAttribute("position");
      const rows = data.surfaces.filter(row => siteFor(row.triangles[0][0]) === site.key);
      let cursor = 0;
      for (const row of rows) {
        const refined = refineStasiEntranceScreen(row);
        if (refined[0] !== row) {
          expect(row.part).toBe("DEBE11YYI0002Eyq");
          expect(row.sheet).toBe(4);
          replacements++;
          cursor += refined.reduce((n, s) => n + s.triangles.length * 3, 0);
          continue;
        }
        for (const triangle of row.triangles) for (const point of triangle) {
          expect([positions.getX(cursor), positions.getY(cursor), positions.getZ(cursor)])
            .toEqual(point.map(Math.fround));
          cursor++;
        }
      }
    }
    expect(replacements).toBe(1);
    expect(createPrisonsMemorialsV209().children.every(c => c instanceof InstancedMesh)).toBe(true);
  });

  test("Haus 1 concrete apertures are physically cut through, with intact surrounding webs", () => {
    const original = data.surfaces.find(row => row.part === "DEBE11YYI0002Eyq" && row.sheet === 4)!;
    const altered = { ...original, triangles: original.triangles.map(t => t.map(p => [...p])) };
    altered.triangles[0][0][1] += .01;
    expect(refineStasiEntranceScreen(altered)[0]).toBe(altered);
    const root = createPrisonsMemorialsEnvelopesV209();
    root.updateMatrixWorld(true);
    const start = new Vector3(7841.803, 0, 663.764);
    const axis = new Vector3(7844.468, 0, 649.241).sub(start);
    const length = axis.length();
    axis.normalize();
    const outward = new Vector3(axis.z, 0, -axis.x);
    const probe = (u: number, y: number) => {
      const origin = start.clone().addScaledVector(axis, u).addScaledVector(outward, .25);
      origin.y = y;
      return new Raycaster(origin, outward.clone().negate(), 0, .55).intersectObject(root, true).length;
    };
    // Centre of the bottom-left opening, adjacent solid web, then top fascia.
    expect(probe(.16 + (length - .32) / 40, 3.3321)).toBe(0);
    expect(probe(.16 + (length - .32) / 20, 3.3321)).toBeGreaterThan(0);
    expect(probe(length / 2, 7.5)).toBeGreaterThan(0);
  });

  test("new ground stays finite, building navigation keeps open memorial court", () => {
    expect(prisonsMemorialsV209GroundAt(-5165, -6112)).toBe(3);
    expect(prisonsMemorialsV209GroundAt(7862, 660)).toBe(3);
    expect(prisonsMemorialsV209GroundAt(8900, -2345)).toBe(3);
    expect(prisonsMemorialsV209GroundAt(8500, -1000)).toBeNull();
    expect(prisonsMemorialsV209SolidAt(7863, 5, 660)).toBe(true);
    expect(prisonsMemorialsV209SolidAt(8900, 5, -2345)).toBe(false);
  });

  test("each world owns its disposable geometry, materials and instance arrays", () => {
    const a = createPrisonsMemorialsV209(), b = createPrisonsMemorialsV209();
    a.children.forEach((o, i) => {
      const x = o as InstancedMesh, y = b.children[i] as InstancedMesh;
      expect(x.geometry).not.toBe(y.geometry); expect(x.material).not.toBe(y.material);
      expect(x.instanceMatrix).not.toBe(y.instanceMatrix);
    });
  });
});
