import {expect, test} from "bun:test";
import {BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, PerspectiveCamera, Scene, WebGLRenderer, WebGLRenderTarget, InterleavedBuffer, InterleavedBufferAttribute} from "three";
import {queueOpeningShaderProgramsV383,queueOpeningSmaaProgramsV383} from "../src/openingShaderProgramsV383";
import {hasParkedStaticStorageBackingV323, parkOpeningWorldBuffers} from "../src/losslessStaticStorage";
import {installGroundDrawCullingV383, prepareGroundDrawRangesV383} from "../src/groundDrawRangesV383";

function terrain() {
  const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 4096);
  mesh.name = "Drawn ground slabs";
  const m = new Matrix4(), color = new Color();
  for(let i=0;i<mesh.count;i++){
    m.makeTranslation(i-2048,0,-10);
    mesh.setMatrixAt(i,m);
    mesh.setColorAt(i,color.setHex(i));
  }
  return mesh;
}

test("draw ranges address the original instance and color buffers at ordered offsets, including after movement", () => {
  const scene = new Scene(), mesh = terrain(), camera = new PerspectiveCamera(40,1,.1,40);
  scene.add(mesh);
  prepareGroundDrawRangesV383(mesh);
  const ranges: number[][] = [];
  const geometry = mesh.geometry, matrix = mesh.instanceMatrix, color = mesh.instanceColor!;
  const renderer = {renderBufferDirect(){
    const m = geometry.getAttribute("instanceMatrix") as unknown as InterleavedBufferAttribute;
    const c = geometry.getAttribute("instanceColor") as unknown as InterleavedBufferAttribute;
    expect(m.data as unknown).toBe(matrix); expect(c.data as unknown).toBe(color);
    expect(m.offset/16).toBe(c.offset/3);
    ranges.push([m.offset/16, mesh.count]);
  }} as unknown as WebGLRenderer;
  installGroundDrawCullingV383(renderer); installGroundDrawCullingV383(renderer);
  const draw = () => renderer.renderBufferDirect(camera,scene,geometry,mesh.material as MeshBasicMaterial,mesh,geometry.groups[0]);
  draw();
  expect(ranges.flatMap(([start,count])=>Array.from({length:count},(_,i)=>i+start))).toContain(2048);
  expect(ranges.reduce((v,r)=>v+r[1],0)).toBeLessThan(256);
  expect(geometry.getAttribute("instanceColor")).toBeUndefined();
  expect(mesh.count).toBe(4096);
  mesh.setMatrixAt(10,new Matrix4().makeTranslation(0,1,-8)); mesh.instanceMatrix.needsUpdate=true;
  ranges.length=0; draw(); expect(ranges[0][0]).toBe(0);
  expect(mesh.instanceMatrix).toBe(matrix); expect(mesh.instanceColor).toBe(color);
});

test("facade batches respect the offset and stride in the original interleaved vertex buffer", () => {
  const mesh = terrain(), scene = new Scene(), camera = new PerspectiveCamera(40, 1, .1, 40);
  mesh.name = "Source-bound ministry reveals, unlit glazing and seven public colonnade arches";
  const geometry = mesh.geometry, original = geometry.getAttribute("position");
  const values = new Float32Array(original.count * 6);
  for (let i = 0; i < original.count; i++) {
    values.set([9999, 9999, 9999, original.getX(i), original.getY(i), original.getZ(i)], i * 6);
  }
  const shared = new InterleavedBuffer(values, 6);
  const positions = new InterleavedBufferAttribute(shared, 3, 3);
  geometry.setAttribute("position", positions);
  const ranges: number[][] = [];
  const renderer = {renderBufferDirect() {
    const binding = geometry.getAttribute("instanceMatrix") as unknown as InterleavedBufferAttribute;
    ranges.push([binding.offset / 16, mesh.count]);
  }} as unknown as WebGLRenderer;
  installGroundDrawCullingV383(renderer);
  renderer.renderBufferDirect(camera, scene, geometry, mesh.material as MeshBasicMaterial, mesh, geometry.groups[0]);
  expect(ranges.some(([start, count]) => start <= 2048 && start + count > 2048)).toBe(true);
  expect(ranges.reduce((total, [, count]) => total + count, 0)).toBeLessThan(256);
  expect(geometry.getAttribute("position")).toBe(positions);
  expect(positions.data.array).toBe(values);
});

test("failed drawing restores canonical geometry and count for navigation and the next render", () => {
  const mesh = terrain();
  const renderer = {renderBufferDirect(){throw Error("GPU unavailable");}} as unknown as WebGLRenderer;
  installGroundDrawCullingV383(renderer);
  expect(()=>renderer.renderBufferDirect(new PerspectiveCamera(50,1,.1,100),new Scene(),mesh.geometry,
    mesh.material as MeshBasicMaterial,mesh,mesh.geometry.groups[0])).toThrow("GPU unavailable");
  expect(mesh.count).toBe(4096);expect(mesh.geometry.attributes.instanceMatrix).toBeUndefined();
});

for(const fallback of [false,true]) test("opening storage restores all 32-bit words, including NaN payloads / fallback="+fallback,async()=>{
  const ctor = globalThis.CompressionStream;
  if(fallback) globalThis.CompressionStream=undefined as unknown as typeof CompressionStream;
  try {
    const world=new Group(), addons=new Group(), mesh=terrain();
    const matrix=mesh.instanceMatrix, source=new Uint32Array(matrix.array.buffer);
    source[0]=0x80000000;source[1]=0x7fc01001;
    const expected=source.slice();
    const other=new Float32Array(36000); other.fill(1.125);
    const shared=new BufferAttribute(other,3);
    const geometry=new BufferGeometry().setAttribute("position",shared);
    geometry.userData.losslessStaticBacking=true;
    world.add(mesh,new Mesh(geometry)); addons.add(new Mesh(geometry));
    await parkOpeningWorldBuffers(world,addons,undefined,()=>false,async()=>{});
    expect(hasParkedStaticStorageBackingV323(matrix)).toBe(true);
    expect(Buffer.from(matrix.array.buffer)).toEqual(Buffer.from(expected.buffer));
    expect(shared.array).toBe(other); expect(other.byteLength).toBe(144000);
    matrix.needsUpdate=true;
    expect(hasParkedStaticStorageBackingV323(matrix)).toBe(false);
  } finally {globalThis.CompressionStream=ctor;}
});

test("cancelling both codec lanes leaves a source owned by the builder",async()=>{
  const world=new Group(), a=terrain(), b=terrain(); world.add(a,b);
  let cancelled=false;
  const done=parkOpeningWorldBuffers(world,new Group(),undefined,()=>cancelled,async()=>{});
  cancelled=true;
  await expect(done).rejects.toThrow("cancelled");
  expect(hasParkedStaticStorageBackingV323(a.instanceMatrix)).toBe(false);
  expect(hasParkedStaticStorageBackingV323(b.instanceMatrix)).toBe(false);
  expect(a.instanceMatrix.array.length).toBe(4096*16);
});

test("an instance matrix shared with a geometry subview never detaches the borrowed bytes",async()=>{
  const world=new Group(), mesh=terrain(), addons=new Group();
  const original=mesh.instanceMatrix.array as Float32Array;
  const view=new BufferAttribute(original.subarray(0,4095),3);
  const g=new BufferGeometry().setAttribute("position",view);
  world.add(mesh);addons.add(new Mesh(g));
  await parkOpeningWorldBuffers(world,addons,undefined,()=>false,async()=>{});
  expect(hasParkedStaticStorageBackingV323(mesh.instanceMatrix)).toBe(true);
  expect(original.byteLength).toBe(4096*64);
  mesh.instanceMatrix.onUploadCallback();
  expect(view.array.byteLength).toBe(4095*4);
});

test("optional shader submission restores the target, original material and actual parent on driver failure",()=>{
  const root=new Group(), scene=new Scene(), camera=new PerspectiveCamera();
  const mesh=new Mesh(new BoxGeometry(),new MeshBasicMaterial());
  root.add(mesh);
  const original=new WebGLRenderTarget(1,1), output=new WebGLRenderTarget(1,1);
  let active=original, called=false;
  const renderer={
    extensions:{has:()=>true}, getContext:()=>({isContextLost:()=>false}),
    getRenderTarget:()=>active, getActiveCubeFace:()=>0, getActiveMipmapLevel:()=>0,
    setRenderTarget:(target:WebGLRenderTarget)=>{active=target;},
    compile:(objects:Group,eye:PerspectiveCamera,environment:Scene)=>{
      called=true;expect(active).toBe(output);expect(objects.children).toContain(mesh);
      expect(mesh.parent).toBe(root);expect(eye).toBe(camera);expect(environment).toBe(scene);
      throw Error("Driver not ready");
    }
  } as unknown as WebGLRenderer;
  queueOpeningShaderProgramsV383(renderer,camera,scene,root,output);
  expect(called).toBe(true);expect(active).toBe(original);expect(mesh.parent).toBe(root);
});

test("all three existing fullscreen programs are queued for their own targets without drawing or changing the quad",()=>{
  const original=new WebGLRenderTarget(1,1), edges=original.clone(), weights=original.clone();
  const quad=new Mesh(new BoxGeometry(),new MeshBasicMaterial());
  const materials=[new MeshBasicMaterial(),new MeshBasicMaterial(),new MeshBasicMaterial()];
  const observed: unknown[][]=[];let active:WebGLRenderTarget|null=original;
  const renderer={
    extensions:{has:()=>true},getContext:()=>({isContextLost:()=>false}),
    getRenderTarget:()=>active,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,
    setRenderTarget:(target:WebGLRenderTarget|null)=>{active=target;},
    compile:(scene:Scene)=>{observed.push([active,(scene.children[0] as Mesh).material]);},
  } as unknown as WebGLRenderer;
  queueOpeningSmaaProgramsV383(renderer,new PerspectiveCamera(),{_fsQuad:{_mesh:quad},_edgesRT:edges,
    _weightsRT:weights,_materialEdges:materials[0],_materialWeights:materials[1],_materialBlend:materials[2]});
  expect(observed).toEqual([[edges,materials[0]],[weights,materials[1]],[null,materials[2]]]);
  expect(quad.parent).toBe(null);expect(active).toBe(original);expect(materials.includes(quad.material)).toBe(false);
});
