import {
  BoxGeometry, BufferGeometry, CircleGeometry, Color, Float32BufferAttribute,
  Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial,
  Vector3,
} from "three";
import type { PrismBuilding } from "./IsometricCityWorld";
import { createBuilder, finishDrawnGroup, paintGeometry, type Builder } from "./drawnKit";
import { letteringStrokePaths } from "./drawnLettering";
import { addMusicMuseumShell } from "./musicMuseumShell";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import {
  LENNE_TOWERS, MINECRAFT_MUSEUM_LENNE_GROUP, MUSEUM_LENNE_GROUP,
  MUSEUM_LENNE_IDS, MUSEUM_LENNE_SOURCE_PRISMS, MUSIC_MUSEUM_HALL_ID,
  MUSIC_MUSEUM_IDS, MUSIC_MUSEUM_ENTRANCE_ID, MUSIC_MUSEUM_PROFILE, musicMuseumFacadeTop, MUSIC_MUSEUM_ROOF_BASE, musicMuseumPartRoofHeightAt, musicMuseumReplacementColumn,
} from "./museumLenneProfile";

type Point = readonly [number, number];
type Triple = [number, number, number];
export type MuseumLenneVoxelPayload = {
  cell_m: number; grid: { min_x_idx: number; min_z_idx: number };
  building_rows?: Array<Array<[number, number, number, number, number]>>;
  buildings?: Array<[number, number, number, number, number]>;
};
export type MuseumLenneOptions = { mobileLike?: boolean; minecraft?: boolean; voxels?: MuseumLenneVoxelPayload; diagnostics?: boolean };
export type MuseumLenneBlock = { position: Triple; size: Triple; yaw: number; color: number; role: string; sourceId: string; normal?: Point };
export type MuseumLenneWall = { part: PrismBuilding; a: Point; b: Point; length: number; nx: number; nz: number; dx: number; dz: number };
const C = { stone: 0xb9b8b0, light: 0xe4e4d9, seam: 0x9d9d92, glass: 0x3c5960, glassLight: 0x648086,
  silver: 0xcad3d1, dark: 0x354748, gold: 0xc79d42, goldLight: 0xe2be57, roof: 0xc3c3b9 };

function inRing(ring: readonly (readonly number[])[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
export function museumLennePrismContains(p: PrismBuilding, x: number, z: number): boolean {
  return inRing(p.ring, x * 10, z * 10) && !(p.holes ?? []).some(h => inRing(h, x * 10, z * 10));
}
function selected(payload?: { buildings: readonly PrismBuilding[] }): PrismBuilding[] {
  return (payload?.buildings ?? MUSEUM_LENNE_SOURCE_PRISMS as PrismBuilding[]).filter(p => MUSEUM_LENNE_IDS.has(p.id));
}
/** Only the exhibition hall needs a finer block roof; all other voxel bodies stay. */
export function musicMuseumHallColumnContains(x: number, z: number): boolean {
  if (x < -93 || x > -34 || z < 895 || z > 972) return false;
  return museumLennePrismContains(MUSEUM_LENNE_SOURCE_PRISMS.find(p => p.id === MUSIC_MUSEUM_HALL_ID) as PrismBuilding, x, z);
}
export function museumLenneWalls(payload?: { buildings: readonly PrismBuilding[] }): MuseumLenneWall[] {
  const walls: MuseumLenneWall[] = [];
  for (const part of selected(payload)) for (const [ri, ring] of [part.ring, ...(part.holes ?? [])].entries()) {
    const area = ring.reduce((s, a, i) => { const b = ring[(i + 1) % ring.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
    const sign = (area >= 0 ? 1 : -1) * (ri ? -1 : 1);
    for (let i = 0; i < ring.length; i++) {
      const a: Point = [ring[i][0] / 10, ring[i][1] / 10], end = ring[(i + 1) % ring.length];
      const b: Point = [end[0] / 10, end[1] / 10], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 1) continue;
      const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
      walls.push({ part, a, b, length, dx, dz, nx: sign * dz, nz: -sign * dx });
    }
  }
  return walls;
}
function at(w: MuseumLenneWall, u: number, y: number, out: number): Triple {
  return [w.a[0] + w.dx * u + w.nx * out, y, w.a[1] + w.dz * u + w.nz * out];
}
function makeVoxelSampler(payload?: MuseumLenneVoxelPayload): (x: number, y: number, z: number) => boolean {
  const columns = new Map<string, Point>();
  if (!payload) return () => false;
  const cell = payload.cell_m;
  const add = (x: number, z: number, low: number, high: number) => {
    const wx = (x + .5) * cell, wz = (z + .5) * cell;
    if (wx < -100 || wx > 325 || wz < 775 || wz > 1035 || musicMuseumReplacementColumn(wx, wz, low / 10, high / 10, cell)) return;
    columns.set(`${x},${z}`, [low / 10, high / 10]);
  };
  payload.building_rows?.forEach((row, zi) => {
    const z = payload.grid.min_z_idx + zi;
    if (z * cell < 770 || z * cell > 1040) return;
    for (const [x, count, low, high] of row) for (let n = 0; n < count; n++) add(payload.grid.min_x_idx + x + n, z, low, high);
  });
  for (const [x, z, low, high] of payload.buildings ?? []) add(x, z, low, high);
  return (x, y, z) => { const c = columns.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`); return !!c && y >= c[0] && y <= c[1]; };
}

function addTriangle(builder: Builder, points: Triple[], color: number, normal: Triple): void {
  const a = new Vector3(...points[0]), b = new Vector3(...points[1]), c = new Vector3(...points[2]);
  if (b.sub(a).cross(c.sub(a)).dot(new Vector3(...normal)) < 0) [points[1], points[2]] = [points[2], points[1]];
  const geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(points.flat(), 3));
  // Keep the common indexed layout so this merges with circles and roof caps.
  geometry.setIndex([0, 1, 2]); paintGeometry(geometry, color); builder.parts.push(geometry);
}
function addQuad(builder: Builder, points: Triple[], color: number, normal: Triple): void {
  addTriangle(builder, [points[0], points[1], points[2]], color, normal);
  addTriangle(builder, [points[0], points[2], points[3]], color, normal);
}

function plan(payload: { buildings: readonly PrismBuilding[] } | undefined, options: MuseumLenneOptions) {
  const parts = selected(payload), walls = museumLenneWalls(payload), blocks: MuseumLenneBlock[] = [], curved = createBuilder();
  const minecraft = !!options.minecraft, mobile = minecraft && !!options.mobileLike, voxel = makeVoxelSampler(options.voxels);
  const occupied = (sourceId: string, p: Triple) => parts.some(q => q.id !== sourceId && q.id !== MUSIC_MUSEUM_ENTRANCE_ID && p[1] >= q.y0_dm / 10 && p[1] < (MUSIC_MUSEUM_IDS.has(q.id) ? musicMuseumPartRoofHeightAt(q.id,p[0],p[2]) ?? -Infinity : (q.y0_dm + q.h_dm) / 10) && museumLennePrismContains(q, p[0], p[2]));
  const emit = (w: MuseumLenneWall, u: number, y: number, width: number, height: number, depth: number, out: number, color: number, role: string, visible = true) => {
    if (width <= 0 || height <= 0 || (visible && occupied(w.part.id, at(w, u, y, .2)))) return;
    if (minecraft && !MUSIC_MUSEUM_IDS.has(w.part.id)) {
      // Trace the actual coarse cell skin, never hide a facade inside a 4 m cube.
      for (const du of [-width * .45, 0, width * .45]) for (let d = 0; d < 3.6; d += .15)
        if (voxel(...at(w, u + du, y, d))) out = Math.max(out, d + depth / 2 + .12);
    }
    const columns = minecraft ? Math.max(1, Math.ceil(width / 5.5)) : 1;
    const rows = minecraft ? Math.max(1, Math.ceil(height / 4.8)) : 1;
    for (let ix = 0; ix < columns; ix++) for (let iy = 0; iy < rows; iy++) {
      const ww = width / columns, hh = height / rows;
      blocks.push({ position: at(w, u - width / 2 + (ix + .5) * ww, y - height / 2 + (iy + .5) * hh, out),
        size: [ww, hh, depth], yaw: -Math.atan2(w.dz, w.dx), color, role, sourceId: w.part.id, normal: [w.nx, w.nz] });
    }
  };
  addMusicMuseumShell(curved, blocks, minecraft, new Set(parts.map(p=>p.id)));
  for (const w of walls) {
    const museum = MUSIC_MUSEUM_IDS.has(w.part.id), tower = LENNE_TOWERS.find(t => (t.ids as readonly string[]).includes(w.part.id));
    const base = w.part.y0_dm / 10, top = (w.part.y0_dm + w.part.h_dm) / 10;
    const wallTop = museum ? musicMuseumFacadeTop(w.part.id, top) : top;
    if (w.part.id===MUSIC_MUSEUM_ENTRANCE_ID)continue;
    if (minecraft && museum) {
      const count=Math.max(1,Math.ceil(w.length));
      for(let i=0;i<count;i++){
        const u=(i+.5)*w.length/count, v=at(w,u,0,-.08);
        const y=w.part.id===MUSIC_MUSEUM_HALL_ID?wallTop:musicMuseumPartRoofHeightAt(w.part.id,v[0],v[2])??wallTop;
        emit(w,u,(base+y)/2,w.length/count,y-base,.28,-.14,C.stone,"museum source wall",false);
      }
    }
    if (w.length < 2.5) continue;
    if (museum) {
      // Long slim staggered panels, not a generic apartment-window grid.
      const pitch = minecraft ? (mobile ? 2.6 : 1.8) : mobile ? 1.4 : .96, bays = Math.max(1, Math.floor(w.length / pitch));
      for (let i = 0; i < bays; i++) {
        const u = (i + .5) * w.length / bays, x = at(w, u, 0, 0);
        for (let y = base + 1; y < wallTop - .5; y += mobile || minecraft ? 3.6 : 2.2) {
          const h = Math.min(mobile || minecraft ? 3.6 : 2.2, wallTop - y - .1);
          emit(w, u, y + h / 2, w.length / bays - .04, h - .035, .08, .065, (i + Math.floor(y)) % 4 ? C.stone : 0xb6b5a7, "museum staggered panel");
        }
        // The exhibition hall's long park wall is substantially opaque.
        if (x[2] < 971 && w.part.id === MUSIC_MUSEUM_HALL_ID) continue;
        if (w.part.id === "4keChp4s" && w.nx > .5) {
          if (i > 1 && i < bays - 2) continue;
          for (const y of [base + 2.5, base + 6.1, base + 9.6]) emit(w, u, y, .55, .85, .1, .18, C.glass, "museum paired slit");
        } else if (w.length > 7) {
          for (let y = base + 3; y < wallTop - 2; y += 4.1) {
            emit(w, u, y, w.length / bays * .79, 2.6, .13, .22, C.glass, "institute glazing");
            emit(w, u, y - 1.37, w.length / bays * .88, .16, .25, .26, C.silver, "institute sill");
            if (!mobile && !minecraft) for (let l = 0; l < 5; l++) emit(w, u, y - .9 + l * .43, w.length / bays * .79, .065, .2, .33, C.silver, "institute sun louvre");
          }
        }
      }
      emit(w, w.length / 2, wallTop - .1, w.length, .2, .22, .12, C.silver, "museum roof edge");
    } else if (tower) {
      const towerParts = parts.filter(p => (tower.ids as readonly string[]).includes(p.id));
      const low = Math.min(...towerParts.map(p => p.y0_dm / 10));
      const cornice = Math.max(...towerParts.map(p => (p.y0_dm + p.h_dm) / 10)) - 1.2;
      const floorHeight = (cornice - low) / tower.floors;
      const pitch = minecraft ? (mobile ? 7 : 5.2) : (mobile ? 4.4 : 3.2), bays = Math.max(1, Math.round(w.length / pitch)), bay = w.length / bays;
      const glass = tower.style === "glass-bands" || tower.style === "silver-frame";
      for (let floor = 0; floor < tower.floors; floor++) {
        const y = low + (floor + .5) * floorHeight;
        if (y < base || y + floorHeight / 2 > top + .05) continue;
        for (let i = 0; i < bays; i++) {
          const u = (i + .5) * bay;
          emit(w, u, y, bay - .025, floorHeight - .025, .09, .09, tower.tone, "Lenne facade field");
          const width = bay * (glass ? .96 : tower.style === "cms-stone" ? .68 : .64);
          const wh = floorHeight * (glass ? .88 : .76);
          emit(w, u, y, width, wh, .12, .22, i % 3 ? C.glass : C.glassLight, `Lenne ${tower.number} glazing`);
          if (tower.style !== "glass-bands") {
            emit(w, u - width / 2 - .045, y, .09, wh + .12, .2, .31, glass ? C.silver : 0xa5a69d, "Lenne window reveal");
            if (!mobile && !minecraft) emit(w, u, y, .085, wh, .15, .35, C.silver, "Lenne paired window mullion");
          }
          if (!glass) {
            emit(w, u, y - wh / 2 + .7, width, .07, .13, .39, C.silver, "Lenne glazing guard rail");
            if (tower.style === "stone-bays") emit(w, u, y - wh / 2 - .12, width + .28, .19, .58, .28, 0x888e86, "Lenne 9 projecting bay sill");
          }
          emit(w, u, low + floor * floorHeight + .08, bay, glass ? .2 : .1, .18, .27, glass ? C.silver : 0xbebdb2, "Lenne floor band");
          if (tower.style === "silver-frame" && i % 2 === 0)
            emit(w, u - bay / 2 + .16, y, .48 - floor * .025, floorHeight, .38, .34, C.silver, "Lenne 5 tapering structural pier");
        }
      }
      emit(w, w.length / 2, top - .12, w.length, .24, .36, .17, glass ? C.silver : tower.tone, "Lenne source parapet");
    }
  }

  const hall = parts.find(p => p.id === MUSIC_MUSEUM_HALL_ID);
  if (hall) {
    const roofY = MUSIC_MUSEUM_ROOF_BASE;
    const entrance = walls.find(w => w.part.id === hall.id && Math.abs(w.a[0]+38.9)<.01 && Math.abs(w.a[1]-940.3)<.01);
    if (entrance) {
      const u = entrance.length * .5;
      emit(entrance, u, hall.y0_dm / 10 + 1.65, entrance.length * .92, 3.3, .16, .24, C.glass, "museum entry glazing");
      for (const du of [-3.4, 0, 3.4]) emit(entrance, u + du, 5.95, .16, 3.3, .23, .35, C.silver, "museum entry mullion");
      // The separate exact K0003U6g source roof supplies the 8.053 m entrance canopy.
      for(const line of letteringStrokePaths("MUSIKINSTRUMENTEN-MUSEUM",.3))for(let i=1;i<line.length;i++){
        const a=line[i-1],b=line[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.ceil(d/.055));
        if(minecraft)for(let j=0;j<steps;j++)emit(entrance,u+a[0]+(b[0]-a[0])*(j+.5)/steps,7.52+a[1]+(b[1]-a[1])*(j+.5)/steps,.045,.045,.075,.39,C.dark,"museum entrance lettering",false);
        else{const dx=-(b[1]-a[1])/d*.022,dy=(b[0]-a[0])/d*.022;addQuad(curved,[at(entrance,u+a[0]+dx,7.52+a[1]+dy,.43),at(entrance,u+b[0]+dx,7.52+b[1]+dy,.43),at(entrance,u+b[0]-dx,7.52+b[1]-dy,.43),at(entrance,u+a[0]-dx,7.52+a[1]-dy,.43)],C.dark,[entrance.nx,0,entrance.nz]);}
      }
      for(const du of [-4.1,0,4.1]){
        const lo=u+du-1.45,hi=u+du+1.45;
        if(minecraft)for(let k=0;k<3;k++)emit(entrance,u+du,8.24+(3-k)*.72-.18,2.9,.36,2.45/3,.1+(k+.5)*2.45/3,C.roof,"museum entrance sloping rooflet",false);
        else addQuad(curved,[at(entrance,lo,8.24,2.55),at(entrance,hi,8.24,2.55),at(entrance,hi,10.4,.1),at(entrance,lo,10.4,.1)],C.roof,[0,1,0]);
      }
    }
    const gold = walls.find(w => w.part.id === hall.id && Math.abs(w.a[0] + 34.9) < .02 && Math.abs(w.a[1] - 959) < .02);
    if (gold) {
      const h = roofY - hall.y0_dm / 10 - .5, rows = mobile ? 13 : 22;
      for (let r = 0; r < rows; r++) {
        const width = gold.length * ((r + .5) / rows), cols = Math.max(1, Math.round(width / (mobile ? .65 : .32)));
        for (let col = 0; col < cols; col++) emit(gold, gold.length - width + (col + .5) * width / cols,
          hall.y0_dm / 10 + (r + .5) * h / rows, width / cols * .96, h / rows * .95, .2 + ((r + col) % 2) * .1,
          .18, (r + col) % 2 ? C.gold : C.goldLight, "museum triangular gold relief", false);
      }
    }
    if(gold){
      const u=gold.length*.24;
      if(minecraft)for(let row=-2;row<=2;row++)emit(gold,u,5.9+row*.26,1.5*Math.sqrt(1-(row/2.6)**2),.27,.12,.35,C.glass,"museum low round opening",false);
      else {const oval=new CircleGeometry(.8,mobile?16:28).rotateY(Math.atan2(gold.nx,gold.nz));oval.translate(...at(gold,u,5.9,.35));paintGeometry(oval,C.glass);curved.parts.push(oval);}
    }
    // Exactly two large upper oval openings in the institute's east plane.
    const ovalWall = walls.find(w => w.part.id === "4keChp4s" && w.nx > .5 && w.length > 20);
    if (ovalWall) for (const u of [8.2, 14.2]) {
      if (minecraft) for (let row = -3; row <= 3; row++) {
        const width = 2.3 * Math.sqrt(Math.max(0, 1 - (row / 3.5) ** 2));
        emit(ovalWall, u, 12.2 + row * .4, width, .5, .19, .36, C.glass, "museum oval opening", false);
      } else {
        const oval = new CircleGeometry(1, mobile ? 20 : 32).scale(1.15, 1.7, 1).rotateY(Math.atan2(ovalWall.nx,ovalWall.nz));
        const p = at(ovalWall,u,12.2,.36); oval.translate(...p); paintGeometry(oval,C.glass); curved.parts.push(oval);
        for (let l = -2; l <= 2; l++) emit(ovalWall,u,12.2+l*.45,2.15*Math.sqrt(1-(l/3.5)**2),.075,.14,.43,C.silver,"museum oval grille",false);
      }
    }
    curved.parts.forEach(g => g.userData.rooflightCount = 14);
  }
  return { blocks, curved, parts };
}

export function createMuseumLenneArchitecture(payload?: { buildings: readonly PrismBuilding[] }, options: MuseumLenneOptions = {}): Group {
  const { blocks, curved, parts } = plan(payload, options), root = new Group();
  root.name = options.minecraft ? MINECRAFT_MUSEUM_LENNE_GROUP : MUSEUM_LENNE_GROUP;
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, roughness: .86, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, blocks.length), matrix = new Matrix4(), scale = new Vector3(), color = new Color();
  blocks.forEach((b,i) => { matrix.makeRotationY(b.yaw).scale(scale.set(...b.size)).setPosition(...b.position); mesh.setMatrixAt(i,matrix); mesh.setColorAt(i,color.setHex(b.color)); });
  mesh.name = `${root.name} facade blocks`; mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night;
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  const details = finishDrawnGroup(curved, { name: "Museum shaped rooflights and oval glazing" }); if (details) root.add(details);
  root.userData.sourceIds = parts.map(p => p.id); root.userData.profile = MUSIC_MUSEUM_PROFILE;
  root.userData.textureFree = true; root.userData.staticAllModes = true;
  root.userData.detailCounts = blocks.reduce<Record<string,number>>((c,b) => { c[b.role]=(c[b.role]??0)+1; return c; },{});
  root.userData.instanceCount = blocks.length;
  if (options.diagnostics) root.userData.blocks = blocks;
  freezeStaticSceneTransforms(root); return root;
}
export function createMinecraftMuseumLenneArchitecture(payload?: { buildings: readonly PrismBuilding[] }, options: Omit<MuseumLenneOptions,"minecraft"> = {}): Group {
  return createMuseumLenneArchitecture(payload, { ...options, minecraft: true });
}
