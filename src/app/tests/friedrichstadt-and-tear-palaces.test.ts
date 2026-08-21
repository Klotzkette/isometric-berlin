import { describe, expect, test } from "bun:test";
import {
  Box3,
  InstancedMesh,
  Material,
  Mesh,
  MeshBasicMaterial,
  Texture,
  Vector3,
} from "three";

import { createCentralCivicDetails } from "../src/CentralCivicDetails";
import {
  FRIEDRICHSTADT_PALAST_FOOTPRINT_WORLD,
  FRIEDRICHSTADT_PALAST_GLASS_LAYER_NAME,
  FRIEDRICHSTADT_PALAST_PROFILE,
  FRIEDRICHSTADT_PALAST_ROOT_NAME,
  FRIEDRICHSTADT_PALAST_SIGN_LAYER_NAME,
  PALACE_DETAIL_RENDER_BUDGETS,
  TEAR_PALACE_FOOTPRINT_WORLD,
  TEAR_PALACE_GLASS_LAYER_NAME,
  TEAR_PALACE_MULLION_LAYER_NAME,
  TEAR_PALACE_PRISM_IDS,
  TEAR_PALACE_PROFILE,
  TEAR_PALACE_ROOT_NAME,
  createFriedrichstadtAndTearPalaces,
  palaceRenderStats,
} from "../src/FriedrichstadtAndTearPalaces";
import { PRISM_SUPPRESSED_IDS } from "../src/IsometricCityWorld";

const viewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
).text();
const modelSource = await Bun.file(
  new URL("../src/FriedrichstadtAndTearPalaces.ts", import.meta.url),
).text();

function materialTextures(material: Material): Texture[] {
  return Object.values(
    material as unknown as Record<string, unknown>,
  ).filter((value): value is Texture => value instanceof Texture);
}

describe("Friedrichstadt-Palast and Tränenpalast recognition details", () => {
  test("pins the Palast massing and facade grammar to OSM and official primary facts", () => {
    expect(FRIEDRICHSTADT_PALAST_PROFILE).toMatchObject({
      baseY: 5.2,
      facade: {
        fieldCounts: { full: 9, mobile: 5 },
        officialGlassBlockCount: 22_500,
        structuralGridM: 6,
      },
      officialEnvelopeM: {
        height: 20,
        length: 110,
        stageTowerHeight: 32,
        stageTowerWidth: 23,
        width: 80,
      },
      osmWayId: "24314976",
      runtimeAssets: [],
      shippedContextPrismId: "24314976",
    });
    expect(FRIEDRICHSTADT_PALAST_FOOTPRINT_WORLD).toHaveLength(18);
    expect(
      FRIEDRICHSTADT_PALAST_PROFILE.sourceUrls.every((url) =>
        url.startsWith("https://"),
      ),
    ).toBeTrue();

    const full = createFriedrichstadtAndTearPalaces("full");
    const palast = full.getObjectByName(FRIEDRICHSTADT_PALAST_ROOT_NAME)!;
    expect(palast.userData).toMatchObject({
      detailProfile: "full",
      sourceBound: true,
      textureFree: true,
    });
    const bounds = new Box3().setFromObject(palast);
    const size = bounds.getSize(new Vector3());
    expect(size.x).toBeGreaterThan(110);
    expect(size.x).toBeLessThan(116);
    expect(size.z).toBeGreaterThan(83);
    expect(size.z).toBeLessThan(88);
    expect(bounds.min.y).toBeCloseTo(5.2, 1);
    expect(bounds.max.y - 5.2).toBeCloseTo(32.24, 1);

    const glass = palast.getObjectByName(
      FRIEDRICHSTADT_PALAST_GLASS_LAYER_NAME,
    ) as InstancedMesh;
    expect(glass).toBeInstanceOf(InstancedMesh);
    expect(glass.count).toBe(9);
    expect(glass.instanceColor).not.toBeNull();
    expect(glass.userData).toMatchObject({
      officialGlassBlockCount: 22_500,
      proceduralAggregate: true,
      textureFree: true,
    });
    const sign = palast.getObjectByName(
      FRIEDRICHSTADT_PALAST_SIGN_LAYER_NAME,
    ) as InstancedMesh;
    expect(sign).toBeInstanceOf(InstancedMesh);
    expect(sign.count).toBeGreaterThan(220);
    expect(sign.userData).toMatchObject({
      proceduralGlyphGrid: [5, 7],
      text: "FRIEDRICHSTADT-PALAST",
      textureFree: true,
    });
  });

  test("keeps the Tränenpalast a separate low transparent steel-glass pavilion", () => {
    expect(TEAR_PALACE_PROFILE).toMatchObject({
      baseY: 2.85,
      envelopeHeightM: 7.35,
      footprintWorld: TEAR_PALACE_FOOTPRINT_WORLD,
      osmWayId: "43173495",
      prismIds: TEAR_PALACE_PRISM_IDS,
      runtimeAssets: [],
    });
    expect(TEAR_PALACE_FOOTPRINT_WORLD).toHaveLength(12);
    for (const id of TEAR_PALACE_PRISM_IDS) {
      expect(PRISM_SUPPRESSED_IDS.has(id)).toBeTrue();
    }

    const root = createFriedrichstadtAndTearPalaces("full");
    const pavilion = root.getObjectByName(TEAR_PALACE_ROOT_NAME)!;
    const panes = pavilion.getObjectByName(
      TEAR_PALACE_GLASS_LAYER_NAME,
    ) as InstancedMesh;
    const mullions = pavilion.getObjectByName(
      TEAR_PALACE_MULLION_LAYER_NAME,
    ) as InstancedMesh;
    expect(panes).toBeInstanceOf(InstancedMesh);
    expect(mullions).toBeInstanceOf(InstancedMesh);
    expect(panes.count).toBeGreaterThan(35);
    expect(mullions.count).toBeGreaterThan(35);
    expect((panes.material as MeshBasicMaterial).transparent).toBeTrue();
    expect((panes.material as MeshBasicMaterial).opacity).toBeLessThan(0.5);
    const bounds = new Box3().setFromObject(pavilion);
    const size = bounds.getSize(new Vector3());
    expect(size.x).toBeGreaterThan(34);
    expect(size.x).toBeLessThan(37);
    expect(size.y).toBeLessThan(7.8);
    expect(size.z).toBeGreaterThan(38);
    expect(size.z).toBeLessThan(41);
    expect(bounds.max.y).toBeLessThan(11);
  });

  test("uses no canvas, photo or runtime texture in either model", () => {
    expect(modelSource).not.toContain("CanvasTexture");
    expect(modelSource).not.toContain("createLetteringTexture");
    expect(modelSource).not.toContain('createElement("canvas")');
    const root = createFriedrichstadtAndTearPalaces("full");
    expect(root.userData).toMatchObject({
      runtimeAssets: [],
      textureFree: true,
    });
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      expect(object.geometry.getAttribute("uv")).toBeUndefined();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        expect(materialTextures(material)).toHaveLength(0);
      }
      for (const material of [
        object.userData.dayMaterial,
        object.userData.nightMaterial,
      ]) {
        if (material instanceof Material) {
          expect(materialTextures(material)).toHaveLength(0);
        }
      }
    });
  });

  test("selects and freezes separate full/mobile render budgets", () => {
    const full = createFriedrichstadtAndTearPalaces("full");
    const mobile = createFriedrichstadtAndTearPalaces("mobile");
    const fullStats = palaceRenderStats(full);
    const mobileStats = palaceRenderStats(mobile);
    const fullBudget = PALACE_DETAIL_RENDER_BUDGETS.full;
    const mobileBudget = PALACE_DETAIL_RENDER_BUDGETS.mobile;
    expect(full.userData.performanceBudget).toBe(fullBudget);
    expect(mobile.userData.performanceBudget).toBe(mobileBudget);
    expect(fullStats.renderables).toBeLessThanOrEqual(
      fullBudget.maxRenderables,
    );
    expect(fullStats.storedVertices).toBeLessThanOrEqual(
      fullBudget.maxStoredVertices,
    );
    expect(fullStats.renderedVertices).toBeLessThanOrEqual(
      fullBudget.maxRenderedVertices,
    );
    expect(fullStats.instanceCount).toBeLessThanOrEqual(
      fullBudget.maxInstances,
    );
    expect(mobileStats.renderables).toBeLessThanOrEqual(
      mobileBudget.maxRenderables,
    );
    expect(mobileStats.storedVertices).toBeLessThanOrEqual(
      mobileBudget.maxStoredVertices,
    );
    expect(mobileStats.renderedVertices).toBeLessThanOrEqual(
      mobileBudget.maxRenderedVertices,
    );
    expect(mobileStats.instanceCount).toBeLessThanOrEqual(
      mobileBudget.maxInstances,
    );
    expect(mobileStats.renderedVertices).toBeLessThan(
      fullStats.renderedVertices,
    );
    expect(mobileStats.instanceCount).toBeLessThan(fullStats.instanceCount);

    const defaultCentral = createCentralCivicDetails([]);
    const mobileCentral = createCentralCivicDetails([], "mobile");
    expect(defaultCentral.userData.detailProfile).toBe("full");
    expect(mobileCentral.userData.detailProfile).toBe("mobile");
    expect(
      mobileCentral.getObjectByName(FRIEDRICHSTADT_PALAST_GLASS_LAYER_NAME),
    ).toMatchObject({ count: 5 });
    expect(viewerSource).toContain(
      'runtime.coarsePointer ? "mobile" : "full"',
    );
  });
});
