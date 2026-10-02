import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { OrthographicCamera } from "three";
import { createSurroundingCity, disposeSurroundingCityRoot, validateSurroundingManifest } from "../src/SurroundingCity";
import { createSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
const rectangle = (a: number, b: number, c: number, d: number) => ({ ring: [[a,b],[c,b],[c,d],[a,d]], holes: [] as number[][][] });
const empty = (): SurroundingCityChunk => ({ schemaVersion: 1, origin: [2048,-10,-1024], meshes: [], nav: { groundY: 3, ground: [], water: [], buildings: [], roads: [], bridges: [] } });
const primary = (): SurroundingCityChunk => ({ ...empty(), nav: { ...empty().nav, ground: [rectangle(0,0,512,512)], water: [rectangle(200,200,250,250)], buildings: [{ ...rectangle(20,20,50,50), sourceId: "retained-source", minHeight: 0, height: 12 }] } });
function manifest() { return { schemaVersion: 1, groundY: 3, footprint: [rectangle(2048,-1024,2560,-512)], chunks: [
  { id: "4_-2", detailCompanionOf: undefined as string | undefined, bounds: [2048,-1024,2560,-512], drawn: { url: "primary.drawn.json", bytes: 2000 }, minecraft: { url: "primary.minecraft.json", bytes: 2000 } },
  { id: "4_-2-scheunen-v168", detailCompanionOf: "4_-2", bounds: [2048,-1024,2560,-512], drawn: { url: "detail.drawn.json", bytes: 2000 }, minecraft: { url: "detail.minecraft.json", bytes: 2000 } },
] }; }
function camera() { const view = new OrthographicCamera(-300,300,300,-300,1,3000); view.position.set(2304,500,-768); view.up.set(0,0,-1); view.lookAt(2304,0,-768); view.updateMatrixWorld(); return view; }
async function until(done: () => boolean) { for(let i=0;i<400;i++){if(done())return;await new Promise(resolve=>setTimeout(resolve,2));}throw new Error("Bounded companion load timed out"); }

test("same-bound companion validates with an empty drawn family; invalid parents fail",()=>{
  expect(validateSurroundingManifest(manifest()).chunks).toHaveLength(2);
  const result=createSurroundingCityChunk(empty(),"4_-2-scheunen-v168");
  expect(result.root.children).toHaveLength(0);disposeSurroundingCityRoot(result.root);
  const badParent=manifest();badParent.chunks[1]!.detailCompanionOf="missing";expect(()=>validateSurroundingManifest(badParent)).toThrow();
  const badBounds=manifest();badBounds.chunks[1]!.bounds[0]=2049;expect(()=>validateSurroundingManifest(badBounds)).toThrow();
  const self=manifest();self.chunks[1]!.detailCompanionOf=self.chunks[1]!.id;expect(()=>validateSurroundingManifest(self)).toThrow();
});

test("same-bound companion loads in both families with primary-only navigation",async()=>{
  const calls:string[]=[];
  const fetcher=(async(input: URL|RequestInfo)=>{const path=new URL(String(input)).pathname;calls.push(path);return new Response(JSON.stringify(path.endsWith("manifest.json")?manifest():path.includes("primary")?primary():empty()));}) as typeof fetch;
  const city=createSurroundingCity({camera:camera(),manifestUrl:new URL("https://test.invalid/manifest.json"),fetch:fetcher});
  await city.ready;await until(()=>!city.pending);
  expect(city.residentChunkCount).toBe(2);expect(city.navigationTiles).toHaveLength(1);
  expect(city.groundAt(2050,-1020)).toBe(3);expect(city.waterAt(2258,-814)).toBeTrue();expect(city.solidAt(2078,8,-994)).toBeTrue();
  city.setMode("minecraft");await until(()=>!city.pending);
  expect(city.residentChunkCount).toBe(2);expect(calls.filter(p=>p.endsWith("minecraft.json"))).toHaveLength(2);
  expect(city.groundAt(2050,-1020)).toBe(3);city.dispose();expect(city.residentChunkCount).toBe(0);
});

test("earlier companion cannot shadow navigation when failed primary retries later",async()=>{
  let fail=true,clock=0;const errors:string[]=[];
  const fetcher=(async(input:URL|RequestInfo)=>{const path=new URL(String(input)).pathname;if(path.includes("primary")&&fail){fail=false;throw new Error("intentional retry fixture");}return new Response(JSON.stringify(path.endsWith("manifest.json")?manifest():path.includes("primary")?primary():empty()));}) as typeof fetch;
  const city=createSurroundingCity({camera:camera(),manifestUrl:new URL("https://test.invalid/manifest.json"),fetch:fetcher,now:()=>clock,onError:e=>errors.push(e)});
  await city.ready;await until(()=>!city.pending);expect(city.residentChunkCount).toBe(1);expect(errors).toHaveLength(1);
  clock=31_000;city.refresh(clock);await until(()=>!city.pending);
  expect(city.residentChunkCount).toBe(2);expect(city.navigationTiles).toHaveLength(1);expect(city.groundAt(2050,-1020)).toBe(3);expect(city.waterAt(2258,-814)).toBeTrue();city.dispose();
});


const auditUrl = new URL("../../../geo_data/regierungsviertel/scheunen-refinements-v168-audit.json", import.meta.url);
test.skipIf(!existsSync(auditUrl))("all published affected packets pass the actual bounded geometry loader", () => {
  const audit = JSON.parse(readFileSync(auditUrl, "utf8")) as { chunks: { id: string }[] };
  const base = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
  const published = JSON.parse(readFileSync(new URL("manifest.json", base), "utf8"));
  const descriptors = new Map<string, { drawn: { url: string }; minecraft: { url: string } }>(published.chunks.map((c: {id: string}) => [c.id,c]));
  let decoded=0;
  // Serial decode/dispose keeps this a bounded packet regression, not a whole
  // world construction test. A 12 MiB JSON can still exceed the vertex limit.
  for (const {id} of audit.chunks) for (const mode of ["drawn","minecraft"] as const) {
    const descriptor = descriptors.get(id)!;
    const packet = JSON.parse(gunzipSync(readFileSync(new URL(descriptor[mode].url,base))).toString("utf8"));
    const result = createSurroundingCityChunk(packet,id,mode==="minecraft");
    try { expect(result.root.children.length).toBeGreaterThan(0); decoded++; }
    finally { disposeSurroundingCityRoot(result.root); }
  }
  expect(decoded).toBe(audit.chunks.length*2);
});
