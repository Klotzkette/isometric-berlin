import {
  BoxGeometry,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
} from "three";

import { createLetteringTexture } from "./drawnLettering";
import { POTSDAMER_DETAIL_PROFILE } from "./expandedCityProfiles";

type Point2 = readonly [number, number];

const PROFILE_PATH: readonly Point2[] = [
  [0, 0],
  [0.02, 2.1],
  [-0.03, 4.35],
  [0.04, 6.35],
  [0.31, 7.45],
  [0.75, 8.15],
  [1.45, 8.42],
  [1.91, 8.82],
  [1.78, 9.23],
  [2.17, 9.5],
  [1.91, 9.8],
  [2.38, 10.08],
  [2.66, 10.45],
  [2.22, 10.69],
  [1.77, 10.91],
  [1.84, 11.27],
  [1.61, 11.63],
  [1.54, 12.18],
  [1.28, 12.82],
  [0.88, 13.42],
  [0.29, 14.02],
  [-0.55, 14.6],
  [-1.55, 15.05],
  [-2.65, 15.36],
  [-3.82, 15.55],
  [-4.75, 15.62],
  [-5.18, 15.79],
  [-5.32, 16.15],
] as const;

const PROFILE_RIBBON_WIDTH_M = 0.26;
const PROFILE_HORIZONTAL_SCALE = 0.58;
const PROFILE_LAYER_DEPTH_M = 0.1;
const PROFILE_LAYER_OFFSETS_M = [-0.18, 0, 0.18] as const;

function segmentNormal(start: Point2, end: Point2): [number, number] {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy) || 1;
  return [-dy / length, dx / length];
}

function ribbonPolygon(
  points: readonly Point2[],
  width: number,
): [number, number][] {
  const halfWidth = width / 2;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  points.forEach((point, index) => {
    const previousNormal = segmentNormal(
      points[Math.max(0, index - 1)],
      points[Math.min(points.length - 1, index)],
    );
    const nextNormal = segmentNormal(
      points[index],
      points[Math.min(points.length - 1, index + 1)],
    );
    const sumX = previousNormal[0] + nextNormal[0];
    const sumY = previousNormal[1] + nextNormal[1];
    const sumLength = Math.hypot(sumX, sumY);
    const miterX = sumLength > 1e-6 ? sumX / sumLength : nextNormal[0];
    const miterY = sumLength > 1e-6 ? sumY / sumLength : nextNormal[1];
    const alignment = Math.max(
      0.34,
      Math.abs(miterX * nextNormal[0] + miterY * nextNormal[1]),
    );
    const offset = Math.min(halfWidth / alignment, halfWidth * 2.8);
    left.push([point[0] + miterX * offset, point[1] + miterY * offset]);
    right.push([point[0] - miterX * offset, point[1] - miterY * offset]);
  });
  return [...left, ...right.reverse()];
}

function profileGeometry(): ExtrudeGeometry {
  const polygon = ribbonPolygon(PROFILE_PATH, PROFILE_RIBBON_WIDTH_M);
  const shape = new Shape();
  polygon.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: PROFILE_LAYER_DEPTH_M,
    steps: 1,
  });
  geometry.translate(0, 0, -PROFILE_LAYER_DEPTH_M / 2);

  const face = new Color(0x2a3032);
  const cutEdge = new Color(0xa1abad);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  for (const group of geometry.groups) {
    const color = group.materialIndex === 1 ? cutEdge : face;
    const end = Math.min(group.start + group.count, positions.count);
    for (let index = group.start; index < end; index += 1) {
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.scale(PROFILE_HORIZONTAL_SCALE, 1, 1);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (bounds) {
    const rawHeight = bounds.max.y - bounds.min.y;
    const heightScale = POTSDAMER_DETAIL_PROFILE.georgElser.heightM / rawHeight;
    geometry.scale(1, heightScale, 1);
    geometry.translate(0, -bounds.min.y * heightScale, 0);
  }
  return geometry;
}

function materialPair(options: {
  color?: number;
  emissive?: number;
  emissiveIntensity?: number;
  vertexColors?: boolean;
}): {
  day: MeshBasicMaterial;
  night: MeshStandardMaterial;
} {
  const day = new MeshBasicMaterial({
    color: options.color ?? 0xffffff,
    vertexColors: options.vertexColors ?? false,
  });
  const night = new MeshStandardMaterial({
    color: options.color ?? 0xffffff,
    flatShading: true,
    metalness: options.vertexColors ? 0.72 : 0.18,
    roughness: options.vertexColors ? 0.34 : 0.72,
    vertexColors: options.vertexColors ?? false,
  });
  if (options.emissive !== undefined) {
    night.userData.nightEmissive = options.emissive;
    night.userData.nightEmissiveIntensity = options.emissiveIntensity ?? 0.15;
  }
  return { day, night };
}

function modeMesh(
  name: string,
  geometry: BoxGeometry | ExtrudeGeometry,
  materials: ReturnType<typeof materialPair>,
): Mesh {
  const mesh = new Mesh(geometry, materials.day);
  mesh.name = name;
  mesh.userData.dayMaterial = materials.day;
  mesh.userData.nightMaterial = materials.night;
  return mesh;
}

function plaqueLine(
  name: string,
  text: string,
  renderedText: string,
  width: number,
  height: number,
  z: number,
): Mesh {
  const texture = createLetteringTexture({
    bandHeightM: height,
    bandWidthM: width,
    capHeightM: height * 0.56,
    fieldColor: "#202427",
    letterColor: "#f2f0e9",
    text: renderedText,
    texelsPerMetre: 320,
  });
  const day = texture
    ? new MeshBasicMaterial({ map: texture, side: DoubleSide })
    : new MeshBasicMaterial({ color: 0x202427, side: DoubleSide });
  const night = texture
    ? new MeshStandardMaterial({
        map: texture,
        roughness: 0.66,
        side: DoubleSide,
      })
    : new MeshStandardMaterial({ color: 0x202427, side: DoubleSide });
  night.userData.nightEmissive = 0x879da2;
  night.userData.nightEmissiveIntensity = 0.14;
  const line = new Mesh(new PlaneGeometry(width, height), day);
  line.name = name;
  line.position.set(0, 0.084, z);
  line.rotation.x = -Math.PI / 2;
  line.renderOrder = 4;
  line.userData.dayMaterial = day;
  line.userData.fallbackWithoutCanvas = texture === null;
  line.userData.lettering = text;
  line.userData.nightMaterial = night;
  line.userData.renderedText = renderedText;
  return line;
}

export function createGeorgElserMemorial(): Group {
  const profile = POTSDAMER_DETAIL_PROFILE.georgElser;
  const memorial = new Group();
  memorial.name = "Denkzeichen Georg Elser";
  memorial.position.set(profile.worldM[0], 8, profile.worldM[1]);
  memorial.rotation.y = profile.rotationY;
  memorial.userData = {
    artist: profile.artist,
    geometryStatus: profile.geometryStatus,
    heightM: profile.heightM,
    inscription: profile.inscription,
    material: profile.material,
    osmNodeId: profile.osmNodeId,
    sourceEpsg25833: profile.sourceEpsg25833,
    sourceUrls: profile.sourceUrls,
  };

  const steel = new Group();
  steel.name = "Georg Elser laminated steel profile";
  const template = profileGeometry();
  const steelMaterials = materialPair({
    emissive: 0xa9c3c7,
    emissiveIntensity: 0.72,
    vertexColors: true,
  });
  PROFILE_LAYER_OFFSETS_M.forEach((offset, index) => {
    const geometry = index === 0 ? template : template.clone();
    const layer = modeMesh(
      `Georg Elser steel profile layer ${index + 1}`,
      geometry,
      steelMaterials,
    );
    layer.position.z = offset;
    layer.userData.layerIndex = index + 1;
    steel.add(layer);
  });
  memorial.add(steel);

  const footMaterials = materialPair({ color: 0x252a2c });
  const foot = modeMesh(
    "Georg Elser steel ground shoe",
    new BoxGeometry(0.48, 0.12, 0.68),
    footMaterials,
  );
  foot.position.y = 0.06;
  memorial.add(foot);

  const plaque = new Group();
  plaque.name = "Georg Elser pavement inscription plaque";
  plaque.position.z = 2.05;
  const rimMaterials = materialPair({ color: 0x8a8d89 });
  const rim = modeMesh(
    "Georg Elser pavement plaque steel rim",
    new BoxGeometry(profile.plaqueWidthM, 0.055, profile.plaqueDepthM),
    rimMaterials,
  );
  rim.position.y = 0.028;
  plaque.add(rim);
  const fieldMaterials = materialPair({ color: 0x202427 });
  const field = modeMesh(
    "Georg Elser pavement plaque dark field",
    new BoxGeometry(
      profile.plaqueWidthM - 0.1,
      0.035,
      profile.plaqueDepthM - 0.1,
    ),
    fieldMaterials,
  );
  field.position.y = 0.059;
  plaque.add(field);
  plaque.add(
    plaqueLine(
      "Georg Elser pavement inscription quote",
      "Ich habe den Krieg verhindern wollen.",
      "ICH HABE DEN KRIEG VERHINDERN WOLLEN.",
      profile.plaqueWidthM - 0.18,
      0.31,
      -0.11,
    ),
    plaqueLine(
      "Georg Elser pavement inscription attribution",
      "Georg Elser, Ende November 1939",
      "GEORG ELSER, ENDE NOVEMBER 1939",
      2.75,
      0.16,
      0.19,
    ),
  );
  memorial.add(plaque);
  return memorial;
}
