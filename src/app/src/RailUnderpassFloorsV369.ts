import { BufferGeometry, Float32BufferAttribute, Mesh, type Material } from "three";
import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";
import floors from "./data/railUnderpassFloorsV369.json";

type Piece = [height: number, colourVertex: number, xz: number[]];
type Cut = [indexOffset: number, a: number, b: number, c: number, pieces: Piece[]];
type Floors = Record<string, Partial<Record<"drawn" | "minecraft", Cut[]>>>;

/** The source city was partitioned with the rail colour taking precedence.
 * Restore its clipped street triangles at the neighbouring street height.
 * A water cut exposes the exact river surface already present underneath. */
export function restoreRailUnderpassFloorV369(entry: SurroundingChunkGeometry, id: string, native: boolean) {
  const cuts = (floors as unknown as Floors)[id]?.[native ? "minecraft" : "drawn"];
  if (!cuts) return;
  const body = entry.root.children.find((object): object is Mesh<BufferGeometry> =>
    object instanceof Mesh && object.name.endsWith(" mapped surfaces and massing"));
  const index = body?.geometry.index;
  if (!body || !index) return;
  const position = body.geometry.getAttribute("position");
  const colour = body.geometry.getAttribute("color");
  const vertices: number[] = [], colours: number[] = [];
  for (const [offset, a, b, c, pieces] of cuts) {
    // A superseding building, street or navigation correction can already
    // have consumed the face. Touch only the original indexed rail triangle.
    if (index.getX(offset) !== a || index.getX(offset + 1) !== b || index.getX(offset + 2) !== c ||
        ![a, b, c].every(i => Math.abs(position.getY(i) * .01 + entry.origin[1] - 3.15) < .001)) continue;
    index.setX(offset + 1, a);
    index.setX(offset + 2, a);
    for (const [y, pigment, points] of pieces) {
      const rgb = [colour.getX(pigment), colour.getY(pigment), colour.getZ(pigment)];
      for (let start = 0; start < points.length; start += 6) {
        const [x0, z0, x1, z1, x2, z2] = points.slice(start, start + 6);
        const reversed = (x1-x0)*(z2-z0) - (z1-z0)*(x2-x0) > 0;
        // Use the parent's centimetre units for its ground finish materials.
        const h = (y - entry.origin[1]) * 100;
        vertices.push(x0*100, h, z0*100, (reversed?x2:x1)*100, h, (reversed?z2:z1)*100,
          (reversed?x1:x2)*100, h, (reversed?z1:z2)*100);
        colours.push(...rgb, ...rgb, ...rgb);
      }
    }
  }
  index.needsUpdate = true;
  if (!vertices.length) return;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const day: Material = body.userData.dayMaterial, night: Material = body.userData.nightMaterial;
  const mesh = new Mesh(geometry, native ? night : day);
  mesh.name = "Street surfaces beneath elevated rail v369";
  mesh.userData = { dayMaterial: day, nightMaterial: night, keepInMinecraft: native };
  mesh.matrixAutoUpdate = false;
  body.add(mesh);
  for (const attr of Object.values(geometry.attributes)) {
    entry.geometryBytes += attr.array.byteLength;
    entry.bufferCount++;
  }
}
