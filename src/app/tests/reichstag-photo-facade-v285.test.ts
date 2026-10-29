import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Box3, Group, InstancedMesh, LineSegments, Matrix4, Mesh, Object3D, Raycaster, ShapeGeometry, Vector2, Vector3 } from "three";
import { createArchitecturalSignature, REICHSTAG_COURTYARDS, type ReichstagModelSignature } from "../src/ArchitecturalLandmarks";
import { REICHSTAG_PHOTO_FACADE_GROUP, REICHSTAG_PHOTO_FACADE_PROFILE } from "../src/ReichstagPhotoFacade";

const signature: ReichstagModelSignature = {
  anchor_world: [0, 0, 0], body_height_m: 28.06, depth_m: 138,
  focus_camera: { azimuth_degrees: 45, distance_m: 200, polar_degrees: 60, target_height_m: 18 },
  geometry_status: "metric test", id: "reichstag-model", kind: "reichstag_model", landmark_name: "Reichstagsgebäude",
  rotation_y_degrees: 0, source_url: "https://www.bundestag.de/", width_m: 100,
};
type Anchor = { sourceName: string; sourceIndex: number; category: string; start: number; count: number };
function model(): Group { return createArchitecturalSignature(signature)!; }
function oldFingerprint(root: Object3D): { hash: string; renderables: number; bytes: number } {
  const hash = createHash("sha256"); let renderables = 0, bytes = 0;
  function visit(o: Object3D): void {
    if (o.name === REICHSTAG_PHOTO_FACADE_GROUP) return;
    hash.update(JSON.stringify({ name: o.name, type: o.type, pos: o.position.toArray(), rot: o.rotation.toArray(), scale: o.scale.toArray() }));
    if (o instanceof Mesh || o instanceof LineSegments) {
      renderables++;
      for (const [name, a] of Object.entries(o.geometry.attributes)) { hash.update(name); hash.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)); bytes += a.array.byteLength; }
      if (o.geometry.index) { const a = o.geometry.index.array; hash.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); bytes += a.byteLength; }
      if (o instanceof InstancedMesh) for (const attribute of [o.instanceMatrix, o.instanceColor]) if (attribute) { const a = attribute.array; hash.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); bytes += a.byteLength; }
    }
    o.children.forEach(visit);
  }
  visit(root); return { hash: hash.digest("hex"), renderables, bytes };
}
function inside(point: Vector2, ring: Vector2[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

describe("Reichstag owner-photo west opening detail", () => {
  test("every earlier rendered buffer and transform survives, including all 234 renderables and six courts", () => {
    const root = model();
    expect(oldFingerprint(root)).toEqual({ hash: "d8c6d9642444f5a5445b3f10500e0e9b41c63b290ddeacdca87f36b83e4499ac", renderables: 234, bytes: 572950 });
    for (let i = 1; i <= 6; i++) expect(root.getObjectByName(`Reichstag west portico column ${i}`)).toBeDefined();
    for (const name of ["Reichstag west pediment crowned corner finials", "Reichstag west portico Wappenbaum fine detail", "Reichstag DEM DEUTSCHEN VOLKE dedication lettering", "Reichstag west triangular pediment"]) expect(root.getObjectByName(name)).toBeDefined();
    expect(REICHSTAG_COURTYARDS).toHaveLength(6);
    const courts: Object3D[] = []; root.traverse(o => { if (o.name === "Reichstag inner courtyard floor") courts.push(o); }); expect(courts).toHaveLength(6);
  });

  test("all 26 existing west openings keep their source transforms and contain the new glazing or ring joints", () => {
    const root = model(), detail = root.getObjectByName(REICHSTAG_PHOTO_FACADE_GROUP)!;
    const mesh = detail.children[0] as InstancedMesh, anchors = detail.userData.openingAnchors as Anchor[];
    const counts: Record<string, number> = {};
    for (const anchor of anchors) counts[anchor.category] = (counts[anchor.category] ?? 0) + 1;
    expect(counts).toEqual({ "wing-arched-glazing": 10, "wing-upper-glazing": 10, "tower-arcade-glazing": 6, "wing-arch-joints": 10, "tower-arch-joints": 6 });
    const sourceMatrix = new Matrix4(), local = new Matrix4(), actual = new Matrix4();
    for (const anchor of anchors) {
      const source = root.getObjectByName(anchor.sourceName) as InstancedMesh;
      source.getMatrixAt(anchor.sourceIndex, sourceMatrix);
      expect(Math.abs(sourceMatrix.elements[12] + signature.width_m / 2)).toBeLessThan(.24);
      const bounds = new Box3().setFromBufferAttribute(source.geometry.getAttribute("position"));
      const shape = (source.geometry as ShapeGeometry).parameters.shapes;
      expect(Array.isArray(shape)).toBeFalse(); if (Array.isArray(shape)) throw new Error("Unexpected multiple opening shapes");
      const outer = shape ? shape.getPoints(64) : [new Vector2(bounds.min.x,bounds.min.y),new Vector2(bounds.max.x,bounds.min.y),new Vector2(bounds.max.x,bounds.max.y),new Vector2(bounds.min.x,bounds.max.y)];
      const holes = shape ? shape.holes.map(h => h.getPoints(64)) : [];
      for (let index = anchor.start; index < anchor.start + anchor.count; index++) {
        mesh.getMatrixAt(index, actual); local.multiplyMatrices(sourceMatrix.clone().invert(), actual);
        for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) {
          const p = new Vector3(x, y, z).applyMatrix4(local);
          expect(p.z).toBeGreaterThan(-.104); expect(p.z).toBeLessThan(-.066);
          expect(p.x).toBeGreaterThan(bounds.min.x); expect(p.x).toBeLessThan(bounds.max.x);
          expect(p.y).toBeGreaterThan(bounds.min.y); expect(p.y).toBeLessThan(bounds.max.y);
          expect(inside(new Vector2(p.x, p.y), outer)).toBeTrue();
          if (anchor.category.endsWith("joints")) for (const hole of holes) expect(inside(new Vector2(p.x, p.y), hole)).toBeFalse();
        }
      }
    }
  });

  test("each added cue is actually visible from the west and fits one small texture-free frozen batch", () => {
    const root = model(), detail = root.getObjectByName(REICHSTAG_PHOTO_FACADE_GROUP)!, mesh = detail.children[0] as InstancedMesh;
    root.updateMatrixWorld(true);
    const matrix = new Matrix4(), center = new Vector3(), ray = new Raycaster(); let visible = 0;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix); center.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);
      ray.set(new Vector3(-200, center.y, center.z), new Vector3(1, 0, 0));
      // Thin editorial linework has a generous Raycaster hit threshold and
      // cannot occlude a solid cue; use actual surfaces for visibility proof.
      const hit = ray.intersectObject(root, true).find(h => h.object instanceof Mesh);
      if (hit?.object === mesh) visible++;
    }
    expect(visible).toBe(mesh.count); expect(mesh.count).toBe(222); expect(detail.children).toHaveLength(1);
    expect(mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength).toBe(16872);
    let bytes = mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
    for (const a of Object.values(mesh.geometry.attributes)) bytes += a.array.byteLength;
    bytes += mesh.geometry.index!.array.byteLength;
    expect(bytes).toBe(17520); expect(bytes).toBeLessThan(20_000);
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined(); expect((mesh.material as { map?: unknown }).map).toBeFalsy();
    expect(mesh.matrixAutoUpdate).toBeFalse();
    for (const x of mesh.instanceMatrix.array) expect(Number.isFinite(x)).toBeTrue();
    expect(detail.userData.photoEvidenceId).toBe("reichstag-owner-photo-v285");
    expect(REICHSTAG_PHOTO_FACADE_PROFILE.photographicPixelsBundled).toBeFalse();
  });
});
