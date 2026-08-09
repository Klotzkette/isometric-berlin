import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Points,
  PointsMaterial,
  SphereGeometry,
  Vector3,
} from "three";

import type { VisualMode } from "./visualMode";

const SNOW_RADIUS_M = 360;
const SNOW_HEIGHT_M = 260;
const FLAKE_FALL_MPS = 22;

type Snowflake = {
  speed: number;
  x: number;
  y: number;
  z: number;
};

export type Snowstorm = {
  air: Group;
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

export function snowflakeCount(coarsePointer: boolean): number {
  return coarsePointer ? 1_100 : 2_400;
}

function createFlakes(coarsePointer: boolean): {
  air: Group;
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
    color: 0xffffff,
    depthWrite: false,
    opacity: 0.96,
    size: coarsePointer ? 2.35 : 2.05,
    sizeAttenuation: true,
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
  return { air, flakes, positions };
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
  const { air, flakes, positions } = createFlakes(coarsePointer);
  const settled = createSettledSnow();
  const group = new Group();
  group.name = "Super snowstorm presentation";
  group.visible = false;
  group.add(air, settled);
  return { air, flakes, flakePositions: positions, group, settled };
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
  const values = snow.flakePositions.array as Float32Array;
  snow.flakes.forEach((flake, index) => {
    flake.y -= flake.speed * elapsed;
    flake.x += 5.4 * elapsed;
    flake.z += 2.2 * elapsed;
    if (flake.y < 0) flake.y += SNOW_HEIGHT_M;
    if (flake.x > SNOW_RADIUS_M) flake.x -= SNOW_RADIUS_M * 2;
    if (flake.z > SNOW_RADIUS_M) flake.z -= SNOW_RADIUS_M * 2;
    values[index * 3] = flake.x;
    values[index * 3 + 1] = flake.y;
    values[index * 3 + 2] = flake.z;
  });
  snow.flakePositions.needsUpdate = true;
}
