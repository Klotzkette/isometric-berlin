import { describe, expect, test } from "bun:test";
import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import {
  CIVIC_FLAG_WIND_PROFILE,
  CIVIC_WIND_FLAG_KINDS,
  civicFlagFrameIntervalMs,
  markWindFlag,
  markWindFlagInstances,
  setWindFlagWinterPresentation,
  updateCivicWindFlags,
  updateWindFlags,
  windFlagIcicleCount,
  windFlagMatrixCount,
} from "../src/WindFlags";
import { createCivicLandmarks } from "../src/CivicLandmarks";

const viewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
)
  .text()
  .then((source) => source.replaceAll("\r\n", "\n"));

function officialFlag(
  kind: (typeof CIVIC_WIND_FLAG_KINDS)[number],
  widthM: number,
  x = 0,
  y = 0,
): Mesh {
  const geometry = new PlaneGeometry(widthM, 1.4, 8, 2);
  geometry.translate(widthM / 2, 0, 0);
  const flag = new Mesh(geometry, new MeshBasicMaterial({ color: 0xc62f38 }));
  flag.position.set(x, y, 0);
  markWindFlag(flag, widthM, { amplitudeM: 4, kind, phase: 0.42 });
  return flag;
}

function matrixSnapshot(object: Object3D): number[] {
  object.updateMatrix();
  return object.matrix.toArray();
}

describe("shared flag wind field", () => {
  test("keeps the pole edge fixed while moving the free edge", () => {
    const geometry = new PlaneGeometry(6, 2, 12, 2);
    geometry.translate(3, 0, 0);
    const flag = new Mesh(geometry, new MeshBasicMaterial());
    const root = new Group();
    root.add(flag);
    markWindFlag(flag, 6, { amplitudeM: 0.5, phase: 0.42 });

    const positions = geometry.getAttribute("position");
    const poleVertices: number[] = [];
    const freeVertices: number[] = [];
    for (let index = 0; index < positions.count; index += 1) {
      if (Math.abs(positions.getX(index)) < 0.001) {
        poleVertices.push(index);
      }
      if (Math.abs(positions.getX(index) - 6) < 0.001) {
        freeVertices.push(index);
      }
    }
    updateWindFlags(root, 1.7);
    expect(
      poleVertices.every((index) => Math.abs(positions.getZ(index)) < 1e-6),
    ).toBe(true);
    expect(
      freeVertices.some((index) => Math.abs(positions.getZ(index)) > 0.05),
    ).toBe(true);
    expect(windFlagMatrixCount(root)).toBe(1);
  });

  test("pins a uniformly gentle amplitude for all four official classes", () => {
    for (const kind of CIVIC_WIND_FLAG_KINDS) {
      const flag = officialFlag(kind, 10);
      const data = flag.userData.windFlag as { amplitudeM: number };
      expect(data.amplitudeM, kind).toBe(CIVIC_FLAG_WIND_PROFILE.maxAmplitudeM);

      updateCivicWindFlags([flag], 1.7);
      const positions = flag.geometry.getAttribute("position");
      let largestOffset = 0;
      for (let index = 0; index < positions.count; index += 1) {
        largestOffset = Math.max(
          largestOffset,
          Math.abs(positions.getZ(index)),
        );
      }
      expect(largestOffset, kind).toBeGreaterThan(0.02);
      expect(largestOffset, kind).toBeLessThanOrEqual(
        CIVIC_FLAG_WIND_PROFILE.maxAmplitudeM,
      );
    }
    const small = officialFlag("switzerland", 2.2);
    expect(
      (small.userData.windFlag as { amplitudeM: number }).amplitudeM,
    ).toBeCloseTo(2.2 * CIVIC_FLAG_WIND_PROFILE.maxAmplitudeWidthRatio, 6);
  });

  test("keeps every free-edge lift-plus-wave vector below 0.28 m", () => {
    for (const kind of CIVIC_WIND_FLAG_KINDS) {
      for (const widthM of [2.2, 3.8, 10]) {
        const flag = officialFlag(kind, widthM);
        const positions = flag.geometry.getAttribute("position");
        const base = Array.from(positions.array);
        let sampledMaximumM = 0;
        for (let elapsed = 0; elapsed <= 24; elapsed += 0.013) {
          updateCivicWindFlags([flag], elapsed);
          for (let index = 0; index < positions.count; index += 1) {
            if (Math.abs(positions.getX(index) - widthM) > 1e-6) continue;
            const offset = index * positions.itemSize;
            sampledMaximumM = Math.max(
              sampledMaximumM,
              Math.hypot(
                positions.getY(index) - base[offset + 1]!,
                positions.getZ(index) - base[offset + 2]!,
              ),
            );
          }
        }
        const boundM = Math.min(
          CIVIC_FLAG_WIND_PROFILE.maxAmplitudeM,
          widthM * CIVIC_FLAG_WIND_PROFILE.maxAmplitudeWidthRatio,
        );
        expect(sampledMaximumM, `${kind}:${widthM}`).toBeLessThanOrEqual(
          boundM + 1e-6,
        );
        expect(sampledMaximumM, `${kind}:${widthM}`).toBeGreaterThan(
          boundM * 0.7,
        );
      }
    }
  });

  test("uses a slower touch cadence without changing the cloth profile", () => {
    expect(civicFlagFrameIntervalMs(false)).toBe(
      CIVIC_FLAG_WIND_PROFILE.frameIntervalMs,
    );
    expect(civicFlagFrameIntervalMs(true)).toBe(
      CIVIC_FLAG_WIND_PROFILE.mobileFrameIntervalMs,
    );
    expect(civicFlagFrameIntervalMs(true)).toBeGreaterThan(
      civicFlagFrameIntervalMs(false),
    );
  });

  test("preserves authored object, instance rotation and scale transforms", () => {
    const root = new Group();
    root.position.set(8, 4, -3);
    root.rotation.set(0.1, -0.2, 0.05);
    const flag = officialFlag("germany", 4, 2, 7);
    flag.rotation.set(0.03, -0.08, 0.04);
    root.add(flag);
    const objectMatrix = matrixSnapshot(flag);

    const marks = new InstancedMesh(
      new PlaneGeometry(0.2, 0.2),
      new MeshBasicMaterial(),
      1,
    );
    const transforms = [
      {
        position: [1, 2, 3] as [number, number, number],
        rotation: [0.2, -0.3, 0.1] as [number, number, number],
        scale: [1.7, 0.8, 1.2] as [number, number, number],
        xFromPoleM: 3,
      },
    ];
    const dummy = new Object3D();
    dummy.position.set(...transforms[0].position);
    dummy.rotation.set(...transforms[0].rotation);
    dummy.scale.set(...transforms[0].scale);
    dummy.updateMatrix();
    marks.setMatrixAt(0, dummy.matrix);
    markWindFlagInstances(marks, transforms, 4, {
      kind: "european-union",
      phase: 0.42,
    });
    root.add(marks);

    updateCivicWindFlags([root], 2.3);
    expect(matrixSnapshot(flag)).toEqual(objectMatrix);
    const matrix = new Matrix4();
    marks.getMatrixAt(0, matrix);
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    matrix.decompose(position, rotation, scale);
    expect(scale.x).toBeCloseTo(transforms[0].scale[0], 5);
    expect(scale.y).toBeCloseTo(transforms[0].scale[1], 5);
    expect(scale.z).toBeCloseTo(transforms[0].scale[2], 5);
    const expectedRotation = new Quaternion().setFromEuler(dummy.rotation);
    expect(rotation.angleTo(expectedRotation)).toBeLessThan(2e-5);
    expect(position.x).toBeCloseTo(transforms[0].position[0], 6);
    expect(position.y).not.toBe(transforms[0].position[1]);
  });

  test("ices every official physical flag with one shared icicle drawcall", () => {
    const root = new Group();
    const officialMeshes: Mesh[] = [];
    CIVIC_WIND_FLAG_KINDS.forEach((kind, kindIndex) => {
      // Three co-moving artwork layers at one pole still describe one flag.
      for (let layer = 0; layer < 3; layer += 1) {
        const mesh = officialFlag(kind, 3, kindIndex * 6, layer * 0.12);
        officialMeshes.push(mesh);
        root.add(mesh);
      }
    });
    const other = new Mesh(
      new PlaneGeometry(3, 1),
      new MeshBasicMaterial({ color: 0x334455 }),
    );
    other.geometry.translate(1.5, 0, 0);
    other.position.x = 30;
    markWindFlag(other, 3, { kind: "other" });
    root.add(other);

    const firstMaterial = officialMeshes[0].material as MeshBasicMaterial;
    const initialColor = firstMaterial.color.getHex();
    const initialOpacity = firstMaterial.opacity;
    const initialTransparent = firstMaterial.transparent;
    const initialObjectMatrices = officialMeshes.map(matrixSnapshot);
    const otherColor = (other.material as MeshBasicMaterial).color.getHex();

    setWindFlagWinterPresentation(root, true);
    expect(windFlagIcicleCount(root)).toBe(CIVIC_WIND_FLAG_KINDS.length * 3);
    const batch = root.getObjectByName(
      "Civic flags shared winter icicles",
    ) as InstancedMesh;
    expect(batch).toBeInstanceOf(InstancedMesh);
    expect(batch.userData.windFlagWinterAccents).toBeTrue();
    expect(batch.visible).toBeTrue();
    expect(firstMaterial.color.getHex()).not.toBe(initialColor);
    expect(firstMaterial.opacity).toBe(initialOpacity);
    expect(firstMaterial.transparent).toBe(initialTransparent);
    expect((other.material as MeshBasicMaterial).color.getHex()).toBe(
      otherColor,
    );
    for (const mesh of officialMeshes) {
      expect(mesh.userData.windFlagIced).toBeTrue();
    }

    const beforeIcicles = Array.from(batch.instanceMatrix.array);
    updateCivicWindFlags([root], 3.1);
    expect(Array.from(batch.instanceMatrix.array)).not.toEqual(beforeIcicles);
    expect(officialMeshes.map(matrixSnapshot)).toEqual(initialObjectMatrices);

    setWindFlagWinterPresentation(root, false);
    expect(batch.visible).toBeFalse();
    expect(firstMaterial.color.getHex()).toBe(initialColor);
    expect(other.userData.windFlagIced).toBeUndefined();

    // Snow -> Day -> Minecraft -> Snow must re-enable the retained batch
    // even if an intervening visibility policy left it false.
    batch.visible = false;
    setWindFlagWinterPresentation(root, true);
    expect(batch.visible).toBeTrue();
    setWindFlagWinterPresentation(root, false);
  });

  test("groups the real layered Swiss and Unity artwork into two physical flags", () => {
    const civic = createCivicLandmarks([
      {
        name: "Schweizerische Botschaft",
        world: [-5.654743, 8, -246.494572],
      },
      { name: "Fahne der Einheit", world: [226.039773, 8, 57.925456] },
    ]);
    expect(windFlagMatrixCount(civic)).toBe(8);
    updateWindFlags(civic, 2.4);
    setWindFlagWinterPresentation(civic, true);
    expect(windFlagIcicleCount(civic)).toBe(6);
  });

  test("wires warm transitions and cold async attaches to one continuous clock", () => {
    const warmVisibility = viewerSource.indexOf(
      "applyRuntimeMinecraftVisibility(runtime, voxelMode);",
    );
    const warmWinter = viewerSource.indexOf(
      "setWindFlagWinterPresentation(runtime.signatures, isSnowstorm);",
    );
    expect(warmVisibility).toBeGreaterThan(0);
    expect(warmWinter).toBeGreaterThan(warmVisibility);
    expect(viewerSource).not.toContain(
      "runtime.schwellenraumFlagElapsedSeconds = 0.9",
    );
    expect(viewerSource).not.toContain(
      "updateWindFlags(runtime.signatures, 0.9)",
    );
    expect(viewerSource).not.toContain(
      "updateWindFlags(runtime.civicDetails, 0.9)",
    );
    expect(viewerSource).toContain("runtime.schwellenraumFlagElapsedSeconds,");
    expect(viewerSource).toContain("runtime.fineDetailVisible");
    expect(viewerSource).toContain(
      'const documentHidden = document.visibilityState === "hidden";',
    );
    expect(viewerSource).toContain("!documentHidden");

    const coldCivicVisibility = viewerSource.indexOf(
      "applyRuntimeMinecraftVisibility(runtime, voxelModeActive(runtime));",
      warmWinter,
    );
    const coldCivicWinter = viewerSource.indexOf(
      "setWindFlagWinterPresentation(\n            runtime.civicDetails,",
      coldCivicVisibility,
    );
    const coldSignatureVisibility = viewerSource.indexOf(
      "applyRuntimeMinecraftVisibility(runtime, voxelModeActive(runtime));",
      coldCivicWinter + 1,
    );
    const coldSignatureWinter = viewerSource.indexOf(
      "setWindFlagWinterPresentation(\n            runtime.signatures,",
      coldSignatureVisibility,
    );
    expect(coldCivicVisibility).toBeGreaterThan(warmWinter);
    expect(coldCivicWinter).toBeGreaterThan(coldCivicVisibility);
    expect(coldSignatureVisibility).toBeGreaterThan(coldCivicWinter);
    expect(coldSignatureWinter).toBeGreaterThan(coldSignatureVisibility);
  });
});
