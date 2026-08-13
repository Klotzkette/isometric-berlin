/**
 * Surface approaches of the Tiergartentunnel (B 96).
 *
 * The public scene manifest carries four OSM-derived access sites and each
 * mapped carriageway separately. This matters: Minna-Cauer-Strasse,
 * Invalidenstrasse, Kemperplatz and Reichpietschufer have different widths,
 * alignments and portal levels. Treating one averaged line as two identical
 * roads produced crossing ribbons and oversized grey headwalls.
 *
 * Horizontal geometry and lane evidence come from OSM. Surface and mouth
 * heights are sampled from the packaged official Berlin 3D mesh; only the
 * smooth grade between those samples is an explicit presentation estimate.
 */

import {
  BufferGeometry,
  BoxGeometry,
  CircleGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Material,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { createLetteringTexture } from "./drawnLettering";

export type TunnelPortalId =
  "invalidenstrasse" | "kemperplatz" | "minna_cauer" | "reichpietschufer";

export type TunnelPortalCarriageway = {
  id: string;
  lane_count: number;
  osm_way_ids: string[];
  points: [number, number, number][];
  widths_m: number[];
};

export type TunnelPortalApproach = {
  carriageways: TunnelPortalCarriageway[];
  geometry_status: string;
  label: string;
  structure: "open_cut" | "rail_deck";
};

export type TunnelPortalPayload = {
  clear_height_m: number;
  clear_width_each_direction_m: number;
  portal_approaches?: Partial<Record<TunnelPortalId, TunnelPortalApproach>>;
  points: [number, number, number][];
};

export type TunnelPortalCourse = {
  clear_height_m?: number;
  clear_width_each_direction_m?: number;
  portal_approaches?: Partial<
    Record<
      TunnelPortalId,
      {
        carriageways: readonly {
          id: string;
          lane_count: number;
          osm_way_ids: readonly string[];
          points: readonly (readonly [number, number, number])[];
          widths_m: readonly number[];
        }[];
        geometry_status: string;
        label: string;
        structure: "open_cut" | "rail_deck";
      }
    >
  >;
  points: readonly (readonly [number, number, number])[];
};

export type TunnelPortalCourseInput =
  TunnelPortalCourse | readonly (readonly [number, number, number])[];

/** Small overlap with the mapped surface road, avoiding a quantised seam. */
export const PORTAL_APPROACH_M = 8;

const PORTAL_ROOF_DEPTH_M = 0.8;
const WALL_THICKNESS_M = 0.5;
const RAIL_HEIGHT_M = 1.15;
const BORE_LENGTH_M = 46;
const PORTAL_FACE_DEPTH_M = 1.55;
const PORTAL_INTERIOR_FLAG = "tiergartentunnelPortalInterior";
const PORTAL_SHADOW_FLAG = "tiergartentunnelPortalShadow";
const PORTAL_SURFACE_MATERIAL_FLAG = "tiergartentunnelPortalSurfaceMaterial";
const PRESERVE_AUTHORED_DARK_FLAG = "preserveAuthoredDark";

const CONCRETE = 0xb9b8b0;
const ASPHALT = 0x343a3f;
const RAILING = 0x3f4948;
const MARKING = 0xf1eee2;

function surfaceMaterial(
  color: number,
  options: { metalness?: number; roughness?: number } = {},
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color,
    depthTest: true,
    depthWrite: true,
    flatShading: true,
    metalness: options.metalness ?? 0.06,
    roughness: options.roughness ?? 0.86,
  });
  material.userData[PORTAL_SURFACE_MATERIAL_FLAG] = true;
  return material;
}

function interiorMaterial(
  color: number,
  options: { metalness?: number; roughness?: number } = {},
): MeshStandardMaterial {
  const material = surfaceMaterial(color, options);
  delete material.userData[PORTAL_SURFACE_MATERIAL_FLAG];
  material.userData[PRESERVE_AUTHORED_DARK_FLAG] = true;
  return material;
}

function segmentNormal(from: Vector3, to: Vector3): Vector3 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const run = Math.hypot(dx, dz) || 1;
  return new Vector3(-dz / run, 0, dx / run);
}

/** Joined offsets keep road edges watertight through mapped bends. */
function miterOffsets(points: Vector3[]): Vector3[] {
  const normals = points
    .slice(0, -1)
    .map((point, index) => segmentNormal(point, points[index + 1]));
  return points.map((_point, index) => {
    if (index === 0) {
      return normals[0].clone();
    }
    if (index === points.length - 1) {
      return normals.at(-1)!.clone();
    }
    const incoming = normals[index - 1];
    const outgoing = normals[index];
    const miter = incoming.clone().add(outgoing);
    if (miter.lengthSq() < 1e-6) {
      return outgoing.clone();
    }
    miter.normalize();
    const projection = Math.max(0.2, miter.dot(outgoing));
    return miter.multiplyScalar(Math.min(1 / projection, 1.35));
  });
}

function atIndex(value: number | readonly number[], index: number): number {
  return typeof value === "number" ? value : value[index];
}

function roadRibbonGeometry(
  points: Vector3[],
  offsets: Vector3[],
  centreOffset: number | readonly number[],
  halfWidth: number | readonly number[],
): BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const centre = atIndex(centreOffset, index);
    const half = atIndex(halfWidth, index);
    for (const edgeOffset of [centre - half, centre + half]) {
      const vertex = points[index]
        .clone()
        .addScaledVector(offsets[index], edgeOffset);
      vertices.push(vertex.x, vertex.y, vertex.z);
    }
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = index * 2;
    const next = current + 2;
    indices.push(current, current + 1, next, current + 1, next + 1, next);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function wallGeometry(
  points: Vector3[],
  offsets: Vector3[],
  centreOffset: number | readonly number[],
  thickness: number,
  bottomAt: (point: Vector3, index: number) => number,
  topAt: (point: Vector3, index: number) => number,
): BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const bottom = bottomAt(point, index);
    const top = Math.max(bottom + 0.02, topAt(point, index));
    const centre = atIndex(centreOffset, index);
    for (const edgeOffset of [centre - thickness / 2, centre + thickness / 2]) {
      const edge = point.clone().addScaledVector(offsets[index], edgeOffset);
      vertices.push(edge.x, bottom, edge.z, edge.x, top, edge.z);
    }
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = index * 4;
    const next = current + 4;
    indices.push(
      current,
      next,
      current + 1,
      current + 1,
      next,
      next + 1,
      current + 2,
      current + 3,
      next + 2,
      current + 3,
      next + 3,
      next + 2,
      current + 1,
      next + 1,
      current + 3,
      current + 3,
      next + 1,
      next + 3,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function addMesh(
  group: Group,
  name: string,
  geometry: BufferGeometry | BoxGeometry,
  material: Material,
  renderOrder: number,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.renderOrder = renderOrder;
  group.add(mesh);
  return mesh;
}

function closestPointOnCourse(points: Vector3[], anchor: Vector3): Vector3 {
  let closest = points[0].clone();
  let closestDistanceSquared = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const lengthSquared = dx * dx + dz * dz;
    const fraction =
      lengthSquared > 1e-8
        ? MathUtils.clamp(
            ((anchor.x - from.x) * dx + (anchor.z - from.z) * dz) /
              lengthSquared,
            0,
            1,
          )
        : 0;
    const candidate = from.clone().lerp(to, fraction);
    const distanceSquared =
      (candidate.x - anchor.x) ** 2 + (candidate.z - anchor.z) ** 2;
    if (distanceSquared < closestDistanceSquared) {
      closest = candidate;
      closestDistanceSquared = distanceSquared;
    }
  }
  return closest;
}

function normalizePortalCourse(
  payload: TunnelPortalCourseInput,
): TunnelPortalCourse {
  return Array.isArray(payload)
    ? { points: payload as readonly (readonly [number, number, number])[] }
    : (payload as TunnelPortalCourse);
}

type PortalRamp = {
  carriagewayId: string;
  centreline: Vector3[];
  id: TunnelPortalId;
  laneCount: number;
  structure: "open_cut" | "rail_deck";
  tunnelJoin: Vector3;
  widths: number[];
};

export type TunnelWalkCourse = {
  halfWidthM: number;
  kind: "portal" | "tube";
  points: readonly (readonly [number, number, number])[];
};

type PortalMaterials = {
  concrete: MeshStandardMaterial;
  marking: MeshStandardMaterial;
  portalConcrete: MeshStandardMaterial;
  railing: MeshStandardMaterial;
  road: MeshStandardMaterial;
  shadow: MeshStandardMaterial;
  signal: MeshStandardMaterial;
  signalStop: MeshStandardMaterial;
  speedSign: MeshStandardMaterial;
  speedSignFace: Material;
  wallLight: MeshStandardMaterial;
};

type PortalAxis = {
  inward: Vector3;
  normal: Vector3;
  yaw: number;
};

/** One shared tunnel bearing starts behind both mapped carriageway mouths. */
function sharedPortalAxis(ramps: readonly PortalRamp[]): PortalAxis {
  const directions = ramps.map((ramp) => {
    const points = ramp.centreline;
    const direction = points.at(-1)!.clone().sub(points.at(-2)!);
    direction.y = 0;
    return direction.normalize();
  });
  const inward = directions.reduce(
    (sum, direction) => sum.add(direction),
    new Vector3(),
  );
  if (inward.lengthSq() < 1e-6) {
    inward.copy(directions[0] ?? new Vector3(0, 0, 1));
  }
  inward.normalize();
  return {
    inward,
    normal: new Vector3(-inward.z, 0, inward.x),
    yaw: Math.atan2(inward.x, inward.z),
  };
}

function portalClearHeight(
  height: number,
  structure: PortalRamp["structure"],
): number {
  return Math.min(height, structure === "rail_deck" ? 4.35 : 4.2);
}

function portalRamps(payloadInput: TunnelPortalCourseInput): PortalRamp[] {
  const payload = normalizePortalCourse(payloadInput);
  const tunnelPoints = payload.points.map(
    (point) => new Vector3(point[0], point[1], point[2]),
  );
  if (tunnelPoints.length < 2 || !payload.portal_approaches) {
    return [];
  }
  const clearHeight = payload.clear_height_m ?? 5;
  const tubeOffset =
    (payload.clear_width_each_direction_m ?? 10.5) / 2 + 0.85;
  const tunnelOffsets = miterOffsets(tunnelPoints);
  const tubeCourses = [-1, 1].map((side) =>
    tunnelPoints.map((point, index) =>
      point.clone().addScaledVector(tunnelOffsets[index], side * tubeOffset),
    ),
  );
  const ramps: PortalRamp[] = [];
  for (const [id, approach] of Object.entries(payload.portal_approaches) as [
    TunnelPortalId,
    NonNullable<TunnelPortalCourse["portal_approaches"]>[TunnelPortalId],
  ][]) {
    if (!approach) {
      continue;
    }
    for (const carriageway of approach.carriageways) {
      const centreline = carriageway.points.map(
        (point) => new Vector3(point[0], point[1], point[2]),
      );
      if (
        centreline.length < 2 ||
        carriageway.widths_m.length !== centreline.length
      ) {
        continue;
      }
      const lengthM = centreline.slice(1).reduce((total, point, index) => {
        const previous = centreline[index];
        return total + Math.hypot(point.x - previous.x, point.z - previous.z);
      }, 0);
      // A malformed manifest must never punch or paint a cross-city stripe.
      if (lengthM < 20 || lengthM > 220) {
        continue;
      }
      const head = centreline.at(-1)!;
      const outward = centreline.at(-2)!.clone().sub(head).setY(0).normalize();
      const projectedInside = head
        .clone()
        .addScaledVector(outward, -BORE_LENGTH_M);
      const joinCandidates = tubeCourses.map((course) =>
        closestPointOnCourse(course, projectedInside),
      );
      const tunnelJoin = joinCandidates.reduce((closest, candidate) =>
        candidate.distanceToSquared(projectedInside) <
        closest.distanceToSquared(projectedInside)
          ? candidate
          : closest,
      );
      tunnelJoin.y -= clearHeight / 2 - 0.4;
      ramps.push({
        carriagewayId: carriageway.id,
        centreline,
        id,
        laneCount: Math.max(1, Math.round(carriageway.lane_count)),
        structure: approach.structure,
        tunnelJoin,
        widths: carriageway.widths_m.map((width) =>
          MathUtils.clamp(width, 3, 15),
        ),
      });
    }
  }
  return ramps;
}

function portalBoreCourse(
  ramp: PortalRamp,
  portalAxis: PortalAxis,
): Vector3[] {
  const head = ramp.centreline.at(-1)!;
  const mouth = head.clone().addScaledVector(portalAxis.inward, 0.7);
  const join = ramp.tunnelJoin.clone();
  const horizontalRun = Math.hypot(join.x - mouth.x, join.z - mouth.z);
  const control = mouth
    .clone()
    .addScaledVector(portalAxis.inward, Math.min(22, horizontalRun * 0.48));
  control.y = MathUtils.lerp(mouth.y, join.y, 0.48);
  return [mouth, control, join];
}

/** Shared geometry contract for the visible ramps and manual walking layer. */
export function tunnelWalkCourses(
  payloadInput: TunnelPortalCourseInput,
): TunnelWalkCourse[] {
  const payload = normalizePortalCourse(payloadInput);
  const height = payload.clear_height_m ?? 5;
  const width = payload.clear_width_each_direction_m ?? 10.5;
  const tunnelPoints = payload.points.map(
    (point) => new Vector3(point[0], point[1], point[2]),
  );
  if (tunnelPoints.length < 2) {
    return [];
  }
  const offsets = miterOffsets(tunnelPoints);
  const tubeOffset = width / 2 + 0.85;
  const courses: TunnelWalkCourse[] = [-1, 1].map((side) => ({
    halfWidthM: (width - 0.7) / 2,
    kind: "tube",
    points: tunnelPoints.map((point, index) => {
      const floor = point
        .clone()
        .addScaledVector(offsets[index], side * tubeOffset);
      floor.y -= height / 2 - 0.4;
      return [floor.x, floor.y, floor.z] as const;
    }),
  }));
  const ramps = portalRamps(payload);
  for (const id of new Set(ramps.map((ramp) => ramp.id))) {
    const siteRamps = ramps.filter((ramp) => ramp.id === id);
    const axis = sharedPortalAxis(siteRamps);
    for (const ramp of siteRamps) {
      const entrance = ramp.centreline[0];
      const inwardAtEntrance = ramp.centreline[1].clone().sub(entrance);
      inwardAtEntrance.y = 0;
      inwardAtEntrance.normalize();
      const approach = entrance
        .clone()
        .addScaledVector(inwardAtEntrance, -PORTAL_APPROACH_M);
      approach.y = entrance.y;
      const bore = portalBoreCourse(ramp, axis);
      const points = [approach, ...ramp.centreline, ...bore.slice(1)];
      courses.push({
        halfWidthM: Math.max(...ramp.widths) / 2,
        kind: "portal",
        points: points.map((point) => [point.x, point.y, point.z] as const),
      });
    }
  }
  return courses;
}

/** Tests a camera against the actual tubes and ramps, not their city-wide AABB. */
export function createTunnelInteriorTester(
  payloadInput: TunnelPortalCourseInput,
): (x: number, y: number, z: number) => boolean {
  const clearHeight = normalizePortalCourse(payloadInput).clear_height_m ?? 5;
  const segments = tunnelWalkCourses(payloadInput).flatMap((course) =>
    course.points.slice(0, -1).map((from, index) => {
      const to = course.points[index + 1];
      const dx = to[0] - from[0];
      const dz = to[2] - from[2];
      return {
        dx,
        dz,
        from,
        halfWidthM: course.halfWidthM + 0.55,
        lengthSquared: dx * dx + dz * dz,
        to,
      };
    }),
  );
  return (x: number, y: number, z: number): boolean => {
    for (const segment of segments) {
      const progress =
        segment.lengthSquared > 1e-8
          ? MathUtils.clamp(
              ((x - segment.from[0]) * segment.dx +
                (z - segment.from[2]) * segment.dz) /
                segment.lengthSquared,
              0,
              1,
            )
          : 0;
      const floorY = MathUtils.lerp(segment.from[1], segment.to[1], progress);
      if (y < floorY - 0.8 || y > floorY + clearHeight + 1.1) {
        continue;
      }
      const closestX = MathUtils.lerp(segment.from[0], segment.to[0], progress);
      const closestZ = MathUtils.lerp(segment.from[2], segment.to[2], progress);
      if (
        (x - closestX) ** 2 + (z - closestZ) ** 2 <=
        segment.halfWidthM ** 2
      ) {
        return true;
      }
    }
    return false;
  };
}

export function createTunnelPortalApproachTester(
  payload: TunnelPortalCourseInput,
  cellHalfDiagonalM = 0,
): (x: number, z: number, shoulderM?: number) => boolean {
  const courses = portalRamps(payload).map((ramp) => {
    const entrance = ramp.centreline[0];
    const inward = ramp.centreline[1].clone().sub(entrance);
    inward.y = 0;
    inward.normalize();
    const approach = entrance
      .clone()
      .addScaledVector(inward, -PORTAL_APPROACH_M);
    const route = [approach, ...ramp.centreline];
    const halfWidth = Math.max(...ramp.widths) / 2 + 1.15;
    return {
      halfWidth,
      maxX: Math.max(...route.map((point) => point.x)),
      maxZ: Math.max(...route.map((point) => point.z)),
      minX: Math.min(...route.map((point) => point.x)),
      minZ: Math.min(...route.map((point) => point.z)),
      segments: route.slice(0, -1).map((from, index) => {
        const to = route[index + 1];
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        return {
          dx,
          dz,
          fromX: from.x,
          fromZ: from.z,
          lengthSquared: dx * dx + dz * dz,
          maxX: Math.max(from.x, to.x),
          maxZ: Math.max(from.z, to.z),
          minX: Math.min(from.x, to.x),
          minZ: Math.min(from.z, to.z),
        };
      }),
    };
  });
  return (x: number, z: number, shoulderM = 0): boolean => {
    for (const course of courses) {
      const halfWidth =
        course.halfWidth +
        Math.max(0, shoulderM) +
        Math.max(0, cellHalfDiagonalM);
      const distanceSquared = halfWidth * halfWidth;
      if (
        x < course.minX - halfWidth ||
        x > course.maxX + halfWidth ||
        z < course.minZ - halfWidth ||
        z > course.maxZ + halfWidth
      ) {
        continue;
      }
      for (const segment of course.segments) {
        if (
          x < segment.minX - halfWidth ||
          x > segment.maxX + halfWidth ||
          z < segment.minZ - halfWidth ||
          z > segment.maxZ + halfWidth
        ) {
          continue;
        }
        const t =
          segment.lengthSquared > 1e-6
            ? MathUtils.clamp(
                ((x - segment.fromX) * segment.dx +
                  (z - segment.fromZ) * segment.dz) /
                  segment.lengthSquared,
                0,
                1,
              )
            : 0;
        const deltaX = x - (segment.fromX + segment.dx * t);
        const deltaZ = z - (segment.fromZ + segment.dz * t);
        if (deltaX * deltaX + deltaZ * deltaZ <= distanceSquared) {
          return true;
        }
      }
    }
    return false;
  };
}

export function pointInsideTunnelPortalApproach(
  payload: TunnelPortalCourseInput,
  x: number,
  z: number,
  shoulderM = 0,
): boolean {
  return createTunnelPortalApproachTester(payload)(x, z, shoulderM);
}

/**
 * Surface approaches remain in every above-ground style. The recessed dark
 * mouth is always present: the coarse terrain cut ends at the measured portal
 * threshold. Exterior mouth close-ups retain that depth-tested shadow instead
 * of painting the buried bore through its roof and surrounding buildings. The
 * continuous interior is revealed only while the pedestrian is physically
 * inside the tunnel; ordinary exterior and landmark views remain occluded.
 */
export function setTunnelPortalPresentation(
  group: Group,
  underside: boolean,
  _voxelMode: boolean,
  revealInterior = false,
): void {
  group.visible = !underside;
  const interiorVisible = revealInterior && !underside;
  group.traverse((object) => {
    if (object.userData[PORTAL_INTERIOR_FLAG] === true) {
      object.visible = interiorVisible;
    }
    if (object.userData[PORTAL_SHADOW_FLAG] === true) {
      object.visible = !underside;
    }
  });
}

function addCarriageway(
  group: Group,
  ramp: PortalRamp,
  height: number,
  materials: PortalMaterials,
  portalAxis: PortalAxis,
): void {
  const label = `Tiergartentunnel ${ramp.id} ${ramp.carriagewayId} ramp`;
  const entrance = ramp.centreline[0];
  const inwardAtEntrance = ramp.centreline[1].clone().sub(entrance);
  inwardAtEntrance.y = 0;
  inwardAtEntrance.normalize();
  const approach = entrance
    .clone()
    .addScaledVector(inwardAtEntrance, -PORTAL_APPROACH_M);
  approach.y = entrance.y;
  const route = [approach, ...ramp.centreline];
  const widths = [ramp.widths[0], ...ramp.widths];
  const halfWidths = widths.map((width) => width / 2);
  const offsets = miterOffsets(route);
  const deck = addMesh(
    group,
    `${label} carriageway deck`,
    roadRibbonGeometry(route, offsets, 0, halfWidths),
    materials.road,
    30,
  );
  deck.userData.carriagewayId = ramp.carriagewayId;
  deck.userData.maximumWidthM = Math.max(...widths);
  deck.userData.minimumY = Math.min(...route.map((point) => point.y));
  deck.userData.maximumY = Math.max(...route.map((point) => point.y));
  deck.userData.osmProfileSamples = route.length;
  deck.userData.portalId = ramp.id;

  const head = ramp.centreline.at(-1)!;
  const clearHeight = portalClearHeight(height, ramp.structure);
  const portalTopY = head.y + clearHeight + PORTAL_ROOF_DEPTH_M;
  const wallTops = route.map((point, index) => {
    const progress = index / Math.max(1, route.length - 1);
    const eased = progress * progress * (3 - 2 * progress);
    return Math.max(
      point.y + 0.22,
      MathUtils.lerp(route[0].y + 0.25, portalTopY, eased),
    );
  });

  for (const edge of [-1, 1]) {
    const edgeMarkOffsets = widths.map(
      (width) => edge * (width / 2 - Math.min(0.28, width * 0.06)),
    );
    addMesh(
      group,
      `${label} solid edge marking`,
      roadRibbonGeometry(
        route.map((point) => point.clone().add(new Vector3(0, 0.035, 0))),
        offsets,
        edgeMarkOffsets,
        0.09,
      ),
      materials.marking,
      44,
    );

    addMesh(
      group,
      `${label} maintenance verge`,
      roadRibbonGeometry(
        route.map((point) => point.clone().add(new Vector3(0, 0.018, 0))),
        offsets,
        widths.map((width) => edge * (width / 2 + 0.42)),
        0.36,
      ),
      materials.concrete,
      33,
    );

    addMesh(
      group,
      `${label} retaining wall`,
      wallGeometry(
        route,
        offsets,
        widths.map((width) => edge * (width / 2 + 0.78 + WALL_THICKNESS_M / 2)),
        WALL_THICKNESS_M,
        (point) => point.y - 0.22,
        (_point, index) => wallTops[index],
      ),
      materials.concrete,
      35,
    );

    const railOffsets = widths.map((width) => edge * (width / 2 + 1.06));
    addMesh(
      group,
      `${label} safety railing`,
      wallGeometry(
        route,
        offsets,
        railOffsets,
        0.11,
        (_point, index) => wallTops[index] + 0.04,
        (_point, index) => {
          const progress = index / Math.max(1, route.length - 1);
          return wallTops[index] + RAIL_HEIGHT_M * Math.min(1, progress * 5);
        },
      ),
      materials.railing,
      40,
    );

    const linedRoute = route.slice(Math.floor(route.length * 0.52));
    const linedOffsets = offsets.slice(Math.floor(route.length * 0.52));
    const linedWidths = widths.slice(Math.floor(route.length * 0.52));
    const linedWallTops = wallTops.slice(Math.floor(route.length * 0.52));
    const slatGeometries = Array.from({ length: 7 }, (_unused, slat) =>
      wallGeometry(
        linedRoute,
        linedOffsets,
        linedWidths.map((width) => edge * (width / 2 + 0.76)),
        0.035,
        (point, index) =>
          Math.min(point.y + 0.65 + slat * 0.47, linedWallTops[index] - 0.18),
        (point, index) =>
          Math.min(point.y + 0.73 + slat * 0.47, linedWallTops[index] - 0.1),
      ),
    );
    const slats = mergeGeometries(slatGeometries, false);
    slatGeometries.forEach((geometry) => geometry.dispose());
    if (slats) {
      addMesh(
        group,
        `${label} acoustic wall slats`,
        slats,
        materials.railing,
        42,
      );
    }
  }

  const wallLightInstances: Object3D[] = [];
  const wallLightDummy = new Object3D();
  for (
    let index = Math.max(1, Math.floor(route.length * 0.55));
    index < route.length;
    index += 2
  ) {
    const point = route[index];
    const tangentBefore = route[Math.max(0, index - 1)];
    const tangentAfter = route[Math.min(route.length - 1, index + 1)];
    const yaw = Math.atan2(
      tangentAfter.x - tangentBefore.x,
      tangentAfter.z - tangentBefore.z,
    );
    for (const edge of [-1, 1]) {
      wallLightDummy.position
        .copy(point)
        .addScaledVector(offsets[index], edge * (widths[index] / 2 + 0.74));
      wallLightDummy.position.y = Math.min(
        wallTops[index] - 0.62,
        point.y + 2.05,
      );
      wallLightDummy.rotation.set(0, yaw, 0);
      wallLightDummy.scale.set(1, 1, 1);
      wallLightDummy.updateMatrix();
      wallLightInstances.push(wallLightDummy.clone());
    }
  }
  if (wallLightInstances.length > 0) {
    const wallLights = new InstancedMesh(
      new BoxGeometry(0.22, 0.2, 0.07),
      materials.wallLight,
      wallLightInstances.length,
    );
    wallLights.name = `${label} instanced wall lights`;
    wallLightInstances.forEach((light, index) => {
      light.updateMatrix();
      wallLights.setMatrixAt(index, light.matrix);
    });
    wallLights.instanceMatrix.needsUpdate = true;
    wallLights.computeBoundingSphere();
    wallLights.renderOrder = 46;
    group.add(wallLights);
  }

  const dashes: Object3D[] = [];
  const dummy = new Object3D();
  let along = 0;
  let nextDashAt = 7;
  for (let index = 0; index < route.length - 1; index += 1) {
    const from = route[index];
    const to = route[index + 1];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const run = Math.hypot(dx, dz) || 1;
    while (nextDashAt <= along + run) {
      const at = (nextDashAt - along) / run;
      const width = MathUtils.lerp(widths[index], widths[index + 1], at);
      for (let lane = 1; lane < ramp.laneCount; lane += 1) {
        const lateral = (lane / ramp.laneCount - 0.5) * width;
        dummy.position
          .copy(from)
          .lerp(to, at)
          .addScaledVector(offsets[index], lateral)
          .add(new Vector3(0, 0.07, 0));
        dummy.rotation.set(0, Math.atan2(dx, dz), 0);
        dummy.scale.set(1, 1, 3);
        dummy.updateMatrix();
        dashes.push(dummy.clone());
      }
      nextDashAt += 14;
    }
    along += run;
  }
  if (dashes.length > 0) {
    const marks = new InstancedMesh(
      new BoxGeometry(0.18, 0.05, 1),
      materials.marking,
      dashes.length,
    );
    marks.name = `${label} dashed lane markings`;
    dashes.forEach((dash, index) => {
      dash.updateMatrix();
      marks.setMatrixAt(index, dash.matrix);
    });
    marks.instanceMatrix.needsUpdate = true;
    marks.computeBoundingSphere();
    marks.renderOrder = 45;
    group.add(marks);
  }

  const width = widths.at(-1)!;

  const boreWall = interiorMaterial(0x5d625f, { roughness: 0.92 });
  const boreDeck = interiorMaterial(0x30363a, { roughness: 0.95 });
  const boreCeiling = interiorMaterial(0x464a48, { roughness: 0.92 });
  const guideMaterial = new MeshBasicMaterial({
    color: 0xd9cfad,
    depthTest: true,
    depthWrite: true,
  });
  const lampMaterial = new MeshStandardMaterial({
    color: 0xffe2b0,
    depthTest: true,
    depthWrite: true,
    emissive: 0xffc678,
    emissiveIntensity: 1.15,
    roughness: 0.6,
  });
  boreWall.side = DoubleSide;
  boreDeck.side = DoubleSide;
  boreCeiling.side = DoubleSide;
  guideMaterial.side = DoubleSide;

  const boreCourse = portalBoreCourse(ramp, portalAxis);
  const boreOffsets = miterOffsets(boreCourse);
  addMesh(
    group,
    `${label} bore deck`,
    roadRibbonGeometry(
      boreCourse,
      boreOffsets,
      0,
      width / 2,
    ),
    boreDeck,
    74,
  );
  addMesh(
    group,
    `${label} bore ceiling`,
    roadRibbonGeometry(
      boreCourse.map((point) =>
        point.clone().add(new Vector3(0, clearHeight + 0.2, 0)),
      ),
      boreOffsets,
      0,
      (width + 1) / 2,
    ),
    boreCeiling,
    71,
  );
  for (const side of [-1, 1]) {
    addMesh(
      group,
      `${label} bore wall`,
      wallGeometry(
        boreCourse,
        boreOffsets,
        side * (width / 2 + 0.25),
        0.5,
        (point) => point.y,
        (point) => point.y + clearHeight,
      ),
      boreWall,
      72,
    );
    addMesh(
      group,
      `${label} bore safety guide`,
      wallGeometry(
        boreCourse,
        boreOffsets,
        side * (width / 2 - 0.03),
        0.08,
        (point) => point.y + 0.99,
        (point) => point.y + 1.11,
      ),
      guideMaterial,
      77,
    );
  }
  const lampSpacingM = 7.5;
  for (let segment = 0; segment < boreCourse.length - 1; segment += 1) {
    const from = boreCourse[segment];
    const to = boreCourse[segment + 1];
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const lampCount = Math.max(1, Math.floor(length / lampSpacingM));
    for (let index = 0; index < lampCount; index += 1) {
      const progress = (index + 1) / (lampCount + 1);
      const lamp = new Mesh(new BoxGeometry(1.45, 0.14, 0.45), lampMaterial);
      lamp.position.copy(from).lerp(to, progress);
      lamp.position.y += clearHeight - 0.12;
      lamp.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      lamp.name = `${label} bore ceiling lamp`;
      lamp.renderOrder = 78;
      group.add(lamp);
    }
  }

  for (const object of group.children) {
    if (object.name.startsWith(`${label} bore `)) {
      object.userData[PORTAL_INTERIOR_FLAG] = true;
      object.visible = false;
    }
  }
}

function addPortalFixture(
  group: Group,
  name: string,
  geometry: BufferGeometry,
  material: Material,
  position: Vector3,
  yaw: number,
  renderOrder: number,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.rotation.y = yaw;
  mesh.renderOrder = renderOrder;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/**
 * One coherent headwall per access site. Its shared yaw and datum prevent the
 * crossed beams produced when each slightly curved carriageway authored its
 * own independent portal frame.
 */
function addPortalHeadwall(
  group: Group,
  ramps: PortalRamp[],
  height: number,
  materials: PortalMaterials,
): void {
  if (ramps.length === 0) {
    return;
  }
  const id = ramps[0].id;
  const heads = ramps.map((ramp) => ramp.centreline.at(-1)!);
  const { inward, normal, yaw } = sharedPortalAxis(ramps);
  const centre = heads
    .reduce((sum, head) => sum.add(head), new Vector3())
    .multiplyScalar(1 / heads.length);
  centre.y = Math.min(...heads.map((head) => head.y));

  const bores = ramps
    .map((ramp, index) => ({
      centreOffset: heads[index].clone().sub(centre).dot(normal),
      clearHeight: portalClearHeight(height, ramp.structure),
      ramp,
      width: ramp.widths.at(-1)!,
    }))
    .sort((left, right) => left.centreOffset - right.centreOffset);
  const minEdge = Math.min(
    ...bores.map((bore) => bore.centreOffset - bore.width / 2),
  );
  const maxEdge = Math.max(
    ...bores.map((bore) => bore.centreOffset + bore.width / 2),
  );
  const clearHeight = Math.max(...bores.map((bore) => bore.clearHeight));
  const outerWidth = maxEdge - minEdge + 2.4;
  const outerCentre = (minEdge + maxEdge) / 2;
  const topY = centre.y + clearHeight + PORTAL_ROOF_DEPTH_M;
  const label = `Tiergartentunnel ${id} shared portal`;

  addPortalFixture(
    group,
    `${label} head beam`,
    new BoxGeometry(outerWidth, PORTAL_ROOF_DEPTH_M, PORTAL_FACE_DEPTH_M),
    materials.portalConcrete,
    centre
      .clone()
      .addScaledVector(normal, outerCentre)
      .setY(topY - PORTAL_ROOF_DEPTH_M / 2),
    yaw,
    55,
  );
  addPortalFixture(
    group,
    `${label} coping`,
    new BoxGeometry(outerWidth + 0.45, 0.2, PORTAL_FACE_DEPTH_M + 0.35),
    materials.portalConcrete,
    centre
      .clone()
      .addScaledVector(normal, outerCentre)
      .setY(topY + 0.1),
    yaw,
    56,
  );

  const jambs = [
    { offset: minEdge - 0.6, width: 1.2 },
    ...bores.slice(0, -1).map((bore, index) => {
      const next = bores[index + 1];
      const leftEdge = bore.centreOffset + bore.width / 2;
      const rightEdge = next.centreOffset - next.width / 2;
      return {
        offset: (leftEdge + rightEdge) / 2,
        // Fill the measured median rather than leaving black gaps around a
        // generic 0.8 m post. Narrow source gaps still receive a structural
        // divider wide enough to read at ordinary map zoom.
        width: Math.max(0.8, rightEdge - leftEdge + 0.08),
      };
    }),
    { offset: maxEdge + 0.6, width: 1.2 },
  ];
  for (const [index, jamb] of jambs.entries()) {
    addPortalFixture(
      group,
      `${label} jamb ${index + 1}`,
      new BoxGeometry(
        jamb.width,
        clearHeight + PORTAL_ROOF_DEPTH_M,
        PORTAL_FACE_DEPTH_M,
      ),
      materials.portalConcrete,
      centre
        .clone()
        .addScaledVector(normal, jamb.offset)
        .setY(centre.y + (clearHeight + PORTAL_ROOF_DEPTH_M) / 2),
      yaw,
      55,
    );
  }

  for (const bore of bores) {
    const boreCentre = centre
      .clone()
      .addScaledVector(normal, bore.centreOffset)
      .addScaledVector(inward, 0.82);
    const shadow = addPortalFixture(
      group,
      `${label} ${bore.ramp.carriagewayId} opening shadow`,
      new BoxGeometry(bore.width + 0.08, bore.clearHeight - 0.18, 0.18),
      materials.shadow,
      boreCentre.clone().setY(centre.y + bore.clearHeight / 2),
      yaw,
      54,
    );
    shadow.userData[PORTAL_SHADOW_FLAG] = true;

    // The first real luminaires sit directly behind the headwall. Keeping
    // these fixtures on the visible threshold side gives the mouth depth
    // without revealing the buried construction-only helper bore.
    for (let lane = 0; lane < bore.ramp.laneCount; lane += 1) {
      const lateral =
        (lane / bore.ramp.laneCount - 0.5 + 0.5 / bore.ramp.laneCount) *
        bore.width;
      const thresholdLamp = addPortalFixture(
        group,
        `${label} ${bore.ramp.carriagewayId} threshold lamp ${lane + 1}`,
        new BoxGeometry(
          Math.min(1.05, (bore.width / bore.ramp.laneCount) * 0.42),
          0.1,
          0.2,
        ),
        materials.wallLight,
        boreCentre
          .clone()
          .addScaledVector(normal, lateral)
          .addScaledVector(inward, -0.16)
          .setY(centre.y + bore.clearHeight - 0.42),
        yaw,
        59,
      );
      thresholdLamp.castShadow = false;
    }

    const gantryAt = boreCentre.clone().addScaledVector(inward, -2.05);
    const gantryY = centre.y + bore.clearHeight - 0.28;
    addPortalFixture(
      group,
      `${label} ${bore.ramp.carriagewayId} lane-control gantry`,
      new BoxGeometry(bore.width - 0.42, 0.2, 0.2),
      materials.railing,
      gantryAt.clone().setY(gantryY),
      yaw,
      58,
    );
    for (let lane = 0; lane < bore.ramp.laneCount; lane += 1) {
      const lateral =
        (lane / bore.ramp.laneCount - 0.5 + 0.5 / bore.ramp.laneCount) *
        bore.width;
      const signal = new Group();
      signal.name = `${label} ${bore.ramp.carriagewayId} lane signal`;
      signal.position
        .copy(gantryAt)
        .addScaledVector(normal, lateral)
        .setY(gantryY - 0.55);
      signal.rotation.y = yaw;
      const housing = new Mesh(
        new BoxGeometry(0.72, 0.72, 0.18),
        materials.shadow,
      );
      signal.add(housing);
      const signalMaterial =
        lane === bore.ramp.laneCount - 1 && bore.ramp.carriagewayId === "west"
          ? materials.signalStop
          : materials.signal;
      const diagonal = new Mesh(
        new BoxGeometry(0.1, 0.45, 0.055),
        signalMaterial,
      );
      diagonal.position.z = -0.12;
      diagonal.rotation.z =
        signalMaterial === materials.signalStop ? Math.PI / 4 : 0;
      signal.add(diagonal);
      if (signalMaterial === materials.signal) {
        for (const side of [-1, 1]) {
          const arrow = new Mesh(
            new BoxGeometry(0.1, 0.29, 0.055),
            signalMaterial,
          );
          arrow.position.set(side * 0.1, -0.11, -0.12);
          arrow.rotation.z = side * (Math.PI / 4);
          signal.add(arrow);
        }
      } else {
        const cross = diagonal.clone();
        cross.rotation.z = -Math.PI / 4;
        signal.add(cross);
      }
      group.add(signal);
    }

    const signPosition = boreCentre
      .clone()
      .addScaledVector(normal, bore.width / 2 + 0.58)
      .addScaledVector(inward, -1.7)
      .setY(centre.y + 2.25);
    const signFace = addPortalFixture(
      group,
      `${label} ${bore.ramp.carriagewayId} 50 speed sign`,
      new CircleGeometry(0.36, 24),
      materials.speedSignFace,
      signPosition,
      yaw,
      60,
    );
    signFace.rotation.y = yaw + Math.PI;
    const signRing = addPortalFixture(
      group,
      `${label} ${bore.ramp.carriagewayId} speed sign ring`,
      new TorusGeometry(0.36, 0.055, 8, 24),
      materials.speedSign,
      signPosition.clone().addScaledVector(inward, -0.012),
      yaw,
      61,
    );
    signRing.rotation.y = yaw + Math.PI;
  }
}

export type TunnelMouthView = {
  azimuth_degrees: number;
  distance_m: number;
  fov_degrees: number;
  polar_degrees: number;
  target_height_m: number;
  target_world: [number, number, number];
};

export function tunnelMouthViews(payload: TunnelPortalPayload): {
  invalidenstrasse?: TunnelMouthView;
  kemperplatz?: TunnelMouthView;
  north: TunnelMouthView;
  south: TunnelMouthView;
} | null {
  const ramps = portalRamps(payload);
  const build = (ramp: PortalRamp): TunnelMouthView => {
    const centreline = ramp.centreline;
    const head = centreline.at(-1)!;
    const axis = sharedPortalAxis(
      ramps.filter((candidate) => candidate.id === ramp.id),
    );
    const inward = axis.inward;
    const targetInM = 10;
    const target = head.clone().addScaledVector(inward, targetInM);
    const boreControl = portalBoreCourse(ramp, axis)[1];
    const controlRun = Math.max(
      1,
      Math.hypot(boreControl.x - head.x, boreControl.z - head.z),
    );
    target.y = MathUtils.lerp(
      head.y,
      boreControl.y,
      Math.min(1, targetInM / controlRun),
    );

    const availableLength = centreline
      .slice(1)
      .reduce((total, point, index) => {
        const previous = centreline[index];
        return total + Math.hypot(point.x - previous.x, point.z - previous.z);
      }, 0);
    const standBackM = Math.min(48, Math.max(24, availableLength * 0.55));
    let stand = head.clone();
    let walked = 0;
    for (let index = centreline.length - 1; index > 0; index -= 1) {
      const current = centreline[index];
      const previous = centreline[index - 1];
      const step = Math.hypot(current.x - previous.x, current.z - previous.z);
      if (walked + step >= standBackM) {
        stand = current
          .clone()
          .lerp(previous, (standBackM - walked) / (step || 1));
        break;
      }
      stand = previous.clone();
      walked += step;
    }
    stand.y += 1.45;
    const offset = stand.clone().sub(target);
    const distance = offset.length() || 1;
    return {
      azimuth_degrees: Math.atan2(offset.x, offset.z) * (180 / Math.PI),
      distance_m: distance,
      fov_degrees: 48,
      polar_degrees: Math.acos(offset.y / distance) * (180 / Math.PI),
      target_height_m: 0,
      target_world: [target.x, target.y, target.z],
    };
  };

  const north = ramps.find((ramp) => ramp.id === "minna_cauer");
  const south = ramps.find((ramp) => ramp.id === "reichpietschufer");
  if (!north || !south) {
    return null;
  }
  const invalidenstrasse = ramps.find((ramp) => ramp.id === "invalidenstrasse");
  const kemperplatz = ramps.find((ramp) => ramp.id === "kemperplatz");
  return {
    invalidenstrasse: invalidenstrasse ? build(invalidenstrasse) : undefined,
    kemperplatz: kemperplatz ? build(kemperplatz) : undefined,
    north: build(north),
    south: build(south),
  };
}

/** All four authored access sites, ready for the daylight scene. */
export function createTunnelPortals(payload: TunnelPortalPayload): Group {
  const group = new Group();
  group.name = "Tiergartentunnel portal approaches";
  group.userData.geometryStatus =
    "Four OSM-derived access sites with separate carriageways; official-mesh endpoint heights and documented smooth grade estimates";
  const ramps = portalRamps(payload);
  group.userData.portalApproachCount = new Set(
    ramps.map((ramp) => ramp.id),
  ).size;
  group.userData.carriagewayCount = ramps.length;
  const speedSignTexture = createLetteringTexture({
    bandHeightM: 0.72,
    bandWidthM: 0.72,
    capHeightM: 0.35,
    fieldColor: "#f4f1e8",
    letterColor: "#17191a",
    text: "50",
    texelsPerMetre: 240,
  });
  const materials: PortalMaterials = {
    concrete: surfaceMaterial(CONCRETE),
    marking: surfaceMaterial(MARKING, { roughness: 0.94 }),
    portalConcrete: surfaceMaterial(CONCRETE),
    railing: surfaceMaterial(RAILING, { metalness: 0.28, roughness: 0.58 }),
    road: surfaceMaterial(ASPHALT, { roughness: 0.93 }),
    shadow: surfaceMaterial(0x15191b, { roughness: 1 }),
    signal: surfaceMaterial(0x43d67d, {
      metalness: 0.05,
      roughness: 0.45,
    }),
    signalStop: surfaceMaterial(0xe63832, {
      metalness: 0.05,
      roughness: 0.45,
    }),
    speedSign: surfaceMaterial(0xd92d27, {
      metalness: 0.05,
      roughness: 0.62,
    }),
    speedSignFace: speedSignTexture
      ? new MeshBasicMaterial({
          depthTest: true,
          depthWrite: true,
          map: speedSignTexture,
          side: DoubleSide,
        })
      : surfaceMaterial(0xf4f1e8, { roughness: 0.86 }),
    wallLight: surfaceMaterial(0xffd59a, {
      metalness: 0.02,
      roughness: 0.5,
    }),
  };
  materials.shadow.userData[PRESERVE_AUTHORED_DARK_FLAG] = true;
  materials.concrete.side = DoubleSide;
  materials.portalConcrete.side = DoubleSide;
  materials.portalConcrete.emissive.setHex(CONCRETE);
  materials.portalConcrete.emissiveIntensity = 0.1;
  materials.signal.emissive.setHex(0x29b765);
  materials.signal.emissiveIntensity = 1.35;
  materials.signalStop.emissive.setHex(0xb91616);
  materials.signalStop.emissiveIntensity = 1.2;
  materials.wallLight.emissive.setHex(0xffb257);
  materials.wallLight.emissiveIntensity = 1.05;
  for (const id of new Set(ramps.map((ramp) => ramp.id))) {
    const portalRamps = ramps.filter((ramp) => ramp.id === id);
    const portalAxis = sharedPortalAxis(portalRamps);
    for (const ramp of portalRamps) {
      addCarriageway(
        group,
        ramp,
        payload.clear_height_m,
        materials,
        portalAxis,
      );
    }
    addPortalHeadwall(group, portalRamps, payload.clear_height_m, materials);
  }
  setTunnelPortalPresentation(group, false, false, false);
  return group;
}
