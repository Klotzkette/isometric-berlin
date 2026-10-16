import { BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import source from "./data/townhallV227Profile.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { DISTRICT_TOWNHALL_RECIPES_V227 as RECIPES, type TownhallEdgeV227 as Edge,
  type TownhallPartV227 as Part, type TownhallSiteV227 as Site, type TownhallRecipeV227 as Recipe } from "./districtTownhallProfileV227";

type Row = number[];
type WindowRow = { x: number; y: number; z: number; w: number; h: number; yaw: number; arch: boolean };
type Facade = Edge & { length: number; dx: number; dz: number; nx: number; nz: number; yaw: number };
export const DISTRICT_TOWNHALLS_V227_GROUP = "Berlin district town halls source-bound recognition v227";

function contains(ring: readonly number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function inPart(p: Part, x: number, z: number): boolean {
  return contains(p.ring, x, z) && !p.holes.some(h => contains(h, x, z));
}
function facade(edge: Edge, part: Part): Facade | null {
  const length = Math.hypot(edge.b[0] - edge.a[0], edge.b[1] - edge.a[1]);
  if (length < 1.1 || edge.eave - edge.base < 2.3) return null;
  const dx = (edge.b[0] - edge.a[0]) / length, dz = (edge.b[1] - edge.a[1]) / length;
  let nx = dz, nz = -dx;
  if (edge.normal) { nx = edge.normal[0]; nz = edge.normal[1]; }
  else if (inPart(part, (edge.a[0] + edge.b[0]) / 2 + nx * .05, (edge.a[1] + edge.b[1]) / 2 + nz * .05)) { nx = -nx; nz = -nz; }
  return { ...edge, length, dx, dz, nx, nz, yaw: -Math.atan2(dz, dx) };
}
function panel(rows: Row[], f: Facade, u: number, y: number, width: number, height: number,
  color: number, out = .2, depth = .12): void {
  if (width <= 0 || height <= 0) return;
  rows.push([f.a[0] + f.dx * u + f.nx * out, y, f.a[1] + f.dz * u + f.nz * out, width, height, depth, f.yaw, color]);
}
function line(rows: Row[], f: Facade, a: number[], b: number[], color: number, width = .12, out = .35): void {
  // Short flat squares are a texture-free original line, independent of fonts
  // or photographic ornament. Native construction is separately orthogonal.
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (width * 1.1)));
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n;
    panel(rows, f, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, width * 1.4, width * 1.4, color, out);
  }
}
function window(rows: Row[], windows: WindowRow[], f: Facade, u: number, y: number, width: number, height: number,
  r: Recipe, arched: boolean, native: boolean): void {
  const x = f.a[0] + f.dx * u + f.nx * .25, z = f.a[1] + f.dz * u + f.nz * .25;
  if (native) {
    // Two independent orthogonal blocks: pale reveal and smaller glazed face.
    // Native detail deliberately has no smooth diagonals or letter/arch curves.
    const w = Math.max(.18, Math.abs(f.dx) * width + Math.abs(f.dz) * .13);
    const d = Math.max(.18, Math.abs(f.dz) * width + Math.abs(f.dx) * .13);
    const axis = Math.abs(f.nx) > Math.abs(f.nz) ? 0 : 1;
    const extent = axis === 0 ? w : d, normal = Math.abs(axis === 0 ? f.nx : f.nz);
    // Expose the glazed front beyond the native reveal even on oblique walls.
    // Merely shifting .13m hides the pane inside its wider diagonal AABB.
    const out = Math.max(.13, ((extent + .18 - extent * .83) / 2 + .035) / normal);
    rows.push([x,y,z,w+.18,height+.18,d+.18,0,r.trim]);
    rows.push([x+f.nx*out,y,z+f.nz*out,w*.83,height*.84,d*.83,0,r.glass]);
    if (arched) rows.push([x,y+height*.6,z,w*.55,.35,d*.55,0,r.trim]);
  } else windows.push({ x, y, z, w: width, h: height, yaw: Math.atan2(f.nx,f.nz), arch: arched });
}
function windowPrimitive(r: Recipe, arched: boolean): BufferGeometry {
  const pieces: BufferGeometry[] = [], tint = new Color();
  const cube = (x:number,y:number,z:number,w:number,h:number,d:number,color:number,rotation=0) => {
    const geometry = new BoxGeometry(w,h,d); geometry.rotateZ(rotation); geometry.translate(x,y,z); geometry.deleteAttribute("uv");
    const colors = new Float32Array(geometry.getAttribute("position").count*3); tint.setHex(color);
    for(let i=0;i<colors.length;i+=3) tint.toArray(colors,i);
    geometry.setAttribute("color",new BufferAttribute(colors,3)); pieces.push(geometry);
  };
  cube(0,0,0,.96,.96,.04,r.glass);
  for(const side of [-1,1]) cube(side*.5,0,.05,.055,1.03,.11,r.trim);
  cube(0,-.51,.075,1.15,.08,.24,r.trim);
  cube(0,0,.065,.035,.96,.1,r.trim); cube(0,.12,.065,.96,.035,.1,r.trim);
  if(arched) {
    const g=new BufferGeometry();g.setAttribute("position",new BufferAttribute(new Float32Array([-.5,.48,.025,.5,.48,.025,0,.85,.025]),3));
    const colors=new Float32Array(9);tint.setHex(r.glass);for(let i=0;i<9;i+=3)tint.toArray(colors,i);
    g.setAttribute("color",new BufferAttribute(colors,3));g.computeVertexNormals();g.setIndex([0,1,2]);pieces.push(g);
    for(const side of [-1,1]) cube(side*.25,.665,.06,Math.hypot(.5,.37),.055,.11,r.trim,-side*Math.atan2(.37,.5));
  } else cube(0,.5,.05,1.07,.055,.11,r.trim);
  const geometry=mergeGeometries(pieces,false)!;pieces.forEach(g=>g.dispose());
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
function addWindows(root: Group, site: Site, rows: WindowRow[]): void {
  const recipe=RECIPES[site.key], day=new MeshBasicMaterial({vertexColors:true}), night=new MeshStandardMaterial({vertexColors:true,roughness:.86});
  for(const arch of [false,true]) {
    const selected=rows.filter(row=>row.arch===arch);if(!selected.length)continue;
    const mesh=new InstancedMesh(windowPrimitive(recipe,arch),day,0),matrices=new Float32Array(selected.length*16),matrix=new Matrix4(),scale=new Vector3();
    selected.forEach((row,i)=>{matrix.makeRotationY(row.yaw).scale(scale.set(row.w,row.h,1));matrix.setPosition(row.x,row.y,row.z).toArray(matrices,i*16);});
    mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.count=selected.length;
    mesh.name=`${site.name} shared ${arch?"pointed":"rectangular"} windows v227`;
    mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,siteKey:site.key,fullStaticDetailOnTouch:true,displayFittingsEstimated:true};
    mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
  }
}
function occluded(site: Site, owner: Part, f: Facade, u: number, y: number): boolean {
  const x = f.a[0] + f.dx * u + f.nx * .4, z = f.a[1] + f.dz * u + f.nz * .4;
  return site.parts.some(p => p !== owner && y > p.ground_y_m && y < p.top_y_m - .5 && inPart(p, x, z));
}
function clock(rows: Row[], f: Facade, r: Recipe, native: boolean): void {
  const radius = Math.min(2.2, f.length * .21), cx = f.length / 2, cy = f.eave - radius * 1.8;
  if (cy - radius < f.base + 1) return;
  const slices = native ? 10 : 18;
  for (let i = 0; i < slices; i++) {
    const yy = radius * (2 * (i + .5) / slices - 1);
    panel(rows, f, cx, cy + yy, Math.sqrt(radius * radius - yy * yy) * 2, radius * 2 / slices + .01, 0xe6dfc8, .39, .12);
  }
  for (let i = 0; i < 12; i++) {
    const t = Math.PI * i / 6;
    panel(rows, f, cx + Math.sin(t) * radius * .82, cy + Math.cos(t) * radius * .82, .14, .17, 0x59665e, .52);
  }
  line(rows, f, [cx, cy], [cx - radius * .42, cy + radius * .48], 0x586259, .1, .55);
  line(rows, f, [cx, cy], [cx + radius * .64, cy + radius * .12], 0x586259, .1, .55);
  panel(rows, f, cx, cy + radius + .35, radius * 2 + .6, .22, r.trim, .35, .32);
}

/** Independent axis-aligned thin native surfaces. Long diagonal cornices are
 * fragmented; they never become one enormous filled axis-aligned rectangle. */
export function nativeTownhallRowsV227(rows: readonly Row[]): Row[] {
  const result: Row[] = [];
  for (const [x, y, z, w, h, d, yaw, color] of rows) {
    if (Math.abs(yaw) < 1e-8) { result.push([x,y,z,w,h,d,color]); continue; }
    const c = Math.cos(yaw), s = Math.sin(yaw), n = Math.max(1, Math.ceil(w / 1.5));
    for (let i = 0; i < n; i++) {
      const u = w * ((i + .5) / n - .5);
      result.push([x + c * u, y, z - s * u, Math.max(.13, Math.abs(c) * w / n + Math.abs(s) * d), h,
        Math.max(.13, Math.abs(s) * w / n + Math.abs(c) * d), color]);
    }
  }
  return result;
}

/** Bounded recognition on exact measured walls. It never changes building
 * envelopes, adds an inferred tower, closes a courtyard, or hides source data. */
export function townhallFittingsV227(site: Site, native = false): { rows: Row[]; windows: WindowRow[]; windowCount: number; clocks: number } {
  const r = RECIPES[site.key];
  if (!r) throw new Error(`Missing verified town hall recipe: ${site.key}`);
  const rows: Row[] = [], windows: WindowRow[] = [], base = Math.min(...site.parts.map(p => p.ground_y_m));
  let windowCount = 0, clocks = 0;
  const clockNormals: number[][] = [];
  // Only a genuinely tall compact measured part can receive a clock. Published
  // tower identities authorize the cue; their geometry remains the source's.
  const towers = r.clock ? site.parts.filter(p => {
    const xs = p.ring.map(q => q[0]), zs = p.ring.map(q => q[1]);
    return p.top_y_m - base > 35 && Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) < 30 &&
      p.wallEdges.some(edge => edge.eave > base + 35 && Math.hypot(edge.b[0]-edge.a[0],edge.b[1]-edge.a[1]) > 5);
  }) : [];
  const tower = towers.sort((a, b) => b.top_y_m - a.top_y_m)[0];
  for (const part of site.parts) for (const edge of part.wallEdges) {
    const f = facade(edge, part); if (!f) continue;
    // Both measured modern parts belong to this exact owner: the low assembly
    // hall must not inherit the older red-brick building's vertical rhythm.
    const modernWedding = site.key === "wedding" && part.parentId === "DEBE01YYK00040vj";
    const n = Math.max(1, Math.floor(f.length / (modernWedding ? 2.8 : r.pitch))), width = Math.min(2.45, f.length / n * (modernWedding ? .76 : r.opening));
    const modern = modernWedding || r.family.startsWith("modern");
    const floorPitch = modernWedding ? 3.2 : r.floor;
    const upper = part === tower && f.eave > base + 35;
    for (let y = Math.max(f.base + 2.0, base + 2.3); y + 1.7 < f.eave - (upper ? 7 : .4); y += floorPitch) {
      for (let i = 0; i < n; i++) {
        const u = (i + .5) * f.length / n;
        if (occluded(site, part, f, u, y)) continue;
        const arched = r.family === "brick-gothic" && y < base + 8 && y + 2.2 < f.eave;
        window(rows, windows, f, u, y, width, modern ? 1.7 : 2.0, r, arched, native); windowCount++;
      }
      if ((r.family === "modern-bands" || modernWedding) && !occluded(site, part, f, f.length / 2, y))
        panel(rows, f, f.length / 2, y - 1.35, f.length, .35, r.trim, .28, .18);
    }
    if (!occluded(site, part, f, f.length / 2, f.eave - .4)) {
      panel(rows, f, f.length / 2, f.eave - .35, f.length, modern ? .18 : .3, r.trim, .26, .32);
      if (r.family === "civic-stone" && f.length > 6) panel(rows, f, f.length / 2, f.base + .9, f.length, .32, r.trim, .24, .28);
    }
    if (upper && clocks < 4 && f.length > 5 && f.length < 25 &&
      !clockNormals.some(([x,z])=>x*f.nx+z*f.nz>.8) && !occluded(site, part, f, f.length / 2, f.eave - 4)) {
      clock(rows, f, r, native); clocks++; clockNormals.push([f.nx,f.nz]);
    }
    // Door framing is permitted only at a retained mapped entrance point.
    for (const entrance of site.entrancePoints ?? []) {
      const u = (entrance[0] - f.a[0]) * f.dx + (entrance[1] - f.a[1]) * f.dz;
      const distance = Math.abs((entrance[0] - f.a[0]) * f.nx + (entrance[1] - f.a[1]) * f.nz);
      if (distance > .8 || u < 1.1 || u > f.length - 1.1 || f.base > base + 2) continue;
      for (const side of [-1, 1]) panel(rows, f, u + side * 1.35, base + 1.75, .28, 3.5, r.trim, .38, .42);
      panel(rows, f, u, base + 3.65, 3.0, .3, r.trim, .45, .55);
      if (modern) panel(rows, f, u, base + 3.85, 4.3, .16, 0x7d8e8b, .8, 1.4);
    }
  }
  return { rows: native ? nativeTownhallRowsV227(rows) : rows, windows, windowCount, clocks };
}

export function createDistrictTownhallsV227(native = false): Group {
  const root = new Group(); root.name = DISTRICT_TOWNHALLS_V227_GROUP + (native ? " native" : "");
  root.userData = { districtTownhallsV227: true, requiredBeforeNavigation: true, textureFree: true,
    fullStaticDetailOnTouch: true, blockNative: native, nativeMinecraft: native, keepInMinecraft: native,
    sourceGeometryRetained: true, noHiddenSolidInfill: true, displayFittingsEstimated: true };
  for (const site of source.sites as unknown as Site[]) {
    const fittings = townhallFittingsV227(site, native);
    if (!native) addWindows(root, site, fittings.windows);
    if (!fittings.rows.length) continue;
    const mesh = justicePalaceV183Boxes(fittings.rows, native);
    mesh.name = `${site.name} source-bound cornices, clocks and mapped entrance frames v227`;
    mesh.userData = { ...mesh.userData, siteKey: site.key, windowCount: fittings.windowCount,
      clockFaces: fittings.clocks, fullStaticDetailOnTouch: true, sourcePartIds: site.parts.map(p => p.id) };
    root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
