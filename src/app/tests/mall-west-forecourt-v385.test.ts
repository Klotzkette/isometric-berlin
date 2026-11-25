import { expect,test } from "bun:test";
import { Mesh, Raycaster, Triangle, Vector3 } from "three";
import { createMallWestForecourtV385 } from "../src/potsdamerForecourtsV385";
import { CLASS_SHADES, createGroundSlabs, smoothGroundTopSampler, type VoxelPayload } from "../src/terrainPayload";
import packet from "../src/data/mallWestForecourtV385.json";

test.each([false,true])("west entrance paving joins the retained ground and keeps the edge of the square, native=%s",async native=>{
  const group=createMallWestForecourtV385(native);
  group.updateMatrixWorld(true);
  expect(group.children.length).toBe(1);
  const surface=group.children[0] as Mesh;
  const geom=surface.geometry,position=geom.getAttribute("position"),index=geom.index!;
  const url=new URL("../public/mesh/regierungsviertel/ground-context.json",import.meta.url);
  const original=await Bun.file(url).json() as VoxelPayload;
  const smooth=smoothGroundTopSampler(original);
  // Keep complete original horizontal runs so their midpoint still supplies
  // the true source DTM height; exclude only rows outside this tiny station.
  const ground_rows=original.ground_rows.map((runs,i)=>{
    const z=(i+original.grid.min_z_idx)*original.cell_m;
    return z<984 || z>1025 ? [] : runs.filter(([i,n])=>{
      const x=(original.grid.min_x_idx+i)*original.cell_m;
      return x<=535 && x+n*original.cell_m>=510;
    });
  });
  const ground=createGroundSlabs({...original,ground_rows},"actual entrance ground",CLASS_SHADES,
    {parkRelief:native?"native":"drawn"});
  ground.updateMatrixWorld(true);
  const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
  const at=(x:number,z:number,target:Mesh)=>{
    ray.ray.origin.set(x,12,z);return ray.intersectObject(target)[0]?.point.y;
  };
  let area=0,sides=0,top=0;
  for(let i=0;i<index.count;i+=3) {
    const [a,b,c]=[0,1,2].map(j=>new Vector3().fromBufferAttribute(position,index.getX(i+j)));
    const triangle=new Triangle(a,b,c),normal=triangle.getNormal(new Vector3());
    if(normal.y<.001){sides++;continue;}
    const centre=triangle.getMidpoint(new Vector3()),old=at(centre.x,centre.z,ground);
    expect(old).toBeDefined();
    expect(centre.y-old!).toBeGreaterThan(.025);
    const xOffset=centre.x/original.cell_m-original.grid.min_x_idx;
    const zOffset=centre.z/original.cell_m-original.grid.min_z_idx;
    expect(Math.abs(centre.y-(smooth(xOffset,zOffset)+.10))).toBeLessThan(.036);
    expect(centre.x).toBeGreaterThan(516.5);
    expect(centre.x).toBeLessThan(533);
    area+=triangle.getArea()*normal.y;top++;
  }
  expect(sides).toBeGreaterThan(40);
  expect(top).toBe(native?2*packet.native.length:235);
  if(native)expect(area).toBeCloseTo(packet.native.reduce((a,r)=>a+r[2]/16,0),2);
  else expect(Math.abs(area-174.5846)).toBeLessThan(.01); // millimetre footprint rounding
  for(const [x,z] of [[526,998.7],[525,1005.5],[527,1012],[530.35,1018.4]])
    expect(at(x,z,surface)!).toBeGreaterThan(at(x,z,ground)!+.025);
  // Fahrbahn, actual stair to U2, lawn, surveyed street tree, mall interior.
  for(const [x,z] of [[519,1004],[511.614,1010.57],[490,1000],[508.46,999.67],[536,1004]])
    expect(at(x,z,surface)).toBeUndefined();
  // The drawn world's original packet already paves the door. Only the
  // native predecessor leaves the coarse grass cell there.
  const door = at(529.8,998.15,surface);
  if(native)expect(door).toBeCloseTo(5,2);
  else expect(door).toBeUndefined();
  let grounded=0;
  const walls=native
    ? packet.nativeSides.map(([a,b,c,d,y,base])=>[320+a/4,980+b/4,320+c/4,980+d/4,y/1000,base/1000])
    : packet.sides.map(([a,b,base])=>{
      const p=packet.vertices[a],q=packet.vertices[b];
      return [320+p[0]/1000,980+p[1]/1000,320+q[0]/1000,980+q[1]/1000,(p[2]+q[2])/2000,base/1000];
    });
  for(const [ax,az,bx,bz,y,base] of walls) {
    if(y-base<.5 || Math.hypot(bx-ax,bz-az)<.2)continue;
    const normal=new Vector3(az-bz,0,bx-ax).normalize();
    const mid=new Vector3((ax+bx)/2,(base+y)/2,(az+bz)/2);
    const sideRay=new Raycaster(mid.addScaledVector(normal,.02),normal.negate(),0,.04);
    expect(sideRay.intersectObject(surface)[0]?.distance).toBeCloseTo(.02,2);
    grounded++;
  }
  expect(grounded).toBeGreaterThan(4);
});
