import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as envelope from "../src/worldEnvelope";
import { cutOrankeseePresentationV209 } from "../src/orankeseePresentationV209";
import { createSurroundingCityChunk } from "../src/SurroundingCityGeometry";
import cut from "../src/data/orankeseeMarginV209.json";

// Execute the actual small margin constructors without importing/building the
// complete historical city and all its unrelated multi-megabyte landmarks.
const drawnSource = readFileSync(new URL("../src/IsometricCityWorld.ts", import.meta.url), "utf8");
const nativeSource = readFileSync(new URL("../src/MinecraftVoxelWorld.ts", import.meta.url), "utf8");
function section(source: string, from: string, to: string): string {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error("Margin source fixture moved");
  return source.slice(start, end).replace(/^export /gm, "");
}
function margin(native = false): THREE.Group {
  const bindings = { ...THREE, ...envelope, mergeGeometries };
  const body = native
    ? section(nativeSource, "function voxelMaterial(", "type InstanceWriter") +
      section(nativeSource, "function instancedBoxes(", "// Only for private meshes") +
      section(nativeSource, "function addTiledBand(", "/**") +
      section(nativeSource, "export function createMinecraftExtrapolatedWorld", "  group.add(ground.mesh);") +
      "  group.add(ground.mesh); return group; }"
    : section(drawnSource, "function boxTriangles(", "/** Closed rectangular beam") +
      section(drawnSource, "export function createExtrapolatedMargin", "/**");
  const compiled = new Bun.Transpiler({ loader: "ts" }).transformSync(body);
  return new Function(...Object.keys(bindings), compiled +
    `; return ${native ? "createMinecraftExtrapolatedWorld" : "createExtrapolatedMargin"}();`)(...Object.values(bindings));
}
function ray(root: THREE.Group, x: number, z: number): THREE.Intersection[] {
  root.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0)).intersectObject(root, true);
}
function addActualWaterPackets(root: THREE.Group, native: boolean): void {
  for (const tile of ["east200-14_-7", "east200-14_-6", "east200-15_-7"]) {
    const path = new URL(`../public/mesh/surrounding-berlin-v159/${tile}.${native ? "minecraft" : "drawn"}.json.gz`, import.meta.url);
    root.add(createSurroundingCityChunk(JSON.parse(gunzipSync(readFileSync(path)).toString()), tile, native).root);
  }
}

test("actual presentation margins stop covering the unchanged lake in both families", () => {
  for (const native of [false, true]) {
    const root = margin(native);
    addActualWaterPackets(root, native);
    for (const [x, z] of [[7525, -3130], [7550, -3200], [7590, -3130]]) {
      expect(ray(root, x, z)[0].point.y).toBeCloseTo(native ? 2.1 : 1.8, 4);
    }
    cutOrankeseePresentationV209(root, native);
    for (const [x, z] of [[7525, -3130], [7550, -3200], [7590, -3130], [7700, -3190]]) {
      const hit = ray(root, x, z)[0];
      expect(hit.point.y).toBeCloseTo(-1.15, 4);
      expect(hit.object.name).toContain("Surrounding Berlin outline east200-");
    }
  }
});

test("all artificial margin outside the coast stays at its original height and tone", () => {
  for (const native of [false, true]) {
    const root = margin(native);
    const points = [[7410, -3130], [7615, -3090], [7490, -3305], [5000, -4800]];
    const before = points.map(([x, z]) => ray(root, x, z)[0].point.toArray());
    cutOrankeseePresentationV209(root, native);
    points.forEach(([x, z], i) => ray(root, x, z)[0].point.toArray().forEach((value, axis) => {
      // Direct world-space Float32 vertices can round the old native matrix's
      // multiply/add by one ULP; all source heights remain within one micron.
      expect(value).toBeCloseTo(before[i][axis], 6);
    }));
    const owner = root.getObjectByName(native ? "Voxel extrapolated ground" : "extrapolated margin ground")!;
    expect(owner.userData.orankeseePresentationCutV209.sourceVertices).toBe(82);
    if (native) {
      const mesh = owner as THREE.InstancedMesh;
      expect(mesh.children.length).toBe(1);
      const replacement = mesh.children[0] as THREE.Mesh;
      expect(replacement.userData.dayMaterial).toBe(replacement.userData.nightMaterial);
      expect((replacement.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0x3d3d3d);
    }
    const count = (owner as THREE.Mesh).geometry.getAttribute("position").count;
    cutOrankeseePresentationV209(root, native);
    expect((owner as THREE.Mesh).geometry.getAttribute("position").count).toBe(count);
  }
});

test("changed source receipts abort before any presentation geometry is changed", () => {
  for (const native of [false, true]) {
    const root = margin(native);
    const mesh = root.getObjectByName(native ? "Voxel extrapolated ground" : "extrapolated margin ground") as THREE.Mesh;
    if (native) {
      const instanced = mesh as THREE.InstancedMesh, m = new THREE.Matrix4();
      const record = cut.native[0];
      for (let i = 0; i < instanced.count; i++) {
        instanced.getMatrixAt(i, m);
        if (m.elements[12] === record.center[0] && m.elements[13] === record.center[1] && m.elements[14] === record.center[2]) {
          instanced.setColorAt(i, new THREE.Color(0)); break;
        }
      }
    } else {
      const p = mesh.geometry.getAttribute("position"), color = mesh.geometry.getAttribute("color");
      for (let i = 0; i < p.count; i++) if (p.getX(i) === 7630) color.setXYZ(i, 0, 0, 0);
    }
    const old = mesh.geometry, children = mesh.children.length;
    const matrices = native ? (mesh as THREE.InstancedMesh).instanceMatrix.array.slice() : null;
    expect(() => cutOrankeseePresentationV209(root, native)).toThrow(/receipt changed/);
    expect(mesh.geometry).toBe(old); expect(mesh.children.length).toBe(children);
    if (native) expect((mesh as THREE.InstancedMesh).instanceMatrix.array).toEqual(matrices);
  }
});
