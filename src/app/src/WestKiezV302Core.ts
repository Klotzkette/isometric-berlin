import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import data from "./data/westKiezV302Core.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { releaseScratchBuffer } from "./releaseScratchBuffer";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export { westKiezV302Solids } from "./WestKiezV302CoreNavigation";
export {
  WEST_KIEZ_V302_CORE_IDS, admitsWestKiezV302Core, admitsWestKiezV302Native,
  isWestKiezV302OldCore, isWestKiezV302OldNativeColumn,
} from "./WestKiezV302CoreOwnership";

type Site = {
  parent: string; addresses: string[]; origin: number[];
  drawn: { positions: string; colors: string; indices: string };
  nativeRows: number[][]; fittings: number[][]; nativeFittings: number[][];
};
type Proof = { native: boolean; children: (Mesh | InstancedMesh)[]; geometries: BufferGeometry[];
  counts: number[]; vertices: number[]; indices: number[]; materials: object[] };
const source = data as unknown as { schemaVersion: number; sites: Site[] };
const completed = new WeakMap<Group, Proof>();

/** Private provenance plus actual complete buffers, rather than a public flag. */
export function hasCompleteWestKiezV302Core(root: Group, native?: boolean): boolean {
  const proof = completed.get(root);
  if (!proof || native !== undefined && native !== proof.native || root.children.length !== proof.children.length) return false;
  return proof.children.every((mesh, i) => root.children[i] === mesh && mesh.parent === root &&
    mesh.geometry === proof.geometries[i] && mesh.geometry.getAttribute("position")?.count === proof.vertices[i] &&
    mesh.geometry.index?.count === proof.indices[i] && mesh.userData.dayMaterial === proof.materials[i * 2] &&
    mesh.userData.nightMaterial === proof.materials[i * 2 + 1] &&
    (!(mesh instanceof InstancedMesh) || mesh.count === proof.counts[i] && mesh.instanceMatrix.count === mesh.count &&
      mesh.instanceColor?.count === mesh.count && mesh.instanceMatrix.array.byteLength === mesh.count * 64 &&
      mesh.instanceColor.array.byteLength === mesh.count * 12 && !mesh.geometry.getAttribute("uv")));
}

/** Complete official walls, articulated roofs and court voids for the exact
 * previously false OSM owners. Touch receives identical full static geometry. */
export function createWestKiezV302Core(native = false, options: { mobileLike?: boolean } = {}): Group {
  const root = new Group();
  root.name = `Complete source-bound West Kiez houses v302${native ? " native" : ""}`;
  let success = false;
  const allocatedGeometries: BufferGeometry[] = [], allocatedMaterials: (MeshBasicMaterial | MeshStandardMaterial)[] = [];
  try {
    const sites = source.sites;
    if (source.schemaVersion !== 1 || sites.length !== 15) throw new Error("Incomplete West Kiez source family");
    if (!native) {
      const vertexCount = sites.reduce((n, site) => n + atob(site.drawn.positions).length / 12, 0);
      const indexCount = sites.reduce((n, site) => n + atob(site.drawn.indices).length / 4, 0);
      const positions = new Float32Array(vertexCount * 3), colors = new Uint8Array(vertexCount * 3), indices = new Uint32Array(indexCount);
      let vertex = 0, index = 0;
      for (const site of sites) {
        const pb = decodeBase64Bytes(site.drawn.positions), cb = decodeBase64Bytes(site.drawn.colors), ib = decodeBase64Bytes(site.drawn.indices);
        try {
          const p = new Float32Array(pb.buffer, pb.byteOffset, pb.byteLength / 4), ix = new Uint32Array(ib.buffer, ib.byteOffset, ib.byteLength / 4);
          if (p.length !== cb.length || p.length % 3 || ix.some(v => v >= p.length / 3)) throw new Error("Invalid West Kiez complete source sheets");
          for (let i = 0; i < p.length; i += 3) for (let axis = 0; axis < 3; axis++) positions[vertex * 3 + i + axis] = p[i + axis] + site.origin[axis];
          colors.set(cb, vertex * 3);
          for (const v of ix) indices[index++] = vertex + v;
          vertex += p.length / 3;
        } finally { releaseScratchBuffer(pb.buffer); releaseScratchBuffer(cb.buffer); releaseScratchBuffer(ib.buffer); }
      }
      const geometry = new BufferGeometry(); allocatedGeometries.push(geometry);
      geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new BufferAttribute(colors, 3, true)); geometry.setIndex(new BufferAttribute(indices, 1));
      geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }), night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .86 });
      allocatedMaterials.push(day, night);
      const mesh = new Mesh(geometry, day); mesh.name = "All 89 complete official West Kiez wall and roof parts";
      mesh.userData = { dayMaterial: day, nightMaterial: night, fullMeasuredSheets: true, textureFree: true };
      root.add(mesh);
    }
    const ordinary: number[][] = [], luminous: number[][] = [];
    for (const site of sites) for (const row of native ? [...site.nativeRows, ...site.nativeFittings] : site.fittings) {
      const tint = row[native ? 6 : 7];
      const hash = (Math.imul(Math.round(row[0] * 10), 73856093) ^ Math.imul(Math.round(row[1] * 10), 19349663) ^ Math.imul(Math.round(row[2] * 10), 83492791)) >>> 0;
      ((tint === 0x688187 || tint === 0x526D74) && hash % 100 < 38 ? luminous : ordinary).push(row);
    }
    const primitive = new BoxGeometry(1, 1, 1); primitive.deleteAttribute("uv"); allocatedGeometries.push(primitive);
    const normals = primitive.getAttribute("normal"), shades = new Uint8Array(normals.count * 3);
    for (let i = 0; i < normals.count; i++) {
      const shade = normals.getY(i) > .5 ? 255 : normals.getY(i) < -.5 ? 170 : normals.getX(i) > .5 ? 211 : normals.getX(i) < -.5 ? 187 : normals.getZ(i) > .5 ? 234 : 201;
      shades.fill(shade, i * 3, i * 3 + 3);
    }
    primitive.setAttribute("color", new BufferAttribute(shades, 3, true));
    for (const [rows, glowing] of [[ordinary, false], [luminous, true]] as const) {
      const count = rows.length;
      if (!count) continue;
      const matrices = new Float32Array(count * 16), colors = new Float32Array(count * 3);
      const matrix = new Matrix4(), scale = new Vector3(), color = new Color(); let index = 0;
      for (const row of rows) {
        const [x, y, z, w, h, d] = row;
        if (![x, y, z, w, h, d].every(Number.isFinite) || Math.min(w, h, d) <= 0) throw new Error("Invalid West Kiez compiled member");
        if (native) matrix.makeScale(w, h, d);
        else matrix.makeRotationY(row[6]).scale(scale.set(w, h, d));
        matrix.setPosition(x, y, z); matrix.toArray(matrices, index * 16);
        color.setHex(row[native ? 6 : 7]).toArray(colors, index * 3); index++;
      }
      const day = new MeshBasicMaterial({ vertexColors: true }), night = new MeshStandardMaterial({ vertexColors: true, roughness: .84,
        emissive: glowing ? 0xffd395 : 0, emissiveIntensity: glowing ? .38 : 0 }); allocatedMaterials.push(day, night);
      const mesh = new InstancedMesh(primitive, day, 0); mesh.count = count;
      mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      mesh.name = glowing ? "Existing West Kiez glazing with estimated warm night occupancy" : native ? "Independent cardinal source walls, roof sheets and West Kiez fittings" : "Source-clipped individual West Kiez facade fittings";
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native, nativeMinecraft: native, keepInMinecraft: native };
      root.add(mesh);
    }
    root.userData = { westKiezV302: true, requiredCompleteReplacement: true, sourceSheetsRetained: true,
      fullStaticDetailOnTouch: true, nativeMinecraft: native, blockNative: native, keepInMinecraft: native,
      sourceReceipt: "west-kiez-v302-core-source.json.gz", textureFree: true };
    const children = root.children as (Mesh | InstancedMesh)[];
    completed.set(root, { native, children: [...children], geometries: children.map(m => m.geometry),
      counts: children.map(m => m instanceof InstancedMesh ? m.count : 0), vertices: children.map(m => m.geometry.getAttribute("position").count),
      indices: children.map(m => m.geometry.index!.count), materials: children.flatMap(m => [m.userData.dayMaterial, m.userData.nightMaterial]) });
    success = true; void options;
    return freezeStaticSceneTransforms(root);
  } finally {
    if (!success) {
      completed.delete(root);
      root.traverse(object => { if (object instanceof InstancedMesh) object.dispose(); }); root.clear();
      for (const geometry of allocatedGeometries) geometry.dispose();
      for (const material of allocatedMaterials) material.dispose();
    }
  }
}
