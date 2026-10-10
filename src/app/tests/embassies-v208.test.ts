import { describe, expect, test } from "bun:test";
import { Color, InstancedMesh, Matrix4, Mesh, Vector3 } from "three";
import { createEmbassiesV208, EMBASSIES_V208_SOURCE_IDS } from "../src/EmbassiesV208";
import data from "../src/data/embassiesV208.json";
import { createUnterDenLindenDetails } from "../src/UnterDenLindenDetails";
import { createMinecraftUnterDenLindenDetails } from "../src/MinecraftUnterDenLindenDetails";

function bytes(root: ReturnType<typeof createEmbassiesV208>): number {
  let n = 0;
  for (const mesh of root.children as InstancedMesh[]) {
    for (const a of Object.values(mesh.geometry.attributes)) n += a.array.byteLength;
    n += mesh.geometry.index?.array.byteLength ?? 0;
    n += mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0);
  }
  return n;
}

describe("v208 source-bound embassy and twelve-axis Trade Mission", () => {
  test("complete static detail, materials and buffers stay bounded and texture-free", () => {
    expect(EMBASSIES_V208_SOURCE_IDS).toHaveLength(17);
    for (const native of [false, true]) {
      const root = createEmbassiesV208(native);
      expect(root.userData.sourceGeometryRetained).toBe(true);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(root.userData.newCourtClosures).toBe(false);
      expect(root.children).toHaveLength(native ? 1 : 2);
      expect(bytes(root)).toBeLessThan(native ? 1300 * 1024 : 400 * 1024);
      for (const mesh of root.children as InstancedMesh[]) {
        expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
        expect(mesh.userData.dayMaterial.map).toBeNull();
        expect(mesh.userData.nightMaterial.map).toBeNull();
        expect(mesh.instanceMatrix.array.length).toBe(mesh.count * 16);
        expect(mesh.matrixAutoUpdate).toBe(false);
        expect([...mesh.instanceMatrix.array].every(Number.isFinite)).toBe(true);
      }
    }
  });

  test("native representation is orthogonal, including lettering and roof chevrons", () => {
    const root = createEmbassiesV208(true), mesh = root.children[0] as InstancedMesh;
    const matrix = new Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      for (const k of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[k]).toBe(0);
    }
  });

  test("both Aeroflot inscriptions read A-to-T left-to-right from the street", () => {
    const front = data.faces[data.aeroflotFrontFace];
    // A visitor looks towards the wall from its outward side, with world Y up.
    // Derive screen-right from that view, independently of the source edge order.
    const view = new Vector3(-front.outward[0], 0, -front.outward[1]);
    const screenRight = view.cross(new Vector3(0, 1, 0)).normalize();
    const color = new Color(), matrix = new Matrix4(), position = new Vector3();
    for (const native of [false, true]) {
      const mesh = createEmbassiesV208(native).children[0] as InstancedMesh;
      for (const [hex, capHeight] of [[0x687273, 1.55], [0x25579b, .68]]) {
        const expectedColor = new Color(hex), projected: number[] = [];
        for (let i = (native ? data.blocks : data.boxes).length; i < mesh.count; i++) {
          mesh.getColorAt(i, color);
          if (Math.abs(color.r - expectedColor.r) + Math.abs(color.g - expectedColor.g)
            + Math.abs(color.b - expectedColor.b) > 1e-6) continue;
          mesh.getMatrixAt(i, matrix);
          projected.push(position.setFromMatrixPosition(matrix).dot(screenRight));
        }
        expect(projected.length).toBeGreaterThan(20);
        // Emitted paths start at A and finish at T. Mirrored lettering reverses
        // their visible order even when every letter and source wall is present.
        expect(projected.at(-1)! - projected[0]).toBeGreaterThan(capHeight * 3.5);
      }
    }
  });

  test("opt-out replaces only Aeroflot and defaults preserve historical constructors", () => {
    const old = createUnterDenLindenDetails();
    const next = createUnterDenLindenDetails({ includeLegacyAeroflot: false });
    const meshes = (r: typeof old) => {
      const result: Mesh[] = []; r.traverse(o => { if (o instanceof Mesh) result.push(o); }); return result;
    };
    const retained = meshes(old).filter(m => !m.name.startsWith("Aeroflot and Trade Mission"));
    const current = meshes(next);
    expect(current.map(m => m.name)).toEqual(retained.map(m => m.name));
    current.forEach((m, i) => {
      expect([...((m as InstancedMesh).instanceMatrix.array)]).toEqual([...((retained[i] as InstancedMesh).instanceMatrix.array)]);
      expect([...((m as InstancedMesh).instanceColor!.array)]).toEqual([...((retained[i] as InstancedMesh).instanceColor!.array)]);
    });
    const native = createMinecraftUnterDenLindenDetails().children[0] as InstancedMesh;
    const optOut = createMinecraftUnterDenLindenDetails({ includeLegacyAeroflot: false }).children[0] as InstancedMesh;
    expect(optOut.count).toBeLessThan(native.count);
    expect(native.count - optOut.count).toBeGreaterThan(30);
  });

  test("each world owns its buffers and material instances", () => {
    const a = createEmbassiesV208(), b = createEmbassiesV208();
    for (let i = 0; i < a.children.length; i++) {
      const x = a.children[i] as InstancedMesh, y = b.children[i] as InstancedMesh;
      expect(x.geometry).not.toBe(y.geometry);
      expect(x.material).not.toBe(y.material);
      expect(x.instanceMatrix).not.toBe(y.instanceMatrix);
    }
  });
});
