import source from "./data/steglitzSchoolV250.json";
import original from "./data/steglitzV182Source.json";
import native from "./data/steglitzV182Native.json";
import refinements from "./data/steglitzV246Details.json";
import places from "./data/schoolsPlacesV205.json";

export const STEGLITZ_SCHOOL_V250_OWNER = "DEBE06YYB0000AUq";

type Row = number[];
type SchoolEntry = { owner: string; boxes: Row[]; rods: Row[]; nativeRows: Row[]; labels: {text:string;center:Row;direction:Row;normal:Row;height:number;color:number}[] };

type ReceiptInputs = Record<keyof typeof source.fingerprints, unknown>;

/** Typed, streaming receipt: no stringify copy or source arrays survive hashing. */
export function steglitzSchoolV250Fingerprint(value: unknown): string {
  let result = 2166136261;
  const buffer = new ArrayBuffer(8), bytes = new Uint8Array(buffer), view = new DataView(buffer);
  const encoder = new TextEncoder();
  const byte = (v: number) => { result = Math.imul(result ^ v, 16777619) >>> 0; };
  const length = (v: number) => {
    view.setUint32(0, v, true);
    for (let i = 0; i < 4; i++) byte(bytes[i]);
  };
  const walk = (item: unknown): void => {
    if (item === null) { byte(48); return; }
    if (typeof item === "boolean") { byte(item ? 84 : 70); return; }
    if (typeof item === "number") {
      byte(78); view.setFloat64(0, item, true);
      for (let i = 0; i < 8; i++) byte(bytes[i]);
    } else if (typeof item === "string") {
      const encoded = encoder.encode(item);
      byte(83); length(encoded.length); for (const v of encoded) byte(v);
    } else if (Array.isArray(item)) {
      byte(91); length(item.length); for (const child of item) walk(child); byte(93);
    } else if (typeof item === "object" && item) {
      const obj = item as Record<string, unknown>, keys = Object.keys(obj).sort();
      byte(123); length(keys.length);
      for (const key of keys) { walk(key); walk(obj[key]); }
      byte(125);
    } else throw new TypeError("Unsupported school receipt value");
  };
  walk(value);
  return result.toString(16).padStart(8, "0");
}

export function verifySteglitzSchoolV250Receipt(inputs: ReceiptInputs): boolean {
  try {
    return (Object.keys(source.fingerprints) as (keyof ReceiptInputs)[]).every(
      key => steglitzSchoolV250Fingerprint(inputs[key]) === source.fingerprints[key],
    );
  } catch { return false; }
}

let verified: boolean | undefined;
/** All six receipts must agree before any old detail is changed or new detail added.
 * Only this boolean is cached: lazy constructor payloads are released normally. */
export function steglitzSchoolV250Enabled(): boolean {
  if (verified === undefined) {
    verified = verifySteglitzSchoolV250Receipt({
      sourceBoxes: original.boxes,
      sourceSurfaces: original.surfaces,
      nativeRows: native.boxes,
      refinementsBoxes: refinements.boxes,
      refinementsNativeRows: refinements.nativeRows,
      entry205: places.schools.find(entry => entry.owner === STEGLITZ_SCHOOL_V250_OWNER),
    });
  }
  return verified;
}

/** Exact old unsurveyed pane registers only; no measured source is filtered. */
export function steglitzSchoolV250SourceBoxes(rows: Row[]): Row[] {
  if (!steglitzSchoolV250Enabled()) return rows;
  const obsolete = new Set(source.remove["v182.boxes"]);
  return rows.filter((_, i) => !obsolete.has(i));
}

/** Retain every native occupied cell and dimension; correct its old paint. */
export function steglitzSchoolV250NativeRows(rows: Row[]): Row[] {
  if (!steglitzSchoolV250Enabled()) return rows;
  const colours = new Map(source.nativeColors.map(r => [r[0],r[1]]));
  return rows.map((row, i) => colours.has(i) ? [...row.slice(0,6),colours.get(i)!] : row);
}

export function steglitzSchoolV250SurfaceColor(index: number, original: number): number {
  if (!steglitzSchoolV250Enabled()) return original;
  return source.surfaceColors.find(row => row[0] === index)?.[1] ?? original;
}

/** v246 glazing belonged exactly to the superseded five/six-storey register. */
export function steglitzSchoolV250Refinements(rows: Row[], native: boolean): Row[] {
  if (!steglitzSchoolV250Enabled()) return rows;
  const obsolete = new Set(source.remove[native ? "v246.nativeRows" : "v246.boxes"]);
  return rows.filter((_, i) => !obsolete.has(i));
}

/** Reuse the existing v205 school batch; additions create no renderable. */
export function replaceSteglitzSchoolPlaceV250<T extends SchoolEntry>(entry: T): T {
  if (entry.owner !== STEGLITZ_SCHOOL_V250_OWNER || !steglitzSchoolV250Enabled()
    || steglitzSchoolV250Fingerprint(entry) !== source.fingerprints.entry205) return entry;
  const worldRows = (rows: Row[], rod = false): Row[] => rows.map(r => r.map((v,i) =>
    i < (rod ? 6 : 3) ? v + source.origin[i % 3] : v));
  return {...entry, boxes:worldRows(source.boxes), rods:worldRows(source.rods,true),
    nativeRows:worldRows(source.nativeRows), labels:[source.label]};
}
