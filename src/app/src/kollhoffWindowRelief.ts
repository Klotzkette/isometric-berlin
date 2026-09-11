import { BufferGeometry, Color, Float32BufferAttribute } from "three";

/** One shared window prototype for the existing Kollhoff opening instances.
 * X/Y remain normalized to the previously authored pane dimensions; Z is metres
 * towards the street. The architect documents deep clinker piers, while these
 * local 0.18 m returns are display relief, not a new opening/depth survey.
 */
export function createKollhoffWindowRelief(): BufferGeometry {
  const positions: number[] = [], colors: number[] = [];
  const glass = new Color(0x718189), brick = new Color(0x875e4c);
  const reveal = new Color(0x654c40), sill = new Color(0xa88767);
  type Point = readonly [number, number, number];
  const quad = (a: Point, b: Point, c: Point, d: Point, tone: Color) => {
    for (const p of [a, b, c, a, c, d]) {
      positions.push(...p); colors.push(tone.r, tone.g, tone.b);
    }
  };
  quad([-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0],glass);
  // The pane stays unchanged. Returns and narrow outer clinker faces sit
  // outside its perimeter, rather than covering it with a second window grid.
  const inner: Point[] = [[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]];
  const lip: Point[] = [[-.59,-.545,.18],[.59,-.545,.18],[.59,.545,.18],[-.59,.545,.18]];
  const outer: Point[] = [[-.64,-.58,.18],[.64,-.58,.18],[.64,.58,.18],[-.64,.58,.18]];
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    quad(inner[next],inner[i],lip[i],lip[next],i === 0 ? sill : reveal);
    quad(lip[next],lip[i],outer[i],outer[next],i === 0 ? sill : brick);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
