import {expect,test} from "bun:test";
import {resolve} from "node:path";
import {transformLosslessJsonData} from "../losslessJsonData";
import data from "../src/data/steglitzCourtyardV251.json";
import original from "../src/data/steglitzV182Source.json";
import native from "../src/data/steglitzV182Native.json";
import previous from "../src/data/steglitzSchoolV250.json";
import places from "../src/data/schoolsPlacesV205.json";
import {
  appendSteglitzCourtyardV251, steglitzCourtyardV251Enabled,
  steglitzCourtyardV251SourceBoxes, steglitzCourtyardV251NativeRows,
  steglitzCourtyardV251SurfaceColor, verifySteglitzCourtyardV251Receipt,
} from "../src/steglitzCourtyardV251";
import {
  replaceSteglitzSchoolPlaceV250, steglitzSchoolV250NativeRows,
  steglitzSchoolV250SurfaceColor,
} from "../src/steglitzSchoolV250";

test("receipt preserves complete v250 front and hall, rejects every altered original field",()=>{
  const inputs={sourceBoxes:original.boxes,sourceSurfaces:original.surfaces,nativeRows:native.boxes,v250:previous};
  expect(steglitzCourtyardV251Enabled()).toBe(true);
  expect(verifySteglitzCourtyardV251Receipt(inputs)).toBe(true);
  for(const key of Object.keys(inputs) as (keyof typeof inputs)[])
    expect(verifySteglitzCourtyardV251Receipt({...inputs,[key]:[]})).toBe(false);
  const changed=structuredClone(previous);changed.boxes[0][0]+=.001;
  expect(verifySteglitzCourtyardV251Receipt({...inputs,v250:changed})).toBe(false);
});

test("original-index filters compose without removing any unrelated or v250 geometry",()=>{
  const remove=new Set([...previous.remove["v182.boxes"],...data.removeSourceBoxes]);
  expect(steglitzCourtyardV251SourceBoxes(original.boxes)).toEqual(original.boxes.filter((_,i)=>!remove.has(i)));
  const baseline=steglitzSchoolV250NativeRows(native.boxes), result=steglitzCourtyardV251NativeRows(native.boxes);
  const paint=new Map(data.nativeColors.map(row=>[row[0],row[1]]));
  expect(result.length).toBe(native.boxes.length);
  result.forEach((row,i)=>{
    expect(row.slice(0,6)).toEqual(native.boxes[i].slice(0,6));
    expect(row[6]).toBe(paint.get(i)??baseline[i][6]);
  });
  const surfacePaint=new Map(data.surfaceColors.map(row=>[row[0],row[1]]));
  original.surfaces.forEach((surface,i)=>{
    expect(steglitzCourtyardV251SurfaceColor(i,surface.color)).toBe(surfacePaint.get(i)??steglitzSchoolV250SurfaceColor(i,surface.color));
  });
});

test("all finite courtyard details append to the already replaced school batch, with no extra mesh",async()=>{
  const old=places.schools.find(s=>s.owner===data.owner)!;
  const front=replaceSteglitzSchoolPlaceV250(old), result=appendSteglitzCourtyardV251(front);
  expect(result.faces).toBe(front.faces);
  expect(result.labels).toBe(front.labels);
  for(const key of ["boxes","rods","nativeRows"] as const){
    expect(result[key].slice(0,front[key].length)).toEqual(front[key]);
    expect(result[key].length).toBe(front[key].length+data[key].length);
    expect(result[key].every(row=>row.every(Number.isFinite))).toBe(true);
  }
  expect(result.nativeRows.every(row=>row.length===7&&row.slice(3,6).every(v=>v>0))).toBe(true);
  for(const other of places.schools.filter(s=>s.owner!==data.owner))expect(appendSteglitzCourtyardV251(other)).toBe(other);
  const path=resolve(import.meta.dir,"../src/data/steglitzCourtyardV251.json");
  const raw=await Bun.file(path).text(), transformed=transformLosslessJsonData(raw,path);
  expect(Buffer.byteLength(raw)).toBeLessThan(160_000);
  expect(transformed?Buffer.byteLength(transformed.code):Buffer.byteLength(raw)).toBeLessThan(160_000);
  expect(data.nativeRows.length*76).toBeLessThan(200_000);
  expect(data.counts.historicWingFloors).toBe(3);
  expect(data.counts.historicWingWindowBays).toBe(20);
  expect(data.counts.historicWingBlankEndWalls).toBe(1);
});

test("changed v250 receipt fails open to the complete prior rendering atomically",()=>{
  const code=`
    import assert from 'node:assert/strict';
    import previous from './src/data/steglitzSchoolV250.json';
    import original from './src/data/steglitzV182Source.json';
    import native from './src/data/steglitzV182Native.json';
    import places from './src/data/schoolsPlacesV205.json';
    previous.boxes[0][0]+=.001;
    const base=await import('./src/steglitzSchoolV250');
    const m=await import('./src/steglitzCourtyardV251');
    assert.equal(m.steglitzCourtyardV251Enabled(),false);
    assert.deepEqual(m.steglitzCourtyardV251SourceBoxes(original.boxes),base.steglitzSchoolV250SourceBoxes(original.boxes));
    assert.deepEqual(m.steglitzCourtyardV251NativeRows(native.boxes),base.steglitzSchoolV250NativeRows(native.boxes));
    original.surfaces.forEach((s,i)=>assert.equal(m.steglitzCourtyardV251SurfaceColor(i,s.color),base.steglitzSchoolV250SurfaceColor(i,s.color)));
    const entry=base.replaceSteglitzSchoolPlaceV250(places.schools.find(s=>s.owner==='DEBE06YYB0000AUq'));
    assert.equal(m.appendSteglitzCourtyardV251(entry),entry);
  `;
  const child=Bun.spawnSync([process.execPath,"-e",code],{cwd:resolve(import.meta.dir,"..")});
  expect(child.stderr.toString()).toBe("");
  expect(child.exitCode).toBe(0);
});
