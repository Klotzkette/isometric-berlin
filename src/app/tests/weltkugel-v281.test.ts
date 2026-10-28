import { describe, expect, test } from "bun:test";
import { Box3, Color, Group, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import { createHash } from "node:crypto";
import { createWeltkugelV281, WELTKUGEL_V281 as P, weltkugelBodyBlockedV281 } from "../src/WeltkugelBrunnenV281";
import { createWeltkugelColumnTesterV281, isWeltkugelSourceV281 } from "../src/weltkugelV281Ownership";
import data from "../src/data/weltkugelV281Ownership.json";
import { createCityWestDetails } from "../src/CityWestDetails";

const digest=(root:any)=>{const hash=createHash("sha256");root.traverse((m:any)=>{if(m.geometry){for(const a of Object.values(m.geometry.attributes) as any[])hash.update(new Uint8Array(a.array.buffer));if(m.geometry.index)hash.update(new Uint8Array(m.geometry.index.array.buffer));}if(m.isInstancedMesh){hash.update(new Uint8Array(m.instanceMatrix.array.buffer));if(m.instanceColor)hash.update(new Uint8Array(m.instanceColor.array.buffer));}});return hash.digest("hex");};

function expectVisibleBronze(root: Group, side: -1 | 1, y: number, z: number) {
  const hits=new Raycaster(new Vector3(P.globeCenter[0]+side*10,y,z),new Vector3(-side,0,0)).intersectObject(root,true);
  expect(hits.length).toBeGreaterThan(0);
  const hit=hits[0],mesh=hit.object as Mesh,color=new Color(),bronze=new Color(0x3e4841);
  if(mesh instanceof InstancedMesh)mesh.getColorAt(hit.instanceId!,color);
  else color.fromBufferAttribute(mesh.geometry.getAttribute("color"),hit.face!.a);
  // Drawn colors are normalized uint8 linear values, native colors float32.
  expect(Math.abs(color.r-bronze.r)+Math.abs(color.g-bronze.g)+Math.abs(color.b-bronze.b)).toBeLessThan(.01);
}
describe("Weltkugelbrunnen exact replacement",()=>{
  test("rejects changed, absent, duplicate or newly overlapping owners",()=>{
    const p=data.previousPrisms[0], c=data.columns[0] as [number,number,number,number,number];
    expect(isWeltkugelSourceV281(p)).toBe(true);
    expect(isWeltkugelSourceV281({...p,h_dm:p.h_dm+1})).toBe(false);
    for(const input of [undefined,[],[p,p],[{...p,h_dm:91}],[p,{...p,id:"foreign"}]])
      expect(createWeltkugelColumnTesterV281(input,4)(...c)).toBe(false);
    const matches=createWeltkugelColumnTesterV281([p],4);
    expect(data.columns.filter(c=>matches(...c as typeof c & [number,number,number,number,number])).length).toBe(17);
    expect(matches(c[0],c[1],c[2],c[3]+1,c[4])).toBe(false);
    expect(createWeltkugelColumnTesterV281([p],2)(...c)).toBe(false);
  });
  test("retains every mapped rim vertex without the nine-metre generic tower",()=>{
    const root=createWeltkugelV281(), mesh=root.children.find(c=>c instanceof Mesh) as Mesh;
    const pos=mesh.geometry.getAttribute("position");
    for(const [x,z] of P.sourceRing){let found=false;for(let i=0;i<pos.count;i++)if(Math.abs(pos.getX(i)-x)<.001&&Math.abs(pos.getZ(i)-z)<.001&&Math.abs(pos.getY(i)-5.31)<.001)found=true;expect(found).toBe(true);}
    const box=new Box3().setFromObject(root);expect(box.max.y).toBeLessThan(10.1);expect(box.max.y).toBeGreaterThan(9.9);
    const ray=new Raycaster(new Vector3(-2413,15,1531),new Vector3(0,-1,0));
    const hits=ray.intersectObject(root,true);expect(hits.length).toBeGreaterThan(0);expect(hits[0].point.y).toBeCloseTo(5.48,2);
    expect(digest(root)).toBe(digest(createWeltkugelV281(false,{mobileLike:true})));
  });
  test("keeps independent native geometry orthogonal, finite and within its small batch",()=>{
    const root=createWeltkugelV281(true), mesh=root.children[0] as InstancedMesh,m=new Matrix4();
    expect(root.children.length).toBe(1);expect(mesh.count).toBeLessThan(5000);expect(mesh.count).toBeGreaterThan(1000);
    for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);expect(m.elements.every(Number.isFinite)).toBe(true);for(const k of [1,2,4,6,8,9])expect(m.elements[k]).toBe(0);}
    expect(mesh.geometry.type).toBe("BoxGeometry");expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect(digest(root)).not.toBe(digest(createWeltkugelV281()));
    expect(new Box3().setFromObject(root).max.y).toBeLessThan(10.1);
  });
  test("shows the complete relief panels and both lower diamond halves outside each globe skin",()=>{
    for(const native of [false,true]) {
      const root=createWeltkugelV281(native);root.updateMatrixWorld(true);
      for(const [dz,h,w] of [[-1.8,3.1,.8],[0,2.4,.65],[1.75,3.15,.75]])
        for(let iy=0;iy<7;iy++)for(let iz=0;iz<7;iz++)
          expectVisibleBronze(root,1,5.2+.5+h*.57+h*.42*(iy/6-.5)*.94,P.globeCenter[1]+dz+w*.6*(iz/6-.5)*.94);
      for(const dz of [-1.2,1.2]) {
        const y=7.9,z=P.globeCenter[1]+dz,points=[[y+.45,z],[y,z+.36],[y-.45,z],[y,z-.36],[y+.45,z]];
        for(let edge=0;edge<4;edge++)for(let sample=0;sample<=10;sample++) {
          const a=points[edge],b=points[edge+1],t=sample/10;
          expectVisibleBronze(root,-1,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);
        }
      }
      expect(digest(root)).toBe(digest(createWeltkugelV281(native,{mobileLike:true})));
    }
  });
  test("does not replace church, square furnishings or other City West geometry",()=>{
    const current=createCityWestDetails(),omitted=createCityWestDetails("full",true,"omit");
    const fountain=current.getObjectByName("Weltkugelbrunnen v281")!;expect(fountain).toBeDefined();fountain.removeFromParent();
    expect(digest(current)).toBe(digest(omitted));
    expect(weltkugelBodyBlockedV281(...P.globeCenter,5.2,6.9,.25)).toBe(true);
    expect(weltkugelBodyBlockedV281(-2413,1531,5.2,6.9,.25)).toBe(false);
    expect(weltkugelBodyBlockedV281(...P.globeCenter,11,12.7,.25)).toBe(false);
  });
});
