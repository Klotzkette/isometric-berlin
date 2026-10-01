import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import source from "./data/moabitJusticeV166Source.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const MOABIT_JUSTICE_V166_GROUP = "Moabit criminal court, prison exterior and Lesser-Ury houses";
export const MOABIT_JUSTICE_V166_NATIVE_GROUP = "Moabit justice and Lesser-Ury independent native surface blocks";

/** Compact matrices contain only the complete authored instance count. */
function boxBatch(rows: readonly number[][]): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: .92 });
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), color = new Color(), scale = new Vector3();
  rows.forEach((r, i) => {
    matrix.makeRotationY(r[6]);
    matrix.scale(scale.set(r[3], r[4], r[5]));
    matrix.setPosition(r[0], r[1], r[2]);
    matrix.toArray(matrices, i * 16);
    color.setHex(r[7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  return mesh;
}

function measuredSurfaces(): Mesh {
  const positions: number[] = [], colors: number[] = [], color = new Color();
  for (const sheet of source.surfaces) {
    color.setHex(sheet.color);
    for (const triangle of sheet.triangles) for (const p of triangle) {
      positions.push(...p); colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, flatShading: true, roughness: .92 });
  const mesh = new Mesh(geometry, day);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  return mesh;
}

/** Independent axis-aligned grille template, never the rotated drawn bars. */
function nativeGrilles(): number[][] {
  const rows: number[][] = [];
  for (const [x, y, z, w, h, yaw] of source.nativeBarWindows) {
    const at = (u: number, dy: number, bw: number, bh: number) => rows.push([
      x + Math.cos(yaw) * u,
      y + dy,
      z - Math.sin(yaw) * u,
      bw, bh, bw, 0, 0xA6AAA1,
    ]);
    for (const u of [-.30, 0, .30]) at(u, 0, .11, h);
    const n = Math.ceil(w / .28);
    for (const dy of [-.48, .48]) for (let i = 0; i < n; i++) at((i + .5) * w / n - w / 2, dy, .24, .085);
  }
  return rows;
}

function create(native: boolean): Group {
  const root = new Group();
  root.name = native ? MOABIT_JUSTICE_V166_NATIVE_GROUP : MOABIT_JUSTICE_V166_GROUP;
  root.userData = {
    textureFree: true, blockNative: native, keepInMinecraft: native,
    fullStaticDetailOnTouch: true, sourceGeometryRetained: true,
    sourcePartIds: source.parts.map(p => p.id), exteriorOnly: true,
    barredWindowCount: source.barredWindowCount,
  };
  if (native) {
    const skin = boxBatch(source.nativeRuns.map(([x, y, z, w, h, d, c]) => [x, y, z, w, h, d, 0, c]));
    skin.name = "Complete separate orthogonal source skin";
    const bars = boxBatch(nativeGrilles());
    bars.name = "Independent orthogonal exterior window grille blocks";
    root.add(skin, bars);
  } else {
    root.add(measuredSurfaces(), boxBatch(source.facadeBoxes));
  }
  return freezeStaticSceneTransforms(root);
}

export function createMoabitJusticeV166(): Group { return create(false); }
export function createMinecraftMoabitJusticeV166(): Group { return create(true); }
