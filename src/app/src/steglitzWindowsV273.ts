import source from "./data/steglitzWindowsV273.json";
import original from "./data/steglitzV182Source.json";
import native from "./data/steglitzV182Native.json";
import street from "./data/steglitzSchoolV250.json";
import courtyard from "./data/steglitzCourtyardV251.json";
import { steglitzSchoolV250Fingerprint } from "./steglitzSchoolV250";
import {
  steglitzCourtyardV251Enabled, steglitzCourtyardV251SourceBoxes,
  steglitzCourtyardV251NativeRows, steglitzCourtyardV251SurfaceColor,
} from "./steglitzCourtyardV251";

type Row = number[];
type Entry = { owner: string; boxes: Row[]; rods: Row[]; nativeRows: Row[] };
type Inputs = Record<keyof typeof source.fingerprints, unknown>;

export function verifySteglitzWindowsV273Receipt(inputs: Inputs): boolean {
  try {
    return (Object.keys(source.fingerprints) as (keyof Inputs)[]).every(
      key => steglitzSchoolV250Fingerprint(inputs[key]) === source.fingerprints[key],
    );
  } catch { return false; }
}
let verified: boolean | undefined;
/** Cache only the verdict, never the weak source arrays or decoded geometry. */
export function steglitzWindowsV273Enabled(): boolean {
  if (verified === undefined) verified = steglitzCourtyardV251Enabled()
    && verifySteglitzWindowsV273Receipt({ sourceBoxes: original.boxes,
      sourceSurfaces: original.surfaces, nativeRows: native.boxes, v250: street, v251: courtyard });
  return verified;
}

/** Original indexed source rows enter here, before either old facade filter. */
export function steglitzWindowsV273SourceBoxes(rows: Row[]): Row[] {
  const baseline = steglitzCourtyardV251SourceBoxes(rows);
  if (!steglitzWindowsV273Enabled()) return baseline;
  const obsolete = new Set(source.removeSourceBoxes.map(i => rows[i]));
  return baseline.filter(row => !obsolete.has(row));
}

/** Every existing native cell and dimension remains; only old pane paint yields. */
export function steglitzWindowsV273NativeRows(rows: Row[]): Row[] {
  const baseline = steglitzCourtyardV251NativeRows(rows);
  if (!steglitzWindowsV273Enabled()) return baseline;
  const paints = new Map(source.nativeColors.map(r => [r[0], r[1]]));
  return baseline.map((r, i) => paints.has(i) ? [...r.slice(0, 6), paints.get(i)!] : r);
}
export function steglitzWindowsV273SurfaceColor(index: number, originalColor: number): number {
  const baseline = steglitzCourtyardV251SurfaceColor(index, originalColor);
  return steglitzWindowsV273Enabled()
    ? source.surfaceColors.find(r => r[0] === index)?.[1] ?? baseline : baseline;
}

/** Append after the complete v250/v251 batch; no existing photo detail changes. */
export function appendSteglitzWindowsV273<T extends Entry>(entry: T): T {
  if (entry.owner !== source.owner || !steglitzWindowsV273Enabled()) return entry;
  const decode = (rows: Row[], rod = false): Row[] => rows.map(row => row.map((v, i) => {
    if (i === row.length - 1) return source.palette[v];
    if (i < (rod ? 7 : 6)) return v / 100 + (i < (rod ? 6 : 3) ? source.origin[i % 3] : 0);
    return v / 10000;
  }));
  return { ...entry, boxes: [...entry.boxes, ...decode(source.boxes)],
    rods: [...entry.rods, ...decode(source.rods, true)],
    nativeRows: [...entry.nativeRows, ...decode(source.nativeRows)] };
}
