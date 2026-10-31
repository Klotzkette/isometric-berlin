import data from "./data/potsdamerCorridorV288Owners.json";

type SourcePart = { id: string; [key: string]: unknown };
const source = data as unknown as {
  schemaVersion: number; oldPrisms: SourcePart[]; retainedPrisms: SourcePart[];
  nativeGrid: Record<string, number>; nativeRows: { index: number; row: number[][] }[]; nativeColumns: number[][];
};
export const POTSDAMER_CORRIDOR_CORE_IDS_V288: ReadonlySet<string> = new Set(source.oldPrisms.map(p => p.id));
const nativeColumns: ReadonlySet<string> = new Set(source.nativeColumns.map(row => row.join(",")));
function own(value: object, key: PropertyKey): unknown {
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d?.enumerable && "value" in d ? d.value : undefined;
}
/** Source validation never invokes accessors or accepts hidden/sparse fields. */
function exact(value: unknown, expected: unknown): boolean {
  if (!expected || typeof expected !== "object") return value === expected;
  if (!value || typeof value !== "object" || Array.isArray(value) !== Array.isArray(expected)) return false;
  const keys = Reflect.ownKeys(expected), actual = Reflect.ownKeys(value);
  if (keys.length !== actual.length || actual.some(key => !keys.includes(key))) return false;
  return keys.every(key => key === "length" && Array.isArray(expected) ?
    Object.getOwnPropertyDescriptor(value, "length")?.value === expected.length : exact(own(value, key), own(expected, key)));
}

/** Five exact proved OSM-height fallbacks only; the caller must first attach
 * the complete required source replacements in the same transaction. */
export function isPotsdamerCorridorOldCoreV288(part: unknown): boolean {
  try {
    if (!part || typeof part !== "object") return false;
    const id = own(part, "id");
    if (typeof id !== "string" || !POTSDAMER_CORRIDOR_CORE_IDS_V288.has(id)) return false;
    const expected = source.oldPrisms.find(p => p.id === id);
    return !!expected && exact(part, expected);
  } catch { return false; }
}

export function admitsPotsdamerCorridorCoreV288(payload: unknown): boolean {
  try {
    if (!payload || typeof payload !== "object") return false;
    const buildings = own(payload, "buildings");
    if (!Array.isArray(buildings)) return false;
    const length = Object.getOwnPropertyDescriptor(buildings, "length")?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > 100_000) return false;
    const expected = [...source.oldPrisms, ...source.retainedPrisms];
    const ids = new Set(expected.map(p => p.id)), seen = new Set<string>();
    for (let i = 0; i < length; i++) {
      const p = own(buildings, String(i));
      if (!p || typeof p !== "object") continue;
      const id = own(p, "id");
      if (typeof id !== "string" || !ids.has(id)) continue;
      if (seen.has(id) || !exact(p, expected.find(e => e.id === id))) return false;
      seen.add(id);
    }
    return seen.size === ids.size;
  } catch { return false; }
}

/** Full affected rows include all neighbouring runs. The large read-only row
 * receipt is construction-local; no constructor/model dependency enters workers. */
export function admitsPotsdamerCorridorNativeV288(payload: unknown): boolean {
  try {
    if (!payload || typeof payload !== "object" || own(payload, "schema_version") !== 2 || own(payload, "cell_m") !== 4 ||
        !exact(own(payload, "grid"), source.nativeGrid)) return false;
    const rows = own(payload, "building_rows");
    return Array.isArray(rows) && source.nativeRows.every(r => exact(own(rows, String(r.index)), r.row));
  } catch { return false; }
}

/** Only use after source admission and complete native construction. */
export function isPotsdamerCorridorOldNativeColumnV288(column: readonly number[]): boolean {
  return column.length === 5 && nativeColumns.has(column.join(","));
}
