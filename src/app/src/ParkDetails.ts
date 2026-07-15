import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  ShapeUtils,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";

export type ParkPath = {
  id: string;
  kind: string;
  name: string | null;
  points: [number, number, number][];
};

export type ParkTree = {
  crown_radius_m: number;
  height_m: number;
  id: string;
  leaf_type: string | null;
  position: [number, number, number];
  variant: number;
};

export type PlaygroundEquipment = {
  id: string;
  kind: string;
  material: string | null;
  points: [number, number, number][];
  position: [number, number, number];
};

export type ParkPlayground = {
  equipment: PlaygroundEquipment[];
  id: string;
  name: string;
  outline: [number, number, number][];
  source_url: string;
  surface: string | null;
  wheelchair: string | null;
};

export type ParkDetailsPayload = {
  paths: ParkPath[];
  playgrounds: ParkPlayground[];
  schema_version: number;
  source: {
    attribution: string;
    geometry_status: string;
    name: string;
  };
  trees: ParkTree[];
};

type Transform = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

type TreeCrownCutaway = {
  focusName: string;
  radiusM: number;
  x: number;
  z: number;
};

const UP = new Vector3(0, 1, 0);
const PATH_STYLE: Record<string, { color: number; width: number }> = {
  bridleway: { color: 0x79684b, width: 1.7 },
  cycleway: { color: 0x77736c, width: 1.8 },
  footway: { color: 0x89785b, width: 1.45 },
  path: { color: 0x77684e, width: 1.35 },
  pedestrian: { color: 0x898174, width: 2.2 },
  steps: { color: 0x71706b, width: 1.65 },
  track: { color: 0x6f6046, width: 2.25 },
};

function material(color: number, roughness = 0.82): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    roughness,
  });
}

function instanced(
  name: string,
  geometry: BufferGeometry,
  surface: MeshStandardMaterial,
  transforms: Transform[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, surface, transforms.length);
  mesh.name = name;
  const dummy = new Object3D();
  transforms.forEach((transform, index) => {
    dummy.position.set(...transform.position);
    dummy.rotation.set(...(transform.rotation ?? [0, 0, 0]));
    dummy.scale.set(...(transform.scale ?? [1, 1, 1]));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;
  return mesh;
}

function pathCategory(kind: string): string {
  return kind in PATH_STYLE ? kind : "path";
}

function createPathGeometry(paths: ParkPath[], width: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const path of paths) {
    for (let index = 1; index < path.points.length; index += 1) {
      const start = path.points[index - 1];
      const end = path.points[index];
      const dx = end[0] - start[0];
      const dz = end[2] - start[2];
      const length = Math.hypot(dx, dz);
      if (length < 0.05) {
        continue;
      }
      const nx = (-dz / length) * (width / 2);
      const nz = (dx / length) * (width / 2);
      const offset = positions.length / 3;
      positions.push(
        start[0] + nx,
        start[1] + 0.09,
        start[2] + nz,
        start[0] - nx,
        start[1] + 0.09,
        start[2] - nz,
        end[0] - nx,
        end[1] + 0.09,
        end[2] - nz,
        end[0] + nx,
        end[1] + 0.09,
        end[2] + nz,
      );
      indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function addPaths(group: Group, paths: ParkPath[]): void {
  const byKind = new Map<string, ParkPath[]>();
  for (const path of paths) {
    const kind = pathCategory(path.kind);
    byKind.set(kind, [...(byKind.get(kind) ?? []), path]);
  }
  for (const [kind, entries] of byKind) {
    const style = PATH_STYLE[kind];
    const pathMaterial = material(style.color, 0.96);
    pathMaterial.side = DoubleSide;
    const mesh = new Mesh(
      createPathGeometry(entries, style.width),
      pathMaterial,
    );
    mesh.name = `Tiergarten ${kind} batched path ribbons`;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

function addTrees(
  group: Group,
  trees: ParkTree[],
  cutaway: TreeCrownCutaway | null,
): void {
  const trunks: Transform[] = [];
  const branches: Transform[] = [];
  const crowns: Transform[][] = [[], [], []];
  const cutawayCrowns: Transform[][] = [[], [], []];
  for (const tree of trees) {
    const [x, y, z] = tree.position;
    const trunkHeight = tree.height_m * 0.5;
    const trunkRadius = Math.max(0.18, tree.crown_radius_m * 0.095);
    trunks.push({
      position: [x, y + trunkHeight / 2, z],
      scale: [trunkRadius, trunkHeight, trunkRadius],
    });
    const branchLength = trunkHeight * 0.44;
    const branchRadius = Math.max(0.1, trunkRadius * 0.58);
    const branchYaw = ((tree.variant % 7) / 7) * Math.PI * 2;
    for (const direction of [-1, 1]) {
      branches.push({
        position: [
          x + Math.cos(branchYaw) * direction * branchLength * 0.12,
          y + trunkHeight * 0.8,
          z + Math.sin(branchYaw) * direction * branchLength * 0.12,
        ],
        rotation: [0, branchYaw, direction * 0.72],
        scale: [branchRadius, branchLength, branchRadius],
      });
    }
    const variant = Math.abs(tree.variant) % 3;
    const offsets = [
      [-0.3, -0.04, 0.13],
      [0.29, 0.12, -0.17],
      [-0.12, 0.34, -0.25],
      [0.16, 0.52, 0.22],
      [0.01, 0.72, 0.01],
    ];
    const isInsideCutaway = cutaway
      ? Math.hypot(x - cutaway.x, z - cutaway.z) <= cutaway.radiusM
      : false;
    for (let layer = 0; layer < offsets.length; layer += 1) {
      const [offsetX, offsetY, offsetZ] = offsets[(layer + variant) % offsets.length];
      const radius =
        tree.crown_radius_m *
        (layer === offsets.length - 1 ? 0.56 : layer >= 2 ? 0.72 : 0.84);
      const target = isInsideCutaway ? cutawayCrowns : crowns;
      target[variant].push({
        position: [
          x + offsetX * tree.crown_radius_m,
          y + trunkHeight + radius * (0.4 + offsetY),
          z + offsetZ * tree.crown_radius_m,
        ],
        rotation: [0, ((tree.variant + layer) * Math.PI) / 7, 0],
        scale: [radius, radius * (0.7 + layer * 0.045), radius],
      });
    }
  }
  group.add(
    instanced(
      "OSM instanced granular tree trunks",
      new CylinderGeometry(1, 1.18, 1, 7),
      material(0x68533c),
      trunks,
    ),
  );
  group.add(
    instanced(
      "OSM instanced granular tree fork branches",
      new CylinderGeometry(1, 1.18, 1, 6),
      material(0x70583e),
      branches,
    ),
  );
  const colors = [0x355b3b, 0x426642, 0x315238];
  crowns.forEach((transforms, index) => {
    if (transforms.length > 0) {
      group.add(
        instanced(
          `OSM instanced three-lobed tree crowns variant ${index + 1}`,
          new IcosahedronGeometry(1, 1),
          material(colors[index], 0.9),
          transforms,
        ),
      );
    }
  });
  cutawayCrowns.forEach((transforms, index) => {
    if (transforms.length > 0 && cutaway) {
      const mesh = instanced(
        `OSM instanced three-lobed tree crowns variant ${index + 1}`,
        new IcosahedronGeometry(1, 1),
        material(colors[index], 0.9),
        transforms,
      );
      mesh.name += " focus cutaway";
      mesh.userData.focusCutawayFor = cutaway.focusName;
      group.add(mesh);
    }
  });
}

function addHiddenEasterEggs(group: Group, trees: ParkTree[]): number {
  const eggCount = Math.min(3, trees.length);
  if (eggCount === 0) {
    return 0;
  }
  const transforms: Transform[] = [];
  for (let index = 0; index < eggCount; index += 1) {
    const treeIndex = Math.min(
      trees.length - 1,
      Math.floor(((index + 0.5) / eggCount) * trees.length),
    );
    const tree = trees[treeIndex];
    const angle = ((tree.variant + index * 5) / 12) * Math.PI * 2;
    transforms.push({
      position: [
        tree.position[0] + Math.cos(angle) * 0.42,
        tree.position[1] + 0.034,
        tree.position[2] + Math.sin(angle) * 0.42,
      ],
      rotation: [0, angle, 0.08 * Math.sin(angle)],
      scale: [1, 1.46, 1],
    });
  }
  const eggs = instanced(
    "Tiergarten three hidden real-scale Easter eggs",
    new SphereGeometry(0.023, 12, 8),
    material(0xd64d5d, 0.42),
    transforms,
  );
  const colors = [0xe84d5b, 0xf2c84b, 0x55b8d2];
  transforms.forEach((_, index) => {
    eggs.setColorAt(index, new Color(colors[index % colors.length]));
  });
  if (eggs.instanceColor) {
    eggs.instanceColor.needsUpdate = true;
  }
  eggs.userData.eggHeightM = 0.067;
  eggs.userData.geometryStatus = "Owner-requested true-scale decorative detail";
  group.add(eggs);
  return eggCount;
}

function treeCrownCutaway(playgrounds: ParkPlayground[]): TreeCrownCutaway | null {
  const focusName = "Spielplatz an der Luiseninsel";
  const playground = playgrounds.find((entry) => entry.name === focusName);
  if (!playground) {
    return null;
  }
  const points = playground.equipment.length > 0
    ? playground.equipment.map((item) => item.position)
    : playground.outline;
  if (points.length === 0) {
    return null;
  }
  return {
    focusName,
    radiusM: 46,
    x: points.reduce((sum, point) => sum + point[0], 0) / points.length,
    z: points.reduce((sum, point) => sum + point[2], 0) / points.length,
  };
}

function addBox(
  group: Group,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  surface: MeshStandardMaterial,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), surface);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addCylinderBetween(
  group: Group,
  name: string,
  start: Vector3,
  end: Vector3,
  radius: number,
  surface: MeshStandardMaterial,
): Mesh {
  const direction = end.clone().sub(start);
  const mesh = new Mesh(
    new CylinderGeometry(radius, radius, direction.length(), 8),
    surface,
  );
  mesh.name = name;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

function footprintGeometry(outline: [number, number, number][]): BufferGeometry {
  const unique = outline.filter(
    (point, index) =>
      index === 0 || point[0] !== outline[index - 1][0] || point[2] !== outline[index - 1][2],
  );
  if (
    unique.length > 2 &&
    unique[0][0] === unique.at(-1)?.[0] &&
    unique[0][2] === unique.at(-1)?.[2]
  ) {
    unique.pop();
  }
  const contour = unique.map((point) => new Vector2(point[0], point[2]));
  const faces = ShapeUtils.triangulateShape(contour, []);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      unique.flatMap((point) => [point[0], point[1] + 0.11, point[2]]),
      3,
    ),
  );
  geometry.setIndex(faces.flatMap((face) => face));
  geometry.computeVertexNormals();
  return geometry;
}

function addClimbingFrame(group: Group, item: PlaygroundEquipment): void {
  const [x, y, z] = item.position;
  const steel = material(0x2e6f72, 0.52);
  const rope = new LineBasicMaterial({ color: 0xd7c394 });
  const posts = [
    new Vector3(x - 1.6, y, z - 1.25),
    new Vector3(x + 1.6, y, z - 1.25),
    new Vector3(x - 1.6, y, z + 1.25),
    new Vector3(x + 1.6, y, z + 1.25),
  ];
  posts.forEach((base, index) => {
    addCylinderBetween(
      group,
      `${item.kind} ${item.id} upright ${index + 1}`,
      base,
      base.clone().add(new Vector3(0, 3.4, 0)),
      0.11,
      steel,
    );
  });
  addCylinderBetween(
    group,
    `${item.kind} ${item.id} ridge`,
    posts[0].clone().add(new Vector3(0, 3.4, 0)),
    posts[3].clone().add(new Vector3(0, 3.4, 0)),
    0.1,
    steel,
  );
  const positions: number[] = [];
  for (let index = 0; index <= 4; index += 1) {
    const fraction = index / 4;
    positions.push(
      x - 1.6 + fraction * 3.2,
      y + 0.25,
      z,
      x - 1.6 + fraction * 3.2,
      y + 3.25,
      z,
      x - 1.6,
      y + 0.25 + fraction * 3,
      z,
      x + 1.6,
      y + 0.25 + fraction * 3,
      z,
    );
  }
  const netGeometry = new BufferGeometry();
  netGeometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const net = new LineSegments(netGeometry, rope);
  net.name = `${item.kind} ${item.id} climbing net`;
  group.add(net);
}

function addSlide(group: Group, item: PlaygroundEquipment): void {
  const [x, y, z] = item.position;
  const direction = item.points.length >= 2
    ? new Vector3(
        item.points.at(-1)![0] - item.points[0][0],
        0,
        item.points.at(-1)![2] - item.points[0][2],
      ).normalize()
    : new Vector3(0, 0, 1);
  const chute = addBox(
    group,
    `slide ${item.id} chute`,
    [1.15, 0.18, 4.5],
    [x, y + 1.3, z],
    material(0xc84937, 0.42),
  );
  chute.rotation.y = Math.atan2(direction.x, direction.z);
  chute.rotation.x = -0.38;
  addBox(
    group,
    `slide ${item.id} platform`,
    [1.8, 0.2, 1.8],
    [x - direction.x * 1.8, y + 2.2, z - direction.z * 1.8],
    material(0x856641),
  );
}

function addSwing(group: Group, item: PlaygroundEquipment): void {
  const [x, y, z] = item.position;
  const frame = material(0x345f66, 0.5);
  const seat = material(item.kind === "basketswing" ? 0xc7573f : 0xd8b447);
  for (const zOffset of [-1.25, 1.25]) {
    addCylinderBetween(
      group,
      `${item.kind} ${item.id} frame left`,
      new Vector3(x - 1.5, y, z + zOffset),
      new Vector3(x, y + 3.1, z + zOffset),
      0.1,
      frame,
    );
    addCylinderBetween(
      group,
      `${item.kind} ${item.id} frame right`,
      new Vector3(x + 1.5, y, z + zOffset),
      new Vector3(x, y + 3.1, z + zOffset),
      0.1,
      frame,
    );
  }
  addCylinderBetween(
    group,
    `${item.kind} ${item.id} top bar`,
    new Vector3(x, y + 3.1, z - 1.25),
    new Vector3(x, y + 3.1, z + 1.25),
    0.12,
    frame,
  );
  for (const offset of [-0.38, 0.38]) {
    addCylinderBetween(
      group,
      `${item.kind} ${item.id} suspension`,
      new Vector3(x, y + 3, z + offset),
      new Vector3(x, y + 1.1, z + offset),
      0.025,
      frame,
    );
  }
  addBox(
    group,
    `${item.kind} ${item.id} seat`,
    item.kind === "basketswing" ? [1.05, 0.22, 0.82] : [0.9, 0.12, 0.36],
    [x, y + 1.03, z],
    seat,
  );
}

function addPlaygroundEquipment(group: Group, item: PlaygroundEquipment): void {
  const [x, y, z] = item.position;
  if (item.kind === "climbingframe") {
    addClimbingFrame(group, item);
  } else if (item.kind === "slide") {
    addSlide(group, item);
  } else if (item.kind === "swing" || item.kind === "basketswing") {
    addSwing(group, item);
  } else if (item.kind === "sandpit") {
    addBox(
      group,
      `sandpit ${item.id}`,
      [5.2, 0.18, 3.8],
      [x, y + 0.1, z],
      material(0xd8bd79, 1),
    );
  } else if (item.kind === "water") {
    addCylinderBetween(
      group,
      `water play pump ${item.id}`,
      new Vector3(x, y, z),
      new Vector3(x, y + 1.25, z),
      0.18,
      material(0x477d91, 0.38),
    );
    addBox(
      group,
      `water play basin ${item.id}`,
      [2.2, 0.16, 1.25],
      [x + 0.8, y + 0.42, z],
      material(0x729ba4, 0.45),
    );
  } else if (item.kind === "excavator") {
    const metal = material(0xd5a434, 0.45);
    addCylinderBetween(
      group,
      `sand excavator ${item.id} pivot`,
      new Vector3(x, y, z),
      new Vector3(x, y + 1.05, z),
      0.14,
      metal,
    );
    addCylinderBetween(
      group,
      `sand excavator ${item.id} arm`,
      new Vector3(x, y + 0.9, z),
      new Vector3(x + 1.3, y + 1.25, z),
      0.1,
      metal,
    );
  } else if (item.kind === "structure") {
    const wood = material(0x8a643e);
    addBox(
      group,
      `play structure ${item.id} platform`,
      [2.4, 0.24, 2.4],
      [x, y + 1.65, z],
      wood,
    );
    for (const dx of [-0.9, 0.9]) {
      for (const dz of [-0.9, 0.9]) {
        addCylinderBetween(
          group,
          `play structure ${item.id} post`,
          new Vector3(x + dx, y, z + dz),
          new Vector3(x + dx, y + 2.9, z + dz),
          0.1,
          wood,
        );
      }
    }
  }
}

function addPlaygrounds(group: Group, playgrounds: ParkPlayground[]): void {
  for (const playground of playgrounds) {
    const playgroundGroup = new Group();
    playgroundGroup.name = `${playground.name} OSM playground details`;
    playgroundGroup.userData.focusRevealFor = playground.name;
    group.add(playgroundGroup);
    if (playground.outline.length >= 4) {
      const surface = material(
        playground.surface === "sand" ? 0xb99b5f : 0x6f865e,
        1,
      );
      surface.side = DoubleSide;
      const footprint = new Mesh(
        footprintGeometry(playground.outline),
        surface,
      );
      footprint.name = `${playground.name} OSM footprint`;
      footprint.receiveShadow = true;
      footprint.userData.sourceUrl = playground.source_url;
      playgroundGroup.add(footprint);
    }
    for (const item of playground.equipment) {
      addPlaygroundEquipment(playgroundGroup, item);
    }
  }
}

export function createParkDetails(payload: ParkDetailsPayload): Group {
  if (payload.schema_version !== 1) {
    throw new Error(`Unsupported park-detail schema ${payload.schema_version}`);
  }
  const group = new Group();
  group.name = "OSM Tiergarten paths, trees and playground details";
  group.userData = {
    attribution: payload.source.attribution,
    geometryStatus: payload.source.geometry_status,
    pathCount: payload.paths.length,
    playgroundCount: payload.playgrounds.length,
    treeCount: payload.trees.length,
  };
  addPaths(group, payload.paths);
  addTrees(group, payload.trees, treeCrownCutaway(payload.playgrounds));
  group.userData.eggCount = addHiddenEasterEggs(group, payload.trees);
  addPlaygrounds(group, payload.playgrounds);
  return group;
}

export function setParkDetailsFocus(group: Group, name: string): void {
  group.traverse((object) => {
    const focusCutawayFor = object.userData.focusCutawayFor;
    if (typeof focusCutawayFor === "string") {
      object.visible = focusCutawayFor !== name;
    }
  });
  for (const child of group.children) {
    const focusRevealFor = child.userData.focusRevealFor;
    if (typeof focusRevealFor !== "string") {
      continue;
    }
    const focused = focusRevealFor === name;
    child.traverse((object) => {
      if (!(object instanceof Mesh || object instanceof LineSegments)) {
        return;
      }
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const isFootprint = object.name.endsWith("OSM footprint");
      for (const surface of materials) {
        surface.depthTest = isFootprint || !focused;
        surface.depthWrite = isFootprint || !focused;
        surface.needsUpdate = true;
      }
      object.renderOrder = focused
        ? isFootprint
          ? 0
          : object instanceof LineSegments
            ? 32
            : 31
        : 0;
    });
  }
}

export function parkDetailFocusDistance(name: string): number | null {
  if (name === "Spielplatz an der Luiseninsel") {
    return 64;
  }
  if (name === "Großer Tiergarten") {
    return 310;
  }
  return null;
}
