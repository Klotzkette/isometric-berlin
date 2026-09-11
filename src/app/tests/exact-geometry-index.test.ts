import { describe, expect, test } from "bun:test";
import {
  BufferAttribute, BufferGeometry, DynamicDrawUsage, Float32BufferAttribute,
  InstancedBufferAttribute, InterleavedBuffer, InterleavedBufferAttribute,
  Uint8BufferAttribute,
} from "three";
import { indexGeometryExactly } from "../src/exactGeometryIndex";

function fixture(): BufferGeometry {
  const geometry = new BufferGeometry();
  // Two triangles with deliberately repeated vertices in their original order.
  geometry.setAttribute("position", new Float32BufferAttribute([
    0,0,0, 1,0,0, 1,1,0, 0,0,0, 1,1,0, 0,1,0,
    0,0,0, 1,0,0, 1,1,0, 0,0,0, 1,1,0, 0,1,0,
  ],3));
  geometry.setAttribute("color", new Uint8BufferAttribute(Array(12).fill([11,97,203]).flat(),3,true));
  geometry.setAttribute("normal", new Float32BufferAttribute(Array(12).fill([0,0,1]).flat(),3));
  geometry.setAttribute("uv", new Float32BufferAttribute([
    0,0, 1,0, 1,1, 0,0, 1,1, 0,1,
    0,0, 1,0, 1,1, 0,0, 1,1, 0,1,
  ],2));
  return geometry;
}

function expandedBytes(geometry: BufferGeometry): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  const count = geometry.index?.count ?? geometry.getAttribute("position").count;
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const bytes = new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);
    const stride = attribute.itemSize * attribute.array.BYTES_PER_ELEMENT;
    result[name] = [];
    for (let i = 0; i < count; i++) {
      const vertex = geometry.index?.getX(i) ?? i;
      result[name].push(...bytes.subarray(vertex * stride, (vertex + 1) * stride));
    }
  }
  return result;
}

describe("lossless static geometry indexing", () => {
  test("preserves dashed-line distances and arbitrary per-vertex attributes", () => {
    const geometry = fixture();
    geometry.setAttribute("lineDistance",new Float32BufferAttribute([0,1,2,3,4,5,0,1,2,3,4,5],1));
    const before = expandedBytes(geometry);
    expect(indexGeometryExactly(geometry).changed).toBeTrue();
    expect(expandedBytes(geometry)).toEqual(before);
    expect(geometry.getAttribute("position").count).toBe(6);
  });

  test("keeps the WebGL primitive-restart sentinel out of 16-bit indices", () => {
    for(const unique of [65535,65536]) {
      const geometry = new BufferGeometry();
      const vertices = new Float32Array(unique * 2 * 3);
      for(let i=0;i<unique*2;i++) vertices[i*3]=i%unique;
      geometry.setAttribute("position",new BufferAttribute(vertices,3));
      const result=indexGeometryExactly(geometry);
      expect(result.changed).toBeTrue(); expect(result.vertexCount).toBe(unique);
      expect(geometry.index!.array.BYTES_PER_ELEMENT).toBe(unique===65535?2:4);
      for(let i=0;i<unique*2;i++) expect(geometry.index!.getX(i)).toBe(i%unique);
    }
  });

  test("preserves every expanded attribute byte, primitive order, groups and draw range", () => {
    const geometry = fixture();
    geometry.addGroup(0,6,2); geometry.addGroup(6,6,1); geometry.setDrawRange(3,6);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const before = expandedBytes(geometry);
    const box = geometry.boundingBox!.clone(); const sphere = geometry.boundingSphere!.clone();
    const result = indexGeometryExactly(geometry);
    expect(result.changed).toBeTrue(); expect(result.vertexCount).toBe(4);
    expect(result.savedBytes).toBeGreaterThan(0);
    expect(expandedBytes(geometry)).toEqual(before);
    expect(geometry.groups).toEqual([{start:0,count:6,materialIndex:2},{start:6,count:6,materialIndex:1}]);
    expect(geometry.drawRange).toEqual({start:3,count:6});
    expect(geometry.boundingBox!.equals(box)).toBeTrue(); expect(geometry.boundingSphere!.equals(sphere)).toBeTrue();
    expect(geometry.getAttribute("color").normalized).toBeTrue();
  });

  test("retains signed zero and distinct NaN payload bits, plus color/UV seams", () => {
    const geometry = fixture();
    const position = geometry.getAttribute("position");
    const raw = new Uint32Array(position.array.buffer);
    raw[0] = 0x80000000; raw[3] = 0x7fc00001; raw[6] = 0x7fc00002;
    geometry.getAttribute("color").setX(6,12);
    geometry.getAttribute("uv").setX(9,0.5);
    const before = expandedBytes(geometry);
    expect(indexGeometryExactly(geometry).changed).toBeTrue();
    expect(expandedBytes(geometry)).toEqual(before);
  });

  test("remaps existing indexed line/triangle order without reordering indices", () => {
    const geometry = fixture();
    geometry.setIndex(new BufferAttribute(new Uint32Array([11,2,5,8,0,3,7,1,10,4,9,6]),1));
    const before = expandedBytes(geometry);
    expect(indexGeometryExactly(geometry).changed).toBeTrue();
    expect(expandedBytes(geometry)).toEqual(before);
    expect(geometry.index!.array).toBeInstanceOf(Uint16Array);
    expect(geometry.index!.count).toBe(12);
    // A second pass is a no-op when no further bytes can be saved.
    const indexed = geometry.index;
    expect(indexGeometryExactly(geometry).changed).toBeFalse(); expect(geometry.index).toBe(indexed);
  });

  test("rejects geometry without a byte saving and leaves original attributes intact", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position",new Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
    const position = geometry.getAttribute("position");
    expect(indexGeometryExactly(geometry).changed).toBeFalse();
    expect(geometry.getAttribute("position")).toBe(position); expect(geometry.index).toBeNull();
  });

  test("skips morphs, interleaved, instanced, dynamic and custom-upload attributes", () => {
    const cases = [
      (g:BufferGeometry)=>{ g.morphAttributes.position=[g.getAttribute("position") as BufferAttribute]; },
      (g:BufferGeometry)=>{ g.setAttribute("uv",new InterleavedBufferAttribute(new InterleavedBuffer(new Float32Array(24),2),2,0)); },
      (g:BufferGeometry)=>{ g.setAttribute("custom",new InstancedBufferAttribute(new Float32Array(12),1)); },
      (g:BufferGeometry)=>{ (g.getAttribute("position") as BufferAttribute).setUsage(DynamicDrawUsage); },
      (g:BufferGeometry)=>{ (g.getAttribute("position") as BufferAttribute).onUpload(()=>{}); },
    ];
    for(const prepare of cases){const g=fixture(); prepare(g); const original=g.getAttribute("position"); expect(indexGeometryExactly(g).changed).toBeFalse(); expect(g.getAttribute("position")).toBe(original);}
  });
});
