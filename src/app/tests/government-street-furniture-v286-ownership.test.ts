import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  admitGovernmentStreetLampsV286,
  SOURCE_LAMP_RECEIPTS_V286,
} from "../src/governmentStreetFurnitureV286Ownership";
import {
  GOVERNMENT_STREET_LAMP_ANCHORS_V286,
  GOVERNMENT_WAYFINDING_PLACEMENT_V286,
} from "../src/governmentStreetFurnitureV286Profile";
import {
  appendGovernmentStreetLampsV286,
  GOVERNMENT_STREET_LAMP_UNDERSIDE_V286,
  type GovernmentStreetLampAnchorV286,
} from "../src/GovernmentStreetLampsV286";

type Light = Record<string, unknown> & { id: string; position: number[] };
const receipts = (): Light[] => structuredClone(SOURCE_LAMP_RECEIPTS_V286) as unknown as Light[];
const receiptCount = SOURCE_LAMP_RECEIPTS_V286.length;
const payload = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/park-details.json", import.meta.url), "utf8"));
const evidence = JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/government-street-furniture-v286-evidence.json", import.meta.url), "utf8"));

describe("v286 exact lamp-family ownership", () => {
  test("admits the actual retained ten owners and reordered copies without mutating any source", () => {
    expect(admitGovernmentStreetLampsV286(payload.street_lights)).toBeTrue();
    expect(SOURCE_LAMP_RECEIPTS_V286).toHaveLength(10);
    for (const receipt of SOURCE_LAMP_RECEIPTS_V286) {
      expect(payload.street_lights.filter((light: Light) => light.id === receipt.id)).toEqual([receipt]);
      expect(Object.keys(receipt).sort()).toEqual(["height_m", "id", "light_type", "position", "rotation_degrees", "street"]);
    }
    const source = receipts().map(light => Object.fromEntries(Object.entries(light).reverse()));
    const before = JSON.stringify(source);
    expect(admitGovernmentStreetLampsV286(source.reverse())).toBeTrue();
    source.reverse();
    expect(JSON.stringify(source)).toBe(before);
  });

  test("one missing or duplicated owner rejects the whole twenty-lamp replacement", () => {
    expect(admitGovernmentStreetLampsV286([])).toBeFalse();
    for (let i = 0; i < receiptCount; i++) {
      expect(admitGovernmentStreetLampsV286(receipts().filter((_, index) => index !== i))).toBeFalse();
      const source = receipts();
      expect(admitGovernmentStreetLampsV286([...source, structuredClone(source[i])])).toBeFalse();
      const changed = structuredClone(source[i]); changed.height_m = 9;
      expect(admitGovernmentStreetLampsV286([...source, changed])).toBeFalse();
    }
  });

  test("every geometry/signature field is exact, including ground Y, type and all six keys", () => {
    const changes: [string, unknown][] = [
      ["height_m", 6.800001], ["height_m", "6.8"], ["height_m", NaN],
      ["rotation_degrees", .001], ["light_type", "unrecognised changed type"],
      ["street", "different street"], ["id", "different-owner"],
      ["position", [-31.99, 4.834]], ["position", [-31.99, 4.834, -49.36, 0]],
      ["position", "-31.99,4.834,-49.36"],
    ];
    for (let owner = 0; owner < receiptCount; owner++) {
      for (const [key, value] of changes) {
        const source = receipts(); source[owner][key] = value;
        expect(admitGovernmentStreetLampsV286(source)).toBeFalse();
      }
      for (const key of Object.keys(receipts()[owner])) {
        const source = receipts(); delete source[owner][key];
        expect(admitGovernmentStreetLampsV286(source)).toBeFalse();
      }
      for (let axis = 0; axis < 3; axis++) {
        const source = receipts(); source[owner].position[axis] += .001;
        expect(admitGovernmentStreetLampsV286(source)).toBeFalse();
      }
    }
  });

  test("installation, unknown and hidden extra properties cannot authorise retirement", () => {
    for (let owner = 0; owner < receiptCount; owner++) {
      for (const value of [undefined, null, "light_band", "mast"]) {
        const source = receipts(); source[owner].installation = value;
        expect(admitGovernmentStreetLampsV286(source)).toBeFalse();
      }
      const extra = receipts(); extra[owner].source_hint = "same geometry";
      expect(admitGovernmentStreetLampsV286(extra)).toBeFalse();
      const hidden = receipts(); Object.defineProperty(hidden[owner], "extra", { value: 1 });
      expect(admitGovernmentStreetLampsV286(hidden)).toBeFalse();
      const symbol = receipts(); Object.defineProperty(symbol[owner], Symbol("extra"), { value: 1 });
      expect(admitGovernmentStreetLampsV286(symbol)).toBeFalse();
      const position = receipts(); Object.assign(position[owner].position, { extra: 1 });
      expect(admitGovernmentStreetLampsV286(position)).toBeFalse();
      const accessor = receipts(); const id = accessor[owner].id;
      Object.defineProperty(accessor[owner], "id", { get: () => id, enumerable: true });
      expect(admitGovernmentStreetLampsV286(accessor)).toBeFalse();
    }
  });

  test("position coordinates require enumerable data descriptors without invoking accessors", () => {
    let reads = 0;
    for (let owner = 0; owner < receiptCount; owner++) {
      for (let axis = 0; axis < 3; axis++) {
        const accessor = receipts(), value = accessor[owner].position[axis];
        Object.defineProperty(accessor[owner].position, axis, {
          get: () => { reads++; return value; }, enumerable: true,
        });
        expect(admitGovernmentStreetLampsV286(accessor)).toBeFalse();
        expect(reads).toBe(0);
        const hidden = receipts();
        Object.defineProperty(hidden[owner].position, axis, { value, enumerable: false });
        expect(admitGovernmentStreetLampsV286(hidden)).toBeFalse();
      }
      const symbol = receipts();
      Object.defineProperty(symbol[owner].position, Symbol("coordinate"), { value: 1 });
      expect(admitGovernmentStreetLampsV286(symbol)).toBeFalse();
      const sparse = receipts(); delete sparse[owner].position[1];
      expect(admitGovernmentStreetLampsV286(sparse)).toBeFalse();
    }
    expect(admitGovernmentStreetLampsV286(receipts())).toBeTrue();
  });

  test("foreign owners at estimated anchors stay unchanged and cannot satisfy missing receipts", () => {
    const foreign = GOVERNMENT_STREET_LAMP_ANCHORS_V286.slice(receiptCount).map(anchor => ({
      id: `foreign-${anchor.id}`, position: [anchor.x, 5, anchor.z], height_m: 9,
      light_type: "foreign/private source", rotation_degrees: 45, street: null,
    }));
    const mixed = [...foreign, null, 1, "unknown", [], ...receipts()];
    const before = JSON.stringify(mixed);
    expect(admitGovernmentStreetLampsV286(mixed)).toBeTrue();
    expect(JSON.stringify(mixed)).toBe(before);
    expect(admitGovernmentStreetLampsV286([...foreign, ...receipts().slice(1)])).toBeFalse();
    expect(admitGovernmentStreetLampsV286(foreign)).toBeFalse();
  });
});

describe("v286 bounded placement and reference evidence", () => {
  test("keeps ten exact municipal XZ anchors, ten distinct estimates and inward-facing heads", () => {
    const anchors = GOVERNMENT_STREET_LAMP_ANCHORS_V286;
    expect(anchors).toHaveLength(20);
    expect(new Set(anchors.map(a => a.id)).size).toBe(20);
    for (const receipt of SOURCE_LAMP_RECEIPTS_V286) {
      const anchor = anchors.find(a => a.id === receipt.id)!;
      expect([anchor.x, anchor.z, anchor.heightM]).toEqual([receipt.position[0], receipt.position[2], receipt.height_m]);
    }
    expect(anchors.slice(receiptCount).map(a => a.id)).toEqual([
      "photo-west-01", "photo-west-02", "photo-west-03", "photo-west-04", "photo-west-05",
      "photo-east-01", "photo-east-02", "photo-east-03", "photo-east-04", "photo-east-05",
    ]);
    for (const a of anchors) {
      const northCorner = ["244884", "92930", "92928", "92926"].includes(a.id);
      const southCorner = ["92931", "92925"].includes(a.id);
      if (northCorner || southCorner) {
        expect(a.yawRadians).toBe(northCorner ? Math.PI / 2 : -Math.PI / 2);
        // Local -X points South on the north row and North on the south row.
        expect(Math.sign(Math.sin(a.yawRadians))).toBe(northCorner ? 1 : -1);
      } else {
        const isEast = a.id === "231349" || a.id === "92927" || a.id.startsWith("photo-east");
        expect(a.yawRadians).toBe(isEast ? -.02936 : Math.PI - .02936);
        expect(Math.sign(-Math.cos(a.yawRadians))).toBe(isEast ? -1 : 1);
      }
      expect(a.heightM).toBe(6.8);
      expect(a.x).toBeGreaterThan(-56); expect(a.x).toBeLessThan(-18);
      expect(a.z).toBeGreaterThan(-72); expect(a.z).toBeLessThan(103);
      expect(["231368", "231334"]).not.toContain(a.id);
    }
  });

  test("the actual adjacent corner dishes have over half a metre of horizontal clearance", () => {
    type Point = readonly number[];
    const pair = GOVERNMENT_STREET_LAMP_ANCHORS_V286.filter(a => a.id === "92928" || a.id === "92927");
    function dishes(anchors: readonly GovernmentStreetLampAnchorV286[]): readonly Point[][] {
      const rings: Point[][] = [];
      appendGovernmentStreetLampsV286({ native: false, box() {}, beam() {}, polygon(ring, holes, _y, tint) {
        if (tint === GOVERNMENT_STREET_LAMP_UNDERSIDE_V286 && holes.length === 1) rings.push([...ring]);
      } }, () => 0, anchors);
      return rings;
    }
    function separated(a: readonly Point[], b: readonly Point[]): boolean {
      return [a, b].some(ring => ring.some((p, i) => {
        const q = ring[(i + 1) % ring.length], axis = [q[1] - p[1], p[0] - q[0]];
        const pa = a.map(v => v[0] * axis[0] + v[1] * axis[1]);
        const pb = b.map(v => v[0] * axis[0] + v[1] * axis[1]);
        return Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa);
      }));
    }
    function pointSegment(p: Point, a: Point, b: Point): number {
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
    }
    const [a, b] = dishes(pair);
    expect(separated(a, b)).toBeTrue();
    const distances = [...a.flatMap(p => b.map((q, i) => pointSegment(p, q, b[(i + 1) % b.length]))),
      ...b.flatMap(p => a.map((q, i) => pointSegment(p, q, a[(i + 1) % a.length])))];
    expect(Math.min(...distances)).toBeCloseTo(.5181713909646555, 8);
    expect(Math.min(...distances)).toBeGreaterThan(.5);
    const old = dishes(pair.map(anchor => anchor.id === "92927" ? { ...anchor, yawRadians: -Math.PI / 2 } : anchor));
    expect(separated(old[0], old[1])).toBeFalse();
    expect(pair.map(p => [p.id, p.x, p.z, p.heightM])).toEqual([
      ["92928", -31.22, -68.88, 6.8], ["92927", -31.33, -66, 6.8],
    ]);
  });

  test("uses only the identified west guidepost and coherent opposite route headings", () => {
    const p = GOVERNMENT_WAYFINDING_PLACEMENT_V286;
    expect([p.sourceNodeId, p.x, p.z]).toEqual(["10298343088", -51.299, -51.259]);
    const d = p.directions;
    expect(Math.sin(d.hauptbahnhofMoabit)).toBeGreaterThan(.99);
    expect(Math.sin(d.potsdamerTor)).toBeLessThan(-.99);
    expect(Math.cos(d.reichstag)).toBeGreaterThan(.99);
    expect(Math.cos(d.schoenebergSiegessaeule)).toBeLessThan(-.99);
    expect(d.hauptbahnhofMoabit - d.potsdamerTor).toBeCloseTo(Math.PI, 9);
    expect(d.schoenebergSiegessaeule - d.reichstag).toBeCloseTo(Math.PI, 9);
  });

  test("retains all seven image identities, source receipts, estimates and two distinct OSM owners", () => {
    expect(evidence.ownerPhotos).toHaveLength(7);
    expect(new Set(evidence.ownerPhotos.map((p: { sha256: string }) => p.sha256)).size).toBe(7);
    for (const photo of evidence.ownerPhotos) {
      expect(photo.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(photo.pixelsBundled).toBeFalse(); expect(photo.referenceOnly).toBeTrue();
    }
    expect(evidence.municipalLampReceipts).toEqual(SOURCE_LAMP_RECEIPTS_V286);
    expect(evidence.lampAnchors).toEqual(GOVERNMENT_STREET_LAMP_ANCHORS_V286);
    expect(evidence.heightStatus).toContain("display fallback");
    expect(evidence.wayfinding.sourceNodeId).toBe(GOVERNMENT_WAYFINDING_PLACEMENT_V286.sourceNodeId);
    expect(evidence.wayfinding.directions).toEqual(GOVERNMENT_WAYFINDING_PLACEMENT_V286.directions);
    expect(evidence.wayfinding.separateGuideposts.map((p: { id: string }) => p.id)).toEqual(["10298343088", "5151420229"]);
    expect(evidence.excludedMunicipalRecords.map((p: { id: string }) => p.id)).toEqual(["231368", "231334"]);
    for (const reference of evidence.references) expect(reference.responseSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence.photographicPixelsBundled).toBeFalse(); expect(evidence.runtimeMediaRequests).toBeFalse();
    expect(evidence.bluePedestrianSigns.legible.at(-1).distanceM).toBeNull();
  });
});
