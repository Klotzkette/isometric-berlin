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
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three";

export type TunnelPortalPayload = {
  clear_height_m: number;
  clear_width_each_direction_m: number;
  points: [number, number, number][];
};

/**
 * Length of each open ramp. With the ~12 m the schematic tube sits below the
 * Spreebogen this is a gradient just under 5 %, which is what the real B 96
 * ramps are built to.
 */
export const RAMP_LENGTH_M = 260;

/** Street level the ramps come up to at the Spreebogen and the Tiergarten. */
const SURFACE_Y = 2.4;
/** Top of the retaining walls, i.e. the kerb the barriers stand on. */
const WALL_TOP_Y = SURFACE_Y + 0.4;
const WALL_THICKNESS_M = 0.65;
const BARRIER_HEIGHT_M = 1.45;
/**
 * Between the two canonical daylight troughs, the route passes beneath the
 * western rail viaduct and Cube Berlin. The public surface must never expose
 * that buried middle section through a transparent building or a gap in the
 * sampled terrain.
 */
const BURIED_CAP_CLEARANCE_M = 0.55;
// The twin-tube outside wall is already 11.35 m from the centreline. This
// deliberately generous skirt also catches oblique above-ground rays through
// Cube glass, water and the station viaduct before forced-depth bore meshes
// can reach the framebuffer.
const BURIED_CAP_MARGIN_M = 12;
// Overlap the ramp's engineered end very slightly. A cap that began exactly
// at its polyline vertex left a one-triangle seam at each trough-to-tube join.
const BURIED_CAP_TROUGH_SEAM_OVERLAP_M = 2;
const BURIED_CAP_RENDER_ORDER = 100;
const BURIED_CAP_NAME = "Tiergartentunnel buried ground occlusion cap";

const CONCRETE = 0x8d8b83;
const ASPHALT = 0x3c4247;
const BARRIER = 0x6f7a74;
const MARKING = 0xe9e5d6;

function surfaceMaterial(
  color: number,
  options: { metalness?: number; roughness?: number } = {},
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: options.metalness ?? 0.06,
    polygonOffset: true,
    polygonOffsetFactor: -1.2,
    polygonOffsetUnits: -1.2,
    roughness: options.roughness ?? 0.86,
    // The official photogrammetry is an uncut ground shell. Portal geometry
    // deliberately sits below that shell, so it must win the depth test just
    // in its narrow ramp corridors instead of disappearing below the mesh.
    depthTest: false,
    depthWrite: false,
  });
}

/** A unit box stretched and aimed along `from` → `to`, so it can slope. */
function slopedBox(
  group: Group,
  name: string,
  geometry: BoxGeometry,
  material: Material,
  from: Vector3,
  to: Vector3,
): Mesh {
  const delta = to.clone().sub(from);
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.scale.z = delta.length() || 1;
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new Vector3(0, 0, 1),
    delta.clone().normalize(),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/** The same, but kept upright — walls and barriers must not lean with the ramp. */
function uprightBox(
  group: Group,
  name: string,
  geometry: BoxGeometry,
  material: Material,
  from: Vector3,
  to: Vector3,
  centreY: number,
): Mesh {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.scale.z = Math.hypot(dx, dz) || 1;
  mesh.position.set((from.x + to.x) / 2, centreY, (from.z + to.z) / 2);
  mesh.rotation.y = Math.atan2(dx, dz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/**
 * Walk the centreline inward from one end, returning the ramp's own
 * centreline with the vertical profile applied: street level at the mouth,
 * tunnel level at the portal.
 */
function rampCentreline(
  points: Vector3[],
  fromStart: boolean,
  tunnelY: number,
): Vector3[] {
  const ordered = fromStart ? points : [...points].reverse();
  const walked: Vector3[] = [ordered[0].clone()];
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
      walked.push(previous.clone().lerp(current, fraction));
      travelled = RAMP_LENGTH_M;
      break;
    }
    walked.push(current.clone());
    travelled += step;
  }
  // The course may be shorter than the nominal ramp; grade over what there is.
  const total = travelled || 1;
  let along = 0;
  return walked.map((point, index) => {
    if (index > 0) {
      const previous = walked[index - 1];
      along += Math.hypot(point.x - previous.x, point.z - previous.z);
    }
    const graded = point.clone();
    graded.y = SURFACE_Y + (tunnelY - SURFACE_Y) * Math.min(1, along / total);
    return graded;
  });
}

function pathLength(points: readonly Vector3[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += points[index].distanceTo(points[index - 1]);
  }
  return total;
}

/** Slice a centreline by travelled metres, preserving exact end points. */
function centrelineInterval(
  points: readonly Vector3[],
  fromM: number,
  toM: number,
): Vector3[] {
  if (toM <= fromM || points.length < 2) {
    return [];
  }
  const result: Vector3[] = [];
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = start.distanceTo(end);
    const segmentStart = travelled;
    const segmentEnd = travelled + length;
    if (segmentEnd < fromM || segmentStart > toM) {
      travelled = segmentEnd;
      continue;
    }
    const startAt = Math.max(fromM, segmentStart);
    const endAt = Math.min(toM, segmentEnd);
    const startFraction = (startAt - segmentStart) / (length || 1);
    const endFraction = (endAt - segmentStart) / (length || 1);
    const intervalStart = start.clone().lerp(end, startFraction);
    const intervalEnd = start.clone().lerp(end, endFraction);
    if (
      result.length === 0 ||
      !result[result.length - 1].equals(intervalStart)
    ) {
      result.push(intervalStart);
    }
    result.push(intervalEnd);
    travelled = segmentEnd;
  }
  return result;
}

/**
 * An opaque ground-depth ribbon seals the otherwise closed surface shell above
 * every buried part of the middle tube. It deliberately leaves both canonical
 * portal troughs uncovered: they remain the sole daylight surface owners and
 * keep the Kemperplatz / Südeingang bore sights usable.
 *
 * The ribbon sits at a conservative surface-adjacent level. It deliberately
 * bypasses the depth test while writing depth itself: the official terrain,
 * water and glass surfaces do not reliably write a usable depth value, but
 * the tunnel bore does deliberately bypass depth so it remains visible inside
 * each portal. Drawing this opaque backing last is therefore the hard public
 * visibility boundary outside the two trough openings.
 */
function addBuriedTunnelOcclusionCap(
  group: Group,
  points: readonly Vector3[],
  width: number,
): void {
  const totalLength = pathLength(points);
  const coveredStart = Math.max(
    0,
    RAMP_LENGTH_M - BURIED_CAP_TROUGH_SEAM_OVERLAP_M,
  );
  const coveredEnd = Math.max(
    coveredStart,
    totalLength - RAMP_LENGTH_M + BURIED_CAP_TROUGH_SEAM_OVERLAP_M,
  );
  const covered = centrelineInterval(points, coveredStart, coveredEnd);
  if (covered.length < 2) {
    return;
  }
  const halfWidth = width + BURIED_CAP_MARGIN_M;
  const positions: number[] = [];
  for (let index = 0; index < covered.length; index += 1) {
    const current = covered[index];
    const before = covered[Math.max(0, index - 1)];
    const after = covered[Math.min(covered.length - 1, index + 1)];
    const tangent = after.clone().sub(before);
    const run = Math.hypot(tangent.x, tangent.z) || 1;
    const normal = new Vector3(-tangent.z / run, 0, tangent.x / run);
    for (const side of [-1, 1]) {
      const point = current.clone().addScaledVector(normal, side * halfWidth);
      positions.push(point.x, SURFACE_Y + BURIED_CAP_CLEARANCE_M, point.z);
    }
  }
  const indices: number[] = [];
  for (let index = 0; index < covered.length - 1; index += 1) {
    const base = index * 2;
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new MeshBasicMaterial({
    color: 0xb8bbb7,
    depthTest: false,
    depthWrite: true,
    side: DoubleSide,
  });
  const cap = new Mesh(geometry, material);
  cap.name = BURIED_CAP_NAME;
  cap.userData.geometryStatus =
    "Engineered presentation occlusion cap derived from the OSM route centreline; not surveyed surface geometry";
  cap.userData.coveredRouteRangeM = [coveredStart, coveredEnd];
  cap.userData.exemptPortalTroughs = ["north", "south"];
  cap.userData.occludesTunnelInteriorOutsidePortalTroughs = true;
  // Portal decks, bores and lamps use forced surface depth to survive the
  // official uncut mesh. Draw the cap after every forced-depth interior
  // element, so it is a hard visibility boundary even behind transparent
  // Cube glass or a non-depth-writing water/bridge surface.
  cap.renderOrder = BURIED_CAP_RENDER_ORDER;
  cap.receiveShadow = true;
  group.add(cap);
}

/**
 * Keep the public ramps in every surface style, but hide their internal
 * forced-depth cap in the voxel world. The cap only seals transparent
 * photogrammetry; above opaque blocks it would become a kilometre-long grey
 * ribbon because Minecraft deliberately remaps every visible material.
 */
export function setTunnelPortalPresentation(
  group: Group,
  underside: boolean,
  voxelMode: boolean,
): void {
  group.visible = !underside;
  const cap = group.getObjectByName(BURIED_CAP_NAME);
  if (cap) {
    cap.visible = !voxelMode;
  }
}

function addRamp(
  group: Group,
  label: string,
  centreline: Vector3[],
  width: number,
  height: number,
  materials: {
    barrier: MeshStandardMaterial;
    concrete: MeshStandardMaterial;
    marking: MeshStandardMaterial;
    road: MeshStandardMaterial;
  },
): void {
  const deckGeometry = new BoxGeometry(width, 0.4, 1);
  const wallGeometry = new BoxGeometry(WALL_THICKNESS_M, 1, 1);
  const barrierGeometry = new BoxGeometry(0.18, BARRIER_HEIGHT_M, 1);
  const dashes: Object3D[] = [];
  const dummy = new Object3D();

  for (let index = 0; index < centreline.length - 1; index += 1) {
    const from = centreline[index];
    const to = centreline[index + 1];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const run = Math.hypot(dx, dz) || 1;
    const normal = new Vector3(-dz / run, 0, dx / run);
    // One trough per direction of travel, mirroring the two tubes.
    for (const tube of [-1, 1]) {
      const lateral = tube * (width / 2 + 0.85);
      const deckFrom = from.clone().addScaledVector(normal, lateral);
      const deckTo = to.clone().addScaledVector(normal, lateral);
      slopedBox(
        group,
        `${label} carriageway deck`,
        deckGeometry,
        materials.road,
        deckFrom,
        deckTo,
      ).renderOrder = 30;
      const deepest = Math.min(deckFrom.y, deckTo.y);
      const wallHeight = WALL_TOP_Y - deepest + 1.2;
      for (const edge of [-1, 1]) {
        const edgeOffset = lateral + edge * (width / 2 + WALL_THICKNESS_M / 2);
        const wallFrom = from.clone().addScaledVector(normal, edgeOffset);
        const wallTo = to.clone().addScaledVector(normal, edgeOffset);
        const wall = uprightBox(
          group,
          `${label} retaining wall`,
          wallGeometry,
          materials.concrete,
          wallFrom,
          wallTo,
          WALL_TOP_Y - wallHeight / 2,
        );
        wall.renderOrder = 35;
        wall.scale.y = wallHeight;
        uprightBox(
          group,
          `${label} noise barrier`,
          barrierGeometry,
          materials.barrier,
          wallFrom,
          wallTo,
          WALL_TOP_Y + BARRIER_HEIGHT_M / 2,
        ).renderOrder = 40;
      }
      // Dashed centre line running down into the tube.
      const dashCount = Math.max(1, Math.round(run / 14));
      for (let dash = 0; dash < dashCount; dash += 1) {
        const at = (dash + 0.5) / dashCount;
        dummy.position
          .copy(deckFrom)
          .lerp(deckTo, at)
          .add(new Vector3(0, 0.22, 0));
        dummy.rotation.set(0, Math.atan2(dx, dz), 0);
        dummy.scale.set(1, 1, Math.min(6, run / dashCount / 2));
        dummy.updateMatrix();
        dashes.push(dummy.clone());
      }
    }
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
    const lateral = tube * (width / 2 + 0.85);
    const beam = new Mesh(
      new BoxGeometry(width + 2.6, 1.5, 1.4),
      materials.concrete,
    );
    beam.name = `${label} portal frame`;
    beam.position.copy(head).addScaledVector(headNormal, lateral);
    beam.position.y = head.y + height + 0.9;
    beam.rotation.y = yaw;
    beam.renderOrder = 55;
    beam.castShadow = true;
    group.add(beam);
    for (const edge of [-1, 1]) {
      const jamb = new Mesh(
        new BoxGeometry(1.3, height + 1.6, 1.4),
        materials.concrete,
      );
      jamb.name = `${label} portal jamb`;
      jamb.position
        .copy(head)
        .addScaledVector(headNormal, lateral + edge * (width / 2 + 0.65));
      jamb.position.y = head.y + (height + 1.6) / 2;
      jamb.rotation.y = yaw;
      jamb.renderOrder = 55;
      jamb.castShadow = true;
      group.add(jamb);
    }
  }

  // The visible tube interior ("man muss … tief hineinschauen können"):
  // each mouth continues past its portal frame as a real receding bore —
  // dark road deck, side walls, ceiling with a row of warm lamps, and a
  // near-black end cap that reads as the tunnel disappearing under the
  // city rather than a painted-on hole. Everything sits BELOW street
  // level, so it is only ever seen through the mouth itself.
  const BORE_LENGTH_M = 46;
  const boreWall = surfaceMaterial(0x4a4d4b, { roughness: 0.92 });
  const boreDeck = surfaceMaterial(0x272c30, { roughness: 0.95 });
  const boreCeiling = surfaceMaterial(0x3a3e3d, { roughness: 0.92 });
  const boreEnd = surfaceMaterial(0x0a0c0d, { roughness: 1 });
  const lampMaterial = new MeshStandardMaterial({
    color: 0xffe2b0,
    emissive: 0xffc678,
    emissiveIntensity: 1.15,
    roughness: 0.6,
    depthTest: false,
    depthWrite: false,
  });
  for (const tube of [-1, 1]) {
    const lateral = tube * (width / 2 + 0.85);
    const mouth = head
      .clone()
      .addScaledVector(headNormal, lateral)
      .addScaledVector(inward, 0.7);
    const boreCentre = mouth.clone().addScaledVector(inward, BORE_LENGTH_M / 2);
    const place = (mesh: Mesh, name: string, y: number): Mesh => {
      mesh.name = name;
      mesh.position.set(boreCentre.x, y, boreCentre.z);
      mesh.rotation.y = yaw;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };
    place(
      new Mesh(new BoxGeometry(width, 0.3, BORE_LENGTH_M), boreDeck),
      `${label} bore deck`,
      head.y - 0.15,
    ).renderOrder = 4;
    place(
      new Mesh(new BoxGeometry(width + 1.0, 0.4, BORE_LENGTH_M), boreCeiling),
      `${label} bore ceiling`,
      head.y + height + 0.2,
    ).renderOrder = 1;
    for (const side of [-1, 1]) {
      const wall = new Mesh(
        new BoxGeometry(0.5, height, BORE_LENGTH_M),
        boreWall,
      );
      wall.position
        .set(boreCentre.x, head.y + height / 2, boreCentre.z)
        .addScaledVector(headNormal, side * (width / 2 + 0.25));
      wall.rotation.y = yaw;
      wall.name = `${label} bore wall`;
      wall.receiveShadow = true;
      wall.renderOrder = 2;
      group.add(wall);
    }
    const endCap = new Mesh(
      new BoxGeometry(width + 1.0, height + 0.6, 0.4),
      boreEnd,
    );
    endCap.position.copy(mouth).addScaledVector(inward, BORE_LENGTH_M - 0.4);
    endCap.position.y = head.y + height / 2;
    endCap.rotation.y = yaw;
    endCap.name = `${label} bore depth cap`;
    endCap.renderOrder = 1;
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
      lamp.position.y = head.y + height - 0.12;
      lamp.rotation.y = yaw;
      lamp.name = `${label} bore ceiling lamp`;
      lamp.renderOrder = 5;
      group.add(lamp);
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

export function tunnelMouthViews(
  payload: TunnelPortalPayload,
): { north: TunnelMouthView; south: TunnelMouthView } | null {
  const points = payload.points.map((point) => new Vector3(...point));
  if (points.length < 2) {
    return null;
  }
  const tunnelY = points[0].y;
  const build = (fromStart: boolean): TunnelMouthView => {
    const centreline = rampCentreline(
      points,
      fromStart,
      fromStart ? tunnelY : points[points.length - 1].y,
    );
    const head = centreline[centreline.length - 1];
    const before = centreline[Math.max(0, centreline.length - 2)];
    const inward = new Vector3(head.x - before.x, 0, head.z - before.z);
    inward.normalize();
    const normal = new Vector3(-inward.z, 0, inward.x);
    // Aim INSIDE one bore, not at the median wall between the two: the
    // tubes flank the centreline at ±(width/2 + 0.85), exactly where
    // addRamp lays their decks.
    const lateral = payload.clear_width_each_direction_m / 2 + 0.85;
    const target = head
      .clone()
      .addScaledVector(inward, 4)
      .addScaledVector(normal, lateral);
    target.y = head.y + payload.clear_height_m / 2;

    // The camera stands up the ramp's own centreline rather than on a fixed
    // sphere around the target. It must remain close: a 46 m stand became a
    // 150 m stand after the isometric FOV's dolly compensation and landed
    // over the Landwehrkanal instead of in front of the south mouth.
    // Walking 32 m back keeps the portal frame beyond the basin-side ramp
    // edge while a photographic frame still contains both bores.
    const STAND_BACK_M = 32;
    let stand = head.clone();
    let walked = 0;
    for (let index = centreline.length - 1; index > 0; index -= 1) {
      const current = centreline[index];
      const previous = centreline[index - 1];
      const step = Math.hypot(current.x - previous.x, current.z - previous.z);
      if (walked + step >= STAND_BACK_M) {
        const fraction = (STAND_BACK_M - walked) / (step || 1);
        stand = current.clone().lerp(previous, fraction);
        walked = STAND_BACK_M;
        break;
      }
      stand = previous.clone();
      walked += step;
    }
    // A close photographic lens can frame both bores without turning this
    // dedicated portal sight into a distant map view. The eye remains 2 m
    // above street level (well clear of the underside threshold) while the
    // target sits halfway up the tube, so the ray clears the ramp lip and
    // continues through the lit bore instead of looking down at paving.
    stand.y = Math.max(stand.y, SURFACE_Y) + 2;
    stand.addScaledVector(normal, lateral);

    const offset = stand.clone().sub(target);
    const distance = offset.length() || 1;
    return {
      azimuth_degrees: Math.atan2(offset.x, offset.z) * (180 / Math.PI),
      distance_m: distance,
      fov_degrees: 39,
      polar_degrees: Math.acos(offset.y / distance) * (180 / Math.PI),
      target_height_m: 0,
      target_world: [target.x, target.y, target.z],
    };
  };

  return { north: build(true), south: build(false) };
}

/**
 * Both open approaches, ready to drop into the daylight scene.
 * The two mouths are named so the report and the tests can tell them apart.
 */
export function createTunnelPortals(payload: TunnelPortalPayload): Group {
  const group = new Group();
  group.name = "Tiergartentunnel portal approaches";
  group.userData.geometryStatus =
    "OSM-derived plan course with an engineered 5 % vertical profile; the manifest carries only a schematic constant tunnel depth";
  const points = payload.points.map((point) => new Vector3(...point));
  if (points.length < 2) {
    return group;
  }
  const materials = {
    barrier: surfaceMaterial(BARRIER, { metalness: 0.22, roughness: 0.62 }),
    concrete: surfaceMaterial(CONCRETE),
    marking: surfaceMaterial(MARKING, { roughness: 0.94 }),
    road: surfaceMaterial(ASPHALT, { roughness: 0.93 }),
  };
  const tunnelY = points[0].y;
  addRamp(
    group,
    "Tiergartentunnel north ramp",
    rampCentreline(points, true, tunnelY),
    payload.clear_width_each_direction_m,
    payload.clear_height_m,
    materials,
  );
  addRamp(
    group,
    "Tiergartentunnel south ramp",
    rampCentreline(points, false, points[points.length - 1].y),
    payload.clear_width_each_direction_m,
    payload.clear_height_m,
    materials,
  );
  addBuriedTunnelOcclusionCap(
    group,
    points,
    payload.clear_width_each_direction_m,
  );
  return group;
}
