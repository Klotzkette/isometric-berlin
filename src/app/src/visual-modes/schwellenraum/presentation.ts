import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";

import type { VisualMode } from "../../visualMode";
import {
  schwellenraumProtectedMemorialClearanceM,
  type SchwellenraumMemorialProtectionIndex,
} from "../../schwellenraumMemorialProtection";
import {
  SCHWELLENRAUM_PROTECTED_VOLUMES,
  isSchwellenraumProtectedObjectName,
  type SchwellenraumProtectedVolume,
} from "../../SchwellenraumInteriors";
import { attachPariserPlatzEntityLoop } from "./pariserPlatzEntityLoop";

/**
 * The Schwellenraum keeps the ordinary daylight city intact. Its atmosphere
 * is therefore made from a different sky and a few additive light objects,
 * never from displaced, stretched or post-processed architecture.
 */
export const SCHWELLENRAUM_SKY_COLOR = 0x837e8b;

export const SCHWELLENRAUM_LIGHT_TONES = [
  0xe0b07f,
  0xa8cbb7,
  0xc1a4ca,
  0x78a5aa,
] as const;

export type SchwellenraumDetailProfile = "full" | "mobile";

/** Hard geometry budgets for all eight sites and the local Pariser Platz loop. */
export const SCHWELLENRAUM_PRESENTATION_BUDGET = {
  full: { geometries: 24, materials: 10, objects: 41, renderables: 31, vertices: 5_700 },
  mobile: { geometries: 24, materials: 10, objects: 41, renderables: 31, vertices: 4_350 },
} as const;

/**
 * The presentation and navigation layers deliberately share this one source
 * of truth. Presentation-only light geometry is kept outside every protected
 * volume and protected object trees retain the exact Day mode.
 */
export const SCHWELLENRAUM_SCHUTZRAEUME = SCHWELLENRAUM_PROTECTED_VOLUMES;

/** A name or explicit metadata flag protects the complete descendant tree. */
export function isSchwellenraumGeschuetzt(object: Object3D): boolean {
  let current: Object3D | null = object;
  while (current) {
    if (
      current.userData.schwellenraumGeschuetzt === true ||
      isSchwellenraumProtectedObjectName(current.name)
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * The presentation dispatcher can use this hook at every material/ink swap.
 * A protected subtree always resolves to ordinary Day, independent of the
 * active atmospheric mode.
 */
export function schwellenraumObjektmodus(
  requested: VisualMode,
  object: Object3D,
): VisualMode {
  return requested === "schwellenraum" && isSchwellenraumGeschuetzt(object)
    ? "day"
    : requested;
}

export type SchwellenraumLichtort = {
  heightM: number;
  name: string;
  rotationY: number;
  widthM: number;
  x: number;
  z: number;
};

/** Safe, non-memorial places where repeated light thresholds can appear. */
export const SCHWELLENRAUM_LICHTORTE: readonly SchwellenraumLichtort[] = [
  {
    heightM: 11.5,
    name: "Hauptbahnhof Vorplatz",
    rotationY: 0.09,
    widthM: 6.8,
    x: -97.15,
    z: -855.26,
  },
  {
    heightM: 10.2,
    name: "Kanzleramt Vorplatz",
    rotationY: -0.34,
    widthM: 6.2,
    x: -182,
    z: -77,
  },
  {
    heightM: 12.8,
    name: "Potsdamer Platz Suedportal",
    rotationY: 0.48,
    widthM: 7.4,
    x: 170.36,
    z: 1038.07,
  },
  {
    heightM: 10.8,
    name: "Hafenplatz Hof",
    rotationY: -0.18,
    widthM: 6.6,
    x: 303,
    z: 1645,
  },
  {
    heightM: 9.6,
    name: "Futurium Vorfeld",
    rotationY: -0.12,
    widthM: 5.8,
    x: 170,
    z: -580,
  },
  {
    heightM: 10.6,
    name: "Leipziger Platz Passage",
    rotationY: 0.22,
    widthM: 6.4,
    x: 540,
    z: 1010,
  },
  {
    heightM: 8.8,
    name: "Haus der Kulturen Vorfeld",
    rotationY: -0.42,
    widthM: 5.6,
    x: -540,
    z: 20,
  },
  {
    heightM: 9.2,
    name: "Cafe am Neuen See Gartenweg",
    rotationY: 0.3,
    widthM: 5.9,
    x: -1815,
    z: 930,
  },
] as const;

function pointInRing(
  x: number,
  z: number,
  ring: ReadonlyArray<readonly [number, number]>,
): boolean {
  let inside = false;
  for (
    let current = 0, previous = ring.length - 1;
    current < ring.length;
    previous = current, current += 1
  ) {
    const [currentX, currentZ] = ring[current];
    const [previousX, previousZ] = ring[previous];
    const crosses =
      currentZ > z !== previousZ > z &&
      x <
        ((previousX - currentX) * (z - currentZ)) /
          (previousZ - currentZ) +
          currentX;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointSegmentDistance(
  x: number,
  z: number,
  from: readonly [number, number],
  to: readonly [number, number],
): number {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const lengthSquared = dx * dx + dz * dz;
  const progress =
    lengthSquared < 1e-12
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((x - from[0]) * dx + (z - from[1]) * dz) / lengthSquared,
          ),
        );
  return Math.hypot(
    x - (from[0] + dx * progress),
    z - (from[1] + dz * progress),
  );
}

function distanceToProtectedVolume(
  x: number,
  z: number,
  volume: SchwellenraumProtectedVolume,
): number {
  if (volume.shape === "circle") {
    return Math.max(
      0,
      Math.hypot(x - volume.centerWorldM[0], z - volume.centerWorldM[1]) -
        volume.radiusM,
    );
  }
  if (volume.shape === "polygon") {
    if (pointInRing(x, z, volume.ringWorldM)) return 0;
    return Math.min(
      ...volume.ringWorldM.map((point, index) =>
        pointSegmentDistance(
          x,
          z,
          point,
          volume.ringWorldM[(index + 1) % volume.ringWorldM.length],
        ),
      ),
    );
  }
  const dx = x - volume.centerWorldM[0];
  const dz = z - volume.centerWorldM[1];
  const cosine = Math.cos(volume.rotationY);
  const sine = Math.sin(volume.rotationY);
  const localX = cosine * dx - sine * dz;
  const localZ = sine * dx + cosine * dz;
  return Math.hypot(
    Math.max(0, Math.abs(localX) - volume.sizeM[0] / 2),
    Math.max(0, Math.abs(localZ) - volume.sizeM[1] / 2),
  );
}

export function abstandZumNaechstenSchutzraum(x: number, z: number): number {
  return Math.min(
    ...SCHWELLENRAUM_PROTECTED_VOLUMES.map((volume) =>
      distanceToProtectedVolume(x, z, volume),
    ),
  );
}

function lightMaterial(opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    blending: AdditiveBlending,
    color: 0xffffff,
    depthWrite: false,
    opacity,
    side: DoubleSide,
    toneMapped: false,
    transparent: true,
    vertexColors: true,
  });
}

function lineMaterial(opacity: number): LineBasicMaterial {
  return new LineBasicMaterial({
    blending: AdditiveBlending,
    color: 0xffffff,
    depthWrite: false,
    opacity,
    toneMapped: false,
    transparent: true,
    vertexColors: true,
  });
}

type LichtschwelleAssets = {
  line: LineBasicMaterial;
  mote: MeshBasicMaterial;
  moteGeometry: OctahedronGeometry;
  veil: MeshBasicMaterial;
};

function pushSegment(
  positions: number[],
  colors: number[],
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  tone: number,
  strength: number,
): void {
  positions.push(...from, ...to);
  const color = new Color(tone).multiplyScalar(strength);
  colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
}

function pushFrame(
  positions: number[],
  colors: number[],
  width: number,
  height: number,
  centerY: number,
  centerZ: number,
  tone: number,
  strength: number,
  centerX = 0,
  topShiftX = 0,
): void {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const halfDepth = 0.04;
  const corners = (z: number) =>
    [
      [centerX - halfWidth, centerY - halfHeight, z],
      [centerX + halfWidth, centerY - halfHeight, z],
      [centerX + halfWidth + topShiftX, centerY + halfHeight, z],
      [centerX - halfWidth + topShiftX, centerY + halfHeight, z],
    ] as const;
  const front = corners(centerZ + halfDepth);
  const back = corners(centerZ - halfDepth);
  for (let side = 0; side < 4; side += 1) {
    const next = (side + 1) % 4;
    pushSegment(positions, colors, front[side], front[next], tone, strength);
    pushSegment(positions, colors, back[side], back[next], tone, strength * 0.72);
    pushSegment(positions, colors, front[side], back[side], tone, strength * 0.58);
  }
}

function pushRing(
  positions: number[],
  colors: number[],
  radius: number,
  y: number,
  segments: number,
  tone: number,
  strength: number,
): void {
  for (let segment = 0; segment < segments; segment += 1) {
    const from = (segment / segments) * Math.PI * 2;
    const to = ((segment + 1) / segments) * Math.PI * 2;
    pushSegment(
      positions,
      colors,
      [Math.cos(from) * radius, y, Math.sin(from) * radius],
      [Math.cos(to) * radius, y, Math.sin(to) * radius],
      tone,
      strength,
    );
  }
}

function pushVeil(
  positions: number[],
  colors: number[],
  width: number,
  height: number,
  z: number,
  tone: number,
  strength: number,
): void {
  const halfWidth = width / 2;
  const bottom = height * 0.03;
  const top = height * 0.97;
  const vertices = [
    [-halfWidth, bottom, z],
    [halfWidth, bottom, z],
    [halfWidth, top, z],
    [-halfWidth, bottom, z],
    [halfWidth, top, z],
    [-halfWidth, top, z],
  ] as const;
  const color = new Color(tone).multiplyScalar(strength);
  for (const vertex of vertices) {
    positions.push(...vertex);
    colors.push(color.r, color.g, color.b);
  }
}

function pushDreamcoreCorridor(
  positions: number[],
  colors: number[],
  width: number,
  height: number,
  index: number,
  detailProfile: SchwellenraumDetailProfile,
): number {
  const frameCount = detailProfile === "mobile" ? 2 : 3;
  for (let frame = 1; frame <= frameCount; frame += 1) {
    const scale = 1 - frame * 0.16;
    const alternatingShift =
      (index % 2 === 0 ? 1 : -1) * (frame % 2 === 0 ? -0.16 : 0.2);
    pushFrame(
      positions,
      colors,
      width * scale,
      height * scale,
      height * (0.5 - frame * 0.018),
      -2.25 - frame * 1.65,
      SCHWELLENRAUM_LIGHT_TONES[(index + frame + 2) % 4],
      0.58 - frame * 0.09,
      alternatingShift,
      alternatingShift * 1.7,
    );
  }
  const farScale = 1 - frameCount * 0.16;
  const farZ = -2.25 - frameCount * 1.65;
  const tone = SCHWELLENRAUM_LIGHT_TONES[(index + 3) % 4];
  for (const side of [-1, 1]) {
    pushSegment(
      positions,
      colors,
      [side * width * 0.5, 0.08, -0.1],
      [side * width * farScale * 0.5, height * 0.06, farZ],
      tone,
      0.36,
    );
    pushSegment(
      positions,
      colors,
      [side * width * 0.5, height * 0.98, -0.1],
      [side * width * farScale * 0.5, height * 0.91, farZ],
      tone,
      0.26,
    );
  }
  return frameCount;
}

function createLichtschwelle(
  profile: SchwellenraumLichtort,
  index: number,
  detailProfile: SchwellenraumDetailProfile,
  assets: LichtschwelleAssets,
): Group {
  const group = new Group();
  group.name = `Schwellenraum Lichtschwelle ${profile.name}`;
  group.position.set(profile.x, 0.12, profile.z);
  group.rotation.y = profile.rotationY;

  const height = profile.heightM;
  const width = profile.widthM;
  const mainTone = SCHWELLENRAUM_LIGHT_TONES[index % 4];
  const echoTone = SCHWELLENRAUM_LIGHT_TONES[(index + 1) % 4];

  // Frames and floor echoes share one line batch per place. The elongated
  // afterimages keep the threshold uncanny while replacing six draw calls
  // and six materials with one source-neutral geometry.
  const linePositions: number[] = [];
  const lineColors: number[] = [];
  const echoCount = detailProfile === "mobile" ? 2 : 3;
  for (let echo = 0; echo < echoCount; echo += 1) {
    const echoOffsetX =
      echo === 0
        ? 0
        : Math.sin((index + 1) * 1.37 + echo * 0.91) * echo * 0.16;
    const echoShearX =
      echo === 0 ? 0 : (index % 2 === 0 ? 1 : -1) * echo * 0.22;
    pushFrame(
      linePositions,
      lineColors,
      width + echo * 0.62,
      height + echo * 0.72,
      height / 2 + echo * 0.18,
      -echo * 0.68,
      echo === 0 ? mainTone : echoTone,
      1 - echo * 0.22,
      echoOffsetX,
      echoShearX,
    );
  }
  const corridorFrameCount = pushDreamcoreCorridor(
    linePositions,
    lineColors,
    width,
    height,
    index,
    detailProfile,
  );
  const ringCount = detailProfile === "mobile" ? 2 : 3;
  const ringSegments = detailProfile === "mobile" ? 24 : 36;
  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    pushRing(
      linePositions,
      lineColors,
      width * (0.62 + ringIndex * 0.24),
      0.08 + ringIndex * 0.05,
      ringSegments,
      SCHWELLENRAUM_LIGHT_TONES[(index + ringIndex + 2) % 4],
      0.92 - ringIndex * 0.18,
    );
  }
  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(linePositions, 3),
  );
  lineGeometry.setAttribute("color", new Float32BufferAttribute(lineColors, 3));
  const contours = new LineSegments(lineGeometry, assets.line);
  contours.name = `${profile.name} gebuendelte Lichtkonturen`;
  contours.userData.schwellenraumStatic = true;
  group.add(contours);

  // Two close translucent planes make a quiet spatial afterimage instead of
  // a bright portal card. Both planes remain in one draw call.
  const veilPositions: number[] = [];
  const veilColors: number[] = [];
  pushVeil(veilPositions, veilColors, width * 0.94, height, 0, mainTone, 0.8);
  pushVeil(
    veilPositions,
    veilColors,
    width * 1.04,
    height * 0.96,
    -0.62,
    echoTone,
    0.48,
  );
  pushVeil(
    veilPositions,
    veilColors,
    width * 0.72,
    height * 1.04,
    -1.52,
    SCHWELLENRAUM_LIGHT_TONES[(index + 3) % 4],
    0.26,
  );
  const veilGeometry = new BufferGeometry();
  veilGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(veilPositions, 3),
  );
  veilGeometry.setAttribute("color", new Float32BufferAttribute(veilColors, 3));
  const veil = new Mesh(veilGeometry, assets.veil);
  veil.name = `${profile.name} doppelter Lichtschleier`;
  veil.userData.schwellenraumStatic = true;
  group.add(veil);

  const moteCount = detailProfile === "mobile" ? 6 : 9;
  const motes = new InstancedMesh(assets.moteGeometry, assets.mote, moteCount);
  motes.name = `${profile.name} ruhende Lichtpunkte`;
  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const euler = new Euler();
  const scale = new Vector3();
  const moteTone = new Color();
  for (let mote = 0; mote < moteCount; mote += 1) {
    const color = SCHWELLENRAUM_LIGHT_TONES[(index + mote) % 4];
    const t = (mote + 1) / (moteCount + 1);
    position.set(
      Math.sin((mote + 1) * 2.17) * width * 0.38,
      1.4 + t * (height - 2.2),
      -0.5 - Math.cos((mote + 1) * 1.71) * 1.25,
    );
    euler.set(mote * 0.13, mote * 0.29, mote * 0.07);
    rotation.setFromEuler(euler);
    scale.setScalar(0.7 + (mote % 3) * 0.16);
    matrix.compose(position, rotation, scale);
    motes.setMatrixAt(mote, matrix);
    motes.setColorAt(mote, moteTone.setHex(color));
  }
  motes.instanceMatrix.needsUpdate = true;
  if (motes.instanceColor) motes.instanceColor.needsUpdate = true;
  motes.computeBoundingSphere();
  motes.userData.schwellenraumStatic = true;
  group.add(motes);

  group.userData.schwellenraumPraesentation = true;
  group.userData.schwellenraumStatic = true;
  group.userData.uncannyFrameShearM = (echoCount - 1) * 0.22;
  group.userData.dreamcoreCorridorFrameCount = corridorFrameCount;
  group.userData.veilLayerCount = 3;
  group.userData.kollision = "nur Licht; keine begehbare oder durchfliegbare Masse";
  // The outer floor-light torus is the widest accent. This radius lets the
  // source-data guard disable the complete threshold before a future mapped
  // memorial could overlap even its faintest additive pixel.
  group.userData.schutzradiusM = width * 1.12;
  group.userData.schutzabstandM = abstandZumNaechstenSchutzraum(
    profile.x,
    profile.z,
  );
  return group;
}

/** Create the deterministic accents and one tightly bounded local motion loop. */
export function createSchwellenraumPraesentation(
  detailProfile: SchwellenraumDetailProfile = "full",
): Group {
  const root = new Group();
  root.name = "Schwellenraum additive Lichtpraesentation";
  root.visible = false;
  root.userData.standardstadtBleibtUnveraendert = true;
  root.userData.tonfolge = SCHWELLENRAUM_LIGHT_TONES.map((tone) =>
    new Color(tone).getHexString(),
  );
  root.userData.detailProfile = detailProfile;
  root.userData.atmosphere =
    "cold dissonant light, impossible receding corridors and static misregistered frame echoes";
  root.userData.renderBudget = SCHWELLENRAUM_PRESENTATION_BUDGET[detailProfile];
  const assets: LichtschwelleAssets = {
    line: lineMaterial(0.22),
    mote: lightMaterial(0.42),
    moteGeometry: new OctahedronGeometry(0.13, 0),
    veil: lightMaterial(0.052),
  };
  for (const [index, profile] of SCHWELLENRAUM_LICHTORTE.entries()) {
    root.add(createLichtschwelle(profile, index, detailProfile, assets));
  }
  attachPariserPlatzEntityLoop(root, detailProfile);
  return root;
}

/**
 * Keep additive accents outside protected OSM shapes as the widened payload
 * evolves. A hidden child stays hidden when the mode toggles because only the
 * presentation root is switched by `setSchwellenraumPraesentation`.
 */
export function setSchwellenraumDatenSchutz(
  root: Group,
  protection: SchwellenraumMemorialProtectionIndex,
): boolean {
  let changed = false;
  for (const child of root.children) {
    if (child.userData.schwellenraumPraesentation !== true) continue;
    const radiusM = child.userData.schutzradiusM as number;
    const clearanceM = schwellenraumProtectedMemorialClearanceM(
      protection,
      child.position.x,
      child.position.z,
    );
    const safe = clearanceM > radiusM + 2;
    if (child.visible !== safe) {
      child.visible = safe;
      changed = true;
    }
    child.userData.datenSchutzabstandM = clearanceM;
    child.userData.datenSchutzAktiv = !safe;
  }
  return changed;
}

export function setSchwellenraumPraesentation(
  root: Group,
  mode: VisualMode,
  obstructed: boolean,
): boolean {
  const visible = mode === "schwellenraum" && !obstructed;
  if (root.visible === visible) {
    return false;
  }
  root.visible = visible;
  return true;
}
