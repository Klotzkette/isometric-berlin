import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Path, PlaneGeometry, Shape, ShapeGeometry, Vector2, Vector3 } from "three";
import { addBox, createBuilder, finishDrawnGroup, paintGeometry } from "./drawnKit";
import sourceProfile from "./humboldthafenBuildingProfile.json";
import { HUMBOLDTHAFEN_H3_COURTYARD_PROFILE, resolveHumboldthafenPrism } from "./humboldthafenCourtyardProfile";

export type HarbourPrism = { id: string; ring: number[][]; holes?: number[][][]; y0_dm: number; h_dm: number };
export const HUMBOLDTHAFEN_BUILDING_IDS: ReadonlySet<string> = new Set(sourceProfile.map(p => p.id));
export const HUMBOLDTHAFEN_EINS_IDS: ReadonlySet<string> = new Set([
  "flTWxifD", "tppqGxWH", "nOu64nI2", "FxtigPVE", "k6NdEsT1", "cZm1I9rQ", "pvadbwQ2", "bnFqavmS", "eGZXjFeA", "ODmia6hi",
]);
export const HUMBOLDTHAFEN_BUILDING_PROFILE = {
  source: "Berlin LoD2 delivered prism coordinates, EPSG:25833, x=E-389500, z=5820000-N; decimetres in the committed profile",
  eins: { architect: "KSP Engel", completed: 2015, storeys: [7, 8], source: "https://www.kvlgroup.com/referenzen/humboldthafen-eins", facade: "irregularly spaced, one-sided bevelled pale GFB pilasters; floor bands and two-storey waterfront arcade" },
  h3h4: { completed: 2019, storeys: 7, source: "https://www.schueco.com/schueco/fabricators/references/humboldthafen-baufeld-h3-h4-4085", facade: "pale panel grid, alternating broad and narrow window bays, glazed commercial base and projecting balcony parapets" },
  spiegel: { name: "SPIEGEL-Hauptstadtstudio", address: "Alexanderufer 5", osmNode: "12121083184", world: [151.18712440156378,-596.7039961535484], sourcePart: "tppqGxWH", source: "https://www.berlin.de/tickets/suche/orte/spiegel-hauptstadtstudio-bdc53199-9a0f-4b6b-8e25-37db8cfd1d2d/", note: "Office identity only; the OSM office point is not asserted to be a surveyed door." },
  courtyardResolution: HUMBOLDTHAFEN_H3_COURTYARD_PROFILE,
  geometryStatus: "Exact outer source outlines and heights retained. The documented H3 overlap is resolved using its existing upper courtyard wall and three lower LoD2 roof parts; original records remain unchanged. Window spacing, reveals and panel joints are photo-guided display dimensions, not a measured facade survey. Flat roof interpretation follows completed-building photographs; no roof height is raised. The colonnade is a shallow facade articulation, not an invented through-building route.",
} as const;

function inRing(ring: number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
export function harbourPrismContains(p: HarbourPrism, x: number, z: number): boolean {
  return inRing(p.ring, x * 10, z * 10) && !(p.holes ?? []).some(h => inRing(h, x * 10, z * 10));
}
function selectPrisms(prisms?: readonly HarbourPrism[]): HarbourPrism[] {
  // Cold Minecraft startup can use this exact, compact source subset without
  // allocating the full drawn world. Source coordinates are checked in tests.
  return (prisms ?? sourceProfile).filter(p => HUMBOLDTHAFEN_BUILDING_IDS.has(p.id)).map(resolveHumboldthafenPrism);
}
export function createHumboldthafenBuildingColumnTester(prisms?: readonly HarbourPrism[]) {
  // Remove the delivered raster column mass, including its erroneous full-
  // height H3 court fill. The replacement preserves its separate low roofs.
  const parts = (prisms ?? sourceProfile).filter(p => HUMBOLDTHAFEN_BUILDING_IDS.has(p.id));
  return (x: number, z: number): boolean => {
    if (x < 43 || x > 168 || z < -960 || z > -514) return false;
    return parts.some(p => harbourPrismContains(p, x, z));
  };
}

type Block = { position: [number, number, number]; size: [number, number, number]; yaw: number; color: number; role: string; sourceId: string; normal?: [number, number] };
const STONE = 0xe7e3d6, FIN = 0xf0eee2, GLASS = 0x38565d, JOINT = 0xbbbdb6, ROOF = 0x747c79;
export function planHumboldthafenBuildingDetails(prisms?: readonly HarbourPrism[], minecraft = false, mobileLike = false): Block[] {
  const parts = selectPrisms(prisms), blocks: Block[] = [];
  const occupied = (p: HarbourPrism, x: number, z: number, y: number) => parts.some(q => q !== p && q.y0_dm / 10 <= y && (q.y0_dm + q.h_dm) / 10 > y && harbourPrismContains(q, x, z));
  for (const p of parts) {
    const eins = HUMBOLDTHAFEN_EINS_IDS.has(p.id), base = eins ? Math.max(p.y0_dm / 10,5.1) : p.y0_dm / 10, top = (p.y0_dm + p.h_dm) / 10;
    if (p.h_dm < 12) continue;
    for (const ring of [p.ring, ...(p.holes ?? [])]) {
      for (let edge = 0; edge < ring.length; edge++) {
        const a = ring[edge], b = ring[(edge + 1) % ring.length];
        const ax = a[0] / 10, az = a[1] / 10, dx = (b[0] - a[0]) / 10, dz = (b[1] - a[1]) / 10;
        const length = Math.hypot(dx, dz); if (length < 0.6) continue;
        const ux = dx / length, uz = dz / length, yaw = -Math.atan2(uz, ux);
        let nx = -uz, nz = ux;
        if (harbourPrismContains(p, ax + dx / 2 + nx * .12, az + dz / 2 + nz * .12)) { nx *= -1; nz *= -1; }
        const emit = (along: number, y: number, w: number, h: number, depth: number, offset: number, color: number, role: string) => {
          if (h <= .02 || w <= .02 || occupied(p, ax + ux * along + nx * .18, az + uz * along + nz * .18, y)) return;
          blocks.push({ position: [ax + ux * along + nx * offset, y, az + uz * along + nz * offset], size: [w, h, depth], yaw, color, role, sourceId: p.id, normal: [nx,nz] });
        };
        const bays = Math.max(1, Math.round(length / (eins ? (minecraft ? 3.8 : 2.5) : 4.2))), pitch = length / bays;
        const observedFloors = p.id === "3zV00024" || p.id === "ee9JgIcN" ? 7
          : p.id === "nOu64nI2" || p.id === "FxtigPVE" ? 2 : eins ? p.id === "eGZXjFeA" ? 8 : 7 : Math.round((top - base) / 4);
        const floors = Math.max(1, Math.min(eins ? 8 : 7, observedFloors)), floor = (top - base - .65) / floors;
        for (let bay = 0; bay < bays; bay++) {
          const along = (bay + .5) * pitch;
          if (minecraft) {
            // Closed surface courses replace the coarse filled 4 m columns.
            // The exact facade can therefore never be buried inside voxels.
            for (let level = 0; level < floors; level++) emit(along, base + (level + .5) * (top - base) / floors, pitch + .015, (top - base) / floors, .32, -.12, STONE, "source-wall-course");
          }
          for (let level = 0; level < floors; level++) {
            const y = base + (level + .52) * floor;
            const arcade = eins && (nx < -.7 || nz > .7);
            const low = level === 0, windowH = Math.min(floor - .6, low ? floor - .8 : eins ? floor - .5 : floor * .73);
            const width = pitch * (eins ? .76 : [0.55, .76, .44, .68][bay % 4]);
            emit(along, y, low ? pitch - .3 : width, windowH, .12, .075, GLASS, low ? "commercial-glazing" : "window");
            if (!mobileLike && !minecraft) {
              emit(along + width * .12, y, .065, windowH, .17, .13, JOINT, "window-mullion");
            }
            // Different building identities: HHE's folded vertical GFB fins,
            // H3/H4's broad stone reveals and offset residential openings.
            if (eins && !(arcade && level < 2)) {
              const finWidth = pitch * [0.18, .25, .13, .31, .2][bay % 5];
              emit((bay + .02) * pitch + finWidth / 2, y, finWidth, floor - .13, .35, .22, FIN, "vertical-gfb-fin");
              if (!minecraft && !mobileLike && level>1 && bay%3===1) emit(along,y+windowH*.27,width,windowH*.42,.1,.15,0xa4a498,"partially-lowered-blind");
            } else if (!eins) {
              emit(along - pitch / 2 + .08, y, .09, floor - .12, .12, .13, JOINT, "stone-panel-joint");
              if (level > 0 && level < floors - 1 && length < 6 && length > 2.4) {
                emit(along, y - windowH / 2 - .14, pitch * .9, .22, .65, .3, FIN, "balcony-slab");
                emit(along, y - windowH / 2 + .48, pitch * .9, .8, .1, .64, 0x91aaa9, "balcony-parapet");
                emit(along, y - windowH / 2 + .91, pitch * .9, .09, .14, .64, JOINT, "balcony-rail");
              }
            }
          }
          for (let level = 1; level <= floors; level++) emit(along, Math.min(top - .1, base + level * floor), pitch + .015, eins ? .2 : .13, .22, .14, FIN, "floor-band");
          emit(along, top - .12, pitch + .015, .24, .32, .12, FIN, "flat-parapet");
          // Pale rectangular piers in front of the glazed plinth; avoids
          // speculative deep arcades or changing source collision routes.
          if (length > 10 && (eins ? nx < -.7 || nz > .7 : nz > .65)) {
            const h=eins ? Math.min(top-base-.2,floor*1.55) : floor;
            emit(bay*pitch+.3,base+h/2,eins ? .65 : .5,h,eins ? 1.2 : .6,eins ? .6 : .3,FIN,"waterfront-colonnade");
            if(eins)emit(along,base+h+.16,pitch+.015,.32,1.25,.6,FIN,"arcade-head-beam");
          }
        }
      }
    }
    if (minecraft) {
      const quantum = mobileLike ? 3 : 2.5;
      const xs = p.ring.map(v => v[0] / 10), zs = p.ring.map(v => v[1] / 10);
      for (let x = Math.min(...xs) + quantum / 2; x < Math.max(...xs); x += quantum) for (let z = Math.min(...zs) + quantum / 2; z < Math.max(...zs); z += quantum) {
        // Full-cell inclusion keeps roof blocks out of source courtyard holes.
        if (![[0,0],[-.49,-.49],[.49,-.49],[-.49,.49],[.49,.49]].every(([a,b]) => harbourPrismContains(p, x+a*quantum,z+b*quantum)) || occupied(p, x, z, top + .05)) continue;
        blocks.push({ position: [x, top - .18, z], size: [quantum + .015, .36, quantum + .015], yaw: 0, color: ROOF, role: "source-flat-roof", sourceId: p.id });
      }
    }
  }
  return blocks;
}

export function createHumboldthafenBuildingDetails(payload?: { buildings: readonly HarbourPrism[] }, options: { minecraft?: boolean; mobileLike?: boolean } = {}): Group {
  const blocks = planHumboldthafenBuildingDetails(payload?.buildings, options.minecraft, options.mobileLike);
  const group = new Group();
  group.name = options.minecraft ? "Minecraft Humboldthafen building architecture" : "Humboldthafen building architecture";
  group.userData.sourceProfile = HUMBOLDTHAFEN_BUILDING_PROFILE;
  group.userData.sourceRoles = blocks.reduce<Record<string, number>>((a,b) => { a[b.role] = (a[b.role] ?? 0) + 1; return a; }, {});
  group.userData.staticAllModes = true;
  group.userData.staticAntiFlicker = true;
  if (options.minecraft) {
    // The shared cube has no vertex colors; its palette comes from instanceColor.
    const mesh = new InstancedMesh(new BoxGeometry(1,1,1), new MeshBasicMaterial(), blocks.length);
    mesh.name = "Minecraft source-bound harbour facade blocks";
    const m = new Matrix4(), v = new Vector3(), c = new Color();
    blocks.forEach((b,i) => { m.makeRotationY(b.yaw).scale(v.set(...b.size)).setPosition(...b.position); mesh.setMatrixAt(i,m); mesh.setColorAt(i,c.setHex(b.color)); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    mesh.userData.approxInstanceTransferBytes = blocks.length * 76;
    group.add(mesh);
    // A thin, exact flat cap closes slivers between the block roof grid and
    // oblique source walls without projecting blocks into courtyard holes.
    const caps = createBuilder();
    for (const p of selectPrisms(payload?.buildings)) {
      const shape = new Shape(p.ring.map(([x,z]) => new Vector2(x / 10,-z / 10)));
      for (const hole of p.holes ?? []) shape.holes.push(new Path(hole.map(([x,z]) => new Vector2(x / 10,-z / 10))));
      const cap = new ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0,(p.y0_dm+p.h_dm)/10-.35,0);
      paintGeometry(cap,ROOF); caps.parts.push(cap);
    }
    const roof = finishDrawnGroup(caps,{name:"Minecraft exact harbour flat roof caps"}); if (roof) group.add(roof);
  } else {
    const builder = createBuilder();
    const flatRoles = new Set(["window", "commercial-glazing", "window-mullion", "stone-panel-joint", "partially-lowered-blind"]);
    blocks.forEach(b => {
      if (flatRoles.has(b.role) && b.normal) {
        const [nx,nz] = b.normal;
        const pane = new PlaneGeometry(b.size[0],b.size[1]).rotateY(Math.atan2(nx,nz));
        pane.translate(b.position[0]+nx*b.size[2]/2,b.position[1],b.position[2]+nz*b.size[2]/2);
        paintGeometry(pane,b.color);builder.parts.push(pane);
      } else if (b.role === "vertical-gfb-fin" && b.normal) {
        // One side of each glass-fibre concrete pilaster folds toward the
        // glass. Model the section itself, rather than a second box lip.
        const fin=new BoxGeometry(...b.size), a=fin.getAttribute("position");
        const ux=Math.cos(b.yaw),uz=-Math.sin(b.yaw),[nx,nz]=b.normal;
        for(let i=0;i<a.count;i++) {
          const x=a.getX(i),y=a.getY(i),z=a.getZ(i)>0 ? b.size[2]*(.12+.38*(x/b.size[0]+.5)) : a.getZ(i);
          a.setXYZ(i,b.position[0]+ux*x+nx*z,b.position[1]+y,b.position[2]+uz*x+nz*z);
        }
        if(ux*nz-uz*nx<0 && fin.index) for(let i=0;i<fin.index.count;i+=3){const a=fin.index.getX(i+1);fin.index.setX(i+1,fin.index.getX(i+2));fin.index.setX(i+2,a);}
        paintGeometry(fin,b.color);builder.parts.push(fin);
      } else addBox(builder,b.color,...b.position,...b.size,b.yaw,b.role === "flat-parapet");
    });
    const drawn = finishDrawnGroup(builder,{name:group.name}); if (drawn) group.add(drawn);
  }
  return group;
}
