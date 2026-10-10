import { expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { InstancedBufferGeometry, Mesh, Vector3 } from "three";
import { createFloodWater, setFloodWaterDepth, updateFloodWater } from "../src/FloodWater";
import { decodeFloodExtensionV205, loadFloodExtensionV205 } from "../src/FloodExtensionV205";
import receipt from "../src/data/floodExtensionV205.json";
import { disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import { createKudammTreesV205 } from "../src/KudammTreesV205";

const packed = await Bun.file(new URL(`../public/mesh/regierungsviertel/${receipt.file}`, import.meta.url)).arrayBuffer();
function bytes(): ArrayBuffer { return Uint8Array.from(gunzipSync(packed)).buffer; }

test("complete water uses zero-copy spatial buffers and shared animated uniforms at all depths", () => {
  const water = createFloodWater(), buffer = bytes();
  const extension = decodeFloodExtensionV205(buffer, water);
  water.add(extension);
  expect(extension.children.length).toBe(receipt.chunks.length + 1);
  let cells = 0;
  for (const child of extension.children as Mesh[]) {
    const geometry = child.geometry;
    if (geometry instanceof InstancedBufferGeometry) {
      cells += geometry.instanceCount;
      expect(geometry.getAttribute("floodOffset").array.buffer).toBe(buffer);
      expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBe(2048);
    }
    expect((child.material as typeof water.material).uniforms).toBe(water.material.uniforms);
  }
  expect(cells).toBe(receipt.gridCells);
  updateFloodWater(water, 123);
  for (const depth of [3,6,21] as const) {
    setFloodWaterDepth(water, depth);water.updateMatrixWorld(true);
    const mesh = extension.children[0] as Mesh;
    const p = new Vector3().fromBufferAttribute(mesh.geometry.getAttribute("position"),0);
    mesh.localToWorld(p);expect(p.y).toBeCloseTo(4.2 + depth,5);
    expect((mesh.material as typeof water.material).uniforms.time.value).toBe(123);
  }
  disposeOutlineConstruction(extension);water.geometry.dispose();water.material.dispose();
});

test("invalid or truncated flood assets cannot allocate a geometry", async () => {
  const water=createFloodWater();
  expect(()=>decodeFloodExtensionV205(new ArrayBuffer(0),water)).toThrow();
  const bad=bytes();new DataView(bad).setUint32(8,0,true);
  expect(()=>decodeFloodExtensionV205(bad,water)).toThrow();
  const abort=new AbortController();abort.abort();
  expect(await loadFloodExtensionV205(water,abort.signal)).toBe(false);
  expect(water.children.length).toBe(0);water.geometry.dispose();water.material.dispose();
});

test("all official Ku'damm trees stay finite and individually represented in both families",()=>{
  for(const native of [false,true]) {
    const root=createKudammTreesV205(native);
    let count=0;
    root.traverse(o=>{if('count' in o){const mesh=o as import('three').InstancedMesh;count+=mesh.count;
      expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBe(true);
      if(native)for(let i=0;i<mesh.count;i++)for(const k of[1,2,4,6,8,9])expect(mesh.instanceMatrix.array[i*16+k]).toBe(0);
    }});
    expect(count).toBe(396*2);disposeOutlineConstruction(root);
  }
});
