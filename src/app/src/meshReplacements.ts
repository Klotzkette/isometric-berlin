import { BufferAttribute, Mesh, Object3D, Vector3 } from "three";

export type EllipticMeshReplacement = {
  centreWorldM: readonly [number, number];
  coreRadiusRatio: number;
  filePattern: string;
  maximumY: number;
  minimumAbsNormalY: number;
  minimumY: number;
  radiiM: readonly [number, number];
  reason: string;
  rotationDegrees: number;
};

/**
 * Source-mesh regions superseded by a measured, authored reconstruction.
 * These masks are deliberately narrower than a building replacement: they
 * remove only the old canopy envelope while retaining vertical edge facades.
 */
export const MESH_REPLACEMENTS: readonly EllipticMeshReplacement[] = [
  {
    centreWorldM: [111.415, 999.258],
    coreRadiusRatio: 0.84,
    filePattern: "3894_58189",
    maximumY: 76,
    minimumAbsNormalY: 0.12,
    minimumY: 38,
    radiiM: [53, 41],
    reason:
      "The source mesh's Sony Center Forum canopy is superseded by the " +
      "OSM-panel and Arup-dimensioned lightweight roof. The outer annulus " +
      "keeps near-vertical building facades while removing roof-facing " +
      "triangles; the inner core removes the old mast and cable clutter.",
    rotationDegrees: 29.465,
  },
];

export function meshReplacementsFor(
  file: string,
): readonly EllipticMeshReplacement[] {
  return MESH_REPLACEMENTS.filter((replacement) =>
    file.includes(replacement.filePattern),
  );
}

function replacementCoordinates(
  point: Vector3,
  replacement: EllipticMeshReplacement,
): [number, number] {
  const rotation = (replacement.rotationDegrees * Math.PI) / 180;
  const dx = point.x - replacement.centreWorldM[0];
  const dz = point.z - replacement.centreWorldM[1];
  const localX = dx * Math.cos(rotation) + dz * Math.sin(rotation);
  const localZ = -dx * Math.sin(rotation) + dz * Math.cos(rotation);
  return [localX / replacement.radiiM[0], localZ / replacement.radiiM[1]];
}

export function triangleMatchesReplacement(
  vertices: readonly [Vector3, Vector3, Vector3],
  replacement: EllipticMeshReplacement,
): boolean {
  const centre = vertices[0]
    .clone()
    .add(vertices[1])
    .add(vertices[2])
    .multiplyScalar(1 / 3);
  if (centre.y < replacement.minimumY || centre.y > replacement.maximumY) {
    return false;
  }
  const [normalX, normalZ] = replacementCoordinates(centre, replacement);
  const radiusRatio = Math.hypot(normalX, normalZ);
  if (radiusRatio > 1) {
    return false;
  }
  if (radiusRatio <= replacement.coreRadiusRatio) {
    return true;
  }
  const normal = vertices[1]
    .clone()
    .sub(vertices[0])
    .cross(vertices[2].clone().sub(vertices[0]));
  const normalLength = normal.length();
  return (
    normalLength > 0 &&
    Math.abs(normal.y) / normalLength >= replacement.minimumAbsNormalY
  );
}

/**
 * Remove triangles superseded by an authored replacement, preserving source
 * files and all geometry outside the registered metric envelope.
 */
export function stripReplacedGeometry(
  root: Object3D,
  replacements: readonly EllipticMeshReplacement[],
): number {
  if (replacements.length === 0) return 0;
  root.updateMatrixWorld(true);
  const vertices: [Vector3, Vector3, Vector3] = [
    new Vector3(),
    new Vector3(),
    new Vector3(),
  ];
  let removedTotal = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry;
    const position = geometry.getAttribute("position");
    if (!position) return;
    const index = geometry.getIndex();
    const vertexAt = (cursor: number): number =>
      index ? index.getX(cursor) : cursor;
    const triangleCount = Math.floor(
      (index ? index.count : position.count) / 3,
    );
    const kept: number[] = [];
    let removed = 0;
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      for (let corner = 0; corner < 3; corner += 1) {
        vertices[corner]
          .fromBufferAttribute(position, vertexAt(triangle * 3 + corner))
          .applyMatrix4(object.matrixWorld);
      }
      if (
        replacements.some((replacement) =>
          triangleMatchesReplacement(vertices, replacement),
        )
      ) {
        removed += 1;
      } else {
        kept.push(
          vertexAt(triangle * 3),
          vertexAt(triangle * 3 + 1),
          vertexAt(triangle * 3 + 2),
        );
      }
    }
    if (removed > 0) {
      geometry.setIndex(new BufferAttribute(new Uint32Array(kept), 1));
      removedTotal += removed;
    }
  });
  return removedTotal;
}
