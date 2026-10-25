import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Box3,Mesh} from 'three';
import {createGolgathaV270} from '../src/GolgathaV270';
import {golgathaRoofAtV270,golgathaSolidsV270} from '../src/golgathaV270Profile';
import {applyGolgathaColoursV270,isGolgathaPreviousPartV270,transferGolgathaTrianglesV270} from '../src/golgathaV270Ownership';
import previous from '../src/data/golgathaV270Previous.json';
import profile from '../src/data/golgathaV270Profile.json';

function run<T>(g:Generator<void,T>){let r=g.next();while(!r.done)r=g.next();return r.value;}
const bytes=(text:string)=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
const root=new URL('../../../',import.meta.url);
const audit=JSON.parse(gunzipSync(readFileSync(new URL('geo_data/regierungsviertel/golgatha-v270-evidence.json.gz',root))).toString());

describe('Golgatha v270 source-bound upper tower',()=>{
 test('both complete factories retain lower fragments and reach the evidenced helm',()=>{
  for(const native of [false,true]){
   const group=createGolgathaV270(native),bounds=new Box3().setFromObject(group);
   expect(bounds.max.y).toBeCloseTo(66.2,4);expect(bounds.min.y).toBeLessThan(6);
   expect(group.userData.fullStaticDetailOnTouch).toBe(true);
   const meshes:Mesh[]=[];group.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});
   expect(meshes.length).toBe(2);expect(meshes.every(m=>m.geometry.index!.count>0)).toBe(true);
   group.traverse((o:any)=>{o.geometry?.dispose();o.userData.dayMaterial?.dispose();o.userData.nightMaterial?.dispose();});
  }
 });
 test('navigation has the complete lower shaft and mode-specific stepped roof',()=>{
  const [x,z]=profile.centre;
  expect(golgathaRoofAtV270(x,z,false)).toBeCloseTo(66.2,5);
  expect(golgathaRoofAtV270(x,z,true)).toBe(66.2);
  for(const native of [false,true]){
   const solids=golgathaSolidsV270(native);
   expect(solids.length).toBe(2);expect(solids[0].minY).toBe(5.2);expect(solids[0].maxY).toBe(33.2);
   expect(solids[1].minY).toBe(33.2);expect(solids[1].maxY).toBe(66.2);
   expect(solids[1].topAt!(x,z)).toBeCloseTo(66.2,5);
   expect(golgathaRoofAtV270(x+50,z,native)).toBeNull();
  }
  for(const [ix,iz,h] of profile.nativeColumns){expect(golgathaRoofAtV270((ix+.5)*.5,(iz+.5)*.5,true)).toBe(h);}
 });
 test('only the exact old navigation leaf yields',()=>{
  expect(isGolgathaPreviousPartV270(previous.previousNavigationPart)).toBe(true);
  expect(isGolgathaPreviousPartV270({...previous.previousNavigationPart,topY:51.4})).toBe(false);
  expect(isGolgathaPreviousPartV270({...previous.previousNavigationPart,id:'another-church'})).toBe(false);
 });
 test('all source-packet modes transfer only audited indices, altered packets stay',()=>{
  for(const a of audit.audit){
   const file=readFileSync(new URL(a.file,root));
   const packet=JSON.parse((a.file.endsWith('.gz')?gunzipSync(file):file).toString());
   const part=packet.meshes[a.meshIndex];const source=new Uint32Array(bytes(part.indices).buffer);
   const native=a.mode==='minecraft';const changed=source.slice();
   expect(run(transferGolgathaTrianglesV270(false,a.tile,native,part,changed,0))).toBe(0);
   expect(run(transferGolgathaTrianglesV270(true,a.tile,native,part,changed,0))).toBe(a.removed);
   const receipt=previous.records.find(r=>r.tile===a.tile&&r.mode===a.mode)!;const selected=new Set(receipt.triangles);
   for(let i=0;i<source.length;i+=3){
    if(selected.has(i/3)){expect(changed[i+1]).toBe(changed[i]);expect(changed[i+2]).toBe(changed[i]);}
    else if(changed[i]!==source[i]||changed[i+1]!==source[i+1]||changed[i+2]!==source[i+2])throw new Error('Unowned source triangle changed');
   }
   const drift={...part,colors:part.colors.slice(0,-4)+'AAAA'};
   expect(run(transferGolgathaTrianglesV270(true,a.tile,native,drift,source.slice(),0))).toBe(0);
  }
 });
 test('masonry colour correction preserves every position and unrelated colour cell',()=>{
  for(const a of audit.colourAudit){
   const part=JSON.parse(readFileSync(new URL(a.file,root)).toString()).meshes[a.meshIndex];
   const positions=new Uint16Array(bytes(part.positions).buffer),colours=bytes(part.colors),count=positions.length/3;
   const values=new Uint16Array((count+2)*6);
   for(let i=0;i<count;i++){values.set(positions.slice(i*3,i*3+3),(i+2)*6);values.set(Array.from(colours.slice(i*3,i*3+3),v=>v*257),(i+2)*6+3);}
   const original=values.slice(),native=a.mode==='minecraft';
   expect(run(applyGolgathaColoursV270(false,a.tile,native,part,a.meshIndex,values,2,count))).toBe(0);
   expect(run(applyGolgathaColoursV270(true,a.tile,native,part,a.meshIndex,values,2,count))).toBe(a.changedVertices.length);
   const changed=new Set(a.changedVertices);
   for(let i=0;i<count;i++)for(let c=0;c<6;c++)if(c<3||!changed.has(i)){
    if(values[(i+2)*6+c]!==original[(i+2)*6+c])throw new Error('Colour receipt changed unowned value');
   }
   expect(run(applyGolgathaColoursV270(true,a.tile,native,{...part,colors:part.colors.slice(0,-4)+'AAAA'},a.meshIndex,values,2,count))).toBe(0);
  }
 });
});
