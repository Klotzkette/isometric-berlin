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
  for (let index = 1; index < ordered.length && travelled < RAMP_LENGTH_M; index += 1) {
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
      );
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
        wall.scale.y = wallHeight;
        uprightBox(
          group,
          `${label} noise barrier`,
          barrierGeometry,
          materials.barrier,
          wallFrom,
          wallTo,
          WALL_TOP_Y + BARRIER_HEIGHT_M / 2,
        );
      }
      // Dashed centre line running down into the tube.
      const dashCount = Math.max(1, Math.round(run / 14));
      for (let dash = 0; dash < dashCount; dash += 1) {
        const at = (dash + 0.5) / dashCount;
        dummy.position.copy(deckFrom).lerp(deckTo, at).add(new Vector3(0, 0.22, 0));
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
  });
  for (const tube of [-1, 1]) {
    const lateral = tube * (width / 2 + 0.85);
    const mouth = head
      .clone()
      .addScaledVector(headNormal, lateral)
      .addScaledVector(inward, 0.7);
    const boreCentre = mouth
      .clone()
      .addScaledVector(inward, BORE_LENGTH_M / 2);
    const place = (
      mesh: Mesh,
      name: string,
      y: number,
    ): void => {
      mesh.name = name;
      mesh.position.set(boreCentre.x, y, boreCentre.z);
      mesh.rotation.y = yaw;
      mesh.receiveShadow = true;
      group.add(mesh);
    };
    place(
      new Mesh(new BoxGeometry(width, 0.3, BORE_LENGTH_M), boreDeck),
      `${label} bore deck`,
      head.y - 0.15,
    );
    place(
      new Mesh(new BoxGeometry(width + 1.0, 0.4, BORE_LENGTH_M), boreCeiling),
      `${label} bore ceiling`,
      head.y + height + 0.2,
    );
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
      group.add(wall);
    }
    const endCap = new Mesh(
      new BoxGeometry(width + 1.0, height + 0.6, 0.4),
      boreEnd,
    );
    endCap.position
      .copy(mouth)
      .addScaledVector(inward, BORE_LENGTH_M - 0.4);
    endCap.position.y = head.y + height / 2;
    endCap.rotation.y = yaw;
    endCap.name = `${label} bore depth cap`;
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
      group.add(lamp);
    }
  }
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
  return group;
}
