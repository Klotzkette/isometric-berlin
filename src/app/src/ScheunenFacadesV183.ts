import { Group } from "three";
import source from "./data/scheunenFacadesV183.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const SCHEUNEN_FACADES_V183_GROUP = "Scheunenviertel source-bound projecting cornices and plinths v183";

/** A shallow addition; streamed source buildings/windows keep their own owners. */
export function createScheunenFacadesV183(): Group {
  const root = new Group();
  root.name = SCHEUNEN_FACADES_V183_GROUP;
  root.userData = { textureFree: true, additiveOnly: true, sourceGeometryRetained: true,
    fullStaticDetailOnTouch: true, sourceSha256: source.sourceSha256,
    sourceStatus: source.policy, wallCount: 97 };
  const members = justicePalaceV183Boxes(source.boxes);
  members.name = "Shallow eave caps, undercuts, plinths and lips on 97 retained walls";
  root.add(members);
  return freezeStaticSceneTransforms(root);
}
