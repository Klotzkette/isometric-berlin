import {
  BoxGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from "three";

import type { VisualMode } from "./visualMode";

const RAIN_RADIUS_M = 300;
const RAIN_HEIGHT_M = 230;
const DROP_LENGTH_M = 4.1;
const DROP_WIDTH_M = 0.105;

type RainDrop = {
  lengthScale: number;
  speedMps: number;
  widthScale: number;
  x: number;
  y: number;
  z: number;
};

export type ModerateRain = {
  drops: RainDrop[];
  group: Group;
  material: MeshBasicMaterial;
  matrixHelper: Object3D;
  matrixMode: VisualMode;
  mesh: InstancedMesh;
};

export type RainPresentation = {
  enabled: boolean;
  mode: VisualMode;
  obstructed: boolean;
};

function deterministicUnit(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

export function moderateRainDropCount(coarsePointer: boolean): number {
  return coarsePointer ? 320 : 700;
}

export function createModerateRain(coarsePointer: boolean): ModerateRain {
  const count = moderateRainDropCount(coarsePointer);
  const geometry = new BoxGeometry(
    DROP_WIDTH_M,
    DROP_LENGTH_M,
    DROP_WIDTH_M,
  );
  const material = new MeshBasicMaterial({
    color: 0x7ea9bb,
    depthTest: true,
    depthWrite: false,
    opacity: 0.62,
    transparent: true,
  });
  material.name = "Moderate rain unlit material";
  material.toneMapped = false;

  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "Moderate rain instanced drops";
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 18;

  const drops: RainDrop[] = [];
  const dummy = new Object3D();
  dummy.rotation.z = -0.075;
  for (let index = 0; index < count; index += 1) {
    const angle = deterministicUnit(index, 1) * Math.PI * 2;
    const radius = Math.sqrt(deterministicUnit(index, 2)) * RAIN_RADIUS_M;
    const drop = {
      lengthScale: 0.62 + deterministicUnit(index, 6) * 0.78,
      speedMps: 42 + deterministicUnit(index, 5) * 24,
      widthScale: 0.72 + deterministicUnit(index, 7) * 0.56,
      x: Math.cos(angle) * radius,
      y: deterministicUnit(index, 3) * RAIN_HEIGHT_M,
      z: Math.sin(angle) * radius,
    };
    drops.push(drop);
    dummy.position.set(drop.x, drop.y, drop.z);
    dummy.scale.set(drop.widthScale, drop.lengthScale, drop.widthScale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;

  const group = new Group();
  group.name = "Moderate rain field";
  group.visible = false;
  group.add(mesh);
  return {
    drops,
    group,
    material,
    matrixHelper: dummy,
    matrixMode: "day",
    mesh,
  };
}

export function setRainPresentation(
  rain: ModerateRain,
  { enabled, mode, obstructed }: RainPresentation,
): boolean {
  // Snowstorm owns the precipitation layer; keeping rain active underneath
  // creates an incoherent mixed-weather mode and wastes a continuous draw.
  const visible = enabled && !obstructed && mode !== "snowstorm";
  let changed = rain.group.visible !== visible;
  rain.group.visible = visible;

  const color =
    mode === "night" ? 0x9bc9e2 : mode === "minecraft" ? 0x55bdec : 0x7ea9bb;
  const opacity = mode === "night" ? 0.72 : mode === "minecraft" ? 0.78 : 0.62;
  if (rain.material.color.getHex() !== color) {
    rain.material.color.setHex(color);
    changed = true;
  }
  if (Math.abs(rain.material.opacity - opacity) > 1e-6) {
    rain.material.opacity = opacity;
    changed = true;
  }
  return changed;
}

export function updateModerateRain(
  rain: ModerateRain,
  deltaSeconds: number,
  focus: Vector3,
  mode: VisualMode,
): void {
  if (!rain.group.visible) {
    return;
  }
  rain.group.position.set(
    focus.x,
    Math.max(-18, Math.min(24, focus.y - 24)),
    focus.z,
  );
  const modeWidthScale = mode === "minecraft" ? 2.25 : 1;
  const dummy = rain.matrixHelper;
  const rebuildTransforms = rain.matrixMode !== mode;
  const matrixElements = rain.mesh.instanceMatrix.array as Float32Array;
  if (rebuildTransforms) {
    dummy.rotation.z = mode === "minecraft" ? -0.04 : -0.075;
  }
  const elapsed = Math.min(Math.max(deltaSeconds, 0), 0.1);
  for (let index = 0; index < rain.drops.length; index += 1) {
    const drop = rain.drops[index];
    drop.y -= drop.speedMps * elapsed;
    while (drop.y < 0) {
      drop.y += RAIN_HEIGHT_M;
    }
    if (rebuildTransforms) {
      dummy.position.set(drop.x, drop.y, drop.z);
      dummy.scale.set(
        drop.widthScale * modeWidthScale,
        drop.lengthScale,
        drop.widthScale * modeWidthScale,
      );
      dummy.updateMatrix();
      rain.mesh.setMatrixAt(index, dummy.matrix);
    } else {
      // Position Y is the sole changing matrix component between mode changes.
      matrixElements[index * 16 + 13] = drop.y;
    }
  }
  rain.matrixMode = mode;
  rain.mesh.instanceMatrix.needsUpdate = true;
}
