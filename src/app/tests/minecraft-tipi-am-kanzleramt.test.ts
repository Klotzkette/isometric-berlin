import { describe, expect, test } from "bun:test";
import {
  Box3,
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

import {
  createMinecraftTipiAmKanzleramt,
  isMinecraftTipiReplacementColumn,
  minecraftTipiPaletteIsClosed,
} from "../src/MinecraftTipiAmKanzleramt";
import { TIPI_AM_KANZLERAMT_PROFILE } from "../src/TipiAmKanzleramt";
import { MINECRAFT_PALETTE } from "../src/visual-modes/minecraft/palette";

describe("Minecraft TIPI am Kanzleramt", () => {
  test("uses one opaque texture-free block batch in the closed world palette", () => {
    const tipi = createMinecraftTipiAmKanzleramt();
    const tipiMaterial = tipi.material as MeshStandardMaterial;

    expect(tipi).toBeInstanceOf(InstancedMesh);
    expect(tipi.geometry).toBeInstanceOf(BoxGeometry);
    expect(tipi.count).toBe(491);
    expect(tipi.userData.drawCallBudget).toBe(1);
    expect(tipi.userData.blockCount).toBe(tipi.count);
    expect(tipi.userData.blockNative).toBe(true);
    expect(tipi.userData.noTexture).toBe(true);
    expect(tipiMaterial.transparent).toBe(false);
    expect(tipiMaterial.map).toBeNull();
    expect(minecraftTipiPaletteIsClosed()).toBe(true);

    const palette = new Set<number>(MINECRAFT_PALETTE);
    const color = new Color();
    for (let index = 0; index < tipi.count; index += 1) {
      tipi.getColorAt(index, color);
      expect(palette.has(color.getHex())).toBe(true);
    }
  });

  test("keeps the fictional owner marquee legible as gold pixel blocks", () => {
    const tipi = createMinecraftTipiAmKanzleramt();
    const goldLetters =
      tipi.userData.cueCounts[
        "TIPI fictional owner-authored PIGOR & EICHHORN gold letter blocks"
      ];

    expect(tipi.userData.marquee).toBe("PIGOR & EICHHORN");
    expect(tipi.userData.marqueeAlwaysVisible).toBe(true);
    expect(tipi.userData.marqueeFictional).toBe(true);
    expect(tipi.userData.marqueeIsOwnerAuthored).toBe(true);
    expect(goldLetters).toBeGreaterThan(200);
    expect(tipi.userData.sourceUrls).toContain(
      "https://www.tipi-am-kanzleramt.de/_Resources/Persistent/0/1/3/9/0139b75bd22d148179852011cf066a1968138877/TIPI_Technikinfo_07_2024.pdf",
    );
  });

  test("stays block-coarse while preserving the official 32 by 26 metre cue", () => {
    const tipi = createMinecraftTipiAmKanzleramt();
    const matrix = new Matrix4();
    const scale = new Vector3();
    for (let index = 0; index < tipi.count; index += 1) {
      tipi.getMatrixAt(index, matrix);
      matrix.decompose(new Vector3(), new Quaternion(), scale);
      expect(Math.max(scale.x, scale.y, scale.z)).toBeLessThanOrEqual(4.001);
    }

    const bounds = new Box3().setFromObject(tipi);
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(48);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(52);
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(32);
    expect(bounds.max.z - bounds.min.z).toBeLessThan(36);
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(13);
    expect(bounds.max.y - bounds.min.y).toBeLessThan(14);
    expect(TIPI_AM_KANZLERAMT_PROFILE.ellipseLengthM).toBe(32);
    expect(TIPI_AM_KANZLERAMT_PROFILE.ellipseWidthM).toBe(26);
    expect(
      tipi.userData.cueCounts["TIPI eight explicit roof peak blocks"],
    ).toBe(8);
  });

  test("replaces only the authored tent, entrance and pavilion footprints", () => {
    const [anchorX, anchorZ] = TIPI_AM_KANZLERAMT_PROFILE.osmLandmarkWorldM;
    expect(isMinecraftTipiReplacementColumn(anchorX, anchorZ)).toBe(true);
    expect(isMinecraftTipiReplacementColumn(anchorX, anchorZ + 16)).toBe(true);
    expect(isMinecraftTipiReplacementColumn(anchorX + 50, anchorZ)).toBe(false);
    expect(isMinecraftTipiReplacementColumn(anchorX, anchorZ - 30)).toBe(false);
  });
});
