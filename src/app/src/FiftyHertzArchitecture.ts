import {
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  ShapeUtils,
  Vector2,
  Vector3,
} from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";
import {
  FIFTY_HERTZ_SOURCE as S,
  FIFTY_HERTZ_GROUP,
  MINECRAFT_FIFTY_HERTZ_GROUP,
  FIFTY_HERTZ_PROFILE,
  FIFTY_HERTZ_ROOF_SUBDIVISIONS,
  fiftyHertzInRing,
  fiftyHertzRoofAt,
} from "./fiftyHertzProfile";

type Triple = [number, number, number];
type Part = typeof S.extension;
type Block = {
  position: Triple;
  size: Triple;
  quaternion: [number, number, number, number];
  color: number;
  role: string;
  sourceId: string;
};
type Plan = {
  blocks: Block[];
  vertices: number[];
  colors: number[];
  minecraft: boolean;
  mobile: boolean;
};
type Wall = {
  part: Part;
  edge: number;
  a: number[];
  dx: number;
  dz: number;
  nx: number;
  nz: number;
  length: number;
};
const C = {
  glass: 0x465c6c,
  lightGlass: 0x63808b,
  recess: 0x253d4a,
  frame: 0xe6e8e5,
  rail: 0xaebbc0,
  roof: 0x8b9290,
  orange: 0xd98a30,
};
const allParts = [...S.prisms, S.extension];

function add(
  p: Plan,
  position: Triple,
  size: Triple,
  color: number,
  role: string,
  sourceId: string,
  quaternion = new Quaternion(),
): void {
  p.blocks.push({
    position,
    size,
    color,
    role,
    sourceId,
    quaternion: quaternion.toArray(),
  });
}
function at(w: Wall, u: number, y: number, out: number): Triple {
  return [w.a[0] + w.dx * u + w.nx * out, y, w.a[1] + w.dz * u + w.nz * out];
}
function box(
  p: Plan,
  w: Wall,
  u: number,
  y: number,
  out: number,
  width: number,
  height: number,
  depth: number,
  color: number,
  role: string,
): void {
  add(
    p,
    at(w, u, y, out),
    [width, height, depth],
    color,
    role,
    w.part.id,
    new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      -Math.atan2(w.dz, w.dx),
    ),
  );
}
function beam(
  p: Plan,
  a: Triple,
  b: Triple,
  width: number,
  color: number,
  role: string,
  id: string,
): void {
  const aa = new Vector3(...a),
    bb = new Vector3(...b),
    d = bb.clone().sub(aa),
    length = d.length();
  if (length < 0.001) return;
  if (p.minecraft) {
    const n = Math.max(
      1,
      Math.ceil(
        Math.max(Math.abs(d.x), Math.abs(d.y), Math.abs(d.z)) /
          (p.mobile ? 0.7 : 0.45),
      ),
    );
    for (let i = 0; i < n; i++)
      add(
        p,
        aa
          .clone()
          .lerp(bb, (i + 0.5) / n)
          .toArray(),
        [
          Math.max(width, Math.abs(d.x) / n),
          Math.max(width, Math.abs(d.y) / n),
          Math.max(width, Math.abs(d.z) / n),
        ],
        color,
        role,
        id,
      );
  } else
    add(
      p,
      aa.lerp(bb, 0.5).toArray(),
      [width, length, width],
      color,
      role,
      id,
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()),
    );
}
export function fiftyHertzWalls(): Wall[] {
  return allParts.flatMap((part) => {
    const r = part.ring,
      sign = Math.sign(
        r.reduce((sum, a, i) => {
          const b = r[(i + 1) % r.length];
          return sum + a[0] * b[1] - b[0] * a[1];
        }, 0),
      );
    return r.map((a, i) => {
      const b = r[(i + 1) % r.length],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]) / 10,
        dx = (b[0] - a[0]) / (10 * length),
        dz = (b[1] - a[1]) / (10 * length);
      return {
        part,
        edge: i,
        a: a.map((v) => v / 10),
        dx,
        dz,
        nx: sign * dz,
        nz: -sign * dx,
        length,
      };
    });
  });
}
function exposed(w: Wall, u: number, y: number): boolean {
  const [x, , z] = at(w, u, y, 0.12);
  return !allParts.some(
    (other) =>
      other.id !== w.part.id &&
      y > other.y0_dm / 10 &&
      y < (fiftyHertzRoofAt(x, z, other.id) ?? -Infinity) &&
      fiftyHertzInRing(other.ring, x * 10, z * 10),
  );
}
function surface(p: Plan, r: number[][], color: number): void {
  const normal = new Vector3().crossVectors(
    new Vector3(...(r[1] as Triple)).sub(new Vector3(...(r[0] as Triple))),
    new Vector3(...(r[2] as Triple)).sub(new Vector3(...(r[0] as Triple))),
  );
  const axis =
    Math.abs(normal.y) > Math.abs(normal.x) &&
    Math.abs(normal.y) > Math.abs(normal.z)
      ? 1
      : Math.abs(normal.x) > Math.abs(normal.z)
        ? 0
        : 2;
  const coords = r.map(
      (a) => new Vector2(a[(axis + 1) % 3], a[(axis + 2) % 3]),
    ),
    color3 = new Color(color);
  for (const tri of ShapeUtils.triangulateShape(coords, []))
    for (const i of tri) {
      p.vertices.push(...r[i]);
      p.colors.push(color3.r, color3.g, color3.b);
    }
}
function shells(p: Plan, walls: Wall[]): void {
  if (!p.minecraft)
    for (const part of S.parts) {
      const prism = S.prisms.find((q) => q.id === part.id.slice(-8))!,
        dy = prism.y0_dm / 10 - part.ground_y_m;
      const roof = FIFTY_HERTZ_ROOF_SUBDIVISIONS.find((r) => r.id === prism.id);
      for (const s of part.surfaces) {
        if (roof && s.kind === "RoofSurface") continue;
        surface(
          p,
          s.rings[0].map((a) => [
            a[0],
            Math.min(a[1] + dy, roof?.eaves ?? Infinity),
            a[2],
          ]),
          s.kind === "RoofSurface" ? C.roof : C.glass,
        );
      }
      if (roof)
        surface(
          p,
          prism.ring.map((a) => [a[0] / 10, roof.eaves, a[1] / 10]),
          C.roof,
        );
    }
  // Minecraft keeps each exact wall footprint; roof slabs are columns sampled
  // from the actual source planes, not synthetic pyramid roof types.
  for (const w of walls) {
    if (!p.minecraft && w.part.id !== S.extension.id) continue;
    const y0 = w.part.y0_dm / 10,
      n = Math.ceil(w.length / (p.mobile ? 1.5 : 1));
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) * w.length) / n,
        q = at(w, u, 0, -0.1),
        top =
          fiftyHertzRoofAt(q[0], q[2], w.part.id) ??
          (w.part.y0_dm + w.part.h_dm) / 10;
      box(
        p,
        w,
        u,
        (top + y0) / 2,
        -0.15,
        w.length / n + 0.02,
        top - y0,
        0.3,
        C.glass,
        "source wall shell",
      );
    }
  }
  for (const part of allParts) {
    if (!p.minecraft && part.id !== S.extension.id) continue;
    const ring = part.ring.map((a) => a.map((v) => v / 10));
    if (!p.minecraft) {
      surface(
        p,
        ring.map((a) => [a[0], (part.y0_dm + part.h_dm) / 10, a[1]]),
        C.roof,
      );
      continue;
    }
    const minX = Math.min(...ring.map((a) => a[0])),
      maxX = Math.max(...ring.map((a) => a[0])),
      minZ = Math.min(...ring.map((a) => a[1])),
      maxZ = Math.max(...ring.map((a) => a[1])),
      cell = p.mobile ? 1.5 : 1;
    for (let z = minZ + cell / 2; z < maxZ; z += cell)
      for (let x = minX + cell / 2; x < maxX; x += cell) {
        if (!fiftyHertzInRing(ring, x, z)) continue;
        const top = fiftyHertzRoofAt(x, z, part.id);
        if (top === null) continue;
        add(
          p,
          [x, top - 0.15, z],
          [cell, 0.3, cell],
          C.roof,
          "source planar roof blocks",
          part.id,
        );
      }
  }
  for (const roof of FIFTY_HERTZ_ROOF_SUBDIVISIONS) {
    const w = walls.find((w) => w.part.id === roof.id && w.edge === 0)!;
    const yaw = 0.372628,
      rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
    add(
      p,
      [roof.centre[0], (roof.top + roof.eaves) / 2, roof.centre[1]],
      [roof.width, roof.top - roof.eaves, roof.depth],
      C.rail,
      "bounded rooftop service housing",
      roof.id,
      rotation,
    );
    // Horizontal louvres give the technical crown a light screened reading.
    for (const side of [-1, 1])
      for (let y = roof.eaves + 0.25; y < roof.top; y += 0.32) {
        const u = roof.width / 2,
          z = side * (roof.depth / 2 + 0.025);
        add(
          p,
          [
            roof.centre[0] + z * Math.sin(yaw),
            y,
            roof.centre[1] + z * Math.cos(yaw),
          ],
          [u * 2, 0.07, 0.05],
          C.recess,
          "roof service louvre",
          w.part.id,
          rotation,
        );
      }
  }
}
function facades(p: Plan, walls: Wall[]): void {
  for (const w of walls) {
    if (w.part.h_dm < 100) continue;
    const tower = w.part.id === "r4lZjw1O",
      extension = w.part.id === S.extension.id;
    const floors = tower ? 13 : 7,
      y0 = w.part.y0_dm / 10;
    const eaves = extension
      ? 35.5
      : tower
        ? 55.84
        : w.part.id === "J4IVUvmp"
          ? 33.02
          : 33.49;
    const pitch = (eaves - y0) / floors,
      bays = Math.max(2, Math.round(w.length / 5.6)),
      bw = w.length / bays;
    for (let f = 0; f < floors; f++)
      for (let b = 0; b < bays; b++) {
        const u = (b + 0.5) * bw,
          y = y0 + (f + 0.5) * pitch;
        if (!exposed(w, u, y)) continue;
        const loggia =
          (f === 2 || f === 5 || (tower && f === 9)) &&
          b === Math.floor(bays / 2);
        box(
          p,
          w,
          u,
          y,
          0.07,
          bw - 0.1,
          pitch - 0.45,
          0.1,
          loggia ? C.recess : (b + f) % 3 === 0 ? C.lightGlass : C.glass,
          loggia ? "recessed outdoor loggia" : "curtain wall pane",
        );
        if (!loggia && b === 1 && (f === 1 || f === 4 || f === 8))
          box(
            p,
            w,
            u - bw * 0.2,
            y,
            0.14,
            bw * 0.35,
            pitch - 0.56,
            0.08,
            C.orange,
            "orange circulation core behind glazing",
          );
        box(
          p,
          w,
          u,
          y0 + f * pitch,
          0.28,
          bw + 0.03,
          0.38,
          0.64,
          C.frame,
          "continuous projecting floor frame",
        );
        for (let j = 0; j <= (p.mobile ? 2 : 4); j++)
          box(
            p,
            w,
            (b + j / (p.mobile ? 2 : 4)) * bw,
            y,
            0.2,
            p.minecraft ? 0.11 : 0.07,
            pitch - 0.35,
            0.1,
            C.rail,
            "slender glazing mullion",
          );
        // Each storey has separate sloping columns; the irregular omissions and
        // shifted rhythm are characteristic, unlike the old repeated X grid.
        const direction = (b + f) % 2 === 0 ? 1 : -1;
        if ((b + f * 3 + w.edge) % 11 !== 7)
          beam(
            p,
            at(w, u - direction * bw * 0.22, y0 + f * pitch + 0.2, 0.5),
            at(w, u + direction * bw * 0.22, y0 + (f + 1) * pitch - 0.2, 0.5),
            0.42,
            C.frame,
            "single-storey diagonal exoskeleton",
            w.part.id,
          );
        if (loggia) {
          box(
            p,
            w,
            u,
            y0 + f * pitch + 1.15,
            0.45,
            bw - 0.2,
            0.075,
            0.11,
            C.rail,
            "loggia guardrail",
          );
          for (const t of [-0.38, 0, 0.38])
            box(
              p,
              w,
              u + t * bw,
              y0 + f * pitch + 0.68,
              0.45,
              0.075,
              0.95,
              0.075,
              C.rail,
              "loggia guardrail upright",
            );
        }
      }
    for (let b = 0; b < bays; b++)
      if (exposed(w, (b + 0.5) * bw, eaves - 0.2))
        box(
          p,
          w,
          (b + 0.5) * bw,
          eaves,
          0.28,
          bw + 0.03,
          0.42,
          0.68,
          C.frame,
          "flat projecting roof rim",
        );
    if ((tower && w.edge === 2) || (extension && w.edge === 1))
      for (const path of letteringStrokePaths("50HERTZ", 0.65))
        for (let i = 1; i < path.length; i++)
          beam(
            p,
            at(
              w,
              w.length / 2 + path[i - 1][0],
              y0 + 2.5 + path[i - 1][1],
              0.64,
            ),
            at(w, w.length / 2 + path[i][0], y0 + 2.5 + path[i][1], 0.64),
            0.085,
            C.frame,
            "50Hertz entrance lettering",
            w.part.id,
          );
  }
}
function bindPresentationMaterials(mesh: Mesh): void {
  mesh.userData.dayMaterial = mesh.material;
  const vertexColors = !(mesh instanceof InstancedMesh);
  mesh.userData.nightMaterial = new MeshStandardMaterial({
    color: 0x8394a7,
    vertexColors,
    roughness: 0.88,
    side: DoubleSide,
  });
  mesh.userData.moonlitMaterial = new MeshStandardMaterial({
    color: 0x64758c,
    vertexColors,
    roughness: 0.91,
    side: DoubleSide,
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}
function build(
  minecraft: boolean,
  mobile: boolean,
  diagnostics: boolean,
): Group {
  const p: Plan = { minecraft, mobile, blocks: [], vertices: [], colors: [] },
    walls = fiftyHertzWalls();
  shells(p, walls);
  facades(p, walls);
  const root = new Group();
  root.name = minecraft ? MINECRAFT_FIFTY_HERTZ_GROUP : FIFTY_HERTZ_GROUP;
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    side: DoubleSide,
  });
  if (p.vertices.length) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(p.vertices, 3),
    );
    geometry.setAttribute("color", new Float32BufferAttribute(p.colors, 3));
    geometry.computeVertexNormals();
    const mesh = new Mesh(
      geometry,
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        side: DoubleSide,
      }),
    );
    mesh.name = "50Hertz retained source wall and roof planes";
    bindPresentationMaterials(mesh);
    root.add(mesh);
  }
  const mesh = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      material,
      p.blocks.length,
    ),
    m = new Matrix4(),
    q = new Quaternion(),
    color = new Color();
  p.blocks.forEach((b, i) => {
    mesh.setMatrixAt(
      i,
      m.compose(
        new Vector3(...b.position),
        q.fromArray(b.quaternion),
        new Vector3(...b.size),
      ),
    );
    mesh.setColorAt(i, color.setHex(b.color));
  });
  mesh.geometry.deleteAttribute("uv");
  bindPresentationMaterials(mesh);
  mesh.name = "50Hertz facade frames glazing and orange cores";
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  root.add(mesh);
  root.userData = {
    sourceIds: [...S.prisms.map((p) => p.id), S.extension.id],
    profile: FIFTY_HERTZ_PROFILE,
    blockCount: p.blocks.length,
    mobileLike: mobile,
    ...(diagnostics ? { blocks: p.blocks } : {}),
  };
  freezeStaticSceneTransforms(root);
  return root;
}
export function createFiftyHertzArchitecture(
  options: { mobileLike?: boolean; diagnostics?: boolean } = {},
): Group {
  return build(false, !!options.mobileLike, !!options.diagnostics);
}
export function createMinecraftFiftyHertzArchitecture(
  options: { mobileLike?: boolean; diagnostics?: boolean } = {},
): Group {
  return build(true, !!options.mobileLike, !!options.diagnostics);
}
