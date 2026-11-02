import { BufferAttribute, BufferGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, LineSegments, Matrix4, Mesh, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PrismBuilding } from "./IsometricCityWorld";
import { hbfBoxFragmentsV291, hbfPolygonComplementV291, hbfSegmentComplementV291, type HbfBoxV291, type HbfOpeningV291 } from "./HbfGeometryOpeningsV291";
import { PARLIAMENT_INTERIORS_V295 as P, PARLIAMENT_OPENINGS_V295, type ParliamentSiteV295 } from "./parliamentInteriorsV295Profile";
import { reichstagRampPoints } from "./ReichstagDome";
// Independently retained complete shipped records. Changed/unknown owners stay
// closed; enabling requires the complete interior in the same world transaction.
const originals: readonly PrismBuilding[] = [{ "id": "UbQkgNZe", "ring": [[2630, 548], [2639, 228], [2699, 230], [2698, 258], [2703, 258], [2702, 286], [2697, 286], [2696, 314], [2713, 315], [2712, 343], [2695, 342], [2693, 438], [2709, 438], [2708, 466], [2692, 466], [2691, 494], [2696, 494], [2695, 522], [2690, 522], [2689, 549]], "holes": [], "y0_dm": 50, "h_dm": 351, "class": 0, "roof": 3100, "tone": [65, 70, 68] }, { "id": "ycOYQRVL", "ring": [[2693, 410], [2695, 370], [2711, 370], [2710, 410]], "holes": [], "y0_dm": 50, "h_dm": 351, "class": 0, "roof": 2100, "tone": [66, 70, 68] }, { "id": "K0002MCN", "ring": [[2882, -264], [2910, -263], [2910, -253], [3082, -248], [3082, -260], [3261, -254], [3261, -242], [3433, -237], [3433, -248], [3461, -247], [3462, -274], [3586, -270], [3585, -243], [3613, -243], [3612, -215], [3639, -214], [3636, -90], [3609, -91], [3608, -63], [3597, -63], [3589, 222], [3595, 222], [3593, 272], [3664, 274], [3663, 282], [3675, 282], [3667, 556], [3655, 556], [3655, 564], [3585, 562], [3584, 612], [3578, 611], [3569, 896], [3580, 897], [3579, 925], [3606, 925], [3602, 1049], [3575, 1049], [3574, 1077], [3546, 1076], [3546, 1103], [3421, 1099], [3422, 1072], [3394, 1071], [3395, 1061], [3223, 1055], [3222, 1067], [3106, 1064], [3043, 1062], [3044, 1050], [2872, 1045], [2871, 1055], [2843, 1055], [2843, 1082], [2718, 1078], [2719, 1051], [2691, 1050], [2692, 1022], [2665, 1021], [2669, 897], [2696, 898], [2696, 870], [2707, 870], [2715, 585], [2693, 585], [2694, 550], [2689, 549], [2690, 522], [2695, 522], [2696, 494], [2691, 494], [2692, 466], [2708, 466], [2709, 438], [2693, 438], [2693, 410], [2710, 410], [2711, 370], [2695, 370], [2695, 342], [2712, 343], [2713, 315], [2696, 314], [2697, 286], [2702, 286], [2703, 258], [2698, 258], [2699, 230], [2704, 230], [2705, 195], [2727, 196], [2735, -88], [2724, -88], [2725, -116], [2698, -117], [2702, -241], [2729, -240], [2730, -268], [2758, -268], [2758, -295], [2883, -291]], "holes": [[[3189, 148], [3301, 151], [3306, -4], [3253, -5], [3252, 12], [3203, 11], [3204, -2], [3194, -2]], [[3023, -12], [3018, 143], [3130, 146], [3135, -4], [3125, -4], [3124, 8], [3075, 7], [3076, -11]], [[3479, 20], [3418, 18], [3413, 188], [3474, 190]], [[3003, 659], [2998, 814], [3052, 816], [3052, 798], [3101, 800], [3101, 812], [3111, 813], [3115, 663]], [[3286, 668], [3174, 664], [3169, 814], [3179, 815], [3180, 802], [3229, 804], [3228, 821], [3281, 823]], [[3400, 638], [3395, 807], [3455, 809], [3460, 640]]], "y0_dm": 50, "h_dm": 281, "class": 0, "roof": 9999, "tone": [73, 78, 76] }, { "id": "eaCxS2u2", "ring": [[6343, 12844], [6115, 12861], [6109, 12782], [6102, 12782], [6090, 12623], [6097, 12622], [6091, 12542], [6099, 12542], [6067, 12118], [6063, 12069], [6056, 12070], [6053, 12039], [6048, 12039], [6046, 12008], [6051, 12008], [6049, 11977], [6169, 11968], [6170, 11978], [6369, 11963], [6369, 11957], [6493, 11948], [6491, 11924], [6497, 11924], [6544, 11921], [6545, 11944], [6658, 11935], [6658, 11941], [6858, 11926], [6857, 11916], [6978, 11907], [6980, 11938], [6985, 11938], [6987, 11969], [6982, 11969], [6985, 12000], [6977, 12001], [7002, 12339], [7012, 12473], [7020, 12473], [7026, 12552], [7033, 12552], [7045, 12711], [7038, 12712], [7044, 12792], [6817, 12809], [6820, 12860], [6662, 12871], [6663, 12882], [6505, 12893], [6504, 12882], [6346, 12893]], "holes": [[[6753, 12060], [6766, 12234], [6881, 12225], [6868, 12051]], [[6785, 12498], [6901, 12489], [6888, 12315], [6772, 12324]], [[6680, 12433], [6625, 12437], [6630, 12492], [6684, 12488]], [[6421, 12452], [6425, 12507], [6480, 12503], [6476, 12448]], [[6294, 12094], [6178, 12103], [6191, 12277], [6307, 12268]], [[6314, 12358], [6198, 12367], [6211, 12541], [6327, 12533]]], "y0_dm": 48, "h_dm": 30, "class": 0, "roof": 9999, "tone": [150, 162, 159] }];
const fingerprints = new Map(originals.map(b => [b.id, JSON.stringify(b)]));
const none: readonly HbfOpeningV291[] = [];
export function parliamentSourceOwnersAdmittedV295(buildings?: readonly unknown[]): boolean {
  if (!buildings)
    return false;
  return originals.every(old => buildings.some(b => b !== null && typeof b === "object" && "id" in b && b.id === old.id && JSON.stringify(b) === fingerprints.get(old.id)));
}
export function parliamentRetainedOpeningsV295(building: PrismBuilding, enabled = false): readonly HbfOpeningV291[] {
  return enabled && building.id !== "eaCxS2u2" && fingerprints.get(building.id) === JSON.stringify(building) ? PARLIAMENT_OPENINGS_V295.reichstag : none;
}
/** Retain every old outside triangle and attribute. Only interpolated aperture
* boundary vertices are new; original source sheets are never mutated. */
export function parliamentClipGeometryV295(source: BufferGeometry, cuts: readonly HbfOpeningV291[]): BufferGeometry {
  if (!cuts.length)
    return source;
  const names = Object.keys(source.attributes), attrs = names.map(n => source.getAttribute(n)), offsets: number[] = [];
  let width = 0;
  for (const a of attrs) {
    offsets.push(width);
    width += a.itemSize;
  }
  const positions = source.getAttribute("position"), index = source.index, out: number[][] = names.map(() => []);
  let changed = false;
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    const tri = [0, 1, 2].map(j => { const k = index ? index.getX(i + j) : i + j; return attrs.flatMap(a => Array.from({ length: a.itemSize }, (_, v) => a.getComponent(k, v))); });
    const parts = hbfPolygonComplementV291(tri, cuts);
    if (parts)
      changed = true;
    for (const p of parts ?? [tri])
      for (let j = 1; j + 1 < p.length; j++)
        for (const v of [p[0], p[j], p[j + 1]])
          attrs.forEach((a, k) => out[k].push(...v.slice(offsets[k], offsets[k] + a.itemSize)));
  }
  if (!changed)
    return source;
  const geometry = new BufferGeometry();
  names.forEach((n, i) => geometry.setAttribute(n, new BufferAttribute(new Float32Array(out[i]), attrs[i].itemSize)));
  if (!geometry.getAttribute("normal"))
    geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = { ...source.userData, parliamentOpeningV295: true };
  return geometry;
}
export function parliamentClipInkV295(source: BufferGeometry, cuts: readonly HbfOpeningV291[]): BufferGeometry {
  if (!cuts.length)
    return source;
  const p = source.getAttribute("position"), out: number[] = [];
  let changed = false;
  for (let i = 0; i < p.count; i += 2) {
    const a = [p.getX(i), p.getY(i), p.getZ(i)], b = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)];
    const parts = hbfSegmentComplementV291(a, b, cuts);
    if (parts)
      changed = true;
    for (const q of parts ?? [[a, b]])
      out.push(...q[0], ...q[1]);
  }
  if (!changed)
    return source;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(out), 3));
  return geometry;
}
const reichstagNames = ["Reichstag LoD2 envelope", "Reichstag west entrance recessed backing", "Reichstag west entrance tall glass pane", "Reichstag west entrance bronze mullions", "Reichstag west entrance bronze transoms", "Reichstag west grand stair step", "Reichstag dome roof podium"];
/** Preserve the shared unit cube and every untouched transform. Axis-aligned
* local cuts produce exact complementary cuboids in the SAME instance batch. */
function clipAlignedBoxInstances(o: InstancedMesh, cuts: readonly HbfOpeningV291[]): boolean {
  if (o.geometry.type !== "BoxGeometry")
    return false;
  const unit: HbfBoxV291 = { min: [-.5, -.5, -.5], max: [.5, .5, .5] }, instance = new Matrix4(), world = new Matrix4();
  const matrices: number[] = [], colors: number[] = [];
  let changed = false;
  for (let i = 0; i < o.count; i++) {
    o.getMatrixAt(i, instance);
    world.multiplyMatrices(o.matrixWorld, instance);
    const e = world.elements;
    const corners = [-.5, .5].flatMap(x => [-.5, .5].flatMap(y => [-.5, .5].map(z => new Vector3(x, y, z).applyMatrix4(world))));
    const lo = [0, 1, 2].map(k => Math.min(...corners.map(p => p.getComponent(k)))), hi = [0, 1, 2].map(k => Math.max(...corners.map(p => p.getComponent(k))));
    const local: HbfOpeningV291[] = [];
    for (const cut of cuts) {
      if (lo.some((n, k) => n >= cut.bounds.max[k] - 1e-7 || hi[k] <= cut.bounds.min[k] + 1e-7))
        continue;
      const min = [-Infinity, -Infinity, -Infinity], max = [Infinity, Infinity, Infinity];
      let empty = false;
      for (const p of cut.planes) {
        const plane = [p[0] * e[0] + p[1] * e[1] + p[2] * e[2], p[0] * e[4] + p[1] * e[5] + p[2] * e[6], p[0] * e[8] + p[1] * e[9] + p[2] * e[10]], d = p[0] * e[12] + p[1] * e[13] + p[2] * e[14] + p[3];
        const axis = plane.reduce((best, n, k) => Math.abs(n) > Math.abs(plane[best]) ? k : best, 0), n = plane[axis];
        if (Math.abs(n) < 1e-10) {
          if (d < 0)
            empty = true;
          continue;
        }
        if (plane.some((q, k) => k !== axis && Math.abs(q) > Math.abs(n) * 1e-6))
          return false;
        const edge = -d / n;
        if (n > 0)
          min[axis] = Math.max(min[axis], edge);
        else
          max[axis] = Math.min(max[axis], edge);
      }
      if (empty || min.some((n, k) => n >= max[k]))
        continue;
      const b: HbfBoxV291 = { min: min as [
          number,
          number,
          number
        ], max: max as [
          number,
          number,
          number
        ] };
      local.push({ id: cut.id, planes: [], bounds: b, nativeBoxes: [b] });
    }
    const parts = hbfBoxFragmentsV291(unit, local);
    if (parts.length !== 1 || parts[0] !== unit)
      changed = true;
    for (const b of parts) {
      const m = parts.length === 1 && b === unit ? instance : instance.clone().multiply(new Matrix4().makeTranslation((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2)).multiply(new Matrix4().makeScale(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]));
      matrices.push(...m.elements);
      if (o.instanceColor)
        colors.push(o.instanceColor.getX(i), o.instanceColor.getY(i), o.instanceColor.getZ(i));
    }
  }
  if (changed) {
    o.instanceMatrix = new InstancedBufferAttribute(new Float32Array(matrices), 16);
    if (o.instanceColor)
      o.instanceColor = new InstancedBufferAttribute(new Float32Array(colors), 3);
    o.count = matrices.length / 16;
    o.computeBoundingBox();
    o.computeBoundingSphere();
    o.userData.parliamentOpeningV295 = true;
  }
  return true;
}
/** Exact previously-authored owners only. This is deliberately default-off at
* their factory; it is enabled only once the complete interior is admitted. */
export function openParliamentAuthoredMeshesV295(root: Group, site: ParliamentSiteV295): void {
  root.updateMatrixWorld(true);
  const cuts = PARLIAMENT_OPENINGS_V295[site], rootInverse = root.matrixWorld.clone().invert();
  const objects: [
    Mesh | LineSegments,
    boolean
  ][] = [];
  root.traverse(o => {
    if (!(o instanceof Mesh || o instanceof LineSegments))
      return;
    if (site === "reichstag" && !reichstagNames.some(n => o.name === n || o.name === `${n} model edges`))
      return;
    objects.push([o, o instanceof LineSegments]);
  });
  for (const [o, line] of objects) {
    if (o instanceof InstancedMesh) {
      if (clipAlignedBoxInstances(o, cuts))
        continue;
      const pieces: BufferGeometry[] = [], retained: number[] = [], colors: number[] = [], instance = new Matrix4();
      let changed = false;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, instance);
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld.clone().multiply(instance));
        if (o.instanceColor) {
          const rgb = new Float32Array(g.getAttribute("position").count * 3);
          for (let v = 0; v < rgb.length; v += 3)
            rgb.set([o.instanceColor.getX(i), o.instanceColor.getY(i), o.instanceColor.getZ(i)], v);
          g.setAttribute("color", new BufferAttribute(rgb, 3));
        }
        const clipped = parliamentClipGeometryV295(g, cuts);
        if (clipped === g) {
          g.dispose();
          retained.push(...instance.elements);
          if (o.instanceColor)
            colors.push(o.instanceColor.getX(i), o.instanceColor.getY(i), o.instanceColor.getZ(i));
          continue;
        }
        changed = true;
        g.dispose();
        clipped.applyMatrix4(rootInverse);
        if (clipped.index) {
          const flat = clipped.toNonIndexed();
          clipped.dispose();
          pieces.push(flat);
        }
        else
          pieces.push(clipped);
      }
      if (!changed)
        continue;
      o.instanceMatrix = new InstancedBufferAttribute(new Float32Array(retained), 16);
      if (o.instanceColor)
        o.instanceColor = new InstancedBufferAttribute(new Float32Array(colors), 3);
      o.count = retained.length / 16;
      o.computeBoundingBox();
      o.computeBoundingSphere();
      o.userData.parliamentOpeningV295 = true;
      // The few curved portal fragments use the existing colour/normal shell
      // batch. All unchanged arches, columns and leaves stay instanced.
      const target = site === "abgeordnetenhaus" ? root.children.find(n => n instanceof Mesh && !(n instanceof InstancedMesh)) as Mesh | undefined : undefined;
      if (target) {
        const old = target.geometry, base = old.index ? old.toNonIndexed() : old;
        const merged = mergeGeometries([base, ...pieces], false)!;
        if (base !== old)
          base.dispose();
        old.dispose();
        pieces.forEach(g => g.dispose());
        target.geometry = merged;
        target.geometry.computeBoundingBox();
        target.geometry.computeBoundingSphere();
      }
      else {
        const merged = mergeGeometries(pieces, false)!;
        pieces.forEach(g => g.dispose());
        const material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
        const replacement = new Mesh(merged, material);
        replacement.name = o.name + " portal complement";
        replacement.userData = { ...o.userData };
        for (const m of Array.isArray(material) ? material : [material])
          Object.assign(m, { vertexColors: true });
        root.add(replacement);
      }
    }
    else {
      const world = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const clipped = line ? parliamentClipInkV295(world, cuts) : parliamentClipGeometryV295(world, cuts);
      if (clipped === world) {
        world.dispose();
        continue;
      }
      world.dispose();
      clipped.applyMatrix4(o.matrixWorld.clone().invert());
      o.geometry.dispose();
      o.geometry = clipped;
      o.userData.parliamentOpeningV295 = true;
    }
  }
  root.userData.parliamentInteriorsV295 = true;
}
/** The retained annular platform needs two stair apertures over the terminal
* public ramp segments. The default dome/ramp/mirror model stays untouched;
* only this exact estimated platform owner is complemented after room admission. */
export function openParliamentDomePlatformV295(root: Group): void {
  const cuts: HbfOpeningV291[] = [];
  for (const phase of [0, Math.PI]) {
    const points = reichstagRampPoints(phase);
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i], b = points[i + 1], base = P.reichstag.terrace;
      if (base + Math.max(a.y, b.y) + 2.05 < base + 16.7 || base + Math.min(a.y, b.y) > base + 16.69)
        continue;
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), tx = dx / len, tz = dz / len, nx = -tz, nz = tx;
      const cx = P.reichstag.anchor[0] + (a.x + b.x) / 2, cz = P.reichstag.anchor[2] + (a.z + b.z) / 2, h = len / 2 + .04, w = 1.03, lo = base + Math.min(a.y, b.y) + .24, hi = base + Math.max(a.y, b.y) + 2.05;
      const rx = Math.abs(tx) * h + Math.abs(nx) * w, rz = Math.abs(tz) * h + Math.abs(nz) * w;
      cuts.push({ id: `platform-ramp-headroom-${phase}-${i}`, planes: [[tx, 0, tz, h - tx * cx - tz * cz], [-tx, 0, -tz, h + tx * cx + tz * cz], [nx, 0, nz, w - nx * cx - nz * cz], [-nx, 0, -nz, w + nx * cx + nz * cz], [0, 1, 0, -lo], [0, -1, 0, hi]], bounds: { min: [cx - rx, lo, cz - rz], max: [cx + rx, hi, cz + rz] } });
    }
  }
  root.updateMatrixWorld(true);
  const o = root.getObjectByName("Reichstag open observation platform");
  if (!(o instanceof Mesh))
    return;
  const world = o.geometry.clone().applyMatrix4(o.matrixWorld), clipped = parliamentClipGeometryV295(world, cuts);
  if (clipped === world) {
    world.dispose();
    return;
  }
  world.dispose();
  clipped.applyMatrix4(o.matrixWorld.clone().invert());
  o.geometry.dispose();
  o.geometry = clipped;
  o.userData.parliamentRampAperturesV295 = true;
}
