import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  type Object3D,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
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

/**
 * The Schwellenraum keeps the ordinary daylight city intact. Its atmosphere
 * is therefore made from a different sky and a few additive light objects,
 * never from displaced, stretched or post-processed architecture.
 */
export const SCHWELLENRAUM_SKY_COLOR = 0xe7e0cc;

export const SCHWELLENRAUM_LIGHT_TONES = [
  0xffdfa0,
  0xfff0c9,
  0xd8caff,
  0xc9eadf,
] as const;

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

function lightMaterial(color: number, opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    blending: AdditiveBlending,
    color,
    depthWrite: false,
    opacity,
    toneMapped: false,
    transparent: true,
  });
}

function lineMaterial(color: number, opacity: number): LineBasicMaterial {
  return new LineBasicMaterial({
    blending: AdditiveBlending,
    color,
    depthWrite: false,
    opacity,
    toneMapped: false,
    transparent: true,
  });
}

function createLichtschwelle(
  profile: SchwellenraumLichtort,
  index: number,
): Group {
  const group = new Group();
  group.name = `Schwellenraum Lichtschwelle ${profile.name}`;
  group.position.set(profile.x, 0.12, profile.z);
  group.rotation.y = profile.rotationY;

  const height = profile.heightM;
  const width = profile.widthM;
  const mainTone = SCHWELLENRAUM_LIGHT_TONES[index % 4];
  const echoTone = SCHWELLENRAUM_LIGHT_TONES[(index + 1) % 4];

  // Three almost-identical frames create the measured, gently prolonged
  // vertical rhythm without ever stretching a building or collision body.
  for (let echo = 0; echo < 3; echo += 1) {
    const frameBox = new BoxGeometry(
      width + echo * 0.62,
      height + echo * 0.72,
      0.08,
    );
    const frameGeometry = new EdgesGeometry(frameBox);
    frameBox.dispose();
    const frame = new LineSegments(
      frameGeometry,
      lineMaterial(echo === 0 ? mainTone : echoTone, 0.2 - echo * 0.045),
    );
    frame.name = `${profile.name} Lichtkontur ${echo + 1}`;
    frame.position.set(0, height / 2 + echo * 0.18, -echo * 0.68);
    group.add(frame);
  }

  const veil = new Mesh(
    new PlaneGeometry(width * 0.94, height * 0.94),
    lightMaterial(mainTone, 0.027),
  );
  veil.name = `${profile.name} zarter Lichtschleier`;
  veil.position.y = height / 2;
  group.add(veil);

  for (let ringIndex = 0; ringIndex < 3; ringIndex += 1) {
    const ring = new Mesh(
      new TorusGeometry(width * (0.62 + ringIndex * 0.24), 0.035, 5, 64),
      lightMaterial(
        SCHWELLENRAUM_LIGHT_TONES[(index + ringIndex + 2) % 4],
        0.2 - ringIndex * 0.035,
      ),
    );
    ring.name = `${profile.name} Bodenlicht ${ringIndex + 1}`;
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08 + ringIndex * 0.05;
    group.add(ring);
  }

  const moteGeometry = new SphereGeometry(0.09, 8, 6);
  const glintGeometry = new OctahedronGeometry(0.13, 0);
  for (let mote = 0; mote < 9; mote += 1) {
    const color = SCHWELLENRAUM_LIGHT_TONES[(index + mote) % 4];
    const point = new Mesh(
      mote % 3 === 0 ? glintGeometry : moteGeometry,
      lightMaterial(color, mote % 3 === 0 ? 0.48 : 0.31),
    );
    point.name = `${profile.name} ruhender Lichtpunkt ${mote + 1}`;
    const t = (mote + 1) / 10;
    point.position.set(
      Math.sin((mote + 1) * 2.17) * width * 0.38,
      1.4 + t * (height - 2.2),
      -0.5 - Math.cos((mote + 1) * 1.71) * 1.25,
    );
    point.scale.setScalar(0.7 + (mote % 3) * 0.16);
    point.rotation.set(mote * 0.13, mote * 0.29, mote * 0.07);
    point.userData.schwellenraumStatic = true;
    group.add(point);
  }

  group.userData.schwellenraumPraesentation = true;
  group.userData.schwellenraumStatic = true;
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

/** Create the complete deterministic, static atmospheric accent layer. */
export function createSchwellenraumPraesentation(): Group {
  const root = new Group();
  root.name = "Schwellenraum additive Lichtpraesentation";
  root.visible = false;
  root.userData.standardstadtBleibtUnveraendert = true;
  root.userData.tonfolge = SCHWELLENRAUM_LIGHT_TONES.map((tone) =>
    new Color(tone).getHexString(),
  );
  for (const [index, profile] of SCHWELLENRAUM_LICHTORTE.entries()) {
    root.add(createLichtschwelle(profile, index));
  }
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
