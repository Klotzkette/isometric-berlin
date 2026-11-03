/** Real Three WebGL allocation/disposal backend with a counting GL host. */
import {BoxGeometry,BufferGeometry,Mesh,MeshBasicMaterial,OrthographicCamera,Scene,type Camera,type Material,type WebGLRenderer,Line,Points} from "three";
import {WebGLAttributes} from "three/src/renderers/webgl/WebGLAttributes.js";
import {WebGLGeometries} from "three/src/renderers/webgl/WebGLGeometries.js";
import {createSceneGeometryGpuResidency} from "../../src/sceneGeometryGpuResidency";
type Renderable=Mesh|Line|Points;
export function geometryGpuHostV309(options: Parameters<typeof createSceneGeometryGpuResidency>[2] = {}) {
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
