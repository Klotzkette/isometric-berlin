import source from "./data/charlottenburgParkV281.json";

/** Original OSM vertices stay intact; widths and jet heights are display estimates.
 * Existing v183 park, water, path, tree and palace owners are never replaced. */
export const CHARLOTTENBURG_PARK_V281 = {
  source,
  reference: "https://www.spsg.de/schloesser-gaerten/objekt/schlossgarten-charlottenburg/",
  hedgeWidthM: .48,
  basinRimWidthM: .38,
  status: "Nine mapped parterre hedges retain explicit OSM 0.3 m height; fountain rim and static jet dimensions are estimates. Existing ground and water surfaces remain intact.",
} as const;

/** Append to the existing palace instance batch, with a separate cardinal reading. */
export function charlottenburgParkV281Rows(native = false): number[][] {
  const rows: number[][] = [];
  const y = source.groundY;
  function member(a: readonly number[], b: readonly number[], height: number, width: number, colour: number): void {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (length < .001) return;
    if (!native) {
      rows.push([(a[0]+b[0])/2, y+.01+height/2, (a[1]+b[1])/2, length+.015, height, width, -Math.atan2(dz,dx), colour]);
      return;
    }
    // Independent orthogonal strips follow each complete mapped segment. Their
    // short projected spans overlap at steps without rotating any native box.
    const count = Math.ceil(length / 2);
    for (let i=0;i<count;i++) {
      const t=(i+.5)/count;
      rows.push([a[0]+dx*t,y+.01+height/2,a[1]+dz*t,Math.abs(dx)/count+width,height,Math.abs(dz)/count+width,colour]);
    }
  }
  for (const feature of source.features) {
    const hedge=feature.role === "parterre hedge";
    const colour=hedge ? (native ? 0x4c7f28 : 0x53733e) : (native ? 0xb69b83 : 0xaea68f);
    const height=hedge ? feature.heightM! : .24;
    for(let i=1;i<feature.points.length;i++) member(feature.points[i-1],feature.points[i],height,hedge?.48:.38,colour);
  }
  // The already delivered exact water sheet remains the basin owner. Static
  // pale jets identify the fountain without a second animated water system.
  const basin=source.features.find(f=>f.role === "octagonal fountain basin")!;
  const points=basin.points.slice(0,-1);
  const cx=points.reduce((sum,p)=>sum+p[0],0)/points.length;
  const cz=points.reduce((sum,p)=>sum+p[1],0)/points.length;
  for (const [dx,dz,h] of [[0,0,5.4],[-.65,0,3.5],[.65,0,3.5],[0,-.65,3.5],[0,.65,3.5]]) {
    const row=[cx+dx,y+.14+h/2,cz+dz,.12,h,.12];
    rows.push(native?[...row,0xa4dfe2]:[...row,0,0xc6e0dd]);
  }
  if(native) {
    const inside=(x:number,z:number):boolean=>{
      let hit=false;
      for(let i=0,j=points.length-1;i<points.length;j=i++) {
        const a=points[i],b=points[j];
        if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
      }
      return hit;
    };
    const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
    // Cardinal water cells are wholly within the source basin, with no shared
    // top-face overlap. The exact retained lower water stays behind their edge.
    for(let x=Math.floor(Math.min(...xs)/2)*2+1;x<Math.max(...xs);x+=2)
      for(let z=Math.floor(Math.min(...zs)/2)*2+1;z<Math.max(...zs);z+=2)
        if([-1,1].every(dx=>[-1,1].every(dz=>inside(x+dx,z+dz))))rows.push([x,3.035,z,2,.05,2,0x72c5d2]);
  }
  return rows;
}

/** Exact octagonal basin footprint, shallow current water interpretation. The
 * retained outer-city generic water level is 4.15 m below this garden, so it
 * cannot describe this ornamental basin. No original surface is discarded. */
export function charlottenburgBasinV281Triangles(): number[][] {
  const ring=source.features.find(f=>f.role === "octagonal fountain basin")!.points;
  const triangles:number[][]=[];
  for(let i=1;i<ring.length-2;i++) triangles.push([
    ring[0][0],3.06,ring[0][1],ring[i][0],3.06,ring[i][1],ring[i+1][0],3.06,ring[i+1][1],0x83adb1,
  ]);
  return triangles;
}
