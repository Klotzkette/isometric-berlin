import { Group } from "three";
import source from "./data/altMitteEdgesV186.json";
import { altMitteEdgesV186Batches } from "./altMitteEdgesV186Batches";

/** Only allocate native geometry: the compact source profiles are shared data. */
export function createMinecraftAltMitteEdgesV186(): Group {
  return altMitteEdgesV186Batches(source.cells, true);
}
