import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, ShapeUtils, Vector2, Vector3,
} from "three";
import {
  BEBELPLATZ_BUILDING_GROUP_NAME, BEBELPLATZ_CIVIC_SOURCES,
  MINECRAFT_BEBELPLATZ_BUILDING_GROUP_NAME, bebelplatzPartBounds,
  bebelplatzPartContains, bebelplatzPartRoofAt, type BebelplatzSourcePart,
} from "./bebelplatzBuildingProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

const TONES = [
  { wall: 0xd9d3c2, roof: 0x665d58, name: "Humboldt main building" },
  { wall: 0xcdbb97, roof: 0x64625d, name: "Alte Bibliothek" },
  { wall: 0xbebdb3, roof: 0x696b68, name: "Hotel de Rome" },
];

function sourceMesh(parts: BebelplatzSourcePart[], tone: typeof TONES[number]): Mesh {
  const positions: number[] = [], colors: number[] = [];
  const normal = new Vector3(), tint = new Color();
  for (const part of parts) for (const surface of part.surfaces) {
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
    tint.setHex(roof ? tone.roof : tone.wall);
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
    dayMaterial, nightMaterial, sourceGeometryUnchanged: true };
  return mesh;
}

/** Complete original source sheets: facade detail never floats above 9 m placeholders. */
export function createBebelplatzBuildingShells(): Group {
  const root = new Group();
  root.name = BEBELPLATZ_BUILDING_GROUP_NAME;
  root.userData = { textureFree: true, sourceParents: BEBELPLATZ_CIVIC_SOURCES.map((s) => s.parent_id) };
  BEBELPLATZ_CIVIC_SOURCES.forEach((profile, i) => root.add(sourceMesh(profile.parts, TONES[i])));
  return freezeStaticSceneTransforms(root);
}

type Block = { position: [number, number, number]; size: [number, number, number]; color: number };

/** Surface-only voxel sampling retains pitched source roofs without interior fill. */
function appendVoxelEnvelope(part: BebelplatzSourcePart, tone: typeof TONES[number], blocks: Block[]): void {
  const [minX, minZ, maxX, maxZ] = bebelplatzPartBounds(part);
  const cell = 2;
  const base = Math.max(part.ground_y_m, 5.18);
  for (let x = Math.floor(minX / cell) * cell + cell / 2; x < maxX; x += cell) {
    for (let z = Math.floor(minZ / cell) * cell + cell / 2; z < maxZ; z += cell) {
      if (!bebelplatzPartContains(part, x, z)) continue;
      const top = bebelplatzPartRoofAt(part, x, z);
      if (top === null || top <= base) continue;
      const roofThickness = Math.min(0.8, top - base);
      blocks.push({ position: [x, top - roofThickness / 2, z], size: [cell, roofThickness, cell], color: tone.roof });
      const boundary = [[cell, 0], [-cell, 0], [0, cell], [0, -cell]].some(([dx, dz]) =>
        !bebelplatzPartContains(part, x + dx, z + dz));
      if (!boundary) continue;
      const wallHeight = top - roofThickness - base;
      const courses = Math.ceil(wallHeight / 3.8), pitch = wallHeight / courses;
      for (let i = 0; i < courses; i++) blocks.push({
        position: [x, base + (i + 0.5) * pitch, z], size: [cell, pitch, cell],
        color: tone.wall,
      });
    }
  }
}

export function createMinecraftBebelplatzBuildingShells(): Group {
  const root = new Group();
  root.name = MINECRAFT_BEBELPLATZ_BUILDING_GROUP_NAME;
  root.userData = { keepInMinecraft: true, blockNative: true, textureFree: true,
    surfaceOnly: true, hiddenSolidInfill: false };
  const blocks: Block[] = [];
  BEBELPLATZ_CIVIC_SOURCES.forEach((profile, i) => {
    for (const part of profile.parts) appendVoxelEnvelope(part, TONES[i], blocks);
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
  mesh.name = "Bebelplatz source-bound wall and roof blocks";
  mesh.userData = { dayMaterial, nightMaterial, textureFree: true, surfaceOnly: true };
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
