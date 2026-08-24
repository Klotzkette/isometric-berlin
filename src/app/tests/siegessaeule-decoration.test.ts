import { describe, expect, test } from "bun:test";
import {
  Box3,
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";

import {
  createSiegessaeule,
  setIsoNightPresentation,
} from "../src/IsometricCityWorld";
import { createMinecraftExtrapolatedWorld } from "../src/MinecraftVoxelWorld";
import {
  SIEGESSAEULE_BRONZE_TONES,
  SIEGESSAEULE_MOSAIC_TONES,
  SIEGESSAEULE_PROFILE,
} from "../src/SiegessaeuleProfile";
import { AXIS_FROM, AXIS_TO } from "../src/worldEnvelope";
import wikimediaAttribution from "../public/dzi/regierungsviertel/wikimedia_attribution.json";

function namedMesh(root: ReturnType<typeof createSiegessaeule>, name: string) {
  const mesh = root.getObjectByName(name);
  expect(mesh).toBeInstanceOf(Mesh);
  return mesh as Mesh;
}

function namedInstances(
  root: ReturnType<typeof createMinecraftExtrapolatedWorld>,
  name: string,
) {
  const mesh = root.getObjectByName(name);
  expect(mesh).toBeInstanceOf(InstancedMesh);
  return mesh as InstancedMesh;
}

function uniqueGeometryColours(mesh: Mesh): Set<string> {
  const attribute = mesh.geometry.getAttribute("color");
  const colours = new Set<string>();
  for (let index = 0; index < attribute.count; index += 1) {
    colours.add(
      `${attribute.getX(index).toFixed(4)}:${attribute
        .getY(index)
        .toFixed(4)}:${attribute.getZ(index).toFixed(4)}`,
    );
  }
  return colours;
}

function uniqueInstanceColours(mesh: InstancedMesh): Set<string> {
  const attribute = mesh.instanceColor;
  expect(attribute).not.toBeNull();
  const colours = new Set<string>();
  if (!attribute) return colours;
  for (let index = 0; index < attribute.count; index += 1) {
    colours.add(
      `${attribute.getX(index).toFixed(4)}:${attribute
        .getY(index)
        .toFixed(4)}:${attribute.getZ(index).toFixed(4)}`,
    );
  }
  return colours;
}

function colourKey(value: number): string {
  const colour = new Color(value);
  return `${colour.r.toFixed(4)}:${colour.g.toFixed(4)}:${colour.b.toFixed(4)}`;
}

describe("the source-bounded lower Siegessäule registers", () => {
  test("records authoritative metrics and freely licensed reference-only views", () => {
    expect(SIEGESSAEULE_PROFILE.heightM).toBe(67);
    expect(SIEGESSAEULE_PROFILE.base.widthM).toBe(25.3);
    expect(SIEGESSAEULE_PROFILE.colonnade.diameterM).toBe(15.7);
    expect(SIEGESSAEULE_PROFILE.colonnade.columnCount).toBe(16);
    expect(SIEGESSAEULE_PROFILE.colonnade.columnHeightM).toBe(4.7);
    expect(SIEGESSAEULE_PROFILE.reliefs.count).toBe(4);
    expect(SIEGESSAEULE_PROFILE.viktoria).toMatchObject({
      castPartCount: 17,
      gilding: "gold leaf on oil ground",
      heightM: 8.32,
      shoeLengthM: 0.92,
      weightT: 35,
    });
    expect(SIEGESSAEULE_PROFILE.viktoria.recognitionCues).toHaveLength(5);
    expect(SIEGESSAEULE_PROFILE.viktoria.recognitionCues).toContain(
      "two layered feathered wings",
    );
    expect(SIEGESSAEULE_PROFILE.reliefs.architecturalLevel).toContain(
      "lower square red-granite base",
    );
    expect(SIEGESSAEULE_PROFILE.mosaic.architecturalLevel).toContain(
      "inside the circular colonnaded hall above the square base",
    );
    expect(SIEGESSAEULE_PROFILE.sourceUrls[0]).toContain(
      "denkmaldatenbank.berlin.de",
    );
    expect(SIEGESSAEULE_PROFILE.sourceUrls).toContain(
      "https://bildhauerei-in-berlin.de/bildwerk/siegessaeule-4706/",
    );
    expect(
      SIEGESSAEULE_PROFILE.visualReferences.map((reference) =>
        reference.license,
      ),
    ).toEqual(["CC0", "CC BY-SA 4.0"]);
    for (const reference of SIEGESSAEULE_PROFILE.visualReferences) {
      expect(reference.geometryStatus).toContain(
        "not used as a runtime texture",
      );
      expect(reference.pageUrl).toStartWith(
        "https://commons.wikimedia.org/wiki/File%3A",
      );
    }
  });

  test("keeps the profile and public attribution synchronized with pinned Commons records", () => {
    const publicRecords = wikimediaAttribution.records.filter(
      (record) => record.landmark_id === "siegessaeule",
    );
    expect(publicRecords).toHaveLength(2);
    expect(
      publicRecords.map(({ artist, license, license_url, page_url, title }) => ({
        artist,
        license,
        licenseUrl: license_url,
        pageUrl: page_url,
        title: title.replace(/^File:/, ""),
      })),
    ).toEqual(
      SIEGESSAEULE_PROFILE.visualReferences.map(
        ({ artist, license, licenseUrl, pageUrl, title }) => ({
          artist,
          license,
          licenseUrl,
          pageUrl,
          title,
        }),
      ),
    );
  });

  test("derives an exact 67 m rendered stack with a 4.7 m colonnade", () => {
    const monument = createSiegessaeule();
    const bounds = new Box3().setFromObject(monument);
    const metrics = monument.userData.lowerRegisterMetrics as {
      colonnadeColumnHeightM: number;
      groundTopY: number;
      renderedHeightM: number;
      renderedTopY: number;
    };

    expect(metrics.colonnadeColumnHeightM).toBeCloseTo(4.7, 8);
    expect(metrics.renderedHeightM).toBe(67);
    expect(metrics.renderedTopY - metrics.groundTopY).toBe(67);
    expect(bounds.max.y).toBeCloseTo(metrics.renderedTopY, 5);
    expect(bounds.max.y - metrics.groundTopY).toBeCloseTo(67, 5);
  });

  test("keeps actual Day and Minecraft top bounds on the same 67 m profile", () => {
    const monument = createSiegessaeule();
    const dayMetrics = monument.userData.lowerRegisterMetrics as {
      groundTopY: number;
    };
    const dayHeight =
      new Box3().setFromObject(monument).max.y - dayMetrics.groundTopY;

    const world = createMinecraftExtrapolatedWorld();
    const voxelColumn = namedInstances(world, "Voxel extrapolated Siegessäule");
    const voxelBounds = new Box3().setFromObject(voxelColumn);
    const voxelHeight =
      voxelBounds.max.y - (voxelColumn.userData.groundTopY as number);

    expect(dayHeight).toBeCloseTo(SIEGESSAEULE_PROFILE.heightM, 5);
    expect(voxelHeight).toBeCloseTo(SIEGESSAEULE_PROFILE.heightM, 5);
    expect(voxelBounds.max.y).toBeCloseTo(
      voxelColumn.userData.renderedTopY as number,
      5,
    );
    expect(dayHeight).toBeCloseTo(voxelHeight, 5);
  });

  test("keeps bronze reliefs below the colonnade mosaic on the correct faces", () => {
    const monument = createSiegessaeule();
    const reliefs = namedMesh(
      monument,
      "Siegessäule lower bronze relief bodies",
    );
    const mosaic = namedMesh(
      monument,
      "Siegessäule Anton von Werner glass mosaic bodies",
    );
    const reliefBounds = new Box3().setFromObject(reliefs);
    const mosaicBounds = new Box3().setFromObject(mosaic);
    const metrics = monument.userData.lowerRegisterMetrics as {
      baseTopY: number;
      bronzeReliefCount: number;
      colonnadeColumnCount: number;
      mosaicColourFieldCount: number;
      mosaicFigureCueCount: number;
    };

    expect(metrics.bronzeReliefCount).toBe(4);
    expect(metrics.colonnadeColumnCount).toBe(16);
    expect(metrics.mosaicColourFieldCount).toBe(32);
    expect(metrics.mosaicFigureCueCount).toBe(24);
    expect(reliefBounds.max.y).toBeLessThan(metrics.baseTopY);
    expect(mosaicBounds.min.y).toBeGreaterThan(metrics.baseTopY);
    expect(reliefBounds.max.y).toBeLessThan(mosaicBounds.min.y);

    // Four thin inset fields reach all four faces of the rotated 25.3 m base.
    const dx = AXIS_TO[0] - AXIS_FROM[0];
    const dz = AXIS_TO[1] - AXIS_FROM[1];
    const length = Math.hypot(dx, dz);
    const axis = [dx / length, dz / length] as const;
    const across = [-axis[1], axis[0]] as const;
    const position = reliefs.geometry.getAttribute("position");
    let minAlong = Infinity;
    let maxAlong = -Infinity;
    let minAcross = Infinity;
    let maxAcross = -Infinity;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index) - AXIS_TO[0];
      const z = position.getZ(index) - AXIS_TO[1];
      const along = x * axis[0] + z * axis[1];
      const acrossDistance = x * across[0] + z * across[1];
      minAlong = Math.min(minAlong, along);
      maxAlong = Math.max(maxAlong, along);
      minAcross = Math.min(minAcross, acrossDistance);
      maxAcross = Math.max(maxAcross, acrossDistance);
    }
    expect(maxAlong - minAlong).toBeCloseTo(25.74, 1);
    expect(maxAcross - minAcross).toBeCloseTo(25.74, 1);
    // The mosaic stays on the inner shaft, behind the 15.7 m colonnade.
    expect(mosaicBounds.max.x - AXIS_TO[0]).toBeLessThan(7.85);
    expect(AXIS_TO[0] - mosaicBounds.min.x).toBeLessThan(7.85);
    expect(mosaicBounds.max.z - AXIS_TO[1]).toBeLessThan(7.85);
    expect(AXIS_TO[1] - mosaicBounds.min.z).toBeLessThan(7.85);
  });

  test("suggests polychrome glass and bronze relief without any image texture", () => {
    const monument = createSiegessaeule();
    const reliefs = namedMesh(
      monument,
      "Siegessäule lower bronze relief bodies",
    );
    const mosaic = namedMesh(
      monument,
      "Siegessäule Anton von Werner glass mosaic bodies",
    );

    expect(uniqueGeometryColours(reliefs).size).toBe(2);
    expect(uniqueGeometryColours(mosaic).size).toBeGreaterThanOrEqual(
      SIEGESSAEULE_MOSAIC_TONES.length,
    );
    expect(reliefs.userData.textureFree).toBe(true);
    expect(mosaic.userData.textureFree).toBe(true);
    expect((reliefs.material as MeshBasicMaterial).map).toBeNull();
    expect((mosaic.material as MeshBasicMaterial).map).toBeNull();
    expect(
      (reliefs.userData.nightMaterial as MeshStandardMaterial).map,
    ).toBeNull();
    expect(
      (mosaic.userData.nightMaterial as MeshStandardMaterial).map,
    ).toBeNull();
  });

  test("uses two merged static detail draws and never rebuilds them on relight", () => {
    const monument = createSiegessaeule();
    const bodies = namedMesh(monument, "Siegessäule and Bismarck bodies");
    const goldelse = namedMesh(monument, "Goldelse gilded Viktoria bodies");
    const reliefs = namedMesh(
      monument,
      "Siegessäule lower bronze relief bodies",
    );
    const mosaic = namedMesh(
      monument,
      "Siegessäule Anton von Werner glass mosaic bodies",
    );
    const detailMeshes = monument.children.filter(
      (child) => child.userData.staticDecoration === true,
    );
    expect(detailMeshes).toHaveLength(2);
    expect(reliefs.geometry.getAttribute("position").count).toBeLessThan(1500);
    expect(mosaic.geometry.getAttribute("position").count).toBeLessThan(4000);

    const geometry = mosaic.geometry;
    const positions = mosaic.geometry.getAttribute("position");
    const matrix = mosaic.matrix.clone();
    const dayMaterial = mosaic.material;
    const bodyGeometry = bodies.geometry;
    const goldelseGeometry = goldelse.geometry;
    const goldelseDayMaterial = goldelse.material;
    const goldelseNightMaterial = goldelse.userData
      .nightMaterial as MeshBasicMaterial;
    const metrics = monument.userData.lowerRegisterMetrics as {
      renderedTopY: number;
    };
    for (const [night, mode] of [
      [true, "night"],
      [false, "snowstorm"],
      [false, "schwellenraum"],
      [false, "day"],
    ] as const) {
      setIsoNightPresentation(monument, night, true, mode);
      expect(mosaic.geometry).toBe(geometry);
      expect(mosaic.geometry.getAttribute("position")).toBe(positions);
      expect(mosaic.matrix.equals(matrix)).toBe(true);
      expect(mosaic.visible).toBe(true);
      expect(mosaic.userData.animated).toBe(false);
      expect(bodies.geometry).toBe(bodyGeometry);
      expect(goldelse.geometry).toBe(goldelseGeometry);
      expect(goldelse.material).toBe(
        mode === "night" ? goldelseNightMaterial : goldelseDayMaterial,
      );
      expect(new Box3().setFromObject(monument).max.y).toBeCloseTo(
        metrics.renderedTopY,
        5,
      );
    }
    expect(mosaic.material).toBe(dayMaterial);
  });

  test("keeps the complete Goldelse in one bright texture-free material draw", () => {
    const monument = createSiegessaeule();
    const goldelse = namedMesh(monument, "Goldelse gilded Viktoria bodies");
    const day = goldelse.userData.dayMaterial as MeshBasicMaterial;
    const night = goldelse.userData.nightMaterial as MeshBasicMaterial;

    expect(goldelse.material).toBe(day);
    expect(day.vertexColors).toBe(true);
    expect(day.map).toBeNull();
    expect(night.vertexColors).toBe(true);
    expect(night.map).toBeNull();
    expect(night.color.getHex()).toBe(0xffefc2);
    expect(goldelse.userData.schwellenraumGeschuetzt).toBe(true);
    expect(goldelse.geometry.getAttribute("position").count).toBe(7_758);
    expect(
      monument.children.filter(
        (child) => child.name === "Goldelse gilded Viktoria bodies",
      ),
    ).toHaveLength(1);
  });

  test("adds four lower bronze panels and an upper mosaic behind the voxel colonnade", () => {
    const world = createMinecraftExtrapolatedWorld();
    const reliefs = namedInstances(
      world,
      "Voxel Siegessäule lower bronze relief panels",
    );
    const band = namedInstances(
      world,
      "Voxel Siegessäule glass mosaic colour band",
    );
    const colonnade = namedInstances(
      world,
      "Voxel Siegessäule upper colonnade",
    );
    expect(reliefs.count).toBe(4);
    expect(band.count).toBe(16);
    expect(colonnade.count).toBe(16);
    expect(uniqueInstanceColours(reliefs)).toEqual(
      new Set([
        colourKey(SIEGESSAEULE_BRONZE_TONES.field),
        colourKey(SIEGESSAEULE_BRONZE_TONES.highlight),
      ]),
    );
    expect(uniqueInstanceColours(band).size).toBeGreaterThanOrEqual(5);
    expect(reliefs.userData.blockNative).toBe(true);
    expect(reliefs.userData.textureFree).toBe(true);
    expect(reliefs.userData.architecturalLevel).toBe(
      SIEGESSAEULE_PROFILE.reliefs.architecturalLevel,
    );
    expect(band.userData.blockNative).toBe(true);
    expect(band.userData.textureFree).toBe(true);
    expect((band.material as MeshStandardMaterial).map).toBeNull();

    const before = new Matrix4();
    const after = new Matrix4();
    band.getMatrixAt(7, before);
    world.updateMatrixWorld(true);
    band.getMatrixAt(7, after);
    expect(after.equals(before)).toBe(true);
    const position = new Vector3().setFromMatrixPosition(after);
    expect(position.y).toBeGreaterThan(11);
    expect(position.y).toBeLessThan(13);

    const reliefBounds = new Box3().setFromObject(reliefs);
    const mosaicBounds = new Box3().setFromObject(band);
    expect(reliefBounds.max.y).toBeLessThan(mosaicBounds.min.y);
    expect(reliefBounds.max.y).toBeLessThan(8);
    // All 36 blocks remain three InstancedMeshes, not one draw per tessera,
    // relief figure or column; no independently flickering objects exist.
    expect(
      world.children.filter(
        (child) =>
          child.name === "Voxel Siegessäule lower bronze relief panels" ||
          child.name === "Voxel Siegessäule glass mosaic colour band" ||
          child.name === "Voxel Siegessäule upper colonnade",
      ),
    ).toHaveLength(3);
    for (const detail of [reliefs, band, colonnade]) {
      expect(detail.userData.animated).toBe(false);
      expect(detail.frustumCulled).toBe(false);
    }
  });
});
