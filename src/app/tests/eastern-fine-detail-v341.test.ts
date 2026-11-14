import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { appendAlexanderRecognitionV257 } from "../src/AlexanderRecognitionV257";
import { appendEastCinemasV260 } from "../src/EastCinemasV260";
import { neukoellnFineDetailV341 } from "../src/NeukoellnFineDetailV341";
import source from "../src/data/neukoellnLandmarksV305Core.json";

type Builder = Parameters<typeof appendEastCinemasV260>[0];
function collect(factory: (builder: Builder) => unknown, minecraft: boolean) {
  const boxes: number[][] = [], lines: number[][] = [], rounds: number[][] = [];
  factory({minecraft,
    box: (p,s,c,yaw=0)=>boxes.push([...p,...s,c,yaw]),
    line: (a,b,w,c=0)=>lines.push([...a,...b,w,c]),
    round: (p,s,c=0)=>rounds.push([...p,...s,c]),
  });
  return {boxes,lines,rounds};
}

test("complete pre-v341 output survives as an exact prefix in both render families", () => {
  // Captured from the actual published220 constructors, not inferred counts.
  for (const [factory,native,counts,sha] of [
    [appendAlexanderRecognitionV257,false,[5203,296,0],"9f8e9f9723cffff98c5a4461be9992dc676e8207cf7a7df6bcc14a9229d98102"],
    [appendAlexanderRecognitionV257,true,[24690,0,0],"bbbf6d36566a195171f43fa56e4db4257ec4e8bcda5f7dbfe5d8b44b9eb70568"],
    [appendEastCinemasV260,false,[596,887,1],"510f5c1e61593ea1a44b4eedd163c3befa13560736fe6a7d46bffbcabdf64eba"],
    [appendEastCinemasV260,true,[8675,0,0],"7ada9391b937c4c1bb3846e6ac18803491c14dade88f7d8f3c79855a00c0ca28"],
  ] as const) {
    const now=collect(factory,native);
    const before={boxes:now.boxes.slice(0,counts[0]),lines:now.lines.slice(0,counts[1]),rounds:now.rounds.slice(0,counts[2])};
    expect(createHash("sha256").update(JSON.stringify(before)).digest("hex")).toBe(sha);
    expect(now.boxes.length+now.lines.length).toBeGreaterThan(counts[0]+counts[1]);
  }
});

test("Neukölln additions leave all old rows intact and borrow the original window supports",()=>{
  for(const native of [false,true]) {
    const old=native?source.nativeBoxes:source.fittings;
    const before=JSON.stringify(old);
    const detail=neukoellnFineDetailV341(native,old);
    expect(JSON.stringify(old)).toBe(before);
    expect(detail.rows.length).toBeLessThan(4800);
    expect(detail.counts.historicWindowBars).toBeGreaterThan(3400);
    expect(detail.counts.arcadenPanelBars).toBeGreaterThan(1100);
    expect(detail.counts.lanternWindows).toBe(12);
    for(const row of detail.rows){
      expect(row.every(Number.isFinite)).toBe(true);
      expect(Math.min(...row.slice(3,6))).toBeGreaterThan(0);
      if(native)expect(row[6]).toBe(0);
    }
    // No new source shell, roof, navigation solid or independent scene batch.
    expect(detail.rows.every(r=>Math.min(r[3],r[5])<=.16)).toBe(true);
    expect(neukoellnFineDetailV341(native,old)).toEqual(detail);
  }
});

test("native upper-lantern windows sit outside the represented old solid",()=>{
  const old=source.nativeBoxes.filter(r=>r[1]===61&&r[4]===3.5&&r[7]===0xa49f8c);
  const windows=neukoellnFineDetailV341(true,source.nativeBoxes).rows.filter(r=>r[7]===0x334442);
  expect(windows).toHaveLength(12);
  for(const w of windows) {
    expect(old.some(r=>Math.abs(r[0]-w[0])<r[3]/2&&Math.abs(r[2]-w[2])<r[5]/2)).toBe(false);
    const axis=w[3]<w[5]?0:2;
    expect(old.some(r=>Math.abs(Math.abs(r[axis]-w[axis])-r[axis+3]/2-.065)<1e-6)).toBe(true);
  }
});
