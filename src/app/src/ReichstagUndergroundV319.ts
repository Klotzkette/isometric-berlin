import { BufferGeometry, Color, CylinderGeometry, DoubleSide, Euler, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, ShapeUtils, Vector2, Vector3 } from "three";
import data from "./data/reichstagUndergroundV319.json";
import { parliamentRetainedPlanV295 } from "./ParliamentRetainedEnvelopeV295";
import { PARLIAMENT_INTERIORS_V295 as P, parliamentWorldPointV295 as W } from "./parliamentInteriorsV295Profile";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { hbfMergeAdjacentBoxesV291 } from "./HbfGeometryOpeningsV291";

type Point = [number, number, number];
export type ReichstagUndergroundVolumeV319 = { id: string; center: Point; size: Point; yaw: number };
type Path = { id: string; kind: string; width: number; height: number; points: number[][]; nameDe: string; nameEn: string; status: string; sourceWay?: number };
const paths: readonly Path[] = data.paths;
/** Public connection identities and mapped UES XY. Pedestrian bends, ALL depths,
 * floor heights and subdivisions are schematic display fits, never a survey. */
export const REICHSTAG_UNDERGROUND_LAYOUT_V319 = data;
export const REICHSTAG_UNDERGROUND_CAMERA_V319 = {
  basement: { target: W("reichstag", [16, 1.4, 0]), span: 165 },
  connections: { target: [408, -1, -67] as Point, span: 390 },
} as const;
const views = new WeakMap<Object3D, { routes: Group; basement: Group; live: boolean }>();

/** Complete-face merges only, grouped by identical paint. Bounds come from
 * the exact original Float32 matrices, so no hidden intermediate coordinates
 * change the represented Native union. No source or Drawn member is touched. */
function mergeNativeRows(rows: number[][]): number[][] {
  const groups = new Map<number, { min: Point; max: Point }[]>();
  for (const row of rows) {
    const r = row.slice(0, 6).map(Math.fround), group = groups.get(row[6]) ?? [];
    group.push({ min: [r[0] - r[3] / 2, r[1] - r[4] / 2, r[2] - r[5] / 2], max: [r[0] + r[3] / 2, r[1] + r[4] / 2, r[2] + r[5] / 2] });
    groups.set(row[6], group);
  }
  return [...groups].flatMap(([rgb, boxes]) => hbfMergeAdjacentBoxesV291(boxes).map(b => [
    ...b.min.map((v, i) => (v + b.max[i]) / 2), ...b.max.map((v, i) => v - b.min[i]), rgb,
  ]));
}

function volume(id: string, a: number[], b: number[], width: number, low: number): ReichstagUndergroundVolumeV319 {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  return { id, center: [(a[0] + b[0]) / 2, (low + 8) / 2, (a[2] + b[2]) / 2],
    size: [Math.hypot(dx, dz) + 2.2, 8 - low, width + 1.6], yaw: Math.atan2(-dz, dx) };
}

/** Apply to original ground/roads/water only. Model roofs are intentionally
 * absent; do not apply these additional reveals to the exhibit itself. */
export function reichstagUndergroundRevealVolumesV319(connections = true): ReichstagUndergroundVolumeV319[] {
  const min: Point = [-7.7, data.floor - .35, -74], max: Point = [55, 8, 74];
  const out: ReichstagUndergroundVolumeV319[] = [{ id: "reichstag-basement", center: W("reichstag", min.map((n, i) => (n + max[i]) / 2)), size: max.map((n, i) => n - min[i]) as Point, yaw: P.reichstag.yaw }];
  if (connections) {
    for (const path of paths) for (let i = 1; i < path.points.length; i++)
      out.push(volume(`${path.id}-${i}`, path.points[i - 1], path.points[i], path.width, path.points[i][1] - .35));
    // The public historical tunnel fragment is in a small display bay beside
    // the pedestrian connection, not a fictitious working historical route.
    out.push({ id: "heating-fragment-display-bay", center: [391.5, 3.95, 46.5], size: [10, 8.1, 9.5], yaw: -.30 });
  }
  return out;
}

function inside(x: number, z: number, ring: readonly number[][]): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}

/** Lazily constructed by the section controller. No normal-world visibility,
 * navigation, source geometry or material is mutated by this factory. */
export function createReichstagUndergroundV319(native = false): Group {
  const root = new Group(), basement = new Group(), routes = new Group();
  root.name = "Reichstag publicly documented basement and connections v319";
  basement.name = "East basement archive and crossing"; routes.name = "Pedestrian passages and separate deeper UES service network";
  routes.visible = false; root.add(basement, routes);
  const baseRows: number[][] = [], routeRows: number[][] = [], baseGlowRows: number[][] = [], routeGlowRows: number[][] = [];
  const baseCylinders: number[][] = [], routeCylinders: number[][] = [];
  const box = (rows: number[][], p: readonly number[], size: readonly number[], colour: number, yaw = 0) =>
    rows.push(native ? [...p, ...size, colour] : [...p, ...size, yaw, colour]);
  const local = (rows: number[][], p: Point, size: Point, colour: number) => box(rows, W("reichstag", p), size, colour, P.reichstag.yaw);
  const source = parliamentRetainedPlanV295(), ring = source.ring.map(p => [p[0] / 10, p[1] / 10]);
  const holes = (source.holes ?? []).map(r => r.map(p => [p[0] / 10, p[1] / 10]));
  // One complete measured floor footprint, retaining all SIX original courts.
  if (!native) {
    const points = [...ring, ...holes.flat()];
    const triangles = ShapeUtils.triangulateShape(ring.map(p => new Vector2(p[0], p[1])), holes.map(r => r.map(p => new Vector2(p[0], p[1]))));
    const positions: number[] = [];
    for (const tri of triangles) for (const i of tri) positions.push(points[i][0], data.floor, points[i][1]);
    const geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
    const day = new MeshBasicMaterial({ color: 0x969c96, side: DoubleSide }), night = new MeshStandardMaterial({ color: 0x969c96, side: DoubleSide, roughness: .85 });
    const mesh = new Mesh(geometry, day); mesh.name = "Complete source footprint basement floor with six courtyard holes";
    mesh.userData = { dayMaterial: day, nightMaterial: night }; basement.add(mesh);
  } else {
    const minX = Math.floor(Math.min(...ring.map(p => p[0]))), maxX = Math.ceil(Math.max(...ring.map(p => p[0]))), minZ = Math.floor(Math.min(...ring.map(p => p[1]))), maxZ = Math.ceil(Math.max(...ring.map(p => p[1])));
    for (let z = minZ; z < maxZ; z++) {
      let start: number | null = null;
      for (let x = minX; x <= maxX; x++) {
        const contained = x < maxX && [x, x + 1].every(xx => [z, z + 1].every(zz => inside(xx, zz, ring) && holes.every(h => !inside(xx, zz, h))));
        if (contained && start === null) start = x;
        if (!contained && start !== null) { box(baseRows, [(start + x) / 2, data.floor - .10, z + .5], [x - start, .20, 1], 0x969c96); start = null; }
      }
    }
  }
  // Boltanski's serial boxes and narrow aisle, with restrained rust variation.
  // This represents approximately5000 boxes; blank label fields do not invent
  // names, party membership, dates or individual victim identifications.
  let archiveBoxes = 0;
  for (const side of [-1, 1]) for (let column = 0; column < 100; column++) for (let row = 0; row < 25; row++) {
    const p: Point = [37.5 + side * 1.55, data.floor + .125 * (row + .5), (column - 49.5) * .32];
    const black = side === 1 && column === 50 && row === 8;
    const tint = black ? 0x252523 : [0x736c5b, 0x626c66, 0x86734f, 0x6b7772][(column * 17 + row * 7 + (side + 1)) % 4];
    local(baseRows, p, [.95, .116, .306], tint); archiveBoxes++;
    if (!black) {
      local(baseRows, [p[0] - side * .486, p[1] + .005, p[2]], [.018, .055, .18], 0xdbd9c9);
      if ((column + row) % 4 === 0) local(baseRows, [p[0] - side * .480, p[1] - .047, p[2] + .105], [.012, .018, .08], 0x987548);
    }
  }
  for (let z = -14; z <= 14; z += 4) {
    local(baseRows, [37.5, 3.38, z], [.014, .31, .014], 0x373a38);
    local(baseGlowRows, [37.5, 3.18, z], [.11, .16, .11], 0xffd6a0);
  }
  // Open topped basement crossing and low cut-side partition, not a purported
  // complete inventory of closed functional rooms.
  local(baseRows, [40.47, 1.85, 0], [.20, 3.2, 38.4], 0xc8cbc5);
  for (const z of [-19.7, 19.7]) local(baseRows, [35, .65, z], [10.5, .8, .16], 0xb7bbb4);
  for (const z of [-16, 16]) {
    local(baseRows, [40.2, 1.45, z], [.16, 2.4, .14], 0x75857e);
    local(baseRows, [40.2, 2.7, z + 1.05], [.16, .1, 2.25], 0x75857e);
  }

  for (const path of paths) for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1], b = path.points[i], dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz), ux = dx / length, uz = dz / length, nx = -uz, nz = ux, yaw = Math.atan2(-uz, ux);
    const at = (t: number, side: number, y: number): Point => [a[0] + dx * t + nx * side, y, a[2] + dz * t + nz * side];
    const floor = a[1], goods = path.kind === "goods", colour = goods ? 0x787e76 : path.id === "rtg-plh" ? 0x68766e : 0xa4a69b;
    if (!native) box(routeRows, at(.5, 0, floor - .12), [length + .16, .24, path.width], colour, yaw);
    else {
      // Independent cardinal floor, contained in the represented segment and
      // joined on a shared global grid. Thin cells have no rotated Drawn copy.
      const s = .75, minX = Math.floor((Math.min(a[0], b[0]) - path.width / 2) / s), maxX = Math.ceil((Math.max(a[0], b[0]) + path.width / 2) / s), minZ = Math.floor((Math.min(a[2], b[2]) - path.width / 2) / s), maxZ = Math.ceil((Math.max(a[2], b[2]) + path.width / 2) / s);
      for (let z = minZ; z < maxZ; z++) {
        let start: number | null = null;
        for (let x = minX; x <= maxX; x++) {
          const px = (x + .5) * s, pz = (z + .5) * s, t = ((px - a[0]) * ux + (pz - a[2]) * uz) / length;
          const distance = Math.abs((px - a[0]) * nx + (pz - a[2]) * nz);
          const yes = x < maxX && t >= -.2 / length && t <= 1 + .2 / length && distance < path.width / 2 - s * .72;
          if (yes && start === null) start = x;
          if (!yes && start !== null) { box(routeRows, [(start + x) * s / 2, floor - .12, (z + .5) * s], [(x - start) * s, .24, s], colour); start = null; }
        }
      }
    }
    // Roofless concrete shells. West-facing wall is cut low for the exhibit.
    const count = Math.max(1, Math.ceil(length / (native ? .65 : 6)));
    for (let n = 0; n < count; n++) for (const side of [-1, 1]) {
      const back = nx * side > .05 || (Math.abs(nx) < .05 && nz * side < 0);
      const height = back ? path.height : .55;
      const size: Point = native ? [Math.abs(ux) * length / count + .30, height, Math.abs(uz) * length / count + .30] : [length / count + .035, height, .20];
      box(routeRows, at((n + .5) / count, side * (path.width / 2 - .06), floor + height / 2), size, goods ? 0xa8afa6 : 0xd2d5ce, yaw);
    }
    if (goods) {
      // Restrained service identity; no invented controls, plant, security
      // apparatus, doors, vehicle movement or usable public access is asserted.
      for (let d = 3; d < length; d += 9) {
        box(routeRows, at(d / length, 0, floor + .015), native ? [.15, .03, .8] : [1.25, .03, .13], 0xc6ad65, yaw);
        box(routeGlowRows, at(d / length, path.width / 2 - .15, floor + 3.5), [.08, .13, .65], 0xffedcc, yaw);
      }
    } else if (path.id === "rtg-plh") {
      for (let d = 5; d < length; d += 10) {
        if (native) box(routeRows, at(d / length, -1.75, floor + 1.6), [1.35, 3.2, 1.35], 0xc9cdc5);
        else routeCylinders.push([...at(d / length, -1.75, floor + 1.6), 1.55, 3.2, 1.55, 0, 0]);
        box(routeRows, at(d / length, -path.width / 2 + .24, floor + 1.45), [.08, 1.75, 1.2], 0x8b9b9b, yaw);
        box(routeGlowRows, at(d / length, path.width / 2 - .6, floor + .04), [.32, .08, .32], 0xedf7ef);
      }
    } else {
      // Static architectural moving-walkway recognition, not an extra timer.
      for (const side of [-1, 1]) {
        const samples = Math.max(1, Math.ceil(length / (native ? .65 : 5)));
        for (let j = 0; j < samples; j++) {
          const t = (j + .5) / samples, size: Point = native ? [Math.abs(ux) * length / samples + 1.1 * Math.abs(nx), .13, Math.abs(uz) * length / samples + 1.1 * Math.abs(nz)] : [length / samples + .02, .13, 1.1];
          box(routeRows, at(t, side * 1.0, floor + .08), size, 0x454d4b, yaw);
        }
        for (let d = .6; d < length; d += 2.0) {
          box(routeRows, at(d / length, side * 1.0, floor + .16), native ? [.07, .025, .9] : [.045, .025, .95], 0x929c97, yaw);
          box(routeRows, at(d / length, side * 1.65, floor + .55), [.06, .95, .06], 0x9da9a3);
          box(routeRows, at(d / length, side * 1.65, floor + 1.05), native ? [.7, .05, .1] : [2.0, .05, .1], 0x45534c, yaw);
        }
      }
    }
  }
  if (native) for (const path of paths) for (const p of path.points) {
    const supported = routeRows.some(r => Math.abs(r[4] - .24) < 1e-9 && Math.abs(r[1] + .12 - p[1]) < 1e-9 && Math.abs(p[0] - r[0]) <= r[3] / 2 && Math.abs(p[2] - r[2]) <= r[5] / 2);
    if (!supported) {
      const s = .75;
      box(routeRows, [(Math.floor(p[0] / s) + .5) * s, p[1] - .12, (Math.floor(p[2] / s) + .5) * s], [s, .24, s], 0x787e76);
    }
  }
  // A source-photographed converted technical passage cue by the northward
  // crossing: pipes, frames and wall lights; no fabricated private plant room.
  for (let i = 0; i < 6; i++) {
    const p: Point = [29.0 + i * .25, 3.16, -8];
    if (native) local(baseRows, p, [.12, .12, 15], [0x969f98, 0xa2a99f, 0x856e57][i % 3]);
    else baseCylinders.push([...W("reichstag", p), .12, 15, .12, P.reichstag.yaw, Math.PI / 2]);
  }
  for (const z of [-13, -8, -3]) {
    local(baseRows, [40.36, 1.7, z], [.06, 1.3, 1.05], 0x738482);
    local(baseGlowRows, [40.3, 2.8, z], [.06, .12, 1.25], 0xf7f3d9);
  }
  // The historical heating-gang FRAGMENT, displayed beside the JKH connection.
  // A shallow brick vault is an explicitly estimated sectional interpretation.
  const cx = 391.5, cz = 46.5;
  for (const side of [-1, 1]) box(routeRows, [cx, .25 + .7, cz + side * .95], [6, 1.4, .3], 0x9b7257);
  for (let arch = 0; arch < 14; arch++) {
    const angle = (arch + .5) / 14 * Math.PI, y = 1.65 + Math.sin(angle) * .85, z = cz + Math.cos(angle) * .95;
    // Cardinal small strips describe a separately built Native arch. Drawn is
    // finer but also roof-open in its western half for an unobstructed display.
    if (arch > 7) continue;
    box(routeRows, [cx, y, z], [6, .18, .23], 0xac8466);
  }
  for (let i = 0; i < 13; i++) box(routeRows, [cx - 3 + i * .5, 1.2, cz + 1.11], [.025, 1.8, .012], 0xd1b898);
  box(routeRows, [cx, .15, cz], [6.5, .2, 2.6], 0x95998e);

  const addBatch = (parent: Group, rows: number[][], name: string, glow = false) => {
    const mesh = justicePalaceV183Boxes(native ? mergeNativeRows(rows) : rows, native); mesh.name = name;
    if (glow) { const night = mesh.userData.nightMaterial as MeshStandardMaterial; night.emissive = new Color(0xffd9a1); night.emissiveIntensity = .6; }
    parent.add(mesh);
  };
  addBatch(basement, baseRows, "Basement archive boxes, labels and open crossing");
  addBatch(routes, routeRows, "Roofless public connection exhibit");
  if (!native) for (const [parent, rows] of [[basement, baseCylinders], [routes, routeCylinders]] as const) {
    const geometry = new CylinderGeometry(.5, .5, 1, 16); geometry.deleteAttribute("uv");
    const day = new MeshBasicMaterial({ color: 0xc1c7be }), night = new MeshStandardMaterial({ color: 0xc1c7be, roughness: .82 });
    const mesh = new InstancedMesh(geometry, day, 0), matrices = new Float32Array(rows.length * 16), matrix = new Matrix4();
    rows.forEach((r, i) => { matrix.compose(new Vector3(r[0], r[1], r[2]), new Quaternion().setFromEuler(new Euler(r[7], r[6], 0, "YXZ")), new Vector3(r[3], r[4], r[5])); matrix.toArray(matrices, i * 16); });
    mesh.count = rows.length; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    mesh.userData = { dayMaterial: day, nightMaterial: night }; mesh.name = parent === basement ? "Photographed service-passage pipes" : "Broad round columns in PLH pedestrian passage"; parent.add(mesh);
  }
  // Light cues are assigned to their actual visibility family; no route lamps
  // float outside the building when only the basement is being inspected.
  addBatch(basement, baseGlowRows, "Basement filament lamps", true); addBatch(routes, routeGlowRows, "Connection lighting cues", true);
  root.userData = { sectionOnly: true, estimatedInteriorPlan: true, fullStaticDetailOnTouch: true, nativeMinecraft: native, blockNative: native, keepInMinecraft: native, sourceCourtyardCount: holes.length, archiveBoxes, noNavigationChange: true };
  const state = { routes, basement, live: true };
  root.traverse(object => { if (object instanceof Mesh) object.geometry.addEventListener("dispose", () => { state.live = false; }); });
  views.set(root, state);
  return freezeStaticSceneTransforms(root);
}

/** Private factory identity prevents a public label/foreign group from acting
 * as this exhibit. Both families keep the basement while branches are hidden. */
export function setReichstagUndergroundViewV319(root: Object3D, connections: boolean): boolean {
  const state = views.get(root);
  if (!state || !state.live || state.routes.parent !== root || state.basement.parent !== root) return false;
  state.routes.visible = connections; state.basement.visible = true; return true;
}
