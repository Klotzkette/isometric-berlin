import { describe, expect, spyOn, test } from "bun:test";
import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DirectionalLight,
  Frustum, Group, InstancedMesh, Line, LineBasicMaterial, LineSegments,
  Matrix4, Mesh, MeshBasicMaterial,
  OrthographicCamera, PerspectiveCamera, PointLight, Scene, Vector4, WebGLRenderTarget,
  type Camera, type Object3D, type WebGLRenderer,
} from "three";
import { WebGLAttributes } from "three/src/renderers/webgl/WebGLAttributes.js";
import { WebGLGeometries } from "three/src/renderers/webgl/WebGLGeometries.js";
import { WebGLObjects } from "three/src/renderers/webgl/WebGLObjects.js";
import {
  createSceneGpuWarmup, GPU_WARMUP_MAX_BYTES, GPU_WARMUP_MAX_OBJECTS,
  GPU_WARMUP_MAX_VIEW_CANDIDATES, type SceneGpuWarmupOptions,
} from "../src/sceneGpuWarmup";
import { retireSceneMaterialPrograms } from "../src/sceneMaterialPrograms";
import { createSceneGpuResidency, MOBILE_GPU_RESIDENCY_SCAN_LIMIT } from "../src/sceneGpuResidency";
import { createSceneGeometryGpuResidency } from "../src/sceneGeometryGpuResidency";
import {
  isInkDrawSuppressed, registerInkDrawObject, updateInkDrawVisibility,
} from "../src/inkDrawVisibility";

/** Real Three buffer backend, counting GL uploads; no browser/GPU speed claim. */
function host(scene: Scene, camera: Camera, options: SceneGpuWarmupOptions = {}) {
  const uploads: ArrayBufferView[] = [];
  const updates: ArrayBufferView[] = [];
  const deleted: unknown[] = [];
  let nextBuffer = 0;
  const gl = {
    ARRAY_BUFFER: 34962, ELEMENT_ARRAY_BUFFER: 34963, FLOAT: 5126,
    UNSIGNED_SHORT: 5123, UNSIGNED_INT: 5125,
    createBuffer: () => ({ id: nextBuffer++ }), bindBuffer: () => {},
    bufferData: (_target: number, array: ArrayBufferView) => uploads.push(array),
    bufferSubData: (_target: number, _offset: number, array: ArrayBufferView) => updates.push(array),
    deleteBuffer: (buffer: unknown) => { deleted.push(buffer); },
  };
  const info = { render: { frame: 0 }, memory: { geometries: 0 } };
  const attributes = WebGLAttributes(gl);
  const bindingStates = { releaseStatesOfGeometry: () => {}, releaseStatesOfObject: () => {} };
  const geometries = WebGLGeometries(gl, attributes, info, bindingStates);
  const objects = WebGLObjects(gl, geometries, attributes, bindingStates, info);
  let target: WebGLRenderTarget | null = new WebGLRenderTarget(20, 30);
  let cube = 2;
  let mip = 3;
  let viewport = new Vector4(5, 7, 300, 200);
  let scissor = new Vector4(11, 13, 80, 90);
  let scissorTest = true;
  let fail = false;
  let contextLost = false;
  let onRender: (() => void) | undefined;
  const calls: { objects: Array<Mesh | Line>; vertices: number; cameraId: number; visited: number }[] = [];
  const events = new EventTarget();
  const renderer = {
    info,
    domElement: events,
    shadowMap: { enabled: true, type: 2, autoUpdate: true, needsUpdate: true },
    localClippingEnabled: false, clippingPlanes: [],
    getContext: () => ({ isContextLost: () => contextLost }),
    getRenderTarget: () => target,
    getActiveCubeFace: () => cube,
    getActiveMipmapLevel: () => mip,
    setRenderTarget: (value: WebGLRenderTarget | null, face = 0, level = 0) => { target = value; cube = face; mip = level; },
    getViewport: (out: Vector4) => out.copy(viewport),
    getScissor: (out: Vector4) => out.copy(scissor),
    getScissorTest: () => scissorTest,
    setViewport: (value: Vector4 | number, y?: number, w?: number, h?: number) => {
      viewport = value instanceof Vector4 ? value.clone() : new Vector4(value, y, w, h);
    },
    setScissor: (value: Vector4) => { scissor = value.clone(); },
    setScissorTest: (value: boolean) => { scissorTest = value; },
    render: (root: Scene, view: Camera) => {
      onRender?.();
      if (fail) throw new Error("injected render failure");
      info.render.frame++;
      root.updateMatrixWorld(true); view.updateMatrixWorld(true);
      const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(view.projectionMatrix, view.matrixWorldInverse));
      const call = { objects: [] as Array<Mesh | Line>, vertices: 0, cameraId: view.id, visited: 0 };
      const visit = (object: Object3D) => {
        call.visited++;
        if (!object.visible) return;
        if ((object instanceof Mesh || object instanceof Line) && object.layers.test(view.layers) && (!object.frustumCulled || frustum.intersectsObject(object))) {
          objects.update(object);
          call.objects.push(object);
          const mats = Array.isArray(object.material) ? object.material : [object.material];
          const groups = Array.isArray(object.material) ? object.geometry.groups : [{ start: 0, count: Infinity, materialIndex: 0 }];
          for (const group of groups) {
            if (!mats[group.materialIndex ?? 0]?.visible) continue;
            const range = object.geometry.drawRange;
            const count = Math.min(range.start + range.count, group.start + group.count, object.geometry.index?.count ?? object.geometry.getAttribute("position").count) - Math.max(range.start, group.start);
            if (count < 0 || !Number.isFinite(count)) continue;
            if (object.geometry.index) attributes.update(object.geometry.index, gl.ELEMENT_ARRAY_BUFFER);
            call.vertices += count * (object instanceof InstancedMesh ? object.count : 1);
            object.onAfterRender(renderer as unknown as WebGLRenderer, root, view,
              object.geometry, mats[group.materialIndex ?? 0], group);
          }
        }
        for (const child of object.children) visit(child);
      };
      visit(root); calls.push(call);
    },
  };
  const warmup = createSceneGpuWarmup(renderer as unknown as WebGLRenderer, scene, camera, options);
  const state = () => ({ target, cube, mip, viewport: viewport.toArray(), scissor: scissor.toArray(), scissorTest,
    shadow: { ...renderer.shadowMap }, background: scene.background });
  return { renderer, warmup, uploads, updates, deleted, calls, state, events,
    set fail(value: boolean) { fail = value; },
    set contextLost(value: boolean) { contextLost = value; },
    set onRender(value: (() => void) | undefined) { onRender = value; } };
}

function fixture() {
  const scene = new Scene(); scene.background = new Color("skyblue");
  const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0);
  return { scene, camera };
}

describe("offscreen GPU residency without geometry changes", () => {
  test("a small preparation batch skips unrelated city branches and restores their exact live hierarchy", () => {
    const { scene, camera } = fixture();
    const activeDistrict = new Group(), otherDistrict = new Group();
    const selected = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
    const distant = Array.from({ length: 4000 }, () => new Mesh(geometry, material));
    for (const mesh of distant) mesh.position.x = 1000;
    otherDistrict.add(...distant); activeDistrict.add(selected);
    const lightAncestor = new Mesh(geometry, material), light = new DirectionalLight();
    lightAncestor.position.x = 1000; lightAncestor.add(light);
    const hidden = new Group(); hidden.visible = false;
    scene.add(activeDistrict, otherDistrict, lightAncestor, hidden);
    const h = host(scene, camera, { viewLocal: true });
    const originalChildren = [...scene.children];
    h.warmup.enqueue(scene);
    const scan = spyOn(scene, "traverse");
    h.onRender = () => {
      expect(otherDistrict.visible).toBeFalse();
      expect(activeDistrict.visible).toBeTrue();
      expect(lightAncestor.visible).toBeTrue();
      expect(lightAncestor.layers.mask).toBe(0);
      expect(light.visible).toBeTrue();
      expect(hidden.visible).toBeFalse();
      expect(selected.parent).toBe(activeDistrict);
    };
    try {
      expect(h.warmup.warmNext()).toBe(1);
      expect(scan).not.toHaveBeenCalled();
      expect(h.calls.at(-1)?.visited).toBeLessThan(10);
      expect(h.calls.at(-1)?.objects).toEqual([selected]);
      expect(h.uploads).not.toContain(geometry.getAttribute("position").array);
      expect(scene.children).toEqual(originalChildren);
      expect(otherDistrict.children).toEqual(distant);
      expect(otherDistrict.visible).toBeTrue();
      expect(hidden.visible).toBeFalse();
      expect(lightAncestor.layers.mask).toBe(1);
      // The next actual view still sees every authored object without waiting
      // for a preparation tick or changing geometry/visibility permanently.
      h.onRender = undefined;
      camera.position.x = 1000; camera.lookAt(1000, 0, 0);
      h.renderer.render(scene, camera);
      expect(h.calls.at(-1)?.objects).toHaveLength(4001);
      expect(h.calls.at(-1)?.vertices).toBe(4001 * 36);
    } finally { scan.mockRestore(); h.warmup.dispose(); }
  });

  test("failed preparation restores every suspended branch and never changes detached light owners", () => {
    const { scene, camera } = fixture();
    const selected = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const other = new Group(), hidden = new Group(); hidden.visible = false;
    other.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
    const detached = new Group(), light = new DirectionalLight(), sibling = new Group();
    detached.add(light, sibling); scene.add(selected, other, hidden, detached);
    const h = host(scene, camera); h.warmup.enqueue(selected);
    detached.removeFromParent();
    h.onRender = () => {
      expect(other.visible).toBeFalse();
      expect(sibling.visible).toBeTrue();
    };
    h.fail = true;
    expect(() => h.warmup.warmNext()).toThrow("injected render failure");
    expect(other.visible).toBeTrue();
    expect(hidden.visible).toBeFalse();
    expect(sibling.visible).toBeTrue();
    expect(selected.geometry.drawRange.count).toBe(Infinity);
    h.warmup.dispose();
  });

  test("mobile preparation keeps a generous view margin and leaves distant buffers dormant", () => {
    const { scene, camera } = fixture();
    const visible = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const margin = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    margin.position.set(8, 8, 0);
    const distant = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    distant.position.x = 1000;
    const uncullable = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    uncullable.position.x = 2000;
    uncullable.frustumCulled = false;
    const beyondFar = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    beyondFar.position.z = -200;
    scene.add(visible, margin, distant, uncullable, beyondFar);
    const original = distant.onAfterRender;
    const geometries = scene.children.map((object) => (object as Mesh).geometry);
    const arrays = geometries.map((geometry) => geometry.getAttribute("position").array.slice());
    const h = host(scene, camera, { viewLocal: true });
    h.warmup.enqueue(scene);
    expect(h.warmup.warmNext()).toBe(3);
    expect(h.calls.at(-1)?.objects).toEqual([visible, margin, uncullable]);
    expect(h.calls.at(-1)?.vertices).toBe(0);
    expect(h.uploads).not.toContain(distant.geometry.getAttribute("position").array);
    expect(h.uploads).not.toContain(beyondFar.geometry.getAttribute("position").array);
    expect(h.warmup.pending).toBeFalse();
    for (let attempt = 0; attempt < 3; attempt++) {
      h.warmup.refreshView();
      expect(h.warmup.pending).toBeFalse();
      expect(h.warmup.warmNext()).toBe(0);
    }
    expect(h.calls).toHaveLength(1);
    expect(distant.onAfterRender).not.toBe(original);
    expect(scene.children).toHaveLength(5);
    geometries.forEach((geometry, index) => {
      expect(geometry.getAttribute("position").array).toEqual(arrays[index]);
      expect(geometry.drawRange).toEqual({ start: 0, count: Infinity });
    });
    h.warmup.dispose();
    expect(distant.onAfterRender).toBe(original);
  });

  test("mobile movement prepares dormant instances exactly once before their first ordinary view", () => {
    const { scene, camera } = fixture();
    const parent = new Group(); parent.position.x = 500;
    const mesh = new InstancedMesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial(), 1);
    mesh.setMatrixAt(0, new Matrix4().makeTranslation(500, 0, 0));
    mesh.setColorAt(0, new Color("red"));
    parent.add(mesh); scene.add(parent);
    const matrices = mesh.instanceMatrix.array.slice();
    const colors = mesh.instanceColor!.array.slice();
    const h = host(scene, camera, { viewLocal: true });
    h.warmup.enqueue(scene);
    expect(h.warmup.warmNext()).toBe(0);
    expect(h.warmup.pending).toBeFalse();
    expect(h.uploads).toHaveLength(0);
    camera.position.x = 1000; camera.lookAt(1000, 0, 0);
    h.warmup.refreshView();
    expect(h.warmup.pending).toBeTrue();
    expect(h.warmup.warmNext()).toBe(1);
    expect(h.warmup.pending).toBeFalse();
    for (const array of [mesh.geometry.index!.array, mesh.geometry.getAttribute("position").array,
      mesh.instanceMatrix.array, mesh.instanceColor!.array]) {
      expect(h.uploads.filter((value) => value === array)).toHaveLength(1);
    }
    const uploadCount = h.uploads.length;
    h.renderer.render(scene, camera);
    expect(h.calls.at(-1)?.vertices).toBe(36);
    expect(h.uploads).toHaveLength(uploadCount);
    expect(h.updates).toHaveLength(0);
    expect(mesh.instanceMatrix.array).toEqual(matrices);
    expect(mesh.instanceColor!.array).toEqual(colors);
    h.warmup.dispose();
  });

  test("ordinary mobile rendering never waits for dormant preparation or a motion notification", () => {
    const { scene, camera } = fixture();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    mesh.position.x = 1000; scene.add(mesh);
    const after = mesh.onAfterRender;
    const h = host(scene, camera, { viewLocal: true });
    h.warmup.enqueue(scene); h.warmup.warmNext();
    expect(h.warmup.pending).toBeFalse();
    camera.position.x = 1000; camera.lookAt(1000, 0, 0);
    h.renderer.render(scene, camera);
    expect(h.calls.at(-1)?.objects).toEqual([mesh]);
    expect(h.calls.at(-1)?.vertices).toBe(36);
    expect(h.uploads).toContain(mesh.geometry.getAttribute("position").array);
    expect(mesh.onAfterRender).toBe(after);
    h.warmup.refreshView();
    expect(h.warmup.pending).toBeFalse();
    h.warmup.dispose();
  });

  test("mobile candidate checks are bounded and movement cannot starve the queue tail", () => {
    const { scene, camera } = fixture();
    const shared = new BoxGeometry(); const material = new MeshBasicMaterial();
    for (let index = 0; index < GPU_WARMUP_MAX_VIEW_CANDIDATES; index++) {
      const object = new Mesh(shared, material); object.position.x = -1000; scene.add(object);
    }
    const tail = new Mesh(new BoxGeometry(), material); tail.position.x = 1000; scene.add(tail);
    const h = host(scene, camera, { viewLocal: true });
    h.warmup.enqueue(scene);
    expect(h.warmup.warmNext()).toBe(0);
    expect(h.warmup.pending).toBeTrue();
    expect(h.uploads).toHaveLength(0);
    camera.position.x = 1000; camera.lookAt(1000, 0, 0);
    h.warmup.refreshView();
    expect(h.warmup.warmNext()).toBe(1);
    expect(h.calls.at(-1)?.objects).toEqual([tail]);
    expect(h.warmup.pending).toBeTrue();
    expect(h.warmup.warmNext()).toBe(0);
    expect(h.warmup.pending).toBeFalse();
    h.warmup.dispose();
  });

  test("mobile projection changes wake dormant buffers while preserving perspective depth limits", () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(30, 1, 1, 100);
    camera.position.z = 10; camera.lookAt(0, 0, 0);
    const side = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); side.position.x = 8;
    const behind = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); behind.position.z = 20;
    scene.add(side, behind);
    const h = host(scene, camera, { viewLocal: true });
    h.warmup.enqueue(scene); expect(h.warmup.warmNext()).toBe(0);
    expect(h.warmup.pending).toBeFalse();
    camera.fov = 60; camera.updateProjectionMatrix();
    h.warmup.refreshView();
    expect(h.warmup.pending).toBeTrue();
    expect(h.warmup.warmNext()).toBe(1);
    expect(h.calls.at(-1)?.objects).toEqual([side]);
    expect(h.uploads).not.toContain(behind.geometry.getAttribute("position").array);
    expect(h.warmup.pending).toBeFalse();
    h.warmup.dispose();
  });

  test("dormant mobile candidates survive material retirement, context restoration and new arrivals", () => {
    const { scene, camera } = fixture();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); mesh.position.x = 1000;
    scene.add(mesh);
    const h = host(scene, camera, { viewLocal: true });
    h.warmup.enqueue(scene); h.warmup.warmNext();
    expect(h.warmup.pending).toBeFalse();
    for (let retirement = 0; retirement < 2; retirement++) {
      expect(retireSceneMaterialPrograms(scene)).toBe(1);
      h.warmup.enqueue(scene);
      expect(h.warmup.warmNext()).toBe(0);
      expect(h.warmup.pending).toBeFalse();
    }
    const arrival = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); scene.add(arrival);
    h.warmup.enqueue(arrival); expect(h.warmup.warmNext()).toBe(1);
    expect(h.calls.at(-1)?.objects).toEqual([arrival]);
    h.contextLost = true;
    h.warmup.refreshView(); expect(h.warmup.pending).toBeFalse();
    h.contextLost = false;
    h.events.dispatchEvent(new Event("webglcontextrestored"));
    expect(h.warmup.warmNext()).toBe(1);
    camera.position.x = 1000; camera.lookAt(1000, 0, 0);
    h.warmup.refreshView(); expect(h.warmup.warmNext()).toBe(1);
    expect(h.calls.at(-1)?.objects).toEqual([mesh]);
    const uploads = h.uploads.length;
    retireSceneMaterialPrograms(scene); h.warmup.enqueue(scene);
    expect(h.warmup.warmNext()).toBe(1);
    expect(h.uploads).toHaveLength(uploads);
    h.warmup.dispose();
  });

  test("mobile eviction removes dormant candidates and their callback without waking them later", () => {
    const { scene, camera } = fixture();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); mesh.position.x = 1000;
    scene.add(mesh);
    const after = mesh.onAfterRender;
    const h = host(scene, camera, { viewLocal: true });
    h.warmup.enqueue(scene); h.warmup.warmNext();
    expect(mesh.onAfterRender).not.toBe(after);
    h.warmup.release(mesh); mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose();
    expect(mesh.onAfterRender).toBe(after);
    camera.position.x = 1000; camera.lookAt(1000, 0, 0);
    h.warmup.refreshView();
    expect(h.warmup.pending).toBeFalse(); expect(h.warmup.warmNext()).toBe(0);
    expect(h.uploads).toHaveLength(0);
    h.warmup.dispose();
  });

  test("prepares suppressed ink and keeps it resident through exact-zero fade transitions", () => {
    const { scene, camera } = fixture();
    const material = new LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const line = new LineSegments(new BoxGeometry(), material);
    line.position.x = 1000;
    scene.add(line);
    const originalAfterRender = line.onAfterRender;
    const h = host(scene, camera);
    h.warmup.enqueue(line);
    expect(line.onAfterRender).not.toBe(originalAfterRender);
    // Recollection while a residency observer is installed must not treat
    // the observer as an authored callback and disable the optimization.
    registerInkDrawObject(line);
    expect(updateInkDrawVisibility(material)).toBeTrue();
    h.onRender = () => {
      expect(material.visible).toBeTrue();
      expect(isInkDrawSuppressed(material)).toBeTrue();
      expect(line.geometry.drawRange.count).toBe(0);
    };
    expect(h.warmup.warmNext()).toBe(1);
    expect(h.calls.at(-1)?.vertices).toBe(0);
    expect(h.uploads).toContain(line.geometry.getAttribute("position").array);
    expect(h.uploads).toContain(line.geometry.index!.array);
    expect(material.visible).toBeFalse();
    expect(isInkDrawSuppressed(material)).toBeTrue();
    expect(line.onAfterRender).toBe(originalAfterRender);
    const uploaded = h.uploads.length;
    h.warmup.enqueue(line);
    expect(h.warmup.pending).toBeFalse();

    h.onRender = undefined;
    material.opacity = Number.MIN_VALUE;
    expect(updateInkDrawVisibility(material)).toBeTrue();
    h.warmup.enqueue(line);
    expect(h.warmup.pending).toBeFalse();
    line.position.x = 0;
    h.renderer.render(scene, camera);
    expect(h.calls.at(-1)!.vertices).toBeGreaterThan(0);
    expect(h.uploads).toHaveLength(uploaded);
    material.opacity = 0;
    updateInkDrawVisibility(material);
    h.warmup.enqueue(line);
    expect(h.warmup.pending).toBeFalse();
    expect(h.warmup.warmNext()).toBe(0);
    h.warmup.dispose();
  });

  test("restores suppressed ink after failed preparation and permits a clean retry", () => {
    const { scene, camera } = fixture();
    const material = new LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const line = new LineSegments(new BoxGeometry(), material);
    line.geometry.setDrawRange(2, 10);
    scene.add(line);
    registerInkDrawObject(line);
    updateInkDrawVisibility(material);
    const h = host(scene, camera);
    const state = h.state();
    h.warmup.enqueue(line);
    h.onRender = () => expect(material.visible).toBeTrue();
    h.fail = true;
    expect(() => h.warmup.warmNext()).toThrow("injected render failure");
    expect(material.visible).toBeFalse();
    expect(isInkDrawSuppressed(material)).toBeTrue();
    expect(line.geometry.drawRange).toEqual({ start: 2, count: 10 });
    expect(h.state()).toEqual(state);
    h.fail = false;
    h.warmup.enqueue(line);
    expect(h.warmup.warmNext()).toBe(1);
    expect(material.visible).toBeFalse();
    expect(h.uploads).toContain(line.geometry.index!.array);
    h.warmup.dispose();
  });

  test("never promotes authored-hidden ink to a preparation draw", () => {
    const { scene, camera } = fixture();
    const material = new LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    material.visible = false;
    const line = new LineSegments(new BoxGeometry(), material);
    scene.add(line);
    registerInkDrawObject(line);
    updateInkDrawVisibility(material);
    const h = host(scene, camera);
    h.warmup.enqueue(line);
    expect(h.warmup.pending).toBeFalse();
    expect(h.warmup.warmNext()).toBe(0);
    expect(h.uploads).toHaveLength(0);
    expect(material.visible).toBeFalse();
    h.warmup.dispose();
  });

  test("residency observers do not make authored ink callbacks safe to suppress", () => {
    const { scene, camera } = fixture();
    const material = new LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const line = new LineSegments(new BoxGeometry(), material);
    let callbacks = 0;
    const after = () => { callbacks++; };
    line.onAfterRender = after;
    scene.add(line);
    const h = host(scene, camera);
    h.warmup.enqueue(line);
    registerInkDrawObject(line);
    expect(updateInkDrawVisibility(material)).toBeFalse();
    expect(material.visible).toBeTrue();
    h.renderer.render(scene, camera);
    expect(callbacks).toBe(1);
    expect(line.onAfterRender).toBe(after);
    expect(h.warmup.pending).toBeFalse();
    h.warmup.dispose();
  });

  test("eviction immediately removes queued descendants without waiting for a render", () => {
    const { scene, camera } = fixture();
    const evicted = new Group();
    const removed = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const retained = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    removed.position.x = retained.position.x = 1000;
    evicted.add(removed); scene.add(evicted, retained);
    const after = removed.onAfterRender;
    const h = host(scene, camera);
    h.warmup.enqueue(scene);
    expect(removed.onAfterRender).not.toBe(after);
    h.warmup.release(evicted);
    evicted.removeFromParent();
    removed.geometry.dispose(); removed.material.dispose();
    expect(removed.onAfterRender).toBe(after);
    expect(h.warmup.warmNext()).toBe(1);
    expect(h.calls.at(-1)?.objects).toEqual([retained]);
    expect(h.warmup.pending).toBeFalse();
    // Releasing a warmed object also invalidates its old residency snapshot.
    h.warmup.release(retained);
    h.warmup.enqueue(retained);
    expect(h.warmup.pending).toBeTrue();
    h.warmup.release(scene);
    expect(h.warmup.pending).toBeFalse();
    h.warmup.dispose();
  });

  test("ordinary rendering drains visible uploads without an extra scene render and preserves callbacks", () => {
    const { scene, camera } = fixture();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    scene.add(mesh);
    let afterCalls = 0;
    const after = function (this: Object3D) { expect(this).toBe(mesh); afterCalls++; };
    mesh.onAfterRender = after;
    const h = host(scene, camera);
    h.warmup.enqueue(mesh);
    h.renderer.render(scene, camera);
    expect(afterCalls).toBe(1);
    expect(mesh.onAfterRender).toBe(after);
    expect(h.uploads.length).toBeGreaterThan(0);
    expect(h.warmup.pending).toBeFalse();
    expect(h.warmup.warmNext()).toBe(0);
    expect(h.calls).toHaveLength(1);
    h.warmup.enqueue(mesh);
    expect(h.warmup.pending).toBeFalse();
    mesh.geometry.getAttribute("position").needsUpdate = true;
    h.warmup.enqueue(mesh);
    expect(h.warmup.pending).toBeTrue();
    h.renderer.render(scene, camera);
    expect(h.updates).toHaveLength(1);
    expect(afterCalls).toBe(2);
    expect(h.warmup.pending).toBeFalse();
    h.warmup.dispose();
  });

  test("multi-material uploads wait for every drawn group and keep offscreen work queued", () => {
    const { scene, camera } = fixture();
    const materials = Array.from({ length: 6 }, () => new MeshBasicMaterial());
    const visible = new Mesh(new BoxGeometry(), materials);
    const offscreen = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    offscreen.position.x = 1000;
    scene.add(visible, offscreen);
    const h = host(scene, camera);
    let groups = 0;
    visible.onAfterRender = () => {
      groups++;
      expect(h.warmup.pending).toBeTrue();
    };
    const after = visible.onAfterRender;
    h.warmup.enqueue(scene);
    h.renderer.render(scene, camera);
    expect(groups).toBe(6);
    expect(visible.onAfterRender).toBe(after);
    expect(h.warmup.pending).toBeTrue();
    expect(h.warmup.warmNext()).toBe(1);
    expect(h.calls.at(-1)?.objects).toEqual([offscreen]);
    expect(h.warmup.pending).toBeFalse();
    h.warmup.dispose();
  });

  test("changed modes, self-replacing callbacks and cancelled queues keep their ownership", () => {
    const { scene, camera } = fixture();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); scene.add(mesh);
    const h = host(scene, camera);
    const replacement = () => {};
    mesh.onAfterRender = () => { mesh.onAfterRender = replacement; };
    h.warmup.enqueue(mesh); h.renderer.render(scene, camera);
    expect(mesh.onAfterRender).toBe(replacement);
    scene.fog = { name: "changed shader context" } as unknown as Scene["fog"];
    h.warmup.enqueue(mesh); expect(h.warmup.pending).toBeTrue();
    h.warmup.dispose();
    expect(mesh.onAfterRender).toBe(replacement);
    expect(h.warmup.pending).toBeFalse();
  });

  test("another camera cannot consume the ordinary-view preparation queue", () => {
    const { scene, camera } = fixture();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); scene.add(mesh);
    const h = host(scene, camera);
    h.warmup.enqueue(mesh);
    h.renderer.render(scene, camera.clone());
    expect(h.warmup.pending).toBeTrue();
    expect(h.warmup.warmNext()).toBe(1);
    h.warmup.dispose();
  });

  test("callbacks that change the just-rendered resources do not claim the replacement was uploaded", () => {
    const { scene, camera } = fixture();
    const originalGeometry = new BoxGeometry();
    const replacement = new BoxGeometry(2, 2, 2);
    const mesh = new Mesh(originalGeometry, new MeshBasicMaterial()); scene.add(mesh);
    const h = host(scene, camera);
    mesh.onAfterRender = () => { mesh.geometry = replacement; };
    const after = mesh.onAfterRender;
    h.warmup.enqueue(mesh); h.renderer.render(scene, camera);
    expect(h.uploads).not.toContain(replacement.getAttribute("position").array);
    expect(h.warmup.pending).toBeTrue();
    expect(h.warmup.warmNext()).toBe(1);
    expect(h.uploads).toContain(replacement.getAttribute("position").array);
    expect(mesh.onAfterRender).toBe(after);
    h.warmup.dispose();
  });

  test("the actual Three buffer backend needs no first-pan uploads after zero-draw warmup", () => {
    const { scene, camera } = fixture();
    const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 3);
    mesh.position.x = 1000;
    mesh.setColorAt(0, new Color("red"));
    scene.add(mesh);
    const h = host(scene, camera);
    const matrices = mesh.instanceMatrix.array.slice();
    const colors = mesh.instanceColor!.array.slice();
    h.renderer.render(scene, camera);
    expect(h.uploads).toHaveLength(0);
    h.warmup.enqueue(scene);
    expect(h.warmup.warmNext()).toBe(1);
    expect(h.calls.at(-1)?.vertices).toBe(0);
    expect(h.calls.at(-1)?.cameraId).not.toBe(camera.id);
    for (const array of [mesh.geometry.index!.array, mesh.geometry.getAttribute("position").array, mesh.instanceMatrix.array, mesh.instanceColor!.array]) {
      expect(h.uploads.filter((value) => value === array)).toHaveLength(1);
    }
    const count = h.uploads.length;
    mesh.position.x = 0;
    h.renderer.render(scene, camera);
    expect(h.calls.at(-1)?.cameraId).toBe(camera.id);
    expect(h.calls.at(-1)!.vertices).toBeGreaterThan(0);
    expect(h.uploads).toHaveLength(count);
    expect(h.updates).toHaveLength(0);
    expect(mesh.instanceMatrix.array).toEqual(matrices);
    expect(mesh.instanceColor!.array).toEqual(colors);
    h.warmup.dispose();
  });

  test("restores framebuffer, shadow atlas policy, scene, groups and layers even on failure", () => {
    const { scene, camera } = fixture();
    const ancestor = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const child = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const light = new DirectionalLight(); ancestor.add(child, light); scene.add(ancestor);
    const hidden = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); hidden.visible = false; scene.add(hidden);
    child.layers.enable(3); child.geometry.setDrawRange(3, 6);
    const h = host(scene, camera); const state = h.state();
    h.onRender = () => {
      expect(child.parent).toBe(ancestor);
      expect(ancestor.visible).toBeTrue(); expect(ancestor.layers.mask).toBe(0);
      expect(child.layers.mask).toBe(9); expect(child.frustumCulled).toBeFalse();
      expect(child.geometry.drawRange).toEqual({ start: 0, count: 0 });
      expect(light.visible).toBeTrue(); expect(hidden.visible).toBeFalse();
      expect(h.renderer.shadowMap).toEqual({ enabled: true, type: 2, autoUpdate: false, needsUpdate: false });
      expect(h.state().target?.width).toBe(1); expect(scene.background).toBeNull();
    };
    h.warmup.enqueue(child); h.fail = true;
    expect(() => h.warmup.warmNext()).toThrow("injected render failure");
    expect(h.state()).toEqual(state);
    expect(child.geometry.drawRange).toEqual({ start: 3, count: 6 });
    expect(child.frustumCulled).toBeTrue(); expect(ancestor.layers.mask).toBe(1);
    h.fail = false; h.warmup.enqueue(child);
    expect(h.warmup.warmNext()).toBe(1);
    expect(h.calls.at(-1)?.objects).toEqual([child]);
    h.warmup.dispose();
  });

  test("a nonzero first material-group offset still uploads the index buffer with zero vertices", () => {
    const { scene, camera } = fixture();
    const geometry = new BoxGeometry();
    const invisible = new MeshBasicMaterial(); invisible.visible = false;
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, [invisible, material, invisible, invisible, invisible, invisible]);
    scene.add(mesh); const h = host(scene, camera);
    h.onRender = () => expect(geometry.drawRange).toEqual({ start: 6, count: 0 });
    h.warmup.enqueue(mesh); h.warmup.warmNext();
    expect(h.uploads).toContain(geometry.index!.array);
    expect(h.calls.at(-1)?.vertices).toBe(0);
    expect(geometry.drawRange).toEqual({ start: 0, count: Infinity });
    h.warmup.dispose();
  });

  test("deduplicates unchanged resources but rewarmes changed attributes, materials and disposed buffers", () => {
    const { scene, camera } = fixture();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); scene.add(mesh);
    const h = host(scene, camera);
    h.warmup.enqueue(scene); h.warmup.enqueue(scene);
    expect(h.warmup.warmNext()).toBe(1); expect(h.warmup.pending).toBeFalse();
    h.warmup.enqueue(scene); expect(h.warmup.pending).toBeFalse();
    mesh.geometry.getAttribute("position").needsUpdate = true;
    h.warmup.enqueue(scene); expect(h.warmup.warmNext()).toBe(1); expect(h.updates).toHaveLength(1);
    mesh.material = new MeshBasicMaterial({ color: "red" });
    h.warmup.enqueue(scene); expect(h.warmup.warmNext()).toBe(1);
    const before = h.uploads.length; mesh.geometry.dispose();
    h.warmup.enqueue(scene); expect(h.warmup.warmNext()).toBe(1); expect(h.uploads.length).toBeGreaterThan(before);
    h.events.dispatchEvent(new Event("webglcontextrestored"));
    expect(h.warmup.pending).toBeTrue(); h.warmup.warmNext();
    h.warmup.dispose(); h.warmup.enqueue(scene); expect(h.warmup.pending).toBeFalse(); expect(h.warmup.warmNext()).toBe(0);
  });

  test("mode retirement rewarms reusable materials, including retirement while already queued", () => {
    const { scene, camera } = fixture();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    mesh.position.x = 1000;
    scene.add(mesh);
    const material = mesh.material;
    const after = mesh.onAfterRender;
    const h = host(scene, camera);
    h.warmup.enqueue(scene);
    // The first mode changes before offscreen preparation reaches this object.
    expect(retireSceneMaterialPrograms(scene)).toBe(1);
    h.warmup.enqueue(scene);
    expect(h.warmup.warmNext()).toBe(1);
    expect(mesh.onAfterRender).toBe(after);
    const uploaded = h.uploads.length;
    for (let transition = 0; transition < 3; transition++) {
      h.warmup.enqueue(scene);
      expect(h.warmup.pending).toBeFalse();
      expect(retireSceneMaterialPrograms(scene)).toBe(1);
      h.warmup.enqueue(scene);
      expect(h.warmup.pending).toBeTrue();
      expect(h.warmup.warmNext()).toBe(1);
      expect(h.warmup.pending).toBeFalse();
      expect(mesh.material).toBe(material);
      expect(mesh.onAfterRender).toBe(after);
      expect(h.uploads).toHaveLength(uploaded);
    }
    h.warmup.dispose();
  });

  test("respects mode/ancestor visibility changes while queued", () => {
    const { scene, camera } = fixture();
    const group = new Group(); const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    group.add(mesh); scene.add(group); const h = host(scene, camera);
    h.warmup.enqueue(scene); group.visible = false;
    expect(h.warmup.warmNext()).toBe(0); expect(h.uploads).toHaveLength(0);
    group.visible = true; mesh.layers.set(2); h.warmup.enqueue(scene); expect(h.warmup.pending).toBeFalse();
    mesh.layers.set(0); h.warmup.enqueue(scene); expect(h.warmup.warmNext()).toBe(1);
    h.warmup.dispose();
  });

  test("context loss pauses preparation without marking missing buffers ready", () => {
    const { scene, camera } = fixture();
    scene.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
    const h = host(scene, camera);
    h.warmup.enqueue(scene); h.contextLost = true;
    expect(h.warmup.pending).toBeFalse();
    expect(h.warmup.warmNext()).toBe(0);
    expect(h.uploads).toHaveLength(0);
    h.contextLost = false;
    h.events.dispatchEvent(new Event("webglcontextrestored"));
    expect(h.warmup.pending).toBeTrue();
    expect(h.warmup.warmNext()).toBe(1);
    expect(h.uploads.length).toBeGreaterThan(0);
    h.warmup.dispose();
  });

  test("first-view bounds are prepared with the unchanged instance transforms", () => {
    const { scene, camera } = fixture();
    const mesh = new InstancedMesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial(), 1);
    mesh.setMatrixAt(0, new Matrix4().makeTranslation(500, 0, 0));
    scene.add(mesh);
    expect(mesh.boundingSphere).toBeNull();
    const h = host(scene, camera);
    h.warmup.enqueue(scene); h.warmup.warmNext();
    expect(mesh.boundingSphere).not.toBeNull();
    expect(mesh.boundingSphere!.center.x).toBe(500);
    expect(mesh.boundingSphere!.radius).toBeCloseTo(Math.sqrt(3), 10);
    const count = h.uploads.length;
    camera.position.x = 500; camera.lookAt(500, 0, 0);
    h.renderer.render(scene, camera);
    expect(h.calls.at(-1)?.vertices).toBe(36);
    expect(h.uploads).toHaveLength(count);
    h.warmup.dispose();
  });

  test("caps each task by object count and buffer bytes while retaining indivisible large geometry", () => {
    const { scene, camera } = fixture();
    const shared = new BoxGeometry(); const material = new MeshBasicMaterial();
    for (let index = 0; index < GPU_WARMUP_MAX_OBJECTS + 2; index++) scene.add(new Mesh(shared, material));
    const h = host(scene, camera); h.warmup.enqueue(scene);
    expect(h.warmup.warmNext()).toBe(GPU_WARMUP_MAX_OBJECTS); expect(h.warmup.pending).toBeTrue();
    expect(h.warmup.warmNext()).toBe(2);
    const big = new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(Math.ceil(GPU_WARMUP_MAX_BYTES / 12) * 3 + 3), 3));
    scene.add(new Mesh(big, material), new Mesh(new BoxGeometry(), material)); h.warmup.enqueue(scene);
    expect(h.warmup.warmNext()).toBe(1); expect(h.warmup.pending).toBeTrue();
    expect(h.warmup.warmNext()).toBe(1); expect(h.warmup.pending).toBeFalse();
    expect(h.calls.every((call) => call.vertices === 0)).toBeTrue();
    h.warmup.dispose();
  });

  test("light context follows hidden ancestors, own layers and shadow flags without a city scan", () => {
    const { scene, camera } = fixture();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const light = new DirectionalLight(), initiallyHidden = new Group();
    initiallyHidden.visible = false; initiallyHidden.add(light); scene.add(mesh, initiallyHidden);
    const h = host(scene, camera);
    const prepare = () => { h.warmup.enqueue(mesh); expect(h.warmup.warmNext()).toBe(1); };
    const unchanged = () => { h.warmup.enqueue(mesh); expect(h.warmup.pending).toBeFalse(); };
    const cityScan = spyOn(scene, "traverseVisible");
    try {
      prepare(); unchanged();
      initiallyHidden.visible = true; prepare();
      light.castShadow = true; prepare();
      light.layers.set(2); prepare();
      light.castShadow = false; unchanged(); // Inactive light cannot change the shader variant.
      light.layers.set(0); prepare();
      initiallyHidden.layers.set(3); unchanged(); // Parent layers are not inherited by lights.
      initiallyHidden.visible = false; prepare();
      initiallyHidden.visible = true; prepare();
      expect(cityScan).not.toHaveBeenCalled();
    } finally { cityScan.mockRestore(); h.warmup.dispose(); }
  });

  test("new, released, detached and reparented light subtrees keep exact context ownership", () => {
    const { scene, camera } = fixture();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); scene.add(mesh);
    const h = host(scene, camera);
    const prepare = () => { h.warmup.enqueue(mesh); expect(h.warmup.warmNext()).toBe(1); };
    const unchanged = () => { h.warmup.enqueue(mesh); expect(h.warmup.pending).toBeFalse(); };
    prepare();
    const rig = new Group(), light = new PointLight(); rig.add(light); scene.add(rig);
    h.warmup.enqueue(rig); prepare(); unchanged();
    const hidden = new Group(); hidden.visible = false; scene.add(hidden);
    hidden.add(light); prepare();
    rig.add(light); prepare();
    scene.remove(rig); prepare(); // A cached light outside this scene is inactive.
    scene.add(rig); prepare();
    h.warmup.release(rig); scene.remove(rig); prepare(); unchanged();
    // Reinsertions notify enqueue just like newly published districts.
    scene.add(rig); h.warmup.enqueue(rig); prepare();
    h.warmup.release(rig); scene.remove(rig); prepare();
    const replacement = new Group(); replacement.add(new DirectionalLight()); scene.add(replacement);
    h.warmup.enqueue(replacement); prepare();
    h.warmup.dispose();
  });

  test("ordinary upload observation does not traverse all city nodes to rediscover lights", () => {
    const { scene, camera } = fixture();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); scene.add(mesh, new DirectionalLight());
    const initialScan = spyOn(scene, "traverse");
    const h = host(scene, camera);
    expect(initialScan).toHaveBeenCalledTimes(1);
    initialScan.mockClear();
    const visibleScan = spyOn(scene, "traverseVisible");
    try {
      for (let frame = 0; frame < 3; frame++) {
        mesh.geometry.getAttribute("position").needsUpdate = true;
        h.warmup.enqueue(mesh); h.renderer.render(scene, camera);
        expect(h.warmup.pending).toBeFalse();
      }
      expect(initialScan).not.toHaveBeenCalled();
      expect(visibleScan).not.toHaveBeenCalled();
      h.warmup.enqueue(mesh); expect(h.warmup.pending).toBeFalse();
    } finally { initialScan.mockRestore(); visibleScan.mockRestore(); h.warmup.dispose(); }
  });

  test("installed Three keeps upload/program/index preparation ahead of zero-count drawing", async () => {
    const source = await Bun.file(new URL("../node_modules/three/src/renderers/WebGLRenderer.js", import.meta.url)).text();
    const project = source.slice(source.indexOf("function projectObject"), source.indexOf("function renderScene"));
    const direct = source.slice(source.indexOf("this.renderBufferDirect ="), source.indexOf("// Compile"));
    expect(project.indexOf("_frustum.intersectsObject( object )")).toBeLessThan(project.indexOf("const geometry = objects.update( object )", project.indexOf("_frustum.intersectsObject( object )")));
    expect(direct.indexOf("setProgram(")).toBeLessThan(direct.indexOf("if ( drawCount < 0"));
    expect(direct).toContain("if ( drawCount < 0 || drawCount === Infinity ) return;");
    expect(direct.indexOf("bindingStates.setup(")).toBeLessThan(direct.indexOf("renderer.renderInstances("));
    const renderObject = source.slice(source.indexOf("function renderObject( object"), source.indexOf("function getProgram"));
    expect(renderObject.indexOf("_this.renderBufferDirect")).toBeGreaterThan(0);
    expect(renderObject.lastIndexOf("_this.renderBufferDirect")).toBeLessThan(renderObject.indexOf("object.onAfterRender("));
  });
});

describe("lossless mobile GPU instance residency", () => {
  test("desktop preparation and both residency observers retire inactive worlds without changing their source arrays", () => {
    const { scene, camera } = fixture();
    const drawn = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 1);
    const native = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 2);
    native.visible = false;
    scene.add(drawn, native);
    const originals = [drawn, native].map(mesh => ({
      matrix: mesh.instanceMatrix.array,
      position: mesh.geometry.getAttribute("position").array,
      material: mesh.material,
      after: mesh.onAfterRender,
    }));
    const h = host(scene, camera, { viewLocal: true });
    const renderer = h.renderer as unknown as WebGLRenderer;
    const instances = createSceneGpuResidency(renderer, camera, { now: () => 0 });
    const geometries = createSceneGeometryGpuResidency(renderer, camera, { now: () => 0 });
    instances.enqueue(scene); geometries.enqueue(scene);
    h.warmup.enqueue(scene); h.renderer.render(scene, camera);
    expect(instances.residentBytes).toBe(64);
    expect(geometries.residentBuffers).toBe(4);
    for (let transition = 0; transition < 6; transition++) {
      const visible = transition % 2 === 0 ? native : drawn;
      drawn.visible = visible === drawn;
      native.visible = visible === native;
      expect(instances.refresh(transition, true)).toBe(1);
      expect(geometries.refresh(transition, true)).toBe(1);
      expect(instances.residentBuffers).toBe(0);
      expect(geometries.residentBuffers).toBe(0);
      const before = h.uploads.length;
      h.warmup.enqueue(scene);
      expect(h.warmup.warmNext()).toBe(1);
      h.renderer.render(scene, camera);
      expect(h.uploads.length - before).toBe(5);
      expect(h.calls.at(-1)?.vertices).toBe(36 * visible.count);
      expect(instances.residentBytes).toBe(visible.instanceMatrix.array.byteLength);
      expect(geometries.residentBuffers).toBe(4);
      [drawn, native].forEach((mesh, index) => {
        expect(mesh.instanceMatrix.array).toBe(originals[index].matrix);
        expect(mesh.geometry.getAttribute("position").array).toBe(originals[index].position);
        expect(mesh.material).toBe(originals[index].material);
      });
    }
    h.warmup.dispose(); geometries.dispose(); instances.dispose();
    expect(drawn.onAfterRender).toBe(originals[0].after);
    expect(native.onAfterRender).toBe(originals[1].after);
  });

  test("retires only off-view owned GPU attributes and exactly restores them on return", () => {
    const { scene, camera } = fixture();
    const geometry = new BoxGeometry(); const material = new MeshBasicMaterial();
    const near = new InstancedMesh(geometry, material, 1);
    const far = new InstancedMesh(geometry, material, 2); far.position.x = 1000;
    far.setColorAt(0, new Color("red")); scene.add(near, far);
    const matrix = far.instanceMatrix.array.slice(); const colors = far.instanceColor!.array.slice();
    const positions = geometry.getAttribute("position").array.slice();
    const h = host(scene, camera);
    let now = 0; const evicted: InstancedMesh[] = [];
    const resident = createSceneGpuResidency(h.renderer as unknown as WebGLRenderer, camera,
      { budgetBytes: 0, graceMs: 50, now: () => now, onEvict: mesh => evicted.push(mesh) });
    resident.enqueue(scene); h.warmup.enqueue(scene); h.warmup.warmNext();
    expect(resident.residentBytes).toBe(near.instanceMatrix.array.byteLength +
      far.instanceMatrix.array.byteLength + far.instanceColor!.array.byteLength);
    expect(resident.refresh()).toBe(0);
    now = 100; expect(resident.refresh()).toBe(1); expect(evicted).toEqual([far]);
    expect(h.deleted).toHaveLength(2);
    expect(resident.residentBytes).toBe(near.instanceMatrix.array.byteLength);
    expect(scene.children).toEqual([near, far]); expect(far.visible).toBeTrue();
    expect(far.instanceMatrix.array).toEqual(matrix); expect(far.instanceColor!.array).toEqual(colors);
    expect(geometry.getAttribute("position").array).toEqual(positions);
    const previousUploads = h.uploads.length;
    camera.position.x = 1000; camera.lookAt(1000, 0, 0); h.renderer.render(scene, camera);
    expect(h.uploads.length - previousUploads).toBe(2);
    expect(h.calls.at(-1)?.vertices).toBe(72);
    expect(resident.residentBytes).toBe(64 + 128 + 24);
    h.warmup.dispose(); resident.dispose();
  });

  test("evicted mobile instances stay dormant until the expanded view returns", () => {
    const { scene, camera } = fixture();
    const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 1);
    scene.add(mesh); const after = mesh.onAfterRender; let now = 0;
    const h = host(scene, camera, { viewLocal: true });
    const resident = createSceneGpuResidency(h.renderer as unknown as WebGLRenderer, camera,
      { budgetBytes: 0, graceMs: 0, now: () => now, onEvict: object => h.warmup.enqueue(object) });
    resident.enqueue(scene); h.warmup.enqueue(scene); h.renderer.render(scene, camera);
    expect(resident.residentBytes).toBe(64);
    camera.position.x = 1000; camera.lookAt(1000, 0, 0); now = 100;
    expect(resident.refresh()).toBe(1); expect(h.warmup.warmNext()).toBe(0);
    expect(h.warmup.pending).toBeFalse(); expect(resident.residentBytes).toBe(0);
    camera.position.x = 0; camera.lookAt(0, 0, 0); now = 200;
    h.warmup.refreshView(); expect(h.warmup.warmNext()).toBe(1);
    expect(resident.residentBytes).toBe(64); expect(resident.refresh()).toBe(0);
    retireSceneMaterialPrograms(scene); h.warmup.enqueue(scene); h.warmup.warmNext();
    expect(resident.residentBytes).toBe(64);
    h.warmup.dispose(); resident.dispose(); expect(mesh.onAfterRender).toBe(after);
  });

  test("protects shared instance attributes, expanded margins and uncullable objects", () => {
    const { scene, camera } = fixture(); const geometry = new BoxGeometry(); const material = new MeshBasicMaterial();
    const near = new InstancedMesh(geometry, material, 1);
    const shared = new InstancedMesh(geometry, material, 1); shared.instanceMatrix = near.instanceMatrix; shared.position.x = 1000;
    const margin = new InstancedMesh(geometry, material, 1); margin.position.x = 8;
    const uncullable = new InstancedMesh(geometry, material, 1); uncullable.position.x = 1000; uncullable.frustumCulled = false;
    scene.add(near, shared, margin, uncullable); const h = host(scene, camera);
    const resident = createSceneGpuResidency(h.renderer as unknown as WebGLRenderer, camera,
      { budgetBytes: 0, graceMs: 0, now: () => 0 });
    resident.enqueue(scene); h.warmup.enqueue(scene); h.warmup.warmNext();
    expect(resident.refresh(100)).toBe(0); expect(h.deleted).toHaveLength(0);
    h.warmup.dispose(); resident.dispose();
  });

  test("bounds each scan, respects its cadence and releases detached observers immediately", () => {
    const { scene, camera } = fixture(); const geometry = new BoxGeometry(); const material = new MeshBasicMaterial();
    for (let index = 0; index < MOBILE_GPU_RESIDENCY_SCAN_LIMIT + 3; index++) {
      const mesh = new InstancedMesh(geometry, material, 1); mesh.position.x = 1000; scene.add(mesh);
    }
    const h = host(scene, camera);
    const resident = createSceneGpuResidency(h.renderer as unknown as WebGLRenderer, camera,
      { budgetBytes: 0, graceMs: 0, now: () => 0 });
    resident.enqueue(scene); h.warmup.enqueue(scene); while (h.warmup.pending) h.warmup.warmNext();
    expect(resident.refresh(100)).toBe(MOBILE_GPU_RESIDENCY_SCAN_LIMIT);
    expect(resident.refresh(110)).toBe(0);
    expect(resident.refresh(200)).toBe(3); expect(resident.residentBytes).toBe(0);
    h.warmup.release(scene); resident.release(scene); scene.clear();
    expect(resident.refresh(300)).toBe(0);
    h.warmup.dispose(); resident.dispose();
  });

  test("external resource disposal resets residency without changing scene ownership", () => {
    const { scene, camera } = fixture();
    const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 1); scene.add(mesh);
    const h = host(scene, camera);
    const resident = createSceneGpuResidency(h.renderer as unknown as WebGLRenderer, camera, { budgetBytes: 0 });
    resident.enqueue(scene); h.warmup.enqueue(scene); h.warmup.warmNext(); expect(resident.residentBytes).toBe(64);
    mesh.dispose(); expect(resident.residentBytes).toBe(0);
    h.renderer.render(scene, camera); expect(resident.residentBytes).toBe(64);
    h.contextLost = true; expect(resident.refresh(Infinity)).toBe(0);
    h.warmup.dispose(); resident.dispose(); expect(resident.residentBytes).toBe(0);
    expect(scene.children).toEqual([mesh]);
  });
});
