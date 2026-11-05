import { Group } from "three";
import encoded from "./data/lindenEastContextV315.json";
import { decodeLosslessGzipJson } from "./losslessGzipBase85";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { createPackedRootV307, type RequiredPackedV307 } from "./requiredPackedRootV307";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { releaseScratchBuffer } from "./releaseScratchBuffer";

type Part = { key: string; native: boolean; boxCount: number; boxes: string; curved?: RequiredPackedV307 };
const diagonalOwner = Symbol("Hackesches Quartier source-bound diagonal structure v315");

function rows(part: Part): number[][] {
  const bytes = decodeBase64Bytes(part.boxes);
  const components = part.native ? 6 : 7, stride = (components + 1) * 4;
  try {
    if (part.boxCount < 1 || part.boxCount > 2000 || bytes.byteLength !== part.boxCount * stride)
      throw Error("Incomplete v315 source-bound fittings");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return Array.from({ length: part.boxCount }, (_, i) => [
      ...Array.from({ length: components }, (_, j) => view.getFloat32(i * stride + j * 4, true)),
      view.getUint32(i * stride + components * 4, true),
    ]);
  } finally { releaseScratchBuffer(bytes.buffer); }
}

/** Three bounded facades on complete retained official owners. Decoration only:
 * no building replacement, collision, terrain, roof or courtyard alteration. */
export function createLindenEastContextV315(native = false): Group {
  const parts = decodeLosslessGzipJson(encoded.payload) as Part[];
  if (parts.length !== 6 || parts.filter(p => p.native === native).length !== 3)
    throw Error("Incomplete v315 facade catalogue");
  const root = new Group();
  root.name = "Unter den Linden, Hackesches Quartier and Mohrenstrasse details v315";
  root.userData = {
    textureFree: true, sourceGeometryRetained: true, fullStaticDetailOnTouch: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native,
  };
  try {
    for (const part of parts) {
      if (part.native !== native) continue;
      const mesh = justicePalaceV183Boxes(rows(part), native);
      mesh.name = part.key;
      root.add(mesh);
      if (part.curved) root.add(createPackedRootV307(diagonalOwner, part.key, false, [part.curved], {}));
    }
    return freezeStaticSceneTransforms(root);
  } catch (error) {
    root.traverse(object => {
      const mesh = object as import("three").Mesh;
      mesh.geometry?.dispose();
      mesh.userData.dayMaterial?.dispose();
      mesh.userData.nightMaterial?.dispose();
    });
    throw error;
  }
}
