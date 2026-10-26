import data from "./data/schoolsCourtsV274Navigation.json";

/** These parts start at the existing BMS roof: no ground-floor owner retires. */
export const SCHOOLS_COURTS_V274_UPPER_PARTS = data.parts;
export const SCHOOLS_COURTS_V274_BASE_PRISM_ID = "98765758";
export const SCHOOLS_COURTS_V274_NATIVE_UPPER_PART = data.nativeUpperPart;
let nativeRoofs: Map<string, number> | undefined;

export function schoolsCourtsV274RoofAt(x: number, z: number, native = false): number | null {
  if (x < 1245 || x > 1320 || z < -940 || z > -844) return null;
  if (native) {
    nativeRoofs ??= new Map(data.nativeRoofCells.map(([cx, cz, y]) => [`${Math.floor(cx/2)},${Math.floor(cz/2)}`, y]));
    return nativeRoofs.get(`${Math.floor(x/2)},${Math.floor(z/2)}`) ?? null;
  }
  let roof: number | null = null;
  for (const [a,b,c] of data.roofTriangles) {
    const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if (Math.abs(d)<1e-8) continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
    if (u>=-1e-6 && v>=-1e-6 && u+v<=1.000001) {
      const y=u*a[1]+v*b[1]+(1-u-v)*c[1];
      roof=roof===null ? y : Math.max(roof,y);
    }
  }
  return roof;
}
