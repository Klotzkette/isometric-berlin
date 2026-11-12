import { Group, InstancedMesh, Mesh } from "three";
import { clipGroundSlabsThroughOpenings, clipGroundSurfaceThroughOpenings } from "./FidelityGroundOpeningsV296";
import type { HbfOpeningV291 } from "./HbfGeometryOpeningsV291";

const groundNames = new Set(["Drawn ground slabs", "Voxel ground runs"]);
const paving = /^(District asphalt carriageways|District mapped paved walkways|smooth (paved paths|park paths|earth desire paths|timber paths|metal paths and steps|carriageways))$/;

/** Cut only identified ground carriers during the unpublished world transaction.
 * Progressive surface families receive the identical operation before attach. */
export function cutNordbahnhofPublicGround(world: Group, native: boolean, openings: readonly HbfOpeningV291[]): boolean {
  let changedSlabs = false;
  world.traverse(object => {
    if (object instanceof InstancedMesh && groundNames.has(object.name)) {
      if (clipGroundSlabsThroughOpenings(object, openings, native,
        "Nordbahnhof source ground outside public stair and corridor openings")) changedSlabs = true;
    } else if (object instanceof Mesh && !(object instanceof InstancedMesh) && paving.test(object.name)) {
      const original = object.geometry;
      original.computeBoundingBox();
      const box = original.boundingBox;
      if (!box || !openings.some(({ bounds: { min, max } }) => box.min.x <= max[0] && box.max.x >= min[0] &&
        box.min.y <= max[1] && box.max.y >= min[1] && box.min.z <= max[2] && box.max.z >= min[2])) return;
      const clipped = clipGroundSurfaceThroughOpenings(original, openings);
      if (clipped === original) return;
      object.geometry = clipped;
      original.dispose();
    }
  });
  return changedSlabs;
}
