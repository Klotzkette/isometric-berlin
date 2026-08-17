import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  addBox,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
  type Builder,
} from "./drawnKit";

export const KINDERTRANSPORT_MEMORIAL_OSM_KEY = "node/8912152881";

const BILDHAUEREI_IN_BERLIN_PAGE =
  "https://bildhauerei-in-berlin.de/bildwerk/denkmal-zur-erinnerung-an-die-kindertransporte-und-die-deportation-von-kindern-1938-1945-5234/";

export const KINDERTRANSPORT_VISUAL_REFERENCES = [
  "MIT_095_1_Pauline_Ahrens_2021.jpg",
  "MIT_095_3_Pauline_Ahrens_2021.jpg",
  "MIT_095_6_Pauline_Ahrens_2021.jpg",
  "MIT_095_7_Pauline_Ahrens_2021.jpg",
  "MIT_095_13_Pauline_Ahrens_2021.jpg",
].map((title) => ({
  artist: "Pauline Ahrens",
  credit: "Foto: Pauline Ahrens, 2021, CC BY 4.0 · Bildhauerei in Berlin",
  fileUrl: `https://bildhauerei-in-berlin.de/wp-content/uploads/${title}`,
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  pageUrl: BILDHAUEREI_IN_BERLIN_PAGE,
  role: "reference-only; photograph and texture are not bundled",
  title,
  year: 2021,
}));

/**
 * OSM fixes the point. Berlin's sculpture inventory fixes the seven figures,
 * their two opposing groups, materials and attributes. The 3 x 2 m overall
 * extent and 2.25 m catalogue height are published values. Individual figure,
 * luggage and stepped-base proportions are bounded display estimates read
 * from the CC BY 4.0 inventory views, never described as a survey.
 */
export const KINDERTRANSPORT_MEMORIAL_PROFILE = {
  artists: ["Frank Meisler", "Arie Ovadia"] as const,
  collisionHalfExtentsM: [1.88, 1.38] as const,
  completionYear: 2008,
  deathGroupCount: 5,
  deathGroupFacing: "east",
  documentedOverallDepthM: 2,
  documentedOverallLengthM: 3,
  groundYM: 3.5,
  lifeGroupCount: 2,
  lifeGroupFacing: "west",
  name: "Denkmal zur Erinnerung an Kindertransporte",
  principalArtist: "Frank Meisler",
  osmKey: KINDERTRANSPORT_MEMORIAL_OSM_KEY,
  overallHeightM: 2.25,
  photoDerivedMainBaseDepthM: 1.44,
  photoDerivedMainBaseLengthM: 2.98,
  rotationY: (-1.02 * Math.PI) / 180,
  sourceUrls: [
    BILDHAUEREI_IN_BERLIN_PAGE,
    "https://www.berlin.de/aktuell/ausgaben/2009/juni/ereignisse/artikel.224008.php",
    "https://taz.de/Denkmal-fuer-Kindertransporte/!786139/",
    "https://www.auswaertiges-amt.de/de/newsroom/roth-kindertransporte-691560",
    "https://www.deutschlandfunkkultur.de/zuege-ins-leben-100.html",
    "https://cja.huji.ac.il/browser.php?id=50463&mode=set",
    "https://www.stiftung-denkmal.de/aktuelles/pressemitteilungen/trauer-um-holocaustueberlebenden-frank-meisler/",
    "https://commons.wikimedia.org/wiki/Category:Trains_to_Life,_Trains_to_Death_(memorial)",
    ...KINDERTRANSPORT_VISUAL_REFERENCES.map((reference) => reference.fileUrl),
  ],
  titleDe: "Züge in das Leben – Züge in den Tod 1938–1945",
  titleEn: "Trains to Life – Trains to Death",
  worldM: [1108.30716689, -80.77000113] as const,
  geometryStatus:
    "OSM-positioned presentation reconstruction: 3 x 2 m overall extent, 2.25 m height, seven figures and one north-side track are source-described; individual figure, luggage and stepped-base proportions are CC-BY-4.0 inventory-view-derived display estimates and are not surveyed geometry",
  visualReferences: KINDERTRANSPORT_VISUAL_REFERENCES,
} as const;

const GRANITE = 0x777a78;
const GRANITE_LIGHT = 0xa5a7a2;
const GRANITE_DARK = 0x5d615f;
const RAIL_STEEL = 0x454b4b;
const TITLE_BRONZE = 0x735541;
const DEATH_PATINA = 0x665f57;
const DEATH_PATINA_DARK = 0x4b4742;
const LIFE_PATINA = 0x9b583e;
const LIFE_PATINA_LIGHT = 0xb86d4c;
const LUGGAGE_BROWN = 0x6f4b39;
const LUGGAGE_DARK = 0x493a32;
const STAR_YELLOW = 0xc6a83b;

type ChildPose = {
  braid?: boolean;
  cap?: boolean;
  group: "death" | "life";
  hasBackpack?: boolean;
  hasCase?: boolean;
  hasSatchel?: boolean;
  hasStar?: boolean;
  hasToy?: boolean;
  headPitch?: number;
  heightM: number;
  name: string;
  stepM?: number;
  x: number;
  z: number;
};

const CHILDREN: readonly ChildPose[] = [
  {
    group: "death",
    hasStar: true,
    headPitch: -0.16,
    heightM: 1.69,
    name: "large long-haired girl with star",
    x: 0.63,
    z: -0.38,
  },
  {
    braid: true,
    group: "death",
    headPitch: -0.2,
    heightM: 1.78,
    name: "large centre girl with braid",
    x: 0.82,
    z: 0.18,
  },
  {
    group: "death",
    hasSatchel: true,
    headPitch: -0.17,
    heightM: 1.63,
    name: "older boy with satchel",
    x: 1.02,
    z: -0.24,
  },
  {
    cap: true,
    group: "death",
    headPitch: -0.13,
    heightM: 1.28,
    name: "small boy with cap",
    stepM: 0.08,
    x: 0.94,
    z: 0.55,
  },
  {
    group: "death",
    headPitch: 0.09,
    heightM: 1.02,
    name: "small child looking aside",
    x: 1.19,
    z: 0.1,
  },
  {
    group: "life",
    hasCase: true,
    heightM: 1.72,
    name: "boy walking west with large case",
    stepM: 0.15,
    x: -1.04,
    z: 0.25,
  },
  {
    group: "life",
    hasBackpack: true,
    hasSatchel: true,
    hasToy: true,
    heightM: 1.42,
    name: "girl walking west with toy",
    stepM: 0.08,
    x: -0.77,
    z: -0.34,
  },
] as const;

function addGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  inked = true,
): void {
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function addSegment(
  builder: Builder,
  color: number,
  start: Vector3,
  end: Vector3,
  radius: number,
  inked = false,
): void {
  const direction = end.clone().sub(start);
  const geometry = new CylinderGeometry(
    radius * 0.88,
    radius,
    direction.length(),
    7,
  );
  geometry.applyQuaternion(
    new Group().quaternion.setFromUnitVectors(
      new Vector3(0, 1, 0),
      direction.clone().normalize(),
    ),
  );
  geometry.translate(...start.clone().add(end).multiplyScalar(0.5).toArray());
  addGeometry(builder, geometry, color, inked);
}

function addSphere(
  builder: Builder,
  color: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  scale: readonly [number, number, number] = [1, 1, 1],
): void {
  const geometry = new SphereGeometry(radius, 10, 7);
  geometry.scale(...scale);
  geometry.translate(x, y, z);
  addGeometry(builder, geometry, color, false);
}

function addChild(builder: Builder, pose: ChildPose): void {
  const saved = pose.group === "life";
  const bronze = saved ? LIFE_PATINA : DEATH_PATINA;
  const darkBronze = saved ? LIFE_PATINA_LIGHT : DEATH_PATINA_DARK;
  const forward = saved ? -1 : 1;
  const baseY = 0.45;
  const height = pose.heightM;
  const scale = height / 1.7;
  const headRadius = 0.135 * scale;
  const shoulderY = baseY + height * 0.69;
  const hipY = baseY + height * 0.36;
  const headY = baseY + height - headRadius;
  const step = pose.stepM ?? 0;

  // Separately placed feet, legs and arms preserve the stiff walking poses
  // visible in the inventory views instead of reducing each child to a post.
  for (const side of [-1, 1]) {
    const sideZ = pose.z + side * 0.095 * scale;
    const footX = pose.x + forward * (side === 1 ? step : -step * 0.45);
    addBox(
      builder,
      darkBronze,
      footX + forward * 0.045,
      baseY + 0.035,
      sideZ,
      0.19 * scale,
      0.07 * scale,
      0.095 * scale,
      0,
      false,
    );
    addSegment(
      builder,
      bronze,
      new Vector3(footX, baseY + 0.08 * scale, sideZ),
      new Vector3(
        pose.x + forward * (side === 1 ? 0.025 : -0.015),
        hipY,
        pose.z + side * 0.07 * scale,
      ),
      0.055 * scale,
    );
  }

  const coat = new CylinderGeometry(
    0.18 * scale,
    0.245 * scale,
    shoulderY - hipY + 0.18 * scale,
    9,
  );
  coat.translate(pose.x, (shoulderY + hipY) / 2 - 0.015, pose.z);
  addGeometry(builder, coat, bronze);

  for (const side of [-1, 1]) {
    const shoulder = new Vector3(
      pose.x,
      shoulderY - 0.05 * scale,
      pose.z + side * 0.175 * scale,
    );
    const hand = new Vector3(
      pose.x + forward * (0.05 + (side === 1 ? step : 0)),
      hipY + 0.03 * scale,
      pose.z + side * 0.22 * scale,
    );
    addSegment(builder, bronze, shoulder, hand, 0.045 * scale);
    addSphere(builder, bronze, hand.x, hand.y, hand.z, 0.052 * scale);
  }

  const neckY = headY - headRadius * 1.05;
  addSegment(
    builder,
    bronze,
    new Vector3(pose.x, shoulderY + 0.06 * scale, pose.z),
    new Vector3(pose.x, neckY, pose.z),
    0.055 * scale,
  );
  const faceX = pose.x + forward * (pose.headPitch ?? 0) * 0.11;
  addSphere(
    builder,
    bronze,
    faceX,
    headY,
    pose.z,
    headRadius,
    [0.88, 1.08, 0.92],
  );
  addSphere(
    builder,
    darkBronze,
    faceX - forward * headRadius * 0.16,
    headY + headRadius * 0.33,
    pose.z,
    headRadius * 0.96,
    [0.82, 0.56, 1],
  );
  addSphere(
    builder,
    bronze,
    faceX + forward * headRadius * 0.82,
    headY - headRadius * 0.02,
    pose.z,
    headRadius * 0.16,
    [1.25, 0.7, 0.7],
  );

  if (pose.cap) {
    const cap = new CylinderGeometry(
      headRadius * 1.02,
      headRadius * 1.1,
      0.065 * scale,
      10,
    );
    cap.translate(faceX, headY + headRadius * 0.78, pose.z);
    addGeometry(builder, cap, darkBronze, false);
    addBox(
      builder,
      darkBronze,
      faceX + forward * headRadius * 0.8,
      headY + headRadius * 0.74,
      pose.z,
      0.14 * scale,
      0.025 * scale,
      0.13 * scale,
      0,
      false,
    );
  }
  if (pose.braid) {
    for (let index = 0; index < 5; index += 1) {
      addSphere(
        builder,
        darkBronze,
        faceX - forward * (headRadius * 0.7 + index * 0.025 * scale),
        headY - headRadius * (0.2 + index * 0.32),
        pose.z + 0.11 * scale,
        0.045 * scale,
      );
    }
  }
  if (pose.hasStar) {
    // The small yellow six-pointed chest badge is the source-described
    // identifying cue. Its word stays omitted at this physical map scale.
    const starShape = new Shape();
    for (let point = 0; point < 12; point += 1) {
      const angle = Math.PI / 2 + point * (Math.PI / 6);
      const radius = (point % 2 === 0 ? 0.075 : 0.038) * scale;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (point === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    starShape.closePath();
    const star = new ExtrudeGeometry(starShape, {
      bevelEnabled: false,
      depth: 0.014,
      steps: 1,
    });
    if (!star.index) {
      star.setIndex(
        Array.from(
          { length: star.getAttribute("position").count },
          (_, index) => index,
        ),
      );
    }
    star.translate(0, 0, -0.007);
    star.rotateY(Math.PI / 2);
    star.translate(
      pose.x + forward * 0.19 * scale,
      shoulderY - 0.13 * scale,
      pose.z - 0.07 * scale,
    );
    addGeometry(builder, star, STAR_YELLOW, false);
  }

  if (pose.hasBackpack) {
    addBox(
      builder,
      darkBronze,
      pose.x - forward * 0.19 * scale,
      shoulderY - 0.18 * scale,
      pose.z,
      0.16 * scale,
      0.38 * scale,
      0.36 * scale,
      0,
      false,
    );
  }
  if (pose.hasSatchel) {
    addBox(
      builder,
      darkBronze,
      pose.x + forward * 0.06,
      hipY + 0.02,
      pose.z - 0.28 * scale,
      0.28 * scale,
      0.26 * scale,
      0.12 * scale,
      0,
      true,
    );
  }
  if (pose.hasCase) {
    addSuitcase(
      builder,
      LIFE_PATINA,
      pose.x - 0.15,
      baseY + 0.31,
      pose.z - 0.38,
      0.68,
      0.56,
      0.18,
      -0.08,
    );
  }
  if (pose.hasToy) {
    const toyX = pose.x - 0.18;
    const toyY = hipY + 0.18;
    const toyZ = pose.z - 0.27;
    addSphere(builder, LIFE_PATINA_LIGHT, toyX, toyY, toyZ, 0.09);
    addSphere(
      builder,
      LIFE_PATINA_LIGHT,
      toyX - 0.04,
      toyY + 0.09,
      toyZ,
      0.055,
    );
    for (const side of [-1, 1]) {
      addSphere(
        builder,
        LIFE_PATINA_LIGHT,
        toyX - 0.045,
        toyY + 0.13,
        toyZ + side * 0.038,
        0.025,
      );
      addSegment(
        builder,
        LIFE_PATINA_LIGHT,
        new Vector3(toyX, toyY + 0.02, toyZ),
        new Vector3(toyX + 0.04, toyY - 0.04, toyZ + side * 0.05),
        0.018,
      );
    }
  }
}

function addSuitcase(
  builder: Builder,
  color: number,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  rotationY = 0,
): void {
  addBox(builder, color, x, y, z, width, height, depth, rotationY);
  const handle = new TorusGeometry(width * 0.12, 0.018, 5, 10, Math.PI);
  handle.rotateY(Math.PI / 2 + rotationY);
  handle.translate(x, y + height / 2 + width * 0.08, z);
  addGeometry(builder, handle, LUGGAGE_DARK, false);
}

function addStructure(builder: Builder): void {
  const profile = KINDERTRANSPORT_MEMORIAL_PROFILE;
  addBox(
    builder,
    GRANITE,
    0,
    0.04,
    0,
    profile.documentedOverallLengthM,
    0.08,
    profile.documentedOverallDepthM,
  );
  addBox(
    builder,
    GRANITE,
    0,
    0.24,
    0.24,
    profile.photoDerivedMainBaseLengthM,
    0.32,
    profile.photoDerivedMainBaseDepthM,
  );
  addBox(builder, GRANITE_LIGHT, 0, 0.425, 0.24, 2.9, 0.05, 1.34);

  // Fine end and side joints keep the granite-clad base readable as panels.
  for (const x of [-0.75, 0, 0.75]) {
    addBox(builder, GRANITE_DARK, x, 0.24, 0.965, 0.018, 0.27, 0.018, 0, false);
    addBox(
      builder,
      GRANITE_DARK,
      x,
      0.24,
      -0.485,
      0.018,
      0.27,
      0.018,
      0,
      false,
    );
  }

  // The source inventory describes one track on the station-facing north
  // side, not a decorative pair. Eight short sleepers fit the documented
  // three-metre overall envelope.
  const railZ = -0.84;
  for (let index = 0; index < 8; index += 1) {
    const x = -1.31 + index * (2.62 / 7);
    addBox(
      builder,
      GRANITE_DARK,
      x,
      0.125,
      railZ,
      0.075,
      0.075,
      0.38,
      0,
      false,
    );
  }
  addBox(builder, RAIL_STEEL, 0, 0.215, railZ, 2.88, 0.11, 0.075, 0, true);

  // A short title plate on one end and a larger donor plate opposite are the
  // two documented frontal cues; text stays abstract at this physical scale.
  addBox(builder, TITLE_BRONZE, 1.503, 0.24, 0.05, 0.025, 0.19, 0.62);
  addBox(builder, TITLE_BRONZE, -1.503, 0.24, 0.24, 0.025, 0.24, 0.92);
}

function addSeparatedLuggage(builder: Builder): void {
  const cases = [
    [-0.38, 0.66, -0.13, 0.62, 0.48, 0.18, -0.1],
    [-0.06, 0.58, 0.28, 0.46, 0.35, 0.17, 0.12],
    [0.21, 0.64, -0.35, 0.52, 0.45, 0.17, -0.04],
    [0.39, 0.57, 0.12, 0.42, 0.3, 0.15, 0.18],
    [0.58, 0.62, 0.4, 0.48, 0.4, 0.15, -0.2],
    [-0.5, 0.54, 0.43, 0.38, 0.27, 0.14, 0.08],
  ] as const;
  for (const [x, y, z, width, height, depth, rotationY] of cases) {
    addSuitcase(
      builder,
      LUGGAGE_BROWN,
      x,
      y,
      z,
      width,
      height,
      depth,
      rotationY,
    );
  }

  // One case is visibly torn/open. Its angled lid and the small broken doll
  // within keep the central separation legible without inventing an inscription.
  addBox(builder, LUGGAGE_DARK, 0.18, 0.79, -0.38, 0.49, 0.045, 0.27, -0.24);
  addSphere(builder, LIFE_PATINA_LIGHT, 0.16, 0.79, -0.38, 0.055);
  addSegment(
    builder,
    LIFE_PATINA_LIGHT,
    new Vector3(0.11, 0.76, -0.38),
    new Vector3(0.02, 0.69, -0.34),
    0.018,
  );

  // The long narrow case is the documented violin case behind the group.
  addBox(builder, LUGGAGE_DARK, 0.73, 0.59, -0.39, 0.72, 0.16, 0.24, -0.12);
}

function finishBatch(builder: Builder, name: string): Group {
  const group = finishDrawnGroup(builder, { name: "monument" });
  if (!group) throw new Error(`Empty Kindertransport memorial batch: ${name}`);
  group.name = name;
  return group;
}

export function createKindertransportMemorial(
  groundYM: number = KINDERTRANSPORT_MEMORIAL_PROFILE.groundYM,
): Group {
  const structure = createBuilder();
  const deathGroup = createBuilder();
  const lifeGroup = createBuilder();
  const luggage = createBuilder();
  addStructure(structure);
  for (const child of CHILDREN) {
    addChild(child.group === "death" ? deathGroup : lifeGroup, child);
  }
  addSeparatedLuggage(luggage);

  const profile = KINDERTRANSPORT_MEMORIAL_PROFILE;
  const memorial = new Group();
  memorial.name = profile.name;
  memorial.position.set(profile.worldM[0], groundYM, profile.worldM[1]);
  memorial.rotation.y = profile.rotationY;
  memorial.userData = {
    artists: profile.artists,
    completionYear: profile.completionYear,
    figureCounts: {
      deportedAndMurderedBoys: 3,
      deportedAndMurderedGirls: 2,
      deportedAndMurdered: profile.deathGroupCount,
      rescued: profile.lifeGroupCount,
      total: profile.deathGroupCount + profile.lifeGroupCount,
    },
    documentedOverallExtentM: [
      profile.documentedOverallLengthM,
      profile.documentedOverallDepthM,
    ],
    documentedOverallHeightM: profile.overallHeightM,
    endPlates: { sponsor: "west", title: "east" },
    geometryStatus: profile.geometryStatus,
    groundYM,
    luggageCount: 8,
    openSuitcaseCount: 1,
    opposingDirections: {
      deportedAndMurdered: profile.deathGroupFacing,
      rescued: profile.lifeGroupFacing,
    },
    osmKey: profile.osmKey,
    principalArtist: profile.principalArtist,
    railSleeperCount: 8,
    railSide: "north / station side",
    railStrandCount: 1,
    schwellenraumGeschuetzt: true,
    sourceUrls: profile.sourceUrls,
    titleDe: profile.titleDe,
    titleEn: profile.titleEn,
    visualReferences: profile.visualReferences,
  };
  memorial.add(
    finishBatch(
      structure,
      "Kindertransport granite base and single north-side rail",
    ),
    finishBatch(deathGroup, "Kindertransport five grey-brown children"),
    finishBatch(lifeGroup, "Kindertransport two red-brown children"),
    finishBatch(luggage, "Kindertransport separated luggage"),
  );
  return memorial;
}
