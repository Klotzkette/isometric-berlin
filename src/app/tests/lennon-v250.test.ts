import { expect, test } from "bun:test";
import data from "../src/data/lennonV250.json";
import old205 from "../src/data/schoolsPlacesV205.json";
import old230 from "../src/data/centralNamedV230.json";
import { canRefineLennonV250, createLennonV250, lennonV250Fingerprint, replacesLennonV250 } from "../src/LennonV250";

test("exact older authored owner yields only when every matching receipt is intact",()=>{
  expect(canRefineLennonV250()).toBe(true);
  for(const [entries,version] of [[old205.schools,"v205"],[old230.sites,"v230"]] as const) {
    for(const entry of entries) {
      const before=JSON.stringify(entry);
      expect(replacesLennonV250(entry,version)).toBe(entry.owner===data.owner);
      expect(JSON.stringify(entry)).toBe(before);
      if(entry.owner!==data.owner)continue;
      const changed=structuredClone(entry); changed.boxes[0][0]+=.001;
      expect(replacesLennonV250(changed,version)).toBe(false);
      const truncated=structuredClone(entry);truncated.nativeRows.pop();
      expect(replacesLennonV250(truncated,version)).toBe(false);
      expect(lennonV250Fingerprint(entry.boxes)).toEqual(data.previous[version].boxes);
    }
  }
});

test("both complete school readings remain a single bounded frozen texture-free batch",()=>{
  for(const native of [false,true]) {
    const mesh=createLennonV250(native);
    expect(mesh.count).toBe(native?data.counts.native:data.counts.drawn);
    expect(mesh.userData.occupiedLevels).toBe(4);
    expect(mesh.userData.centralPortals).toBe(3);
    expect(mesh.userData.sourceGeometryRetained).toBe(true);
    expect(mesh.userData.fullStaticDetailOnTouch).toBe(true);
    expect(mesh.matrixAutoUpdate).toBe(false);
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect(mesh.boundingBox!.min.y).toBeGreaterThan(9.7);
    expect(mesh.boundingBox!.max.y).toBeLessThan(31.5);
    expect(mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength).toBeLessThan(270_000);
    expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBe(true);
    expect(mesh.instanceMatrix.count).toBe(mesh.count);
    if(native)for(let i=0;i<mesh.count;i++)for(const k of [1,2,4,6,8,9])expect(mesh.instanceMatrix.array[i*16+k]).toBe(0);
    mesh.geometry.dispose();mesh.userData.dayMaterial.dispose();mesh.userData.nightMaterial.dispose();mesh.dispose();
  }
});
