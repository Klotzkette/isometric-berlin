import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Surface = { triangles: number[][][]; color: number; owner?: string };
type Cell = { id: string; boxes: number[][]; surfaces?: Surface[] };

/** Resolve close ground layers in depth without moving source coordinates. */
function groundDepthBias(
  material: MeshBasicMaterial | MeshStandardMaterial,
): void {
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -2;
}

/** Small spatial cells keep Tierpark and Köpenick independently cullable. */
export function eastLandmarksV187Batches(
  cells: readonly Cell[],
  native: boolean,
): Group {
  const root = new Group();
  root.name = native
    ? "East landmarks v187: native source skins and zoo enclosures"
    : "East landmarks v187: measured Tierpark and Köpenick";
  root.userData = {
    textureFree: true,
    fullStaticDetailOnTouch: true,
    completeSourceOwners: true,
    blockNative: native,
    nativeMinecraft: native,
    keepInMinecraft: native,
    eastLandmarksV187: true,
  };
  for (const cell of cells) {
    // Only native enclosure floors have this explicit thin ground-run profile.
    // Separating them also keeps depth bias off walls, roofs, fences and sills.
    const isNativeGround = (row: number[]) =>
      native && row[1] === 3.03 && row[4] === 0.04;
    for (const ground of native ? [false, true] : [false]) {
      const rows = native
        ? cell.boxes.filter((row) => isNativeGround(row) === ground)
        : cell.boxes;
      if (!rows.length) continue;
      const mesh = justicePalaceV183Boxes(rows, native);
      mesh.name = `East v187 ${cell.id}: ${native ? "native skins" : "restrained facade and mapped barrier members"}`;
      mesh.userData.eastLandmarksV187 = cell.id;
      mesh.userData.enclosureGroundV187 = ground;
      if (ground) {
        groundDepthBias(mesh.userData.dayMaterial);
        groundDepthBias(mesh.userData.nightMaterial);
        mesh.name = `East v187 ${cell.id}: native mapped enclosure grounds`;
      }
      root.add(mesh);
    }
    if (native || !cell.surfaces?.length) continue;
    // Source-owned faces are the complete buildings; owner-less surfaces are
    // the clipped enclosure floors. Their original vertices remain untouched.
    for (const ground of [false, true]) {
      const surfaces = cell.surfaces.filter(
        (surface) => !surface.owner === ground,
      );
      if (!surfaces.length) continue;
      const count = surfaces.reduce(
        (sum, s) => sum + s.triangles.length * 9,
        0,
      );
      const positions = new Float32Array(count),
        colors = new Float32Array(count);
      const color = new Color();
      let offset = 0;
      for (const surface of surfaces)
        for (const triangle of surface.triangles) {
          // One immutable face shade, no texture/light/animation allocation.
          const [a, b, c] = triangle;
          const ux = b[0] - a[0],
            uy = b[1] - a[1],
            uz = b[2] - a[2];
          const vx = c[0] - a[0],
            vy = c[1] - a[1],
            vz = c[2] - a[2];
          const nx = uy * vz - uz * vy,
            ny = uz * vx - ux * vz,
            nz = ux * vy - uy * vx;
          const norm = Math.hypot(nx, ny, nz) || 1;
          const shade =
            0.8 + 0.16 * Math.abs(ny / norm) + 0.04 * Math.abs(nx / norm);
          color.setHex(surface.color).multiplyScalar(shade);
          for (const p of triangle) {
            positions.set(p, offset);
            color.toArray(colors, offset);
            offset += 3;
          }
        }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setAttribute("color", new BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const day = new MeshBasicMaterial({
        vertexColors: true,
        side: DoubleSide,
      });
      const night = new MeshStandardMaterial({
        vertexColors: true,
        side: DoubleSide,
        flatShading: true,
        roughness: 0.88,
      });
      if (ground) {
        groundDepthBias(day);
        groundDepthBias(night);
      }
      const mesh = new Mesh(geometry, day);
      mesh.name = `East v187 ${cell.id}: ${ground ? "mapped enclosure grounds" : "full measured walls and roofs"}`;
      mesh.userData = {
        dayMaterial: day,
        nightMaterial: night,
        textureFree: true,
        eastLandmarksV187: cell.id,
        enclosureGroundV187: ground,
      };
      root.add(mesh);
    }
  }
  return freezeStaticSceneTransforms(root);
}
