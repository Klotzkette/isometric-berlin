import { expect, test } from "bun:test";
import { Color, InstancedMesh, Mesh } from "three";
import before from "./fixtures/core-material-v211-before.json";
import { buildingAttributes, mappedRoofTone } from "../src/buildingAttributes";
import { preloadAltMitteNativeV169Source } from "../src/AltMitteNativeCoreV169";
import { buildColumnToneLookup } from "../src/MinecraftVoxelWorld";
import { urbanFacadeScope } from "../src/urbanFacadePresentation";
import { cleanedTone, isoFaceShade } from "../src/IsometricCityWorld";
import { genericFacadeTone } from "../src/cityColourV184";
import { coreSourceV211, sourceIdsV211, nativeIdsV211, fixtureV211, drawnV211, nativeV211, snapshotV211, wallColoursV211, disposeV211 } from "./helpers/coreMaterialV211";

test("real core owners use retained CSS/material evidence in both construction passes without changing geometry", () => {
  for (const id of sourceIdsV211) {
    const part = coreSourceV211.buildings.find(part => part.id === id)!;
    expect(urbanFacadeScope(part)).toBeFalse();
    const immutable = JSON.stringify(part);
    const walls: string[][] = [];
    for (const pass of ["distant", "detailed"] as const) {
      const root = drawnV211(part, pass), other = drawnV211({ ...part, tone: [210, 40, 20] }, pass);
      try {
        const actual = snapshotV211(root), previous = before.drawn[`${id}:${pass}` as keyof typeof before.drawn];
        expect({ ...actual, colours: previous.colours }).toEqual(previous);
        expect(actual.colours).not.toBe(previous.colours);
        expect(actual.colours).toBe(snapshotV211(other).colours);
        walls.push(wallColoursV211(root, part.y0_dm / 10));
      } finally { disposeV211(root); disposeV211(other); }
    }
    expect(walls[0]).toEqual(walls[1]);
    expect(JSON.stringify(part)).toBe(immutable);
  }
});

test("existing source hex, authored hero and coloured sample bytes remain exact", () => {
  for (const id of ["10895838", "gCPv6VJo", "99MFTlRq", "v211-coloured"]) {
    for (const pass of ["distant", "detailed"] as const) {
      const root = drawnV211(fixtureV211(id), pass);
      try { expect(snapshotV211(root)).toEqual(before.drawn[`${id}:${pass}` as keyof typeof before.drawn]); }
      finally { disposeV211(root); }
    }
  }
});

test("neutral samples retain continuous neighbouring tones and shared early/late walls", () => {
  const colours = new Set<string>();
  for (let grey = 80; grey <= 200; grey += 20) {
    const part = { ...fixtureV211("v211-neutral"), tone: [grey, grey, grey] as [number, number, number] };
    const distant = drawnV211(part, "distant"), detailed = drawnV211(part, "detailed");
    try {
      const early = wallColoursV211(distant, 4);
      expect(wallColoursV211(detailed, 4)).toEqual(early);
      colours.add(JSON.stringify(early));
      for (const [pass, root] of [["distant", distant], ["detailed", detailed]] as const) {
        const actual = snapshotV211(root), previous = before.drawn[`v211-neutral:${pass}`];
        expect({ ...actual, colours: previous.colours }).toEqual(previous);
      }
    } finally { disposeV211(distant); disposeV211(detailed); }
  }
  expect(colours.size).toBeGreaterThanOrEqual(6);
});

test("the neutral correction reduces the former ivory lift gently in the actual shell", () => {
  const part = fixtureV211("v211-neutral"), root = drawnV211(part, "distant");
  try {
    const old = cleanedTone(part.tone!).lerp(new Color(0xfbf5e4), .38).lerp(genericFacadeTone(part.id), .38);
    const mesh = root.children[0] as Mesh, p = mesh.geometry.getAttribute("position");
    const n = mesh.geometry.getAttribute("normal"), c = mesh.geometry.getAttribute("color");
    let oldLight = 0, newLight = 0, count = 0;
    for (let i = 0; i < p.count; i++) if (p.getY(i) === 4) {
      const shade = isoFaceShade(n.getX(i), n.getY(i), n.getZ(i));
      oldLight += (old.r + old.g + old.b) * shade / 3;
      newLight += (c.getX(i) + c.getY(i) + c.getZ(i)) / 3;
      count++;
    }
    const reduction = (oldLight - newLight) / count;
    expect(reduction).toBeGreaterThan(.005);
    expect(reduction).toBeLessThan(.05);
  } finally { disposeV211(root); }
});

test("native source priority preserves roof selection, courts and existing authored paint", () => {
  const parts = nativeIdsV211.map(fixtureV211), first = buildColumnToneLookup({ buildings: parts });
  const other = buildColumnToneLookup({ buildings: parts.map(part => ({ ...part, tone: [210, 40, 20] })) });
  for (const [i, part] of parts.entries()) {
    const x = 8002 + i * 8, z = 8002;
    if (!part.id.startsWith("v211-")) expect(first(x, z)).toBe(other(x, z));
    if (sourceIdsV211.includes(part.id)) expect(first.roofToneAt!(x, z)).toBe(mappedRoofTone(buildingAttributes(part.id)));
  }
  // Existing native hero palette values, before the broader material priority.
  expect(first(8002 + 5 * 8, 8002)).toBe(0xb9684f);
  const holed = { ...fixtureV211("ilN3ccbn"), holes: [[[80010, 80010], [80030, 80010], [80030, 80030], [80010, 80030]]] };
  const lookup = buildColumnToneLookup({ buildings: [holed] });
  expect(lookup(8002, 8002)).toBeNull();
  expect(lookup.roofToneAt!(8002, 8002)).toBeUndefined();
  expect(lookup(8000.5, 8000.5)).not.toBeNull();
});

test("actual native factories retain all full/mobile matrices, indices, caps and buffer sizes", async () => {
  await preloadAltMitteNativeV169Source();
  for (const profile of ["full", "mobile"] as const) {
    const root = nativeV211(profile);
    try {
      const actual = snapshotV211(root), previous = before.native[profile];
      expect({ ...actual, colours: previous.colours }).toEqual(previous);
      const mesh = root.getObjectByName("Voxel building columns") as InstancedMesh;
      const lookup = buildColumnToneLookup({ buildings: nativeIdsV211.map(fixtureV211) });
      const tone = new Color();
      for (let i = 0; i < mesh.count; i++) {
        const m = mesh.instanceMatrix.array, x = m[i * 16 + 12];
        // Body courses exclude the unchanged one-metre plinth/cap layers.
        if (m[i * 16 + 5] <= 1) continue;
        mesh.getColorAt(i, tone);
        expect(tone.getHex()).toBe(lookup(x, 8002)!);
      }
    } finally { disposeV211(root); Bun.gc(true); }
  }
}, 60000);
