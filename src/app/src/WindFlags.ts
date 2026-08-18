import {
  BufferAttribute,
  InstancedMesh,
  Mesh,
  Object3D,
  Vector3,
} from "three";

export type WindFlagKind =
  | "european-union"
  | "federal-president"
  | "germany"
  | "other"
  | "switzerland";

type WindFlagData = {
  amplitudeM: number;
  basePositions: Float32Array;
  kind: WindFlagKind;
  phase: number;
  widthM: number;
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
  const reach = Math.min(1, Math.max(0, xFromPoleM / widthM));
  const envelope = Math.pow(reach, 0.84);
  const primary = Math.sin(elapsedSeconds * 2.15 - xFromPoleM * 1.08 + phase);
  const flutter = Math.sin(elapsedSeconds * 3.7 - xFromPoleM * 2.35 + phase * 0.7);
  const offset = amplitudeM * envelope * (primary + flutter * 0.24);
  return {
    lift: amplitudeM * 0.16 * envelope * Math.cos(elapsedSeconds * 2.15 - xFromPoleM),
    offset,
  };
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
  mesh.userData.windFlag = {
    amplitudeM: options.amplitudeM ?? Math.min(0.58, widthM * 0.055),
    basePositions: new Float32Array(positions.array),
    kind: options.kind ?? "other",
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
  mesh.userData.windFlagInstances = {
    amplitudeM: options.amplitudeM ?? Math.min(0.58, widthM * 0.055),
    instances,
    kind: options.kind ?? "other",
    phase: options.phase ?? 0.35,
    widthM,
  } satisfies WindFlagInstanceData;
}

function updateFlagMesh(mesh: Mesh, data: WindFlagData, elapsedSeconds: number): void {
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
      | Record<string, number>
      | undefined) ?? {};
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
  root.traverse((object) => {
    if (object instanceof InstancedMesh) {
      const data = object.userData.windFlagInstances as
        | WindFlagInstanceData
        | undefined;
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
      | WindFlagInstanceData
      | undefined;
    const meshData = object.userData.windFlag as WindFlagData | undefined;
    const kind = instanceData?.kind ?? meshData?.kind;
    if (kind && kindAllowed(kind)) {
      count += 1;
    }
  });
  return count;
}
