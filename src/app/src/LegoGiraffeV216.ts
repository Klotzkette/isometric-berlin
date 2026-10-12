import {
  BoxGeometry, Color, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh,
  Matrix4, MeshBasicMaterial, MeshStandardMaterial,
} from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Current sculpture installed in May 2022, rather than the older brown-spotted figure. */
export const LEGO_GIRAFFE_V216_PROFILE = {
  name: "LEGOLAND current rainbow LEGO giraffe",
  heightM: 6,
  photoDate: "2022-07-17",
  geometryStatus: "Original procedural recognition model; proportions and individual colour patches are photo-informed display estimates, not a measured brick inventory",
  reference: {
    url: "https://commons.wikimedia.org/wiki/File:Lego_Giraffe_(Mai_2022)_Legoland_Discovery_Centre_Berlin_02.jpg",
    author: "Singlespeedfahrer",
    license: "CC0-1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    use: "Visual reference only; no photograph or texture is bundled",
  },
  heightSource: "https://www.zeit.de/news/2022-05/18/potsdamer-platz-hat-eine-neue-giraffe",
  localFrame: "Feet at Y=0; +Y up; body along Z; head towards -Z; placement is supplied by caller",
  maxInstances: { drawn: 1500, minecraft: 500 },
} as const;

const YELLOW = 0xffcf06, ORANGE = 0xff8b12, RED = 0xf23b20;
const CYAN = 0x4dd7e8, BLUE = 0x0754d9, PURPLE = 0x682fc1, GREEN = 0x079650;
const BLACK = 0x17171b, WHITE = 0xfffbea;
type Block = [number, number, number, number, number, number, number];
type Patch = [number, number, number, number, number]; // y, z, vertical radius, longitudinal radius, colour

// Broad colour islands seen in the free reference, not a claim to reproduce every brick.
const BODY_PATCHES: Patch[] = [
  [3.23, -.63, .22, .26, RED], [3.00, -.31, .19, .23, PURPLE],
  [2.85, -.78, .25, .26, ORANGE], [2.72, -.02, .25, .24, BLUE],
  [2.94, .40, .20, .32, ORANGE], [2.76, .93, .20, .29, ORANGE],
  [2.48, .45, .23, .23, CYAN], [2.35, .94, .18, .28, PURPLE],
  [2.45, -.57, .18, .20, PURPLE], [3.12, .18, .17, .20, RED],
];
const NECK_PATCHES: Patch[] = [
  [3.42, -.48, .20, .24, PURPLE], [3.72, -.76, .19, .18, BLUE],
  [4.06, -.58, .18, .24, CYAN], [4.36, -.84, .19, .19, BLUE],
  [4.63, -.62, .16, .23, GREEN], [4.94, -.84, .14, .20, GREEN],
  [5.15, -.99, .14, .23, GREEN],
];

function ellipsoid(x: number, y: number, z: number, cx: number, cy: number, cz: number,
  rx: number, ry: number, rz: number): boolean {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1;
}

/** Union of small recognition volumes; only exterior cells are emitted below. */
function occupied(x: number, y: number, z: number): boolean {
  if (ellipsoid(x, y, z, 0, 2.73, .16, .49, .61, 1.04)
    || ellipsoid(x, y, z, 0, 2.95, -.53, .54, .64, .49)
    || ellipsoid(x, y, z, 0, 2.60, .97, .39, .48, .41)
    || ellipsoid(x, y, z, 0, 5.40, -.86, .39, .29, .47)
    || ellipsoid(x, y, z, 0, 5.28, -1.28, .33, .20, .44)) return true;
  if (y >= 2.90 && y <= 5.34) {
    const t = (y - 2.9) / 2.44;
    if ((x / (.31 - .10 * t)) ** 2 + ((z + .56 + .23 * t) / (.34 - .11 * t)) ** 2 <= 1) return true;
  }
  if (y >= .22 && y <= 2.80) {
    for (const side of [-1, 1]) for (const rear of [false, true]) {
      const t = Math.min(1, y / 2.6);
      const cx = side * (.40 - .035 * t);
      const cz = rear ? 1.10 - .28 * t + .11 * Math.sin(t * Math.PI) : -.67;
      const radius = .105 + .035 * t + .054 * Math.exp(-(((y - 1.18) / .15) ** 2))
        + .035 * Math.exp(-(((y - .46) / .11) ** 2)) + .07 * Math.max(0, (y - 1.6) / 1.2);
      if (((x - cx) / radius) ** 2 + ((z - cz) / (radius * 1.15)) ** 2 <= 1) return true;
    }
  }
  return false;
}

function surfaceColour(x: number, y: number, z: number): number {
  // Surface membership is tested before colour, so a patch never creates floating geometry.
  if (y > 5.10 && y < 5.31 && z < -1.53) return RED;
  const patches = y >= 3.34 ? NECK_PATCHES : BODY_PATCHES;
  if (y >= 2.2) {
    for (const [py, pz, ry, rz, colour] of patches) {
      const sideShift = x < 0 ? .06 : -.025;
      const cx = y >= 3.34 ? .23 : .45;
      const rx = y >= 3.34 ? .14 : .22;
      if (((Math.abs(x) - cx) / rx) ** 2 + ((y - py + sideShift) / ry) ** 2
        + ((z - pz) / (rz * .78)) ** 2 < 1) return colour;
    }
    // Separate front-neck spots leave a yellow boundary against the side islands.
    if (y > 3.34 && Math.abs(x) < .14) {
      const band = Math.floor((y - 3.34) / .42), py = 3.53 + band * .42;
      const frontZ = -.56 - .23 * ((y - 2.9) / 2.44) - (.34 - .11 * ((y - 2.9) / 2.44));
      if ((x / .14) ** 2 + ((y - py) / .15) ** 2 + ((z - frontZ) / .11) ** 2 < 1) {
        return [PURPLE, CYAN, BLUE, GREEN, GREEN][Math.min(band, 4)];
      }
    }
  } else if (y > .78) {
    // The photographed legs have large purple, cyan and red islands above yellow shins.
    const band = Math.floor((y - .78) / .30);
    const middle = .93 + band * .30;
    const legZ = z > 0 ? 1.10 - .28 * Math.min(1, y / 2.6) + .11 * Math.sin(Math.min(1, y / 2.6) * Math.PI) : -.67;
    const sideIsland = ((Math.abs(x) - .51) / .13) ** 2 + ((z - legZ) / .115) ** 2;
    const frontIsland = ((Math.abs(x) - .38) / .09) ** 2 + ((z - legZ + .14) / .08) ** 2;
    if (((y - middle) / .12) ** 2 + Math.min(sideIsland, frontIsland) < 1) {
      return [BLUE, RED, PURPLE, CYAN, PURPLE][(band + (z > 0 ? 2 : 0)) % 5];
    }
  }
  return YELLOW;
}

function buildBlocks(minecraft: boolean): { blocks: Block[]; occupiedCells: number; surfaceCells: number } {
  // Native samples its own coarser volume; it never voxelizes or keeps the drawn instance payload.
  const cell = minecraft ? .16 : .10, course = minecraft ? .20 : .10;
  const nx = Math.ceil(.75 / cell) * 2, nz = Math.ceil(2 / cell) * 2, ny = Math.ceil(5.7 / course);
  const voxels = new Uint8Array(nx * ny * nz);
  const offset = (i: number, j: number, k: number) => (j * nz + k) * nx + i;
  const has = (i: number, j: number, k: number) => i >= 0 && i < nx && j >= 0 && j < ny
    && k >= 0 && k < nz && voxels[offset(i, j, k)] !== 0;
  const px = (i: number) => (i + .5 - nx / 2) * cell;
  const pz = (k: number) => (k + .5 - nz / 2) * cell;
  let occupiedCells = 0, surfaceCells = 0;
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    if (occupied(px(i), (j + .5) * course, pz(k))) { voxels[offset(i, j, k)] = 1; occupiedCells++; }
  }
  const exterior = (i: number, j: number, k: number) => has(i, j, k)
    && (!has(i - 1, j, k) || !has(i + 1, j, k) || !has(i, j - 1, k)
      || !has(i, j + 1, k) || !has(i, j, k - 1) || !has(i, j, k + 1));
  const blocks: Block[] = [];
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    for (let i = 0; i < nx;) {
      if (!exterior(i, j, k)) { i++; continue; }
      const start = i, y = (j + .5) * course, z = pz(k);
      const colour = surfaceColour(px(i), y, z);
      do { surfaceCells++; i++; } while (i < nx && exterior(i, j, k)
        && surfaceColour(px(i), y, z) === colour);
      blocks.push([(px(start) + px(i - 1)) / 2, y, z, (i - start) * cell, course, cell, colour]);
    }
  }
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, colour: number) => {
    blocks.push([x, y, z, w, h, d, colour]);
  };
  for (const side of [-1, 1]) {
    for (const z of [-.67, 1.10]) {
      box(side * .40, .08, z - .015, .32, .16, .40, BLACK);
      box(side * .40, .20, z, .29, .08, .32, CYAN);
    }
    // Pointed ears, yellow stem and black cap of each ossicone remain distinct at both resolutions.
    const earSteps = minecraft ? 3 : 5;
    for (let i = 0; i < earSteps; i++) {
      const t = i / earSteps;
      box(side * (.36 + .56 * (t + .5 / earSteps)), 5.47 + t * .14, -.68,
        .56 / earSteps, .20 * (1 - t) + .05, .38 * (1 - t) + .07, YELLOW);
    }
    box(side * .23, 5.69, -.61, .12, .42, .14, YELLOW);
    box(side * .23, 5.94, -.61, .20, .12, .20, BLACK);
    // Layered square eyes sit against the cheek's actual exterior, with dark brows above.
    box(side * .345, 5.43, -1.00, .10, .25, .26, BLACK);
    box(side * .401, 5.44, -1.04, .03, .13, .14, WHITE);
    box(side * .421, 5.425, -1.075, .025, .095, .085, BLACK);
    box(side * .442, 5.464, -1.095, .025, .034, .037, WHITE);
    box(side * .335, 5.59, -1.01, .16, .075, .33, BLACK);
    if (!minecraft) for (let lash = 0; lash < 3; lash++) {
      box(side * (.38 + lash * .022), 5.64, -.92 - lash * .09, .07, .06, .06, BLACK);
    }
  }
  // The nose/lip is a short connected stepped rim, not the former large ochre cuboid.
  box(0, 5.24, -1.655, .36, .085, .09, RED);
  box(0, 5.29, -1.61, .21, .065, .10, RED);
  // Narrow tail with black tip; original display interpretation of the rear-facing detail.
  const tailSteps = minecraft ? 5 : 9;
  for (let i = 0; i < tailSteps; i++) {
    const t = i / (tailSteps - 1);
    box(0, 2.70 - .69 * t, 1.23 + .27 * Math.min(1, t * 2), .11,
      .69 / (tailSteps - 1) + .035, .12, i === tailSteps - 1 ? BLACK : YELLOW);
  }
  return { blocks, occupiedCells, surfaceCells };
}

/** One static, texture-free batch; its caller owns geographic position and orientation. */
export function createLegoGiraffeV216(minecraft = false): Group {
  const { blocks, occupiedCells, surfaceCells } = buildBlocks(minecraft);
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  // One reusable cube carries subdued face contrast; no brick-sized materials or textures.
  const normals = geometry.getAttribute("normal"), faceTints = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    const shade = normals.getY(i) > 0 ? 1 : normals.getY(i) < 0 ? .70 : normals.getX(i) !== 0 ? .89 : .78;
    faceTints.fill(shade, i * 3, i * 3 + 3);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(faceTints, 3));
  const day = new MeshBasicMaterial({ vertexColors: true });
  const night = new MeshStandardMaterial({ roughness: .76, vertexColors: true });
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(blocks.length * 16), colours = new Float32Array(blocks.length * 3);
  const transform = new Matrix4(), tint = new Color();
  blocks.forEach(([x, y, z, w, h, d, colour], index) => {
    transform.makeScale(w, h, d).setPosition(x, y, z).toArray(matrices, index * 16);
    tint.setHex(colour).toArray(colours, index * 3);
  });
  mesh.count = blocks.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colours, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = "LEGO giraffe yellow stepped surface, rainbow spots, face, ears, horns, tail and four feet";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: minecraft, nativeMinecraft: minecraft, keepInMinecraft: minecraft };
  const root = new Group();
  root.name = LEGO_GIRAFFE_V216_PROFILE.name + (minecraft ? " native" : " drawn");
  root.userData = {
    legoGiraffeV216: true, heightM: 6, physicalHeightM: 6,
    geometryStatus: LEGO_GIRAFFE_V216_PROFILE.geometryStatus,
    sourceUrls: [LEGO_GIRAFFE_V216_PROFILE.reference.url, LEGO_GIRAFFE_V216_PROFILE.heightSource],
    sourceCredit: LEGO_GIRAFFE_V216_PROFILE.reference,
    fullStaticDetailOnTouch: true, textureFree: true,
    blockNative: minecraft, nativeMinecraft: minecraft, keepInMinecraft: minecraft,
    instanceCount: blocks.length, occupiedCells, surfaceCells,
    interiorCellsOmitted: occupiedCells - surfaceCells,
    gpuBytes: matrices.byteLength + colours.byteLength + 24 * 3 * 4 * 3 + 36 * 2,
  };
  root.add(mesh);
  // Leave the root movable so callers can place it without a mandatory updateMatrix call.
  freezeStaticSceneTransforms(mesh);
  return root;
}
