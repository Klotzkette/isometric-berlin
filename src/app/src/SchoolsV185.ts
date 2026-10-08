import { Group } from "three";
import source from "./data/schoolsV185.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Small source-bound accents, with independent culling for the distant sites. */
export function createSchoolsV185(minecraft = false): Group {
  const root = new Group();
  root.name = minecraft ? "School recognition: block-native surface accents v185" : "School recognition: shallow facade accents v185";
  root.userData = {
    schoolsV185: true,
    textureFree: true,
    additiveOnly: true,
    sourceGeometryRetained: true,
    fullStaticDetailOnTouch: true,
    blockNative: minecraft,
    keepInMinecraft: minecraft,
    noHiddenSolidInfill: true,
  };
  for (const school of source.schools) {
    const start = minecraft ? school.firstNative : school.firstBox;
    const count = minecraft ? school.nativeCount : school.boxCount;
    const rows = (minecraft ? source.nativeRows : source.boxes).slice(start, start + count);
    const mesh = justicePalaceV183Boxes(rows, minecraft);
    mesh.name = `${school.name}: eave, corner and console course`;
    mesh.userData.sourceOwner = school.owner;
    root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
