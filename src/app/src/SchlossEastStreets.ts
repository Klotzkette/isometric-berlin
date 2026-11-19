import { Group, Mesh, MeshBasicMaterial } from "three";
import source from "./data/schlossEastStreets.json";
import native from "./data/schlossEastBlockStreets.json";
import { createSourceStreetSurfaces, type StreetSource } from "./DistrictStreets";
import { createBlockStreetSurfaces } from "./HansaplatzBlockStreets";
import type { VoxelPayload } from "./MinecraftVoxelWorld";
import { correctedSchlossRowsV362, createMitteGardenRoutesV362, drawnCurbCutsV362, nativeCurbCutsV362 } from "./MitteGardenRoutesV362";
import { createNikolaikirchplatzV367 } from "./NikolaikirchplatzV367";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const SCHLOSS_EAST_STREETS_GROUP_NAME = "Schloss to Alexanderplatz mapped street extension";

export function createSchlossEastStreets(ground: VoxelPayload, minecraft = false): Group {
  if (minecraft) {
    const runs = correctedSchlossRowsV362(native.runs, nativeCurbCutsV362);
    const root = createBlockStreetSurfaces(ground, { ...native, runs }, `Block-native ${SCHLOSS_EAST_STREETS_GROUP_NAME}`,
      [0x858d89,0xd4d0c3,0xd8d5c9,0xd5d7c5]);
    root.add(createMitteGardenRoutesV362(ground, true), createNikolaikirchplatzV367(true));
    return freezeStaticSceneTransforms(root);
  }
  const root = new Group(); root.name = SCHLOSS_EAST_STREETS_GROUP_NAME;
  root.userData = { sourceGeometry: source.source, textureFree: true, additiveOnly: true };
  const blank = createSourceStreetSurfaces(ground, { source: { presentationOnly: true },
    surfaces: [source.blank_extension], curbs_m: [], markings_m: [], elevated_path_ids: [] } as StreetSource,
    "Neutral ground under requested eastern outline preview");
  blank.traverse(object => {
    if (!(object instanceof Mesh)) return;
    (object.userData.dayMaterial as MeshBasicMaterial).color.setHex(0xd5d7c5);
  });
  const streets = { ...source, curbs_m: correctedSchlossRowsV362(source.curbs_m, drawnCurbCutsV362) };
  root.add(blank, createSourceStreetSurfaces(ground, streets as unknown as StreetSource,
    "Eastern source carriageways, footways and kerbs"), createMitteGardenRoutesV362(ground, false), createNikolaikirchplatzV367(false));
  return freezeStaticSceneTransforms(root);
}
