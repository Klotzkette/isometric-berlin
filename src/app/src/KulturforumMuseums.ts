import {
  BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, InstancedMesh,
  Matrix4, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2, Vector3,
} from "three";
import { createBuilder, finishDrawnGroup, paintGeometry } from "./drawnKit";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import source from "./kulturforumMuseumsSource.json";
import { KULTURFORUM_MUSEUM_PROFILE, kulturforumMuseumRoofHeightAt } from "./kulturforumMuseumsProfile";

type Point = [number, number, number];
type Body = typeof source.bodies[number];
type Wall = { body: Body; a: [number, number]; dx: number; dz: number; nx: number; nz: number; length: number; index: number; inner: boolean; facadeSourceId?: string; facadeGroundY?: number };
export type KulturforumMuseumBlock = { position: Point; size: Point; yaw: number; color: number; role: string; sourceId: string };
export type KulturforumMuseumOptions = { mobileLike?: boolean; diagnostics?: boolean };
const C = { brick: 0x9b5544, brickLight: 0xa96351, concrete: 0xc6c2b5, aluminium: 0xb8bfb7, glass: 0x46616a, dark: 0x35454a, stone: 0xd6c4a0, stoneLight: 0xe2d4b6, plinth: 0x858b89, roof: 0xb3b4ab, red: 0xb7392b };

function normal(ring: readonly (readonly number[])[]): Vector3 {
  const n = new Vector3();
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    n.x += (a[1] - b[1]) * (a[2] + b[2]); n.y += (a[2] - b[2]) * (a[0] + b[0]); n.z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n.normalize();
}
function surface(rings: Point[][], color: number): BufferGeometry | null {
  const n = normal(rings[0]), axis = Math.abs(n.y) > Math.max(Math.abs(n.x), Math.abs(n.z)) ? 1 : Math.abs(n.x) > Math.abs(n.z) ? 0 : 2;
  const project = (p: Point) => axis === 1 ? new Vector2(p[0], p[2]) : axis === 0 ? new Vector2(p[2], p[1]) : new Vector2(p[0], p[1]);
  const flat = rings.flat(), triangles = ShapeUtils.triangulateShape(rings[0].map(project), rings.slice(1).map(r => r.map(project)));
  if (!triangles.length) return null;
  const indices = triangles.flatMap(t => {
    const a = new Vector3(...flat[t[0]]), b = new Vector3(...flat[t[1]]), c = new Vector3(...flat[t[2]]);
    return b.sub(a).cross(c.sub(a)).dot(n) < 0 ? t.reverse() : t;
  });
  const g = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(flat.flat(), 3));
  g.setIndex(indices); paintGeometry(g, color); return g;
}
export function kulturforumMuseumWalls(): Wall[] {
  const result: Wall[] = [];
  for (const body of source.bodies) for (const [ri, ring] of [body.source_prism.ring, ...body.source_prism.holes].entries()) {
    const area = ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0);
    const sign = (area >= 0 ? 1 : -1) * (ri ? -1 : 1);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]) / 10;
      if (length < .8) continue;
      const dx = (b[0] - a[0]) / length / 10, dz = (b[1] - a[1]) / length / 10;
      result.push({ body, a: [a[0] / 10, a[1] / 10], dx, dz, nx: sign * dz, nz: -sign * dx, length, index: i, inner: ri > 0 });
    }
  }
  return result;
}
/** The gallery is reached through the retained shared foyer at the Piazzetta.
 * Its old eastern gallery edge adjoins this building and is not an outer door. */
export function kulturforumMuseumEntranceWalls(): Wall[] {
  const craft = kulturforumMuseumWalls().find(w => w.body.prism_id === "K0002QYw" && w.index === 54 && !w.inner)!;
  const profile = KULTURFORUM_MUSEUM_PROFILE.sharedPiazzettaEntrance;
  const [a, b] = profile.sourceEdgeWorldM, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
  return [craft, { body: source.bodies.find(b => b.prism_id === "K0002Sq5")!, a: [...a], dx, dz, nx: dz, nz: -dx, length, index: 55, inner: false, facadeSourceId: "jfT1esZV", facadeGroundY: profile.groundY }];
}
function wallPoint(w: Wall, u: number, y: number, out: number): Point { return [w.a[0] + w.dx * u + w.nx * out, y, w.a[1] + w.dz * u + w.nz * out]; }

function build(minecraft: boolean, options: KulturforumMuseumOptions): Group {
  const root = new Group(), builder = createBuilder(), blocks: KulturforumMuseumBlock[] = [], walls = kulturforumMuseumWalls();
  root.name = minecraft ? "Minecraft Kulturforum museums" : "Kulturforum museums source architecture";
  const emit = (w: Wall, u: number, y: number, width: number, height: number, depth: number, out: number, color: number, role: string) => {
    if (width <= 0 || height <= 0) return;
    if (!minecraft) blocks.push({ position: wallPoint(w, u, y, out), size: [width, height, depth], yaw: -Math.atan2(w.dz, w.dx), color, role, sourceId: w.facadeSourceId ?? w.body.prism_id });
    else {
      // Discrete facade pixels sit beyond the two-metre source block skin.
      const count = Math.max(1, Math.ceil(width / 1.5));
      for (let i = 0; i < count; i++) {
        const position = wallPoint(w, u - width / 2 + (i + .5) * width / count, y, out + (w.facadeSourceId ? 3 : .85));
        const size: Point = Math.abs(w.nx) > Math.abs(w.nz) ? [Math.max(.32, depth), height, width / count] : [width / count, height, Math.max(.32, depth)];
        blocks.push({ position, size, yaw: 0, color, role, sourceId: w.facadeSourceId ?? w.body.prism_id });
      }
    }
  };
  for (const body of source.bodies) {
    const craft = body.prism_id === "K0002QYw";
    if (!minecraft) for (const s of body.surfaces) {
      if (s.kind === "GroundSurface") continue;
      const g = surface(s.rings.map(r => r.map(p => [p[0], Math.max(body.street_ground_y_m, p[1]), p[2]] as Point)), s.kind === "RoofSurface" ? C.roof : craft ? C.brick : C.stone);
      if (g) builder.parts.push(g);
    }
    else {
      const ring = body.source_prism.ring, columns = new Map<string, number>();
      const xs = ring.map(p => p[0] / 10), zs = ring.map(p => p[1] / 10);
      for (let x = Math.floor(Math.min(...xs) / 2) * 2 + 1; x < Math.max(...xs); x += 2) for (let z = Math.floor(Math.min(...zs) / 2) * 2 + 1; z < Math.max(...zs); z += 2) {
        const y = kulturforumMuseumRoofHeightAt(body.prism_id, x, z, true);
        if (y !== null) columns.set(`${x},${z}`, y);
      }
      for (const [key, top] of columns) {
        const [x, z] = key.split(",").map(Number);
        blocks.push({ position: [x, top - .25, z], size: [2, .5, 2], yaw: 0, color: C.roof, role: "source roof block", sourceId: body.prism_id });
        const adjacent = [[-2, 0], [2, 0], [0, -2], [0, 2]].map(([dx, dz]) => columns.get(`${x + dx},${z + dz}`) ?? body.street_ground_y_m);
        const bottom = Math.max(body.street_ground_y_m, Math.min(...adjacent));
        if (bottom >= top - .5) continue;
        for (let y = bottom; y < top - .5; y += 2) {
          const h = Math.min(2, top - .5 - y);
          blocks.push({ position: [x, y + h / 2, z], size: [2, h, 2], yaw: 0, color: craft ? C.brick : C.stone, role: "source wall block", sourceId: body.prism_id });
        }
      }
    }
  }
  // Official DOP 2025: continuous rooflight strips surround the central
  // gallery lantern field. All panels are projected onto the original LoD2
  // roof planes; only the small lantern upstands rise 0.45 m as display detail.
  const roofBox = (id: string, x: number, z: number, sx: number, sz: number, color: number, role: string, height = .08, yaw = 0) => {
    if (minecraft) { x = Math.floor(x / 2) * 2 + 1; z = Math.floor(z / 2) * 2 + 1; sx = Math.min(1.86, sx); sz = Math.min(1.86, sz); }
    const y = kulturforumMuseumRoofHeightAt(id, x, z, minecraft);
    if (y === null) return;
    blocks.push({ position: [x, y + height / 2 + .035, z], size: [sx, height, sz], yaw: minecraft ? 0 : yaw, color, role, sourceId: id });
  };
  const yaw = -Math.atan2(.289, .9573), c = Math.cos(yaw), sn = Math.sin(yaw);
  const roofPoint = (u: number, v: number): [number, number] => [-477 + c * u + sn * v, 1139 - sn * u + c * v];
  for (const [u0, u1, v0, v1] of [[-45, 33, -29, -15], [-45, 33, 16, 30], [-59, -45, -29, 30], [34, 46, 7, 37], [-40, -8, -40, -34], [1, 30, -40, -34]]) {
    for (let u = u0; u < u1; u += 2.4) for (let v = v0; v < v1; v += 2.4) {
      const su = Math.min(2.4, u1 - u), sv = Math.min(2.4, v1 - v);
      const corners = [[u + .08, v + .08], [u + su - .08, v + .08], [u + su - .08, v + sv - .08], [u + .08, v + sv - .08]].map(([a, b]) => roofPoint(a, b));
      const ys = corners.map(([x, z]) => kulturforumMuseumRoofHeightAt("K0002Sq5", x, z, minecraft));
      if (ys.some(y => y === null)) continue;
      if (minecraft) { const [x, z] = roofPoint(u + su / 2, v + sv / 2); roofBox("K0002Sq5", x, z, su - .13, sv - .13, 0x86a8b5, "gallery rooflight pane"); }
      else {
        const g = surface([corners.map(([x, z], i) => [x, ys[i]! + .035, z] as Point).reverse()], 0x86a8b5);
        if (g) builder.parts.push(g);
      }
    }
  }
  for (const v of [-7, 0, 7]) for (let u = -39; u <= 29; u += 6.8) {
    const [x, z] = roofPoint(u, v);
    roofBox("K0002Sq5", x, z, 3.0, 3.0, 0xdde4da, "gallery central roof lantern", .45, yaw);
    roofBox("K0002Sq5", x, z, 2.45, 2.45, 0xb1c5c5, "gallery central lantern glass", .49, yaw);
  }
  // Aerial-observed roof service heads and their coping, deliberately shallow:
  // DOP is plan evidence, not a measurement of their unpublished height.
  for (const [x, z, sx, sz] of [[-279, 992, 5, 5], [-291, 1036, 6, 6], [-307, 984, 9, 7], [-318, 1006, 4, 5]]) {
    roofBox("K0002QYw", x, z, sx, sz, 0xc9c8bd, "craft roof service coping", .28, .43);
    roofBox("K0002QYw", x, z, sx - .45, sz - .45, 0x969d99, "craft roof service field", .31, .43);
  }
  for (const w of walls) {
    if (w.length < 2.5) continue;
    const craft = w.body.prism_id === "K0002QYw", base = w.body.street_ground_y_m;
    const at = wallPoint(w, w.length / 2, 0, -.08);
    const top = kulturforumMuseumRoofHeightAt(w.body.prism_id, at[0], at[2]) ?? Math.max(...w.body.surfaces.filter(s => s.kind === "RoofSurface").flatMap(s => s.rings.flat().map(p => p[1])));
    const span = top - base;
    // Aluminium coping, concrete floor bands, brick fins are photographed KGM features.
    emit(w, w.length / 2, top - .13, w.length, .26, .24, .17, craft ? C.aluminium : C.plinth, "source-aligned parapet");
    if (craft) {
      for (const y of [base + 4.9, base + 10.1]) if (y < top - .4) emit(w, w.length / 2, y, w.length, .29, .19, .14, C.concrete, "craft exposed concrete band");
      const bays = Math.max(1, Math.round(w.length / 4.2));
      for (let i = 0; i < bays; i++) {
        const u = (i + .5) * w.length / bays, bay = w.length / bays;
        emit(w, u, base + span / 2, bay - .1, span - .55, .06, .08, i % 3 ? C.brick : C.brickLight, "craft brick panel");
        emit(w, u - bay / 2 + .12, base + span / 2, .14, span - .55, .23, .24, C.brick, "craft vertical brick fin");
        for (let y = base + 1.6; y < top - 1; y += 2.2) emit(w, u, y, bay * .74, .065, .09, .16, C.concrete, "craft pale brick course");
      }
      // The western part of the south forecourt is the distinctive metal/glass wing.
      if (!w.inner && [52, 54, 55].includes(w.index)) {
        emit(w, w.length / 2, base + 7.9, w.length, 5.3, .1, .34, C.aluminium, "craft aluminium entrance wing");
        const panes = Math.max(2, Math.round(w.length / 1.6));
        for (let i = 0; i < panes; i++) {
          const u = (i + .5) * w.length / panes;
          emit(w, u, base + 6.8, w.length / panes - .13, 2.75, .11, .43, C.glass, "craft entrance wing glazing");
          emit(w, u - w.length / panes / 2, base + 7.9, .11, 5.3, .2, .49, C.aluminium, "craft silver mullion");
        }
      }
    } else {
      // Official museum association identifies blind upper windows and a rusticated base.
      emit(w, w.length / 2, base + 1.65, w.length, 3.3, .16, .13, C.plinth, "gallery rusticated plinth");
      for (let y = base + .35; y < base + 3.3; y += .52) emit(w, w.length / 2, y, w.length, .065, .12, .25, C.dark, "gallery plinth joint");
      const bays = Math.max(1, Math.round(w.length / 7.4));
      for (let i = 0; i < bays; i++) {
        const bay = w.length / bays, u = (i + .5) * bay, h = Math.min(4.4, span * .36), y = base + span * .56;
        emit(w, u, y, Math.min(2.7, bay * .55) + .17, h + .17, .06, .08, 0xbba984, "gallery blind window reveal");
        emit(w, u, y, Math.min(2.7, bay * .55), h, .09, .13, C.stoneLight, "gallery stone blind window");
        emit(w, u - bay / 2 + .07, base + 3.5 + (span - 3.8) / 2, .1, span - 3.8, .13, .16, C.plinth, "gallery metal bay joint");
        if (w.length > 12) {
          emit(w, u, base + 1.7, Math.min(2.7, bay * .65), 1.9, .12, .28, C.glass, "gallery lower glazing");
          emit(w, u, base + 1.7, .11, 1.9, .18, .37, C.aluminium, "gallery lower glazing mullion");
        }
      }
      for (let y = base + 4.4; y < top - .5; y += 1.2) emit(w, w.length / 2, y, w.length, .035, .07, .07, 0xcbb994, "gallery fine stone course");
    }
  }
  // Entrance coordinates are source-wall registers, not the old off-wall marker boxes.
  const entrances = [
    { id: "K0002QYw", edge: 54, width: 15.5, label: "KUNSTGEWERBEMUSEUM", color: C.red },
    { id: "K0002Sq5", edge: 4, width: 12, label: "GEMÄLDEGALERIE", color: C.dark },
  ];
  for (const entry of entrances) {
    const w = kulturforumMuseumEntranceWalls().find(w => w.body.prism_id === entry.id)!;
    const u = w.length / 2, width = Math.min(entry.width, w.length - .8), base = w.facadeGroundY ?? w.body.street_ground_y_m, h = 3.65;
    emit(w, u, base + h / 2, width, h, .12, .4, C.glass, "museum entrance glazing");
    for (let i = 0; i <= 8; i++) emit(w, u - width / 2 + width * i / 8, base + h / 2, .095, h, .24, .52, C.aluminium, "museum door frame");
    for (const y of [.08, 2.65, h]) emit(w, u, base + y, width, .11, .24, .53, C.aluminium, "museum door transom");
    for (const du of [-1.35, -.25, .25, 1.35]) emit(w, u + du, base + 1.25, .06, .55, .14, .68, C.aluminium, "museum door pull");
    emit(w, u, base + h + .62, width + .35, 1.05, .18, .39, C.aluminium, "museum entrance sign fascia");
    // Axis-aligned native fascia pixels project beyond their source wall plane.
    // Keep each glyph's back face beyond that complete stepped envelope.
    const fasciaPixelWidth = (width + .35) / Math.ceil((width + .35) / 1.5);
    const normalMajor = Math.max(Math.abs(w.nx), Math.abs(w.nz)), normalMinor = Math.min(Math.abs(w.nx), Math.abs(w.nz));
    const letteringOut = minecraft ? .39 + normalMajor * .32 + normalMinor * (fasciaPixelWidth + .073) / 2 + .08 : .53;
    const text = letteringStrokePaths(entry.label, .65), textWidth = Math.max(...text.flat().map(p => p[0])) - Math.min(...text.flat().map(p => p[0]));
    const scale = Math.min(1, (width - .3) / textWidth);
    // Looking inward from the facade, reader-right is (nz, 0, -nx).
    // Source polygon tangents usually run the other way around the exterior.
    const readerSign = Math.sign(w.dx * w.nz - w.dz * w.nx);
    for (const line of text) for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]) * scale, count = Math.max(1, Math.ceil(length / .12));
      for (let j = 0; j < count; j++) {
        const t = (j + .5) / count;
        emit(w, u + readerSign * (a[0] + (b[0] - a[0]) * t) * scale, base + h + .52 + (a[1] + (b[1] - a[1]) * t) * scale, .073, .073, .07, letteringOut, entry.color, "museum entrance lettering");
      }
    }
    const sign = new Group();
    sign.name = `${entry.label} entrance lettering`;
    sign.userData.lettering = entry.label; sign.userData.kulturforumEntrance = true;
    sign.userData.sourceId = w.facadeSourceId ?? entry.id; sign.userData.renderedAsFacadeInstances = true;
    root.add(sign);
    // The real forecourt ramps have open rails, not a golden concert-hall canopy.
    for (const du of [-width / 2 - .8, width / 2 + .8]) {
      emit(w, u + du, base + .9, .07, .07, 3.3, 1.65, C.aluminium, "museum entrance handrail");
      for (const out of [.35, 2.95]) emit(w, u + du, base + .44, .075, .88, .075, out, C.aluminium, "museum entrance handrail post");
    }
  }
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("normal"); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, roughness: .88, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, blocks.length), matrix = new Matrix4(), size = new Vector3(), color = new Color();
  blocks.forEach((b, i) => { matrix.makeRotationY(b.yaw).scale(size.set(...b.size)).setPosition(...b.position); mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.setHex(b.color)); });
  mesh.name = `${root.name} facade and native blocks`; mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  const shell = finishDrawnGroup(builder, { name: "Kulturforum complete official wall and roof sheets" }); if (shell) root.add(shell);
  root.userData.profile = KULTURFORUM_MUSEUM_PROFILE; root.userData.textureFree = true; root.userData.sourceIds = source.bodies.map(b => b.prism_id);
  root.userData.entranceSourceIds = ["K0002QYw", "jfT1esZV"];
  root.userData.instanceCount = blocks.length; root.userData.detailCounts = blocks.reduce<Record<string, number>>((out, b) => { out[b.role] = (out[b.role] ?? 0) + 1; return out; }, {});
  if (options.diagnostics) root.userData.blocks = blocks;
  freezeStaticSceneTransforms(root); return root;
}
export function createKulturforumMuseums(options: KulturforumMuseumOptions = {}): Group { return build(false, options); }
export function createMinecraftKulturforumMuseums(options: KulturforumMuseumOptions = {}): Group { return build(true, options); }
