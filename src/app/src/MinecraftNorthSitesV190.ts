import { Group } from "three";
import source from "./data/northSitesV190Native.json";
import { eastLandmarksV187Batches } from "./eastLandmarksV187Batches";

/** Independent orthogonal source skins; never a smooth model with rotated cubes. */
export function createMinecraftNorthSitesV190(): Group {
  const root = eastLandmarksV187Batches(source.cells, true);
  root.name = "North sites v190: native cemetery grounds, Platzhaus and brewery";
  root.userData.northSitesV190 = true;
  return root;
}
