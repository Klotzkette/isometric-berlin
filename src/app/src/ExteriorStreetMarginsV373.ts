import {
  BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshBasicMaterial, type InstancedMesh,
} from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import survey from "./data/exteriorStreetMarginsV373.json";
import central from "./data/mitteRoadMarginsV376.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { releaseScratchBuffer } from "./releaseScratchBuffer";
import { smoothGroundTopSampler, type VoxelPayload } from "./terrainPayload";

const name = "Surveyed exterior street margins v373";
// Reuse the city's road and paving tones, with finishes for the explicit
// sidewalk material codes in the Berlin 2014/15 survey.
const tones: Readonly<Record<string, number>> = {
  asphalt: 0xc4c5c0, pavers: 0xdcd8cc, lawn: 0xc1cda7, setts: 0xc8c5bd,
  mosaic: 0xd3cfc3, slabs: 0xdad7ce, gravel: 0xc8b99c,
};

function readBuffer(packed: string, size: number): Uint8Array<ArrayBuffer> {
  const zipped = decodeBase64Bytes(packed);
  try {
    if (zipped.byteLength < 18 || new DataView(zipped.buffer, zipped.byteOffset, zipped.byteLength)
        .getUint32(zipped.byteLength - 4, true) !== size) throw Error("Invalid street-margin packet size");
    const raw = new Uint8Array(size);
    const decoded = gunzipSync(zipped, {out:raw});
    if (decoded.byteLength !== size) throw Error("Incomplete street-margin packet");
    return raw;
  } finally {
    releaseScratchBuffer(zipped.buffer);
  }
}

function groundRowsMatch(ground: VoxelPayload): boolean {
  let hash = 2166136261;
  for (const row of ground.ground_rows) {
    hash = Math.imul(hash ^ row.length, 16777619);
    for (const [start, length, kind] of row) {
      hash = Math.imul(hash ^ start, 16777619);
      hash = Math.imul(hash ^ length, 16777619);
      hash = Math.imul(hash ^ kind, 16777619);
    }
  }
  return (hash >>> 0) === survey.groundRowsGuard;
}

/** Fill only surveyed pieces of missing ground outside every existing road.
 * The early opaque pass writes no depth: independent architecture, detail
 * and street surfaces keep priority even if their measured heights differ. */
export function* attachExteriorStreetMarginsV373(slabs: InstancedMesh, ground: VoxelPayload): Generator<void> {
  // The preceding production source check admits the exact terrain heights
  // and vector road polygons. Also require the raster rows used in clipping.
  if (slabs.name !== "Drawn ground slabs" || !slabs.userData.tiergartenPathsV345 ||
      slabs.getObjectByName(name) || !groundRowsMatch(ground)) return;
  const root = new Group();
  root.name = name;
  // Keep the ordinary opaque group order. The paper floor draws first, then
  // the non-depth-writing margin meshes, then the independent city owners.
  slabs.add(root);
  const day = new MeshBasicMaterial({vertexColors: true, depthWrite: false});
  const night = new MeshBasicMaterial({vertexColors: true, color: 0x354253, depthWrite: false});
  const palette = survey.styles.map(style => new Color(tones[style]));
  const sample = smoothGroundTopSampler(ground);
  const {cell_m: cell, grid} = ground;
  let byteBudget = 0;
  const mitte = new Group();
  mitte.name = "Surveyed road margins in Mitte v376";
  root.add(mitte);
  const regions = [[root, survey.chunks], [mitte, central.chunks]] as const;
  for (const [region, chunks] of regions) {
    for (const part of chunks) {
      const xz = new Uint16Array(readBuffer(part.xz, part.vertices*4).buffer);
      const styles = readBuffer(part.style, part.vertices);
      const indices = new Uint16Array(readBuffer(part.index, part.indices*2).buffer);
      const pos = new Float32Array(part.vertices*3), colors = new Uint8Array(part.vertices*3);
      for (let i=0; i<part.vertices; i++) {
        const x = (part.origin[0] + xz[2*i]) / 100;
        const z = (part.origin[1] + xz[2*i+1]) / 100;
        const at = i*3, color = palette[styles[i]];
        pos[at] = x;
        pos[at+1] = sample(x/cell-grid.min_x_idx, z/cell-grid.min_z_idx);
        pos[at+2] = z;
        colors[at] = Math.round(color.r*255);
        colors[at+1] = Math.round(color.g*255);
        colors[at+2] = Math.round(color.b*255);
      }
      releaseScratchBuffer(xz.buffer);
      releaseScratchBuffer(styles.buffer);
      const geometry = new BufferGeometry();
      geometry.setAttribute("position",new BufferAttribute(pos,3));
      geometry.setAttribute("color",new BufferAttribute(colors,3,true));
      geometry.setIndex(new BufferAttribute(indices,1));
      geometry.computeBoundingSphere();
      const mesh = new Mesh(geometry, day);
      mesh.name = `Street margins ${part.origin[0]}:${part.origin[1]}`;
      mesh.renderOrder = -9000;
      mesh.userData.dayMaterial = day;
      mesh.userData.nightMaterial = night;
      region.add(mesh);
      byteBudget += pos.byteLength + colors.byteLength + indices.byteLength;
      if (byteBudget >= 512*1024) {
        byteBudget = 0;
        yield;
      }
    }
  }
}
