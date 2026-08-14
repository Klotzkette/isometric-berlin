import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PlaneGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  markArchitecturalInk,
} from "./architecturalInk";
import { createLetteringTexture } from "./drawnLettering";
import {
  addBox,
  addCylinder,
  createBuilder,
  finishDrawnGroup,
} from "./drawnKit";

const CHARCOAL_STONE = 0x454a48;
const DARK_FRAME = 0x252c2b;
const WARM_INTERIOR = 0xe6c794;
const PAVING = 0xc8c5bc;
const STEEL = 0x737b79;
const SIGN_RED = 0xdf493d;

/**
 * Metric shell evidence and bounded recognition details for the existing
 * Berlin-Pavillon on Scheidemannstrasse. This is not the proposed future
 * Bundestag visitor centre: all exact dimensions below belong to the four
 * current LoD2 parts, while shop fittings remain photo-bounded estimates.
 */
export const BERLIN_PAVILLON_PROFILE = {
  address: "Scheidemannstrasse 1, 10557 Berlin",
  cafeChairCount: 12,
  cafeTableCount: 4,
  facadeAnchorWorld: [156.05, 144.35] as const,
  facadeHeightM: 5.75,
  facadeRotationY: -0.0345,
  facadeWidthM: 19.55,
  footprintAreaM2: 599.35,
  footprintBoundsEpsg25833: [
    389645.692, 5819824.573, 389668.234, 5819855.29,
  ] as const,
  footprintDepthM: 30.717,
  footprintWidthM: 22.542,
  geometryStatus:
    "Berlin LoD2 fixes the existing four-part shell, centroid and measured heights; storefront bays, merchandise, restaurant fittings and terrace furniture are bounded visual-reference approximations",
  glassPaneCount: 20,
  groundY: 4.7,
  landmarkWorld: [157.11971173324855, 8, 160.52018948458135] as const,
  lod2HeightRangeM: [4.586, 6.342] as const,
  lod2ParentBuildingId: "DEBE01YYK0002Pvf",
  lod2PartIds: [
    "DEBE3DNLloEussQR",
    "DEBE3DDgAhATwErH",
    "DEBE3DgrmxDq2ssM",
    "DEBE3DdXH5BzPXTO",
  ] as const,
  outdoorChairCount: 15,
  outdoorTableCount: 5,
  pedestrianBollardCount: 16,
  postcardRackCount: 2,
  souvenirObjectCount: 60,
  sourceCentroidEpsg25833: [389657.11971173325, 5819839.479810515] as const,
  terraceCanopyCount: 2,
  visualReferences: [
    {
      artist: "Roy Zuo",
      license: "CC BY-SA 4.0",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:Souvenir_shop_and_restaurant_at_Bundestag,_Scheidemannstra%C3%9Fe,_24-05-2025.jpg",
      role: "current 2025 north-front glazing, signs, shop and terrace QA",
    },
    {
      artist: "Triebkraft",
      license: "CC BY-SA 3.0",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:Berlin-Pavillon_(Scheidemannstra%C3%9Fe).jpg",
      role: "secondary facade-proportion QA",
    },
  ],
} as const;

function addFacadeFrame(): Group | null {
  const builder = createBuilder();
  const halfWidth = BERLIN_PAVILLON_PROFILE.facadeWidthM / 2;

  addBox(builder, CHARCOAL_STONE, 0, 5.18, 0, 19.55, 1.14, 0.42);
  addBox(builder, CHARCOAL_STONE, -halfWidth + 0.35, 2.52, 0, 0.7, 4.28, 0.42);
  addBox(builder, CHARCOAL_STONE, halfWidth - 0.35, 2.52, 0, 0.7, 4.28, 0.42);
  addBox(builder, CHARCOAL_STONE, -0.75, 2.52, 0, 1.05, 4.28, 0.42);
  addBox(builder, DARK_FRAME, 0, 0.24, -0.18, 19.05, 0.22, 0.2);

  for (const x of [-8.4, -6.65, -4.9, -3.15, 0.55, 2.35, 4.15, 5.95, 7.75]) {
    addBox(builder, DARK_FRAME, x, 2.55, -0.25, 0.105, 4.25, 0.12, 0, false);
  }
  addBox(builder, DARK_FRAME, 0, 2.32, -0.25, 18.85, 0.11, 0.12, 0, false);
  addBox(builder, DARK_FRAME, 0, 4.24, -0.25, 18.85, 0.12, 0.12, 0, false);

  // The pavement and shallow entrance threshold stop the facade from floating
  // above the exact 4.7 m LoD2 ground sample.
  addBox(builder, PAVING, 0, 0.055, -1.12, 20.8, 0.11, 2.05, 0, false);
  addBox(builder, 0x868781, -0.75, 0.105, -1.74, 2.15, 0.2, 0.72);

  // Two freestanding menu boards appear in the 2025 street view.
  for (const [x, z] of [
    [-1.55, -2.25],
    [0.55, -2.45],
  ] as const) {
    addBox(builder, 0x343a39, x, 0.96, z, 0.72, 1.72, 0.1, 0.08);
    addBox(
      builder,
      0xe9e1cf,
      x,
      0.98,
      z - 0.06,
      0.54,
      1.34,
      0.035,
      0.08,
      false,
    );
  }

  for (
    let index = 0;
    index < BERLIN_PAVILLON_PROFILE.pedestrianBollardCount;
    index += 1
  ) {
    const x = -11.2 + index * 1.92;
    addCylinder(builder, STEEL, x, 0.48, -3.1, 0.075, 0.96, 8);
    addCylinder(builder, 0xb8bbb5, x, 0.96, -3.1, 0.095, 0.08, 8);
  }

  return finishDrawnGroup(builder, {
    name: "Berlin Pavillon photo-bounded facade",
  });
}

function addSouvenirRack(
  builder: ReturnType<typeof createBuilder>,
  x: number,
  z: number,
): void {
  addCylinder(builder, 0x3c4443, x, 1.15, z, 0.065, 2.15, 8);
  addCylinder(builder, 0x747c79, x, 0.18, z, 0.42, 0.08, 12);
  const colours = [0xd94b3e, 0x397cb1, 0xe2bc46, 0x72a15f, 0xf0e5ca, 0x9a67a5];
  for (let level = 0; level < 2; level += 1) {
    for (let card = 0; card < 6; card += 1) {
      const angle = (card / 6) * Math.PI * 2;
      addBox(
        builder,
        colours[(level * 3 + card) % colours.length],
        x + Math.cos(angle) * 0.32,
        0.88 + level * 0.72,
        z + Math.sin(angle) * 0.32,
        0.28,
        0.45,
        0.035,
        -angle,
        false,
      );
    }
  }
}

function createInterior(): Group | null {
  const builder = createBuilder();
  addBox(builder, 0x252a29, 0, 0.14, 0.16, 18.65, 0.2, 2.55, 0, false);
  addBox(builder, 0x303634, 0, 4.52, 0.15, 18.65, 0.14, 2.5, 0, false);

  // Souvenir shop: three shelf courses, sixty small deterministic objects,
  // two postcard drums and a compact garment rail. Nothing uses photo pixels.
  for (const y of [0.65, 1.45, 2.25]) {
    addBox(builder, 0x565e5b, -5.6, y, 0.92, 6.1, 0.09, 0.55, 0, false);
  }
  const colours = [
    0xd55445, 0x397cb1, 0xe8c14c, 0x74a662, 0xd889a1, 0xede1c6, 0x4e868a,
    0x9a6aae, 0xe8843d, 0x6a78a6,
  ];
  for (
    let index = 0;
    index < BERLIN_PAVILLON_PROFILE.souvenirObjectCount;
    index += 1
  ) {
    const column = index % 10;
    const row = Math.floor(index / 10) % 3;
    const front = Math.floor(index / 30);
    addBox(
      builder,
      colours[index % colours.length],
      -8.15 + column * 0.57,
      0.46 + row * 0.8,
      0.62 + front * 0.42,
      0.31,
      0.46 + (index % 3) * 0.05,
      0.18,
      0,
      false,
    );
  }
  addSouvenirRack(builder, -3.3, -0.02);
  addSouvenirRack(builder, -1.95, -0.02);
  addBox(builder, DARK_FRAME, -7.1, 1.55, -0.05, 3.4, 0.1, 0.1, 0, false);
  for (let index = 0; index < 8; index += 1) {
    addBox(
      builder,
      colours[(index + 2) % colours.length],
      -8.45 + index * 0.4,
      1.14,
      -0.07,
      0.3,
      0.75,
      0.08,
      0,
      false,
    );
  }

  // Restaurant side: counter, four indoor tables, twelve chairs and warm
  // ceiling lights remain visible through the full-height glazing at night.
  addBox(builder, 0x82674d, 7.65, 1.0, 0.62, 2.15, 1.72, 0.68);
  addBox(builder, 0xd0b88d, 7.65, 1.91, 0.62, 2.3, 0.12, 0.82);
  const tableCentres = [
    [1.2, 0.52],
    [3.25, 0.52],
    [5.25, 0.52],
    [3.3, -0.42],
  ] as const;
  for (const [x, z] of tableCentres) {
    addCylinder(builder, 0x353b3a, x, 0.5, z, 0.075, 0.88, 8);
    addCylinder(builder, 0xc4a77f, x, 0.96, z, 0.58, 0.08, 16);
    for (const offset of [-0.74, 0.74]) {
      addBox(builder, 0x343a39, x + offset, 0.52, z, 0.48, 0.08, 0.48);
      addBox(builder, 0x343a39, x + offset, 0.82, z + 0.2, 0.48, 0.62, 0.08);
    }
  }
  // Four extra chairs at the two outer tables complete the photographed cafe
  // density while staying below the 20-person whole-scene budget.
  for (const x of [1.2, 5.25]) {
    for (const z of [-0.25, 1.27]) {
      addBox(builder, 0x343a39, x, 0.52, z, 0.48, 0.08, 0.48);
      addBox(builder, 0x343a39, x + 0.2, 0.82, z, 0.08, 0.62, 0.48);
    }
  }
  for (const x of [-7.8, -5.6, -3.4, 1.15, 3.45, 5.75, 7.8]) {
    addCylinder(builder, WARM_INTERIOR, x, 4.31, 0.15, 0.16, 0.08, 12, true);
  }

  const interior = finishDrawnGroup(builder, {
    lampEmissive: 0xffc56b,
    lampEmissiveIntensity: 1.15,
    name: "Berlin Pavillon visible souvenir and cafe interior",
  });
  const bodies = interior?.getObjectByName(
    "Berlin Pavillon visible souvenir and cafe interior bodies",
  ) as Mesh | undefined;
  if (bodies) {
    bodies.userData.nightMaterial = new MeshBasicMaterial({
      color: 0xffd69a,
      vertexColors: true,
    });
  }
  return interior;
}

function createGlass(): Mesh {
  const geometries: BufferGeometry[] = [];
  const paneWidth = 1.64;
  const columns = BERLIN_PAVILLON_PROFILE.glassPaneCount / 2;
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const geometry = new PlaneGeometry(paneWidth, 1.79);
      geometry.translate(-8.38 + column * 1.86, 1.29 + row * 1.91, -0.46);
      geometries.push(geometry);
    }
  }
  const merged = mergeGeometries(geometries, false);
  if (!merged) throw new Error("Berlin Pavillon glazing could not be merged");
  for (const geometry of geometries) geometry.dispose();
  const dayMaterial = new MeshPhysicalMaterial({
    color: 0x96c4c6,
    depthWrite: false,
    metalness: 0,
    opacity: 0.27,
    roughness: 0.18,
    side: DoubleSide,
    transparent: true,
  });
  const nightMaterial = new MeshPhysicalMaterial({
    color: 0x688d8e,
    depthWrite: false,
    emissive: 0x1c2929,
    emissiveIntensity: 0.18,
    metalness: 0,
    opacity: 0.22,
    roughness: 0.22,
    side: DoubleSide,
    transparent: true,
  });
  const glass = new Mesh(merged, dayMaterial);
  glass.name = "Berlin Pavillon transparent storefront glazing";
  glass.renderOrder = 8;
  glass.userData = {
    antiFlicker:
      "glazing is 0.21 m forward of merchandise, depthWrite=false, stable renderOrder=8",
    dayMaterial,
    nightMaterial,
    paneCount: BERLIN_PAVILLON_PROFILE.glassPaneCount,
  };
  return glass;
}

function canopyGeometry(width: number, depth: number): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        -width / 2,
        0.1,
        -depth / 2,
        width / 2,
        0.1,
        -depth / 2,
        width / 2 - 0.65,
        -0.28,
        depth / 2,
        -width / 2 + 0.65,
        -0.28,
        depth / 2,
      ],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function createTerrace(): Group {
  const group = new Group();
  group.name = "Berlin Pavillon shaded restaurant terrace";
  const builder = createBuilder();
  for (const x of [11.1, 17.1]) {
    addCylinder(builder, 0x515957, x, 1.72, 0.6, 0.075, 3.44, 10);
  }
  const tableCentres = [10.7, 12.9, 15.1, 17.3, 19.5];
  for (const x of tableCentres) {
    addCylinder(builder, 0x3e4543, x, 0.46, 0.25, 0.07, 0.86, 8);
    addCylinder(builder, 0xb18b61, x, 0.92, 0.25, 0.52, 0.08, 14);
    for (let chair = 0; chair < 3; chair += 1) {
      const angle = (chair / 3) * Math.PI * 2;
      addBox(
        builder,
        0x343a39,
        x + Math.cos(angle) * 0.76,
        0.5,
        0.25 + Math.sin(angle) * 0.76,
        0.42,
        0.08,
        0.42,
        -angle,
      );
      addBox(
        builder,
        0x343a39,
        x + Math.cos(angle) * 0.92,
        0.82,
        0.25 + Math.sin(angle) * 0.92,
        0.42,
        0.56,
        0.07,
        -angle,
      );
    }
  }
  addCylinder(builder, 0x9b7b56, 20.55, 0.58, 0.15, 0.52, 1.16, 14);
  addCylinder(builder, 0xe5d7b4, 20.55, 1.16, 0.15, 0.55, 0.08, 14);
  const furniture = finishDrawnGroup(builder, {
    name: "Berlin Pavillon terrace furniture",
  });
  if (furniture) group.add(furniture);

  for (const x of [13.0, 17.3]) {
    const geometry = canopyGeometry(5.4, 4.7);
    const dayMaterial = new MeshBasicMaterial({
      color: 0xd8d7cc,
      side: DoubleSide,
    });
    const nightMaterial = new MeshBasicMaterial({
      color: 0xb5b5ad,
      side: DoubleSide,
    });
    const canopy = new Mesh(geometry, dayMaterial);
    canopy.name = "Berlin Pavillon light tensile terrace canopy";
    canopy.position.set(x, 3.42, 0.55);
    canopy.userData.dayMaterial = dayMaterial;
    canopy.userData.nightMaterial = nightMaterial;
    group.add(canopy);
    const edges = new LineSegments(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
      markArchitecturalInk(new LineBasicMaterial(), "detail"),
    );
    edges.name = "Berlin Pavillon canopy ink lines";
    edges.position.copy(canopy.position);
    edges.renderOrder = 2;
    group.add(edges);
  }
  group.userData.canopyCount = BERLIN_PAVILLON_PROFILE.terraceCanopyCount;
  return group;
}

function createSign(
  name: string,
  text: string,
  width: number,
  x: number,
): Mesh {
  const height = 0.62;
  const texture = createLetteringTexture({
    bandHeightM: height,
    bandWidthM: width,
    capHeightM: 0.39,
    fieldColor: "rgba(0,0,0,0)",
    letterColor: "#df493d",
    text,
    texelsPerMetre: 260,
  });
  const dayMaterial = texture
    ? new MeshBasicMaterial({
        map: texture,
        side: DoubleSide,
        transparent: true,
      })
    : new MeshBasicMaterial({ color: SIGN_RED, side: DoubleSide });
  const nightMaterial = texture
    ? new MeshBasicMaterial({
        color: 0xffb49e,
        map: texture,
        side: DoubleSide,
        transparent: true,
      })
    : new MeshBasicMaterial({ color: 0xff735f, side: DoubleSide });
  const sign = new Mesh(new PlaneGeometry(width, height), dayMaterial);
  sign.name = name;
  sign.position.set(x, 3.62, -0.59);
  sign.rotation.y = Math.PI;
  sign.renderOrder = 10;
  sign.userData = {
    dayMaterial,
    lettering: text,
    nightMaterial,
    visualReference: BERLIN_PAVILLON_PROFILE.visualReferences[0].pageUrl,
  };
  return sign;
}

export function createBerlinPavillon(): Group {
  const group = new Group();
  group.name = "LoD2-anchored Berlin Pavillon visitor and souvenir centre";
  group.position.set(
    BERLIN_PAVILLON_PROFILE.facadeAnchorWorld[0],
    BERLIN_PAVILLON_PROFILE.groundY,
    BERLIN_PAVILLON_PROFILE.facadeAnchorWorld[1],
  );
  group.rotation.y = BERLIN_PAVILLON_PROFILE.facadeRotationY;
  group.userData = {
    geometryStatus: BERLIN_PAVILLON_PROFILE.geometryStatus,
    keepInMinecraft: true,
    profile: BERLIN_PAVILLON_PROFILE,
  };

  const facade = addFacadeFrame();
  if (facade) group.add(facade);
  const interior = createInterior();
  if (interior) group.add(interior);
  group.add(createGlass());
  group.add(createTerrace());
  group.add(createSign("Berlin Pavillon cafe lettering", "CAFE", 1.7, -8));
  group.add(
    createSign("Berlin Pavillon name lettering", "BERLIN PAVILLON", 5.2, -2.8),
  );
  group.add(
    createSign("Berlin Pavillon restaurant lettering", "RESTAURANT", 4.4, 5.7),
  );
  return group;
}
