import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { InstancedMesh, Mesh } from 'three';
import { createOperaTheatresV274 } from '../src/OperaTheatresV274';
import nav from '../src/data/operaTheatresV274Navigation.json';
import ownership from '../src/data/operaTheatresV274Ownership.json';
import oldDetails from '../src/data/cityRecognitionV182.json';
import { operaTheatresV274RoofAt, operaTheatresV274SourceColumn } from '../src/operaTheatresV274Profile';
import { createOperaTheatresColumnTesterV274, operaTheatreNavigationV274, isOperaTheatrePreviousPrismV274, isOperaTheatrePreviousNavigationV274, operaTheatresV274PreviousFilters, transferOperaTheatreTrianglesV274, transferOperaTheatreLinesV274 } from '../src/operaTheatresV274Ownership';
function metrics(native: boolean, mobileLike=false) {
  const root=createOperaTheatresV274(native,{mobileLike});let calls=0,bytes=0,instances=0;
  expect(root.userData.sourcePartIds.length).toBe(71);
  root.traverse(o=>{
    expect(o.matrixAutoUpdate).toBe(false);
    if(!(o instanceof Mesh))return;
    calls++;expect(o.userData.textureFree).toBe(true);
    for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;
    if(o instanceof InstancedMesh){
      bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);instances+=o.count;
      if(native)for(let i=0;i<o.count;i++)for(const k of [1,2,4,6,8,9])expect(Math.abs(o.instanceMatrix.array[i*16+k])).toBe(0);
    }
    o.geometry.dispose();o.userData.dayMaterial.dispose();o.userData.nightMaterial.dispose();
  });return {calls,bytes,instances};
}
function finish(g:Generator<void,number>){let r=g.next();while(!r.done)r=g.next();return r.value;}
function u32(value:string){const b=Buffer.from(value,'base64');return new Uint32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
function u16(value:string){const b=Buffer.from(value,'base64');return new Uint16Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
describe('v274 five theatre architecture',()=>{
  test('all measured source parts and static details survive mobile; native is orthogonal',()=>{
    const drawn=metrics(false),native=metrics(true);
    expect(metrics(false,true)).toEqual(drawn);expect(metrics(true,true)).toEqual(native);
    expect(drawn.calls).toBe(2);expect(native.calls).toBe(1);
    expect(drawn.bytes).toBeLessThan(250_000);expect(native.bytes).toBeLessThan(1_400_000);
    console.log('OperaTheatresV274',{drawn,native});
  });
  test('only exact Schiller owners transfer, including heights and existing courtyards',()=>{
    for(const p of nav.legacyPrisms){
      expect(isOperaTheatrePreviousPrismV274(true,p)).toBe(true);
      expect(isOperaTheatrePreviousPrismV274(false,p)).toBe(false);
      expect(isOperaTheatrePreviousPrismV274(true,{...p,h_dm:p.h_dm+1})).toBe(false);
      expect(isOperaTheatrePreviousPrismV274(true,{...p,id:'49449347'})).toBe(false);
    }
    expect(operaTheatresV274SourceColumn(-3620,740,5.2,21.2)).toBe(true);
    expect(operaTheatresV274SourceColumn(-3620,740,6.2,22.2)).toBe(false);
    expect(operaTheatresV274RoofAt(-3620,740)).toBeGreaterThan(30);
    expect(operaTheatresV274RoofAt(-3620,740,true)).toBeGreaterThan(30);
    expect(operaTheatresV274RoofAt(0,0)).toBe(null);
    // The foyer no longer inherits the 38.98 m stage height.
    expect(operaTheatresV274RoofAt(-4268,650)).toBeLessThan(25);
    expect(operaTheatresV274RoofAt(-4300,620)).toBeGreaterThan(40);
  });
  test('native exact columns retain shared neighbours and reject source drift',()=>{
    const prisms=[...nav.legacyPrisms,...ownership.neighbours];
    const tester=createOperaTheatresColumnTesterV274(prisms,ownership.cellM);
    expect(ownership.columns.length).toBeGreaterThan(200);
    for(const c of ownership.columns)expect(tester(c[0],c[1],c[2],c[3],c[4])).toBe(true);
    for(const c of ownership.sharedColumns)expect(tester(c[0],c[1],c[2],c[3],c[4])).toBe(false);
    const c=ownership.columns[0];
    expect(tester(c[0],c[1],c[2],c[3]+1,c[4])).toBe(false);
    expect(createOperaTheatresColumnTesterV274(undefined,ownership.cellM)(...c as [number,number,number,number,number])).toBe(false);
    expect(createOperaTheatresColumnTesterV274(prisms.slice(1),ownership.cellM)(...c as [number,number,number,number,number])).toBe(false);
    const foreign={...nav.legacyPrisms[0],id:'new-owner'};
    const conservative=createOperaTheatresColumnTesterV274([...prisms,foreign],ownership.cellM);
    expect(ownership.columns.filter(c=>conservative(c[0],c[1],c[2],c[3],c[4])).length).toBeLessThan(ownership.columns.length);
  });
  test('navigation and old generic window filters fail closed on changed source',()=>{
    for(const r of ownership.navigationRecords){
      expect(isOperaTheatrePreviousNavigationV274(true,r.tile,r.mode==='minecraft',r.original,r.groundY)).toBe(true);
      expect(isOperaTheatrePreviousNavigationV274(true,r.tile,r.mode==='minecraft',{...r.original,height:r.original.height+1},r.groundY)).toBe(false);
      expect(isOperaTheatrePreviousNavigationV274(true,r.tile,r.mode==='minecraft',r.original,r.groundY+1)).toBe(false);
      expect(isOperaTheatrePreviousNavigationV274(true,r.tile,r.mode==='minecraft',{...r.original,groundOffset:0},r.groundY)).toBe(true);
      expect(isOperaTheatrePreviousNavigationV274(true,r.tile,r.mode==='minecraft',{...r.original,groundOffset:.01},r.groundY)).toBe(false);
    }
    const f=operaTheatresV274PreviousFilters();
    expect(oldDetails.boxes.filter(f.box).length).toBe(oldDetails.boxes.length-30);
    expect(oldDetails.segments.filter(f.segment).length).toBe(oldDetails.segments.length-60);
    for(const[index,row]of ownership.previousBoxes as [number,number[]][]){expect(f.box(row,index)).toBe(false);expect(f.box([...row.slice(0,7),0],index)).toBe(true);expect(f.box(row,index+1)).toBe(true);}
  });
  test('every production transfer preserves all unrelated triangles and line endpoints',()=>{
    for(const tile of ['-9_0','-9_1'])for(const native of [false,true]){
      const mode=native?'minecraft':'drawn';
      const packet=JSON.parse(gunzipSync(readFileSync(`public/mesh/surrounding-berlin-v159/${tile}.${mode}.json.gz`)).toString());
      const part=packet.meshes.find((p:{kind:string})=>p.kind==='city');
      const count=ownership.records.filter(r=>r.tile===tile&&r.mode===mode).reduce((n,r)=>n+r.triangles.length,0);
      expect(operaTheatreNavigationV274(true,tile,native,packet.nav,count).buildings.length).toBe(packet.nav.buildings.filter((p:{sourceId:string})=>!['DEBE04YY500002EM','DEBE04YY50002cf0'].includes(p.sourceId)).length);
      expect(operaTheatreNavigationV274(true,tile,native,packet.nav,count-1)).toBe(packet.nav);
      const original=u32(part.indices),changed=original.slice();
      const selected=new Set(ownership.records.filter(r=>r.tile===tile&&r.mode===mode).flatMap(r=>r.triangles));
      expect(finish(transferOperaTheatreTrianglesV274(true,tile,native,part,changed,0))).toBe(selected.size);
      for(let i=0;i<original.length/3;i++)expect([...changed.slice(i*3,i*3+3)]).toEqual(selected.has(i)?[original[i*3],original[i*3],original[i*3]]:[...original.slice(i*3,i*3+3)]);
      const untouched=original.slice();expect(finish(transferOperaTheatreTrianglesV274(false,tile,native,part,untouched,0))).toBe(0);expect(untouched).toEqual(original);
      expect(finish(transferOperaTheatreTrianglesV274(true,tile,native,{...part,colors:part.colors.slice(4)},untouched,0))).toBe(0);expect(untouched).toEqual(original);
      if(!native){
        const before=u16(packet.lines.positions),after=before.slice();const lines=new Set(ownership.lineRecords.filter(r=>r.tile===tile).flatMap(r=>r.segments));
        expect(finish(transferOperaTheatreLinesV274(true,tile,packet.lines,after,3))).toBe(lines.size);
        for(let i=0;i<before.length/6;i++)expect([...after.slice(i*6,i*6+6)]).toEqual(lines.has(i)?[...before.slice(i*6,i*6+3),...before.slice(i*6,i*6+3)]:[...before.slice(i*6,i*6+6)]);
      }
    }
  });
});
