import { BufferAttribute, BufferGeometry, Color, LinearSRGBColorSpace, Mesh, MeshBasicMaterial } from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { invalidenBoundsV371 } from "./invalidenBoundsV371";
import survey from "./data/invalidenGroundV371.json";

const finishes: Readonly<Record<string, number>> = {
  urban: 0xa49f91, earth: 0x9a8972, lawn: 0x809569, planting: 0x708360,
  sand: 0xc8b99c, gravel: 0xb5a994, asphalt: 0x646966, setts: 0x96918a,
  mosaic: 0xaba79c, pavers: 0xb2aea2, slabs: 0xbcb9b0, trackbed: 0x777873,
  platform: 0xaaa79f, kerb: 0xb9b5aa,
};

// Local positions and triangle indices are delta-coded by component in the bake.
function decodeWords(encoded: string, count: number, stride: number): Uint16Array {
  const words = new Uint16Array(count * stride);
  const size = words.length;
  const planes = gunzipSync(decodeBase64Bytes(encoded), {out: new Uint8Array(size * 2)});
  for (let c = 0; c < stride; c++) {
    let value = 0;
    for (let i = 0; i < count; i++) {
      const k = c * count + i;
      value = (value + planes[k] + (planes[size + k] << 8)) & 65535;
      words[i * stride + c] = value;
    }
  }
  return words;
}

/** Contiguous surveyed edges, including courtyard paths and narrow kerb heads.
 * Water, the park and its sculpture have separate source owners. */
export function createInvalidenGroundV371(groundY: (x: number, z: number) => number): Mesh {
  const groups = survey.groups.map(({material, vertices, indexCount, xz, indices}) => ({
    material,
    xz: decodeWords(xz, vertices, 2),
    triangles: decodeWords(indices, indexCount, 1),
  }));
  const vertexCount = groups.reduce((n, group) => n + group.xz.length / 2, 0);
  const indexCount = groups.reduce((n, group) => n + group.triangles.length, 0);
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Uint8Array(vertexCount * 3);
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  let vertex = 0, index = 0;
  for (const {material, xz, triangles} of groups) {
    const first = vertex;
    // The drawn compositor presents ground vertex values directly. These are
    // display swatches, including the lawn bordering the original city mesh.
    const color = new Color().setHex(finishes[material], LinearSRGBColorSpace);
    const red = Math.round(color.r * 255), green = Math.round(color.g * 255), blue = Math.round(color.b * 255);
    const lift = material === "kerb" ? .14 : .10;
    for (let i = 0; i < xz.length; i += 2, vertex++) {
      const x = invalidenBoundsV371[0] + xz[i] / survey.unitsPerMetre;
      const z = invalidenBoundsV371[1] + xz[i + 1] / survey.unitsPerMetre;
      const offset = 3 * vertex;
      positions[offset] = x;
      positions[offset + 1] = groundY(x, z) + lift;
      positions[offset + 2] = z;
      colors[offset] = red;
      colors[offset + 1] = green;
      colors[offset + 2] = blue;
    }
    for (const localIndex of triangles) indices[index++] = first + localIndex;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3, true));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({vertexColors: true});
  const night = new MeshBasicMaterial({vertexColors: true, color: 0x555f70});
  const mesh = new Mesh(geometry, day);
  mesh.name = "Invalidenstraße, Charité and Hannoversche Straße surveyed ground v371";
  mesh.userData.dayMaterial = day;
  mesh.userData.nightMaterial = night;
  return mesh;
}
