import { describe, expect, test } from "bun:test";
import {
  BoxGeometry,
  Group,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  NoToneMapping,
  Vector3,
} from "three";

import {
  SCHWELLENRAUM_LICHTORTE,
  SCHWELLENRAUM_LIGHT_TONES,
  SCHWELLENRAUM_PRESENTATION_BUDGET,
  SCHWELLENRAUM_SCHUTZRAEUME,
  abstandZumNaechstenSchutzraum,
  createSchwellenraumPraesentation,
  isSchwellenraumGeschuetzt,
  schwellenraumObjektmodus,
  setSchwellenraumDatenSchutz,
  setSchwellenraumPraesentation,
} from "../src/visual-modes/schwellenraum/presentation";
import streetDetails from "../public/mesh/regierungsviertel/street-details.json";
import { UI_COPY } from "../src/localization";
import { PRESENTATION_TONE, isPaintFaithful } from "../src/presentationTone";
import type { StreetDetailsPayload } from "../src/TrafficSignals";
import { applyLightingToRoot } from "../src/ThreeViewer";
import { createSchwellenraumMemorialProtectionIndex } from "../src/schwellenraumMemorialProtection";
import { createCsdAttackMemorial } from "../src/CsdAttackMemorial";

const appSource = await Bun.file(new URL("../src/App.tsx", import.meta.url)).text();
const street = streetDetails as unknown as StreetDetailsPayload;

describe("Schwellenraum presentation", () => {
  test("uses the visible requested name in both interface languages", () => {
    expect(UI_COPY.de.schwellenraum).toBe("Schwellenraum");
    expect(UI_COPY.en.schwellenraum).toBe("Schwellenraum");
    expect(UI_COPY.de.visualModes).toContain("Schwellenraum");
    expect(UI_COPY.en.visualModes).toContain("Schwellenraum");
  });

  test("keeps the standard paint curve bit-faithful", () => {
    expect(PRESENTATION_TONE.schwellenraum).toEqual({
      exposure: 1,
      toneMapping: NoToneMapping,
    });
    expect(isPaintFaithful("schwellenraum")).toBeTrue();
  });

  test("protects complete memorial subtrees and leaves their transforms alone", () => {
    const memorial = new Group();
    memorial.name = "Denkmal für die ermordeten Juden Europas";
    memorial.position.set(462.88, 8, 557.37);
    memorial.rotation.set(0.02, 0.31, -0.01);
    memorial.scale.set(1, 1, 1);
    const dayMaterial = new MeshStandardMaterial({
      color: 0x8e8c88,
      emissive: 0x12100e,
      emissiveIntensity: 0.08,
      roughness: 0.94,
    });
    const nightMaterial = new MeshStandardMaterial({
      color: 0x46536b,
      emissive: 0x788bac,
      emissiveIntensity: 0.4,
      roughness: 0.94,
    });
    const body = new Mesh(new BoxGeometry(2.38, 3.7, 0.95), dayMaterial);
    body.name = "unnamed protected body";
    body.userData.dayMaterial = dayMaterial;
    body.userData.nightMaterial = nightMaterial;
    memorial.add(body);

    applyLightingToRoot(memorial, "day");

    const position = memorial.position.clone();
    const rotation = memorial.rotation.toArray();
    const scale = memorial.scale.clone();
    const material = body.material;
    const materialColor = material.color.getHex();
    const emissive = material.emissive.getHex();
    const emissiveIntensity = material.emissiveIntensity;

    applyLightingToRoot(memorial, "schwellenraum");

    expect(isSchwellenraumGeschuetzt(body)).toBeTrue();
    expect(schwellenraumObjektmodus("schwellenraum", body)).toBe("day");
    expect(memorial.position).toEqual(position);
    expect(memorial.rotation.toArray()).toEqual(rotation);
    expect(memorial.scale).toEqual(scale);
    expect(body.material).toBe(material);
    expect(material.color.getHex()).toBe(materialColor);
    expect(material.emissive.getHex()).toBe(emissive);
    expect(material.emissiveIntensity).toBe(emissiveIntensity);

    const ordinary = new Group();
    ordinary.name = "Charite entrance";
    expect(isSchwellenraumGeschuetzt(ordinary)).toBeFalse();
    expect(schwellenraumObjektmodus("schwellenraum", ordinary)).toBe(
      "schwellenraum",
    );
  });

  test("keeps the separate CSD attack memorial on exact Day presentation", () => {
    const memorial = createCsdAttackMemorial();
    expect(memorial.name).toBe("Gedenkstelle CSD-Attentat vom 25.7.2026");
    expect(memorial.userData.schwellenraumGeschuetzt).toBeTrue();
    memorial.traverse((object) => {
      expect(isSchwellenraumGeschuetzt(object), object.name).toBeTrue();
      expect(schwellenraumObjektmodus("schwellenraum", object)).toBe("day");
    });
  });

  test("keeps every additive light threshold outside all quiet zones", () => {
    expect(SCHWELLENRAUM_SCHUTZRAEUME.length).toBeGreaterThanOrEqual(17);
    expect(SCHWELLENRAUM_LICHTORTE.length).toBeGreaterThanOrEqual(4);
    for (const place of SCHWELLENRAUM_LICHTORTE) {
      expect(
        abstandZumNaechstenSchutzraum(place.x, place.z),
        place.name,
      ).toBeGreaterThan(35);
    }
  });

  test("also keeps light thresholds outside the complete source-driven protection set", () => {
    const protection = createSchwellenraumMemorialProtectionIndex(
      street.monuments,
    );
    const root = createSchwellenraumPraesentation();
    expect(setSchwellenraumDatenSchutz(root, protection)).toBeFalse();
    const lightPlaces = root.children.filter(
      (child) => child.userData.schwellenraumPraesentation === true,
    );
    for (const child of lightPlaces) {
      expect(child.visible, child.name).toBeTrue();
      expect(child.userData.datenSchutzAktiv, child.name).toBeFalse();
      expect(child.userData.datenSchutzabstandM, child.name).toBeGreaterThan(
        child.userData.schutzradiusM + 2,
      );
    }

    const firstLight = SCHWELLENRAUM_LICHTORTE[0];
    const protectedEntry = street.monuments!.find(
      (entry) => entry.schwellenraum_protected,
    )!;
    const futureProtection = createSchwellenraumMemorialProtectionIndex([
      {
        ...protectedEntry,
        osm_id: "future-protected-light-site",
        osm_key: "node/future-protected-light-site",
        x_dm: Math.round(firstLight.x * 10),
        z_dm: Math.round(firstLight.z * 10),
      },
    ]);
    expect(setSchwellenraumDatenSchutz(root, futureProtection)).toBeTrue();
    expect(root.children[0].visible).toBeFalse();
    expect(root.children[0].userData.datenSchutzAktiv).toBeTrue();
  });

  test("builds a deterministic pastel light layer without moving the city", () => {
    const root = createSchwellenraumPraesentation();
    expect(root.visible).toBeFalse();
    const lightPlaces = root.children.filter(
      (child) => child.userData.schwellenraumPraesentation === true,
    );
    expect(lightPlaces).toHaveLength(SCHWELLENRAUM_LICHTORTE.length);
    expect(root.children).toHaveLength(SCHWELLENRAUM_LICHTORTE.length + 1);
    expect(root.userData.standardstadtBleibtUnveraendert).toBeTrue();
    expect(root.userData.tonfolge).toHaveLength(SCHWELLENRAUM_LIGHT_TONES.length);
    for (const [index, child] of lightPlaces.entries()) {
      const profile = SCHWELLENRAUM_LICHTORTE[index];
      expect(child.position).toEqual(new Vector3(profile.x, 0.12, profile.z));
      expect(child.userData.schwellenraumPraesentation).toBeTrue();
      expect(child.userData.schutzabstandM).toBeGreaterThan(35);
      expect(child.userData.uncannyFrameShearM).toBeGreaterThan(0);
      expect(child.userData.dreamcoreCorridorFrameCount).toBe(3);
      expect(child.userData.veilLayerCount).toBe(3);
    }

    expect(setSchwellenraumPraesentation(root, "schwellenraum", false)).toBeTrue();
    expect(root.visible).toBeTrue();
    expect(setSchwellenraumPraesentation(root, "schwellenraum", false)).toBeFalse();
    expect(setSchwellenraumPraesentation(root, "schwellenraum", true)).toBeTrue();
    expect(root.visible).toBeFalse();
    expect(setSchwellenraumPraesentation(root, "day", false)).toBeFalse();
  });

  test("keeps the richer threshold atmosphere inside fixed desktop and mobile budgets", () => {
    let fullVertices = 0;
    let mobileVertices = 0;
    for (const detailProfile of ["full", "mobile"] as const) {
      const root = createSchwellenraumPraesentation(detailProfile);
      const geometries = new Set();
      const materials = new Set();
      let objects = 0;
      let renderables = 0;
      let vertices = 0;
      root.traverse((object) => {
        objects += 1;
        if (!(object instanceof Mesh) && !(object instanceof LineSegments)) {
          return;
        }
        renderables += 1;
        geometries.add(object.geometry);
        vertices += object.geometry.getAttribute("position").count;
        const assigned = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of assigned) materials.add(material);
      });
      const budget = SCHWELLENRAUM_PRESENTATION_BUDGET[detailProfile];
      expect(root.userData.renderBudget).toBe(budget);
      expect(objects).toBeLessThanOrEqual(budget.objects);
      expect(renderables).toBeLessThanOrEqual(budget.renderables);
      expect(geometries.size).toBeLessThanOrEqual(budget.geometries);
      expect(materials.size).toBeLessThanOrEqual(budget.materials);
      expect(vertices).toBeLessThanOrEqual(budget.vertices);
      expect(
        root.children
          .filter(
            (place) => place.userData.schwellenraumPraesentation === true,
          )
          .every((place) => place.children.length === 3),
      ).toBe(true);
      if (detailProfile === "full") fullVertices = vertices;
      else mobileVertices = vertices;
    }
    expect(fullVertices).toBe(5_613);
    expect(mobileVertices).toBe(4_269);
    expect(mobileVertices).toBeLessThan(fullVertices);
  });

  test("opens the spatial mode in 3D and never repaints the source map", () => {
    expect(appSource).toContain('if (next === "schwellenraum")');
    expect(appSource).toContain('setViewerMode("three")');
    expect(appSource).not.toContain("map-schwellenraum");
  });
});
