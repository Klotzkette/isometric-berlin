import {
  BufferAttribute,
  Color,
  ConeGeometry,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from "three";

export type WindFlagKind =
  "european-union" | "federal-president" | "germany" | "other" | "switzerland";

/**
 * The restrained common wind field used by the four official civic flags.
 * The values are deliberately public so presentation tests can pin the
 * low-motion contract without copying animation constants.
 */
export const CIVIC_FLAG_WIND_PROFILE = Object.freeze({
  frameIntervalMs: 1000 / 12,
  flutterRadiansPerSecond: 1.7,
  maxAmplitudeM: 0.28,
  maxAmplitudeWidthRatio: 0.032,
  mobileFrameIntervalMs: 1000 / 8,
  primaryRadiansPerSecond: 0.95,
});

// Primary + flutter can reach 1.18 laterally while lift reaches 0.12. Scale
// both axes by their conservative joint bound so `maxAmplitudeM` is a true
// vector-displacement ceiling, not merely a waveform coefficient.
const CIVIC_FLAG_WAVE_VECTOR_BOUND = Math.hypot(1.18, 0.12);

export function civicFlagFrameIntervalMs(coarsePointer: boolean): number {
  return coarsePointer
    ? CIVIC_FLAG_WIND_PROFILE.mobileFrameIntervalMs
    : CIVIC_FLAG_WIND_PROFILE.frameIntervalMs;
}

export const CIVIC_WIND_FLAG_KINDS = [
  "federal-president",
  "germany",
  "european-union",
  "switzerland",
] as const satisfies readonly WindFlagKind[];

const civicWindFlagKinds: ReadonlySet<WindFlagKind> = new Set(
  CIVIC_WIND_FLAG_KINDS,
);

export function isCivicWindFlagKind(kind: WindFlagKind): boolean {
  return civicWindFlagKinds.has(kind);
}

type WindFlagData = {
  amplitudeM: number;
  basePositions: Float32Array;
  kind: WindFlagKind;
  phase: number;
  widthM: number;
};

type WindFlagIcicle = {
  amplitudeM: number;
  basePosition: Vector3;
  lengthM: number;
  liftDirection: Vector3;
  phase: number;
  waveDirection: Vector3;
  widthM: number;
  xFromPoleM: number;
};

type WindFlagWinterData = {
  icicles: WindFlagIcicle[];
  mesh: InstancedMesh;
  sourceCount: number;
};

type WindFlagInstance = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  xFromPoleM: number;
};

type WindFlagInstanceData = {
  amplitudeM: number;
  instances: WindFlagInstance[];
  kind: WindFlagKind;
  phase: number;
  widthM: number;
};

export type WindFlagUpdateOptions = {
  /**
   * Stable cache namespace for a filtered update contract. The historical
   * unfiltered update keeps using `all`, so existing modes retain their exact
   * authored wind pose.
   */
  cacheKey?: string;
  /** Return true only for flag kinds that may change in this update. */
  kindAllowed?: (kind: WindFlagKind) => boolean;
};

function waveAt(
  xFromPoleM: number,
  widthM: number,
  elapsedSeconds: number,
  phase: number,
  amplitudeM: number,
): { lift: number; offset: number } {
  const gentleAmplitude = Math.min(
    amplitudeM,
    CIVIC_FLAG_WIND_PROFILE.maxAmplitudeM,
    widthM * CIVIC_FLAG_WIND_PROFILE.maxAmplitudeWidthRatio,
  );
  const reach = Math.min(1, Math.max(0, xFromPoleM / widthM));
  const envelope = Math.pow(reach, 0.84);
  const primary = Math.sin(
    elapsedSeconds * CIVIC_FLAG_WIND_PROFILE.primaryRadiansPerSecond -
      xFromPoleM * 1.08 +
      phase,
  );
  const flutter = Math.sin(
    elapsedSeconds * CIVIC_FLAG_WIND_PROFILE.flutterRadiansPerSecond -
      xFromPoleM * 2.35 +
      phase * 0.7,
  );
  const normalizedAmplitude = gentleAmplitude / CIVIC_FLAG_WAVE_VECTOR_BOUND;
  const offset = normalizedAmplitude * envelope * (primary + flutter * 0.18);
  return {
    lift:
      normalizedAmplitude *
      0.12 *
      envelope *
      Math.cos(
        elapsedSeconds * CIVIC_FLAG_WIND_PROFILE.primaryRadiansPerSecond -
          xFromPoleM,
      ),
    offset,
  };
}

function civicAmplitudeM(widthM: number): number {
  return Math.min(
    CIVIC_FLAG_WIND_PROFILE.maxAmplitudeM,
    widthM * CIVIC_FLAG_WIND_PROFILE.maxAmplitudeWidthRatio,
  );
}

export function markWindFlag(
  mesh: Mesh,
  widthM: number,
  options: {
    amplitudeM?: number;
    kind?: WindFlagKind;
    phase?: number;
  } = {},
): void {
  const positions = mesh.geometry.getAttribute("position");
  if (!(positions instanceof BufferAttribute)) {
    return;
  }
  mesh.frustumCulled = false;
  const kind = options.kind ?? "other";
  mesh.userData.windFlag = {
    amplitudeM: isCivicWindFlagKind(kind)
      ? civicAmplitudeM(widthM)
      : (options.amplitudeM ?? Math.min(0.58, widthM * 0.055)),
    basePositions: new Float32Array(positions.array),
    kind,
    phase: options.phase ?? 0.35,
    widthM,
  } satisfies WindFlagData;
}

export function markWindFlagInstances(
  mesh: InstancedMesh,
  instances: WindFlagInstance[],
  widthM: number,
  options: {
    amplitudeM?: number;
    kind?: WindFlagKind;
    phase?: number;
  } = {},
): void {
  mesh.frustumCulled = false;
  const kind = options.kind ?? "other";
  mesh.userData.windFlagInstances = {
    amplitudeM: isCivicWindFlagKind(kind)
      ? civicAmplitudeM(widthM)
      : (options.amplitudeM ?? Math.min(0.58, widthM * 0.055)),
    instances,
    kind,
    phase: options.phase ?? 0.35,
    widthM,
  } satisfies WindFlagInstanceData;
}

function updateFlagMesh(
  mesh: Mesh,
  data: WindFlagData,
  elapsedSeconds: number,
): void {
  const positions = mesh.geometry.getAttribute("position");
  if (!(positions instanceof BufferAttribute)) {
    return;
  }
  for (let index = 0; index < positions.count; index += 1) {
    const offset = index * positions.itemSize;
    const baseX = data.basePositions[offset];
    const baseY = data.basePositions[offset + 1];
    const baseZ = data.basePositions[offset + 2];
    const wave = waveAt(
      baseX,
      data.widthM,
      elapsedSeconds,
      data.phase,
      data.amplitudeM,
    );
    positions.setXYZ(index, baseX, baseY + wave.lift, baseZ + wave.offset);
  }
  positions.needsUpdate = true;
}

// Scratch objects for the per-frame flag update: allocating them per
// instance per frame caused steady GC churn on mobile.
const flagDummy = new Object3D();
const flagOffset = new Vector3();
const flagRootInverse = new Matrix4();
const flagLocalToRoot = new Matrix4();
const flagPoint = new Vector3();
const flagWaveDirection = new Vector3();
const flagLiftDirection = new Vector3();

const WINTER_BATCH_NAME = "Civic flags shared winter icicles";
const WINTER_ICE_COLOR = new Color(0xdff3f6);
type FrostMaterialState = {
  color?: Color;
};

const frostMaterialStates = new WeakMap<Material, FrostMaterialState>();

function materialsOf(mesh: Mesh | InstancedMesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function setMaterialFrost(material: Material, enabled: boolean): void {
  const colored = material as Material & { color?: Color };
  if (enabled) {
    if (frostMaterialStates.has(material)) return;
    frostMaterialStates.set(material, {
      color: colored.color?.clone(),
    });
    colored.color?.lerp(WINTER_ICE_COLOR, 0.2);
    material.needsUpdate = true;
    return;
  }
  const state = frostMaterialStates.get(material);
  if (!state) return;
  if (state.color && colored.color) colored.color.copy(state.color);
  material.needsUpdate = true;
  frostMaterialStates.delete(material);
}

function civicWindSourceCount(root: Object3D): number {
  let count = 0;
  root.traverse((object) => {
    const meshData = object.userData.windFlag as WindFlagData | undefined;
    const instanceData = object.userData.windFlagInstances as
      WindFlagInstanceData | undefined;
    const kind = meshData?.kind ?? instanceData?.kind;
    if (kind && isCivicWindFlagKind(kind)) count += 1;
  });
  return count;
}

type IcicleFlagSurface = {
  amplitudeM: number;
  localMaxX: number;
  localMinX: number;
  localMinY: number;
  localToRoot: Matrix4;
  liftDirection: Vector3;
  lowestRootY: number;
  phase: number;
  poleRoot: Vector3;
  rootHeightM: number;
  waveDirection: Vector3;
  widthM: number;
};

function flagSurfaceForIcicles(
  mesh: Mesh,
  data: WindFlagData,
): IcicleFlagSurface | null {
  if (!isCivicWindFlagKind(data.kind) || data.basePositions.length < 3) {
    return null;
  }
  let localMinX = Number.POSITIVE_INFINITY;
  let localMaxX = Number.NEGATIVE_INFINITY;
  let localMinY = Number.POSITIVE_INFINITY;
  let localMaxY = Number.NEGATIVE_INFINITY;
  for (let offset = 0; offset < data.basePositions.length; offset += 3) {
    const x = data.basePositions[offset];
    const y = data.basePositions[offset + 1];
    localMinX = Math.min(localMinX, x);
    localMaxX = Math.max(localMaxX, x);
    localMinY = Math.min(localMinY, y);
    localMaxY = Math.max(localMaxY, y);
  }
  if (![localMinX, localMaxX, localMinY, localMaxY].every(Number.isFinite)) {
    return null;
  }
  flagLocalToRoot.multiplyMatrices(flagRootInverse, mesh.matrixWorld);
  const localToRoot = flagLocalToRoot.clone();
  const poleRoot = flagPoint.set(0, 0, 0).applyMatrix4(localToRoot).clone();
  const lowestRootY = flagPoint
    .set(localMaxX, localMinY, 0)
    .applyMatrix4(localToRoot).y;
  const waveDirection = flagWaveDirection
    .set(0, 0, 1)
    .transformDirection(localToRoot)
    .normalize()
    .clone();
  const liftDirection = flagLiftDirection
    .set(0, 1, 0)
    .transformDirection(localToRoot)
    .normalize()
    .clone();
  return {
    amplitudeM: data.amplitudeM,
    localMaxX,
    localMinX,
    localMinY,
    localToRoot,
    liftDirection,
    lowestRootY,
    phase: data.phase,
    poleRoot,
    rootHeightM: Math.abs(localMaxY - localMinY),
    waveDirection,
    widthM: data.widthM,
  };
}

function buildWinterIcicles(
  root: Object3D,
  sourceCount: number,
): WindFlagWinterData {
  root.updateWorldMatrix(true, true);
  flagRootInverse.copy(root.matrixWorld).invert();
  const surfaces: Array<{
    kind: WindFlagKind;
    surface: IcicleFlagSurface;
  }> = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh) || object instanceof InstancedMesh) return;
    const data = object.userData.windFlag as WindFlagData | undefined;
    if (!data) return;
    const surface = flagSurfaceForIcicles(object, data);
    if (!surface) return;
    const physicalIndex = surfaces.findIndex(
      (entry) =>
        entry.kind === data.kind &&
        Math.hypot(
          entry.surface.poleRoot.x - surface.poleRoot.x,
          entry.surface.poleRoot.z - surface.poleRoot.z,
        ) <= 0.3,
    );
    const current = surfaces[physicalIndex]?.surface;
    if (
      !current ||
      surface.lowestRootY < current.lowestRootY - 0.01 ||
      (Math.abs(surface.lowestRootY - current.lowestRootY) <= 0.01 &&
        surface.rootHeightM > current.rootHeightM)
    ) {
      const entry = { kind: data.kind, surface };
      if (physicalIndex >= 0) surfaces[physicalIndex] = entry;
      else surfaces.push(entry);
    }
  });

  const icicles: WindFlagIcicle[] = [];
  const reaches = [0.42, 0.7, 0.94] as const;
  for (const { surface } of surfaces) {
    reaches.forEach((reach, index) => {
      const x =
        surface.localMinX + (surface.localMaxX - surface.localMinX) * reach;
      const lengthM = Math.min(
        0.42,
        0.11 + surface.widthM * (0.018 + index * 0.004),
      );
      icicles.push({
        amplitudeM: surface.amplitudeM,
        basePosition: new Vector3(x, surface.localMinY, 0).applyMatrix4(
          surface.localToRoot,
        ),
        lengthM,
        liftDirection: surface.liftDirection,
        phase: surface.phase,
        waveDirection: surface.waveDirection,
        widthM: surface.widthM,
        xFromPoleM: Math.max(0, x - surface.localMinX),
      });
    });
  }

  const geometry = new ConeGeometry(1, 1, 5);
  geometry.rotateZ(Math.PI);
  const mesh = new InstancedMesh(
    geometry,
    new MeshBasicMaterial({
      color: 0xdff7ff,
      opacity: 0.86,
      transparent: true,
    }),
    icicles.length,
  );
  mesh.name = WINTER_BATCH_NAME;
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  mesh.userData.windFlagWinterIce = true;
  mesh.userData.windFlagWinterAccents = true;
  root.add(mesh);
  return { icicles, mesh, sourceCount };
}

function disposeWinterIcicles(data: WindFlagWinterData): void {
  data.mesh.removeFromParent();
  data.mesh.geometry.dispose();
  for (const material of materialsOf(data.mesh)) material.dispose();
}

function updateWinterIcicles(
  data: WindFlagWinterData,
  elapsedSeconds: number,
): void {
  data.icicles.forEach((icicle, index) => {
    const wave = waveAt(
      icicle.xFromPoleM,
      icicle.widthM,
      elapsedSeconds,
      icicle.phase,
      icicle.amplitudeM,
    );
    flagDummy.position
      .copy(icicle.basePosition)
      .addScaledVector(icicle.waveDirection, wave.offset)
      .addScaledVector(icicle.liftDirection, wave.lift);
    flagDummy.position.y -= icicle.lengthM / 2;
    flagDummy.rotation.set(0, 0, 0);
    const radius = Math.min(0.075, 0.032 + icicle.lengthM * 0.1);
    flagDummy.scale.set(radius, icicle.lengthM, radius);
    flagDummy.updateMatrix();
    data.mesh.setMatrixAt(index, flagDummy.matrix);
  });
  data.mesh.instanceMatrix.needsUpdate = true;
}

function updateFlagInstances(
  mesh: InstancedMesh,
  data: WindFlagInstanceData,
  elapsedSeconds: number,
): void {
  const dummy = flagDummy;
  data.instances.forEach((instance, index) => {
    const wave = waveAt(
      instance.xFromPoleM,
      data.widthM,
      elapsedSeconds,
      data.phase,
      data.amplitudeM,
    );
    dummy.position
      .fromArray(instance.position)
      .add(flagOffset.set(0, wave.lift, wave.offset));
    dummy.rotation.set(...(instance.rotation ?? [0, 0, 0]));
    dummy.scale.set(...(instance.scale ?? [1, 1, 1]));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

export function updateWindFlags(
  root: Object3D,
  elapsedSeconds: number,
  options: WindFlagUpdateOptions = {},
): void {
  // Caller-owned frozen/cadenced wind means repeated timestamps are exact
  // cache hits; avoid rewriting every vertex or instance matrix.
  const cacheKey = options.cacheKey ?? "all";
  let appliedByContract =
    (root.userData.windFlagsAppliedAtByContract as
      Record<string, number> | undefined) ?? {};
  const applied = appliedByContract[cacheKey];
  if (applied === elapsedSeconds) {
    return;
  }
  if (cacheKey === "all") {
    // A complete authored-pose update supersedes every filtered mutation.
    appliedByContract = { all: elapsedSeconds };
    root.userData.windFlagsAppliedAt = elapsedSeconds;
  } else {
    // A filtered cloth update means the previous whole-root cache no longer
    // describes current geometry. The next ordinary-mode switch must restore
    // its authored pose instead of being skipped as an apparent cache hit.
    delete appliedByContract.all;
    appliedByContract[cacheKey] = elapsedSeconds;
  }
  root.userData.windFlagsAppliedAtByContract = appliedByContract;
  root.userData.windFlagsLastElapsedSeconds = elapsedSeconds;
  root.traverse((object) => {
    if (object instanceof InstancedMesh) {
      const data = object.userData.windFlagInstances as
        WindFlagInstanceData | undefined;
      if (data && (options.kindAllowed?.(data.kind) ?? true)) {
        updateFlagInstances(object, data, elapsedSeconds);
      }
      return;
    }
    if (object instanceof Mesh) {
      const data = object.userData.windFlag as WindFlagData | undefined;
      if (data && (options.kindAllowed?.(data.kind) ?? true)) {
        updateFlagMesh(object, data, elapsedSeconds);
      }
    }
  });
  const winter = root.userData.windFlagWinter as WindFlagWinterData | undefined;
  if (winter?.mesh.visible) updateWinterIcicles(winter, elapsedSeconds);
}

/** Animate only the four official civic flag classes in every visual mode. */
export function updateCivicWindFlags(
  roots: readonly Object3D[],
  elapsedSeconds: number,
): void {
  for (const root of roots) {
    updateWindFlags(root, elapsedSeconds, {
      cacheKey: "official-civic-flags",
      kindAllowed: isCivicWindFlagKind,
    });
  }
}

/**
 * Apply reversible frost and one shared low-cost icicle batch per scene root.
 * Country colours remain legible beneath the restrained icy tint.
 */
export function setWindFlagWinterPresentation(
  root: Object3D,
  enabled: boolean,
): void {
  root.traverse((object) => {
    const meshData = object.userData.windFlag as WindFlagData | undefined;
    const instanceData = object.userData.windFlagInstances as
      WindFlagInstanceData | undefined;
    const kind = meshData?.kind ?? instanceData?.kind;
    if (
      !kind ||
      !isCivicWindFlagKind(kind) ||
      (!(object instanceof Mesh) && !(object instanceof InstancedMesh))
    ) {
      return;
    }
    for (const material of materialsOf(object)) {
      setMaterialFrost(material, enabled);
    }
    object.userData.windFlagIced = enabled;
  });

  let winter = root.userData.windFlagWinter as WindFlagWinterData | undefined;
  const lastElapsed = root.userData.windFlagsLastElapsedSeconds;
  const elapsedSeconds =
    typeof lastElapsed === "number" && Number.isFinite(lastElapsed)
      ? lastElapsed
      : 0.9;
  if (!enabled) {
    if (winter) {
      winter.mesh.visible = false;
      updateWinterIcicles(winter, elapsedSeconds);
    }
    root.userData.windFlagWinterActive = false;
    return;
  }

  const sourceCount = civicWindSourceCount(root);
  if (sourceCount === 0) {
    if (winter) disposeWinterIcicles(winter);
    delete root.userData.windFlagWinter;
    root.userData.windFlagWinterActive = true;
    return;
  }
  if (!winter || winter.sourceCount !== sourceCount) {
    if (winter) disposeWinterIcicles(winter);
    winter = buildWinterIcicles(root, sourceCount);
    root.userData.windFlagWinter = winter;
  }
  winter.mesh.visible = true;
  updateWinterIcicles(winter, elapsedSeconds);
  root.userData.windFlagWinterActive = true;
}

export function windFlagIcicleCount(root: Object3D): number {
  const winter = root.userData.windFlagWinter as WindFlagWinterData | undefined;
  return winter?.icicles.length ?? 0;
}

export function windFlagMatrixCount(root: Object3D): number {
  let count = 0;
  root.traverse((object) => {
    if (object.userData.windFlag || object.userData.windFlagInstances) {
      count += 1;
    }
  });
  return count;
}

export function windFlagKindCount(
  root: Object3D,
  kindAllowed: (kind: WindFlagKind) => boolean,
): number {
  let count = 0;
  root.traverse((object) => {
    const instanceData = object.userData.windFlagInstances as
      WindFlagInstanceData | undefined;
    const meshData = object.userData.windFlag as WindFlagData | undefined;
    const kind = instanceData?.kind ?? meshData?.kind;
    if (kind && kindAllowed(kind)) {
      count += 1;
    }
  });
  return count;
}
