import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, ShapeUtils, Vector2, Vector3,
} from "three";
import {
  SCHLOSS_NATURKUNDE_GROUP_NAME, SCHLOSS_NATURKUNDE_SOURCES,
  MINECRAFT_SCHLOSS_NATURKUNDE_GROUP_NAME, schlossNaturkundePartBounds,
  schlossNaturkundePartRoofAt, type SchlossNaturkundePart,
} from "./schlossNaturkundeProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

const TONES = [
  { wall: 0xe4d1a6, roof: 0x666c64, name: "Berliner Schloss" },
  { wall: 0xc1b79d, roof: 0x68645d, name: "Museum fuer Naturkunde" },
];

function sourceMesh(parts: SchlossNaturkundePart[], tone: typeof TONES[number]): Mesh {
  const positions: number[] = [], colors: number[] = [];
  const normal = new Vector3(), tint = new Color();
  for (const part of parts) for (const surface of part.surfaces) {
    if (part.id === "DEBE3DzLpp1avSfB") continue;
    const rings = surface.rings, ring = rings[0];
    normal.set(0, 0, 0);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      normal.x += (a[1] - b[1]) * (a[2] + b[2]);
      normal.y += (a[2] - b[2]) * (a[0] + b[0]);
      normal.z += (a[0] - b[0]) * (a[1] + b[1]);
    }
    normal.normalize();
    const dominant = Math.abs(normal.y) > Math.abs(normal.x)
      ? Math.abs(normal.y) > Math.abs(normal.z) ? 1 : 2
      : Math.abs(normal.x) > Math.abs(normal.z) ? 0 : 2;
    const projected = rings.map((r) => r.map((p) => dominant === 1
      ? new Vector2(p[0], p[2]) : dominant === 0
        ? new Vector2(p[2], p[1]) : new Vector2(p[0], p[1])));
    const triangles = ShapeUtils.triangulateShape(projected[0], projected.slice(1));
    const flat = rings.flat(), roof = surface.kind === "RoofSurface";
    tint.setHex(part.id === "DEBE3DzLpp1avSfB" && roof ? 0x698f81 : roof ? tone.roof : tone.wall);
    if (!roof) tint.multiplyScalar(0.88 + 0.12 * Math.abs(normal.x));
    for (const triangle of triangles) {
      const a = new Vector3(...flat[triangle[0]] as [number, number, number]);
      const b = new Vector3(...flat[triangle[1]] as [number, number, number]);
      const c = new Vector3(...flat[triangle[2]] as [number, number, number]);
      if (b.sub(a).cross(c.sub(a)).dot(normal) < 0) [triangle[1], triangle[2]] = [triangle[2], triangle[1]];
      for (const index of triangle) {
        positions.push(...flat[index]);
        colors.push(tint.r, tint.g, tint.b);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const dayMaterial = new MeshBasicMaterial({ color: 0xffffff, vertexColors: true, side: DoubleSide });
  const nightMaterial = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true,
    side: DoubleSide, roughness: 0.86, flatShading: true });
  const mesh = new Mesh(geometry, dayMaterial);
  mesh.name = `${tone.name} official LoD2 walls and roof`;
  mesh.userData = { sourcePartIds: parts.map((part) => part.id), textureFree: true,
    dayMaterial, nightMaterial, sourceGeometryUnchanged: !parts.some((p) => p.id === "DEBE3DzLpp1avSfB"),
    curvedDomeReplacement: parts.some((p) => p.id === "DEBE3DzLpp1avSfB") };
  return mesh;
}

/** Complete original source sheets: facade detail never floats above 9 m placeholders. */
export function createSchlossNaturkundeShells(): Group {
  const root = new Group();
  root.name = SCHLOSS_NATURKUNDE_GROUP_NAME;
  root.userData = { textureFree: true, sourceParents: SCHLOSS_NATURKUNDE_SOURCES.map((s) => s.parent_id) };
  SCHLOSS_NATURKUNDE_SOURCES.forEach((profile, i) => {
    const mesh = sourceMesh(profile.parts, TONES[i]);
    mesh.position.y = profile.display_y_translation_m;
    root.add(mesh);
  });
  return freezeStaticSceneTransforms(root);
}

type Block = { position: [number, number, number]; size: [number, number, number]; color: number };

/** Uppermost surface only: overlapping LoD2 parts do not create buried blocks. */
function appendVoxelEnvelope(profile: typeof SCHLOSS_NATURKUNDE_SOURCES[number], tone: typeof TONES[number], blocks: Block[]): void {
  const bounds = profile.parts.map(schlossNaturkundePartBounds), cell = 2.5;
  const minX = Math.min(...bounds.map((v) => v[0])), minZ = Math.min(...bounds.map((v) => v[1]));
  const maxX = Math.max(...bounds.map((v) => v[2])), maxZ = Math.max(...bounds.map((v) => v[3]));
  const base = Math.max(profile.parts[0].ground_y_m + profile.display_y_translation_m, 5.2);
  const columns = new Map<string, { x: number; z: number; top: number; roof: number }>();
  const firstX = Math.floor(minX / cell), firstZ = Math.floor(minZ / cell);
  for (let ix = firstX; ix * cell < maxX; ix++) for (let iz = firstZ; iz * cell < maxZ; iz++) {
    const x = (ix + .5) * cell, z = (iz + .5) * cell;
    let top: number | null = null, roof = tone.roof;
    for (const part of profile.parts) {
      const y = schlossNaturkundePartRoofAt(part, x, z);
      if (y !== null && (top === null || y > top)) { top = y; roof = part.id === "DEBE3DzLpp1avSfB" ? 0x775443 : tone.roof; }
    }
    if (top !== null && top > base) columns.set(`${ix},${iz}`, { x, z, top, roof });
  }
  for (const [key, c] of columns) {
    const [ix, iz] = key.split(",").map(Number), roofThickness = Math.min(.7, c.top - base);
    blocks.push({ position: [c.x, c.top - roofThickness / 2, c.z], size: [cell, roofThickness, cell], color: c.roof });
    const neighbourTop = Math.min(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => columns.get(`${ix + dx},${iz + dz}`)?.top ?? base));
    const wallBase = Math.max(base, neighbourTop), wallHeight = c.top - roofThickness - wallBase;
    if (wallHeight <= .15) continue;
    const courses = Math.ceil(wallHeight / 3.8), pitch = wallHeight / courses;
    for (let i = 0; i < courses; i++) blocks.push({ position: [c.x, wallBase + (i + .5) * pitch, c.z], size: [cell, pitch, cell], color: tone.wall });
  }
}

export function createMinecraftSchlossNaturkundeShells(): Group {
  const root = new Group();
  root.name = MINECRAFT_SCHLOSS_NATURKUNDE_GROUP_NAME;
  root.userData = { keepInMinecraft: true, blockNative: true, textureFree: true,
    surfaceOnly: true, hiddenSolidInfill: false };
  const blocks: Block[] = [];
  SCHLOSS_NATURKUNDE_SOURCES.forEach((profile, i) => {
    appendVoxelEnvelope(profile, TONES[i], blocks);
  });
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
  const nightMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, flatShading: true });
  const mesh = new InstancedMesh(geometry, dayMaterial, 0);
  const matrices = new Float32Array(blocks.length * 16), colors = new Float32Array(blocks.length * 3);
  const matrix = new Matrix4(), color = new Color();
  blocks.forEach((block, i) => {
    matrix.makeScale(...block.size).setPosition(...block.position).toArray(matrices, i * 16);
    color.setHex(block.color).toArray(colors, i * 3);
  });
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.count = blocks.length;
  mesh.name = "Schloss and Naturkunde source-bound wall and roof blocks";
  mesh.userData = { dayMaterial, nightMaterial, textureFree: true, surfaceOnly: true };
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
