import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { InstancedMesh, Matrix4 } from "three";
import source from "../src/data/littenInstanzV257.json";
import previous from "../src/data/justicePalaceV183.json";
import previousNative from "../src/data/justicePalaceV183Native.json";
import { littenInstanzV257Rows } from "../src/littenInstanzV257";
import { createJusticePalaceV183 } from "../src/JusticePalaceV183";
import { createMinecraftJusticePalaceV183 } from "../src/MinecraftJusticePalaceV183";

test("exact source profiles and all previous courthouse details survive",()=>{
  for(const [name,sha] of Object.entries(source.retainedProfiles)) {
    const bytes=readFileSync(new URL(`../src/data/${name}`,import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha);
  }
  for(const [path,sha] of [[source.courtSource,source.courtSourceSha256],[source.restaurantSource,source.restaurantSourceSha256]])
    expect(createHash("sha256").update(readFileSync(new URL(`../../../${path}`,import.meta.url))).digest("hex")).toBe(sha);
});

test("every formerly omitted short plane now reaches the unchanged upper eave",()=>{
  const rows=littenInstanzV257Rows();
  expect(source.missingCourtFaces.length).toBeGreaterThan(250);
  for(const face of source.missingCourtFaces) {
    const x=(face.a[0]+face.b[0])/2+face.normal[0]*.01,z=(face.a[1]+face.b[1])/2+face.normal[1]*.01;
    const skin=rows.find(r=>Math.abs(r[0]-x)<.001&&Math.abs(r[2]-z)<.001&&r[5]===.08);
    expect(skin).toBeDefined();
    expect(skin![1]+skin![4]/2).toBe(27);
    expect(skin![1]-skin![4]/2).toBeCloseTo(face.top,5);
    expect(skin![3]).toBeCloseTo(Math.hypot(face.b[0]-face.a[0],face.b[1]-face.a[1]),5);
  }
});

test("three source-bound restaurant facades retain four central window axes",()=>{
  expect(source.restaurants.map(f=>f.owner)).toEqual(["DEBE01YYK0000626","DEBE01YYK00009MO","DEBE01YYK00008M9"]);
  const rows=littenInstanzV257Rows().filter(r=>r[2]>220&&r[2]<245&&r[0]>2855);
  expect(rows.filter(r=>r[3]===1.35&&r[4]===1.8&&r[1]===7.65)).toHaveLength(4);
  expect(rows.some(r=>r.at(-1)===0x865332)).toBeTrue(); // Current brown fascia.
  expect(rows.filter(r=>r.at(-1)===0xe4bb70)).toHaveLength(2); // Entrance lanterns.
});

test("portal glazing follows the curved source frontage rather than its hidden chord",()=>{
  const glazing=littenInstanzV257Rows().filter(r=>r[7]===0x4b6064&&r[2]<110);
  expect(glazing.length).toBeGreaterThan(20);
  for(const row of glazing) {
    const distances=source.courtFront.slice(1).map((b,i)=>{
      const a=source.courtFront[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((row[0]-a[0])*dx+(row[2]-a[1])*dz)/(dx*dx+dz*dz)));
      return Math.hypot(row[0]-a[0]-t*dx,row[2]-a[1]-t*dz);
    });
    expect(Math.min(...distances)).toBeLessThan(.5);
  }
});

test("complete drawn and independent native detail share the existing exact-count batch",()=>{
  for(const native of [false,true]) {
    const additions=littenInstanzV257Rows(native),root=native?createMinecraftJusticePalaceV183():createJusticePalaceV183();
    const batch=root.children.find(o=>o.userData.littenInstanzV257Rows) as InstancedMesh;
    expect(batch.count).toBe((native?previousNative.nativeRows:previous.boxes).length+additions.length);
    expect(additions.length).toBeLessThan(native?8000:4000);
    for(const row of additions){expect(row.every(Number.isFinite)).toBeTrue();expect(Math.min(...row.slice(3,6))).toBeGreaterThan(0);expect(row[1]+row[4]/2).toBeLessThan(31);}
    const matrix=new Matrix4();
    if(native) for(let i=previousNative.nativeRows.length;i<batch.count;i++) {
      batch.getMatrixAt(i,matrix);
      for(const component of [1,2,4,6,8,9]) expect(matrix.elements[component]).toBe(0);
    }
    expect(batch.instanceMatrix.count).toBe(batch.count);
  }
});
