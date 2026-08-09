import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  DataTexture,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Points,
  PointsMaterial,
  RGBAFormat,
  SphereGeometry,
  Vector3,
  LinearFilter,
} from "three";

import type { VisualMode } from "./visualMode";

const SNOW_RADIUS_M = 360;
const SNOW_HEIGHT_M = 260;
const FLAKE_FALL_MPS = 22;
const FLURRY_CYCLE_SECONDS = 16;
const CALM_FLAKE_OPACITY = 0.08;
const PEAK_FLAKE_OPACITY = 0.96;

type Snowflake = {
  drift: number;
  phase: number;
  speed: number;
  x: number;
  y: number;
  z: number;
};

export type Snowstorm = {
  ageSeconds: number;
  air: Group;
  flakeMaterial: PointsMaterial;
  flakes: Snowflake[];
  flakePositions: BufferAttribute;
  group: Group;
  settled: Group;
};

export type SnowstormPresentation = {
  mode: VisualMode;
  obstructed: boolean;
};

function deterministicUnit(index: number, salt: number): number {
  const value = Math.sin((index + 3) * 17.713 + salt * 91.117) * 24_631.438;
  return value - Math.floor(value);
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum)));
  return t * t * (3 - 2 * t);
}

/**
 * A calm-to-flurry envelope with no hard visibility boundary.
 *
 * Each cycle begins and ends with only a few faint flakes. A broad middle
 * pulse increases opacity and wind for a short blizzard-like squall. The
 * small deterministic flutter keeps consecutive squalls from reading as a
 * mechanical on/off loop while remaining reproducible for tests and captures.
 */
export function snowFlurryIntensity(ageSeconds: number): number {
  const safeAge = Number.isFinite(ageSeconds) ? Math.max(0, ageSeconds) : 0;
  const phase = safeAge % FLURRY_CYCLE_SECONDS;
  const rise = smoothstep(2.1, 4.2, phase);
  const fall = 1 - smoothstep(8.8, 12.2, phase);
  const flutter = 0.88 + 0.12 * (0.5 + 0.5 * Math.sin(safeAge * 2.3));
  return rise * fall * flutter;
}

function createSnowflakeTexture(): DataTexture {
  const size = 24;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = ((x + 0.5) / size) * 2 - 1;
      const ny = ((y + 0.5) / size) * 2 - 1;
      const radius = Math.hypot(nx, ny);
      const angle = Math.atan2(ny, nx);
      const armDistance = Math.abs(Math.sin(angle * 3)) * radius;
      const alpha =
        radius < 0.3 || (radius < 0.88 && armDistance < 0.14)
          ? Math.round(255 * Math.max(0, 1 - radius * 0.42))
          : 0;
      const offset = (y * size + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = alpha;
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function snowflakeCount(coarsePointer: boolean): number {
  return coarsePointer ? 1_100 : 2_400;
}

function createFlakes(coarsePointer: boolean): {
  air: Group;
  material: PointsMaterial;
  flakes: Snowflake[];
  positions: BufferAttribute;
} {
  const count = snowflakeCount(coarsePointer);
  const values = new Float32Array(count * 3);
  const flakes: Snowflake[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = deterministicUnit(index, 1) * Math.PI * 2;
    const radius = Math.sqrt(deterministicUnit(index, 2)) * SNOW_RADIUS_M;
    const flake = {
      drift: 0.45 + deterministicUnit(index, 7) * 1.15,
      phase: deterministicUnit(index, 6) * Math.PI * 2,
      speed: FLAKE_FALL_MPS * (0.55 + deterministicUnit(index, 5) * 0.9),
      x: Math.cos(angle) * radius,
      y: deterministicUnit(index, 3) * SNOW_HEIGHT_M,
      z: Math.sin(angle) * radius,
    };
    flakes.push(flake);
    values[index * 3] = flake.x;
    values[index * 3 + 1] = flake.y;
    values[index * 3 + 2] = flake.z;
  }
  const positions = new BufferAttribute(values, 3);
  positions.setUsage(DynamicDrawUsage);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", positions);
  const material = new PointsMaterial({
    alphaToCoverage: true,
    // Preserve the antialiased arms of sub-two-pixel flakes. A larger cutoff
    // erased the sprite after minification in the wide isometric view.
    alphaTest: 0.015,
    color: 0xa7becb,
    depthWrite: false,
    opacity: CALM_FLAKE_OPACITY,
    map: createSnowflakeTexture(),
    // Keep the flakes genuinely tiny but legible in the wide isometric view.
    // World-sized points fell below one screen pixel at the default camera
    // distance and disappeared against the snow cover.
    size: coarsePointer ? 2.4 : 2.15,
    sizeAttenuation: false,
    transparent: true,
  });
  material.name = "Snowstorm flake material";
  material.toneMapped = false;
  const points = new Points(geometry, material);
  points.name = "Snowstorm point flakes";
  points.frustumCulled = false;
  points.renderOrder = 19;
  const air = new Group();
  air.name = "Snowstorm air field";
  air.add(points);
  return { air, material, flakes, positions };
}

function applyTransforms(
  mesh: InstancedMesh,
  transforms: Array<{
    position: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
  }>,
): void {
  const dummy = new Object3D();
  transforms.forEach((transform, index) => {
    dummy.position.set(...transform.position);
    dummy.rotation.set(...(transform.rotation ?? [0, 0, 0]));
    dummy.scale.set(...(transform.scale ?? [1, 1, 1]));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
}

function createSettledSnow(): Group {
  const group = new Group();
  group.name = "Deep snowdrifts and snowploughs";
  const blanketMaterial = new MeshBasicMaterial({
    color: 0xf5f7f6,
    depthWrite: false,
    opacity: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    transparent: true,
  });
  blanketMaterial.toneMapped = false;
  const blanket = new Mesh(new CircleGeometry(3_600, 96), blanketMaterial);
  blanket.name = "Continuous deep snow cover across the expanded city";
  // The drawn-ground extrusion tops vary between roughly 4.8 and 5.5 m;
  // this shallow cover sits just above them and deliberately buries the
  // lowest kerbs, as deep city snow should, without clipping doors/windows.
  blanket.position.set(-735, 5.72, -355);
  blanket.rotation.x = -Math.PI / 2;
  blanket.receiveShadow = true;
  blanket.renderOrder = 3;
  group.add(blanket);
  const driftTransforms = Array.from({ length: 168 }, (_, index) => {
    const angle = deterministicUnit(index, 17) * Math.PI * 2;
    const radius = 45 + deterministicUnit(index, 18) * 1_760;
    return {
      position: [
        -420 + Math.cos(angle) * radius,
        4.35 + deterministicUnit(index, 19) * 0.8,
        160 + Math.sin(angle) * radius,
      ] as [number, number, number],
      rotation: [0, angle, 0] as [number, number, number],
      scale: [
        7 + deterministicUnit(index, 20) * 22,
        1.1 + deterministicUnit(index, 21) * 3.7,
        3.5 + deterministicUnit(index, 22) * 10,
      ] as [number, number, number],
    };
  });
  const drifts = new InstancedMesh(
    new SphereGeometry(1, 10, 6),
    new MeshStandardMaterial({
      color: 0xf4f8fa,
      flatShading: true,
      roughness: 0.94,
    }),
    driftTransforms.length,
  );
  drifts.name = "Wind-shaped deep snowdrifts";
  drifts.castShadow = true;
  drifts.receiveShadow = true;
  applyTransforms(drifts, driftTransforms);
  group.add(drifts);

  const ploughs = [
    { x: -260, z: 340, rotation: 0.42 },
    { x: 410, z: 690, rotation: -0.84 },
    { x: -1_260, z: 435, rotation: 1.47 },
  ];
  const vehicleParts: Array<{
    geometry: BoxGeometry;
    material: MeshStandardMaterial | MeshBasicMaterial;
    name: string;
    offset: [number, number, number];
    scale: [number, number, number];
  }> = [
    {
      geometry: new BoxGeometry(1, 1, 1),
      material: new MeshStandardMaterial({
        color: 0xf29b27,
        flatShading: true,
      }),
      name: "Snowplough orange bodies",
      offset: [0, 2.2, 0],
      scale: [3.4, 2.1, 7.4],
    },
    {
      geometry: new BoxGeometry(1, 1, 1),
      material: new MeshStandardMaterial({
        color: 0xcde8f0,
        flatShading: true,
      }),
      name: "Snowplough glass cabs",
      offset: [0, 4.15, -0.8],
      scale: [2.9, 2, 3.1],
    },
    {
      geometry: new BoxGeometry(1, 1, 1),
      material: new MeshStandardMaterial({
        color: 0xd8452f,
        flatShading: true,
      }),
      name: "Snowplough angled blades",
      offset: [0, 1.05, 5.1],
      scale: [7.4, 1.3, 0.55],
    },
    {
      geometry: new BoxGeometry(1, 1, 1),
      material: new MeshBasicMaterial({ color: 0xffc83d }),
      name: "Snowplough warning beacons",
      offset: [0, 5.45, -0.9],
      scale: [0.5, 0.5, 0.5],
    },
  ];
  for (const part of vehicleParts) {
    const mesh = new InstancedMesh(
      part.geometry,
      part.material,
      ploughs.length,
    );
    mesh.name = part.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    applyTransforms(
      mesh,
      ploughs.map((plough) => ({
        position: [
          plough.x + Math.sin(plough.rotation) * part.offset[2],
          4.8 + part.offset[1],
          plough.z + Math.cos(plough.rotation) * part.offset[2],
        ],
        rotation: [0, plough.rotation, 0],
        scale: part.scale,
      })),
    );
    group.add(mesh);
  }
  return group;
}

export function createSnowstorm(coarsePointer: boolean): Snowstorm {
  const { air, material, flakes, positions } = createFlakes(coarsePointer);
  const settled = createSettledSnow();
  const group = new Group();
  group.name = "Super snowstorm presentation";
  group.visible = false;
  group.add(air, settled);
  return {
    ageSeconds: 0,
    air,
    flakeMaterial: material,
    flakes,
    flakePositions: positions,
    group,
    settled,
  };
}

export function setSnowstormPresentation(
  snow: Snowstorm,
  { mode, obstructed }: SnowstormPresentation,
): boolean {
  const visible = mode === "snowstorm" && !obstructed;
  const changed = snow.group.visible !== visible;
  snow.group.visible = visible;
  return changed;
}

export function updateSnowstorm(
  snow: Snowstorm,
  deltaSeconds: number,
  focus: Vector3,
): void {
  if (!snow.group.visible) {
    return;
  }
  snow.air.position.set(focus.x, Math.max(-18, focus.y - 20), focus.z);
  const elapsed = Math.min(Math.max(deltaSeconds, 0), 0.1);
  snow.ageSeconds += elapsed;
  const flurry = snowFlurryIntensity(snow.ageSeconds);
  const windScale = 0.62 + flurry * 1.55;
  snow.flakeMaterial.opacity =
    CALM_FLAKE_OPACITY +
    (PEAK_FLAKE_OPACITY - CALM_FLAKE_OPACITY) * flurry;
  const values = snow.flakePositions.array as Float32Array;
  snow.flakes.forEach((flake, index) => {
    flake.y -= flake.speed * (0.88 + flurry * 0.34) * elapsed;
    const gust = 0.55 + 0.45 * Math.sin(snow.ageSeconds * 0.48 + flake.phase);
    flake.x += (4.4 + gust * 4.8) * flake.drift * windScale * elapsed;
    flake.z += (1.2 + gust * 2.7) * flake.drift * windScale * elapsed;
    if (flake.y < 0) flake.y += SNOW_HEIGHT_M;
    if (flake.x > SNOW_RADIUS_M) flake.x -= SNOW_RADIUS_M * 2;
    if (flake.z > SNOW_RADIUS_M) flake.z -= SNOW_RADIUS_M * 2;
    values[index * 3] = flake.x;
    values[index * 3 + 1] = flake.y;
    values[index * 3 + 2] = flake.z;
  });
  snow.flakePositions.needsUpdate = true;
}
