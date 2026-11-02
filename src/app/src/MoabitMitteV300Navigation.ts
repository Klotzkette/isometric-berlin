import profile from "./data/moabitMitteV300Profile.json";
function roofAt(triangles: readonly number[][][], x: number, z: number): number | null {
  let top = -Infinity;
  for (const [a, b, c] of triangles) {
    const det = (b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if (Math.abs(det)<1e-9) continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det, v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
    if (Math.min(u,v,1-u-v)>=-1e-7) top=Math.max(top,u*a[1]+v*b[1]+(1-u-v)*c[1]);
  }
  return Number.isFinite(top)?top:null;
}
type NativeRow = [string,number,number,number,number,number];
let nativeRows: Map<string,Map<number,NativeRow[]>> | undefined;
let nativeMaximum: Map<string,number> | undefined;
function nativeProfiles() {
  if (nativeRows && nativeMaximum) return {rows:nativeRows,maximum:nativeMaximum};
  nativeRows=new Map();nativeMaximum=new Map();
  for (const row of profile.nativeRoofs as NativeRow[]) {
    const [parent,,z,,,high]=row, family=nativeRows.get(parent)??new Map<number,NativeRow[]>(), list=family.get(z)??[];
    list.push(row);family.set(z,list);nativeRows.set(parent,family);nativeMaximum.set(parent,Math.max(nativeMaximum.get(parent)??-Infinity,high));
  }
  return {rows:nativeRows,maximum:nativeMaximum};
}
/** Granular measured leaves keep every court hole. Native roofs use the actual
 * compiled cardinal cell caps, rather than sinking into the lower LoD2 slope. */
export function moabitMitteV300Solids(native=false) {
  const nativeSource=native?nativeProfiles():undefined;
  return profile.navigation.map(p=>({sourceId:p.id,parentId:p.parent,ring:p.ring,holes:p.holes,
    minY:native?Math.floor(p.low/.5)*.5:p.low,maxY:native?nativeSource!.maximum.get(p.parent)??p.high:p.high,
    low:p.low,high:p.high,
    topAt:(x:number,z:number)=>native?(nativeSource!.rows.get(p.parent)?.get(Math.floor(z/.5))?.find(r=>Math.floor(x/.5)>=r[1]&&Math.floor(x/.5)<r[1]+r[3])?.[5]??null):roofAt(p.roofTriangles,x,z),
  }));
}
