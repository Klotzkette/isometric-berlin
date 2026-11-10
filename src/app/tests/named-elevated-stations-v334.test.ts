import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import data from "../src/data/namedElevatedStationsV334.json";
import {
  namedElevatedFloorAtV334,
  namedSiteNavigationV238,
  prepareNamedSiteV238,
  type NamedSiteSourceV238,
} from "../src/namedSiteReplacementsV238";
import {
  createSurroundingCityChunk,
  surroundingBuildingSolidAt,
  type SurroundingCityChunk,
} from "../src/SurroundingCityGeometry";
import {
  createPedestrianState,
  stepPedestrian,
  type PedestrianEnvironment,
} from "../src/pedestrianNavigation";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

const source = data as unknown as NamedSiteSourceV238;

function finish<T>(operation: Generator<void, T>): T {
  let result = operation.next();
  while (!result.done) result = operation.next();
  return result.value;
}

function packet(tile: string, mode: string): SurroundingCityChunk {
  return JSON.parse(gunzipSync(readFileSync(new URL(
    `../public/mesh/surrounding-berlin-v159/${tile}.${mode}.json.gz`, import.meta.url,
  ))).toString());
}

function inside(ring: readonly number[][], x: number, z: number): boolean {
  let contained = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = [ring[i], ring[j]];
    if ((a[1] > z) !== (b[1] > z) && x < a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1])) {
      contained = !contained;
    }
  }
  return contained;
}

test("all four named tiles install both complete geometry families on their exact city packets", () => {
  for (const key of data.keys) {
    const [mode, tile] = key.split(":");
    const native = mode === "minecraft";
    const original = packet(tile, mode);
    const prepared = finish(prepareNamedSiteV238(original, tile, native, source));
    expect(prepared.meshes.slice(0, -1)).toEqual(original.meshes);
    expect(prepared.meshes.at(-1)?.kind).toBe("named-elevated-v334");
    expect(prepared.nav).toBe(original.nav);
    const { root } = createSurroundingCityChunk(prepared, tile, native);
    try {
      expect(root.userData.sourceKinds).toContain("named-elevated-v334");
    } finally {
      disposeSurroundingCityRoot(root);
    }
    const { indices } = original.meshes[0];
    const changed = {
      ...original,
      meshes: [{ ...original.meshes[0], indices: (indices[0] === "A" ? "B" : "A") + indices.slice(1) },
        ...original.meshes.slice(1)],
    };
    expect(finish(prepareNamedSiteV238(changed, tile, native, source))).toBe(changed);
  }
});

test("the street remains clear below Schönhauser Allee and the mapped middle run reaches the platform", () => {
  const owners = new Set(["OSM-way-375386234", "OSM-way-465412568", "OSM-way-465412570"]);
  for (const mode of ["drawn", "minecraft"]) {
    const original = packet("5_-7", mode);
    const prepared = finish(prepareNamedSiteV238(original, "5_-7", mode === "minecraft", source));
    const nav = namedSiteNavigationV238(prepared, original.nav);
    const model = nav.buildings.slice(original.nav.buildings.length - 3);
    expect(nav.buildings.slice(0, -model.length)).toEqual(original.nav.buildings.filter(b => !owners.has(b.sourceId)));
    const [ox, , oz] = original.origin;
    const tops = (x: number, z: number) => model.filter(b =>
      inside(b.ring, x - ox, z - oz) && !b.holes.some(h => inside(h, x - ox, z - oz)))
      .map(b => [b.minHeight + nav.groundY, b.height + nav.groundY]);
    expect(tops(2941, -3350).every(([low]) => low > 7.9)).toBe(true);
    expect(tops(2941, -3350).some(([, high]) => high > 13.9)).toBe(true);
    expect(namedElevatedFloorAtV334(nav, 2941 - ox, -3323 - oz, 6)).toBeCloseTo(5.98);
    expect(namedElevatedFloorAtV334(nav, 2940 - ox, -3315 - oz, 7.55)).toBeCloseTo(7.54);
    expect(namedElevatedFloorAtV334(nav, 2939 - ox, -3304 - oz, 9.60)).toBeCloseTo(9.62);
    expect(namedElevatedFloorAtV334(nav, 2939 - ox, -3304 - oz, 3)).toBeNull();
    expect(namedElevatedFloorAtV334(original.nav, 2939 - ox, -3304 - oz, 9.60)).toBeNull();
  }
});


test("the actual walking controller ascends the south U2 stairs without snapping up from the street", () => {
  for (const mode of ["drawn", "minecraft"]) {
    const native = mode === "minecraft";
    const original = packet("5_-7", mode);
    const prepared = finish(prepareNamedSiteV238(original, "5_-7", native, source));
    const { root, origin: [ox, , oz], nav } = createSurroundingCityChunk(prepared, "5_-7", native);
    try {
      const bounds = { minX: 2910, minZ: -3285, maxX: 2980, maxZ: -3195 };
      const env: PedestrianEnvironment = {
        bounds,
        groundAt: () => 3,
        interiorGroundAt: (x, z, currentY) => namedElevatedFloorAtV334(nav, x - ox, z - oz, currentY),
        extension: {
          bounds, groundAt: () => 3, waterAt: () => false,
          solidAt: (x, y, z, radius) => surroundingBuildingSolidAt(nav, x - ox, y, z - oz, radius),
        },
        water: [],
      };
      // The south flight follows exact OSM way/375386244.
      const yaw = Math.atan2(0.13142016410597893, 0.9913267576668944);
      let person = createPedestrianState(env, { x: 2929.303, z: -3231.623, yaw });
      expect(person.groundY).toBe(3);
      for (let i = 0; i < 550 && person.z > -3247.55; i++) {
        person = stepPedestrian(person, { forward: 1, turn: 0, look: 0, strafe: 0, sprint: false }, .025, env).state;
      }
      expect(person.z).toBeLessThan(-3247.45);
      expect(person.groundY).toBeCloseTo(9.62);
      expect(env.interiorGroundAt?.(person.x, person.z, 3)).toBeNull();
    } finally {
      disposeSurroundingCityRoot(root);
    }
  }
});
