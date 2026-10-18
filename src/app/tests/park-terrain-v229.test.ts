import {expect,test} from "bun:test";
import {Mesh,Raycaster,Vector3} from "three";
import drawn from "../src/data/northParksV198Drawn0.json";
import drawn1 from "../src/data/northParksV198Drawn1.json";
import native0 from "../src/data/northParksV198Native0.json";
import native1 from "../src/data/northParksV198Native1.json";
import changes from "../src/data/parkTerrainV229Changes.json";
import {correctParkTerrainV229} from "../src/parkTerrainGeometryV229";
import {parkTerrainOffsetV229} from "../src/parkTerrainV229";
import {createNorthParksV198} from "../src/NorthParksV198";
import {parkStaticGeometrySteps} from "../src/losslessStaticStorage";
import {northParksV198TerrainAt} from "../src/northParksV198Navigation";

test("old packet XZ, outside triangle order, colors and source objects remain intact",()=>{
 for(const native of [false,true])for(const model of native?[native0,native1]:[drawn,drawn1])for(const old of model.cells){
  const current=correctParkTerrainV229(old,native),patch=changes.cells.find(c=>c.id===old.id&&c.native===native);
  if(!patch){expect(current).toBe(old);continue;}
  for(let i=0;i<old.positions.length;i+=3){expect(current.positions[i]).toBe(old.positions[i]);expect(current.positions[i+2]).toBe(old.positions[i+2]);}
  expect(current.colors.slice(0,old.colors.length)).toEqual(old.colors);
  const removed=new Set(patch.remove),expected=old.indices.filter((_,i)=>!removed.has(Math.floor(i/3)*3));
  expect(current.indices.slice(0,expected.length)).toEqual(expected);
  expect(patch.remove).toEqual([...patch.remove].sort((a,b)=>a-b));
  for(let i=0;i<old.boxes.length;i++)for(let j=0;j<old.boxes[i].length;j++)if(j!==1)expect(current.boxes[i][j]).toBe(old.boxes[i][j]);
 }
});
for(const native of [false,true])test(`${native?'native':'drawn'} actual hill surfaces match DGM navigation without an old lid`,()=>{
 const root=createNorthParksV198(native);root.updateMatrixWorld(true);
 const grounds=root.children.filter(c=>c.name.includes('source terrain'));
 let count=0;
 for(let z=-6749.863;z<-6600;z+=11)for(let x=760.137;x<878;x+=11){
  if(Math.abs(parkTerrainOffsetV229(x,z,native))<.03)continue;
  const y=northParksV198TerrainAt(x,z,native),r=new Raycaster(new Vector3(x,y+1,z),new Vector3(0,-1,0));
  const hits=r.intersectObjects(grounds,false).filter(h=>h.point.y>y-.02&&h.point.y<y+.2);
  expect(hits.length,`${x},${z} expected${y}`).toBeGreaterThan(0);
  expect(Math.abs(hits[0].point.y-y),`${x},${z} expected${y}; hits${hits.map(h=>h.point.y)}`).toBeLessThan(.071);count++;
 }
 for(const _step of parkStaticGeometrySteps(root))void _step;
 const replayX=832.137,replayZ=-6703.863,replayY=northParksV198TerrainAt(replayX,replayZ,native);
 const replay=new Raycaster(new Vector3(replayX,replayY+.5,replayZ),new Vector3(0,-1,0)).intersectObjects(grounds,false);
 expect(replay.some(h=>Math.abs(h.point.y-replayY)<.071)).toBe(true);
 expect(count).toBeGreaterThan(90);
 expect(northParksV198TerrainAt(832,-6704)).toBeCloseTo(24.84,4);
 if(native)for(const child of grounds){const g=(child as Mesh).geometry,p=g.getAttribute('position'),ii=g.index!;
  for(let i=0;i<ii.count;i+=3){const ids=[ii.getX(i),ii.getX(i+1),ii.getX(i+2)],xs=ids.map(j=>p.getX(j)),ys=ids.map(j=>p.getY(j)),zs=ids.map(j=>p.getZ(j));
   if(Math.min(...xs)<704||Math.max(...xs)>928||Math.min(...zs)<-6784||Math.max(...zs)>-6560)continue;
   if(Math.max(...ys)<30)expect(Math.max(...ys)-Math.min(...ys)<.001||Math.abs((xs[1]-xs[0])*(zs[2]-zs[0])-(xs[2]-xs[0])*(zs[1]-zs[0]))<.001).toBe(true);
  }
 }
});
test("finite correction preserves old park margins, cemetery and distant scopes",()=>{
 for(const p of [[704,-6704],[928,-6704],[832,-6784],[832,-6560],[300,-6900],[2465,-6530],[0,0]])expect(parkTerrainOffsetV229(...p as [number,number])).toBe(0);
});
