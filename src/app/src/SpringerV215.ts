import { Group } from "three";
import drawn from "./data/springerV215Drawn.json";
import native from "./data/springerV215Minecraft.json";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "./SurroundingCityGeometry";
import { SPRINGER_V215_OWNER, SPRINGER_V215_CURRENT_OWNER } from "./springerV215Profile";

export const SPRINGER_V215_GROUP = "Zentrales Springergebäude current OSM envelope v215";

/** Standalone audit factory. Production installs the same required packet in
 * the Alt-Mitte publication transaction, never a second outline-layer shell. */
export function* buildSpringerV215Steps(blockNative = false): Generator<void, Group> {
  const result=yield* buildSurroundingCityChunk(
    (blockNative?native:drawn) as unknown as SurroundingCityChunk,
    "springer-current-v215",blockNative,
  );
  result.root.name=SPRINGER_V215_GROUP;
  Object.assign(result.root.userData,{
    springerV215:true,sourceOwner:SPRINGER_V215_CURRENT_OWNER,
    transferredOwner:SPRINGER_V215_OWNER,textureFree:true,
    fullStaticDetailOnTouch:true,fullMobileIdentical:true,
    blockNative,nativeMinecraft:blockNative,keepInMinecraft:blockNative,
    geometryBytes:result.geometryBytes,
  });
  return result.root;
}

export function createSpringerV215(blockNative = false): Group {
  const steps=buildSpringerV215Steps(blockNative);
  let next=steps.next();
  while (!next.done) next=steps.next();
  return next.value;
}
