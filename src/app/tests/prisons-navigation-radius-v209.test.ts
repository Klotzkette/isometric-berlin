import { describe, expect, test } from "bun:test";
import source from "../src/data/prisonsMemorialsV209Navigation.json";
import { prisonsMemorialsV209GroundAt, prisonsMemorialsV209SolidAt } from "../src/prisonsMemorialsV209Navigation";

describe("bounded source-ring prison collision radius", () => {
  test("a capsule beside the Tegel wall collides only when its radius reaches the wall", () => {
    const [x, y, z] = [-5078.689346, 5, -5956.393745];
    expect(prisonsMemorialsV209SolidAt(x, y, z, 0)).toBe(false);
    expect(prisonsMemorialsV209SolidAt(x, y, z, .19)).toBe(false);
    expect(prisonsMemorialsV209SolidAt(x, y, z, .35)).toBe(true);
  });

  test("every complete original outer and courtyard ring has collidable edges", () => {
    let owners = 0, holeEdges = 0;
    for (const owner of source.owners) {
      owners++;
      const polygons = owner.geometry.type === "Polygon" ? [owner.geometry.coordinates as number[][][]] : owner.geometry.coordinates as number[][][][];
      for (const polygon of polygons) for (let r = 0; r < polygon.length; r++) {
        const ring = polygon[r];
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[j], b = ring[i];
          if (r > 0) holeEdges++;
          expect(prisonsMemorialsV209SolidAt((a[0] + b[0]) / 2, (owner.low + owner.high) / 2, (a[1] + b[1]) / 2, .001)).toBe(true);
        }
      }
    }
    expect(owners).toBe(118);
    expect(holeEdges).toBeGreaterThan(0);
  });

  test("original courtyard holes, memorial court and foreign distant points stay open", () => {
    for (const [x, z] of [[-5215.4375, -5996.582], [7891.255196, 596.595285], [8900, -2345]]) {
      expect(prisonsMemorialsV209GroundAt(x, z)).toBe(3);
      expect(prisonsMemorialsV209SolidAt(x, 5, z, .35)).toBe(false);
    }
    for (const [x, z] of [[0, 0], [8500, -1000], [-100000, 100000], [100000, -100000]]) {
      expect(prisonsMemorialsV209GroundAt(x, z)).toBeNull();
      expect(prisonsMemorialsV209SolidAt(x, 5, z, .35)).toBe(false);
    }
    expect(prisonsMemorialsV209SolidAt(7863, 5, 660, .35)).toBe(true);
    expect(prisonsMemorialsV209SolidAt(7863, 100, 660, .35)).toBe(false);
  });
});
