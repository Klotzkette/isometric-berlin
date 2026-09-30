import source from "./data/unterDenLindenBlockStreets.json";
import { createBlockStreetSurfaces } from "./HansaplatzBlockStreets";
import type { VoxelPayload } from "./MinecraftVoxelWorld";

export function createUnterDenLindenBlockStreets(ground: VoxelPayload) {
  return createBlockStreetSurfaces(ground, source, "Block-native Unter den Linden complete avenue",
    [0x858d89,0xd4d0c3,0xd9c9a6,0x8eab79,0xe7e3d8],4);
}
