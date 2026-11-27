import { expect, test } from "bun:test";
import { BufferAttribute, BufferGeometry, Uint16BufferAttribute, Uint32BufferAttribute } from "three";
import { refineCoreParkReliefSurface } from "../src/parkReliefSurfaceV182";

test("hill refinement preserves outside faces, complete source area and winding", () => {
  const g = new BufferGeometry();
  const p = new Float32Array([1000,0,-3100, 1064,0,-3100, 1000,0,-3036, 0,0,0, 64,0,0, 0,0,64]);
  g.setAttribute("position",new BufferAttribute(p,3)); g.setIndex([0,1,2,3,4,5]);
  const r = refineCoreParkReliefSurface(g), a=r.getAttribute("position"), indices=r.getIndex()!;
  expect(Array.from(a.array.slice(0,p.length))).toEqual(Array.from(p));
  expect(Array.from(indices.array.slice(-3))).toEqual([3,4,5]);
  let area=0;
  for(let i=0;i<indices.count;i+=3){
    const ids=[indices.getX(i),indices.getX(i+1),indices.getX(i+2)];
    const x=ids.map(j=>a.getX(j)),z=ids.map(j=>a.getZ(j));
    const cross=(x[1]-x[0])*(z[2]-z[0])-(z[1]-z[0])*(x[2]-x[0]);
    expect(cross).toBeGreaterThan(0); area+=cross/2;
    if(x[0]>500) for(let j=0;j<3;j++) expect(Math.hypot(x[j]-x[(j+1)%3],z[j]-z[(j+1)%3])).toBeLessThanOrEqual(4.000001);
  }
  expect(area).toBe(4096);expect(a.count).toBeLessThan(1000);
  g.dispose();r.dispose();
});

test("midpoint rounding, shared edges, longest-edge ties and chunk boundaries preserve the original bytes", () => {
  const source = new BufferGeometry();
  source.setAttribute("position", new BufferAttribute(new Float32Array([
    0, 0, 0, 2, 0, 0, 0, 0, 2,
    1000.125, 0.20000003, -3100.5, 1000.125, 2.30000019, -3070.5,
    1032.125, 4.70000029, -3085.5, 968.125, -1.90000013, -3085.5,
  ]), 3));
  const faces = [0, 1, 2];
  for (let i = 0; i < 120; i++) faces.push(3, 4, 5, 4, 3, 6);
  faces.push(2, 1, 0);
  source.setIndex(faces);
  const result = refineCoreParkReliefSurface(source);
  const digest = (a: ArrayBufferView) => new Bun.CryptoHasher("sha256")
    .update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)).digest("hex");
  // Independent baseline from the preceding release's number-array subdivision.
  expect(digest(result.getAttribute("position").array)).toBe("43f873b17009f7ff7049e2bc3ead5bd467f576abbddd5e53c2488c8a73b854e9");
  expect(digest(result.getIndex()!.array)).toBe("342b4efdf1c05b00aa1c531a2f066994d6a76e28232692a727df3cec70ed313f");
  expect(result.getIndex()!.count).toBe(138246);
});

test("index width accounts for WebGL's reserved primitive-restart index", () => {
  for (const vertices of [65534, 65535]) {
    const source = new BufferGeometry();
    const points = new Float32Array(vertices * 3);
    points.set([1000, 0, -3100, 1005, 0, -3100, 1002.5, 0, -3099]);
    source.setAttribute("position", new BufferAttribute(points, 3));
    source.setIndex([0, 1, 2]);
    const result = refineCoreParkReliefSurface(source);
    expect(result.index).toBeInstanceOf(vertices === 65535 ? Uint32BufferAttribute : Uint16BufferAttribute);
    expect(result.getAttribute("position").count).toBe(vertices + 1);
    expect(Array.from(result.index!.array)).toEqual([vertices, 1, 2, 0, vertices, 2]);
  }
});
