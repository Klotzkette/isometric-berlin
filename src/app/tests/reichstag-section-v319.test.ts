import { expect, test } from "bun:test";
import { BoxGeometry, Group, InstancedMesh, Material, Mesh, MeshBasicMaterial, MeshDepthMaterial, PerspectiveCamera, Plane, Scene, ShaderMaterial, Vector3 } from "three";
import { createReichstagSectionV319, createReichstagSectionRoomsV319, reichstagSectionBoxPlanesV319, reichstagSectionBoxesV319, reichstagSectionCameraV319, reichstagSectionRemovedAtV319, type ReichstagSectionViewV319 } from "../src/ReichstagSectionV319";
import { parliamentWorldPointV295 as W } from "../src/parliamentInteriorsV295Profile";
import { ownReichstagSectionShaderV319, patchReichstagSectionFragmentV319 } from "../src/reichstagSectionShaderV319";
import { schwellenraumMaterialFor } from "../src/visual-modes/schwellenraum/materialGrade";

const canvas = { getBoundingClientRect: () => ({left: 0, top: 0, right: 800, bottom: 800, width: 800, height: 800}) } as HTMLCanvasElement;
const views = ["longitudinal", "rooms", "basement", "connections"] as const;
function camera() { const c = new PerspectiveCamera(43, 1, 1, 5000); c.position.set(...W("reichstag", [-200, 90, 170])); c.lookAt(...W("reichstag", [0, 18, 0])); c.updateMatrixWorld(true); return c; }

test("deep western cut and bounded basement complement retain outside city and actual lower rooms", () => {
  expect(reichstagSectionRemovedAtV319("longitudinal", ...W("reichstag", [-30, 0, 0]))).toBe(true);
  expect(reichstagSectionRemovedAtV319("longitudinal", ...W("reichstag", [30, 0, 0]))).toBe(false);
  expect(reichstagSectionRemovedAtV319("longitudinal", ...W("reichstag", [1, 15, 53]))).toBe(true);
  expect(reichstagSectionRemovedAtV319("longitudinal", ...W("reichstag", [25, 15, 53]))).toBe(false);
  expect(reichstagSectionRemovedAtV319("basement", ...W("reichstag", [30, 5.2, 0]))).toBe(true);
  expect(reichstagSectionRemovedAtV319("basement", ...W("reichstag", [30, 3.595, 0]))).toBe(true);
  expect(reichstagSectionRemovedAtV319("basement", ...W("reichstag", [30, -.15, 0]))).toBe(false);
  for (const view of views) {
    expect(reichstagSectionRemovedAtV319(view, 0, 50, 0)).toBe(false);
    expect(reichstagSectionRemovedAtV319(view, 15000, 5, 0)).toBe(false);
    for (const b of reichstagSectionBoxesV319(view)) {
      const planes = reichstagSectionBoxPlanesV319(b);
      expect(planes).toHaveLength(6); expect(planes.every(p => p.distanceToPoint(new Vector3(...b.center as [number, number, number])) < 0)).toBe(true);
    }
    const framing = reichstagSectionCameraV319(view);
    expect([...framing.eye, ...framing.target, framing.fov].every(Number.isFinite)).toBe(true);
  }
});

test("closing the basement view leaves an exterior roof click available while interior and dome furniture stay protected", () => {
  const c = camera(), section = createReichstagSectionV319({scene: new Scene(), camera: c, canvas, renderer: {localClippingEnabled: false}, ready: () => true, invalidate: () => {}});
  const pose = (eye: number[], target: number[]) => {c.position.set(...W("reichstag",eye)); c.lookAt(...W("reichstag",target)); c.updateMatrixWorld(true);};
  pose([-8,34,40],[0,10,0]); expect(section.hit(400,400)).toBe(true);
  pose([0,10,0],[21,10,0]); expect(section.hit(400,400)).toBe(false);
  pose([0,40,0],[21,40,0]); expect(section.hit(400,400)).toBe(false);
  section.dispose();
});

test("every view restores exact materials, shader callbacks, shadow pointers and original source arrays", () => {
  const scene = new Scene(), source = new MeshBasicMaterial(), body = new Mesh(new BoxGeometry(), source); body.castShadow = true;
  const customDepth = new MeshDepthMaterial(); body.customDepthMaterial = customDepth;
  const original = { before: source.onBeforeCompile, key: source.customProgramCacheKey, clone: source.clone, cloneDescriptor: Object.getOwnPropertyDescriptor(source, "clone"), positions: body.geometry.attributes.position.array };
  scene.add(body); const renderer = {localClippingEnabled: false}; let native = false, removed = 0;
  const changes: boolean[] = [], changedViews: ReichstagSectionViewV319[] = [];
  const section = createReichstagSectionV319({ scene, camera: camera(), canvas, renderer, ready: () => true, native: () => native, createRooms: n => createReichstagSectionRoomsV319(n), disposeObject: () => removed++, onChange: v => changes.push(v), onViewChange: v => changedViews.push(v), invalidate: () => {} });
  section.tap(400, 400); expect(section.open).toBe(true); expect(source.clippingPlanes).toHaveLength(24); expect(body.customDepthMaterial).not.toBe(customDepth);
  section.setView("basement"); expect(source.clippingPlanes).toHaveLength(18);
  const outside = source.clone(); expect(outside.clippingPlanes).toBeNull(); expect(outside.clipIntersection).toBe(false);
  const outsideBody = new Mesh(new BoxGeometry(), outside); scene.add(outsideBody); section.sync(); expect(outside.clippingPlanes).toHaveLength(18);
  section.setView("connections"); expect(source.clippingPlanes!.length).toBeGreaterThan(12);
  expect(source.clippingPlanes!.length).toBeLessThanOrEqual(192);
  // The first group is a non-discarding enclosing guard. Every actual removed
  // volume lies completely inside it, including all rotated corridor corners.
  const guard = source.clippingPlanes!.slice(0, 6);
  for (const b of reichstagSectionBoxesV319("connections")) {
    const c = Math.cos(b.yaw ?? 0), s = Math.sin(b.yaw ?? 0);
    for (const x of [-b.size[0] / 2, b.size[0] / 2]) for (const y of [-b.size[1] / 2, b.size[1] / 2]) for (const z of [-b.size[2] / 2, b.size[2] / 2]) {
      const p = new Vector3(b.center[0] + x * c + z * s, b.center[1] + y, b.center[2] - x * s + z * c);
      expect(guard.every(plane => plane.distanceToPoint(p) <= 1e-6)).toBe(true);
    }
  }
  const exhibit = scene.children.find(o => o.userData.sectionOnly)!;
  exhibit.traverse(o => {if (o instanceof Mesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) expect(m.clippingPlanes).toHaveLength(6);});
  const grade = schwellenraumMaterialFor(body, source); expect(grade.clippingPlanes).toBeNull(); body.material = grade; section.sync(); expect(grade.clippingPlanes!.length).toBeGreaterThan(12);
  native = true; section.sync(); expect(scene.children.filter(o => o.userData.sectionOnly && o.visible)).toHaveLength(1);
  const late = new MeshBasicMaterial(); scene.add(new Mesh(new BoxGeometry(), late)); section.sync(); expect(late.clippingPlanes!.length).toBeGreaterThan(12);
  const lateWater = new ShaderMaterial({vertexShader: "void main() { gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }", fragmentShader: "void main() { gl_FragColor=vec4(1.); }"}); scene.add(new Mesh(new BoxGeometry(), lateWater)); section.sync(); expect(lateWater.clipping).toBe(true); expect(lateWater.clippingPlanes!.length).toBeGreaterThan(12);
  section.setOpen(false);
  expect(source.clippingPlanes).toBeNull(); expect(grade.clippingPlanes).toBeNull(); expect(late.clippingPlanes).toBeNull();
  expect(lateWater.clippingPlanes).toBeNull(); expect(lateWater.clipping).toBe(false);
  expect(source.onBeforeCompile).toBe(original.before); expect(source.customProgramCacheKey).toBe(original.key);
  expect(source.clone).toBe(original.clone); expect(Object.getOwnPropertyDescriptor(source, "clone")).toEqual(original.cloneDescriptor); expect(outside.clippingPlanes).toBeNull();
  expect(body.customDepthMaterial).toBe(customDepth); expect(body.customDistanceMaterial).toBeUndefined(); expect(renderer.localClippingEnabled).toBe(false);
  expect(body.geometry.attributes.position.array).toBe(original.positions); expect(section.view).toBe("connections");
  section.setOpen(true); section.dispose(); expect(removed).toBe(2); expect(body.customDepthMaterial).toBe(customDepth); expect(scene.children.filter(o => o.userData.sectionOnly)).toHaveLength(0);
  expect(changes).toEqual([true, false, true]); expect(changedViews).toEqual(["basement", "connections"]);
});

test("fictional high water gets the exact corridor XZ mask without lifting ordinary source cuts", () => {
  const scene = new Scene(), water = new ShaderMaterial(), ground = new MeshBasicMaterial(); scene.add(new Mesh(new BoxGeometry(), water), new Mesh(new BoxGeometry(), ground));
  const section = createReichstagSectionV319({scene, camera: camera(), canvas, renderer: {localClippingEnabled: false}, ready: () => true, floodMaterial: () => water, initialView: "connections", invalidate: () => {}});
  section.setOpen(true);
  const b = reichstagSectionBoxesV319("connections").find(b => !reichstagSectionRemovedAtV319("basement", b.center[0], 25.5, b.center[2]) && b.center[1] < 4)!;
  expect(b).toBeDefined(); const p = new Vector3(b.center[0], 25.5, b.center[2]);
  const removes = (planes: Plane[]) => {for (let i = 6; i < planes.length; i += 6) if (planes.slice(i, i + 6).every(plane => plane.distanceToPoint(p) < 0)) return true; return false;};
  expect(removes(ground.clippingPlanes!)).toBe(false); expect(removes(water.clippingPlanes!)).toBe(true);
  expect(water.clone().clipping).toBe(false); section.dispose(); expect(water.clipping).toBe(false);
});

test("authored clipping stays unchanged and disposing a source material releases temporary shader ownership", () => {
  const scene = new Scene(), ownPlanes = [new Plane(new Vector3(0, 1, 0), -2)], fixed = new MeshBasicMaterial({clippingPlanes: ownPlanes}), disposable = new MeshBasicMaterial();
  const ownBefore = fixed.onBeforeCompile, before = disposable.onBeforeCompile;
  scene.add(new Mesh(new BoxGeometry(), fixed), new Mesh(new BoxGeometry(), disposable));
  const section = createReichstagSectionV319({scene, camera: camera(), canvas, renderer: {localClippingEnabled: true}, ready: () => true, invalidate: () => {}});
  section.setOpen(true); expect(fixed.clippingPlanes).toBe(ownPlanes); expect(fixed.onBeforeCompile).toBe(ownBefore);
  disposable.dispose(); expect(disposable.onBeforeCompile).toBe(before); expect(disposable.clippingPlanes).toBeNull(); expect(disposable.clipIntersection).toBe(false); expect(disposable.clipShadows).toBe(false); section.dispose(); expect(fixed.clippingPlanes).toBe(ownPlanes);
  expect(section.tap(400, 400)).toBe(false);
});

test("finite union shader independently discards each box and preserves custom flood uniforms and clean restoration", () => {
  const planes = reichstagSectionBoxesV319("basement").flatMap(reichstagSectionBoxPlanesV319);
  const shader = patchReichstagSectionFragmentV319("before\n#include <clipping_planes_fragment>\nafter", 2);
  expect(shader.match(/\) discard;/g)).toHaveLength(2); expect(shader).toContain("clippingPlanes[11]"); expect(shader).toContain("NUM_CLIPPING_PLANES == 12");
  const guarded = patchReichstagSectionFragmentV319("#include <clipping_planes_fragment>", 3, true);
  expect(guarded.match(/\) discard;/g)).toHaveLength(2); expect(guarded).toContain("clippingPlanes[17]"); expect(guarded.indexOf("clippingPlanes[0]")).toBeLessThan(guarded.indexOf("clippingPlanes[6]"));
  expect(() => patchReichstagSectionFragmentV319("no standard clipping", 2)).toThrow();
  const uniform = {value: 12}, material = new ShaderMaterial({uniforms: {time: uniform}, vertexShader: "void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }", fragmentShader: "void main() { gl_FragColor = vec4(1.); }"});
  const before = material.onBeforeCompile, cache = material.customProgramCacheKey, clipping = material.clipping;
  const receipt = ownReichstagSectionShaderV319(material, planes);
  const program = {vertexShader: material.vertexShader, fragmentShader: material.fragmentShader, uniforms: material.uniforms};
  material.onBeforeCompile(program as Parameters<Material["onBeforeCompile"]>[0], {} as Parameters<Material["onBeforeCompile"]>[1]);
  expect(program.vertexShader).toContain("vClipPosition = -(modelViewMatrix"); expect(program.fragmentShader).toContain("clippingPlanes[11]"); expect(program.uniforms.time).toBe(uniform);
  receipt.restore(); expect(material.clipping).toBe(clipping); expect(material.onBeforeCompile).toBe(before); expect(material.customProgramCacheKey).toBe(cache);
});

test("initial basement selection is preserved across independently rebuilt mode families without a second visible exhibit", () => {
  const scene = new Scene(); let native = false;
  const section = createReichstagSectionV319({scene, camera: camera(), canvas, renderer: {localClippingEnabled: false}, initiallyOpen: true, initialView: "basement", ready: () => true, native: () => native, createRooms: n => createReichstagSectionRoomsV319(n), invalidate: () => {}});
  section.sync(); native = true; section.sync(); native = false; section.sync();
  expect(section.view).toBe("basement"); expect(section.open).toBe(true);
  const roots = scene.children.filter(o => o.userData.sectionOnly); expect(roots).toHaveLength(2); expect(roots.filter(o => o.visible)).toHaveLength(1);
  for (const root of roots) { expect(root.children[0].visible).toBe(false); expect(root.children[1].visible).toBe(false); let instances = 0; root.traverse(o => {if (o instanceof InstancedMesh) instances += o.count;}); expect(instances).toBeLessThan(20000); }
  section.dispose();
});
