import {
  pointInWorldRing,
  type WorldRing,
} from "./chancelleryExtensionProfile";

type Ring = readonly (readonly number[])[];
type LegacyPrism = {
  id: string;
  ring: Ring;
  holes?: readonly Ring[];
  y0_dm: number;
  h_dm: number;
  roof: number;
};
export type AltMitteV169Part = {
  id: string;
  sourceId?: string;
  ring: Ring;
  holes: readonly Ring[];
  groundY: number;
  topY: number;
};
export type AltMitteV169Navigation = {
  legacyPrisms: readonly LegacyPrism[];
  parts: readonly AltMitteV169Part[];
  roofTriangles: readonly (readonly (readonly number[])[])[];
  /** Same ordered xyz coordinates, packed without rounding or quantization. */
  roofTriangleCoordinates?: Float64Array;
  nativeRoofCells: readonly (readonly number[])[];
  /** Lossless unions of 1m cells; x1/z1 are exclusive integer boundaries. */
  nativeRoofSpans?: readonly (readonly number[])[];
};
export const ALT_MITTE_V169_INDEX_CELL_M = 16;
const EPSILON = 1e-6;
const ROOF_TIERS = new Set([3100, 3200, 3300, 3400]);
const key = (x: number, z: number): string => `${x},${z}`;
const ringContains = (x: number, z: number, ring: Ring): boolean =>
  pointInWorldRing(x, z, ring as WorldRing);

function indexBounds(
  index: Map<string, number[]>,
  id: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): void {
  const cell = ALT_MITTE_V169_INDEX_CELL_M;
  for (let x = Math.floor(x0 / cell); x <= Math.floor(x1 / cell); x++)
    for (let z = Math.floor(z0 / cell); z <= Math.floor(z1 / cell); z++) {
      const address = key(x, z),
        bucket = index.get(address);
      if (bucket) bucket.push(id);
      else index.set(address, [id]);
    }
}

/** Construct once from committed data; every query visits only its 16m bucket.
 * The injectable constructor also permits exact ownership/courtyard fixtures. */
export function createAltMitteV169NavigationIndex(
  data: AltMitteV169Navigation,
  options: { lazy?: boolean } = {},
) {
  const buildColumns = () => {
    const columns = data.legacyPrisms.map((p) => ({
      prism: p,
      base: p.y0_dm / 10,
      top: p.y0_dm / 10 + Math.ceil(p.h_dm / 40) * 4,
      tier: ROOF_TIERS.has(p.roof),
    }));
    const columnIndex = new Map<string, number[]>();
    for (let i = 0; i < columns.length; i++) {
      let x0 = Infinity,
        z0 = Infinity,
        x1 = -Infinity,
        z1 = -Infinity;
      for (const [x, z] of columns[i].prism.ring) {
        x0 = Math.min(x0, x / 10);
        x1 = Math.max(x1, x / 10);
        z0 = Math.min(z0, z / 10);
        z1 = Math.max(z1, z / 10);
      }
      if ([x0, z0, x1, z1].every(Number.isFinite))
        indexBounds(columnIndex, i, x0, z0, x1, z1);
    }
    return {
      columns,
      columnIndex,
      prismIds: new Set(data.legacyPrisms.map((p) => p.id)),
    };
  };
  const buildDrawnRoofs = () => {
    // Keep one contiguous double buffer instead of 300,116 nested triangle/
    // vertex arrays and 75,029 derived records. The arithmetic below retains
    // the original operation order and every source bit.
    let coordinates = data.roofTriangleCoordinates;
    if (!coordinates) {
      const source = data.roofTriangles;
      coordinates = new Float64Array(source.length * 9);
      for (let i = 0; i < source.length; i++)
        for (let vertex = 0; vertex < 3; vertex++)
          for (let axis = 0; axis < 3; axis++)
            coordinates[i * 9 + vertex * 3 + axis] = source[i][vertex][axis];
    }
    if (coordinates.length % 9 !== 0) throw new Error("Incomplete navigation roof triangle");
    const count = coordinates.length / 9;
    const bounds = new Float64Array(count * 5);
    const roofIndex = new Map<string, number[]>();
    for (let i = 0; i < count; i++) {
      const j = i * 9, k = i * 5;
      const ax = coordinates[j], az = coordinates[j + 2];
      const bx = coordinates[j + 3], bz = coordinates[j + 5];
      const cx = coordinates[j + 6], cz = coordinates[j + 8];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      bounds[k] = d;
      bounds[k + 1] = Math.min(ax, bx, cx);
      bounds[k + 2] = Math.max(ax, bx, cx);
      bounds[k + 3] = Math.min(az, bz, cz);
      bounds[k + 4] = Math.max(az, bz, cz);
      if (Math.abs(d) < 1e-8) continue;
      indexBounds(
        roofIndex,
        i,
        bounds[k + 1] - EPSILON,
        bounds[k + 3] - EPSILON,
        bounds[k + 2] + EPSILON,
        bounds[k + 4] + EPSILON,
      );
    }
    return { coordinates, bounds, roofIndex };
  };
  const buildNativeRoofs = () => {
    const nativeRoof = new Map<string, number>();
    for (const [x, z, y] of data.nativeRoofCells) {
      const address = key(x, z),
        previous = nativeRoof.get(address);
      nativeRoof.set(
        address,
        previous === undefined ? y : Math.max(previous, y),
      );
    }
    const nativeSpans = data.nativeRoofSpans ?? [];
    const nativeSpanIndex = new Map<string, number[]>();
    for (let i = 0; i < nativeSpans.length; i++) {
      const [x0, z0, x1, z1] = nativeSpans[i];
      if (x1 > x0 && z1 > z0)
        indexBounds(nativeSpanIndex, i, x0, z0, x1 - 1, z1 - 1);
    }
    return { nativeRoof, nativeSpans, nativeSpanIndex };
  };
  let columnState: ReturnType<typeof buildColumns> | undefined;
  let drawnState: ReturnType<typeof buildDrawnRoofs> | undefined;
  let nativeState: ReturnType<typeof buildNativeRoofs> | undefined;
  const prepareColumns = () => (columnState ??= buildColumns());
  const prepareDrawnRoofs = () => (drawnState ??= buildDrawnRoofs());
  const prepareNativeRoofs = () => (nativeState ??= buildNativeRoofs());
  // Existing injectable callers retain eager semantics; the viewer opts into
  // representation-local preparation before publishing its first frame.
  if (!options.lazy) {
    prepareColumns();
    prepareDrawnRoofs();
    prepareNativeRoofs();
  }
  const sourceColumn = (
    x: number,
    z: number,
    base: number,
    top: number,
  ): boolean => {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(z) ||
      !Number.isFinite(base) ||
      !Number.isFinite(top)
    )
      return false;
    const { columns, columnIndex } = prepareColumns();
    const candidates = columnIndex.get(
      key(
        Math.floor(x / ALT_MITTE_V169_INDEX_CELL_M),
        Math.floor(z / ALT_MITTE_V169_INDEX_CELL_M),
      ),
    );
    if (!candidates) return false;
    for (const i of candidates) {
      const c = columns[i];
      const body =
        Math.abs(base - c.base) < 0.11 && Math.abs(top - c.top) < 0.11;
      const tier =
        c.tier &&
        Math.abs(base - c.top) < 0.11 &&
        Math.abs(top - c.top - 4) < 0.11;
      if (
        (body || tier) &&
        ringContains(x * 10, z * 10, c.prism.ring) &&
        !c.prism.holes?.some((hole) => ringContains(x * 10, z * 10, hole))
      )
        return true;
    }
    return false;
  };
  const roofAt = (x: number, z: number, native = false): number | null => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    if (native) {
      const { nativeRoof, nativeSpans, nativeSpanIndex } = prepareNativeRoofs();
      const cellX = Math.floor(x),
        cellZ = Math.floor(z);
      let highest = nativeRoof.get(key(cellX, cellZ)) ?? null;
      const candidates = nativeSpanIndex.get(
        key(
          Math.floor(cellX / ALT_MITTE_V169_INDEX_CELL_M),
          Math.floor(cellZ / ALT_MITTE_V169_INDEX_CELL_M),
        ),
      );
      if (candidates)
        for (const i of candidates) {
          const [x0, z0, x1, z1, y] = nativeSpans[i];
          if (cellX >= x0 && cellX < x1 && cellZ >= z0 && cellZ < z1)
            highest = highest === null ? y : Math.max(highest, y);
        }
      return highest;
    }
    const { coordinates, bounds, roofIndex } = prepareDrawnRoofs();
    const candidates = roofIndex.get(
      key(
        Math.floor(x / ALT_MITTE_V169_INDEX_CELL_M),
        Math.floor(z / ALT_MITTE_V169_INDEX_CELL_M),
      ),
    );
    if (!candidates) return null;
    let highest: number | null = null;
    for (const i of candidates) {
      const j = i * 9, k = i * 5;
      const d = bounds[k], x0 = bounds[k + 1], x1 = bounds[k + 2];
      const z0 = bounds[k + 3], z1 = bounds[k + 4];
      if (
        x < x0 - EPSILON ||
        x > x1 + EPSILON ||
        z < z0 - EPSILON ||
        z > z1 + EPSILON
      )
        continue;
      const ax = coordinates[j], az = coordinates[j + 2];
      const bx = coordinates[j + 3], bz = coordinates[j + 5];
      const cx = coordinates[j + 6], cz = coordinates[j + 8];
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
      const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
      if (u >= -EPSILON && v >= -EPSILON && u + v <= 1 + EPSILON) {
        const y = u * coordinates[j + 1] + v * coordinates[j + 4] + (1 - u - v) * coordinates[j + 7];
        highest = highest === null ? y : Math.max(highest, y);
      }
    }
    return highest;
  };
  return {
    sourceColumn,
    roofAt,
    prepareDrawnRoofs,
    prepareNative: () => {
      prepareColumns();
      prepareNativeRoofs();
    },
    get prismIds() {
      return prepareColumns().prismIds;
    },
    parts: data.parts,
  };
}
