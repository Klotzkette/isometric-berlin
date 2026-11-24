import {attachWorldSpaceDetail} from "./attachWorldSpaceDetail";
import {createLocalColourGeometry} from "./localColourGeometryV381";
import type {SurroundingChunkGeometry} from "./SurroundingCityGeometry";

const owner = "DEBE03YY600004DV";

/** The historical v205 source already retires the tile's coarse building geometry.
 * Its navigation row identifies the exact host for this complete replacement. */
export async function attachRykeBasilicaV381(
  entry: SurroundingChunkGeometry, id: string, native: boolean, signal: AbortSignal,
) {
  if (id !== "6_-4" || signal.aborted || entry.root.userData.rykeBasilicaV381) return;
  if (!entry.nav.buildings.some(building => building.sourceId === owner && "parentId" in building && building.parentId === owner)) return;
  const {default: packet} = native
    ? await import("./data/rykeBasilicaV381-native.json")
    : await import("./data/rykeBasilicaV381-drawn.json");
  if (signal.aborted || entry.root.userData.rykeBasilicaV381) return;
  const model = createLocalColourGeometry("Synagoge Rykestraße", native, packet, 26000);
  model.userData.rykeBasilicaV381 = true;
  model.userData.sourceOwner = owner;
  attachWorldSpaceDetail(entry, model);
  entry.root.userData.rykeBasilicaV381 = true;
}
