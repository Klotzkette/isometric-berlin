import { Group } from "three";
import source from "./data/northSitesV190.json";
import { eastLandmarksV187Batches } from "./eastLandmarksV187Batches";

/** Complete northern source roofs plus independent, spatially bounded accents. */
export function createNorthSitesV190(): Group {
  const root = eastLandmarksV187Batches(source.cells, false);
  root.name = "North sites v190: cemetery grounds, Platzhaus, brewery and Kastanienallee";
  root.userData.northSitesV190 = true;
  root.userData.sourceOwnerIds = source.sourceOwnerIds;
  return root;
}
