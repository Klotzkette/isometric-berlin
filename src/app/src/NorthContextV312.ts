import { Group } from "three";
import data from "./data/northContextV312.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { createPackedRootV307, type RequiredPackedV307 } from "./requiredPackedRootV307";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { createNorthernNavigationV309, type NorthernSolidV309 } from "./NorthernNavigationV309";

type ContextPart = {
  key: string;
  native: boolean;
  boxCount: number;
  boxes: string;
  curved?: RequiredPackedV307;
};

const parts = data as ContextPart[];
const arches = Symbol("Stettiner Vorortbahnhof arches v312");
const solidParts = new Set([
  "Park am Nordbahnhof retaining edge",
  "Helmholtzplatz table tennis",
]);

function boxRows(part: ContextPart): number[][] {
  const bytes = decodeBase64Bytes(part.boxes);
  const components = part.native ? 6 : 7;
  const stride = (components + 1) * 4;
  if (part.boxCount < 1 || bytes.byteLength !== part.boxCount * stride)
    throw new Error("Incomplete v312 detail batch");
  const words = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rows: number[][] = [];
  for (let i = 0; i < part.boxCount; i++) {
    const row = Array.from({ length: components }, (_, j) =>
      words.getFloat32(i * stride + j * 4, true));
    row.push(words.getUint32(i * stride + components * 4, true));
    rows.push(row);
  }
  return rows;
}

/** Static detail on the retained Alt-Mitte and existing street/park owners. */
export function createNorthContextV312(native = false): Group {
  const root = new Group();
  root.name = "Nordbahnhof, Danziger Straße and Helmholtzplatz details v312";
  root.userData = {
    textureFree: true,
    fullStaticDetailOnTouch: true,
    nativeMinecraft: native,
    blockNative: native,
    keepInMinecraft: native,
  };
  for (const part of parts) {
    if (part.native !== native) continue;
    const batch = justicePalaceV183Boxes(boxRows(part), native);
    batch.name = part.key;
    root.add(batch);
    if (part.curved) {
      root.add(createPackedRootV307(arches, part.curved.key, false, [part.curved], {}));
    }
  }
  return freezeStaticSceneTransforms(root);
}

/** Optional walking collision uses the very same rendered boxes. It leaves
 * the spaces beneath the tabletops and around both ends of the wall open. */
function northContextSolidsV312(native: boolean): NorthernSolidV309[] {
  const solids: NorthernSolidV309[] = [];
  for (const part of parts) {
    if (part.native !== native || !solidParts.has(part.key)) continue;
    for (const [x, y, z, width, height, depth, yaw] of boxRows(part)) {
      const angle = native ? 0 : yaw;
      const c = Math.cos(angle), s = Math.sin(angle);
      const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [
        x + (c * u * width + s * v * depth) / 2,
        z + (-s * u * width + c * v * depth) / 2,
      ]);
      solids.push({ ring, minY: y - height / 2, maxY: y + height / 2 });
    }
  }
  return solids;
}

const navigation = new Map<boolean, ReturnType<typeof createNorthernNavigationV309>>();

export function northContextSolidAtV312(
  x: number, y: number, z: number, radius: number, native: boolean,
): boolean {
  if (y < 3 || y > 10) return false;
  const nearWall = x >= 1073 - radius && x <= 1110 + radius
    && z >= -1634 - radius && z <= -1586 + radius;
  const nearTables = x >= 3194 - radius && x <= 3286 + radius
    && z >= -2672 - radius && z <= -2594 + radius;
  if (!nearWall && !nearTables) return false;
  let index = navigation.get(native);
  if (!index) {
    index = createNorthernNavigationV309(northContextSolidsV312(native), () => true);
    navigation.set(native, index);
  }
  return index.solidAt(x, y, z, radius);
}
