import { BufferAttribute, BufferGeometry, Color, LinearSRGBColorSpace, Mesh, MeshBasicMaterial } from "three";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import survey from "./data/invalidenParkGroundV371.json";

const finishes: Readonly<Record<string, number>> = {
  granite: 0xadaaa2,
  coping: 0xbab7ae,
  gravel: 0xafa697,
  underplanting: 0x6e805e,
  lawn: 0x809569,
};

/** One ground surface around the existing basin. The granite ribbons, gravel
 * and grass share their edges so they keep their shape at city and foot level. */
export function createInvalidenParkGroundV371(groundY: (x: number, z: number) => number): Mesh {
  const xz = new Int16Array(decodeBase64Bytes(survey.xzCm).buffer);
  const triangles = new Uint16Array(decodeBase64Bytes(survey.indices).buffer);
  const positions = new Float32Array(xz.length / 2 * 3);
  const colors = new Float32Array(positions.length);
  let vertex = 0;
  for (const { material, endVertex } of survey.groups) {
    // The drawn compositor presents ground vertex values directly. These are
    // display swatches, including the lawn bordering the original city mesh.
    const color = new Color().setHex(finishes[material], LinearSRGBColorSpace);
    for (; vertex < endVertex; vertex++) {
      const x = survey.origin[0] + xz[2 * vertex] / 100;
      const z = survey.origin[1] + xz[2 * vertex + 1] / 100;
      positions[3 * vertex] = x;
      positions[3 * vertex + 1] = groundY(x, z) + 0.10;
      positions[3 * vertex + 2] = z;
      color.toArray(colors, 3 * vertex);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(new BufferAttribute(triangles, 1));
  const day = new MeshBasicMaterial({ vertexColors: true });
  const night = new MeshBasicMaterial({ color: 0x555f70, vertexColors: true });
  const mesh = new Mesh(geometry, day);
  mesh.name = "Invalidenpark granite ribbons and lawn v371";
  mesh.userData.dayMaterial = day;
  mesh.userData.nightMaterial = night;
  return mesh;
}
