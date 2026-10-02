import { Group } from "three";
import {
  buildSurroundingCityChunk,
  type SurroundingCityChunk,
} from "./SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "./SurroundingCity";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const ALT_MITTE_V169_GROUP =
  "Alt-Mitte complete resident source envelopes";
export const ALT_MITTE_V169_NATIVE_GROUP =
  "Alt-Mitte complete resident native source envelopes";

export type AltMitteCoreV169Source = {
  schemaVersion: 1;
  drawnChunks: { id: string; packet: SurroundingCityChunk }[];
  minecraftChunks: { id: string; packet: SurroundingCityChunk }[];
  sourceParents: unknown[];
};

/** Unpublished exact shells yield within decoding. Returning early unwinds both
 * the active packet and all completed packets, before ownership transfers. */
export function* buildAltMitteCoreV169Steps(
  payload: AltMitteCoreV169Source,
  native = false,
): Generator<void, Group> {
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.sourceParents))
    throw new Error("Invalid Alt-Mitte core source");
  const chunks = native ? payload.minecraftChunks : payload.drawnChunks;
  if (!Array.isArray(chunks)) throw new Error("Invalid Alt-Mitte core chunks");
  const root = new Group();
  root.name = native ? ALT_MITTE_V169_NATIVE_GROUP : ALT_MITTE_V169_GROUP;
  let geometryBytes = 0,
    bufferCount = 0;
  const ids = new Set<string>();
  let completed = false;
  try {
    for (const chunk of chunks) {
      if (
        !chunk ||
        typeof chunk.id !== "string" ||
        !chunk.id ||
        ids.has(chunk.id)
      )
        throw new Error("Invalid or duplicate Alt-Mitte core chunk identity");
      ids.add(chunk.id);
      const decoded = yield* buildSurroundingCityChunk(
        chunk.packet,
        `alt-mitte-v169-${chunk.id}`,
        native,
      );
      decoded.root.name = `${root.name}: ${chunk.id}`;
      decoded.root.userData.sourceGeometry =
        "Geoportal Berlin LoD2; complete measured Alt-Mitte source envelopes";
      decoded.root.userData.unsurveyedGround = false;
      decoded.root.userData.sourceEnvelopeResident = true;
      root.add(decoded.root);
      geometryBytes += decoded.geometryBytes;
      bufferCount += decoded.bufferCount;
      yield;
    }
    root.userData = {
      textureFree: true,
      sourceEnvelopeResident: true,
      facadeStreamingIndependent: true,
      fullMobileIdentical: true,
      nativeMinecraft: native,
      blockNative: native,
      keepInMinecraft: native,
      sourceParents: payload.sourceParents,
      sourceChunkIds: [...ids],
      geometryBytes,
      bufferCount,
    };
    freezeStaticSceneTransforms(root);
    completed = true;
    return root;
  } finally {
    // The packet decoder disposes its own incomplete packet. Roll back every
    // earlier packet too on cancellation or a late malformed stream.
    if (!completed) disposeSurroundingCityRoot(root);
  }
}

/** Synchronous factory for standalone worlds; identical to staged publication. */
export function createAltMitteCoreV169FromSource(
  payload: AltMitteCoreV169Source,
  native = false,
): Group {
  const steps = buildAltMitteCoreV169Steps(payload, native);
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}
