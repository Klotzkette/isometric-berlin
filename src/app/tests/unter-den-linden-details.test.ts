import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  Box3,
  BufferGeometry,
  Group,
  InstancedMesh,
  Mesh,
} from "three";

import { FINE_DETAIL_LAYER_NAMES } from "../src/fineDetailFade";
import { createMinecraftUnterDenLindenDetails } from "../src/MinecraftUnterDenLindenDetails";
import { createUnterDenLindenDetails } from "../src/UnterDenLindenDetails";
import {
  MINECRAFT_UNTER_DEN_LINDEN_GROUP_NAME,
  UNTER_DEN_LINDEN_DETAILS_GROUP_NAME,
  UNTER_DEN_LINDEN_DETAILS_PROFILE,
  UNTER_DEN_LINDEN_FINE_LAYER_NAME,
} from "../src/unterDenLindenProfiles";

function budget(root: Group): {
  bytes: number;
  draws: number;
  instances: number;
} {
  const geometries = new Set<BufferGeometry>();
  let bytes = 0;
  let draws = 0;
  let instances = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    draws += 1;
    expect(object.matrixAutoUpdate).toBeFalse();
    expect(object.frustumCulled).toBeTrue();
    expect(object.userData.dayMaterial.map).toBeNull();
    expect(object.userData.nightMaterial.map).toBeNull();
    if (!geometries.has(object.geometry)) {
      geometries.add(object.geometry);
      for (const attribute of Object.values(object.geometry.attributes)) {
        bytes += attribute.array.byteLength;
        expect(Array.from(attribute.array).every(Number.isFinite)).toBeTrue();
      }
      bytes += object.geometry.index?.array.byteLength ?? 0;
    }
    if (object instanceof InstancedMesh) {
      expect(object.instanceColor?.count).toBe(object.count);
      bytes += object.instanceMatrix.array.byteLength;
      bytes += object.instanceColor?.array.byteLength ?? 0;
      instances += object.count;
    }
  });
  return { bytes, draws, instances };
}

describe("source-bound Unter den Linden recognition details", () => {
  test("pins every requested address to committed OSM and Berlin LoD2 evidence", () => {
    const buildings = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings;
    expect(buildings.britishEmbassy).toMatchObject({
      osmKey: "relation/24516",
      lod2Parent: "DEBE01YYK00001KP",
      lod2MainPart: "DEBE3DzLVkos5eqV",
    });
    expect(buildings.russianEmbassy).toMatchObject({
      osmKey: "node/514864739",
      lod2Parent: "DEBE01YYK00003En",
      anchorWorldM: [793.37, 5.2, 331.555],
      sourceHeightM: 30.318,
    });
    expect(buildings.russianEmbassy.streetFacade.outwardSide).toBe(-1);
    expect(buildings.russianEmbassy.lod2PartIds).toHaveLength(4);
    expect(buildings.aeroflot).toMatchObject({
      osmKey: "way/195071820",
      lod2Parent: "DEBE01YYK00001vY",
      sourceHeightM: 19.606,
    });
    expect(buildings.aeroflot.streetFacade.outwardSide).toBe(-1);
    expect(buildings.einstein).toMatchObject({
      osmKey: "node/1412218896",
      lod2Parent: "DEBE01YYK0000A6r",
      sourceHeightM: 28.178,
    });
    expect(buildings.einstein.streetFacade.outwardSide).toBe(-1);
    expect(buildings.dussmann).toMatchObject({
      osmKey: "node/1665158255",
      lod2Parent: "DEBE01YYK00002Es",
      sourceHeightM: 32.411,
    });
    expect(buildings.dussmann.eastFacade.outwardSide).toBe(1);
    expect(buildings.dussmann.southFacade.outwardSide).toBe(-1);
    expect(UNTER_DEN_LINDEN_DETAILS_PROFILE.photographsBundled).toBeFalse();
    expect(UNTER_DEN_LINDEN_DETAILS_PROFILE.textureFree).toBeTrue();
  });

  test("keeps persistent structures separate from close-only signs and mullions", () => {
    const root = createUnterDenLindenDetails();
    expect(root.name).toBe(UNTER_DEN_LINDEN_DETAILS_GROUP_NAME);
    expect(root.userData.buildingCount).toBe(5);
    for (const name of [
      "Russian Embassy source-bound facade",
      "Aeroflot and Trade Mission source-bound facade",
      "Haus Pietzsch and Einstein source-bound facade",
      "Dussmann KulturKaufhaus source-bound facade",
    ]) {
      expect(root.getObjectByName(name)).toBeDefined();
    }
    const fine = root.getObjectByName(UNTER_DEN_LINDEN_FINE_LAYER_NAME)!;
    expect(fine.userData.detailFadeM).toEqual([420, 700]);
    expect(FINE_DETAIL_LAYER_NAMES).toContain(
      UNTER_DEN_LINDEN_FINE_LAYER_NAME,
    );
    expect(FINE_DETAIL_LAYER_NAMES).not.toContain(
      UNTER_DEN_LINDEN_DETAILS_GROUP_NAME,
    );
    const bounds = new Box3().setFromObject(root);
    expect(bounds.min.x).toBeGreaterThan(790);
    expect(bounds.max.x).toBeGreaterThan(1215);
    expect(bounds.max.y).toBeGreaterThan(40);
  });

  test("adds hundreds of facade cues within a small texture-free GPU budget", () => {
    const stats = budget(createUnterDenLindenDetails());
    expect(stats.draws).toBe(10);
    expect(stats.instances).toBeGreaterThan(600);
    expect(stats.instances).toBe(1_649);
    expect(stats.bytes).toBeLessThan(180_000);
  });

  test("keeps the runtime model free of reference photographs and image loaders", () => {
    const source = readFileSync(
      new URL("../src/UnterDenLindenDetails.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/TextureLoader|CanvasTexture|\.jpe?g|\.png/i);
    expect(source).toContain("letteringStrokePaths");
  });

  test("uses one facade-only Minecraft batch for all five buildings", () => {
    const root = createMinecraftUnterDenLindenDetails();
    expect(root.name).toBe(MINECRAFT_UNTER_DEN_LINDEN_GROUP_NAME);
    expect(root.userData.keepInMinecraft).toBeTrue();
    expect(root.userData.facadeOnly).toBeTrue();
    expect(root.children).toHaveLength(1);
    const stats = budget(root);
    expect(stats.draws).toBe(1);
    expect(stats.instances).toBeGreaterThan(280);
    expect(stats.instances).toBeLessThan(500);
    expect(stats.bytes).toBeLessThan(50_000);
    expect(
      (root.children[0] as InstancedMesh).geometry.getAttribute("position").count,
    ).toBe(24);
  });
});
