import { describe, expect, test } from "bun:test";
import { BufferAttribute, Color, Group, LineDashedMaterial, LineSegments, MaterialLoader, Mesh, ShaderLib } from "three";
import { buildingAttributes, type BuildingAttributes } from "../src/buildingAttributes";
import {
  createDistantBuildingShells,
  createIsometricCity,
  type PrismBuilding,
  type PrismPayload,
} from "../src/IsometricCityWorld";
import {
  pointInUrbanFacadeScope,
  urbanFacadeScope,
  urbanFacadeInkShader,
  urbanIllustrationToneInto,
  urbanMappedFacadeTone,
  urbanMappedRoofTone,
} from "../src/urbanFacadePresentation";
import { buildColumnToneLookup } from "../src/MinecraftVoxelWorld";
import { stabilizeInkLineMaterial } from "../src/ThreeViewer";

const source = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const sourcePart = (id: string): PrismBuilding => source.buildings.find((part) => part.id === id)!;
const attributes = (tags: BuildingAttributes["tags"]): BuildingAttributes => ({ osm: "way/test", part: false, tags });
type Pass = "distant" | "detailed";

function build(part: PrismBuilding, pass: Pass): { group: Group; body: Mesh } {
  const group = pass === "distant"
    ? createDistantBuildingShells(source, [part])
    : createIsometricCity(source, null, null, null, { buildings: [part], includeContext: false });
  return { group, body: group.getObjectByName(pass === "distant" ? "LoD2 distant building shells" : "LoD2 prism buildings") as Mesh };
}

function digest(attribute: BufferAttribute): string {
  const array = attribute.array;
  return new Bun.CryptoHasher("sha256").update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest("hex");
}

function dispose(group: Group): void {
  group.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
  });
}

describe("bounded ordinary facade presentation", () => {
  test("covers the requested quarters and immediate park edge without extending across Berlin", () => {
    for (const [x, z] of [[427, 1066], [497, 293], [565.85, -1091.96], [-500, -1500], [-1404, 1166], [-1820, -50]]) {
      expect(pointInUrbanFacadeScope(x, z)).toBeTrue();
      expect(urbanFacadeScope({ ring: [[x * 10 - 10, z * 10 - 10], [x * 10 + 10, z * 10 - 10], [x * 10 + 10, z * 10 + 10], [x * 10 - 10, z * 10 + 10]] })).toBeTrue();
    }
    for (const [x, z] of [[3500, 2000], [3000, -3000], [-4000, 2000], [0, -4000]]) {
      expect(pointInUrbanFacadeScope(x, z)).toBeFalse();
    }
  });

  test("resolves retained CSS colour names exactly and preserves explicit colour priority", () => {
    expect(buildingAttributes("K0000APP")?.tags["building:colour"]).toBe("tan");
    expect(buildingAttributes("YFvyF7Oj")?.tags["building:colour"]).toBe("lightblue");
    expect(urbanMappedFacadeTone(buildingAttributes("K0000APP"))).toBe(0xd2b48c);
    expect(urbanMappedFacadeTone(buildingAttributes("YFvyF7Oj"))).toBe(0xadd8e6);
    expect(urbanMappedRoofTone(buildingAttributes("K0000APP"))).toBe(0x66cdaa);
    expect(urbanMappedFacadeTone(attributes({ "building:colour": "#abc", "building:material": "brick" }))).toBe(0xaabbcc);
    expect(urbanMappedFacadeTone(attributes({ "building:colour": "red;white" }))).toBeUndefined();
    expect(urbanMappedRoofTone(attributes({ "roof:colour": "b" }))).toBeUndefined();
    expect(urbanMappedFacadeTone(undefined)).toBeUndefined();
  });

  test("retains warm and cool illustration families with finite, readable output", () => {
    const target = new Color();
    expect(urbanIllustrationToneInto([180, 150, 100], target)).toBe(target);
    expect(target.r).toBeGreaterThan(target.g);
    expect(target.g).toBeGreaterThan(target.b);
    const cool = urbanIllustrationToneInto([70, 130, 190], new Color());
    expect(cool.b).toBeGreaterThan(cool.r);
    for (const tone of [[0, 0, 0], [65, 70, 68], [255, 255, 255]] as [number, number, number][]) {
      const result = urbanIllustrationToneInto(tone, target);
      for (const value of result.toArray()) {
        expect(Number.isFinite(value)).toBeTrue();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  test("existing dashed facade ink keeps its shader features and applies only once after transfer", () => {
    const original = { vertexShader: ShaderLib.dashed.vertexShader, fragmentShader: ShaderLib.dashed.fragmentShader };
    const modified = urbanFacadeInkShader(original.vertexShader, original.fragmentShader);
    expect(urbanFacadeInkShader(modified.vertexShader, modified.fragmentShader)).toEqual(modified);
    expect(modified.vertexShader).toContain("#include <project_vertex>");
    expect(modified.fragmentShader).toContain("#include <color_fragment>");
    expect(modified.fragmentShader).toContain("#include <fog_fragment>");
    expect(modified.fragmentShader).toContain("vLineDistance");
    expect(modified.fragmentShader).toContain("dashSize");
    expect(modified.fragmentShader).toContain("vUrbanFacadeEmphasis");

    const authored = new LineDashedMaterial({ opacity: 0.34, transparent: true });
    authored.userData.urbanFacadeContrast = true;
    // Material JSON/structured clone has no callback; the viewer reinstalls it
    // from the retained marker while keeping its established stable-ink hook.
    const restored = new MaterialLoader().parse(structuredClone(authored.toJSON())) as LineDashedMaterial;
    stabilizeInkLineMaterial(restored);
    const key = restored.customProgramCacheKey();
    expect(key).toContain("stable-ink-view-bias-v1");
    expect(key).toContain("urban-facade-ink-v1");
    stabilizeInkLineMaterial(restored);
    expect(restored.customProgramCacheKey()).toBe(key);
    expect(restored.opacity).toBe(0.34);
    const compiled = { ...original, uniforms: {} };
    restored.onBeforeCompile(compiled as never, {} as never);
    expect(compiled.vertexShader.match(/varying float vUrbanFacadeEmphasis/g)?.length).toBe(1);
    expect(compiled.fragmentShader).toContain("#include <fog_fragment>");
    expect(restored.depthTest).toBeTrue();
    expect(restored.depthWrite).toBeFalse();
    authored.dispose();
    restored.dispose();
  });

  test("Minecraft source lookups keep mapped facade and roof colours while excluding unrequested areas", () => {
    for (const [id, x, z, facade, roof] of [
      ["K0000APP", 427.7, 323.1, 0xd2b17a, 0x66cdaa],
      ["YFvyF7Oj", -507.7, 1345.5, 0xa4dfe2, 0xa5aaa9],
      ["1x80YnFI", 346, -1006.9, 0xd4d4b7, undefined],
    ] as const) {
      const part = sourcePart(id);
      const first = buildColumnToneLookup({ buildings: [part] });
      const differentSample = buildColumnToneLookup({ buildings: [{ ...part, tone: [210, 40, 20] }] });
      expect(first.sourceIdAt?.(x, z)).toBe(id);
      expect(first(x, z)).toBe(facade);
      expect(differentSample(x, z)).toBe(facade);
      expect(first.roofToneAt?.(x, z)).toBe(roof);
      expect(differentSample.roofToneAt?.(x, z)).toBe(roof);
      expect(first.roofToneAt?.(3500, 2000)).toBeUndefined();
    }
    const relocated = {
      ...sourcePart("K0000APP"),
      ring: [[35000, 20000], [35160, 20000], [35160, 20080], [35000, 20080]],
      holes: [[[35060, 20020], [35100, 20020], [35100, 20060], [35060, 20060]]],
    };
    expect(urbanFacadeScope(relocated)).toBeFalse();
    const outside = buildColumnToneLookup({ buildings: [relocated] });
    // The legacy out-of-scope renderer resolves mapped copper as before,
    // while the newly supported CSS roof name is limited to the named areas.
    expect(outside.roofToneAt?.(3502, 2002)).toBe(0x709589);
    expect(outside(3508, 2004)).toBeNull();
    expect(outside.roofToneAt?.(3508, 2004)).toBeUndefined();
    expect(outside.sourceIdAt?.(3508, 2004)).toBeNull();
  });

  for (const pass of ["distant", "detailed"] as const) {
    test(`${pass} factory gives mapped colour and material priority over the old drawn sample`, () => {
      for (const id of ["K0000APP", "YFvyF7Oj", "1x80YnFI"]) {
        const part = sourcePart(id);
        const original = JSON.stringify(part);
        expect(urbanFacadeScope(part)).toBeTrue();
        if (id === "1x80YnFI") {
          expect(buildingAttributes(id)?.tags).toEqual({ "building:material": "plaster" });
        }
        const first = build(part, pass);
        const otherSample = build({ ...part, tone: [210, 40, 20] }, pass);
        try {
          expect(first.body).toBeDefined();
          expect(digest(first.body.geometry.getAttribute("color") as BufferAttribute)).toBe(
            digest(otherSample.body.geometry.getAttribute("color") as BufferAttribute),
          );
          expect(JSON.stringify(part)).toBe(original);
        } finally {
          dispose(first.group);
          dispose(otherSample.group);
        }
      }
    });
  }

  test("preserves the source geometry and draw counts through the colour correction", () => {
    // Captured from v1.0.34 before the presentation change. These three real
    // source parts cover pitched stone, a curved plaster facade and material-only evidence.
    const baselines = [
      ["K0000APP", "distant", 38, 1, "2a752756cb043674cd1fcf5c87a1286869bc133ebaf0a83acb9634434544eff0"],
      ["K0000APP", "detailed", 204, 4, "ef5f1058751630214f31a54034e786d992168af02064cd67c415682770f7ff64"],
      ["YFvyF7Oj", "distant", 175, 1, "112de9a8037f6f047295cc8bf2b16900b9bafa9c73a36bcf64ad2001c5f8eeaf"],
      ["YFvyF7Oj", "detailed", 2148, 4, "69608a7b1f071ed0c1db326b4384b4c542c20a444abf31350bcca1a42b256e4d"],
      ["1x80YnFI", "distant", 20, 1, "c166aa5d5b918ca765f6572baf40eebdc1a882cb218a4c8a04fe66bfa57a6696"],
      ["1x80YnFI", "detailed", 276, 3, "381964add2d7e47d05252f340ec47ddc9cbf49f69e333b83528344deeb3e58c3"],
    ] as const;
    for (const [id, pass, vertices, draws, hash] of baselines) {
      const { group, body } = build(sourcePart(id), pass);
      try {
        const position = body.geometry.getAttribute("position") as BufferAttribute;
        expect(position.count).toBe(vertices);
        expect(digest(position)).toBe(hash);
        let renderables = 0;
        group.traverse((object) => { if (object instanceof Mesh || object instanceof LineSegments) renderables += 1; });
        expect(renderables).toBe(draws);
      } finally {
        dispose(group);
      }
    }
  });

  test("keeps out-of-scope and authored hero colour buffers identical to v1.0.34", () => {
    const outside: PrismBuilding = {
      id: "urban-outside-fixture", class: 0, y0_dm: 40, h_dm: 180, roof: 1000,
      tone: [150, 170, 160],
      ring: [[35000, 20000], [35160, 20000], [35160, 20080], [35000, 20080]],
    };
    const hero = sourcePart("K0002Qys");
    expect(urbanFacadeScope(outside)).toBeFalse();
    expect(urbanFacadeScope(hero)).toBeTrue();
    for (const [part, pass, hash] of [
      [outside, "distant", "860f0dc3e6ad703016f16b151ad467be2097489fc0e4bddc58defd09258ee69c"],
      [outside, "detailed", "c4313ab6d315ff4b7e545338267f6e0090209c790fa8707f60eb9a4cbadd4f39"],
      [hero, "distant", "5db1bfba78509717372487d226bda1d16f8de80d9bafa3afacacd73fe67ca7fe"],
      [hero, "detailed", "8d08c0d60806b88e980f14cc39affdaab7a6f2239ef1f06695cf6b46be385e4e"],
    ] as const) {
      const { group, body } = build(part, pass);
      try {
        expect(digest(body.geometry.getAttribute("color") as BufferAttribute)).toBe(hash);
      } finally {
        dispose(group);
      }
    }
  });
});
