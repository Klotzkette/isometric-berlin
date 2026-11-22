import { Material, type Mesh, type MeshStandardMaterial } from "three";
import type { SurfaceFinish } from "./architecturalFinishTypes";

// These are paint values from the corresponding model builders. A single batch often
// also contains lettering, timber, paving or planting, so its name alone is insufficient.
const museumTriad = {
  masonry: [0xd8cdb8, 0x998b76, 0xb3ac99, 0xc5bca9, 0xc9ad8c],
  glass: [0x526b72, 0xa9babb],
  metal: [0x697d7e],
};
const deutschesTheater = {
  masonry: [0xeeece5, 0xdeddd7, 0xd4d0c6],
  glass: [0x46606a],
  metal: [0x343d3e, 0x9b563f],
};
const tiergartenMonuments = {
  patina: [0x709185, 0x415f55, 0x91aa9a], masonry: [0xa17564, 0x825c50, 0xe4ddcc, 0xc3bdaa], metal: [0xba9245],
};
const funkturmFittings = { metal: [0x9f9e91, 0x5c635e], glass: [0x577681] };
const aokWindows = { glass: [0x4b5555], metal: [0xc3c6bd] };
const embassyMaterials = new Map<number, SurfaceFinish>([
  [0xd8d3c7, "masonry"], [0xc9ad87, "masonry"], [0xe4dfd3, "masonry"], [0xe2e2de, "masonry"],
  [0x70898d, "glass"], [0x8fa5a7, "glass"],
]);
const literaryMemorial = { masonry: [0xe7e3d6, 0xaaa9a3, 0x987368, 0xaaa79f], patina: [0x486d63] };
const parkSculptures = {
  masonry: [0xe8e5dc, 0x9d7a6e, 0xaaa69d, 0xd8cbb0, 0xeee6d5],
  patina: [0x344b43, 0x60857a, 0x7b9b91, 0x45665d], glass: [0x5f9fc4],
};
const facade = new Map<string, SurfaceFinish>([
  ["Thirty retained LoD2 tower parts", { masonry: [0xcfc8b0], metal: [0xe4e5dd] }],
  ["Source-clipped limestone windows glass crown and staggered aluminium facade", {
    glass: [0x45616b, 0x4d6971, 0x3d5660, 0x78968f, 0x657f7e, 0x587377],
    metal: [0xacb6aa, 0xf0eee5, 0xeeede3, 0xe8e8df], masonry: [0xc8c1a9],
  }],
  ["BahnTower frame", { metal: [0x72888e, 0x344a51, 0xb5c5c4] }],
  ["BahnTower glass", { glass: [0x9caead, 0x77959e, 0x91abb0, 0x9eb6b9] }],
  ["BahnTower crown", "glass"],
  ["Estrel exact mapped tower and podium sloping envelopes", {
    glass: [0x667b7f, 0x8b9b9a, 0x8ca3a0, 0x5d7a7d, 0x91a8a6],
    masonry: [0xaeb4ad, 0xbcc2be],
  }],
  ["Source-clipped windows and silver mullions", {
    glass: [0x577787, 0x657c84, 0x647c75], metal: [0xb5bec0],
  }],
  ["Charité paired panes, vertical lesenes and rooftop screen", {
    glass: [0x51696f, 0x718589], metal: [0xb8c3c5, 0x707e82],
  }],
  ["Measured-facade EUREF fittings and open 78 m Gasometer frame", {
    glass: [0x597b82, 0x9ca995, 0x6f9191, 0x617d86, 0x485f6d],
    metal: [0x555f63, 0xa6afac, 0xabb4af, 0x8b9390, 0x727b7b, 0x6e7775], masonry: [0xa96749],
  }],
  ["Europacity framed glazing", "glass"],
  ["Europacity facade masonry and metal", { masonry: [0xded9c9, 0x946650] }],
  ["Bikini transparent panorama storeys", "glass"],
  ["Bikini window frames, coloured spandrels, steps and lettering", {
    glass: [0x78918d], metal: [0x7f9082, 0xb29669],
  }],
  ["Sony Center curved Forum glass facades", "glass"],
  ["Sony Center glass roof sectors", "glass"],
  ["Sony Center stainless facade rails", "metal"],
  ["Sony Center stainless vertical mullions", "metal"],
  ["Sony Center membrane field clamp rails", "metal"],
  ["Sony Center twelve upper ridge cables", "metal"],
  ["Sony Center twelve upper valley cables", "metal"],
  ["Sony Center forty-eight cable junction nodes", "metal"],
  ["Sony Center oval ring truss", "metal"],
  ["Sony Center radial roof cables", "metal"],
  ["Fernsehturm observation 203 m and restaurant 207 m window belts", "glass"],
  ["Fernsehturm window mullions and open maintenance rails", "metal"],
  ["Fernsehturm pavilion glazing, frames, gallery rails and steps", {
    glass: [0x63898d], metal: [0x667d7d], masonry: [0xd4d2bf],
  }],
  ["Funkturm: bounded steel and architectural details", {
    glass: [0x6d8990, 0x758d91, 0x719091], metal: [0x8f8a77, 0xa49a83, 0xbcb6a0, 0xb9b4a4, 0xb9bab0],
  }],
  ["Glockenturm: bounded steel and architectural details", { masonry: [0xc9c2ab, 0xcfc8b3, 0xb9b29f, 0xbeb8a6] }],
  ["Olympiastadion: bounded steel and architectural details", { masonry: [0xbfb7a1, 0xc3bba6], metal: [0xbcc4c0] }],
  ["Restrained windows, fine scaffold lattice, crane and nine mirror panels", {
    metal: [0xb7bab0, 0x8d9a90, 0x9eaba0, 0xa7b7ba, 0xbcc7c7],
  }],
  ["Museum triad architectural details box", museumTriad],
  ["Museum triad architectural details column", museumTriad],
  ["Kulturforum museums source architecture facade and native blocks", {
    glass: [0x46616a, 0x86a8b5, 0xb1c5c5], metal: [0xb8bfb7],
    masonry: [0x9b5544, 0xa96351, 0xc6c2b5, 0xd6c4a0, 0xe2d4b6],
  }],
  ["Museum and Lenne source-bound architecture facade blocks", {
    masonry: [0xb9b8b0, 0xe4e4d9], glass: [0x3c5960, 0x648086], metal: [0xcad3d1, 0xc79d42, 0xe2be57],
  }],
  ["Deutsches Theater details facade blocks", deutschesTheater],
  ["Deutsches Theater details glazing and lettering", deutschesTheater],
  ["Carillon overhanging patinated flying-bowl roof", "patina"],
  ["Carillon shallow four-sided roof cap", "patina"],
  ["Carillon 68 bronze bells", "patina"],
  ["Carillon player cabin at 33 m", "glass"],
  ["Granitschale hollow polished red-granite basin", "masonry"],
  ["Concert halls measured shells bodies", {
    metal: [0xd5b767, 0xc2c8c8], glass: [0x799797], masonry: [0xe4e5da, 0xe7e8df],
  }],
  ["Concert halls gold panel seams bodies", { metal: [0xad8d43, 0xe5e8de], glass: [0x68888c] }],
  ["Concert halls mapped main entrance glass doors bodies", { glass: [0x5d797d], metal: [0xd7dcda] }],
  ["Complete 71-part measured Schiller and Deutsche Oper roofs and walls", { masonry: [0xc7c0ac, 0x9d9f97] }],
  ["Opera theatre source-bound metal ribs, facade glazing and geometric signs", {
    glass: [0x466d71, 0x426467], metal: [0xaaafa6], masonry: [0x737e7a],
  }],
  ["Bismarck-Nationaldenkmal bodies", tiergartenMonuments],
  ["Moltke-Denkmal bodies", tiergartenMonuments],
  ["Four existing-foot steel and porcelain bearings: small steel and concrete members", funkturmFittings],
  ["Open stair flights beside retained lift: small steel and concrete members", funkturmFittings],
  ["Restaurant kitchen, inclined glazing and canopy rim: small steel and concrete members", funkturmFittings],
  ["Upper platform guardrails and existing mast aerials: small steel and concrete members", funkturmFittings],
  ["Central transit and civic details bodies", {
    metal: [0xdde2df, 0xcbd2d0], glass: [0x315d69, 0x386b78], // Futurium facade shingles and photovoltaic panels
  }],
  ["Parliament source-bound architecture facade and roof details", {
    masonry: [0xd6d7cb, 0xe6e5d8, 0xcac7b5], glass: [0x597e87, 0x72989d], metal: [0x939f9c],
  }],
  ["Paul-Löbe canopy bodies", { masonry: [0xf1ece0, 0xe1dbcb, 0xe8e2d5], glass: [0xd8e2e2] }],
  ["Nationalgalerie open steel and glass pavilion v183 stone", {
    metal: [0x13191a, 0x090e0f, 0x151b1c, 0x080c0d, 0x182021],
    masonry: [0xb8b4aa],
  }],
  ["Exact retained Nationalgalerie terrace footprint", "masonry"],
  ["Goethe memorial structural silhouette bodies", literaryMemorial],
  ["Goethe memorial fine allegory and fence cues bodies", literaryMemorial],
  ["Lessing memorial structural silhouette bodies", literaryMemorial],
  ["Lessing memorial relief allegory and fence cues bodies", literaryMemorial],
  ["Berlin Pavillon transparent storefront glazing", "glass"],
  ["Bebelplatz transparent walkable glass pane", "glass"],
  ["Helene Weigel clear glass vitrine", "glass"],
  ["Luisen corridor framed glazing", "glass"],
  ["Zoo hall transparent source curtain walls", "glass"],
  ["ARD Hauptstadtstudio atrium roof glazing", "glass"],
  ["traffic tower glazing", "glass"],
  ["Friedrichstrasse facade glazing", "glass"],
  ["Topography glazing and protective canopy", "glass"],
  ["City West Europa Center and Allianz towers bodies", {
    glass: [0x34474a, 0x477b80, 0x213744], metal: [0xb8c0bd], masonry: [0xd8c6a5],
  }],
  ["Europa-Center silver Mercedes ring and tapered arms bodies", "metal"],
  ["Gedächtniskirche blue concrete-glass cells lamps", "glass"],
  ["Gedächtniskirche and Breitscheidplatz ensemble bodies", {
    masonry: [0x999387, 0xb4ad9e, 0xaaa497, 0x95968d, 0xb2ac9d, 0x81867e, 0x9f9b90, 0xaca99d],
    patina: [0x657e79, 0x708a84, 0x607772, 0x81938a, 0x435e5a, 0x526d68],
  }],
  ["Zoo Palast ceramic joints canopy brass entrance and programme cases", {
    masonry: [0xbba96f], metal: [0xc7ab64],
  }],
  ["Neue Synagoge gold ribs roundels horseshoe arches and three star finials", {
    metal: [0xd4ab4c], masonry: [0xd0bfa0, 0x776a57, 0x8c795d],
  }],
  ["Neue Synagoge brick bands terracotta rosettes cornices and paired lancets", {
    masonry: [0xa9987c, 0xd0bfa0, 0x786952, 0x7a6b53, 0x887657],
  }],
  ["Friedrichstadt-Palast concrete frames and roof", { masonry: [0xbebcb0, 0xd7d4c7], metal: [0x7f8a87] }],
  ["Friedrichstadt-Palast arched concrete-glass fields", {
    glass: [0x3c5156, 0xbbcfcc, 0x839eab, 0xd9d8cb, 0xa49fae, 0xc2ba9e, 0x9eafb2, 0xbecbc3, 0x96a9b1, 0xc4bca9],
  }],
  ["Alexander Calder — Têtes et Queue (1965) continuous sculpted surface", { metal: [0x20282b, 0x262d2e, 0x1c2428] }],
  ["Henry Moore — Three Way Piece No. 2: Archer (1964) continuous sculpted surface", { patina: [0x6c634d, 0x746951, 0x817352] }],
  ["Reichstag dark tall arched facade windows", "glass"],
  ["Reichstag selectively lit tall arched facade windows", "glass"],
  ["Reichstag dark upper rectangular facade windows", "glass"],
  ["Reichstag dark three-bay tower arched windows", "glass"],
  ["Reichstag dark upper corner-tower windows", "glass"],
  ["Reichstag bounded glazing bars and arch joint batch", { metal: [0x677372], masonry: [0x878174] }],
  ["Reichstag west continuous facade cornice", "masonry"],
  ["Reichstag west portico entablature", "masonry"],
  ["Reichstag west portico column plinth rings", "masonry"],
  ["Reichstag west portico Corinthian capital leaves", "masonry"],
  ["Reichstag portico architrave moulding", "masonry"],
  ["Reichstag aluminium louvre sunshade", "metal"],
  ["daylight mirror cone 360 individual panels", "metal"],
  ["Siegessäule and Bismarck bodies", {
    masonry: [0xb9ae94, 0xc8bda3, 0xb3a68b, 0xa99e87], metal: [0xe4be58, 0xf4d37a],
  }],
  ["St Hedwig green copper domes bodies", "patina"],
  ["St Hedwig source-bound stone and portico bodies", { masonry: [0xcfc0a5, 0xe0d3b9], glass: [0x526b70], metal: [0xc9b269] }],
  ["Charlottenburger Tor source-aligned wings v201 bodies", { masonry: [0xd8c6a8], patina: [0x557e6d] }],
  ["Thin brick backing arched panes and missing octagonal masonry spire", { masonry: [0xb3a07a, 0xd4c5a3, 0xa99569], glass: [0x414746] }],
  ["Zionskirche pale brick bands cornices pilasters and portal doors", { masonry: [0xb3a07a, 0xd4c5a3] }],
  ["Reisens thin aluminium grid and concave shell members", {
    glass: [0x668594], metal: [0xcacac1, 0xdddcd1], masonry: [0xdbd9ca],
  }],
  ["Brandenburg Gate measured guard rooms and open sandstone entablatures", "masonry"],
  ["Brandenburg Gate crossed standing-seam copper roofs", "patina"],
  ["Brandenburg Gate guardroom portals and divided upper lights", { glass: [0x414b49] }],
  ["Brandenburg Gate open hall fluted sandstone columns", "masonry"],
  ["Brandenburg Gate instanced Doric capital abaci", "masonry"],
  ["Brandenburg Gate pavilion portico columns", "masonry"],
  ["Brandenburg Gate entablature", "masonry"],
  ["Brandenburg Gate sculpted frieze band", "masonry"],
  ["Brandenburg Gate pavilion cornice", "masonry"],
  ["Quadriga bodies", "patina"],
  ["Quadriga manes", "patina"],
  ["Quadriga robe folds", "patina"],
  ["Quadriga tails", "patina"],
]);
const architecture = new Map<string, SurfaceFinish>([
  ["Molecule Man source-aligned three figures v183", "metal"],
  ["Alexander north: complete Park Inn, Pressehaus, Tor and street sources", {
    glass: [0x68828e, 0x7c96a1, 0x536d7b, 0x50676c, 0x91a7b2], metal: [0xc1cbce], masonry: [0xd8d2bc],
  }],
  ["Humboldt entrance and Bebelplatz source-bound facades", {
    masonry: [0xd9d3c2, 0xe6dfcf, 0xcdbb97], glass: [0x526d75], metal: [0xbfa24a],
  }],
  ["Gendarmenmarkt dome towers, portico and public square", {
    masonry: [0xd6c6a7, 0xe7ddc7, 0xad9d7e], glass: [0x455353],
    patina: [0x718b7b, 0x899782, 0x5b6657], metal: [0xc7a355],
  }],
  ["Estrel aluminium fins, curtain wall grid and independent Native body v345", {
    metal: [0xb5bfbd, 0xa2aca9, 0x394a50, 0xc1c9c6],
  }],
  ["Rotes Rathaus and St. Marien source-bound architecture", {
    masonry: [0xac5f42, 0xc07d52, 0x89533e, 0xb7aa83, 0xd3cbbb],
    glass: [0x3b5258], patina: [0x7dafa0, 0x527c6f], metal: [0xd3ba69],
  }],
  ["Schloss and Naturkunde source-bound facade recognition", {
    masonry: [0xe3d0a7, 0xece1c5, 0xb8a780, 0xdcd8cf], glass: [0x4b6266, 0x576466],
    patina: [0x775443, 0x9d7850, 0xa17a58], metal: [0xd5b44f],
  }],
  ["Eastern Unter den Linden palais and Friedrich monument", {
    masonry: [0xddd2bb, 0xefe6d4, 0x8e7971], glass: [0x42595e], patina: [0x405750, 0x687b66],
  }],
]);

export function skylineArchitecturalFinish(mesh: Mesh): SurfaceFinish | undefined {
  // The facade builder puts actual panes in dedicated batches even when their
  // neighbours (frames, signs, lamps) all draw together in a single solids mesh.
  if (mesh.userData.facadeOnly && /(?: |-)glass$/.test(mesh.name)) return "glass";
  if (/^Reichstag west portico column(?: base)? [1-6]$/.test(mesh.name) ||
      /^Brandenburg Gate (?:Doric column|column base|Doric capital) [12]:[1-6]$/.test(mesh.name)) return "masonry";
  const parent = mesh.parent?.name;
  if (parent === "OSM Tiergarten monuments" && mesh.name === "monument bodies") return parkSculptures;
  if (mesh.name.startsWith("Swiss Embassy ")) {
    // This model reuses unpainted geometry and keeps each actual finish in its material.
    const day = mesh.userData.dayMaterial;
    const surface = (day instanceof Material ? day : mesh.material) as MeshStandardMaterial;
    const paint = surface.color?.getHex();
    return paint === undefined ? undefined : embassyMaterials.get(paint);
  }
  if (parent === "AOK Nordost · Verwaltungshochhaus") {
    return "instanceColor" in mesh ? aokWindows : "masonry";
  }
  return facade.get(mesh.name) ?? (parent ? architecture.get(parent) : undefined);
}

// Dedicated packed parts are kept separate from their neighbouring meshes by the packet renderer.
const packed = new Map<string, SurfaceFinish>([
  ["nikolaikirche-v353", {
    patina: [0x669083, 0x6c9689, 0x729c8f, 0x537d70], metal: [0xbc9b51],
    masonry: [0x8d4f3d, 0x6f7167, 0x979382],
  }],
  ["quartier207-v241", {
    glass: [0x3e5558, 0x4b686c, 0x58747a, 0x66848b, 0x708f96, 0x7e9aa0], metal: [0xb5bcb5, 0x7a9396],
  }],
  ["ihz-v241", {
    glass: [0x455b5a, 0x425857, 0x485e5d, 0x4f6564, 0x4c6261, 0x526867],
    masonry: [0xa9a89f, 0xbcbbb2, 0xcbc4b5], metal: [0x9da199],
  }],
  // Both models bake five isometric face shades into the source swatches.
  ["staatsoper-v240", {
    masonry: [0xddd7be, 0xd8d2ba, 0xd2ccb4, 0xd5cfb7, 0xdbd5bc, 0xc7c3af, 0xc2bfab, 0xbdb9a6, 0xc0bca9, 0xc5c1ad],
    glass: [0x526368, 0x506166, 0x4d5e62, 0x4f5f64, 0x516267],
  }],
  ["staatsbibliothek-v241", {
    masonry: [0xd7d1bc, 0xd2ccb8, 0xccc6b2, 0xcfc9b5, 0xd5cfba, 0xbdbaa8, 0xb9b6a4, 0xb3b19f, 0xb6b3a2, 0xbbb8a6],
  }],
]);

export function skylinePacketFinish(kind: string): SurfaceFinish | undefined {
  return packed.get(kind);
}
