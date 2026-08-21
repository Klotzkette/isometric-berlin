import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";

import { POTSDAMER_DETAIL_PROFILE } from "./expandedCityProfiles";
import { SONY_CENTER_OSM_PANEL_PLAN } from "./sonyCenterPanelPlan";

const PROFILE = POTSDAMER_DETAIL_PROFILE.sonyCenterForumRoof;
const UP = new Vector3(0, 1, 0);
const STRUCTURE_DAY = new MeshBasicMaterial({ color: 0x82979d });
const STRUCTURE_NIGHT = new MeshStandardMaterial({
  color: 0x71838c,
  metalness: 0.42,
  roughness: 0.34,
});

const OSM_RING_SIZE_M = [103.407738, 78.079653] as const;

type BoxInstance = {
  position: Vector3;
  rotationY: number;
  size: Vector3;
};

function ringPoint(index: number, heightOffset = 0): Vector3 {
  const angle = (index / PROFILE.segmentCount) * Math.PI * 2;
  const rotation = (PROFILE.axisDegrees * Math.PI) / 180;
  const localX = Math.cos(angle) * (PROFILE.outerRingSizeM[0] / 2);
  const localZ = Math.sin(angle) * (PROFILE.outerRingSizeM[1] / 2);
  return new Vector3(
    PROFILE.outerRingCenterWorldM[0] +
      localX * Math.cos(rotation) -
      localZ * Math.sin(rotation),
    PROFILE.groundY +
      PROFILE.supportHeightAboveGroundM +
      Math.sin(angle - 0.38) * 1.65 +
      heightOffset,
    PROFILE.outerRingCenterWorldM[1] +
      localX * Math.sin(rotation) +
      localZ * Math.cos(rotation),
  );
}

function openingPoint(index: number, heightOffset = 0): Vector3 {
  const angle = (index / PROFILE.segmentCount) * Math.PI * 2;
  const peakY = PROFILE.groundY + PROFILE.peakHeightAboveGroundM;
  return new Vector3(
    PROFILE.openingCenterWorldM[0] + Math.cos(angle) * PROFILE.openingRadiusM,
    peakY - 10.8 + Math.sin(angle - 0.38) * 0.85 + heightOffset,
    PROFILE.openingCenterWorldM[1] + Math.sin(angle) * PROFILE.openingRadiusM,
  );
}

function fitOsmPointToPublishedRing(
  x: number,
  z: number,
  edge: "inner" | "outer",
): Vector3 {
  const rotation = (PROFILE.axisDegrees * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = x - PROFILE.outerRingCenterWorldM[0];
  const dz = z - PROFILE.outerRingCenterWorldM[1];
  const localX =
    (dx * cos + dz * sin) * (PROFILE.outerRingSizeM[0] / OSM_RING_SIZE_M[0]);
  const localZ =
    (-dx * sin + dz * cos) * (PROFILE.outerRingSizeM[1] / OSM_RING_SIZE_M[1]);
  const fittedX =
    PROFILE.outerRingCenterWorldM[0] + localX * cos - localZ * sin;
  const fittedZ =
    PROFILE.outerRingCenterWorldM[1] + localX * sin + localZ * cos;

  if (edge === "inner") {
    const angle = Math.atan2(
      fittedZ - PROFILE.openingCenterWorldM[1],
      fittedX - PROFILE.openingCenterWorldM[0],
    );
    const index = (angle / (Math.PI * 2)) * PROFILE.segmentCount;
    return openingPoint(index);
  }

  const fittedLocalX =
    (fittedX - PROFILE.outerRingCenterWorldM[0]) * cos +
    (fittedZ - PROFILE.outerRingCenterWorldM[1]) * sin;
  const fittedLocalZ =
    -(fittedX - PROFILE.outerRingCenterWorldM[0]) * sin +
    (fittedZ - PROFILE.outerRingCenterWorldM[1]) * cos;
  const angle = Math.atan2(
    fittedLocalZ / (PROFILE.outerRingSizeM[1] / 2),
    fittedLocalX / (PROFILE.outerRingSizeM[0] / 2),
  );
  const index = (angle / (Math.PI * 2)) * PROFILE.segmentCount;
  return ringPoint(index);
}

function kingpostPeak(): Vector3 {
  return new Vector3(
    PROFILE.openingCenterWorldM[0] + 0.7,
    PROFILE.groundY + PROFILE.peakHeightAboveGroundM,
    PROFILE.openingCenterWorldM[1] - 0.35,
  );
}

function kingpostLowerTip(): Vector3 {
  const peak = kingpostPeak();
  const tilt = (PROFILE.kingpostTiltDegrees * Math.PI) / 180;
  const horizontalOffset = Math.sin(tilt) * PROFILE.kingpostLengthM;
  const verticalDrop = Math.cos(tilt) * PROFILE.kingpostLengthM;
  return peak.add(
    new Vector3(
      -horizontalOffset * 0.9285,
      -verticalDrop,
      horizontalOffset * 0.3714,
    ),
  );
}

function addTriangle(
  positions: number[],
  normals: number[],
  first: Vector3,
  second: Vector3,
  third: Vector3,
): void {
  const normal = second
    .clone()
    .sub(first)
    .cross(third.clone().sub(first))
    .normalize();
  for (const vertex of [first, second, third]) {
    positions.push(vertex.x, vertex.y, vertex.z);
    normals.push(normal.x, normal.y, normal.z);
  }
}

function addQuad(
  positions: number[],
  normals: number[],
  first: Vector3,
  second: Vector3,
  third: Vector3,
  fourth: Vector3,
): void {
  addTriangle(positions, normals, first, second, third);
  addTriangle(positions, normals, first, third, fourth);
}

function makeMembraneGeometry(): BufferGeometry {
  const normals: number[] = [];
  const positions: number[] = [];
  for (const panel of SONY_CENTER_OSM_PANEL_PLAN) {
    const vertices = panel.vertices.map(([x, z], index) =>
      fitOsmPointToPublishedRing(x, z, index === 0 ? "inner" : "outer"),
    );
    for (let index = 1; index < vertices.length - 1; index += 1) {
      addTriangle(
        positions,
        normals,
        vertices[0],
        vertices[index],
        vertices[index + 1],
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function makeGlassGeometry(): BufferGeometry {
  const normals: number[] = [];
  const positions: number[] = [];
  for (let index = 0; index < SONY_CENTER_OSM_PANEL_PLAN.length; index += 1) {
    const panel = SONY_CENTER_OSM_PANEL_PLAN[index];
    const next =
      SONY_CENTER_OSM_PANEL_PLAN[
        (index + 1) % SONY_CENTER_OSM_PANEL_PLAN.length
      ];
    addQuad(
      positions,
      normals,
      fitOsmPointToPublishedRing(
        panel.vertices[0][0],
        panel.vertices[0][1],
        "inner",
      ),
      fitOsmPointToPublishedRing(
        panel.vertices[1][0],
        panel.vertices[1][1],
        "outer",
      ),
      fitOsmPointToPublishedRing(
        next.vertices[next.vertices.length - 1][0],
        next.vertices[next.vertices.length - 1][1],
        "outer",
      ),
      fitOsmPointToPublishedRing(
        next.vertices[0][0],
        next.vertices[0][1],
        "inner",
      ),
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function addModeMesh(
  group: Group,
  name: string,
  geometry: BufferGeometry,
  dayMaterial: MeshBasicMaterial,
  nightMaterial: MeshStandardMaterial,
): Mesh {
  const mesh = new Mesh(geometry, dayMaterial);
  mesh.name = name;
  mesh.userData.dayMaterial = dayMaterial;
  mesh.userData.nightMaterial = nightMaterial;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);
  return mesh;
}

function cylinderMatrix(start: Vector3, end: Vector3): Matrix4 {
  const direction = end.clone().sub(start);
  const centre = start.clone().add(end).multiplyScalar(0.5);
  const rotation = new Quaternion().setFromUnitVectors(
    UP,
    direction.clone().normalize(),
  );
  return new Matrix4().compose(
    centre,
    rotation,
    new Vector3(1, direction.length(), 1),
  );
}

function makeInstancedTubes(
  name: string,
  pairs: Array<[Vector3, Vector3]>,
  radius: number,
  radialSegments: number,
): InstancedMesh {
  const geometry = new CylinderGeometry(radius, radius, 1, radialSegments, 1);
  const mesh = new InstancedMesh(geometry, STRUCTURE_DAY, pairs.length);
  mesh.name = name;
  mesh.userData.dayMaterial = STRUCTURE_DAY;
  mesh.userData.nightMaterial = STRUCTURE_NIGHT;
  pairs.forEach(([start, end], index) => {
    mesh.setMatrixAt(index, cylinderMatrix(start, end));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  return mesh;
}

function makeInstancedBoxes(
  name: string,
  entries: BoxInstance[],
  dayMaterial: MeshBasicMaterial,
  nightMaterial: MeshStandardMaterial,
): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1);
  const mesh = new InstancedMesh(geometry, dayMaterial, entries.length);
  mesh.name = name;
  mesh.userData.dayMaterial = dayMaterial;
  mesh.userData.nightMaterial = nightMaterial;
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  entries.forEach((entry, index) => {
    rotation.setFromAxisAngle(UP, entry.rotationY);
    matrix.compose(entry.position, rotation, entry.size);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/**
 * The former roof-only signature left a pale generic ring below the canopy.
 * These inward Forum facades follow the same published ellipse: cool glass,
 * stainless horizontal rails and the real warm-red vertical accent rhythm.
 */
function addForumFacades(group: Group): void {
  const glassPanels: BoxInstance[] = [];
  const horizontalRails: BoxInstance[] = [];
  const verticalMullions: BoxInstance[] = [];
  const entranceGlazing: BoxInstance[] = [];
  const parapetCaps: BoxInstance[] = [];
  const redFins: BoxInstance[] = [];
  const radiusX = PROFILE.outerRingSizeM[0] * 0.435;
  const radiusZ = PROFILE.outerRingSizeM[1] * 0.435;
  const axis = (PROFILE.axisDegrees * Math.PI) / 180;
  const panelCount = 28;
  for (let index = 0; index < panelCount; index += 1) {
    const angle = (index / panelCount) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const localX = cos * radiusX;
    const localZ = sin * radiusZ;
    const x =
      PROFILE.outerRingCenterWorldM[0] +
      localX * Math.cos(axis) -
      localZ * Math.sin(axis);
    const z =
      PROFILE.outerRingCenterWorldM[1] +
      localX * Math.sin(axis) +
      localZ * Math.cos(axis);
    const tangentX =
      -radiusX * sin * Math.cos(axis) - radiusZ * cos * Math.sin(axis);
    const tangentZ =
      -radiusX * sin * Math.sin(axis) + radiusZ * cos * Math.cos(axis);
    const rotationY = -Math.atan2(tangentZ, tangentX);
    const tangentLength = Math.hypot(tangentX, tangentZ);
    const unitTangentX = tangentX / tangentLength;
    const unitTangentZ = tangentZ / tangentLength;
    for (let floor = 0; floor < 6; floor += 1) {
      glassPanels.push({
        position: new Vector3(x, PROFILE.groundY + 8.85 + floor * 4.3, z),
        rotationY,
        size: new Vector3(8.05, 3.86, 0.34),
      });
    }
    redFins.push({
      position: new Vector3(
        x - unitTangentX * 4.08,
        PROFILE.groundY + 20.2,
        z - unitTangentZ * 4.08,
      ),
      rotationY,
      size: new Vector3(0.32, 28.1, 0.56),
    });
    for (const offset of [-2.65, 0, 2.65]) {
      verticalMullions.push({
        position: new Vector3(
          x + unitTangentX * offset,
          PROFILE.groundY + 20.2,
          z + unitTangentZ * offset,
        ),
        rotationY,
        size: new Vector3(0.13, 27.4, 0.46),
      });
    }
    for (let floor = 0; floor <= 6; floor += 1) {
      horizontalRails.push({
        position: new Vector3(x, PROFILE.groundY + 6.7 + floor * 4.3, z),
        rotationY,
        size: new Vector3(8.2, 0.16, 0.5),
      });
    }
    parapetCaps.push({
      position: new Vector3(x, PROFILE.groundY + 34.6, z),
      rotationY,
      size: new Vector3(8.25, 0.34, 0.92),
    });
    if (index % 2 === 0) {
      for (const offset of [-2.0, 2.0]) {
        entranceGlazing.push({
          position: new Vector3(
            x + unitTangentX * offset,
            PROFILE.groundY + 3.05,
            z + unitTangentZ * offset,
          ),
          rotationY,
          size: new Vector3(3.55, 5.5, 0.32),
        });
      }
    }
  }
  group.add(
    makeInstancedBoxes(
      "Sony Center curved Forum glass facades",
      glassPanels,
      new MeshBasicMaterial({
        color: 0xa9cbd0,
        depthWrite: false,
        opacity: 0.28,
        transparent: true,
      }),
      new MeshStandardMaterial({
        color: 0x294d5c,
        depthWrite: false,
        emissive: 0x6c9bad,
        emissiveIntensity: 0.16,
        metalness: 0.12,
        opacity: 0.34,
        roughness: 0.28,
        transparent: true,
      }),
    ),
    makeInstancedBoxes(
      "Sony Center stainless facade rails",
      horizontalRails,
      new MeshBasicMaterial({ color: 0xd7dddd }),
      new MeshStandardMaterial({
        color: 0x8d999c,
        metalness: 0.45,
        roughness: 0.34,
      }),
    ),
    makeInstancedBoxes(
      "Sony Center stainless vertical mullions",
      verticalMullions,
      new MeshBasicMaterial({ color: 0xc9d3d5 }),
      new MeshStandardMaterial({
        color: 0x829094,
        metalness: 0.48,
        roughness: 0.32,
      }),
    ),
    makeInstancedBoxes(
      "Sony Center alternating full-height Forum entrances",
      entranceGlazing,
      new MeshBasicMaterial({
        color: 0x527f8b,
        depthWrite: false,
        opacity: 0.5,
        transparent: true,
      }),
      new MeshStandardMaterial({
        color: 0x1f4450,
        depthWrite: false,
        emissive: 0x79aab4,
        emissiveIntensity: 0.22,
        opacity: 0.54,
        roughness: 0.24,
        transparent: true,
      }),
    ),
    makeInstancedBoxes(
      "Sony Center continuous Forum parapet caps",
      parapetCaps,
      new MeshBasicMaterial({ color: 0xdce2e2 }),
      new MeshStandardMaterial({
        color: 0x8a9698,
        metalness: 0.42,
        roughness: 0.38,
      }),
    ),
    makeInstancedBoxes(
      "Sony Center warm red facade fins",
      redFins,
      new MeshBasicMaterial({ color: 0xa94d43 }),
      new MeshStandardMaterial({
        color: 0x7a2f31,
        emissive: 0xb74349,
        emissiveIntensity: 0.1,
        roughness: 0.82,
      }),
    ),
  );
  group.userData.forumFacadePanelCount = panelCount;
  group.userData.forumFacadeFloorCount = 6;
  group.userData.forumFacadeGlassFieldCount = glassPanels.length;
  group.userData.forumFacadeMullionCount = verticalMullions.length;
  group.userData.forumEntranceFieldCount = entranceGlazing.length;
}

function makeInstancedNodes(
  name: string,
  points: Vector3[],
  radius: number,
): InstancedMesh {
  const nodes = new InstancedMesh(
    new SphereGeometry(radius, 7, 5),
    STRUCTURE_DAY,
    points.length,
  );
  nodes.name = name;
  nodes.userData.dayMaterial = STRUCTURE_DAY;
  nodes.userData.nightMaterial = STRUCTURE_NIGHT;
  const matrix = new Matrix4();
  points.forEach((point, index) => {
    matrix.makeTranslation(point.x, point.y, point.z);
    nodes.setMatrixAt(index, matrix);
  });
  nodes.instanceMatrix.needsUpdate = true;
  nodes.computeBoundingBox();
  nodes.computeBoundingSphere();
  nodes.castShadow = false;
  return nodes;
}

/**
 * The OSM membrane fields and Arup structure stay the metric anchor. These
 * five shared batches supply the fine clamping, alternating ridge/valley and
 * night-service details visible in the official engineering photographs.
 */
function addRoofGranularity(group: Group): void {
  const panelClamps: Array<[Vector3, Vector3]> = [];
  for (const panel of SONY_CENTER_OSM_PANEL_PLAN) {
    const vertices = panel.vertices.map(([x, z], index) =>
      fitOsmPointToPublishedRing(x, z, index === 0 ? "inner" : "outer"),
    );
    for (let index = 0; index < vertices.length; index += 1) {
      panelClamps.push([
        vertices[index],
        vertices[(index + 1) % vertices.length],
      ]);
    }
  }

  const ridgeCables: Array<[Vector3, Vector3]> = [];
  const valleyCables: Array<[Vector3, Vector3]> = [];
  const junctions: Vector3[] = [];
  const soffitLights: BoxInstance[] = [];
  for (let index = 0; index < PROFILE.segmentCount; index += 1) {
    const foldOffset = index % 2 === 0 ? 0.42 : -0.34;
    const outer = ringPoint(index, foldOffset);
    const inner = openingPoint(index, foldOffset * 0.58);
    (index % 2 === 0 ? ridgeCables : valleyCables).push([outer, inner]);
    junctions.push(outer, inner);
    const next = ringPoint(index + 1, foldOffset);
    const midpoint = outer.clone().add(next).multiplyScalar(0.5);
    soffitLights.push({
      position: midpoint.add(new Vector3(0, -0.55, 0)),
      rotationY: (PROFILE.axisDegrees * Math.PI) / 180,
      size: new Vector3(0.58, 0.18, 0.42),
    });
  }
  const nightLightMaterial = new MeshStandardMaterial({
    color: 0x625b43,
    emissive: 0xffbf65,
    emissiveIntensity: 1.2,
    roughness: 0.42,
  });
  group.add(
    makeInstancedTubes(
      "Sony Center membrane field clamp rails",
      panelClamps,
      0.035,
      5,
    ),
    makeInstancedTubes(
      "Sony Center twelve upper ridge cables",
      ridgeCables,
      0.075,
      6,
    ),
    makeInstancedTubes(
      "Sony Center twelve upper valley cables",
      valleyCables,
      0.062,
      6,
    ),
    makeInstancedNodes(
      "Sony Center forty-eight cable junction nodes",
      junctions,
      0.18,
    ),
    makeInstancedBoxes(
      "Sony Center twenty-four restrained ring soffit lights",
      soffitLights,
      new MeshBasicMaterial({ color: 0x81785f }),
      nightLightMaterial,
    ),
  );
  group.userData.membraneClampCount = panelClamps.length;
  group.userData.upperRidgeCableCount = ridgeCables.length;
  group.userData.upperValleyCableCount = valleyCables.length;
  group.userData.cableJunctionCount = junctions.length;
}

function makeReflectingPool(): Mesh {
  const geometry = new CylinderGeometry(8.2, 8.2, 0.08, 48);
  const dayMaterial = new MeshBasicMaterial({
    color: 0x72b7c5,
    depthWrite: false,
    opacity: 0.74,
    transparent: true,
  });
  const nightMaterial = new MeshStandardMaterial({
    color: 0x315c72,
    depthWrite: false,
    emissive: 0x6ba4b8,
    emissiveIntensity: 0.18,
    metalness: 0.15,
    opacity: 0.78,
    roughness: 0.28,
    transparent: true,
  });
  const pool = new Mesh(geometry, dayMaterial);
  pool.name = "Sony Center Forum reflecting pool";
  pool.position.set(
    PROFILE.openingCenterWorldM[0],
    PROFILE.groundY + 0.12,
    PROFILE.openingCenterWorldM[1],
  );
  pool.userData.dayMaterial = dayMaterial;
  pool.userData.nightMaterial = nightMaterial;
  pool.renderOrder = 1;
  return pool;
}

function addForumFountainDetails(group: Group): void {
  const rimPairs: Array<[Vector3, Vector3]> = [];
  const jetPairs: Array<[Vector3, Vector3]> = [];
  const centre = new Vector3(
    PROFILE.openingCenterWorldM[0],
    PROFILE.groundY + 0.23,
    PROFILE.openingCenterWorldM[1],
  );
  const segmentCount = 48;
  for (let index = 0; index < segmentCount; index += 1) {
    const angle = (index / segmentCount) * Math.PI * 2;
    const nextAngle = ((index + 1) / segmentCount) * Math.PI * 2;
    rimPairs.push([
      centre
        .clone()
        .add(new Vector3(Math.cos(angle) * 8.35, 0, Math.sin(angle) * 8.35)),
      centre
        .clone()
        .add(
          new Vector3(
            Math.cos(nextAngle) * 8.35,
            0,
            Math.sin(nextAngle) * 8.35,
          ),
        ),
    ]);
  }
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const start = centre
      .clone()
      .add(new Vector3(Math.cos(angle) * 3.9, 0.03, Math.sin(angle) * 3.9));
    jetPairs.push([
      start,
      start.clone().add(new Vector3(0, 0.78 + (index % 3) * 0.18, 0)),
    ]);
  }
  group.add(
    makeInstancedTubes(
      "Sony Center Forum forty-eight-piece fountain rim",
      rimPairs,
      0.13,
      7,
    ),
  );
  const jets = makeInstancedTubes(
    "Sony Center Forum twelve restrained fountain jets",
    jetPairs,
    0.035,
    5,
  );
  const jetDayMaterial = new MeshBasicMaterial({
    color: 0xa6e3ed,
    depthWrite: false,
    opacity: 0.7,
    transparent: true,
  });
  const jetNightMaterial = new MeshStandardMaterial({
    color: 0x62b8cc,
    depthWrite: false,
    emissive: 0x5cabbc,
    emissiveIntensity: 0.3,
    opacity: 0.72,
    roughness: 0.2,
    transparent: true,
  });
  jets.material = jetDayMaterial;
  jets.userData.dayMaterial = jetDayMaterial;
  jets.userData.nightMaterial = jetNightMaterial;
  group.add(jets);
  group.userData.forumFountainRimSegments = rimPairs.length;
  group.userData.forumFountainJetCount = jetPairs.length;
}

/**
 * OSM-plan and Arup-dimensioned reconstruction of the Sony Center Forum roof.
 * The fabric and glass occupy disjoint radial sectors, so transparent depth
 * sorting stays deterministic while the camera orbits.
 */
export function createSonyCenterForumRoof(): Group {
  const group = new Group();
  group.name = "Sony Center lightweight Forum roof";
  group.userData.profile = PROFILE;
  group.userData.presentationRole = "architectural-signature";
  group.userData.geometryStatus = PROFILE.geometryStatus;
  group.userData.sourceUrls = [...PROFILE.sources];
  group.userData.primaryArchitectureSource =
    "https://jahn.studio/work/sony-center/";
  group.userData.visualReferencePolicy =
    "Free Wikimedia references were inspected for QA only; no image or texture is bundled";

  const membraneDayMaterial = new MeshBasicMaterial({
    color: 0xf5f2e8,
    depthWrite: false,
    opacity: 0.82,
    side: DoubleSide,
    transparent: true,
  });
  const membraneNightMaterial = new MeshStandardMaterial({
    color: 0xc9d3d5,
    depthWrite: false,
    emissive: 0xd7c596,
    emissiveIntensity: 0.13,
    metalness: 0,
    opacity: 0.68,
    roughness: 0.82,
    side: DoubleSide,
    transparent: true,
  });
  const membrane = addModeMesh(
    group,
    "Sony Center membrane roof sectors",
    makeMembraneGeometry(),
    membraneDayMaterial,
    membraneNightMaterial,
  );
  membrane.renderOrder = 3;

  const glassDayMaterial = new MeshBasicMaterial({
    color: 0xaad9e5,
    depthWrite: false,
    opacity: 0.2,
    side: DoubleSide,
    transparent: true,
  });
  const glassNightMaterial = new MeshStandardMaterial({
    color: 0x5d8eaa,
    depthWrite: false,
    emissive: 0x406e82,
    emissiveIntensity: 0.1,
    metalness: 0,
    opacity: 0.16,
    roughness: 0.22,
    side: DoubleSide,
    transparent: true,
  });
  const glass = addModeMesh(
    group,
    "Sony Center glass roof sectors",
    makeGlassGeometry(),
    glassDayMaterial,
    glassNightMaterial,
  );
  glass.renderOrder = 2;

  const outerRingPairs: Array<[Vector3, Vector3]> = [];
  const ringDiagonalPairs: Array<[Vector3, Vector3]> = [];
  const innerRingPairs: Array<[Vector3, Vector3]> = [];
  const radialPairs: Array<[Vector3, Vector3]> = [];
  const lowerStayPairs: Array<[Vector3, Vector3]> = [];
  for (let index = 0; index < PROFILE.segmentCount; index += 1) {
    outerRingPairs.push([ringPoint(index), ringPoint(index + 1)]);
    const lowerCurrent = ringPoint(index, -1.15);
    const lowerNext = ringPoint(index + 1, -1.15);
    ringDiagonalPairs.push(
      [ringPoint(index), lowerNext],
      [lowerCurrent, ringPoint(index + 1)],
      [lowerCurrent, lowerNext],
    );
    innerRingPairs.push([openingPoint(index), openingPoint(index + 1)]);
    radialPairs.push([ringPoint(index, 0.13), openingPoint(index, 0.13)]);
    lowerStayPairs.push([ringPoint(index, -0.3), kingpostLowerTip()]);
  }
  group.add(
    makeInstancedTubes("Sony Center oval ring truss", outerRingPairs, 0.34, 8),
    makeInstancedTubes(
      "Sony Center oval ring lattice",
      ringDiagonalPairs,
      0.085,
      6,
    ),
    makeInstancedTubes(
      "Sony Center central opening ring",
      innerRingPairs,
      0.2,
      8,
    ),
    makeInstancedTubes("Sony Center radial roof cables", radialPairs, 0.07, 6),
    makeInstancedTubes(
      "Sony Center lower stay cables",
      lowerStayPairs,
      0.055,
      6,
    ),
  );

  const peak = kingpostPeak();
  const lowerTip = kingpostLowerTip();
  group.add(
    makeInstancedTubes(
      "Sony Center tilted kingpost",
      [[lowerTip, peak]],
      0.38,
      10,
    ),
  );

  const supports: Array<[Vector3, Vector3]> = [];
  for (let index = 0; index < PROFILE.supportCount; index += 1) {
    const ringIndex = Math.round(
      (index * PROFILE.segmentCount) / PROFILE.supportCount,
    );
    const top = ringPoint(ringIndex);
    supports.push([
      new Vector3(top.x, PROFILE.groundY + 35.5, top.z),
      top.clone().add(new Vector3(0, -0.25, 0)),
    ]);
  }
  group.add(
    makeInstancedTubes("Sony Center seven ring supports", supports, 0.23, 8),
    makeReflectingPool(),
  );
  addRoofGranularity(group);
  addForumFountainDetails(group);
  addForumFacades(group);
  return group;
}
