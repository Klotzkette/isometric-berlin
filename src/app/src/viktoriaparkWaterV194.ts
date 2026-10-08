import data from "./data/viktoriaparkV194.json";
import { parkReliefAt } from "./parkReliefV182";
// Same three source-closed ponds and vertical datums as the offline water patch.
const levels: Record<string, number> = {"way/31791743": 6.83, "relation/544767": 30.95, "way/171168191": 6.94};
const ponds = data.features.filter(f=>f.id in levels).map(f=>({level:levels[f.id],rings:(f.geometry.coordinates as number[][][][])[0]}));
function inside(ring:number[][],x:number,z:number){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function distance(ring:number[][],x:number,z:number){let best=Infinity;for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));best=Math.min(best,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}return best;}
export function viktoriaparkWaterAtV194(x:number,z:number,native=false):number{
  let level=parkReliefAt(x,z,3,native)+.08,nearest=Infinity,pondY=level;
  for(const pond of ponds){if(inside(pond.rings[0],x,z)&&!pond.rings.slice(1).some(r=>inside(r,x,z)))return pond.level;const d=distance(pond.rings[0],x,z);if(d<nearest){nearest=d;pondY=pond.level;}}
  if(nearest<6){const t=nearest/6;level=pondY*(1-t)+level*t;}
  return Math.round(level*100)/100;
}
