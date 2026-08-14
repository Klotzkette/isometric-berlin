import {
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";

import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  markArchitecturalInk,
} from "./architecturalInk";
import {
  type VoxelPayload,
  worldGroundSampler,
} from "./MinecraftVoxelWorld";

/**
 * OSM way 737280675 plus the landscape design documented by Berlin and
 * w+s Landschaftsarchitekten. The two circle-segment lawns rise toward the
 * Spree and leave the former Alsenstrasse axis open between Corten-steel walls.
 */
export const SPREEBOGEN_PARK_PROFILE = {
  name: "Spreebogenpark",
  osmWayId: "737280675",
  lawnRows: 28,
  southZ: -278,
  northZ: -414,
  centreX: 20,
  landscapeWindowWidthM: 17,
  maximumRiseM: 6.8,
  ludwigErhardUferWayIds: ["34834265", "1128036906"],
  sourceUrls: [
    "https://www.openstreetmap.org/way/737280675",
    "https://www.berlin.de/sen/uvk/_assets/natur-gruen/landschaftsplanung/20-gruene-hauptwege/weg-1/flyer_flanieren_entlang_der_stadtspree.pdf",
    "https://www.german-architects.com/de/architecture-news/building-of-the-week/gelassene-weite",
  ],
} as const;

type Vertex = [number, number, number];

function addTriangle(
  positions: number[],
  first: Vertex,
  second: Vertex,
  third: Vertex,
): void {
  positions.push(...first, ...second, ...third);
}

function addQuad(
  positions: number[],
  first: Vertex,
  second: Vertex,
  third: Vertex,
  fourth: Vertex,
): void {
  addTriangle(positions, first, second, third);
  addTriangle(positions, first, third, fourth);
}

function geometryFromPositions(positions: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function lawnPoint(
  side: -1 | 1,
  row: number,
  edge: "inner" | "outer",
  groundAt: (x: number, z: number) => number,
): Vertex {
  const t = row / SPREEBOGEN_PARK_PROFILE.lawnRows;
  const eased = Math.sin((t * Math.PI) / 2);
  const circularBow = Math.sin(t * Math.PI);
  const z =
    SPREEBOGEN_PARK_PROFILE.southZ +
    (SPREEBOGEN_PARK_PROFILE.northZ - SPREEBOGEN_PARK_PROFILE.southZ) * t;
  // The paired lawns are circle segments, not wedges. Their outer edges bow
  // away from the former Alsenstrasse and taper again at the Spree promenade.
  const halfGap = SPREEBOGEN_PARK_PROFILE.landscapeWindowWidthM / 2;
  const distance =
    edge === "inner"
      ? halfGap
      : halfGap + 48 + circularBow * 34 + eased * 6;
  const x = SPREEBOGEN_PARK_PROFILE.centreX + side * distance;
  const ground = groundAt(x, z);
  const rise = SPREEBOGEN_PARK_PROFILE.maximumRiseM * eased * eased;
  return [x, ground + 0.1 + rise, z];
}

function makeLawnGeometry(
  side: -1 | 1,
  groundAt: (x: number, z: number) => number,
): BufferGeometry {
  const positions: number[] = [];
  for (let row = 0; row < SPREEBOGEN_PARK_PROFILE.lawnRows; row += 1) {
    const inner0 = lawnPoint(side, row, "inner", groundAt);
    const outer0 = lawnPoint(side, row, "outer", groundAt);
    const inner1 = lawnPoint(side, row + 1, "inner", groundAt);
    const outer1 = lawnPoint(side, row + 1, "outer", groundAt);
    if (side < 0) {
      addQuad(positions, outer0, inner0, inner1, outer1);
    } else {
      addQuad(positions, inner0, outer0, outer1, inner1);
    }
  }
  return geometryFromPositions(positions);
}

function makeCortenWallGeometry(
  side: -1 | 1,
  groundAt: (x: number, z: number) => number,
): BufferGeometry {
  const positions: number[] = [];
  for (let row = 0; row < SPREEBOGEN_PARK_PROFILE.lawnRows; row += 1) {
    const top0 = lawnPoint(side, row, "inner", groundAt);
    const top1 = lawnPoint(side, row + 1, "inner", groundAt);
    const bottom0: Vertex = [top0[0], groundAt(top0[0], top0[2]) + 0.08, top0[2]];
    const bottom1: Vertex = [top1[0], groundAt(top1[0], top1[2]) + 0.08, top1[2]];
    if (side < 0) {
      addQuad(positions, bottom0, top0, top1, bottom1);
    } else {
      addQuad(positions, top0, bottom0, bottom1, top1);
    }
  }
  return geometryFromPositions(positions);
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
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/** Build the missing terrain sculpture without replacing the OSM lawn plate. */
export function createSpreebogenPark(ground: VoxelPayload): Group {
  const group = new Group();
  group.name = "Spreebogenpark landscape window";
  group.userData.keepInMinecraft = true;
  group.userData.profile = SPREEBOGEN_PARK_PROFILE;
  group.userData.geometryStatus =
    "OSM-bounded, source-described rising lawn segments; terrain heights from the committed Berlin ground grid";
  const sample = worldGroundSampler(ground);
  const groundAt = (x: number, z: number): number => sample(x, z) ?? 4.8;

  const lawnDay = new MeshBasicMaterial({
    color: 0x91c67a,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: DoubleSide,
  });
  const lawnNight = new MeshStandardMaterial({
    color: 0x213822,
    flatShading: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    roughness: 0.96,
    side: DoubleSide,
  });
  const cortenDay = new MeshBasicMaterial({ color: 0x4b332d, side: DoubleSide });
  const cortenNight = new MeshStandardMaterial({
    color: 0x201918,
    flatShading: true,
    roughness: 0.92,
    side: DoubleSide,
  });

  for (const side of [-1, 1] as const) {
    const lawn = makeLawnGeometry(side, groundAt);
    addModeMesh(
      group,
      `Spreebogenpark ${side < 0 ? "west" : "east"} rising lawn`,
      lawn,
      lawnDay,
      lawnNight,
    );
    const wall = makeCortenWallGeometry(side, groundAt);
    addModeMesh(
      group,
      `Spreebogenpark ${side < 0 ? "west" : "east"} Corten wall`,
      wall,
      cortenDay,
      cortenNight,
    );
    const edges = new LineSegments(
      new EdgesGeometry(wall, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
      markArchitecturalInk(new LineBasicMaterial(), "silhouette"),
    );
    edges.name = `Spreebogenpark ${side < 0 ? "west" : "east"} wall ink`;
    edges.renderOrder = 2;
    group.add(edges);
  }

  // A restrained centre line makes the surviving Alsenstrasse axis legible
  // without inventing street furniture or duplicating the mapped paths.
  const axisGeometry = new BufferGeometry().setFromPoints([
    new Vector3(
      SPREEBOGEN_PARK_PROFILE.centreX,
      groundAt(SPREEBOGEN_PARK_PROFILE.centreX, SPREEBOGEN_PARK_PROFILE.southZ) +
        0.16,
      SPREEBOGEN_PARK_PROFILE.southZ,
    ),
    new Vector3(
      SPREEBOGEN_PARK_PROFILE.centreX,
      groundAt(SPREEBOGEN_PARK_PROFILE.centreX, SPREEBOGEN_PARK_PROFILE.northZ) +
        0.16,
      SPREEBOGEN_PARK_PROFILE.northZ,
    ),
  ]);
  const axis = new LineSegments(
    axisGeometry,
    markArchitecturalInk(new LineBasicMaterial({ color: 0x4d4b42 }), "detail"),
  );
  axis.name = "Spreebogenpark former Alsenstrasse axis";
  group.add(axis);
  return group;
}
