import { expect, test } from "bun:test";
import { BoxGeometry, DataTexture, InstancedMesh, MeshBasicMaterial, OrthographicCamera, Scene, type WebGLRenderer } from "three";
import { createSceneGpuResidency } from "../src/sceneGpuResidency";

test("GPU eviction never destroys an authored instance morph texture", () => {
  const scene = new Scene();
  const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  camera.position.z = 10; camera.lookAt(0, 0, 0);
  const renderer = { info: { render: { frame: 1 } }, getContext: () => ({ isContextLost: () => false }) } as unknown as WebGLRenderer;
  const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 1);
  mesh.position.x = 1000;
  const morph = new DataTexture(new Float32Array([1, 0, 0, 1]), 1, 1);
  mesh.morphTexture = morph;
  let textureDisposed = false;
  morph.addEventListener("dispose", () => { textureDisposed = true; });
  scene.add(mesh);
  const residency = createSceneGpuResidency(renderer, camera, { budgetBytes: 0, graceMs: 0, now: () => 0 });
  residency.enqueue(scene);
  mesh.onAfterRender(renderer, scene, camera, mesh.geometry, mesh.material, null);
  expect(residency.residentBytes).toBe(64);
  expect(residency.refresh(100)).toBe(0);
  expect(mesh.morphTexture).toBe(morph);
  expect(textureDisposed).toBeFalse();
  expect(residency.residentBytes).toBe(64);
  residency.dispose();
  morph.dispose();
});

function policyHost(options: { budgetBytes?: number; budgetBuffers?: number; graceMs?: number } = {}) {
  const scene = new Scene();
  const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 1000);
  camera.position.z = 10; camera.lookAt(0, 0, 0);
  const renderer = { info: { render: { frame: 1 } }, getContext: () => ({ isContextLost: () => false }) } as unknown as WebGLRenderer;
  const residency = createSceneGpuResidency(renderer, camera, { now: () => 0, ...options });
  const create = (x: number, z = 0) => {
    const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 1);
    mesh.position.set(x, 0, z); scene.add(mesh); return mesh;
  };
  const observe = () => {
    residency.enqueue(scene);
    scene.traverse(object => {
      if (object instanceof InstancedMesh) object.onAfterRender(renderer, scene, camera, object.geometry, object.material, null);
    });
  };
  return { scene, camera, residency, renderer, create, observe };
}

test("small instance buffers trigger handle pressure while byte usage stays low, respecting grace/cadence/work bounds", () => {
  const h = policyHost({ budgetBytes: 1024 * 1024, budgetBuffers: 1 });
  const meshes = Array.from({ length: 70 }, () => h.create(1000));
  const originals = meshes.map(mesh => mesh.instanceMatrix.array);
  h.observe(); expect(h.residency.residentBuffers).toBe(70); expect(h.residency.residentBytes).toBe(4480);
  expect(h.residency.refresh(1000)).toBe(0);
  expect(h.residency.refresh(2001)).toBe(64); expect(h.residency.residentBuffers).toBe(6);
  expect(h.residency.refresh(2050)).toBe(0);
  expect(h.residency.refresh(2102)).toBe(5); expect(h.residency.residentBuffers).toBe(1);
  meshes.forEach((mesh, i) => { expect(mesh.instanceMatrix.array).toBe(originals[i]); expect(mesh.visible).toBeTrue(); });
  h.residency.dispose(); expect(h.residency.residentBuffers).toBe(0);
});

test("a large camera jump clears the entire safe previous view before new uploads, even below budgets and inside grace", () => {
  const h = policyHost({ budgetBytes: Infinity, budgetBuffers: Infinity });
  const obsolete = Array.from({ length: 70 }, () => h.create(0));
  const visible = h.create(128), margin = h.create(136), uncullable = h.create(0);
  uncullable.frustumCulled = false;
  const sharedA = h.create(0), sharedB = h.create(0); sharedB.instanceMatrix = sharedA.instanceMatrix;
  const morph = h.create(0); morph.morphTexture = new DataTexture(new Float32Array(4), 1, 1);
  const oldArrays = obsolete.map(mesh => mesh.instanceMatrix.array);
  h.observe(); const before = h.residency.residentBuffers;
  // Every uniquely uploaded attribute is counted once even with shared owners.
  expect(before).toBe(75); expect(h.residency.refresh(0)).toBe(0);
  h.camera.position.x = 128; h.camera.lookAt(128, 0, 0);
  expect(h.residency.refresh(1)).toBe(70); expect(h.residency.residentBuffers).toBe(5);
  expect(h.residency.refresh(2)).toBe(0);
  obsolete.forEach((mesh, i) => expect(mesh.instanceMatrix.array).toBe(oldArrays[i]));
  for (const mesh of [visible, margin, uncullable, sharedA, sharedB, morph]) expect(mesh.visible).toBeTrue();
  expect(morph.morphTexture).not.toBeNull();
  // Returning uses the same CPU arrays and ordinary Three upload observation.
  obsolete[0].onAfterRender(h.renderer, h.scene, h.camera, obsolete[0].geometry, obsolete[0].material, null);
  expect(h.residency.residentBuffers).toBe(6);
  h.residency.release(obsolete[0]); expect(h.residency.residentBuffers).toBe(5);
  h.residency.dispose(); morph.morphTexture!.dispose();
});

test("cleanup motion accumulates and projection changes retire only newly offview instances", () => {
  const h = policyHost({ budgetBytes: Infinity, budgetBuffers: Infinity });
  h.create(0); h.observe(); expect(h.residency.refresh(0)).toBe(0);
  h.camera.position.x = 64; h.camera.lookAt(64, 0, 0); expect(h.residency.refresh(1)).toBe(0);
  h.camera.position.x = 128; h.camera.lookAt(128, 0, 0); expect(h.residency.refresh(2)).toBe(1);
  const edge = h.create(136), center = h.create(128); h.observe();
  h.camera.zoom = 2; h.camera.updateProjectionMatrix();
  expect(h.residency.refresh(3)).toBe(2); // old view plus the now-outside former margin
  expect(h.residency.residentBuffers).toBe(1); expect(center.visible).toBeTrue(); expect(edge.visible).toBeTrue();
  h.residency.dispose();
});

test("camera rotation beyond 36 degrees performs urgent cleanup without changing visible detail", () => {
  const h = policyHost({ budgetBytes: Infinity, budgetBuffers: Infinity });
  h.camera.position.set(0, 0, 0); h.camera.lookAt(0, 0, -1);
  const mesh = h.create(0, -100); h.observe(); expect(h.residency.refresh(0)).toBe(0);
  h.camera.rotation.y = 35 * Math.PI / 180; expect(h.residency.refresh(1)).toBe(0);
  h.camera.rotation.y = 37 * Math.PI / 180; expect(h.residency.refresh(2)).toBe(1);
  expect(h.residency.residentBuffers).toBe(0); expect(mesh.visible).toBeTrue();
  h.residency.dispose();
});

test("mode publication can immediately retire hidden and offview instances with an unchanged camera", () => {
  const h = policyHost({ budgetBytes: Infinity, budgetBuffers: Infinity });
  const visible = h.create(0), hidden = h.create(0), outside = h.create(1000);
  hidden.frustumCulled = false;
  h.observe(); expect(h.residency.refresh(0)).toBe(0);
  hidden.visible = false;
  const visibleArray = visible.instanceMatrix.array, hiddenArray = hidden.instanceMatrix.array;
  expect(h.residency.refresh(1, true)).toBe(2);
  expect(h.residency.residentBuffers).toBe(1);
  expect(visible.instanceMatrix.array).toBe(visibleArray); expect(hidden.instanceMatrix.array).toBe(hiddenArray);
  expect(hidden.visible).toBeFalse(); expect(outside.visible).toBeTrue();
  expect(h.residency.refresh(2, true)).toBe(0);
  h.residency.dispose();
});
