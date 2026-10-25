import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import before from "./fixtures/core-house-colours-v273-before.json";
import paint from "../src/data/coreHouseColoursV273.json";
import { coreHousePaintV273 } from "../src/CoreHouseColoursV273";
import { buildColumnToneLookup } from "../src/MinecraftVoxelWorld";
import { HERO_PRISM_TONES, HERO_PRISM_ROOF_TONES, PRISM_SUPPRESSED_IDS, PRISM_GLASSED_IDS } from "../src/IsometricCityWorld";
import { coreSourceV211, drawnV211, snapshotV211, disposeV211, wallColoursV211 } from "./helpers/coreMaterialV211";

test("resolved authored registries and their imported owners are completely excluded", () => {
  const protection = JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/core-house-colours-v273-protected.json", import.meta.url), "utf8"));
  const registries = {
    HERO_PRISM_TONES: Object.keys(HERO_PRISM_TONES).sort(),
    HERO_PRISM_ROOF_TONES: Object.keys(HERO_PRISM_ROOF_TONES).sort(),
    PRISM_SUPPRESSED_IDS: [...PRISM_SUPPRESSED_IDS].sort(),
    PRISM_GLASSED_IDS: [...PRISM_GLASSED_IDS].sort(),
  };
  expect(protection.registries).toEqual(registries);
  for (const id of Object.values(registries).flat()) {
    expect(Object.hasOwn(paint.owners, id)).toBeFalse();
  }
});

test("every positive residential receipt matches its complete unchanged source and rejects changed samples/geometry", () => {
  let selected = 0;
  for (const part of coreSourceV211.buildings) {
    const row = coreHousePaintV273(part);
    if (!row) continue;
    selected++;
    expect(coreHousePaintV273({ ...part, h_dm: part.h_dm + 1 })).toBeUndefined();
    expect(coreHousePaintV273({ ...part, class: part.class + 1 })).toBeUndefined();
    expect(coreHousePaintV273({ ...part, tone: [part.tone![0] + 1, ...part.tone!.slice(1)] })).toBeUndefined();
    expect(coreHousePaintV273({ ...part, ring: [[part.ring[0][0] + 1, part.ring[0][1]], ...part.ring.slice(1)] })).toBeUndefined();
    expect(coreHousePaintV273({ ...part, holes: [...part.holes ?? [], [[0,0],[1,0],[1,1]]] })).toBeUndefined();
  }
  expect(selected).toBe(7174);
  expect(coreHousePaintV273({ id: Object.keys(paint.owners)[0], ring: [[0,0],[1,0],[1,1]] })).toBeUndefined();
});

test("actual early and detailed factories change only existing paint; mapped and authored controls are byte-identical", () => {
  for (const record of before.records) {
    const part = coreSourceV211.buildings[record.index];
    expect(part.id).toBe(record.id);
    const selected = coreHousePaintV273(part) !== undefined;
    let early: string[] | undefined;
    for (const pass of ["distant", "detailed"] as const) {
      const object = drawnV211(part, pass);
      try {
        const current = snapshotV211(object), previous = record.drawn[pass];
        expect({ ...current, colours: previous.colours }).toEqual(previous);
        if (selected) expect(current.colours).not.toBe(previous.colours);
        else expect(current).toEqual(previous);
        const walls = wallColoursV211(object, part.y0_dm / 10);
        if (pass === "distant") early = walls;
        // Detailed shells retain additional existing recess/junction shading.
        // Every early outer-wall shade remains present in that finer mesh.
        else expect(early!.every(tone => walls.includes(tone))).toBeTrue();
      } finally { disposeV211(object); }
    }
  }
});

test("all 29,818 native sample queries keep mapped caps and exact source ownership, with an unchanged colour complement", () => {
  const lookup = buildColumnToneLookup(coreSourceV211);
  const owners = paint.owners as unknown as Record<string, number[][]>;
  let changed = 0, unchanged = 0;
  for (const [x, z, oldPaint, oldRoof, oldOwner] of before.native as [number,number,number|null,number|null,string|null][]) {
    expect(lookup.sourceIdAt!(x, z)).toBe(oldOwner);
    expect(lookup.roofToneAt!(x, z) ?? null).toBe(oldRoof);
    const current = lookup(x,z);
    if (!oldOwner || !owners[oldOwner]) {
      expect(current).toBe(oldPaint);
      expect(lookup.illustrationRoofToneAt!(x,z)).toBeUndefined();
      unchanged++;
    } else if (current !== oldPaint) {
      expect(owners[oldOwner].some(row => row[4] === current)).toBeTrue();
      changed++;
    }
  }
  expect(changed).toBeGreaterThan(5000);
  expect(unchanged).toBeGreaterThan(19000);
});

test("the entire native constructor is unchanged except paint on an already existing cap", () => {
  const source = readFileSync(new URL("../src/MinecraftVoxelWorld.ts", import.meta.url), "utf8");
  const constructor = source.slice(source.indexOf("export function* buildMinecraftVoxelWorldSteps("));
  const current = "sourceRoofTone ?? toneLookup?.illustrationRoofToneAt?.(worldX, worldZ) ?? layers.cap";
  expect(constructor.split(current)).toHaveLength(2);
  const normalized = constructor.replace(current, "sourceRoofTone ?? layers.cap");
  expect(new Bun.CryptoHasher("sha256").update(normalized).digest("hex")).toBe(before.nativeConstructorSha256);
  // This fixes the complete full/mobile control flow, all original matrix/size
  // writes, cap allocation, window/tree/landmark construction and return path.
  // Unknown roof paint must never enter roofToneAt and create mobile geometry.
});
