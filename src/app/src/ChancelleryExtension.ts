import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  Quaternion,
  Shape,
  Vector3,
} from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  CHANCELLERY_EXTENSION_PROFILE,
  type WorldRing,
} from "./chancelleryExtensionProfile";
import {
  type Builder,
  addBox,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";

const SITE_GRAVEL = 0xd8d2c2;
const CONCRETE = 0xd8d8d3;
const CONCRETE_SHADOW = 0xb9bcb9;
const CLADDING = 0xecebe4;
const GLASS = 0x7c9ca1;
const STEEL = 0x59615f;
const SCAFFOLD = 0x737a78;
const TIMBER = 0x9d7b56;
const HOARDING = 0x414a49;
const CRANE = 0xd8ad39;
const RED = 0xc84038;
const WHITE = 0xf4f1e7;

export const CHANCELLERY_EXTENSION_DETAIL_COUNTS = {
  craneCount: 2,
  materialStackCount: 4,
  redWhiteBarrierCount: 12,
} as const;

function customGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  inked = true,
  lamp = false,
): void {
  if (!geometry.index) {
    const count = geometry.getAttribute("position").count;
    geometry.setIndex(Array.from({ length: count }, (_, index) => index));
  }
  paintGeometry(geometry, color);
  (lamp ? builder.lamps : builder.parts).push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function polygonPrism(
  builder: Builder,
  ring: WorldRing,
  bottomY: number,
  height: number,
  color: number,
  inked = true,
): void {
  const shape = new Shape();
  ring.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: height,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bottomY, 0);
  geometry.computeVertexNormals();
  customGeometry(builder, geometry, color, inked);
}

function segment(
  builder: Builder,
  color: number,
  start: readonly [number, number],
  end: readonly [number, number],
  centerY: number,
  height: number,
  depth: number,
  lamp = false,
): void {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  if (length < 0.08) return;
  const geometry = new BoxGeometry(length, height, depth);
  geometry.rotateY(-Math.atan2(dz, dx));
  geometry.translate((start[0] + end[0]) / 2, centerY, (start[1] + end[1]) / 2);
  customGeometry(builder, geometry, color, false, lamp);
}

function beamBetween(
  builder: Builder,
  color: number,
  start: Vector3,
  end: Vector3,
  thickness: number,
): void {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length < 0.08) return;
  const geometry = new BoxGeometry(thickness, length, thickness);
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      direction.normalize(),
    ),
  );
  geometry.translate(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    (start.z + end.z) / 2,
  );
  customGeometry(builder, geometry, color, false);
}

function ringEdge(
  ring: WorldRing,
  index: number,
): readonly [readonly [number, number], readonly [number, number]] {
  return [ring[index], ring[(index + 1) % ring.length]];
}

function addStoreyRegisters(
  builder: Builder,
  ring: WorldRing,
  baseY: number,
  heightM: number,
  storeys: number,
): void {
  const pitch = heightM / storeys;
  const selectedEdges = ring
    .map((_, index) => index)
    .filter((index) => {
      const [start, end] = ringEdge(ring, index);
      return Math.hypot(end[0] - start[0], end[1] - start[1]) > 4.2;
    });
  for (const edgeIndex of selectedEdges) {
    const [start, end] = ringEdge(ring, edgeIndex);
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);
    const bays = Math.max(1, Math.round(length / 4.3));
    for (let floor = 0; floor < storeys; floor += 1) {
      const y = baseY + pitch * floor + pitch * 0.54;
      segment(builder, GLASS, start, end, y, pitch * 0.52, 0.11);
      segment(
        builder,
        CLADDING,
        start,
        end,
        baseY + pitch * (floor + 1) - 0.18,
        0.36,
        0.2,
      );
      // The April 2026 shell is in technical fit-out, not an occupied office
      // block. Keep every day pane cool and add only a sparse deterministic
      // subset to the night-emissive bucket. This avoids the former orange
      // full-storey stripes while still suggesting work inside after dark.
      for (let bay = 0; bay < bays; bay += 1) {
        if ((bay + floor * 3 + edgeIndex * 5) % 13 !== 0) continue;
        const startFraction = (bay + 0.18) / bays;
        const endFraction = (bay + 0.82) / bays;
        const litStart: [number, number] = [
          start[0] + dx * startFraction,
          start[1] + dz * startFraction,
        ];
        const litEnd: [number, number] = [
          start[0] + dx * endFraction,
          start[1] + dz * endFraction,
        ];
        segment(builder, GLASS, litStart, litEnd, y, pitch * 0.38, 0.14, true);
      }
    }
    for (let bay = 0; bay <= bays; bay += 1) {
      const fraction = bay / bays;
      const x = start[0] + dx * fraction;
      const z = start[1] + dz * fraction;
      addBox(
        builder,
        CONCRETE_SHADOW,
        x,
        baseY + heightM / 2,
        z,
        0.16,
        heightM,
        0.16,
        0,
        false,
      );
    }
  }
}

function addScaffold(
  builder: Builder,
  ring: WorldRing,
  edgeIndices: readonly number[],
  groundY: number,
  topY: number,
): number {
  let bayTotal = 0;
  for (const edgeIndex of edgeIndices) {
    const [start, end] = ringEdge(ring, edgeIndex);
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);
    const bays = Math.max(1, Math.ceil(length / 3.1));
    bayTotal += bays;
    for (let bay = 0; bay <= bays; bay += 1) {
      const fraction = bay / bays;
      const x = start[0] + dx * fraction;
      const z = start[1] + dz * fraction;
      addBox(
        builder,
        SCAFFOLD,
        x,
        groundY + (topY - groundY) / 2,
        z,
        0.09,
        topY - groundY,
        0.09,
        0,
        false,
      );
      if (bay < bays) {
        const nextFraction = (bay + 1) / bays;
        const nx = start[0] + dx * nextFraction;
        const nz = start[1] + dz * nextFraction;
        for (let level = 0; level < 5; level += 1) {
          const lowY = groundY + 1 + level * 3.25;
          const highY = lowY + (bay % 2 === level % 2 ? 2.9 : -2.9);
          beamBetween(
            builder,
            SCAFFOLD,
            new Vector3(x, lowY, z),
            new Vector3(nx, highY, nz),
            0.055,
          );
        }
      }
    }
    for (let y = groundY + 1; y < topY; y += 3.25) {
      segment(builder, SCAFFOLD, start, end, y, 0.08, 0.08);
      segment(builder, TIMBER, start, end, y + 0.12, 0.1, 0.55);
    }
  }
  return bayTotal;
}

function addTowerCrane(
  builder: Builder,
  x: number,
  z: number,
  groundY: number,
  mastHeight: number,
  rotation: number,
): void {
  const topY = groundY + mastHeight;
  for (const ox of [-0.5, 0.5]) {
    for (const oz of [-0.5, 0.5]) {
      addBox(
        builder,
        CRANE,
        x + ox,
        groundY + mastHeight / 2,
        z + oz,
        0.14,
        mastHeight,
        0.14,
        0,
        false,
      );
    }
  }
  for (let y = groundY + 1.8; y < topY; y += 2.4) {
    addBox(builder, CRANE, x, y, z - 0.5, 1.1, 0.09, 0.1, 0, false);
    addBox(builder, CRANE, x - 0.5, y, z, 0.1, 0.09, 1.1, 0, false);
  }
  const jib = new BoxGeometry(45, 0.55, 0.55);
  jib.rotateY(rotation);
  jib.translate(x + Math.cos(rotation) * 8, topY, z - Math.sin(rotation) * 8);
  customGeometry(builder, jib, CRANE, false);
  const cabin = new BoxGeometry(3.1, 1.8, 2.1);
  cabin.rotateY(rotation);
  cabin.translate(x, topY - 1.05, z);
  customGeometry(builder, cabin, GLASS, true);
  const beacon = new CylinderGeometry(0.22, 0.22, 0.42, 8);
  beacon.translate(x, topY + 0.48, z);
  customGeometry(builder, beacon, RED, false, true);
}

function addSouthBridge(builder: Builder, groundY: number): void {
  const { startWorldM, endWorldM } = CHANCELLERY_EXTENSION_PROFILE.southBridge;
  const dx = endWorldM[0] - startWorldM[0];
  const dz = endWorldM[1] - startWorldM[1];
  const length = CHANCELLERY_EXTENSION_PROFILE.southBridge.documentedLengthM;
  const rotation = -Math.atan2(dz, dx);
  const x = (startWorldM[0] + endWorldM[0]) / 2;
  const z = (startWorldM[1] + endWorldM[1]) / 2;
  const deckY = groundY + 8.6;
  addBox(builder, CONCRETE, x, deckY, z, length, 1.25, 6.1, rotation, true);
  addBox(
    builder,
    GLASS,
    x,
    deckY + 1.42,
    z - 2.86,
    length,
    1.85,
    0.14,
    rotation,
    false,
  );
  addBox(
    builder,
    GLASS,
    x,
    deckY + 1.42,
    z + 2.86,
    length,
    1.85,
    0.14,
    rotation,
    false,
  );
  for (let offset = -length / 2 + 3; offset < length / 2; offset += 6) {
    const px = x + Math.cos(rotation) * offset;
    const pz = z - Math.sin(rotation) * offset;
    addBox(
      builder,
      STEEL,
      px,
      deckY + 1.42,
      pz - 2.88,
      0.09,
      1.85,
      0.09,
      rotation,
      false,
    );
    addBox(
      builder,
      STEEL,
      px,
      deckY + 1.42,
      pz + 2.88,
      0.09,
      1.85,
      0.09,
      rotation,
      false,
    );
  }
}

function addSitePerimeter(builder: Builder, groundY: number): number {
  const ring = CHANCELLERY_EXTENSION_PROFILE.siteFootprintWorldM;
  const edgeIndices = [2, 3, 7, 8, 9, 16, 17, 18, 19, 20, 21, 22, 23];
  let panels = 0;
  for (const edgeIndex of edgeIndices) {
    const [start, end] = ringEdge(ring, edgeIndex);
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const count = Math.max(1, Math.ceil(length / 2.4));
    for (let panel = 0; panel < count; panel += 1) {
      const f1 = panel / count;
      const f2 = (panel + 1) / count;
      const a: [number, number] = [
        start[0] + (end[0] - start[0]) * f1,
        start[1] + (end[1] - start[1]) * f1,
      ];
      const b: [number, number] = [
        start[0] + (end[0] - start[0]) * f2,
        start[1] + (end[1] - start[1]) * f2,
      ];
      segment(builder, HOARDING, a, b, groundY + 1.15, 2.2, 0.12);
      panels += 1;
    }
  }
  return panels;
}

/**
 * Present-day construction stage, not the finished published project.
 * Building footprints and bridge axis are source geometry; temporary detail
 * is intentionally sparse and static so it reads clearly without flicker.
 */
export function createChancelleryExtension(ground: VoxelPayload): Group | null {
  const sample = worldGroundSampler(ground);
  const curvedGroundY = sample(-681.77, -177.65) ?? 4.3;
  const annexGroundY = sample(-505.76, -187.19) ?? 4.8;
  const groundY = Math.min(curvedGroundY, annexGroundY);
  const profile = CHANCELLERY_EXTENSION_PROFILE;
  const shell = createBuilder();

  polygonPrism(
    shell,
    profile.curvedBuildingFootprintWorldM,
    curvedGroundY,
    profile.curvedBuildingHeightM,
    CONCRETE,
  );
  addStoreyRegisters(
    shell,
    profile.curvedBuildingFootprintWorldM,
    curvedGroundY,
    profile.curvedBuildingHeightM,
    profile.plannedOfficeStoreys,
  );
  polygonPrism(
    shell,
    profile.annexFootprintWorldM,
    annexGroundY,
    profile.annexHeightM,
    CLADDING,
  );
  addStoreyRegisters(
    shell,
    profile.annexFootprintWorldM,
    annexGroundY,
    profile.annexHeightM,
    1,
  );
  addSouthBridge(shell, 2.1);

  const group = new Group();
  group.name = "Federal Chancellery extension current construction stage";
  const shellGroup = finishDrawnGroup(shell, {
    lampEmissive: 0xffc86f,
    lampEmissiveIntensity: 0.82,
    name: "Chancellery extension standing shell",
  });
  if (shellGroup) group.add(shellGroup);

  const site = createBuilder();
  // Keep the worksite legible without replacing the entire Kanzlerpark with a
  // single invented dirt polygon: only documented building aprons are paved.
  polygonPrism(
    site,
    [
      [-770, -218],
      [-590, -218],
      [-575, -111],
      [-744, -105],
    ],
    groundY + 0.02,
    0.16,
    SITE_GRAVEL,
    false,
  );
  polygonPrism(
    site,
    [
      [-590, -217],
      [-397, -214],
      [-405, -150],
      [-590, -151],
    ],
    groundY + 0.03,
    0.16,
    SITE_GRAVEL,
    false,
  );
  const scaffoldBays = addScaffold(
    site,
    profile.curvedBuildingFootprintWorldM,
    [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
    curvedGroundY + 0.1,
    curvedGroundY + 18.3,
  );
  addTowerCrane(site, -690, -146, curvedGroundY, 42, -0.08);
  addTowerCrane(site, -523, -231, annexGroundY, 36, Math.PI - 0.18);
  const fencePanelCount = addSitePerimeter(site, groundY);
  for (
    let index = 0;
    index < CHANCELLERY_EXTENSION_DETAIL_COUNTS.redWhiteBarrierCount;
    index += 1
  ) {
    addBox(
      site,
      index % 2 === 0 ? RED : WHITE,
      -603 + index * 1.65,
      groundY + 0.48,
      -235.8,
      1.45,
      0.82,
      0.22,
      -0.02,
      false,
    );
  }
  for (
    let stack = 0;
    stack < CHANCELLERY_EXTENSION_DETAIL_COUNTS.materialStackCount;
    stack += 1
  ) {
    addBox(
      site,
      TIMBER,
      -615 + stack * 4.2,
      groundY + 0.42,
      -222,
      3.1,
      0.55,
      1.2,
      0.04,
      true,
    );
  }
  const siteGroup = finishDrawnGroup(site, {
    lampEmissive: 0xffb14f,
    lampEmissiveIntensity: 1.15,
    name: "Chancellery extension construction details",
  });
  if (siteGroup) group.add(siteGroup);

  group.userData = {
    currentStage: profile.currentStage,
    currentStagePublishedAt: profile.currentStagePublishedAt,
    fencePanelCount,
    geometryStatus: profile.geometryStatus,
    osmAnnexWayId: profile.osmAnnexWayId,
    osmCurvedBuildingWayId: profile.osmCurvedBuildingWayId,
    osmSiteWayId: profile.osmSiteWayId,
    osmSouthBridgeWayId: profile.osmSouthBridgeWayId,
    scaffoldBays,
    sourceCheckedAt: profile.sourceCheckedAt,
    sourceUrls: [...profile.sourceUrls],
    southBridgePresentationRule: profile.southBridge.presentationRule,
    towerCraneCount: CHANCELLERY_EXTENSION_DETAIL_COUNTS.craneCount,
  };
  return group.children.length > 0 ? group : null;
}
