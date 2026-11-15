import { expect, test } from "bun:test";
import { LineSegments, Material } from "three";
import { createA10TransportV347 } from "../src/A10TransportV347";
import source from "../src/data/a10TransportV347.json";
import { decodeLosslessGzipJson } from "../src/losslessGzipBase85";

function dispose(root: ReturnType<typeof createA10TransportV347>): void {
  for (const object of root.children) {
    const line = object as LineSegments;
    line.geometry.dispose();
    for (const material of new Set([line.material,line.userData.dayMaterial,line.userData.nightMaterial])) {
      if (material instanceof Material) material.dispose();
    }
  }
}

test("bounded A10 groups preserve each exact centimetre source in both cartographic families", () => {
  for (const native of [false,true]) {
    const root = createA10TransportV347(native);
    expect(root.children.length).toBe(23);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.blockNative).toBe(native);
    let bytes = 0;
    for (let i=0;i<root.children.length;i++) {
      const line = root.children[i] as LineSegments;
      expect(line).toBeInstanceOf(LineSegments);
      expect(line.matrixAutoUpdate).toBe(false);
      expect(line.frustumCulled).toBe(true);
      expect(line.geometry.getAttribute("uv")).toBeUndefined();
      const decoded = decodeLosslessGzipJson(source.groups[i].gzipBase85,2*1024*1024) as {positionsCm:string;colorsU8:string};
      const expected = Buffer.from(decoded.positionsCm,"base64");
      const actual = line.geometry.getAttribute("position");
      expect(actual.array.length*4).toBe(expected.byteLength);
      for(let n=0;n<actual.array.length;n++) expect(Math.abs(actual.array[n]-expected.readInt32LE(n*4)/100)).toBeLessThan(.004);
      expect(Array.from(line.geometry.getAttribute("color").array)).toEqual(Array.from(Buffer.from(decoded.colorsU8,"base64")));
      for(const attribute of Object.values(line.geometry.attributes)) bytes+=attribute.array.byteLength;
      expect(line.userData.dayMaterial).not.toBe(line.userData.nightMaterial);
      expect(line.userData.cartographicTransport).toBe(true);
    }
    expect(bytes).toBeLessThan(900_000);
    dispose(root);
    const recreated=createA10TransportV347(native);
    expect((recreated.children[0] as LineSegments).geometry).not.toBe((root.children[0] as LineSegments).geometry);
    dispose(recreated);
  }
});
