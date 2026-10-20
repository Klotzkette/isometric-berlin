import { describe, expect, test } from "bun:test";
import data from "../src/data/gipsKoppenV252.json";
import old from "../src/data/schoolsPlacesV205.json";
import { appendGipsKoppenV252, gipsKoppenV252Matches } from "../src/gipsKoppenV252";
import { justicePalaceV183Boxes } from "../src/justicePalaceV183Batches";
import { letteringStrokePaths } from "../src/drawnLettering";

describe("Gips and Koppenplatz exact old-batch extension",()=>{
  const entry=old.schools.find(s=>s.owner===data.owner)!;
  test("only exact inaccurate authored owner yields; old source arrays survive",()=>{
    expect(gipsKoppenV252Matches(entry)).toBe(true);
    const before=JSON.stringify(entry), result=appendGipsKoppenV252(entry);
    expect(JSON.stringify(entry)).toBe(before);
    expect(result.boxes.length).toBe(1150);
    expect(result.rods.length).toBe(163);
    expect(result.nativeRows.length).toBe(3293);
    expect(data.koppenReplacement).toEqual({oldVerifiedPanes:56,occupiedLevels:3,newPanes:76});
    for(const other of old.schools.filter(s=>s.owner!==data.owner)){
      expect(appendGipsKoppenV252(other)).toBe(other);
    }
    const changed={...entry,boxes:entry.boxes.map(r=>[...r])};
    changed.boxes[0][0]+=.001;
    expect(appendGipsKoppenV252(changed)).toBe(changed);
  });
  test("native is independently orthogonal and compact; sign is drawable",()=>{
    const result=appendGipsKoppenV252(entry);
    const mesh=justicePalaceV183Boxes(result.nativeRows,true);
    expect(mesh.count).toBe(3293);
    expect(mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength).toBeLessThan(260_000);
    for(let i=0;i<mesh.count;i++){
      const m=mesh.instanceMatrix.array;
      for(const k of [1,2,4,6,8,9])expect(m[i*16+k]).toBe(0);
      expect(Number.isFinite(m[i*16+12])).toBe(true);
    }
    const sign=result.labels.at(-1)!;
    expect(sign.text).toBe("MILCHHALLE");
    const strokes=letteringStrokePaths(sign.text,sign.height);
    expect(strokes.length).toBeGreaterThan(10);
    expect(Math.max(...strokes.flat().map(p=>Math.abs(p[0])))).toBeLessThan(2.7);
    mesh.geometry.dispose();
    mesh.userData.dayMaterial.dispose();
    mesh.userData.nightMaterial.dispose();
  });
});
