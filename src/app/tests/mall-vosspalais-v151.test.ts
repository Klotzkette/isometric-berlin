import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import source from "../src/leipzigerPlatzSource.json";
import { createLeipzigerPlatzSourceShells } from "../src/LeipzigerPlatzSourceShells";
import { createLeipzigerPlatzDetails } from "../src/LeipzigerPlatzDetails";
import { createMallAndVosspalaisDetails } from "../src/MallAndVosspalaisDetails";
import { LEIPZIGER_SOURCE_PARTS, LEIPZIGER_SOURCE_PRISM_IDS, LEIPZIGER_VOSSPALAIS_PROFILE, leipzigerSourceRoofAt, leipzigerPartSolidBase, isLeipzigerMallPassageColumn, LEIPZIGER_MALL_PASSAGE_PART } from "../src/leipzigerPlatzSourceProfile";

function budget(root: ReturnType<typeof createLeipzigerPlatzSourceShells>) {
  let bytes=0,draws=0,instances=0;
  root.traverse(object=>{
    if(!(object instanceof Mesh))return;draws++;
    for(const attribute of Object.values(object.geometry.attributes))bytes+=attribute.array.byteLength;
    bytes+=object.geometry.index?.array.byteLength??0;
    if(object instanceof InstancedMesh){instances+=object.count;bytes+=object.instanceMatrix.array.byteLength+ (object.instanceColor?.array.byteLength??0);}
    const materials=Array.isArray(object.material)?object.material:[object.material];
    for(const material of materials)expect((material as unknown as {map?:unknown}).map??null).toBeNull();
  });
  return {bytes,draws,instances};
}
describe("complete Mall and Voßpalais source presentation",()=>{
  test("retains all 96 official parts and their exact old prism records",()=>{
    expect(LEIPZIGER_SOURCE_PARTS).toHaveLength(96);expect(LEIPZIGER_SOURCE_PRISM_IDS.size).toBe(96);
    for(const p of Object.values(source.profiles)){
      expect(p.previous_display_prisms.map(x=>x.id).sort()).toEqual([...p.replaced_prism_ids].sort());
      const translated=LEIPZIGER_SOURCE_PARTS.filter(x=>p.parts.some(y=>y.id===x.id));
      for(const part of translated){
        const old=p.parts.find(x=>x.id===part.id)!;
        expect(part.surfaces).toHaveLength(old.surfaces.length);
        expect(part.top_y_m-part.ground_y_m).toBeCloseTo(old.top_y_m-old.ground_y_m,6);
        expect(part.ring).toEqual(old.ring);expect(part.holes).toEqual(old.holes);
      }
    }
  });
  test("keeps the covered Piazza axis free from an opaque replacement cap",()=>{
    const shells=createLeipzigerPlatzSourceShells();shells.updateMatrixWorld(true);
    for(const [x,z] of [[631.15,925],[633.51,953.6],[635.86,983]]){
      const upward=new Raycaster(new Vector3(x,5.5,z),new Vector3(0,1,0));
      const hits=upward.intersectObject(shells,true);
      expect(hits.length).toBeGreaterThan(0);
      for(const hit of hits){
        expect(hit.object.name).toBe("Mall of Berlin transparent barrel passage roof");
        expect(hit.point.y).toBeCloseTo(leipzigerSourceRoofAt(LEIPZIGER_MALL_PASSAGE_PART,x,z)!,3);
      }
    }
    const details=createLeipzigerPlatzDetails();
    expect(details.getObjectByName("Mall of Berlin transparent barrel passage roof")).toBeUndefined();
    const glass=shells.getObjectByName("Mall of Berlin transparent barrel passage roof") as Mesh;
    expect(glass).toBeInstanceOf(Mesh);expect((glass.material as {transparent:boolean}).transparent).toBe(true);
    expect((glass.material as {depthWrite:boolean}).depthWrite).toBe(false);
    expect(glass.userData.openCoveredPassage).toBe(true);
  });
  test("keeps navigation and native columns open only under the covered passage",()=>{
    const roof=LEIPZIGER_MALL_PASSAGE_PART;
    expect(leipzigerPartSolidBase(roof)).toBeCloseTo(21.251,3);
    expect(isLeipzigerMallPassageColumn(633.5,953.6,1)).toBe(true);
    expect(isLeipzigerMallPassageColumn(636.4,990.5,1)).toBe(true);
    expect(isLeipzigerMallPassageColumn(630.6,916.7,1)).toBe(true);
    expect(isLeipzigerMallPassageColumn(620,955,1)).toBe(false);
    expect(isLeipzigerMallPassageColumn(640,1000,1)).toBe(false);
    const native=createMallAndVosspalaisDetails({minecraft:true});native.updateMatrixWorld(true);
    const upward=new Raycaster(new Vector3(633,5.5,953),new Vector3(0,1,0));
    const hits=upward.intersectObject(native,true);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every(hit=>hit.point.y>20)).toBe(true);
    expect(hits.some(hit=>(hit.object as Mesh).userData.openCoveredPassage)).toBe(true);
  });
  test("anchors the historic four-axis red-sandstone facade to its own five parts",()=>{
    expect(LEIPZIGER_VOSSPALAIS_PROFILE.osmIdentity).toBe("way/503373675");
    expect(LEIPZIGER_VOSSPALAIS_PROFILE.partIds).toHaveLength(5);
    expect(LEIPZIGER_VOSSPALAIS_PROFILE.parentId).toBe("DEBE01YYK0000Ao8");
    const front=LEIPZIGER_SOURCE_PARTS.find(p=>p.id==="DEBE3DvH1K1I8Hcr")!;
    const back=LEIPZIGER_SOURCE_PARTS.find(p=>p.id==="DEBE3DGdGVeD0KLy")!;
    expect(leipzigerSourceRoofAt(front,683,893)).toBeGreaterThan(24);
    expect(back.top_y_m).toBeGreaterThan(front.top_y_m+5.9);
    expect(leipzigerSourceRoofAt(front,680,880)).toBeNull();
  });
  test("uses fixed geometry under bounded budgets and separate native facade and glass batches",()=>{
    const drawn=createMallAndVosspalaisDetails(),native=createMallAndVosspalaisDetails({minecraft:true});
    const d=budget(drawn),n=budget(native),s=budget(createLeipzigerPlatzSourceShells());
    expect(d.draws).toBe(3);expect(d.instances).toBeLessThan(5000);expect(d.bytes).toBeLessThan(390_000);
    expect(n.draws).toBe(2);expect(n.bytes).toBeLessThan(420_000);expect(native.userData.blockNative).toBe(true);
    expect(s.draws).toBe(17);expect(s.bytes).toBeLessThan(405_000);
    for(const root of [drawn,native])root.traverse(o=>expect(o.matrixAutoUpdate).toBe(false));
  });
});
