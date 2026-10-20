import source from "./data/steglitzCourtGroundV251.json";
import navigation from "./data/steglitzV182Navigation.json";
import { steglitzSchoolV250Fingerprint } from "./steglitzSchoolV250";

type Row = number[];
type Entry = {owner: string; boxes: Row[]; rods: Row[]; nativeRows: Row[]};
const owners = new Set([source.owner, "DEBE06YYB0000nL1", "DEBE06YYB0000nx8"]);
let verified: boolean | undefined;

/** Missing/changed measured school geometry disables this additive detail.
 * The only retained working state is a boolean, never decoded instance arrays. */
export function steglitzCourtGroundV251Enabled(): boolean {
  if (verified === undefined) {
    verified = steglitzSchoolV250Fingerprint(
      navigation.buildings.filter(part => owners.has(part.owner)),
    ) === source.sourceReceipt;
  }
  return verified;
}

function worldRows(rows: Row[], rod = false): Row[] {
  return rows.map(row => row.map((value, index) =>
    index === row.length - 1 ? source.palette[value]
      : index < (rod ? 6 : 3) ? value + source.origin[index % 3] : value));
}

/** Append to the existing school batch. No extra draw, texture or frame work. */
export function appendSteglitzCourtGroundV251<T extends Entry>(entry: T): T {
  if (entry.owner !== source.owner || !steglitzCourtGroundV251Enabled()) return entry;
  return {...entry,
    boxes: [...entry.boxes, ...worldRows(source.boxes)],
    rods: [...entry.rods, ...worldRows(source.rods, true)],
    nativeRows: [...entry.nativeRows, ...worldRows(source.nativeRows)],
  };
}
