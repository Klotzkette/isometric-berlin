import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { BoxGeometry, Color, InstancedBufferAttribute, InstancedMesh, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, type WebGLRenderer } from "three";
import { civicArchitecturalFinish, civicPacketFinish, markKoepenickCourtWalls } from "../src/civicArchitecturalFinish";
import { markMappedBuildingWalls } from "../src/highRiseWallFinish";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { courtPaneMasksV333 } from "../src/CourtsParkV293";
import { createDistrictCourtEnvelopesV229 } from "../src/DistrictCourtEnvelopesV229";
import { createDistrictCourtsV229 } from "../src/DistrictCourtsV229";
import { createFederalMinistriesV321, hasCompleteFederalMinistriesV321 } from "../src/FederalMinistriesV321";
import { presentArchitecturalSheen } from "../src/architecturalSheen";
import { installGroundDrawCullingV383 } from "../src/groundDrawRangesV383";
import { groundRangeShaderSafeV383 } from "../src/groundRangeShaderProvenanceV383";
import { createForeignOfficeV344, FOREIGN_OFFICE_V344_NAME } from "../src/ForeignOfficeV344";
import { createBendlerblockV202 } from "../src/BendlerblockV202";
import { createDistrictTownhallsV227 } from "../src/DistrictTownhallsV227";
import { createEconomicMinistrySourceGeometry } from "../src/EconomicMinistrySourceGeometry";
import { createHbfNorthApproach } from "../src/HbfNorthApproach";
import { createLabourQuartierV208 } from "../src/LabourQuartierV208";
import { createLittenStadthausV297 } from "../src/LittenStadthausV297";
import { createMinistrySpreeV207 } from "../src/MinistrySpreeV207";
import { createPotsdamerMinistryArchitecture } from "../src/PotsdamerMinistryArchitecture";
import { createRohwedderHausArchitecture } from "../src/RohwedderHausArchitecture";
import { createMoabitJusticeV166 } from "../src/MoabitJusticeV166";
import federal from "../src/data/federalMinistriesV321.json";
import senate from "../src/data/berlinSenateV321.json";
import type { PrismBuilding } from "../src/IsometricCityWorld";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

function paintedSwatches(mesh: Mesh) {
  const colors = new Set<number>(), color = new Color();
  const vertex = mesh.geometry.getAttribute("color");
  if (vertex) for (let i = 0; i < vertex.count; i++) {
    color.setRGB(vertex.getX(i), vertex.getY(i), vertex.getZ(i));
    colors.add(color.getHex());
  }
  if (mesh instanceof InstancedMesh && mesh.instanceColor) for (let i = 0; i < mesh.count; i++) {
    mesh.getColorAt(i, color);
    colors.add(color.getHex());
  }
  return colors;
}

test("the Gate view culls the finished ministry facade while preserving unknown shader inputs", () => {
  const root = createFederalMinistriesV321(false, {sourcePrisms: federal.sourcePrisms as unknown as PrismBuilding[], mobileLike: true});
  try {
    const mesh = root.getObjectByName("Source-bound ministry reveals, unlit glazing and seven public colonnade arches") as InstancedMesh;
    const scene = new Scene();
    scene.add(root);
    scene.updateMatrixWorld(true);
    const camera = new PerspectiveCamera(16, 530 / 889, 0.25, 97000);
    camera.position.set(639.4495, 66.978, 368.1881);
    camera.lookAt(417.898, 17.734, 300.453);
    camera.updateMatrixWorld();
    const submitted: number[] = [];
    const renderer = {renderBufferDirect() {submitted.push(mesh.count);}} as unknown as WebGLRenderer;
    installGroundDrawCullingV383(renderer);
    const material = mesh.material as MeshBasicMaterial;
    const draw = () => {
      submitted.length = 0;
      renderer.renderBufferDirect(camera, scene, mesh.geometry, material, mesh, mesh.geometry.groups[0]);
      return [...submitted];
    };
    expect(mesh.count).toBe(40883);
    const ordinary = draw();
    expect(ordinary).toEqual([64]);
    presentArchitecturalSheen(mesh, "day");
    expect(draw()).toEqual(ordinary);
    expect(hasCompleteFederalMinistriesV321(root, false)).toBe(true);

    const sheen = material.onBeforeCompile;
    material.onBeforeCompile = shader => {shader.vertexShader += "\n// Foreign position or instance-ID code";};
    expect(draw()).toEqual([40883]);
    material.onBeforeCompile = sheen;
    mesh.geometry.setAttribute("customInstance", new InstancedBufferAttribute(new Float32Array(mesh.count), 1));
    expect(draw()).toEqual([40883]);
    mesh.geometry.deleteAttribute("customInstance");
    expect(draw()).toEqual(ordinary);
  } finally { disposeStaticAudit(root); }
});

test("architectural sheen keeps an existing external shader outside range culling", () => {
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(new BoxGeometry(), material);
  mesh.name = "LoD2 prism buildings";
  const external = material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\ntransformed.y += float(gl_InstanceID);");
  };
  presentArchitecturalSheen(mesh, "day");
  expect(material.onBeforeCompile).not.toBe(external);
  expect(groundRangeShaderSafeV383(material)).toBe(false);
  mesh.geometry.dispose();
  material.dispose();
});

test("district court masonry and windows follow 18 actual fronts, with the three plaque-only sites excluded", () => {
  const courts = createDistrictCourtsV229(false, courtPaneMasksV333());
  const envelopes = createDistrictCourtEnvelopesV229();
  try {
    expect(envelopes.children).toHaveLength(6);
    for (const mesh of envelopes.children) expect(civicArchitecturalFinish(mesh as Mesh)).toBe("masonry");
    const plaqueOnly: string[] = [];
    let mixedWithLettering = 0;
    for (const group of courts.children) {
      const mesh = group.children[0] as InstancedMesh;
      const finish = civicArchitecturalFinish(mesh);
      if (!finish) { plaqueOnly.push(mesh.userData.siteKey); continue; }
      expect(typeof finish).toBe("object");
      if (typeof finish === "string") throw Error("Mixed court front must select its own paint");
      const colors = paintedSwatches(mesh);
      expect(finish.masonry!.some(color => colors.has(color))).toBeTrue();
      // The small lettering and plaques share the draw with the stonework.
      if (colors.has(0x615449)) {
        expect(Object.values(finish).flat()).not.toContain(0x615449);
        mixedWithLettering++;
      }
    }
    expect(mixedWithLettering).toBeGreaterThan(10);
    expect(plaqueOnly.sort()).toEqual(["charlottenburg-register", "tiergarten-bereitschaft", "tiergarten-kirch"].sort());
    for (const name of ["Wedding Brunnenplatz curtain arch, tracery and double portal v333", "Charlottenburg plaza sandstone courses, windows and open iron balcony"]) {
      const finish = civicArchitecturalFinish(courts.getObjectByName(name) as Mesh);
      expect(typeof finish).toBe("object");
    }
  } finally {
    disposeStaticAudit(courts);
    disposeStaticAudit(envelopes);
  }
});

test("federal buildings retain their complete source receipt and each ministry's window and stone colors are present on the actual day members", () => {
  const root = createFederalMinistriesV321(false, {sourcePrisms: federal.sourcePrisms as unknown as PrismBuilding[]});
  try {
    expect(hasCompleteFederalMinistriesV321(root, false)).toBeTrue();
    for (const site of federal.sites) {
      const veneer = root.getObjectByName(site.key + "-public-facade-veneer") as Mesh;
      expect(civicArchitecturalFinish(veneer)).toBe("masonry");
    }
    const [mixed, lit] = root.children.slice(1) as InstancedMesh[];
    expect(civicArchitecturalFinish(lit)).toBe("glass");
    const profile = civicArchitecturalFinish(mixed);
    if (!profile || typeof profile === "string") throw Error("Missing color selection for federal row batch");
    const drawn = paintedSwatches(mixed);
    for (const site of federal.sites) {
      expect(profile.masonry).toContain(site.palette[0]);
      expect(profile.glass).toContain(site.palette[1]);
      expect(drawn.has(site.palette[0]) && drawn.has(site.palette[1])).toBeTrue();
    }
    expect(drawn.has(0xc8b58d) && profile.masonry!.includes(0xc8b58d)).toBeTrue();
    expect(hasCompleteFederalMinistriesV321(root, false)).toBeTrue();
  } finally { disposeStaticAudit(root); }
});

test("Foreign Office glass bands and both Moabit geometry encodings use their own finishes", () => {
  const foreign = createForeignOfficeV344()!, court = createMoabitJusticeV166();
  try {
    expect(civicArchitecturalFinish(foreign.getObjectByName(FOREIGN_OFFICE_V344_NAME + " glass") as Mesh)).toBe("glass");
    const masonry = civicArchitecturalFinish(court.children[0] as Mesh);
    const mixed = civicArchitecturalFinish(court.children[1] as Mesh);
    expect(masonry).toEqual({masonry: [0xcec8b5]});
    if (!mixed || typeof mixed === "string") throw Error("Missing Moabit window selection");
    expect(paintedSwatches(court.children[1] as InstancedMesh).has(mixed.glass![0])).toBeTrue();
    expect(civicArchitecturalFinish(new Mesh())).toBeUndefined();
  } finally { disposeStaticAudit(foreign); disposeStaticAudit(court); }
});

test("existing ministry and Senate producers expose real painted public members across the city", () => {
  const buildings = [
    [createBendlerblockV202(), "Bendlerblock pale window frames, cornices and Ehrenhof"],
    [createDistrictTownhallsV227(), "Rathaus Wilmersdorf shared rectangular windows v227"],
    [createEconomicMinistrySourceGeometry(), "Ministry modern roof photovoltaic modules and lower-wing facades"],
    [createHbfNorthApproach(() => 3), "North rail concrete, rails, catenary and park furniture"],
    [createLabourQuartierV208(), "BMAS framed openings, rustication and Quartier 206 limestone ribbons"],
    [createLittenStadthausV297(), "Retained Litten and Stadthaus exterior profiles, Instanz name and Münze court fittings"],
    [createMinistrySpreeV207(), "Ministry green stone fins, pale panels, bronze frames and entrance glazing"],
    [createPotsdamerMinistryArchitecture(), "Potsdamer ministry source facade relief stone"],
    [createRohwedderHausArchitecture(), "Detlev Rohwedder Haus source-bound architecture facade blocks"],
  ] as const;
  try {
    for (const [root, name] of buildings) {
      const mesh = root.getObjectByName(name) as InstancedMesh;
      const finish = civicArchitecturalFinish(mesh);
      if (!finish || typeof finish === "string") throw Error("Missing painted profile for " + name);
      const colors = paintedSwatches(mesh);
      for (const [role, swatches] of Object.entries(finish)) {
        expect(swatches.some(color => colors.has(color)), name + " " + role).toBeTrue();
      }
    }
  } finally { for (const [root] of buildings) disposeStaticAudit(root); }
});

test("Senate joinery selects paints that occur in every real drawn patch without selecting another record in the tile", () => {
  const drawn = Object.entries(senate.packets).filter(([key]) => key.startsWith("drawn:"));
  expect(drawn).toHaveLength(3);
  const provided = new Set<number>();
  for (const [,packet] of drawn) {
    const profile = civicPacketFinish(packet.append.kind);
    if (!profile || typeof profile === "string") throw Error("Missing Senate joinery paints");
    const rgb = Buffer.from(packet.append.colors, "base64");
    const colors = new Set<number>();
    for (let i = 0; i < rgb.length; i += 3) colors.add(rgb.readUIntBE(i, 3));
    const hits = Object.values(profile).flat().filter(hex => {
      const [r, g, b] = new Color(hex).toArray().map(channel => Math.round(channel * 255));
      return colors.has((r << 16) | (g << 8) | b);
    });
    expect(hits.length).toBeGreaterThan(0);
    for (const color of hits) provided.add(color);
  }
  expect(provided.size).toBe(10);
  expect(civicPacketFinish("city")).toBeUndefined();
  expect(civicPacketFinish("public-institutions-v326")).toBeUndefined();
});

test("low court buildings in their real borough packets expose verifiable exterior-only walls", () => {
  const sites = [
    ["1_7", "DEBE07YY90002dn9"], ["1_8", "DEBE07YY90002dn9"],
    ["-10_-2", "DEBE04YY500008YZ"], ["ring182-8_8", "OSM-relation-4752291"],
    ["north190-11_-9", "OSM-way-59453998"], ["north190-6_-11", "OSM-way-696007526"],
    ["outer187--9_17", "OSM-relation-311548"], ["outer187--23_-5", "OSM-way-24149118"],
  ];
  for (const [tile, owner] of sites) {
    const file = new URL("../public/mesh/surrounding-berlin-v159/" + tile + ".drawn.json.gz", import.meta.url);
    const packet: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(file)).toString());
    const buildings = packet.nav.buildings.filter(b => b.sourceId === owner);
    expect(buildings).toHaveLength(1);
    expect(buildings[0].height).toBeLessThan(22);
    const part = packet.meshes.find(m => m.kind === "city")!;
    const points = Buffer.from(part.positions, "base64"), faces = Buffer.from(part.indices, "base64");
    const count = points.length / 6, words = new Uint16Array(count * 6);
    const indices = new Uint32Array(faces.buffer, faces.byteOffset, faces.byteLength / 4);
    for (let i = 0; i < count; i++) for (let axis = 0; axis < 3; axis++) {
      words[i * 6 + axis] = points.readUInt16LE(i * 6 + axis * 2);
    }
    let marked = 0;
    const work = markMappedBuildingWalls(words, indices, 0, indices.length, 0, count,
      {...packet.nav, buildings}, packet.origin[1], () => { marked++; });
    for (const _ of work) {}
    expect(marked, tile + " " + owner).toBeGreaterThan(0);
  }
});

type SourceFamily = {
  id: string;
  parts: { id: string; groundY: number | null; surfaces: {kind: string; rings: number[][][]}[] }[];
};

test("Mandrellaplatz masonry reaches all three measured parts and touches only verified court walls in the mixed packet", () => {
  const tile = "publicInstitutions326-27_14-p0";
  const file = new URL("../public/mesh/surrounding-berlin-v159/" + tile + ".drawn.json.gz", import.meta.url);
  const packet: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(file)).toString());
  const part = packet.meshes[0];
  const offset = 609;
  const marked = new Set<number>();
  markKoepenickCourtWalls(tile, part, offset, i => marked.add(i - offset));
  expect(marked.size).toBe(51);

  // Independent of the stored vertex ranges: find the original measured sheets of
  // every face the vertex shader can touch, including the adjacent unmarked vertices.
  const owners = new Set(packet.nav.buildings.map(b => "parentId" in b ? b.parentId : undefined));
  expect(owners.size).toBe(8);
  const archive = new URL("../../../geo_data/regierungsviertel/public-institutions-v326-source.json.gz", import.meta.url);
  const families: SourceFamily[] = JSON.parse(gunzipSync(readFileSync(archive)).toString()).families;
  const courtFamilies = new Set(["DEBE09YYP0002tOa", "DEBE09YYP0003JNQ"]);
  const visibleParts = new Set<string>();
  const sheets = families.filter(family => owners.has(family.id)).flatMap(family => {
    const offset = 3 - Math.min(...family.parts.flatMap(p => p.groundY === null ? [] : [p.groundY]));
    return family.parts.flatMap(p => p.surfaces.map(surface => ({
      courtWall: courtFamilies.has(family.id) && surface.kind === "WallSurface", partId: p.id,
      roof: surface.kind === "RoofSurface",
      points: new Set(surface.rings.flat().map(([x,y,z]) => [x, y + offset, z]
        .map((coordinate, axis) => Math.round((coordinate - packet.origin[axis]) * 100)).join("/"))),
    })));
  });
  const positions = Buffer.from(part.positions, "base64"), colors = Buffer.from(part.colors, "base64");
  const faces = Buffer.from(part.indices, "base64");
  const wallByte = Math.round(new Color(0xd3d0c3).r * 255);
  let touched = 0;
  for (let i = 0; i < faces.length; i += 12) {
    const face = [0, 4, 8].map(skip => faces.readUInt32LE(i + skip));
    if (!face.some(vertex => marked.has(vertex))) continue;
    expect(face.every(v => colors[v * 3] === wallByte)).toBeTrue();
    const points = face.map(v => [0, 2, 4].map(skip => positions.readUInt16LE(v * 6 + skip)).join("/"));
    const matches = sheets.filter(sheet => !sheet.roof && points.every(point => sheet.points.has(point)));
    expect(matches.length).toBeGreaterThan(0);
    for (const sheet of matches) {
      expect(sheet.courtWall).toBeTrue();
      visibleParts.add(sheet.partId);
    }
    touched++;
  }
  expect(touched).toBe(98);
  expect([...visibleParts].sort()).toEqual(["DEBE09YYP0003JNQ", "DEBE3DJ174xIry5M", "DEBE3DdOeV9OtS0V"]);
  const drawn = createSurroundingCityChunk(packet, tile);
  try {
    const mesh = drawn.root.children.find(m => m instanceof Mesh)!;
    expect(mesh.userData.architecturalRuns).toEqual([42 * 8192 + 7 * 4, 86 * 8192 + 34 * 4, 444 * 8192 + 7 * 4]);
  } finally { disposeStaticAudit(drawn.root); }
  const unexpected = () => { throw Error("Selected a different packet or topology"); };
  markKoepenickCourtWalls("publicInstitutions326-27_15-p0", part, offset, unexpected);
  markKoepenickCourtWalls(tile, { ...part, kind: "city" }, offset, unexpected);
  for (const field of ["positions", "colors", "indices"] as const) {
    const swapFirstByte = (part[field][0] === "A" ? "B" : "A") + part[field].slice(1);
    markKoepenickCourtWalls(tile, { ...part, [field]: swapFirstByte }, offset, unexpected);
  }
});
