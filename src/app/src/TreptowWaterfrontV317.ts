/** Complete measured buildings and source-bound waterfront recognition. */
import {
  BufferAttribute, BufferGeometry, Group, InstancedMesh, InterleavedBufferAttribute, Material, Mesh,
  Object3D,
} from "three";
import source from "./data/treptowWaterfrontV317Core.json";
import {
  completePackedRootV307, createPackedRootV307, type RequiredPackedV307,
} from "./requiredPackedRootV307";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { interleaveStaticGeometry } from "./interleaveStaticGeometry";
import { staticStorageInfo } from "./losslessStaticStorage";
import { isSceneGeometryGpuRetirementV309 } from "./sceneGeometryGpuResidency";
import { isSceneInstanceGpuRetirementV309 } from "./sceneGpuResidency";
import {
  hasSchwellenraumMaterialProvenance, schwellenraumMaterialFor,
} from "./visual-modes/schwellenraum/materialGrade";
import { hasMinecraftMaterialProvenance } from "./visual-modes/minecraft/materialMode";

export { treptowWaterfrontV317Solids } from "./treptowWaterfrontV317Navigation";

type NativeRows = {
  key: string; native: true; origin: number[]; count: number;
  columns: string[]; tones: string; palette: number[];
};
type Facade = [number,number,number,number,number,number,number,number,number,number,number,number,number,string];
type Data = { schemaVersion: number; models: (RequiredPackedV307 | NativeRows)[]; facades: Facade[] };
type Attribute = BufferAttribute | InterleavedBufferAttribute;
type AttributePin = {
  attribute: Attribute; version: number; count: number; itemSize: number;
  normalized: boolean; storage: ReturnType<typeof staticStorageInfo>;
  backing: BufferAttribute | InterleavedBufferAttribute["data"];
  stride: number; offset: number;
};
type Member = {
  mesh: InstancedMesh; geometry: BufferGeometry; count: number; pose: number[];
  attributes: [string, AttributePin][]; index: AttributePin;
  matrix: AttributePin; colors: AttributePin; day: Material; night: Material; grade: Material;
};
type Receipt = {
  native: boolean; base?: Group; members: Member[]; pose: number[]; invalid: boolean;
};
const owner = Symbol("Complete Treptow waterfront v317");
const receipts = new WeakMap<Group, Receipt>();
function sourceControl(value: unknown): number {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i),16777619) >>> 0;
  return hash;
}
const pose = (o: Object3D): number[] => [
  ...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray(),
  ...o.matrix.elements, Number(o.matrixAutoUpdate), Number(o.matrixWorldAutoUpdate),
];
const samePose = (o: Object3D, expected: number[]): boolean =>
  pose(o).every((v, i) => Object.is(v, expected[i]));
const backing = (a: Attribute) => a instanceof InterleavedBufferAttribute ? a.data : a;
const stride = (a: Attribute) => a instanceof InterleavedBufferAttribute ? a.data.stride : a.itemSize;
const offset = (a: Attribute) => a instanceof InterleavedBufferAttribute ? a.offset : 0;
function pin(attribute: Attribute): AttributePin {
  return { attribute, version: backing(attribute).version, count: attribute.count,
    itemSize: attribute.itemSize, normalized: attribute.normalized,
    storage: staticStorageInfo(backing(attribute)), backing: backing(attribute),
    stride: stride(attribute), offset: offset(attribute) };
}
function matches(a: Attribute | undefined | null, p: AttributePin): boolean {
  if (!a || a !== p.attribute || backing(a) !== p.backing || p.backing.version !== p.version ||
    a.count !== p.count || a.itemSize !== p.itemSize || a.normalized !== p.normalized ||
    stride(a) !== p.stride || offset(a) !== p.offset) return false;
  const s = staticStorageInfo(p.backing);
  return s.arrayIdentity === p.storage.arrayIdentity && s.bufferIdentity === p.storage.bufferIdentity &&
    s.byteLength === p.storage.byteLength && s.bufferBytes === p.storage.bufferBytes;
}
function validMaterial(mesh: Mesh, day: Material, night: Material): boolean {
  const candidate = mesh.material;
  return !Array.isArray(candidate) && (candidate === day || candidate === night ||
    hasSchwellenraumMaterialProvenance(mesh, day, candidate) ||
    hasMinecraftMaterialProvenance(mesh, day, candidate) ||
    hasMinecraftMaterialProvenance(mesh, night, candidate));
}

/** Private complete construction, transforms and resource lifetime admit owners. */
export function hasCompleteTreptowWaterfrontV317(root: Group, native?: boolean): boolean {
  const r = receipts.get(root);
  return !!r && !r.invalid && root.visible && (native === undefined || native === r.native) &&
    samePose(root, r.pose) && root.children.length === r.members.length + (r.base ? 1 : 0) &&
    (!r.base || root.children[0] === r.base && r.base.parent === root &&
    completePackedRootV307(r.base, owner, r.native)) && r.members.every((p, i) =>
      root.children[i + (r.base ? 1 : 0)] === p.mesh && p.mesh.parent === root && p.mesh.visible &&
      p.mesh.geometry === p.geometry && p.mesh.count === p.count && samePose(p.mesh, p.pose) &&
      p.geometry.drawRange.start === 0 &&
      (p.geometry.drawRange.count === Infinity || p.geometry.drawRange.count === p.index.count) &&
      Object.keys(p.geometry.attributes).length === p.attributes.length &&
      p.attributes.every(([key, a]) => matches(p.geometry.getAttribute(key) as Attribute, a)) &&
      matches(p.geometry.index, p.index) && matches(p.mesh.instanceMatrix, p.matrix) &&
      matches(p.mesh.instanceColor, p.colors) && p.mesh.userData.dayMaterial === p.day &&
      p.mesh.userData.nightMaterial === p.night && p.mesh.userData.schwellenraumMaterial === p.grade &&
      validMaterial(p.mesh, p.day, p.night));
}

function nativeRows(q: NativeRows): number[][] {
  if (q.columns.length !== 6 || q.origin.length !== 3 || q.count <= 0) throw Error("Incomplete v317 native rows");
  const columns = q.columns.map(s => {
    const b = decodeBase64Bytes(s);
    if (b.byteLength !== q.count * 2) throw Error("Incomplete v317 native column");
    return new Uint16Array(b.buffer, b.byteOffset, q.count);
  });
  const tones = decodeBase64Bytes(q.tones);
  if (tones.length !== q.count || tones.some(t => t >= q.palette.length)) throw Error("Incomplete v317 native palette");
  return Array.from({ length: q.count }, (_, i) => [
    ...columns.map((c, field) => c[i] / 100 + (field < 3 ? q.origin[field] : 0)), q.palette[tones[i]],
  ]);
}

function facadeRows(recipes: Facade[], native: boolean): number[][] {
  const rows: number[][] = [];
  for (const [x,y0,z,dx,dz,nx,nz,uStep,yStart,yStep,w,h,tone,encoded] of recipes) {
    const bytes = decodeBase64Bytes(encoded);
    if (bytes.byteLength % 2) throw Error("Incomplete v317 facade slots");
    const slots = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    for (const slot of slots) {
      const u = 1.7 + (slot % 256) * uStep, y = yStart + Math.floor(slot / 256) * yStep;
      if (native) {
        for (let t = -w / 2; t < w / 2; t += .7) {
          rows.push([Math.round((x + dx * (u + t) + nx * .18) * 2) / 2, y,
            Math.round((z + dz * (u + t) + nz * .18) * 2) / 2, .5, h, .5, tone]);
        }
      } else {
        const yaw = Math.atan2(-dz, dx);
        rows.push([x + dx * u + nx * .09, y, z + dz * u + nz * .09, w, h, .035, yaw, tone]);
        rows.push([x + dx * u + nx * .11, y, z + dz * u + nz * .11, .09, h, .045, yaw, 0xB5BEC0]);
      }
    }
    // y0 is retained with the measured source wall plane for reproducibility.
    if (!Number.isFinite(y0)) throw Error("Invalid v317 wall datum");
  }
  return rows;
}

/** No source owner yields until all source bodies, deck and fittings are present. */
export function createTreptowWaterfrontV317(native = false): Group {
  const data = source as unknown as Data;
  if (data.schemaVersion !== 1 || data.models.length !== 6 || !data.facades.length ||
    sourceControl(data) !== 4251443003) throw Error("Incomplete v317 source inventory");
  const root = new Group();
  root.name = `Treptowers, Arena Berlin and Badeschiff v317${native ? " native" : ""}`;
  const receipt: Receipt = { native, members: [], pose: [], invalid: false };
  const resources = new Set<{ dispose(): void }>();
  const invalidate = (): void => { receipt.invalid = true; };
  try {
    const drawn = data.models.filter(q => !q.native) as RequiredPackedV307[];
    if (!native) {
      receipt.base = createPackedRootV307(owner, "Complete v317 source surfaces", false, drawn,
        { sourceLeaves: 80, sourceEvidence: "treptow-waterfront-v317-source.json.gz" });
      root.add(receipt.base);
    }
    const groups: [string, number[][]][] = native ?
      (data.models.filter(q => q.native) as NativeRows[]).map(q => [q.key, nativeRows(q)]) : [];
    groups.push(["Source-clipped windows and silver mullions", facadeRows(data.facades, native)]);
    for (const [name, rows] of groups) {
      const mesh = justicePalaceV183Boxes(rows, native);
      mesh.name = name;
      resources.add(mesh); resources.add(mesh.geometry);
      resources.add(mesh.userData.dayMaterial); resources.add(mesh.userData.nightMaterial);
      mesh.geometry.addEventListener("dispose", () => {
        if (!isSceneGeometryGpuRetirementV309(mesh.geometry)) invalidate();
      });
      mesh.addEventListener("dispose", () => {
        if (!isSceneInstanceGpuRetirementV309(mesh)) invalidate();
      });
      mesh.userData.dayMaterial.addEventListener("dispose", invalidate);
      mesh.userData.nightMaterial.addEventListener("dispose", invalidate);
      const grade = schwellenraumMaterialFor(mesh, mesh.userData.dayMaterial);
      resources.add(grade); grade.addEventListener("dispose", invalidate);
      root.add(mesh);
    }
    root.userData = { textureFree: true, fullStaticDetailOnTouch: true,
      nativeMinecraft: native, blockNative: native, keepInMinecraft: native,
      requiredCompleteReplacement: true, fittingDimensionsEstimated: true };
    // These new immutable stock-box streams receive their final mobile layout
    // before the private receipt. The later whole-world pass is idempotent.
    // The complete Uint16 source models retain their existing packed receipts.
    interleaveStaticGeometry(root);
    freezeStaticSceneTransforms(root);
    receipt.pose = pose(root);
    receipt.members = (root.children.slice(receipt.base ? 1 : 0) as InstancedMesh[]).map(mesh => ({
      mesh, geometry: mesh.geometry, count: mesh.count, pose: pose(mesh),
      attributes: Object.entries(mesh.geometry.attributes).map(([key, a]) => [key, pin(a as Attribute)]),
      index: pin(mesh.geometry.index!), matrix: pin(mesh.instanceMatrix), colors: pin(mesh.instanceColor!),
      day: mesh.userData.dayMaterial, night: mesh.userData.nightMaterial,
      grade: mesh.userData.schwellenraumMaterial,
    }));
    receipts.set(root, receipt);
    return root;
  } catch (error) {
    receipt.base?.traverse(o => {
      if (o instanceof Mesh) {
        resources.add(o.geometry);
        for (const m of [o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial]) if (m) resources.add(m);
      }
    });
    for (const r of resources) r.dispose();
    root.clear();
    throw error;
  }
}
