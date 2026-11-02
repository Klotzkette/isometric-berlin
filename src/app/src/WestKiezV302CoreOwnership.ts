import data from "./data/westKiezV302CoreOwners.json";

type SourcePart = { id: string; [key: string]: unknown };
type Source = {
  schemaVersion: number; oldPrisms: SourcePart[];
  nativeGrid: Record<string, number>; nativeClasses: unknown;
  nativeRows: { index: number; row: number[][] }[]; nativeColumns: number[][];
};
const source = data as unknown as Source;
export const WEST_KIEZ_V302_CORE_IDS: ReadonlySet<string> = new Set(source.oldPrisms.map(p => p.id));
const columns: ReadonlySet<string> = new Set(source.nativeColumns.map(row => row.join(",")));
const own = (value: object, key: PropertyKey): unknown => {
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d?.enumerable && "value" in d ? d.value : undefined;
};
/** Never invoke caller accessors, accept sparse arrays or ignore extra fields. */
function exact(value: unknown, expected: unknown): boolean {
  if (!expected || typeof expected !== "object") return value === expected;
  if (!value || typeof value !== "object" || Array.isArray(value) !== Array.isArray(expected)) return false;
  const keys = Reflect.ownKeys(expected), actual = Reflect.ownKeys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key)) && keys.every(key =>
    key === "length" && Array.isArray(expected)
      ? Object.getOwnPropertyDescriptor(value, key)?.value === expected.length
      : exact(own(value, key), own(expected, key)),
  );
}

/** This predicate alone grants no admission; root first owns the full model. */
export function isWestKiezV302OldCore(part: unknown): boolean {
  try {
    if (!part || typeof part !== "object") return false;
    const id = own(part, "id");
    if (typeof id !== "string" || !WEST_KIEZ_V302_CORE_IDS.has(id)) return false;
    return exact(part, source.oldPrisms.find(p => p.id === id));
  } catch { return false; }
}

export function admitsWestKiezV302Core(payload: unknown): boolean {
  try {
    if (!payload || typeof payload !== "object" || source.schemaVersion !== 1) return false;
    const buildings = own(payload, "buildings");
    if (!Array.isArray(buildings) || buildings.length > 100000) return false;
    const seen = new Set<string>();
    for (let i = 0; i < buildings.length; i++) {
      const part = own(buildings, String(i));
      if (!part || typeof part !== "object") continue;
      const id = own(part, "id");
      if (typeof id !== "string" || !WEST_KIEZ_V302_CORE_IDS.has(id)) continue;
      if (seen.has(id) || !isWestKiezV302OldCore(part)) return false;
      seen.add(id);
    }
    return seen.size === WEST_KIEZ_V302_CORE_IDS.size;
  } catch { return false; }
}

/** Validate complete actual affected rows, including every adjacent foreign run. */
export function admitsWestKiezV302Native(payload: unknown): boolean {
  try {
    if (!payload || typeof payload !== "object" || own(payload, "schema_version") !== 2 || own(payload, "cell_m") !== 4 ||
      !exact(own(payload, "grid"), source.nativeGrid) || !exact(own(payload, "classes"), source.nativeClasses)) return false;
    const rows = own(payload, "building_rows");
    return Array.isArray(rows) && source.nativeRows.length > 0 && source.nativeRows.every(record => exact(own(rows, String(record.index)), record.row));
  } catch { return false; }
}

/** Actual source tuples, checked only after complete source/model admission. */
export function isWestKiezV302OldNativeColumn(column: readonly number[]): boolean {
  return column.length === 5 && columns.has(column.join(","));
}
