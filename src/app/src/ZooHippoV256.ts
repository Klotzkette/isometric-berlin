import data from "./data/zooHippoV256Source.json";
import type { ZooRecognitionV255Sink } from "./ZooRecognitionV255";

type P = [number, number, number];

/** Flush decorative grid on complete retained source sheets, not a new shell. */
export function appendZooHippoV256(d: ZooRecognitionV255Sink): void {
  if (d.native) {
    for (const [x, y, z, w, h, depth] of data.nativeRoofBars)
      d.box(data.frameColor, x, y, z, w, h, depth);
    for (const [x, y, z, w, h, depth] of data.nativePosts)
      d.box(data.frameColor, x, y, z, w, h, depth);
    return;
  }
  // A surface strip, like the retained facade trim, keeps the full published
  // grid scale without thousands of hidden solid members. Double-sided in the
  // existing surface batch; endpoints follow each measured roof-plane break.
  const strip = (segment: number[][], width: number, color: number): void => {
    const [a, b] = segment;
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (length < 1e-5) return;
    const nx = -(b[2] - a[2]) / length * width / 2;
    const nz = (b[0] - a[0]) / length * width / 2;
    d.face(color, [
      [a[0] + nx, a[1], a[2] + nz],
      [b[0] + nx, b[1], b[2] + nz],
      [b[0] - nx, b[1], b[2] - nz],
      [a[0] - nx, a[1], a[2] - nz],
    ] as P[]);
  };
  for (const segment of data.ribs) strip(segment, .06, data.frameColor);
  for (const segment of data.edges) strip(segment, .13, data.edgeColor);
  for (const [x, y, z, w, h, depth] of data.posts)
    d.box(data.frameColor, x, y, z, w, h, depth);
}
