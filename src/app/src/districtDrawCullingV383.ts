import {
  BufferAttribute, Frustum, Matrix4, type BufferGeometry, type Camera, type GeometryGroup,
  type LineBasicMaterial, type LineSegments, type Material, type Mesh, type Object3D, type WebGLRenderer,
} from "three";
import {staticStorageInfo} from "./losslessStaticStorage";
import {inkLineViewBias} from "./inkDrawVisibility";

// One contiguous interval ends on both triangle and line-pair boundaries.
// Preserve the input order of the pavement, its kerb strokes and markings.
const BLOCK = 3 * 192;
const MAX_CALLS = 8;
const MIN_INDICES = BLOCK * 32;
const installed = new WeakMap<WebGLRenderer, () => void>();
const verticesPerPrimitive = new Map<string, number>([
  ["District raised kerbstones", 3], ["District asphalt carriageways", 3], ["District mapped paved walkways", 3],
  ["District kerb ink", 2], ["District lane markings", 2],
]);

type PartialMesh = Material & {wireframe?: boolean; displacementMap?: unknown};

function supportedMesh(object: Object3D, material: PartialMesh, geometry: BufferGeometry) {
  const mesh = object as Mesh;
  return mesh.isMesh && object.frustumCulled &&
    !("isInstancedMesh" in mesh) && !("isSkinnedMesh" in mesh) && !("isBatchedMesh" in mesh) &&
    !material.wireframe && !material.displacementMap && !("isShaderMaterial" in material) &&
    !geometry.morphAttributes.position?.length && !("isInstancedBufferGeometry" in geometry);
}

class IndexedBounds {
  readonly boxes: Float32Array;
  readonly primitiveCount: number;
  readonly positionVersion: number;
  readonly indexVersion: number;
  readonly positionIdentity: object;
  readonly indexIdentity: object | undefined;
  readonly positionCount: number;
  readonly ranges = new Uint32Array(2 * MAX_CALLS);
  private readonly projection = new Matrix4();
  private readonly gapStart = new Int32Array(MAX_CALLS - 1);
  private readonly gapEnd = new Int32Array(MAX_CALLS - 1);
  private readonly gapSize = new Int32Array(MAX_CALLS - 1);
  private lastStart = -1;
  private lastEnd = -1;
  private lastCoordinateSystem = -1;
  private lastReversed = false;
  private count = 0;

  constructor(position: BufferAttribute, index: BufferAttribute | null) {
    this.positionVersion = position.version;
    this.indexVersion = index?.version ?? -1;
    this.positionIdentity = staticStorageInfo(position).arrayIdentity;
    this.indexIdentity = index ? staticStorageInfo(index).arrayIdentity : undefined;
    this.positionCount = position.count;
    this.primitiveCount = index?.count ?? position.count;
    this.boxes = new Float32Array(Math.ceil(this.primitiveCount / BLOCK) * 6);
    const xyz = position.array, indices = index?.array;
    for (let start = 0, k = 0; start < this.primitiveCount; start += BLOCK, k += 6) {
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      const end = Math.min(start + BLOCK, this.primitiveCount);
      for (let i = start; i < end; i++) {
        const vertex = 3 * (indices ? indices[i] : i);
        const x = xyz[vertex], y = xyz[vertex + 1], z = xyz[vertex + 2];
        x0 = Math.min(x0,x); y0 = Math.min(y0,y); z0 = Math.min(z0,z);
        x1 = Math.max(x1,x); y1 = Math.max(y1,y); z1 = Math.max(z1,z);
      }
      // The actual streets are in metres. Leave extra room at clipping planes
      // for shader depth bias and Float32 GPU matrix multiplication.
      this.boxes.set([x0-.125,y0-.125,z0-.125,x1+.125,y1+.125,z1+.125],k);
    }
  }

  matches(p: BufferAttribute, idx: BufferAttribute | null) {
    // The backing's opaque identity survives lossless CPU parking. Reading the
    // array merely to compare identity would inflate the whole city on each pass.
    return this.positionVersion === p.version && this.positionCount === p.count &&
      this.primitiveCount === (idx?.count ?? p.count) && this.indexVersion === (idx?.version ?? -1) &&
      this.positionIdentity === staticStorageInfo(p).arrayIdentity &&
      this.indexIdentity === (idx ? staticStorageInfo(idx).arrayIdentity : undefined);
  }

  plan(matrix: Matrix4, camera: Camera, frustum: Frustum, start: number, end: number) {
    if (this.projection.equals(matrix) && this.lastStart === start && this.lastEnd === end &&
        this.lastCoordinateSystem === camera.coordinateSystem && this.lastReversed === camera.reversedDepth) return this.count;
    this.projection.copy(matrix);
    this.lastStart = start;
    this.lastEnd = end;
    this.lastCoordinateSystem = camera.coordinateSystem;
    this.lastReversed = camera.reversedDepth;
    frustum.setFromProjectionMatrix(matrix, camera.coordinateSystem, camera.reversedDepth);
    const boxes=this.boxes, gaps=MAX_CALLS-1;
    this.gapSize.fill(0);
    let first=-1, previousEnd=-1;
    for (let block=Math.floor(start/BLOCK); block*BLOCK<end; block++) {
      const offset=block*6;
      let visible=true;
      for (const plane of frustum.planes) {
        const {x,y,z}=plane.normal;
        if (x*boxes[offset+(x<0?0:3)] + y*boxes[offset+(y<0?1:4)] +
            z*boxes[offset+(z<0?2:5)] + plane.constant < 0) { visible=false; break; }
      }
      if (!visible) continue;
      const begin=Math.max(start,block*BLOCK);
      if (first<0) first=begin;
      if (previousEnd>=0 && begin>previousEnd) {
        // Keep the seven largest interior gaps, in source order. A missed
        // culling opportunity only submits additional original triangles.
        let slot=0;
        for (let i=1;i<gaps;i++) if (this.gapSize[i]<this.gapSize[slot]) slot=i;
        const size=begin-previousEnd;
        if (size>this.gapSize[slot]) {
          this.gapStart[slot]=previousEnd; this.gapEnd[slot]=begin; this.gapSize[slot]=size;
        }
      }
      previousEnd=Math.min(end,(block+1)*BLOCK);
    }
    this.count=0;
    if (first<0) return 0;
    let cursor=first, kept=0;
    while (cursor<previousEnd) {
      let next=-1;
      for (let i=0;i<gaps;i++) if (this.gapSize[i] && this.gapStart[i]>=cursor &&
          (next<0 || this.gapStart[i]<this.gapStart[next])) next=i;
      const stop=next<0?previousEnd:this.gapStart[next];
      this.ranges[2*this.count]=cursor;
      this.ranges[2*this.count+1]=stop-cursor;
      this.count++; kept+=stop-cursor;
      cursor=next<0?previousEnd:this.gapEnd[next];
    }
    // One ordinary draw is cheaper than splitting a skyline-wide view.
    if (this.count>1 && kept>(end-start)*.78) {
      this.ranges[0]=start; this.ranges[1]=end-start; this.count=1;
    }
    return this.count;
  }
}

/** Refine the normal Three.js draw without changing its geometry, render list,
 * shader, attributes or material callbacks. Its drawRange (including a zero-count
 * prewarm) and material group remain authoritative. Unsupported paths pass through. */
export function installDistrictDrawCullingV383(renderer: WebGLRenderer): () => void {
  const active=installed.get(renderer);
  if (active) return active;
  const original=renderer.renderBufferDirect;
  const cache=new WeakMap<BufferGeometry, IndexedBounds>();
  const clip=new Matrix4(), frustum=new Frustum();
  const partial: GeometryGroup={start:0,count:0,materialIndex:0};
  const wrapped: WebGLRenderer["renderBufferDirect"]=function(camera,scene,geometry,material,object,group) {
    const size = object && verticesPerPrimitive.get(object.name);
    if (!size) return original.call(renderer,camera,scene,geometry,material,object,group);
    let viewBias = 0;
    if (size === 2) {
      const bias = inkLineViewBias(material);
      if (!(object as LineSegments).isLineSegments || !object.frustumCulled ||
          !(material as LineBasicMaterial).isLineBasicMaterial || bias === undefined ||
          geometry.morphAttributes.position?.length || "isInstancedBufferGeometry" in geometry) {
        return original.call(renderer,camera,scene,geometry,material,object,group);
      }
      viewBias = bias;
    } else if (!supportedMesh(object,material,geometry)) {
      return original.call(renderer,camera,scene,geometry,material,object,group);
    }
    const p=geometry.getAttribute("position"), idx=geometry.index;
    if (!(p instanceof BufferAttribute) || p.itemSize!==3 || (idx && idx.itemSize!==1)) {
      return original.call(renderer,camera,scene,geometry,material,object,group);
    }
    const total=idx?.count ?? p.count;
    const start=Math.max(0,geometry.drawRange.start,group?.start ?? 0);
    const end=Math.min(total,geometry.drawRange.start+geometry.drawRange.count,group?group.start+group.count:Infinity);
    if (end-start<MIN_INDICES || start%size || end%size) return original.call(renderer,camera,scene,geometry,material,object,group);
    let map=cache.get(geometry);
    if (!map?.matches(p,idx)) {
      if (!(p.array instanceof Float32Array) || (idx && !(idx.array instanceof Uint16Array || idx.array instanceof Uint32Array)))
        return original.call(renderer,camera,scene,geometry,material,object,group);
      map=new IndexedBounds(p,idx);
      cache.set(geometry,map);
    }
    // Match the stock line shader's optional view-space depth adjustment
    // before projection, including for scaled objects and perspective cameras.
    clip.copy(camera.matrixWorldInverse);
    clip.elements[14] += viewBias;
    clip.premultiply(camera.projectionMatrix).multiply(object.matrixWorld);
    const count=map.plan(clip,camera,frustum,start,end);
    if (count===1 && map.ranges[0]===start && map.ranges[1]===end-start)
      return original.call(renderer,camera,scene,geometry,material,object,group);
    partial.materialIndex=group?.materialIndex ?? 0;
    for (let i=0;i<count;i++) {
      partial.start=map.ranges[2*i];
      partial.count=map.ranges[2*i+1];
      original.call(renderer,camera,scene,geometry,material,object,partial);
    }
  };
  renderer.renderBufferDirect=wrapped;
  const dispose=() => {
    if (renderer.renderBufferDirect===wrapped) renderer.renderBufferDirect=original;
    installed.delete(renderer);
  };
  installed.set(renderer,dispose);
  return dispose;
}
