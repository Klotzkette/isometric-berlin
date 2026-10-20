import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { transformLosslessJsonData } from "../losslessJsonData";
import source from "../src/data/steglitzSchoolV250.json";
import original from "../src/data/steglitzV182Source.json";
import native from "../src/data/steglitzV182Native.json";
import details from "../src/data/steglitzV246Details.json";
import places from "../src/data/schoolsPlacesV205.json";
import {
  replaceSteglitzSchoolPlaceV250, steglitzSchoolV250Enabled,
  steglitzSchoolV250Fingerprint, steglitzSchoolV250NativeRows,
  steglitzSchoolV250Refinements, steglitzSchoolV250SourceBoxes,
  steglitzSchoolV250SurfaceColor, verifySteglitzSchoolV250Receipt,
} from "../src/steglitzSchoolV250";

const entry = places.schools.find(s => s.owner === "DEBE06YYB0000AUq")!;
const inputs = {
  sourceBoxes:original.boxes, sourceSurfaces:original.surfaces, nativeRows:native.boxes,
  refinementsBoxes:details.boxes, refinementsNativeRows:details.nativeRows, entry205:entry,
};

test("typed receipts match Python and detect an altered coordinate, paint, owner or missing row", () => {
  expect(steglitzSchoolV250Enabled()).toBe(true);
  expect(verifySteglitzSchoolV250Receipt(inputs)).toBe(true);
  for (const key of Object.keys(inputs) as (keyof typeof inputs)[]) {
    expect(steglitzSchoolV250Fingerprint(inputs[key])).toBe(source.fingerprints[key]);
    expect(verifySteglitzSchoolV250Receipt({...inputs,[key]:[]})).toBe(false);
  }
  const changed = structuredClone(entry); changed.boxes[0][0] += .001;
  expect(replaceSteglitzSchoolPlaceV250(changed)).toBe(changed);
  const paint = structuredClone(original.surfaces); paint[0].color ^= 1;
  expect(verifySteglitzSchoolV250Receipt({...inputs,sourceSurfaces:paint})).toBe(false);
});

test("each bad original source atomically retains every old layer and adds no replacement", () => {
  for (const mutation of [
    "original.boxes[0][0]+=.001", "original.surfaces[0].color^=1",
    "native.boxes.pop()", "details.boxes[0][0]+=.001",
    "details.nativeRows.pop()", "entry.owner+='changed'",
  ]) {
    const code = `
      import assert from 'node:assert/strict';
      import original from './src/data/steglitzV182Source.json';
      import native from './src/data/steglitzV182Native.json';
      import details from './src/data/steglitzV246Details.json';
      import places from './src/data/schoolsPlacesV205.json';
      const entry=places.schools.find(s=>s.owner==='DEBE06YYB0000AUq');
      ${mutation};
      const m=await import('./src/steglitzSchoolV250');
      assert.equal(m.steglitzSchoolV250Enabled(),false);
      assert.equal(m.steglitzSchoolV250SourceBoxes(original.boxes),original.boxes);
      assert.equal(m.steglitzSchoolV250NativeRows(native.boxes),native.boxes);
      assert.equal(m.steglitzSchoolV250Refinements(details.boxes,false),details.boxes);
      assert.equal(m.steglitzSchoolV250Refinements(details.nativeRows,true),details.nativeRows);
      assert.equal(m.steglitzSchoolV250SurfaceColor(0,123),123);
      assert.equal(m.replaceSteglitzSchoolPlaceV250(entry),entry);
    `;
    const result = Bun.spawnSync([process.execPath,"-e",code],{cwd:import.meta.dir+"/.."});
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
  }
});

test("only receipted old pane estimates change; every native cell keeps its full geometry", () => {
  const deleted = new Set(source.remove["v182.boxes"]);
  expect(steglitzSchoolV250SourceBoxes(original.boxes)).toEqual(original.boxes.filter((_,i)=>!deleted.has(i)));
  const painted = new Map(source.nativeColors.map(r=>[r[0],r[1]]));
  const rows = steglitzSchoolV250NativeRows(native.boxes);
  expect(rows.length).toBe(native.boxes.length);
  rows.forEach((row,i)=>{
    expect(row.slice(0,6)).toEqual(native.boxes[i].slice(0,6));
    expect(row[6]).toBe(painted.get(i)??native.boxes[i][6]);
    if(!painted.has(i)) expect(row).toBe(native.boxes[i]);
  });
  const colours = new Map(source.surfaceColors.map(r=>[r[0],r[1]]));
  original.surfaces.forEach((s,i)=>expect(steglitzSchoolV250SurfaceColor(i,s.color)).toBe(colours.get(i)??s.color));
  for(const isNative of [false,true]){
    const key=isNative?"nativeRows":"boxes", removals=new Set(source.remove[`v246.${key}`]);
    expect(steglitzSchoolV250Refinements(details[key],isNative)).toEqual(details[key].filter((_,i)=>!removals.has(i)));
  }
});

test("replacement uses the existing school batch, finite full native detail and bounded payload", async () => {
  for(const other of places.schools.filter(s=>s!==entry)) expect(replaceSteglitzSchoolPlaceV250(other)).toBe(other);
  const replacement=replaceSteglitzSchoolPlaceV250(entry);
  expect(replacement.faces).toBe(entry.faces);
  expect(replacement.boxes.length).toBe(961);
  expect(replacement.rods.length).toBe(882);
  expect(replacement.nativeRows.length).toBe(2778);
  expect(replacement.labels[0].text).toBe("GYMNASIUM");
  expect(replacement.labels[0].direction[2]).toBeLessThan(-.99);
  replacement.nativeRows.forEach(r=>{
    expect(r.length).toBe(7);
    expect(r.every(Number.isFinite)).toBe(true);
    expect(r.slice(3,6).every(v=>v>0)).toBe(true);
  });
  const path=resolve(import.meta.dir,"../src/data/steglitzSchoolV250.json");
  const transformed=transformLosslessJsonData(await Bun.file(path).text(),path)!;
  expect(Buffer.byteLength(transformed.code)).toBeLessThan(200_000);
  expect(replacement.nativeRows.length*76).toBeLessThan(240_000);
});
