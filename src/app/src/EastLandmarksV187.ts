import { Group } from "three";
import source from "./data/eastLandmarksV187.json";
import { eastLandmarksV187Batches } from "./eastLandmarksV187Batches";

/** Independent drawn source family; no source simplification on touch. */
export function createEastLandmarksV187(): Group {
  return eastLandmarksV187Batches(source.cells, false);
}
