import { correctFeuerwacheProfilesV267 } from "./feuerwacheKreuzbergV267Profiles";
import { Group } from "three";
import source from "./data/southKiezV185Native.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Independent shallow orthogonal contours; no smooth payload or solid fill. */
export function createMinecraftSouthKiezV185(): Group {
  const root = new Group();
  root.name = "Minecraft southern neighbourhood contours v185";
  root.userData = {
    textureFree: true, additiveOnly: true, sourceGeometryRetained: true,
    blockNative: true, keepInMinecraft: true, frontageCount: 113, mappedBenchCount: 39,
  };
  const mesh = justicePalaceV183Boxes(correctFeuerwacheProfilesV267(source.nativeRows, true), true);
  mesh.name = "Native source street/path contours, facade profiles and mapped park benches";
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
