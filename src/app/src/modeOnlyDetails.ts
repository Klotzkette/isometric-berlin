import {
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { VisualMode } from "./visualMode";

export type SnowBox = {
  position: readonly [number, number, number];
  size: readonly [number, number, number];
};

export type SnowMound = {
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
};

export type SnowRidge = {
  depthM?: number;
  end: readonly [number, number, number];
  start: readonly [number, number, number];
  widthM: number;
};

export type SnowAccentOptions = {
  boxes?: readonly SnowBox[];
  mounds?: readonly SnowMound[];
  name: string;
  ridges?: readonly SnowRidge[];
};

function ridgeGeometry(ridge: SnowRidge): BoxGeometry | null {
  const start = new Vector3(...ridge.start);
  const end = new Vector3(...ridge.end);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length < 1e-5) return null;
  const geometry = new BoxGeometry(
    ridge.widthM,
    length,
    ridge.depthM ?? ridge.widthM,
  );
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      delta.normalize(),
    ),
  );
  geometry.translate(
    (ridge.start[0] + ridge.end[0]) / 2,
    (ridge.start[1] + ridge.end[1]) / 2,
    (ridge.start[2] + ridge.end[2]) / 2,
  );
  return geometry;
}

/**
 * Merge small, physically plausible snow accumulations into one draw call.
 * The parent recognition model supplies all positions in its own local frame;
 * this utility only owns the shared snow material and mode-only contract.
 */
export function createSnowAccents({
  boxes = [],
  mounds = [],
  name,
  ridges = [],
}: SnowAccentOptions): Group {
  const group = new Group();
  group.name = name;
  group.userData.visualModeOnly = "snowstorm" satisfies VisualMode;
  group.visible = false;

  const geometries: BufferGeometry[] = [];
  for (const box of boxes) {
    const geometry = new BoxGeometry(...box.size);
    geometry.translate(...box.position);
    geometries.push(geometry);
  }
  for (const mound of mounds) {
    // A shallow upper hemisphere reads as settled snow, not a white copy of
    // the complete object below it.
    const geometry = new SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    geometry.scale(...mound.scale);
    geometry.translate(...mound.position);
    geometries.push(geometry);
  }
  for (const ridge of ridges) {
    const geometry = ridgeGeometry(ridge);
    if (geometry) geometries.push(geometry);
  }

  const merged = geometries.length > 0 ? mergeGeometries(geometries, false) : null;
  if (merged) {
    const material = new MeshBasicMaterial({
      color: 0xf4f7f7,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    material.toneMapped = false;
    const snow = new Mesh(merged, material);
    snow.name = `${name} merged snow surface`;
    snow.castShadow = true;
    snow.receiveShadow = true;
    group.add(snow);
  }
  for (const geometry of geometries) geometry.dispose();
  return group;
}

/** Switch every explicitly mode-only descendant without rebuilding geometry. */
export function setModeOnlyDetails(root: Group, mode: VisualMode): void {
  root.traverse((object) => {
    const only = object.userData.visualModeOnly;
    if (
      only === "day" ||
      only === "night" ||
      only === "minecraft" ||
      only === "snowstorm" ||
      only === "schwellenraum"
    ) {
      object.visible = only === mode;
    }
  });
}
