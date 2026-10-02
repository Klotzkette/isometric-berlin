import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import source, { renderBudget } from "./data/bndHeadquartersV174Source.json";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const BND_HEADQUARTERS_V174_GROUP = "BND public exterior: source-clipped upper wings, gatehouses and visitor centre";
export const BND_HEADQUARTERS_V174_NATIVE_GROUP = "BND public exterior: independent native upper skin and facade blocks";

/** Only the lazy presentation module imports the render payload. */
export const BND_HEADQUARTERS_V174_RENDER_BUDGET = /* @__PURE__ */ Object.freeze(renderBudget);

function sheets(): Mesh {
  const count = source.surfaces.reduce((n, s) => n + s.triangles.length * 9, 0);
  const positions = new Float32Array(count), colors = new Float32Array(count), color = new Color();
  let offset = 0;
  for (const s of source.surfaces) {
    color.setHex(s.color);
    for (const t of s.triangles) for (const p of t) {
      positions.set(p, offset);
      colors.set([color.r, color.g, color.b], offset);
      offset += 3;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .88, flatShading: true });
  const mesh = new Mesh(geometry, day);
  mesh.name = "BND additive mapped upper shells and shallow exterior cladding";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, additiveSourceGeometry: true };
  return mesh;
}

/** Plain locator lettering, not a reproduction of an emblem or corporate mark. */
function lettering(native: boolean): number[][] {
  const rows: number[][] = [], portal = source.visitorPortal;
  const paths = letteringStrokePaths("BND BESUCHERZENTRUM", .36);
  const span = Math.max(...paths.flat().map(p => p[0]));
  const [dx, dz] = portal.tangent, [nx, nz] = portal.normal;
  for (const path of paths) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .06));
    for (let j = 0; j <= steps; j++) {
      const u = a[0] + (b[0] - a[0]) * j / steps - span / 2;
      const y = portal.y + a[1] + (b[1] - a[1]) * j / steps;
      rows.push([portal.point[0] + dx * u + nx * .64, y,
        portal.point[1] + dz * u + nz * .64, .055, .055, .055,
        ...(native ? [0x343D37] : [0, 0x343D37])]);
    }
  }
  return rows;
}

function instances(native: boolean): InstancedMesh {
  const labels = lettering(native);
  const rows = native ? source.nativeBoxes : source.boxes;
  const count = rows.length + labels.length;
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .89, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(count * 16), colors = new Float32Array(count * 3);
  const matrix = new Matrix4(), color = new Color(), size = new Vector3();
  for (let i = 0; i < count; i++) {
    const row = i < rows.length ? rows[i] : labels[i - rows.length];
    if (native) matrix.identity();
    else matrix.makeRotationY(Number(row[6]));
    matrix.scale(size.set(Number(row[3]), Number(row[4]), Number(row[5])));
    matrix.setPosition(Number(row[0]), Number(row[1]), Number(row[2]));
    matrix.toArray(matrices, i * 16);
    color.setHex(Number(row[native ? 6 : 7])).toArray(colors, i * 3);
  }
  mesh.count = count;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.name = native ? "BND orthogonal facade and upper roof skin" : "BND metal rhythm, travertine portals and brick visitor facade";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: native, nativeMinecraft: native, noHiddenSolidInfill: true };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  return mesh;
}

function create(native: boolean): Group {
  const root = new Group();
  root.name = native ? BND_HEADQUARTERS_V174_NATIVE_GROUP : BND_HEADQUARTERS_V174_GROUP;
  root.userData = { northMitteV174: "bnd",
    textureFree: true, fullStaticDetailOnTouch: true, fullMobileIdentical: true,
    renderBudget: BND_HEADQUARTERS_V174_RENDER_BUDGET,
    sourceGeometryRetained: true, preservedOwners: source.preservedOwners,
    newReplacedOwners: [], originalCourtyardsRetained: true,
    sourcePartIds: source.preservedOwners.flatMap(p => p.partIds),
    detailStatus: source.detailStatus, publicExteriorOnly: true,
    keepInMinecraft: native, blockNative: native, nativeMinecraft: native,
    noHiddenSolidInfill: true,
  };
  if (!native) root.add(sheets());
  root.add(instances(native));
  return freezeStaticSceneTransforms(root);
}

export function createBndHeadquartersV174(_options: { mobileLike?: boolean } = {}): Group { return create(false); }
export function createMinecraftBndHeadquartersV174(_options: { mobileLike?: boolean } = {}): Group { return create(true); }
