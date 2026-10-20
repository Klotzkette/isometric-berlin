import source from "./data/playgroundsV255.json";
import type { Group } from "three";

export type PlaygroundSiteV255 = {
  id: string;
  name: string;
  rank: number | null;
  katasterfl: number;
};

const sites = new Map<string, PlaygroundSiteV255>(
  source.sites.map(site => [site.id, site]),
);
const packetSites = source.packetSites as Record<string, string>;

/** Metadata only: all geometry stays in the ordinary streamed packet lifetime. */
export function playgroundSiteV255(packetId: string): PlaygroundSiteV255 | undefined {
  return sites.get(packetSites[packetId]);
}

/** Shared by all full drawn profiles; native geometry is independently authored. */
export function annotatePlaygroundPacketV255(root: Group, packetId: string): void {
  const site = playgroundSiteV255(packetId);
  if (!site) return;
  root.userData.playgroundV255 = {
    ...site,
    areaMeaning: "official GRIS cadastral site area, not net equipped play area",
    sourceBoundEquipment: true,
    unsurveyedFittingDimensions: true,
    fullStaticDetailOnTouch: true,
  };
}
