import { Box3, Material, Mesh, LineSegments, Object3D, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3, type WebGLRenderer } from "three";
import { PARLIAMENT_INTERIORS_V295 as P, parliamentLocalPointV295 } from "./parliamentInteriorsV295Profile";
import { ownReichstagSectionMaterialV318, releaseReichstagSectionMaterialV318 } from "./reichstagSectionMaterialV318";

/** A reversible display cut, parallel to the building's long north/south axis.
 * Native and drawn geometry use the same world planes; source arrays are never
 * copied, edited or evicted. No geographic clipping applies outside this box. */
export const REICHSTAG_SECTION_V318 = { min: [-69, 5.45, -74], max: [-8, 90, 74], cutAxis: "longitudinal north/south", estimated: true } as const;
export function reichstagSectionRemovedAtV318(x: number, y: number, z: number): boolean {
  const q = parliamentLocalPointV295("reichstag", x, y, z), b = REICHSTAG_SECTION_V318;
  return q.every((n, i) => n > b.min[i] && n < b.max[i]);
}
export function reichstagSectionPlanesV318(): Plane[] {
  const b = REICHSTAG_SECTION_V318, yaw = P.reichstag.yaw, c = Math.cos(yaw), s = Math.sin(yaw);
  // Three.js clipIntersection discards the intersection of the six NEGATIVE
  // halfspaces, retaining the full complement, including all other city sites.
  return [[-1, 0, 0, b.min[0]], [1, 0, 0, -b.max[0]], [0, -1, 0, b.min[1]], [0, 1, 0, -b.max[1]], [0, 0, -1, b.min[2]], [0, 0, 1, -b.max[2]]].map(([a, yy, zz, d]) => {
    const normal = new Vector3(a * c + zz * s, yy, -a * s + zz * c);
    return new Plane(normal, d - normal.x * P.reichstag.anchor[0] - normal.z * P.reichstag.anchor[2]);
  });
}
type Receipt = { planes: Plane[] | null; intersection: boolean; shadows: boolean; release: () => void };
export type ReichstagSectionV318 = ReturnType<typeof createReichstagSectionV318>;
export function createReichstagSectionV318(options: {
  scene: Object3D; camera: PerspectiveCamera; canvas: HTMLCanvasElement; renderer: Pick<WebGLRenderer, "localClippingEnabled">;
  ready: () => boolean; invalidate: () => void; onChange?: (open: boolean) => void; initiallyOpen?: boolean;
  native?: () => boolean; createRooms?: (native: boolean) => Object3D; disposeObject?: (root: Object3D) => void;
  presentRooms?: (root: Object3D) => void;
}) {
  let open = options.initiallyOpen === true, disposed = false, lastTap = -Infinity;
  const originalClipping = options.renderer.localClippingEnabled, planes = reichstagSectionPlanesV318(), receipts = new Map<Material, Receipt>();
  const rooms = new Map<boolean, Object3D>();
  const ray = new Raycaster(), ndc = new Vector2(), inverseYaw = -P.reichstag.yaw;
  const bounds = new Box3(new Vector3(-66, 5.4, -70), new Vector3(51, 43, 70));
  const apply = (material: Material) => {
    if (receipts.has(material)) return;
    // Preserve unrelated authored clipping rather than replacing its semantics.
    if (material.clippingPlanes?.length) return;
    const release = () => { receipts.delete(material); releaseReichstagSectionMaterialV318(material); material.removeEventListener("dispose", release); };
    const state = { planes: material.clippingPlanes, intersection: material.clipIntersection, shadows: material.clipShadows, release };
    receipts.set(material, state); ownReichstagSectionMaterialV318(material, state);
    material.addEventListener("dispose", release);
    material.clippingPlanes = planes; material.clipIntersection = true; material.clipShadows = true; material.needsUpdate = true;
  };
  const restore = () => {
    for (const [m, old] of receipts) { m.removeEventListener("dispose", old.release); releaseReichstagSectionMaterialV318(m); m.clippingPlanes = old.planes; m.clipIntersection = old.intersection; m.clipShadows = old.shadows; m.needsUpdate = true; }
    receipts.clear(); options.renderer.localClippingEnabled = originalClipping;
  };
  const sync = () => {
    if (disposed || !open || !options.ready()) return;
    const native = options.native?.() === true;
    if (options.createRooms && !rooms.has(native)) { const root = options.createRooms(native); rooms.set(native, root); options.scene.add(root); }
    for (const [family, root] of rooms) { root.visible = family === native; if (root.visible) options.presentRooms?.(root); }
    options.renderer.localClippingEnabled = true;
    options.scene.traverse(o => {
      if (!(o instanceof Mesh || o instanceof LineSegments)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) apply(m);
      // Both explicit lighting variants must be clipped when a mode changes.
      for (const key of ["dayMaterial", "nightMaterial", "schwellenraumMaterial"]) {
        const m = o.userData[key]; if (m instanceof Material) apply(m);
      }
    });
  };
  const setOpen = (value: boolean) => {
    if (disposed || value === open || (value && !options.ready())) return;
    open = value; if (!open) { restore(); for (const root of rooms.values()) root.visible = false; } else sync(); options.onChange?.(open); options.invalidate();
  };
  const hit = (x: number, y: number) => {
    if (disposed || !options.ready()) return false;
    const r = options.canvas.getBoundingClientRect();
    if (!r.width || !r.height || x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
    ndc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, options.camera);
    // Do not turn ordinary clicks on furniture into exhibit clicks inside.
    const cp = parliamentLocalPointV295("reichstag", ...options.camera.position.toArray());
    if (Math.abs(cp[0]) < 50 && Math.abs(cp[2]) < 69 && cp[1] < 48) return false;
    const localRay = ray.ray.clone(); localRay.origin.sub(new Vector3(...P.reichstag.anchor)); localRay.origin.y += P.reichstag.anchor[1];
    localRay.origin.applyAxisAngle(new Vector3(0, 1, 0), inverseYaw); localRay.direction.applyAxisAngle(new Vector3(0, 1, 0), inverseYaw);
    const point = localRay.intersectBox(bounds, new Vector3());
    const distance = point ? point.distanceTo(localRay.origin) : Infinity;
    // A genuine gap above the building is not a target; the dome is separate.
    const dome = new Box3(new Vector3(-21, P.reichstag.terrace, -21), new Vector3(21, P.reichstag.terrace + 24, 21));
    const domePoint = localRay.intersectBox(dome, new Vector3());
    return Math.min(distance, domePoint ? domePoint.distanceTo(localRay.origin) : Infinity) < 1800;
  };
  return {
    get open() { return open; }, sync, setOpen, hit,
    tap(x: number, y: number): boolean { if (!hit(x, y)) return false; const now = performance.now(); if (now - lastTap > 400) { lastTap = now; setOpen(!open); } return true; },
    dispose() { disposed = true; restore(); for (const root of rooms.values()) { root.removeFromParent(); options.disposeObject?.(root); } rooms.clear(); },
  };
}
