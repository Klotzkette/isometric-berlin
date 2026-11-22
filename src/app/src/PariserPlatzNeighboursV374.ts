import {
  BufferGeometry, DoubleSide, Uint16BufferAttribute, Group, LineSegments, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Uint8BufferAttribute,
} from "three";
import capture from "./data/pariserNeighbourOwnersV374.json";

type Point = [number, number, number];
type Face = { width: number; point(u: number, height: number, recess?: number): Point };

export const SOMMER_V374 = "Haus Sommer, Pariser Platz 1";
export const DZ_FRONT_V374 = "DZ Bank, Pariser Platz 3";
export const DZ_ROOF_V374 = "DZ Bank, surveyed atrium roof";
const limestone = 0xb6ac99, paleStone = 0xc6bca6, shadow = 0x312d25;
const glass = 0x18232c, frame = 0x090c0d;

// Centimetre vertices and heights of the real v169 packet fronts. Both rear
// shells, all party walls and all non-street-facing surfaces remain resident.
const summerHouse = { base:4.9, height:17.13, ring:[[430.79,361.30],[428.30,333.52],[442.35,332.29],[444.82,360.05]] };
const bankFront = { base:4.8, height:20.34, ring:[[524.29,362.34],[482.69,366.04],[481.87,356.80],[523.49,353.17]] };
type Elevation = typeof summerHouse;

class Surface {
  private xyz: number[] = [];
  private rgb: number[] = [];
  private indices: number[] = [];

  quad(a: Point, b: Point, c: Point, d: Point, tone: number) {
    const index = this.xyz.length / 3;
    // The byte render target and final SMAA pass present these display swatches directly.
    const red = tone >> 16, green = (tone >> 8) & 255, blue = tone & 255;
    for (const p of [a, b, c, d]) {
      this.xyz.push(...p);
      this.rgb.push(red, green, blue);
    }
    this.indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
  }

  panel(f: Face, a: number, b: number, y: number, top: number, tone: number, depth = 0) {
    this.quad(f.point(a, y, depth), f.point(b, y, depth), f.point(b, top, depth), f.point(a, top, depth), tone);
  }

  mesh(name: string) {
    const geometry = new BufferGeometry();
    const origin = [Infinity, Infinity, Infinity];
    this.xyz.forEach((v,i) => { origin[i%3] = Math.min(origin[i%3], Math.floor(v)); });
    const xyz = this.xyz.map((v,i) => Math.round((v-origin[i%3])*1000));
    if (xyz.some(v => v<0 || v>65535)) throw Error("Pariser Platz detail exceeds its local millimetre frame");
    geometry.setAttribute("position", new Uint16BufferAttribute(xyz, 3));
    geometry.setAttribute("color", new Uint8BufferAttribute(this.rgb, 3, true));
    geometry.setIndex(this.indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
    const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .9, flatShading:true });
    const mesh = new Mesh(geometry, day);
    mesh.position.set(origin[0],origin[1],origin[2]);
    mesh.scale.setScalar(.001);
    mesh.name = name;
    mesh.userData.dayMaterial = day;
    mesh.userData.nightMaterial = night;
    return mesh;
  }
}

function wall(source: Elevation, edge: number): Face {
  const [a,b] = [source.ring[edge], source.ring[(edge + 1) % 4]];
  const dx = b[0] - a[0], dz = b[1] - a[1], width = Math.hypot(dx, dz);
  return { width, point: (u, h, d = 0) => [
    a[0] + (u*dx - d*dz) / width, source.base + h,
    a[1] + (u*dz + d*dx) / width,
  ] };
}

function opening(model: Surface, face: Face, a: number, b: number, y: number, top: number,
  depth: number, pane: number, trim: number) {
  const p = face.point;
  model.quad(p(a,y), p(a,top), p(a,top,depth), p(a,y,depth), trim);
  model.quad(p(b,y,depth), p(b,top,depth), p(b,top), p(b,y), trim);
  model.quad(p(a,y), p(a,y,depth), p(b,y,depth), p(b,y), trim);
  model.quad(p(a,top), p(b,top), p(b,top,depth), p(a,top,depth), shadow);
  model.panel(face, a, b, y, top, pane, depth);
}

// Kleihues + Kleihues, Häuser Sommer und Liebermann; Commons street photographs
// “Pariser Platz - Haus Sommer ( 1 )” and “Rückseite Ebertstraße”.
// https://kleihues.com/haeuser-sommer-und-liebermann-berlin/
// The south house
// has an asymmetric triplet of windows, an attic register and a single balcony.
function sommer(model: Surface, source: Elevation) {
  const height = source.height;
  for (let edge = 0; edge < 4; edge++) {
    const f = wall(source, edge), w = f.width;
    const publicFront = edge === 2, rear = edge === 0, end = edge === 1;
    if (!publicFront && !rear && !end) continue;
    model.panel(f, 0, w, 0, .46, 0x232520);
    const levels = [[.46, .82, 4.02, 4.62], [4.62, 5.35, 8.68, 9.25],
      [9.25, 9.9, 13.03, 13.8], [13.8, 14.23, 15.77, height-.36]];
    for (let floor = 0; floor < levels.length; floor++) {
      const [base, y, top, ceil] = levels[floor];
      const count = end ? 3 : 11;
      const pitch = w / (count + .5);
      model.panel(f, 0, w, base, y, paleStone);
      model.panel(f, 0, w, top, ceil, paleStone);
      let last = 0;
      const bays = Array.from({ length: count }, (_, i) => (i + .75)*pitch);
      if (publicFront && floor === 2) bays.splice(0, 2, .64*pitch, 1.22*pitch, 1.80*pitch);
      for (const centre of bays) {
        const door = !end && Math.abs(centre-w/2) < .01 && floor === 0;
        const bw = end ? 1.18 : door ? 1.85 : floor === 3 ? 1.10 : 1.30;
        const a = centre-bw/2, b = centre+bw/2, depth = door ? .85 : .34;
        model.panel(f, last, a, y, top, paleStone);
        opening(model, f, a, b, y, top, depth, door ? 0x130d09 : glass, 0x6f6452);
        if (!door) {
          model.panel(f, centre-.045, centre+.045, y, top, frame, depth-.025);
          model.panel(f, a, b, y + (top-y)*.56, y + (top-y)*.56+.075, frame, depth-.028);
          if (!end && floor === 2) {
            model.panel(f, a-.13, b+.13, top+.08, top+.20, 0x908268, -.12);
          }
        }
        last = b;
      }
      model.panel(f, last, w, y, top, paleStone);
    }
    if (publicFront) {
      const center = w/2, a = center-1.55, b = center+1.55;
      model.quad(f.point(a, 4.97), f.point(b, 4.97), f.point(b, 4.97, -.92), f.point(a, 4.97, -.92), shadow);
      model.panel(f, a, b, 4.83, 4.97, shadow, -.92);
      model.panel(f, a, b, 5.83, 5.92, frame, -.92);
      for (let i = 0; i <= 12; i++) {
        const u = a + (b-a)*i/12;
        model.panel(f, u-.025, u+.025, 4.97, 5.86, frame, -.92);
      }
    }
    model.panel(f, 0, w, 4.53, 4.67, 0x8a7f65, -.06);
    model.panel(f, 0, w, height-.36, height-.16, 0x0a0c0d, -.10);
    model.panel(f, 0, w, height-.16, height, paleStone);
  }
}

// Gehry’s seven-bay limestone screen has four stacked heavy floor bands. The
// upper two levels share double-height recesses and flush glass balustrades.
// The front photograph shows warm-grey limestone, blue-grey panes and lighter
// reflections on the balustrades. The entrance remains in deeper shade.
// https://www.berlin.de/sehenswuerdigkeiten/3561052-3558930-dz-bank-ehemals-dg-bank.html
// https://commons.wikimedia.org/wiki/File:Pariser_Platz_-_DZ_Bank_-_Fassade.jpg
function bank(model: Surface, source: Elevation) {
  const f = wall(source, 2), w = f.width, h = source.height;
  const levels = [[0, .16, 4.44, 4.92], [4.92, 5.10, 8.7, 9.18],
    [9.18, 9.36, 12.78, 13.24], [13.24, 13.40, 19.94, h]];
  const pitch = (w-1.08)/7;
  for (let floor = 0; floor < levels.length; floor++) {
    const [base, sill, top, ceil] = levels[floor];
    model.panel(f, 0, w, base, sill, limestone);
    model.panel(f, 0, w, top, ceil, limestone);
    let last = 0;
    for (let i = 0; i < 7; i++) {
      const centre = .54 + (i+.5)*pitch, a = centre-pitch*.34, b = centre+pitch*.34;
      model.panel(f, last, a, sill, top, limestone);
      opening(model, f, a, b, sill, top, floor === 0 ? 1.45 : .82,
        floor === 0 ? 0x37464a : 0x526a78, 0x8d816d);
      if (floor === 3) {
        model.panel(f, a, b, 16.3, 16.52, 0x626e70, .48);
        model.panel(f, a, b, 16.52, 17.18, 0x95a3a4, .48);
      } else if (floor > 0) {
        model.panel(f, a, b, sill, sill+.64, 0x859294, .32);
      }
      last = b;
    }
    model.panel(f, last, w, sill, top, limestone);
  }
}

// Plan traced on Geoportal Berlin TrueDOP spring 2025, EPSG:25833. The city
// and the roof engineer document a 61 × 20 m triangulated skylight. The bDOM
// sampled crown rises towards the south; glass returns below the LoD2 support
// are unsuitable for assigning individual pane heights. The local mesh pitch
// and pane colours are a display approximation of the triangular steel grid.
// https://www.sbp.de/projekt/glasdach-fuer-die-dz-bank/
// https://gdi.berlin.de/services/wms/dop_2025_fruehjahr (layer dop_2025)
// https://gdi.berlin.de/services/wms/bdom (layer b_bdom, NHN minus 30 m)
const atrium: readonly [number,number,number,number][] = [
  [501.6,362.65,.35,25.25], [501.55,363.4,4.6,25.36], [501.4,366.2,8.15,25.65],
  [502,373,9.5,27.65], [503.1,381.5,9.7,28.25], [504,390,9.7,29.23],
  [504.9,398.6,9.5,30.06], [505.2,407,7.9,30.25], [505.6,413.2,5.7,30.7],
  [506.3,417.7,3.7,31.18], [506.9,420,1.4,31.48],
];

function skylight(model: Surface) {
  const rows = atrium.map(([cx,cz,riseWidth,crown], i) => Array.from({length: 9}, (_, j): Point => {
    const t = (j-4)/4;
    const eave = i < 3 ? 25.16 : 27.15;
    return [cx + t*riseWidth*.996, eave + (crown-eave)*(1-t*t), cz - t*riseWidth*.087];
  }));
  const rib = (a: Point, b: Point, width: number) => {
    const dx = b[0]-a[0], dz = b[2]-a[2], scale = width/(2*Math.hypot(dx,dz));
    const shift = (p: Point, s: number): Point => [p[0]-dz*scale*s, p[1]+.013, p[2]+dx*scale*s];
    model.quad(shift(a,1),shift(b,1),shift(b,-1),shift(a,-1),0x242d31);
  };
  for (let i = 1; i < rows.length; i++) for (let j = 1; j < rows[i].length; j++) {
    const a = rows[i-1][j-1], b = rows[i-1][j], c = rows[i][j], d = rows[i][j-1];
    const tone = j < 4 ? 0x21353e : j === 4 ? 0x2a4249 : 0x384d54;
    model.quad(a,b,c,d,tone);
    rib(a,b,.105); rib(a,d,.105); rib(a,c,.085);
    if (i === rows.length-1) rib(d,c,.105);
    if (j === rows[i].length-1) rib(b,c,.105);
  }
}

function sourceParts(root: Group) {
  const parts = [];
  for (const [id, refs] of Object.entries(capture)) {
    const chunk = root.getObjectByName(`${root.name}: ${id}`);
    const object = chunk?.children.find(o => o instanceof Mesh || o instanceof LineSegments);
    if (!chunk || !(object instanceof Mesh || object instanceof LineSegments)) return;
    const mesh = object instanceof Mesh;
    const index = object.geometry.index, pos = object.geometry.getAttribute("position");
    if (!pos || mesh !== Boolean(index)) return;
    let hash = 2166136261;
    // A source update must not punch out an unrelated face. Check every
    // live vertex and index in all four packets before editing the first.
    for (const refsOfKind of [refs.front, refs.roof]) for (const item of refsOfKind) {
      for (let j = 0; j < (mesh ? 3 : 2); j++) {
        const vertex = mesh ? index!.getX(3*item+j) : 2*item+j;
        for (const n of [vertex, pos.getX(vertex), pos.getY(vertex), pos.getZ(vertex)]) hash = Math.imul(hash^n,16777619);
      }
    }
    if ((hash >>> 0) !== refs.guard) return;
    parts.push({ id, refs, chunk, object, index, pos });
  }
  return parts;
}

/** Public fronts span the 512 m packet seam. The four checked immutable
 * source packets travel together in the resident drawn core, so transfer
 * either the complete set or leave the previous source display in place. */
export function finishPariserNeighboursV374(root: Group): Group {
  if (root.userData.pariserNeighboursV374) return root;
  const parts = sourceParts(root);
  if (!parts) return root;
  const house = new Surface(), bankFace = new Surface(), roof = new Surface();
  sommer(house, summerHouse); bank(bankFace, bankFront); skylight(roof);
  // Transfer the old horizontal cap triangles once, preserving their survey
  // vertices, heights and extent. Their previous brown material made the
  // whole bank read as a single blank roof in oblique views.
  for (const { refs, chunk, index, pos } of parts) for (const item of refs.roof) {
    const ps = [0,1,2].map((j): Point => {
      const v = index!.getX(3*item+j);
      return [chunk.position.x + pos.getX(v)/100, chunk.position.y + pos.getY(v)/100, chunk.position.z + pos.getZ(v)/100];
    });
    const dst = ps[0][0] < 451 ? house : ps[0][1] < 26 ? bankFace : roof;
    dst.quad(ps[0],ps[1],ps[2],ps[2], dst === house ? 0x65675f : 0x747363);
  }
  const meshes = [house.mesh(SOMMER_V374), bankFace.mesh(DZ_FRONT_V374), roof.mesh(DZ_ROOF_V374)];
  const anchor = parts[0].chunk;
  for (const mesh of meshes) {
    mesh.position.sub(anchor.position);
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    anchor.add(mesh);
    const g = mesh.geometry;
    root.userData.geometryBytes += g.getAttribute("position").array.byteLength +
      g.getAttribute("color").array.byteLength + g.index!.array.byteLength;
    root.userData.bufferCount += 3;
  }
  for (const { refs, index, pos } of parts) {
    if (index) {
      for (const list of [refs.front, refs.roof]) for (const i of list) {
        const v = index.getX(i*3);
        index.setX(i*3+1,v); index.setX(i*3+2,v);
      }
      index.needsUpdate = true;
    } else {
      for (const i of refs.front) pos.setXYZ(2*i+1,pos.getX(2*i),pos.getY(2*i),pos.getZ(2*i));
      pos.needsUpdate = true;
    }
  }
  root.userData.pariserNeighboursV374 = true;
  return root;
}
