import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import data from "./data/westCivicV210.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const WEST_CIVIC_V210_GROUP = "Westend and DRV civic recognition v210";
export const WEST_CIVIC_V210_SOURCE_IDS = data.sourceOwnerIds;

/** Attach before enabling new navigation: all rbb solid additions and the
 * seven-tier sculpture, including their own surface details, exactly once. */
export function createWestCivicEnvelopesV210(native = false): Group {
  return createWestCivicSelectionV210(native, true);
}

/** Source owners remain elsewhere in the city. These bounded additions are
 * optional facade decoration and mapped plaza context. Mobile uses identical detail. */
export function createWestCivicV210(native = false): Group {
  return createWestCivicSelectionV210(native, false);
}

function createWestCivicSelectionV210(native: boolean, required: boolean): Group {
  const root = new Group(); root.name = WEST_CIVIC_V210_GROUP +
    (required ? " required solids" : " optional facades") + (native ? " native" : "");
  root.userData = {
    textureFree: true, fullStaticDetailOnTouch: true, sourceGeometryRetained: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native,
    sourceOwnerIds: WEST_CIVIC_V210_SOURCE_IDS, sourceReceipt: "west-civic-v210-source.json",
    unrelatedDetailsRetained: true, blueObeliskGlassTiers: 7,
    noGenericOwnerRemoval: true, navigationReceipt: "westCivicV210Navigation.json",
    requiredBeforeNavigation: required,
  };
  for (const item of data.groups) {
    if (item.required !== required) continue;
    const cell = new Group(); cell.name = item.name;
    cell.userData = { keepInMinecraft: native, blockNative: native, textureFree: true };
    const rows: number[][] = native ? item.native : item.boxes;
    if (rows.length) {
      const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
      const normal = geometry.getAttribute("normal"), vertexTints = new Float32Array(normal.count * 3);
      for (let i = 0; i < normal.count; i++) {
        const v = normal.getY(i) > .5 ? 1 : normal.getX(i) > .5 ? .87 : .95;
        vertexTints.set([v, v, v], i * 3);
      }
      geometry.setAttribute("color", new BufferAttribute(vertexTints, 3));
      const day = new MeshBasicMaterial({ vertexColors: true });
      const night = new MeshStandardMaterial({ vertexColors: true, roughness: .75,
        emissive: item.name.startsWith("Blauer") ? 0x071a46 : 0,
        emissiveIntensity: item.name.startsWith("Blauer") ? .55 : 0 });
      const mesh = new InstancedMesh(geometry, day, 0);
      const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
      const matrix = new Matrix4(), scale = new Vector3(), tint = new Color();
      rows.forEach((r, i) => {
        if (native) matrix.makeScale(r[3], r[4], r[5]);
        else matrix.makeRotationY(r[6]).scale(scale.set(r[3], r[4], r[5]));
        matrix.setPosition(r[0], r[1], r[2]).toArray(matrices, i * 16);
        tint.setHex(r[native ? 6 : 7]).toArray(colors, i * 3);
      });
      mesh.count = rows.length;
      mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
      mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
      mesh.name = item.name + (native ? ": independent native surface blocks" : ": bounded architectural fittings");
      mesh.userData = { textureFree: true, dayMaterial: day, nightMaterial: night,
        nativeMinecraft: native, blockNative: native, keepInMinecraft: native };
      mesh.computeBoundingBox(); mesh.computeBoundingSphere(); cell.add(mesh);
    }
    if ((!native && item.surfaces.length) || (native && item.nativeSurfaceQuads.length)) {
      const size = native ? item.nativeSurfaceQuads.length * 18 : item.surfaces.reduce((n, s) => n + s.triangles.length * 9, 0);
      const positions = new Float32Array(size), colors = new Float32Array(size);
      const color = new Color(); let offset = 0;
      if (native) for (const [x0,z0,x1,z1,y,hex] of item.nativeSurfaceQuads) {
        color.setHex(hex);
        for (const p of [[x0,y,z0],[x1,y,z1],[x1,y,z0],[x0,y,z0],[x0,y,z1],[x1,y,z1]]) {
          positions.set(p,offset); color.toArray(colors,offset); offset+=3;
        }
      }
      else for (const s of item.surfaces) {
        color.setHex(s.color);
        for (const t of s.triangles) for (const p of t) {
          positions.set(p, offset); color.toArray(colors, offset); offset += 3;
        }
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setAttribute("color", new BufferAttribute(colors, 3));
      geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
      const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .8 });
      const mesh = new Mesh(geometry, day); mesh.name = item.name + (native ? ": independent native pavement quads" : ": source-bound surfaces");
      mesh.userData = { textureFree: true, dayMaterial: day, nightMaterial: night, blockNative: native, keepInMinecraft: native };
      cell.add(mesh);
    }
    root.add(cell);
  }
  return freezeStaticSceneTransforms(root);
}
