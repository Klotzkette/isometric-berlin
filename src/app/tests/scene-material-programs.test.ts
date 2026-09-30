import { describe, expect, test } from "bun:test";
import {
  BoxGeometry, Group, InstancedMesh, Line, LineBasicMaterial, LineSegments,
  Material, Mesh, MeshBasicMaterial, Points, PointsMaterial, RawShaderMaterial,
  Scene, Sprite, SpriteMaterial, Texture,
} from "three";
import { WebGLPrograms } from "three/src/renderers/webgl/WebGLPrograms.js";
import { WebGLProperties } from "three/src/renderers/webgl/WebGLProperties.js";
import { retireSceneMaterialPrograms } from "../src/sceneMaterialPrograms";

const rendererSource = await Bun.file(new URL(
  "../node_modules/three/src/renderers/WebGLRenderer.js", import.meta.url,
)).text();
const disposalStart = rendererSource.indexOf("function onMaterialDispose( event )");
const disposalEnd = rendererSource.indexOf("// Buffer rendering", disposalStart);
if (disposalStart < 0 || disposalEnd < 0) throw new Error("Three material disposal implementation changed");
// Exercise the installed renderer's real disposal functions with its actual
// WebGLPrograms/WebGLProperties backend. Only the GL driver is a counting stub;
// this proves resource lifetime, not compilation correctness or GPU speed.
const materialDisposal = new Function("properties", "programCache",
  `${rendererSource.slice(disposalStart, disposalEnd)}\nreturn onMaterialDispose;`);

function programHost() {
  const created: object[] = [];
  const deleted: object[] = [];
  const releasedBindings: object[] = [];
  const gl = {
    VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632,
    createProgram: () => { const program = {}; created.push(program); return program; },
    createShader: () => ({}), shaderSource: () => {}, compileShader: () => {},
    attachShader: () => {}, linkProgram: () => {}, bindAttribLocation: () => {},
    deleteProgram: (program: object) => deleted.push(program),
  };
  const renderer = {
    getContext: () => gl, getRenderTarget: () => null,
    state: { buffers: { depth: { getReversed: () => false } } },
    shadowMap: { enabled: false, type: 0 }, outputColorSpace: "srgb", toneMapping: 0,
  };
  const backend = WebGLPrograms(renderer, { get: () => null }, { has: () => false },
    { logarithmicDepthBuffer: false, precision: "highp" },
    { releaseStatesOfProgram: (program: object) => releasedBindings.push(program) },
    { numPlanes: 0, numIntersection: 0 });
  const properties = WebGLProperties();
  const onDispose = materialDisposal(properties, backend);
  const scene = new Scene();
  const lights = {
    directional: [], point: [], spot: [], spotLightMap: [], rectArea: [], hemi: [],
    directionalShadowMap: [], pointShadowMap: [], spotShadowMap: [],
    numSpotLightShadowsWithMaps: 0, numLightProbes: 0,
  };
  const mesh = new Mesh(new BoxGeometry());
  const compile = (material: RawShaderMaterial) => {
    const parameters = backend.getParameters(material, lights, [], scene, mesh, []);
    const key = backend.getProgramCacheKey(parameters);
    const data = properties.get(material);
    if (!data.programs) {
      data.programs = new Map();
      material.addEventListener("dispose", onDispose);
    }
    if (!data.programs.has(key)) {
      material.onBeforeCompile(parameters, renderer as never);
      data.programs.set(key, backend.acquireProgram(parameters, key));
    }
    return data.programs.get(key);
  };
  return { compile, backend, properties, created, deleted, releasedBindings };
}

function shader() {
  return new RawShaderMaterial({
    vertexShader: "attribute vec3 position; void main() { gl_Position = vec4(position, 1.0); }",
    fragmentShader: "precision highp float; void main() { gl_FragColor = vec4(1.0); }",
  });
}

describe("drawn-mode material program retirement", () => {
  test("retires each assigned/alternate material once, preserving authored scene resources", () => {
    const scene = new Scene();
    const geometry = new BoxGeometry();
    const texture = new Texture();
    const day = new MeshBasicMaterial({ map: texture });
    const night = new MeshBasicMaterial();
    const moonlit = new MeshBasicMaterial();
    const graded = shader();
    const time = { value: 12.5 };
    graded.uniforms.uTime = time;
    const compile = () => {};
    const cacheKey = () => "authored-key";
    graded.onBeforeCompile = compile;
    graded.customProgramCacheKey = cacheKey;
    graded.userData.source = { id: "retained-source" };
    const userData = graded.userData;
    const uniforms = graded.uniforms;
    const mesh = new Mesh(geometry, [day, graded, day]);
    Object.assign(mesh.userData, {
      dayMaterial: day, nightMaterial: night, moonlitMaterial: moonlit,
      schwellenraumMaterial: graded, sourceEnvelope: [1, 2, 3],
    });
    const instance = new InstancedMesh(geometry, day, 2);
    const lineMaterial = new LineBasicMaterial();
    const pointsMaterial = new PointsMaterial();
    const spriteMaterial = new SpriteMaterial();
    const override = new MeshBasicMaterial();
    scene.overrideMaterial = override;
    const hidden = new Group(); hidden.visible = false;
    hidden.add(instance, new Line(geometry, lineMaterial), new LineSegments(geometry, lineMaterial),
      new Points(geometry, pointsMaterial), new Sprite(spriteMaterial));
    scene.add(mesh, hidden);
    const assigned = mesh.material;
    const objectData = mesh.userData;
    const source = mesh.userData.sourceEnvelope;
    const matrix = instance.instanceMatrix;
    const position = geometry.getAttribute("position");
    const after = () => {};
    mesh.onAfterRender = after;
    const materials = [day, night, moonlit, graded, lineMaterial, pointsMaterial, spriteMaterial, override];
    const versions = materials.map(material => material.version);
    const events = new Map<Material, number>();
    for (const material of materials) {
      material.addEventListener("dispose", () => events.set(material, (events.get(material) ?? 0) + 1));
    }
    let freedData = 0;
    geometry.addEventListener("dispose", () => freedData++);
    texture.addEventListener("dispose", () => freedData++);
    instance.addEventListener("dispose", () => freedData++);
    for (let transition = 1; transition <= 2; transition++) {
      expect(retireSceneMaterialPrograms(scene)).toBe(materials.length);
      expect(materials.map(material => events.get(material))).toEqual(materials.map(() => transition));
      expect(materials.map(material => material.version)).toEqual(versions);
      expect(freedData).toBe(0);
      expect(mesh.material).toBe(assigned);
      expect(mesh.userData).toBe(objectData);
      expect(mesh.userData.sourceEnvelope).toBe(source);
      expect(mesh.onAfterRender).toBe(after);
      expect(instance.instanceMatrix).toBe(matrix);
      expect(geometry.getAttribute("position")).toBe(position);
      expect(day.map).toBe(texture);
      expect(graded.uniforms).toBe(uniforms);
      expect(graded.uniforms.uTime).toBe(time);
      expect(graded.userData).toBe(userData);
      expect(graded.onBeforeCompile).toBe(compile);
      expect(graded.customProgramCacheKey).toBe(cacheKey);
      expect(hidden.visible).toBeFalse();
    }
  });

  test("Three releases old program variants and reuses the same materials on repeated switches", () => {
    const host = programHost();
    const day = shader();
    const alternate = shader();
    const untouched = shader();
    untouched.defines.PERSISTENT = 1;
    const untouchedProgram = host.compile(untouched);
    const scene = new Scene();
    const mesh = new Mesh(new BoxGeometry(), day);
    mesh.userData.schwellenraumMaterial = alternate;
    scene.add(mesh);
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const variant of ["day", "night", "snowstorm"]) {
        day.defines.MODE = alternate.defines.MODE = variant;
        const shared = host.compile(day);
        expect(host.compile(alternate)).toBe(shared);
        expect(shared.usedTimes).toBe(2);
      }
      expect(host.backend.programs).toHaveLength(4);
      expect(host.properties.get(day).programs.size).toBe(3);
      const retired = host.backend.programs.filter((program: unknown) => program !== untouchedProgram);
      const previousDeletes = host.deleted.length;
      expect(retireSceneMaterialPrograms(scene)).toBe(2);
      expect(host.backend.programs).toEqual([untouchedProgram]);
      expect(host.properties.has(day)).toBeFalse();
      expect(host.properties.has(alternate)).toBeFalse();
      expect(host.deleted).toHaveLength(previousDeletes + 3);
      expect(retired.every((program: object) => host.releasedBindings.includes(program))).toBeTrue();
      expect(mesh.material).toBe(day);
      expect(mesh.userData.schwellenraumMaterial).toBe(alternate);
    }
    untouched.dispose();
    expect(host.backend.programs).toHaveLength(0);
    expect(host.deleted).toHaveLength(host.created.length);
  });

  test("Three retains a shared program until its final material reference is released", () => {
    const host = programHost();
    const retired = shader();
    const retained = shader();
    const program = host.compile(retired);
    expect(host.compile(retained)).toBe(program);
    const mesh = new Mesh(new BoxGeometry(), retired);
    retireSceneMaterialPrograms(mesh);
    expect(program.usedTimes).toBe(1);
    expect(host.backend.programs).toEqual([program]);
    expect(host.deleted).toHaveLength(0);
    retained.dispose();
    expect(host.backend.programs).toHaveLength(0);
    expect(host.deleted).toHaveLength(1);
  });
});
