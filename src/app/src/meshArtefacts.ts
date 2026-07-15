import { Box3, BufferAttribute, Mesh, Object3D, Vector3 } from "three";

/**
 * Known photogrammetry reconstruction artefacts in the official Berlin 3D
 * Mesh tiles: floating "sky blobs" with no physical counterpart. They are
 * removed triangle-exact at load time; the committed source tiles stay
 * untouched (regenerating them requires the raw mesh inputs, see
 * docs/data.md). A triangle is dropped when ANY of its vertices lies
 * inside an artefact box: the boxes are defined to contain no surveyed
 * geometry, and blob artefacts often connect to the terrain via long,
 * thin reconstruction spikes that only partially enter the volume.
 */
export type SkyArtefact = {
  /** Substring of the mesh file name this artefact belongs to. */
  filePattern: string;
  /** World-space box fully containing the floating artefact. */
  box: Box3;
  /** Evidence note: why nothing real can exist in this volume. */
  reason: string;
};

export const MESH_SKY_ARTEFACTS: readonly SkyArtefact[] = [
  {
    filePattern: "3890_58200",
    box: new Box3(
      new Vector3(-147.5, 45.0, -83.5),
      new Vector3(-113.0, 62.5, -76.0),
    ),
    reason:
      "Dark reconstruction blob floating 47-61 m over the Chancellery's " +
      "north side (Kanzlerpark). The leadership cube tops out at 36 m plus " +
      "roof plant, and the tallest park poplars stay below 45 m, so no " +
      "surveyed structure can occupy this volume.",
  },
];

export function skyArtefactsFor(file: string): readonly SkyArtefact[] {
  return MESH_SKY_ARTEFACTS.filter((artefact) =>
    file.includes(artefact.filePattern),
  );
}

/**
 * Remove all triangles that lie fully inside one of the artefact boxes.
 * Returns the number of removed triangles across the subtree.
 */
export function stripSkyArtefacts(
  root: Object3D,
  artefacts: readonly SkyArtefact[],
): number {
  if (artefacts.length === 0) {
    return 0;
  }
  root.updateMatrixWorld(true);
  const corners = [new Vector3(), new Vector3(), new Vector3()];
  let removedTotal = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    const geometry = object.geometry;
    const position = geometry.getAttribute("position");
    if (!position) {
      return;
    }
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
        corners[corner]
          .fromBufferAttribute(position, vertexAt(triangle * 3 + corner))
          .applyMatrix4(object.matrixWorld);
      }
      const insideArtefact = artefacts.some(
        (artefact) =>
          artefact.box.containsPoint(corners[0]) ||
          artefact.box.containsPoint(corners[1]) ||
          artefact.box.containsPoint(corners[2]),
      );
      if (insideArtefact) {
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
