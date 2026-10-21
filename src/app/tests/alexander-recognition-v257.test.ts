import { expect, test } from "bun:test";
import { appendAlexanderRecognitionV257, ALEXANDER_RECOGNITION_V257 as source } from "../src/AlexanderRecognitionV257";

function rows(minecraft: boolean) {
  const boxes: number[][] = [], lines: number[][] = [];
  const stats = appendAlexanderRecognitionV257({ minecraft,
    box: (p, size, tint, yaw = 0) => boxes.push([...p, ...size, tint, yaw]),
    line: (a, b, width, tint = 0) => lines.push([...a, ...b, width, tint]),
  });
  return { boxes, lines, stats };
}

test("three bounded sites share old batches with finite independent native geometry", () => {
  const a = rows(false), n = rows(true);
  expect(a.boxes.length).toBe(5203); expect(a.lines.length).toBe(296);
  expect(n.boxes.length).toBe(24690); expect(n.lines).toEqual([]);
  expect(n.boxes.every(r => r[7] === 0)).toBe(true);
  expect(a.stats.drawCallsAdded).toBe(0); expect(n.stats.descriptorCountAdded).toBe(0);
  expect(a.stats.measuredEnvelopesRetained).toBe(true);
  for (const result of [a, n]) {
    expect(result.stats.fullStaticDetailOnTouch).toBe(true);
    for (const row of result.boxes) {
      expect(row.every(Number.isFinite)).toBe(true);
      expect(Math.min(...row.slice(3, 6))).toBeGreaterThan(0);
      expect(row[0]).toBeGreaterThan(2480); expect(row[0]).toBeLessThan(2800);
      expect(row[2]).toBeGreaterThan(-225); expect(row[2]).toBeLessThan(110);
      expect(row[1] - row[4] / 2).toBeGreaterThan(5.2);
    }
  }
  expect(rows(false)).toEqual(a); expect(rows(true)).toEqual(n);
});

test("CUBIX, residential slab and retail podium remain distinct retained owners", () => {
  expect(source.sites.cubix.parent).toBe("DEBE01YYK000097N");
  expect(source.sites.rathauspassagen.parent).toBe("DEBE01YYK00003PR");
  const a = rows(false);
  // Full pane + two horizontal / two vertical frame members for nine upper bays.
  expect(a.boxes.filter(r => Math.abs(r[3] - 32.8) < .001 && r[4] >= 4.5).length).toBe(3);
  expect(a.boxes.filter(r => Math.abs(r[3] - 5.7) < .001 && r[4] >= 4.5).length).toBe(3);
  expect(a.boxes.filter(r => Math.abs(r[3] - 31) < .001 && r[4] >= 4.5).length).toBe(3);
  // No new ground, navigation solid, complete mass, source cap or roof replacement.
  expect(a.boxes.every(r => Math.min(r[3], r[5]) < .8)).toBe(true);
});
