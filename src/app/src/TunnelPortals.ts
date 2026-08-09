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
const PORTAL_INTERIOR_FLAG = "tiergartentunnelPortalInterior";

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
  group.traverse((object) => {
    if (object.userData[PORTAL_INTERIOR_FLAG] === true) {
      object.visible = interiorVisible;
    }
  });
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
  const boreWall = surfaceMaterial(0x5d625f, { roughness: 0.92 });
  const boreDeck = surfaceMaterial(0x30363a, { roughness: 0.95 });
  const boreCeiling = surfaceMaterial(0x464a48, { roughness: 0.92 });
  const boreEnd = surfaceMaterial(0x111416, { roughness: 1 });
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
    ).renderOrder = 74;
    place(
      new Mesh(new BoxGeometry(width + 1.0, 0.4, BORE_LENGTH_M), boreCeiling),
      `${label} bore ceiling`,
      head.y + height + 0.2,
    ).renderOrder = 71;
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
      wall.renderOrder = 72;
      group.add(wall);

      // A calm, continuous reflector band makes the close bore view readable
      // without animated lighting or depth-fighting decals.
      const guide = new Mesh(
        new BoxGeometry(0.08, 0.12, BORE_LENGTH_M),
        guideMaterial,
      );
      guide.position
        .set(boreCentre.x, head.y + 1.05, boreCentre.z)
        .addScaledVector(headNormal, side * (width / 2 - 0.03));
      guide.rotation.y = yaw;
      guide.name = `${label} bore safety guide`;
      guide.renderOrder = 77;
      group.add(guide);
    }
    const endCap = new Mesh(
      new BoxGeometry(width + 1.0, height + 0.6, 0.4),
      boreEnd,
    );
    endCap.position.copy(mouth).addScaledVector(inward, BORE_LENGTH_M - 0.4);
    endCap.position.y = head.y + height / 2;
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
      lamp.position.y = head.y + height - 0.12;
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
    // The south view aims farther into its long, exposed approach so the lamp
    // rhythm and both wall guides establish depth behind the portal frame.
    const targetInM = fromStart ? 10 : 18;
    const target = head
      .clone()
      .addScaledVector(inward, targetInM)
      .addScaledVector(normal, lateral);
    target.y = head.y + payload.clear_height_m / 2;

    // The camera stands up the ramp's own centreline rather than on a fixed
    // sphere around the target. It must remain close: a 46 m stand became a
    // 150 m stand after the isometric FOV's dolly compensation and landed
    // over the Landwehrkanal instead of in front of the south mouth.
    // Each stand distance is tuned to the available open-ramp envelope; the
    // south mouth must stay close enough to avoid seeing the uncut city shell.
    const standBackM = fromStart ? 26 : 12;
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
    stand.y += fromStart ? 1.9 : 1.65;
    stand.addScaledVector(normal, lateral);

    const offset = stand.clone().sub(target);
    const distance = offset.length() || 1;
    return {
      azimuth_degrees: Math.atan2(offset.x, offset.z) * (180 / Math.PI),
      distance_m: distance,
      fov_degrees: fromStart ? 38 : 36,
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
  setTunnelPortalPresentation(group, false, false, false);
  return group;
}
