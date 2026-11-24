import { Group } from "three";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { addSurveyTreesV380, createSurveySurfaceV380, type PrenzlauerStreetPacketV380 } from "./prenzlauerStreetsV380";
import { platzModelGroupV383 } from "./platzModelGroupV383";
import type { SurveyMeshPacket } from "./measuredPlaceGeometryV381";
import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";

export async function attachSchoenebergPlaetzeV383(entry: SurroundingChunkGeometry, id: string, native: boolean, signal?: AbortSignal) {
  const site = id.slice("schoeneberg383-".length);
  if ((site !== "winter" && site !== "noll") || entry.root.userData.schoenebergPlaetzeV383) return;
  signal?.throwIfAborted();
  const style = native ? "native" : "drawn";
  const [surface, buildings] = await Promise.all([
    import(`./data/schoenebergPlaetzeV383/${site}.json`) as Promise<{default: PrenzlauerStreetPacketV380}>,
    import(`./data/schoenebergPlaetzeV383/${site}_${style}.json`) as Promise<{default: SurveyMeshPacket[]}>,
  ]);
  signal?.throwIfAborted();
  if (entry.root.userData.schoenebergPlaetzeV383) return;
  const name = site === "winter" ? "Winterfeldtplatz und St. Matthias" : "Nollendorfplatz";
  const group = new Group();
  group.name = name;
  group.userData = { schoenebergPlaetzeV383: true, nativeMinecraft: native, keepInMinecraft: native };
  group.add(createSurveySurfaceV380(surface.default, name));
  addSurveyTreesV380(group, surface.default.trees, native);
  group.add(platzModelGroupV383(name, native, buildings.default));
  attachWorldSpaceDetail(entry, group);
  entry.root.userData.schoenebergPlaetzeV383 = true;
}
