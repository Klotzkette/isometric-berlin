import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import source from "./data/zooPalastV260.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";

type P = [number, number, number];
type Edge = { a: number[]; b: number[]; length: number; dx: number; dz: number; nx: number; nz: number };
type Box = [number, number, number, number, number, number, number, number];

export const ZOO_PALAST_V260_BOUNDS = Object.freeze({ minX: -2594, maxX: -2550, minZ: 1368, maxZ: 1404, minY: 5.2, maxY: 30 });
export const ZOO_PALAST_V260_PROFILE = Object.freeze({
  sourceOwner: source.owner, sourceSha256: source.sourceSha256,
  portholes: 3, posterCases: 4, fullStaticDetailOnTouch: true,
  fittingsStatus: source.status,
});

function edge(a: number[], b: number[]): Edge {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
  return { a, b, length, dx, dz, nx: -dz, nz: dx };
}
function at(e: Edge, u: number, y: number, offset = .08): P {
  return [e.a[0] + e.dx * u + e.nx * offset, y, e.a[1] + e.dz * u + e.nz * offset];
}

function build(native: boolean): Group {
  const root = new Group(), boxes: Box[] = [], positions: number[] = [], colors: number[] = [];
  root.name = native ? "Zoo Palast native ceramic entrance and portholes v260" : "Zoo Palast ceramic entrance and portholes v260";
  root.userData = {
    ...ZOO_PALAST_V260_PROFILE, textureFree: true, additiveOnly: true,
    sourceEnvelopeRetained: true, nativeMinecraft: native, blockNative: native,
    keepInMinecraft: native, noHiddenSolidInfill: true,
  };
  const occupied = native ? new Set(source.nativeOccupiedCells.map(p => p.join(","))) : null;
  const nativeCells = new Map<string, Box>();
  const box = (p: P, size: P, tint: number, yaw = 0): void => { boxes.push([...p, ...size, yaw, tint]); };
  const triangle = (a: P, b: P, c: P, tint: number): void => {
    const color = new Color(tint);
    for (const p of [a, b, c]) { positions.push(...p); colors.push(color.r, color.g, color.b); }
  };
  // The existing native shell has 2 m cells. Each new independent orthogonal
  // fitting moves only to that shell's first free outward half-metre column.
  // This avoids burying the detail inside the retained, deliberately coarse skin.
  const nativeCell = (e: Edge, u: number, y: number, height: number, tint: number, width = .5, grid = .5, span?: [number, number]): void => {
    const p = at(e, u, y, .12);
    let x = p[0], z = p[2], lastBlocked = -1;
    for (let shift = 0; shift < 12; shift++) {
      x = Math.floor((p[0] + e.nx * shift * .25) / grid) * grid + grid / 2;
      z = Math.floor((p[2] + e.nz * shift * .25) / grid) * grid + grid / 2;
      let blocked = false;
      for (let yy = span?.[0] ?? y - height / 2 + .05; yy <= (span?.[1] ?? y + height / 2); yy += .5)
        blocked ||= occupied!.has(`${Math.floor(x / 2)},${Math.floor(yy / 2)},${Math.floor(z / 2)}`);
      if (blocked) lastBlocked = shift;
      if (!span && !blocked) break;
    }
    if (span) {
      // Letter strokes need one native block of clearance over the staircase
      // facade at oblique views; the retained sign remains underneath.
      x = Math.floor((p[0] + e.nx * (lastBlocked + 8) * .25) / grid) * grid + grid / 2;
      z = Math.floor((p[2] + e.nz * (lastBlocked + 8) * .25) / grid) * grid + grid / 2;
    }
    nativeCells.set(`${x},${y},${z},${height}`, [x, y, z, width, height, width, 0, tint]);
  };
  const panel = (e: Edge, u: number, y: number, w: number, h: number, depth: number, tint: number, offset = .09): void => {
    if (!native) box(at(e, u, y, offset), [w, h, depth], tint, -Math.atan2(e.dz, e.dx));
    else for (let d = -w / 2 + .25; d < w / 2; d += .5) nativeCell(e, u + d, y, h, tint);
  };
  const ring = (e: Edge, u: number, y: number, inner: number, outer: number, tint: number, offset: number): void => {
    const n = outer < .2 ? 8 : 32;
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n, b = (i + 1) * Math.PI * 2 / n;
      const p = at(e, u + Math.cos(a) * inner, y + Math.sin(a) * inner, offset);
      const q = at(e, u + Math.cos(a) * outer, y + Math.sin(a) * outer, offset);
      const r = at(e, u + Math.cos(b) * outer, y + Math.sin(b) * outer, offset);
      const s = at(e, u + Math.cos(b) * inner, y + Math.sin(b) * inner, offset);
      triangle(p, q, r, tint); triangle(p, r, s, tint);
    }
  };

  const ceramic = 0xbba96f, coping = 0x7b8a87, brass = 0xc7ab64, slate = 0x424c49;
  for (let i = 1; i < source.curve.length; i++) {
    const a = source.curve[i - 1], b = source.curve[i], e = edge(a, b);
    const low = Math.max(a[2], b[2]) + .10, high = Math.min(a[3], b[3]) - .12;
    // Very narrow material joints leave the source ceramic wall, relief buttons
    // and existing curved ZOO PALAST lettering completely intact and visible.
    for (let y = Math.ceil(low / (native ? 1.2 : .48)) * (native ? 1.2 : .48); y < high; y += native ? 1.2 : .48)
      panel(e, e.length / 2, y, e.length, native ? .10 : .018, .025, ceramic, .045);
    if (!native) for (let u = .29; u < e.length; u += .32)
      panel(e, u, (low + high) / 2, .014, high - low, .025, 0xc2af75, .047);
    panel(e, e.length / 2, high + .10, e.length, native ? .24 : .17, .16, coping, .075);
  }
  // Brass collars surround the original v166 studs; those original squares
  // still supply their centres and remain part of the delivered city.
  for (const s of source.studs) {
    const e = edge([s[0], s[2]], [s[0] + Math.cos(s[6]), s[2] - Math.sin(s[6])]);
    if (native) nativeCell(e, 0, s[1], .20, brass, .24);
    else ring(e, 0, s[1], .075, .115, brass, .11);
  }
  if (native) {
    const edges = source.curve.slice(1).map((p, i) => edge(source.curve[i], p));
    const length = edges.reduce((n, e) => n + e.length, 0);
    for (const path of letteringStrokePaths("ZOO PALAST", 1.72)) for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .12));
      for (let k = 0; k <= steps; k++) {
        let u = length / 2 + a[0] + (b[0] - a[0]) * k / steps, index = 0;
        while (index < edges.length - 1 && u > edges[index].length) { u -= edges[index].length; index++; }
        nativeCell(edges[index], u, Math.round((26.4 + a[1] + (b[1] - a[1]) * k / steps) / .2) * .2, .21, 0xf5efdb, .22, .25, [26.3, 28.3]);
      }
    }
  }

  const side = edge(source.side[0], source.side[1]);
  // This short exterior return is in front of the retained tall side annex;
  // placing windows on the long inner wall would bury them in that annex.
  for (const y of [18.6, 22, 25.4]) {
    if (native) {
      for (const [u, yy, h] of [[1.7, y, 1.5], [2.7, y, 1.5], [2.2, y - .5, .5], [2.2, y + .5, .5]])
        nativeCell(side, u, yy, h, 0xddd7bd);
      nativeCell(side, 2.2, y, .5, 0x334b50);
    } else {
      ring(side, 2.2, y, 0, .53, 0x344a50, .095);
      ring(side, 2.2, y, .53, .65, 0xe0dbc4, .13);
      ring(side, 2.2, y, .49, .53, 0x768b8b, .145);
      panel(side, 2.02, y + .16, .10, .38, .025, 0x91a9a5, .16);
    }
  }
  for (let i = 1; i < source.front.length; i++) {
    const e = edge(source.front[i - 1], source.front[i]);
    if (e.length < .6) continue;
    // A thin canopy edge/fascia refines the measured low foyer wall, rather
    // than inventing a new solid roof or replacing its sloped source sheets.
    panel(e, e.length / 2, 12.38, e.length, 1.30, .13, slate, .12);
    panel(e, e.length / 2, 13.06, e.length, .16, .48, coping, .21);
    panel(e, e.length / 2, 11.69, e.length, .09, .18, brass, .20);
    if (!native) for (let u = .28; u < e.length; u += .48)
      panel(e, u, 12.38, .018, 1.22, .02, 0x606963, .205);
  }
  const entrance = edge(source.front[7], source.front[9]);
  for (let u = 2.1; u < entrance.length - 1.3; u += 1.55) {
    panel(entrance, u, 8.46, native ? .5 : .10, 6.15, .15, brass, .22);
    panel(entrance, u + .48, 7.44, native ? .5 : .065, .62, .12, 0xe0c887, .26);
  }
  panel(entrance, entrance.length / 2, 9.55, entrance.length - .6, .085, .16, brass, .22);
  panel(entrance, entrance.length / 2, 5.29, entrance.length - .6, .13, .36, 0xc7c2b1, .18);

  // Four plainly abstract programme cases: no movie artwork, dates, titles or
  // present tenant claim is invented from the historical reference photograph.
  for (const [a, b, u, tint] of [
    [source.front[0], source.front[1], 1.1, 0x7c554d],
    [source.front[4], source.front[5], 2.4, 0x667d82],
    [source.front[13], source.front[14], 2.5, 0x94704b],
    [source.front[17], source.front[18], 1.15, 0x566a68],
  ] as [number[], number[], number, number][]) {
    const e = edge(a, b);
    if (native) {
      nativeCell(e, u - .5, 7.66, 2.5, 0xb7ab85);
      nativeCell(e, u + .5, 7.66, 2.5, 0xb7ab85);
      nativeCell(e, u, 8.66, .5, 0xb7ab85);
      nativeCell(e, u, 6.66, .5, 0xb7ab85);
      nativeCell(e, u, 7.66, 1.5, tint);
    } else {
      panel(e, u, 7.66, 1.30, 2.32, .16, 0xb7ab85, .29);
      panel(e, u, 7.66, 1.09, 2.09, .05, tint, .40);
      panel(e, u, 8.36, .82, .12, .035, 0xe7dfc7, .44);
      panel(e, u, 6.88, .72, .07, .035, 0xd5d0be, .44);
    }
  }
  boxes.push(...nativeCells.values());
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .86, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, 0), matrix = new Matrix4(), color = new Color();
  const matrices = new Float32Array(boxes.length * 16), tints = new Float32Array(boxes.length * 3);
  boxes.forEach((b, i) => {
    matrix.makeRotationY(b[6]); matrix.scale(new Vector3(b[3], b[4], b[5]));
    matrix.setPosition(b[0], b[1], b[2]); matrix.toArray(matrices, i * 16);
    color.setHex(b[7]).toArray(tints, i * 3);
  });
  mesh.count = boxes.length; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(tints, 3);
  mesh.name = native ? "Zoo Palast independently orthogonal fittings" : "Zoo Palast ceramic joints canopy brass entrance and programme cases";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, nativeMinecraft: native, blockNative: native };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  if (positions.length) {
    const g = new BufferGeometry(); g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3)); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    const d = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
    const n = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .7 });
    const relief = new Mesh(g, d); relief.name = "Zoo Palast three side portholes and brass button collars";
    relief.userData = { dayMaterial: d, nightMaterial: n, textureFree: true }; root.add(relief);
  }
  root.userData.instances = boxes.length;
  return freezeStaticSceneTransforms(root);
}

export function createZooPalastV260(_options: { mobileLike?: boolean } = {}): Group { return build(false); }
export function createMinecraftZooPalastV260(_options: { mobileLike?: boolean } = {}): Group { return build(true); }
