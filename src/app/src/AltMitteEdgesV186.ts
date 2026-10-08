import { Group } from "three";
import source from "./data/altMitteEdgesV186.json";
import { altMitteEdgesV186Batches } from "./altMitteEdgesV186Batches";

/** No smooth building masses, photographs or changed source detail. */
export function createAltMitteEdgesV186(): Group {
  return altMitteEdgesV186Batches(source.cells, false);
}
