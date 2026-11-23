import {expect,test} from "bun:test";
import {Box3,Mesh,Raycaster,Vector3} from "three";
import {createCharlottenburgerTorV379,loadCharlottenburgerTorV379} from "../src/CharlottenburgerTorV379";
import drawn from "../src/data/charlottenburgerTorV379Drawn.json";
import native from "../src/data/charlottenburgerTorV379Native.json";
import {charlottenburgerTorSolidAtV379 as solid} from "../src/charlottenburgerTorNavigationV379";
import {isCharlottenburgerCandelabrumV379 as oldPrism,isCharlottenburgerCandelabrumCellV379 as oldCell,
  charlottenburgerCandelabrumSourcePairV379 as pair} from "../src/charlottenburgerTorOwnershipV379";

test("both region packages have the two 22 m lamp standards, measured crowns and open street",()=>{
  for (const [block,packet] of [[false,drawn],[true,native]] as const) {
    const group=createCharlottenburgerTorV379(block,packet);
    expect(group.children).toHaveLength(1);
    const mesh=group.children[0] as Mesh;
    group.updateMatrixWorld(true);
    const ray=new Raycaster();
    const top=(x:number,z:number)=>{
      ray.set(new Vector3(x,50,z),new Vector3(0,-1,0));
      return ray.intersectObject(mesh)[0]?.point.y ?? 0;
    };
    for (const [x,z] of [[-2794,552.22],[-2790.17,594.36]]) {
      expect(top(x,z)).toBeGreaterThan(27.0);
      expect(top(x,z)).toBeLessThan(27.85);
      expect(solid(x,13,z,.1,block)).toBe(true);
    }
    for (const [x,z] of [[-2733.1,546.9],[-2730.0,588.5]]) {
      expect(top(x,z)).toBeGreaterThan(24.45);
      expect(top(x,z)).toBeLessThan(25.6);
    }
    expect(top(-2758,570.4)).toBeLessThan(6);
    expect(solid(-2732,8,568,.3,block)).toBe(false);
    const extent=new Box3().setFromObject(group);
    expect(extent.min.x).toBeLessThan(-2840);
    expect(extent.max.x).toBeGreaterThan(-2620);
    expect(mesh.geometry.getAttribute("position").count).toBeLessThan(21000);
    expect(mesh.geometry.index!.count).toBe(3*packet.faces);
  }
});

test("lamp ownership matches the full source outline and the actual native tuple",()=>{
  const south={id:"06961073",ring:[[-27875,5918],[-27872,5966],[-27928,5969],[-27931,5922]],holes:[],y0_dm:52,h_dm:90,class:0,roof:9999};
  const north={...south,id:"14399857",ring:[[-27959,5540],[-27962,5508],[-27921,5505],[-27918,5536]]};
  expect(oldPrism(south)).toBe(true);expect(oldPrism(north)).toBe(true);
  expect(oldPrism({...south,ring:north.ring})).toBe(false);
  expect(oldPrism({...south,h_dm:100})).toBe(false);
  expect(pair([south,north])).toBe(true);expect(pair([south,south])).toBe(false);
  expect(oldCell(-698,148,52,172,3)).toBe(true);expect(oldCell(-698,147,52,172,3)).toBe(false);
});
test("cancelled family selection never allocates the new geometry",async()=>{
  await expect(loadCharlottenburgerTorV379(false,AbortSignal.abort())).rejects.toThrow();
});
