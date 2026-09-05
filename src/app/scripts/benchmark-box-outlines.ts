/** Compare contour construction only; identical input buffers in both paths. */
import { BoxGeometry, BufferGeometry, EdgesGeometry } from "three";
import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "../src/architecturalInk";
import { boxOutlineGeometry } from "../src/drawnKit";

const boxes = Array.from({ length: 8_000 }, (_, i) => {
  const box = new BoxGeometry(0.1 + i % 9, 0.2 + i % 16, 0.04 + (i % 4) / 10);
  box.rotateY(i * 0.0783);
  box.translate(4_200 - (i % 600) * 11.3, i % 100, -3_500 + (i % 500) * 12.1);
  return box;
});
const legacy = (box: BufferGeometry): BufferGeometry =>
  new EdgesGeometry(box, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES);

function digest(build: typeof legacy): string {
  const hash = new Bun.CryptoHasher("sha256");
  for (const box of boxes) {
    const edges = build(box);
    hash.update(edges.getAttribute("position").array);
    edges.dispose();
  }
  return hash.digest("hex");
}

function timed(build: typeof legacy): number {
  const start = performance.now();
  for (const box of boxes) build(box).dispose();
  return performance.now() - start;
}

const referenceHash = digest(legacy);
const outputHash = digest(boxOutlineGeometry);
if (referenceHash !== outputHash) throw new Error("Contour bytes changed");
const before: number[] = [], after: number[] = [];
for (let i = 0; i < 7; i += 1) {
  // Alternate order to avoid consistently giving one path a warmer heap.
  if (i % 2 === 0) {
    before.push(timed(legacy));
    after.push(timed(boxOutlineGeometry));
  } else {
    after.push(timed(boxOutlineGeometry));
    before.push(timed(legacy));
  }
}
before.sort((a, b) => a - b);
after.sort((a, b) => a - b);
console.log(JSON.stringify({
  boxes: boxes.length,
  legacy_median_ms: Number(before[3].toFixed(2)),
  template_median_ms: Number(after[3].toFixed(2)),
  speedup: Number((before[3] / after[3]).toFixed(2)),
  output_sha256: outputHash,
  byte_identical: true,
}, null, 2));
for (const box of boxes) box.dispose();
