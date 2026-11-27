import {
  Box3, BoxGeometry, Camera, Frustum, InstancedBufferAttribute, InstancedInterleavedBuffer,
  InstancedMesh, InterleavedBufferAttribute, Matrix4, Object3D,
  Vector3, type BufferAttribute, type WebGLRenderer,
} from "three";

import { staticStorageInfo } from "./losslessStaticStorage";
import { groundRangeShaderSafeV383 } from "./groundRangeShaderProvenanceV383";

// These static layers each span multiple buildings or city blocks. A single
// city-wide sphere admitted up to 40,883 facade cuboids even in a close-up.
const layers = new Set([
  "Drawn ground slabs", "Voxel ground runs",
  "Source-bound ministry reveals, unlit glazing and seven public colonnade arches",
  "Wilhelm street source-supported composed architecture fittings",
  "Library glazing, stone orders, gold magazine joints and reading-room fins",
  "Measured-wall-clipped individual Moabit/Mitte facade members",
  "Mapped Spree bank railings members",
]);
const batchSize = 64;
type Batch = {start: number; end: number; box: Box3};
type Range = {start: number; end: number};
type Layout = {batches: Batch[]; matrix: InstancedBufferAttribute; version: number; count: number;
  positions: BufferAttribute | InterleavedBufferAttribute; positionVersion: number; offset: number; stride: number; matrixId: object; positionId: object;
  projection?: Matrix4; ranges?: Range[]; reversed?: boolean; coordinateSystem?: number};
const layouts = new WeakMap<InstancedMesh, Layout>();
const installed = new WeakSet<WebGLRenderer>();

// Slabs arrive in source row order. Keep the order and the entire geometry,
// including terrain side faces and the separately drawn block-mode undersides.
export function prepareGroundDrawRangesV383(root: Object3D): void {
  root.traverse(mesh => {
    if (mesh instanceof InstancedMesh && mesh.geometry instanceof BoxGeometry && layers.has(mesh.name)) prepare(mesh);
  });
}

function prepare(mesh: InstancedMesh): Layout | undefined {
  const positions = mesh.geometry.getAttribute("position");
  if (!positions || positions.itemSize !== 3 || mesh.count < 2048 || mesh.geometry.morphAttributes.position?.length) return;
  const matrix = mesh.instanceMatrix;
  if (matrix.itemSize !== 16 || matrix.meshPerAttribute !== 1) return;
  const storage = "data" in positions ? positions.data : positions;
  const offset = "data" in positions ? positions.offset : 0, stride = "data" in positions ? positions.data.stride : positions.itemSize;
  const matrixId = staticStorageInfo(matrix).arrayIdentity, positionId = staticStorageInfo(storage).arrayIdentity;
  const previous = layouts.get(mesh);
  if (previous && matrix === previous.matrix && matrix.version === previous.version &&
      matrixId === previous.matrixId && positionId === previous.positionId &&
      previous.count === mesh.count && positions === previous.positions && storage.version === previous.positionVersion && previous.offset === offset && previous.stride === stride) return previous;

  const base = new Box3(), point = new Vector3();
  for (let i=0; i<positions.count; i++) base.expandByPoint(point.fromBufferAttribute(positions,i));
  const c = base.getCenter(new Vector3()), h = base.getSize(new Vector3()).multiplyScalar(0.5);
  const values = matrix.array;
  const batches: Batch[] = [];
  for (let start = 0; start < mesh.count; start += batchSize) {
    const box = new Box3();
    const end = Math.min(start + batchSize, mesh.count);
    for (let i = start; i < end; i++) {
      const o = i * 16;
      if (values[o+3] !== 0 || values[o+7] !== 0 || values[o+11] !== 0 || values[o+15] !== 1) return;
      for (const [axis, key] of axes) {
        const a = values[o+axis], b = values[o+4+axis], d = values[o+8+axis];
        const mid = a*c.x + b*c.y + d*c.z + values[o+12+axis];
        const half = Math.abs(a)*h.x + Math.abs(b)*h.y + Math.abs(d)*h.z;
        box.min[key] = Math.min(box.min[key], mid - half);
        box.max[key] = Math.max(box.max[key], mid + half);
      }
    }
    if (!Number.isFinite(box.min.lengthSq() + box.max.lengthSq())) return;
    // The CPU bounds use doubles while the GPU transforms use floats.
    batches.push({start, end, box: box.expandByScalar(0.05)});
  }
  const layout = {batches, matrix, matrixId, positionId, version:matrix.version, count:mesh.count, positions, positionVersion:storage.version, offset, stride};
  layouts.set(mesh, layout);
  return layout;
}
const axes = [[0,"x"], [1,"y"], [2,"z"]] as const;

const clip = new Matrix4(), frustum = new Frustum();
function visibleRanges(layout: Layout, camera: Camera, mesh: InstancedMesh) {
  clip.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld);
  if (layout.projection?.equals(clip) && layout.coordinateSystem === camera.coordinateSystem &&
      layout.reversed === camera.reversedDepth && layout.ranges) return layout.ranges;
  (layout.projection ??= new Matrix4()).copy(clip);
  layout.coordinateSystem = camera.coordinateSystem;
  layout.reversed = camera.reversedDepth;
  frustum.setFromProjectionMatrix(clip, camera.coordinateSystem, camera.reversedDepth);
  const ranges: Range[] = [];
  for (const batch of layout.batches) {
    if (!frustum.intersectsBox(batch.box)) continue;
    const last = ranges[ranges.length - 1];
    // It costs less to submit a short invisible gap than a second draw.
    if (last && batch.start - last.end <= 3 * batchSize) last.end = batch.end;
    else ranges.push({start:batch.start, end:batch.end});
  }
  layout.ranges = ranges;
  return ranges;
}

// WebGL2 vertexAttribPointer supports a byte offset into an already uploaded
// instanced buffer. Three r185 exposes it through InterleavedBufferAttribute.
// Give the original storage its stride/divisor description so both bindings
// refer to the same WebGLAttributes cache entry, including after context restore.
const views = new WeakMap<InstancedBufferAttribute, Map<number, InterleavedBufferAttribute>>();
function bindingAt(storage: InstancedBufferAttribute, start: number) {
  let bindings = views.get(storage);
  if (!bindings) {
    bindings = new Map();
    views.set(storage, bindings);
  }
  let attribute = bindings.get(start);
  if (!attribute) {
    attribute = new InterleavedBufferAttribute(storage as unknown as InstancedInterleavedBuffer,
      storage.itemSize, start * storage.itemSize, storage.normalized);
    bindings.set(start, attribute);
  }
  return attribute;
}

function bindStride(storage: InstancedBufferAttribute) {
  Object.defineProperties(storage, {
    stride: {value:storage.itemSize, configurable:true},
    isInstancedInterleavedBuffer: {value:true, configurable:true},
  });
}
function unbindStride(storage: InstancedBufferAttribute) {
  Reflect.deleteProperty(storage, "stride");
  Reflect.deleteProperty(storage, "isInstancedInterleavedBuffer");
}
function canBind(storage: InstancedBufferAttribute) {
  return Object.isExtensible(storage) && !("stride" in storage) && !("isInstancedInterleavedBuffer" in storage);
}

export function installGroundDrawCullingV383(renderer: WebGLRenderer): void {
  if (installed.has(renderer)) return;
  installed.add(renderer);
  const draw = renderer.renderBufferDirect.bind(renderer);
  renderer.renderBufferDirect = (camera, scene, geometry, material, mesh, group) => {
    if (!(mesh instanceof InstancedMesh) || !layers.has(mesh.name) || !(geometry instanceof BoxGeometry) || mesh.geometry !== geometry ||
        geometry.attributes.instanceMatrix || geometry.attributes.instanceColor || mesh.morphTexture ||
        !groundRangeShaderSafeV383(material) || ("displacementMap" in material && material.displacementMap) ||
        ("isShaderMaterial" in material) || mesh.instanceColor && mesh.instanceColor.meshPerAttribute !== 1 ||
        geometry.drawRange.count === 0) return draw(camera, scene, geometry, material, mesh, group);
    // Only the object's matrix and color get rebased when a range starts midway.
    for (const attribute of Object.values(geometry.attributes)) {
      if (("isInstancedBufferAttribute" in attribute && attribute.isInstancedBufferAttribute) ||
          ("data" in attribute && "isInstancedInterleavedBuffer" in attribute.data && attribute.data.isInstancedInterleavedBuffer))
        return draw(camera, scene, geometry, material, mesh, group);
    }
    const layout = prepare(mesh);
    if (!layout) return draw(camera, scene, geometry, material, mesh, group);
    const ranges = visibleRanges(layout, camera, mesh);
    const count = mesh.count;
    if (ranges.length > 48 || ranges.reduce((n,r) => n + r.end - r.start, 0) > count * 0.75)
      return draw(camera, scene, geometry, material, mesh, group);
    if (!ranges.length) return;
    const matrix = mesh.instanceMatrix, color = mesh.instanceColor;
    if (!canBind(matrix) || color && !canBind(color)) return draw(camera, scene, geometry, material, mesh, group);
    bindStride(matrix);
    try {
      if (color) bindStride(color);
      for (const range of ranges) {
        geometry.setAttribute("instanceMatrix", bindingAt(mesh.instanceMatrix, range.start));
        if (mesh.instanceColor) geometry.setAttribute("instanceColor", bindingAt(mesh.instanceColor, range.start));
        mesh.count = range.end - range.start;
        draw(camera, scene, geometry, material, mesh, group);
      }
    } finally {
      geometry.deleteAttribute("instanceMatrix");
      geometry.deleteAttribute("instanceColor");
      mesh.count = count;
      unbindStride(matrix);
      if (color) unbindStride(color);
    }
  };
}
