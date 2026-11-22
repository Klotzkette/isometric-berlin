import { BufferAttribute, BufferGeometry, Color, DoubleSide, LinearSRGBColorSpace, Mesh, MeshBasicMaterial } from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import gardenLayout from "./data/gateGardenFurnitureV374.json";
import survey from "./data/gateForecourtsV374.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import type { VoxelPayload } from "./terrainPayload";

type Point = [number, number];
type SourceIndices = Uint16Array | Uint32Array;
type Style = keyof typeof survey.district;

export const GATE_FORECOURTS_V374 = "Surveyed Platz des 18. März and Pariser Platz v374";
// These display swatches represent the WFS material differences seen in the
// Berlin 2026 orthophoto. The light car-accessible stone east of the Gate has
// its own material; it must not take on the asphalt of Ebertstraße to the west.
// The drawn pass writes the normalized vertex bytes directly to the final
// picture. These are daylight byte values from the 2026 orthophoto, including
// its slight warm-grey difference between the mosaic wings and central stone.
const swatches: Record<string, number> = {
  asphalt: 0x787578, footway: 0xcdcbc6, stoneRoad: 0xc7c4bd, mosaic: 0xb3aea8,
  median: 0xbdb7af, plaza: 0xc3c1ba, cycle: 0xada7a2, grass: 0x8ea17a,
  tactile: 0xd4d1c8, plantedVerge: 0x8c997e,
  gardenStone: 0xbabbb4, flowerSoil: 0x826e5c, earth: 0x877a69,
  kerb: 0xbcbab1, flushKerb: 0xc2bfb6, downstand: 0x9d9c96,
};
const retainedVegetation = new Set(["grass","flowerSoil","earth","plantedVerge"]);
// The local DGM is the same height reference as the district streets. The
// exposed original raster tops lie up to 24 cm above that surface locally.
const levels: Record<string, number> = {
  asphalt: .26, footway: .32, stoneRoad: .26, mosaic: .32, median: .32,
  tactile: .325, plantedVerge: .28, gardenStone: .36, flowerSoil: .34, plaza: .32, cycle: .32, grass: .28, earth: .26, kerb: .39, flushKerb: .325, downstand: .255,
};

function unpack(text: string): ArrayBuffer {
  const bytes = gunzipSync(decodeBase64Bytes(text));
  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer as ArrayBuffer : bytes.slice().buffer as ArrayBuffer;
}

export function gateSurveyAdmitsV374(ground: VoxelPayload): boolean {
  const grid = ground.grid, h = ground.ground_height;
  if (ground.cell_m !== 4 || grid.min_x_idx !== -975 || grid.min_z_idx !== -905 ||
      grid.cols !== 1578 || grid.rows !== 1633 || h.stride_cells !== 4) return false;
  const [minX, minZ, cols, rows, expected] = survey.groundGuard;
  let hash = 2166136261;
  for (let z = minZ; z < minZ + rows; z++) for (let x = minX; x < minX + cols; x++) {
    hash = Math.imul(hash ^ h.y_dm[z*h.cols + x], 16777619);
  }
  return (hash >>> 0) === expected;
}

function stoneFinish(material: MeshBasicMaterial): void {
  // Quiet, subpixel-filtered joints only in resolved stone areas. Their
  // dimensions and laying pattern are a presentation detail, not survey data.
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `
      #include <common>
      attribute float forecourtStone;
      varying vec2 forecourtXZ;
      varying float stoneSize;
    `).replace("#include <begin_vertex>", `
      #include <begin_vertex>
      forecourtXZ = mat2(.9962,.087,-.087,.9962) * position.xz;
      stoneSize = forecourtStone;
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `
      #include <common>
      varying vec2 forecourtXZ;
      varying float stoneSize;
    `).replace("#include <color_fragment>", `
      #include <color_fragment>
      if (stoneSize > .1) {
        vec2 p = forecourtXZ / vec2(stoneSize, stoneSize * .63);
        vec2 width = max(fwidth(p), vec2(.002));
        p.x += .5 * mod(floor(p.y), 2.);
        vec2 distanceToEdge = .5 - abs(fract(p) - .5);
        vec2 interior = smoothstep(vec2(.012) - width, vec2(.018) + width, distanceToEdge);
        float coverage = (1. - min(interior.x,interior.y)) * (1. - smoothstep(.18,.85,max(width.x,width.y)));
        diffuseColor.rgb *= 1. - .15 * coverage;
      }
    `);
  };
  material.customProgramCacheKey = () => "surveyed-gate-stone-v374";
}

export function createGateForecourtsV374(height: (x: number,z: number) => number): Mesh {
  const verts = new Uint16Array(unpack(survey.vertices)), index = new Uint16Array(unpack(survey.indices));
  const styles = [...survey.styles, "downstand"];
  const colors = styles.map(key => retainedVegetation.has(key)
    ? new Color(swatches[key]) : new Color().setHex(swatches[key],LinearSRGBColorSpace));
  const oldAsphalt = new Color(0x858d89);
  const positions = new Float32Array(verts.length), rgb = new Uint8Array(verts.length);
  const detail = new Float32Array(verts.length/3);
  for (let at = 0; at < verts.length; at += 3) {
    const x = 292 + verts[at]/100, z = 220 + verts[at+1]/100;
    const kind = verts[at+2], color = colors[kind], style = styles[kind];
    positions[at] = x; positions[at+1] = height(x,z) + levels[style]; positions[at+2] = z;
    // At the four clipped approach ends, blend into the existing city-road
    // colour so a measured continuation does not gain a straight dark seam.
    const join = style === "asphalt" ? Math.max(0,1-Math.min(x-292,560-x,z-220,379-z)/14) : 0;
    rgb[at] = Math.round((color.r+(oldAsphalt.r-color.r)*join)*255);
    rgb[at+1] = Math.round((color.g+(oldAsphalt.g-color.g)*join)*255);
    rgb[at+2] = Math.round((color.b+(oldAsphalt.b-color.b)*join)*255);
    detail[at/3] = style === "mosaic" || style === "cycle" ? .15 : style === "footway" ? .56 :
      style === "stoneRoad" || style === "plaza" || style === "median" ? .26 : 0;
  }
  const geom = new BufferGeometry();
  geom.setAttribute("position", new BufferAttribute(positions,3));
  geom.setAttribute("color", new BufferAttribute(rgb,3,true));
  geom.setAttribute("forecourtStone", new BufferAttribute(detail,1));
  geom.setIndex(new BufferAttribute(index,1));
  geom.computeBoundingSphere();
  const day = new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const night = new MeshBasicMaterial({vertexColors:true,color:0x4d5666,side:DoubleSide});
  stoneFinish(day); stoneFinish(night);
  const mesh = new Mesh(geom,day);
  mesh.name = GATE_FORECOURTS_V374;
  mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night;
  return mesh;
}

export function gateRemovedFacesV374(kind: Style): Uint32Array {
  return new Uint32Array(unpack(survey.district[kind].removed));
}

/** Retain the exact old plane on every triangle crossing a measured edge.
 * All untouched vertices remain byte-identical in their original material. */
export function retainGateDistrictEdgesV374(kind: Style, positions: Float32Array, indices: SourceIndices):
  [Float32Array, SourceIndices] {
  const fragments = new Int32Array(unpack(survey.district[kind].fragments));
  if (!fragments.length) return [positions,indices];
  const count = fragments.length/9*3, base = positions.length/3;
  const verts = new Float32Array(positions.length + count*3);
  verts.set(positions);
  const Index = indices instanceof Uint32Array || base+count >= 65535 ? Uint32Array : Uint16Array;
  const next = new Index(indices.length + count);
  next.set(indices);
  let v = base, word = indices.length;
  for (let at = 0; at < fragments.length; at += 9) {
    const a=3*fragments[at], b=3*fragments[at+1], c=3*fragments[at+2];
    const ax=positions[a], az=positions[a+2], bx=positions[b]-ax, bz=positions[b+2]-az;
    const cx=positions[c]-ax, cz=positions[c+2]-az, det=bx*cz-cx*bz;
    for (let i = at+3; i < at+9; i += 2) {
      const x=fragments[i]/100, z=fragments[i+1]/100;
      const u=((x-ax)*cz-(z-az)*cx)/det, w=(bx*(z-az)-bz*(x-ax))/det;
      verts[3*v]=x; verts[3*v+1]=positions[a+1]+u*(positions[b+1]-positions[a+1])+w*(positions[c+1]-positions[a+1]);
      verts[3*v+2]=z; next[word++]=v++;
    }
  }
  return [verts,next];
}

export function gateDistrictKerbsV374(): Map<number,Point[][]> {
  return new Map(survey.kerbReplacements as Array<[number,Point[][]]>);
}

/** Limit the separately drawn fine summer blades to the inside of the
 * rounded grass border, leaving room for the measured edge and flowers. */
export function gateGardenLawnV374(x: number, z: number, garden: number): boolean {
  const outline = gardenLayout[garden].rail;
  let inside = false;
  for (let i = 1; i < outline.length; i++) {
    const [ax,,az] = outline[i-1], [bx,,bz] = outline[i];
    if ((az > z) !== (bz > z) && x < ax + (bx-ax)*(z-az)/(bz-az)) inside = !inside;
    const dx = bx-ax, dz = bz-az, len = dx*dx+dz*dz;
    const t = len ? Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/len)) : 0;
    if ((x-ax-t*dx)**2+(z-az-t*dz)**2 < 1.32**2) return false;
  }
  return inside;
}

export function gateGroundInkV374(ground: VoxelPayload): readonly number[] {
  return gateSurveyAdmitsV374(ground) ? survey.rasterInk : [];
}

export function keepGateLaneMarkingsV374(output: number[], excluded: ReadonlySet<number>, height: (x:number,z:number)=>number) {
  for (const [id,ax,az,bx,bz] of survey.laneMarks) {
    if (!excluded.has(id)) output.push(ax/100,height(ax/100,az/100)+.285,az/100,bx/100,height(bx/100,bz/100)+.285,bz/100);
  }
}

export { stoneFinish as applyGateStoneFinishV374 };
