import { expect, test } from "bun:test";
import { Color, LinearSRGBColorSpace, Mesh, PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import raster from "../public/mesh/regierungsviertel/ground-context.json";
import { createDistrictStreets, districtStreetTerrainSampler } from "../src/DistrictStreets";
import { GATE_FORECOURTS_V374, gateGroundInkV374, gateSurveyAdmitsV374 } from "../src/GateForecourtsV374";
import { createGroundSlabs, type VoxelPayload } from "../src/terrainPayload";
import { ISO_GROUND_SHADES } from "../src/IsometricCityWorld";
import { pointInBrandenburgApproach } from "../src/brandenburgApproachScope";
import survey from "../src/data/gateForecourtsV374.json";

const ground = raster as unknown as VoxelPayload;
const ray = (x:number,z:number) => new Raycaster(new Vector3(x,20,z),new Vector3(0,-1,0));

test("the district ground owns the two surveyed forecourts and their true street edges before publication", () => {
  const streets = createDistrictStreets(ground,new Set(),true);
  const mesh = streets.getObjectByName(GATE_FORECOURTS_V374) as Mesh;
  expect(mesh).toBeInstanceOf(Mesh);
  const cells: [number, number, number, number][] = [
    [350,300,0x787578,.26],  // Straße des 17. Juni, cm_fahrbahn.56086
    [383,300,0xc3c1ba,.32],  // west pedestrian paving, ci_oeffentlicher_platz.1728
    [403,300,0xc3c1ba,.32],
    [399,325,0xada7a2,.32],  // stone cycleway, ch_radweg.10879
    [452,300,0xc7c4bd,.26],  // stone carriageway east of the gate, cm_fahrbahn.54020
    [470,298,0xbdb7af,.32],  // rounded central median, cf_trennstreifen.18607
    [500,270,0xb3aea8,.32],  // east mosaic path, cl_gehweg.664486
    [515,251,new Color(0x8ea17a).getHex(LinearSRGBColorSpace),.28],  // northern parterre, ce_gruenflaeche.21433
    [370.145,288.09,0x787578,.26], // asphalt crossing on OSM way 538530050
    [360.531,284.71,0xd4d1c8,.325], // WFS bw_aufmerksamkeitsfeld.18507
    [364.946,329.04,0xcdcbc6,.32], // WFS island edges + OSM way 1155911775
    [379,326.7,0x787578,.26], // southern crossing on OSM way 376992756
    [417,244.8,0xcdcbc6,.32], // north facade apron, outside its real planted strips
    [436.6,260.8,0xcdcbc6,.32], // distinct paved base for the mapped access ramp
    [429,296,0xbcbab1,.39],  // surveyed raised kerb
  ];
  const rasterGround=createGroundSlabs(ground, "Drawn ground slabs", ISO_GROUND_SHADES, {
    skipClasses:["asphalt"],skipWater:true,skipBridge:true,parkRelief:"drawn",
    skipAtWorld:(x,z)=>pointInBrandenburgApproach(x,z,ground.cell_m/Math.SQRT2),
  });
  const westHits=ray(383,300).intersectObject(rasterGround,false);
  expect(westHits.length).toBeGreaterThan(0);
  const original=new Color();
  rasterGround.getColorAt(westHits[0].instanceId!,original);
  expect(ISO_GROUND_SHADES.grass).toContain(original.getHex());
  const dgm=districtStreetTerrainSampler(ground);
  for (const [x,z,hex,lift] of cells) {
    const hits=ray(x,z).intersectObject(streets);
    expect(hits[0]?.object).toBe(mesh);
    for (const hit of hits) expect(hit.object).toBe(mesh);
    const hit=hits[0], color=new Color().fromBufferAttribute(mesh.geometry.getAttribute("color"),hit.face!.a);
    expect(color.getHex(LinearSRGBColorSpace)).toBe(hex);
    for (const old of ray(x,z).intersectObject(rasterGround,false)) expect(old.point.y).toBeLessThan(hit.point.y);
    expect(Math.abs(hit.point.y-dgm(x,z)-lift)).toBeLessThan(.027);
  }
  // Reproduce the exact oblique rays whose foreground in the first build
  // of v254 was the top or the vertical side of a green raster slab. A
  // vertical-only test missed the last of these four road crossings.
  const camera=new PerspectiveCamera(39,1120/760,.25,97000);
  camera.position.set(270,172,185); camera.lookAt(455,12,317); camera.updateMatrixWorld();
  for (const [px,py] of [[690,659],[710,700],[852,587],[796,553],[648,501],[614,524],[592,536]]) {
    const probe=new Raycaster();
    probe.setFromCamera(new Vector2((px+.5)*2/1120-1,1-(py+.5)*2/760),camera);
    const hits=probe.intersectObjects([rasterGround,streets], true);
    expect(hits[0].object).toBe(mesh);
  }
  // The two original fountains, both enclosed gate rooms, the neighbouring
  // cadastral building and the outside court retain their own surfaces.
  for (const [x,z] of [[494,255],[500.55,334.16],[429.92,274.65],[434.35,325.55],[427.95,249.4],[562,329]]) {
    expect(ray(x,z).intersectObject(mesh)).toHaveLength(0);
  }
  expect(mesh.geometry.getAttribute("position").count).toBeLessThan(20000);
  expect(mesh.userData.nightMaterial).toBeDefined();
  expect(gateGroundInkV374(ground).length).toBeGreaterThan(30);
});

test("a different DGM or grid keeps the original district street owners", () => {
  const [left,top]=survey.groundGuard, dgm=ground.ground_height;
  const heights={ ...dgm, y_dm: Array.from(dgm.y_dm) };
  heights.y_dm[top*dgm.cols+left]+=1;
  const modified={...ground,ground_height:heights};
  expect(gateSurveyAdmitsV374(ground)).toBeTrue();
  expect(gateSurveyAdmitsV374(modified)).toBeFalse();
  expect(gateSurveyAdmitsV374({...ground,cell_m:2})).toBeFalse();
  expect(createDistrictStreets(modified,new Set(),true).getObjectByName(GATE_FORECOURTS_V374)).toBeUndefined();
});
