import { expect,test } from "bun:test";
import { createSpreeFacadesV231,planSpreeFacadesV231 } from "../src/SpreeFacadesV231";
import ownership from "../src/data/spreeFacadesV231Ownership.json";
import profile from "../src/data/spreeFacadesV231.json";
import { applyAltMitteAppearanceV213,type AltMitteAppearanceSourceV213 } from "../src/altMitteAppearanceV213";
import { transferSpreeFacadeV231 } from "../src/spreeFacadeOwnershipV231";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

function drain<T>(g:Generator<void,T>):T {let n=g.next();while(!n.done)n=g.next();return n.value;}

test("named architectural distinctions and retained ordinary opening positions",()=>{
 const drawn=planSpreeFacadesV231(false);
 expect(profile.sites).toHaveLength(15);
 expect(drawn.filter(b=>b.role==='colossal pilaster')).toHaveLength(4);
 expect(drawn.filter(b=>b.role==='wooden daylight panel').length).toBeGreaterThan(10);
 expect(drawn.filter(b=>b.role==='retained opening transom').length).toBeGreaterThan(100);
 // Ordinary fronts have no new glazing grid or opaque replacement skin.
 for(const s of profile.sites.slice(3))expect(drawn.filter(b=>b.owner===s.owner).every(b=>!b.role.includes('glazing'))).toBe(true);
});

test("small static families, full drawn detail and independent orthogonal native",()=>{
 for(const native of [false,true]) {
  const root=createSpreeFacadesV231(native,true),plan=planSpreeFacadesV231(native);
  expect(root.children.length).toBe(15);expect(root.userData.fullStaticDetailOnTouch).toBe(true);
  expect(plan.length).toBeLessThan(native?5000:3000);
  for(const b of plan){expect(b.position.every(Number.isFinite)).toBe(true);expect(b.size.every(v=>Number.isFinite(v)&&v>0)).toBe(true);if(native)expect(b.yaw).toBe(0);}
 }
});

test("only audited old facade indices transfer; every outside index survives",()=>{
 for(const record of ownership.records) {
  const packet=JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${record.tile}.drawn.json.gz`,import.meta.url))).toString());
  let matched=false;
  for(const part of packet.meshes) {
   const bytes=Buffer.from(part.indices,'base64'),before=new Uint32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
   const after=before.slice();const count=drain(transferSpreeFacadeV231(record.tile,false,part,after,0));
   if(!count)continue;matched=true;expect(count).toBe(record.triangles.length);
   const selected=new Set(record.triangles);
   for(let i=0;i<before.length;i++){if(!selected.has(Math.floor(i/3)))expect(after[i]).toBe(before[i]);}
   const changed={...part,positions:part.positions.slice(0,-1)+(part.positions.endsWith('A')?'B':'A')};
   const untouched=before.slice();expect(drain(transferSpreeFacadeV231(record.tile,false,changed,untouched,0))).toBe(0);expect(untouched).toEqual(before);
  }
  expect(matched).toBe(true);
 }
});

test("colour receipt keeps positions and nonselected bytes, rejects changed packet",()=>{
 // Same audited existing helper is used after v213; malformed fingerprint is
 // deliberately supplied against a real eligible packet rather than a mock mesh.
 const evidence=ownership.appearance as AltMitteAppearanceSourceV213;
 for(const [key,receipts] of Object.entries(evidence.packets)) {
  const identity=key.replace(/^(minecraft|drawn):alt-mitte-v169-/,''),native=key.startsWith('minecraft:');
  const sourceText=readFileSync(new URL(`../src/data/altMitte${native?'Native':'Drawn'}V169Data.ts`,import.meta.url),'utf8');
  const match=sourceText.match(new RegExp(`id:"${identity}",packet:p(\\d+)`))!;
  const packet=JSON.parse(readFileSync(new URL(`../src/data/altMitteV169${native?'Native':'Drawn'}/packet-${match[1].padStart(3,'0')}.json`,import.meta.url),'utf8'));
  for(const receipt of receipts) {
   const part=packet.meshes[receipt.mesh],p=Buffer.from(part.positions,'base64'),c=Buffer.from(part.colors,'base64');
   const pos=new Uint16Array(p.buffer,p.byteOffset,p.length/2),vertices=new Uint16Array(pos.length*2);
   for(let i=0;i<pos.length/3;i++){for(let a=0;a<3;a++){vertices[i*6+a]=pos[i*3+a];vertices[i*6+3+a]=c[i*3+a]*257;}}
   const before=vertices.slice();const changed=drain(applyAltMitteAppearanceV213(key.split(':')[1],native,part,receipt.mesh,vertices,0,pos.length/3,evidence));expect(changed).toBeGreaterThan(0);
   const allowed=new Set<number>(),runs=Buffer.from(receipt.runs,'base64');for(let i=0;i<runs.length;i+=12){for(let v=runs.readUInt32LE(i);v<runs.readUInt32LE(i)+runs.readUInt32LE(i+4);v++)allowed.add(v);}
   for(let i=0;i<vertices.length;i++)if(i%6<3||!allowed.has(Math.floor(i/6)))expect(vertices[i]).toBe(before[i]);
   const bad={...evidence,packets:{[key]:[{...receipt,fingerprint:receipt.fingerprint^1}]}};
   expect(drain(applyAltMitteAppearanceV213(key.split(':')[1],native,part,receipt.mesh,before,0,pos.length/3,bad))).toBe(0);
  }
 }
});
