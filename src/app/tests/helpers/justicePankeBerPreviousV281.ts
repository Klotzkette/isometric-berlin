import { expect } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BufferAttribute, BufferGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, Path, Shape, ShapeGeometry, Vector2, Vector3, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import justice from "../../src/data/justicePalaceV183.json";
import justiceNative from "../../src/data/justicePalaceV183Native.json";
import drawn0 from "../../src/data/northParksV198Drawn0.json";
import drawn1 from "../../src/data/northParksV198Drawn1.json";
import native0 from "../../src/data/northParksV198Native0.json";
import native1 from "../../src/data/northParksV198Native1.json";
import terrain from "../../src/data/parkTerrainV229Changes.json";
import airport from "../../src/data/berAirportV205.json";
import roofPatch from "../../src/data/berAirportRoofPatchV236.json";
import { littenInstanzV257Rows } from "../../src/littenInstanzV257";
import { charlottenburgParkV281Rows, charlottenburgBasinV281Triangles } from "../../src/CharlottenburgParkV281";
import sourceReceipt from "../fixtures/justice-panke-ber-v281-source-replay.json";
import historical from "../fixtures/outline-preservation-v220-audit.json";
import { replaySourceV281 } from "./coreMaterialV281";
import { geometryPreservationV206 } from "./geometryPreservationV206";
import { restoreLegacyInstances } from "./instanceBufferReplay";
import { spliceGeometryContribution } from "./geometryContributionReplay";

type Undo = () => void;
const bytes = (array: ArrayBufferView) => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const sha = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const same = (actual: ArrayBufferView, expected: ArrayBufferView) => {
  expect(actual.constructor.name).toBe(expected.constructor.name);
  expect(actual.byteLength).toBe(expected.byteLength); expect(sha(bytes(actual))).toBe(sha(bytes(expected)));
};
let checkedSources = false;
function assertSources() {
  if (checkedSources) return;
  expect(sourceReceipt.beforeCommit).toBe("8838ad4862941a6e09d8180066e1a68330029f06");
  for (const [path, digest] of Object.entries(sourceReceipt.sourceGraphs.current))
    expect(sha(readFileSync(resolve(import.meta.dir, "../../../..", path)))).toBe(digest);
  for (const receipt of sourceReceipt.sourceReplay)
    replaySourceV281(readFileSync(resolve(import.meta.dir, "../../../..", receipt.path), "utf8"), receipt);
  checkedSources = true;
}
function one(root: Object3D, name: string): any {
  const matches: Object3D[] = []; root.traverse(o => { if (o.name === name) matches.push(o); });
  expect(matches).toHaveLength(1); return matches[0];
}
/** The old v220 ledger remains immutable, including all siblings and headers. */
function assertHistoricalFamily(root: Group, mode: "day" | "minecraft") {
  const ledger = [...historical.modes[mode].unchangedRecords, ...historical.modes[mode].afterChanged]
    .sort((a, b) => a.index - b.index).map(({ index: _, ...record }) => record);
  const name = JSON.stringify([root.type, root.name]);
  const starts = ledger.filter(r => r.key.endsWith(`/${name}:0`));
  expect(starts).toHaveLength(1);
  const prefix = starts[0].key;
  const expected = ledger.filter(r => r.key === prefix || r.key.startsWith(prefix + "/"))
    .map(r => ({ ...r, key: name + r.key.slice(prefix.length) }));
  expect(geometryPreservationV206(root)).toEqual(expected);
}
function packedRows(rows: readonly (readonly number[])[], native: boolean) {
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), scale = new Vector3(), color = new Color();
  rows.forEach((r, i) => {
    if (native) matrix.makeScale(r[3], r[4], r[5]);
    else matrix.makeRotationY(r[6]).scale(scale.set(r[3], r[4], r[5]));
    matrix.setPosition(r[0], r[1], r[2]).toArray(matrices, i * 16);
    color.setHex(r[native ? 6 : 7]).toArray(colors, i * 3);
  });
  return { matrices, colors };
}
function replaceInstances(mesh: InstancedMesh, matrices: Float32Array, colors: Float32Array, count: number, undo: Undo[]) {
  const oldMatrix = mesh.instanceMatrix, oldColor = mesh.instanceColor, oldCount = mesh.count;
  expect(oldMatrix.itemSize).toBe(16); expect(oldColor!.itemSize).toBe(3);
  expect(oldMatrix.count).toBe(oldCount); expect(oldColor!.count).toBe(oldCount);
  undo.push(() => { mesh.instanceMatrix = oldMatrix; mesh.instanceColor = oldColor; mesh.count = oldCount; });
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16, oldMatrix.normalized, oldMatrix.meshPerAttribute).setUsage(oldMatrix.usage);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3, oldColor!.normalized, oldColor!.meshPerAttribute).setUsage(oldColor!.usage); mesh.count = count;
}
function replaceGeometry(mesh: Mesh, next: BufferGeometry, undo: Undo[]) {
  const old = mesh.geometry;
  next.name = old.name; next.groups = old.groups.map(group => ({ ...group })); next.drawRange = { ...old.drawRange };
  next.userData = old.userData;
  for(const name of Object.keys(next.attributes)){
    const current = old.getAttribute(name), restored = next.getAttribute(name) as BufferAttribute;
    expect(current.itemSize).toBe(restored.itemSize); expect(current.normalized).toBe(restored.normalized);
    restored.setUsage((current as BufferAttribute).usage);
  }
  if(next.index){expect(old.index!.itemSize).toBe(next.index.itemSize);expect(old.index!.normalized).toBe(next.index.normalized);next.index.setUsage(old.index!.usage);}
  undo.push(() => { mesh.geometry = old; next.dispose(); }); mesh.geometry = next;
}

function restoreJustice(root: Group, native: boolean, undo: Undo[]): Group {
  const family = one(root, native ? "Independent native courthouse and palace recognition v183"
    : "Source-bound Berlin courthouses and Charlottenburg recognition v183") as Group;
  const mesh = one(family, native ? "Orthogonal facade strips and stepped upper architectural contours"
    : "Thin facade windows, pale frames and open tower members") as InstancedMesh;
  expect(mesh).toBeInstanceOf(InstancedMesh);
  const oldCount = native ? justiceNative.nativeRows.length : justice.boxes.length;
  const fittings = littenInstanzV257Rows(native), park = charlottenburgParkV281Rows(native);
  expect(fittings).toHaveLength(native ? 7172 : 3681); expect(park).toHaveLength(native ? 1100 : 244);
  expect(mesh.count).toBe(oldCount + fittings.length + park.length);
  const suffix = packedRows([...fittings, ...park], native);
  same(mesh.instanceMatrix.array.subarray(oldCount * 16), suffix.matrices);
  same(mesh.instanceColor!.array.subarray(oldCount * 3), suffix.colors);
  // The actual complete original prefix is shared, not regenerated.
  replaceInstances(mesh, mesh.instanceMatrix.array.subarray(0, oldCount * 16) as Float32Array,
    mesh.instanceColor!.array.subarray(0, oldCount * 3) as Float32Array, oldCount, undo);
  if (!native) {
    const roofs = one(family, "Courthouse hollow upper roof skins on exact source footprints") as Mesh;
    const triangles = charlottenburgBasinV281Triangles(); expect(triangles).toHaveLength(6);
    const p = new Float32Array(54), c = new Float32Array(54), color = new Color(), normal = new Vector3(),
      a = new Vector3(), b = new Vector3(), light = new Vector3(-.5, 1, .5).normalize();
    triangles.forEach((r, i) => {
      a.set(r[3]-r[0],r[4]-r[1],r[5]-r[2]); b.set(r[6]-r[0],r[7]-r[1],r[8]-r[2]);
      normal.crossVectors(a,b).normalize(); if(normal.y<0)normal.negate();
      color.setHex(r[9]).multiplyScalar(.7+.3*Math.max(0,normal.dot(light)));
      for(let j=0;j<9;j++)p[i*9+j]=r[j]; for(let j=0;j<3;j++)color.toArray(c,i*9+j*3);
    });
    const expected = new BufferGeometry(); expected.setAttribute("position",new BufferAttribute(p,3));
    expected.setAttribute("color",new BufferAttribute(c,3)); expected.computeVertexNormals();
    try {
      const length = justice.roofTriangles.length * 9;
      expect(Object.keys(roofs.geometry.attributes)).toEqual(["position", "color", "normal"]);
      for (const name of ["position", "color", "normal"]) {
        const live = roofs.geometry.getAttribute(name) as BufferAttribute;
        expect(live.itemSize).toBe(3); expect(live.normalized).toBe(false);
        expect(live.array.length).toBe(length + 54); same(live.array.subarray(length), expected.getAttribute(name).array);
        undo.push(() => roofs.geometry.setAttribute(name, live));
        roofs.geometry.setAttribute(name, new BufferAttribute(live.array.subarray(0, length), 3, live.normalized).setUsage(live.usage));
      }
    } finally { expected.dispose(); }
  }
  return family;
}

function restoreNorthPark(root: Group, native: boolean, undo: Undo[]): Group {
  const family = one(root, "Schönhausen, mapped Panke and Schönholzer Heide v198") as Group;
  const sources = (native ? [native0, native1] : [drawn0, drawn1]).flatMap(p => p.cells).filter(c => c.id === "0:-7");
  expect(sources).toHaveLength(1); const cell = sources[0];
  const patch = terrain.cells.find(c => c.native === native && c.id === "0:-7")!;
  expect(patch.sourceCounts).toEqual([cell.positions.length, cell.indices.length, cell.boxes.length]);
  const mesh = one(family, "North parks v198 0:-7: source terrain, paths and complete roofs") as Mesh;
  const positions = new Float32Array([...cell.positions, ...patch.positions]), colors = new Uint8Array([...cell.colors, ...patch.colors]);
  for (const [i, before, after] of patch.vertexY) { expect(cell.positions[i*3+1]).toBe(before); positions[i*3+1] = after; }
  const removed = new Set(patch.remove), indices: number[] = [];
  for(let i=0;i<cell.indices.length;i+=3)if(!removed.has(i))indices.push(...cell.indices.slice(i,i+3));
  const retainedIndices = indices.length, vertexBase = cell.positions.length / 3;
  for(const index of patch.indices)indices.push(vertexBase+index);
  const expected = new BufferGeometry(); expected.setAttribute("position",new BufferAttribute(positions,3));
  expected.setAttribute("color",new BufferAttribute(colors,3,true)); expected.setIndex(indices); expected.computeVertexNormals();
  try {
    expect(Object.keys(mesh.geometry.attributes)).toEqual(Object.keys(expected.attributes));
    for(const name of Object.keys(expected.attributes)){
      const live=mesh.geometry.getAttribute(name), next=expected.getAttribute(name);
      expect([live.itemSize,live.normalized,live.count]).toEqual([next.itemSize,next.normalized,next.count]);same(live.array,next.array);
    }
    expect([mesh.geometry.index!.itemSize,mesh.geometry.index!.normalized,mesh.geometry.index!.count])
      .toEqual([expected.index!.itemSize,expected.index!.normalized,expected.index!.count]);
    same(mesh.geometry.index!.array,expected.index!.array);
  } finally { expected.dispose(); }
  const oldPositions = new Float32Array(mesh.geometry.getAttribute("position").array.subarray(0, cell.positions.length));
  for(const [index, before]of patch.vertexY)oldPositions[index*3+1]=before;
  const liveIndices = mesh.geometry.index!.array, oldIndices: number[]=[]; let cursor=0;
  for(let i=0;i<cell.indices.length;i+=3){
    if(removed.has(i))oldIndices.push(...cell.indices.slice(i,i+3));
    else for(let j=0;j<3;j++)oldIndices.push(liveIndices[cursor++]);
  }
  expect(cursor).toBe(retainedIndices);
  const old = new BufferGeometry(); old.setAttribute("position",new BufferAttribute(oldPositions,3));
  old.setAttribute("color",new BufferAttribute(mesh.geometry.getAttribute("color").array.subarray(0,cell.colors.length),3,true));
  old.setIndex(oldIndices); old.computeVertexNormals(); replaceGeometry(mesh,old,undo);
  const boxes = one(family,"North parks v198 0:-7: bounded architecture and mapped barriers") as InstancedMesh;
  expect(boxes.count).toBe(cell.boxes.length);
  const matrices = new Float32Array(boxes.instanceMatrix.array);
  for(const [index,before,after]of patch.boxY){
    expect(cell.boxes[index][1]).toBe(before); expect(matrices[index*16+13]).toBe(Math.fround(after)); matrices[index*16+13]=before;
  }
  replaceInstances(boxes,matrices,boxes.instanceColor!.array as Float32Array,boxes.count,undo);
  return family;
}

function pierRoof(rings: number[][][], y: number) {
  const shape = new Shape(rings[0].map(([x,z])=>new Vector2(x,-z)));
  shape.holes = rings.slice(1).map(r=>new Path(r.map(([x,z])=>new Vector2(x,-z))));
  const geometry = new ShapeGeometry(shape); geometry.rotateX(-Math.PI/2); geometry.translate(0,y,0); geometry.deleteAttribute("uv"); return geometry;
}
/** Only the one documented pier has no glass, columns or deep roof fascia.
 * Its old/new contribution consists exactly of native cap rows and edge beams. */
function pierRows(native: boolean, current: boolean) {
  const p = airport.buildings.find(p=>p.id===roofPatch.id)!;
  expect(p.id).toBe("way/1083495102"); expect(p.glass||p.tower||p.column).toBe(false);
  expect(p.roofBottom).toBeGreaterThanOrEqual(p.top-.31);
  const rows: number[][] = native ? [...(current?roofPatch.nativeRows:p.native)] : [];
  for(const polygon of current?(native?roofPatch.nativeRings:roofPatch.drawnRings):[p.rings])for(const ring of polygon)for(let i=1;i<ring.length;i++){
    const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<.001)continue;
    if(!native)rows.push([(a[0]+b[0])/2,p.top+.10,(a[1]+b[1])/2,length,.2,.2,-Math.atan2(dz,dx),0x67756f]);
    else {const count=Math.max(1,Math.ceil(length/2));for(let j=0;j<count;j++)rows.push([a[0]+dx*(j+.5)/count,p.top+.10,a[1]+dz*(j+.5)/count,
      Math.max(.2,Math.abs(dx)/count),.2,Math.max(.2,Math.abs(dz)/count),0x67756f]);}
  }
  return rows;
}
function restoreBer(root: Group, native: boolean, undo: Undo[]): Group {
  const family=one(root,"BER Willy Brandt — mapped terminal parts and runway markings v205") as Group;
  expect(airport.sourceSha256).toBe(roofPatch.sourceSha256);
  const rows=one(family,"BER native roofs, source frames and runway width markings") as InstancedMesh;
  const before=pierRows(native,false),after=pierRows(native,true),old=packedRows(before,native),current=packedRows(after,native);
  expect(after.length-before.length).toBe(native?173:6);
  const matrices=bytes(rows.instanceMatrix.array),colors=bytes(rows.instanceColor!.array),needle=bytes(current.matrices),needleColors=bytes(current.colors);
  const matches:number[]=[];
  for(let i=0;i<=rows.count-after.length;i++)if(matrices.subarray(i*64,(i+1)*64).equals(needle.subarray(0,64))&&
    matrices.subarray(i*64,(i+after.length)*64).equals(needle)&&colors.subarray(i*12,(i+after.length)*12).equals(needleColors))matches.push(i);
  expect(matches).toHaveLength(1); const start=matches[0];
  const records=(packed:ReturnType<typeof packedRows>,count:number)=>Array.from({length:count},(_,i)=>{
    const data=new Float32Array(19);data.set(packed.matrices.subarray(i*16,i*16+16));data.set(packed.colors.subarray(i*3,i*3+3),16);
    return {index:start+i,data:Buffer.from(data.buffer).toString("base64")};
  });
  const restored=restoreLegacyInstances(rows,{beforeCount:rows.count+before.length-after.length,afterCount:rows.count,
    retainedCount:rows.count-after.length,removed:records(old,before.length),added:records(current,after.length)});
  replaceInstances(rows,restored.instanceMatrix.array as Float32Array,restored.instanceColor!.array as Float32Array,restored.count,undo);
  if(!native){
    const cap=one(family,"BER exact source roof planes") as Mesh,p=airport.buildings.find(p=>p.id===roofPatch.id)!;
    const parts=roofPatch.drawnRings.map(rings=>pierRoof(rings,p.top)),current=mergeGeometries(parts,false)!,previous=pierRoof(p.rings,p.top);
    try {replaceGeometry(cap,spliceGeometryContribution(cap.geometry,current,previous),undo);}
    finally {for(const part of parts)part.dispose();current.dispose();previous.dispose();}
  }
  return family;
}

/** Invert only source-receipted append/terrain/pier changes. No factory or whole
 * outline rebuild; every unaffected live byte must reproduce the old ledger. */
export function restoreJusticePankeBerPreviousV281(root: Group, mode: "day" | "minecraft"): Undo {
  assertSources(); const native=mode==="minecraft",undo:Undo[]=[];
  const restore=()=>{for(const fn of undo.splice(0).reverse())fn();};
  try {
    assertHistoricalFamily(restoreJustice(root,native,undo),mode);
    assertHistoricalFamily(restoreNorthPark(root,native,undo),mode);
    assertHistoricalFamily(restoreBer(root,native,undo),mode);
  } catch(error){restore();throw error;}
  return restore;
}
