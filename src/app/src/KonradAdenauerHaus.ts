import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Shape, ShapeGeometry, Vector2, Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { addBox, createBuilder, finishDrawnGroup, paintGeometry } from "./drawnKit";
import { KONRAD_ADENAUER_HAUS_PROFILE as PROFILE } from "./expandedCityProfiles";

type Point = readonly [number, number];
type Box = { color: number; at: [number, number, number]; size: [number, number, number]; rotation: number };
const GLASS = 0x41636b;
const FRAME = 0xaebdbc;
const WOOD = 0xb39b75;
const SILVER = 0xcbd0c9;

/** Exact mapped outer hull; the curved inner office facades are display fits. */
export function konradAdenauerFootprintContains(x: number, z: number): boolean {
  if (x < -1437 || x > -1378 || z < 1299 || z > 1380) return false;
  const ring = PROFILE.footprintWorldM;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function ellipse(length: number, depth: number, dx = 0, dz = 0, count = 48): Point[] {
  const c = Math.cos(PROFILE.innerBodyRotationY), s = Math.sin(PROFILE.innerBodyRotationY);
  return Array.from({ length: count }, (_, i) => {
    const a = i * Math.PI * 2 / count;
    const x = length / 2 * Math.cos(a), z = depth / 2 * Math.sin(a);
    return [PROFILE.innerBodyCenterWorldM[0] + dx + x * c + z * s,
      PROFILE.innerBodyCenterWorldM[1] + dz - x * s + z * c];
  });
}

function surface(ring: readonly Point[], y: number): BufferGeometry {
  const shape = new Shape(ring.map(([x, z]) => new Vector2(x, -z)));
  const geometry = new ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
}

/** All repeated mullions, ribbons, doors and railings share one bounded batch. */
function facadeBoxes(minecraft: boolean): Box[] {
  const boxes: Box[] = [];
  const ground = PROFILE.groundY;
  const segment = (color: number, a: Point, b: Point, y: number, height: number, depth: number): void => {
    boxes.push({ color, at: [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2],
      size: [Math.hypot(b[0] - a[0], b[1] - a[1]), height, depth],
      rotation: -Math.atan2(b[1] - a[1], b[0] - a[0]) });
  };
  const outline = (ring: readonly Point[], color: number, y: number, height: number, depth: number): void => {
    ring.forEach((a, i) => segment(color, a, ring[(i + 1) % ring.length], y, height, depth));
  };
  const hull = PROFILE.footprintWorldM;
  // Photograph-visible curtain wall has two glazing registers per office floor.
  for (let row = 0; row <= 8; row++) outline(hull, FRAME, ground + row * 2.25, 0.11, 0.2);
  for (let edge = 0; edge < hull.length; edge++) {
    const a = hull[edge], b = hull[(edge + 1) % hull.length];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / (minecraft ? 4.7 : 2.35)));
    for (let i = 0; i < n; i++) {
      boxes.push({ color: FRAME, at: [a[0] + (b[0] - a[0]) * i / n, ground + 9, a[1] + (b[1] - a[1]) * i / n],
        size: [minecraft ? 0.24 : 0.13, 18, minecraft ? 0.24 : 0.13], rotation: 0 });
    }
  }
  // The four lower office floors now actually meet the upper two: no 2.4 m gap.
  const storeys = [
    [54, 30, 0, 0, 0, 4.5], [54, 30, 0, 0, 4.5, 4.5],
    [54, 30, 0, 0, 9, 4.5], [54, 30, 0, 0, 13.5, 4.5],
    [53.4, 29.2, -.55, -.38, 18, 4], [51.2, 27.6, -1.05, -.72, 22, 4],
  ];
  for (const [length, depth, dx, dz, y, height] of storeys) {
    const ring = ellipse(length, depth, dx, dz, minecraft ? 32 : 48);
    outline(ring, GLASS, ground + y + height / 2, height, minecraft ? 0.5 : 0.3);
    outline(ring, y < 18 ? WOOD : SILVER, ground + y + .48, .96, .43);
    outline(ring, y < 18 ? 0xc2ad88 : SILVER, ground + y + height - .12, .24, .45);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const radialX = a[0] - PROFILE.innerBodyCenterWorldM[0] - dx;
      const radialZ = a[1] - PROFILE.innerBodyCenterWorldM[1] - dz;
      const outward = .3 / Math.hypot(radialX, radialZ);
      boxes.push({ color: y < 18 ? 0xc0aa84 : SILVER, at: [a[0] + radialX * outward, ground + y + height / 2, a[1] + radialZ * outward],
        size: [minecraft ? .25 : .11, height - .95, minecraft ? .25 : .11], rotation: 0 });
    }
  }
  // The large glazed south-east entrance is inset in the narrow east hull edge.
  const a = hull[3], b = hull[4];
  const doorA: Point = [a[0] + (b[0] - a[0]) * .13 - 1, a[1] + (b[1] - a[1]) * .13];
  const doorB: Point = [a[0] + (b[0] - a[0]) * .58 - 1, a[1] + (b[1] - a[1]) * .58];
  segment(0x2c474d, doorA, doorB, ground + 1.9, 3.8, .24);
  segment(SILVER, doorA, doorB, ground + 3.85, .18, 1.5);
  for (let i = 0; i <= 6; i++) {
    const x = doorA[0] + (doorB[0] - doorA[0]) * i / 6;
    const z = doorA[1] + (doorB[1] - doorA[1]) * i / 6;
    boxes.push({ color: SILVER, at: [x + .2, ground + 1.9, z], size: [.18, 3.8, .16], rotation: 0 });
  }
  // Horizontal roof trusses read through the glass rather than an opaque lid.
  const c = Math.cos(PROFILE.innerBodyRotationY), s = Math.sin(PROFILE.innerBodyRotationY);
  for (let i = -4; i <= 4; i++) {
    const x = PROFILE.innerBodyCenterWorldM[0] + i * 5.5 * c;
    const z = PROFILE.innerBodyCenterWorldM[1] - i * 5.5 * s;
    const aa: Point = [x - 11 * s, z - 11 * c];
    const bb: Point = [x + 11 * s, z + 11 * c];
    if (konradAdenauerFootprintContains(aa[0], aa[1]) && konradAdenauerFootprintContains(bb[0], bb[1]))
      segment(FRAME, aa, bb, ground + 17.75, .24, .22);
  }
  // Shallow silver roof shoulder replaces the former exposed circular rail.
  for (let i = 0; i < 3; i++) outline(ellipse(51.2 - i * .8, 27.6 - i * .8, -1.05, -.72,
    minecraft ? 32 : 48), i === 0 ? SILVER : 0xb2b9b4, ground + 26.15 + i * .3, .3, .65);
  const mast: Point = [PROFILE.innerBodyCenterWorldM[0] + c * 23 - 1.05,
    PROFILE.innerBodyCenterWorldM[1] - s * 23 - .72];
  boxes.push({ color: FRAME, at: [mast[0], ground + 30.9, mast[1]], size: [.12, 8.2, .12], rotation: 0 });
  boxes.push({ color: 0x4e9b9a, at: [mast[0] + 1, ground + 33.55, mast[1]], size: [2, 2.7, .05], rotation: 0 });
  // The photographed current office identifier is geometry on a small white
  // panel just behind the pointed glass front; no logo/photo texture is used.
  const sign = PROFILE.identificationSign;
  const tangent: Point = [-s, -c];
  const front: Point = [PROFILE.innerBodyCenterWorldM[0] + 27.35 * c,
    PROFILE.innerBodyCenterWorldM[1] - 27.35 * s];
  const signBox = (color: number, x: number, y: number, w: number, h: number, outward: number): void => {
    boxes.push({ color, at: [front[0] + tangent[0] * x + c * outward,
      ground + sign.heightAboveGroundM + y, front[1] + tangent[1] * x - s * outward],
      size: [w, h, .05], rotation: -Math.atan2(tangent[1], tangent[0]) });
  };
  signBox(0xe9ece2, 0, 0, sign.widthM, sign.heightM, 0);
  const glyphs = [
    ["01110", "11001", "11000", "11000", "11000", "11001", "01110"],
    ["11110", "11011", "11001", "11001", "11001", "11011", "11110"],
    ["11001", "11001", "11001", "11001", "11001", "11011", "01110"],
  ];
  glyphs.forEach((rows, letter) => rows.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel === "1") signBox(0x344e53, -.98 + letter * .81 + x * .125, .43 - y * .145, .135, .155, .065);
  })));
  for (let i = 0; i < 3; i++) signBox([0x41504e, 0xb55048, 0xd1b64e][i], -1.6 + i * .18, -.12, .13, .55 + i * .12, .065);
  return boxes;
}

export function createKonradAdenauerHaus(): Group {
  const builder = createBuilder();
  const ground = PROFILE.groundY;
  const boxes = facadeBoxes(false);
  for (const box of boxes) addBox(builder, box.color, ...box.at, ...box.size, box.rotation, false);
  for (const [ring, y, color] of [
    [PROFILE.footprintWorldM, ground + PROFILE.travertinePlinthHeightM, 0xc9c0ad],
    [ellipse(54, 30), ground + 18, SILVER],
    [ellipse(53.4, 29.2, -.55, -.38), ground + 22, SILVER],
    [ellipse(49.6, 26, -1.05, -.72), ground + 26.9, 0xaeb6b1],
  ] as const) {
    const geometry = surface(ring, y);
    paintGeometry(geometry, color);
    builder.parts.push(geometry);
  }
  const group = finishDrawnGroup(builder, { name: "Konrad-Adenauer-Haus glass envelope" })!;
  const glassParts: BufferGeometry[] = [];
  PROFILE.footprintWorldM.forEach((a, i) => {
    const b = PROFILE.footprintWorldM[(i + 1) % PROFILE.footprintWorldM.length];
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([
      a[0], ground + .7, a[1], b[0], ground + .7, b[1], b[0], ground + 18, b[1], a[0], ground + 18, a[1],
    ], 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    glassParts.push(geometry);
  });
  const roof = surface(PROFILE.footprintWorldM, ground + 18);
  roof.deleteAttribute("normal"); roof.deleteAttribute("uv"); glassParts.push(roof);
  const glazing = new Mesh(mergeGeometries(glassParts), new MeshBasicMaterial({
    color: 0x6d989e, opacity: .2, transparent: true, depthWrite: false, side: DoubleSide,
  }));
  glazing.name = "Konrad-Adenauer-Haus transparent winter garden glazing";
  glazing.userData.dayMaterial = glazing.material;
  glazing.userData.nightMaterial = new MeshBasicMaterial({ color: 0x79999f, opacity: .14, transparent: true, depthWrite: false, side: DoubleSide });
  group.add(glazing);
  glassParts.forEach(part => part.dispose());
  group.userData = { ...PROFILE, facadeBoxCount: boxes.length };
  return group;
}

/** Surface-only block model: the surrounding winter garden stays open. */
export function createMinecraftKonradAdenauerHaus(): InstancedMesh {
  const boxes = facadeBoxes(true);
  const ground = PROFILE.groundY;
  // Low slabs retain mapped plan and stepped oval terraces without solid infill.
  for (let x = -1436; x < -1378; x += 2) for (let z = 1300; z < 1380; z += 2) {
    if (!konradAdenauerFootprintContains(x, z)) continue;
    let halfCell = .98;
    // Trim edge cells, including the narrow bow, instead of spilling a square
    // cell across the measured hull into the street.
    while (halfCell > .03 && ![-1, 1].every(sx => [-1, 1].every(sz =>
      konradAdenauerFootprintContains(x + sx * halfCell, z + sz * halfCell)))) halfCell *= .75;
    boxes.push({ color: 0xc9c0ad, at: [x, ground + .325, z], size: [halfCell * 2, .65, halfCell * 2], rotation: 0 });
    const c = Math.cos(PROFILE.innerBodyRotationY), s = Math.sin(PROFILE.innerBodyRotationY);
    for (const [width, depth, y, offsetX, offsetZ] of [[54, 30, 18, 0, 0], [53.4, 29.2, 22, -.55, -.38], [49.6, 26, 26.9, -1.05, -.72]]) {
      const dx = x - PROFILE.innerBodyCenterWorldM[0] - offsetX, dz = z - PROFILE.innerBodyCenterWorldM[1] - offsetZ;
      const u = dx * c - dz * s, v = dx * s + dz * c;
      if ((u / (width / 2)) ** 2 + (v / (depth / 2)) ** 2 < 1)
        boxes.push({ color: SILVER, at: [x, ground + y, z], size: [1.96, .25, 1.96], rotation: 0 });
    }
  }
  // Instanced colours are supplied by instanceColor; this cube has no vertex
  // colour attribute. Enabling vertexColors would multiply every block black.
  const material = new MeshBasicMaterial({ color: 0xffffff });
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), material, boxes.length);
  const matrix = new Matrix4();
  boxes.forEach((box, index) => {
    matrix.makeRotationY(box.rotation).scale(new Vector3(...box.size)).setPosition(...box.at);
    mesh.setMatrixAt(index, matrix); mesh.setColorAt(index, new Color(box.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.name = "Minecraft Konrad-Adenauer-Haus open glass hull";
  mesh.userData = { ...PROFILE, blockCount: boxes.length, dayMaterial: material,
    nightMaterial: new MeshStandardMaterial({ color: 0xffffff, roughness: .85, metalness: .05 }) };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  return mesh;
}
