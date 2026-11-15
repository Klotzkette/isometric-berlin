import { describe, expect, test } from "bun:test";
import { BoxGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, ShaderLib, type Material, type WebGLRenderer } from "three";
import { certifyPackedRiverWaterV348, createWaterRipplesV348, PACKED_RIVER_PAINT_V348, patchRiverShaderV348 } from "../src/WaterRipplesV348";
import { retireSceneMaterialPrograms } from "../src/sceneMaterialPrograms";
import type { SurroundingNavigation } from "../src/SurroundingCityGeometry";

const nav = (ring = [[0, 0], [20, 0], [20, 20], [0, 20]], holes: number[][][] = []): SurroundingNavigation => ({
  ground: [], buildings: [], water: [{ ring, holes }], groundY: 4.2,
});
const vertices = (points = [[0, 0], [20, 0], [0, 20]]) => new Uint16Array(points.flatMap(([x, z]) => [x * 100, 885, z * 100, ...PACKED_RIVER_PAINT_V348.map(c => c * 257)]));
function finish<T>(steps: Generator<void, T>): T { let result = steps.next(); while (!result.done) result = steps.next(); return result.value; }
const certify = (v = vertices(), n = nav(), native = false, ix = new Uint16Array([0, 1, 2])) => finish(certifyPackedRiverWaterV348(-10, n, v, ix, native));
function compile(material: Material) {
  const shader = { vertexShader: ShaderLib.basic.vertexShader, fragmentShader: ShaderLib.basic.fragmentShader, uniforms: {} as Record<string, { value: number }> };
  material.onBeforeCompile(shader, {} as WebGLRenderer);
  return shader;
}
function draw(material: Material, mesh: Mesh, camera = new PerspectiveCamera()) {
  material.onBeforeRender({} as WebGLRenderer, new Scene(), camera, mesh.geometry, mesh, new Group());
}

describe("V348 source-bound river ripple admission", () => {
  test("same original arrays, triangles, groups, water datum and palette; no Native or empty tile work", () => {
    const v = vertices(), ix = new Uint16Array([0, 1, 2]), before = v.slice(), beforeIndex = ix.slice();
    expect(certify(v, nav(), false, ix)).toEqual({ rgb: PACKED_RIVER_PAINT_V348.map(c => c / 255), localY: 885, triangles: 1, bounds: [0, 0, 2000, 2000] });
    expect(v).toEqual(before); expect(ix).toEqual(beforeIndex);
    expect(certify(v, nav(), true)).toBeUndefined();
    const empty = nav(); empty.water = [];
    expect(certify(v, empty)).toBeUndefined();
    const raised = v.slice(); raised[1] = raised[7] = raised[13] = 1520;
    expect(certify(raised)).toBeUndefined();
  });
  test("a paint collision, mixed triangle, concave bank or even a small enclosed island rejects admission", () => {
    expect(certify(vertices([[0, 0], [40, 0], [0, 20]]))).toBeUndefined();
    const mixed = vertices(); mixed[9] = 0;
    expect(certify(mixed)).toBeUndefined();
    expect(certify(vertices(), nav(undefined, [[[3, 3], [4, 3], [4, 4], [3, 4]]]))).toBeUndefined();
    expect(certify(vertices([[0, 0], [20, 0], [20, 20]]), nav([[0, 0], [20, 0], [20, 20], [11, 20], [11, 5], [9, 5], [9, 20], [0, 20]]))).toBeUndefined();
    const degenerate = new Uint16Array([0, 0, 0, 0, 1, 2]);
    expect(certify(vertices(), nav(), false, degenerate)?.triangles).toBe(1);
  });
  test("yielded admission keeps a bounded scan", () => {
    const indices = new Uint16Array(Array.from({ length: 1024 }, () => [0, 1, 2]).flat());
    let yields = 0;
    const steps = certifyPackedRiverWaterV348(-10, nav(), vertices(), indices);
    let result = steps.next(); while (!result.done) { yields++; result = steps.next(); }
    expect(yields).toBe(4); expect(result.value?.triangles).toBe(1024);
  });
});

describe("V348 original material and shared frame lifetime", () => {
  test("shader composes prior patches, keeps all geometry/paint/transparency and restores exact callbacks", () => {
    const material = new MeshBasicMaterial({ color: 0x9fc7d8, transparent: true, opacity: .46, depthWrite: false });
    material.onBeforeCompile = shader => { shader.fragmentShader = "// earlier owner\n" + shader.fragmentShader; };
    material.customProgramCacheKey = () => "earlier-owner";
    const oldCompile = material.onBeforeCompile, oldKey = material.customProgramCacheKey, oldRender = material.onBeforeRender;
    const mesh = new Mesh(new BoxGeometry(20, .14, 20), material); mesh.name = "smooth water surface";
    const geometry = mesh.geometry, position = geometry.getAttribute("position").array.slice(), materialJSON = material.toJSON();
    const controller = createWaterRipplesV348(); controller.bind(mesh); controller.bind(mesh);
    expect(controller.boundMaterials).toBe(1);
    const shader = compile(material);
    expect(shader.fragmentShader).toContain("// earlier owner");
    expect(shader.fragmentShader).toContain("fwidth(riverA)");
    expect(shader.vertexShader).toContain("instanceMatrix * riverWorldV348");
    expect(material.customProgramCacheKey()).toBe("earlier-owner|ordinary-river-ripples-v348-pure");
    expect(mesh.geometry).toBe(geometry); expect(geometry.getAttribute("position").array).toEqual(position);
    expect(material.toJSON()).toEqual(materialJSON);
    controller.dispose();
    expect(material.onBeforeCompile).toBe(oldCompile); expect(material.customProgramCacheKey).toBe(oldKey); expect(material.onBeforeRender).toBe(oldRender);
    expect(controller.boundMaterials).toBe(0);
    geometry.dispose(); material.dispose();
  });
  test("cold startup, non-water owners, still modes, hidden/reduced motion and offscreen time stay idle", () => {
    const controller = createWaterRipplesV348(), mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    mesh.name = "Sinti and Roma pool"; controller.bind(mesh); expect(controller.boundMaterials).toBe(0);
    mesh.name = "smooth water surface"; controller.bind(mesh); const shader = compile(mesh.material);
    expect(controller.update(0, "day", false, false)).toBe(false);
    draw(mesh.material, mesh);
    expect(controller.update(42, "day", false, false)).toBe(true);
    draw(mesh.material, mesh); expect(controller.update(84, "day", false, false)).toBe(true);
    expect(shader.uniforms.uRiverTimeV348.value).toBeCloseTo(.042);
    const frozen = shader.uniforms.uRiverTimeV348.value;
    for (const mode of ["minecraft", "flood", "schwellenraum"] as const) {
      expect(controller.update(90, mode, false, false)).toBe(false);
      expect(shader.uniforms.uRiverEnabledV348.value).toBe(0);
    }
    expect(controller.update(100, "day", true, false)).toBe(false);
    expect(controller.update(20000, "day", false, true)).toBe(false);
    expect(shader.uniforms.uRiverTimeV348.value).toBe(frozen);
    expect(controller.update(20042, "day", false, false)).toBe(false);
    draw(mesh.material, mesh); controller.update(20084, "day", false, false);
    expect(shader.uniforms.uRiverTimeV348.value).toBe(frozen);
    expect(controller.update(20085, "day", false, false)).toBe(false);
    expect(controller.update(20250, "day", false, false)).toBe(false);
    controller.dispose(); mesh.geometry.dispose(); mesh.material.dispose();
  });
  test("mixed water bounds must meet camera frustum, not merely another part of the visible tile", () => {
    const controller = createWaterRipplesV348(), mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial({ vertexColors: true }));
    mesh.scale.setScalar(.01); mesh.updateMatrixWorld();
    const selector = certify()!;
    controller.bind(mesh, selector);
    const camera = new PerspectiveCamera(50, 1, .1, 500);
    camera.position.set(-200, 15, -200); camera.lookAt(-250, 15, -250); camera.updateMatrixWorld();
    controller.update(0, "day", false, false); draw(mesh.material, mesh, camera);
    expect(controller.update(42, "day", false, false)).toBe(false);
    camera.position.set(10, 30, 30); camera.lookAt(10, 8.85, 10); camera.updateMatrixWorld();
    draw(mesh.material, mesh, camera); expect(controller.update(84, "day", false, false)).toBe(true);
    controller.dispose(); mesh.geometry.dispose(); mesh.material.dispose();
  });
  test("retiring mode programs preserves hooks; genuine packet disposal releases controller retention", () => {
    const controller = createWaterRipplesV348(), mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); mesh.name = "drawn water surface";
    const root = new Group(); root.add(mesh); controller.bind(mesh); const patched = mesh.material.onBeforeCompile;
    retireSceneMaterialPrograms(root); expect(mesh.material.onBeforeCompile).toBe(patched); expect(controller.boundMaterials).toBe(1);
    mesh.material.dispose(); expect(controller.boundMaterials).toBe(0);
    expect(mesh.material.onBeforeCompile).not.toBe(patched);
    controller.dispose(); mesh.geometry.dispose();
  });
  test("pure and mixed shaders patch actual Three templates without replacing outputs or depth", () => {
    for (const source of [ShaderLib.basic, ShaderLib.standard]) for (const mixed of [false, true]) {
      const patch = patchRiverShaderV348(source.vertexShader, source.fragmentShader, mixed);
      expect(patch.fragment).toContain("#include <opaque_fragment>"); expect(patch.fragment).toContain("#include <colorspace_fragment>");
      expect(patch.vertex.match(/gl_Position\s*=/g)).toBeNull();
      expect(patch.fragment).not.toContain("discard"); expect(patch.fragment.match(/sampler2D/g)?.length ?? 0).toBe(source.fragmentShader.match(/sampler2D/g)?.length ?? 0);
      if (mixed) expect(patch.vertex).toContain("distance(color.rgb,uRiverSelectorV348.xyz)");
    }
    expect(() => patchRiverShaderV348("missing", "missing", false)).toThrow();
  });
});
