import data from "./data/charlottenburgerTorV201Navigation.json";

let columns: Map<string, number[]> | null = null;
/** Only actual gate solids: roadway and the four-column openings remain open. */
export function charlottenburgerTorV201SolidAt(x:number,y:number,z:number,radius=0,native=false):boolean {
  if(x < -2745-radius || x > -2710+radius || z < 518-radius || z > 615+radius || y < 7.5 || y > 35) return false;
  if(native) {
    columns ??= new Map(data.nativeColumns.map(row=>[`${row[0]}:${row[1]}`,row]));
    const step=data.step;
    for(let iz=Math.floor((z-radius)/step);iz<=Math.floor((z+radius)/step);iz++)
      for(let ix=Math.floor((x-radius)/step);ix<=Math.floor((x+radius)/step);ix++) {
        const row=columns.get(`${ix}:${iz}`); if(!row)continue;
        for(let j=2;j<row.length;j+=2)if(y>=row[j]&&y<=row[j+1])return true;
      }
    return false;
  }
  for(const r of data.primitives) {
    if(y<r[1]-r[4]/2 || y>r[1]+r[4]/2)continue;
    const dx=x-r[0],dz=z-r[2];
    if(r[7]===1) {
      const t=(y-r[1]+r[4]/2)/r[4], rr=r[3]+(r[5]-r[3])*t;
      if(Math.hypot(dx,dz)<=rr+radius)return true;
    } else {
      const c=Math.cos(r[6]),s=Math.sin(r[6]);
      if(Math.abs(dx*c-dz*s)<=r[3]/2+radius&&Math.abs(dx*s+dz*c)<=r[5]/2+radius)return true;
    }
  }
  return false;
}
