import { describe, expect, test } from "bun:test";
import { Group, InstancedMesh, Matrix4, Mesh } from "three";
import { appendSchoolsCourtsV274, createSchoolsCourtsV274, SCHOOLS_COURTS_V274_BUDGET } from "../src/SchoolsCourtsV274";
import { SCHOOLS_COURTS_V274_UPPER_PARTS, schoolsCourtsV274RoofAt } from "../src/schoolsCourtsV274Navigation";
import nav from "../src/data/schoolsCourtsV274Navigation.json";
import { createSchoolsV185 } from "../src/SchoolsV185";

function meshes(root: Group): Mesh[] { const result: Mesh[]=[]; root.traverse(o => { if(o instanceof Mesh) result.push(o); }); return result; }
function dispose(root: Group): void { for (const m of meshes(root)) { m.geometry.dispose(); const materials=new Set([...(Array.isArray(m.material)?m.material:[m.material]),m.userData.dayMaterial,m.userData.nightMaterial]); for(const material of materials) material?.dispose(); } }

describe("seven bounded school/courtyard sites v274",()=>{
  test("drawn model includes every detail and all measured upper roof triangles",()=>{
    const root=createSchoolsCourtsV274();
    const all=meshes(root), instances=all.filter(m=>m instanceof InstancedMesh) as InstancedMesh[];
    expect(all.length).toBe(8); expect(instances.length).toBe(7);
    expect(instances.reduce((n,m)=>n+m.count,0)).toBe(SCHOOLS_COURTS_V274_BUDGET.boxes);
    const shell=all.find(m=>!(m instanceof InstancedMesh))!;
    expect(shell.geometry.getAttribute("position").count).toBe(SCHOOLS_COURTS_V274_BUDGET.bmsUpperTriangles*3);
    expect(shell.geometry.boundingBox!.min.y).toBeCloseTo(23.2,4);
    expect(shell.geometry.boundingBox!.max.y).toBeCloseTo(30.349,3);
    expect(all.every(m=>m.userData.textureFree && m.geometry.boundingSphere && !m.geometry.getAttribute("uv"))).toBe(true);
    dispose(root);
  });
  test("native model has only independent orthogonal instances and all seven sites",()=>{
    const root=createSchoolsCourtsV274(true), all=meshes(root);
    expect(all.length).toBe(7);
    expect(all.every(m=>m instanceof InstancedMesh)).toBe(true);
    expect(all.reduce((n,m)=>n+(m as InstancedMesh).count,0)).toBe(SCHOOLS_COURTS_V274_BUDGET.nativeRows);
    const matrix=new Matrix4();
    for(const m of all as InstancedMesh[]) for(let i=0;i<m.count;i++) {
      m.getMatrixAt(i,matrix);
      expect([1,2,4,6,8,9].every(k=>Math.abs(matrix.elements[k])<1e-8)).toBe(true);
      expect([0,5,10].every(k=>matrix.elements[k]>0)).toBe(true);
    }
    dispose(root);
  });
  test("mobile uses identical static geometry; construction rows never enter scene metadata",()=>{
    for(const native of [false,true]) {
      const a=createSchoolsCourtsV274(native), b=createSchoolsCourtsV274(native,{mobileLike:true});
      const aa=meshes(a),bb=meshes(b);
      expect(aa.length).toBe(bb.length);
      for(let i=0;i<aa.length;i++) {
        expect(aa[i].geometry.getAttribute("position").array).toEqual(bb[i].geometry.getAttribute("position").array);
        if(aa[i] instanceof InstancedMesh) expect((aa[i] as InstancedMesh).instanceMatrix.array).toEqual((bb[i] as InstancedMesh).instanceMatrix.array);
        expect(aa[i].userData.boxes).toBeUndefined(); expect(aa[i].userData.nativeRows).toBeUndefined();
      }
      dispose(a); dispose(b);
    }
  });
  test("existing school integration appends exactly once",()=>{
    const root=new Group(); const old=new Group(); root.add(old);
    appendSchoolsCourtsV274(root); appendSchoolsCourtsV274(root);
    expect(root.children.length).toBe(2); expect(root.children[0]).toBe(old);
    dispose(root);
  });
  test("both delivered school factories include the addition and preserve old children",()=>{
    for (const native of [false,true]) {
      const root=createSchoolsV185(native);
      expect(root.userData.schoolsCourtsV274).toBe(true);
      const additions: Group[]=[];
      root.traverse(o=>{ if(o!==root && o instanceof Group && o.userData.schoolsCourtsV274) additions.push(o); });
      expect(additions.length).toBe(1);
      expect(meshes(additions[0]).length).toBe(native?7:8);
      expect(root.children.some(child=>child!==additions[0])).toBe(true);
      const count=meshes(root).length;
      appendSchoolsCourtsV274(root,native);
      expect(meshes(root).length).toBe(count);
      dispose(root);
    }
  });
  test("roof queries use measured pitched roofs and independent native cell tops",()=>{
    expect(SCHOOLS_COURTS_V274_UPPER_PARTS.length).toBe(5);
    expect(SCHOOLS_COURTS_V274_UPPER_PARTS.every(p=>p.groundY===23.2)).toBe(true);
    for(const triangle of nav.roofTriangles) {
      const x=triangle.reduce((s,p)=>s+p[0],0)/3,z=triangle.reduce((s,p)=>s+p[2],0)/3;
      const y=schoolsCourtsV274RoofAt(x,z);
      expect(y).not.toBeNull(); expect(y!).toBeGreaterThanOrEqual(Math.min(...triangle.map(p=>p[1]))-.001);
    }
    for(const [x,z,y] of nav.nativeRoofCells) expect(schoolsCourtsV274RoofAt(x,z,true)).toBe(y);
    expect(schoolsCourtsV274RoofAt(0,0)).toBeNull(); expect(schoolsCourtsV274RoofAt(0,0,true)).toBeNull();
  });
});
