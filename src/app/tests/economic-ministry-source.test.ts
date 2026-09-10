import {describe,expect,test} from "bun:test";
import {BoxGeometry,Matrix4,Mesh,Quaternion,Raycaster,Vector3} from "three";
import {
  ECONOMIC_MINISTRY_SOURCE as S, ECONOMIC_MINISTRY_SOLAR_BLOCKS,
  createEconomicMinistrySourceGeometry, createMinecraftEconomicMinistryDetails,
  economicMinistryContains, economicMinistryRoofTopAt, isEconomicMinistryReplacementCell,
} from "../src/EconomicMinistrySourceGeometry";
import original from "../public/mesh/regierungsviertel/lod2-prisms.json";

describe("ministry source architecture and modern solar roof",()=>{
 test("retains all original source rings, eleven main courts and five lower new-wing courts",()=>{
   for(const part of S.prisms)expect(part).toEqual(original.buildings.find(p=>p.id===part.id));
   expect(S.prisms.find(p=>p.id==="K00008CN")!.holes).toHaveLength(11);
   expect(S.prisms.find(p=>p.id==="-3202585")!.holes).toHaveLength(5);
   expect(S.parts.reduce((n,p)=>n+p.surfaces.length,0)).toBe(328);
   const modern=S.parts.find(p=>p.id==="yAAWS2KQ")!;
   expect(modern.surfaces.filter(p=>p.kind==="RoofSurface")).toHaveLength(2);
   expect(S.mainRoof.status).toContain("not surveyed");
   expect(S.parts.find(p=>p.id==="K00008CN")!.surfaces.filter(p=>p.kind==="RoofSurface")).toHaveLength(1);
 });
 test("solar tiles sit above the source canal pitch, wholly inside the modern wing",()=>{
   const part=S.prisms.find(p=>p.id==="yAAWS2KQ")!;
   expect(ECONOMIC_MINISTRY_SOLAR_BLOCKS).toHaveLength(447);
   const cube=new BoxGeometry(1,1,1),positions=cube.getAttribute("position"),m=new Matrix4();
   for(const b of ECONOMIC_MINISTRY_SOLAR_BLOCKS){
     m.compose(new Vector3(...b.position),new Quaternion(...b.quaternion),new Vector3(...b.size));
     for(let i=0;i<positions.count;i++){
       const p=new Vector3().fromBufferAttribute(positions,i).applyMatrix4(m);
       expect(economicMinistryContains(part,p.x,p.z)).toBeTrue();
       const roof=economicMinistryRoofTopAt(p.x,p.z,part.id);
       expect(roof).not.toBeNull();expect(p.y-roof!).toBeGreaterThan(.05);expect(p.y-roof!).toBeLessThan(.22);
     }
   }
   cube.dispose();
 });
 test("downward rays cross the main and lower new-wing courtyards without hitting a roof",()=>{
   const root=createEconomicMinistrySourceGeometry();root.updateMatrixWorld(true);
   const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
   for(const id of ["K00008CN","-3202585"]){
     const part=S.prisms.find(p=>p.id===id)!;
     for(const hole of part.holes){
       // A bounded grid selects an interior point even in the large concave court.
       const xs=hole.map(p=>p[0]/10),zs=hole.map(p=>p[1]/10);let checked=false;
       for(let x=Math.min(...xs)+2;x<Math.max(...xs)-2&&!checked;x+=1.3)for(let z=Math.min(...zs)+2;z<Math.max(...zs)-2&&!checked;z+=1.3){
         const court={ring:hole,holes:[]};if(!economicMinistryContains(court,x,z))continue;
         if([[x-1,z],[x+1,z],[x,z-1],[x,z+1]].some(p=>!economicMinistryContains(court,p[0],p[1])))continue;
         if(S.prisms.some(p=>p.id!==id&&economicMinistryContains(p,x,z)))continue;
         expect(economicMinistryRoofTopAt(x,z,id)).toBeNull();
         ray.ray.origin.set(x,100,z);expect(ray.intersectObject(root,true)).toHaveLength(0);checked=true;
       }
       expect(checked).toBeTrue();
     }
   }
 });
 test("voxel replacement preserves the court interior and rejects faraway city cells",()=>{
   expect(isEconomicMinistryReplacementCell(200,-1120,1)).toBeFalse();
   expect(isEconomicMinistryReplacementCell(145,-1160,5)).toBeTrue();
   for(const x of [-6000,6000])for(const z of [-6000,6000])expect(isEconomicMinistryReplacementCell(x,z,4)).toBeFalse();
 });
 for(const mobileLike of [false,true])test(`native ${mobileLike?"mobile":"full"} keeps roof tiles inside source boundaries and one draw call`,()=>{
   const root=createMinecraftEconomicMinistryDetails(undefined,{mobileLike,diagnostics:true});
   let renderables=0;root.traverse(o=>{if(o instanceof Mesh)renderables++;});expect(renderables).toBe(1);
   expect(root.userData.instances).toBeLessThan(mobileLike?20_000:28_000);
   expect(root.userData.solarModules).toBe(447);
   for(const b of root.userData.blocks.filter((b:{role:string})=>b.role==="source roof surface block")){
     const part=S.prisms.find(p=>p.id===b.sourceId)!;
     for(const dx of [-.5,.5])for(const dz of [-.5,.5])expect(economicMinistryContains(part,b.position[0]+dx*b.size[0],b.position[2]+dz*b.size[2])).toBeTrue();
   }
   root.updateMatrixWorld(true);
   const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
   for(const b of root.userData.blocks.filter((b:{role:string})=>b.role==="modern roof photovoltaic module")){
     ray.ray.origin.set(b.position[0],100,b.position[2]);
     const hits=ray.intersectObject(root,true);expect(hits.length).toBeGreaterThan(0);
     expect(hits[0].point.y).toBeCloseTo(b.position[1]+b.size[1]/2,4);
   }
   expect(root.userData.blocks.filter((b:{role:string})=>b.role==="historic court or side window")).toHaveLength(580);
 });
});
