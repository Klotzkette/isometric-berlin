import {
  BackSide, BoxGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Path, Quaternion, Shape,
  ShapeGeometry, Vector3, type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { StreetLight } from "./ParkDetails";
import {
  appendGovernmentStreetLampsV286, GOVERNMENT_STREET_LAMP_UNDERSIDE_V286,
  GOVERNMENT_STREET_LAMPS_V286, type GovernmentStreetLampPartsV286,
} from "./GovernmentStreetLampsV286";
import { GOVERNMENT_STREET_LAMP_ANCHORS_V286 } from "./governmentStreetFurnitureV286Profile";
import { admitGovernmentStreetLampsV286, SOURCE_LAMP_RECEIPTS_V286 } from "./governmentStreetFurnitureV286Ownership";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const GOVERNMENT_STREET_LAMP_BATCH_V286 = "Government-quarter photo street lamps v286";
export type GovernmentStreetFurnitureTerrainAtV286 = (x: number, z: number, sourceY: number) => number;
type Vec = [number, number, number];
type Ground = { id: string; x: number; z: number; groundY: number; source: boolean };

/** The nearest complete source segment supplies a finite conservative datum
 * where no terrain sampler is present. Source endpoints are never moved. */
function interpolateSourceGround(x: number, z: number, sources: readonly Ground[]): number {
  let distance = Infinity, result = sources[0].groundY;
  for (let i = 0; i < sources.length; i++) for (let j = i + 1; j < sources.length; j++) {
    const a = sources[i], b = sources[j], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const d = (x - a.x - dx * t) ** 2 + (z - a.z - dz * t) ** 2;
    if (d < distance) { distance = d; result = a.groundY + (b.groundY - a.groundY) * t; }
  }
  return result;
}

class LampParts implements GovernmentStreetLampPartsV286 {
  readonly native = false;
  readonly matrices: number[] = [];
  readonly colors: number[] = [];
  readonly plates: BufferGeometry[] = [];
  readonly undersides: BufferGeometry[] = [];
  members = 0;
  private matrix = new Matrix4();
  private color = new Color();
  box(position: Vec, size: Vec, tint: number, yaw = 0): void {
    this.matrix.compose(new Vector3(...position), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw), new Vector3(...size));
    this.matrix.toArray(this.matrices, this.matrices.length);
    this.color.setHex(tint).toArray(this.colors, this.colors.length); this.members++;
  }
  beam(a: Vec, b: Vec, width: number, height: number, tint: number): void {
    const direction = new Vector3(...b).sub(new Vector3(...a));
    if (direction.lengthSq() < 1e-12) return;
    this.matrix.compose(new Vector3(...a).add(new Vector3(...b)).multiplyScalar(.5),
      new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), direction.clone().normalize()),
      new Vector3(width, height, direction.length()));
    this.matrix.toArray(this.matrices, this.matrices.length);
    this.color.setHex(tint).toArray(this.colors, this.colors.length); this.members++;
  }
  polygon(ring: readonly number[][], holes: readonly number[][][], heightAt: (x: number, z: number) => number, tint: number): void {
    const shape = new Shape();
    ring.forEach((p, i) => i ? shape.lineTo(p[0], -p[1]) : shape.moveTo(p[0], -p[1]));
    for (const ring of holes) {
      const hole = new Path(); ring.forEach((p, i) => i ? hole.lineTo(p[0], -p[1]) : hole.moveTo(p[0], -p[1]));
      shape.holes.push(hole);
    }
    const geometry = new ShapeGeometry(shape); geometry.deleteAttribute("uv"); geometry.rotateX(-Math.PI / 2);
    const positions = geometry.getAttribute("position"), colors = new Float32Array(positions.count * 3);
    this.color.setHex(tint);
    for (let i = 0; i < positions.count; i++) {
      positions.setY(i, heightAt(positions.getX(i), positions.getZ(i))); this.color.toArray(colors, i * 3);
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
    (tint === GOVERNMENT_STREET_LAMP_UNDERSIDE_V286 ? this.undersides : this.plates).push(geometry); this.members++;
  }
}

/** Atomic companion to ParkDetails' original generic-light loop. Only a
 * complete, admitted profile family permits its exact source owners to
 * yield. A failed terrain or construction step leaves every generic intact. */
export function createGovernmentStreetLampBatchV286(
  lights: readonly StreetLight[], terrainAt?: GovernmentStreetFurnitureTerrainAtV286,
): Group | null {
  if (!admitGovernmentStreetLampsV286(lights)) return null;
  const parts = new LampParts(), root = new Group(); root.name = GOVERNMENT_STREET_LAMP_BATCH_V286;
  const resources: { dispose(): void }[] = [];
  try {
    const sourceIds = new Set<string>(SOURCE_LAMP_RECEIPTS_V286.map(light => light.id));
    const sources = lights.filter(light => sourceIds.has(light.id)).map(light => ({
      id: light.id, x: light.position[0], z: light.position[2], groundY: light.position[1], source: true,
    }));
    const grounds: Ground[] = GOVERNMENT_STREET_LAMP_ANCHORS_V286.map(anchor => {
      const source = sources.find(source => source.id === anchor.id);
      if (source) return source;
      const fallback = interpolateSourceGround(anchor.x, anchor.z, sources);
      const sampled = terrainAt?.(anchor.x, anchor.z, fallback);
      return { id: anchor.id, x: anchor.x, z: anchor.z, groundY: sampled !== undefined && Number.isFinite(sampled) ? sampled : fallback, source: false };
    });
    const byPoint = new Map(grounds.map(ground => [`${ground.x}/${ground.z}`, ground.groundY]));
    appendGovernmentStreetLampsV286(parts, (x, z) => byPoint.get(`${x}/${z}`)!, GOVERNMENT_STREET_LAMP_ANCHORS_V286);
    if (grounds.length !== GOVERNMENT_STREET_LAMP_ANCHORS_V286.length || sources.length !== SOURCE_LAMP_RECEIPTS_V286.length || !parts.matrices.length || !parts.plates.length || !parts.undersides.length)
      throw new Error("Incomplete government street-lamp family");
    const boxes = new BoxGeometry(1, 1, 1); boxes.deleteAttribute("uv"); resources.push(boxes);
    const steel = new MeshStandardMaterial({ color: 0xffffff, roughness: .76, metalness: .2, flatShading: true }); resources.push(steel);
    const body = new InstancedMesh(boxes, steel, parts.colors.length / 3), matrix = new Matrix4(), color = new Color();
    for (let i = 0; i < body.count; i++) {
      body.setMatrixAt(i, matrix.fromArray(parts.matrices, i * 16)); body.setColorAt(i, color.fromArray(parts.colors, i * 3));
    }
    body.name = "Government street-lamp tapered posts, collars, S-necks and rims";
    body.instanceMatrix.needsUpdate = true; if (body.instanceColor) body.instanceColor.needsUpdate = true;
    body.computeBoundingBox(); body.computeBoundingSphere(); body.castShadow = true; body.receiveShadow = true; root.add(body);
    for (const underside of [false, true]) {
      const geometry = mergeGeometries(underside ? parts.undersides : parts.plates, false);
      if (!geometry) throw new Error("Incomplete government street-lamp dish plates"); resources.push(geometry);
      const material = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .86,
        metalness: .12, side: underside ? BackSide : DoubleSide, flatShading: true }); resources.push(material);
      if (underside) { material.userData.nightEmissive = 0xffdf91; material.userData.nightEmissiveIntensity = 4.2; }
      const mesh = new Mesh(geometry, material);
      mesh.name = underside ? "Government street-lamp luminous undersides only" : "Government street-lamp nonluminous upper dishes";
      mesh.userData = { governmentStreetLampUndersideV286: underside, textureFree: true, keepInMinecraft: false };
      mesh.castShadow = !underside; mesh.receiveShadow = true; root.add(mesh);
    }
    root.userData = { governmentStreetLampsV286: GOVERNMENT_STREET_LAMPS_V286,
      replacementSourceIds: [...sourceIds], lampCount: grounds.length, sourceLampCount: sources.length,
      estimatedLampCount: grounds.length - sources.length, memberCount: parts.members, groundAnchors: grounds,
      groundStatus: `${sources.length} exact source datums retained; remaining anchors use supplied terrain or nearest source-segment interpolation`,
      fullStaticDetailOnTouch: true, textureFree: true, keepInMinecraft: false, sourceGeometryRetained: true };
    return freezeStaticSceneTransforms(root);
  } catch {
    for (const resource of resources) resource.dispose(); root.clear(); return null;
  } finally {
    for (const geometry of [...parts.plates, ...parts.undersides]) geometry.dispose();
  }
}
