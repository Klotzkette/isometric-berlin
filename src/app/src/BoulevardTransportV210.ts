import { BoxGeometry, Group, InstancedBufferAttribute, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import paint from "./data/boulevardTransportV210.json";
import ground from "./data/boulevardTransportGroundV210.json";
import curbs from "./data/boulevardCurbsV210.json";
import { createAltMitteTransportV206 } from "./AltMitteTransportV206";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { terrainGroundAt } from "./weinbergTerrainV176";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

function inside(x: number, z: number, ring: readonly (readonly number[])[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

function core(x: number, z: number): boolean {
  return inside(x, z, ground.core.ring) && !ground.core.holes.some(r => inside(x, z, r));
}

/** The actual retained core height samples, plus the outer terrain field. */
export function boulevardGroundV210(x: number, z: number, native = false): number {
  if (!core(x, z)) return terrainGroundAt(x, z, ground.outerGroundY, native);
  const sx = (x - ground.origin[0]) / ground.step - (native ? 0 : .5);
  const sz = (z - ground.origin[1]) / ground.step - (native ? 0 : .5);
  const ix = Math.floor(sx), iz = Math.floor(sz);
  const at = (cx: number, cz: number) => ground.heightsDm[
    Math.max(0, Math.min(ground.rows - 1, cz)) * ground.cols + Math.max(0, Math.min(ground.cols - 1, cx))
  ] / 10;
  if (native) return at(ix, iz);
  const a = sx - ix, b = sz - iz;
  return (at(ix, iz) * (1 - a) + at(ix + 1, iz) * a) * (1 - b) + (at(ix, iz + 1) * (1 - a) + at(ix + 1, iz + 1) * a) * b;
}

export function boulevardPaintHeightV210(x: number, z: number, native = false): number {
  return boulevardGroundV210(x, z, native) + (core(x, z) ? (native ? .025 : .205) : .115);
}

/** Exact quarter-metre footprints and half-pixel centres in local cells.
 * Unnormalised Uint16 attributes are converted to float by WebGL; the mesh
 * transform restores metres for rendering, culling and ordinary raycasting. */
export function createNativeCurbBatchV210(rows: readonly number[][], cell: readonly number[]): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xd4d0c2 });
  const night = new MeshStandardMaterial({ color: 0xd4d0c2, flatShading: true, roughness: .88 });
  const mesh = new InstancedMesh(geometry, day, 0);
  const values = new Uint16Array(rows.length * 16), ox = cell[0] * 512, oz = cell[1] * 512;
  const packed = (value: number): number => {
    const integer = Math.round(value);
    if (Math.abs(value - integer) > 1e-6 || integer < 0 || integer > 65535)
      throw new Error("Native curb matrix is not exactly representable in its local cell");
    return integer;
  };
  rows.forEach((r, i) => {
    const offset = i * 16;
    values[offset] = packed(r[3] / .125); values[offset + 5] = packed(r[4] / .005);
    values[offset + 10] = packed(r[5] / .125);
    values[offset + 12] = packed((r[0] - ox) / .125); values[offset + 13] = packed(r[1] / .005);
    values[offset + 14] = packed((r[2] - oz) / .125); values[offset + 15] = 1;
  });
  mesh.instanceMatrix = new InstancedBufferAttribute(values, 16, false); mesh.count = rows.length;
  mesh.position.set(ox, 0, oz); mesh.scale.set(.125, .005, .125);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: true, keepInMinecraft: true, exactQuarterMetreCurbRaster: true };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}

/** Static 512m batches, without new textures, animation or device quality tiers. */
export function createBoulevardTransportV210(native = false): Group {
  const root = createAltMitteTransportV206(native, paint, boulevardPaintHeightV210);
  root.name = "Source-bound boulevard paint and curbs v210" + (native ? " native" : "");
  root.userData.fullStaticDetailOnTouch = true;
  root.userData.additiveOnly = true;
  root.userData.sourceGeometryRetained = true;
  root.userData.curbLengthM = curbs.sourceLengthM;
  for (const mesh of root.children) mesh.name = mesh.name.replace("Alt-Mitte source paint", "Boulevard source paint v210");
  const cells = new Map<string, number[][]>();
  const add = (x: number, z: number, width: number, depth: number, yaw = 0) => {
    const y = boulevardGroundV210(x, z, native) + .185;
    const key = `${Math.floor(x / 512)}:${Math.floor(z / 512)}`;
    let rows = cells.get(key);
    if (!rows) { rows = []; cells.set(key, rows); }
    rows.push(native ? [x, y, z, width, .19, depth, 0xd4d0c2]
      : [x, y, z, width, .19, depth, yaw, 0xd4d0c2]);
  };
  if (native) {
    for (const [ix, iz, width, depth] of curbs.nativeRuns)
      add((ix + width / 2) / 4, (iz + depth / 2) / 4, width / 4, depth / 4);
  } else {
    for (const [ax, az, bx, bz] of curbs.segments)
      add((ax + bx) / 2, (az + bz) / 2, Math.hypot(bx - ax, bz - az), .22, -Math.atan2(bz - az, bx - ax));
  }
  for (const [cell, rows] of cells) {
    const mesh = native ? createNativeCurbBatchV210(rows, cell.split(":").map(Number)) : justicePalaceV183Boxes(rows, false);
    mesh.name = `Retained asphalt boundary curbs v210 ${cell}`;
    // Every curb has the same colour: a material colour avoids a redundant
    // instance colour buffer while preserving the previous linear colour.
    mesh.instanceColor = null;
    mesh.userData.dayMaterial.color.setHex(0xd4d0c2);
    mesh.userData.nightMaterial.color.setHex(0xd4d0c2);
    mesh.userData.staticAntiFlicker = true;
    root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
