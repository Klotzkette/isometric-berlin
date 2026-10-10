import { Group } from "three";
import source from "./data/chariteBettenhausV207.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const CHARITE_BETTENHAUS_V207_GROUP = "Charité Bettenhochhaus facade and rooftop identity v207";
export const CHARITE_BETTENHAUS_V207_IDS: ReadonlySet<string> = new Set(source.sourceIds);

/** Additive recognition: all existing source shells and native columns stay. */
export function createChariteBettenhausV207(minecraft = false): Group {
  const root = new Group();
  root.name = CHARITE_BETTENHAUS_V207_GROUP;
  root.userData = { textureFree: true, fullStaticDetailOnTouch: true,
    sourceGeometryRetained: true, sourceParent: source.sourceParent,
    sourceSha256: source.sourceSha256, sourceSuppressionIds: [],
    nativeMinecraft: minecraft, blockNative: minecraft, keepInMinecraft: minecraft,
    estimateStatus: source.estimates, profile: source.profile, stats: source.stats };
  const mesh = justicePalaceV183Boxes(minecraft ? source.nativeBlocks : source.boxes, minecraft);
  mesh.name = minecraft ? "Charité source-bound native facade blocks" : "Charité paired panes, vertical lesenes and rooftop screen";
  mesh.userData.surfaceOnly = true;
  mesh.boundingBox!.getBoundingSphere(mesh.boundingSphere!);
  root.add(mesh);
  const light = justicePalaceV183Boxes(minecraft ? source.nightNativeBlocks : source.nightBoxes, minecraft);
  light.name = "Charite lit facade window panes";
  light.userData.nightMaterial.dispose();
  delete light.userData.dayMaterial;
  delete light.userData.nightMaterial;
  light.userData.nightOnly = true;
  light.visible = false;
  light.boundingBox!.getBoundingSphere(light.boundingSphere!);
  root.add(light);
  return freezeStaticSceneTransforms(root);
}
