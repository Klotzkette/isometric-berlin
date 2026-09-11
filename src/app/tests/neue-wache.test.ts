import { describe,expect,test } from "bun:test";
import { Group,InstancedMesh,Mesh,Raycaster,Vector3 } from "three";
import { createNeueWache } from "../src/NeueWache";
import { NEUE_WACHE_PROFILE as P, NEUE_WACHE_COLUMN_U, NEUE_WACHE_DOOR_U,
  neueWacheWorld,neueWacheGroundAt,neueWacheSolidAt,neueWacheWalkableAt,isNeueWacheReplacementColumn,neueWacheRoofAt } from "../src/neueWacheProfile";
import { compilePedestrianObstacles,createPedestrianState,pedestrianPointIsBlocked,type PedestrianEnvironment } from "../src/pedestrianNavigation";
import { PRISM_SUPPRESSED_IDS } from "../src/IsometricCityWorld";
import source from "../src/neueWacheSource.json";

describe("Neue Wache open hall",()=>{
  test("keeps source envelopes, opens only its replacement and leaves neighbours solid",()=>{
    expect(source.parts.map(p=>p.top_y_m)).toEqual([15.013,15.479]);
    expect(source.previous_display_prisms[0].h_dm).toBe(60);
    expect(PRISM_SUPPRESSED_IDS.has("24240381")).toBeTrue();
    expect(isNeueWacheReplacementColumn(...neueWacheWorld(0,0))).toBeTrue();
    expect(isNeueWacheReplacementColumn(1600,142)).toBeFalse();
    const [x,z]=neueWacheWorld(2,3);
    expect(neueWacheWalkableAt(x,7,z,"24240381")).toBeTrue();
    expect(neueWacheWalkableAt(x,7,z,"neighbour")).toBeFalse();
    expect(neueWacheSolidAt(...(() => {const [a,b]=neueWacheWorld(13,0);return [a,14.7,b] as const;})())).toBeFalse();
  });
  test("the standing capsule can walk from the street through the centre gate and around the sculpture",()=>{
    const index=compilePedestrianObstacles({buildings:source.previous_display_prisms});
    const access={walkableInteriorAt:neueWacheWalkableAt,interiorSolidAt:neueWacheSolidAt};
    for(let v=24;v>=2;v-=.15) {
      const [x,z]=neueWacheWorld(NEUE_WACHE_DOOR_U,v);
      const y=neueWacheGroundAt(x,z)??P.streetY;
      expect(pedestrianPointIsBlocked(x,z,y,index,access)).toBeFalse();
    }
    for(let a=0;a<Math.PI*2;a+=.2){
      const [x,z]=neueWacheWorld(Math.cos(a)*2.2,Math.sin(a)*2.2);
      expect(pedestrianPointIsBlocked(x,z,P.floorY,index,access)).toBeFalse();
    }
    for(const [u,v] of [[0,0],[NEUE_WACHE_COLUMN_U[0],19.75],[-3.55,13.37],[10.95,3]]){
      const [x,z]=neueWacheWorld(u,v);
      expect(pedestrianPointIsBlocked(x,z,P.floorY,index,access)).toBeTrue();
    }
  });
  test("hover-to-walk uses the real floor, represented roofs and open oculus in every mode",()=>{
    const sourceBefore=JSON.stringify(source.previous_display_prisms);
    for(const mode of ["day","night","snowstorm","schwellenraum","minecraft"] as const){
      const minecraft=mode==="minecraft";
      const environment:PedestrianEnvironment={
        bounds:{minX:-4000,maxX:4000,minZ:-4000,maxZ:4000},groundAt:()=>P.streetY,water:[],
        obstacles:compilePedestrianObstacles({buildings:source.previous_display_prisms},()=>mode),
        interiorGroundAt:neueWacheGroundAt,walkableInteriorAt:neueWacheWalkableAt,
        interiorSolidAt:(x,y,z,radius)=>neueWacheSolidAt(x,y,z,radius,minecraft),
      };
      const at=(u:number,v:number,hint:number)=>{
        const[x,z]=neueWacheWorld(u,v);
        return createPedestrianState(environment,{x,z,yaw:0,groundYHint:hint,preserveHorizontalPosition:true});
      };
      // The old OSM fallback top was 11.2 m, in empty air inside this hall.
      for(const hint of [11.3,12,13,14])expect(at(3,0,hint).groundY).toBe(P.floorY);
      const roof=at(3,0,17);
      expect(roof.groundY).toBe(P.roofY);
      expect(pedestrianPointIsBlocked(roof.x,roof.z,roof.groundY,environment.obstacles!,environment)).toBeFalse();
      // Off-centre in the opening, clear of the mother's protected bronze body.
      const opening=at(1.35,0,17);
      expect(opening.groundY).toBe(P.floorY);
      expect(pedestrianPointIsBlocked(opening.x,opening.z,P.floorY,environment.obstacles!,environment)).toBeFalse();
      for(const [u,v] of [[3,17],[-10.65,15.1]]){
        const roof=at(u,v,17);
        expect(roof.groundY).toBeCloseTo(neueWacheRoofAt(roof.x,roof.z,minecraft),8);
        expect(pedestrianPointIsBlocked(roof.x,roof.z,roof.groundY,environment.obstacles!,environment)).toBeFalse();
      }
    }
    expect(JSON.stringify(source.previous_display_prisms)).toBe(sourceBefore);
  });
  test("an unrelated overlapping source keeps its own roof and occupied interior",()=>{
    const[x,z]=neueWacheWorld(3,0);
    const neighbour={...source.previous_display_prisms[0],id:"unrelated-test",y0_dm:52,h_dm:118,
      ring:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([dx,dz])=>[(x+dx)*10,(z+dz)*10])};
    const environment:PedestrianEnvironment={
      bounds:{minX:-4000,maxX:4000,minZ:-4000,maxZ:4000},groundAt:()=>P.streetY,water:[],
      obstacles:compilePedestrianObstacles({buildings:[...source.previous_display_prisms,neighbour]}),
      interiorGroundAt:neueWacheGroundAt,walkableInteriorAt:neueWacheWalkableAt,interiorSolidAt:neueWacheSolidAt,
    };
    expect(createPedestrianState(environment,{x,z,yaw:0,groundYHint:18,preserveHorizontalPosition:true}).groundY).toBe(17);
    expect(pedestrianPointIsBlocked(x,z,P.floorY,environment.obstacles!,environment)).toBeTrue();
  });
  for(const minecraft of [false,true])test(`${minecraft?"Minecraft":"drawn"}: open entrance, unobstructed oculus and bounded static buffers`,()=>{
    const root=createNeueWache(minecraft);root.updateMatrixWorld(true);
    for(const[u,v]of[[3,0],[3,17],[-10.65,15.1]]){
      const[x,z]=neueWacheWorld(u,v);
      const roofHit=new Raycaster(new Vector3(x,25,z),new Vector3(0,-1,0)).intersectObject(root,true)[0];
      expect(roofHit).toBeDefined();
      expect(roofHit.point.y).toBeCloseTo(neueWacheRoofAt(x,z,minecraft),3);
    }
    const [x,z]=neueWacheWorld(0,0);
    const topHit=new Raycaster(new Vector3(x,25,z),new Vector3(0,-1,0)).intersectObject(root,true)[0];
    expect(topHit).toBeDefined();expect(topHit.point.y).toBeLessThan(P.floorY+1.7);
    const [ax,az]=neueWacheWorld(NEUE_WACHE_DOOR_U,24),[bx,bz]=neueWacheWorld(0,0);
    const origin=new Vector3(ax,P.floorY+1.35,az),target=new Vector3(bx,P.floorY+1.35,bz);
    const hit=new Raycaster(origin,target.sub(origin).normalize()).intersectObject(root,true)[0];
    expect(hit).toBeDefined();expect(hit.distance).toBeGreaterThan(22);
    let bytes=0,draws=0;
    root.traverse(o=>{
      expect(o.matrixAutoUpdate).toBeFalse();
      if(!(o instanceof Mesh))return;draws++;
      for(const attr of Object.values(o.geometry.attributes)) { bytes+=attr.array.byteLength;expect(Array.from(attr.array).every(Number.isFinite)).toBeTrue(); }
      bytes+=o.geometry.index?.array.byteLength??0;
      if(o instanceof InstancedMesh)bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);
      expect(o.userData.dayMaterial.map).toBeNull();expect(o.userData.nightMaterial.map).toBeNull();
    });
    expect(draws).toBeLessThanOrEqual(7);expect(bytes).toBeLessThan(minecraft?230_000:180_000);
    expect((root as Group).userData.openInterior).toBeTrue();
  });
});
