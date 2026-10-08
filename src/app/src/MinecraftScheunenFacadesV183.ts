import { Group } from "three";
import source from "./data/scheunenFacadesV183Native.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const SCHEUNEN_FACADES_V183_NATIVE_GROUP = "Scheunenviertel independent native cornices and plinths v183";

export function createMinecraftScheunenFacadesV183(): Group {
  const root = new Group();
  root.name = SCHEUNEN_FACADES_V183_NATIVE_GROUP;
  root.userData = { textureFree: true, additiveOnly: true, sourceGeometryRetained: true,
    keepInMinecraft: true, blockNative: true, independentNativePayload: true };
  const members = justicePalaceV183Boxes(source.nativeRows, true);
  members.name = "Orthogonal source-aligned cornice and plinth steps";
  root.add(members);
  return freezeStaticSceneTransforms(root);
}
