/**
 * The two open approaches of the Tiergartentunnel (B 96), north at the
 * Spreebogen behind the Hauptbahnhof and south towards the Landwehrkanal.
 *
 * The tunnel itself is drawn as a cutaway that is only shown when the camera
 * goes under the city. The mouths, though, are surface features: from above
 * you see a trough that drops away between retaining walls, noise barriers
 * along the top, and the carriageway markings running into the portal. Those
 * belong to the daylight scene, so they are built here as their own always
 * visible group rather than inside the cutaway.
 *
 * The plan course is the committed OSM-derived centreline; only the vertical
 * profile is engineered, because the manifest carries a single schematic depth
 * for the whole tube and no real gradient.
 */

import {
  BufferGeometry,
  BoxGeometry,
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
  Vector3,
} from "three";

export type TunnelPortalPayload = {
  clear_height_m: number;
  clear_width_each_direction_m: number;
  portal_surface_anchors?: {
    kemperplatz?: [number, number, number];
  };
  portal_approaches?: {
    kemperplatz?: [number, number, number][];
  };
  points: [number, number, number][];
};

export type TunnelPortalCourse = {
  clear_height_m?: number;
  portal_surface_anchors?: {
    kemperplatz?: readonly [number, number, number];
  };
  portal_approaches?: {
    kemperplatz?: readonly (readonly [number, number, number])[];
  };
  points: readonly (readonly [number, number, number])[];
};

export type TunnelPortalCourseInput =
  | TunnelPortalCourse
  | readonly (readonly [number, number, number])[];

/**
 * Length of each open ramp. The committed route has no measured vertical
 * profile, so the surface threshold and schematic tunnel depth are joined by
 * a long engineered transition instead of an abrupt drop.
 */
export const RAMP_LENGTH_M = 260;

/** Flat overlap with the mapped surface road, preventing an abrupt cut edge. */
export const PORTAL_APPROACH_M = 32;

/** Outer footprint of both open cuts, including walls and safety shoulder. */
export const PORTAL_CORRIDOR_HALF_WIDTH_M = 14.5;

/** Street level the ramps come up to at the Spreebogen and the Tiergarten. */
export const TUNNEL_SURFACE_Y = 2.4;
/** Top of the retaining walls, i.e. the kerb the barriers stand on. */
const WALL_TOP_Y = TUNNEL_SURFACE_Y + 0.4;
const PORTAL_ROOF_DEPTH_M = 0.8;
const WALL_THICKNESS_M = 0.65;
const BARRIER_HEIGHT_M = 1.45;
const RAMP_SAMPLE_M = 8;
const BORE_LENGTH_M = 46;
const PORTAL_INTERIOR_FLAG = "tiergartentunnelPortalInterior";
const PORTAL_SURFACE_MATERIAL_FLAG = "tiergartentunnelPortalSurfaceMaterial";
const PORTAL_REVEAL_MATERIAL_FLAG = "tiergartentunnelPortalRevealMaterial";

const CONCRETE = 0xaaa9a2;
const ASPHALT = 0x343a3f;
const BARRIER = 0x697570;
const MARKING = 0xe9e5d6;

/** Road-deck height at the visible threshold, before the buried bore falls. */
export function tunnelPortalDeckY(clearHeightM: number): number {
  return TUNNEL_SURFACE_Y - clearHeightM - PORTAL_ROOF_DEPTH_M;
}

function surfaceMaterial(
  color: number,
  options: {
    metalness?: number;
    revealThroughGround?: boolean;
    roughness?: number;
  } = {},
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: options.metalness ?? 0.06,
    polygonOffset: true,
    polygonOffsetFactor: -1.2,
    polygonOffsetUnits: -1.2,
    roughness: options.roughness ?? 0.86,
    // Surface approaches must obey the city depth buffer. Turning depth tests
    // off here made the long south ramp paint through the Potsdamer-Platz
    // buildings from ordinary exterior views. The explicit mouth close-up may
    // temporarily reveal these materials through the uncut ground shell; the
    // first free camera movement restores normal occlusion.
    depthTest: true,
    depthWrite: true,
  });
  material.userData[PORTAL_SURFACE_MATERIAL_FLAG] = true;
  if (options.revealThroughGround) {
    material.userData[PORTAL_REVEAL_MATERIAL_FLAG] = true;
  }
  return material;
}

function interiorMaterial(
  color: number,
  options: { metalness?: number; roughness?: number } = {},
): MeshStandardMaterial {
  const material = surfaceMaterial(color, options);
  delete material.userData[PORTAL_SURFACE_MATERIAL_FLAG];
  material.depthTest = false;
  material.depthWrite = false;
  return material;
}

function segmentNormal(from: Vector3, to: Vector3): Vector3 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const run = Math.hypot(dx, dz) || 1;
  return new Vector3(-dz / run, 0, dx / run);
}

/** Joined offsets keep both carriageways watertight through mapped bends. */
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

function roadRibbonGeometry(
  points: Vector3[],
  offsets: Vector3[],
  centreOffset: number,
  halfWidth: number,
): BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index < points.length; index += 1) {
    for (const edgeOffset of [
      centreOffset - halfWidth,
      centreOffset + halfWidth,
    ]) {
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
  centreOffset: number,
  thickness: number,
  bottomAt: (point: Vector3) => number,
  topAt: (point: Vector3, index: number) => number,
): BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const bottom = bottomAt(point);
    const top = topAt(point, index);
    for (const edgeOffset of [
      centreOffset - thickness / 2,
      centreOffset + thickness / 2,
    ]) {
      const edge = point.clone().addScaledVector(offsets[index], edgeOffset);
      vertices.push(edge.x, bottom, edge.z, edge.x, top, edge.z);
    }
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = index * 4;
    const next = current + 4;
    // Both vertical faces and the coping are authored as one continuous wedge.
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

function sampleRampProfile(source: Vector3[], destinationY: number): Vector3[] {
  if (source.length < 2) {
    return source;
  }
  const cumulative = [0];
  for (let index = 1; index < source.length; index += 1) {
    cumulative.push(
      cumulative[index - 1] +
        Math.hypot(
          source[index].x - source[index - 1].x,
          source[index].z - source[index - 1].z,
        ),
    );
  }
  const total = cumulative.at(-1) || 1;
  const sampleCount = Math.max(2, Math.ceil(total / RAMP_SAMPLE_M) + 1);
  const sampled: Vector3[] = [];
  let segment = 1;
  for (let index = 0; index < sampleCount; index += 1) {
    const along = Math.min(total, (index / (sampleCount - 1)) * total);
    while (segment < cumulative.length - 1 && cumulative[segment] < along) {
      segment += 1;
    }
    const startDistance = cumulative[segment - 1];
    const span = cumulative[segment] - startDistance;
    const fraction = span > 1e-6 ? (along - startDistance) / span : 0;
    const point = source[segment - 1].clone().lerp(source[segment], fraction);
    // Smoothstep leaves both the street apron and portal threshold level.
    const progress = Math.min(1, along / total);
    const grade = progress * progress * (3 - 2 * progress);
    point.y = TUNNEL_SURFACE_Y + (destinationY - TUNNEL_SURFACE_Y) * grade;
    sampled.push(point);
  }
  return sampled;
}

/**
 * Walk the centreline inward from one end, returning the ramp's own
 * centreline with the vertical profile applied: street level at the mouth,
 * tunnel level at the portal.
 */
function rampCentreline(
  points: Vector3[],
  fromStart: boolean,
  destinationY: number,
): Vector3[] {
  const ordered = fromStart ? points : [...points].reverse();
  const source: Vector3[] = [ordered[0].clone()];
  let travelled = 0;
  for (
    let index = 1;
    index < ordered.length && travelled < RAMP_LENGTH_M;
    index += 1
  ) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const step = Math.hypot(current.x - previous.x, current.z - previous.z);
    if (travelled + step >= RAMP_LENGTH_M) {
      const fraction = (RAMP_LENGTH_M - travelled) / (step || 1);
      source.push(previous.clone().lerp(current, fraction));
      travelled = RAMP_LENGTH_M;
      break;
    }
    source.push(current.clone());
    travelled += step;
  }

  return sampleRampProfile(source, destinationY);
}

type PortalRamp = {
  centreline: Vector3[];
  id: "kemperplatz" | "north" | "south";
  tunnelY: number;
};

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
        ? Math.max(
            0,
            Math.min(
              1,
              ((anchor.x - from.x) * dx + (anchor.z - from.z) * dz) /
                lengthSquared,
            ),
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

function portalRamps(payloadInput: TunnelPortalCourseInput): PortalRamp[] {
  const payload = normalizePortalCourse(payloadInput);
  const points = payload.points.map((point) => new Vector3(...point));
  if (points.length < 2) {
    return [];
  }
  const portalY = tunnelPortalDeckY(payload.clear_height_m ?? 5);
  const ramps: PortalRamp[] = [
    {
      centreline: rampCentreline(points, true, portalY),
      id: "north",
      tunnelY: points[0].y,
    },
    {
      centreline: rampCentreline(points, false, portalY),
      id: "south",
      tunnelY: points.at(-1)!.y,
    },
  ];
  const kemperplatz = payload.portal_approaches?.kemperplatz;
  if (kemperplatz && kemperplatz.length >= 2) {
    const source = kemperplatz.map((point) => new Vector3(...point));
    source.forEach((point) => {
      point.y = TUNNEL_SURFACE_Y;
    });
    const surface = source[0];
    const connection = closestPointOnCourse(points, source.at(-1)!);
    const horizontalLength = Math.hypot(
      connection.x - surface.x,
      connection.z - surface.z,
    );
    // Reject stale anchors rather than cutting an accidental cross-city scar.
    if (horizontalLength >= 25 && horizontalLength <= 180) {
      ramps.push({
        centreline: sampleRampProfile(source, portalY),
        id: "kemperplatz",
        tunnelY: connection.y,
      });
    }
  }
  return ramps;
}

export function createTunnelPortalApproachTester(
  payload: TunnelPortalCourseInput,
): (x: number, z: number, shoulderM?: number) => boolean {
  const ramps = portalRamps(payload);
  if (ramps.length === 0) {
    return () => false;
  }
  const courses = ramps.map(({ centreline: ramp }) => {
    const inward = ramp[1].clone().sub(ramp[0]);
    inward.y = 0;
    inward.normalize();
    const approach = ramp[0]
      .clone()
      .addScaledVector(inward, -PORTAL_APPROACH_M);
    const route = [approach, ...ramp];
    const segments = route.slice(0, -1).map((from, index) => {
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
    });
    return {
      maxX: Math.max(...route.map((point) => point.x)),
      maxZ: Math.max(...route.map((point) => point.z)),
      minX: Math.min(...route.map((point) => point.x)),
      minZ: Math.min(...route.map((point) => point.z)),
      segments,
    };
  });
  return (x: number, z: number, shoulderM = 0): boolean => {
    const halfWidth = PORTAL_CORRIDOR_HALF_WIDTH_M + Math.max(0, shoulderM);
    const distanceSquared = halfWidth * halfWidth;
    for (const course of courses) {
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
            ? Math.max(
                0,
                Math.min(
                  1,
                  ((x - segment.fromX) * segment.dx +
                    (z - segment.fromZ) * segment.dz) /
                    segment.lengthSquared,
                ),
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
 * Keep the two public ramps in every surface style. Forced-depth bore pieces
 * are a close-up aid, not surface geometry: reveal them only for an explicit
 * tunnel-mouth focus and hide them again on the first free camera movement.
 */
export function setTunnelPortalPresentation(
  group: Group,
  underside: boolean,
  voxelMode: boolean,
  revealInterior = false,
): void {
  group.visible = !underside;
  const interiorVisible = !underside && !voxelMode && revealInterior;
  const surfaceMaterials = new Set<Material>();
  group.traverse((object) => {
    if (object.userData[PORTAL_INTERIOR_FLAG] === true) {
      object.visible = interiorVisible;
    }
    if (!(object instanceof Mesh)) {
      return;
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      if (
        material.userData[PORTAL_SURFACE_MATERIAL_FLAG] === true &&
        !surfaceMaterials.has(material)
      ) {
        surfaceMaterials.add(material);
        const revealThroughGround =
          material.userData[PORTAL_REVEAL_MATERIAL_FLAG] === true;
        material.depthTest = !(interiorVisible && revealThroughGround);
        material.depthWrite = !(interiorVisible && revealThroughGround);
      }
    }
  });
}

function addRamp(
  group: Group,
  label: string,
  centreline: Vector3[],
  width: number,
  height: number,
  tunnelY: number,
  materials: {
    barrier: MeshStandardMaterial;
    concrete: MeshStandardMaterial;
    marking: MeshStandardMaterial;
    portalConcrete: MeshStandardMaterial;
    road: MeshStandardMaterial;
    shadow: MeshStandardMaterial;
    signal: MeshStandardMaterial;
  },
): void {
  const entrance = centreline[0];
  const inwardAtEntrance = centreline[1].clone().sub(entrance);
  inwardAtEntrance.y = 0;
  inwardAtEntrance.normalize();
  const approach = entrance
    .clone()
    .addScaledVector(inwardAtEntrance, -PORTAL_APPROACH_M);
  approach.y = TUNNEL_SURFACE_Y;
  const route = [approach, ...centreline];
  const offsets = miterOffsets(route);
  const tubeOffset = width / 2 + 0.85;
  const dashes: Object3D[] = [];
  const dummy = new Object3D();

  // Two continuous ribbons replace the former chain of boxes. Every bend now
  // shares vertices, so the road cannot split or expose the city shell.
  for (const tube of [-1, 1]) {
    const lateral = tube * tubeOffset;
    const deck = addMesh(
      group,
      `${label} carriageway deck`,
      roadRibbonGeometry(route, offsets, lateral, width / 2),
      materials.road,
      30,
    );
    deck.userData.minimumY = Math.min(...route.map((point) => point.y));
    deck.userData.maximumY = Math.max(...route.map((point) => point.y));
    deck.userData.approachLengthM = PORTAL_APPROACH_M;
    deck.userData.profileSamples = route.length;

    // Fine solid shoulder lines make the two directional carriageways read as
    // roads all the way from the mapped surface into the dark bores.
    for (const edge of [-1, 1]) {
      addMesh(
        group,
        `${label} solid edge marking`,
        roadRibbonGeometry(
          route.map((point) => point.clone().add(new Vector3(0, 0.035, 0))),
          offsets,
          lateral + edge * (width / 2 - 0.28),
          0.09,
        ),
        materials.marking,
        44,
      );

      const wallOffset = lateral + edge * (width / 2 + WALL_THICKNESS_M / 2);
      addMesh(
        group,
        `${label} retaining wall`,
        wallGeometry(
          route,
          offsets,
          wallOffset,
          WALL_THICKNESS_M,
          (point) => point.y - 0.25,
          () => WALL_TOP_Y,
        ),
        materials.concrete,
        35,
      );
    }
  }

  // Only the outer shoulders carry the tall protective panels; four complete
  // rows previously made the centre reservation look like a grey box canyon.
  for (const side of [-1, 1]) {
    const outerOffset = side * (width + 0.85 + WALL_THICKNESS_M + 0.09);
    addMesh(
      group,
      `${label} noise barrier`,
      wallGeometry(
        route,
        offsets,
        outerOffset,
        0.18,
        () => WALL_TOP_Y,
        (_point, index) =>
          WALL_TOP_Y +
          BARRIER_HEIGHT_M * Math.min(1, Math.max(0, (index - 1) / 4)),
      ),
      materials.barrier,
      40,
    );
  }

  // Stable 14 m marking rhythm independent of the route sampling interval.
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
      for (const tube of [-1, 1]) {
        dummy.position
          .copy(from)
          .lerp(to, at)
          .addScaledVector(offsets[index], tube * tubeOffset)
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

  // Portal headwall at the foot of the ramp, where the trough becomes a tube.
  const head = centreline[centreline.length - 1];
  const before = centreline[Math.max(0, centreline.length - 2)];
  const yaw = Math.atan2(head.x - before.x, head.z - before.z);
  const dxh = head.x - before.x;
  const dzh = head.z - before.z;
  const runh = Math.hypot(dxh, dzh) || 1;
  const headNormal = new Vector3(-dzh / runh, 0, dxh / runh);
  const inward = new Vector3(dxh / runh, 0, dzh / runh);
  for (const tube of [-1, 1]) {
    const lateral = tube * tubeOffset;
    const openingTopY = head.y + height;
    const fasciaHeight = Math.max(1.4, WALL_TOP_Y - openingTopY);
    const beam = new Mesh(
      new BoxGeometry(width + 2.2, fasciaHeight, 2.4),
      materials.portalConcrete,
    );
    beam.name = `${label} portal frame`;
    beam.position.copy(head).addScaledVector(headNormal, lateral);
    beam.position.y = openingTopY + fasciaHeight / 2;
    beam.rotation.y = yaw;
    beam.renderOrder = 55;
    beam.castShadow = true;
    group.add(beam);
    for (const edge of [-1, 1]) {
      const jambHeight = WALL_TOP_Y - head.y + 0.25;
      const jamb = new Mesh(
        new BoxGeometry(1.1, jambHeight, 2.4),
        materials.portalConcrete,
      );
      jamb.name = `${label} portal jamb`;
      jamb.position
        .copy(head)
        .addScaledVector(headNormal, lateral + edge * (width / 2 + 0.55));
      jamb.position.y = head.y + jambHeight / 2;
      jamb.rotation.y = yaw;
      jamb.renderOrder = 55;
      jamb.castShadow = true;
      group.add(jamb);
    }

    const shadow = new Mesh(
      new BoxGeometry(width - 0.5, height - 0.35, 0.35),
      materials.shadow,
    );
    shadow.name = `${label} portal shadow`;
    shadow.position
      .copy(head)
      .addScaledVector(headNormal, lateral)
      .addScaledVector(inward, 1.25);
    shadow.position.y = head.y + height / 2;
    shadow.rotation.y = yaw;
    shadow.renderOrder = 54;
    group.add(shadow);
  }

  // A single top slab joins both directional mouths and closes the terrain
  // edge. It remains above street level, so the portal is legible even when
  // the closed official ground mesh correctly occludes the buried road.
  const portalWidth = 2 * width + 4.5;
  const coping = new Mesh(
    new BoxGeometry(portalWidth, 0.45, 4.6),
    materials.portalConcrete,
  );
  coping.name = `${label} portal coping`;
  coping.position.copy(head);
  coping.position.y = WALL_TOP_Y + 0.18;
  coping.rotation.y = yaw;
  coping.renderOrder = 56;
  coping.castShadow = true;
  coping.receiveShadow = true;
  group.add(coping);

  // The real entrances are controlled portals, not anonymous holes. A slim
  // overhead gantry and four lane signals provide the recognisable threshold.
  const gantryAt = head.clone().addScaledVector(inward, -7);
  const gantryY = head.y + height - 0.35;
  const gantry = new Mesh(
    new BoxGeometry(portalWidth - 2.1, 0.28, 0.28),
    materials.barrier,
  );
  gantry.name = `${label} lane-control gantry`;
  gantry.position.copy(gantryAt);
  gantry.position.y = gantryY;
  gantry.rotation.y = yaw;
  gantry.renderOrder = 58;
  group.add(gantry);
  for (const lateral of [-0.75, -0.25, 0.25, 0.75].map(
    (fraction) => fraction * (portalWidth / 2 - 2.2),
  )) {
    const signal = new Group();
    signal.name = `${label} green lane signal`;
    signal.position.copy(gantryAt).addScaledVector(headNormal, lateral);
    signal.position.y = gantryY - 0.75;
    signal.rotation.y = yaw;
    const housing = new Mesh(
      new BoxGeometry(1.15, 1.15, 0.22),
      materials.shadow,
    );
    housing.position.z = -0.04;
    housing.renderOrder = 59;
    signal.add(housing);
    const stem = new Mesh(new BoxGeometry(0.14, 0.42, 0.08), materials.signal);
    stem.position.set(0, 0.15, -0.18);
    stem.renderOrder = 60;
    signal.add(stem);
    for (const side of [-1, 1]) {
      const arrow = new Mesh(
        new BoxGeometry(0.14, 0.44, 0.08),
        materials.signal,
      );
      arrow.position.set(side * 0.13, -0.16, -0.18);
      arrow.rotation.z = side * (Math.PI / 4);
      arrow.renderOrder = 60;
      signal.add(arrow);
    }
    group.add(signal);
  }

  // The visible tube interior ("man muss … tief hineinschauen können"):
  // each mouth continues past its portal frame as a real receding bore —
  // dark road deck, side walls, ceiling with a row of warm lamps, and a
  // near-black end cap that reads as the tunnel disappearing under the
  // city rather than a painted-on hole. Everything sits BELOW street
  // level, so it is only ever seen through the mouth itself.
  const boreWall = interiorMaterial(0x5d625f, { roughness: 0.92 });
  const boreDeck = interiorMaterial(0x30363a, { roughness: 0.95 });
  const boreCeiling = interiorMaterial(0x464a48, { roughness: 0.92 });
  const boreEnd = interiorMaterial(0x111416, { roughness: 1 });
  const guideMaterial = new MeshBasicMaterial({
    color: 0xd9cfad,
    depthTest: false,
    depthWrite: false,
  });
  const lampMaterial = new MeshStandardMaterial({
    color: 0xffe2b0,
    emissive: 0xffc678,
    emissiveIntensity: 1.15,
    roughness: 0.6,
    depthTest: false,
    depthWrite: false,
  });
  boreWall.side = DoubleSide;
  boreDeck.side = DoubleSide;
  boreCeiling.side = DoubleSide;
  guideMaterial.side = DoubleSide;
  for (const tube of [-1, 1]) {
    const lateral = tube * (width / 2 + 0.85);
    const mouth = head
      .clone()
      .addScaledVector(headNormal, lateral)
      .addScaledVector(inward, 0.7);
    const deep = mouth.clone().addScaledVector(inward, BORE_LENGTH_M);
    deep.y = tunnelY;
    const boreCourse = [mouth, deep];
    const boreOffsets = [headNormal, headNormal];
    addMesh(
      group,
      `${label} bore deck`,
      roadRibbonGeometry(
        boreCourse.map((point) => point.clone().add(new Vector3(0, -0.15, 0))),
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
          point.clone().add(new Vector3(0, height + 0.2, 0)),
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
          (point) => point.y + height,
        ),
        boreWall,
        72,
      );

      // A calm, continuous reflector band makes the close bore view readable
      // without animated lighting or depth-fighting decals.
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
    const endCap = new Mesh(
      new BoxGeometry(width + 1.0, height + 0.6, 0.4),
      boreEnd,
    );
    endCap.position.copy(deep).addScaledVector(inward, -0.4);
    endCap.position.y = tunnelY + height / 2;
    endCap.rotation.y = yaw;
    endCap.name = `${label} bore depth cap`;
    endCap.renderOrder = 70;
    group.add(endCap);
    // A row of ceiling lamps marching into the dark — the cue that makes
    // the bore read as depth instead of a black rectangle.
    const LAMP_SPACING_M = 7.5;
    const lampCount = Math.floor((BORE_LENGTH_M - 4) / LAMP_SPACING_M);
    for (let index = 0; index < lampCount; index += 1) {
      const lamp = new Mesh(new BoxGeometry(1.6, 0.14, 0.5), lampMaterial);
      lamp.position
        .copy(mouth)
        .addScaledVector(inward, 4 + index * LAMP_SPACING_M);
      const fraction = (4 + index * LAMP_SPACING_M) / BORE_LENGTH_M;
      lamp.position.y =
        MathUtils.lerp(head.y, tunnelY, fraction) + height - 0.12;
      lamp.rotation.y = yaw;
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

/**
 * Camera stand for looking INTO a tunnel bore: a low, axis-near position
 * up the ramp from the mouth, aimed a few metres inside the tube so the
 * receding walls, the lamp row and the depth cap fill the frame. Derived
 * from the same centreline the ramps are built from, so the view stays
 * glued to the geometry if the course ever moves.
 */
export type TunnelMouthView = {
  azimuth_degrees: number;
  distance_m: number;
  fov_degrees: number;
  polar_degrees: number;
  target_height_m: number;
  target_world: [number, number, number];
};

export function tunnelMouthViews(payload: TunnelPortalPayload): {
  kemperplatz?: TunnelMouthView;
  north: TunnelMouthView;
  south: TunnelMouthView;
} | null {
  const ramps = portalRamps(payload);
  const north = ramps.find((ramp) => ramp.id === "north");
  const south = ramps.find((ramp) => ramp.id === "south");
  if (!north || !south) {
    return null;
  }
  const build = (ramp: PortalRamp): TunnelMouthView => {
    const centreline = ramp.centreline;
    const head = centreline[centreline.length - 1];
    const before = centreline[Math.max(0, centreline.length - 2)];
    const inward = new Vector3(head.x - before.x, 0, head.z - before.z);
    inward.normalize();
    const normal = new Vector3(-inward.z, 0, inward.x);
    // Aim INSIDE one bore, not at the median wall between the two: the
    // tubes flank the centreline at ±(width/2 + 0.85), exactly where
    // addRamp lays their decks.
    const lateral = payload.clear_width_each_direction_m / 2 + 0.85;
    // The south view aims farther into its long, exposed approach so the lamp
    // rhythm and both wall guides establish depth behind the portal frame.
    const targetInM = ramp.id === "north" ? 10 : 18;
    const target = head
      .clone()
      .addScaledVector(inward, targetInM)
      .addScaledVector(normal, lateral);
    target.y =
      MathUtils.lerp(
        head.y,
        ramp.tunnelY,
        Math.min(1, targetInM / BORE_LENGTH_M),
      ) +
      payload.clear_height_m / 2;

    // The camera stands up the ramp's own centreline rather than on a fixed
    // sphere around the target. It must remain close: a 46 m stand became a
    // 150 m stand after the isometric FOV's dolly compensation and landed
    // over the Landwehrkanal instead of in front of the south mouth.
    // Each stand distance is tuned to the available open-ramp envelope; the
    // south mouth must stay close enough to avoid seeing the uncut city shell.
    const standBackM = ramp.id === "north" ? 82 : ramp.id === "south" ? 76 : 50;
    let stand = head.clone();
    let walked = 0;
    for (let index = centreline.length - 1; index > 0; index -= 1) {
      const current = centreline[index];
      const previous = centreline[index - 1];
      const step = Math.hypot(current.x - previous.x, current.z - previous.z);
      if (walked + step >= standBackM) {
        const fraction = (standBackM - walked) / (step || 1);
        stand = current.clone().lerp(previous, fraction);
        walked = standBackM;
        break;
      }
      stand = previous.clone();
      walked += step;
    }
    // Stay on the ramp's own grade. Forcing the eye back to surface level
    // made it look steeply down through the head beam instead of horizontally
    // into the bore. ThreeViewer explicitly exempts this authored portal shot
    // from the generic underside/underwater switch until free navigation.
    // Keep the eye at driver height above the graded carriageway. The sampled
    // stand point rises naturally as framing moves farther up the approach.
    stand.y += 1.45;
    stand.addScaledVector(normal, lateral);

    const offset = stand.clone().sub(target);
    const distance = offset.length() || 1;
    return {
      azimuth_degrees: Math.atan2(offset.x, offset.z) * (180 / Math.PI),
      distance_m: distance,
      fov_degrees: ramp.id === "north" ? 43 : ramp.id === "south" ? 42 : 44,
      polar_degrees: Math.acos(offset.y / distance) * (180 / Math.PI),
      target_height_m: 0,
      target_world: [target.x, target.y, target.z],
    };
  };

  const views: {
    kemperplatz?: TunnelMouthView;
    north: TunnelMouthView;
    south: TunnelMouthView;
  } = { north: build(north), south: build(south) };
  const kemperplatz = ramps.find((ramp) => ramp.id === "kemperplatz");
  if (kemperplatz) {
    views.kemperplatz = build(kemperplatz);
  }
  return views;
}

/** All authored open approaches, ready to drop into the daylight scene. */
export function createTunnelPortals(payload: TunnelPortalPayload): Group {
  const group = new Group();
  group.name = "Tiergartentunnel portal approaches";
  group.userData.geometryStatus =
    "OSM-derived plan course with an engineered smooth vertical profile; the manifest carries only a schematic constant tunnel depth";
  const points = payload.points.map((point) => new Vector3(...point));
  if (points.length < 2) {
    return group;
  }
  const materials = {
    barrier: surfaceMaterial(BARRIER, { metalness: 0.22, roughness: 0.62 }),
    concrete: surfaceMaterial(CONCRETE),
    marking: surfaceMaterial(MARKING, { roughness: 0.94 }),
    portalConcrete: surfaceMaterial(CONCRETE, { revealThroughGround: true }),
    road: surfaceMaterial(ASPHALT, {
      revealThroughGround: true,
      roughness: 0.93,
    }),
    shadow: surfaceMaterial(0x15191b, {
      revealThroughGround: true,
      roughness: 1,
    }),
    signal: surfaceMaterial(0x43d67d, {
      metalness: 0.05,
      revealThroughGround: true,
      roughness: 0.45,
    }),
  };
  materials.concrete.side = DoubleSide;
  materials.portalConcrete.side = DoubleSide;
  materials.portalConcrete.emissive.setHex(0xaaa9a2);
  materials.portalConcrete.emissiveIntensity = 0.16;
  materials.signal.emissive.setHex(0x29b765);
  materials.signal.emissiveIntensity = 1.35;
  for (const ramp of portalRamps(payload)) {
    addRamp(
      group,
      `Tiergartentunnel ${ramp.id} ramp`,
      ramp.centreline,
      payload.clear_width_each_direction_m,
      payload.clear_height_m,
      ramp.tunnelY,
      materials,
    );
  }
  setTunnelPortalPresentation(group, false, false, false);
  return group;
}
