import { Group, InstancedMesh, Mesh } from "three";
import { clipGroundSlabsThroughOpenings, clipGroundSurfaceThroughOpenings } from "./FidelityGroundOpeningsV296";
import { POTSDAMER_SOUTH_ACCESS_NAME, potsdamerSouthGroundOpenings } from "./PotsdamerSouthAccess";
import { createPotsdamerPassarelle, potsdamerPassarelleGroundOpenings } from "./PotsdamerPassarelle";
import type { HbfOpeningV291 } from "./HbfGeometryOpeningsV291";

const groundSlabs = new Set(["Drawn ground slabs", "Voxel ground runs"]);
const paving = /^(District asphalt carriageways|District mapped paved walkways|smooth (paved paths|park paths|earth desire paths|timber paths|metal paths and steps|carriageways))$/;

/** Only published surface carriers can mask the new underground entrance.
 * A progressive Drawn surface packet reuses the exact same cut on arrival. */
function cutStationGround(root: Group, native: boolean, openings: readonly HbfOpeningV291[], name: string): boolean {
  let cutSlab = false;
  root.traverse(object => {
    if (object instanceof InstancedMesh && groundSlabs.has(object.name)) {
      if (clipGroundSlabsThroughOpenings(object, openings, native, name)) cutSlab = true;
    } else if (object instanceof Mesh && !(object instanceof InstancedMesh) && paving.test(object.name)) {
      const original = object.geometry;
      original.computeBoundingBox();
      const box = original.boundingBox;
      if (!box || !openings.some(({ bounds: { min, max } }) => box.min.x <= max[0] && box.max.x >= min[0] &&
        box.min.y <= max[1] && box.max.y >= min[1] && box.min.z <= max[2] && box.max.z >= min[2])) return;
      const cut = clipGroundSurfaceThroughOpenings(original, openings);
      if (cut === original) return;
      object.geometry = cut;
      original.dispose();
    }
  });
  return cutSlab;
}

export function cutPotsdamerSouthGround(root: Group, native: boolean, requireSlab: boolean): boolean {
  if (requireSlab && !root.getObjectByName(POTSDAMER_SOUTH_ACCESS_NAME)) return false;
  const cut = cutStationGround(root, native, potsdamerSouthGroundOpenings(native),
    "Potsdamer Platz retained pavement around south descent");
  if (requireSlab && cut) root.userData.potsdamerSouthPublicAccess = true;
  return cut;
}

export function cutPotsdamerPassarelleGround(root: Group, native: boolean): boolean {
  return cutStationGround(root, native, potsdamerPassarelleGroundOpenings(native),
    "Potsdamer Platz retained pavement above Mittelpassarelle");
}

export function addPotsdamerPassarelle(root: Group, native: boolean): void {
  if (root.userData.potsdamerPassarellePublicAccess || !cutPotsdamerPassarelleGround(root, native)) return;
  root.add(createPotsdamerPassarelle(native));
  root.userData.potsdamerPassarellePublicAccess = true;
}
