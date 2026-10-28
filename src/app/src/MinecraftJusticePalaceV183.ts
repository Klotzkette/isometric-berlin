import { Group } from "three";
import source from "./data/justicePalaceV183Native.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { createCharlottenburgCupolaV183 } from "./CharlottenburgCupolaV183";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { littenInstanzV257Rows } from "./littenInstanzV257";
import { charlottenburgParkV281Rows } from "./CharlottenburgParkV281";

export const JUSTICE_PALACE_V183_NATIVE_GROUP = "Independent native courthouse and palace recognition v183";

/** Separate lazy native payload, without any smooth lines or city-shell fill. */
export function createMinecraftJusticePalaceV183(): Group {
  const root = new Group();
  root.name = JUSTICE_PALACE_V183_NATIVE_GROUP;
  root.userData = { textureFree: true, additiveOnly: true, blockNative: true, keepInMinecraft: true, sourceGeometryRetained: true, independentNativePayload: true };
  const fittingsV257 = littenInstanzV257Rows(true);
  const parkV281=charlottenburgParkV281Rows(true);
  const blocks = justicePalaceV183Boxes([...source.nativeRows, ...fittingsV257, ...parkV281], true);
  blocks.userData.charlottenburgParkV281Rows=parkV281.length;
  blocks.userData.littenInstanzV257Rows = fittingsV257.length;
  blocks.name = "Orthogonal facade strips and stepped upper architectural contours";
  root.add(blocks, createCharlottenburgCupolaV183(true));
  return freezeStaticSceneTransforms(root);
}
