import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, ShapeUtils, Vector2 } from "three";
import type { PrismBuilding } from "./IsometricCityWorld";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { FRIEDRICHSTRASSE_ARCHITECTURE_SOURCE as S, FRIEDRICHSTRASSE_ARCHITECTURE_GROUP, MINECRAFT_FRIEDRICHSTRASSE_ARCHITECTURE_GROUP, FRIEDRICHSTRASSE_ARCHITECTURE_EVIDENCE, ADMIRALSPALAST_IDS, admiralspalastRoofAt, admiralspalastSourceColumnAt } from "./friedrichstrasseArchitectureProfile";
type Point = readonly [number, number];
type Triple = [number, number, number];
export type FriedrichstrasseSourcePrism = Pick<PrismBuilding, "id" | "ring" | "holes" | "y0_dm" | "h_dm">;
type Wall = { part: PrismBuilding; a: Point; dx: number; dz: number; nx: number; nz: number; length: number; ringIndex?: number; street: boolean; front: boolean };
export type FriedrichstrasseBlock = { position: Triple; size: Triple; yaw: number; color: number; role: string; sourceId: string; normal: Point; glass: boolean; roll?: number };
type Voxels = { cell_m: number; grid: { min_x_idx: number; min_z_idx: number }; building_rows?: Array<Array<[number, number, number, number, number]>>; buildings?: Array<[number, number, number, number, number]> };
export type FriedrichstrasseOptions = { mobileLike?: boolean; minecraft?: boolean; voxels?: Voxels; sourcePrisms?: readonly FriedrichstrasseSourcePrism[]; diagnostics?: boolean };
import { letteringStrokePaths } from "./drawnLettering";
const GLASS = 0x41545b, FRAME = 0xdbd9ce, DARK = 0x454b48;
function inRing(ring: number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
export function friedrichstrassePrismContains(part: FriedrichstrasseSourcePrism, x: number, z: number): boolean {
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
export function friedrichstrasseArchitectureWalls(): Wall[] {
  const walls: Wall[] = [];
  for (const part of S.prisms as unknown as PrismBuilding[]) for (const [ri, ring] of [part.ring, ...(part.holes ?? [])].entries()) {
    const area = ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0);
    const sign = (area >= 0 ? 1 : -1) * (ri ? -1 : 1);
    for (let i = 0; i < ring.length; i++) {
      const a: Point = [ring[i][0] / 10, ring[i][1] / 10], b = ring[(i + 1) % ring.length];
      const length = Math.hypot(b[0] / 10 - a[0], b[1] / 10 - a[1]);
      if (length < .65) continue;
      const dx = (b[0] / 10 - a[0]) / length, dz = (b[1] / 10 - a[1]) / length, nx = sign * dz, nz = -sign * dx;
      const x = a[0] + dx * length / 2, z = a[1] + dz * length / 2, road = nearestRoad(x, z);
      const street = ri === 0 && road.distance < 33 && (road.x - x) * nx + (road.z - z) * nz > road.distance * .45;
      walls.push({ part, a, dx, dz, nx, nz, length, ringIndex: ri, street, front: street && Math.abs(nx) > .7 });
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
    if (x * cell < 810 || x * cell > 1270 || z * cell < -460 || z * cell > -150) return;
    if (!admiralspalastSourceColumnAt((x + .5) * cell, (z + .5) * cell, low / 10, high / 10)) cols.set(`${x},${z}`, [low / 10, high / 10]);
  };
  payload.building_rows?.forEach((row, zi) => {
    const z = payload.grid.min_z_idx + zi;
    if (z * cell < -460 || z * cell > -150) return;
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


/** Exterior-only facade details; no source courtyard or neighbouring mass is filled. */
export function planFriedrichstrasseArchitecture(options: FriedrichstrasseOptions = {}): FriedrichstrasseBlock[] {
  const blocks: FriedrichstrasseBlock[] = [], mc = !!options.minecraft, mobile = mc && !!options.mobileLike, voxel = voxelSampler(options.voxels);
  const parts = S.prisms as unknown as PrismBuilding[], profiles = new Map(S.profiles.flatMap(p => p.ids.map(id => [id, p] as const)));
  const nearby = (options.sourcePrisms ?? parts).map(p => ({p, x0: Math.min(...p.ring.map(a=>a[0]))/10, x1: Math.max(...p.ring.map(a=>a[0]))/10, z0: Math.min(...p.ring.map(a=>a[1]))/10, z1: Math.max(...p.ring.map(a=>a[1]))/10})).filter(b=>b.x1>800 && b.x0<1280 && b.z1> -460 && b.z0< -150);
  const hidden = (w: Wall, u: number, y: number, out: number) => {
    const p = at(w, u, y, out);
    return nearby.some(b => p[0]>=b.x0 && p[0]<=b.x1 && p[2]>=b.z0 && p[2]<=b.z1 && b.p.id !== w.part.id && y >= b.p.y0_dm / 10 && y < (ADMIRALSPALAST_IDS.has(b.p.id) ? admiralspalastRoofAt(p[0], p[2], b.p.id) ?? -Infinity : (b.p.y0_dm + b.p.h_dm) / 10) && friedrichstrassePrismContains(b.p, p[0], p[2]));
  };
  let wall: Wall, push = 0;
  const emit = (u: number, y: number, width: number, height: number, depth: number, out: number, color: number, role: string, glass = false, roll = 0) => {
    if (!Number.isFinite(push) || hidden(wall, u, y, out + push) || width <= 0 || height <= 0) return;
    blocks.push({ position: at(wall, u, y, out + push + (mc && ADMIRALSPALAST_IDS.has(wall.part.id) ? .85 : 0)), size: [width, height, depth], yaw: -Math.atan2(wall.dz, wall.dx), color, role, sourceId: wall.part.id, normal: [wall.nx, wall.nz], glass, roll });
  };
  const line = (u: number, y: number, v: number, yy: number, thickness: number, out: number, color: number, role: string) => {
    const dx = v - u, dy = yy - y, n = mc ? Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / .45)) : 1;
    for (let i = 0; i < n; i++) emit(u + dx * (i + .5) / n, y + dy * (i + .5) / n, mc ? Math.max(thickness, Math.abs(dx) / n) : Math.hypot(dx, dy), mc ? Math.max(thickness, Math.abs(dy) / n) : thickness, .10, out, color, role, false, mc ? 0 : Math.atan2(dy, dx));
  };
  const sign = (text: string, u: number, y: number, cap: number, out: number, color: number) => {
    for (const path of letteringStrokePaths(text, cap)) for (let i = 1; i < path.length; i++) line(u + path[i-1][0], y + path[i-1][1], u + path[i][0], y + path[i][1], Math.max(.045, cap * .09), out, color, `lettering ${text}`);
  };
  for (wall of friedrichstrasseArchitectureWalls()) {
    const profile = profiles.get(wall.part.id)!, style = profile.style, base = wall.part.y0_dm / 10, top = (S.facadeTops as Record<string, number>)[wall.part.id], span = top - base;
    if (span < 6 || wall.length < .8) continue;
    // The street portico is authored once across its source's deliberately
    // segmented half-column outline, not repeated once per tiny source edge.
    if (wall.part.id === "K00002ap" && wall.nx < -.6) continue;
    const curvedGlass = style === "vertical-glass", court = style === "admiral" && wall.part.id === "K00002uV" && wall.nx < -.5;
    const floors = curvedGlass ? 10 : style === "hotel-stone" ? Math.min(9, Math.max(2, Math.round(span / 3.4))) : style === "admiral" ? 5 : Math.min(profile.floors, Math.max(2, Math.round(span / 3.4)));
    const pitch = span / floors, bayPitch = curvedGlass ? (mc ? 2.7 : mobile ? 2.2 : 1.55) : style === "hotel-stone" ? 3.2 : 3.9;
    const bays = Math.max(1, Math.round(wall.length / bayPitch)), step = wall.length / bays;
    if (wall.length < (curvedGlass ? .8 : 2.3)) continue;
    for (let i = 0; i < bays; i++) {
      const u = (i + .5) * step;
      for (let f = 0; f < floors; f++) {
        const y = base + (f + .5) * pitch, shop = f === 0 && wall.street, width = step * (curvedGlass ? .82 : shop ? .76 : .44), h = pitch * (curvedGlass ? .69 : .67);
        push = mc && !ADMIRALSPALAST_IDS.has(wall.part.id) ? voxel(wall, u, step, y, pitch) : 0;
        if ([-width*.48,0,width*.48].some(du => hidden(wall,u+du,y,.3+push))) continue;
        emit(u, y, width, h, .08, .17, curvedGlass ? 0x607b83 : GLASS, court ? "court window glazing" : "exposed window glazing", true);
        if (curvedGlass) {
          emit(u - step / 2 + .1, y, .14, pitch, .32, .22, 0x939799, "continuous aluminium double-facade fin");
          emit(u, base + f * pitch + .15, step, .30, .10, .20, 0x4a5254, "dark horizontal spandrel");
        } else {
          const frame = style === "hotel-stone" ? 0x363f42 : 0xe0ddd1;
          for (const side of [-1,1]) emit(u + side * (width / 2 + .055), y, .11, h + .20, .13, .21, frame, "window reveal");
          emit(u, y - h / 2 - .05, width + .22, .14, .20, .24, frame, "projecting sill");
          if (!mc) emit(u, y, .065, h, .07, .255, frame, "central mullion");
          if (!mobile && !mc) emit(u, y + h*.12, width, .06, .07, .255, frame, "window transom");
          if (style === "hotel-stone" && f > 0) {
            emit(u, y - h*.15, width+.2, .055, .075, .35, DARK, "Juliet balcony rail");
            for (const side of [-1,1]) emit(u+side*width*.43,y-h*.34,.055,h*.42,.075,.35,DARK,"Juliet balcony upright");
          }
          if (profile.key === "schiff5" && f === floors - 1 && wall.street) {
            const n=mc?5:8;
            for(let j=0;j<n;j++){const t0=j*Math.PI/n,t1=(j+1)*Math.PI/n;line(u+Math.cos(t0)*width*.5,y+h*.46+Math.sin(t0)*.32,u+Math.cos(t1)*width*.5,y+h*.46+Math.sin(t1)*.32,.095,.25,0xdfdac9,"Schiffbauerdamm 5 upper arched opening");}
          }
          if (style === "hotel-stone" && !mobile && !mc && wall.street) {
            emit(u,base+f*pitch,step,.028,.027,.035,0xa49f91,"limestone cladding course");
          }
          if (court) {
            for (const side of [-1,1]) emit(u+side*(width/2+.3),y,.38,pitch,.10,.06,0xaa604c,"terracotta court surround");
            emit(u,y+h/2+.24,width+.9,.39,.1,.07,0xb2624c,"terracotta court lintel");
          }
          if ((style === "historic" || style === "terrace-plaster") && wall.street) {
            if (style === "historic") emit(u, y+h/2+.22, width+.65,.18,.26,.20,0xd4cbb6,"historic hood cornice");
            if ((style === "historic" && (f===1 || f===2)) || (style === "terrace-plaster" && f>0 && f<floors-1 && (i<2 || i>bays-3))) {
              const balconyBase = base+f*pitch;
              emit(u,balconyBase+.17,width+.7,.16,.7,.40,0xc8c0ad,"historic shallow balcony slab");
              const stoneBalustrade = profile.key === "schiff8";
              emit(u,balconyBase+1.08,width+.6,stoneBalustrade?.14:.09,stoneBalustrade?.22:.08,.72,stoneBalustrade?0xd0c6b0:DARK,"historic open balcony rail");
              if (stoneBalustrade) {
                // Dguendel's credited Schiffbauerdamm 6–8 view shows pale
                // open stone balustrades, not a single dark metal line. The
                // existing balcony/window layout is retained; spindle spacing
                // and sections remain small procedural display subdivisions.
                for (let k=0;k<4;k++) {
                  const bu=u-width*.43+k*width*.86/3;
                  emit(bu,balconyBase+.64,.105,.70,.14,.72,0xd0c6b0,"Schiffbauerdamm 8 stone baluster stem");
                  emit(bu,balconyBase+.59,.21,.26,.19,.72,0xbcb19b,"Schiffbauerdamm 8 stone baluster body");
                }
                emit(u,balconyBase+.30,width+.6,.10,.22,.72,0xc8c0ad,"Schiffbauerdamm 8 lower balustrade course");
              }
            }
          }
        }
      }
      push = mc && !ADMIRALSPALAST_IDS.has(wall.part.id) ? voxel(wall,u,step,top-.2,.4) : 0;
      emit(u,top-.13,step,.24,.22,.19,profile.tone,"source eaves cornice");
    }
    push=0;
  }
  // Front datum and six column centres are the actual LoD2 street outline;
  // vertical subdivisions are bounded by the official eaves and free photos.
  const front = parts.find(p => p.id === "K00002ap")!;
  const a: Point = [1150.4,-199.6], b: Point = [1152.8,-167.2], length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
  wall={part:front,a,dx,dz,nx:-dz,nz:dx,length,street:true,front:true};
  const base=front.y0_dm/10, eaves=(S.facadeTops as Record<string,number>)[front.id], H=eaves-base;
  const cols=[.9,7.6,14.1,20.6,28.1,32.1], bays=cols.slice(1).map((v,i)=>(v+cols[i])/2);
  for (const u of cols) {
    // Faceted half-cylinder and flute channels share the facade batch.
    const n=mc?5:mobile?7:11;
    for (let j=0;j<n;j++) { const t=-Math.PI/2+(j+.5)*Math.PI/n;emit(u+Math.sin(t)*.60,base+H*.46,Math.max(.12,1.4/n),H*.91,.20,.12+Math.cos(t)*.62,0x9b8e73,"giant granite Doric half-column"); }
    for (const y of [base+.35,eaves-.8]) emit(u,y,1.45,.30,.85,.32,0xb4a68c,"Doric base and capital");
    if (!mc && !mobile) for(let j=0;j<7;j++){const t=-Math.PI*.43+j*Math.PI*.86/6;emit(u+Math.sin(t)*.61,base+H*.47,.055,H*.87,.04,.26+Math.cos(t)*.62,0x6c6251,"column flute shadow");}
  }
  for (const [i,u] of bays.entries()) {
    const step=cols[i+1]-cols[i], w=Math.min(3.7,step-1.3);
    for (const [fraction,hfraction] of [[.12,.22],[.40,.20],[.67,.26]]) {
      const y=base+H*fraction,h=H*hfraction;emit(u,y,w,h,.13,.32,0x334142,"Admiral street glazing",true);
      if (!mc) { for(let j=1;j<5;j++)emit(u-w/2+j*w/5,y,.06,h,.08,.42,DARK,"Admiral window lattice");for(let j=1;j<4;j++)emit(u,y-h/2+j*h/4,w,.06,.08,.42,DARK,"Admiral window lattice"); }
    }
    // Segmental top arch, pale rectangular spolia fields and shallow carved
    // figure cues: no photograph or copyrighted current show artwork.
    for(let j=0;j<(mc?6:10);j++){const n=mc?6:10,t0=j*Math.PI/n,t1=(j+1)*Math.PI/n;line(u+Math.cos(t0)*w*.54,base+H*.80+Math.sin(t0)*.48,u+Math.cos(t1)*w*.54,base+H*.80+Math.sin(t1)*.48,.18,.39,0xd5cbb4,"segmental limestone arch");}
    for (const f of [.27,.52,.89]) {
      emit(u,base+H*f,w+.45,H*.095,.15,.30,0xdbd2bc,"Istrian limestone relief panel");
      if (!mobile) {for(const side of [-1,1])emit(u+side*(w*.5+.14),base+H*f,.10,H*.09,.06,.41,0xb4a38c,"relief frame");line(u-.5,base+H*f-.35,u+.05,base+H*f+.36,.13,.43,0xb09d7e,"procedural relief silhouette");line(u+.05,base+H*f+.36,u+.58,base+H*f-.10,.13,.43,0xb09d7e,"procedural relief silhouette");}
    }
    for(const side of [-1,1])for(const f of [.32,.63,.87])emit(u+side*(w*.5+.38),base+H*f,.42,H*.10,.10,.30,0xd3c9b3,"flanking pale relief field");
    if(i<4){const y=base+H*.285;emit(u,y,w+.4,.19,1.0,.65,0xb4a58a,"open balcony slab");emit(u,y+.95,w+.4,.07,.08,1.08,DARK,"Admiral balcony handrail");for(let j=0;j<7;j++)emit(u-w/2+j*w/6,y+.50,.055,.90,.08,1.08,DARK,"Admiral balcony baluster");}
  }
  for(const [y,h,depth] of [[eaves-.18,.38,.80],[eaves-.58,.15,.55]])emit(length/2,y,length+1,h,depth,.22,0xb4a68c,"continuous Doric entablature");
  // Five contemporary flat-faced dormers sit within the delivered pitched
  // roof envelope. Their local widths and setbacks are reference estimates.
  for (const u of bays) {
    const p=at(wall,u,0,-2.7), roof=admiralspalastRoofAt(p[0],p[2],front.id);
    if (roof===null) continue;
    const y=roof+.40,w=3.55;
    emit(u,y,w+ .30,1.65,1.8,-2.7,0x626862,"street roof dormer casing");
    emit(u,y,w,1.37,.08,-1.76,0x687d80,"street roof dormer glazing",true);
    emit(u,y,.09,1.37,.08,-1.65,0xb9bdb6,"dormer centre mullion");
    emit(u,y+.88,w+.48,.15,2.0,-2.7,0x747975,"flat dormer cap");
  }
  // Permanent entrance identification; programme posters are deliberately absent.
  emit(bays[4],base+H*.26,3.4,.75,.16,.42,0xc8b68b,"Admiral entrance name panel");
  sign("ADMIRALSPALAST",bays[4],base+H*.246,.20,.54,0x665d46);
  return blocks;
}
function addAdmiralShell(root: Group, blocks: FriedrichstrasseBlock[], options: FriedrichstrasseOptions): void {
  if (options.minecraft) {
    const cell=options.mobileLike?1.55:1.2;
    for (const part of S.prisms.filter(p=>ADMIRALSPALAST_IDS.has(p.id))) {
      const x0=Math.floor(Math.min(...part.ring.map(a=>a[0]))/10/cell),x1=Math.ceil(Math.max(...part.ring.map(a=>a[0]))/10/cell),z0=Math.floor(Math.min(...part.ring.map(a=>a[1]))/10/cell),z1=Math.ceil(Math.max(...part.ring.map(a=>a[1]))/10/cell),base=part.y0_dm/10;
      const inside=(x:number,z:number)=>friedrichstrassePrismContains(part as unknown as PrismBuilding,x,z);
      for(let xi=x0;xi<=x1;xi++)for(let zi=z0;zi<=z1;zi++){
        const x=(xi+.5)*cell,z=(zi+.5)*cell;if(!inside(x,z))continue;
        const top=admiralspalastRoofAt(x,z,part.id);if(top===null||top<=base)continue;
        const perimeter=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>!inside(x+dx*cell,z+dz*cell));
        const n=perimeter?Math.ceil((top-base)/cell):1;
        for(let i=0;i<n;i++){
          const y=perimeter?base+Math.min(top-base,(i+.5)*cell):top-cell*.30,h=perimeter?Math.min(cell,top-(base+i*cell)):cell*.6;
          if(h<=0)continue;
          blocks.push({position:[x,Math.min(y,top-h/2),z],size:[cell,h,cell],yaw:0,color:!perimeter||i===n-1?0x555651:part.id==='K00002uV'?0xddd7c5:0xb1a591,role:!perimeter||i===n-1?'official stepped roof shell':'official perimeter wall shell',sourceId:part.id,normal:[0,0],glass:false});
        }
      }
    }
    return;
  }
  const positions:number[]=[],colors:number[]=[];
  for(const part of S.admiralParts)for(const surface of part.surfaces){
    const r=surface.rings[0];if(r.length<3)continue;
    const n=[0,0,0];r.forEach((a,i)=>{const b=r[(i+1)%r.length];n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);});
    const axis=Math.abs(n[1])>Math.abs(n[0])&&Math.abs(n[1])>Math.abs(n[2])?1:Math.abs(n[0])>Math.abs(n[2])?0:2;
    const project=(p:number[])=>axis===1?new Vector2(p[0],p[2]):axis===0?new Vector2(p[2],p[1]):new Vector2(p[0],p[1]);
    const rings=surface.rings.map(r=>r.map(project)),flat=surface.rings.flat(),faces=ShapeUtils.triangulateShape(rings[0],rings.slice(1));
    const c=new Color(surface.kind==='RoofSurface'?0x555651:part.id.endsWith('K00002uV')?0xdfd8c5:0xb1a591);
    for(const face of faces)for(const index of face){const p=flat[index];positions.push(p[0],p[1]+part.offset_y_m,p[2]);colors.push(c.r,c.g,c.b);}
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new Mesh(geometry,new MeshStandardMaterial({vertexColors:true,roughness:.91,side:DoubleSide}));mesh.name='Admiralspalast official wall and roof planes';mesh.userData.sourceIds=[...ADMIRALSPALAST_IDS];bindMaterials(mesh,false);root.add(mesh);
}
function bindMaterials(mesh: Mesh, glazing: boolean): void {
  mesh.userData.dayMaterial=mesh.material;
  mesh.userData.nightMaterial=new MeshStandardMaterial({color:glazing?0xe0d6b6:0x75808b,vertexColors:!!mesh.geometry.getAttribute('color'),side:DoubleSide,roughness:glazing?.45:.92,emissive:glazing?0x5f451f:0,emissiveIntensity:glazing?.32:0});
  mesh.userData.moonlitMaterial=new MeshStandardMaterial({color:glazing?0x899eaf:0x727f8d,vertexColors:!!mesh.geometry.getAttribute('color'),side:DoubleSide,roughness:.9,emissive:0});
}
export function createFriedrichstrasseArchitecture(options: FriedrichstrasseOptions = {}): Group {
  const root=new Group(),blocks=planFriedrichstrasseArchitecture(options);
  root.name=options.minecraft?MINECRAFT_FRIEDRICHSTRASSE_ARCHITECTURE_GROUP:FRIEDRICHSTRASSE_ARCHITECTURE_GROUP;
  root.userData={evidence:FRIEDRICHSTRASSE_ARCHITECTURE_EVIDENCE,profile:options.mobileLike?'mobile':'full',sourcePartCount:S.prisms.length,textureFree:true,runtimeAssets:[]};
  addAdmiralShell(root,blocks,options);
  if(options.diagnostics)root.userData.blocks=blocks;
  const cube=new BoxGeometry(1,1,1),matrix=new Matrix4(),rotation=new Matrix4(),color=new Color();cube.deleteAttribute('uv');
  for(const glass of [false,true]){
    const selected=blocks.filter(b=>b.glass===glass),mesh=new InstancedMesh(cube,new MeshStandardMaterial({color:0xffffff,roughness:glass?.46:.91}),selected.length);
    mesh.name=glass?'Friedrichstrasse facade glazing':'Friedrichstrasse masonry and metal';bindMaterials(mesh,glass);
    selected.forEach((b,i)=>{matrix.makeRotationY(b.yaw);if(b.roll)matrix.multiply(rotation.makeRotationZ(b.roll));matrix.scale({x:b.size[0],y:b.size[1],z:b.size[2]} as import('three').Vector3);matrix.setPosition(...b.position);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setHex(b.color));});
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
  }
  freezeStaticSceneTransforms(root);return root;
}
export function createMinecraftFriedrichstrasseArchitecture(options: Omit<FriedrichstrasseOptions,'minecraft'> = {}): Group {return createFriedrichstrasseArchitecture({...options,minecraft:true});}
