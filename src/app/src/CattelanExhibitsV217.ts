import {
  BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute,
  Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion,
  SphereGeometry, Vector3,
} from "three";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** All coordinates/proportions are display estimates from the owner's October 2026 photos.
 * These are small original geometric readings, not scans or a surveyed installation plan. */
export const CATTELAN_EXHIBITS_V217 = {
  hangingFigure: [-15, 0, 12], marbleShrouds: [[-5, 0, -7], [-2, 0, -7], [1, 0, -7], [4, 0, -7]],
  tube: { center: [10, 1.18, -10], length: 7, outerRadius: 1.17, innerRadius: 1.12, axis: "X" },
  horse: [13, 5.15, -16], bed: [-14, 0, 17], gateCabinet: [0, 0, 11],
  source: "Owner-supplied Neue Nationalgalerie photographs, October 2026; reference only, never bundled",
  geometryStatus: "Photo-informed procedural display estimates; local room arrangement is not a surveyed installation plan",
} as const;

const GREY = 0x737778, CHROME = 0xc3cdce, DARK = 0x25292c, SKIN = 0xd6b499;
const HAIR = 0x292323, WOOD = 0x794936, WHITE = 0xf3f0e4;
type Point = [number, number, number];

class ExhibitBatch {
  readonly boxes: number[][] = [];
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];
  private readonly indices: number[] = [];
  private readonly spheres: { matrix: Matrix4; color: number }[] = [];
  private readonly rods: { matrix: Matrix4; color: number }[] = [];
  private readonly unitSphere = new SphereGeometry(1, 10, 6);
  private readonly unitCylinder = new CylinderGeometry(1, 1, 1, 10);
  constructor(readonly native: boolean) {}

  box(x: number, y: number, z: number, w: number, h: number, d: number, color: number): void {
    this.boxes.push([x, y, z, w, h, d, color]);
  }

  geometry(geometry: BufferGeometry, matrix: Matrix4, color: number): void {
    const position = geometry.getAttribute("position"), point = new Vector3(), rgb = new Color(color);
    const offset = this.positions.length / 3;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(matrix);
      this.positions.push(point.x, point.y, point.z); this.colors.push(rgb.r, rgb.g, rgb.b);
    }
    if (geometry.index) for (const index of geometry.index.array) this.indices.push(offset + index);
    else for (let i = 0; i < position.count; i++) this.indices.push(offset + i);
  }

  ellipsoid(x: number, y: number, z: number, rx: number, ry: number, rz: number, color: number): void {
    if (this.native) {
      // Three independent native surface courses preserve the silhouette without smooth doubles.
      for (const [dy, scale] of [[-.65, .70], [0, 1], [.65, .70]]) {
        this.box(x, y + dy * ry, z, 2 * rx * scale, ry * .69, 2 * rz * scale, color);
      }
    } else this.spheres.push({ matrix: new Matrix4().makeScale(rx, ry, rz).setPosition(x, y, z), color });
  }

  rod(a: Point, b: Point, radius: number, color: number): void {
    const direction = new Vector3(...b).sub(new Vector3(...a)), length = direction.length();
    if (this.native) {
      const count = Math.max(1, Math.ceil(length / Math.max(.10, radius * 2)));
      for (let i = 0; i < count; i++) {
        const t = (i + .5) / count;
        this.box(a[0] + direction.x * t, a[1] + direction.y * t, a[2] + direction.z * t,
          Math.abs(direction.x) / count + radius * 2 * Math.sqrt(Math.max(0, 1 - (direction.x / length) ** 2)),
          Math.abs(direction.y) / count + radius * 2 * Math.sqrt(Math.max(0, 1 - (direction.y / length) ** 2)),
          Math.abs(direction.z) / count + radius * 2 * Math.sqrt(Math.max(0, 1 - (direction.z / length) ** 2)), color);
      }
    } else {
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
      this.rods.push({ matrix: new Matrix4().compose(new Vector3(
        (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q,
      new Vector3(radius, length, radius)), color });
    }
  }

  finish(name: string): Group {
    const root = new Group(); root.name = name;
    root.userData = { cattelanExhibitsV217: true, textureFree: true, nativeMinecraft: this.native,
      keepInMinecraft: this.native, blockNative: this.native, fullStaticDetailOnTouch: true,
      source: CATTELAN_EXHIBITS_V217.source, geometryStatus: CATTELAN_EXHIBITS_V217.geometryStatus };
    if (this.boxes.length) {
      const boxes = justicePalaceV183Boxes(this.native ? this.boxes : this.boxes.map(r => [...r.slice(0, 6), 0, r[6]]), this.native);
      boxes.name = "Cattelan exhibit cabinet, clothing, furnishings and native surfaces";
      root.add(boxes);
    }
    for (const [geometry, instances, label] of [
      [this.unitSphere, this.spheres, "sculpted heads cloth volumes and horses"],
      [this.unitCylinder, this.rods, "chrome rods limbs suspension and fluted columns"],
    ] as const) {
      if (!instances.length) { geometry.dispose(); continue; }
      geometry.deleteAttribute("uv");
      const normals = geometry.getAttribute("normal"), shades = new Float32Array(normals.count * 3);
      for (let i = 0; i < normals.count; i++) {
        const shade = .74 + .26 * Math.max(0, .35 * normals.getX(i) + .82 * normals.getY(i) + .45 * normals.getZ(i));
        shades.fill(shade, i * 3, i * 3 + 3);
      }
      geometry.setAttribute("color", new Float32BufferAttribute(shades, 3));
      const day = new MeshBasicMaterial({ vertexColors: true });
      const night = new MeshStandardMaterial({ vertexColors: true, roughness: .59 });
      const mesh = new InstancedMesh(geometry, day, 0), rgb = new Color();
      const matrices = new Float32Array(instances.length * 16), colors = new Float32Array(instances.length * 3);
      instances.forEach(({ matrix, color }, i) => { matrix.toArray(matrices, i * 16); rgb.setHex(color).toArray(colors, i * 3); });
      mesh.count = instances.length;
      mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
      mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
      mesh.name = "Cattelan " + label;
      mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
    }
    if (this.positions.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
      geometry.setIndex(this.indices); geometry.computeVertexNormals();
      // Normal-derived daylight definition keeps folds legible in the drawn scene's basic-material pass.
      const normals = geometry.getAttribute("normal");
      for (let i = 0; i < normals.count; i++) {
        const shade = .73 + .27 * Math.max(0, .35 * normals.getX(i) + .82 * normals.getY(i) + .45 * normals.getZ(i));
        for (let c = 0; c < 3; c++) this.colors[i * 3 + c] *= shade;
      }
      geometry.setAttribute("color", new Float32BufferAttribute(this.colors, 3));
      geometry.computeBoundingSphere(); geometry.computeBoundingBox();
      const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
      const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .59 });
      const mesh = new Mesh(geometry, day); mesh.name = "Cattelan sculpted figures and open tube";
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
      root.add(mesh);
    }
    let gpuBytes = 0;
    root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      for (const name of Object.keys(object.geometry.attributes)) gpuBytes += object.geometry.getAttribute(name).array.byteLength;
      gpuBytes += object.geometry.index?.array.byteLength ?? 0;
      if (object instanceof InstancedMesh) gpuBytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
    });
    root.userData.gpuBytes = gpuBytes;
    for (const child of root.children) freezeStaticSceneTransforms(child);
    return root;
  }
}

function hangingFigure(batch: ExhibitBatch): void {
  const [x, , z] = CATTELAN_EXHIBITS_V217.hangingFigure;
  // An open chromed coat stand, black drip tray, projecting pegs and collar support.
  // There is deliberately no rope and no connection around the figure's neck.
  for (const dx of [-.38, .38]) {
    batch.rod([x + dx, .035, z], [x + dx, 2.05, z], .022, CHROME);
    batch.rod([x + dx, .055, z], [x + dx, .055, z + .56], .024, CHROME);
  }
  for (const y of [.10, .44, 1.73, 2.05]) batch.rod([x - .38, y, z], [x + .38, y, z], .021, CHROME);
  batch.box(x, .07, z + .24, .74, .075, .57, DARK);
  for (const dx of [-.26, -.12, .12, .26]) batch.rod([x + dx, 1.73, z], [x + dx, 1.78, z + .12], .015, CHROME);
  batch.rod([x, 1.73, z], [x, 1.77, z + .14], .018, CHROME);
  batch.ellipsoid(x, 1.28, z + .22, .20, .40, .12, GREY);
  batch.box(x, 1.35, z + .28, .35, .57, .13, GREY);
  for (const side of [-1, 1]) {
    // Hanging sleeves, relaxed arms, separate trouser legs and uncovered feet.
    batch.rod([x + side * .19, 1.57, z + .22], [x + side * .24, 1.06, z + .37], .082, GREY);
    batch.ellipsoid(x + side * .24, .99, z + .39, .055, .09, .04, SKIN);
    batch.rod([x + side * .095, 1.01, z + .23], [x + side * .09, .46, z + .31], .084, GREY);
    batch.ellipsoid(x + side * .09, .38, z + .37, .062, .09, .11, SKIN);
    // Folded lapel and dropped cuff distinguish a grey felt suit from a featureless body.
    batch.rod([x + side * .10, 1.60, z + .36], [x + side * .035, 1.37, z + .38], .025, 0x969995);
    batch.box(x + side * .235, 1.065, z + .37, .15, .045, .13, 0x939793);
  }
  for (const y of [1.18, 1.30, 1.42]) batch.ellipsoid(x, y, z + .365, .012, .012, .010, DARK);
  batch.ellipsoid(x + .035, 1.66, z + .39, .135, .16, .14, SKIN);
  batch.ellipsoid(x + .015, 1.75, z + .385, .15, .115, .15, HAIR);
  batch.ellipsoid(x + .09, 1.67, z + .49, .09, .14, .045, HAIR);
  batch.ellipsoid(x + .055, 1.61, z + .53, .028, .027, .035, SKIN);
}

function shroudHeight(u: number, t: number, variant: number): number {
  const edge = Math.max(0, 1 - u * u);
  // Covered head, chest, knees and feet produce longitudinal body contours under the cloth.
  const body = .28 * Math.exp(-(((t - .17) / .10) ** 2))
    + .40 * Math.exp(-(((t - .37) / .20) ** 2))
    + .24 * Math.exp(-(((t - .68) / .18) ** 2))
    + .15 * Math.exp(-(((t - .88) / .09) ** 2));
  const folds = .052 * Math.sin(u * 16 + t * 12 + variant) * Math.sin(t * Math.PI)
    + .029 * Math.sin(u * 28 - t * 17 + variant * 2);
  return .012 + Math.pow(edge, .60) * Math.sin(t * Math.PI) * Math.max(.018, body + folds);
}

function marbleShrouds(batch: ExhibitBatch): void {
  CATTELAN_EXHIBITS_V217.marbleShrouds.forEach(([x, , z], variant) => {
    const width = (t: number) => .38 + .20 * Math.sin(t * Math.PI) + .025 * Math.sin(t * 25 + variant);
    if (batch.native) {
      // Surface-only independent block reading: folds survive without a hidden solid mass.
      for (let j = 0; j < 19; j++) for (let i = 0; i < 9; i++) {
        const t = (j + .5) / 19, u = (i + .5) / 4.5 - 1, y = shroudHeight(u, t, variant);
        batch.box(x + u * width(t), y + .025, z + (t - .5) * 2.55,
          width(t) / 4.5, .052, 2.55 / 19, WHITE);
      }
      return;
    }
    const nx = 18, nz = 32, positions: number[] = [], indices: number[] = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const t = j / nz, u = i / nx * 2 - 1;
      positions.push(u * width(t), shroudHeight(u, t, variant), (t - .5) * 2.55);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + nx + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    batch.geometry(geometry, new Matrix4().makeRotationY((variant - 1.5) * .03).setPosition(x, 0, z), WHITE);
    geometry.dispose();
  });
}

function openTube(batch: ExhibitBatch): void {
  const { center: [x, y, z], length, outerRadius: outer, innerRadius: inner } = CATTELAN_EXHIBITS_V217.tube;
  if (batch.native) {
    const cell = .14;
    for (let iy = -9; iy <= 9; iy++) for (let iz = -9; iz <= 9; iz++) {
      const dy = iy * cell, dz = iz * cell, radius = Math.hypot(dy, dz);
      if (radius < inner - .06 || radius > outer + .02) continue;
      batch.box(x, Math.max(cell / 2, y + dy), z + dz, length, cell, cell, 0x999f9f);
    }
    return;
  }
  const segments = 48, positions: number[] = [], indices: number[] = [];
  for (const radius of [outer, inner]) for (const end of [-1, 1]) for (let i = 0; i <= segments; i++) {
    const a = i / segments * Math.PI * 2;
    positions.push(x + end * length / 2, y + Math.sin(a) * radius, z + Math.cos(a) * radius);
  }
  const stride = segments + 1;
  for (let i = 0; i < segments; i++) {
    // Outer wall, inner wall and annular lips; deliberately no end disks.
    for (const [a, b] of [[i, stride + i], [2 * stride + i, 3 * stride + i],
      [i, 2 * stride + i], [stride + i, 3 * stride + i]]) indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
  batch.geometry(geometry, new Matrix4(), 0xa6aeaf); geometry.dispose();
}

function suspendedHorse(batch: ExhibitBatch): void {
  const [x, y, z] = CATTELAN_EXHIBITS_V217.horse;
  const brown = 0x644332;
  batch.ellipsoid(x, y, z, .34, .43, .86, brown);
  batch.ellipsoid(x, y + .09, z - .65, .34, .43, .33, brown);
  batch.rod([x, y + .09, z - .65], [x, y - .38, z - 1.02], .20, brown);
  batch.ellipsoid(x, y - .48, z - 1.1, .15, .30, .20, brown);
  for (const side of [-1, 1]) {
    batch.rod([x + side * .23, y - .2, z - .52], [x + side * .22, y - 1.30, z - .49], .068, brown);
    batch.rod([x + side * .23, y - .20, z + .56], [x + side * .20, y - 1.30, z + .69], .071, brown);
    for (const dz of [-.49, .69]) batch.ellipsoid(x + side * .21, y - 1.34, z + dz, .09, .10, .14, DARK);
    batch.rod([x + side * .08, y - .28, z - 1.08], [x + side * .11, y - .03, z - 1.15], .042, brown);
  }
  batch.rod([x, y + .05, z + .83], [x + .08, y - .77, z + 1.04], .067, 0x352c24);
  // Fine suspension lines converge above the back, as in the supplied photograph.
  for (const dz of [-.5, .5]) batch.rod([x, y + .4, z + dz], [x, 6.95, z], .009, 0x6f7370);
  batch.rod([x, 6.95, z], [x, 8.10, z], .009, 0x6f7370);
}

function doubleBed(batch: ExhibitBatch): void {
  const [x, , z] = CATTELAN_EXHIBITS_V217.bed;
  batch.box(x, .24, z, 1.04, .22, 1.55, WOOD);
  batch.box(x, .39, z, .99, .13, 1.45, WHITE);
  for (const dz of [-.79, .79]) {
    batch.box(x, dz < 0 ? .60 : .37, z + dz, 1.15, dz < 0 ? .86 : .42, .08, WOOD);
    batch.box(x, dz < 0 ? 1.03 : .59, z + dz, 1.21, .055, .11, 0x935b41);
  }
  for (const dx of [-.47, .47]) for (const dz of [-.67, .67]) batch.box(x + dx, .08, z + dz, .11, .16, .12, WOOD);
  for (const side of [-1, 1]) {
    const xx = x + side * .24;
    batch.ellipsoid(xx, .49, z - .46, .22, .065, .20, WHITE);
    batch.ellipsoid(xx, .58, z - .48, .105, .115, .12, SKIN);
    batch.ellipsoid(xx, .60, z - .535, .11, .10, .085, 0x77766f);
    batch.ellipsoid(xx, .54, z - .13, .17, .10, .29, 0x272a32);
    for (const leg of [-1, 1]) {
      batch.rod([xx + leg * .08, .51, z + .07], [xx + leg * .085, .50, z + .57], .06, 0x292c34);
      batch.ellipsoid(xx + leg * .085, .52, z + .63, .065, .073, .12, 0x4b3529);
    }
    batch.rod([xx + side * .14, .55, z - .31], [xx + side * .20, .50, z + .09], .043, 0x272a32);
    batch.ellipsoid(xx + side * .19, .54, z + .10, .045, .035, .07, SKIN);
  }
}

function gateCabinet(batch: ExhibitBatch): void {
  const [x, , z] = CATTELAN_EXHIBITS_V217.gateCabinet;
  // Brown cabinet-sized Brandenburg Gate: six paired fluted columns and tiny green quadriga.
  for (const dz of [-.68, .68]) for (const dx of [-2.25, -1.35, -.45, .45, 1.35, 2.25]) {
    batch.box(x + dx, .06, z + dz, .40, .12, .40, WOOD);
    batch.rod([x + dx, .14, z + dz], [x + dx, 2.68, z + dz], .16, 0x9a644c);
    batch.box(x + dx, 2.69, z + dz, .4, .14, .4, WOOD);
    if (!batch.native) for (let a = 0; a < 8; a++) {
      const angle = a * Math.PI / 4;
      batch.rod([x + dx + Math.cos(angle) * .154, .28, z + dz + Math.sin(angle) * .154],
        [x + dx + Math.cos(angle) * .154, 2.55, z + dz + Math.sin(angle) * .154], .012, 0x5f3d31);
    }
  }
  batch.box(x, 2.91, z, 5.22, .34, 1.83, WOOD);
  batch.box(x, 3.13, z, 5.5, .13, 2.0, 0x9b664d);
  batch.box(x, 3.48, z, 4.99, .58, 1.66, WOOD);
  batch.box(x, 3.81, z, 5.3, .13, 1.90, 0x986146);
  batch.box(x, 4.05, z, 1.85, .42, 1.30, WOOD);
  for (const dx of [-1.80, -.90, 0, .90, 1.80]) batch.box(x + dx, 1.36, z, .21, 2.59, 1.19, 0x583c32);
  for (const dz of [-.94, .94]) for (let i = 0; i < 11; i++) {
    batch.box(x - 2.40 + i * .48, 2.94, z + dz, .045, .26, .035, 0xba896a);
    batch.ellipsoid(x - 2.17 + i * .44, 2.95, z + dz, .105, .10, .027, 0x935d46);
  }
  const bronze = 0x9daea0;
  for (const dx of [-.57, -.19, .19, .57]) {
    batch.ellipsoid(x + dx, 4.45, z, .11, .14, .31, bronze);
    batch.rod([x + dx, 4.5, z - .21], [x + dx, 4.80, z - .31], .075, bronze);
    batch.ellipsoid(x + dx, 4.81, z - .34, .07, .105, .13, bronze);
    for (const dz of [-.20, .20]) batch.rod([x + dx, 4.39, z + dz], [x + dx, 4.17, z + dz], .024, bronze);
  }
  batch.ellipsoid(x, 4.69, z + .41, .10, .28, .09, bronze);
  batch.ellipsoid(x, 5.02, z + .40, .09, .10, .09, bronze);
  batch.rod([x + .19, 4.70, z + .35], [x + .19, 5.35, z + .35], .018, bronze);
  batch.ellipsoid(x + .19, 5.37, z + .35, .18, .055, .035, bronze);
}

export function createCattelanExhibitsV217(native = false): Group {
  const batch = new ExhibitBatch(native);
  hangingFigure(batch); marbleShrouds(batch); openTube(batch); suspendedHorse(batch); doubleBed(batch); gateCabinet(batch);
  const root = batch.finish("Cattelan 2026 photo-informed exhibition sculptures");
  root.userData.exhibitInventory = ["felt-suit coat-rack figure", "four marble shrouds", "open steel tube", "suspended horse", "double self-portrait bed", "brown Brandenburg-Gate cabinet"];
  root.userData.openTube = CATTELAN_EXHIBITS_V217.tube;
  root.userData.exhibitPlacements = CATTELAN_EXHIBITS_V217;
  return root;
}

/** Roof edge at local Y=0, small drummer faces +Z, feet hang below the edge. */
export function createCattelanRooftopFigureV217(native = false): Group {
  const batch = new ExhibitBatch(native);
  batch.ellipsoid(0, .34, -.13, .18, .30, .15, 0x505267);
  batch.ellipsoid(0, .78, -.11, .13, .16, .13, SKIN);
  batch.ellipsoid(0, .85, -.13, .15, .11, .14, HAIR);
  for (const side of [-1, 1]) {
    batch.rod([side * .095, .20, -.10], [side * .12, .07, .21], .075, 0x54646a);
    batch.rod([side * .12, .07, .21], [side * .12, -.28, .24], .069, 0x54646a);
    batch.ellipsoid(side * .12, -.31, .29, .08, .06, .14, 0x818e89);
    batch.rod([side * .17, .53, -.11], [side * .25, .36, .13], .055, 0x505267);
    batch.ellipsoid(side * .245, .38, .18, .046, .05, .046, SKIN);
    batch.rod([side * .25, .39, .18], [side * .09, .45, .37], .012, 0xbf9b68);
  }
  batch.ellipsoid(0, .25, .23, .22, .15, .17, 0xad352b);
  batch.box(0, .42, .23, .46, .04, .36, WHITE);
  batch.box(0, .10, .23, .46, .035, .36, WHITE);
  for (const x of [-.18, -.09, 0, .09, .18]) batch.box(x, .26, .399, .015, .24, .015, WHITE);
  return batch.finish("Cattelan small seated drummer on roof edge");
}
