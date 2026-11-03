/** Complete hospital bodies and source-clipped, reference-guided recognition. */
import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, Vector3,
} from "three";
import type { Material } from "three";
import data from "./data/hospitalArchitectureV308Core.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { staticStorageInfo } from "./losslessStaticStorage";
import {isSceneGeometryGpuRetirementV309} from "./sceneGeometryGpuResidency";
import {isSceneInstanceGpuRetirementV309} from "./sceneGpuResidency";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { schwellenraumMaterialFor } from "./visual-modes/schwellenraum/materialGrade";
import {decodeHospitalRowsV308} from "./hospitalArchitectureV308Rows";
import type {HospitalRowsV308 as Rows} from "./hospitalArchitectureV308Rows";

type Packed = { positions: string; colors: string; indices: string };
type Site = {
  key: string; name: string; drawn?: Packed; fittings: Rows;
  nativeBoxes: Rows;
  counts: { sourceTriangles: number; fittings: number; nativeInstances: number };
};
type AttributeReceipt = {
  attribute: BufferAttribute; storage: ReturnType<typeof staticStorageInfo>;
  count: number; itemSize: number; normalized: boolean; version: number;
};
type MeshReceipt = {
  mesh: Mesh; geometry: BufferGeometry; attributes: Map<string, AttributeReceipt>;
  index: AttributeReceipt; day: Material; night: Material; grade: Material;
  instances?: { count: number; matrix: AttributeReceipt; color: AttributeReceipt };
  pose: number[];
};
const complete = new WeakMap<Group, { native: boolean; children: MeshReceipt[];pose:number[];invalid:boolean }>();
function pose(object:Object3D):number[]{return [...object.position.toArray(),...object.quaternion.toArray(),...object.scale.toArray(),...object.matrix.elements,Number(object.matrixAutoUpdate),Number(object.matrixWorldAutoUpdate)];}
function samePose(object:Object3D,expected:number[]){const current=pose(object);return current.length===expected.length&&current.every((v,i)=>Object.is(v,expected[i]));}

function attributeReceipt(attribute: BufferAttribute): AttributeReceipt {
  return { attribute, storage: staticStorageInfo(attribute), count: attribute.count,
    itemSize: attribute.itemSize, normalized: attribute.normalized,
    version: attribute.version };
}
function matches(attribute: BufferAttribute | null | undefined, receipt: AttributeReceipt): boolean {
  if (!attribute || attribute !== receipt.attribute || attribute.version !== receipt.version ||
    attribute.count !== receipt.count || attribute.itemSize !== receipt.itemSize ||
    attribute.normalized !== receipt.normalized) return false;
  const current = staticStorageInfo(attribute);
  return current.arrayIdentity === receipt.storage.arrayIdentity &&
    current.bufferIdentity === receipt.storage.bufferIdentity &&
    current.byteLength === receipt.storage.byteLength &&
    current.bufferBytes === receipt.storage.bufferBytes;
}

/** The full private constructor/buffer/material provenance survives legal GPU
 * parking. Public labels, partial children and cloned materials cannot admit it. */
export function hasCompleteHospitalArchitectureV308(root: Group, native?: boolean): boolean {
  const receipt = complete.get(root);
  if (!receipt || receipt.invalid || !samePose(root,receipt.pose) || !root.visible || native !== undefined && receipt.native !== native ||
    root.children.length !== receipt.children.length) return false;
  return receipt.children.every((r, i) => root.children[i] === r.mesh &&
    r.mesh.parent === root && samePose(r.mesh,r.pose) && r.mesh.geometry === r.geometry && r.mesh.visible &&
    r.geometry.drawRange.start === 0 &&
    (r.geometry.drawRange.count === Infinity || r.geometry.drawRange.count === r.index.count) &&
    Object.keys(r.geometry.attributes).length === r.attributes.size &&
    [...r.attributes].every(([key, pin]) => matches(r.geometry.getAttribute(key) as BufferAttribute, pin)) &&
    matches(r.geometry.index, r.index) &&
    (r.mesh.material === r.day || r.mesh.material === r.night || r.mesh.material === r.grade) &&
    r.mesh.userData.dayMaterial === r.day && r.mesh.userData.nightMaterial === r.night &&
    r.mesh.userData.schwellenraumMaterial === r.grade &&
    (!r.instances || r.mesh instanceof InstancedMesh && r.mesh.count === r.instances.count &&
      matches(r.mesh.instanceMatrix, r.instances.matrix) &&
      matches(r.mesh.instanceColor, r.instances.color)));
}

/** Every campus receives separate finite culling bounds and complete geometry
 * on touch and pointer devices. Construction owns all allocations until return. */
export function createHospitalArchitectureV308(
  native = false, _options: { mobileLike?: boolean } = {},
): Group {
  const root = new Group();
  const resources = new Set<{ dispose(): void }>();
  root.name = `Complete hospital architecture v308${native ? " native" : ""}`;
  try {
    const source = data as unknown as { schemaVersion: number; sites: Site[] };
    const sites = source.sites;
    if (source.schemaVersion !== 1 || sites.length !== 4 ||
      new Set(sites.map(s => s.key)).size !== sites.length) {
      throw Error("Incomplete hospital v308 construction schema");
    }
    const primitive = new BoxGeometry(1, 1, 1);
    resources.add(primitive);
    primitive.deleteAttribute("uv");
    const normals = primitive.getAttribute("normal");
    const shades = new Uint8Array(normals.count * 3);
    for (let i = 0; i < normals.count; i++) {
      const tone = normals.getY(i) > .5 ? 255 : normals.getY(i) < -.5 ? 170 :
        normals.getX(i) > .5 ? 211 : normals.getX(i) < -.5 ? 187 :
        normals.getZ(i) > .5 ? 234 : 201;
      shades.fill(tone, i * 3, i * 3 + 3);
    }
    primitive.setAttribute("color", new BufferAttribute(shades, 3, true));
    const add = (site: Site, geometry: BufferGeometry, label: string, rows?: Rows) => {
      const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
      const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide,
        roughness: .91, flatShading: native });
      resources.add(day); resources.add(night);
      let mesh: Mesh;
      if (rows) {
        const columns = decodeHospitalRowsV308(rows);
        const matrices = new Float32Array(rows.count * 16);
        const colors = new Float32Array(rows.count * 3);
        const matrix = new Matrix4(), scale = new Vector3(), color = new Color();
        for (let i = 0; i < rows.count; i++) {
          const x=columns[0][i],y=columns[1][i],z=columns[2][i],w=columns[3][i],
            h=columns[4][i],d=columns[5][i],yaw=columns[6][i],tone=columns[7][i];
          if (Math.min(w, h, d) <= 0 || !Number.isSafeInteger(tone) ||
            tone<0||tone>0xffffff||native && yaw !== 0) {
            throw Error("Invalid independent hospital v308 member");
          }
          matrix.makeRotationY(yaw).scale(scale.set(w, h, d)).setPosition(x, y, z);
          matrix.toArray(matrices, i * 16); color.setHex(tone).toArray(colors, i * 3);
        }
        const instances = new InstancedMesh(geometry, day, 0);
        resources.add(instances);
        instances.count = rows.count;
        instances.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
        instances.instanceColor = new InstancedBufferAttribute(colors, 3);
        instances.computeBoundingBox(); instances.computeBoundingSphere();
        mesh = instances;
      } else mesh = new Mesh(geometry, day);
      mesh.name = `${site.name}: ${label}`;
      mesh.userData = { siteKey: site.key, hospitalArchitectureV308: true,
        dayMaterial: day, nightMaterial: night, textureFree: true,
        fullStaticDetailOnTouch: true, nativeMinecraft: native, blockNative: native,
        keepInMinecraft: native, sourceSheetsRetained: true };
      resources.add(schwellenraumMaterialFor(mesh, day));
      root.add(mesh);
    };
    let sourceCount = 0;
    for (const site of sites) {
      if (!site.fittings.count || site.counts.fittings !== site.fittings.count ||
        site.counts.nativeInstances !== site.nativeBoxes.count) {
        throw Error("Incomplete hospital v308 campus fittings");
      }
      if (site.drawn) {
        sourceCount++;
        if (!native) {
        const p = decodeBase64Bytes(site.drawn.positions);
        const c = decodeBase64Bytes(site.drawn.colors);
        const ix = decodeBase64Bytes(site.drawn.indices);
        if (p.byteLength % 12 || c.byteLength !== p.byteLength / 4 || ix.byteLength % 12) {
          throw Error("Invalid complete hospital v308 source arrays");
        }
        const positions = new Float32Array(p.buffer, p.byteOffset, p.byteLength / 4);
        const indices = new Uint32Array(ix.buffer, ix.byteOffset, ix.byteLength / 4);
        if (indices.length !== site.counts.sourceTriangles * 3 || !positions.length ||
          positions.some(x => !Number.isFinite(x)) ||
          indices.some(x => x >= positions.length / 3)) {
          throw Error("Invalid complete hospital v308 source geometry");
        }
          const geometry = new BufferGeometry(); resources.add(geometry);
          geometry.setAttribute("position", new BufferAttribute(positions, 3));
          geometry.setAttribute("color", new BufferAttribute(c, 3, true));
          geometry.setIndex(new BufferAttribute(indices, 1));
          geometry.computeVertexNormals(); geometry.computeBoundingBox();
          geometry.computeBoundingSphere();
          add(site, geometry, "complete source sheets and exact outside complements");
        }
      } else if (site.counts.sourceTriangles !== 0) {
        throw Error("Hospital v308 source model missing");
      }
      add(site, primitive, native ? "independent cardinal body, roofs and fittings" :
        "source-clipped architectural fittings", native ? site.nativeBoxes : site.fittings);
    }
    if (sourceCount !== 2 || root.children.length !== (native ? 4 : 6)) {
      throw Error("Complete hospital v308 children were not attached");
    }
    root.userData = { hospitalArchitectureV308: true, requiredCompleteReplacement: true,
      textureFree: true, fullStaticDetailOnTouch: true, nativeMinecraft: native,
      blockNative: native, keepInMinecraft: native, sourceXZPreserved: true,
      sourceSheetsRetained: true, sourceReceipt: "hospitals-v308-source.json.gz",
      fittingDimensionsEstimated: true, timerFree: true };
    freezeStaticSceneTransforms(root);
    const receipt={ native,pose:pose(root),invalid:false, children: (root.children as Mesh[]).map(mesh => ({
      mesh, geometry: mesh.geometry,
      attributes: new Map(Object.entries(mesh.geometry.attributes)
        .map(([key, attribute]) => [key, attributeReceipt(attribute as BufferAttribute)])),
      index: attributeReceipt(mesh.geometry.index!), day: mesh.userData.dayMaterial,
      night: mesh.userData.nightMaterial, grade: mesh.userData.schwellenraumMaterial,
      instances: mesh instanceof InstancedMesh ? { count: mesh.count,
        matrix: attributeReceipt(mesh.instanceMatrix),
        color: attributeReceipt(mesh.instanceColor!) } : undefined,pose:pose(mesh),
    })) };
    for(const resource of resources)if("addEventListener"in resource){
      const invalidate=()=>{
        if(resource instanceof BufferGeometry&&isSceneGeometryGpuRetirementV309(resource))return;
        if(resource instanceof InstancedMesh&&isSceneInstanceGpuRetirementV309(resource))return;
        receipt.invalid=true;
      };
      (resource as unknown as {addEventListener(type:"dispose",listener:()=>void):void}).addEventListener("dispose",invalidate);
    }
    complete.set(root,receipt);
    return root;
  } catch (error) {
    complete.delete(root);
    for (const resource of resources) resource.dispose();
    root.clear();
    throw error;
  }
}
