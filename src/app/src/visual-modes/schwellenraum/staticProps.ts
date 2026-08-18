import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from "three";

import { schwellenraumProtectedMemorialClearanceM } from "../../schwellenraumMemorialProtection";
import type { SchwellenraumMemorialProtectionIndex } from "../../schwellenraumMemorialProtection";

type GroundAt = (x: number, z: number) => number | null;

export type SchwellenraumPropKind =
  | "chair"
  | "floor-lamp"
  | "refrigerator"
  | "side-table"
  | "sofa"
  | "washing-machine";

export type SchwellenraumStaticProp = {
  color: number;
  id: string;
  kind: SchwellenraumPropKind;
  localX: number;
  localZ: number;
  rotationY: number;
  sizeM: readonly [number, number, number];
};

export type SchwellenraumStaticVignette = {
  id: string;
  name: string;
  props: readonly SchwellenraumStaticProp[];
  rotationY: number;
  x: number;
  z: number;
};

/**
 * Four deliberately sparse, fixed vignettes at already-audited non-memorial
 * threshold sites. Coordinates share the exact world frame used by the
 * source-derived city; terrain elevation is sampled at runtime.
 */
export const SCHWELLENRAUM_STATIC_VIGNETTES: readonly SchwellenraumStaticVignette[] = [
  {
    id: "hauptbahnhof-vorplatz",
    name: "Hauptbahnhof Vorplatz ruhende Sitzecke",
    rotationY: 0.09,
    x: -97.15,
    z: -855.26,
    props: [
      {
        color: 0xd7a95b,
        id: "amber-sofa",
        kind: "sofa",
        localX: -1.1,
        localZ: 0.2,
        rotationY: 0,
        sizeM: [2.65, 1.08, 0.96],
      },
      {
        color: 0xe8d4a4,
        id: "opal-floor-lamp",
        kind: "floor-lamp",
        localX: 1.45,
        localZ: -0.12,
        rotationY: 0,
        sizeM: [0.52, 1.82, 0.52],
      },
    ],
  },
  {
    id: "kanzleramt-vorplatz",
    name: "Kanzleramt Vorplatz ruhende Stuhlgruppe",
    rotationY: -0.34,
    x: -182,
    z: -77,
    props: [
      {
        color: 0xb6a1c7,
        id: "lavender-chair",
        kind: "chair",
        localX: -0.95,
        localZ: 0,
        rotationY: 0.24,
        sizeM: [0.82, 1.03, 0.84],
      },
      {
        color: 0xcab38a,
        id: "small-side-table",
        kind: "side-table",
        localX: 0.18,
        localZ: 0.08,
        rotationY: 0,
        sizeM: [0.72, 0.62, 0.72],
      },
      {
        color: 0x9eb9ad,
        id: "sage-chair",
        kind: "chair",
        localX: 1.25,
        localZ: -0.18,
        rotationY: -0.3,
        sizeM: [0.82, 1.03, 0.84],
      },
    ],
  },
  {
    id: "potsdamer-suedportal",
    name: "Potsdamer Platz Suedportal ruhende Kuechenecke",
    rotationY: 0.48,
    x: 170.36,
    z: 1038.07,
    props: [
      {
        color: 0xd8cbb3,
        id: "small-refrigerator",
        kind: "refrigerator",
        localX: -0.88,
        localZ: 0,
        rotationY: 0,
        sizeM: [0.86, 1.62, 0.82],
      },
      {
        color: 0xe0b66e,
        id: "single-chair",
        kind: "chair",
        localX: 0.78,
        localZ: 0.12,
        rotationY: -0.18,
        sizeM: [0.82, 1.03, 0.84],
      },
    ],
  },
  {
    id: "hafenplatz-hof",
    name: "Hafenplatz Hof ruhende Waschecke",
    rotationY: -0.18,
    x: 303,
    z: 1645,
    props: [
      {
        color: 0xc6d5cd,
        id: "washing-machine",
        kind: "washing-machine",
        localX: -0.8,
        localZ: 0,
        rotationY: 0,
        sizeM: [0.9, 0.92, 0.82],
      },
      {
        color: 0xcb9f68,
        id: "compact-sofa",
        kind: "sofa",
        localX: 0.9,
        localZ: 0.16,
        rotationY: 0.12,
        sizeM: [1.9, 1.02, 0.92],
      },
    ],
  },
] as const;

function material(color: number, roughness = 0.74): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness: 0.04, roughness });
}

function box(
  parent: Object3D,
  name: string,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  color: number,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), material(color));
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.schwellenraumSolid = true;
  mesh.userData.schwellenraumStatic = true;
  parent.add(mesh);
  return mesh;
}

function createSofa(profile: SchwellenraumStaticProp): Group {
  const [width, height, depth] = profile.sizeM;
  const group = new Group();
  const tone = profile.color;
  box(
    group,
    `${profile.id} seat`,
    [width * 0.78, height * 0.3, depth * 0.72],
    [0, height * 0.38, 0.08],
    tone,
  );
  box(
    group,
    `${profile.id} back`,
    [width * 0.78, height * 0.62, depth * 0.2],
    [0, height * 0.63, -depth * 0.34],
    tone,
  );
  for (const side of [-1, 1]) {
    box(
      group,
      `${profile.id} arm ${side}`,
      [width * 0.11, height * 0.56, depth * 0.88],
      [side * width * 0.445, height * 0.36, 0],
      tone,
    );
  }
  return group;
}

function createChair(profile: SchwellenraumStaticProp): Group {
  const [width, height, depth] = profile.sizeM;
  const group = new Group();
  box(
    group,
    `${profile.id} seat`,
    [width, 0.14, depth * 0.82],
    [0, height * 0.47, 0.05],
    profile.color,
  );
  box(
    group,
    `${profile.id} back`,
    [width, height * 0.5, 0.12],
    [0, height * 0.72, -depth * 0.37],
    profile.color,
  );
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      box(
        group,
        `${profile.id} leg ${x}:${z}`,
        [0.1, height * 0.46, 0.1],
        [x * width * 0.38, height * 0.23, z * depth * 0.32],
        0x796d5d,
      );
    }
  }
  return group;
}

function createSideTable(profile: SchwellenraumStaticProp): Group {
  const [width, height, depth] = profile.sizeM;
  const group = new Group();
  box(group, `${profile.id} top`, [width, 0.1, depth], [0, height - 0.05, 0], profile.color);
  const stem = new Mesh(
    new CylinderGeometry(0.07, 0.09, height - 0.1, 12),
    material(0x8a7963, 0.54),
  );
  stem.name = `${profile.id} stem`;
  stem.position.y = (height - 0.1) / 2;
  stem.userData.schwellenraumSolid = true;
  stem.userData.schwellenraumStatic = true;
  group.add(stem);
  return group;
}

function createFloorLamp(profile: SchwellenraumStaticProp): Group {
  const [width, height] = profile.sizeM;
  const group = new Group();
  const stem = new Mesh(
    new CylinderGeometry(0.035, 0.05, height * 0.76, 10),
    material(0x8d826f, 0.45),
  );
  stem.name = `${profile.id} fixed stem`;
  stem.position.y = height * 0.38;
  stem.userData.schwellenraumSolid = true;
  stem.userData.schwellenraumStatic = true;
  group.add(stem);
  const shadeMaterial = material(profile.color, 0.92);
  shadeMaterial.emissive.setHex(0xffd58a);
  shadeMaterial.emissiveIntensity = 0.42;
  const shade = new Mesh(
    new CylinderGeometry(
      width * 0.32,
      width * 0.48,
      height * 0.24,
      20,
      1,
      true,
    ),
    shadeMaterial,
  );
  shade.name = `${profile.id} fixed opaline shade`;
  shade.position.y = height * 0.86;
  shade.userData.schwellenraumSolid = true;
  shade.userData.schwellenraumStatic = true;
  group.add(shade);
  return group;
}

function createAppliance(profile: SchwellenraumStaticProp): Group {
  const [width, height, depth] = profile.sizeM;
  const group = new Group();
  box(group, `${profile.id} cabinet`, [width, height, depth], [0, height / 2, 0], profile.color);
  if (profile.kind === "washing-machine") {
    const drum = new Mesh(
      new CylinderGeometry(width * 0.25, width * 0.25, 0.035, 28),
      material(0x6e7f81, 0.34),
    );
    drum.name = `${profile.id} fixed drum window`;
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0, height * 0.49, depth / 2 + 0.025);
    drum.userData.schwellenraumStatic = true;
    group.add(drum);
  } else {
    box(
      group,
      `${profile.id} lower door seam`,
      [width * 0.82, 0.025, 0.025],
      [0, height * 0.36, depth / 2 + 0.02],
      0x8f8577,
    );
  }
  return group;
}

function createProp(profile: SchwellenraumStaticProp): Group {
  const group =
    profile.kind === "sofa"
      ? createSofa(profile)
      : profile.kind === "chair"
        ? createChair(profile)
        : profile.kind === "side-table"
          ? createSideTable(profile)
          : profile.kind === "floor-lamp"
            ? createFloorLamp(profile)
            : createAppliance(profile);
  group.name = `Schwellenraum fixed ${profile.kind} ${profile.id}`;
  group.position.set(profile.localX, 0, profile.localZ);
  group.rotation.y = profile.rotationY;
  group.userData.schwellenraumSolid = true;
  group.userData.schwellenraumStatic = true;
  return group;
}

function vignetteRadius(profile: SchwellenraumStaticVignette): number {
  return Math.max(
    ...profile.props.map(
      (prop) =>
        Math.hypot(prop.localX, prop.localZ) +
        Math.hypot(prop.sizeM[0], prop.sizeM[2]) / 2,
    ),
  );
}

/** Adds each safe vignette directly below the guarded presentation root. */
export function installSchwellenraumStaticProps(
  root: Group,
  groundAt: GroundAt,
): number {
  if (root.userData.schwellenraumStaticPropsInstalled === true) return 0;
  let installed = 0;
  for (const profile of SCHWELLENRAUM_STATIC_VIGNETTES) {
    const ground = groundAt(profile.x, profile.z);
    if (ground === null || !Number.isFinite(ground)) continue;
    const vignette = new Group();
    vignette.name = `Schwellenraum feste Requisiten ${profile.name}`;
    vignette.position.set(profile.x, ground + 0.08, profile.z);
    vignette.rotation.y = profile.rotationY;
    vignette.userData.schwellenraumPraesentation = true;
    vignette.userData.schwellenraumStatic = true;
    vignette.userData.schutzradiusM = vignetteRadius(profile);
    vignette.userData.sourceContract = [
      "Fixed display furniture on the committed open-data terrain;",
      "dimensions are restrained presentation approximations",
    ].join(" ");
    for (const prop of profile.props) vignette.add(createProp(prop));
    root.add(vignette);
    installed += profile.props.length;
  }
  root.userData.schwellenraumStaticPropsInstalled = true;
  root.userData.schwellenraumStaticPropCount = installed;
  return installed;
}

function worldPropCenter(
  vignette: SchwellenraumStaticVignette,
  prop: SchwellenraumStaticProp,
): readonly [number, number] {
  const cosine = Math.cos(vignette.rotationY);
  const sine = Math.sin(vignette.rotationY);
  return [
    vignette.x + cosine * prop.localX + sine * prop.localZ,
    vignette.z - sine * prop.localX + cosine * prop.localZ,
  ];
}

export type SchwellenraumStaticPropCollision = (
  x: number,
  y: number,
  z: number,
  radius?: number,
) => boolean;

/** Compile the sparse props once; navigation then performs no terrain lookup. */
export function createSchwellenraumStaticPropCollision(
  groundAt: GroundAt,
  protection?: SchwellenraumMemorialProtectionIndex,
): SchwellenraumStaticPropCollision {
  const solids: Array<{
    centerX: number;
    centerZ: number;
    cosine: number;
    depth: number;
    ground: number;
    height: number;
    sine: number;
    width: number;
  }> = [];
  for (const vignette of SCHWELLENRAUM_STATIC_VIGNETTES) {
    if (
      protection &&
      schwellenraumProtectedMemorialClearanceM(
        protection,
        vignette.x,
        vignette.z,
      ) <=
        vignetteRadius(vignette) + 2
    ) {
      continue;
    }
    const vignetteGround = groundAt(vignette.x, vignette.z);
    if (vignetteGround === null || !Number.isFinite(vignetteGround)) continue;
    for (const prop of vignette.props) {
      const [centerX, centerZ] = worldPropCenter(vignette, prop);
      const [width, height, depth] = prop.sizeM;
      const angle = vignette.rotationY + prop.rotationY;
      solids.push({
        centerX,
        centerZ,
        cosine: Math.cos(angle),
        depth,
        ground: vignetteGround,
        height,
        sine: Math.sin(angle),
        width,
      });
    }
  }
  return (x, y, z, radius = 0) => {
    for (const solid of solids) {
      if (
        y + radius < solid.ground ||
        y - radius > solid.ground + solid.height
      ) {
        continue;
      }
      const dx = x - solid.centerX;
      const dz = z - solid.centerZ;
      const localX = solid.cosine * dx - solid.sine * dz;
      const localZ = solid.sine * dx + solid.cosine * dz;
      if (
        Math.abs(localX) <= solid.width / 2 + radius &&
        Math.abs(localZ) <= solid.depth / 2 + radius
      ) {
        return true;
      }
    }
    return false;
  };
}

/** Analytic solid contract shared by pedestrian and free-flight collision. */
export function schwellenraumStaticPropSolidAt(
  x: number,
  y: number,
  z: number,
  radius: number | undefined,
  groundAt: GroundAt,
  protection?: SchwellenraumMemorialProtectionIndex,
): boolean {
  return createSchwellenraumStaticPropCollision(groundAt, protection)(
    x,
    y,
    z,
    radius,
  );
}
