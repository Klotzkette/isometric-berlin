import { describe, expect, test } from "bun:test";
import {
  BoxGeometry, BufferAttribute, BufferGeometry, Group, InstancedMesh,
  InterleavedBuffer, InterleavedBufferAttribute, Line, LineBasicMaterial, Mesh,
  MeshBasicMaterial, OrthographicCamera, Points, PointsMaterial, Scene,
  type Camera, type Material, type WebGLRenderer,
} from "three";
import { WebGLAttributes } from "three/src/renderers/webgl/WebGLAttributes.js";
import { WebGLGeometries } from "three/src/renderers/webgl/WebGLGeometries.js";
import { createSceneGeometryGpuResidency } from "../src/sceneGeometryGpuResidency";
import { createSceneGpuResidency } from "../src/sceneGpuResidency";

type Renderable = Mesh | Line | Points;

/** Exercise Three's real allocation/disposal backend with a counting GL host. */
function host(options: Parameters<typeof createSceneGeometryGpuResidency>[2] = {}) {
  const scene = new Scene();
  const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  camera.position.z = 10; camera.lookAt(0, 0, 0);
  let time = 0, contextLost = false, nextId = 0;
  const live = new Set<object>();
  const uploads: ArrayBufferView[] = [];
  const released: BufferGeometry[] = [];
  const gl = {
    ARRAY_BUFFER: 34962, ELEMENT_ARRAY_BUFFER: 34963, FLOAT: 5126,
    UNSIGNED_SHORT: 5123, UNSIGNED_INT: 5125,
    createBuffer: () => { const id = { id: nextId++ }; live.add(id); return id; },
    deleteBuffer: (id: object) => { live.delete(id); },
    bindBuffer: () => {},
    bufferData: (_target: number, data: ArrayBufferView) => { uploads.push(data); },
    bufferSubData: () => {},
  };
  const events = new EventTarget();
  const info = { render: { frame: 0 }, memory: { geometries: 0 } };
  const attributes = WebGLAttributes(gl);
  const geometries = WebGLGeometries(gl, attributes, info, {
    releaseStatesOfGeometry: (geometry: BufferGeometry) => { released.push(geometry); },
  });
  const renderer = {
    info, domElement: events, getContext: () => ({ isContextLost: () => contextLost }),
  } as unknown as WebGLRenderer;
  const residency = createSceneGeometryGpuResidency(renderer, camera, { now: () => time, ...options });
  const draw = (object: Renderable, view: Camera = camera) => {
    info.render.frame++;
    geometries.get(object, object.geometry); geometries.update(object.geometry);
    const material = (Array.isArray(object.material) ? object.material[0] : object.material) as Material;
    const index = "wireframe" in material && material.wireframe
      ? geometries.getWireframeAttribute(object.geometry) : object.geometry.index;
    if (index) attributes.update(index, gl.ELEMENT_ARRAY_BUFFER);
    object.onAfterRender(renderer, scene, view, object.geometry, material, null);
  };
  const box = (x = 100) => { const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); mesh.position.x = x; scene.add(mesh); return mesh; };
  return { scene, camera, residency, renderer, draw, box, live, uploads, released, events,
    set time(value: number) { time = value; },
    set contextLost(value: boolean) { contextLost = value; },
  };
}

function interleavedTriangle() {
  const geometry = new BufferGeometry();
  const data = new InterleavedBuffer(new Float32Array([
    -1, -1, 0, 0, 0, 1, 1, -1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1,
  ]), 6);
  geometry.setAttribute("position", new InterleavedBufferAttribute(data, 3, 0));
  geometry.setAttribute("normal", new InterleavedBufferAttribute(data, 3, 3));
  geometry.setIndex([0, 1, 2]);
  return { geometry, data };
}

describe("lossless static-geometry GPU residency", () => {
  test("counts real uploads once, including interleaved storage, and reuploads identical data", () => {
    const h = host({ budgetBuffers: 0, graceMs: 0 });
    const { geometry, data } = interleavedTriangle();
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material); mesh.position.x = 100; h.scene.add(mesh);
    const originalAttributes = { ...geometry.attributes }, originalIndex = geometry.index;
    const source = data.array.slice();
    let materialDisposals = 0;
    material.addEventListener("dispose", () => { materialDisposals++; });
    h.residency.enqueue(h.scene);
    expect(h.residency.residentBuffers).toBe(0);
    h.draw(mesh); h.draw(mesh);
    expect(h.residency.residentBuffers).toBe(2);
    expect(h.live.size).toBe(2);
    expect(h.uploads.length).toBe(2);
    expect(h.residency.refresh(10)).toBe(1);
    expect(h.live.size).toBe(0);
    expect(h.residency.residentBuffers).toBe(0);
    expect(h.released).toEqual([geometry]);
    expect(mesh.parent).toBe(h.scene);
    expect(mesh.geometry).toBe(geometry);
    expect(geometry.attributes).toEqual(originalAttributes);
    expect(geometry.index).toBe(originalIndex);
    expect(data.array).toEqual(source);
    expect(mesh.material).toBe(material);
    expect(materialDisposals).toBe(0);
    h.draw(mesh);
    expect(h.live.size).toBe(2);
    expect(h.residency.residentBuffers).toBe(2);
    expect(h.uploads[2]).toBe(h.uploads[0]);
    expect(h.uploads[3]).toBe(h.uploads[1]);
    h.residency.dispose();
  });

  test("one visible owner protects shared geometry, including the expanded view margin", () => {
    const h = host({ budgetBuffers: 0, graceMs: 0 });
    const distant = h.box(100);
    const near = new Mesh(distant.geometry, distant.material); near.position.x = 8; h.scene.add(near);
    h.residency.enqueue(h.scene); h.draw(distant); h.draw(near);
    expect(h.residency.residentBuffers).toBe(4);
    expect(h.residency.refresh(100)).toBe(0);
    near.position.x = 100;
    expect(h.residency.refresh(200)).toBe(1);
    expect(h.live.size).toBe(0);
    expect(h.released).toEqual([distant.geometry]);
    h.residency.dispose();
  });

  test("shared attributes across different geometries prohibit retirement", () => {
    const h = host({ budgetBuffers: 0, graceMs: 0 });
    const { geometry, data } = interleavedTriangle();
    const second = new BufferGeometry();
    second.setAttribute("position", new InterleavedBufferAttribute(data, 3, 0));
    second.setIndex([0, 1, 2]);
    const firstMesh = new Mesh(geometry, new MeshBasicMaterial()); firstMesh.position.x = 100;
    const secondMesh = new Mesh(second, firstMesh.material); secondMesh.visible = false;
    h.scene.add(firstMesh, secondMesh); h.residency.enqueue(h.scene);
    h.draw(firstMesh); h.draw(secondMesh);
    expect(h.residency.residentBuffers).toBe(3);
    expect(h.live.size).toBe(3);
    expect(h.residency.refresh(100, true)).toBe(0);
    expect(h.released).toEqual([]);
    h.residency.release(secondMesh); h.scene.remove(secondMesh);
    expect(h.residency.refresh(200, true)).toBe(1);
    expect(h.released).toEqual([geometry]);
    h.residency.dispose(); second.dispose();
  });

  test("ordinary retirement honors grace and oldest use, with a bounded rotating scan", () => {
    const h = host({ budgetBuffers: 4, graceMs: 100, scanLimit: 1, scanIntervalMs: 10 });
    const first = h.box(), second = h.box();
    h.residency.enqueue(h.scene); h.draw(first); h.time = 50; h.draw(second);
    expect(h.residency.refresh(60)).toBe(0);
    expect(h.residency.refresh(65)).toBe(0);
    expect(h.residency.refresh(110)).toBe(0); // Next one still in grace.
    expect(h.residency.refresh(120)).toBe(1); // Rotation returns to old first.
    expect(h.released).toEqual([first.geometry]);
    expect(h.residency.residentBuffers).toBe(4);
    h.residency.dispose();
  });

  test("jump retirement occurs before the new view uploads, even below the budget and within grace", () => {
    const h = host({ budgetBuffers: 6000, graceMs: 2000 });
    const previous = h.box(0), destination = h.box(200);
    h.residency.enqueue(h.scene); h.draw(previous);
    expect(h.residency.refresh(0)).toBe(0);
    h.camera.position.x = 200; h.camera.lookAt(200, 0, 0);
    expect(h.residency.refresh(1)).toBe(1);
    expect(h.live.size).toBe(0);
    expect(h.released).toEqual([previous.geometry]);
    h.draw(destination);
    expect(h.live.size).toBe(4);
    expect(h.residency.refresh(2)).toBe(0);
    h.residency.dispose();
  });

  test("acute pressure ignores grace but never retires a currently visible object", () => {
    const h = host({ budgetBuffers: 0, graceMs: 2000, emergencyHeadroomBuffers: 4 });
    const visible = h.box(0), hidden = h.box(100);
    h.residency.enqueue(h.scene); h.draw(visible); h.draw(hidden);
    expect(h.residency.refresh(1)).toBe(1);
    expect(h.released).toEqual([hidden.geometry]);
    expect(h.residency.residentBuffers).toBe(4);
    h.residency.dispose();
  });

  test("protected pressure sweeps once, then uses bounded cadence until fresh buffer growth", () => {
    const h = host({ budgetBuffers: 4, emergencyHeadroomBuffers: 4, graceMs: 0,
      scanLimit: 2, scanIntervalMs: 100 });
    const meshes = Array.from({ length: 20 }, () => h.box(0));
    h.residency.enqueue(h.scene);
    let inspections = 0;
    for (const mesh of meshes) {
      h.draw(mesh);
      mesh.geometry.attributes = new Proxy(mesh.geometry.attributes, {
        ownKeys(target) { inspections++; return Reflect.ownKeys(target); },
      });
    }
    expect(h.residency.refresh(0)).toBe(0);
    expect(inspections).toBe(20);
    for (let frame = 1; frame < 100; frame++) expect(h.residency.refresh(frame)).toBe(0);
    expect(inspections).toBe(20);
    h.residency.refresh(100);
    expect(inspections).toBe(22); // One bounded pass, not all twenty geometries.
    const additional = h.box(0); h.residency.enqueue(additional); h.draw(additional);
    h.residency.refresh(101);
    expect(inspections).toBe(42); // New headroom-sized growth permits one full pass.
    for (let frame = 102; frame < 201; frame++) h.residency.refresh(frame);
    expect(inspections).toBe(42);
    h.residency.refresh(201);
    expect(inspections).toBe(44);
    h.residency.refresh(202, true);
    expect(inspections).toBe(64); // Explicit transitions still sweep immediately.
    expect(h.released).toEqual([]);
    expect(h.residency.residentBuffers).toBe(84);
    h.residency.dispose();
  });

  test("small movements accumulate against the last swept view", () => {
    const h = host(); const mesh = h.box(0);
    h.residency.enqueue(h.scene); h.draw(mesh); h.residency.refresh(0);
    for (let step = 1; step <= 12; step++) {
      h.camera.position.x = step * 10; h.camera.lookAt(step * 10, 0, 0);
      expect(h.residency.refresh(step)).toBe(0);
    }
    h.camera.position.x = 130; h.camera.lookAt(130, 0, 0);
    expect(h.residency.refresh(13)).toBe(1);
    expect(h.live.size).toBe(0);
    h.residency.dispose();
  });

  test("small continuous zoom avoids full sweeps while a large zoom retires old off-view buffers", () => {
    const h = host(); const mesh = h.box(100);
    h.residency.enqueue(h.scene); h.draw(mesh); h.residency.refresh(0);
    for (let index = 1; index <= 10; index++) {
      h.camera.zoom *= 1.01; h.camera.updateProjectionMatrix();
      expect(h.residency.refresh(index)).toBe(0);
    }
    h.camera.zoom *= 2; h.camera.updateProjectionMatrix();
    expect(h.residency.refresh(11)).toBe(1);
    expect(h.live.size).toBe(0);
    h.residency.dispose();
  });

  test("a completed scan retires the least recently rendered geometry first", () => {
    const h = host({ budgetBuffers: 8, graceMs: 0 });
    const first = h.box(), second = h.box(), third = h.box();
    h.residency.enqueue(h.scene);
    h.time = 30; h.draw(first); h.time = 10; h.draw(second); h.time = 20; h.draw(third);
    expect(h.residency.refresh(100)).toBe(1);
    expect(h.released).toEqual([second.geometry]);
    h.residency.dispose();
  });

  test("hidden parents and camera layers are respected, while uncullable owners remain protected", () => {
    const h = host({ budgetBuffers: 0, graceMs: 0 });
    const hiddenParent = new Group(); hiddenParent.visible = false; h.scene.add(hiddenParent);
    const child = h.box(0); hiddenParent.add(child);
    const layer = h.box(0); layer.layers.set(1);
    const uncullable = h.box(100); uncullable.frustumCulled = false;
    h.residency.enqueue(h.scene); h.draw(child); h.draw(layer); h.draw(uncullable);
    expect(h.residency.refresh(100)).toBe(2);
    expect(h.released).toEqual([child.geometry, layer.geometry]);
    expect(h.live.size).toBe(4);
    h.residency.dispose();
  });

  test("Line and Points buffers participate without disposal of their materials", () => {
    const h = host({ budgetBuffers: 0, graceMs: 0 });
    const line = new Line(new BoxGeometry(), new LineBasicMaterial()); line.position.x = 100;
    const points = new Points(new BoxGeometry(), new PointsMaterial()); points.position.x = 100;
    h.scene.add(line, points); h.residency.enqueue(h.scene); h.draw(line); h.draw(points);
    expect(h.residency.residentBuffers).toBe(8);
    expect(h.residency.refresh(100)).toBe(2);
    expect(h.live.size).toBe(0);
    expect(h.scene.children).toEqual([line, points]);
    h.residency.dispose();
  });

  test("first-upload interleaving and subsequent authored replacement cannot evict stale ownership", () => {
    const h = host({ budgetBuffers: 0, graceMs: 0 });
    const mesh = h.box(100); h.residency.enqueue(h.scene);
    const { geometry } = interleavedTriangle();
    mesh.geometry.attributes = geometry.attributes; mesh.geometry.index = geometry.index;
    h.draw(mesh);
    expect(h.residency.residentBuffers).toBe(2);
    mesh.geometry.setAttribute("color", new BufferAttribute(new Float32Array(9), 3));
    h.draw(mesh);
    expect(h.residency.refresh(100, true)).toBe(0);
    expect(h.residency.residentBuffers).toBe(3);
    expect(h.live.size).toBe(3);
    expect(h.released).toEqual([]);
    h.residency.dispose();
  });

  test("steady draws do not re-enumerate geometry storage or allocate attribute snapshots", () => {
    const h = host(); const mesh = h.box();
    h.residency.enqueue(h.scene); h.draw(mesh);
    let inspections = 0;
    mesh.geometry.attributes = new Proxy(mesh.geometry.attributes, {
      ownKeys(target) { inspections++; return Reflect.ownKeys(target); },
    });
    // Call just the real post-render hook: Three's own upload loop is separate.
    for (let index = 0; index < 1000; index++) {
      mesh.onAfterRender(h.renderer, h.scene, h.camera, mesh.geometry, mesh.material, null);
    }
    expect(inspections).toBe(0);
    expect(h.residency.residentBuffers).toBe(4);
    h.residency.dispose();
  });

  test("wireframe's additional private index is counted and retired with the geometry", () => {
    const h = host({ budgetBuffers: 0, graceMs: 0 }); const mesh = h.box();
    h.residency.enqueue(h.scene); h.draw(mesh); mesh.material.wireframe = true; h.draw(mesh);
    expect(h.residency.residentBuffers).toBe(5);
    expect(h.live.size).toBe(5);
    expect(h.residency.refresh(100)).toBe(1);
    expect(h.live.size).toBe(0);
    h.residency.dispose();
  });

  test("context loss resets observed residency and suspended context never sweeps", () => {
    const h = host({ budgetBuffers: 0, graceMs: 0 }); const mesh = h.box();
    h.residency.enqueue(h.scene); h.draw(mesh);
    h.contextLost = true; h.events.dispatchEvent(new Event("webglcontextlost"));
    expect(h.residency.residentBuffers).toBe(0);
    expect(h.residency.refresh(100, true)).toBe(0);
    h.contextLost = false; h.draw(mesh);
    expect(h.residency.residentBuffers).toBe(4);
    h.residency.dispose();
    expect(h.residency.residentBuffers).toBe(0);
    h.draw(mesh); expect(h.residency.residentBuffers).toBe(0);
  });

  test("observer chains restore in reverse order and never replace a later authored callback", () => {
    const h = host(); const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 1);
    h.scene.add(mesh);
    let authoredCalls = 0;
    const original = () => { authoredCalls++; }; mesh.onAfterRender = original;
    const instances = createSceneGpuResidency(h.renderer, h.camera, { now: () => 0 });
    instances.enqueue(h.scene); const instanceObserver = mesh.onAfterRender;
    h.residency.enqueue(h.scene); const geometryObserver = mesh.onAfterRender;
    const laterWrapper: typeof mesh.onAfterRender = function (...args) { geometryObserver.apply(this, args); };
    mesh.onAfterRender = laterWrapper;
    h.draw(mesh);
    expect(authoredCalls).toBe(1);
    expect(instances.residentBytes).toBe(64);
    expect(h.residency.residentBuffers).toBe(4);
    mesh.onAfterRender = geometryObserver;
    h.residency.release(h.scene); expect(mesh.onAfterRender).toBe(instanceObserver);
    instances.release(h.scene); expect(mesh.onAfterRender).toBe(original);
    h.residency.enqueue(h.scene); mesh.onAfterRender = laterWrapper;
    h.residency.release(h.scene); expect(mesh.onAfterRender).toBe(laterWrapper);
    h.residency.dispose(); instances.dispose();
  });
});
