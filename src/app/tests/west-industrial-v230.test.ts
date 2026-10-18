import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Raycaster, Vector3 } from "three";
import { createWestIndustrialV230 } from "../src/WestIndustrialV230";
import nav from "../src/data/westIndustrialV230Navigation.json";
import native from "../src/data/westIndustrialV230Native.json";
import receipt from "../src/data/westIndustrialV230Ownership.json";
import { westIndustrialV230GroundAt, westIndustrialV230RoofAt, westIndustrialV230SolidAt } from "../src/westIndustrialV230Navigation";
import { transferWestIndustrialNavigationV230 } from "../src/westIndustrialPacketNavigationV230";

function hits(root:ReturnType<typeof createWestIndustrialV230>,x:number,z:number){
  root.updateMatrixWorld(true);
  return new Raycaster(new Vector3(x,250,z),new Vector3(0,-1,0)).intersectObject(root,true).map(h=>h.point.y);
}

describe("v230 source industrial envelopes",()=>{
 test("hollow 100m cooling shell is actually open and has real walking support",()=>{
   const root=createWestIndustrialV230(false),t=nav.sites.find(s=>s.tower)!.tower!;
   const [x,z]=t.center, radius=t.profile.at(-1)![1];
   const center=hits(root,x,z);
   expect(center.length).toBeGreaterThan(0);
   expect(Math.max(...center)).toBeLessThan(20); // open mouth, no high flat cap
   const rim=hits(root,x+radius-.4,z);
   expect(Math.max(...rim)).toBeCloseTo(103,2);
   expect(westIndustrialV230RoofAt(x+radius-.4,z)).toBeCloseTo(103,2);
   expect(westIndustrialV230SolidAt(x,70,z)).toBeFalse();
   const y=t.profile[4][0],r=t.profile[4][1];
   expect(westIndustrialV230SolidAt(x+r-.4,y,z)).toBeTrue();
   expect(westIndustrialV230GroundAt(x,z,3)).toBeCloseTo(3,3);
   expect(westIndustrialV230GroundAt(x,z,3)).not.toBe(103);
 });
 test("independent native top support agrees with real rendered block rays",()=>{
   const root=createWestIndustrialV230(true),matrix=new Matrix4();let checked=0;
   root.traverse(object=>{if(object instanceof InstancedMesh){
     expect(object.userData.nativeMinecraft).toBeTrue();
     for(let i=0;i<object.count;i+=Math.max(1,Math.floor(object.count/40))){
       object.getMatrixAt(i,matrix);const e=matrix.elements;
       for(const k of [1,2,4,6,8,9])expect(e[k]).toBe(0);
     }
   }});
   for(const site of native.sites){
     const skin=site.blocks.slice(0,site.skinCount);
     for(let i=0;i<skin.length;i+=Math.max(1,Math.floor(skin.length/8))){
       const [x,,z]=skin[i],top=westIndustrialV230RoofAt(x,z,true);
       const physical=hits(root,x,z);
       if(top!==null && physical.length){
         // Thin recognition may sit above an edge; the independent body itself
         // must still provide exactly the sampled navigation support.
         expect(physical.some(y=>Math.abs(y-top)<.003)).toBeTrue();checked++;
       }
     }
   }
   expect(checked).toBeGreaterThan(65);
 });
 test("navigation transfer preserves altered and unrelated original records",()=>{
   const r=receipt.navigationRecords[0];
   const other={...r.original,sourceId:"untouched-neighbour"};
   const altered={...r.original,height:r.original.height+1};
   const original={groundY:r.groundY,ground:[],water:[],roads:[],bridges:[],buildings:[r.original,other,altered]};
   const result=transferWestIndustrialNavigationV230(r.tile,original as any);
   expect(result.buildings).toEqual([other,altered]);
   expect(original.buildings).toHaveLength(3);
 });
});
