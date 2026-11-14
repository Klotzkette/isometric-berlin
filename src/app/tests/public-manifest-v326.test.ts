import {expect,test} from "bun:test";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {OrthographicCamera} from "three";
import ne from "../src/data/northEastPublicSitesV326Index.json";
import institutions from "../src/data/publicInstitutionsV326Index.json";
import approaches from "../src/data/ubahnGroundApproachesV326Index.json";
import {createSurroundingCity,validateSurroundingManifest,
 SURROUNDING_CITY_MAX_DESCRIPTORS,SURROUNDING_CITY_MAX_FOOTPRINTS,SURROUNDING_CITY_MAX_MANIFEST_BYTES,
 SURROUNDING_CITY_RESIDENT_BUDGET_BYTES,SURROUNDING_CITY_MAX_CHUNK_BYTES,
 SURROUNDING_CITY_PREFETCH_BYTES,SURROUNDING_CITY_PREFETCH_COUNT,
 SURROUNDING_CITY_SCAN_MS,SURROUNDING_CITY_RETIRE_MS} from "../src/SurroundingCity";

const body=readFileSync(new URL("../public/mesh/surrounding-berlin-v159/manifest.json",import.meta.url));
const expanded=JSON.parse(body.toString());
const legacyBytes=gunzipSync(readFileSync(new URL("../../../geo_data/regierungsviertel/marzahn-v330-published210-manifest.json.gz",import.meta.url)));
const manifest=JSON.parse(legacyBytes.toString());
const originalBytes=gunzipSync(readFileSync(new URL("../../../geo_data/regierungsviertel/public-fidelity-v326-published206-manifest.json.gz",import.meta.url)));
const original=JSON.parse(originalBytes.toString());
const hash=(data:Uint8Array)=>createHash("sha256").update(data).digest("hex");

test("all206 parsed values and hash references remain exact; only finite named descriptors and footprints append",()=>{
 expect(originalBytes.byteLength).toBe(2174832);expect(hash(originalBytes)).toBe("a0e6feb92ff3624360b207472c27b0d5006d389688ba1c78415af32746ba2d0e");
 expect(manifest.chunks).toHaveLength(2843);expect(manifest.footprint).toHaveLength(2885);
 expect(manifest.chunks.slice(0,2203)).toEqual(original.chunks);
 expect(manifest.footprint.slice(0,339)).toEqual(original.footprint);
 for(const key of Object.keys(original))if(key!=="chunks"&&key!=="footprint")expect(manifest[key]).toEqual(original[key]);
 expect(manifest.chunks.slice(2203)).toEqual([...ne.chunks,...institutions.chunks,...approaches.chunks]);
 expect(manifest.footprint.slice(339,2492)).toEqual([...ne.footprint,...institutions.footprint,...approaches.footprint,...approaches.nativeFootprint]);
 expect(manifest.publicFidelityV326.exactActualNavComplementPolygons).toBe(393);
 expect(new Set(manifest.chunks.map((p:{id:string})=>p.id)).size).toBe(2843);
 expect(validateSurroundingManifest(manifest)).toBe(manifest);
});

test("only measured static allowances grow; all transfer/residency/vertex/index live limits stay fixed",()=>{
 expect(SURROUNDING_CITY_MAX_DESCRIPTORS).toBe(2906);expect(SURROUNDING_CITY_MAX_FOOTPRINTS).toBe(2907);
 expect(SURROUNDING_CITY_MAX_MANIFEST_BYTES).toBe(3922*1024);
 expect(legacyBytes.byteLength).toBe(3853868);expect(body.byteLength).toBe(4015235);expect(SURROUNDING_CITY_MAX_MANIFEST_BYTES-body.byteLength).toBeLessThan(2048);
 expect(SURROUNDING_CITY_RESIDENT_BUDGET_BYTES).toBe(24*1024*1024);expect(SURROUNDING_CITY_MAX_CHUNK_BYTES).toBe(12*1024*1024);
 expect(SURROUNDING_CITY_PREFETCH_BYTES).toBe(4*1024*1024);expect(SURROUNDING_CITY_PREFETCH_COUNT).toBe(2);
 expect(SURROUNDING_CITY_SCAN_MS).toBe(180);expect(SURROUNDING_CITY_RETIRE_MS).toBe(1800);
 const geometry=readFileSync(new URL("../src/SurroundingCityGeometry.ts",import.meta.url),"utf8");
 expect(geometry).toContain("const MAX_VERTEX_COUNT = 400_000;");expect(geometry).toContain("const MAX_INDEX_COUNT = 2_400_000;");
 const tooMany={...expanded,chunks:[...expanded.chunks,{...expanded.chunks[0],id:"unregistered-extra"}]};expect(()=>validateSurroundingManifest(tooMany)).toThrow("manifest");
 const tooWide={...expanded,footprint:[...expanded.footprint,expanded.footprint[0]]};expect(()=>validateSurroundingManifest(tooWide)).toThrow("manifest");
 const unsafe=structuredClone(expanded);unsafe.chunks.at(-1).drawn.url="../outside.json";expect(()=>validateSurroundingManifest(unsafe)).toThrow("descriptor");
});

test("actual bounded HTTP manifest loader admits the complete expanded metadata without constructing any city",async()=>{
 const camera=new OrthographicCamera(-5,5,5,-5,1,1000);camera.position.set(100000000,500,100000000);camera.up.set(0,0,-1);camera.lookAt(100000000,0,100000000);camera.updateMatrixWorld();
 const calls:string[]=[];
 const city=createSurroundingCity({manifestUrl:new URL("https://example.test/manifest.json"),camera,
  fetch:(async (input: URL | RequestInfo)=>{calls.push(String(input));if(!String(input).endsWith("manifest.json"))throw new Error("Unexpected geometry request");return new Response(body.toString(),{headers:{"Content-Type":"application/json"}});}) as typeof fetch});
 try{await city.ready;expect(city.manifest?.chunks).toHaveLength(2906);expect(city.residentChunkCount).toBe(0);expect(calls).toEqual(["https://example.test/manifest.json"]);expect(city.groundAt(100000000,100000000)).toBeNull();expect(city.solidAt(100000000,3,100000000,.4)).toBeFalse();}
 finally{city.dispose();}
},10000);

test("named additions compose their exact packet receipts without changing the previous city", () => {
  const root = new URL("../../..", import.meta.url);
  const receipt = JSON.parse(readFileSync(new URL("geo_data/regierungsviertel/mitte-garden-details-receipt.json", root), "utf8"));
  const previous = JSON.parse(execFileSync("git", ["show", `${receipt.previous}:src/app/public/mesh/surrounding-berlin-v159/manifest.json`], {
    cwd: fileURLToPath(root), maxBuffer: 5 * 1024 * 1024, encoding: "utf8",
  }));
  for (const descriptor of previous.chunks) {
    for (const family of ["drawn", "minecraft"]) {
      const packet = receipt.packets[`${family}:${descriptor.id}`];
      if (!packet) continue;
      expect(descriptor[family]).toEqual(packet.before);
      descriptor[family] = packet.after;
    }
  }
  previous.chunks.push(...receipt.additions);
  const zoo = JSON.parse(readFileSync(new URL("geo_data/regierungsviertel/zoo-garden-details-v341-receipt.json", root), "utf8"));
  for (const descriptor of previous.chunks) for (const family of ["drawn", "minecraft"]) {
    const packet = zoo.packets[`${family}:${descriptor.id}`];
    if (!packet) continue;
    expect(descriptor[family]).toEqual(packet.before);
    descriptor[family] = packet.after;
  }
  const south = JSON.parse(readFileSync(new URL("geo_data/regierungsviertel/britz-neukoelln-v342-receipt.json", root), "utf8"));
  const published = JSON.parse(execFileSync("git", ["show", `${south.previous}:src/app/public/mesh/surrounding-berlin-v159/manifest.json`], {
    cwd: fileURLToPath(root), maxBuffer: 5 * 1024 * 1024, encoding: "utf8",
  }));
  expect(previous).toEqual(published);
  expect(south.packets).toEqual({});
  previous.chunks.push(...south.additions);
  previous.footprint.push(...south.footprintAdditions);
  expect(expanded).toEqual(previous);
});
