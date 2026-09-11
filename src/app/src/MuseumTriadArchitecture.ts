import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  ShapeUtils,
  Vector2,
  Vector3,
} from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";
import {
  MUSEUM_TRIAD_SOURCES,
  MUSEUM_TRIAD_GROUP_NAME,
  MINECRAFT_MUSEUM_TRIAD_GROUP_NAME,
  MUSEUM_TRIAD_PROFILE,
  museumTriadContains,
  museumTriadPartRoofAt,
  nationalgalerieLocal,
  NATIONALGALERIE_FRAME,
} from "./museumTriadProfile";
import type { SourcePart } from "./spreeRecognitionProfile";
type P = [number, number, number];
type V = [number, number];
type Kind = "box" | "column";
const LIGHT = 0xd8cdb8,
  DARK = 0x998b76,
  GLASS = 0x526b72,
  RED = 0x713f3d,
  GREEN = 0x57796b;
const TONES = [0xb3ac99, 0xc5bca9, 0xc9ad8c];
class Builder {
  batches = new Map<Kind, { matrix: number[]; color: number }[]>();
  constructor(
    readonly minecraft: boolean,
    readonly mobile: boolean,
  ) {}
  add(kind: Kind, p: P, s: P, color: number, q = new Quaternion()): void {
    const a = this.batches.get(kind) ?? [];
    a.push({
      matrix: new Matrix4()
        .compose(new Vector3(...p), q, new Vector3(...s))
        .toArray(),
      color,
    });
    this.batches.set(kind, a);
  }
  box(p: P, s: P, color: number, yaw = 0): void {
    this.add(
      "box",
      p,
      s,
      color,
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw),
    );
  }
  beam(a: P, b: P, w: number, color: number): void {
    const d = new Vector3(...b).sub(new Vector3(...a));
    const l = d.length();
    if (l < 1e-4) return;
    if (this.minecraft) {
      const n = Math.ceil(l / (this.mobile ? 1.5 : 0.8));
      for (let i = 0; i < n; i++)
        this.box(
          a.map((v, k) => v + ((b[k] - v) * (i + 0.5)) / n) as P,
          [
            Math.max(w, Math.abs(b[0] - a[0]) / n),
            Math.max(w, Math.abs(b[1] - a[1]) / n),
            Math.max(w, Math.abs(b[2] - a[2]) / n),
          ],
          color,
        );
    } else
      this.add(
        "box",
        a.map((v, k) => (v + b[k]) / 2) as P,
        [w, l, w],
        color,
        new Quaternion().setFromUnitVectors(
          new Vector3(0, 1, 0),
          d.multiplyScalar(1 / l),
        ),
      );
  }
  column(p: P, w: number, h: number, color: number): void {
    if (this.minecraft) {
      const n = Math.ceil(h / 2.3);
      for (let i = 0; i < n; i++)
        this.box(
          [p[0], p[1] - h / 2 + ((i + 0.5) * h) / n, p[2]],
          [w, h / n, w],
          color,
        );
    } else this.add("column", p, [w, h, w], color);
  }
}
function materialPair(vertexColors = false) {
  return [
    new MeshBasicMaterial({ color: 0xffffff, vertexColors, side: DoubleSide }),
    new MeshStandardMaterial({
      color: 0xffffff,
      vertexColors,
      side: DoubleSide,
      roughness: 0.86,
      flatShading: true,
    }),
  ] as const;
}
function setMaterials(mesh: Mesh, pair: ReturnType<typeof materialPair>): void {
  mesh.userData.dayMaterial = pair[0];
  mesh.userData.nightMaterial = pair[1];
  mesh.userData.moonlitMaterial = pair[1];
  mesh.userData.textureFree = true;
}
function finish(builder: Builder, root: Group): void {
  for (const [kind, rows] of builder.batches) {
    const g =
      kind === "box"
        ? new BoxGeometry(1, 1, 1)
        : new CylinderGeometry(0.46, 0.5, 1, builder.mobile ? 8 : 12);
    g.deleteAttribute("uv");
    const pair = materialPair();
    const mesh = new InstancedMesh(g, pair[0], 0),
      matrices = new Float32Array(rows.length * 16),
      colors = new Float32Array(rows.length * 3),
      c = new Color();
    rows.forEach((r, i) => {
      matrices.set(r.matrix, i * 16);
      c.setHex(r.color).toArray(colors, i * 3);
    });
    mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
    mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
    mesh.count = rows.length;
    mesh.name = `Museum triad ${builder.minecraft ? "native blocks" : "architectural details"} ${kind}`;
    setMaterials(mesh, pair);
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    root.add(mesh);
  }
}
function ng(u: number, y: number, v: number): P {
  const f = NATIONALGALERIE_FRAME,
    c = Math.cos(f.yaw),
    s = Math.sin(f.yaw);
  return [f.x + c * u + s * v, y, f.z - s * u + c * v];
}
function surfaceMesh(): Mesh {
  const positions: number[] = [],
    colors: number[] = [];
  const tint = new Color();
  MUSEUM_TRIAD_SOURCES.forEach((source, which) => {
    for (const part of source.parts)
      for (const s of part.surfaces ?? []) {
        const ring = s.rings[0],
          normal = new Vector3();
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length];
          normal.x += (a[1] - b[1]) * (a[2] + b[2]);
          normal.y += (a[2] - b[2]) * (a[0] + b[0]);
          normal.z += (a[0] - b[0]) * (a[1] + b[1]);
        }
        const axis =
          Math.abs(normal.y) > Math.max(Math.abs(normal.x), Math.abs(normal.z))
            ? 1
            : Math.abs(normal.x) > Math.abs(normal.z)
              ? 0
              : 2;
        const project = (p: number[]) =>
          axis === 1
            ? new Vector2(p[0], p[2])
            : axis === 0
              ? new Vector2(p[2], p[1])
              : new Vector2(p[0], p[1]);
        // Cut the coarse upper portico enclosure into its retained lower base,
        // actual inner wall and entablature. The space between them stays open.
        const clip = (
          r: number[][],
          signed: (p: number[]) => number,
        ): number[][] => {
          const out: number[][] = [];
          for (let i = 0; i < r.length; i++) {
            const a = r[i],
              c = r[(i + 1) % r.length],
              da = signed(a),
              dc = signed(c);
            if (da >= 0) out.push(a);
            if (da >= 0 !== dc >= 0) {
              const t = da / (da - dc);
              out.push(a.map((v, k) => v + (c[k] - v) * t));
            }
          }
          return out;
        };
        const variants =
          which === 2 && s.kind === "WallSurface"
            ? [
                clip(ring, (p) => 25.2 - nationalgalerieLocal(p[0], p[2])[1]),
                clip(
                  clip(ring, (p) => nationalgalerieLocal(p[0], p[2])[1] - 25.2),
                  (p) => 13.54 - p[1],
                ),
                clip(
                  clip(ring, (p) => nationalgalerieLocal(p[0], p[2])[1] - 25.2),
                  (p) => p[1] - 32.2,
                ),
              ]
            : [ring];
        for (const r of variants) {
          if (r.length < 3) continue;
          const rings = [r];
          const triangles = ShapeUtils.triangulateShape(
              rings[0].map(project),
              rings.slice(1).map((r) => r.map(project)),
            ),
            flat = rings.flat();
          const roof = s.kind === "RoofSurface";
          tint.setHex(
            roof
              ? which === 0
                ? 0xa0aaa8
                : which === 1
                  ? 0x929993
                  : 0xb6c3be
              : TONES[which],
          );
          if (!roof)
            tint.multiplyScalar(
              0.91 + 0.09 * Math.abs(normal.clone().normalize().x),
            );
          for (const tri of triangles)
            for (const i of tri) {
              positions.push(...flat[i]);
              colors.push(tint.r, tint.g, tint.b);
            }
        }
      }
  });
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const pair = materialPair(true),
    mesh = new Mesh(g, pair[0]);
  mesh.name = "Museum triad original LoD2 surfaces with open portico";
  setMaterials(mesh, pair);
  return mesh;
}
function signedArea(r: number[][]): number {
  return (
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2
  );
}
function facadeRuns(
  parts: SourcePart[],
  visitor: (a: V, b: V, n: V, part: SourcePart) => void,
): void {
  for (const part of parts) {
    const ring = part.ring,
      sign = signedArea(ring) > 0 ? 1 : -1;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i] as V,
        b = ring[(i + 1) % ring.length] as V,
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        l = Math.hypot(dx, dz);
      if (l < 2.4) continue;
      const n: V = [(sign * dz) / l, (-sign * dx) / l],
        mid: V = [
          (a[0] + b[0]) / 2 + n[0] * 0.45,
          (a[1] + b[1]) / 2 + n[1] * 0.45,
        ];
      if (
        parts.some(
          (p) =>
            p !== part &&
            museumTriadContains(p, ...mid) &&
            p.top_y_m >= part.top_y_m - 1,
        )
      )
        continue;
      visitor(a, b, n, part);
    }
  }
}
function facades(b: Builder): void {
  MUSEUM_TRIAD_SOURCES.forEach((source, which) =>
    facadeRuns(source.parts, (a, end, n, part) => {
      const l = Math.hypot(end[0] - a[0], end[1] - a[1]),
        yaw = -Math.atan2(end[1] - a[1], end[0] - a[0]);
      const at = (u: number, y: number, o = 0.16): P => [
        a[0] + ((end[0] - a[0]) * u) / l + n[0] * o,
        y,
        a[1] + ((end[1] - a[1]) * u) / l + n[1] * o,
      ];
      const eaves = Math.min(
        ...(part.surfaces ?? [])
          .filter((s) => s.kind === "RoofSurface")
          .flatMap((s) => s.rings.flatMap((r) => r.map((p) => p[1]))),
      );
      if (eaves < 12) return;
      const ys =
        which === 2
          ? [7.6, 11.1]
          : which === 0
            ? [5.3, 12.2, 20.2]
            : [9.2, 17.0, 24.7];
      const count = Math.max(1, Math.round(l / (which === 0 ? 4.35 : 4.7)));
      for (const y of [part.ground_y_m + 1.2, eaves - 1.1, eaves - 0.3])
        b.box(
          at(l / 2, y, 0.24),
          [l, 0.35, 0.35],
          which === 2 ? 0xbba084 : LIGHT,
          yaw,
        );
      for (let i = 0; i < count; i++) {
        const u = ((i + 0.5) * l) / count,
          p = at(u, 0);
        if (which === 2 && nationalgalerieLocal(p[0], p[2])[1] > 25.1) continue;
        // The high central Pergamon hall is deliberately almost windowless.
        const [localU] = nationalgalerieLocal(p[0], p[2]);
        const blind =
          (which === 0 && part.id === "DEBE3DKEaAKJ8HLe") ||
          (which === 1 && part.id === "DEBE3DDnx0Lx4Dpf") ||
          (which === 0 &&
            ((part.id === "DEBE3DE5tHN43NVQ" && localU < -153) ||
              (part.id === "DEBE3DiGGe7UaHKY" && localU < -150)));
        for (const y of ys) {
          if (y + 2.2 > eaves || blind) continue;
          const w = which === 2 ? 1.25 : which === 0 ? 1.65 : 2.0,
            h = which === 2 ? 2.1 : 3.45;
          b.box(at(u, y, 0.2), [w, h, 0.15], GLASS, yaw);
          for (const sign of [-1, 1])
            b.box(
              at(u + sign * (w / 2 + 0.12), y, 0.3),
              [0.19, h + 0.38, 0.22],
              LIGHT,
              yaw,
            );
          b.box(
            at(u, y + h / 2 + 0.18, 0.35),
            [w + 0.6, 0.28, 0.42],
            LIGHT,
            yaw,
          );
          b.box(
            at(u, y - h / 2 - 0.12, 0.31),
            [w + 0.4, 0.23, 0.34],
            LIGHT,
            yaw,
          );
          if (!b.mobile) b.box(at(u, y, 0.35), [0.09, h, 0.1], DARK, yaw);
        }
        if (which === 0 && !blind) {
          b.box(
            at(u + (l / count) * 0.47, 15.1, 0.42),
            [0.6, 20.5, 0.52],
            LIGHT,
            yaw,
          );
          b.box(
            at(u + (l / count) * 0.47, 25.35, 0.5),
            [0.95, 0.5, 0.72],
            LIGHT,
            yaw,
          );
        }
        if (which === 1 && !b.mobile) {
          for (const y of [12.1, 20.5])
            b.box(at(u, y, 0.28), [l / count - 0.2, 0.09, 0.1], DARK, yaw);
          if (i % 3 === 0)
            b.box(at(u + 1.5, 18.2, 0.08), [0.56, 1.1, 0.08], 0xafaa94, yaw);
        }
      }
    }),
  );
}
function ngBox(
  b: Builder,
  u: number,
  y: number,
  v: number,
  w: number,
  h: number,
  d: number,
  color: number,
): void {
  b.box(ng(u, y, v), [w, h, d], color, NATIONALGALERIE_FRAME.yaw);
}
function ngColumn(b: Builder, u: number, v: number): void {
  b.column(ng(u, 21.87, v), 1.15, 15.0, 0xd2b692);
  for (const [y, w, h] of [
    [14.0, 1.55, 0.45],
    [14.4, 1.3, 0.28],
    [29.2, 1.62, 0.68],
    [29.65, 1.86, 0.36],
  ])
    ngBox(b, u, y, v, w, h, w, 0xd2b692);
  if (!b.mobile)
    for (const s of [-1, 1])
      for (const t of [-1, 1])
        ngBox(b, u + s * 0.58, 28.95, v + t * 0.58, 0.42, 0.8, 0.42, 0xbda282);
}
function figure(b: Builder, p: P, h: number, color: number): void {
  b.column([p[0], p[1] + h * 0.47, p[2]], h * 0.28, h * 0.65, color);
  b.box([p[0], p[1] + h * 0.89, p[2]], [h * 0.23, h * 0.25, h * 0.25], color);
  for (const s of [-1, 1])
    b.beam(
      [p[0] + s * h * 0.13, p[1] + h * 0.66, p[2]],
      [p[0] + s * h * 0.24, p[1] + h * 0.34, p[2] + h * 0.08],
      h * 0.11,
      color,
    );
}
function nationalgalerie(b: Builder): void {
  for (let i = 0; i < 8; i++) ngColumn(b, -15.0 + i * 4.14, 32.3);
  for (const side of [-1, 1])
    for (let i = 0; i < 14; i++)
      ngColumn(b, side < 0 ? -16.58 : 15.3, 25.9 - i * 4.25);
  for (let i = 0; i < 11; i++) {
    const angle = Math.PI * (i / 10);
    ngColumn(b, -0.5 + 13 * Math.cos(angle), -30.3 - 13 * Math.sin(angle));
  }
  ngBox(b, -0.5, 23.5, 25.33, 30.6, 10.5, 0.3, RED);
  ngBox(b, -0.5, 16.5, 25.44, 30.6, 2.1, 0.3, 0xc5b393);
  ngBox(b, -0.5, 15.8, 25.64, 2.8, 4.5, 0.22, 0x2e393b);
  for (const y of [30.0, 31.0, 32.15])
    ngBox(b, -0.5, y, 33.27, 32.7, 0.46, 0.78, 0xcbb190);
  b.beam(ng(-17, 32.45, 33.45), ng(-0.5, 35.97, 33.45), 0.3, 0xc7a987);
  b.beam(ng(-0.5, 35.97, 33.45), ng(15.6, 32.45, 33.45), 0.3, 0xc7a987);
  for (let i = 0; i < 24; i++) {
    const u = -16.6 + ((i + 0.5) * 32.2) / 24,
      h = 3.4 * (1 - Math.abs((u + 0.5) / 16.1));
    if (h > 0.05) ngBox(b, u, 32.4 + h / 2, 33.23, 32.2 / 24, h, 0.3, 0xb8a084);
  }
  for (let i = -5; i <= 5; i++)
    figure(
      b,
      ng(i * 2.1, 32.5, 33.52),
      Math.max(0.5, 2.15 - Math.abs(i) * 0.3),
      0xd0b794,
    );
  figure(b, ng(-0.5, 36.0, 31.9), 2.65, 0x82745f);
  figure(b, ng(-1.9, 36, 31.9), 2.1, 0x82745f);
  figure(b, ng(0.9, 36, 31.9), 2.1, 0x82745f);
  if (!b.mobile)
    for (let i = 0; i < 58; i++)
      ngBox(b, -16.2 + i * 0.56, 31.7, 33.74, 0.21, 0.32, 0.34, 0x9f876f);
  // Two rising side flights retain a free approach at the central entrance.
  const n = b.mobile ? 14 : 24;
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const u = 5.2 + ((i + 0.5) * 18.5) / n;
      ngBox(
        b,
        side * u,
        4.14 + ((i + 0.5) * 4.7) / n / 2,
        51.75,
        18.5 / n + 0.01,
        ((i + 0.5) * 4.7) / n,
        5.3,
        TONES[2],
      );
      const upper = 8.84 + ((n - i - 0.5) * 4.7) / n;
      ngBox(
        b,
        side * u,
        (4.14 + upper) / 2,
        39.35,
        18.5 / n + 0.01,
        upper - 4.14,
        6.5,
        TONES[2],
      );
    }
    ngBox(b, side * 20.85, (4.14 + 8.84) / 2, 45.85, 5.7, 4.7, 6.5, TONES[2]);
    for (const [v, ya, yb] of [
      [54.45, 5.25, 9.95],
      [42.66, 14.65, 9.95],
    ]) {
      b.beam(ng(side * 5.2, ya, v), ng(side * 23.7, yb, v), 0.42, LIGHT);
      for (let i = 0; i < 12; i++) {
        const u = 5.2 + (i * 18.5) / 11,
          y = ya + ((yb - ya) * i) / 11;
        ngBox(b, side * u, y - 0.4, v, 0.22, 0.8, 0.3, 0xb89e80);
      }
    }
  }
  ngBox(b, -0.5, 13.23, 34.65, 32.5, 0.62, 3.1, TONES[2]);
  for (const sign of [-1, 1])
    ngBox(b, -0.5 + sign * 3.4, 8.6, 40.15, 3.1, 8.9, 9.1, TONES[2]);
  ngBox(b, -0.5, 12.33, 40.15, 3.7, 2.4, 9.1, TONES[2]);
  ngBox(b, -0.5, 7.4, 36.0, 3.15, 5.4, 0.4, 0x2e3535);
  for (const s of [-1, 1])
    ngBox(b, -0.5 + s * 1.85, 7.45, 44.98, 0.4, 6.1, 0.5, LIGHT);
  for (let i = 0; i < 13; i++) {
    const t = (i / 12) * Math.PI;
    ngBox(
      b,
      -0.5 + 1.83 * Math.cos(t),
      10.18 + 1.83 * Math.sin(t),
      44.98,
      0.48,
      0.48,
      0.5,
      LIGHT,
    );
  }
  // Calandrelli's mounted king, with four seated base figures.
  ngBox(b, -0.5, 14.48, 40.1, 4.4, 2.1, 3.3, 0x9c8167);
  ngBox(b, -0.5, 15.8, 40.1, 4.9, 0.5, 3.8, GREEN);
  ngBox(b, -0.5, 18.2, 40.1, 1.15, 1.4, 3.2, GREEN);
  b.beam(ng(-0.5, 18.4, 41.0), ng(-0.5, 20.0, 41.65), 0.75, GREEN);
  ngBox(b, -0.5, 20.0, 42.0, 0.65, 0.7, 1.12, GREEN);
  for (const s of [-1, 1])
    for (const v of [39.0, 41.15])
      b.beam(
        ng(-0.5 + s * 0.42, 18, v),
        ng(-0.5 + s * 0.48, 16.1, v + 0.22),
        0.25,
        GREEN,
      );
  figure(b, ng(-0.5, 18.95, 39.65), 2.2, GREEN);
  for (const s of [-1, 1])
    for (const v of [39.3, 41.0])
      figure(b, ng(-0.5 + s * 2.15, 13.95, v), 1.75, GREEN);
  const paths = letteringStrokePaths("DER DEUTSCHEN KUNST MDCCCLXXI", 0.45);
  for (const path of paths)
    for (let i = 1; i < path.length; i++)
      b.beam(
        ng(path[i - 1][0] - 0.5, 31.13 + path[i - 1][1], 33.71),
        ng(path[i][0] - 0.5, 31.13 + path[i][1], 33.71),
        b.minecraft ? 0.1 : 0.055,
        0xb19b57,
      );
}
function museumFronts(b: Builder): void {
  // Three tall bays articulate both ends of the Neues Museum's cross hall.
  for (const [u, sign] of [
    [-97.4, -1],
    [-56.85, 1],
  ]) {
    for (const v of [39.25, 44.65, 50.05])
      for (const [y, h] of [
        [12.1, 7.0],
        [24.0, 10.2],
      ]) {
        ngBox(b, u + sign * 0.24, y, v, 0.25, h, 4.25, GLASS);
        for (const dy of [-h / 2, h / 2])
          ngBox(b, u + sign * 0.42, y + dy, v, 0.55, 0.3, 4.6, LIGHT);
        if (!b.mobile)
          for (const dy of [-h / 4, 0, h / 4])
            ngBox(b, u + sign * 0.46, y + dy, v, 0.14, 0.11, 4.1, DARK);
      }
    for (const v of [36.55, 41.95, 47.35, 52.75]) {
      b.column(ng(u + sign * 0.65, 24, v), 0.72, 10.5, LIGHT);
      ngBox(b, u + sign * 0.67, 29.25, v, 1.04, 0.65, 1.1, LIGHT);
      b.column(ng(u + sign * 0.55, 12.1, v), 0.6, 7.0, LIGHT);
    }
    for (const y of [16.05, 18.15, 30.15, 32.2])
      ngBox(b, u + sign * 0.48, y, 44.65, 0.7, 0.44, 18.0, LIGHT);
    b.beam(
      ng(u + sign * 0.4, 32.45, 35.9),
      ng(u + sign * 0.4, 34.9, 44.65),
      0.3,
      LIGHT,
    );
    b.beam(
      ng(u + sign * 0.4, 34.9, 44.65),
      ng(u + sign * 0.4, 32.45, 53.7),
      0.3,
      LIGHT,
    );
    for (let i = -3; i <= 3; i++)
      figure(
        b,
        ng(u + sign * 0.65, 32.6, 44.65 + i * 1.7),
        Math.max(0.6, 1.9 - Math.abs(i) * 0.35),
        LIGHT,
      );
  }
  // Six Ionic half-columns on each projecting western Pergamon pavilion.
  // All local dimensions are display subdivisions of the source frontage.
  for (const [u, v] of [
    [-154.45, -112.95],
    [-151.55, -34.15],
  ]) {
    for (let i = 0; i < 6; i++) {
      const offset = (i - 2.5) * 4.8;
      b.column(ng(u - 0.48, 13.7, v + offset), 1.28, 18.2, TONES[0]);
      ngBox(b, u - 0.5, 4.45, v + offset, 1.62, 0.6, 1.6, LIGHT);
      ngBox(b, u - 0.5, 22.85, v + offset, 1.65, 0.55, 1.8, LIGHT);
      for (const sign of [-1, 1])
        ngBox(
          b,
          u - 0.55,
          22.6,
          v + offset + sign * 0.73,
          0.55,
          0.55,
          0.55,
          LIGHT,
        );
    }
    for (let i = 0; i < 5; i++) {
      const offset = (i - 2) * 4.8;
      ngBox(b, u - 0.15, 9.7, v + offset, 0.15, 6.5, 2.8, GLASS);
      for (let j = 0; j < 7; j++) {
        const t = (j / 6) * Math.PI;
        ngBox(
          b,
          u - 0.28,
          13.05 + 1.4 * Math.sin(t),
          v + offset + 1.4 * Math.cos(t),
          0.24,
          0.3,
          0.42,
          LIGHT,
        );
      }
    }
    for (const y of [23.4, 24.4, 25.35])
      ngBox(b, u - 0.42, y, v, 0.65, 0.4, 28.0, LIGHT);
    b.beam(ng(u - 0.5, 25.5, v - 14.0), ng(u - 0.5, 29.55, v), 0.4, LIGHT);
    b.beam(ng(u - 0.5, 29.55, v), ng(u - 0.5, 25.5, v + 14), 0.4, LIGHT);
    for (let i = 0; i < 25; i++) {
      const offset = (i - 12) * 1.08,
        h = 4.05 * (1 - Math.abs(offset) / 14);
      ngBox(b, u - 0.2, 25.5 + h / 2, v + offset, 0.2, h, 1.1, TONES[0]);
    }
  }
}
function roofDetails(b: Builder): void {
  for (const [which, source] of MUSEUM_TRIAD_SOURCES.entries())
    for (const part of source.parts) {
      for (const surface of part.surfaces) {
        if (surface.kind !== "RoofSurface") continue;
        const r = surface.rings[0];
        if (!b.mobile)
          for (let i = 0; i < r.length; i++) {
            const a = r[i] as P,
              c = r[(i + 1) % r.length] as P;
            if (Math.hypot(a[0] - c[0], a[2] - c[2]) > 5)
              b.beam(
                [a[0], a[1] + 0.08, a[2]],
                [c[0], c[1] + 0.08, c[2]],
                0.1,
                which === 2 ? GREEN : 0x7e8985,
              );
          }
      }
    }
  const ngPart = MUSEUM_TRIAD_SOURCES[2].parts[0];
  for (let i = 0; i < (b.mobile ? 12 : 24); i++) {
    const v = -28 + (i * 57) / (b.mobile ? 11 : 23);
    for (const side of [-1, 1]) {
      const a = ng(-0.5, 0, v),
        c = ng(-0.5 + side * 15.3, 0, v);
      const ya = museumTriadPartRoofAt(ngPart, a[0], a[2]),
        yc = museumTriadPartRoofAt(ngPart, c[0], c[2]);
      if (ya !== null && yc !== null)
        b.beam([a[0], ya + 0.1, a[2]], [c[0], yc + 0.1, c[2]], 0.13, 0x758f85);
    }
  }
  // Contemporary glazed roofs of the two courtyards, between source wings.
  for (const [a, c] of [
    [
      [1773.2568, -117.7787],
      [1773.2568, -117.7787],
    ],
    [
      [1798.4024, -85.3463],
      [1798.4024, -85.3463],
    ],
  ] as [V, V][]) {
    const mid: P = [(a[0] + c[0]) / 2, 26.9, (a[1] + c[1]) / 2];
    b.box(mid, [12.7, 0.27, 23.0], 0xa9babb, 0.655);
    const n = b.mobile ? 4 : 8;
    for (let i = 0; i < n; i++) {
      const u = ((i - (n - 1) / 2) * 12.7) / n;
      const p: P = [
        mid[0] + Math.cos(0.655) * u,
        27.09,
        mid[2] - Math.sin(0.655) * u,
      ];
      b.box(p, [0.12, 0.15, 23.0], 0x697d7e, 0.655);
    }
  }
}
function nativeEnvelope(b: Builder): void {
  const cell = b.mobile ? 3.6 : 2.6;
  MUSEUM_TRIAD_SOURCES.forEach((source, which) => {
    // Thin, source-aligned facade courses keep windows on their exterior skin.
    // Only roofs use the coarse world grid; there is no hidden volume fill.
    facadeRuns(source.parts, (a, end, n, part) => {
      const l = Math.hypot(end[0] - a[0], end[1] - a[1]),
        count = Math.ceil(l / cell),
        yaw = -Math.atan2(end[1] - a[1], end[0] - a[0]);
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count,
          x = a[0] + (end[0] - a[0]) * t,
          z = a[1] + (end[1] - a[1]) * t;
        const top =
          museumTriadPartRoofAt(part, x - n[0] * 0.1, z - n[1] * 0.1) ??
          part.top_y_m;
        const v = nationalgalerieLocal(x, z)[1];
        const roof = which === 2 && v > 25.2 ? 13.54 : top;
        const courses = Math.ceil((roof - part.ground_y_m) / 3.8);
        for (let c = 0; c < courses; c++)
          b.box(
            [
              x - n[0] * 0.14,
              part.ground_y_m +
                ((c + 0.5) * (roof - part.ground_y_m)) / courses,
              z - n[1] * 0.14,
            ],
            [l / count + 0.01, (roof - part.ground_y_m) / courses, 0.4],
            TONES[which],
            yaw,
          );
      }
    });
    for (const part of source.parts) {
      const xs = part.ring.map((p) => p[0]),
        zs = part.ring.map((p) => p[1]);
      for (let x = Math.min(...xs) + cell / 2; x < Math.max(...xs); x += cell)
        for (
          let z = Math.min(...zs) + cell / 2;
          z < Math.max(...zs);
          z += cell
        ) {
          const top = museumTriadPartRoofAt(part, x, z);
          if (top === null) continue;
          const neighbours = [
            [cell, 0],
            [-cell, 0],
            [0, cell],
            [0, -cell],
          ]
            .map(([dx, dz]) => museumTriadPartRoofAt(part, x + dx, z + dz))
            .filter((value): value is number => value !== null);
          const thickness = Math.max(
            0.8,
            top - Math.min(top, ...neighbours) + 0.2,
          );
          b.box(
            [x, top - thickness / 2, z],
            [cell, thickness, cell],
            which === 2 ? 0x83968d : 0x929d98,
          );
        }
    }
  });
}
export function createMuseumTriadArchitecture(
  options: { mobileLike?: boolean; minecraft?: boolean } = {},
): Group {
  const root = new Group(),
    b = new Builder(options.minecraft ?? false, !!options.minecraft && !!options.mobileLike);
  root.name = b.minecraft
    ? MINECRAFT_MUSEUM_TRIAD_GROUP_NAME
    : MUSEUM_TRIAD_GROUP_NAME;
  root.userData = {
    ...MUSEUM_TRIAD_PROFILE,
    blockNative: b.minecraft,
    keepInMinecraft: b.minecraft,
    mobileLike: b.mobile,
  };
  if (b.minecraft) nativeEnvelope(b);
  else root.add(surfaceMesh());
  facades(b);
  nationalgalerie(b);
  museumFronts(b);
  roofDetails(b);
  finish(b, root);
  return freezeStaticSceneTransforms(root);
}
export function createMinecraftMuseumTriadArchitecture(
  options: { mobileLike?: boolean } = {},
): Group {
  return createMuseumTriadArchitecture({ ...options, minecraft: true });
}
