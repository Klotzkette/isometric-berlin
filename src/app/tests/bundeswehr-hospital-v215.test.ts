import { expect, test } from "bun:test";
import { Mesh } from "three";
import drawn from "../src/data/bundeswehrHospitalV215Drawn.json";
import native from "../src/data/bundeswehrHospitalV215Minecraft.json";
import ownership from "../src/data/bundeswehrHospitalV215Ownership.json";
import springerOwnership from "../src/data/springerV215Ownership.json";
import nav from "../src/data/bundeswehrHospitalV215Navigation.json";
import source from "../src/data/bundeswehrHospitalV214.json";
import { type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { transferSiteTrianglesV209 } from "../src/siteOwnershipV209";
import { correctedHospitalFittingsV215, correctedHospitalRoofAtV215 } from "../src/bundeswehrHospitalV215Profile";
import { buildAltMitteCoreV169Steps } from "../src/AltMitteCoreV169";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import original from "../src/data/altMitteV169Drawn/packet-000.json";

function complete<T>(steps: Generator<void,T>): T { let next=steps.next(); while (!next.done) next=steps.next(); return next.value; }

test("exact hospital transfer keeps unrelated triangles and rejects changed source bytes", () => {
  const record=ownership.records.find(r=>r.mode==="drawn" && r.layer==="drawn")!;
  const part=original.meshes.find(p=>p.kind===record.kind)!;
  // Buffer byte offsets are not guaranteed shared between allocations.
  const bytes=Buffer.from(part.indices,"base64"), raw=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
  const actual=new Uint32Array(raw), wanted=new Set([...ownership.records, ...springerOwnership.records].filter(r => r.tile === record.tile && r.kind === record.kind && r.mode === record.mode && r.fingerprint === record.fingerprint).flatMap(r => r.triangles));
  expect(complete(transferSiteTrianglesV209(record.tile,false,part as never,actual,0))).toBe(wanted.size);
  for (let t=0;t<raw.length/3;t++) {
    expect(actual[t*3]).toBe(raw[t*3]);
    expect(actual[t*3+1]).toBe(wanted.has(t)?raw[t*3]:raw[t*3+1]);
    expect(actual[t*3+2]).toBe(wanted.has(t)?raw[t*3]:raw[t*3+2]);
  }
  const untouched=new Uint32Array(raw);
  expect(complete(transferSiteTrianglesV209(record.tile,false,{...part,colors:part.colors.slice(4)+"AAAA"} as never,untouched,0))).toBe(0);
  expect(untouched).toEqual(raw);
});

test("roof replacement is required resident geometry in both modes with accounted buffers", () => {
  expect(() => complete(buildAltMitteCoreV169Steps({schemaVersion:1,sourceParents:[ownership.owner],drawnChunks:[],minecraftChunks:[]}))).toThrow("correction is required");
  for (const [packet,isNative] of [[drawn,false],[native,true]] as const) {
    const root=complete(buildAltMitteCoreV169Steps({schemaVersion:1,sourceParents:[ownership.owner],drawnChunks:[],minecraftChunks:[],hospitalCorrection:packet as SurroundingCityChunk},isNative));
    try {
      expect(root.children.length).toBe(1);
      expect(root.children[0].userData.hospitalRoofV215).toBe(true);
      expect(root.userData.fullMobileIdentical).toBe(true);
      expect(root.userData.geometryBytes).toBeGreaterThan(10000);
      expect(root.userData.geometryBytes).toBeLessThan(125000);
      root.traverse(node=>{if(node instanceof Mesh) expect(node.geometry.boundingSphere!.radius * node.scale.x).toBeLessThan(120);});
    } finally {disposeSurroundingCityRoot(root);}
  }
});

test("only audited upper gable fittings change and native roof picking matches correction", () => {
  for (const [rows,isNative] of [[source.boxes,false],[source.blocks,true]] as const) {
    const fixed=correctedHospitalFittingsV215(rows,isNative);
    const changes=isNative?ownership.adjustments.minecraft:ownership.adjustments.drawn;
    expect(fixed.length).toBe(rows.length-changes.retire.length);
    for (const row of fixed) expect(rows.includes(row)).toBe(true);
  }
  expect(correctedHospitalRoofAtV215(300,400,false,18)).toBe(18);
  const sample=nav.nativeChangedRoofCells.find(c=>c[2]!==null && c[3]!==null)!;
  expect(correctedHospitalRoofAtV215(sample[0]!+.5,sample[1]!+.5,true,sample[2])).toBe(sample[3]);
  expect(correctedHospitalRoofAtV215(sample[0]!+.5,sample[1]!+.5,true,100)).toBe(100);
});
