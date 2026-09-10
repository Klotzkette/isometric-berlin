import { describe, expect, test } from "bun:test";
import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DirectionalLight,
  Frustum, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  OrthographicCamera, Scene, Vector4, WebGLRenderTarget,
  type Camera, type Object3D, type WebGLRenderer,
} from "three";
import { WebGLAttributes } from "three/src/renderers/webgl/WebGLAttributes.js";
import { WebGLGeometries } from "three/src/renderers/webgl/WebGLGeometries.js";
import { WebGLObjects } from "three/src/renderers/webgl/WebGLObjects.js";
import { createSceneGpuWarmup, GPU_WARMUP_MAX_BYTES, GPU_WARMUP_MAX_OBJECTS } from "../src/sceneGpuWarmup";

/** Real Three buffer backend, counting GL uploads; no browser/GPU speed claim. */
function host(scene: Scene, camera: Camera) {
  const uploads: ArrayBufferView[] = [];
  const updates: ArrayBufferView[] = [];
  let nextBuffer = 0;
  const gl = {
    ARRAY_BUFFER: 34962, ELEMENT_ARRAY_BUFFER: 34963, FLOAT: 5126,
    UNSIGNED_SHORT: 5123, UNSIGNED_INT: 5125,
    createBuffer: () => ({ id: nextBuffer++ }), bindBuffer: () => {},
    bufferData: (_target: number, array: ArrayBufferView) => uploads.push(array),
    bufferSubData: (_target: number, _offset: number, array: ArrayBufferView) => updates.push(array),
    deleteBuffer: () => {},
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
  const calls: { objects: Mesh[]; vertices: number; cameraId: number }[] = [];
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
      const call = { objects: [] as Mesh[], vertices: 0, cameraId: view.id };
      const visit = (object: Object3D) => {
        if (!object.visible) return;
        if (object instanceof Mesh && object.layers.test(view.layers) && (!object.frustumCulled || frustum.intersectsObject(object))) {
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
  const warmup = createSceneGpuWarmup(renderer as unknown as WebGLRenderer, scene, camera);
  const state = () => ({ target, cube, mip, viewport: viewport.toArray(), scissor: scissor.toArray(), scissorTest,
    shadow: { ...renderer.shadowMap }, background: scene.background });
  return { renderer, warmup, uploads, updates, calls, state, events,
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
