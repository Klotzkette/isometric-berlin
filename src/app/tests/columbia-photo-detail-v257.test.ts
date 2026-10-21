import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Raycaster, Vector3 } from "three";
import { createColumbiaConcertV257 } from "../src/ColumbiaConcertV257";

for(const native of [false,true])test(`photo-supported Columbia ${native?"native":"drawn"} trusses, duct and open balcony stay bounded`,()=>{
  const concert=createColumbiaConcertV257(native);
  try {
    const structure=concert.root.children[0] as InstancedMesh;
    const ranges=structure.userData.photoDetails as Record<string,[number,number]>;
    const matrix=new Matrix4();
    let rotated=0;
    for(let i=0;i<structure.count;i++) {
      structure.getMatrixAt(i,matrix);
      expect(matrix.elements.every(Number.isFinite)).toBeTrue();
      if(matrix.elements[1]!==0||matrix.elements[4]!==0)rotated++;
    }
    expect(rotated).toBe(native?0:114);
    expect(ranges["triangular-truss-webs"][1]).toBe(native?200:50);
    const [ductStart,ductCount]=ranges["right-roof-ventilation-duct"];
    expect(ductCount).toBe(native?40:64);
    for(let i=ductStart;i<ductStart+ductCount;i++) {
      structure.getMatrixAt(i,matrix);
      expect(matrix.elements[12]).toBeGreaterThan(11);
      expect(matrix.elements[13]).toBeGreaterThan(8);
      expect(matrix.elements[13]).toBeLessThan(10);
    }
    // A view through each former solid balcony panel remains open between
    // uprights; the same ray still reaches its retained side wall behind it.
    concert.root.updateMatrixWorld(true);
    for(const side of [-1,1]) {
      const ray=new Raycaster(new Vector3(side*13,4.75,2),new Vector3(side,0,0),0,5);
      const hits=ray.intersectObject(structure);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].distance).toBeGreaterThan(3);
    }
  } finally {concert.dispose();}
});
