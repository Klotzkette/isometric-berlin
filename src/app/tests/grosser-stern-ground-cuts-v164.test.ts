import { expect, test } from 'bun:test';
import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { cutGrosserSternGatehouseGroundSurface, restoreGrosserSternGatehouseGroundOwnership } from '../src/MinecraftVoxelWorld';
import { GROSSER_STERN_GATEHOUSES_V164_GROUND_CUTS, GROSSER_STERN_GATEHOUSES_V164_PROFILE, gatehouseV164World } from '../src/grosserSternGatehousesV164Profile';
const area=(p:readonly (readonly number[])[])=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
function meshArea(g:BufferGeometry,topY?:number):number {
  const p=g.getAttribute('position'),ix=g.index;let sum=0;
  for(let i=0;i<(ix?.count??p.count);i+=3){const a=ix?ix.getX(i):i,b=ix?ix.getX(i+1):i+1,c=ix?ix.getX(i+2):i+2;
    if(topY!==undefined&&[a,b,c].some(i=>Math.abs(p.getY(i)-topY)>.001))continue;
    sum+=Math.abs((p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a))-(p.getX(c)-p.getX(a))*(p.getZ(b)-p.getZ(a)))/2;
  }return sum;
}
const down=(root:Mesh,x:number,z:number)=>new Raycaster(new Vector3(x,15,z),new Vector3(0,-1,0)).intersectObject(root,true);

test('rotated stair apertures retain exact outside area and interpolated terrain height',()=>{
  for(const ring of GROSSER_STERN_GATEHOUSES_V164_GROUND_CUTS){
    const x0=Math.min(...ring.map(p=>p[0]))-2,x1=Math.max(...ring.map(p=>p[0]))+2;
    const z0=Math.min(...ring.map(p=>p[1]))-2,z1=Math.max(...ring.map(p=>p[1]))+2;
    const y=(x:number,z:number)=>12+x*.002+z*.003;
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([x0,y(x0,z0),z0,x1,y(x1,z0),z0,x1,y(x1,z1),z1,x0,y(x0,z1),z1],3));g.setIndex([0,2,1,0,3,2]);
    const before=Array.from(g.getAttribute('position').array),beforeIndex=Array.from(g.index!.array);
    const result=cutGrosserSternGatehouseGroundSurface(g),p=result.getAttribute('position');expect(result).not.toBe(g);
    expect(meshArea(result)).toBeCloseTo((x1-x0)*(z1-z0)-area(ring),2);
    for(let i=0;i<p.count;i++)expect(p.getY(i)).toBeCloseTo(y(p.getX(i),p.getZ(i)),5);
    expect(Array.from(p.array).slice(0,before.length)).toEqual(before);
    expect(Array.from(g.getAttribute('position').array)).toEqual(before);expect(Array.from(g.index!.array)).toEqual(beforeIndex);
    const mesh=new Mesh(result,new MeshBasicMaterial({side:DoubleSide}));mesh.updateMatrixWorld(true);
    const center=ring.reduce((s,p)=>[s[0]+p[0]/4,s[1]+p[1]/4],[0,0]);expect(down(mesh,...center as [number,number])).toHaveLength(0);
    expect(down(mesh,x0+.3,z0+.3).length).toBeGreaterThan(0);g.dispose();result.dispose();
  }
});

test('untouched indexed terrain returns its original object and preserves indices',()=>{
  const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([0,5,0,20,6,0,0,5,20],3));g.setIndex([0,1,2]);
  expect(cutGrosserSternGatehouseGroundSurface(g)).toBe(g);
  expect(Array.from(g.index!.array)).toEqual([0,1,2]);g.dispose();
});

test('ground runs keep paint and heights everywhere outside the exact four wells',()=>{
  const slabs=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),5),m=new Matrix4(),c=new Color();
  const tones=[0xAA9977,0x638159,0xC3BAA1,0x797E83,0x112233];
  for(let i=0;i<4;i++){const h=GROSSER_STERN_GATEHOUSES_V164_PROFILE[i];m.makeScale(30,12,24).setPosition(h.center[0],-.8,h.center[1]);slabs.setMatrixAt(i,m);slabs.setColorAt(i,c.setHex(tones[i]));}
  m.makeScale(4,12,4).setPosition(0,-.8,0);slabs.setMatrixAt(4,m);slabs.setColorAt(4,c.setHex(tones[4]));
  const farMatrix=Array.from(slabs.instanceMatrix.array.slice(64,80)),farColor=Array.from(slabs.instanceColor!.array.slice(12,15));
  const sentinel=new Mesh(new BoxGeometry(1,1,1),new MeshBasicMaterial());sentinel.name='Earlier disjoint ownership';slabs.add(sentinel);
  restoreGrosserSternGatehouseGroundOwnership(slabs);expect(slabs.count).toBe(1);
  expect(Array.from(slabs.instanceMatrix.array)).toEqual(farMatrix);expect(Array.from(slabs.instanceColor!.array)).toEqual(farColor);
  expect(slabs.children[0]).toBe(sentinel);
  const complement=slabs.children.find(c=>c.userData.gatehouseGroundOwnership) as Mesh;expect(complement).toBeDefined();expect(complement.userData.affectedRuns).toBe(4);
  const expected=4*30*24-GROSSER_STERN_GATEHOUSES_V164_GROUND_CUTS.reduce((s,r)=>s+area(r),0);
  expect(meshArea(complement.geometry,5.2)).toBeCloseTo(expected,2);
  const pos=complement.geometry.getAttribute('position'),colors=complement.geometry.getAttribute('color');
  for(let i=0;i<pos.count;i++){
    expect(Math.min(Math.abs(pos.getY(i)-5.2),Math.abs(pos.getY(i)+6.8))).toBeLessThan(.00001);
    const matching=GROSSER_STERN_GATEHOUSES_V164_PROFILE.findIndex(h=>Math.abs(pos.getX(i)-h.center[0])<15.01&&Math.abs(pos.getZ(i)-h.center[1])<12.01);expect(matching).toBeGreaterThanOrEqual(0);
    c.setHex(tones[matching]);expect(colors.getX(i)).toBeCloseTo(c.r,6);expect(colors.getY(i)).toBeCloseTo(c.g,6);expect(colors.getZ(i)).toBeCloseTo(c.b,6);
  }
  slabs.updateMatrixWorld(true);
  for(const h of GROSSER_STERN_GATEHOUSES_V164_PROFILE){
    const center=gatehouseV164World(h,0,0,0);expect(down(slabs,center[0],center[2])).toHaveLength(0);
    // Two centimetres outside the well remains: never remove a whole 4 m cell.
    for(const u of [-2.60,2.60]){const p=gatehouseV164World(h,u,0,0);const hit=down(slabs,p[0],p[2])[0];expect(hit).toBeDefined();expect(hit.point.y).toBeCloseTo(5.2,5);}
  }
});
