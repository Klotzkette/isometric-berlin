import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import source from "./data/religiousSitesV205.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const RELIGIOUS_SITES_V205_GROUP = "Six source-bound religious sites v205";
type Triangle = { points: number[][]; color: number };

function sheets(triangles: Triangle[], label: string): Mesh {
  const positions = new Float32Array(triangles.length * 9);
  const colors = new Float32Array(positions.length), color = new Color();
  triangles.forEach((t, i) => {
    color.setHex(t.color);
    t.points.forEach((p, j) => {
      positions.set(p, i * 9 + j * 3);
      color.toArray(colors, i * 9 + j * 3);
    });
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .95, flatShading: true });
  const mesh = new Mesh(geometry, day);
  mesh.name = label;
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    surfaceOnly: true, hiddenSolidInfill: false };
  return mesh;
}

/** Final-size oriented strokes, shared unit box, no maximum-capacity allocation. */
function members(rows: number[][]): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: .9 });
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const a = new Vector3(), b = new Vector3(), direction = new Vector3(), mid = new Vector3();
  const scale = new Vector3(), q = new Quaternion(), matrix = new Matrix4(), color = new Color();
  const vertical = new Vector3(0, 1, 0);
  rows.forEach((r, i) => {
    a.fromArray(r, 0); b.fromArray(r, 3); direction.subVectors(b, a);
    const length = direction.length(); direction.normalize();
    q.setFromUnitVectors(vertical, direction); mid.addVectors(a, b).multiplyScalar(.5);
    matrix.compose(mid, q, scale.set(r[6], length, r[6])).toArray(matrices, i * 16);
    color.setHex(r[7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = "Source-plane arch frames, rose tracery and thin architectural members";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, finalCountAllocation: true };
  return mesh;
}

/** Six independently culled sites; native mode creates only its block surface. */
export function createReligiousSitesV205(minecraft = false): Group {
  const root = new Group(); root.name = RELIGIOUS_SITES_V205_GROUP;
  root.userData = { textureFree: true, sourceGeometryRetained: true, exactOwnerTransfer: true,
    fullStaticDetailOnTouch: true, nativeMinecraft: minecraft, blockNative: minecraft,
    keepInMinecraft: minecraft, sourceParents: source.sites.flatMap(s => s.parents),
    estimateStatus: source.estimates };
  for (const site of source.sites) {
    const group = new Group(); group.name = site.name;
    group.userData = { siteId: site.id, sourceParents: site.parents, recognition: site.recognition,
      groundY: 3, sourceNavigationParts: site.navigation.length, fullStaticDetailOnTouch: true };
    if (minecraft) {
      const blocks = justicePalaceV183Boxes(site.nativeBlocks, true);
      blocks.name = `${site.name}: axis-aligned source and recognition surface blocks`;
      blocks.userData.surfaceOnly = true;
      group.add(blocks);
    } else {
      const suppressed = new Set(site.suppressedSourceTriangleIndices);
      const exact = sheets([...site.triangles.filter((_, i) => !suppressed.has(i)), ...site.clippedSourceTriangles], `${site.name}: source sheets with documented crown corrections`);
      exact.userData.sourceGeometry = true;
      exact.userData.crownCorrections = site.crownCorrections;
      const estimated = sheets(site.estimatedTriangles, `${site.name}: documented recognition estimates`);
      estimated.userData.displayEstimate = true;
      group.add(exact, estimated, members(site.members));
    }
    root.add(group);
  }
  return freezeStaticSceneTransforms(root);
}
