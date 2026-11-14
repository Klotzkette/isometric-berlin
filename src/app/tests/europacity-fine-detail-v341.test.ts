import { expect,test } from "bun:test";
import { createHash } from "node:crypto";
import {planEuropacityArchitecture,europacityFineReliefV341} from "../src/EuropacityArchitecture";
import source from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxels from "../public/mesh/regierungsviertel/minecraft-voxels.json";
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("Europacity opt-in retains every original complete row and full drawn touch detail",()=>{
  for(const minecraft of [false,true]) {
    const options={minecraft,voxels:minecraft?voxels:undefined,sourcePrisms:source.buildings};
    const before=planEuropacityArchitecture(options);
    const after=planEuropacityArchitecture({...options,fineReliefV341:true});
    expect(digest(after.slice(0,before.length))).toBe(digest(before));
    const added=after.slice(before.length);
    expect(added.length).toBeGreaterThan(1000);
    expect(added.length).toBeLessThan(10000);
    expect(added.every(b=>b.role.startsWith("v341")&&!b.glass&&b.position.every(Number.isFinite))).toBe(true);
    expect(added.some(b=>b.role==="v341 limestone sill lip")).toBe(true);
    expect(added.some(b=>b.role==="v341 glazed ceramic flute")).toBe(true);
    if(!minecraft)expect(digest(planEuropacityArchitecture({...options,mobileLike:true,fineReliefV341:true}))).toBe(digest(after));
  }
});

test("native relief has independently cardinal dimensions on actual exposed cells",()=>{
  const options={minecraft:true,voxels,sourcePrisms:source.buildings};
  const additions=europacityFineReliefV341(planEuropacityArchitecture(options),options);
  const cells=new Map<string,number[]>(),s=voxels.cell_m;
  voxels.building_rows.forEach((row,zi)=>{
    const z=voxels.grid.min_z_idx+zi;
    if(z*s< -1960||z*s> -880)return;
    for(const [x,n,lo,hi] of row)for(let i=0;i<n;i++){
      const xi=voxels.grid.min_x_idx+x+i;
      if(xi*s>=-725&&xi*s<=-50)cells.set(`${xi},${z}`,[lo/10,hi/10]);
    }
  });
  for(const b of additions){
    expect(b.yaw).toBe(0);
    const [nx,nz]=b.normal;
    expect(Math.abs(nx)+Math.abs(nz)).toBe(1);
    const x=Math.floor((b.position[0]-nx*.30)/s),z=Math.floor((b.position[2]-nz*.30)/s);
    const owner=cells.get(`${x},${z}`);
    expect(owner).toBeDefined();
    expect(owner![0]).toBeLessThanOrEqual(b.position[1]-b.size[1]/2);
    expect(owner![1]).toBeGreaterThanOrEqual(b.position[1]+b.size[1]/2);
    const neighbour=cells.get(`${x+nx},${z+nz}`);
    expect(!!neighbour&&neighbour[0]<b.position[1]+b.size[1]/2&&neighbour[1]>b.position[1]-b.size[1]/2).toBe(false);
    expect(nx?b.size[0]:b.size[2]).toBeLessThanOrEqual(.22);
  }
});
