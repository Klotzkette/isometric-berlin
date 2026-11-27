import { test, expect } from "bun:test";
import { Group, Mesh, Raycaster, Vector3 } from "three";
import { readFileSync } from "node:fs";
import { addFritzSportparkV390 } from "../src/FritzSportparkV390";
import { fritzArenaColumnsV390, isFritzArenaPrismV390 } from "../src/fritzArenaOwnershipV390";
import { createWeddingMoabitV229 } from "../src/WeddingMoabitV229";
import owners from "../src/data/fritzArenaOwnersV390.json";

test("only the captured stadium slab and north terrace lose their generic building height", () => {
  const {buildings}=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8"));
  expect(buildings.filter(isFritzArenaPrismV390).map((p:{id:string})=>p.id).sort()).toEqual(["j50000ZC","t5WhhQNJ"]);
  const match=fritzArenaColumnsV390(buildings,4);
  expect(match(-199,-315,52,92,3)).toBeTrue();
  expect(match(-199,-315,52,132,3)).toBeFalse();
  expect(match(-199,-315,52,92,2)).toBeFalse();
  expect(match(-400,-315,52,92,3)).toBeFalse();
  const bad=owners.owners.map(p=>({...p,h_dm:p.h_dm+1}));
  expect(fritzArenaColumnsV390(bad,4)(-199,-315,52,92,3)).toBeFalse();
  const extra={...owners.owners[0],id:"New overlapping source"};
  expect(fritzArenaColumnsV390([...owners.owners,extra],4)(-199,-315,52,92,3)).toBeFalse();
});

for(const native of [false,true]) test(`surveyed turf, clay and a tree-covered hill in the actual ${native?"block":"drawn"} site`,()=>{
  const group=new Group();addFritzSportparkV390(group,native);group.updateMatrixWorld(true);
  expect(group.children).toHaveLength(2);
  const fields=group.children[0] as Mesh,trees=group.children[1] as Mesh;
  expect(fields.userData.fullStaticDetailOnTouch).toBeTrue();
  expect(trees.userData.fullStaticDetailOnTouch).toBeTrue();
  expect(fields.geometry.getAttribute("position").count).toBeLessThan(15000);
  expect(trees.geometry.getAttribute("position").count).toBeLessThan(26000);
  const shows=(x:number,z:number)=>new Raycaster(new Vector3(x,70,z),new Vector3(0,-1,0)).intersectObject(fields)[0];
  for(const [x,z] of [[-793,-1257],[-928,-1338],[-1032,-1389],[-809,-1397]]) {
    const hit=shows(x,z);expect(hit).toBeDefined();expect(hit.point.y).toBeGreaterThan(5);
  }
  expect(shows(-1200,-1080)).toBeUndefined();
  expect(trees.geometry.boundingBox!.getSize(new Vector3()).y).toBeGreaterThan(22);
  const root=createWeddingMoabitV229(native);
  expect(root.getObjectByName(fields.name)).toBeDefined();
  expect(root.children.filter(o=>o.name.includes("field markings and open goals v229"))).toHaveLength(14);
  expect(root.children.find(o=>o.name.includes("way/17189008"))?.name.startsWith("Poststadion")).toBeTrue();
});
