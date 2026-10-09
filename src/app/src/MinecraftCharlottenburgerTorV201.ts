import { Group } from "three";
import source from "./data/charlottenburgerTorV201.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { CHARLOTTENBURGER_TOR_PROFILE } from "./charlottenburgerTorV201Profile";

/** Separate orthogonal surface blocks for both source-aligned gate wings. */
export function createMinecraftCharlottenburgerTorV201(): Group {
  const root = new Group();
  root.name = "Charlottenburger Tor native source-aligned wings v201";
  root.userData = { nativeMinecraft: true, keepInMinecraft: true, textureFree: true,
    noHiddenSolidInfill: true, charlottenburgerTor: CHARLOTTENBURGER_TOR_PROFILE,
    sourcePartCounts: source.partCounts };
  const mesh = justicePalaceV183Boxes(source.boxes, true);
  mesh.name = "Charlottenburger Tor native columns pylons cornices and bronze groups";
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
