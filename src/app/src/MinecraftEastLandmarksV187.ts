import { Group } from "three";
import source from "./data/eastLandmarksV187Native.json";
import { eastLandmarksV187Batches } from "./eastLandmarksV187Batches";

/** Only independent orthogonal surface skins, never a smooth double. */
export function createMinecraftEastLandmarksV187(): Group {
  return eastLandmarksV187Batches(source.cells, true);
}
