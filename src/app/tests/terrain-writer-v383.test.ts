import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Color, Vector3 } from "three";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import { CLASS_SHADES, createGroundSlabs, instancedBoxes, type VoxelPayload } from "../src/terrainPayload";

test("the complete surveyed ground keeps all 172,339 instance matrices and colours bit-for-bit", () => {
  // Fingerprint of both live GPU attributes from v262's createGroundSlabs.
  const mesh = createGroundSlabs(ground as unknown as VoxelPayload, "Drawn ground slabs", CLASS_SHADES, {bridgeDecks:true});
  expect(mesh.count).toBe(172339);
  expect(createHash("sha256").update(mesh.instanceMatrix.array).update(mesh.instanceColor!.array).digest("hex"))
    .toBe("7974f43b870ea49f6ec03f11ebc346591999075d356551ac54179fd4c6b9a25f");
});

test("axis-aligned writing resets a rotated slot and preserves signs, colours and later updates", () => {
  const direct = instancedBoxes("direct", 3, 0, true);
  const standard = instancedBoxes("standard", 3, 0, false);
  function compare() {
    const words = (array: ArrayBufferView) => new Uint32Array(array.buffer,array.byteOffset,array.byteLength/4);
    expect(direct.mesh.count).toBe(standard.mesh.count);
    for(const key of ["instanceMatrix","instanceColor"] as const)
      expect(words(direct.mesh[key]!.array)).toEqual(words(standard.mesh[key]!.array));
  }
  const centre = new Vector3(-0,2.175,-47.15);
  const size = new Vector3(4,3,4);
  const paint = new Color().setRGB(-0,.4,.991);
  function write(rotation:number) { for(const w of [standard,direct]) w.write(centre,size,paint,rotation); }
  write(-0); write(Math.PI*.3); write(-Math.PI*.78);
  compare();
  for(const w of [standard,direct]) w.mesh.count=1;
  size.set(-0, 4.3, -2.125); centre.set(-4.3, -0, 2.4); paint.setRGB(1.2,-0,.123);
  write(0); write(Math.PI/4);
  compare();
  // Three lazily recreates a removed colour attribute for further writes.
  for(const w of [standard,direct]) { w.mesh.instanceColor=null; w.mesh.count=2; }
  write(-0);
  compare();
});
