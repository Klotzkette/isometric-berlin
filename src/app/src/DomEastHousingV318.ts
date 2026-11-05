import { Group, type Mesh } from "three";
import encoded from "./data/domEastHousingV318.json";
import { decodeLosslessGzipJson } from "./losslessGzipBase85";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { decodeLosslessWordPlanesV309 } from "./losslessWordStreamV309";
import { releaseScratchBuffer } from "./releaseScratchBuffer";

type Part = {
  key: string; native: boolean; count: number;
  profileCount: number; profiles: string; profilesCodec: string;
  patterns: number[][][]; allRowWordsSha256: string;
};

/** Shallow recognition on the complete retained DDR residential bar east of
 * the Dom. The original roof, podium, windows, walls and navigation stay owned
 * by the existing source. Native members fit its independent cardinal faces. */
export function createDomEastHousingV318(native = false): Group {
  const parts = decodeLosslessGzipJson(encoded.payload) as Part[];
  if (parts.length !== 2 || parts[0].native || !parts[1].native)
    throw Error("Incomplete Dom-east housing facade catalogue");
  const part = parts[native ? 1 : 0], rows: number[][] = [];
  const components = native ? 6 : 7;
  if (part.profilesCodec !== "u32-delta-byteplanes-stride1-v1" ||
      !Number.isInteger(part.profileCount) || part.profileCount < 1 || part.profileCount > 2000)
    throw Error("Invalid Dom-east housing profile inventory");
  const words = decodeLosslessWordPlanesV309(part.profiles, part.profileCount * components, 1);
  const floats = new Float32Array(words.buffer, words.byteOffset, words.length);
  try { for (let i = 0; i < part.profileCount; i++) {
    const profile = Array.from({ length: components }, (_, j) =>
      (j < components - 2 ? floats : words)[j * part.profileCount + i]);
    const [x, z, width, depth] = profile;
    const colour = profile[native ? 4 : 5], index = profile[native ? 5 : 6];
    const pattern = part.patterns[index];
    if (!Number.isInteger(index) || !pattern || profile.length !== (native ? 6 : 7))
      throw Error("Invalid Dom-east housing fitting profile");
    for (const [y, height] of pattern) {
      const row = [x, y, z, width, height, depth];
      if (!native) row.push(profile[4]);
      row.push(colour);
      if (!row.every(Number.isFinite) || width <= 0 || height <= 0 || depth <= 0)
        throw Error("Invalid Dom-east housing fitting dimensions");
      rows.push(row);
    }
  } } finally { if (words.buffer instanceof ArrayBuffer) releaseScratchBuffer(words.buffer); }
  if (rows.length !== part.count || rows.length < 100 || rows.length > 10000)
    throw Error("Incomplete Dom-east housing fitting inventory");
  const root = new Group();
  root.name = "Karl-Liebknecht-Strasse DDR residential loggias v318";
  root.userData = {
    sourceGeometryRetained: true, textureFree: true, fullStaticDetailOnTouch: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native,
  };
  try {
    const mesh = justicePalaceV183Boxes(rows, native);
    mesh.name = part.key;
    root.add(mesh);
    return freezeStaticSceneTransforms(root);
  } catch (error) {
    root.traverse(object => {
      const mesh = object as Mesh;
      mesh.geometry?.dispose();
      mesh.userData.dayMaterial?.dispose(); mesh.userData.nightMaterial?.dispose();
    });
    throw error;
  }
}
