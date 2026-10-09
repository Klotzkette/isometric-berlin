import {describe,expect,test} from "bun:test";
import {InstancedMesh,Mesh,Raycaster,Vector3} from "three";
import {createCemeteryGrunewaldV199} from "../src/CemeteryGrunewaldV199";
import {cemeteryGrunewaldV199SolidAt} from "../src/cemeteryGrunewaldV199Navigation";
import source from "../src/data/cemeteryGrunewaldV199Navigation.json";
import {grunewaldGroundAt} from "../src/grunewaldTerrainV190";

describe("Grunewald-Forst mapped grave and traversable entrance",()=>{
  for(const native of [false,true])test(`${native?"native":"drawn"} complete finite geometry and source-datum alignment`,()=>{
    const root=createCemeteryGrunewaldV199(native),nav=native?source.native:source.drawn;
    root.updateMatrixWorld(true);let bytes=0;
    expect(root.children.length).toBe(native?2:3);expect(root.userData.textureFree).toBe(true);
    for(const child of root.children){
      const mesh=child as Mesh;expect(mesh.matrixAutoUpdate).toBe(false);expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
      expect(mesh.userData.dayMaterial).not.toBe(mesh.userData.nightMaterial);
      for(const a of Object.values(mesh.geometry.attributes)){bytes+=a.array.byteLength;for(const v of a.array)expect(Number.isFinite(v)).toBe(true);}
      if(mesh instanceof InstancedMesh){
        bytes+=mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength;expect(mesh.boundingSphere!.radius).toBeGreaterThan(0);
        for(let i=0;i<mesh.count;i++){
          for(let j=0;j<16;j++)expect(Number.isFinite(mesh.instanceMatrix.array[i*16+j])).toBe(true);
          if(native)for(const j of [1,2,4,6,8,9])expect(mesh.instanceMatrix.array[i*16+j]).toBe(0);
        }
      }
    }
    expect(bytes).toBeLessThan(1024*1024);
    const grave=nav.graves.find(g=>g.id==="node/277933694")!,[x,z]=grave.point,y=grunewaldGroundAt(x,z,3,native);
    expect(grave.groundY).toBeCloseTo(y,7);
    expect(cemeteryGrunewaldV199SolidAt(x,y+.5,z,.1,native)).toBe(true);
    const ray=new Raycaster(new Vector3(x,y+4,z),new Vector3(0,-1,0));
    expect(ray.intersectObjects(root.children,false).some(h=>Math.abs(h.point.y-(y+1.18))<.004)).toBe(true);
    const [gx,gy,gz]=nav.gate;
    for(let v=-2;v<=2;v+=.25){const nx=.792,nz=.611;expect(cemeteryGrunewaldV199SolidAt(gx+nx*v,gy+1,gz+nz*v,.22,native)).toBe(false);}
    expect(cemeteryGrunewaldV199SolidAt(0,3,0,.3,native)).toBe(false);
  });
});
