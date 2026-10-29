import {
  Box3, BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh,
  Matrix4, MeshStandardMaterial, Quaternion, Vector3,
} from "three";

export const REICHSTAG_PHOTO_FACADE_GROUP = "Reichstag photo-guided west glazing and arch joints";
export const REICHSTAG_PHOTO_FACADE_PROFILE = {
  photoEvidenceId: "reichstag-owner-photo-v285",
  geometryStatus: "Owner photograph guides unmeasured pane and stone-joint subdivisions; existing authored openings and the complete metric building remain unchanged",
  wingArchedOpeningCount: 10,
  wingUpperOpeningCount: 10,
  towerArcadeOpeningCount: 6,
  archJointAnglesDegrees: [15, 34, 53, 72, 108, 127, 146, 165],
  glazingBarWidthM: .045,
  outwardStandoffM: .085,
  referencePhotoCount: 1,
  photographicPixelsBundled: false,
} as const;

type Opening = { source: InstancedMesh; sourceIndex: number; matrix: Matrix4; bounds: Box3 };
type Anchor = { sourceName: string; sourceIndex: number; category: string; start: number; count: number };

/** Read the actual retained window buffers, rather than repeating a facade grid. */
function westOpenings(root: Group, name: string, widthM: number): Opening[] {
  const source = root.getObjectByName(name) as InstancedMesh | undefined;
  if (!source?.isInstancedMesh) return [];
  source.geometry.computeBoundingBox();
  const bounds = source.geometry.boundingBox!.clone();
  const result: Opening[] = [];
  for (let sourceIndex = 0; sourceIndex < source.count; sourceIndex++) {
    const matrix = new Matrix4(); source.getMatrixAt(sourceIndex, matrix);
    // All selected planes belong to the authored west envelope. Eastern,
    // lateral and inward tower openings remain completely untouched.
    if (Math.abs(matrix.elements[12] + widthM / 2) > .24) continue;
    result.push({ source, sourceIndex, matrix, bounds });
  }
  return result;
}

class DetailBatch {
  matrices: number[] = []; colors: number[] = []; anchors: Anchor[] = [];
  private local = new Matrix4(); private world = new Matrix4();
  private p = new Vector3(); private s = new Vector3(); private q = new Quaternion(); private c = new Color();
  box(opening: Opening, x: number, y: number, width: number, height: number, color: number, angle = 0): void {
    this.p.set(x, y, -REICHSTAG_PHOTO_FACADE_PROFILE.outwardStandoffM);
    this.s.set(width, height, .035); this.q.setFromAxisAngle(new Vector3(0, 0, 1), angle);
    this.local.compose(this.p, this.q, this.s); this.world.multiplyMatrices(opening.matrix, this.local);
    this.matrices.push(...this.world.elements); this.c.setHex(color).toArray(this.colors, this.colors.length);
  }
  anchor(opening: Opening, category: string, draw: () => void): void {
    const start = this.colors.length / 3; draw();
    this.anchors.push({ sourceName: opening.source.name, sourceIndex: opening.sourceIndex, category, start, count: this.colors.length / 3 - start });
  }
}

function glazing(batch: DetailBatch, opening: Opening, arched: boolean, existingCentreHeight = 0, hasExistingTransom = false): void {
  const b = opening.bounds, radius = (b.max.x - b.min.x) / 2;
  const bottom = b.min.y + .08, top = b.max.y - .08, spring = b.max.y - radius;
  const metal = 0x677372, bar = REICHSTAG_PHOTO_FACADE_PROFILE.glazingBarWidthM;
  // Continue the existing centre mullion at its ends; never duplicate it.
  if (existingCentreHeight > 0) {
    const edge = existingCentreHeight / 2;
    if (-edge > bottom) batch.box(opening, 0, (bottom - edge) / 2, bar, -edge - bottom, metal);
    if (top > edge) batch.box(opening, 0, (top + edge) / 2, bar, top - edge, metal);
  } else batch.box(opening, 0, (bottom + top) / 2, bar, top - bottom, metal);
  const rails = arched ? [bottom + (spring - bottom) * .40, spring] : [bottom + (top - bottom) * .34, bottom + (top - bottom) * .67];
  for (const y of rails) {
    // The old main-arch transom is at +0.85 m; retain its distinct register.
    if (hasExistingTransom && Math.abs(y - .85) < .15) continue;
    batch.box(opening, 0, y, radius * 2 - .16, bar, metal);
  }
}

function archJoints(batch: DetailBatch, opening: Opening): void {
  const b = opening.bounds, outer = (b.max.x - b.min.x) / 2, spring = b.max.y - outer;
  const inner = outer - .145, jointOuter = outer - .025, radius = (inner + jointOuter) / 2;
  for (const degrees of REICHSTAG_PHOTO_FACADE_PROFILE.archJointAnglesDegrees) {
    const angle = degrees * Math.PI / 180;
    // Short radial joints stay strictly inside the existing stone ring and
    // clear the preserved large crown keystone; no new arch solid is added.
    batch.box(opening, radius * Math.cos(angle), spring + radius * Math.sin(angle), .022, jointOuter - inner, 0x878174, angle - Math.PI / 2);
  }
}

/** Full drawn detail is shared by pointer and touch modes; no runtime media. */
export function appendReichstagPhotoFacade(root: Group, widthM: number): Group {
  const batch = new DetailBatch();
  for (const name of ["Reichstag dark tall arched facade windows", "Reichstag selectively lit tall arched facade windows"]) {
    for (const opening of westOpenings(root, name, widthM)) batch.anchor(opening, "wing-arched-glazing", () => glazing(batch, opening, true, 4.85, true));
  }
  for (const opening of westOpenings(root, "Reichstag dark upper rectangular facade windows", widthM)) batch.anchor(opening, "wing-upper-glazing", () => glazing(batch, opening, false));
  for (const opening of westOpenings(root, "Reichstag dark upper corner-tower windows", widthM)) batch.anchor(opening, "tower-arcade-glazing", () => glazing(batch, opening, true, 3.72));
  for (const opening of westOpenings(root, "Reichstag instanced tall arched-window stone reveals", widthM)) batch.anchor(opening, "wing-arch-joints", () => archJoints(batch, opening));
  for (const opening of westOpenings(root, "Reichstag instanced upper corner-tower window frames", widthM)) batch.anchor(opening, "tower-arch-joints", () => archJoints(batch, opening));
  const group = new Group(); group.name = REICHSTAG_PHOTO_FACADE_GROUP;
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const material = new MeshStandardMaterial({ color: 0xffffff, roughness: .74, metalness: .08 });
  material.userData.nightEmissive = 0x52616b; material.userData.nightEmissiveIntensity = .16;
  const mesh = new InstancedMesh(geometry, material, 0);
  mesh.instanceMatrix = new InstancedBufferAttribute(new Float32Array(batch.matrices), 16);
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(batch.colors), 3); mesh.count = batch.colors.length / 3;
  mesh.name = "Reichstag bounded glazing bars and arch joint batch";
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); group.add(mesh);
  group.userData = { textureFree: true, photographReferenceOnly: true, exactExistingOpeningAnchors: true, photoEvidenceId: REICHSTAG_PHOTO_FACADE_PROFILE.photoEvidenceId, profile: REICHSTAG_PHOTO_FACADE_PROFILE, openingAnchors: batch.anchors };
  root.add(group); return group;
}
