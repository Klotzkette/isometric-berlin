import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4 } from "three";
import { createLitfinNeighboursV215, litfinNeighboursV215Members, litfinNeighboursV215NativeRows, LITFIN_NEIGHBOURS_V215_PROFILE as profile } from "../src/LitfinNeighboursV215";
import source from "../src/data/litfinNeighboursV215Source.json";

function snapshot(native:boolean,mobileLike:boolean){
  const root=createLitfinNeighboursV215(native,{mobileLike});let bytes=0;
  for(const child of root.children){const mesh=child as InstancedMesh;
    for(const a of Object.values(mesh.geometry.attributes))bytes+=a.array.byteLength;
    bytes+=mesh.geometry.index?.array.byteLength??0;
    bytes+=mesh.instanceMatrix?.array.byteLength??0;bytes+=mesh.instanceColor?.array.byteLength??0;
  }return {root,bytes};
}

describe("the three measured Litfin-neighbour houses",()=>{
  test("recognition is architectural and keeps all source families",()=>{
    expect(source.replacementOwners).toEqual([]);
    expect(source.buildings.map(b=>b.partIds.length)).toEqual([3,2,2]);
    const members=litfinNeighboursV215Members();
    for(const [site,role] of [["kieler3","oriel-roof-guard"],["kieler3","rear-balcony-slab"],["kieler3","roof-gallery-glazing"],["kieler2","black-glazed-oriel"],["kieler2a","terrace-post"]]){
      expect(members.some(m=>m.site===site&&m.role===role)).toBe(true);
    }
    for(const m of members){
      expect(m.row.every(Number.isFinite)).toBe(true);
      expect(m.row.slice(3,6).every(v=>v>0)).toBe(true);
      expect(Math.hypot(...m.normal)).toBeCloseTo(1,5);
    }
  });
  test("desktop and mobile draw exactly the same retained quality within budget",()=>{
    for(const native of [false,true]){
      const a=snapshot(native,false),b=snapshot(native,true);
      expect(a.bytes).toBe(native?profile.budget.nativeBytes:profile.budget.drawnBytes);
      expect(b.bytes).toBe(a.bytes);
      expect(a.root.children.length).toBe(native?1:2);
      for(let i=0;i<a.root.children.length;i++){
        const ma=a.root.children[i] as InstancedMesh,mb=b.root.children[i] as InstancedMesh;
        expect(ma.geometry.getAttribute("position").array).toEqual(mb.geometry.getAttribute("position").array);
        expect(ma.instanceMatrix?.array).toEqual(mb.instanceMatrix?.array);
        expect(ma.instanceColor?.array).toEqual(mb.instanceColor?.array);
        expect(ma.geometry.getAttribute("uv")).toBeUndefined();
        expect(ma.matrixAutoUpdate).toBe(false);
      }
    }
  });
  test("native model uses exterior orthogonal cells with no duplicate occupied cell",()=>{
    const rows=litfinNeighboursV215NativeRows(),cells=new Set<string>();
    for(const r of rows){
      expect(r[4]).toBe(.5);expect(r[5]).toBe(.5);
      for(let i=0;i<Math.round(r[3]/.5);i++){
        const key=[Math.round((r[0]-r[3]/2+.25+i*.5)*2),Math.round(r[1]*2),Math.round(r[2]*2)].join(":");
        expect(cells.has(key)).toBe(false);cells.add(key);
      }
    }
    const native=snapshot(true,false).root.children[0] as InstancedMesh,matrix=new Matrix4();
    for(let i=0;i<native.count;i++){
      native.getMatrixAt(i,matrix);for(const j of [1,2,4,6,8,9])expect(matrix.elements[j]).toBe(0);
    }
    // Only one narrow facade shell plus balconies: no full building fill.
    expect(rows.length).toBeLessThan(14000);
  });
});
