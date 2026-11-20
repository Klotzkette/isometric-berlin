import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, InstancedMesh,
  Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Path, Quaternion, Shape, Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hbfLocalToWorldV291, hbfRailCurveAtV291, HBF_CIRCULATION_V291 } from "./HbfCirculationV291";
import data from "./data/humboldthafenRailV369.json";
import type { RailPayload } from "./RailNetwork";
import type { VoxelPayload } from "./terrainPayload";

type Point = [number, number, number];
type Ring = readonly (readonly number[])[];
type Cross = { ring: Ring; holes?: readonly Ring[] };
const STEEL = 0x97a3a2, CAST = 0x737c7c, CONCRETE = 0xb9b9ac, EDGE = 0xc9c9be;
const BEARING = 0x697477, RAIL = 0x929a97;
const DECK_HEIGHT = 1.70, TUBE_DIAMETER = .66;
const oldPiers = new Set(data.retiredPiersDm.map(p => p.join(",")));
const worldUp = new Vector3(0, 1, 0);

export function hasDrawnHumboldthafenV369(payload: RailPayload) {
  if (payload.deck_top_y_m !== 14.475 || !payload.viaduct.length) return false;
  const piers = new Set(payload.piers.map(p => p.join(",")));
  return [...oldPiers].every(key => piers.has(key));
}
export const isReplacedHumboldthafenPierV369 = (xDm: number, zDm: number) => oldPiers.has(xDm + "," + zDm);

export function hasNativeHumboldthafenV369(v: VoxelPayload) {
  if (v.grid.min_x_idx !== data.grid[0] || v.grid.min_z_idx !== data.grid[1] || v.cell_m !== data.grid[2]) return false;
  return data.tracks.every(({ landing }) => {
    const [x, z, base, top] = landing.cell;
    return v.building_rows?.[z]?.some(([i, n, y0, y1]) => x >= i && x < i + n && y0 === base && y1 === top);
  });
}

/** Return the same grid, with only previously spurious bridge cells over the
 * mapped harbour put back into the ordinary Native water material and height. */
export function restoreHumboldthafenWaterV369(v: VoxelPayload, native = true): VoxelPayload {
  // The lightweight Drawn ground packet deliberately omits the elevated
  // building cells. Its caller verifies the active source railway instead.
  if (v.grid.min_x_idx !== data.grid[0] || v.grid.min_z_idx !== data.grid[1] || v.cell_m !== data.grid[2]
      || (native && !hasNativeHumboldthafenV369(v))) return v;
  const oldClass = v.classes.indexOf("bridge"), water = v.classes.indexOf("water");
  if (oldClass < 0 || water < 0) return v;
  const recorded = Object.entries(data.waterRows);
  if (!recorded.every(([id, cells]) => cells.every(x =>
    v.ground_rows[Number(id)]?.some(([start, n, cls]) => cls === oldClass && x >= start && x < start + n)))) return v;
  const rows = v.ground_rows.slice();
  for (const [id, cells] of recorded) {
    const z = Number(id), changed = new Set(cells);
    const fresh: VoxelPayload["ground_rows"][number] = [];
    for (const run of rows[z]) {
      const [start, count, cls] = run;
      if (cls !== oldClass || !cells.some(x => x >= start && x < start + count)) { fresh.push(run); continue; }
      let from = start, previous = changed.has(from);
      for (let x = start + 1; x <= start + count; x++) {
        const inside = changed.has(x);
        if (x === start + count || inside !== previous) {
          fresh.push([from, x - from, previous ? water : cls]);
          from = x; previous = inside;
        }
      }
    }
    rows[z] = fresh;
  }
  return { ...v, ground_rows: rows };
}

class Members {
  private matrices: number[] = [];
  private tones: number[] = [];
  private matrix = new Matrix4();

  box(x: number, y: number, z: number, w: number, h: number, d: number, tone: number) {
    this.matrix.makeScale(w, h, d).setPosition(x, y, z);
    this.add(tone);
  }
  segment(a: Point, b: Point, diameter: number, native: boolean, tone: number) {
    const d = new Vector3(b[0]-a[0], b[1]-a[1], b[2]-a[2]), length = d.length();
    if (length < .025) return;
    if (native) {
      const vertical = Math.abs(d.x) + Math.abs(d.z) < .01;
      const count = vertical ? 1 : Math.ceil(length / .65);
      for (let i = 0; i < count; i++) {
        const t = (i + .5) / count;
        this.box(a[0]+d.x*t, a[1]+d.y*t, a[2]+d.z*t,
          Math.abs(d.x)/count+diameter, Math.abs(d.y)/count+(vertical ? 0 : diameter), Math.abs(d.z)/count+diameter, tone);
      }
      return;
    }
    this.matrix.compose(new Vector3((a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2),
      new Quaternion().setFromUnitVectors(worldUp, d.normalize()), new Vector3(diameter, length, diameter));
    this.add(tone);
  }
  private add(tone: number) { this.matrices.push(...this.matrix.elements); this.tones.push(tone); }

  attach(group: Group, geometry: BufferGeometry, name: string, native: boolean) {
    if (!this.tones.length) { geometry.dispose(); return; }
    // In the daylight ink pass the material is unlit. Give the round tube
    // section enough tonal variation to distinguish it from a flat grey strip.
    const round = geometry.type === "CylinderGeometry";
    if (round) {
      const normal = geometry.getAttribute("normal"), shades = new Float32Array(normal.count * 3);
      for (let i = 0; i < normal.count; i++) {
        const light = .83 + .13 * normal.getZ(i) + .04 * normal.getY(i);
        shades.fill(light, 3 * i, 3 * i + 3);
      }
      geometry.setAttribute("color", new Float32BufferAttribute(shades, 3));
    }
    const night = new MeshStandardMaterial({ roughness: .86, metalness: .08, vertexColors: round });
    const day = native ? night : new MeshBasicMaterial({ vertexColors: round });
    const mesh = new InstancedMesh(geometry, day, this.tones.length);
    mesh.name = name;
    mesh.userData = { dayMaterial: day, nightMaterial: night, keepInMinecraft: native, blockNative: native };
    mesh.instanceMatrix.array.set(this.matrices);
    const color = new Color();
    this.tones.forEach((tone, i) => mesh.setColorAt(i, color.setHex(tone)));
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
}

function part(ring: Cross, y: number, h: number, tone: number) {
  const path = (shape: Shape | Path, points: Ring) => {
    points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
    shape.closePath();
    return shape;
  };
  const outline = path(new Shape(), ring.ring) as Shape;
  for (const hole of ring.holes ?? []) outline.holes.push(path(new Path(), hole));
  const geometry = new ExtrudeGeometry(outline, { depth: h, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  const color = new Color(tone), normal = geometry.getAttribute("normal");
  const shades = new Float32Array(normal.count * 3);
  for (let i = 0; i < normal.count; i++) {
    const light = .89 + normal.getY(i) * .09 + normal.getZ(i) * .02;
    shades.set([color.r * light, color.g * light, color.b * light], 3 * i);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(shades, 3));
  return geometry;
}

function blockRing(members: Members, ring: Ring, bottom: number, top: number, tone: number) {
  const low = Math.min(...ring.map(p => p[1])), high = Math.max(...ring.map(p => p[1]));
  for (let cell = Math.floor(low*2); cell/2 < high; cell++) {
    const a = Math.max(low, cell/2), b = Math.min(high,(cell+1)/2), z = (a+b)/2;
    const hits: number[] = [];
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i+1)%ring.length];
      if ((p[1] > z) === (q[1] > z)) continue;
      hits.push(p[0] + (z-p[1])/(q[1]-p[1])*(q[0]-p[0]));
    }
    if (hits.length === 2) members.box((hits[0]+hits[1])/2, (bottom+top)/2, z,
      Math.abs(hits[0]-hits[1]),top-bottom,b-a,tone);
  }
}

function railZAt(track: typeof data.tracks[number], x: number) {
  const i = track.points.findIndex(p => p[0] >= x);
  if (i < 0) return track.points.at(-1)![1];
  if (!i) return track.points[0][1];
  const a = track.points[i-1], b = track.points[i];
  return a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]);
}

const minWestX = data.nativeStartX;
const nativeWestDeck = HBF_CIRCULATION_V291.frame.anchorWorld[1] + 10.35;
const unit = (n: number) => Math.max(0, Math.min(1, n));
const landings = data.tracks.map(t => t.landing);
function nativeDeckY(x: number, z: number) {
  // At the east end the six old voxel roof cells differ by up to 20 cm.
  const index = landings.findIndex(p => p.z >= z);
  const upper = Math.max(1, index < 0 ? landings.length - 1 : index);
  const a = landings[upper-1], b = landings[upper];
  const cap = a.top + unit((z-a.z)/(b.z-a.z))*(b.top-a.top);
  return nativeWestDeck - .045 + unit((x-90)/(a.x-90))*(cap-nativeWestDeck+.045);
}

function nativeTrackJoin(rail: typeof data.tracks[number], i: number) {
  const x = 163.8, offset = HBF_CIRCULATION_V291.upperTrackCentresLocalZ[i];
  const [px, , pz] = hbfLocalToWorldV291([x, 10.53, hbfRailCurveAtV291(x)+offset]);
  const delta = pz - railZAt(rail, px);
  // The six existing authored platform tracks are more tightly spaced than
  // their surveyed counterparts. Ease their actual end positions onto OSM.
  return { start: px, z: (s: number) => {
    const t = unit((s - px)/28);
    return railZAt(rail, s) + delta*(1 - t*t*(3-2*t));
  } };
}

function nativeDeck(members: Members) {
  for (const [i, ranges] of data.nativeBedRows.entries()) {
    const x = minWestX+i+.5;
    for (const [low,high] of ranges) {
      const z=(low+high)/2;
      const y=nativeDeckY(x,z);
      // The west landing feathers into the retained 37 m station deck.
      const fit = .52+.48*unit((x-minWestX)/39);
      const centre = -691 + .055*x, zz = centre+(z-centre)*fit;
      members.box(x,y-DECK_HEIGHT/2,zz,1,DECK_HEIGHT,(high-low)*fit,CONCRETE);
    }
  }
  for (const [i, track] of data.tracks.entries()) {
    const join = nativeTrackJoin(track,i);
    for (let start = join.start; start < track.landing.x; start+=.8) {
      const end = Math.min(start+.8, track.landing.x), x=(start+end)/2;
      const a = join.z(start), b = join.z(end), z=(a+b)/2;
      // The deep outer rails of the block station have 50 cm tall heads.
      // Fit that exact Y at the joint, then taper into the open-track profile.
      const blend = unit((start-join.start)/14);
      const top = nativeDeckY(x,z)+.475-.24*blend, h=.5-.32*blend;
      if (x < join.start+28) members.box(x, top-h-.14, z, end-start, .30, 3.0+Math.abs(b-a),CONCRETE);
      for (const side of [-.72,.72]) members.box(x,top-h/2,z+side,end-start,h,.70-.52*blend+Math.abs(b-a),RAIL);
    }
  }
}

export function createHumboldthafenRailV369(deckTop: number, water: number, native=false): Group {
  const group = new Group();
  group.name = "Humboldthafenbrücke • eight steel tube ribs v369";
  const boxes = new Members(), tubes = new Members(), solids: BufferGeometry[] = [];
  const foundationTop = water + 1.35, socketTop = foundationTop + .82;
  const top = (x: number, z: number) => native ? nativeDeckY(x,z) : deckTop;
  for (const base of data.foundations) {
    if (native) blockRing(boxes,base.ring,water-.35,foundationTop,CONCRETE);
    else solids.push(part(base,water-.35,foundationTop-water+.35,CONCRETE));
  }
  if (native) nativeDeck(boxes);
  else for (const deck of data.drawnDecks) {
    // Retain the original top sheet, all openings, six track axes and fascia.
    solids.push(part(deck,deckTop-DECK_HEIGHT,DECK_HEIGHT-.90,EDGE));
  }

  const ribPoints: Point[][] = [];
  for (let i=0;i<8;i++) {
    const west=data.bearings[0][i], east=data.bearings[1][i];
    const row: Point[] = [];
    for (let bank=0;bank<2;bank++) {
      const foot = bank ? east : west, other = bank ? west : east;
      const [x,z] = foot.center, dx=other.center[0]-x,dz=other.center[1]-z;
      if (native) blockRing(boxes,foot.ring,foundationTop,socketTop-.21,CAST);
      else solids.push(part(foot,foundationTop,socketTop-foundationTop-.21,CAST));
      tubes.segment([x,socketTop-.24,z],[x,socketTop+.13,z],1.04,native,CAST);
      const soffit = top(x,z)-DECK_HEIGHT;
      tubes.segment([x,socketTop,z],[x,soffit,z],.50,native,STEEL);
      // The rib enters the deck on either side of its crown. Its upper
      // portion is cast into the slab, as in Schober's 2000 section, Fig. 21.
      for (const reach of [.35,-.265]) {
        const points: Point[] = [];
        for (let j=0;j<=8;j++) {
          const t=j/8, xx=x+t*reach*dx, zz=z+t*reach*dz;
          // The long harbour rib flattens toward its crown; the
          // shorter landward leg rises almost directly to the slab.
          const bow = reach > 0 ? .72 : .13;
          const f=t*(1+bow-bow*t);
          const y=socketTop+(top(xx,zz)-DECK_HEIGHT+.11-socketTop)*f;
          const point: Point=[xx,y,zz];
          if (j) tubes.segment(points[j-1],point,TUBE_DIAMETER,native,STEEL);
          points.push(point);
          if (j===3 || j===6) {
            tubes.segment(point,[xx,top(xx,zz)-DECK_HEIGHT,zz],.37,native,STEEL);
            tubes.segment([xx,y-.18,zz],[xx,y+.22,zz],.71,native,CAST);
            row.push(point);
          }
          if (j===8) tubes.segment([xx,y-.36,zz],point,.89,native,BEARING);
        }
      }
    }
    ribPoints.push(row);
  }
  // Each superstructure has its own paired ribs. Connect matched cast nodes
  // across that pair only, preserving the slots between the four floor plates.
  for (let i=0;i<8;i+=2) for (let j=0;j<ribPoints[i].length;j++) {
    tubes.segment(ribPoints[i][j],ribPoints[i+1][j],.34,native,STEEL);
  }
  boxes.attach(group,new BoxGeometry(),"Humboldthafen cardinal bed, bearings and rails",native);
  tubes.attach(group,native ? new BoxGeometry() : new CylinderGeometry(.5,.5,1,12),
    "Humboldthafen paired arch tubes, spandrels and cross ties",native);
  if (solids.length) {
    const merged=mergeGeometries(solids)!;
    solids.forEach(g=>g.dispose());
    const day=new MeshBasicMaterial({vertexColors:true}),night=new MeshStandardMaterial({vertexColors:true,roughness:.94});
    const mesh=new Mesh(merged,day);
    mesh.name="Humboldthafen registered foundations, pedestals and deck undersides";
    mesh.userData={dayMaterial:day,nightMaterial:night}; group.add(mesh);
  }
  return group;
}
