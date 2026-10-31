import { BoxGeometry, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import owners from "./data/chancelleryPhotoV287Owners.json";
import { appendChancelleryPhotoV287, CHANCELLERY_NATIVE_FACES_V287, CHANCELLERY_PHOTO_V287, type ChancelleryPhotoPartsV287, type ChancelleryPhotoReceiptV287, type ChancelleryPhotoSignatureV287 } from "./ChancelleryPhotoV287";

type Row = { matrix: number[]; color: number[] | null };
type Transfer = { mesh: InstancedMesh; indices: number[]; whole: boolean };
const matrix = new Matrix4(), quaternion = new Quaternion(), axis = new Vector3(0, 1, 0);
const completeNativeReceipts = new WeakSet<object>();

/** The receipt is admitted only after every native member reached the host's
 * private construction buffers. A forged count cannot retire an old owner. */
export function appendChancelleryPhotoNativeOwnedV287(parts: ChancelleryPhotoPartsV287, signature: unknown): ChancelleryPhotoReceiptV287 | undefined {
  if (!parts.native || !admitsChancelleryPhotoSignatureV287(signature)) return undefined;
  const pending: Parameters<ChancelleryPhotoPartsV287["box"]>[] = [];
  const receipt = appendChancelleryPhotoV287({ native: true, box(...args) { pending.push(args); } }, signature);
  if (receipt.count !== 1811 || pending.length !== receipt.count) throw new Error("Incomplete native Chancellery photo family");
  for (const args of pending) parts.box(...args);
  Object.freeze(receipt); completeNativeReceipts.add(receipt);
  return receipt;
}

/** JSON source geometry is compared through data descriptors before it is read.
 * Recognition metadata at the top level is not a geometry owner. */
function sameData(actual: unknown, expected: unknown, top = false): boolean {
  if (expected === null || typeof expected !== "object") return actual === expected;
  if (!actual || typeof actual !== "object" || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const descriptors = Object.getOwnPropertyDescriptors(actual);
  const keys = Object.keys(expected);
  if (!top && Reflect.ownKeys(descriptors).length !== Reflect.ownKeys(expected).length) return false;
  return keys.every(key => {
    const d = descriptors[key];
    return !!d?.enumerable && "value" in d && sameData(d.value, (expected as Record<string, unknown>)[key]);
  }) && (!Array.isArray(expected) || (descriptors.length && "value" in descriptors.length && descriptors.length.value === expected.length));
}
export function admitsChancelleryPhotoSignatureV287(signature: unknown): signature is ChancelleryPhotoSignatureV287 {
  try { return sameData(signature, owners.sourceSignature, true); } catch { return false; }
}
function arraysEqual(actual: ArrayLike<number>, expected: ArrayLike<number>): boolean {
  return actual.length === expected.length && Array.from(expected).every((v, i) => actual[i] === v);
}
function ordinaryTransform(mesh: InstancedMesh): boolean {
  return mesh.position.equals(new Vector3()) && mesh.quaternion.equals(new Quaternion()) && mesh.scale.equals(new Vector3(1, 1, 1)) && mesh.matrix.equals(new Matrix4());
}
function materialMatches(material: MeshStandardMaterial, recipe: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(recipe)) {
    if (key === "emissive") { if (material.emissive.getHex() !== value) return false; }
    else if (key === "color") { if (material.color.getHex() !== value) return false; }
    else if (key === "userData") { if (!sameData(material.userData, value)) return false; }
    else if ((material as unknown as Record<string, unknown>)[key] !== value) return false;
  }
  return ["map", "normalMap", "alphaMap", "aoMap", "bumpMap", "displacementMap", "emissiveMap", "lightMap", "metalnessMap", "roughnessMap"].every(key => (material as unknown as Record<string, unknown>)[key] == null);
}
function cubeMatches(mesh: InstancedMesh, parameters: Record<string, number>): boolean {
  if (!(mesh.geometry instanceof BoxGeometry) || !sameData(mesh.geometry.parameters, parameters)) return false;
  const expected = new BoxGeometry(parameters.width, parameters.height, parameters.depth, parameters.widthSegments, parameters.heightSegments, parameters.depthSegments);
  try {
    for (const key of ["position", "normal", "uv"]) {
      const a = mesh.geometry.getAttribute(key), b = expected.getAttribute(key);
      if (!a || !arraysEqual(a.array, b.array)) return false;
    }
    return !!mesh.geometry.index && !!expected.index && arraysEqual(mesh.geometry.index.array, expected.index.array);
  } finally { expected.dispose(); }
}
function matchingIndices(mesh: InstancedMesh, rows: readonly Row[]): number[] | null {
  const indices: number[] = [];
  for (const row of rows) {
    const matches: number[] = [];
    for (let i = 0; i < mesh.count; i++) {
      if (!arraysEqual((mesh.instanceMatrix.array as Float32Array).subarray(i * 16, i * 16 + 16), row.matrix)) continue;
      if (row.color ? !mesh.instanceColor || !arraysEqual((mesh.instanceColor.array as Float32Array).subarray(i * 3, i * 3 + 3), row.color) : !!mesh.instanceColor) continue;
      matches.push(i);
    }
    if (matches.length !== 1 || indices.includes(matches[0])) return null;
    indices.push(matches[0]);
  }
  return indices;
}
function drawnTransfers(root: Group): Transfer[] | null {
  const transfers: Transfer[] = [];
  for (const receipt of owners.drawn) {
    if (root.getObjectsByProperty("name", receipt.name).length !== 1) return null;
    const candidates: Transfer[] = [];
    root.traverse(o => {
      if (!(o instanceof InstancedMesh) || o.parent !== root || o.name !== receipt.name || !ordinaryTransform(o) || !cubeMatches(o, receipt.parameters)) return;
      const material = o.material;
      if (Array.isArray(material) || !(material instanceof MeshStandardMaterial) || material.color.getHex() !== receipt.color || !materialMatches(material, receipt.material) || (receipt.whole && o.children.length)) return;
      const indices = matchingIndices(o, receipt.owners);
      if (indices && (!receipt.whole || o.count === receipt.count)) candidates.push({ mesh: o, indices, whole: receipt.whole });
    });
    if (candidates.length !== 1) return null;
    transfers.push(candidates[0]);
  }
  return transfers;
}
function prepareInstances(mesh: InstancedMesh, removed: readonly number[], append: readonly Row[] = []) {
  const excluded = new Set(removed), matrices: number[] = [], colors: number[] = [];
  for (let i = 0; i < mesh.count; i++) if (!excluded.has(i)) {
    matrices.push(...(mesh.instanceMatrix.array as Float32Array).subarray(i * 16, i * 16 + 16));
    if (mesh.instanceColor) colors.push(...(mesh.instanceColor.array as Float32Array).subarray(i * 3, i * 3 + 3));
  }
  for (const row of append) { matrices.push(...row.matrix); if (row.color) colors.push(...row.color); }
  const preview = new InstancedMesh(mesh.geometry, mesh.material, 0);
  preview.instanceMatrix = new InstancedBufferAttribute(new Float32Array(matrices), 16);
  if (mesh.instanceColor) preview.instanceColor = new InstancedBufferAttribute(new Float32Array(colors), 3);
  preview.count = matrices.length / 16;
  preview.computeBoundingBox(); preview.computeBoundingSphere();
  return { mesh, preview };
}
function commitInstances({ mesh, preview }: ReturnType<typeof prepareInstances>): void {
  mesh.instanceMatrix = preview.instanceMatrix; mesh.instanceColor = preview.instanceColor;
  mesh.count = preview.count; mesh.boundingBox = preview.boundingBox; mesh.boundingSphere = preview.boundingSphere;
}

/** Complete new opaque and transparent batches are constructed before any exact
 * authored ivy, louvre or local winter-garden instance yields. */
export function applyChancelleryPhotoDrawnV287(root: Group, signature: unknown): boolean {
  if (!admitsChancelleryPhotoSignatureV287(signature)) return false;
  const transfers = drawnTransfers(root); if (!transfers) return false;
  const batches = [{ matrices: [] as number[], colors: [] as number[] }, { matrices: [] as number[], colors: [] as number[] }];
  const meshes: InstancedMesh[] = [];
  let receipt: ReturnType<typeof appendChancelleryPhotoV287>;
  let prepared: ReturnType<typeof prepareInstances>[];
  const yaw = signature.rotation_y_degrees * Math.PI / 180;
  const inverse = new Matrix4().compose(new Vector3(...signature.anchor_world as [number, number, number]), new Quaternion().setFromAxisAngle(axis, yaw), new Vector3(1, 1, 1)).invert();
  try {
    receipt = appendChancelleryPhotoV287({ native: false, box(position, size, tint, heading = 0) {
      const batch = batches[tint === CHANCELLERY_PHOTO_V287.tint.glazing ? 1 : 0];
      matrix.compose(new Vector3(...position), quaternion.setFromAxisAngle(axis, heading), new Vector3(...size)).premultiply(inverse).toArray(batch.matrices, batch.matrices.length);
      new Color(tint).toArray(batch.colors, batch.colors.length);
    } }, signature);
    if (receipt.count !== 1838 || batches[1].colors.length / 3 !== 16) throw new Error("Incomplete Chancellery photo batch");
    for (const [i, batch] of batches.entries()) {
      const geometry = new BoxGeometry(); geometry.deleteAttribute("uv");
      const day = i ? new MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .28, depthWrite: false, roughness: .24, metalness: .04, transmission: .12, side: DoubleSide }) : new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide });
      const night = i ? day.clone() : new MeshStandardMaterial({ color: 0xffffff, side: DoubleSide, roughness: .94 });
      const mesh = new InstancedMesh(geometry, day, 0); meshes.push(mesh);
      mesh.count = batch.colors.length / 3;
      mesh.instanceMatrix = new InstancedBufferAttribute(new Float32Array(batch.matrices), 16);
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(batch.colors), 3);
      mesh.name = i ? "Chancellery photo v287 clear louvre glazing" : "Chancellery photo v287 green climbing cover and Ehrenhof faces";
      mesh.userData = { dayMaterial: day, nightMaterial: night, fullStaticDetailOnTouch: true, textureFree: true, sourceGeometryRetained: true };
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    }
    prepared = transfers.filter(t => !t.whole).map(t => prepareInstances(t.mesh, t.indices));
  } catch {
    for (const mesh of meshes) { mesh.removeFromParent(); mesh.geometry.dispose(); for (const material of [mesh.userData.dayMaterial, mesh.userData.nightMaterial]) material?.dispose(); }
    return false;
  }
  // Every replacement buffer/bound was prepared without changing the host.
  root.add(...meshes);
  for (const item of prepared) commitInstances(item);
  for (const transfer of transfers) if (transfer.whole) {
    transfer.mesh.removeFromParent(); transfer.mesh.geometry.dispose(); (transfer.mesh.material as MeshStandardMaterial).dispose();
  }
  root.userData.chancelleryPhotoV287 = { ...receipt, retiredIvy: 40, retiredLouvres: 8, retiredLocalLoggiaInstances: 4, sourceGeometryRetained: true };
  return true;
}

function nativeTransfer(root: Group): Transfer | null {
  if (root.getObjectsByProperty("name", owners.native.name).length !== 1) return null;
  const candidates: Transfer[] = [];
  root.traverse(o => {
    if (!(o instanceof InstancedMesh) || o.parent !== root || o.name !== owners.native.name || !ordinaryTransform(o)) return;
    if (Array.isArray(o.material) || !(o.material instanceof MeshStandardMaterial) || !materialMatches(o.material, owners.native.material)) return;
    if (!cubeMatches(o, { width: 1, height: 1, depth: 1, widthSegments: 1, heightSegments: 1, depthSegments: 1 })) return;
    const indices = matchingIndices(o, owners.native.owners);
    const supports = matchingIndices(o, CHANCELLERY_NATIVE_FACES_V287.frontPylons.flatMap(pylon => pylon.owners));
    if (indices && supports && supports.every(i => !indices.includes(i))) candidates.push({ mesh: o, indices, whole: false });
  });
  return candidates.length === 1 ? candidates[0] : null;
}
export function admitsChancelleryPhotoNativeV287(root: Group): boolean { return nativeTransfer(root) !== null; }
/** Called only after the complete Hbf native face/foliage receipt exists in the
 * same staged world transaction. Four outside-boundary pane pieces survive. */
export function applyChancelleryPhotoNativeV287(root: Group, completeReceipt: { count?: number } | undefined): boolean {
  if (!completeReceipt || !completeNativeReceipts.has(completeReceipt) || completeReceipt.count !== 1811) return false;
  const transfer = nativeTransfer(root); if (!transfer) return false;
  const fragments = owners.native.owners.flatMap(row => row.retained ? [row.retained] : []);
  commitInstances(prepareInstances(transfer.mesh, transfer.indices, fragments));
  transfer.mesh.userData.chancelleryPhotoV287 = { retiredGenericPanes: 16, retainedOutsideBoundaryFragments: 4, retainedExactSupportMembers: 12, sourceGeometryRetained: true };
  return true;
}
