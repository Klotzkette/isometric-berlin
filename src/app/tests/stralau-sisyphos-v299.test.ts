import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { InstancedMesh, Matrix4 } from "three";
import recipes from "../src/data/stralauSisyphosV299Packets.json";
import integration from "../../../geo_data/regierungsviertel/stralau-sisyphos-v299-integration.json";
import supplement from "../../../geo_data/regierungsviertel/stralau-sisyphos-v299-manifest.json";
import manifest from "../public/mesh/surrounding-berlin-v159/manifest.json";
import { createStralauSisyphosV299, stralauGeometryV299, STRALAU_SISYPHOS_V299_PROFILE } from "../src/StralauSisyphosV299";
import { captureStralauSisyphosV299, prepareStralauSisyphosV299, STRALAU_DETAILS_KIND_V299, type StralauPacketSourceV299 } from "../src/StralauSisyphosV299Packets";
import { surroundingPolygonContains, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const source = recipes as unknown as StralauPacketSourceV299;
function finish<T>(it: Generator<void, T>): T { let n = it.next(); while (!n.done) n = it.next(); return n.value; }
function packet(key: string): SurroundingCityChunk {
  const [mode, id] = key.split(":"), entry = [...supplement.chunks, ...manifest.chunks].find(c => c.id === id)!;
  const asset = (entry as unknown as Record<string, { url: string }>)[mode];
  return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${asset.url}`, import.meta.url))).toString());
}
function typedPositions(encoded: string): Uint16Array { const b = Buffer.from(encoded, "base64"); return new Uint16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
function cornerBytes(boxes: number[][]): Uint16Array {
  const result = new Uint16Array(boxes.length * 24); let i = 0;
  for (const [x,y,z,dx,dz,nx,nz,w,h,d] of boxes) for (const a of [-1,1]) for (const b of [-1,1]) for (const c of [-1,1]) {
    result[i++] = Math.round((x + dx*a*w/2 + nx*c*d/2)*100);
    result[i++] = Math.round((y + b*h/2)*100);
    result[i++] = Math.round((z + dz*a*w/2 + nz*c*d/2)*100);
  }
  return result;
}

test("all source-bound details survive touch, with independently cardinal native members and finite exact-size buffers", () => {
  for (const native of [false, true]) {
    const rows = stralauGeometryV299(native);
    expect(rows.rows).toHaveLength(native ? 31674 : 13203);
    for (const role of ["sisyphos-duck-body", "sisyphos-duck-curved-neck", "sisyphos-duck-bill", "sisyphos-geometric-name", "dorfkirche-clock-disc", "mapped-citymarina-pier", "public-floating-apartment-floating-hull", "mapped-public-event-barge-floating-hull", "glashuette-visible-steel-frame", "arched-masonry-window-head"]) expect(rows.roles[role]).toBeGreaterThan(0);
    expect(rows.roles["sisyphos-duck-bill"]).toBe(2);
    const a = createStralauSisyphosV299(native), b = createStralauSisyphosV299(native, { mobileLike: true });
    const m = a.children[0] as InstancedMesh, n = b.children[0] as InstancedMesh;
    expect(a.children).toHaveLength(1); expect(m.instanceMatrix.array).toEqual(n.instanceMatrix.array); expect(m.instanceColor!.array).toEqual(n.instanceColor!.array);
    expect(m.geometry.getAttribute("uv")).toBeUndefined(); expect(m.instanceMatrix.count).toBe(m.count); expect(m.instanceColor!.count).toBe(m.count);
    const matrix = new Matrix4(); for (let i=0;i<m.count;i++) { m.getMatrixAt(i,matrix); if (native) for (const j of [1,2,4,6,8,9]) expect(matrix.elements[j]).toBe(0); }
    for (const root of [a,b]) { const mesh=root.children[0] as InstancedMesh; mesh.geometry.dispose(); (Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>m.dispose()); mesh.userData.nightMaterial.dispose(); }
  }
  expect(STRALAU_SISYPHOS_V299_PROFILE.gate).toEqual([8054.054,3046.112]);
  expect(STRALAU_SISYPHOS_V299_PROFILE.address).toBe("Hauptstraße 15, Rummelsburg");
});

test("all eighteen finite recipes admit only complete original packets and append after retained preparers", () => {
  expect(source.keys).toHaveLength(18);
  for (const key of source.keys) {
    const [mode,id]=key.split(":"), native=mode==="minecraft", raw=packet(key), snapshot=JSON.stringify(raw), plan=source.packets[key];
    expect(finish(captureStralauSisyphosV299(raw,id,native))).toBeUndefined();
    expect(finish(prepareStralauSisyphosV299(raw))).toBe(raw);
    const ticket=finish(captureStralauSisyphosV299(raw,id,native,true)); expect(typeof ticket).toBe("function");
    const extra={...raw.meshes[0],kind:"retained-earlier-preparer"}, before={...raw,meshes:[...raw.meshes,extra]};
    const prepared=finish(prepareStralauSisyphosV299(before,ticket)); expect(prepared).not.toBe(before);
    expect(prepared.meshes.slice(0,before.meshes.length)).toEqual(before.meshes);
    expect(prepared.nav.ground).toBe(raw.nav.ground); expect(prepared.nav.water).toBe(raw.nav.water); expect(prepared.nav.buildings).toBe(raw.nav.buildings);
    expect(prepared.meshes.reduce((n,m)=>n+Buffer.from(m.positions,"base64").byteLength/6,0)).toBeLessThanOrEqual(400000);
    expect(prepared.meshes.reduce((n,m)=>n+Buffer.from(m.indices,"base64").byteLength/4,0)).toBeLessThanOrEqual(2400000);
    expect(prepared.meshes.length).toBeLessThanOrEqual(16);
    expect(JSON.stringify(raw)).toBe(snapshot);
    expect(finish(prepareStralauSisyphosV299(prepared,ticket))).toBe(prepared);
    const proof=integration.proof.find(p=>p.key===key)!;
    expect(createHash("sha256").update(cornerBytes(plan.boxes)).digest("hex")).toBe(proof.exactCmCornersSha256);
    expect(plan.boxes.length).toBeLessThanOrEqual(20000);
    if(native) for(const row of plan.boxes) expect(row[3]===0||row[4]===0).toBe(true);
  }
});

test("changed origin, nav, encoded geometry and post-capture mutation fail closed without losing the prepared complement", () => {
  const key="drawn:stralau299-15_5", id="stralau299-15_5", raw=packet(key);
  for(const change of [(c:SurroundingCityChunk)=>{c.origin[0]++},(c:SurroundingCityChunk)=>{c.nav.groundY++},(c:SurroundingCityChunk)=>{c.meshes[0].positions="AAAA"+c.meshes[0].positions.slice(4)}]) {
    const bad=structuredClone(raw);change(bad);expect(finish(captureStralauSisyphosV299(bad,id,false,true))).toBeUndefined();
  }
  expect(finish(captureStralauSisyphosV299(raw,id+"-foreign",false,true))).toBeUndefined();
  const changed=structuredClone(raw), ticket=finish(captureStralauSisyphosV299(changed,id,false,true)); changed.meshes[0].colors="AAAA"+changed.meshes[0].colors.slice(4);
  expect(finish(prepareStralauSisyphosV299(changed,ticket))).toBe(changed);
});

test("public boat decks and mapped pier floors coincide with represented slab heights; cabins and rails remain solid", () => {
  for(const mode of ["drawn","minecraft"]) for(const id of ["stralau299-13_5","stralau299-15_6"]) {
    const raw=packet(`${mode}:${id}`), ticket=finish(captureStralauSisyphosV299(raw,id,mode==="minecraft",true)), built=finish(prepareStralauSisyphosV299(raw,ticket));
    const nav=built.nav.spreeBridgesV242!;expect(nav.floors.length).toBe(id.endsWith("15_6")?12:1);expect(nav.solids.length).toBeGreaterThan(20);
    const mesh=built.meshes.find(m=>m.kind===STRALAU_DETAILS_KIND_V299)!, p=typedPositions(mesh.positions), tops=new Set<number>();
    for(let i=1;i<p.length;i+=3)tops.add(Math.round((p[i]/100+raw.origin[1])*100));
    for(const floor of nav.floors) expect(tops.has(Math.round(floor.y*100))).toBe(true);
    for(const solid of nav.solids)expect(solid.high).toBeGreaterThan(solid.low);
    expect(nav.floors.some(f=>f.y===-.42)).toBe(true);
    if(id.endsWith("15_6")) expect(nav.floors.some(f=>f.y===-.49)).toBe(true);
    // Every new floating apartment sits in this source tile's actual mapped water.
    if(id.endsWith("15_6")) for(let i=0;i<3;i++)expect(raw.nav.water.some(p=>surroundingPolygonContains(p,7884+i*13-raw.origin[0],3300.5+i*14-raw.origin[2]))).toBe(true);
  }
});
