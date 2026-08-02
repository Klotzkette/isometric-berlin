import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { MONUMENT_INK } from "./TiergartenMonuments";

/**
 * The flat-tone + ink-line kit the drawn accessory layers share.
 *
 * Every drawn group in the viewer follows the same recipe: solid-colour
 * boxes merged into one mesh, an `EdgesGeometry` outline merged into one
 * `LineSegments`, and a day/night material pair swapped by the tone rig.
 * Keeping it here means a new accessory is a list of boxes, not another
 * copy of the plumbing.
 */

export type Builder = {
  edges: BufferGeometry[];
  /** Optional second mesh that glows after dark (lampions, signs). */
  lamps: BufferGeometry[];
  parts: BufferGeometry[];
};

export function createBuilder(): Builder {
  return { edges: [], lamps: [], parts: [] };
}

export function paintGeometry(geometry: BufferGeometry, color: number): void {
  geometry.deleteAttribute("uv");
  const shade = new Color(color);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    colors[index * 3] = shade.r;
    colors[index * 3 + 1] = shade.g;
    colors[index * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
}

export function addBox(
  builder: Builder,
  color: number,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  rotationY = 0,
  inked = true,
): void {
  const geometry = new BoxGeometry(sx, sy, sz);
  if (rotationY !== 0) {
    geometry.rotateY(rotationY);
  }
  geometry.translate(cx, cy, cz);
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  if (inked) {
    builder.edges.push(new EdgesGeometry(geometry, 24));
  }
}

export function addCone(
  builder: Builder,
  color: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  height: number,
  segments: number,
  inked = true,
): void {
  const geometry = new CylinderGeometry(0, radius, height, segments);
  geometry.translate(cx, cy, cz);
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  if (inked) {
    builder.edges.push(new EdgesGeometry(geometry, 24));
  }
}

export function addCylinder(
  builder: Builder,
  color: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  height: number,
  segments: number,
  lamp = false,
): void {
  const geometry = new CylinderGeometry(radius, radius, height, segments);
  geometry.translate(cx, cy, cz);
  paintGeometry(geometry, color);
  (lamp ? builder.lamps : builder.parts).push(geometry);
}

export type DrawnGroupOptions = {
  /** Emissive colour for the `lamps` mesh after dark. */
  lampEmissive?: number;
  lampEmissiveIntensity?: number;
  /** Base name; meshes become "<name> bodies" / "<name> ink lines". */
  name: string;
};

/**
 * Merge a builder into the standard group. Returns null when nothing was
 * drawn, so callers can skip adding an empty group to the scene.
 */
export function finishDrawnGroup(
  builder: Builder,
  options: DrawnGroupOptions,
): Group | null {
  if (builder.parts.length === 0 && builder.lamps.length === 0) {
    return null;
  }
  const group = new Group();
  group.name = options.name;

  const merged = mergeGeometries(builder.parts, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.name = `${options.name} bodies`;
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    group.add(mesh);
    for (const part of builder.parts) {
      part.dispose();
    }
  }
  const lampGeometry = mergeGeometries(builder.lamps, false);
  if (lampGeometry) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.6,
      vertexColors: true,
    });
    nightMaterial.userData.nightEmissive = options.lampEmissive ?? 0xffb457;
    nightMaterial.userData.nightEmissiveIntensity =
      options.lampEmissiveIntensity ?? 1.1;
    const lamps = new Mesh(lampGeometry, dayMaterial);
    lamps.name = `${options.name} lamps`;
    lamps.userData.dayMaterial = dayMaterial;
    lamps.userData.nightMaterial = nightMaterial;
    group.add(lamps);
    for (const lamp of builder.lamps) {
      lamp.dispose();
    }
  }
  const inkGeometry = mergeGeometries(builder.edges, false);
  if (inkGeometry) {
    const ink = new LineSegments(
      inkGeometry,
      new LineBasicMaterial({ color: MONUMENT_INK }),
    );
    ink.name = `${options.name} ink lines`;
    ink.renderOrder = 2;
    group.add(ink);
    for (const edge of builder.edges) {
      edge.dispose();
    }
  }
  return group;
}

/** Every mesh name `finishDrawnGroup` can produce, for the tone rig. */
export function drawnGroupMeshNames(name: string): string[] {
  return [`${name} bodies`, `${name} lamps`];
}
