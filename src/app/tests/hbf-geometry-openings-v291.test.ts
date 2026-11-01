import { describe, expect, test } from "bun:test";
import { BoxGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { HBF_CIRCULATION_V291, hbfRailCurveAtV291 } from "../src/HbfCirculationV291";
import { hbfBoxFragmentsV291, hbfCompactNativeBayFragmentsV291, hbfFlightOpeningsV291, hbfGeometryComplementV291, hbfMergeAdjacentBoxesV291, hbfOfficeRailUnderpassV291, hbfPolygonComplementV291, hbfSlabOpeningsV291, type HbfOpeningV291 } from "../src/HbfGeometryOpeningsV291";

function volume(g:BoxGeometry|ReturnType<typeof hbfGeometryComplementV291>):number {
  const p=g.getAttribute("position"),index=g.index;let sum=0;
  const v=(i:number)=>new Vector3(p.getX(i),p.getY(i),p.getZ(i));
  for(let i=0;i<(index?.count??p.count);i+=3) {
    const a=v(index?index.getX(i):i),b=v(index?index.getX(i+1):i+1),c=v(index?index.getX(i+2):i+2);
    sum+=a.dot(b.cross(c))/6;
  }
  return Math.abs(sum);
}
const inside=(cut:HbfOpeningV291,p:readonly number[])=>cut.planes.every(a=>a[0]*p[0]+a[1]*p[1]+a[2]*p[2]+a[3]>=-1e-7);
const hits=(g:ReturnType<typeof hbfGeometryComplementV291>,p:Vector3,d:Vector3,length=20)=>{const m=new Mesh(g,new MeshBasicMaterial({side:2}));m.updateMatrixWorld(true);return new Raycaster(p,d,0,length).intersectObject(m);};

describe("Hbf bounded real geometry openings",()=>{
  test("native fragments merge only along complete exactly equal faces",()=>{
    const rows=[{min:[0,0,0] as const,max:[1,1,1] as const},{min:[1,0,0] as const,max:[2,1,1] as const},{min:[0,0,1] as const,max:[2,1,2] as const},{min:[3,0,0] as const,max:[4,1,1] as const}];
    const original=structuredClone(rows),merged=hbfMergeAdjacentBoxesV291(rows);
    expect(merged).toHaveLength(2);expect(rows).toEqual(original);
    expect(merged).toContainEqual({min:[0,0,0],max:[2,1,2]});
    const almost=[{min:[0,0,0] as const,max:[1,1,1] as const},{min:[1+1e-10,0,0] as const,max:[2,1,1] as const}];
    expect(hbfMergeAdjacentBoxesV291(almost)).toHaveLength(2);
  });
  test("native bay compaction preserves every occupied cell and float32 world boundary",()=>{
    const boxes=[{min:[0,0,0] as const,max:[1,1,4] as const},{min:[1,0,0] as const,max:[3,1,1] as const},
      {min:[1,0,1] as const,max:[2,1,3] as const},{min:[2,0,1] as const,max:[3,1,4] as const}];
    const original=structuredClone(boxes),merged=hbfCompactNativeBayFragmentsV291(boxes);
    expect(boxes).toEqual(original);expect(merged.length).toBeLessThan(boxes.length);
    const contains=(rows:typeof boxes,p:readonly number[])=>rows.some(b=>p.every((n,i)=>n>b.min[i]&&n<b.max[i]));
    for(let x=.25;x<3;x+=.5)for(let y=.25;y<1;y+=.5)for(let z=.25;z<4;z+=.5)
      expect(contains(merged as typeof boxes,[x,y,z])).toBe(contains(boxes,[x,y,z]));
    const gap=[{min:[0,0,0] as const,max:[1,1,1] as const},{min:[1+1e-10,0,0] as const,max:[2,1,1] as const}];
    expect(hbfCompactNativeBayFragmentsV291(gap)).toHaveLength(2);
    const residue=[{min:[0,0,0] as const,max:[1+5e-14,1,1] as const},{min:[1-5e-14,0,0] as const,max:[2,1,1] as const}];
    expect(hbfCompactNativeBayFragmentsV291(residue)).toHaveLength(1);
    const frame=HBF_CIRCULATION_V291.frame,r=frame.rotationDegrees*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
    const world=(p:readonly number[])=>[frame.anchorWorld[0]+c*p[0]+s*p[2],frame.anchorWorld[1]+p[1],frame.anchorWorld[2]-s*p[0]+c*p[2]].map(Math.fround);
    for(const b of residue)for(const p of[b.min,b.max])expect(world(p)).toEqual(world(p.map(n=>Number(n.toFixed(12)))));
  });
  test("convex subtraction preserves exact outside volume and unrelated identity",()=>{
    const source=new BoxGeometry(10,10,10);
    const cut:HbfOpeningV291={id:"bounded",bounds:{min:[-2,-2,-2],max:[2,2,2]},planes:[[1,0,0,2],[-1,0,0,2],[0,1,0,2],[0,-1,0,2],[0,0,1,2],[0,0,-1,2]],nativeBoxes:[{min:[-2,-2,-2],max:[2,2,2]}]};
    const result=hbfGeometryComplementV291(source,[cut]);
    expect(volume(result)).toBeCloseTo(936,5);
    expect(volume(source)).toBeCloseTo(1000,5);
    // Retained solid above the void has no false internal face atx=±2.
    const crossings=hits(result,new Vector3(3,3,0),new Vector3(-1,0,0),9);
    expect(crossings.length).toBeGreaterThan(0);
    expect(crossings.every(hit=>Math.abs(hit.distance-8)<1e-6)).toBeTrue();
    const shifted=new BoxGeometry(1,1,1).translate(50,0,0);
    expect(hbfGeometryComplementV291(shifted,[cut])).toBe(shifted);
    const blocks=hbfBoxFragmentsV291({min:[-5,-5,-5],max:[5,5,5]},[cut]);
    expect(blocks.reduce((s,b)=>s+b.min.reduce((p,n,i)=>p*(b.max[i]-n),1),0)).toBeCloseTo(936,9);
  });
  test("polygon clipping keeps attached attributes and untouched faces",()=>{
    const opening=hbfSlabOpeningsV291(9.25,10.73)[0];
    const poly=[[100,0,100,7],[101,0,100,7],[101,0,101,7]];
    expect(hbfPolygonComplementV291(poly,[opening])).toBeNull();
    const f=HBF_CIRCULATION_V291.flights.find(f=>f.fromLevelId==="upper-rail")!;
    const x=(f.from[0]+f.to[0])/2,z=(f.from[2]+f.to[2])/2;
    const pieces=hbfPolygonComplementV291([[x-6,9.8,z-4,7],[x+6,9.8,z-4,7],[x+6,9.8,z+4,7],[x-6,9.8,z+4,7]],[opening]);
    expect(pieces).not.toBeNull();
    for(const piece of pieces!)for(const p of piece)expect(p[3]).toBe(7);
  });
  test("the real deck bottom determines headroom below the upper platform",()=>{
    const f=HBF_CIRCULATION_V291.flights.find(f=>f.fromLevelId==="upper-rail")!;
    const cut=hbfFlightOpeningsV291().find(c=>c.id===f.id)!;
    // At6.5m foot height the old floorTop−2.5 test missed a ceiling at9.25m.
    const t=(10.73-6.5)/(10.73-4.85),x=f.from[0]+(f.to[0]-f.from[0])*t,z=f.from[2]+(f.to[2]-f.from[2])*t;
    expect(inside(cut,[x,9.25,z])).toBeTrue();
    expect(inside(cut,[x,9.45,z])).toBeFalse();
    const slab=new BoxGeometry(90,1.1,70).translate(0,9.8,0);
    const opened=hbfGeometryComplementV291(slab,[cut]);
    expect(hits(opened,new Vector3(x,8,z),new Vector3(0,1,0),1.35)).toHaveLength(0);
    expect(hits(opened,new Vector3(x,10,z+8),new Vector3(0,-1,0),2).length).toBeGreaterThan(0);
  });
  test("native stair mouths keep their XZ course and cross the entire actual slab",()=>{
    const bottom=9.25,top=10.73,cuts=hbfSlabOpeningsV291(bottom,top,true);
    const mouths=cuts.filter(c=>c.id.startsWith("hbf-escalator")||c.id.startsWith("hbf-stairs"));
    expect(mouths.length).toBeGreaterThan(0);
    for(const c of mouths){expect(c.bounds.min[1]).toBe(bottom);expect(c.bounds.max[1]).toBe(top);expect(c.nativeBoxes).toEqual([c.bounds]);}
  });
  test("all six shaft mouths and all six upper flights clear slab faces",()=>{
    const cuts=hbfSlabOpeningsV291(9.25,10.73),upper=HBF_CIRCULATION_V291.flights.filter(f=>f.fromLevelId==="upper-rail");
    expect(upper).toHaveLength(6);
    const source=new BoxGeometry(100,1.48,80).translate(0,9.99,0),opened=hbfGeometryComplementV291(source,cuts);
    for(const s of HBF_CIRCULATION_V291.shafts)expect(hits(opened,new Vector3(s.x,15,s.z),new Vector3(0,-1,0),9)).toHaveLength(0);
    for(const f of upper) {
      const t=.5,x=f.from[0]+(f.to[0]-f.from[0])*t,z=f.from[2]+(f.to[2]-f.from[2])*t,y=f.from[1]+(f.to[1]-f.from[1])*t;
      expect(hits(opened,new Vector3(x,y+.1,z),new Vector3(0,1,0),2.7)).toHaveLength(0);
    }
  });
  test("office underpasses retain offices above and glass outside the rail hall",()=>{
    for(const x of [-35,35]) {
      const cut=hbfOfficeRailUnderpassV291(x,20);
      for(const box of cut.nativeBoxes!)for(const xx of box.min[0]===box.max[0]?[box.min[0]]:[box.min[0],box.max[0]])for(const yy of[box.min[1],box.max[1]])for(const zz of[box.min[2],box.max[2]])expect(inside(cut,[xx,yy,zz])).toBeTrue();
      const source=new BoxGeometry(20,46,180).translate(x,23,0),opened=hbfGeometryComplementV291(source,[cut]);
      expect(hits(opened,new Vector3(x-15,12,hbfRailCurveAtV291(x)),new Vector3(1,0,0),30)).toHaveLength(0);
      expect(hits(opened,new Vector3(x-15,35,0),new Vector3(1,0,0),30).length).toBeGreaterThan(0);
      expect(hits(opened,new Vector3(x-15,12,70),new Vector3(1,0,0),30).length).toBeGreaterThan(0);
      expect(volume(opened)).toBeGreaterThan(volume(source)*.8);
    }
  });
});
