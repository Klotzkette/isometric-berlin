import { Box3, Group, Material, Mesh, LineSegments, Object3D, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3, type WebGLRenderer } from "three";
import { PARLIAMENT_INTERIORS_V295 as P, parliamentLocalPointV295, parliamentWorldPointV295 as W } from "./parliamentInteriorsV295Profile";
import { ownReichstagSectionMaterialV318, releaseReichstagSectionMaterialV318 } from "./reichstagSectionMaterialV318";
import { createReichstagSectionRoomsV318 } from "./ReichstagRoomsV318";
import { createReichstagSectionFurnishingsV319 } from "./ReichstagRoomsV319";
import { createReichstagUndergroundV319, reichstagUndergroundRevealVolumesV319, setReichstagUndergroundViewV319 } from "./ReichstagUndergroundV319";
import { createReichstagSectionShadowV319, ownReichstagSectionShaderV319, type SectionShaderReceiptV319 } from "./reichstagSectionShaderV319";

export type ReichstagSectionViewV319 = "longitudinal" | "rooms" | "basement" | "connections";
export type ReichstagSectionBoxV319 = { center: readonly number[]; size: readonly number[]; yaw?: number };
export const REICHSTAG_WEST_CUT_V319: ReichstagSectionBoxV319 = { center: W("reichstag", [-38.5, 40.5, 0]), size: [61, 99, 148], yaw: P.reichstag.yaw };
// The original closed body's bottom face lies at3.595m. Clear it as well as
// upper terrain: stopping at a nominal basement ceiling would leave an opaque
// source floor hiding the very rooms this temporary exhibit is meant to show.
const upperCut: ReichstagSectionBoxV319 = { center: W("reichstag", [23.5, 44.95, 0]), size: [63, 90.1, 148], yaw: P.reichstag.yaw };
// Independent native source columns fill the otherwise hollow wing interiors.
// Expose only the two furnished strips; source facade/roof complements survive
// everywhere else. Exhibit walls, furniture and floors use west-only clipping.
const furnishedWingCuts: readonly ReichstagSectionBoxV319[] = [-1, 1].map(side => ({center: W("reichstag", [2.6, 16.4, side * 53.75]), size: [21.2, 23, 19.5], yaw: P.reichstag.yaw}));
export function reichstagSectionBoxPlanesV319(box: ReichstagSectionBoxV319): Plane[] {
  const c = Math.cos(box.yaw ?? 0), s = Math.sin(box.yaw ?? 0), center = new Vector3(...box.center as [number, number, number]);
  return [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]].map((normal, i) => {
    const n = new Vector3(normal[0] * c + normal[2] * s, normal[1], -normal[0] * s + normal[2] * c);
    return new Plane(n, -n.dot(center) - box.size[Math.floor(i / 2)] / 2);
  });
}
export function reichstagSectionBoxesV319(view: ReichstagSectionViewV319): readonly ReichstagSectionBoxV319[] {
  return view === "longitudinal" || view === "rooms" ? [REICHSTAG_WEST_CUT_V319, ...furnishedWingCuts] : view === "basement" ? [REICHSTAG_WEST_CUT_V319, upperCut] : [REICHSTAG_WEST_CUT_V319, upperCut, ...reichstagUndergroundRevealVolumesV319()];
}
function sourcePlanes(view: ReichstagSectionViewV319, flood = false): Plane[] {
  // Only fictional water receives the taller vertical mask, keeping the same
  // corridor XZ. A21m flood must not cover its underground exhibit; ordinary
  // buildings, ground, roads and source water keep their exact lower cuts.
  const boxes = reichstagSectionBoxesV319(view).map(b => {
    if (!flood || view !== "connections") return b;
    const low = b.center[1] - b.size[1] / 2;
    return { ...b, center: [b.center[0], (low + 90) / 2, b.center[2]], size: [b.size[0], 90 - low, b.size[2]] };
  }), all = boxes.flatMap(reichstagSectionBoxPlanesV319);
  if (boxes.length === 1) return all;
  // A cheap enclosing guard skips every fine tunnel plane for fragments outside
  // this finite quarter. It is a shader optimisation, never a removed volume.
  const bounds = new Box3();
  for (const b of boxes) {
    const c = Math.abs(Math.cos(b.yaw ?? 0)), s = Math.abs(Math.sin(b.yaw ?? 0));
    const half = new Vector3((c * b.size[0] + s * b.size[2]) / 2, b.size[1] / 2, (s * b.size[0] + c * b.size[2]) / 2), center = new Vector3(...b.center as [number, number, number]);
    bounds.expandByPoint(center.clone().sub(half)); bounds.expandByPoint(center.add(half));
  }
  return [...reichstagSectionBoxPlanesV319({center: bounds.getCenter(new Vector3()).toArray(), size: bounds.getSize(new Vector3()).toArray()}), ...all];
}
export function reichstagSectionRemovedAtV319(view: ReichstagSectionViewV319, x: number, y: number, z: number): boolean {
  const point = new Vector3(x, y, z);
  return reichstagSectionBoxesV319(view).some(box => reichstagSectionBoxPlanesV319(box).every(p => p.distanceToPoint(point) < 0));
}
export function reichstagSectionCameraV319(view: ReichstagSectionViewV319): { eye: [number, number, number]; target: [number, number, number]; fov: number } {
  if (view === "longitudinal") return { eye: W("reichstag", [-131, 52, 72]), target: W("reichstag", [0, 13, 18]), fov: 43 };
  if (view === "rooms") return { eye: W("reichstag", [-56, 32, 55]), target: W("reichstag", [1, 15.5, 53]), fov: 44 };
  if (view === "basement") return { eye: W("reichstag", [-8, 34, 40]), target: W("reichstag", [38, 1.5, 0]), fov: 47 };
  const boxes = reichstagUndergroundRevealVolumesV319();
  const minX = Math.min(...boxes.map(b => b.center[0] - Math.hypot(b.size[0], b.size[2]) / 2)), maxX = Math.max(...boxes.map(b => b.center[0] + Math.hypot(b.size[0], b.size[2]) / 2));
  const minZ = Math.min(...boxes.map(b => b.center[2] - Math.hypot(b.size[0], b.size[2]) / 2)), maxZ = Math.max(...boxes.map(b => b.center[2] + Math.hypot(b.size[0], b.size[2]) / 2));
  const x = (minX + maxX) / 2, z = (minZ + maxZ) / 2, span = Math.max(maxX - minX, maxZ - minZ, 160);
  return { eye: [x - span * .55, span * .85, z + span * .85], target: [x, -2, z], fov: 47 };
}

const exhibitParts = new WeakMap<Object3D, { wings: Object3D[]; basement: Object3D }>();
export function createReichstagSectionRoomsV319(native = false): Group {
  const root = new Group(), wings = [createReichstagSectionRoomsV318(native), createReichstagSectionFurnishingsV319(native)], basement = createReichstagUndergroundV319(native);
  root.name = "Reichstag reversible furnished section and basement";
  root.userData = { sectionOnly: true, native, fullStaticDetailOnTouch: true };
  root.add(...wings, basement); exhibitParts.set(root, { wings, basement }); return root;
}
function presentExhibit(root: Object3D, view: ReichstagSectionViewV319): void {
  const parts = exhibitParts.get(root); if (!parts) return;
  for (const wing of parts.wings) wing.visible = view === "longitudinal" || view === "rooms";
  setReichstagUndergroundViewV319(parts.basement, view === "connections");
}

type Receipt = { planes: Plane[] | null; intersection: boolean; shadows: boolean; release: () => void; shader: SectionShaderReceiptV319; restoreCloneMethod: () => void; exhibit: boolean; flood: boolean };
type ShadowReceipt = { depth: Material | undefined; distance: Material | undefined };
export type ReichstagSectionV319 = ReturnType<typeof createReichstagSectionV319>;
export function createReichstagSectionV319(options: {
  scene: Object3D; camera: PerspectiveCamera; canvas: HTMLCanvasElement; renderer: Pick<WebGLRenderer, "localClippingEnabled">;
  ready: () => boolean; invalidate: () => void; onChange?: (open: boolean) => void; initiallyOpen?: boolean;
  native?: () => boolean; createRooms?: (native: boolean) => Object3D; disposeObject?: (root: Object3D) => void;
  presentRooms?: (root: Object3D) => void; initialView?: ReichstagSectionViewV319; onViewChange?: (view: ReichstagSectionViewV319) => void;
  floodMaterial?: () => Material | undefined;
}) {
  let open = options.initiallyOpen === true, view = options.initialView ?? "longitudinal", disposed = false, lastTap = -Infinity;
  const originalClipping = options.renderer.localClippingEnabled, receipts = new Map<Material, Receipt>(), rooms = new Map<boolean, Object3D>();
  const exhibitPlanes = reichstagSectionBoxPlanesV319(REICHSTAG_WEST_CUT_V319);
  let planes = sourcePlanes(view), floodPlanes = sourcePlanes(view, true);
  const shadows = new WeakMap<Mesh, ShadowReceipt>(), shadowRefs = new Set<WeakRef<Mesh>>(), shadowVariants = new Map<string, Map<Material | undefined, Material>>();
  const ray = new Raycaster(), ndc = new Vector2(), inverseYaw = -P.reichstag.yaw;
  const bounds = new Box3(new Vector3(-66, -9, -70), new Vector3(51, 43, 70));
  const apply = (material: Material, exhibit: boolean, flood = false) => {
    const old = receipts.get(material), selected = exhibit ? exhibitPlanes : flood ? floodPlanes : planes;
    if (old) { if (old.exhibit !== exhibit || old.flood !== flood) throw new Error("Reichstag exhibit cannot share a source material"); return; }
    if (material.clippingPlanes?.length) return;
    const cloneDescriptor = Object.getOwnPropertyDescriptor(material, "clone"), originalClone = material.clone;
    if (cloneDescriptor && !cloneDescriptor.configurable && !cloneDescriptor.writable) return;
    const shader = ownReichstagSectionShaderV319(material, selected, selected.length > 6);
    const restoreCloneMethod = () => { if (cloneDescriptor) Object.defineProperty(material, "clone", cloneDescriptor); else delete (material as unknown as {clone?: unknown}).clone; };
    const release = () => {
      restoreCloneMethod(); shader.restore(); material.clippingPlanes = state.planes; material.clipIntersection = state.intersection; material.clipShadows = state.shadows; material.needsUpdate = true;
      receipts.delete(material); releaseReichstagSectionMaterialV318(material); material.removeEventListener("dispose", release);
    };
    const state = { planes: material.clippingPlanes, intersection: material.clipIntersection, shadows: material.clipShadows, release, shader, restoreCloneMethod, exhibit, flood };
    // Late source transactions clone their actual materials while preparing
    // outside complements. Cloning a temporary cut must yield the clean source
    // state, so its later publication and every close can still restore exactly.
    const clone = function(this: Material) {
      const result = originalClone.call(this);
      if (this === material && result !== material) {
        result.clippingPlanes = state.planes?.map(p => p.clone()) ?? null;
        result.clipIntersection = state.intersection; result.clipShadows = state.shadows; shader.restoreClone(result);
      }
      return result;
    };
    Object.defineProperty(material, "clone", cloneDescriptor && !cloneDescriptor.configurable ? {...cloneDescriptor, value: clone} : {value: clone, configurable: true, writable: true, enumerable: cloneDescriptor?.enumerable ?? false});
    receipts.set(material, state); ownReichstagSectionMaterialV318(material, state); material.addEventListener("dispose", release);
    material.clippingPlanes = selected; material.clipIntersection = true; material.clipShadows = true; material.needsUpdate = true;
  };
  const restoreShadows = () => {
    for (const ref of shadowRefs) { const object = ref.deref(), old = object && shadows.get(object); if (object && old) { object.customDepthMaterial = old.depth; object.customDistanceMaterial = old.distance; shadows.delete(object); } }
    shadowRefs.clear(); for (const variants of shadowVariants.values()) for (const material of variants.values()) material.dispose(); shadowVariants.clear();
  };
  const applyShadows = (object: Mesh, exhibit: boolean) => {
    if (!object.castShadow || shadows.has(object)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some(m => !receipts.has(m))) return;
    const selected = exhibit ? exhibitPlanes : planes;
    shadows.set(object, { depth: object.customDepthMaterial, distance: object.customDistanceMaterial }); shadowRefs.add(new WeakRef(object));
    for (const distance of [false, true]) {
      const key = `${exhibit}:${distance}`, original = distance ? object.customDistanceMaterial : object.customDepthMaterial;
      let variants = shadowVariants.get(key); if (!variants) { variants = new Map(); shadowVariants.set(key, variants); }
      let material = variants.get(original); if (!material) { material = createReichstagSectionShadowV319(selected, distance, original, selected.length > 6); variants.set(original, material); }
      if (distance) object.customDistanceMaterial = material; else object.customDepthMaterial = material;
    }
  };
  const restore = () => {
    restoreShadows();
    for (const [m, old] of receipts) { m.removeEventListener("dispose", old.release); old.restoreCloneMethod(); old.shader.restore(); releaseReichstagSectionMaterialV318(m); m.clippingPlanes = old.planes; m.clipIntersection = old.intersection; m.clipShadows = old.shadows; m.needsUpdate = true; }
    receipts.clear(); options.renderer.localClippingEnabled = originalClipping;
  };
  const sync = () => {
    if (disposed || !open || !options.ready()) return;
    const native = options.native?.() === true;
    if (options.createRooms && !rooms.has(native)) { const root = options.createRooms(native); rooms.set(native, root); options.scene.add(root); }
    for (const [family, root] of rooms) { root.visible = family === native; presentExhibit(root, view); if (root.visible) options.presentRooms?.(root); }
    for (const ref of shadowRefs) if (!ref.deref()) shadowRefs.delete(ref);
    const roots = new Set(rooms.values()), flood = options.floodMaterial?.(); options.renderer.localClippingEnabled = true;
    options.scene.traverse(o => {
      if (!(o instanceof Mesh || o instanceof LineSegments)) return;
      let parent: Object3D | null = o, exhibit = false; while (parent) { if (roots.has(parent)) { exhibit = true; break; } parent = parent.parent; }
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) apply(m, exhibit, m === flood);
      for (const key of ["dayMaterial", "nightMaterial", "schwellenraumMaterial"]) { const m = o.userData[key]; if (m instanceof Material) apply(m, exhibit, m === flood); }
      if (o instanceof Mesh) applyShadows(o, exhibit);
    });
  };
  const setOpen = (value: boolean) => {
    if (disposed || value === open || (value && !options.ready())) return;
    open = value; if (!open) { restore(); for (const root of rooms.values()) root.visible = false; } else sync(); options.onChange?.(open); options.invalidate();
  };
  const hit = (x: number, y: number) => {
    if (disposed || !options.ready()) return false;
    const r = options.canvas.getBoundingClientRect(); if (!r.width || !r.height || x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
    ndc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, options.camera);
    const cp = parliamentLocalPointV295("reichstag", ...options.camera.position.toArray());
    const inBody = Math.abs(cp[0]) < 50 && Math.abs(cp[2]) < 69 && cp[1] < P.reichstag.terrace + .75;
    const inDome = Math.hypot(cp[0], cp[2]) < 21 && cp[1] < P.reichstag.terrace + 24.5;
    if (inBody || inDome) return false;
    const localRay = ray.ray.clone(); localRay.origin.sub(new Vector3(...P.reichstag.anchor)); localRay.origin.y += P.reichstag.anchor[1];
    localRay.origin.applyAxisAngle(new Vector3(0, 1, 0), inverseYaw); localRay.direction.applyAxisAngle(new Vector3(0, 1, 0), inverseYaw);
    const point = localRay.intersectBox(bounds, new Vector3());
    const dome = new Box3(new Vector3(-21, P.reichstag.terrace, -21), new Vector3(21, P.reichstag.terrace + 24, 21)), domePoint = localRay.intersectBox(dome, new Vector3());
    return Math.min(point ? point.distanceTo(localRay.origin) : Infinity, domePoint ? domePoint.distanceTo(localRay.origin) : Infinity) < 1800;
  };
  return {
    get open() { return open; }, get view() { return view; }, sync, setOpen, hit,
    setView(next: ReichstagSectionViewV319) { if (disposed || next === view || !["longitudinal", "rooms", "basement", "connections"].includes(next)) return; restore(); view = next; planes = sourcePlanes(view); floodPlanes = sourcePlanes(view, true); sync(); options.onViewChange?.(view); options.invalidate(); },
    tap(x: number, y: number): boolean { if (!hit(x, y)) return false; const now = performance.now(); if (now - lastTap > 400) { lastTap = now; setOpen(!open); } return true; },
    dispose() { disposed = true; restore(); for (const root of rooms.values()) { root.removeFromParent(); options.disposeObject?.(root); } rooms.clear(); },
  };
}
