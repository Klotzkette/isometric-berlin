import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import data from "./data/neukoellnLandmarksV305Core.json";
import profile from "./data/neukoellnLandmarksV305Profile.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { staticStorageInfo } from "./losslessStaticStorage";
import { schwellenraumMaterialFor } from "./visual-modes/schwellenraum/materialGrade";
import type { Material } from "three";

export { neukoellnLandmarksV305Solids } from "./NeukoellnLandmarksV305Navigation";

type Packed = { positions: string; colors: string; indices: string };
type AttributeReceipt = { attribute: BufferAttribute; storage: ReturnType<typeof staticStorageInfo>; version:number; count: number; itemSize: number; normalized: boolean };
type MeshReceipt = { mesh: Mesh; geometry: BufferGeometry; attributes: Map<string, AttributeReceipt>; index: AttributeReceipt; day: MeshBasicMaterial; night: MeshStandardMaterial; grade:Material; instances?: { count: number; matrix: AttributeReceipt; color: AttributeReceipt } };
type Receipt = { native: boolean; children: MeshReceipt[] };
const complete = new WeakMap<Group, Receipt>();
function attributeReceipt(attribute: BufferAttribute): AttributeReceipt { return { attribute, storage:staticStorageInfo(attribute), version:attribute.version, count: attribute.count, itemSize: attribute.itemSize, normalized: attribute.normalized }; }
function matches(attribute: BufferAttribute | undefined | null, receipt: AttributeReceipt): boolean { if(!attribute||attribute!==receipt.attribute||attribute.version!==receipt.version||attribute.count!==receipt.count||attribute.itemSize!==receipt.itemSize||attribute.normalized!==receipt.normalized)return false;const info=staticStorageInfo(attribute);return info.arrayIdentity===receipt.storage.arrayIdentity&&info.bufferIdentity===receipt.storage.bufferIdentity&&info.byteLength===receipt.storage.byteLength&&info.bufferBytes===receipt.storage.bufferBytes; }
/** Private provenance and actual complete child/buffer/material identities. */
export function hasCompleteNeukoellnLandmarksV305(root: Group, native?: boolean): boolean {
  const receipt = complete.get(root);
  if (!receipt || !root.visible || native !== undefined && receipt.native !== native || root.children.length !== receipt.children.length) return false;
  return receipt.children.every((r, i) => root.children[i] === r.mesh && r.mesh.parent === root && r.mesh.geometry === r.geometry && r.mesh.visible && r.geometry.drawRange.start === 0 && (r.geometry.drawRange.count === Infinity || r.geometry.drawRange.count === r.index.count) &&
    Object.keys(r.geometry.attributes).length === r.attributes.size && [...r.attributes].every(([name, a]) => matches(r.geometry.getAttribute(name) as BufferAttribute, a)) && matches(r.geometry.index, r.index) &&
    (r.mesh.material === r.day || r.mesh.material === r.night || r.mesh.material===r.grade) && r.mesh.userData.dayMaterial === r.day && r.mesh.userData.nightMaterial === r.night && r.mesh.userData.schwellenraumMaterial===r.grade &&
    (!r.instances || r.mesh instanceof InstancedMesh && r.mesh.count === r.instances.count && matches(r.mesh.instanceMatrix, r.instances.matrix) && matches(r.mesh.instanceColor, r.instances.color)));
}
/** Complete official source sheets and independently cardinal native buildings.
 * No partially constructed group is published; every allocation is owned here. */
export function createNeukoellnLandmarksV305(native = false, _options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(), resources = new Set<{ dispose: () => void }>();
  root.name = `Neukölln Arcaden and Rathaus complete measured source v305${native ? " native" : ""}`;
  try {
    const source = data as unknown as { schemaVersion: number; drawn: Packed; fittings: number[][]; nativeBoxes: number[][]; counts: Record<string, number> };
    if (source.schemaVersion !== 1 || source.counts.sites !== profile.sites.length || !source.counts.sourceTriangles || !source.nativeBoxes.length || !source.fittings.length || source.counts.nativeTriangles !== source.nativeBoxes.length * 12 || source.counts.drawnTriangles !== source.counts.sourceTriangles + source.fittings.length * 12) throw Error("Incomplete Neukölln landmarks construction schema");
    const add = (geometry: BufferGeometry, name: string, rows?: number[][], luminous = false) => {
      const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }); resources.add(day);
      const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .92, flatShading: native, emissive: luminous ? 0xffd395 : 0, emissiveIntensity: luminous ? .38 : 0 }); resources.add(night);
      let mesh: Mesh;
      if (rows) {
        const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3), matrix = new Matrix4(), scale = new Vector3(), color = new Color();
        rows.forEach((row, i) => {
          const [x, y, z, w, h, d, angle, tone] = row;
          if (row.length !== 8 || !row.every(Number.isFinite) || Math.min(w, h, d) <= 0 || native && angle !== 0) throw Error("Invalid independent Neukölln landmarks member");
          matrix.makeRotationY(angle).scale(scale.set(w, h, d)).setPosition(x, y, z); matrix.toArray(matrices, i * 16); color.setHex(tone).toArray(colors, i * 3);
        });
        const instances = new InstancedMesh(geometry, day, 0); resources.add(instances); instances.count = rows.length;
        instances.instanceMatrix = new InstancedBufferAttribute(matrices, 16); instances.instanceColor = new InstancedBufferAttribute(colors, 3); instances.computeBoundingBox(); instances.computeBoundingSphere(); mesh = instances;
      } else mesh = new Mesh(geometry, day);
      mesh.name = name; mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, fullStaticDetailOnTouch: true, nativeMinecraft: native, blockNative: native, keepInMinecraft: native, sourceSheetsRetained: true }; resources.add(schwellenraumMaterialFor(mesh,day));root.add(mesh);
    };
    if (!native) {
      const raw = decodeBase64Bytes(source.drawn.positions), colors = decodeBase64Bytes(source.drawn.colors), bytes = decodeBase64Bytes(source.drawn.indices);
      if (raw.byteLength % 12 || colors.byteLength !== raw.byteLength / 4 || bytes.byteLength % 12) throw Error("Invalid complete Neukölln landmarks source arrays");
      const positions = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4), indices = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      if (indices.length !== source.counts.sourceTriangles * 3 || !positions.length || positions.some(v => !Number.isFinite(v)) || indices.some(i => i >= positions.length / 3)) throw Error("Invalid complete Neukölln landmarks source geometry");
      const geometry = new BufferGeometry(); resources.add(geometry); geometry.setAttribute("position", new BufferAttribute(positions, 3)); geometry.setAttribute("color", new BufferAttribute(colors, 3, true)); geometry.setIndex(new BufferAttribute(indices, 1)); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      add(geometry, "Complete official Neukölln landmarks wall and roof sheets with all courtyard holes");
    }
    const geometry = new BoxGeometry(1, 1, 1); resources.add(geometry); geometry.deleteAttribute("uv");
    // One shared face-lighting primitive keeps the complete instance geometry
    // legible by day; source-neutral house tones still multiply every member.
    const normals = geometry.getAttribute("normal"), shades = new Uint8Array(normals.count * 3);
    for (let i = 0; i < normals.count; i++) { const shade = normals.getY(i) > .5 ? 255 : normals.getY(i) < -.5 ? 170 : normals.getX(i) > .5 ? 211 : normals.getX(i) < -.5 ? 187 : normals.getZ(i) > .5 ? 234 : 201; shades.fill(shade, i * 3, i * 3 + 3); }
    geometry.setAttribute("color", new BufferAttribute(shades, 3, true));
    const ordinary: number[][] = [], luminous: number[][] = [];
    for (const row of native ? source.nativeBoxes : source.fittings) {
      const hash = (Math.imul(Math.round(row[0] * 10), 73856093) ^ Math.imul(Math.round(row[1] * 10), 19349663) ^ Math.imul(Math.round(row[2] * 10), 83492791)) >>> 0;
      (row[7] === 0x526263 && hash % 100 < 38 ? luminous : ordinary).push(row);
    }
    add(geometry, native ? "Independent cardinal Neukölln landmarks source body roofs and full facade members" : "Measured-wall-clipped individual Neukölln landmarks facade members", ordinary);
    if (luminous.length) add(geometry, "Same complete window members with estimated warm night occupancy", luminous, true);
    if (root.children.length !== (native ? 1 : 2) + (luminous.length ? 1 : 0)) throw Error("A complete Neukölln landmarks child was not attached");
    root.userData = { neukoellnLandmarksV305: true, requiredCompleteReplacement: true, fullStaticDetailOnTouch: true, sourceSheetsRetained: true, sourceXZPreserved: true, textureFree: true, nativeMinecraft: native, blockNative: native, keepInMinecraft: native, sourceReceipt: "neukoelln-landmarks-v305-source.json.gz", houseCount: profile.sites.length, referenceOnly: true, fittingDimensionsEstimated: true };
    freezeStaticSceneTransforms(root);
    complete.set(root, { native, children: (root.children as Mesh[]).map(mesh => ({ mesh, geometry: mesh.geometry, attributes: new Map(Object.entries(mesh.geometry.attributes).map(([k, a]) => [k, attributeReceipt(a as BufferAttribute)])), index: attributeReceipt(mesh.geometry.index!), day: mesh.userData.dayMaterial, night: mesh.userData.nightMaterial, grade:mesh.userData.schwellenraumMaterial, instances: mesh instanceof InstancedMesh ? { count: mesh.count, matrix: attributeReceipt(mesh.instanceMatrix), color: attributeReceipt(mesh.instanceColor!) } : undefined })) });
    return root;
  } catch (error) { complete.delete(root); for (const resource of resources) resource.dispose(); root.clear(); throw error; }
}
