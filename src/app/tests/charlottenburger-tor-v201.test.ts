import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Box3, BufferGeometry, InstancedMesh, Matrix4, Mesh, Vector3 } from "three";
import { buildCharlottenburgerTorWingV201, createCharlottenburgerTorV201 } from "../src/CharlottenburgerTorV201";
import { createMinecraftCharlottenburgerTorV201 } from "../src/MinecraftCharlottenburgerTorV201";
import { CHARLOTTENBURGER_TOR_PROFILE as profile } from "../src/charlottenburgerTorV201Profile";
import { charlottenburgerTorV201SolidAt as solid } from "../src/charlottenburgerTorV201Navigation";
import baseline from "./fixtures/charlottenburger-tor-v200.json";
import nativeData from "../src/data/charlottenburgerTorV201.json";
import evidence from "../../../geo_data/regierungsviertel/charlottenburger-tor-v201-evidence.json";

const oldYaw=.087;
function disposeParts(b:ReturnType<typeof buildCharlottenburgerTorWingV201>):void {
  [...b.parts,...b.edges,...b.lamps].forEach(g=>g.dispose());
}
function oldCenter(side:number):Vector3 {
  const z=side*20.2;
  return new Vector3(profile.anchorWorldM[0]+z*Math.sin(oldYaw),0,profile.anchorWorldM[2]+z*Math.cos(oldYaw));
}
function center(g:BufferGeometry):Vector3 {g.computeBoundingBox();return g.boundingBox!.getCenter(new Vector3());}

describe("source-aligned Charlottenburger Tor wings",()=>{
  test("retains the actual v200 primitive/index/colour bytes before placement",()=>{
    const wings=[buildCharlottenburgerTorWingV201(-1,false),buildCharlottenburgerTorWingV201(1,false)];
    for(const key of ["parts","edges","lamps"] as const){
      const all=wings.flatMap(w=>w[key]),hash=createHash("sha256");
      expect(all.length).toBe(baseline.counts[key]);
      for(const g of all){
        for(const a of Object.keys(g.attributes).sort())hash.update(Buffer.from(g.getAttribute(a).array.buffer));
        if(g.index)hash.update(Buffer.from(g.index.array.buffer));
      }
      expect(hash.digest("hex")).toBe(baseline.hashes[key]);
    }
    wings.forEach(disposeParts);
  });
  test("rigidly carries every original detail; only the southern principal figure translates to east",()=>{
    for(const side of [-1,1] as const){
      const old=buildCharlottenburgerTorWingV201(side,false),next=buildCharlottenburgerTorWingV201(side);
      const wing=profile.wings[side<0?0:1],oc=oldCenter(side);
      expect(wing.centerWorldM[0]).toBeCloseTo(evidence.wings[side<0?0:1].centerWorldM[0],7);
      expect(wing.centerWorldM[1]).toBeCloseTo(evidence.wings[side<0?0:1].centerWorldM[1],7);
      expect(wing.yawRadians*180/Math.PI).toBeCloseTo(evidence.wings[side<0?0:1].yawDegrees,7);
      const inverse=new Matrix4().makeTranslation(oc.x,0,oc.z)
        .multiply(new Matrix4().makeRotationY(oldYaw-wing.yawRadians))
        .multiply(new Matrix4().makeTranslation(-wing.centerWorldM[0],0,-wing.centerWorldM[1]));
      for(const key of ["parts","edges","lamps"] as const){
        expect(next[key].length).toBe(old[key].length);
        for(let part=0;part<old[key].length;part++){
          const before=old[key][part],after=next[key][part];
          expect(after.index?.array).toEqual(before.index?.array);
          expect(after.getAttribute("color")?.array).toEqual(before.getAttribute("color")?.array);
          const bp=before.getAttribute("position"),ap=after.getAttribute("position");
          const statue=side>0&&((key==="parts"&&part>=23&&part<=25)||(key==="edges"&&part===14));
          for(let i=0;i<bp.count;i++){
            const actual=new Vector3().fromBufferAttribute(ap,i).applyMatrix4(inverse);
            if(statue){actual.x-=6.9*Math.sin(oldYaw);actual.z-=6.9*Math.cos(oldYaw);}
            expect(actual.distanceTo(new Vector3().fromBufferAttribute(bp,i))).toBeLessThan(.0007);
          }
        }
      }
      // Both complete principal bronze groups now sit on the Tiergarten/east face,
      // at the road-side end. No sculpture anatomy was reflected.
      const statue=center(next.parts[23]);
      expect(statue.x).toBeGreaterThan(wing.centerWorldM[0]);
      expect(side<0?statue.z>wing.centerWorldM[1]:statue.z<wing.centerWorldM[1]).toBe(true);
      disposeParts(old);disposeParts(next);
    }
  });
  test("native uses all58 source parts, orthogonal surfaces and bounded final-capacity storage",()=>{
    const native=createMinecraftCharlottenburgerTorV201(),drawn=createCharlottenburgerTorV201();
    expect(nativeData.partCounts).toEqual([29,29]);
    expect(native.children.length).toBe(1);
    const mesh=native.children[0] as InstancedMesh;
    expect(mesh.count).toBe(nativeData.boxes.length);
    expect(mesh.count).toBeLessThan(7000);
    expect(mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength).toBeLessThan(550000);
    expect(mesh.boundingSphere!.radius).toBeGreaterThan(40);
    const matrix=new Matrix4();
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);
      for(const k of [1,2,4,6,8,9])expect(matrix.elements[k]).toBe(0);
    }
    const oldBox=new Box3().setFromObject(drawn),newBox=new Box3().setFromObject(native);
    expect(newBox.min.distanceTo(oldBox.min)).toBeLessThan(.87);
    expect(newBox.max.distanceTo(oldBox.max)).toBeLessThan(.87);
    for(const root of [native,drawn])root.traverse(o=>{
      expect(o.matrixAutoUpdate).toBe(false);
      if(o instanceof Mesh){expect(o.userData.dayMaterial).toBeTruthy();expect(o.userData.nightMaterial).toBeTruthy();}
    });
  });
  test("both modes leave the roadway, column openings and east-side approaches traversable",()=>{
    for(const native of [false,true]){
      for(let x=-2770;x<=-2680;x+=2)for(const z of [558,568,578])expect(solid(x,9.8,z,.2,native)).toBe(false);
      for(const wing of profile.wings){
        const c=Math.cos(wing.yawRadians),s=Math.sin(wing.yawRadians);
        for(const lx of [-4.4,0,4.4])for(const lz of [-5,0,5]){
          expect(solid(wing.centerWorldM[0]+lx*c+lz*s,11,wing.centerWorldM[1]-lx*s+lz*c,.2,native)).toBe(false);
        }
        // Boundary surfaces of each end pylon are solid; roof stays above heads.
        const x=wing.centerWorldM[0]-11.2*c+2.7*s,z=wing.centerWorldM[1]+11.2*s+2.7*c;
        expect(solid(x,14,z,.25,native)).toBe(true);
        expect(solid(wing.centerWorldM[0],11,wing.centerWorldM[1],.2,native)).toBe(false);
      }
    }
  });
});
