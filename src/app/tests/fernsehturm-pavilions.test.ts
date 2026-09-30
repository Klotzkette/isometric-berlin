import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { BufferGeometry, Group, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createFernsehturmPavilions, createMinecraftFernsehturmPavilions } from "../src/FernsehturmPavilions";
import { FERNSEHTURM_PAVILION_PROFILE as P, FERNSEHTURM_PAVILION_SOURCE as S, FERNSEHTURM_PAVILION_PARTS, FERNSEHTURM_PAVILION_STAIRS as STAIRS, fernsehturmPavilionSolidAt as solid, fernsehturmPavilionSupportHeightAt as support } from "../src/fernsehturmPavilionProfile";

function measure(root:Group){const hash=createHash("sha256"),seen=new Set<BufferGeometry>();let draws=0,instances=0,bytes=0;root.traverse(o=>{if(!(o instanceof Mesh))return;draws++;expect(o.matrixAutoUpdate).toBeFalse();expect(o.userData.dayMaterial.map).toBeNull();expect(o.userData.nightMaterial.map).toBeNull();if(!seen.has(o.geometry)){seen.add(o.geometry);for(const a of Object.values(o.geometry.attributes)){expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();bytes+=a.array.byteLength;hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));}bytes+=o.geometry.index?.array.byteLength??0;}if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);hash.update(new Uint8Array(o.instanceMatrix.array.buffer));}});return{draws,instances,bytes,hash:hash.digest("hex")};}
const drawn=createFernsehturmPavilions(),native=createMinecraftFernsehturmPavilions();
test("additive folded pavilion ensemble preserves all source parts and full touch detail",()=>{
  expect(S.profiles).toHaveLength(16);expect(FERNSEHTURM_PAVILION_PARTS).toHaveLength(22);
  const d=measure(drawn),n=measure(native);expect(measure(createFernsehturmPavilions(true))).toEqual(d);expect(measure(createMinecraftFernsehturmPavilions(true))).toEqual(n);
  expect(d.draws).toBe(2);expect(n.draws).toBe(1);expect(d.bytes).toBeLessThan(450_000);expect(n.bytes).toBeLessThan(1_000_000);expect(native.userData.blockNative).toBeTrue();expect(native.userData.hiddenSolidInfill).toBeFalse();
  expect((native.children[0] as Mesh).geometry.getAttribute("position").count).toBe(24);
  console.log("Fernsehturm pavilion budgets",{drawn:d,native:n});
});
test("measured triangular cantilevers stay thin and navigable below",()=>{
  const peak=S.profiles.find(p=>p.key==="northPeak")!.parts[0],roof=peak.surfaces.find(s=>s.kind==="RoofSurface")!.rings[0];
  const x=roof.reduce((n,p)=>n+p[0],0)/3,z=roof.reduce((n,p)=>n+p[2],0)/3,y=roof.reduce((n,p)=>n+p[1],0)/3;
  expect(solid(x,z,8)).toBeFalse();expect(solid(x,z,y)).toBeTrue();
  for(const root of[drawn,native]){root.updateMatrixWorld(true);const hits=new Raycaster(new Vector3(x,28,z),new Vector3(0,-1,0),0,25).intersectObject(root,true);expect(hits.length).toBeGreaterThan(0);expect(hits[0].point.y).toBeGreaterThan(19);expect(hits[0].point.y).toBeLessThan(23);}
  expect(solid(2580.5,-156.9,8)).toBeFalse();expect(support(2580.5,-156.9,5.2)).toBeNull();
});
test("source staircase subdivisions ascend continuously and leave the exterior approaches open",async()=>{
  const {createPedestrianState,stepPedestrian,PEDESTRIAN_IDLE_INPUT}=await import("../src/pedestrianNavigation");
  for(const s of STAIRS){
    const bottom=[(s.c[0]+s.d[0])/2,(s.c[1]+s.d[1])/2],top=[(s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2],dx=top[0]-bottom[0],dz=top[1]-bottom[1],length=Math.hypot(dx,dz);
    const env={bounds:{minX:2490,maxX:2660,minZ:-230,maxZ:-50},water:[],groundAt:()=>5.2,interiorSolidAt:(x:number,y:number,z:number,r=0)=>solid(x,z,y,r),interiorGroundAt:(x:number,z:number,y=5.2)=>support(x,z,y)};
    let state=createPedestrianState(env,{x:bottom[0]+dx/length*.5,z:bottom[1]+dz/length*.5,yaw:Math.atan2(dx,-dz),groundYHint:5.65,preserveHorizontalPosition:true});
    for(let i=0;i<400;i++){state=stepPedestrian(state,{...PEDESTRIAN_IDLE_INPUT,forward:.2},.02,env).state;if(Math.hypot(state.x-top[0],state.z-top[1])<.5)break;}
    expect(state.groundY).toBeGreaterThan(P.galleryY-.7);expect(Math.hypot(state.x-top[0],state.z-top[1])).toBeLessThan(2);
    const high=state.groundY;state={...state,yaw:state.yaw+Math.PI};for(let i=0;i<400;i++){state=stepPedestrian(state,{...PEDESTRIAN_IDLE_INPUT,forward:.2},.02,env).state;if(Math.hypot(state.x-bottom[0],state.z-bottom[1])<.6)break;}
    expect(state.groundY).toBeLessThan(high-4);expect(state.groundY).toBeGreaterThanOrEqual(5.2);
  }
});
