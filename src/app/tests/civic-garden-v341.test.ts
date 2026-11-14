import { expect, test } from "bun:test";
import { Color, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import { civicGardenPatchesV341, createCivicGardenReliefV341 } from "../src/CivicGardenReliefV341";
import { createArchitecturalSignature, type ChancelleryModelSignature } from "../src/ArchitecturalLandmarks";
import { createMinecraftArchitecturalLandmarks } from "../src/MinecraftArchitecturalLandmarks";
import { PARISER_PLATZ_GARDENS, PARISER_PLATZ_CENTRAL_PAVING } from "../src/CentralCivicDetails";
import { CHANCELLERY_LAWN_RINGS } from "../src/ChancelleryEntranceProfile";
import lawn from "../src/data/reichstagLawnV318.json";
import scene from "../public/mesh/regierungsviertel/scene.json";

const ground = (x: number, z: number) => 5.2 + x * .0003 + z * .0002;
const drawnPatches = civicGardenPatchesV341(ground);
const nativePatches = civicGardenPatchesV341(ground, true);
const drawn = createCivicGardenReliefV341(ground);
const native = createCivicGardenReliefV341(ground, true);
const drawnMesh = drawn.children[0] as Mesh;
const nativeMesh = native.children[0] as InstancedMesh;
const positions = drawnMesh.geometry.getAttribute("position");

function inverse(x: number, z: number, cx: number, cz: number, yaw: number): [number, number] {
  return [(x - cx) * Math.cos(yaw) - (z - cz) * Math.sin(yaw),
    (x - cx) * Math.sin(yaw) + (z - cz) * Math.cos(yaw)];
}
function footprint(index: number, block: boolean): Vector3[] {
  if (!block) return Array.from({ length: 9 }, (_, j) => new Vector3().fromBufferAttribute(positions, index * 9 + j));
  const matrix = new Matrix4(); nativeMesh.getMatrixAt(index, matrix);
  return [-.5, .5].flatMap(x => [-.5, .5].map(z => new Vector3(x, -.5, z).applyMatrix4(matrix)));
}
function inside(x: number, z: number, ring: readonly number[][]): boolean {
  let winding = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const cross = (b[0] - a[0]) * (z - a[1]) - (x - a[0]) * (b[1] - a[1]);
    if (a[1] <= z && b[1] > z && cross > 0) winding++;
    if (a[1] > z && b[1] <= z && cross < 0) winding--;
  }
  return winding !== 0;
}

test("every Ehrenhof grass vertex is supported by an actual retained curved lawn, with all ten plots visible", () => {
  const signature = scene.architectural_signatures.find(s => s.kind === "chancellery_model") as ChancelleryModelSignature;
  const source = createArchitecturalSignature(signature)!; source.updateMatrixWorld(true);
  const surfaces = source.getObjectByName("Chancellery curved Ehrenhof lawn plots")!.children.slice(0, CHANCELLERY_LAWN_RINGS.length);
  const occupied = new Set<string>();
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0), 0, .3);
  drawnPatches.forEach((patch, i) => {
    if (patch.site !== "Ehrenhof") return;
    for (const vertex of footprint(i, false)) {
      ray.ray.origin.set(vertex.x, 5.55, vertex.z);
      const hit = ray.intersectObjects(surfaces, false)[0];
      expect(hit).toBeDefined();
      expect(hit.point.y).toBeCloseTo(5.36, 5);
      expect(vertex.y).toBeGreaterThan(hit.point.y);
      occupied.add(hit.object.name);
    }
  });
  expect(occupied.size).toBe(CHANCELLERY_LAWN_RINGS.length);
});

test("native Ehrenhof blocks stand on existing lawn cube tops, independently of the drawn quadratic clipping", () => {
  const source = createMinecraftArchitecturalLandmarks(); source.updateMatrixWorld(true);
  const mesh = source.children.find(o => o.userData.landmarkId === "bundeskanzleramt") as InstancedMesh;
  const tint = new Color(0x5d9634), color = new Color(), matrix = new Matrix4();
  const supports: Matrix4[] = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getColorAt(i, color);
    if (Math.abs(color.r - tint.r) + Math.abs(color.g - tint.g) + Math.abs(color.b - tint.b) > 1e-6) continue;
    mesh.getMatrixAt(i, matrix); matrix.premultiply(mesh.matrixWorld);
    // The separate Chillida island shares this tint but has a lower .18 m slab.
    if (Math.abs(matrix.elements[5] - .22) > 1e-6) continue;
    expect(matrix.elements[13] + matrix.elements[5] / 2).toBeCloseTo(5.44, 5);
    supports.push(matrix.clone().invert());
  }
  expect(supports.length).toBe(211);
  nativePatches.forEach((patch, i) => {
    if (patch.site !== "Ehrenhof") return;
    for (const vertex of footprint(i, true)) {
      expect(vertex.y).toBeCloseTo(5.444, 5);
      expect(supports.some(m => {
        const p = new Vector3(vertex.x, 5.44, vertex.z).applyMatrix4(m);
        return Math.abs(p.x) < .5 && Math.abs(p.z) < .5 && Math.abs(p.y - .5) < 1e-4;
      })).toBeTrue();
    }
  });
});

test("Pariser Platz leaves the central passage, fountains, flower strips and topiary clear in both families", () => {
  for (const [block, patches] of [[false, drawnPatches], [true, nativePatches]] as const) {
    for (const [i, patch] of patches.entries()) {
      if (patch.site !== "Pariser Platz") continue;
      for (const vertex of footprint(i, block)) {
        const garden = PARISER_PLATZ_GARDENS.find(({ centre, size }) => {
          const [x, z] = inverse(vertex.x, vertex.z, ...centre, .087);
          return Math.abs(x) < size[0] / 2 - 1.83 && Math.abs(z) < size[1] / 2 - 1.83;
        });
        expect(garden).toBeDefined();
        const [x, z] = inverse(vertex.x, vertex.z, ...garden!.centre, .087);
        expect(Math.hypot(x, z)).toBeGreaterThan(5.75);
        for (const az of [-4.35, 4.35]) expect(Math.hypot(x - (-garden!.size[0] / 2 + 8.2), z - az)).toBeGreaterThan(1.75);
        const [px, pz] = inverse(vertex.x, vertex.z, ...PARISER_PLATZ_CENTRAL_PAVING.centre, PARISER_PLATZ_CENTRAL_PAVING.rotationRad);
        expect(Math.abs(px) < PARISER_PLATZ_CENTRAL_PAVING.size[0] / 2 && Math.abs(pz) < PARISER_PLATZ_CENTRAL_PAVING.size[1] / 2).toBeFalse();
        expect(vertex.y).toBeGreaterThan(5.08);
      }
    }
  }
});

test("Reichstag grass vertices stay outside the actual retained path polygons and follow varying terrain", () => {
  for (const [block, patches] of [[false, drawnPatches], [true, nativePatches]] as const) {
    for (const [i, patch] of patches.entries()) {
      if (patch.site !== "Platz der Republik") continue;
      expect(patch.y).toBeCloseTo(ground(patch.x, patch.z) + .09, 9);
      for (const p of footprint(i, block)) {
        expect(inside(p.x * 10, p.z * 10, lawn.ring)).toBeTrue();
        expect(lawn.roads.some(r => inside(p.x * 10, p.z * 10, r.ring) && !r.holes.some(h => inside(p.x * 10, p.z * 10, h)))).toBeFalse();
      }
    }
  }
  for (const empty of [null, NaN, Infinity, -Infinity]) {
    const patches = civicGardenPatchesV341(() => empty);
    expect(patches.some(p => p.site === "Platz der Republik")).toBeFalse();
    expect(patches.length).toBe(1044); // Known authored lawn planes still exist.
  }
});

test("the full static detail is one bounded texture-free batch per family, with cardinal native cubes", () => {
  expect(drawnPatches.length).toBe(3246); expect(nativePatches.length).toBe(3246);
  expect(positions.count).toBe(3246 * 9); expect(nativeMesh.count).toBe(3246);
  for (const root of [drawn, native]) {
    expect(root.children).toHaveLength(1);
    expect(root.userData.fullStaticDetailOnTouch).toBeTrue();
    expect(root.userData.textureFree).toBeTrue();
    const mesh = root.children[0] as Mesh;
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect(mesh.matrixAutoUpdate).toBeFalse();
    expect(mesh.userData.dayMaterial.map).toBeNull();
    expect(mesh.userData.nightMaterial.map).toBeNull();
    expect(Array.from(mesh.geometry.getAttribute("position").array).every(Number.isFinite)).toBeTrue();
  }
  const matrix = new Matrix4();
  for (let i = 0; i < nativeMesh.count; i++) {
    nativeMesh.getMatrixAt(i, matrix);
    for (const k of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[k]).toBe(0);
    expect(matrix.elements[0]).toBeCloseTo(.28, 6); expect(matrix.elements[10]).toBeCloseTo(.28, 6);
    expect(matrix.elements[5]).toBeGreaterThanOrEqual(.06); expect(matrix.elements[5]).toBeLessThanOrEqual(.13);
  }
});
