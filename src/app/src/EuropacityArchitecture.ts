import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshStandardMaterial } from "three";
import type { PrismBuilding } from "./IsometricCityWorld";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { preparePrismContainment } from "./preparedPrismContainment";
import { EUROPACITY_ARCHITECTURE_SOURCE as S, EUROPACITY_ARCHITECTURE_GROUP, MINECRAFT_EUROPACITY_ARCHITECTURE_GROUP, EUROPACITY_ARCHITECTURE_EVIDENCE } from "./europacityArchitectureProfile";
type Point = readonly [number, number];
type Triple = [number, number, number];
export type EuropacitySourcePrism = Pick<PrismBuilding, "id" | "ring" | "holes" | "y0_dm" | "h_dm">;
type Wall = { part: PrismBuilding; a: Point; dx: number; dz: number; nx: number; nz: number; length: number; street: boolean; front: boolean };
export type EuropacityBlock = { position: Triple; size: Triple; yaw: number; color: number; role: string; sourceId: string; normal: Point; glass: boolean };
type Voxels = { cell_m: number; grid: { min_x_idx: number; min_z_idx: number }; building_rows?: Array<Array<[number, number, number, number, number]>>; buildings?: Array<[number, number, number, number, number]> };
export type EuropacityOptions = { mobileLike?: boolean; minecraft?: boolean; voxels?: Voxels; sourcePrisms?: readonly EuropacitySourcePrism[]; diagnostics?: boolean; fineReliefV341?: boolean };
const GLASS = 0x41545b, FRAME = 0xdbd9ce, DARK = 0x454b48;
function inRing(ring: number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
export function europacityPrismContains(part: EuropacitySourcePrism, x: number, z: number): boolean {
  return inRing(part.ring, x * 10, z * 10) && !(part.holes ?? []).some(h => inRing(h, x * 10, z * 10));
}
function nearestRoad(x: number, z: number): { distance: number; x: number; z: number } {
  let nearest = { distance: Infinity, x, z };
  for (const road of S.roads) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    const px = a[0] + t * dx, pz = a[1] + t * dz, distance = Math.hypot(x - px, z - pz);
    if (distance < nearest.distance) nearest = { distance, x: px, z: pz };
  }
  return nearest;
}
export function europacityArchitectureWalls(): Wall[] {
  const walls: Wall[] = [];
  for (const part of S.prisms as unknown as PrismBuilding[]) for (const [ri, ring] of [part.ring, ...(part.holes ?? [])].entries()) {
    const area = ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0);
    const sign = (area >= 0 ? 1 : -1) * (ri ? -1 : 1);
    for (let i = 0; i < ring.length; i++) {
      const a: Point = [ring[i][0] / 10, ring[i][1] / 10], b = ring[(i + 1) % ring.length];
      const length = Math.hypot(b[0] / 10 - a[0], b[1] / 10 - a[1]);
      if (length < 1.8) continue;
      const dx = (b[0] / 10 - a[0]) / length, dz = (b[1] / 10 - a[1]) / length, nx = sign * dz, nz = -sign * dx;
      const x = a[0] + dx * length / 2, z = a[1] + dz * length / 2, road = nearestRoad(x, z);
      const street = ri === 0 && road.distance < 33 && (road.x - x) * nx + (road.z - z) * nz > road.distance * .45;
      walls.push({ part, a, dx, dz, nx, nz, length, street, front: street && Math.abs(nx) > .7 });
    }
  }
  return walls;
}
function at(w: Wall, u: number, y: number, out: number): Triple {
  return [w.a[0] + w.dx * u + w.nx * out, y, w.a[1] + w.dz * u + w.nz * out];
}
function voxelSampler(payload?: Voxels): (w: Wall, u: number, width: number, y: number, height: number) => number {
  if (!payload) return () => 0;
  const cols = new Map<string, Point>(), cell = payload.cell_m;
  const add = (x: number, z: number, low: number, high: number) => {
    if (x * cell < -725 || x * cell > -50 || z * cell < -1960 || z * cell > -880) return;
    cols.set(`${x},${z}`, [low / 10, high / 10]);
  };
  payload.building_rows?.forEach((row, zi) => {
    const z = payload.grid.min_z_idx + zi;
    if (z * cell < -1960 || z * cell > -880) return;
    for (const [x, count, low, high] of row) for (let j = 0; j < count; j++) add(payload.grid.min_x_idx + x + j, z, low, high);
  });
  payload.buildings?.forEach(([x, z, lo, hi]) => add(x, z, lo, hi));
  return (w, u, width, y, height) => {
    const points = [-width / 2, width / 2].flatMap(du => [0, 3.6].map(d => at(w, u + du, y, d)));
    const x0 = Math.floor(Math.min(...points.map(p => p[0])) / cell), x1 = Math.floor(Math.max(...points.map(p => p[0])) / cell);
    const z0 = Math.floor(Math.min(...points.map(p => p[2])) / cell), z1 = Math.floor(Math.max(...points.map(p => p[2])) / cell);
    let push = 0;
    // Clip each intersecting source cell in wall coordinates. Sparse point
    // probes miss the projecting corner of oblique cells between samples.
    const clip = (ring: Point[], edge: number, greater: boolean): Point[] => {
      const result: Point[] = [];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const ina = greater ? a[0] >= edge : a[0] <= edge, inb = greater ? b[0] >= edge : b[0] <= edge;
        if (ina) result.push(a);
        if (ina !== inb) { const t = (edge - a[0]) / (b[0] - a[0]); result.push([edge, a[1] + t * (b[1] - a[1])]); }
      }
      return result;
    };
    for (let xi = x0; xi <= x1; xi++) for (let zi = z0; zi <= z1; zi++) {
      const column = cols.get(`${xi},${zi}`);
      if (!column || column[0] > y + height / 2 || column[1] < y - height / 2) continue;
      let ring: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([cx, cz]) => {
        const dx = (xi + cx) * cell - w.a[0], dz = (zi + cz) * cell - w.a[1];
        return [dx * w.dx + dz * w.dz, dx * w.nx + dz * w.nz];
      });
      ring = clip(clip(ring, u - width / 2, true), u + width / 2, false);
      if (!ring.length || Math.min(...ring.map(p => p[1])) > 3.6) continue;
      const far = Math.max(...ring.map(p => p[1]));
      if (far > 0) push = Math.max(push, far + .1);
    }
    // Do not move a bay through an opposite wall in a tiny courtyard.
    return push > 3.6 ? Infinity : push;
  };
}

/** Exposed-wall recognition only: retained roofs and open courts stay authoritative. */
export function planEuropacityArchitecture(options: EuropacityOptions = {}): EuropacityBlock[] {
  const blocks: EuropacityBlock[] = [], mc = !!options.minecraft, mobile = mc && !!options.mobileLike, voxel = voxelSampler(options.voxels);
  const parts = S.prisms as unknown as PrismBuilding[], byId = new Map(S.profiles.flatMap(p => p.ids.map(id => [id, p] as const)));
  const bound = (p: EuropacitySourcePrism) => ({ p, x0: Math.min(...p.ring.map(a => a[0])) / 10, x1: Math.max(...p.ring.map(a => a[0])) / 10, z0: Math.min(...p.ring.map(a => a[1])) / 10, z1: Math.max(...p.ring.map(a => a[1])) / 10 });
  const nearbyParts = (options.sourcePrisms ?? parts).map(bound).filter(b => b.x1 >= -725 && b.x0 <= -50 && b.z1 >= -1960 && b.z0 <= -880).map(b => ({ ...b, contains: preparePrismContainment(b.p) }));
  for (const w of europacityArchitectureWalls()) {
    const profile = byId.get(w.part.id)!, style = profile.style;
    const base = w.part.y0_dm / 10, top = (S.facadeTops as Record<string, number>)[w.part.id], span = top - base;
    if (span < 8 || w.length < 2.2) continue;
    const neighbours = nearbyParts.filter(q => q.p.id !== w.part.id && q.x1 >= w.a[0] - w.length - 4 && q.x0 <= w.a[0] + w.length + 4 && q.z1 >= w.a[1] - w.length - 4 && q.z0 <= w.a[1] + w.length + 4);
    const hidden = (u: number, y: number, width: number, height: number, out: number) => {
      // The footprint is independent of height: retain all three original
      // vertical probes, but test each horizontal point only once per prism.
      const ys = [y - height * .45, y, y + height * .45];
      for (const du of [-width * .47, 0, width * .47]) for (const d of [.015, out]) {
        const p = at(w, u + du, y, d);
        if (neighbours.some(q => p[0] >= q.x0 && p[0] <= q.x1 && p[2] >= q.z0 && p[2] <= q.z1 && ys.some(py => py >= q.p.y0_dm / 10 && py < (q.p.y0_dm + q.p.h_dm) / 10) && q.contains(p[0], p[2]))) return true;
      }
      return false;
    };
    let push = 0;
    const emit = (u: number, y: number, width: number, height: number, depth: number, out: number, color: number, role: string, glass = false, yawDelta = 0) => {
      if (!Number.isFinite(push) || width <= 0 || hidden(u, y, width, height, out + push) || y + height / 2 > top + .03 || y - height / 2 < base) return;
      blocks.push({ position: at(w, u, y, out + push), size: [width, height, depth], yaw: -Math.atan2(w.dz, w.dx) + yawDelta, color, role, sourceId: w.part.id, normal: [w.nx, w.nz], glass });
    };
    const office = ["limestone", "einz-podium", "staab", "track", "concrete-grid", "colonnades"].includes(style);
    const floors = style === "einz-podium" ? Math.max(1, Math.round(span / 4.3)) : style === "track" ? profile.floors : style === "limestone" ? profile.floors : style === "concrete-folds" ? Math.max(2, Math.round(span / 3.5)) : style === "staab" ? Math.max(2, Math.round(span / 3.65)) : Math.max(2, Math.min(profile.floors, Math.round(span / 3.2)));
    const pitch = span / floors;
    const facadePitch = style === "staab" ? mc ? 3.7 : 2.65 : style === "limestone" ? mc ? 3.8 : 2.65 : style === "track" ? mc ? 5.2 : 4.2 : mc ? 4.4 : 3.7;
    const bayPitch = facadePitch * (mobile ? 1.35 : 1);
    const bays = Math.max(1, Math.round(w.length / bayPitch)), step = w.length / bays;
    const canal = w.nx > .60;
    for (let i = 0; i < bays; i++) {
      const u = (i + .5) * step;
      for (let f = 0; f < floors; f++) {
        const y = base + (f + .51) * pitch, shop = f === 0 && w.street;
        const opening = Math.min(step * (office || shop ? .76 : .61), 4.6), openingH = pitch * (style === "track" ? .64 : shop ? .78 : .75);
        push = mc ? voxel(w, u, step, y, pitch) : 0;
        if (!mc && !mobile && ["staab", "limestone", "colonnades"].includes(style)) emit(u, y, opening + .2, openingH + .2, .1, .075, DARK, "deep opening shadow");
        emit(u, y, opening, openingH, .09, .17, GLASS, shop ? "street entrance glazing" : "framed glazing", true);
        const frame = style === "staab" ? 0xbdb7a2 : style === "red-brick" ? 0x9a9381 : FRAME;
        if (!mc && (!mobile || office)) {
          const mullions = style === "track" ? mobile ? 1 : 3 : 1;
          for (let m = 1; m <= mullions; m++) emit(u - opening / 2 + opening * m / (mullions + 1), y, .065, openingH, .065, .245, frame, "fine window mullion");
        }
        const bandH = style === "track" ? pitch * .27 : style === "terraced" ? .30 : style === "red-brick" ? .35 : .22;
        const bandColor = style === "track" ? 0x535f53 : style === "red-brick" ? 0x865c4f : profile.tone;
        emit(u, base + f * pitch + bandH / 2 + .015, step - .06, bandH, .20, .14, bandColor, style === "track" ? "dark green ceramic spandrel" : "storey band");
        const finW = style === "staab" ? Math.max(.13, .58 * (1 - f / Math.max(1, floors) * .78)) : style === "limestone" ? i % 3 === 0 ? .34 : .17 : style === "red-brick" ? .46 : style === "track" ? .34 : .24;
        const finDepth = style === "limestone" ? .40 : style === "staab" ? .34 : .23;
        emit(u - step / 2 + finW / 2, base + (f + .5) * pitch, finW, pitch - .12, finDepth, finDepth / 2 + .04, profile.tone, style === "staab" ? "graded concrete and anodised frame" : style === "limestone" ? "rhythmic limestone pilaster" : "facade pier");
        if (style === "concrete-folds" || style === "colonnades") {
          emit(u + opening / 2 + .17, y, Math.min(.40, step - opening - .1), openingH + .2, .20, .28, profile.tone, "folded concrete reveal", false, mc ? 0 : .16);
        }
        const balcony = f > 0 && !office && (style === "terraced" || style === "folded" && (canal || w.street) || style === "brick-loggias" && (i % 2 === 0 || canal));
        if (balcony) {
          const width = Math.min(step * .94, 4.4), floorY = base + f * pitch + .17;
          emit(u, floorY, width, .17, .82, .49, style === "terraced" ? 0xd8d3c4 : profile.tone, "loggia floor and stone cornice");
          emit(u, floorY + .91, width, .07, .08, .84, DARK, "open metal balcony handrail");
          const rails = mc ? 1 : mobile ? 2 : 3;
          for (let r = 0; r <= rails; r++) emit(u - width / 2 + r * width / rails, floorY + .50, mc ? .14 : .055, .82, .075, .84, DARK, "slender balcony railing");
          if (style === "folded" && canal) emit(u + width * .38, floorY + .53, width * .30, .83, .08, .65, 0xb7beb7, "triangular loggia return", false, mc ? 0 : .38);
        }
        if (style === "track" && f > 0 && i === 0 && w.length < 35 && f % 2 === 0) {
          emit(u, base + f * pitch + .16, opening, .18, .60, .35, FRAME, "Track end balcony slab");
          emit(u, base + f * pitch + 1.05, opening, .10, .10, .65, DARK, "Track balcony guard");
        }
        if (!mc && !mobile && w.street && f === 0 && ["red-brick", "brick-loggias", "folded"].includes(style)) {
          for (let c = 0; c < 4; c++) emit(u - step * .39, y - pitch * .35 + c * pitch * .23, Math.max(.16, (step - opening) * .40), .028, .022, .09, style === "red-brick" ? 0xb0907d : 0xc6beaa, "bounded clinker bed joint");
        }
      }
      push = mc ? voxel(w, u, step, top - .20, .40) : 0;
      emit(u, top - .16, step - .05, .28, .28, .18, style === "red-brick" ? 0x946650 : FRAME, "source roof parapet cap");
    }
  }
  if (options.fineReliefV341) blocks.push(...europacityFineReliefV341(blocks, options));
  return blocks;
}

/** Thin, estimated surface fittings. The original complete plan stays first.
 * Native additions are constructed on actual exposed cardinal voxel faces;
 * existing native rows supply only building identity and storey elevation. */
export function europacityFineReliefV341(plan: readonly EuropacityBlock[], options: EuropacityOptions): EuropacityBlock[] {
  const profiles = new Map(S.profiles.flatMap(p=>p.ids.map(id=>[id,p] as const)));
  const seeds = plan.filter(b=>{
    const p=profiles.get(b.sourceId);
    return p?.style==="limestone"&&b.glass || p?.style==="track"&&p.floors>=11&&b.role==="dark green ceramic spandrel";
  });
  const result: EuropacityBlock[]=[];
  const native=!!options.minecraft, payload=options.voxels;
  const columns=new Map<string,{x:number;z:number;low:number;high:number}>();
  const cell=payload?.cell_m??4;
  if(native) {
    if(!payload)return result;
    const add=(x:number,z:number,lo:number,hi:number)=>{
      if(x*cell< -725||x*cell> -50||z*cell< -1960||z*cell> -880||hi<=lo)return;
      columns.set(`${x},${z}`,{x,z,low:lo/10,high:hi/10});
    };
    payload.building_rows?.forEach((row,zi)=>{
      const z=payload.grid.min_z_idx+zi;
      if(z*cell< -1960||z*cell> -880)return;
      for(const [x,count,lo,hi] of row)for(let j=0;j<count;j++)add(payload.grid.min_x_idx+x+j,z,lo,hi);
    });
    payload.buildings?.forEach(([x,z,lo,hi])=>add(x,z,lo,hi));
  }
  const emitted=new Set<string>();
  const sourceParts=new Map((S.prisms as unknown as EuropacitySourcePrism[]).map(p=>[p.id,p]));
  const ownerCells=new Map<string,Set<string>>();
  const belongs=(id:string,key:string)=>{
    let owned=ownerCells.get(id);
    if(!owned) {
      owned=new Set<string>();
      const part=sourceParts.get(id)!;
      const contains=preparePrismContainment(part);
      for(const [k,c] of columns) {
        const x=c.x*cell,z=c.z*cell;
        if([[.01,.01],[.99,.01],[.01,.99],[.99,.99],[.5,.5]].some(([dx,dz])=>contains(x+dx*cell,z+dz*cell)) ||
          part.ring.some(p=>p[0]/10>=x&&p[0]/10<=x+cell&&p[1]/10>=z&&p[1]/10<=z+cell))owned.add(k);
      }
      ownerCells.set(id,owned);
    }
    return owned.has(key);
  };
  for(const seed of seeds) {
    const stone=profiles.get(seed.sourceId)!.style==="limestone";
    const y=stone?seed.position[1]-seed.size[1]/2-.075:seed.position[1];
    const h=stone?.10:seed.size[1]*.78;
    if(!native) {
      const count=stone?1:4, width=stone?seed.size[0]+.10:.075;
      for(let i=0;i<count;i++) {
        const along=stone?0:(i-1.5)*seed.size[0]/5;
        result.push({...seed,position:[seed.position[0]+Math.cos(seed.yaw)*along+seed.normal[0]*.13,y,seed.position[2]-Math.sin(seed.yaw)*along+seed.normal[1]*.13],
          size:[width,h,stone?.22:.10],glass:false,color:stone?0xded9c9:0x7b8b80,role:stone?"v341 limestone sill lip":"v341 glazed ceramic flute"});
      }
      continue;
    }
    // The native world uses 4 m source cells. Select the nearest exposed face
    // near this storey; no smooth polygon, yaw or smooth bay width is copied.
    const ix=Math.floor(seed.position[0]/cell),iz=Math.floor(seed.position[2]/cell);
    let best:{x:number;z:number;nx:number;nz:number;score:number;key:string}|undefined;
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
      const c=columns.get(`${ix+dx},${iz+dz}`);
      if(!c||c.low>y-h/2||c.high<y+h/2)continue;
      if(!belongs(seed.sourceId,`${c.x},${c.z}`))continue;
      for(const [nx,nz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if(nx*seed.normal[0]+nz*seed.normal[1]<.45)continue;
        const adjacent=columns.get(`${c.x+nx},${c.z+nz}`);
        if(adjacent&&adjacent.low<y+h/2&&adjacent.high>y-h/2)continue;
        const x=(c.x+.5+nx*.5)*cell,z=(c.z+.5+nz*.5)*cell;
        const score=Math.hypot(x-seed.position[0],z-seed.position[2]);
        if(score>cell*1.6||best&&score>=best.score)continue;
        best={x,z,nx,nz,score,key:`${c.x},${c.z},${nx},${nz},${y.toFixed(3)},${stone}`};
      }
    }
    if(!best||emitted.has(best.key))continue;
    emitted.add(best.key);
    const {x,z,nx,nz}=best,count=stone?1:3;
    for(let i=0;i<count;i++) {
      const along=stone?0:(i-1)*cell/4,width=stone?cell*.78:.10,depth=stone?.22:.10;
      result.push({position:[x+nx*.26+nz*along,y,z+nz*.26-nx*along],size:[nx?depth:width,h,nx?width:depth],yaw:0,
        color:stone?0xded9c9:0x7b8b80,role:stone?"v341 limestone sill lip":"v341 glazed ceramic flute",sourceId:seed.sourceId,normal:[nx,nz],glass:false});
    }
  }
  return result;
}
export function createEuropacityArchitecture(options: EuropacityOptions = {}): Group {
  const root = new Group(), plan = planEuropacityArchitecture(options);
  root.name = options.minecraft ? MINECRAFT_EUROPACITY_ARCHITECTURE_GROUP : EUROPACITY_ARCHITECTURE_GROUP;
  root.userData.evidence = EUROPACITY_ARCHITECTURE_EVIDENCE;
  root.userData.profile = options.mobileLike ? "mobile" : "full";
  root.userData.sourcePartCount = S.prisms.length;
  root.userData.textureFree = true;
  root.userData.runtimeAssets = [];
  if (options.diagnostics) root.userData.blocks = plan;
  const cube = new BoxGeometry(1, 1, 1), matrix = new Matrix4(), color = new Color();
  cube.deleteAttribute("uv");
  for (const glazing of [false, true]) {
    const blocks = plan.filter(p => p.glass === glazing);
    const material = new MeshStandardMaterial({ color: 0xffffff, roughness: glazing ? .42 : .91 });
    const mesh = new InstancedMesh(cube, material, blocks.length);
    mesh.name = glazing ? "Europacity framed glazing" : "Europacity facade masonry and metal";
    mesh.userData.dayMaterial = material;
    mesh.userData.nightMaterial = new MeshStandardMaterial({ color: glazing ? 0xc5ccd0 : 0x6b7580, roughness: .8, emissive: glazing ? 0x715323 : 0, emissiveIntensity: glazing ? .2 : 0 });
    for (let i = 0; i < blocks.length; i++) {
      const p = blocks[i]; matrix.makeRotationY(p.yaw); matrix.scale({ x: p.size[0], y: p.size[1], z: p.size[2] } as import("three").Vector3); matrix.setPosition(...p.position);
      mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.setHex(p.color));
    }
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  }
  freezeStaticSceneTransforms(root); return root;
}
