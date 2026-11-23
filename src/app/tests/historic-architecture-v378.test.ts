import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { InstancedMesh, Mesh } from "three";
import { createStreamedSurroundingCityChunkV255 } from "../src/SurroundingCity";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { createAlexanderNorthWithJonassV378 } from "../src/AlexanderNorthV166";
import { createArchenholdEntranceV378, createSohoHouseFrontV378 } from "../src/historicArchitectureV378Specials";
import { createPrenzlbergEnvelopesV264 } from "../src/PrenzlbergEnvelopesV264";
import { loadHistoricArchitectureV378 } from "../src/historicArchitectureV378";
import { historicArchitectureViewsV378 } from "../src/historicArchitectureViewsV378";
import index from "../src/data/historicArchitectureV378Index.json";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

test("Thirty independent registered buildings have real historical source geometry in both editions", async () => {
  const ownerSets = [new Set<string>(), new Set<string>()];
  let smooth = 0, native = 0;
  for (const [m, mode] of (["drawn", "minecraft"] as const).entries()) {
    for (const tile of index[mode]) {
      const part = (await loadHistoricArchitectureV378(tile, mode === "minecraft"))!;
      expect(part).toBeDefined();
      if (part.shells) {
        const shell = part.shells.tiles[tile][0];
        expect(part.retirements!.packets[tile].owners).toContain(shell.id);
        ownerSets[m].add(shell.id);
        if (m) native++; else smooth++;
        const positions = Buffer.from(shell.mesh.positions, "base64");
        const original = Buffer.from(shell.mesh.indices,"base64");
        expect(original.length).toBeGreaterThan(shell.roofIndexStart*4);
        if (m) {
          const point = (at: number) => {
            const i=original.readUInt32LE(at*4)*6;
            return [positions.readUInt16LE(i),positions.readUInt16LE(i+2),positions.readUInt16LE(i+4)];
          };
          for (let i=shell.roofIndexStart; i<original.length/4; i+=3) {
            const a=point(i),b=point(i+1),c=point(i+2);
            if (a[1]!==b[1] || a[1]!==c[1]) throw Error("Sloped face in a native roof");
          }
        }
      }
      for (const set of Object.values(part.facades.tiles)) {
        for (const owner of set) ownerSets[m].add(owner.id);
      }
    }
  }
  expect(ownerSets[0].size).toBe(30);
  expect(ownerSets[1]).toEqual(ownerSets[0]);
  expect(smooth).toBe(34);
  expect(native).toBeGreaterThanOrEqual(28);
  expect(loadHistoricArchitectureV378("outside-the-coverage", false)).toBeUndefined();
  expect(Object.keys(historicArchitectureViewsV378)).toHaveLength(33);
});

test("Soho's shop windows and stone piers, the observatory clock, and the silver dome use both normal editions", () => {
  for (const native of [false,true]) {
    const shop = createSohoHouseFrontV378(native) as InstancedMesh;
    expect(shop.count).toBe(native?226:178);
    const world = createAlexanderNorthWithJonassV378(native);
    expect(world.getObjectByName(shop.name)).toBeDefined();
    const observatory = createArchenholdEntranceV378(native);
    expect((observatory.children[0] as Mesh).geometry.attributes.position.count).toBeGreaterThan(500);
    const dome = createPrenzlbergEnvelopesV264(native);
    for (const part of dome.children) {
      const mesh=part as Mesh;
      expect(mesh.userData.dayMaterial.customProgramCacheKey()).toBe("berlin-planetarium-cladding-v378");
      expect(mesh.userData.nightMaterial.customProgramCacheKey()).toBe("berlin-planetarium-cladding-v378");
    }
    disposeStaticAudit(world);
    disposeStaticAudit(observatory);
    disposeStaticAudit(dome);
    shop.dispose(); shop.geometry.dispose(); shop.userData.dayMaterial.dispose(); shop.userData.nightMaterial.dispose();
  }
});

test("the real district stream publishes all thirty monuments in each edition", async () => {
  const directory = resolve(import.meta.dir, "../public/mesh/surrounding-berlin-v159");
  const parts: {id: string; drawn: {url: string}; minecraft: {url: string}}[] =
    JSON.parse(readFileSync(resolve(directory, "manifest.json"), "utf8")).chunks;
  const active: Set<string>[] = [];
  for (const mode of ["drawn", "minecraft"] as const) {
    const monuments = new Set<string>();
    const physicalBodies = new Set<string>();
    for (const id of index[mode]) {
      const url = parts.find(part => part.id === id)![mode].url;
      const input: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(resolve(directory, url))).toString("utf8"));
      const source = (await loadHistoricArchitectureV378(id, mode === "minecraft"))!;
      const owners = new Set([
        ...(source.shells?.tiles[id] ?? []).map(body => body.id),
        ...Object.values(source.facades.tiles).flat().map(front => front.id),
      ]);
      const streamed = await createStreamedSurroundingCityChunkV255(input, id, mode === "minecraft", {yield: async () => undefined});
      try {
        for (const owner of streamed.root.userData.surveyedShellOwnersV377 ?? []) {
          if (owners.has(owner)) {
            physicalBodies.add(owner);
            monuments.add(owner);
          }
        }
        streamed.root.traverse(child => {
          for (const front of child.userData.facadeOwnersV377 ?? []) {
            if (owners.has(front.id)) monuments.add(front.id);
          }
        });
      } finally {
        disposeSurroundingCityRoot(streamed.root);
      }
    }
    expect(physicalBodies.size).toBe(mode === "minecraft" ? 28 : 30);
    expect(monuments.size).toBe(30);
    active.push(monuments);
  }
  expect(active[1]).toEqual(active[0]);
}, 60_000);
