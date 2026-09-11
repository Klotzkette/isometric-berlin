import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  appendVoxelEnvelope,
  sourceMesh,
  type SourceEnvelopeBlock,
} from "./BebelplatzBuildingShells";
import {
  bebelplatzPartContains,
  bebelplatzPartRoofAt,
} from "./bebelplatzBuildingProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";
import {
  GYMNASIUM_AULA_IDS,
  GYMNASIUM_NEUBAU_PARTS as PARTS,
  GYMNASIUM_NEUBAU_SOURCE,
  HAND_MIT_UHR_PROFILE,
} from "./gymnasiumTiergartenProfile";

type Point = [number, number, number];
const WHITE = 0xe9e7e1,
  BLUE = 0x769fae,
  ROOF = 0x737975;
const GLASS = 0x75929d,
  FRAME = 0x647176,
  RED = 0xa94f38;
const UP = new Vector3(0, 1, 0);

/** One cube buffer and one instanced draw, including the block-native variant. */
function boxBatch(name: string, minecraft: boolean) {
  const matrices: number[] = [],
    colours: number[] = [];
  const matrix = new Matrix4(),
    rotation = new Quaternion(),
    colour = new Color();
  const box = (
    p: Point,
    size: Point,
    tone: number,
    yaw: number | Quaternion = 0,
  ) => {
    matrix.compose(
      new Vector3(...p),
      typeof yaw === "number" ? rotation.setFromAxisAngle(UP, yaw) : yaw,
      new Vector3(...size),
    );
    matrix.toArray(matrices, matrices.length);
    colour.setHex(tone).toArray(colours, colours.length);
  };
  const finish = () => {
    const geometry = new BoxGeometry();
    geometry.deleteAttribute("uv");
    const dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
    const nightMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      flatShading: true,
    });
    const mesh = new InstancedMesh(geometry, dayMaterial, 0);
    mesh.count = matrices.length / 16;
    mesh.instanceMatrix = new InstancedBufferAttribute(
      new Float32Array(matrices),
      16,
    );
    mesh.instanceColor = new InstancedBufferAttribute(
      new Float32Array(colours),
      3,
    );
    mesh.name = name;
    mesh.userData = {
      dayMaterial,
      nightMaterial,
      textureFree: true,
      blockNative: minecraft,
    };
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    return mesh;
  };
  return { box, finish };
}

/** Retain the complete thirteen measured bodies; supplement their exterior faces. */
export function createGymnasiumTiergartenNeubau(minecraft = false): Group {
  const root = new Group();
  root.name = minecraft
    ? "Block-native Gymnasium Tiergarten Neubau"
    : "Gymnasium Tiergarten Neubau source architecture";
  root.userData = {
    textureFree: true,
    keepInMinecraft: minecraft,
    blockNative: minecraft,
    sourceParent: GYMNASIUM_NEUBAU_SOURCE.parent_id,
    hiddenSolidInfill: false,
  };
  const batch = boxBatch(
    "Gymnasium white facades, terracotta strips and blue Aula",
    minecraft,
  );
  const shellMeshes: Mesh[] = [],
    blocks: SourceEnvelopeBlock[] = [];
  for (const part of PARTS) {
    const aula = GYMNASIUM_AULA_IDS.has(part.id.slice(-8));
    const tone = { name: part.id, wall: aula ? BLUE : WHITE, roof: ROOF };
    if (minecraft) appendVoxelEnvelope(part, tone, blocks);
    else shellMeshes.push(sourceMesh([part], tone));
    let area = 0;
    for (let i = 0; i < part.ring.length; i++) {
      const a = part.ring[i],
        b = part.ring[(i + 1) % part.ring.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const side = area > 0 ? 1 : -1;
    for (let i = 0; i < part.ring.length; i++) {
      const a = part.ring[i],
        b = part.ring[(i + 1) % part.ring.length];
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      if (length < 4) continue;
      const yaw = -Math.atan2(dz, dx),
        out = minecraft ? 1.13 : 0.1;
      const point = (u: number, y: number, offset = out): Point => [
        a[0] + (dx * u + dz * side * offset) / length,
        y,
        a[1] + (dz * u - dx * side * offset) / length,
      ];
      const face = (
        u: number,
        y: number,
        w: number,
        h: number,
        d: number,
        tone: number,
        offset = out,
      ) => batch.box(point(u, y, offset), [w, h, d], tone, yaw);
      const exposed = (u: number, y: number) => {
        const [x, , z] = point(u, y, 0.2);
        return !PARTS.some(
          (other) =>
            other !== part &&
            y < other.top_y_m - 0.15 &&
            y > other.ground_y_m &&
            bebelplatzPartContains(other, x, z),
        );
      };
      const roofYs = part.surfaces
        .filter((s) => s.kind === "RoofSurface")
        .flatMap((s) => s.rings.flatMap((r) => r.map((p) => p[1])));
      const flatRoof = Math.max(...roofYs) - Math.min(...roofYs) < 0.2;
      // The Aula retains broad blue wall fields; no invented upper classroom grid.
      const rows = aula
        ? [7.25]
        : [7.25, 10.4, 14.5, 18.6, 22.7, 26.8, 30.9, 34.65, 38.05];
      for (const y of rows) {
        if (y + 1.05 > part.top_y_m - 0.35) continue;
        const n = Math.max(
          1,
          Math.floor((length - 1.4) / (minecraft ? 3.1 : 2.55)),
        );
        for (let j = 0; j < n; j++) {
          const u = 0.7 + ((j + 0.5) * (length - 1.4)) / n;
          if (!exposed(u, y)) continue;
          const [x, , z] = point(u, y, -0.05);
          if (
            y + 1.15 >
            (bebelplatzPartRoofAt(part, x, z) ?? part.top_y_m) - 0.2
          )
            continue;
          // Service volumes retain their photographed narrow upper openings.
          const h = y > 33 ? 1.25 : y < 8 ? 1.9 : 2.25,
            w = ((length - 1.4) / n) * 0.72;
          face(u, y, w, h, 0.1, GLASS);
          face(u + w * 0.3, y, 0.22, h + 0.02, 0.12, RED, out + 0.035);
          for (const edge of [-1, 1])
            face(
              u + (edge * w) / 2,
              y,
              0.075,
              h + 0.08,
              0.14,
              FRAME,
              out + 0.08,
            );
          face(u, y - h / 2, w + 0.14, 0.095, 0.16, FRAME, out + 0.08);
          face(u, y + h * 0.27, w, 0.075, 0.15, FRAME, out + 0.08);
        }
      }
      // A fine continuous coping follows only the source top edge.
      if (flatRoof && exposed(length / 2, part.top_y_m - 0.15))
        face(length / 2, part.top_y_m - 0.11, length, 0.17, 0.2, 0xa7adaa, out);
    }
  }
  // Main entrance on the south-facing low Aula front, within the retained face.
  const a: Point = [-2156.318, 5.2, -96.795],
    b: Point = [-2142.896, 5.2, -90.952];
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    l = Math.hypot(dx, dz),
    yaw = -Math.atan2(dz, dx);
  const entry = (u: number, y: number, out = 0.15): Point => [
    a[0] + (u * dx) / l - (out * dz) / l,
    y,
    a[2] + (u * dz) / l + (out * dx) / l,
  ];
  const centre = l * 0.52,
    offset = minecraft ? 1.15 : 0.16;
  for (const side of [-1, 1]) {
    batch.box(
      entry(centre + side * 0.62, 6.7, offset),
      [1.15, 2.8, 0.12],
      0x476575,
      yaw,
    );
    batch.box(
      entry(centre + side * 0.1, 6.65, offset + 0.12),
      [0.055, 0.75, 0.06],
      WHITE,
      yaw,
    );
  }
  batch.box(entry(centre, 8.25, offset), [3.25, 0.17, 0.65], WHITE, yaw);
  for (const path of letteringStrokePaths("GYMNASIUM TIERGARTEN", 0.48))
    for (let i = 1; i < path.length; i++) {
      const p = entry(
        centre + path[i - 1][0],
        8.95 + path[i - 1][1],
        offset + 0.03,
      );
      const q = entry(centre + path[i][0], 8.95 + path[i][1], offset + 0.03);
      const v = new Vector3(...q).sub(new Vector3(...p)),
        length = v.length();
      batch.box(
        p.map((x, j) => (x + q[j]) / 2) as Point,
        [0.035, length, 0.035],
        WHITE,
        new Quaternion().setFromUnitVectors(UP, v.normalize()),
      );
    }
  for (const block of blocks)
    batch.box(block.position, block.size, block.color);
  if (shellMeshes.length) {
    const geometry = mergeGeometries(shellMeshes.map((m) => m.geometry));
    if (!geometry) throw new Error("School source sheets could not be merged");
    const mesh = new Mesh(geometry, shellMeshes[0].material);
    mesh.name = "Gymnasium thirteen measured Neubau envelopes";
    mesh.userData = {
      ...shellMeshes[0].userData,
      sourcePartIds: PARTS.map((p) => p.id),
      sourceGeometryUnchanged: false,
      rigidDisplayTranslationY: GYMNASIUM_NEUBAU_SOURCE.display_y_translation_m,
    };
    root.add(mesh);
    shellMeshes.forEach((m, i) => {
      m.geometry.dispose();
      if (i) {
        m.userData.dayMaterial.dispose();
        m.userData.nightMaterial.dispose();
      }
    });
  }
  root.add(batch.finish());
  root.add(createHandMitUhr(minecraft));
  return freezeStaticSceneTransforms(root);
}

/** Schmettau's down-gripping hand: wrist above, four hanging fingers and thumb. */
export function createHandMitUhr(minecraft = false): Group {
  const root = new Group(),
    p = HAND_MIT_UHR_PROFILE;
  root.name = minecraft
    ? "Block-native Hand mit Uhr"
    : "Joachim Schmettau Hand mit Uhr";
  root.position.set(...p.world);
  root.rotation.y = p.localYawRadians;
  root.userData = {
    textureFree: true,
    blockNative: minecraft,
    keepInMinecraft: minecraft,
    osmKey: p.osmKey,
    displayHeightM: p.displayHeightM,
    artist: p.artist,
    fingerCount: 5,
  };
  const batch = boxBatch(
      "Hand concrete plinth and red digital clock",
      minecraft,
    ),
    parts: BufferGeometry[] = [];
  const metal = 0xa3adae,
    shadeDirection = new Vector3(-0.45, 0.72, 0.66).normalize();
  const paint = (geometry: BufferGeometry, tone: number) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute("uv");
    const c = new Color(tone),
      base = c.clone(),
      values = new Float32Array(g.getAttribute("position").count * 3);
    const normals = g.getAttribute("normal"),
      normal = new Vector3();
    for (let i = 0; i < values.length; i += 3) {
      const light =
        0.79 +
        0.21 * normal.fromBufferAttribute(normals, i / 3).dot(shadeDirection);
      c.copy(base).multiplyScalar(light).toArray(values, i);
    }
    g.setAttribute("color", new Float32BufferAttribute(values, 3));
    parts.push(g);
  };
  // Photo-confirmed paving, with a deliberately bounded, non-surveyed extent.
  for (let row = 0; row < 6; row++)
    for (let column = 0; column < 6; column++)
      batch.box(
        [(column - 2.5) * 0.6, 0.03, (row - 2.5) * 0.6],
        [0.589, 0.06, 0.589],
        (row + column) % 3 === 0 ? 0xa8aba3 : 0xb4b5ad,
      );
  // Connect the photo-proportioned apron to retained OSM footway 1104087086.
  // Only the endpoint is mapped; the narrow intermediate paving is a display fit.
  const worldDx = -2151.634 - p.world[0];
  const worldDz = -72.277 - p.world[2];
  const c = Math.cos(p.localYawRadians),
    s = Math.sin(p.localYawRadians);
  const endX = c * worldDx - s * worldDz;
  const endZ = s * worldDx + c * worldDz;
  const startX = (endX * 1.5) / endZ,
    startZ = 1.5;
  const dx = endX - startX,
    dz = endZ - startZ;
  const length = Math.hypot(dx, dz),
    rows = Math.ceil(length / 0.6);
  for (let row = 0; row < rows; row++)
    for (let column = -1; column <= 1; column++) {
      const t = (row + 0.5) / rows;
      batch.box(
        [
          startX + t * dx + (column * 0.6 * dz) / length,
          0.03,
          startZ + t * dz - (column * 0.6 * dx) / length,
        ],
        [0.589, 0.06, length / rows - 0.008],
        0xb4b5ad,
        Math.atan2(dx, dz),
      );
    }
  batch.box([0, 0.8, 0], [0.95, 1.6, 0.95], 0xe6e4dd);
  batch.box([0.08, 1.995, 0.015], [1.14, 0.79, 1.14], 0xbe674b, 0.14);
  const skin = (a: Point, s: Point) => {
    if (minecraft) batch.box(a, s, metal);
    else {
      const g = new SphereGeometry(1, 12, 8);
      g.scale(...(s.map((v) => v / 2) as Point));
      g.translate(...a);
      paint(g, metal);
    }
  };
  // Continuous loft keeps a broad palm and the narrower vertically cut wrist.
  if (minecraft)
    for (let k = 0; k < 9; k++) {
      const t = k / 8,
        y = 3.05 + t * 1.175;
      skin(
        [-0.06 + t * 0.035, y, -0.05],
        [1.3 - 0.52 * t, 0.42, 0.57 - 0.13 * t],
      );
    }
  else {
    const vertices: number[] = [],
      indices: number[] = [],
      segments = 16,
      rings = 9;
    for (let k = 0; k < rings; k++)
      for (let j = 0; j < segments; j++) {
        const t = k / (rings - 1),
          a = (j / segments) * Math.PI * 2;
        vertices.push(
          -0.06 + t * 0.035 + (Math.cos(a) * (1.3 - 0.52 * t)) / 2,
          3.0 + t * 1.32,
          -0.05 + (Math.sin(a) * (0.57 - 0.13 * t)) / 2,
        );
      }
    for (let k = 0; k < rings - 1; k++)
      for (let j = 0; j < segments; j++) {
        const a = k * segments + j,
          b = k * segments + ((j + 1) % segments);
        indices.push(a, b + segments, b, a, a + segments, b + segments);
      }
    for (let j = 1; j < segments - 1; j++)
      indices.push(
        0,
        j + 1,
        j,
        (rings - 1) * segments,
        (rings - 1) * segments + j,
        (rings - 1) * segments + j + 1,
      );
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    paint(geometry, metal);
  }
  batch.box([-0.025, 4.33, -0.05], [0.77, 0.34, 0.44], metal);
  const fingers: Point[][] = [
    [
      [-0.56, 3.31, -0.02],
      [-0.74, 2.94, 0.16],
      [-0.63, 2.42, 0.4],
      [-0.48, 2.05, 0.52],
    ],
    [
      [-0.23, 3.27, 0.02],
      [-0.37, 2.91, 0.33],
      [-0.3, 2.35, 0.58],
      [-0.19, 2.03, 0.63],
    ],
    [
      [0.1, 3.22, 0.02],
      [0.01, 2.86, 0.37],
      [0.08, 2.34, 0.65],
      [0.18, 2.11, 0.63],
    ],
    [
      [0.39, 3.15, -0.01],
      [0.35, 2.83, 0.3],
      [0.45, 2.46, 0.58],
      [0.51, 2.22, 0.51],
    ],
    [
      [0.53, 3.47, -0.12],
      [0.78, 3.08, -0.08],
      [0.81, 2.68, 0.15],
      [0.73, 2.4, 0.28],
    ],
  ];
  fingers.forEach((path, index) => {
    const curve = new CatmullRomCurve3(path.map((v) => new Vector3(...v)));
    const radius = index === 4 ? 0.17 : 0.135;
    if (minecraft)
      for (let i = 0; i <= 10; i++) {
        const t = i / 10,
          q = curve.getPoint(t),
          diameter = radius * 2 * (1 - 0.18 * t);
        skin(q.toArray() as Point, [diameter, diameter * 1.05, diameter]);
      }
    else {
      paint(new TubeGeometry(curve, 18, radius, 8, false), metal);
      for (const t of [0, 1])
        skin(curve.getPoint(t).toArray() as Point, [
          radius * 2,
          radius * 2,
          radius * 2,
        ]);
    }
    // Subtle fingernail face, kept metallic rather than transient painted graffiti.
    const q = curve.getPoint(0.92);
    const nailUp = curve.getTangent(0.92).negate();
    const nailNormal = new Vector3(0, 0, 1);
    nailNormal.addScaledVector(nailUp, -nailNormal.dot(nailUp)).normalize();
    const nailAcross = new Vector3().crossVectors(nailUp, nailNormal).normalize();
    const nailRotation = new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(nailAcross, nailUp, nailNormal),
    );
    // Offset the entire nail beyond this digit's radius and align it with the
    // local curve, avoiding intersections at the bent outer fingertips.
    q.addScaledVector(nailNormal, radius + 0.03);
    batch.box(q.toArray() as Point, [0.13, 0.16, 0.035], 0x71787a, nailRotation);
  });
  // The red LED clock is geometric and static; no timer or extra light is needed.
  batch.box([-0.025, 4.245, 0.182], [0.7, 0.29, 0.045], 0x222b2d);
  const digits = [1, 9, 1, 9],
    masks = [0x06, 0x6f];
  const segments: [number, number, number, number][] = [
    [0, 0.085, 0.095, 0.017],
    [0.054, 0.043, 0.017, 0.07],
    [0.054, -0.043, 0.017, 0.07],
    [0, -0.085, 0.095, 0.017],
    [-0.054, -0.043, 0.017, 0.07],
    [-0.054, 0.043, 0.017, 0.07],
    [0, 0, 0.095, 0.017],
  ];
  digits.forEach((digit, j) =>
    segments.forEach(([x, y, w, h], i) => {
      if ((masks[digit === 1 ? 0 : 1] & (1 << i)) !== 0)
        batch.box(
          [-0.285 + j * 0.165 + x, 4.245 + y, 0.21],
          [w, h, 0.016],
          0xff4d34,
        );
    }),
  );
  for (const y of [-0.042, 0.042])
    batch.box([0.04, 4.245 + y, 0.211], [0.022, 0.025, 0.018], 0xff4d34);
  root.add(batch.finish());
  if (parts.length) {
    const geometry = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    if (!geometry) throw new Error("Hand geometry could not be merged");
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.7,
      metalness: 0.18,
    });
    const mesh = new Mesh(geometry, dayMaterial);
    mesh.name = "Hand palm and five curved digits";
    mesh.userData = { dayMaterial, nightMaterial, textureFree: true };
    root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
