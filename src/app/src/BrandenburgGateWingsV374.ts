import {
  gateHallColumns,
  gatePavementTopV374,
  gateHallsV374,
  hallPoint,
  type GateHall,
} from "./BrandenburgGatehouseSourceV374";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
} from "three";
import core from "./data/brandenburgGatehouseCoresV374.json";

type Point = [number, number, number];

const stone = 0xc8c3b6,
  pale = 0xd8d3c7,
  shade = 0xb3ac9e;
const copper = 0x96aaa0,
  flashing = 0x7c9488;
const glass = 0x414b49,
  frame = 0x514e46;
const darkJoint = 0xada698;

/** Indexed, flat-shaded planar surfaces with one material per actual finish. */
class Faces {
  private xyz: number[] = [];
  private rgb: number[] = [];
  private indices: number[] = [];
  private color = new Color();

  face(tone: number, ...points: Point[]): void {
    const first = this.xyz.length / 3;
    this.color.setHex(tone);
    for (const point of points) {
      this.xyz.push(...point);
      this.rgb.push(this.color.r, this.color.g, this.color.b);
    }
    for (let i = 1; i < points.length - 1; i++) this.indices.push(first, first + i, first + i + 1);
  }

  roofFace(tone: number, ...points: Point[]): void {
    const [a, b, c] = points;
    const normalY = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    this.face(tone, ...(normalY < 0 ? points.reverse() : points));
  }

  box(x: number, y: number, z: number, dx: number, dy: number, dz: number, tone: number): void {
    const x0 = x - dx / 2,
      x1 = x + dx / 2,
      y0 = y - dy / 2,
      y1 = y + dy / 2,
      z0 = z - dz / 2,
      z1 = z + dz / 2;
    this.face(tone, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    this.face(tone, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
    this.face(tone, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    this.face(tone, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    this.face(tone, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    this.face(tone, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  }

  mesh(group: Group, name: string, material: MeshStandardMaterial): void {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(this.xyz, 3));
    geo.setAttribute("color", new Float32BufferAttribute(this.rgb, 3));
    geo.setIndex(this.indices);
    geo.computeVertexNormals();
    const mesh = new Mesh(geo, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

function finish(metalness: number, roughness: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    side: DoubleSide,
    metalness,
    roughness,
  });
}

/** Twenty concave flutes interrupt the taper. Slight entasis and independent
 * drum tones remain readable when projected grooves fall below pixel size. */
export function gateDoricShaftV374(base: number, top: number, height: number): BufferGeometry {
  const xyz: number[] = [],
    rgb: number[] = [],
    indices: number[] = [];
  const steps = 80,
    drums = 6;
  for (let drum = 0; drum < drums; drum++) {
    const tone = [0.94, 0.98, 0.9, 0.97, 0.93, 1][drum];
    for (const level of [0, 1]) {
      const t = (drum + level) / drums;
      const radius = base + (top - base) * t + base * 0.034 * Math.sin(Math.PI * t);
      for (let i = 0; i < steps; i++) {
        const angle = (2 * Math.PI * i) / steps;
        const groove = [0, 0.036, 0.055, 0.036][i % 4];
        const r = radius * (1 - groove);
        xyz.push(r * Math.cos(angle), (t - 0.5) * height, r * Math.sin(angle));
        // The flat day draw shares the same broad light/dark modulation as the
        // neighbouring lintel. The actual concavities also take the night light.
        const value = tone * (0.89 + 0.09 * Math.cos(angle - 0.6)) * (1 - groove);
        rgb.push(value, value, value);
      }
    }
    for (let i = 0; i < steps; i++) {
      const a = 2 * drum * steps + i,
        b = 2 * drum * steps + ((i + 1) % steps);
      indices.push(a, a + steps, b + steps, a, b + steps, b);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(xyz, 3));
  geo.setAttribute("color", new Float32BufferAttribute(rgb, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function hallBox(
  batch: Faces,
  h: GateHall,
  u: number,
  y: number,
  v: number,
  du: number,
  dy: number,
  dv: number,
  color: number,
): void {
  const [x, , z] = hallPoint(h, u, y, v);
  batch.box(x, y, z, h.east ? du : dv, dy, h.east ? dv : du, color);
}

function buildHall(h: GateHall, masonry: Faces, roofing: Faces, shafts: Point[]): void {
  const halfL = h.length / 2,
    halfW = h.width / 2;
  const eaves = h.ridge - 1.25,
    orderTop = eaves - 1.12;
  for (const [x, z] of gateHallColumns(h)) {
    const floor = gatePavementTopV374(x, z);
    const height = orderTop - floor - 0.47;
    shafts.push([x, height, z]);
    masonry.box(x, floor + 0.08, z, 1.04, 0.4, 1.04, shade);
    masonry.box(x, floor + 0.285, z, 0.99, 0.085, 0.99, stone);
    masonry.box(x, orderTop - 0.04, z, 1.09, 0.27, 1.09, stone);
    masonry.box(x, orderTop + 0.07, z, 1.2, 0.17, 1.2, pale);
  }
  // A continuous, shallow entablature bridges every genuinely open bay.
  hallBox(masonry, h, 0, orderTop + 0.25, 0, h.length - 0.22, 0.35, h.width - 0.24, shade);
  hallBox(masonry, h, 0, orderTop + 0.65, 0, h.length - 0.12, 0.53, h.width - 0.15, stone);
  hallBox(masonry, h, 0, eaves - 0.14, 0, h.length, 0.16, h.width, pale);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2 * (h.east ? 6 : 5) - 1; i++) {
      const u = -halfL + 0.6 + ((h.length - 1.2) * i) / (2 * (h.east ? 6 : 5) - 2);
      hallBox(masonry, h, u, orderTop + 0.62, side * (halfW - 0.055), 0.39, 0.41, 0.12, shade);
      for (const delta of [-0.105, 0.105])
        hallBox(
          masonry,
          h,
          u + delta,
          orderTop + 0.62,
          side * (halfW + 0.015),
          0.045,
          0.37,
          0.025,
          pale,
        );
    }
    if (side !== (h.east ? 1 : Math.sign(h.z))) continue;
    const u = side * halfL;
    const base = hallPoint(h, u, eaves - 0.05, -halfW),
      tip = hallPoint(h, u, h.ridge - 0.03, 0);
    const far = hallPoint(h, u, eaves - 0.05, halfW);
    masonry.face(stone, base, tip, far);
    // A recessed field and a continuous, raking stone cornice.
    const insetU = u + side * 0.018;
    masonry.face(
      shade,
      hallPoint(h, insetU, eaves + 0.12, -halfW + 0.94),
      hallPoint(h, insetU, h.ridge - 0.27, 0),
      hallPoint(h, insetU, eaves + 0.12, halfW - 0.94),
    );
    // A small circular relief occupies the centre of the tympanum.
    const cy = eaves + 0.52,
      faceU = u + side * 0.032;
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12,
        b = ((i + 1) * Math.PI) / 12;
      const arc = (angle: number, r: number) =>
        hallPoint(h, faceU, cy + Math.sin(angle) * r, Math.cos(angle) * r);
      masonry.face(i < 12 ? pale : stone, arc(a, 0.34), arc(b, 0.34), arc(b, 0.27), arc(a, 0.27));
    }
    for (const slope of [-1, 1]) {
      const over = u + side * 0.052;
      masonry.face(
        pale,
        hallPoint(h, over, eaves - 0.04, slope * halfW),
        hallPoint(h, over, h.ridge, 0),
        hallPoint(h, over, h.ridge - 0.13, 0),
        hallPoint(h, over, eaves - 0.17, slope * halfW),
      );
    }
  }
  for (const side of [-1, 1]) {
    const e = side * halfW;
    roofing.roofFace(
      copper,
      hallPoint(h, -halfL, eaves, e),
      hallPoint(h, halfL, eaves, e),
      hallPoint(h, halfL, h.ridge, 0),
      hallPoint(h, -halfL, h.ridge, 0),
    );
    for (let u = -halfL + 1.05; u < halfL - 0.3; u += 1.05) {
      roofing.roofFace(
        flashing,
        hallPoint(h, u, eaves + 0.022, e),
        hallPoint(h, u + 0.035, eaves + 0.022, e),
        hallPoint(h, u + 0.035, h.ridge + 0.022, 0),
        hallPoint(h, u, h.ridge + 0.022, 0),
      );
    }
  }
}

function measuredRooms(masonry: Faces, roofing: Faces): void {
  const a = (core.rotation * Math.PI) / 180;
  const points: Point[] = core.positionCm.map(([u, v, w]) => {
    const x = core.origin[0] + u / 100 - core.anchor[0],
      z = core.origin[2] + w / 100 - core.anchor[2];
    return [
      x * Math.cos(a) - z * Math.sin(a),
      core.origin[1] + v / 100 - core.anchor[1],
      x * Math.sin(a) + z * Math.cos(a),
    ];
  });
  for (const [a, b, c, roof] of core.faces) {
    (roof ? roofing : masonry).face(roof ? copper : stone, points[a], points[b], points[c]);
  }
}

function roomFront(x: number, z: number, masonry: Faces, glazing: Faces): void {
  // An individual lintel and reveals surround each real central door and the
  // square upper light; stone block joints stop at the opening.
  for (const [centre, height, width] of [
    [2.4, 4.28, 1.52],
    [6.43, 1.52, 1.64],
  ]) {
    masonry.box(x + 0.075, centre, z, 0.16, height + 0.28, width + 0.29, shade);
    glazing.box(x + 0.164, centre, z, 0.025, height, width, glass);
    for (const s of [-1, 1])
      masonry.box(x + 0.18, centre, z + s * (width / 2 + 0.09), 0.12, height + 0.15, 0.16, pale);
    masonry.box(x + 0.2, centre + height / 2 + 0.14, z, 0.36, 0.19, width + 0.53, pale);
    for (const side of [-1, 1])
      glazing.box(x + 0.192, centre, z + (side * width) / 6, 0.025, height, 0.052, frame);
    for (let dy = -height / 2 + 0.7; dy < height / 2 - 0.18; dy += 0.78)
      glazing.box(x + 0.192, centre + dy, z, 0.025, 0.058, width, frame);
  }
  for (let y = 0.86; y < 8.65; y += 0.74) {
    for (const s of [-1, 1]) masonry.box(x + 0.035, y, z + s * 2.1, 0.022, 0.025, 2.1, darkJoint);
  }
}

/** The east rooms have a second door halfway along the inward-looking wall.
 * The three upper and lower bays are visible behind the six free columns. */
function roomSide(z: number, side: number, masonry: Faces, glazing: Faces): void {
  const bays = [9.95, 14.25, 18.55];
  for (const [i, x] of bays.entries()) {
    for (const upper of [false, true]) {
      const door = !upper && i === 1;
      const h = upper ? 1.45 : door ? 4.1 : 2.82;
      const y = upper ? 6.43 : door ? 2.35 : 2.75;
      const w = door ? 1.52 : 1.24;
      masonry.box(x, y, z + side * 0.045, w + 0.17, h + 0.18, 0.12, shade);
      glazing.box(x, y, z + side * 0.12, w, h, 0.03, glass);
      glazing.box(x, y, z + side * 0.146, 0.055, h, 0.025, frame);
      for (let dy = -h / 2 + 0.7; dy < h / 2 - 0.17; dy += 0.72)
        glazing.box(x, y + dy, z + side * 0.146, w, 0.044, 0.025, frame);
      if (door) masonry.box(x, y + h / 2 + 0.14, z + side * 0.16, w + 0.46, 0.19, 0.32, pale);
    }
  }
}

function coverCentralAttic(roofing: Faces): void {
  // Low, folded metal covers sit within the projecting stone cornices. The
  // sculptural plinth and all four horses retain their independent height.
  const covers = [
    [-16.37, -11.9, 4.97, 19.043],
    [-11.9, -7.41, 4.94, 19.633],
    [-7.41, 7.41, 4.93, 20.379],
    [7.41, 11.9, 4.94, 19.633],
    [11.9, 16.37, 4.97, 19.043],
  ];
  for (const [z0, z1, halfX, y] of covers) {
    for (const side of [-1, 1]) {
      const x = halfX * side,
        crest = y + 0.065;
      roofing.roofFace(copper, [x, y, z0], [x, y, z1], [0, crest, z1], [0, crest, z0]);
      for (let z = z0 + 0.7; z < z1 - 0.18; z += 0.7) {
        roofing.roofFace(
          flashing,
          [x, y + 0.016, z],
          [x, y + 0.016, z + 0.028],
          [0, crest + 0.016, z + 0.028],
          [0, crest + 0.016, z],
        );
      }
    }
  }
}

export function addBrandenburgGateWingsV374(group: Group): void {
  const masonry = new Faces(),
    roofing = new Faces(),
    glazing = new Faces(),
    shafts: Point[] = [];
  measuredRooms(masonry, roofing);
  coverCentralAttic(roofing);
  for (const hall of gateHallsV374) buildHall(hall, masonry, roofing, shafts);
  roomFront(20.86, 26.46, masonry, glazing);
  roomFront(21.05, -24.6, masonry, glazing);
  roomSide(23.25, -1, masonry, glazing);
  roomSide(-21.37, 1, masonry, glazing);
  const stoneFinish = finish(0, 0.91);
  stoneFinish.userData.nightEmissive = 0xa58057;
  stoneFinish.userData.nightEmissiveIntensity = 0.24;
  masonry.mesh(
    group,
    "Brandenburg Gate measured guard rooms and open sandstone entablatures",
    stoneFinish,
  );
  roofing.mesh(group, "Brandenburg Gate crossed standing-seam copper roofs", finish(0.32, 0.61));
  glazing.mesh(
    group,
    "Brandenburg Gate guardroom portals and divided upper lights",
    finish(0.11, 0.49),
  );
  const columnFinish = stoneFinish.clone();
  columnFinish.color.setHex(0xc8c5bd);
  const columns = new InstancedMesh(gateDoricShaftV374(0.5, 0.415, 1), columnFinish, shafts.length);
  columns.name = "Brandenburg Gate open hall fluted sandstone columns";
  const transform = new Matrix4();
  shafts.forEach(([x, h, z], i) =>
    columns.setMatrixAt(
      i,
      transform.makeScale(1, h, 1).setPosition(x, gatePavementTopV374(x, z) + 0.29 + h / 2, z),
    ),
  );
  columns.castShadow = true;
  columns.receiveShadow = true;
  group.add(columns);
}
