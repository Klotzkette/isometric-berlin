import { describe, expect, test } from "bun:test";
import { Box3, Mesh, Raycaster, Vector3 } from "three";
import { createDistantBuildingShells, createIsometricCity, PRISM_SUPPRESSED_IDS, type PrismPayload } from "../src/IsometricCityWorld";
import { createTipiAmKanzleramt, TIPI_AM_KANZLERAMT_PROFILE } from "../src/TipiAmKanzleramt";
import { createTipiSitePavilions } from "../src/TipiSitePavilions";
import { isMinecraftTipiReplacementColumn } from "../src/MinecraftTipiAmKanzleramt";
import { TIPI_SITE_PARTS, TIPI_SITE_PRISM_IDS, tipiSiteEnvelope } from "../src/tipiSiteProfile";

const source = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const byId = new Map(source.buildings.map((b) => [b.id, b]));
const center = (ring: readonly number[][]): [number, number] => [0, 1].map((axis) => ring.reduce((sum, p) => sum + p[axis] / 10, 0) / ring.length) as [number, number];

describe("TIPI source-bound site replacement", () => {
  test("keeps all twenty original records and replaces only their generic display masses", () => {
    expect(TIPI_SITE_PARTS).toHaveLength(20);
    for (const part of TIPI_SITE_PARTS) {
      const original = byId.get(part.prismId)!;
      expect(original.ring).toEqual(part.ringDm);
      expect(original.h_dm / 10).toBe(part.retainedSourceHeightM);
      expect(original.y0_dm / 10).toBe(part.groundY);
      expect(PRISM_SUPPRESSED_IDS.has(part.prismId)).toBe(true);
      expect(part.osmWay.endsWith(part.prismId)).toBe(true);
    }
    const parts = source.buildings.filter((b) => TIPI_SITE_PRISM_IDS.has(b.id));
    expect(createDistantBuildingShells(source, parts).children).toHaveLength(0);
    const detailed = createIsometricCity(source, null, null, null, { buildings: parts, includeContext: false });
    const body = detailed.getObjectByName("LoD2 prism buildings") as Mesh | undefined;
    expect(body?.geometry.attributes.position.count ?? 0).toBe(0);
  });

  test("preserves real containers, the Carillon and free gaps between exact source rings", () => {
    for (const id of ["58756205", "58756207", "K0002MQ0"]) {
      expect(TIPI_SITE_PRISM_IDS.has(id)).toBe(false);
      expect(isMinecraftTipiReplacementColumn(...center(byId.get(id)!.ring))).toBe(false);
    }
    for (const part of TIPI_SITE_PARTS) {
      expect(isMinecraftTipiReplacementColumn(...center(part.ringDm))).toBe(true);
    }
    expect(isMinecraftTipiReplacementColumn(-307, 80)).toBe(false);
    expect(isMinecraftTipiReplacementColumn(-322, 50)).toBe(false);
  });

  test("makes fallback-height satellite tents pointed and low on their mapped bases", () => {
    const pavilions = createTipiSitePavilions();
    pavilions.updateMatrixWorld(true);
    const roofAt = (x: number, z: number) => new Raycaster(new Vector3(x, 100, z), new Vector3(0, -1, 0)).intersectObject(pavilions, true)[0]?.point.y;
    for (const part of TIPI_SITE_PARTS.filter((p) => p.role === "pagoda" || p.role === "turret")) {
      const [x, z] = center(part.ringDm), first = part.ringDm[0];
      const envelope = tipiSiteEnvelope(part);
      expect(roofAt(x, z)).toBeCloseTo(part.groundY + envelope.peak, 4);
      const edgeX = x + (first[0] / 10 - x) * 0.9, edgeZ = z + (first[1] / 10 - z) * 0.9;
      expect(roofAt(edgeX, edgeZ)).toBeLessThan(part.groundY + envelope.peak - 1);
      if (part.role === "pagoda") expect(envelope.peak).toBeLessThan(part.retainedSourceHeightM);
    }
    expect(roofAt(-290.85, 28.4)).toBeUndefined();
  });

  test("keeps the eight-peak main canvas and faces the visible entrance north", () => {
    const tent = createTipiAmKanzleramt([-297.284, 3.98, 52.502]);
    tent.updateMatrixWorld(true);
    const roof = tent.getObjectByName("TIPI main peaked canvas roof")!;
    const size = new Box3().setFromObject(roof).getSize(new Vector3());
    expect(size.z).toBeCloseTo(TIPI_AM_KANZLERAMT_PROFILE.ellipseLengthM);
    expect(size.x).toBeCloseTo(TIPI_AM_KANZLERAMT_PROFILE.ellipseWidthM);
    const position = tent.getObjectByName("TIPI low dark-timber entrance hall")!.getWorldPosition(new Vector3());
    expect(position.z).toBeLessThan(20);
    expect(position.x).toBeCloseTo(-297.284);
    expect(tent.userData.mainRoofPeakCount).toBe(8);
    expect(tent.getObjectByName("TIPI two large side pavilions")).toBeUndefined();
  });
});
