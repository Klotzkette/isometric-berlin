/** Step 10: independent axis-aligned native surfaces of all retained v116 parts. */
import { writeFileSync } from "node:fs";
import { BufferGeometry, Color, Vector3 } from "three";
import { buildCharlottenburgerTorWingV201 } from "../src/CharlottenburgerTorV201";
import { CHARLOTTENBURGER_TOR_PROFILE as profile } from "../src/charlottenburgerTorV201Profile";
const STEP = .5;
const occupied = new Map<string, { x:number; y:number; z:number; color:number }>();
const a = new Vector3(), b = new Vector3(), c = new Vector3(), color = new Color();
const primitives: number[][] = [], partCounts: number[] = [];
for (const side of [-1, 1] as const) {
  const builder = buildCharlottenburgerTorWingV201(side);
  partCounts.push(builder.parts.length);
  const yaw = profile.wings[side < 0 ? 0 : 1].yawRadians;
  for (const part of builder.parts) {
    const pos = part.getAttribute("position"), rgb = part.getAttribute("color");
    const hex = color.setRGB(rgb.getX(0), rgb.getY(0), rgb.getZ(0)).getHex();
    const index = part.index!;
    const p = part as BufferGeometry & { parameters?: { radiusTop:number; radiusBottom:number; height:number } };
    if (p.parameters) {
      part.computeBoundingBox(); const center = part.boundingBox!.getCenter(new Vector3());
      primitives.push([center.x,center.y,center.z,p.parameters.radiusBottom,p.parameters.height,p.parameters.radiusTop,0,1]);
    } else {
      const local=part.clone().rotateY(-yaw); local.computeBoundingBox();
      const center=local.boundingBox!.getCenter(new Vector3()).applyAxisAngle(new Vector3(0,1,0),yaw);
      const size=local.boundingBox!.getSize(new Vector3()); local.dispose();
      primitives.push([center.x,center.y,center.z,size.x,size.y,size.z,yaw,0]);
    }
    for(let i=0;i<index.count;i+=3) {
      a.fromBufferAttribute(pos,index.getX(i)); b.fromBufferAttribute(pos,index.getX(i+1)); c.fromBufferAttribute(pos,index.getX(i+2));
      const divisions=Math.max(1,Math.ceil(Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))/(STEP*.42)));
      for(let u=0;u<=divisions;u++) for(let v=0;v<=divisions-u;v++) {
        const f=u/divisions,g=v/divisions;
        const x=Math.floor((a.x+(b.x-a.x)*f+(c.x-a.x)*g)/STEP);
        const y=Math.floor((a.y+(b.y-a.y)*f+(c.y-a.y)*g)/STEP);
        const z=Math.floor((a.z+(b.z-a.z)*f+(c.z-a.z)*g)/STEP);
        occupied.set(`${x}:${y}:${z}`,{x,y,z,color:hex});
      }
    }
  }
  [...builder.parts,...builder.edges,...builder.lamps].forEach(g=>g.dispose());
}
// Losslessly coalesce touching equal-colour cells vertically. No hidden infill.
const columns=new Map<string, {x:number; y:number; z:number; color:number}[]>();
for(const cell of occupied.values()) {
  const key=`${cell.x}:${cell.z}:${cell.color}`,values=columns.get(key)??[];
  values.push(cell); columns.set(key,values);
}
const boxes:number[][]=[];
for(const cells of columns.values()) {
  cells.sort((a,b)=>a.y-b.y);
  let start=0;
  while(start<cells.length) {
    let end=start;
    while(end+1<cells.length && cells[end+1].y===cells[end].y+1)end++;
    const f=cells[start],l=cells[end];
    boxes.push([(f.x+.5)*STEP,(f.y+l.y+1)*STEP/2,(f.z+.5)*STEP,STEP,(l.y-f.y+1)*STEP,STEP,f.color]);
    start=end+1;
  }
}
boxes.sort((a,b)=>a[0]-b[0]||a[2]-b[2]||a[1]-b[1]);
const data={step:STEP,partCounts,nativeSurfaceCells:occupied.size,boxes,primitives};
writeFileSync(new URL("../src/data/charlottenburgerTorV201.json",import.meta.url),JSON.stringify(data));
console.log({parts:partCounts,blocks:boxes.length,cells:occupied.size,bytes:JSON.stringify(data).length});
// Navigation stores the same physical native columns with uncoloured intervals,
// independently of the constructor-only coloured instance payload.
const navColumns=new Map<string, {x:number;z:number; ys:number[]}>();
for(const cell of occupied.values()) {
  const key=`${cell.x}:${cell.z}`,col=navColumns.get(key)??{x:cell.x,z:cell.z,ys:[]};
  col.ys.push(cell.y); navColumns.set(key,col);
}
const nativeColumns:number[][]=[];
for(const col of navColumns.values()) {
  col.ys.sort((a,b)=>a-b); const intervals:number[]=[];
  let start=0;
  while(start<col.ys.length) {
    let end=start; while(end+1<col.ys.length&&col.ys[end+1]<=col.ys[end]+1)end++;
    intervals.push(col.ys[start]*STEP,(col.ys[end]+1)*STEP); start=end+1;
  }
  nativeColumns.push([col.x,col.z,...intervals]);
}
nativeColumns.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
writeFileSync(new URL("../src/data/charlottenburgerTorV201Navigation.json",import.meta.url),JSON.stringify({step:STEP,primitives,nativeColumns}));
writeFileSync(new URL("../src/data/charlottenburgerTorV201.json",import.meta.url),JSON.stringify({step:STEP,partCounts,nativeSurfaceCells:occupied.size,boxes}));
