import navigation from "./data/bundeswehrHospitalV215Navigation.json";
import ownership from "./data/bundeswehrHospitalV215Ownership.json";

export const BUNDESWEHR_HOSPITAL_V215_PART = /*#__PURE__*/ (() => ownership.part)();
export const BUNDESWEHR_HOSPITAL_V215_PARENT = /*#__PURE__*/ (() => ownership.owner)();
export const BUNDESWEHR_HOSPITAL_V215_ROOF_Y = /*#__PURE__*/ (() => navigation.technicalRoofY)();

type Row = (number | string)[];
/** Only audited obsolete upper-gable fittings move; lower and other owners' rows
 * retain their original values and ordering. Source JSON is never rewritten. */
export function correctedHospitalFittingsV215<T extends Row>(rows: T[], native: boolean): T[] {
  const changes = native ? ownership.adjustments.minecraft : ownership.adjustments.drawn;
  const retired = new Set(changes.retire);
  const moves = new Map(changes.moveY as [number, number][]);
  return rows.flatMap((row, i) => {
    if (retired.has(i)) return [];
    const y = moves.get(i);
    if (y === undefined) return [row];
    const corrected = [...row] as T; corrected[1] = y;
    return [corrected];
  });
}

function triangleRoofAt(triangles: number[][][], x: number, z: number): number | null {
  let highest: number | null = null;
  for (const [a,b,c] of triangles) {
    const d = (b[2]-c[2])*(a[0]-c[0]) + (c[0]-b[0])*(a[2]-c[2]);
    if (Math.abs(d)<1e-9) continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
    if (u < -1e-6 || v < -1e-6 || u+v > 1+1e-6) continue;
    const y=u*a[1]+v*b[1]+(1-u-v)*c[1];
    highest = highest === null ? y : Math.max(highest,y);
  }
  return highest;
}
let nativeColumns: Map<number, Map<number, (number | null)[]>> | undefined;
/** Roof picking follows the same source-owner correction. Other source owners,
 * other eleven campus parts, and points outside changed cells retain their roof. */
export function correctedHospitalRoofAtV215(x: number, z: number, native: boolean, original: number | null): number | null {
  if (x < -84 || x > -7 || z < -1850 || z > -1754) return original;
  if (native) {
    if (!nativeColumns) {
      nativeColumns = new Map();
      for (const [cx,cz,oldY,newY] of navigation.nativeChangedRoofCells) {
        let column = nativeColumns.get(cx!);
        if (!column) nativeColumns.set(cx!, column = new Map());
        column.set(cz!, [oldY,newY]);
      }
    }
    const changed = nativeColumns.get(Math.floor(x))?.get(Math.floor(z));
    if (!changed) return original;
    const [oldY,newY] = changed;
    if (original === oldY || (original !== null && oldY !== null && Math.abs(original-oldY)<.02)) return newY;
    return newY === null ? original : Math.max(original ?? -Infinity,newY);
  }
  const oldY=triangleRoofAt(navigation.oldTargetRoofs,x,z);
  if (oldY === null) return original;
  const newY=triangleRoofAt(navigation.newFamilyRoofs,x,z);
  if (original !== null && Math.abs(original-oldY)<.02) return newY;
  return newY === null ? original : Math.max(original ?? -Infinity,newY);
}
