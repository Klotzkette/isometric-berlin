import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Group, Mesh, Raycaster, Vector3 } from "three";
import { createStreamedSurroundingCityChunkV255 } from "../src/SurroundingCity";
import type { SurroundingChunkGeometry } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import { attachSchoenebergPlaetzeV383 } from "../src/schoenebergPlaetzeV383";
import { schoenebergPlaetzeViewsV383, schoenebergPlaetzeOpeningHostV383 } from "../src/schoenebergPlaetzeViewsV383";
import winter from "../src/data/schoenebergPlaetzeV383/winter.json";
import noll from "../src/data/schoenebergPlaetzeV383/noll.json";

test("St. Matthias replaces its own prism on both sides of the stream seam and retains its historic neighbour", async () => {
  for (const native of [false,true]) {
    for (const tile of ["-3_4","-3_5"]) {
      const file = new URL("../public/mesh/surrounding-berlin-v159/"+tile+"."+(native?"minecraft":"drawn")+".json.gz",import.meta.url);
      const input = JSON.parse(gunzipSync(readFileSync(file)).toString());
      const entry = await createStreamedSurroundingCityChunkV255(input,tile,native,{yield:async()=>{}});
      try {
        expect(entry.root.userData.surveyedShellOwnersV377).toContain("DEBE07YY900000CC");
        if (tile === "-3_5") {
          expect(entry.root.userData.surveyedShellOwnersV377).toContain("DEBE07YY900007c4");
          const church = entry.nav.buildings.filter(b=>b.sourceId==="DEBE07YY900000CC");
          expect(Math.max(...church.map(b=>b.height))).toBeCloseTo(60,1);
        }
      } finally { disposeSurroundingCityRoot(entry.root); }
    }
  }
}, 60000);

test("both detailed plazas adopt trees and measured material surfaces once in either city style", async () => {
  expect(winter.trees).toHaveLength(110);
  expect(noll.trees).toHaveLength(47);
  expect(Object.keys(schoenebergPlaetzeViewsV383)).toHaveLength(4);
  for (const native of [false,true]) {
    for (const name of ["Nollendorfplatz","Winterfeldtplatz"]) {
      const id=schoenebergPlaetzeOpeningHostV383(name)!;
      const entry={root:new Group(), origin:[0,0,0],geometryBytes:0,bufferCount:0} as unknown as SurroundingChunkGeometry;
      await attachSchoenebergPlaetzeV383(entry,id,native);
      const first=entry.geometryBytes;
      expect(first).toBeGreaterThan(0);
      await attachSchoenebergPlaetzeV383(entry,id,native);
      expect(entry.geometryBytes).toBe(first);
      let triangles=0;
      entry.root.traverse(o=>{if (o instanceof Mesh) triangles+=(o.geometry.index?.count??0)/3});
      expect(triangles).toBeGreaterThan(10000);
      disposeSurroundingCityRoot(entry.root);
    }
  }
});

test("the active district floors support survey roads, tree roots and benches in both styles", async () => {
  const heightAt = (mesh: Mesh, x: number, z: number) =>
    new Raycaster(new Vector3(x, 10, z), new Vector3(0, -1, 0)).intersectObject(mesh, false)[0]?.point.y;
  for (const native of [false,true]) {
    for (const name of ["Nollendorfplatz","Winterfeldtplatz"]) {
      const entry = { root: new Group(), origin:[0,0,0], geometryBytes:0, bufferCount:0 } as unknown as SurroundingChunkGeometry;
      const nollendorf = name === "Nollendorfplatz";
      try {
        await attachSchoenebergPlaetzeV383(entry, schoenebergPlaetzeOpeningHostV383(name)!, native);
        entry.root.updateMatrixWorld(true);
        const meshes: Mesh[] = [];
        const owner = nollendorf ? name : "Winterfeldtplatz und St. Matthias";
        entry.root.traverse(o => { if (o instanceof Mesh && o.name === owner) meshes.push(o); });
        const road = meshes.find(mesh => mesh.geometry.hasAttribute("jointSize"))!;
        const furniture = meshes.find(mesh => !mesh.geometry.hasAttribute("jointSize"))!;
        if (nollendorf) {
          // Two points inside surveyed Fahrbahn .41138 previously showed different
          // legacy surfaces, including kerb ink at 5.49 m on the second point.
          expect(heightAt(road, -1276.69, 2150.89)).toBeCloseTo(5.63, 2);
          expect(heightAt(road, -1269.98, 2148.31)).toBeCloseTo(5.63, 2);
          expect(noll.trees.find(r => r[0] === -1334.78 && r[1] === 2085.69)?.[2]).toBeCloseTo(5.70, 2);
          expect(heightAt(furniture, -1330.5447, 2103.8914)).toBeCloseTo(6.20, 2);
        } else {
          // Core-run street, transition and the original lower district floor.
          expect(heightAt(road, -1158.47, 2404.15)).toBeCloseTo(5.63, 2);
          // The previous smooth road tip and its 5.49 m cartographic edge
          // extend slightly beyond the last original raster cell at this corner.
          expect(heightAt(road, -1213.58, 2398.50)).toBeCloseTo(5.63, 2);
          expect(heightAt(road, -1212.58, 2399.50)).toBeCloseTo(5.63, 2);
          expect(heightAt(road, -1221.20, 2399.15)).toBeCloseTo(5.14, 2);
          expect(heightAt(road, -1180.32, 2517.49)).toBeCloseTo(3.29, 2);
          expect(heightAt(road, -1206, 2497)).toBeCloseTo(3.35, 2);
          expect(winter.trees.find(r => r[0] === -1288.87 && r[1] === 2418.97)?.[2]).toBeCloseTo(3.36, 2);
          expect(heightAt(furniture, -1159.1756, 2626.9451)).toBeCloseTo(3.86, 2);
        }
      } finally { disposeSurroundingCityRoot(entry.root); }
    }
  }
});
