import {describe,expect,test} from "bun:test";
import {BufferAttribute,Group,InstancedMesh,InterleavedBufferAttribute,Mesh,MeshBasicMaterial} from "three";
import {createHospitalArchitectureV308,hasCompleteHospitalArchitectureV308} from "../src/HospitalArchitectureV308";
import {decodeHospitalRowsV308} from "../src/hospitalArchitectureV308Rows";
import {applyHospitalPreviousV308} from "../src/HospitalArchitectureV308Previous";
import {hospitalArchitectureV308Solids,hospitalV308OverridesV228} from "../src/HospitalArchitectureV308Navigation";
import {createHospitalRecognitionV228} from "../src/HospitalRecognitionV228";
import {createHospitalEnvelopesV228} from "../src/HospitalEnvelopesV228";
import {createBundeswehrHospitalV214} from "../src/BundeswehrHospitalV214";
import core from "../src/data/hospitalArchitectureV308Core.json";
import previous from "../src/data/hospitalArchitectureV308Previous.json";
import {parkStaticGeometrySteps} from "../src/losslessStaticStorage";
import {interleaveStaticGeometry} from "../src/interleaveStaticGeometry";
import {schwellenraumMaterialFor} from "../src/visual-modes/schwellenraum/materialGrade";
function bytes(a:ArrayBufferView){let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619)>>>0;return h;}
function signature(root:Group){return root.children.map(c=>{
 const m=c as Mesh;return[m.name,bytes(m.geometry.getAttribute("position").array),
 m instanceof InstancedMesh?bytes(m.instanceMatrix.array):null,m instanceof InstancedMesh?m.count:null];
});}
function dispose(root:Group){const resources=new Set<{dispose():void}>();root.traverse(o=>{if(o instanceof Mesh){resources.add(o.geometry);for(const m of [o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m)resources.add(m);if(o instanceof InstancedMesh)resources.add(o);}});for(const r of resources)r.dispose();root.clear();}
describe("hospital v308 exact inputs and complete admission",()=>{
 test("canonical Float32 bit deltas decode exactly and reject overflow",()=>{
  const expected=new Uint32Array([0,0x80000000,0x3f800000,0xbf800000,0x4a123456]);
  let previous=0;const bytes:number[]=[];
  for(const bits of expected){const delta=(bits-previous)|0;previous=bits;let value=((delta<<1)^(delta>>31))>>>0;while(value>=128){bytes.push((value&127)|128);value>>>=7;}bytes.push(value);}
  const column=Buffer.from(bytes).toString("base64"),input={codec:"f32-delta-zigzag-varint-columns-v1",count:expected.length,columns:Array(8).fill(column)};
  for(const decoded of decodeHospitalRowsV308(input))expect(Array.from(new Uint32Array(decoded.buffer))).toEqual(Array.from(expected));
  input.columns[0]=Buffer.from([255,255,255,255,255]).toString("base64");
  expect(()=>decodeHospitalRowsV308(input)).toThrow();
 });
 test("compact Float32 columns remain finite; only native rows are cardinal",()=>{
  for(const site of core.sites){
   for(const key of ["fittings","nativeBoxes"]as const){
    const cols=decodeHospitalRowsV308(site[key]);expect(cols).toHaveLength(8);
    expect(cols.every(c=>c.length===site[key].count&&c.every(Number.isFinite))).toBe(true);
    expect(cols.slice(3,6).every(c=>c.every(v=>v>0))).toBe(true);
    if(key==="nativeBoxes")expect(cols[6].every(v=>v===0)).toBe(true);
   }
  }
  const broken=structuredClone(core.sites[0].fittings);broken.columns[0]=broken.columns[0].slice(0,-4);
  expect(()=>decodeHospitalRowsV308(broken)).toThrow();
 });
 for(const native of [false,true])test(`touch parity and private lifecycle (${native})`,()=>{
  const a=createHospitalArchitectureV308(native),b=createHospitalArchitectureV308(native,{mobileLike:true});
  expect(signature(a)).toEqual(signature(b));expect(a.children).toHaveLength(native?4:6);
  expect(hasCompleteHospitalArchitectureV308(a,native)).toBe(true);
  expect(hasCompleteHospitalArchitectureV308(a.clone(),native)).toBe(false);
  const mesh=a.children[0]as Mesh,day=mesh.material;
  for(const material of [mesh.userData.nightMaterial,mesh.userData.schwellenraumMaterial]){
   mesh.material=material;expect(hasCompleteHospitalArchitectureV308(a,native)).toBe(true);
  }
  mesh.material=new MeshBasicMaterial();expect(hasCompleteHospitalArchitectureV308(a,native)).toBe(false);
  (mesh.material as MeshBasicMaterial).dispose();mesh.material=day;
  const position=mesh.geometry.getAttribute("position");position.needsUpdate=true;
  expect(hasCompleteHospitalArchitectureV308(a,native)).toBe(false);
  dispose(a);dispose(b);
 });
 test("legal geometry and instance parking preserves the private proof",()=>{
  const root=createHospitalArchitectureV308(true);
  const work=parkStaticGeometrySteps(root,true);let step=work.next();while(!step.done)step=work.next();
  root.traverse(o=>{if(o instanceof Mesh){for(const attribute of Object.values(o.geometry.attributes))if(attribute instanceof BufferAttribute)attribute.onUploadCallback();o.geometry.index?.onUploadCallback();if(o instanceof InstancedMesh){o.instanceMatrix.onUploadCallback();o.instanceColor?.onUploadCallback();}}});
  expect(hasCompleteHospitalArchitectureV308(root,true)).toBe(true);dispose(root);
 });
 test("moved or disposed required models cannot authorize old-owner retirement",()=>{
  const root=createHospitalArchitectureV308(),member=root.children[0]as Mesh;
  root.position.y=1;expect(hasCompleteHospitalArchitectureV308(root)).toBe(false);root.position.y=0;
  member.position.x=1;expect(hasCompleteHospitalArchitectureV308(root)).toBe(false);member.position.x=0;
  expect(hasCompleteHospitalArchitectureV308(root)).toBe(true);
  member.geometry.dispose();expect(hasCompleteHospitalArchitectureV308(root)).toBe(false);dispose(root);
  const material=createHospitalArchitectureV308();(material.children[0]as Mesh).userData.dayMaterial.dispose();
  expect(hasCompleteHospitalArchitectureV308(material)).toBe(false);dispose(material);
 });
 for(const native of [false,true])test(`exact prior batches and foreign BWK rows roll back (${native})`,()=>{
  const root=new Group(),oldRecognition=createHospitalRecognitionV228(native),oldEnvelopes=createHospitalEnvelopesV228(native),oldWard=createBundeswehrHospitalV214(native),replacement=createHospitalArchitectureV308(native);
  root.add(oldRecognition,oldEnvelopes,oldWard,replacement);
  const ward=oldWard.children.find(c=>c instanceof InstancedMesh)as InstancedMesh;
  const before=new Float32Array(ward.instanceMatrix.array),colors=bytes(ward.instanceColor!.array);
  expect(applyHospitalPreviousV308(root,native)).toBe(false);
  expect(applyHospitalPreviousV308(root,native,true,replacement)).toBe(true);
  const indices=new Set(previous.batches.find(p=>p.native===native)!.bundeswehr.rows.map(r=>r.index));
  for(let row=0;row<ward.count;row++){
   const matrix=ward.instanceMatrix.array.slice(row*16,row*16+16);
   if(indices.has(row))expect(Array.from(matrix.slice(0,12)).every(v=>v===0)).toBe(true);
   else expect(Array.from(matrix)).toEqual(Array.from(before.slice(row*16,row*16+16)));
  }
  expect(bytes(ward.instanceColor!.array)).toBe(colors);
  const foreign=oldRecognition.children.filter(c=>!["benjamin-franklin","friedrichshain"].includes(c.userData.siteKey));
  expect(foreign.every(c=>c.visible)).toBe(true);
  expect(applyHospitalPreviousV308(root,native,true,replacement)).toBe(true);
  replacement.children[0].visible=false;
  expect(applyHospitalPreviousV308(root,native,true,replacement)).toBe(false);
  expect(Array.from(ward.instanceMatrix.array)).toEqual(Array.from(before));
  expect(oldRecognition.children.every(c=>c.visible)).toBe(true);
  for(const r of [oldRecognition,oldEnvelopes,oldWard,replacement])dispose(r);
 });
 for(const native of [false,true])test(`late original night/grade/interleaved/parked admission and revoke (${native})`,()=>{
  const root=new Group(),recognition=createHospitalRecognitionV228(native),envelopes=createHospitalEnvelopesV228(native),ward=createBundeswehrHospitalV214(native),replacement=createHospitalArchitectureV308(native);
  root.add(recognition,envelopes,ward,replacement);
  const target=ward.children.find(c=>c instanceof InstancedMesh)as InstancedMesh,
    before=new Float32Array(target.instanceMatrix.array);
  for(const legacy of [recognition,envelopes,ward]){
   legacy.traverse(o=>{if(o instanceof Mesh){o.material=o.userData.nightMaterial;o.material=schwellenraumMaterialFor(o,o.userData.dayMaterial);}});
   interleaveStaticGeometry(legacy);
   const work=parkStaticGeometrySteps(legacy,true);let step=work.next();while(!step.done)step=work.next();
   const uploaded=new Set<object>();legacy.traverse(o=>{if(o instanceof Mesh){for(const a of Object.values(o.geometry.attributes)){const storage=a instanceof InterleavedBufferAttribute?a.data:a;if(!uploaded.has(storage)){uploaded.add(storage);storage.onUploadCallback();}}o.geometry.index?.onUploadCallback();if(o instanceof InstancedMesh){o.instanceMatrix.onUploadCallback();o.instanceColor?.onUploadCallback();}}});
  }
  expect(applyHospitalPreviousV308(root,native,true,replacement)).toBe(true);
  expect(applyHospitalPreviousV308(root,native,false,replacement)).toBe(false);
  expect(Array.from(target.instanceMatrix.array)).toEqual(Array.from(before));
  expect(recognition.children.every(c=>c.visible)).toBe(true);
  expect(applyHospitalPreviousV308(root,native,true,replacement)).toBe(true);
  root.remove(replacement);expect(applyHospitalPreviousV308(root,native,true,replacement)).toBe(false);
  for(const r of [recognition,envelopes,ward,replacement])dispose(r);
 });
 test("spoofed/damaged legacy batches keep every original member",()=>{
  const root=new Group(),recognition=createHospitalRecognitionV228(),envelopes=createHospitalEnvelopesV228(),ward=createBundeswehrHospitalV214(),replacement=createHospitalArchitectureV308();root.add(recognition,envelopes,ward,replacement);
  const target=recognition.children.find(c=>c.userData.siteKey==="friedrichshain")as InstancedMesh;
  target.instanceMatrix.array[12]+=.25;target.instanceMatrix.needsUpdate=true;
  expect(applyHospitalPreviousV308(root,false,true,replacement)).toBe(false);
  expect(recognition.children.every(c=>c.visible)).toBe(true);
  for(const r of [recognition,envelopes,ward,replacement])dispose(r);
 });
 test("granular navigation has real court holes and finite old-helper scope",()=>{
  const drawn=hospitalArchitectureV308Solids(),native=hospitalArchitectureV308Solids(true);
  expect(drawn.length).toBeGreaterThan(132);expect(native.length).toBeGreaterThan(1);
  expect(drawn.some(p=>p.holes.length>0)).toBe(true);
  expect(drawn.every(p=>p.low<p.high)).toBe(true);
  expect(native.every(p=>p.ring.every((v,i,r)=>i===0||v[0]===r[i-1][0]||v[1]===r[i-1][1]))).toBe(true);
  expect(hospitalV308OverridesV228(0,0)).toBe(false);
  expect(hospitalV308OverridesV228(-3600,8400)).toBe(true);
 });
});
