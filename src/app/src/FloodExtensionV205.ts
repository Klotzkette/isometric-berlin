import { Box3, BufferAttribute, BufferGeometry, Group, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, Sphere, Vector3 } from 'three';
import receipt from './data/floodExtensionV205.json';
import type { FloodWater } from './FloodWater';

/** Lossless source-bound border plus identical shared 64 m swell cells. */
export function decodeFloodExtensionV205(bytes: ArrayBuffer, water: FloodWater): Group {
  const header = new DataView(bytes);
  if (bytes.byteLength !== receipt.rawBytes ||
      String.fromCharCode(...new Uint8Array(bytes, 0, 8)) !== 'ISOFLO05' ||
      header.getUint32(8, true) !== receipt.gridCells ||
      header.getUint32(12, true) !== receipt.vertices ||
      header.getUint32(16, true) !== receipt.indices) throw new Error('Invalid Berlin flood extent');
  const offsets = new Float32Array(bytes, 20, receipt.gridCells * 2);
  const positions = new Float32Array(bytes, 20 + offsets.byteLength, receipt.vertices * 3);
  const indices = new Uint32Array(bytes, 20 + offsets.byteLength + positions.byteLength, receipt.indices);
  for (const value of offsets) if (!Number.isFinite(value)) throw new Error('Invalid flood grid coordinate');
  for (const value of positions) if (!Number.isFinite(value)) throw new Error('Invalid flood shore coordinate');
  for (const value of indices) if (value >= receipt.vertices) throw new Error('Invalid flood shore index');
  const root = new Group();
  root.name = 'Complete Berlin flood extent v205';
  root.userData.floodExtensionV205 = true;
  const vertices = new BufferAttribute(new Float32Array([0,7.2,0,64,7.2,0,64,7.2,64,0,7.2,64]),3);
  const index = new BufferAttribute(new Uint16Array([0,1,2,0,2,3]),1);
  const gridMaterial = water.material.clone();
  gridMaterial.uniforms = water.material.uniforms;
  gridMaterial.defines = { ...gridMaterial.defines, FLOOD_GRID: 1 };
  for (const chunk of receipt.chunks) {
    const grid = new InstancedBufferGeometry();
    grid.setAttribute('position', vertices);grid.setIndex(index);
    grid.setAttribute('floodOffset',new InstancedBufferAttribute(offsets.subarray(chunk.start*2,(chunk.start+chunk.count)*2),2));
    grid.instanceCount=chunk.count;
    const west=chunk.key[0]*2048,north=chunk.key[1]*2048;
    grid.boundingBox=new Box3(new Vector3(west,6.96,north),new Vector3(west+2048,7.44,north+2048));
    grid.boundingSphere=grid.boundingBox.getBoundingSphere(new Sphere());
    const mesh=new Mesh(grid,gridMaterial);mesh.name=`Berlin flood swell cell ${chunk.key.join(':')}`;
    root.add(mesh);
  }
  const border = new BufferGeometry();
  border.setAttribute('position',new BufferAttribute(positions,3));
  border.setIndex(new BufferAttribute(indices,1));
  border.computeBoundingBox();border.boundingBox!.min.y-=.24;border.boundingBox!.max.y+=.24;
  border.boundingSphere=border.boundingBox!.getBoundingSphere(new Sphere());
  const borderMesh = new Mesh(border,water.material);
  borderMesh.name = 'Berlin flood — exact outer boundary';
  root.add(borderMesh);
  for (const mesh of root.children) { mesh.raycast=()=>{};mesh.matrixAutoUpdate=false;mesh.updateMatrix(); }
  return root;
}

async function readBounded(stream: ReadableStream<Uint8Array>, count: number, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const output = new Uint8Array(count), reader = stream.getReader();
  let offset = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted','AbortError');
      const {done,value}=await reader.read();if(done)break;
      if(offset+value.byteLength>count)throw new Error('Flood asset exceeds its fixed budget');
      output.set(value,offset);offset+=value.byteLength;
    }
    if(offset!==count)throw new Error('Truncated flood asset');
    return output;
  } finally { await reader.cancel().catch(()=>{});reader.releaseLock(); }
}

/** Fetch only in Flood mode, with fixed allocations and teardown cancellation. */
export async function loadFloodExtensionV205(water: FloodWater, signal: AbortSignal): Promise<boolean> {
  if(signal.aborted)return false;
  const response = await fetch(new URL(`./mesh/regierungsviertel/${receipt.file}?v=${receipt.sha256}`,new URL(import.meta.env.BASE_URL,document.baseURI)),{signal});
  if(!response.ok||!response.body)throw new Error(`Flood extent HTTP ${response.status}`);
  const decoded = response.headers.get('content-encoding')?.toLowerCase().split(',').some(s=>s.trim()==='gzip');
  let bytes: Uint8Array<ArrayBuffer>;
  if(decoded)bytes=await readBounded(response.body,receipt.rawBytes,signal);
  else {
    const packed=await readBounded(response.body,receipt.compressedBytes,signal);
    if(signal.aborted)return false;
    if(typeof DecompressionStream!=='undefined') {
      bytes=await readBounded(new Response(packed).body!.pipeThrough(new DecompressionStream('gzip')),receipt.rawBytes,signal);
    } else {
      const {gunzipSync}=await import('three/examples/jsm/libs/fflate.module.js');
      if(signal.aborted)return false;
      const output=new Uint8Array(receipt.rawBytes);
      const result=gunzipSync(packed,{out:output});
      if(result.byteLength!==receipt.rawBytes)throw new Error('Truncated flood extent');
      bytes=output;
    }
  }
  if(signal.aborted)return false;
  water.add(decodeFloodExtensionV205(bytes.buffer,water));
  return true;
}
