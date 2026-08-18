import {
  AdditiveBlending,
  InstancedMesh,
  Mesh,
  ShaderMaterial,
  Vector4,
  type Object3D,
} from "three";

import {
  SCHWELLENRAUM_PROTECTED_VOLUMES,
  type SchwellenraumProtectedVolume,
} from "../../SchwellenraumInteriors";
import type { VisualMode } from "../../visualMode";
import { isSchwellenraumGeschuetzt } from "./presentation";

/**
 * A deliberately sparse material-only exception to Schwellenraum's still
 * world. The surveyed water geometry never moves: only a faint additive veil
 * changes brightness at a bounded cadence.
 */
// Four flag ticks: the water-only scene therefore redraws at just 3.75 Hz.
export const SCHWELLENRAUM_WATER_FRAME_INTERVAL_MS = (1_000 / 15) * 4;
export const SCHWELLENRAUM_WATER_INITIAL_TIME_SECONDS = 4.75;
export const SCHWELLENRAUM_WATER_GLINT_PERIOD_SECONDS = [18, 38] as const;

const WATER_SURFACE_NAMES = new Set([
  "basin water",
  "drawn water surface",
  "natural pond water",
  "Otto-Weidt-Platz fountain water",
  "Sony Center Forum reflecting pool",
  "smooth water surface",
]);

// The metric wave ribbon lies directly over the canonical smooth Spree plate.
// The latter owns the one Schwellenraum veil; cloning both would add the same
// light twice over nearly the complete river course. Keep this exclusion ahead
// of the explicit metadata opt-in as a closed duplicate-host safeguard.
const DUPLICATE_WATER_SURFACE_NAMES = new Set([
  "Spree metrically aligned undulating water surface",
]);

const NON_SURFACE_WATER_MARKERS =
  /\b(bank|bed|crest|edge|ice|ink|jet|quay|ripple|shore|slope|spray|wall|wake)\b/i;

const WATER_SURFACE_SUFFIX =
  /\b(?:basin|canal|fountain|pond|reflecting|river) water$/i;

export const SCHWELLENRAUM_WATER_OVERLAY_NAME =
  "Schwellenraum ethereal water light";

export type SchwellenraumWaterProtectedMask =
  | {
      centerWorldM: readonly [number, number];
      kind: "circle";
      radiusM: number;
      sourceId: string;
      sourceShape: "circle";
    }
  | {
      centerWorldM: readonly [number, number];
      halfSizeM: readonly [number, number];
      kind: "box";
      sourceId: string;
      sourceShape: "box" | "polygon";
    };

function protectedWaterMask(
  volume: SchwellenraumProtectedVolume,
): SchwellenraumWaterProtectedMask {
  if (volume.shape === "circle") {
    return {
      centerWorldM: volume.centerWorldM,
      kind: "circle",
      radiusM: volume.radiusM,
      sourceId: volume.id,
      sourceShape: volume.shape,
    };
  }
  if (volume.shape === "box") {
    const halfX = volume.sizeM[0] / 2;
    const halfZ = volume.sizeM[1] / 2;
    const cosine = Math.abs(Math.cos(volume.rotationY));
    const sine = Math.abs(Math.sin(volume.rotationY));
    return {
      centerWorldM: volume.centerWorldM,
      halfSizeM: [
        cosine * halfX + sine * halfZ,
        sine * halfX + cosine * halfZ,
      ],
      kind: "box",
      sourceId: volume.id,
      sourceShape: volume.shape,
    };
  }

  // The Moabit protection ring is the sole polygon. A conservative world AABB
  // costs one vec4, never exposes a protected fragment and keeps the complete
  // 17-volume mask well below the WebGL2 fragment-uniform budget.
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const [x, z] of volume.ringWorldM) {
    minX = Math.min(minX, x);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxZ = Math.max(maxZ, z);
  }
  return {
    centerWorldM: [(minX + maxX) / 2, (minZ + maxZ) / 2],
    halfSizeM: [(maxX - minX) / 2, (maxZ - minZ) / 2],
    kind: "box",
    sourceId: volume.id,
    sourceShape: volume.shape,
  };
}

/**
 * Plan masks derived from the same source as navigation protection. Circles
 * remain exact; rotated boxes and the polygon use conservative world AABBs.
 */
export const SCHWELLENRAUM_WATER_PROTECTED_MASKS =
  SCHWELLENRAUM_PROTECTED_VOLUMES.map(protectedWaterMask);

/** CPU mirror of the fragment discard, used by regression tests and audits. */
export function isSchwellenraumWaterAtmospherePointProtected(
  x: number,
  z: number,
): boolean {
  return SCHWELLENRAUM_WATER_PROTECTED_MASKS.some((mask) => {
    const dx = x - mask.centerWorldM[0];
    const dz = z - mask.centerWorldM[1];
    return mask.kind === "circle"
      ? dx * dx + dz * dz <= mask.radiusM * mask.radiusM
      : Math.abs(dx) <= mask.halfSizeM[0] &&
          Math.abs(dz) <= mask.halfSizeM[1];
  });
}

const PROTECTED_WATER_MASK_UNIFORMS = SCHWELLENRAUM_WATER_PROTECTED_MASKS.map(
  (mask) =>
    mask.kind === "circle"
      ? new Vector4(
          mask.centerWorldM[0],
          mask.centerWorldM[1],
          mask.radiusM,
          -mask.radiusM,
        )
      : new Vector4(
          mask.centerWorldM[0],
          mask.centerWorldM[1],
          mask.halfSizeM[0],
          mask.halfSizeM[1],
        ),
);

const WATER_VERTEX_SHADER = /* glsl */ `
  varying highp float vWaterUp;
  varying highp vec2 vWaterWorld;

  void main() {
    vec4 localPosition = vec4(position, 1.0);
    vec3 localNormal = normal;
    #ifdef USE_INSTANCING
      localPosition = instanceMatrix * localPosition;
      localNormal = mat3(instanceMatrix) * localNormal;
    #endif
    vec4 worldPosition = modelMatrix * localPosition;
    vWaterUp = normalize(mat3(modelMatrix) * localNormal).y;
    vWaterWorld = worldPosition.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const WATER_FRAGMENT_SHADER = /* glsl */ `
  uniform highp float uBreath;
  uniform highp float uGlintStrength;
  uniform highp vec4 uProtectedWaterMasks[${SCHWELLENRAUM_WATER_PROTECTED_MASKS.length}];
  uniform int uProtectedWaterMaskCount;
  uniform highp float uStrength;
  uniform highp float uTime;
  varying highp float vWaterUp;
  varying highp vec2 vWaterWorld;

  highp float hash21(highp vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  bool isProtectedWaterPoint(highp vec2 point) {
    for (int index = 0; index < ${SCHWELLENRAUM_WATER_PROTECTED_MASKS.length}; index += 1) {
      if (index >= uProtectedWaterMaskCount) break;
      highp vec4 mask = uProtectedWaterMasks[index];
      highp vec2 delta = point - mask.xy;
      // Negative w identifies an exact circle. Positive w is a conservative
      // world-axis box for source boxes and the one polygon protection ring.
      if (mask.w < 0.0) {
        if (dot(delta, delta) <= mask.z * mask.z) return true;
      } else if (all(lessThanEqual(abs(delta), mask.zw))) {
        return true;
      }
    }
    return false;
  }

  void main() {
    // Cylinder- and box-backed pools share their source geometry with the
    // overlay. Only the actual upward water top may glow; sides and undersides
    // stay untouched and therefore cannot create luminous rims below grade.
    if (vWaterUp < 0.55) discard;
    highp vec2 point = vWaterWorld;
    if (isProtectedWaterPoint(point)) discard;

    // Two fixed world-space fields form broad patches. Time changes only
    // their brightness, never their position, so the water does not appear
    // to flow beneath a still city.
    highp float fieldA = 0.5 + 0.5 * sin(point.x * 0.0107 + point.y * 0.0061);
    highp float fieldB = 0.5 + 0.5 * sin(point.x * -0.0049 + point.y * 0.0123 + 1.7);
    highp float mist = smoothstep(0.63, 0.93, fieldA * 0.58 + fieldB * 0.42);

    // Only a small deterministic subset of 24 m water cells can glint. Each
    // selected cell has a long individual cycle and a soft rise/fall; there
    // is no rapid flash and no synchronised river-wide pulse.
    highp vec2 cell = floor(point / 24.0);
    highp float seed = hash21(cell);
    highp float selected = step(0.91, seed);
    highp float period = mix(${SCHWELLENRAUM_WATER_GLINT_PERIOD_SECONDS[0].toFixed(1)}, ${SCHWELLENRAUM_WATER_GLINT_PERIOD_SECONDS[1].toFixed(1)}, hash21(cell + 19.3));
    highp float phase = fract(uTime / period + seed);
    highp float envelope =
      smoothstep(0.0, 0.055, phase) *
      (1.0 - smoothstep(0.055, 0.19, phase));
    highp vec2 offset = vec2(
      hash21(cell + vec2(3.1, 7.7)),
      hash21(cell + vec2(11.9, 2.3))
    ) - 0.5;
    highp vec2 localPoint = fract(point / 24.0) - 0.5 - offset * 0.52;
    highp float halo = 1.0 - smoothstep(0.025, 0.115, length(localPoint));
    highp float crossGlint = max(
      1.0 - smoothstep(0.008, 0.026, abs(localPoint.x)),
      1.0 - smoothstep(0.008, 0.026, abs(localPoint.y))
    ) * (1.0 - smoothstep(0.03, 0.12, length(localPoint)));
    highp float glint =
      selected * envelope * max(halo * 0.72, crossGlint * 0.46) * uGlintStrength;

    highp float mistAlpha = (0.0015 + mist * 0.0105 * uBreath) * uStrength;
    highp float glintAlpha = glint * 0.052 * uStrength;
    highp float alpha = mistAlpha + glintAlpha;
    if (alpha < 0.0012) discard;

    lowp vec3 mistTone = vec3(0.72, 0.91, 0.91);
    lowp vec3 glintTone = vec3(1.0, 0.91, 0.69);
    gl_FragColor = vec4(mix(mistTone, glintTone, min(0.58, glint)), alpha);
  }
`;

export type SchwellenraumWaterPresentationResult = {
  changed: boolean;
  installed: number;
  visibleCount: number;
};

/** Names are a closed semantic contract; bank walls, wakes and ink stay out. */
export function isSchwellenraumWaterSurface(object: Object3D): object is Mesh {
  if (!(object instanceof Mesh)) return false;
  if (object.userData.schwellenraumWaterAtmosphere === true) return false;
  if (DUPLICATE_WATER_SURFACE_NAMES.has(object.name)) return false;
  if (object.userData.schwellenraumWaterSurface === true) return true;
  if (WATER_SURFACE_NAMES.has(object.name)) return true;
  return (
    !NON_SURFACE_WATER_MARKERS.test(object.name) &&
    WATER_SURFACE_SUFFIX.test(object.name)
  );
}

function createWaterMaterial(): ShaderMaterial {
  const material = new ShaderMaterial({
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    fragmentShader: WATER_FRAGMENT_SHADER,
    polygonOffset: true,
    polygonOffsetFactor: -1.5,
    polygonOffsetUnits: -1.5,
    toneMapped: false,
    transparent: true,
    uniforms: {
      uBreath: {
        value: schwellenraumWaterBreath(
          SCHWELLENRAUM_WATER_INITIAL_TIME_SECONDS,
        ),
      },
      uGlintStrength: { value: 1 },
      uProtectedWaterMaskCount: {
        value: SCHWELLENRAUM_WATER_PROTECTED_MASKS.length,
      },
      uProtectedWaterMasks: {
        value: PROTECTED_WATER_MASK_UNIFORMS.map((mask) => mask.clone()),
      },
      uStrength: { value: 0.72 },
      uTime: { value: SCHWELLENRAUM_WATER_INITIAL_TIME_SECONDS },
    },
    vertexShader: WATER_VERTEX_SHADER,
  });
  material.name = "Schwellenraum water mist and glint material";
  material.userData.schwellenraumWaterAtmosphere = true;
  material.userData.lightOnly = true;
  material.userData.noTexture = true;
  return material;
}

function createWaterOverlay(host: Mesh): Mesh {
  const material = createWaterMaterial();
  const overlay =
    host instanceof InstancedMesh
      ? new InstancedMesh(host.geometry, material, host.count)
      : new Mesh(host.geometry, material);
  if (host instanceof InstancedMesh && overlay instanceof InstancedMesh) {
    overlay.instanceMatrix.copy(host.instanceMatrix);
    overlay.instanceMatrix.needsUpdate = true;
  }
  overlay.name = `${SCHWELLENRAUM_WATER_OVERLAY_NAME}: ${host.name}`;
  overlay.visible = false;
  overlay.castShadow = false;
  overlay.receiveShadow = false;
  overlay.frustumCulled = host.frustumCulled;
  overlay.renderOrder = Math.max(4, host.renderOrder + 1);
  overlay.raycast = () => undefined;
  overlay.userData.schwellenraumPraesentation = true;
  overlay.userData.schwellenraumWaterAtmosphere = true;
  overlay.userData.sourceWaterName = host.name;
  overlay.userData.geometryMotion = "none";
  overlay.userData.presentation =
    "Light-only fixed mist fields and rare slow glints over source water";
  return overlay;
}

/** Add one geometry-sharing, non-interactive overlay per eligible water mesh. */
export function installSchwellenraumWaterAtmosphere(root: Object3D): number {
  const hosts: Mesh[] = [];
  root.traverse((object) => {
    if (
      isSchwellenraumWaterSurface(object) &&
      object.userData.schwellenraumWaterAtmosphereInstalled !== true &&
      !isSchwellenraumGeschuetzt(object)
    ) {
      hosts.push(object);
    }
  });
  for (const host of hosts) {
    host.userData.schwellenraumWaterAtmosphereInstalled = true;
    host.add(createWaterOverlay(host));
  }
  return hosts.length;
}

function isWaterOverlay(object: Object3D): object is Mesh<
  Mesh["geometry"],
  ShaderMaterial
> {
  return (
    object instanceof Mesh &&
    object.userData.schwellenraumWaterAtmosphere === true &&
    object.material instanceof ShaderMaterial
  );
}

/**
 * Install lazily on first entry and toggle losslessly with the visual mode.
 * Obstructed/underwater/underside views never render the surface veil.
 */
export function setSchwellenraumWaterAtmospherePresentation(
  roots: readonly Object3D[],
  mode: VisualMode,
  obstructed: boolean,
): SchwellenraumWaterPresentationResult {
  let installed = 0;
  if (mode === "schwellenraum") {
    for (const root of roots) {
      installed += installSchwellenraumWaterAtmosphere(root);
    }
  }
  const visible = mode === "schwellenraum" && !obstructed;
  let changed = installed > 0;
  let visibleCount = 0;
  for (const root of roots) {
    root.traverse((object) => {
      if (!isWaterOverlay(object)) return;
      if (object.visible !== visible) {
        object.visible = visible;
        changed = true;
      }
      if (visible) visibleCount += 1;
    });
  }
  return { changed, installed, visibleCount };
}

/** A 24 s breath: deliberately far below any flashing cadence. */
export function schwellenraumWaterBreath(elapsedSeconds: number): number {
  const safeTime = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  return 0.72 + 0.28 * (0.5 - 0.5 * Math.cos((safeTime * Math.PI) / 12));
}

/** Update material uniforms only. Mesh matrices and source water stay fixed. */
export function updateSchwellenraumWaterAtmosphere(
  roots: readonly Object3D[],
  elapsedSeconds: number,
  reducedMotion = false,
): number {
  const materials = new Set<ShaderMaterial>();
  for (const root of roots) {
    root.traverse((object) => {
      if (isWaterOverlay(object) && object.visible) {
        materials.add(object.material);
      }
    });
  }
  const safeTime = Number.isFinite(elapsedSeconds)
    ? Math.max(0, elapsedSeconds)
    : 0;
  for (const material of materials) {
    material.uniforms.uTime.value = safeTime;
    material.uniforms.uBreath.value = schwellenraumWaterBreath(safeTime);
    material.uniforms.uStrength.value = reducedMotion ? 0.48 : 0.72;
    material.uniforms.uGlintStrength.value = reducedMotion ? 0.22 : 1;
  }
  return materials.size;
}
