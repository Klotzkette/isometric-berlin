import {
  BoxGeometry, BufferAttribute, BufferGeometry, DoubleSide, Group, InstancedMesh,
  Matrix4, Mesh, MeshBasicMaterial,
} from "three";
import source from "./data/kulturforumPavingV343.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const KULTURFORUM_PAVING_V343 = Object.freeze({
  source: "https://www.godelmann.de/de/referenzen/kulturforum-am-scharounplatz",
  slabM: [.75, .35] as const,
  scope: source.scope,
  counts: source.counts,
  // Supplier's Kies-Braun finish: low-contrast inset seams, never black ink.
  jointDay: 0xbab5a8,
  jointNight: 0x20252d,
  status: "Supplier slab formats; laying phase, bond and 14 mm joint are visual estimates. Exact current displayed paving support; no new pavement blanket.",
});

function bytes(text: string): ArrayBuffer {
  const decoded = atob(text);
  const out = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) out[i] = decoded.charCodeAt(i);
  return out.buffer;
}

/** Interpolate the actual supporting road triangle, not a second terrain fit. */
export function kulturforumSupportHeightV343(
  points: ArrayLike<number>, heights: ArrayLike<number>, index: number, x: number, z: number,
): number {
  const at = index * 6;
  const ax = points[at], az = points[at + 1], bx = points[at + 2], bz = points[at + 3];
  const cx = points[at + 4], cz = points[at + 5];
  const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
  const a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
  const b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
  return a * heights[index * 3] + b * heights[index * 3 + 1] + (1 - a - b) * heights[index * 3 + 2];
}

/** Finite source-clipped detail in a single batch. Shared by every drawn device
 * profile; native uses independently authored cardinal slab joints. Nothing
 * here retires old pavement, changes walking, or creates a frame-time loop. */
export function createKulturforumPavingV343(
  terrainAt: (x: number, z: number) => number, native = false, nativeGround?: InstancedMesh,
): Group {
  const group = new Group();
  group.name = `Philharmonie-West source paving joints V343${native ? " native" : ""}`;
  const dayMaterial = new MeshBasicMaterial({ color: KULTURFORUM_PAVING_V343.jointDay, side: DoubleSide });
  const nightMaterial = new MeshBasicMaterial({ color: KULTURFORUM_PAVING_V343.jointNight, side: DoubleSide });
  const lift = source.pavingLiftM + source.separationM;
  let object: Mesh | InstancedMesh;
  if (native) {
    const supports = new Map<string, number>();
    const key = (x: number, z: number, w: number, d: number) => [x,z,w,d].map(v => Math.round(v * 100)).join(",");
    const wanted = new Set(source.nativeSupports.map(([x0,z0,x1,z1]) => key((x0+x1)/2,(z0+z1)/2,x1-x0,z1-z0)));
    if (nativeGround) {
      const m = nativeGround.instanceMatrix.array;
      for (let i = 0; i < nativeGround.count; i++) {
        const at = i * 16;
        // Existing native ground has cardinal boxes; fail closed for any
        // transformed/rotated/replaced support rather than guessing its top.
        if ([1,2,4,6,8,9].some(off => Math.abs(m[at + off]) > 1e-6)) continue;
        const id = key(m[at+12],m[at+14],m[at],m[at+10]);
        if (wanted.has(id)) supports.set(id,m[at+13]+m[at+5]/2);
      }
    }
    const tops = source.nativeSupports.map(([x0,z0,x1,z1]) => supports.get(key((x0+x1)/2,(z0+z1)/2,x1-x0,z1-z0)));
    const joints = new Int16Array(bytes(source.native));
    let supported = 0;
    for (let at = 0; at < joints.length; at += 5) if (tops[joints[at+4]] !== undefined) supported++;
    group.userData.nativeGroundSupport = { planned: joints.length / 5, supported, omitted: joints.length / 5 - supported };
    if (!supported) { dayMaterial.dispose(); nightMaterial.dispose(); return freezeStaticSceneTransforms(group); }
    const blocks = new InstancedMesh(new BoxGeometry(1, 1, 1), dayMaterial, supported);
    const matrix = new Matrix4();
    let instance = 0;
    for (let at = 0; at < joints.length; at += 5) {
      const top = tops[joints[at+4]];
      if (top === undefined) continue;
      const ax = source.origin[0] + joints[at] / 100, az = source.origin[1] + joints[at + 1] / 100;
      const bx = source.origin[0] + joints[at + 2] / 100, bz = source.origin[1] + joints[at + 3] / 100;
      const x = (ax + bx) / 2, z = (az + bz) / 2;
      matrix.makeScale(Math.max(source.jointWidthM, Math.abs(bx - ax)), .014, Math.max(source.jointWidthM, Math.abs(bz - az)));
      // Shallow inlay: 12 mm inside the actual source slab, only 2 mm above.
      matrix.setPosition(x, top - .005, z);
      blocks.setMatrixAt(instance++, matrix);
    }
    blocks.instanceMatrix.needsUpdate = true;
    blocks.computeBoundingBox(); blocks.computeBoundingSphere();
    object = blocks;
  } else {
    const supports = new Float32Array(bytes(source.supports));
    const heights = new Float64Array(supports.length / 2);
    for (let at = 0; at < supports.length; at += 2) heights[at / 2] = terrainAt(supports[at], supports[at + 1]) + lift;
    const joints = new Int16Array(bytes(source.segments));
    const positions = new Float32Array(joints.length / 5 * 18);
    let out = 0;
    for (let at = 0; at < joints.length; at += 5) {
      const ax = source.origin[0] + joints[at] / 100, az = source.origin[1] + joints[at + 1] / 100;
      const bx = source.origin[0] + joints[at + 2] / 100, bz = source.origin[1] + joints[at + 3] / 100;
      const length = Math.hypot(bx - ax, bz - az), scale = source.jointWidthM / (2 * length);
      const nx = (bz - az) * scale, nz = (ax - bx) * scale;
      for (const [x, z] of [[ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax + nx, az + nz], [bx - nx, bz - nz], [ax - nx, az - nz]]) {
        positions[out++] = x;
        positions[out++] = kulturforumSupportHeightV343(supports, heights, joints[at + 4], x, z);
        positions[out++] = z;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    object = new Mesh(geometry, dayMaterial);
  }
  object.name = "Kies-Braun slab joints on retained paving";
  object.userData.dayMaterial = dayMaterial;
  object.userData.nightMaterial = nightMaterial;
  object.userData.sourceGeometry = "Exact existing pavement triangle supports; supplier 75 x 35 cm slab formats";
  group.add(object);
  return freezeStaticSceneTransforms(group);
}
