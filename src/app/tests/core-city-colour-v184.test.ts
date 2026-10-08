import { expect, test } from "bun:test";
import { BufferAttribute, Group, LineDashedMaterial, LineSegments, Material, MaterialLoader, Mesh } from "three";
import { createDistantBuildingShells, createIsometricCityCore, type PrismBuilding, type PrismPayload } from "../src/IsometricCityWorld";
import { applyArchitecturalInkMode } from "../src/architecturalInk";
import { buildingAttributes } from "../src/buildingAttributes";

type Pass = "distant" | "detailed";
const fixture = (id = "v184-generic-0"): PrismBuilding => ({
  id, class: 0, y0_dm: 40, h_dm: 180, roof: 1000, tone: [168, 166, 160],
  ring: [[35000, 20000], [35160, 20000], [35160, 20080], [35000, 20080]],
});
function build(part: PrismBuilding, pass: Pass): Group {
  const payload: PrismPayload = { schema_version: 1, classes: ["concrete"], buildings: [part] };
  return pass === "distant" ? createDistantBuildingShells(payload, [part])
    : createIsometricCityCore(payload, null, null, null, { includeContext: false });
}
function dispose(group: Group): void {
  const materials = new Set<Material>();
  group.traverse(object => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    for (const value of Object.values(object.userData)) if (value instanceof Material) materials.add(value);
  });
  for (const material of materials) material.dispose();
}
const digest = (attribute: BufferAttribute | null): string | null => attribute
  ? new Bun.CryptoHasher("sha256").update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)).digest("hex") : null;
const body = (group: Group): Mesh => group.children.find(object => object instanceof Mesh) as Mesh;
function geometryDigest(group: Group): string {
  const rows: unknown[] = [];
  group.traverse(object => {
    if (object instanceof Mesh || object instanceof LineSegments) rows.push({
      name: object.name, index: digest(object.geometry.index),
      attributes: Object.entries(object.geometry.attributes).filter(([name]) => name !== "color")
        .map(([name, attr]) => [name, attr.count, attr.itemSize, attr.normalized, digest(attr as BufferAttribute)]),
    });
  });
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(rows)).digest("hex");
}
function wallColours(group: Group): string[] {
  const geometry = body(group).geometry, positions = geometry.getAttribute("position"), colors = geometry.getAttribute("color").array;
  const result = new Set<string>();
  for (let i = 0; i < positions.count; i++) if (positions.getY(i) === 4)
    result.add(Array.from(colors.slice(i * 3, i * 3 + 3)).join(","));
  return [...result].sort();
}

test("generic source IDs vary gently and distant/detail walls share the same paint", () => {
  for (const sampled of [false, true]) {
    const families = new Set<string>();
    for (let index = 0; index < 8; index++) {
      const part = fixture(`v184-generic-${index}`);
      if (!sampled) delete part.tone;
      const original = JSON.stringify(part), distant = build(part, "distant"), detail = build(part, "detailed");
      try {
        expect(wallColours(detail)).toEqual(wallColours(distant));
        families.add(JSON.stringify(wallColours(distant)));
        expect(JSON.stringify(part)).toBe(original);
      } finally { dispose(distant); dispose(detail); }
    }
    expect(families.size).toBeGreaterThanOrEqual(6);
  }
});

test("one synthetic house preserves every non-colour attribute, index and draw count from v1.0.83", () => {
  // Captured from the untouched v1.0.83 checkout; no full city or recognition context.
  for (const [pass, hash, counts] of [
    ["distant", "651a2eb6916dfacc60e2cabec25d02f64007796bb9f96215fef847368db1eb85", [20]],
    ["detailed", "f51de9b8d75ee0a3e38d12ca192ef06ffc90809d52d248f9c37c6e9907018886", [276, 68, 4, 120]],
  ] as const) {
    const group = build(fixture(), pass);
    try {
      expect(geometryDigest(group)).toBe(hash);
      expect(group.children.map(object => (object as Mesh).geometry.getAttribute("position").count)).toEqual(counts);
    } finally { dispose(group); }
  }
});

test("hero and recorded facade/roof colours retain exact v1.0.83 bytes", () => {
  expect(buildingAttributes("10895838")?.tags).toMatchObject({ "building:colour": "#E3DEDE", "roof:colour": "#464B67" });
  for (const [id, pass, hash] of [
    ["K0002Qys", "distant", "59521f1256a742456b77aa7fc95e3451bcd119f07bea12bfe021710ca49373a8"],
    ["K0002Qys", "detailed", "c79a82f49df04bad48e1cb818229f035c70cf4d6f245697f53fac124b7ae3d11"],
    ["10895838", "distant", "1ddb447c9bee5cf7c047b6a29716deadb3f4be5104d59b88d4a600d26e633abc"],
    ["10895838", "detailed", "759e0de8123b5a29adfa7d4ebd607f4af7c1bd46d79b9860108674e38215f3cb"],
  ] as const) for (const tone of [[168, 166, 160], [210, 40, 20]] as [number, number, number][]) {
    const group = build({ ...fixture(id), tone }, pass);
    try { expect(digest(body(group).geometry.getAttribute("color") as BufferAttribute)).toBe(hash); }
    finally { dispose(group); }
  }
});

test("generic window accent survives material transfer and mode round trips without geometry changes", () => {
  const group = build(fixture(), "detailed"), geometry = geometryDigest(group);
  const axes = group.getObjectByName("LoD2 facade axes") as LineSegments;
  const material = new MaterialLoader().parse(structuredClone((axes.material as Material).toJSON())) as LineDashedMaterial;
  try {
    expect(material.userData).toMatchObject({ architecturalInkDayColor: 0x819c9f, architecturalInkRole: "micro", urbanFacadeContrast: true });
    expect(material.opacity).toBe(0.34);
    for (const mode of ["night", "snowstorm", "schwellenraum", "minecraft", "flood", "day"] as const) {
      applyArchitecturalInkMode(material, mode);
      if (mode === "day" || mode === "flood") expect(material.color.getHex()).toBe(0x819c9f);
      else expect(material.color.getHex()).not.toBe(0x819c9f);
    }
    expect(geometryDigest(group)).toBe(geometry);
  } finally { material.dispose(); dispose(group); }
});
