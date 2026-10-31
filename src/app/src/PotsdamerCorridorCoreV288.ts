import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3,
} from "three";
import data from "./data/potsdamerCorridorCoreV288.json";
import profile from "./data/potsdamerCorridorV288Profile.json";
import { buildingTerrainOffset } from "./weinbergTerrainV176";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Site = {
  key: string; parent: string; origin: number[]; sourceGround: number; anchor: number[];
  drawn: { positions: string; colors: string; indices: string };
  blocks: number[][]; fittings: (number | string)[][]; nativeFittings: (number | string)[][];
};
export const POTSDAMER_CORRIDOR_CORE_PROFILE_V288 = profile;
const source = data as unknown as { schemaVersion: number; sites: Site[] };
const complete = new WeakSet<Group>();
export function hasCompletePotsdamerCorridorCoreV288(root: Group): boolean { return complete.has(root); }

export {
  POTSDAMER_CORRIDOR_CORE_IDS_V288, admitsPotsdamerCorridorCoreV288,
  admitsPotsdamerCorridorNativeV288, isPotsdamerCorridorOldCoreV288,
  isPotsdamerCorridorOldNativeColumnV288,
} from "./PotsdamerCorridorV288Ownership";

function decoded(text: string): ArrayBuffer {
  return Uint8Array.from(atob(text), c => c.charCodeAt(0)).buffer;
}

export { potsdamerCorridorSolidsV288 } from "./PotsdamerCorridorV288Navigation";

/** Complete measured Hansa-Haus, Anton-von-Werner-Haus and Potsdamer/Bülow
 * bank family plus shallow recognition on retained Loeser & Wolff. Two drawn
 * batches / one independent native batch. No constructor source arrays escape
 * onto the published root; existing touch and pointer detail are identical. */
export function createPotsdamerCorridorCoreV288(native = false): Group {
  const root = new Group();
  root.name = `Potsdamer Straße measured offices and Mercator public fronts v288${native ? " native" : ""}`;
  const sites = source.sites;
  const offsets = sites.map(s => buildingTerrainOffset(s.parent, s.anchor[0], s.anchor[1], s.sourceGround));
  if (!native) {
    const vertexCount = sites.reduce((n, s) => n + atob(s.drawn.positions).length / 12, 0);
    const indexCount = sites.reduce((n, s) => n + atob(s.drawn.indices).length / 4, 0);
    const positions = new Float32Array(vertexCount * 3), colors = new Uint8Array(vertexCount * 3), indices = new Uint32Array(indexCount);
    let vertex = 0, index = 0;
    for (let si = 0; si < sites.length; si++) {
      const site = sites[si], p = new Float32Array(decoded(site.drawn.positions)), c = new Uint8Array(decoded(site.drawn.colors)), ix = new Uint32Array(decoded(site.drawn.indices));
      if (p.length !== c.length || p.length % 3 !== 0 || ix.some(i => i >= p.length / 3)) throw new Error("Invalid complete Potsdamer source sheet");
      for (let i = 0; i < p.length; i += 3) {
        positions[vertex * 3 + i] = p[i] + site.origin[0];
        positions[vertex * 3 + i + 1] = p[i + 1] + site.origin[1] + offsets[si];
        positions[vertex * 3 + i + 2] = p[i + 2] + site.origin[2];
      }
      colors.set(c, vertex * 3);
      for (const i of ix) indices[index++] = i + vertex;
      vertex += p.length / 3;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3, true)); geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }), night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .87 });
    const mesh = new Mesh(geometry, day);
    mesh.name = "Complete retained LoD2 Hansa-Haus, Werner and Potsdamer/Bülow walls, roofs and courts";
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, fullMeasuredSheets: true };
    root.add(mesh);
  }
  const count = sites.reduce((n, s) => n + (native ? s.blocks.length + s.nativeFittings.length : s.fittings.length), 0);
  const matrices = new Float32Array(count * 16), colors = new Float32Array(count * 3);
  const matrix = new Matrix4(), size = new Vector3(), color = new Color(); let at = 0;
  for (let si = 0; si < sites.length; si++) {
    const site = sites[si], rows = native ? [...site.blocks, ...site.nativeFittings] : site.fittings;
    for (const row of rows) {
      const [x, y, z, w, h, d] = row as number[];
      if (![x, y, z, w, h, d].every(Number.isFinite) || Math.min(w, h, d) <= 0) throw new Error("Invalid Potsdamer fitting dimensions");
      if (native) matrix.makeScale(w, h, d);
      else matrix.makeRotationY(row[6] as number).scale(size.set(w, h, d));
      matrix.setPosition(x, y + offsets[si], z); matrix.toArray(matrices, at * 16);
      color.setHex(row[native ? 6 : 7] as number).toArray(colors, at * 3); at++;
    }
  }
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial(), night = new MeshStandardMaterial({ roughness: .82 });
  const mesh = new InstancedMesh(geometry, day, 0); mesh.count = count;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = native ? "Independent exterior cardinal Potsdamer buildings, roofs and window fittings" : "Loeser sandstone courses, Hansa pilasters, Werner two-bay front and bank window grids";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native, nativeMinecraft: native, keepInMinecraft: native };
  root.add(mesh);
  root.userData = { potsdamerCorridorV288: true, requiredCompleteReplacement: true,
    fullStaticDetailOnTouch: true, sourceXZPreserved: true, sourceSheetsRetained: true,
    sourceReceipt: "potsdamer-corridor-v288-evidence.json", textureFree: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native,
    replacedCoreOwners: profile.oldCoreIds, nativeOldColumnCount: profile.nativeColumns.length,
    referenceOnly: true, fittingDimensionsEstimated: true };
  complete.add(root);
  return freezeStaticSceneTransforms(root);
}
