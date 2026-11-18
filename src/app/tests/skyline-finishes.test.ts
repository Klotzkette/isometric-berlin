import { describe, expect, it } from "bun:test";
import { Color, InstancedMesh, Mesh, type Group } from "three";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createCivicLandmarks } from "../src/CivicLandmarks";
import { createCentralCivicDetails } from "../src/CentralCivicDetails";
import { createParliamentArchitecture } from "../src/ParliamentArchitecture";
import { createNeueNationalgalerieV183 } from "../src/NeueNationalgalerieV183";
import { createTiergartenLiteraryMemorials } from "../src/TiergartenLiteraryMemorials";
import { createBreitscheidTowers } from "../src/BreitscheidTowers";
import { createDbTowerArchitecture } from "../src/DbTowerArchitecture";
import { createArchitecturalSignature, type ArchitecturalSignature } from "../src/ArchitecturalLandmarks";
import { createSiegessaeule } from "../src/IsometricCityWorld";
import { createSonyCenterForumRoof } from "../src/SonyCenterForumRoof";
import { createAlexanderCivicArchitecture } from "../src/AlexanderCivicArchitecture";
import { skylineArchitecturalFinish, skylinePacketFinish } from "../src/skylineFinishes";
import ihz from "../src/data/ihzV241.json";
import oper from "../src/data/staatsoperV240.json";
import library from "../src/data/staatsbibliothekV241.json";
import quartier from "../src/data/quartier207V241.json";

function mesh(root: Group, name: string): Mesh {
  const result = root.getObjectByName(name);
  if (!(result instanceof Mesh)) throw new Error(`Missing model surface: ${name}`);
  return result;
}

function encodedSwatch(srgb: number): number {
  const { r, g, b } = new Color(srgb);
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}

describe("Authored daytime surface finishes", () => {
  it("separates Upper West aluminium and Zoofenster limestone from their panes", () => {
    const root = createBreitscheidTowers();
    const details = mesh(root, "Source-clipped limestone windows glass crown and staggered aluminium facade") as InstancedMesh;
    const profile = skylineArchitecturalFinish(details);
    if (!profile || typeof profile === "string") throw new Error("Expected a mixed facade");
    const colors = new Set<number>(), sample = new Color();
    for (let i = 0; i < details.count; i++) {
      details.getColorAt(i, sample);
      colors.add(sample.getHex());
    }
    for (const tint of Object.values(profile).flat()) expect(colors.has(tint)).toBe(true);
    expect(profile.glass?.length).toBe(6);
    expect(profile.masonry).toContain(0xc8c1a9);
    expect(profile.metal).toContain(0xf0eee5);
  });

  it("leaves the BahnTower office ceiling bands and red and white logo in their original finish", () => {
    const root = createDbTowerArchitecture();
    const panes = skylineArchitecturalFinish(mesh(root, "BahnTower glass"));
    if (!panes || typeof panes === "string") throw new Error("Expected glazing selectors");
    expect(panes.glass).toContain(0x77959e);
    expect(panes.glass).not.toContain(0xf7f7ee);
    expect(skylineArchitecturalFinish(mesh(root, "BahnTower crown"))).toBe("glass");
    for (const n of ["BahnTower logo-red", "BahnTower logo-white"]) expect(skylineArchitecturalFinish(mesh(root, n))).toBeUndefined();
  });

  it("keeps Sony Center fabric and water separate from wired steel and glass", () => {
    const root = createSonyCenterForumRoof();
    expect(skylineArchitecturalFinish(mesh(root, "Sony Center glass roof sectors"))).toBe("glass");
    expect(skylineArchitecturalFinish(mesh(root, "Sony Center stainless facade rails"))).toBe("metal");
    for (const n of ["Sony Center Forum reflecting pool", "Sony Center membrane roof sectors"]) {
      expect(skylineArchitecturalFinish(mesh(root, n))).toBeUndefined();
    }
  });

  it("keeps the copper roof, sandstone, windows and clock face distinct in the Rathaus and Marienkirche batches", () => {
    const root = createAlexanderCivicArchitecture();
    const display = root.children.find(child => child instanceof InstancedMesh) as Mesh;
    expect(display).toBeInstanceOf(Mesh);
    const finish = skylineArchitecturalFinish(display);
    if (!finish || typeof finish === "string") throw new Error("Expected material-specific finishes");
    expect(finish.patina).toContain(0x7dafa0);
    expect(finish.glass).toContain(0x3b5258);
    expect(finish.masonry).toContain(0xac5f42);
    expect(Object.values(finish).flat()).not.toContain(0x57939a);
  });

  it("distinguishes the Reichstag portico and windows, the gate and the gilded fittings on the Victory Column", () => {
    const file = new URL("../public/mesh/regierungsviertel/scene.json", import.meta.url);
    const signatures: ArchitecturalSignature[] = JSON.parse(readFileSync(file, "utf8")).architectural_signatures;
    function model(id: string) {
      return createArchitecturalSignature(signatures.find(signature => signature.id === id)!)!;
    }
    const reichstag = model("reichstag-model");
    expect(skylineArchitecturalFinish(mesh(reichstag, "Reichstag west portico column 3"))).toBe("masonry");
    expect(skylineArchitecturalFinish(mesh(reichstag, "Reichstag dark upper rectangular facade windows"))).toBe("glass");
    const gate = model("brandenburger-tor-model");
    expect(skylineArchitecturalFinish(mesh(gate, "Brandenburg Gate entablature"))).toBe("masonry");
    expect(skylineArchitecturalFinish(mesh(gate, "Quadriga bodies"))).toBe("patina");
    expect(skylineArchitecturalFinish(mesh(gate, "Quadriga snow caps"))).toBeUndefined();
    const column = mesh(createSiegessaeule(), "Siegessäule and Bismarck bodies");
    const profile = skylineArchitecturalFinish(column);
    if (!profile || typeof profile === "string") throw new Error("Expected shaft and gilding swatches");
    expect(profile.masonry).toContain(0xb9ae94);
    expect(profile.metal).toContain(0xe4be58);
  });

  it("uses the embassy's actual shared stone and glass materials, including serialized clones", () => {
    const embassy = createCivicLandmarks([]);
    const stone = mesh(embassy, "Swiss Embassy 1871 historic palace");
    const panes = mesh(embassy, "Swiss Embassy instanced modern-extension windows");
    expect(skylineArchitecturalFinish(stone)).toBe("masonry");
    expect(skylineArchitecturalFinish(panes)).toBe("glass");
    const clone = panes.clone();
    clone.userData.dayMaterial = { color: 0x70898d, type: "MeshStandardMaterial" };
    expect(skylineArchitecturalFinish(clone)).toBe("glass");
    for (const name of ["Swiss Embassy animated red flag field", "Swiss Embassy historic timber entrance left leaf"]) {
      expect(skylineArchitecturalFinish(mesh(embassy, name))).toBeUndefined();
    }
  });

  it("matches only the Futurium's metal shingles and solar glazing in the shared civic mesh", () => {
    const name = "Central transit and civic details bodies";
    const withMuseum = mesh(createCentralCivicDetails([{ name: "Futurium", world: [0, 4, 0] }]), name);
    const withoutMuseum = mesh(createCentralCivicDetails([]), name);
    const profile = skylineArchitecturalFinish(withMuseum);
    if (!profile || typeof profile === "string") throw new Error("Expected Futurium finishes");
    const colors = (model: Mesh) => {
      const bytes = model.geometry.getAttribute("color").array as Uint8Array;
      const result = new Set<number>();
      for (let i = 0; i < bytes.length; i += 3) result.add(bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2]);
      return result;
    };
    const present = colors(withMuseum), absent = colors(withoutMuseum);
    for (const paint of Object.values(profile).flat()) {
      expect(present.has(encodedSwatch(paint))).toBeTrue();
      expect(absent.has(encodedSwatch(paint))).toBeFalse();
    }
  });

  it("distinguishes the two parliamentary facades' natural wood from glass and concrete", () => {
    const file = new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url);
    const root = createParliamentArchitecture(JSON.parse(readFileSync(file, "utf8")));
    const panels = mesh(root, "Parliament source-bound architecture facade and roof details") as InstancedMesh;
    const swatches = new Set<number>(), color = new Color();
    for (let i = 0; i < panels.count; i++) { panels.getColorAt(i, color); swatches.add(color.getHex()); }
    const profile = skylineArchitecturalFinish(panels);
    if (!profile || typeof profile === "string") throw new Error("Expected parliamentary finishes");
    const eastWing = mesh(root, "Jakob-Kaiser northeast upper wing source-gap display");
    swatches.add(eastWing.userData.dayMaterial.color.getHex());
    for (const paint of Object.values(profile).flat()) expect(swatches.has(paint)).toBeTrue();
    for (const cedar of [0x977154, 0xb29270]) {
      expect(swatches.has(cedar)).toBeTrue();
      expect(Object.values(profile).flat()).not.toContain(cedar);
    }
  });

  it("selects the Nationalgalerie steelwork and the literary monuments' marble without fences or lettering", () => {
    const gallery = createNeueNationalgalerieV183();
    const steel = skylineArchitecturalFinish(mesh(gallery, "Nationalgalerie open steel and glass pavilion v183 stone"));
    if (!steel || typeof steel === "string") throw new Error("Expected separate steel and stone");
    expect(steel.metal).toContain(0x13191a);
    expect(skylineArchitecturalFinish(mesh(gallery, "Nationalgalerie open steel and glass pavilion v183 glass"))).toBe("glass");
    const sculpture = mesh(createTiergartenLiteraryMemorials(), "Lessing memorial relief allegory and fence cues bodies");
    const profile = skylineArchitecturalFinish(sculpture);
    if (!profile || typeof profile === "string") throw new Error("Expected marble and bronze");
    expect(profile.masonry).toContain(0xe7e3d6);
    expect(profile.patina).toContain(0x486d63);
    for (const excluded of [0xc49a45, 0x64867a, 0x353b3a]) expect(Object.values(profile).flat()).not.toContain(excluded);
  });

  it("matches the drawn Nikolaikirche copper spires in their installed city packets", () => {
    const file = new URL("../src/data/nikolaikircheV353Packets.json.gz", import.meta.url);
    const { packets } = JSON.parse(gunzipSync(readFileSync(file)).toString());
    const swatches = new Set<number>();
    const profile = skylinePacketFinish("nikolaikirche-v353");
    if (!profile || typeof profile === "string" || !profile.patina) throw new Error("Expected copper selectors");
    for (const [id, entry] of Object.entries(packets)) {
      if (!id.startsWith("drawn:")) continue;
      const { append } = entry as { append: { kind: string; colors: string } };
      expect(append.kind).toBe("nikolaikirche-v353");
      const paint = Buffer.from(append.colors, "base64");
      for (let i = 0; i < paint.length; i += 3) swatches.add(paint.readUIntBE(i, 3));
    }
    for (const color of profile.patina) expect(swatches.has(encodedSwatch(color))).toBe(true);
    expect(Object.values(profile).flat()).not.toContain(0x304245);
  });

  it("matches encoded paint on actual packed historic and modern facades", () => {
    for (const packet of [ihz.drawn, oper.drawn, library.drawn, quartier.drawn]) {
      const { colors, kind } = packet.meshes[0];
      const paint = Buffer.from(colors, "base64"), actual = new Set<number>();
      for (let i = 0; i < paint.length; i += 3) actual.add(paint.readUIntBE(i, 3));
      const profile = skylinePacketFinish(kind);
      if (!profile || typeof profile === "string") throw new Error(`No swatches for ${kind}`);
      for (const selected of Object.values(profile)) {
        for (const tint of selected) expect(actual.has(encodedSwatch(tint))).toBe(true);
      }
    }
    expect(skylinePacketFinish("city")).toBeUndefined();
  });
});
