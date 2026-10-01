import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, ShapeUtils, Vector2, Vector3,
} from "three";
import source from "./data/hackescherMarktV163Source.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
import { letteringStrokePaths } from "./drawnLettering";

export const HACKESCHER_MARKT_V163_GROUP = "Hackescher Markt and Hackesche Hoefe source architecture";
export const HACKESCHER_MARKT_V163_NATIVE_GROUP = "Hackescher Markt and Hackesche Hoefe native blocks";
function instances(rows: readonly number[][], native: boolean): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .88, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), color = new Color();
  rows.forEach((r, i) => {
    if (native) matrix.makeScale(2, 2, 2);
    else { matrix.makeRotationY(r[6]); matrix.scale(new Vector3(r[3], r[4], r[5])); }
    matrix.setPosition(r[0], r[1], r[2]); matrix.toArray(matrices, i * 16);
    color.setHex(r[native ? 3 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}
function meshFromTriangles(surfaces: { color: number; triangles: number[][][] }[]): Mesh {
  const n = surfaces.reduce((sum, s) => sum + s.triangles.length * 9, 0);
  const position = new Float32Array(n), colors = new Float32Array(n), tint = new Color();
  let i = 0;
  for (const s of surfaces) {
    tint.setHex(s.color);
    for (const tri of s.triangles) for (const p of tri) {
      position.set(p, i); colors.set([tint.r, tint.g, tint.b], i); i += 3;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .9, flatShading: true });
  const mesh = new Mesh(geometry, day); mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return mesh;
}
function paving(minecraft: boolean): Mesh {
  const surfaces: { color: number; triangles: number[][][] }[] = [], rows: number[][] = [];
  for (const p of source.paving) {
    const color = p.kind === "courts" ? 0xc3b69b : 0xb9b3a5;
    if (minecraft) {
      const minX = Math.min(...p.ring.map(v => v[0])), maxX = Math.max(...p.ring.map(v => v[0]));
      const minZ = Math.min(...p.ring.map(v => v[1])), maxZ = Math.max(...p.ring.map(v => v[1]));
      for (let x = Math.floor(minX / 2) * 2 + 1; x < maxX; x += 2) for (let z = Math.floor(minZ / 2) * 2 + 1; z < maxZ; z += 2) {
        if (pointInWorldRing(x, z, p.ring as unknown as WorldRing) && !p.holes.some(h => pointInWorldRing(x, z, h as unknown as WorldRing)))
          rows.push([x, 4.31, z, color]);
      }
    } else {
      const rings = [p.ring, ...p.holes], flat = rings.flat();
      const indices = ShapeUtils.triangulateShape(rings[0].map(v => new Vector2(...v as [number, number])), rings.slice(1).map(r => r.map(v => new Vector2(...v as [number, number]))));
      surfaces.push({ color, triangles: indices.map(t => t.map(k => [flat[k][0], 5.34, flat[k][1]])) });
    }
  }
  const mesh = minecraft ? instances(rows, true) : meshFromTriangles(surfaces);
  mesh.name = "Mapped market paving and open interconnected courtyard floors"; return mesh;
}
function signs(): Mesh {
  const triangles: number[][][] = [];
  // Code lettering lies on the actual south-east source facade, not a billboard.
  const labels = [
    { text: "DIE HACKESCHEN HOEFE", a: [2113.66, -510.44], b: [2131.97, -538.06], y: 27.8, height: .70 },
    { text: "HACKESCHER MARKT", a: [2013.23, -335.27], b: [2033.86, -353.15], y: 10.5, height: .72 },
  ];
  for (const l of labels) {
    const dx = l.b[0] - l.a[0], dz = l.b[1] - l.a[1], len = Math.hypot(dx, dz);
    const at = (u: number, y: number): number[] => [(l.a[0] + l.b[0]) / 2 + dx / len * u, y, (l.a[1] + l.b[1]) / 2 + dz / len * u];
    for (const path of letteringStrokePaths(l.text, l.height)) for (let i = 1; i < path.length; i++) {
      const a = path[i-1], b = path[i], du = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(du, dy);
      if (!length) continue;
      const u = -.035 * dy / length, v = .035 * du / length;
      const q = [at(a[0]+u,l.y+a[1]+v),at(b[0]+u,l.y+b[1]+v),at(b[0]-u,l.y+b[1]-v),at(a[0]-u,l.y+a[1]-v)];
      triangles.push([q[0],q[1],q[2]],[q[0],q[2],q[3]]);
    }
  }
  return meshFromTriangles([{color:0x385765,triangles}]);
}
/** The pointer and mobile builds use exactly the same measured source/detail. */
export function createHackescherMarktV163(): Group {
  const root = new Group(); root.name = HACKESCHER_MARKT_V163_GROUP;
  root.userData = { textureFree: true, sourceParents: source.parents.map(p => p.id), mappedPassages: source.passages.length };
  const shell = meshFromTriangles(source.surfaces); shell.name = "Fifty measured building parts with mapped open passages";
  root.add(shell, instances(source.facadeBoxes.map(r => r.slice(0,8) as number[]), false), paving(false), signs());
  return freezeStaticSceneTransforms(root);
}
export function createMinecraftHackescherMarktV163(): Group {
  const root = new Group(); root.name = HACKESCHER_MARKT_V163_NATIVE_GROUP;
  root.userData = { keepInMinecraft: true, blockNative: true, textureFree: true, surfaceOnly: true };
  root.add(instances(source.nativeBlocks, true), paving(true));
  return freezeStaticSceneTransforms(root);
}
