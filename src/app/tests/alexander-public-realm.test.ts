import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { BufferGeometry, Group, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createAlexanderPublicRealm, createMinecraftAlexanderPublicRealm } from "../src/AlexanderPublicRealm";
import { ALEXANDER_PUBLIC_REALM_PROFILE as P, ALEXANDER_PUBLIC_REALM_SOURCE as S,
  alexanderPublicRealmSolidAt as solid, alexanderPublicRealmSupportHeightAt as support } from "../src/alexanderPublicRealmProfile";
import { isSchwellenraumGeschuetzt } from "../src/visual-modes/schwellenraum/presentation";

function measure(root:Group) {
  const hash=createHash("sha256"),seen=new Set<BufferGeometry>();let bytes=0,instances=0,draws=0;
  root.traverse(o=>{if(!(o instanceof Mesh))return;draws++;expect(o.matrixAutoUpdate).toBeFalse();
    expect(isSchwellenraumGeschuetzt(o)).toBeTrue();
    expect(o.userData.dayMaterial.map).toBeNull();expect(o.userData.nightMaterial.map).toBeNull();
    if(!seen.has(o.geometry)){
      seen.add(o.geometry);for(const a of Object.values(o.geometry.attributes)) {
        expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();bytes+=a.array.byteLength;hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));
      }bytes+=o.geometry.index?.array.byteLength??0;
    }
    if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);hash.update(new Uint8Array(o.instanceMatrix.array.buffer));}
  });return{bytes,instances,draws,hash:hash.digest("hex")};
}
const drawn=createAlexanderPublicRealm(),native=createMinecraftAlexanderPublicRealm();
test("full mobile and desktop static detail remains identical within five bounded draw calls",()=>{
  const a=measure(drawn),b=measure(createAlexanderPublicRealm(true)),n=measure(native);
  expect(a).toEqual(b);expect(a.draws).toBe(5);expect(n.draws).toBe(1);
  expect(a.bytes).toBeLessThan(1_000_000);expect(n.bytes).toBeLessThan(600_000);
  expect(native.userData.hiddenSolidInfill).toBeFalse();expect(native.children[0]).toBeInstanceOf(InstancedMesh);
  expect((native.children[0] as Mesh).geometry.getAttribute("position").count).toBe(24);
  expect(measure(createMinecraftAlexanderPublicRealm(true))).toEqual(n);
  console.log("Alexander public realm budgets",{drawn:a,native:n});
});
test("four-lobed fountain has actual stone, water, ten metre trident and shared native placement",()=>{
  const [x,y,z]=P.neptun.position;
  for(const root of[drawn,native]){
    root.updateMatrixWorld(true);
    const angle=-2.35,side=-.83,front=.46;
    const tx=x+Math.cos(angle)*front-Math.sin(angle)*side,tz=z+Math.sin(angle)*front+Math.cos(angle)*side;
    const top=new Raycaster(new Vector3(tx,y+12,tz),new Vector3(0,-1,0),0,12).intersectObject(root,true);
    expect(top.length).toBeGreaterThan(0);expect(top[0].point.y-y).toBeGreaterThan(9.7);expect(top[0].point.y-y).toBeLessThan(10.3);
    const water=new Raycaster(new Vector3(x+4,y+2,z+2),new Vector3(0,-1,0),0,2).intersectObject(root,true);
    expect(water.length).toBeGreaterThan(0);expect(water[0].point.y-y).toBeGreaterThan(.1);
  }
});
test("monument circle stays walkable while plinth, fountain rim and trunks collide",()=>{
  expect(solid(S.ensemble.center_xz[0],S.ensemble.center_xz[1],7,.2)).toBeFalse();
  expect(support(S.ensemble.center_xz[0],S.ensemble.center_xz[1],5.245)).toBeCloseTo(5.285);
  const [x,y,z]=P.marxEngels.position;expect(solid(x,z,y+.1)).toBeTrue();
  expect(support(x,z,y)).toBeCloseTo(y+.18,5);
  const corner=S.marx_engels.outline_xz[0];const bx=x+(corner[0]-x)*.9,bz=z+(corner[1]-z)*.9;
  expect(support(bx,bz,y)).toBeCloseTo(y+.18,5);expect(solid(bx,bz,y+.18)).toBeFalse();
  const edge=S.neptun.outline_xz[10];expect(solid(edge[0],edge[1],5.6,.2)).toBeTrue();
  expect(solid(P.neptun.position[0]+5,P.neptun.position[2],7,.1)).toBeFalse();
  expect(solid(0,0,7)).toBeFalse();expect(support(0,0,7)).toBeNull();
  const t=S.added_trees[0].position;expect(solid(t[0],t[2],t[1]+1,.1)).toBeTrue();
});
test("source tree addition keeps all 161 previous forum trees and the entire current mapped ensemble",()=>{
  expect(P.treeCount).toBe(59);expect(P.retainedForumTreeCount).toBe(161);
  expect(drawn.userData.ownedOsmKeys).toHaveLength(10);expect(drawn.userData.sourceTreeCount).toBe(59);
  expect(S.secondary.filter(s=>s.kind==="double-stele")).toHaveLength(4);
  expect(S.secondary.filter(s=>s.kind==="bronze-relief")).toHaveLength(2);
  for(const t of S.added_trees){expect(t.nearest_existing_m).toBeGreaterThan(2);expect(t.nearest_native_tree_m).toBeGreaterThanOrEqual(3);}
});

test("actual pedestrian stepping stands on the low plinth and walks away without a stuck foot plane",async()=>{
  const {createPedestrianState,stepPedestrian,PEDESTRIAN_IDLE_INPUT}=await import("../src/pedestrianNavigation");
  const [cx,cy,cz]=P.marxEngels.position,corner=S.marx_engels.outline_xz[0];
  const x=cx+(corner[0]-cx)*.85,z=cz+(corner[1]-cz)*.85;
  const env={bounds:{minX:2100,maxX:2500,minZ:-200,maxZ:300},water:[],groundAt:()=>S.ground_y_m,
    interiorSolidAt:(x:number,y:number,z:number,r=0)=>solid(x,z,y,r),
    interiorGroundAt:(x:number,z:number,y=S.ground_y_m)=>support(x,z,y)};
  let state=createPedestrianState(env,{x,z,yaw:Math.PI/2,groundYHint:cy+.18,preserveHorizontalPosition:true});
  expect(state.x).toBeCloseTo(x);expect(state.z).toBeCloseTo(z);expect(state.groundY).toBeCloseTo(cy+.18);
  state=stepPedestrian(state,PEDESTRIAN_IDLE_INPUT,.04,env).state;expect(state.groundY).toBeCloseTo(cy+.18);
  for(let i=0;i<80;i++)state=stepPedestrian(state,{...PEDESTRIAN_IDLE_INPUT,forward:.25},.02,env).state;
  expect(state.x).toBeGreaterThan(x+2);expect(state.groundY).toBeCloseTo(S.ground_y_m+.04);
});


test("native fountain water clears the retained source plaza without lowering its paving",async()=>{
  const {createSchlossEastStreets}=await import("../src/SchlossEastStreets");
  const payload=await Bun.file(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json",import.meta.url)).json();
  const streets=createSchlossEastStreets(payload,true);streets.updateMatrixWorld(true);native.updateMatrixWorld(true);
  const [x,y,z]=P.neptun.position;
  const ray=new Raycaster(new Vector3(x+4,y+2,z+2),new Vector3(0,-1,0),0,2);
  const paving=ray.intersectObject(streets,true),water=ray.intersectObject(native,true);
  expect(paving.length).toBeGreaterThan(0);expect(water.length).toBeGreaterThan(0);
  expect(paving[0].point.y).toBeCloseTo(5.52,4);
  expect(water[0].point.y).toBeCloseTo(5.675,4);
  expect(water[0].point.y-paving[0].point.y).toBeGreaterThan(.15);
  expect(water[0].point.y).toBeLessThan(y+.69);
});
