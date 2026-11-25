import source from "./data/mallBridgeRoofsV385.json";

export const MALL_PIAZZA_LOD2_PARENT = "DEBE00YY1mc0004C";
export function isFormerMallCrossing(part: { id: string; sourceId?: string }): boolean {
  return part.sourceId === MALL_PIAZZA_LOD2_PARENT &&
    (part.id === "DEBE3DUbf8929NwV" || part.id === "DEBE3DuwANtdjIMa");
}

// Each ordinal is pinned to all nine coordinates of its original triangle.
export const mallBridgeRoofTrianglesV385 = source.drawn as number[][];
let cells: Map<number, readonly [number, number | null]> | undefined;
export function retainedMallNativeRoofV385(x: number, z: number, original: number | null): number | null {
  if (original === null || x < 618 || x >= 650 || z < 923 || z >= 986) return original;
  if (!cells) {
    cells = new Map();
    for (const [cx, cz, before, after] of source.native as [number, number, number, number | null][])
      cells.set(cx * 2048 + cz, [before, after]);
  }
  const match = cells.get(Math.floor(x) * 2048 + Math.floor(z));
  return match && match[0] === original ? match[1] : original;
}
