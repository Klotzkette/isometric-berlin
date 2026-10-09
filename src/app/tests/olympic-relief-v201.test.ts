import {expect,test} from "bun:test";
import {Mesh,InstancedMesh} from "three";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {olympicTerrainOffsetV201} from "../src/olympicTerrainV201";
import {terrainGroundAt} from "../src/weinbergTerrainV176";
import {grunewaldTerrainOffset} from "../src/grunewaldTerrainV190";
import {westernStadiumGroundYV187} from "../src/westernStadiumGroundV187";
import {createWesternLandmarksV187,createMinecraftWesternLandmarksV187} from "../src/WesternLandmarksV187";
import field from "../src/data/olympicTerrainV201.json";
import source from "../src/data/westLandmarksV187.json";
import evidence from "../../../geo_data/regierungsviertel/olympic-landmarks-v201.json";

test("Olympic datum is measured; native terraces and invalid queries are bounded",()=>{
  expect(terrainGroundAt(-9651,151)).toBeCloseTo(7.66,8);
  expect(terrainGroundAt(-9651,245)).toBeCloseTo(31.98,8);
  expect(terrainGroundAt(-8780,266)).toBeCloseTo(36.0525,8);
  expect(westernStadiumGroundYV187(-8963,262)).toBeCloseTo(23.05,8);
  for(const q of [NaN,Infinity,-Infinity]){
    expect(olympicTerrainOffsetV201(q,0)).toBeNull();
    expect(olympicTerrainOffsetV201(0,q,true)).toBeNull();
  }
  for(const [x,z] of [[-9652,148],[-9636,204],[-8948,268]]){
    const expected=terrainGroundAt(x,z,3,true);
    for(const dx of [-3.99,0,3.99])for(const dz of [-3.99,0,3.99])
      expect(terrainGroundAt(x+dx,z+dz,3,true)).toBeCloseTo(expected,8);
  }
});

test("every apron interval joins the unchanged earlier field without doubling height",()=>{
  const [w,n,e,s]=field.profiles[0].support;
  for(const [axis,edge,a,b] of [[0,w,n,s],[0,e,n,s],[1,n,w,e],[1,s,w,e]])
    for(let position=a;position<b;position+=8)for(const fraction of [.17,.63]){
      const x=axis===0?edge:position+8*fraction,z=axis===1?edge:position+8*fraction;
      expect(olympicTerrainOffsetV201(x,z)).toBeNull();
      const near=olympicTerrainOffsetV201(Math.max(w+1e-6,Math.min(e-1e-6,x)),Math.max(n+1e-6,Math.min(s-1e-6,z)));
      expect(near!).toBeCloseTo(grunewaldTerrainOffset(x,z),3);
    }
});

test("retained stadium XZ/detail count and rigid canopy height survive both modes",()=>{
  expect(createHash("sha256").update(readFileSync(new URL("../src/data/westLandmarksV187.json",import.meta.url))).digest("hex")).toBe(evidence.sourceSha256);
  const old=source.groups.find(g=>g.name==="Olympiastadion")!;
  for(const native of [false,true]){
    const root=native?createMinecraftWesternLandmarksV187():createWesternLandmarksV187();
    const group=root.children.find(g=>g.name==="Olympiastadion")!;
    const instances=group.children.find(g=>g instanceof InstancedMesh) as InstancedMesh;
    expect(instances.count).toBe(native?old.native.length:old.boxes.length+old.rods.length);
    if(!native){
      const mesh=group.children.find(g=>g instanceof Mesh&&!(g instanceof InstancedMesh)) as Mesh;
      const positions=mesh.geometry.getAttribute("position");let i=0;
      for(const s of old.surfaces)for(const tri of s.triangles)for(const p of tri){
        expect(positions.getX(i)).toBeCloseTo(p[0],2);expect(positions.getZ(i)).toBeCloseTo(p[2],3);
        if(p[1]>=3.55)expect(positions.getY(i)).toBeCloseTo(p[1]+33.45,4);
        i++;
      }
      expect(positions.count).toBe(i);
    }else{
      for(let i=0;i<instances.count;i++){
        const m=instances.instanceMatrix.array.slice(i*16,i*16+16);
        for(const j of [1,2,4,6,8,9])expect(m[j]).toBe(0);
      }
    }
    let bytes=0,calls=0;
    root.traverse(o=>{if(o instanceof Mesh){calls++;for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;if(o instanceof InstancedMesh)bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);}});
    expect(calls).toBeLessThanOrEqual(26);expect(bytes).toBeLessThan(12*1024*1024);
  }
});
