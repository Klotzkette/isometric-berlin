import { applyNikolaiSettFinish } from "./nikolaiSettFinish";
import { Uint8BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial } from "three";
import survey from "./data/nikolaikirchplatzV367.json";

const palette: Record<string, number> = {
  apron: 0x9c978a, kerb: 0xbab6ac, garden: 0x82936b, square: 0xada9a0, "08": 0xc6c2b6, slab: 0xbdb9ae,
  "04": 0xa7a49b, "05": 0x8f8d86, "13": 0xb3a593, seat: 0x726650, frame: 0x494b48,
};
const PLAZA_Y = 3; // Resident host 4_0 terrain plane, shared with the fountain and navigation.

// Local centimetres and quarter-metre runs fit signed 16-bit words.
// Decode only the projection currently on screen.
function decodeDeltaRows(deltas: number[], stride: number): Int16Array {
  const values = Int16Array.from(deltas);
  for (let i = stride; i < values.length; i++) values[i] += values[i-stride];
  return values;
}

/** One bounded batch for the measured pedestrian square and surrounding alley surfaces. */
export function createNikolaikirchplatzV367(native: boolean): Mesh {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const settSizes: number[] = [];
  let settSize = 0;
  const tint = new Color();
  function vertex(x: number, y: number, z: number) {
    if (!native) settSizes.push(settSize);
    positions.push(x, y, z);
    colors.push(tint.r, tint.g, tint.b);
  }
  function rectangle(x: number, z: number, width: number, depth: number) {
    return [[x,z],[x,z+depth],[x+width,z+depth],[x+width,z]];
  }
  function prism(ring: number[][], top: number, bottom?: number) {
    const start = positions.length / 3;
    for (const [x,z] of ring) vertex(x,top,z);
    indices.push(start,start+1,start+2,start,start+2,start+3);
    if (bottom === undefined) return;
    for (const [x,z] of ring) vertex(x,bottom,z);
    for (let i=0; i<4; i++) {
      const a=start+i, b=start+(i+1)%4;
      indices.push(a,a+4,b, b,a+4,b+4);
    }
  }

  for (const surface of survey.surfaces) {
    settSize = surface.material === "05" ? 2 : Number(surface.material === "04" || surface.material === "square");
    tint.setHex(palette[surface.material]);
    // The resident 4_0 road cap is at +.12 m in both projections. The polygon
    // finish must stay above it even on a shallow view along the square.
    const top = surface.material === "kerb" ? .165 : .145;
    if (native) {
      const runs = decodeDeltaRows(surface.runs,4);
      for (let i=0; i<runs.length; i+=4) {
        prism(rectangle(runs[i]/4,runs[i+1]/4,runs[i+2]/4,runs[i+3]/4),top);
      }
    } else {
      const start = positions.length / 3;
      const points = decodeDeltaRows(surface.points,2);
      for (let i=0; i<points.length; i+=2) vertex(points[i]/100,top,points[i+1]/100);
      for (const i of decodeDeltaRows(surface.indices,1)) indices.push(start+i);
    }
  }
  settSize = 0;
  for (const part of survey.furniture) {
    tint.setHex(palette[part.material]);
    const seat = part.material === "seat", bottom = seat ? .52 : .145, top = seat ? .58 : .52;
    if (native) {
      for (const [x,z,w] of part.runs) prism(rectangle(x/20,z/20,w/20,.05),top,bottom);
    } else {
      prism(part.points.map(([x,z]) => [x/100,z/100]),top,bottom);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position",new Float32BufferAttribute(positions,3));
  geometry.setAttribute("color",new Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const night = new MeshBasicMaterial({vertexColors:true,color:0x505862,side:DoubleSide});
  if (!native) {
    geometry.setAttribute("settSize", new Uint8BufferAttribute(settSizes, 1));
    applyNikolaiSettFinish(day);
    applyNikolaiSettFinish(night);
  }
  const mesh = new Mesh(geometry,day);
  mesh.position.set(survey.origin[0],PLAZA_Y,survey.origin[1]);
  mesh.name = "Nikolaikirchplatz — Brunnenplatz, Propststraße, Eiergasse";
  mesh.userData = {dayMaterial:day,nightMaterial:night,source:"ci_oeffentlicher_platz.1207",
    fullStaticDetailOnTouch:true,blockNative:native,keepInMinecraft:native,textureFree:true,staticAntiFlicker:true};
  return mesh;
}
