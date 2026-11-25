import { readSourceHistoryLayer } from "./sourceHistoryLayer";
import { sourceHistoryV385 } from "./sourceHistoryV385";

const layer = readSourceHistoryLayer(
  "v384", "34cd50153bf3f593f5ce8a3680810b25ae81a7d6",
  new URL("../fixtures/source-history-v384.json", import.meta.url),
  "f395636525aa3e7681ca2d44210ff9f848f06b39e5a33d72a54675e3304c0ff5", sourceHistoryV385,
);
export const isSourceAdditionV384 = layer.isAddition;
export const sourceAtBeforeV384 = layer.restore;
export const projectSourceBeforeV384 = layer.project;
export const assertSourceLayerV384 = layer.verify;
