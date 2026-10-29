import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";
import { createHbfNorthApproach } from "../src/HbfNorthApproach";
import { GOVERNMENT_STREET_LAMP_ANCHORS_V286 } from "../src/governmentStreetFurnitureV286Profile";

const before = [
  {native:false,count:10981,matrices:"873bef627eed00fa3af589c021b9316f731a83400dc94527d4fe6e4b444a1d25",colors:"3eeeed5417f9ac51ec0cf151ded33b70d0190691b5f208c81e7c512469d327d2"},
  {native:true,count:58569,matrices:"92ecafaa260c0e01c94684d3ecc7b178a6fbc910c3f7d2b139bce06eae659624",colors:"fd4463fa8104d8c39800a138b293af06a4e7b6fdb65b16cd610851693d234fcf"},
];
const hash = (array: Float32Array) => new Bun.CryptoHasher("sha256").update(array).digest("hex");

test("all previous public-realm instances survive exactly, within the existing draw and buffer limits",()=>{
  for(const b of before){
    const root=createHbfNorthApproach(()=>5.2,b.native);
    const mesh=root.children.find(o=>o instanceof InstancedMesh) as InstancedMesh;
    expect(hash((mesh.instanceMatrix.array as Float32Array).subarray(0,b.count*16))).toBe(b.matrices);
    expect(hash((mesh.instanceColor!.array as Float32Array).subarray(0,b.count*3))).toBe(b.colors);
    expect(mesh.count).toBeGreaterThan(b.count);
    let draws=0,bytes=0;
    root.traverse(o=>{
      if(!(o instanceof Mesh))return;draws++;
      for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;
      bytes+=o.geometry.index?.array.byteLength??0;
      if(o instanceof InstancedMesh)bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);
    });
    expect(draws).toBe(b.native?1:2);expect(bytes).toBeLessThan(5_000_000);
    expect(root.userData.fullStaticDetailOnTouch).toBeTrue();
    expect(root.userData.governmentWayfindingV286.sourceNodeId).toBe("10298343088");
    expect(root.userData.governmentWayfindingV286.anchorWorld).toEqual([-51.299,5.2,-51.259]);
    if(b.native){
      expect(root.userData.governmentStreetLampsV286.anchors).toHaveLength(20);
      const matrix=new Matrix4();
      for(let i=b.count;i<mesh.count;i++){
        mesh.getMatrixAt(i,matrix);
        for(const index of [1,2,4,6,8,9])expect(matrix.elements[index]).toBe(0);
        for(const index of [0,5,10])expect(matrix.elements[index]).toBeGreaterThan(0);
      }
    }else expect(root.userData.governmentStreetLampsV286).toBeUndefined();
  }
});

test("photo-estimated lamps remain a bounded inventory outside road asphalt",()=>{
  expect(GOVERNMENT_STREET_LAMP_ANCHORS_V286).toHaveLength(20);
  expect(new Set(GOVERNMENT_STREET_LAMP_ANCHORS_V286.map(a=>a.id)).size).toBe(20);
  for(const a of GOVERNMENT_STREET_LAMP_ANCHORS_V286){
    expect(a.x).toBeGreaterThan(-57);expect(a.x).toBeLessThan(-17);
    expect(a.z).toBeGreaterThan(-73);expect(a.z).toBeLessThan(124);
    expect(a.heightM).toBe(6.8);
  }
});
