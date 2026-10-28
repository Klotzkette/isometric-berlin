import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3,
} from 'three';
import data from './data/zooHousesV282.json';
import { letteringStrokePaths } from './drawnLettering';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

type P = [number, number, number];
type Member = { position: P; scale: P; quaternion: Quaternion; color: number };
type Entry = { anchor: number[]; tangent: number[]; normal: number[]; label: string };

class Details {
  members: Member[] = [];
  constructor(readonly native: boolean) {}
  box(color: number, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0): void {
    if (this.native && yaw !== 0) {
      const n = Math.max(1, Math.ceil(w / .4));
      for (let i = 0; i < n; i++) {
        const u = (i + .5) * w / n - w / 2;
        this.box(color, x + Math.cos(yaw) * u, y, z - Math.sin(yaw) * u,
          Math.abs(Math.cos(yaw)) * w / n + Math.abs(Math.sin(yaw)) * d,
          h, Math.abs(Math.sin(yaw)) * w / n + Math.abs(Math.cos(yaw)) * d);
      }
      return;
    }
    this.members.push({ position: [x, y, z], scale: [w, h, d],
      quaternion: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw), color });
  }
  line(color: number, a: P, b: P, width = .07): void {
    const delta = new Vector3(...b).sub(new Vector3(...a)), length = delta.length();
    if (length < 1e-8) return;
    if (this.native) {
      const n = Math.max(1, Math.ceil(length / .4));
      for (let i = 0; i < n; i++) {
        const t = (i + .5) / n;
        this.box(color, a[0] + delta.x * t, a[1] + delta.y * t, a[2] + delta.z * t,
          Math.max(width, Math.abs(delta.x) / n), Math.max(width, Math.abs(delta.y) / n),
          Math.max(width, Math.abs(delta.z) / n));
      }
    } else this.members.push({ position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
      scale: [width, length, width], quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize()), color });
  }
}

function materials(vertexColors: boolean) {
  const params = { color: 0xffffff, vertexColors, side: DoubleSide };
  const day = new MeshBasicMaterial(params);
  const night = new MeshStandardMaterial({ ...params, roughness: .88, flatShading: true });
  return { day, night };
}

function instances(details: Details): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute('uv');
  const { day, night } = materials(false);
  const mesh = new InstancedMesh(geometry, day, 0), matrix = new Matrix4(), color = new Color();
  const matrices = new Float32Array(details.members.length * 16), colors = new Float32Array(details.members.length * 3);
  details.members.forEach((m, i) => {
    matrix.compose(new Vector3(...m.position), m.quaternion, new Vector3(...m.scale)).toArray(matrices, i * 16);
    color.setHex(m.color).toArray(colors, i * 3);
  });
  mesh.count = details.members.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  return mesh;
}

function shell(): Mesh {
  const positions: number[] = [], colors: number[] = [], color = new Color();
  for (const surface of data.penguin.surfaces) {
    color.setHex(surface.color);
    for (const tri of surface.triangles) for (const p of tri) {
      positions.push(...p); colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const { day, night } = materials(true), mesh = new Mesh(geometry, day);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return mesh;
}

function entry(details: Details, e: Entry, ground: number): void {
  const [tx, tz] = e.tangent, [nx, nz] = e.normal, [x, z] = e.anchor;
  const off = details.native ? 1.15 : .13;
  const at = (u: number, y: number, depth = off): P => [x + tx * u + nx * depth, y, z + tz * u + nz * depth];
  const yaw = Math.atan2(-tz, tx);
  for (const u of [-1.28, 1.28]) details.line(0xCED1C5, at(u, ground + .2), at(u, ground + 3.08), .12);
  details.line(0xCED1C5, at(-1.28, ground + 3.08), at(1.28, ground + 3.08), .12);
  // A shallow house-name recognition panel, not a claim of surveyed signage.
  details.box(0x315C62, ...at(0, ground + 3.65), 5.4, .78, .12, yaw);
  const paths = letteringStrokePaths(e.label, .4);
  const extent = Math.max(...paths.flatMap(path => path.map(p => p[0]))), scale = Math.min(1, 5 / extent);
  for (const path of paths) for (let i = 1; i < path.length; i++) {
    const p = path[i - 1], q = path[i];
    details.line(0xE4E4D6, at((p[0] - extent / 2) * scale, ground + 3.44 + p[1] * scale, off + .1),
      at((q[0] - extent / 2) * scale, ground + 3.44 + q[1] * scale, off + .1), .04);
  }
}

/** Required Penguin replacement and separate source-preserving Brehm details.
 * No animal, ground, navigation, texture or private animation lifetime is added.
 * The required-site transaction must construct Zoo before retiring its receipts.
 */
export function createZooHousesV282(site: 'zoo' | 'tierpark', native = false): Group {
  const root = new Group(), details = new Details(native);
  root.name = `${site === 'zoo' ? 'Pinguinwelt complete measured shell' : 'Regenwaldhaus retained facade recognition'} v282 ${native ? 'native' : 'drawn'}`;
  if (site === 'zoo') {
    if (native) for (const [x, y, z, w, h, d, color] of data.penguin.nativeRows) details.box(color, x, y, z, w, h, d);
    else { const body = shell(); body.name = 'All four retained Penguin source parts'; root.add(body); }
    for (const e of data.penguin.entries) entry(details, e, data.penguin.groundY);
  } else {
    // Preserve the 124 individually measured curved/recessed facade edges.
    // No invented greenhouse roof is placed above the retained flat source.
    const ring = data.brehm.ring, top = data.brehm.topY;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      details.line(0xBDC2B3, [a[0], top + .06, a[1]], [b[0], top + .06, b[1]], .15);
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 3.2)
        details.line(0xBCBBAA, [a[0], data.brehm.groundY + .15, a[1]], [a[0], top, a[1]], .09);
    }
    for (const e of data.brehm.entries) entry(details, e, data.brehm.groundY);
  }
  const trim = instances(details); trim.name = 'Independent source-bound house fittings'; root.add(trim);
  root.userData = { zooHousesV282: true, site, native, fullStaticDetailOnTouch: true, textureFree: true,
    measuredPenguinParts: site === 'zoo' ? 4 : 0, preservedBrehmEnvelope: site === 'tierpark' };
  freezeStaticSceneTransforms(root);
  return root;
}

/** Attaches to the existing bounded Tierpark packet, never a new global loader. */
export function createTierparkHouseV282(id: string, native = false): Group | null {
  return id === data.brehm.packetId ? createZooHousesV282('tierpark', native) : null;
}
