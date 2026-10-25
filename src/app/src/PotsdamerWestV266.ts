import {
  BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Vector3,
} from 'three';
import data from './data/potsdamerWestV266.json';
import { buildingTerrainOffset } from './weinbergTerrainV176';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

export const POTSDAMER_WEST_V266_PROFILE = {
  ...data.profile,
  drawnVertices: data.colors.length,
  drawnFittings: data.boxes.length,
  nativeBlocks: data.profile.nativeBlocks,
  fullStaticDetailOnTouch: true,
  publishedShaftHeightM: 106,
  estimatedOfficeRoofHeightM: 85,
  cameras: {
    tower: { position: [-111, 116, 1590], target: [57, 67, 1474] },
    greenCube: { position: [95, 122, 1534], target: [61.35, 105.5, 1482.81] },
    parkSequence: { position: [395, 128, 1435], target: [149, 39, 1290] },
  },
} as const;

/** Construction-local native rows; smooth geometry is never copied into native. */
export function potsdamerWestRecordsV266(native = false): (number | string)[][] {
  if (!native) return data.boxes;
  const rows: (number | string)[][] = data.nativeRoofBlocks.map(row => [...row]);
  const round = (n: number) => Math.round(n * 10_000) / 10_000;
  for (const column of data.nativeSurfaceColumns) {
    const [x, z, low, top, cell, count, tone] = column as number[];
    const shaft = column[7], height = (top - low) / count;
    for (let iy = 0; iy < count; iy++) rows.push([x, round(low + (iy + .5) * height), z,
      cell, round(height), cell, shaft ? tone : iy % 3 === 0 ? 0xB88D65 : 0x698A91,
      'upper-surface-cell', 0]);
  }
  for (const r of data.boxes) {
    const [x, y, z, w, h, d, angle, color] = r as number[];
    const n = Math.max(1, Math.ceil(w / .65)), step = w / n;
    const dx = Math.cos(angle), dz = -Math.sin(angle);
    for (let i = 0; i < n; i++) {
      const u = (i + .5) * step - w / 2;
      rows.push([round(x + dx * u), y, round(z + dz * u),
        round(Math.abs(dx) * step + Math.abs(dz) * d), h,
        round(Math.abs(dz) * step + Math.abs(dx) * d), color, r[8], r[9]]);
    }
  }
  return rows;
}

/** Additive source-plan tower completion and shallow fittings; no old owner yields. */
export function createPotsdamerWestV266(native = false, options: { mobileLike?: boolean } = {}): Group {
  void options;
  const root = new Group();
  root.name = 'Potsdamer west Atrium tower, green ventilation cube and Rogers rails v266';
  root.userData = {
    ...POTSDAMER_WEST_V266_PROFILE,
    potsdamerWestV266: true, sourceGeometryRetained: true, additiveOnly: true,
    textureFree: true, blockNative: native, nativeMinecraft: native, keepInMinecraft: native,
    sourceReceipt: 'potsdamer-west-v266-evidence.json.gz',
  };
  const offsets = data.profile.owners.map(owner => buildingTerrainOffset(owner.id,
    owner.anchor[0], owner.anchor[1], owner.groundY));
  const mainOffset = offsets[0];
  if (!native) {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(data.positions);
    for (let i = 1; i < positions.length; i += 3) positions[i] += mainOffset;
    const colors = new Float32Array(data.colors.length * 3), tint = new Color();
    data.colors.forEach((c, i) => tint.setHex(c).toArray(colors, i * 3));
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const day = new MeshBasicMaterial({ vertexColors: true });
    const night = new MeshStandardMaterial({ vertexColors: true, roughness: .84 });
    const mesh = new Mesh(geometry, day);
    mesh.name = 'Nine mapped Atrium upper parts above retained source envelope';
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, sourcePlanUpperCompletion: true };
    root.add(mesh);
  }
  const rows = potsdamerWestRecordsV266(native);
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute('uv');
  const day = new MeshBasicMaterial(), night = new MeshStandardMaterial({ roughness: .8 });
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), scale = new Vector3(), tint = new Color();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const [x, y, z, w, h, d] = r as number[];
    if (native) matrix.makeScale(w, h, d);
    else matrix.makeRotationY(r[6] as number).scale(scale.set(w, h, d));
    matrix.setPosition(x, y + offsets[r[native ? 8 : 9] as number], z); matrix.toArray(matrices, i * 16);
    tint.setHex(r[native ? 6 : 7] as number).toArray(colors, i * 3);
  }
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = native ? 'Independent orthogonal Atrium upper surfaces and green square lattice' : 'Terracotta bands, double facade grid, green square cube and Rogers vertical rails';
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: native, nativeMinecraft: native, keepInMinecraft: native };
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
