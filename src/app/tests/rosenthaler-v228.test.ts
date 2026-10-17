import {describe,expect,test} from "bun:test";
import {InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,Raycaster} from "three";
import {createRosenthalerV228} from "../src/RosenthalerV228";
import {ROSENTHALER_STAIRS_V228,ROSENTHALER_V228_OPENINGS,rosenthalerV228FloorAt,rosenthalerV228SolidAt} from "../src/rosenthalerV228Profile";

describe("Rosenthaler source-aligned entrances and additive shopfronts v228",()=>{
  test("stair floors descend to finite landings; side solids leave every upper approach free",()=>{
    expect(ROSENTHALER_V228_OPENINGS.length).toBe(4);
    for(const native of [false,true])for(const r of ROSENTHALER_STAIRS_V228){
      const base=native?r.nativeSurfaceY:r.surfaceY;
      let last=base;
      for(let i=0;i<100;i++){
        const u=r.length*(i+.1)/100,x=r.top[0]+r.ux*u,z=r.top[1]+r.uz*u;
        const y=rosenthalerV228FloorAt(x,z,native)!;
        expect(y).not.toBeNull();expect(y).toBeLessThanOrEqual(last+1e-7);
        expect(rosenthalerV228SolidAt(x,y+.5,z,0,native)).toBe(false);last=y;
      }
      expect(last).toBeCloseTo(base-r.descent,6);
      expect(rosenthalerV228FloorAt(r.top[0]-r.ux*.3,r.top[1]-r.uz*.3,native)).toBeNull();
      expect(rosenthalerV228SolidAt(r.top[0]-r.ux*.3,base+.5,r.top[1]-r.uz*.3,.22,native)).toBe(false);
      expect(rosenthalerV228SolidAt(r.top[0]+r.ux*r.length/2+r.nx*(r.width/2+.11),base+.5,r.top[1]+r.uz*r.length/2+r.nz*(r.width/2+.11),0,native)).toBe(true);
    }
  });
  test("visible treads follow the walking floor within one riser across all four drawn/native runs",()=>{
    for(const native of [false,true]){
      const root=createRosenthalerV228(native);root.updateMatrixWorld(true);
      const ray=new Raycaster();ray.ray.direction.set(0,-1,0);ray.far=8;
      for(const stair of ROSENTHALER_STAIRS_V228){
        const mesh=root.children.find(o=>o.name.includes(`stair ${stair.osmWay}:`)) as InstancedMesh;
        const base=native?stair.nativeSurfaceY:stair.surfaceY;
        for(const t of [.15,.3,.45,.6,.75,.9,.96])for(const v of [-.5,0,.5]){
          const x=stair.top[0]+stair.ux*stair.length*t+stair.nx*v;
          const z=stair.top[1]+stair.uz*stair.length*t+stair.nz*v;
          ray.ray.origin.set(x,base+.22,z);
          const hits=ray.intersectObject(mesh,false);
          expect(hits.length).toBeGreaterThan(0);
          const floor=rosenthalerV228FloorAt(x,z,native)!;
          expect(Math.abs(hits[0].point.y-floor)).toBeLessThan(.18);
        }
      }
      root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();(o.material as MeshBasicMaterial).dispose();}});
    }
  });
  test("six compact batches per representation, finite matrices, no textures or source object retention",()=>{
    for(const native of [false,true]){
      const root=createRosenthalerV228(native);expect(root.children.length).toBe(6);
      let bytes=0;const m=new Matrix4();
      root.traverse(o=>{
        expect(o.userData.source).toBeUndefined();expect(o.userData.boxes).toBeUndefined();
        if(!(o instanceof Mesh))return;
        expect(o.geometry.getAttribute("uv")).toBeUndefined();expect((o.material as MeshBasicMaterial).map).toBeNull();
        const mesh=o as InstancedMesh;
        bytes+=mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength;
        for(let i=0;i<mesh.count;i++){
          mesh.getMatrixAt(i,m);expect(m.elements.every(Number.isFinite)).toBe(true);
          if(native)for(const j of [1,2,4,6,8,9])expect(m.elements[j]).toBe(0);
        }
      });
      expect(bytes).toBeLessThan(native?235000:60000);
    }
  });
});
