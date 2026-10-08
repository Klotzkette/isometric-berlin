import { ExtrudeGeometry, Group, Shape } from "three";
import source from "./data/northV185.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { buildingTerrainOffset, terrainGroundAt } from "./weinbergTerrainV176";

export const NORTH_V185_GROUP = "Northern neighbourhoods: bounded source-bound accents v185";
type Face = typeof source.faces[number];
type Rows = number[][];

/** Shared forms, independent axis-aligned native blocks; no additional city shell. */
function put(rows: Rows, native: boolean, x: number, y: number, z: number, w: number, h: number, d: number, yaw: number, color: number): void {
  if (!native) { rows.push([x, y, z, w, h, d, yaw, color]); return; }
  const count = Math.max(1, Math.ceil(w / 2));
  for (let i = 0; i < count; i++) {
    const u = (i + .5) * w / count - w / 2;
    const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
    const depth = Math.max(.18, d);
    rows.push([x + Math.cos(yaw) * u, y, z - Math.sin(yaw) * u, c * w / count + s * depth, h, s * w / count + c * depth, color]);
  }
}

function facade(rows: Rows, arches: Rows, f: Face, native: boolean): void {
  const length = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
  const tx = (f.b[0] - f.a[0]) / length, tz = (f.b[1] - f.a[1]) / length;
  const yaw = -Math.atan2(tz, tx), [nx, nz] = f.normal;
  const brewery = f.kind === "kulturbrauerei", modern = f.kind === "choriner";
  const baseline = 3 + buildingTerrainOffset(f.id, (f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2);
  const ground = baseline + f.wallBottom, top = baseline + f.wallTop, height = top - ground;
  const box = (u: number, y: number, w: number, h: number, color: number, out = .20, depth = .12) => {
    const offset = native ? out + 1.05 : out;
    put(rows, native, f.a[0] + tx * u + nx * offset, y, f.a[1] + tz * u + nz * offset, w, h, depth, yaw, color);
  };
  const arch = (u: number, y: number, w: number, h: number, color: number, out: number) => {
    if (native) { box(u, y - .15, w, h - .30, color, out); box(u, y + h / 2 - .20, w * .65, .4, color, out); return; }
    arches.push([f.a[0] + tx * u + nx * out, y, f.a[1] + tz * u + nz * out, w, h, .10, yaw, color]);
  };
  const stone = brewery ? 0xc49670 : modern ? 0xc6c2ad : 0xd9d0ba;
  box(length / 2, ground + .65, length - .12, .75, brewery ? 0x825744 : 0xada999, .16, .16);
  // Modern Choriner 84 gets only low stone courses and shallow regular reveals;
  // its already detailed source crown/roof and open courts remain untouched.
  if (!modern) {
    box(length / 2, top - .42, length - .10, .23, stone, .25, .32);
    box(length / 2, top - .66, length - .12, .08, brewery ? 0x764e3d : 0xaaa393, .25, .24);
  }
  const floors = Math.min(7, Math.max(1, Math.floor((height - 1) / (brewery ? 4.2 : 3.65))));
  const pitchY = (height - 1.5) / floors;
  const bays = Math.max(1, Math.floor(length / (brewery ? 3.8 : 3.7))), pitch = length / bays;
  if (brewery) for (let i = 0; i <= bays; i++) {
    const u = Math.max(.3, Math.min(length - .3, i * pitch));
    box(u, (ground + top) / 2, .34, height - .3, 0x9c6148, .14, .22);
  }
  for (let level = 0; level < floors; level++) {
    const y = ground + 1.85 + level * pitchY;
    if (y + 1.15 >= top - .8) continue;
    if (brewery) {
      box(length / 2, y - 1.0, length - .18, .38, 0x9c6148, .10, .12);
      box(length / 2, y - 1.16, length - .14, .14, stone, .23, .25);
    }
    for (let bay = 0; bay < bays; bay++) {
      const u = (bay + .5) * pitch, w = Math.min(modern ? 2.1 : 1.65, pitch * .48), h = Math.min(2, pitchY * .58);
      if (brewery) {
        arch(u, y, w + .24, h + .22, stone, .19);
        arch(u, y, w, h, 0x738b87, .29);
      } else {
        box(u, y, w + .24, h + .22, stone, .19, .14);
        box(u, y, w, h, 0x829b9e, .29, .12);
      }
      box(u, y - h / 2 - .1, w + .36, .13, stone, .32, .34);
      box(u, y, .075, h, brewery ? 0xb6b4a0 : 0xd4d6c9, .38, .08);
    }
  }
}

function inRing(x: number, z: number, ring: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function garden(rows: Rows, native: boolean): void {
  for (const bed of source.beds) for (const polygon of bed.geometry.coordinates) {
    const [ring, ...holes] = polygon;
    const left = Math.min(...ring.map(p => p[0])), right = Math.max(...ring.map(p => p[0]));
    const north = Math.min(...ring.map(p => p[1])), south = Math.max(...ring.map(p => p[1]));
    for (let x = left + .8; x < right; x += 2.2) for (let z = north + .8; z < south; z += 2.2) {
      // All four corners must be planted land: never spill colour into a path.
      if (![[-.42, -.42], [.42, -.42], [.42, .42], [-.42, .42]].every(([dx, dz]) =>
        inRing(x + dx, z + dz, ring) && !holes.some(hole => inRing(x + dx, z + dz, hole)))) continue;
      const ground = terrainGroundAt(x, z, 3, native);
      put(rows, native, x, ground + .22, z, .75, .38, .70, 0, 0x637c4e);
      const colour = [0xbb7f93, 0xddd4b5, 0xba776d][Math.abs(Math.round(x + z)) % 3];
      put(rows, native, x, ground + .44, z, .28, .12, .30, 0, colour);
    }
  }
}

function roadEdges(rows: Rows, native: boolean): void {
  for (const road of source.roads) for (let i = 1; i < road.line.length; i++) {
    const a = road.line[i - 1], b = road.line[i];
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (length < .01) continue;
    for (const side of [-1, 1]) {
      const x = (a[0] + b[0]) / 2 + dz / length * side * road.width / 2;
      const z = (a[1] + b[1]) / 2 - dx / length * side * road.width / 2;
      put(rows, native, x, 3.08, z, length, .12, .19, -Math.atan2(dz, dx), 0xbab7a6);
    }
  }
}

export function createNorthV185(minecraft = false): Group {
  const root = new Group();
  root.name = NORTH_V185_GROUP + (minecraft ? " native" : "");
  root.userData = { additiveOnly: true, sourceGeometryRetained: true, textureFree: true,
    blockNative: minecraft, keepInMinecraft: minecraft, fullStaticDetailOnTouch: true,
    sourceStatus: source.sourceStatus, sourceOwnerIds: source.owners.map(p => p.id) };
  for (const kind of ["kulturbrauerei", "hagenauer", "choriner", "weinbergspark"]) {
    const rows: Rows = [], arches: Rows = [];
    source.faces.filter(f => f.kind === kind).forEach(f => facade(rows, arches, f, minecraft));
    if (kind === "weinbergspark") garden(rows, minecraft);
    if (kind === "hagenauer") roadEdges(rows, minecraft);
    if (!rows.length) continue;
    const mesh = justicePalaceV183Boxes(rows, minecraft);
    mesh.name = `North v185 ${kind}: source-bound shallow additions`;
    mesh.userData.northV185 = kind;
    root.add(mesh);
    if (arches.length) {
      // Every industrial arch reuses one tiny normalized profile; this avoids
      // eight individual masonry/pane strips per opening and any texture.
      const shape = new Shape();
      shape.moveTo(-.5, -.5); shape.lineTo(.5, -.5); shape.lineTo(.5, 0);
      shape.absarc(0, 0, .5, 0, Math.PI, false); shape.closePath();
      const geometry = new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 6, steps: 1 });
      geometry.translate(0, 0, -.5); geometry.deleteAttribute("uv");
      const archMesh = justicePalaceV183Boxes(arches);
      archMesh.geometry.dispose(); archMesh.geometry = geometry;
      archMesh.computeBoundingBox(); archMesh.computeBoundingSphere();
      archMesh.name = "Kulturbrauerei shared arched opening profile";
      archMesh.userData.northV185 = kind;
      root.add(archMesh);
    }
  }
  return freezeStaticSceneTransforms(root);
}
