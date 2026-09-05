import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import {
  MINECRAFT_SONY_SURROUNDINGS_GROUP_NAME,
  SONY_SURROUNDINGS_GROUP_NAME,
  SONY_SURROUNDINGS_PROFILE,
  SONY_SURROUNDING_BUILDINGS,
  type SonyFacadeRun,
  type SonySurroundingBuilding,
} from "./sonyCenterSurroundingsProfile";

type FacadeBox = {
  position: [number, number, number];
  size: [number, number, number];
  rotationY: number;
  color: number;
};

const SILVER = 0xd0d9d9;
const GLASS = 0x66868e;
const GLASS_LIGHT = 0x92aeb3;
const REVEAL = 0x6a7479;
const UP = new Vector3(0, 1, 0);

function facadeBoxes(
  building: SonySurroundingBuilding,
  voxel: boolean,
): FacadeBox[] {
  const boxes: FacadeBox[] = [];
  for (const run of building.runs) {
    for (let segment = 0; segment < run.chain.length - 1; segment += 1) {
      const start = run.chain[segment];
      const end = run.chain[segment + 1];
      const dx = end[0] - start[0];
      const dz = end[1] - start[1];
      const length = Math.hypot(dx, dz);
      if (length < 1) continue;
      const rotationY = -Math.atan2(dz, dx);
      const add = (
        u: number,
        y: number,
        width: number,
        height: number,
        color: number,
        offset = 0.44,
        depth = 0.12,
      ) => {
        // In source winding the exterior is to the right of the chain.
        // Voxel bands are subdivided too: no continuous smooth facade double.
        const divisions = voxel ? Math.ceil(width / 5.5) : 1;
        const courses = voxel ? Math.ceil(height / 5.5) : 1;
        for (let part = 0; part < divisions; part += 1) {
          for (let course = 0; course < courses; course += 1) {
            const along = u - width / 2 + ((part + 0.5) * width) / divisions;
            boxes.push({
              position: [
                start[0] + (dx * along + dz * offset) / length,
                run.groundY +
                  y -
                  height / 2 +
                  ((course + 0.5) * height) / courses,
                start[1] + (dz * along - dx * offset) / length,
              ],
              size: [
                width / divisions,
                height / courses,
                voxel ? Math.max(depth, 0.35) : depth,
              ],
              rotationY,
              color,
            });
          }
        }
      };
      addSegment(building, run, length, voxel, add);
    }
  }
  return boxes;
}

type AddFacadeBox = (
  u: number,
  y: number,
  width: number,
  height: number,
  color: number,
  offset?: number,
  depth?: number,
) => void;

function addSegment(
  building: SonySurroundingBuilding,
  run: SonyFacadeRun,
  length: number,
  voxel: boolean,
  add: AddFacadeBox,
): void {
  const { style, firstFloorM: base, floorPitchM: pitch } = building;
  const top = run.heightM - 0.5;
  const glazed =
    style === "curtain-wall" ||
    style === "esplanade" ||
    style === "forum-apartments";
  const floorCount = Math.max(1, Math.floor((top - base) / pitch));
  const floors = voxel ? Math.ceil(floorCount / 2) : floorCount;
  const floorHeight = (top - base) / floors;
  const bayCount = Math.max(
    1,
    Math.floor(length / (voxel ? 5.5 : glazed ? 3.2 : 3.8)),
  );
  const bay = length / bayCount;
  const band = voxel ? 0.42 : 0.18;

  // Leave the historic Esplanade vitrines and the Forum's existing inner
  // facades to their current models; only these measured outer faces change.
  if (glazed && !voxel) {
    add(
      length / 2,
      (base + top) / 2,
      length,
      top - base,
      GLASS_LIGHT,
      0.32,
      0.08,
    );
  }
  for (let floor = 0; floor < floors; floor += 1) {
    const bottom = base + floor * floorHeight;
    const y = bottom + floorHeight / 2;
    if (glazed) {
      add(
        length / 2,
        bottom,
        length,
        style === "esplanade" ? 0.3 : band,
        SILVER,
        0.54,
      );
      if (!voxel && style === "curtain-wall") {
        add(length / 2, bottom + 0.34, length, 0.1, SILVER, 0.54);
      }
    }
    for (let column = 0; column < bayCount; column += 1) {
      const u = (column + 0.5) * bay;
      const windowHeight =
        floorHeight * (glazed || style === "parkside" ? 0.84 : 0.68);
      if (style === "filmhaus" && Math.abs(u - length * 0.43) < length * 0.13)
        continue;
      const paneTone = (column + floor * 3) % 5 === 0 ? GLASS_LIGHT : GLASS;
      if (style === "art-deco" || (style === "stone-office" && y > 36)) {
        for (const half of [-1, 1]) {
          add(u + half * bay * 0.19, y, bay * 0.29, windowHeight, paneTone);
        }
      } else {
        const width =
          bay *
          (glazed
            ? 0.89
            : style === "parkside"
              ? column % 3 === 0
                ? 0.84
                : 0.56
              : 0.64);
        if (style === "filmhaus" && !voxel) {
          add(u, y, width + 0.24, windowHeight + 0.22, SILVER, 0.34, 0.08);
        }
        add(u, y, width, windowHeight, paneTone);
      }
      if (style === "esplanade") {
        // Continuous French balcony rails with the photographed projecting
        // glazed bays. The bays stay thin and do not fill the source courtyard.
        add(u, bottom + 0.95, bay * 0.96, band, SILVER, 0.86);
        if (column % 4 === 1) {
          add(u, y, bay * 0.7, windowHeight, GLASS_LIGHT, 0.96, 0.12);
          add(u, bottom + 0.12, bay * 0.74, 0.22, SILVER, 0.7, 0.65);
        }
      } else if (style === "parkside" && column % 3 === 0) {
        add(
          u,
          bottom + 0.82,
          bay * 0.89,
          voxel ? 0.45 : 0.32,
          building.tone,
          0.68,
          0.22,
        );
      } else if (style === "marriott" && !voxel) {
        add(u - bay * 0.33, y, 0.16, windowHeight + 0.26, 0xe9e7df, 0.55, 0.16);
      }
      if (!voxel && glazed) {
        add(u - bay * 0.46, y, 0.1, floorHeight, SILVER, 0.56);
      }
    }
  }

  if (style === "filmhaus") {
    const atriumWidth = length * 0.24;
    const centre = length * 0.43;
    add(centre, top / 2, atriumWidth, top - 0.4, GLASS, 0.36, 0.08);
    for (let level = 1; level <= floors; level += 1) {
      add(
        centre,
        (level * top) / (floors + 1),
        atriumWidth,
        band,
        SILVER,
        0.56,
      );
    }
    for (let mullion = -2; mullion <= 2; mullion += 1) {
      add(
        centre + (mullion * atriumWidth) / 5,
        top / 2,
        voxel ? 0.4 : 0.16,
        top - 0.4,
        SILVER,
        0.57,
      );
    }
    add(length / 2, 2, length, 3.2, REVEAL, 0.24, 0.08);
  } else if (style === "art-deco" || style === "stone-office") {
    for (let column = 0; column <= bayCount; column += 1) {
      const u = Math.max(0.22, Math.min(length - 0.22, column * bay));
      add(
        u,
        (base + top) / 2,
        style === "art-deco" ? 0.3 : 0.2,
        top - base,
        0xf0eee7,
        0.55,
        0.24,
      );
    }
    for (const crown of [top - 1.6, top - 0.65, top]) {
      add(length / 2, crown, length, 0.3, 0xeeeae0, 0.64, 0.25);
    }
    add(length / 2, base - 0.5, length, 0.5, building.tone, 0.65, 0.32);
    if (
      building.id === "ritz-carlton" &&
      run.prismId === "e1PTH7PY" &&
      length > 35
    ) {
      const lobbyWidth = Math.min(12, length * 0.28);
      add(length / 2, 2.65, lobbyWidth, 4.9, GLASS_LIGHT, 0.7, 0.28);
      add(length / 2, 5.05, lobbyWidth + 1.2, 0.32, 0xd8d2c6, 1.08, 0.58);
      for (const side of [-1, 1]) {
        add(
          length / 2 + side * lobbyWidth * 0.49,
          2.75,
          voxel ? 0.5 : 0.28,
          5.3,
          0xeee9df,
          0.92,
          0.28,
        );
      }
      add(length / 2, 5.65, lobbyWidth * 0.72, 0.34, 0xb49b72, 0.98, 0.18);
    }
  } else {
    add(length / 2, top, length, 0.35, SILVER, 0.54, 0.22);
    if (style === "curtain-wall") {
      for (let slat = 0; slat < (voxel ? 2 : 4); slat += 1) {
        add(
          length / 2,
          top - 0.5 - slat * 0.28,
          length,
          voxel ? 0.25 : 0.1,
          SILVER,
          0.62,
        );
      }
    }
  }
}

function createBatch(
  boxes: readonly FacadeBox[],
  name: string,
  geometry: BoxGeometry,
  day: MeshBasicMaterial | MeshStandardMaterial,
  night: MeshStandardMaterial,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, day, boxes.length);
  mesh.name = name;
  mesh.userData.dayMaterial = day;
  mesh.userData.nightMaterial = night;
  mesh.userData.textureFree = true;
  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  const rotation = new Quaternion();
  const color = new Color();
  boxes.forEach((box, index) => {
    position.set(...box.position);
    scale.set(...box.size);
    rotation.setFromAxisAngle(UP, box.rotationY);
    mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
    mesh.setColorAt(index, color.setHex(box.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.matrixAutoUpdate = false;
  return mesh;
}

function createSurroundings(voxel: boolean): Group {
  const group = new Group();
  group.name = voxel
    ? MINECRAFT_SONY_SURROUNDINGS_GROUP_NAME
    : SONY_SURROUNDINGS_GROUP_NAME;
  group.userData = {
    ...SONY_SURROUNDINGS_PROFILE,
    blockNative: voxel,
    keepInMinecraft: voxel,
    buildingCount: SONY_SURROUNDING_BUILDINGS.length,
    collisionRole:
      "Existing LoD2 solids only; facade overlays do not close paths",
    detailFadeM: [1350, 1750],
  };
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const night = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0,
    flatShading: true,
  });
  // Instance colours multiply white. Enabling vertex colours on this uncoloured
  // unit cube would turn facades black on drivers without a default attribute.
  const day = voxel ? night : new MeshBasicMaterial({ color: 0xffffff });
  const voxelBoxes: FacadeBox[] = [];
  let instanceCount = 0;
  for (const building of SONY_SURROUNDING_BUILDINGS) {
    const boxes = facadeBoxes(building, voxel);
    instanceCount += boxes.length;
    if (voxel) voxelBoxes.push(...boxes);
    else {
      const mesh = createBatch(boxes, building.name, geometry, day, night);
      mesh.userData.lod2ParentId = building.parentId;
      mesh.userData.facadeStyle = building.style;
      group.add(mesh);
    }
  }
  if (voxel)
    group.add(
      createBatch(
        voxelBoxes,
        "Sony surroundings block-native facades",
        geometry,
        day,
        night,
      ),
    );
  group.userData.instanceCount = instanceCount;
  group.userData.instanceBufferBytes = instanceCount * (16 + 3) * 4;
  return group;
}

export function createSonyCenterSurroundings(): Group {
  return createSurroundings(false);
}

export function createMinecraftSonyCenterSurroundings(): Group {
  return createSurroundings(true);
}
