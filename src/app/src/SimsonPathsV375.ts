import { BufferAttribute, BufferGeometry, Color, DoubleSide, LinearSRGBColorSpace, Mesh, MeshBasicMaterial } from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import survey from "./data/simsonPathsV375.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { applyGateStoneFinishV374 } from "./GateForecourtsV374";

export const SIMSON_PATHS_V375 = "Surveyed Simsonweg and Tiergarten junctions v375";

function words(encoded: string): Uint16Array {
  const bytes = gunzipSync(decodeBase64Bytes(encoded));
  return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}

/** A single persistent Drawn ground mesh up to the exact boundary of the previous forecourt. */
export function createSimsonPathsV375(terrainAt: (x:number,z:number)=>number): Mesh {
  const vertices = words(survey.vertices);
  const xyz = new Float32Array(vertices.length);
  const rgb = new Uint8Array(vertices.length);
  const sizes = new Float32Array(vertices.length / 3);
  // The mosaic uses the precise v374 swatch and joint finish at the common
  // edge. Water-bound aggregate has a slightly warmer, softer unjointed face.
  const palette = [
    new Color().setHex(0xb3aea8, LinearSRGBColorSpace),
    new Color().setHex(0xbab2a5, LinearSRGBColorSpace),
    new Color(0x88765d), new Color().setHex(0xb0a99e, LinearSRGBColorSpace),
    new Color(0xa9c592),
  ];
  for (let at = 0; at < vertices.length; at += 3) {
    const x = vertices[at]/100, z = vertices[at+1]/100, style = vertices[at+2];
    const color = palette[style];
    xyz[at] = x;
    xyz[at+1] = terrainAt(x,z) + (style === 2 ? .29 : .32);
    xyz[at+2] = z;
    rgb[at] = Math.round(color.r * 255);
    rgb[at+1] = Math.round(color.g * 255);
    rgb[at+2] = Math.round(color.b * 255);
    sizes[at/3] = style === 0 ? .15 : style === 3 ? .19 : 0;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(xyz,3));
  geometry.setAttribute("color", new BufferAttribute(rgb,3,true));
  geometry.setAttribute("forecourtStone", new BufferAttribute(sizes,1));
  geometry.setIndex(new BufferAttribute(words(survey.indices),1));
  geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const night = new MeshBasicMaterial({vertexColors:true,side:DoubleSide,color:0x4d5666});
  applyGateStoneFinishV374(day);
  applyGateStoneFinishV374(night);
  const mesh = new Mesh(geometry,day);
  mesh.name = SIMSON_PATHS_V375;
  mesh.userData.dayMaterial = day;
  mesh.userData.nightMaterial = night;
  return mesh;
}
