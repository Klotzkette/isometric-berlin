import type { Mesh } from "three";
import type { SurfaceFinish } from "./architecturalFinishTypes";

// These are the source builders' sRGB paints, before the viewer applies light.
// A colour is meaningful only on its named owner. In particular, the ministries
// share batches with signs, courtyards and gardens whose colours stay outside.
const federalOpenings: SurfaceFinish = {
  glass: [0x52636a, 0x53646d, 0x526a77, 0x4d6673, 0x52615e, 0x53656b, 0x4f646a, 0x526a74, 0x526f75],
  masonry: [0xcac8bc, 0xcdbb96, 0xd2cfc2, 0xcbc9bd, 0xcbc3b1, 0xcbc0a5, 0x515751, 0xcccac0, 0xbcc6c2, 0xc8b58d],
};
const charlottenburg: SurfaceFinish = {
  masonry: [0xe1d3ba, 0xc9b28e, 0xd7c4a4, 0xac9476, 0xb59e80, 0x807c73, 0xb69e7d],
  glass: [0x334047, 0x526168], metal: [0x312d29],
};
const districtStones: ReadonlyArray<readonly [string, number]> = [
  ["charlottenburg", 0xd0c1a4], ["wedding", 0xbdad91], ["wedding-mahn", 0xc7c2b7],
  ["koepenick", 0xc8b7a2], ["koepenick-grundbuch", 0xb5b6ac], ["kreuzberg", 0xc8b49c],
  ["kreuzberg-familie", 0xb8bdb9], ["lichtenberg", 0xd1c3a8], ["lichtenberg-archiv", 0xae8062],
  ["mitte", 0xcfbeab], ["neukoelln", 0xc6ac8f], ["pankow", 0xc3b298],
  ["pankow-familie", 0xc3bca9], ["schoeneberg", 0xa59679], ["schoeneberg-ring", 0xc9b59c],
  ["spandau", 0xccbfa8], ["tegeler-neubau", 0xc0b4a8], ["tiergarten-moabit", 0xbcaa8e],
];
const districtFronts = new Map<string, SurfaceFinish>(districtStones.map(([key, stone]) => [key, {
  masonry: [stone, 0xd9cdb7, 0xd4c9b4, 0xd2c4ac], glass: [0x697f80],
}]));

const finishes = new Map<string, SurfaceFinish>([
  ["Wedding Brunnenplatz curtain arch, tracery and double portal v333", {
    glass: [0x394a51], masonry: [0xa99d89, 0xc0b5a1, 0x74695e],
  }],
  ["Charlottenburg plaza rounded heads and carved pediment", charlottenburg],
  ["Charlottenburg plaza sandstone courses, windows and open iron balcony", charlottenburg],
  ["Court stonework, public fronts, church recognition and open Rolleracht bridge", { masonry: [0xcdbb97, 0xd8cfb9] }],
  ["Thin facade windows, pale frames and open tower members", {
    glass: [0x4c616b], masonry: [0xcbbea4], patina: [0x6c9686],
  }],
  ["Sozialgericht sandstone facade, portal and roof sculpture bodies", {
    glass: [0x718c98], metal: [0x30342f, 0xa7833d], patina: [0x68746c],
    masonry: [0x77736d, 0xcbb18a, 0xdac39d, 0xaa8e69],
  }],
  ["Source-bound ministry illuminated glazing", "glass"],
  ["Source-bound ministry reveals, unlit glazing and seven public colonnade arches", federalOpenings],
  ["BMJV-complete-source", "masonry"],
  ["BMWSB-complete-source", "masonry"],
  ["Ministry exact walls, open courts and source-qualified roofs", "masonry"],
  ["Ministry modern roof photovoltaic modules and lower-wing facades", {
    glass: [0x243b4e, 0x526d71], masonry: [0xdce0da],
  }],
  ["Bundeswirtschaftsministerium architectural details bodies", {
    glass: [0x5b777c, 0x4b666b], masonry: [0xe9ebe5, 0xeee7d8], metal: [0x4a5558],
  }],
  ["Bendlerblock measured walls and roofs with three open source passages", {
    masonry: [0xc1b59e, 0xd7d3c9, 0x9d563e, 0x776f63],
  }],
  ["Bendlerblock pale window frames, cornices and Ehrenhof", {
    masonry: [0xa79f90, 0xd8d0bd, 0xaea38e, 0xd5cdbb], glass: [0x637879],
  }],
  ["Richard Scheibe bound figure facing the court entry", "patina"],
  ["Bendlerblock recognition details bodies", {
    masonry: [0xc8c1b3, 0xe4ded1], glass: [0x52676b], metal: [0x363d3e], patina: [0x527363],
  }],
  ["Detlev Rohwedder Haus source-bound architecture facade blocks", {
    masonry: [0xc9c6b5, 0xdad7c5, 0xb1b1a4], glass: [0x536b70], patina: [0x838d80],
  }],
  ["Measured BMAS stone planes and Quartier 206 folded fronts", {
    masonry: [0xcac4b1, 0xbbab8f, 0xdbd9cc], glass: [0x617c85],
  }],
  ["BMAS framed openings, rustication and Quartier 206 limestone ribbons", {
    masonry: [0xcac4b1, 0xe4dfcd, 0xbbab8f, 0x978b78], glass: [0x617c85, 0x435d64],
  }],
  ["Measured ministry facade planes and exposed technical screens", {
    masonry: [0x8c9e91], glass: [0x637e7d], metal: [0x34494b],
  }],
  ["Ministry green stone fins, pale panels, bronze frames and entrance glazing", {
    masonry: [0x8c9e91, 0xadb9ae], glass: [0x637e7d, 0x24464c], metal: [0xa59a79],
  }],
  ["North rail concrete, rails, catenary and park furniture", {
    glass: [0x66858b, 0x92a8a7], masonry: [0x6d7976, 0xd5cdb9],
  }],
  ["Source-bound Foreign Office street elevations v344 stone", {
    masonry: [0xcac7ba, 0xa6a79e, 0xc4c2b7], metal: [0x626b62, 0x848d88],
  }],
  ["Source-bound Foreign Office street elevations v344 glass", "glass"],
  ["foreignOfficeOld official LoD2 walls and roof", "masonry"],
  ["foreignOfficeNew official LoD2 walls and roof", "masonry"],
  ["Foreign Office glass atria official LoD2 walls and roof", "glass"],
  ["Potsdamer ministry source facade relief stone", {
    masonry: [0xe4e1d4, 0xaca28f, 0xc5b39a, 0xd2c1a8],
  }],
  ["Potsdamer ministry source facade relief glass", "glass"],
  ["Potsdamer ministry source facade relief arched-glass", "glass"],
  ["Potsdamer ministry source facade relief segmental-glass", "glass"],
  ["Bundesumweltministerium historic building official LoD2 walls and roof", "masonry"],
  ["Bundesumweltministerium northern extension official LoD2 walls and roof", "masonry"],
  ["Bundesumweltministerium southern extension official LoD2 walls and roof", "masonry"],
  ["Bundesumweltministerium covered inner atrium official LoD2 walls and roof", "glass"],
  ["Senate upper source-contained frames", "masonry"],
  ["Senate upper source-contained glazing", "glass"],
  ["education-bounded-roof", "masonry"],
  ["urban-bounded-roof", "masonry"],
  ["oranien-complete-source", { glass: [0x44585f], masonry: [0x8e4635, 0xd1cab8] }],
  ["Rathaus Wilmersdorf shared rectangular windows v227", { glass: [0x6d8b92], masonry: [0xdedfd0] }],
  ["Rathaus Wilmersdorf source-bound cornices, clocks and mapped entrance frames v227", {
    masonry: [0xc5c9bd, 0xdedfd0],
  }],
  ["Retained Litten and Stadthaus exterior profiles, Instanz name and Münze court fittings", {
    masonry: [0xc5baa4, 0xd8ceb8, 0xbfb8a5, 0xa5a18f], metal: [0x8d9188],
  }],
]);

for (const key of ["BMI", "BMJV", "BMBFSFJ", "BMDS", "BMG", "BMLEH", "BMZ", "BMWSB"]) {
  finishes.set(key + "-public-facade-veneer", "masonry");
}

const moabitWalls: SurfaceFinish = { masonry: [0xcec8b5] };
const moabitOpenings: SurfaceFinish = { glass: [0x354a4b], masonry: [0xd9d6c4, 0xc4bca7, 0xd4ccb8, 0xbbb4a1] };
const senatePacket: SurfaceFinish = {
  glass: [0x526870, 0x6a7c83, 0x4a626b, 0x657983],
  masonry: [0xcbc2ab, 0xaca492, 0xc2b8a0, 0xd6cfb9, 0xaaa492, 0xc9c3ae],
};

export function civicArchitecturalFinish(mesh: Mesh): SurfaceFinish | undefined {
  if (mesh.userData.districtCourtEnvelopesV229) return "masonry";
  if (mesh.userData.districtCourtsV229) return districtFronts.get(mesh.userData.siteKey);
  // Drawn Moabit uses two unnamed objects: the separate LoD2 skin and its fittings.
  if (!mesh.name && mesh.parent?.name === "Moabit criminal court, prison exterior and Lesser-Ury houses") {
    return mesh.geometry.hasAttribute("color") ? moabitWalls : moabitOpenings;
  }
  return finishes.get(mesh.name);
}

/** Only the Senate joinery record inside a shared city packet owns these colours. */
export function civicPacketFinish(kind: string): SurfaceFinish | undefined {
  return kind === "berlin-senate-v321" ? senatePacket : undefined;
}

type CivicMeshPart = { kind: string; positions: string; colors: string; indices: string };

function packetFieldHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}

// The retained V326 draw packet merges eight building families with identical paints.
// Replaying its measured sheets identifies only these vertices as exclusively WallSurface
// on DEBE09YYP0002tOa (two parts) or DEBE09YYP0003JNQ (one part), Mandrellaplatz 6.
// Ground/roof-shared vertices are excluded. A changed vertex order or topology expires the ranges.
const koepenickCourtWallRanges = [[42, 49], [86, 120], [444, 451]] as const;

export function markKoepenickCourtWalls(
  id: string, part: CivicMeshPart, vertexOffset: number, mark: (vertex: number) => void,
): void {
  if (id !== "publicInstitutions326-27_14-p0" || part.kind !== "public-institutions-v326") return;
  if (part.positions.length !== 3680 || part.colors.length !== 1840 || part.indices.length !== 9568) return;
  if (packetFieldHash(part.positions) !== 0xcbdf1d79 || packetFieldHash(part.colors) !== 0x0a5b20ad ||
      packetFieldHash(part.indices) !== 0x1e72b4f2) return;
  for (const [first, last] of koepenickCourtWallRanges) {
    for (let i = first; i <= last; i++) mark(vertexOffset + i);
  }
}
