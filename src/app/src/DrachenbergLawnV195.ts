import {
  BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial,
} from "three";
import source from "./data/drachenbergLawnV195.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { teufelsbergTerrainOffsetV195 } from "./teufelsbergTerrainV195";

type Footprint = { ring: number[][]; holes: number[][][] };

function inRing(ring: number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[j], [bx, bz] = ring[i];
    const dx = bx - ax, dz = bz - az;
    const cross = (x - ax) * dz - (z - az) * dx;
    if (Math.abs(cross) <= 1e-7 * Math.hypot(dx, dz) &&
      x >= Math.min(ax, bx) - 1e-7 && x <= Math.max(ax, bx) + 1e-7 &&
      z >= Math.min(az, bz) - 1e-7 && z <= Math.max(az, bz) + 1e-7) return true;
    if ((az > z) !== (bz > z) && x < ax + (z - az) * dx / dz) inside = !inside;
  }
  return inside;
}

function contains(polygons: Footprint[], x: number, z: number): boolean {
  return polygons.some(p => inRing(p.ring, x, z) && !p.holes.some(h => inRing(h, x, z)));
}

/** Only the previously omitted mapped lawn; no rectangular navigation fallback. */
export function drachenbergLawnGroundAtV195(x: number, z: number, native = false): number | null {
  const [w, n, e, s] = source.bounds;
  if (x < w || x > e || z < n || z > s || !contains(source.footprint, x, z)) return null;
  const offset = teufelsbergTerrainOffsetV195(x, z, native);
  if (offset === null) return null;
  return (contains(source.pathFootprint, x, z) ? 3.12 : 3.01) + offset;
}

/** One static, texture-free batch, partitioned into source lawn and dirt path. */
export function createDrachenbergLawnV195(native = false): Group {
  const root = new Group();
  root.name = "Exact mapped Drachenberg lawn and crossing dirt path infill v195";
  root.position.fromArray(source.origin);
  root.userData = {
    drachenbergLawnV195: true, textureFree: true, fullStaticDetailOnTouch: true,
    blockNative: native, nativeMinecraft: native, keepInMinecraft: native,
    sourceId: source.sourceId, pathSourceId: source.pathSourceId,
    groundAt: (x: number, z: number) => drachenbergLawnGroundAtV195(x, z, native),
  };
  const model = native ? source.native : source.drawn;
  const positions = new Float32Array(model.positions.length * 3);
  const colors = new Uint8Array(model.colors.length * 3);
  model.positions.forEach((p, i) => positions.set(p, i * 3));
  model.colors.forEach((c, i) => colors.set(c, i * 3));
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3, true));
  geometry.setIndex(model.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1, flatShading: true });
  const day = native ? night : new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const mesh = new Mesh(geometry, day);
  mesh.name = native ? "Exact source lawn and path on eight metre terraces" : "Exact source lawn and path on measured terrain planes";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
