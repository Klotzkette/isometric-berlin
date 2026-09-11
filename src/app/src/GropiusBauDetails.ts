import { staticModelDetailProfile } from "./staticModelDetail";
import {
  BoxGeometry, Color, EdgesGeometry, Group, InstancedBufferAttribute,
  InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial,
  Quaternion, Vector3,
} from "three";
import {
  addBox, createBuilder, finishDrawnGroup, paintGeometry,
} from "./drawnKit";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import {
  GROPIUS_BAU_DETAILS_GROUP_NAME, GROPIUS_BAU_FACADES,
  GROPIUS_BAU_PROFILE, GROPIUS_BAU_SOURCE_RING_DM,
  MINECRAFT_GROPIUS_BAU_GROUP_NAME,
  type GropiusBauDetailProfile, type GropiusBauFacade,
} from "./gropiusBauProfile";

type Point = [number, number, number];
type Part = {
  position: Point;
  size: Point;
  color: number;
  yaw: number;
  roll: number;
  ink: boolean;
  cue: string;
};
type Plan = { parts: Part[]; counts: Record<string, number> };

const C = {
  brick: 0xb97962,
  darkBrick: 0x995b48,
  granite: 0x797b73,
  graniteJoint: 0x5a615c,
  sandstone: 0xc9bc98,
  stoneLight: 0xdacfaf,
  stoneShadow: 0x978c72,
  terracotta: 0xae7658,
  cornice: 0x85543f,
  glass: 0x3a535b,
  glassLight: 0x668080,
  frame: 0x665a47,
  gold: 0xc5a35e,
  mosaicGround: 0x7f7959,
  mosaicBlue: 0x557c87,
  mosaicGreen: 0x687960,
} as const;

export const GROPIUS_BAU_DETAIL_BUDGETS = {
  full: { drawnParts: 2700, drawnBytes: 1_500_000, minecraftBlocks: 1400 },
  mobile: { drawnParts: 2700, drawnBytes: 1_500_000, minecraftBlocks: 1350 },
  drawnRenderables: 2,
  minecraftRenderables: 1,
} as const;

function facadeLength(f: GropiusBauFacade): number {
  return Math.hypot(f.end[0] - f.start[0], f.end[1] - f.start[1]);
}

/** Outward is the right side of the clockwise source outline in world x/z. */
export function gropiusBauFacadePoint(
  f: GropiusBauFacade,
  u: number,
  localY: number,
  outward = 0,
): Point {
  const dx = f.end[0] - f.start[0];
  const dz = f.end[1] - f.start[1];
  const length = Math.hypot(dx, dz);
  return [
    f.start[0] + (dx * u + dz * outward) / length,
    GROPIUS_BAU_PROFILE.groundYM + localY,
    f.start[1] + (dz * u - dx * outward) / length,
  ];
}

function makePlan(profile: GropiusBauDetailProfile, minecraft: boolean): Plan {
  const plan: Plan = { parts: [], counts: {} };
  const fine = profile === "full" && !minecraft;
  // Source 4 m columns conservatively rasterise past a wall by up to 2.12 m.
  // Keep the block detail in front of those cells rather than buried in them.
  const standOff = minecraft ? 3.1 : 0.2;
  const heightScale = minecraft ? 32 / 29.3 : 1;
  const add = (
    f: GropiusBauFacade, u: number, y: number, width: number, height: number,
    depth: number, color: number, cue: string, offset = 0, ink = false,
    roll = 0,
  ): void => {
    const yaw = -Math.atan2(f.end[1] - f.start[1], f.end[0] - f.start[0]);
    plan.parts.push({
      position: gropiusBauFacadePoint(f, u, y * heightScale, standOff + offset),
      size: [width, height * heightScale, depth], color, yaw, roll, ink, cue,
    });
    plan.counts[cue] = (plan.counts[cue] ?? 0) + 1;
  };
  const strip = (
    f: GropiusBauFacade, y: number, h: number, depth: number, color: number,
    cue: string, offset = 0, ink = false,
  ): void => add(f, facadeLength(f) / 2, y, facadeLength(f), h, depth,
    color, cue, offset, ink);

  // Masonry and cornice courses follow the delivered outline, including the
  // projecting south stair block. No rectangular envelope spans the courts.
  const ring = GROPIUS_BAU_SOURCE_RING_DM;
  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    const f: GropiusBauFacade = {
      id: "north", start: [start[0] / 10, start[1] / 10],
      end: [end[0] / 10, end[1] / 10], bays: 1,
    };
    if (facadeLength(f) < 2) continue;
    strip(f, 1.65, 3.3, minecraft ? 0.8 : 0.24, C.granite, "Belgian granite base");
    const courses = minecraft ? 10 : profile === "full" ? 20 : 14;
    for (let row = 0; row < courses; row += 1) {
      strip(f, 3.75 + row * 19.4 / courses, minecraft ? 0.35 : 0.2,
        minecraft ? 0.65 : 0.12, C.darkBrick, "alternating clinker bands", 0.03);
    }
    for (const [y, h, color] of [
      [3.35, 0.34, C.stoneShadow], [11.6, 0.65, C.sandstone],
      [12.3, 0.4, C.stoneShadow], [23.0, 0.55, C.sandstone],
      [23.55, 0.35, C.stoneShadow], [27.65, 0.4, C.sandstone],
      [28.3, 0.48, C.cornice], [28.82, 0.76, C.terracotta],
    ] as const) {
      strip(f, y, h, minecraft ? 1 : 0.52, color,
        y > 27 ? "projecting terracotta cornice" : "three-zone facade registers",
        y > 27 ? 0.28 : 0.12, !minecraft && y > 27);
    }
  }

  for (const f of GROPIUS_BAU_FACADES) {
    const length = facadeLength(f);
    const pitch = length / f.bays;
    const sourceProjectionAt = (u: number): number =>
      f.id === "south" && Math.abs(u - length / 2) < 7.1 ? 4.8 :
        f.id === "north" && Math.abs(u - length / 2) < 5.5 ? 0.8 : 0;
    for (let bay = 0; bay < f.bays; bay += 1) {
      const besideVoxelStair = minecraft && f.id === "south" && (bay === 2 || bay === 4);
      // The 4 m raster makes the south stair return wider than its source
      // outline. Compact the two neighbouring block-native window triplets
      // onto the remaining visible wall; do not project three whole bays out.
      const u = (bay + 0.5) * pitch + (besideVoxelStair ? (bay < 3 ? -3.1 : 3.1) : 0);
      const central = f.bays === 7 && bay === 3;
      // Source north teeth project 0.8 m; the south stair block projects 4.8 m.
      const projection = sourceProjectionAt(u);
      const windowWidth = pitch * (besideVoxelStair ? 0.47 : minecraft ? 0.66 : 0.61);
      const panelPitch = windowWidth / 3;
      add(f, u, 1.65, windowWidth * 0.76, 1.5, minecraft ? 0.75 : 0.15,
        C.glass, "basement windows", projection + 0.18);
      for (const [level, y, height] of [[0, 7.25, 6.45], [1, 17.05, 7.1]] as const) {
        // Continuous dark reveal behind three separately legible glass lights.
        add(f, u, y, windowWidth + 0.5, height + 0.32,
          minecraft ? 0.8 : 0.18, C.stoneShadow, "main window recesses",
          projection + 0.22);
        for (let light = -1; light <= 1; light += 1) {
          add(f, u + light * panelPitch, y, panelPitch - (minecraft ? 0.4 : 0.24),
            height, minecraft ? 0.75 : 0.14,
            light === 0 ? C.glassLight : C.glass,
            "three-part main windows", projection + 0.37);
        }
        for (const member of [-1.5, -0.5, 0.5, 1.5]) {
          add(f, u + member * panelPitch, y, minecraft ? 0.5 : 0.23,
            height + 0.35, minecraft ? 0.9 : 0.36, C.sandstone,
            "window columns and jambs", projection + 0.52, !minecraft);
          if (fine) {
            add(f, u + member * panelPitch, y + height / 2 - 0.05,
              0.48, 0.35, 0.48, C.stoneLight, "column capitals",
              projection + 0.6);
            add(f, u + member * panelPitch, y - height / 2 + 0.08,
              0.4, 0.25, 0.45, C.stoneLight, "column bases",
              projection + 0.6);
          }
        }
        add(f, u, y - height / 2 - 0.2, windowWidth + 0.88,
          0.38, minecraft ? 1.1 : 0.6, C.stoneLight, "window sills",
          projection + 0.58, !minecraft);
        add(f, u, y + height / 2 + 0.25, windowWidth + 0.95,
          0.42, minecraft ? 1 : 0.6, C.sandstone, "window entablatures",
          projection + 0.6, !minecraft);
        if (!minecraft) {
          add(f, u, y - height * 0.21, windowWidth, 0.14, 0.2,
            C.frame, "window transoms", projection + 0.52);
        }
        if (level === 1) {
          const span = windowWidth + 1.15;
          const rise = central && f.id === "north" ? 1.75 : 1.05;
          const bottom = y + height / 2 + 0.55;
          if (minecraft) {
            for (let step = 0; step < 3; step += 1) {
              add(f, u, bottom + step * 0.34, span * (1 - step * 0.32),
                0.34, 0.9, C.sandstone, "stepped triangular pediments",
                projection + 0.6);
            }
          } else {
            const beamLength = Math.hypot(span / 2, rise);
            for (const side of [-1, 1]) {
              add(f, u + side * span / 4, bottom + rise / 2,
                beamLength, 0.22, 0.62, C.sandstone,
                "flat triangular pediments", projection + 0.68, true,
                -side * Math.atan2(rise, span / 2));
            }
            add(f, u, bottom, span, 0.23, 0.66, C.stoneLight,
              "pediment lower mouldings", projection + 0.68, true);
          }
        }
      }
      for (let light = -1; light <= 1; light += 1) {
        add(f, u + light * panelPitch * 0.83, 25.48,
          panelPitch * 0.67, 2.95, minecraft ? 0.8 : 0.14,
          C.glass, "mezzanine triplets", projection + 0.25);
      }
      for (const side of [-1, 1]) {
        add(f, u + side * windowWidth * 0.46, 25.48, minecraft ? 0.5 : 0.22,
          3.3, minecraft ? 0.9 : 0.35, C.sandstone,
          "mezzanine jambs", projection + 0.42);
      }
    }
    // Original abstract tessera fields identify the mosaic register without
    // copying the historic allegories, artist portraits or current exhibition art.
    for (let boundary = 0; boundary <= f.bays; boundary += 1) {
      const u = Math.max(1.4, Math.min(length - 1.4, boundary * pitch));
      const projection = sourceProjectionAt(u);
      add(f, u, 25.48, 2.05, 3.15, minecraft ? 0.8 : 0.18,
        C.gold, "gold mosaic frames", projection + 0.18, !minecraft);
      add(f, u, 25.48, 1.62, 2.7, minecraft ? 0.85 : 0.12,
        C.mosaicGround, "mosaic fields", projection + 0.32);
      const rows = fine ? 4 : 2;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < (fine ? 3 : 1); col += 1) {
          add(f, u + (fine ? col - 1 : 0) * 0.41,
            24.6 + row * 1.7 / (rows - 1), minecraft ? 0.7 : 0.31,
            minecraft ? 0.65 : 0.31, minecraft ? 0.9 : 0.1,
            [C.mosaicBlue, C.gold, C.mosaicGreen, C.stoneLight][(row + col + boundary) % 4],
            "abstract mosaic tesserae", projection + 0.43);
        }
      }
    }
    if (!minecraft) {
      const repeats = profile === "full" ? f.bays * 5 : f.bays * 3;
      for (let repeat = 0; repeat < repeats; repeat += 1) {
        const u = (repeat + 0.5) * length / repeats;
        for (const y of [11.93, 23.1]) {
          add(f, u, y, 0.29, 0.34, 0.14, C.gold,
            "terracotta frieze relief rhythm", sourceProjectionAt(u) + 0.44);
        }
      }
    }
    const dentils = profile === "full" ? f.bays * 3 : f.bays * 2;
    for (let tooth = 0; tooth < dentils; tooth += 1) {
      const u = (tooth + 0.5) * length / dentils;
      add(f, u, 28.22,
        minecraft ? 0.7 : 0.35, 0.42, minecraft ? 1.1 : 0.72,
        C.cornice, "cornice consoles", sourceProjectionAt(u) + 0.54);
    }
  }

  const north = GROPIUS_BAU_FACADES[0];
  const centre = facadeLength(north) / 2;
  for (const side of [-1, 1]) {
    add(north, centre + side * 4.15, 7.25, 0.7, 7.35,
      minecraft ? 1.35 : 0.92, C.stoneLight, "north portal piers", 1.05, !minecraft);
    add(north, centre + side * 4.15, 11.12, 1.1, 0.5,
      minecraft ? 1.45 : 1.1, C.sandstone, "north portal capitals", 1.1, !minecraft);
  }
  add(north, centre, 11.55, 9.85, 0.52, minecraft ? 1.45 : 1.25,
    C.stoneLight, "north entrance entablature", 1.05, !minecraft);
  add(north, centre, 4.45, 6.1, 2.25, minecraft ? 0.9 : 0.25,
    C.frame, "north entrance doors", 1.02);
  return plan;
}

/** Shared detail plan is exported for bounded source/mode regression audits. */
export function gropiusBauDetailPlan(
  profile: GropiusBauDetailProfile = "full",
  minecraft = false,
): Readonly<Plan> {
  return makePlan(minecraft ? profile : staticModelDetailProfile(profile), minecraft);
}

export function createGropiusBauDetails(
  profile: GropiusBauDetailProfile = "full",
): Group {
  profile = staticModelDetailProfile(profile);
  const plan = makePlan(profile, false);
  const builder = createBuilder();
  for (const part of plan.parts) {
    if (part.roll === 0) {
      addBox(builder, part.color, ...part.position, ...part.size, part.yaw, part.ink);
    } else {
      const geometry = new BoxGeometry(...part.size);
      geometry.rotateZ(part.roll).rotateY(part.yaw).translate(...part.position);
      paintGeometry(geometry, part.color);
      builder.parts.push(geometry);
      if (part.ink) builder.edges.push(new EdgesGeometry(geometry, 30));
    }
  }
  const root = finishDrawnGroup(builder, { name: GROPIUS_BAU_DETAILS_GROUP_NAME })!;
  root.userData = {
    ...GROPIUS_BAU_PROFILE, detailProfile: profile, facadeOnly: true,
    primitiveCount: plan.parts.length, cueCounts: plan.counts,
  };
  root.traverse((object) => {
    if (object.userData.dayMaterial) object.userData.civicBuildingDetail = true;
  });
  return freezeStaticSceneTransforms(root);
}

export function createMinecraftGropiusBauDetails(
  profile: GropiusBauDetailProfile = "full",
): Group {
  const plan = makePlan(profile, true);
  const root = new Group();
  root.name = MINECRAFT_GROPIUS_BAU_GROUP_NAME;
  root.userData = {
    ...GROPIUS_BAU_PROFILE, detailProfile: profile, facadeOnly: true,
    blockNative: true, keepInMinecraft: true,
    primitiveCount: plan.parts.length, cueCounts: plan.counts,
    voxelFacadeStandOffM: 3.1, quantisedHeightM: 32,
  };
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
  const nightMaterial = new MeshStandardMaterial({
    color: 0xffffff, flatShading: true, roughness: 0.9, metalness: 0,
  });
  const mesh = new InstancedMesh(geometry, dayMaterial, 0);
  const matrices = new Float32Array(plan.parts.length * 16);
  const colors = new Float32Array(plan.parts.length * 3);
  const matrix = new Matrix4();
  const position = new Vector3();
  const size = new Vector3();
  const rotation = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const color = new Color();
  plan.parts.forEach((part, index) => {
    matrix.compose(position.set(...part.position),
      rotation.setFromAxisAngle(up, part.yaw), size.set(...part.size));
    matrix.toArray(matrices, index * 16);
    color.setHex(part.color).toArray(colors, index * 3);
  });
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.count = plan.parts.length;
  mesh.name = `${MINECRAFT_GROPIUS_BAU_GROUP_NAME} blocks`;
  mesh.userData.dayMaterial = dayMaterial;
  mesh.userData.nightMaterial = nightMaterial;
  mesh.userData.textureFree = true;
  mesh.userData.civicBuildingDetail = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
