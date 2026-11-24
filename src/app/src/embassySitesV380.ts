import {attachWorldSpaceDetail} from "./attachWorldSpaceDetail";
import {embassyIdsV380} from "./embassySitesIndexV380";
import type {SurroundingChunkGeometry} from "./SurroundingCityGeometry";
import { createLocalColourGeometry, type LocalColourPacket } from "./localColourGeometryV381";

export function createEmbassySitesV380(id: string, native: boolean, packet: LocalColourPacket) {
  return createLocalColourGeometry(id, native, packet, 20000);
}

export async function attachEmbassySitesV380(entry: SurroundingChunkGeometry, id: string, native: boolean, signal: AbortSignal) {
  if (!embassyIdsV380.has(id) || signal.aborted) return;
  const tag = id.slice("embassy380-".length) + (native ? "-native" : "-drawn");
  const {default: packet} = await import(`./data/embassySitesV380/${tag}.json`);
  if (signal.aborted || entry.root.userData.embassySitesV380) return;
  attachWorldSpaceDetail(entry, createEmbassySitesV380(id, native, packet));
  entry.root.userData.embassySitesV380 = true;
}
