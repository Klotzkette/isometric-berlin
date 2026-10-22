import { describe, expect, test } from "bun:test";
import { Color, Group, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import { createTempelhofV261, TEMPELHOF_V261_PROFILE } from "../src/TempelhofV261";
import { createAirportsV194 } from "../src/AirportsV194";
import { tempelhofV261GroundAt, tempelhofV261SolidAt } from "../src/tempelhofV261Navigation";
import data from "../src/data/tempelhofV261.json";

describe("Tempelhof entrance and Airlift Memorial v261", () => {
  test("both complete static modes fit their local budget without textures or frame work", () => {
    for (const native of [false, true]) {
      const root = createTempelhofV261(native);
      expect(root.children.length).toBe(native ? 1 : 2);
      expect(root.userData.sourceGeometryRetained).toBe(true);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      let bytes = 0;
      for (const child of root.children) {
        const mesh = child as Mesh;
        expect(mesh.matrixAutoUpdate).toBe(false);
        expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
        expect(mesh.userData.dayMaterial).not.toBe(mesh.userData.nightMaterial);
        for (const a of Object.values(mesh.geometry.attributes)) {
          bytes += a.array.byteLength;
          expect(Array.from(a.array).every(Number.isFinite)).toBe(true);
        }
        bytes += mesh.geometry.index?.array.byteLength ?? 0;
        if (mesh instanceof InstancedMesh) {
          bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
          expect(mesh.count).toBe(native ? 3200 : 234);
          expect(mesh.boundingSphere!.radius).toBeLessThan(150);
          if (native) for (let i = 0; i < mesh.count; i++) {
            for (const j of [1, 2, 4, 6, 8, 9]) expect(mesh.instanceMatrix.array[i * 16 + j]).toBe(0);
          }
        }
      }
      expect(bytes).toBe(native ? 243848 : 245556);
      expect(bytes).toBeLessThan(TEMPELHOF_V261_PROFILE.budgetBytes);
    }
  });

  test("low plinth remains walkable and park approaches remain open", () => {
    const [x, y, z] = data.monument.anchor;
    for (const native of [false, true]) {
      expect(tempelhofV261GroundAt(x, z + 2.8, native)).toBe(y + .42);
      expect(tempelhofV261GroundAt(x, z + 4, native)).toBeNull();
      expect(tempelhofV261GroundAt(x + 4, z, native)).toBeNull();
      expect(tempelhofV261SolidAt(x, y + 2, z + 4, .15, native)).toBe(false);
      expect(tempelhofV261SolidAt(x - 10, y + 2, z, .15, native)).toBe(false);
      expect(tempelhofV261SolidAt(x, y - 1, z, 0, native)).toBe(false);
      expect(tempelhofV261SolidAt(x - 3, y + 21, z, 0, native)).toBe(false);
    }
  });

  test("collision follows the concrete and its three separate tips in each mode", () => {
    const [x, y, z] = data.monument.anchor;
    for (const native of [false, true]) {
      expect(tempelhofV261SolidAt(x + .1, y + 4, z, 0, native)).toBe(true);
      expect(tempelhofV261SolidAt(x - 3.2, y + 19, z, .1, native)).toBe(true);
      expect(tempelhofV261SolidAt(x - 3.2, y + 19, z + 1.5, 0, native)).toBe(false);
      expect(tempelhofV261SolidAt(x - 3.2, y + 19, z - 1.5, 0, native)).toBe(false);
    }
    for (const b of data.blocks) expect(tempelhofV261SolidAt(b[0], b[1], b[2], 0, true)).toBe(true);
  });

  test("doors and lettering remain visible in front of the retained projecting entrance hall", () => {
    const [a, b] = data.entranceFront.rings[0];
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const dx = (b[0] - a[0]) / length, dz = (b[2] - a[2]) / length;
    const outward = new Vector3(dz, 0, -dx), ray = new Raycaster();
    const camera = new Vector3().fromArray(TEMPELHOF_V261_PROFILE.camera.position);
    const letteringColor = new Color(0xDFDED0), color = new Color(), matrix = new Matrix4();
    for (const native of [false, true]) {
      const root = new Group(), airport = createAirportsV194(native), details = createTempelhofV261(native);
      root.add(airport, details); root.updateMatrixWorld(true);
      // All 22 door axes, at four glazing samples each, must clear both the
      // exact source sheets and the independent older orthogonal source skin.
      for (let i = 0; i < 22; i++) for (const offset of [-.75, -.3, .3, .75]) {
        const u = (i + .5) * length / 22 + offset;
        const target = new Vector3(a[0] + dx * u, a[1] - 3, a[2] + dz * u);
        ray.set(target.clone().addScaledVector(outward, 30), outward.clone().negate());
        expect(ray.intersectObject(root, true)[0].object.parent).toBe(details);
      }
      const targets: Vector3[] = [];
      for (const child of details.children) {
        const mesh = child as Mesh;
        if (mesh instanceof InstancedMesh) {
          for (let i = 0; i < mesh.count; i++) {
            mesh.getColorAt(i, color);
            if (Math.abs(color.r - letteringColor.r) + Math.abs(color.g - letteringColor.g) + Math.abs(color.b - letteringColor.b) > 1e-6) continue;
            mesh.getMatrixAt(i, matrix); targets.push(new Vector3().setFromMatrixPosition(matrix));
          }
        } else {
          const positions = mesh.geometry.getAttribute("position"), colors = mesh.geometry.getAttribute("color");
          for (let i = 0; i < positions.count; i += 3) {
            if (Math.abs(colors.getX(i) - letteringColor.r) + Math.abs(colors.getY(i) - letteringColor.g) + Math.abs(colors.getZ(i) - letteringColor.b) > 1e-6) continue;
            targets.push(new Vector3().fromBufferAttribute(positions, i).add(new Vector3().fromBufferAttribute(positions, i + 1))
              .add(new Vector3().fromBufferAttribute(positions, i + 2)).multiplyScalar(1 / 3));
          }
        }
      }
      expect(targets.length).toBeGreaterThan(50);
      for (let i = 0; i < targets.length; i += 9) {
        ray.set(camera, targets[i].clone().sub(camera).normalize());
        expect(ray.intersectObject(root, true)[0].object.parent).toBe(details);
      }
      root.traverse(object => {
        const mesh = object as Mesh;
        mesh.geometry?.dispose();
        for (const material of new Set([mesh.userData.dayMaterial, mesh.userData.nightMaterial])) material?.dispose();
        if (mesh instanceof InstancedMesh) mesh.dispose();
      });
    }
  });
});
