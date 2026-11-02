import {expect,test}from"bun:test";
import {Group,InstancedMesh,Matrix4}from"three";
import data from"../src/data/mauerContextV294.json";
import{createMauerContextV294,mauerContextGeometryV294}from"../src/MauerContextV294";
import{createSouthFidelityV294,hasCompleteSouthFidelityV294}from"../src/SouthFidelityV294";
import{disposeSurroundingCityRoot}from"../src/SurroundingCity";

test("E-Werk curved steel/brick control room, industrial windows and distinct real neighbours bind to retained metric source owners",()=>{
 const m=mauerContextGeometryV294();expect(m.roles["ewerk-three-stepped-steel-cantilever"]).toBe(30);expect(m.roles["ewerk-control-lower-steel-floor-band"]).toBe(20);expect(m.roles["ewerk-quarter-control-strip-window"]).toBe(50);
 for(const role of["ewerk-nine-storey-small-square-window","ewerk-tall-industrial-hall-window","rohwedder-niederkirchner-tall-window","reichspost-baroque-pier-capital","gropius-terracotta-cornice-connection","topography-screen-cornice-clamp"])expect(m.roles[role]).toBeGreaterThan(0);
 const sources=new Set(data.buildings.flatMap(b=>b.originalPrisms.map(p=>p.id)));for(const r of m.rows)expect(sources.has(r.sourceId)||["RQLhhnrF","400002h6"].includes(r.sourceId)).toBe(true);
 for(const r of m.rows.filter(r=>r.role==="ewerk-three-stepped-steel-cantilever"))expect(r.p[1]+r.s[1]/2).toBeLessThan(26.8);
});

test("complete mobile context is identical; native independently cardinal; all original South budgets remain and factories include context",()=>{
 for(const native of[false,true]){
  const a=createMauerContextV294(native),b=createMauerContextV294(native,{mobileLike:true}),m=a.children[0]as InstancedMesh,n=b.children[0]as InstancedMesh;
  expect(m.instanceMatrix.array).toEqual(n.instanceMatrix.array);expect(m.instanceColor!.array).toEqual(n.instanceColor!.array);expect(m.geometry.getAttribute("uv")).toBeUndefined();expect(m.instanceMatrix.array.byteLength+m.instanceColor!.array.byteLength).toBeLessThan(native?350_000:185_000);
  const matrix=new Matrix4();for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);expect(matrix.elements.every(Number.isFinite)).toBe(true);if(native)for(const j of[1,2,4,6,8,9])expect(matrix.elements[j]).toBe(0);}
  const south=createSouthFidelityV294(native);expect(hasCompleteSouthFidelityV294(south)).toBe(true);const context=south.children.find(c=>c instanceof Group&&c.userData.mauerContextV294)as Group;expect(context).toBeDefined();south.remove(context);expect(hasCompleteSouthFidelityV294(south)).toBe(false);south.add(context);
  disposeSurroundingCityRoot(a);disposeSurroundingCityRoot(b);disposeSurroundingCityRoot(south);
 }
});
