import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { Group, Mesh } from "three";
import { loadTierparkEastLowV379, loadTierparkEastShellsV379, tierparkEastIdsV379 } from "../src/tierparkEastIndexV379";
import { attachTierparkEastV379 } from "../src/tierparkEastV379";
import { tierparkEastViewsV379 } from "../src/tierparkEastViewsV379";
import { admitSurveyedShellsV377 } from "../src/surveyedBuildingShellsV377";
import type { SurroundingChunkGeometry, SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import index from "../src/data/tierparkEastV379ShellIndex.json";
import lows from "../src/data/tierparkEastV379LowIndex.json";
import landscapes from "../src/data/tierparkEastV379LandscapeIndex.json";
import previous from "../src/data/historicArchitectureV378Index.json";

function chunk(tile: string, native: boolean): SurroundingCityChunk {
  const file = resolve(import.meta.dir, "../public/mesh/surrounding-berlin-v159", tile + (native ? ".minecraft.json.gz" : ".drawn.json.gz"));
  return JSON.parse(gunzipSync(readFileSync(file)).toString());
}

test("both geometry families authenticate the exact replaced eastern zoo owners", async() => {
  const owners = new Set<string>();
  for (const native of [false,true]) {
    for (const tile of new Set([...index,...lows])) {
      const source = await loadTierparkEastShellsV379(tile,native);
      const packet = chunk(tile,native);
      expect(previous[native ? "minecraft":"drawn"].includes(tile)).toBeFalse();
      expect(source).toBeDefined();
      const generator = admitSurveyedShellsV377(packet,tile,source!);
      let state = generator.next();
      while (!state.done) state=generator.next();
      expect(state.value?.shells.length).toBeGreaterThan(0);
      for(const shell of state.value!.shells) {
        owners.add(shell.id);
        expect(shell.mesh.indices.length).toBeGreaterThan(60);
      }
    }
  }
  expect(owners.has("DEBE11YYI0000Ixq")).toBeTrue();
  expect(owners.has("DEBE11YYI0000IWe")).toBeTrue();
  expect(owners.has("OSM-way-440392310")).toBeTrue();
  expect(owners.size).toBeGreaterThanOrEqual(18);
  expect(await loadTierparkEastShellsV379("ring182-6_7",false)).toBeUndefined();
});

test("the local landscape owns its geometry and walk decks across both families", async() => {
  for (const native of [false,true]) {
    const names=new Set<string>();
    let floors=0;
    for (const tile of landscapes) {
      const packet=chunk(tile,native);
      const entry: SurroundingChunkGeometry={origin:packet.origin,root:new Group(),nav:packet.nav,geometryBytes:0,bufferCount:0};
      const controller=new AbortController();
      await attachTierparkEastV379(entry,tile,native,controller.signal);
      entry.root.traverse(o=>{
        if (!(o instanceof Mesh)) return;
        names.add(o.name);
        expect(o.geometry.index?.count).toBeGreaterThan(0);
        expect(o.geometry.boundingSphere?.radius).toBeGreaterThan(0);
      });
      floors+=entry.nav.spreeBridgesV242?.floors.length??0;
      const before=entry.geometryBytes;
      await attachTierparkEastV379(entry,tile,native,controller.signal);
      expect(entry.geometryBytes).toBe(before);
      expect(tierparkEastIdsV379.has(tile)).toBeTrue();
      disposeSurroundingCityRoot(entry.root);
    }
    expect(floors).toBeGreaterThan(125);
    expect([...names].some(n=>n.includes("Giraffenpfad"))).toBeTrue();
    expect([...names].some(n=>n.includes("Geländerelief"))).toBeTrue();
    expect([...names].some(n=>n.includes("Baumkronen"))).toBeTrue();
  }
  for(const view of Object.values(tierparkEastViewsV379)) {
    const [x,,z]=view.target;
    expect(tierparkEastIdsV379.has("outer187-"+Math.floor(x/512)+"_"+Math.floor(z/512))).toBeTrue();
  }
});

test("outdated tower navigation is retired only after the matching grouped roof mesh was accepted",async()=>{
  for (const native of [false,true]) {
    const tile="outer187-21_3";
    const data=chunk(tile,native);
    const low=await loadTierparkEastLowV379(tile,native);
    expect(low).toBeDefined();
    const entry:SurroundingChunkGeometry={nav:data.nav,origin:data.origin,root:new Group(),geometryBytes:0,bufferCount:0};
    entry.root.userData.surveyedShellIndexRangesV377=[{owner:low!.shell.id}];
    await attachTierparkEastV379(entry,tile,native,new AbortController().signal);
    expect(entry.nav.buildings.find(v=>v.sourceId==="DEBE11YYI0000A0u")?.height).toBeLessThan(5);
    expect(entry.nav.buildings.find(v=>v.sourceId==="DEBE11YYI0000CJH")).toBeUndefined();
    disposeSurroundingCityRoot(entry.root);
  }
});
