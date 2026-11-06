/** Small exact packets exercise the real streamed controller, never a city build. */
import { expect, spyOn, test } from "bun:test";
import { BufferGeometry, Group, Mesh, OrthographicCamera } from "three";
import {
  createSurroundingCity, disposeSurroundingCityRoot,
  type SurroundingCity, type SurroundingCityManifest, type SurroundingCityOptions,
} from "../src/SurroundingCity";
import {
  createSurroundingCityChunk,
  type SurroundingCityChunk, type SurroundingPackedMesh,
} from "../src/SurroundingCityGeometry";
import {
  createSourceQuarterRecipeLoaderV309, SOURCE_QUARTER_CATALOGUE_V309,
  type SourceQuarterRecipesV309,
} from "../src/SourceQuarterCatalogueV309";
import type { SourceQuarterSourceV303 } from "../src/SourceQuarterPacketV303";

const owner = "synthetic-complete-wilhelm-street-front-v325";
const ids = ["1_0", "1_1"] as const;
const base64 = (a: Uint16Array | Uint32Array | Uint8Array) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
const fingerprint = (text: string) => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash;
};
const polygon = (x: number) => ({ ring: [[x, 0], [x + 512, 0], [x + 512, 512], [x, 512], [x, 0]], holes: [] as number[][][] });
const response = (value: unknown) => new Response(JSON.stringify(value));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 500; i++) {
    if (check()) return;
    await new Promise(done => setTimeout(done, 2));
  }
  throw Error("Finite new Wilhelm packet fixture did not settle");
}
function view(two = false): OrthographicCamera {
  const camera = new OrthographicCamera(two ? -2000 : -300, two ? 2000 : 300, 300, -300, 1, 3000);
  const x = two ? 1280 : 256;
  camera.position.set(x, 500, 256); camera.up.set(0, 0, -1); camera.lookAt(x, 0, 256); camera.updateMatrixWorld();
  return camera;
}
function fixture(two = false, unrelated = false) {
  const selected: string[] = unrelated ? ["unrelated-v325"] : [...ids.slice(0, two ? 2 : 1)];
  const packets = new Map<string, SurroundingCityChunk>();
  const source: SourceQuarterSourceV303 = { schemaVersion: 1, keys: [], packets: {} };
  const manifest: SurroundingCityManifest = { schemaVersion: 1, groundY: 3, footprint: [], chunks: [] };
  for (const [index, id] of selected.entries()) {
    const x = index * 2048;
    const part: SurroundingPackedMesh = {
      kind: "city", positionType: "u16cm",
      positions: base64(new Uint16Array([0, 1300, 0, 100, 1300, 0, 0, 1400, 0, 200, 1300, 200, 300, 1300, 200, 200, 1400, 200])),
      colors: base64(new Uint8Array(18).fill(80)), indices: base64(new Uint32Array([0, 1, 2, 3, 4, 5])),
    };
    const packet: SurroundingCityChunk = {
      schemaVersion: 1, origin: [x, -10, 0], meshes: [part],
      nav: { ground: [polygon(0)], water: [], groundY: 3,
        buildings: [{ ring: [[50, 50], [100, 50], [100, 100], [50, 100]], holes: [], height: 20, minHeight: 0, sourceId: "unchanged-source-building" }] },
    };
    packets.set(id, packet); manifest.footprint.push(polygon(x));
    manifest.chunks.push({ id, bounds: [x, 0, x + 512, 512],
      drawn: { url: `${id}.drawn.json`, bytes: JSON.stringify(packet).length },
      minecraft: { url: `${id}.minecraft.json`, bytes: JSON.stringify(packet).length } });
    if (unrelated) continue;
    const key = `drawn:${id}`, pin = { mesh: 0, kind: part.kind, fingerprint: fingerprint(part.positions + part.colors + part.indices) };
    source.keys.push(key);
    // A complete separately resident owner authorizes only retirement of one
    // exact old fitting. No append geometry, body or navigation is substituted.
    source.packets[key] = {
      origin: packet.origin, records: [pin], preparedRecords: [pin],
      navGuard: fingerprint(JSON.stringify(packet.nav)), preparedNavGuard: fingerprint(JSON.stringify(packet.nav)),
      lineGuard: null, preparedLineGuard: null, append: null,
      retire: [{ mesh: 0, triangles: [0] }], retireLines: [], retireNav: [], appendNav: [], owners: [owner],
    } as unknown as SourceQuarterSourceV303["packets"][string];
  }
  const entry = { source, kind: "wilhelm-street-v325", requiredReplacement: true, admission: "wilhelm-street-v325" as const };
  const requests: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const name = new URL(String(input)).pathname.split("/").at(-1)!; requests.push(name);
    return response(name === "manifest.json" ? manifest : packets.get(name.replace(/\.(drawn|minecraft)\.json$/, "")));
  }) as typeof fetch;
  const recipes = async (id: string, native = false): Promise<SourceQuarterRecipesV309> =>
    !native && source.keys.includes(`drawn:${id}`) ? [entry] : [];
  const options: SurroundingCityOptions = {
    camera: view(two), manifestUrl: new URL("https://wilhelm.test/manifest.json"), fetch: fetcher,
    sourceQuartersV303: true, loadSourceQuarterSourcesV309: recipes,
  };
  return { packets, source, manifest, entry, requests, recipes, options };
}
const indices = (root: Group) => Array.from((root.children.find(child => child instanceof Mesh) as Mesh).geometry.index!.array);
const resident = (city: SurroundingCity) => city.root.children[0] as Group;

test("retirement stays closed by default and preserves the complete source/body/navigation complement", () => {
  const f = fixture(), packet = f.packets.get(ids[0])!, before = JSON.stringify(packet);
  const control = createSurroundingCityChunk(packet, ids[0]);
  try {
    for (const ready of [undefined, false, true]) {
      const result = createSurroundingCityChunk(packet, ids[0], false, {
        sourceQuartersV303: true, sourceQuarterSourcesV303: [f.entry], wilhelmStreetFrontsV325: ready,
        // Distinct older housing and site gates cannot admit the new street owner.
        neukoellnLandmarksV305: ready !== true, wilhelmHousingV324: ready !== true,
      });
      try {
        expect(indices(result.root)).toEqual(ready ? [0, 0, 0, 3, 4, 5] : indices(control.root));
        expect(result.root.userData.sourceQuarterOwnersV303).toEqual(ready ? [owner] : []);
        expect(result.nav).toEqual(control.nav);
        const original = (control.root.children[0] as Mesh).geometry, actual = (result.root.children[0] as Mesh).geometry;
        for (const field of ["position", "color"]) expect(Array.from(actual.getAttribute(field).array)).toEqual(Array.from(original.getAttribute(field).array));
        expect(result.root.children).toHaveLength(control.root.children.length);
      } finally { disposeSurroundingCityRoot(result.root); }
    }
    expect(JSON.stringify(packet)).toBe(before);
  } finally { disposeSurroundingCityRoot(control.root); }
});

test("changed source fingerprints/navigation and a missing required-replacement proof never retire old fittings", () => {
  for (const corruption of ["mesh", "navigation", "required"] as const) {
    const f = fixture(), packet = structuredClone(f.packets.get(ids[0])!);
    if (corruption === "mesh") packet.meshes[0].colors = base64(new Uint8Array(18).fill(81));
    if (corruption === "navigation") packet.nav.buildings[0].height++;
    const result = createSurroundingCityChunk(packet, ids[0], false, {
      sourceQuartersV303: true, wilhelmStreetFrontsV325: true,
      sourceQuarterSourcesV303: [{ ...f.entry, requiredReplacement: corruption !== "required" }],
    });
    try { expect(indices(result.root)).toEqual([0, 1, 2, 3, 4, 5]); expect(result.root.userData.sourceQuarterOwnersV303).toEqual([]); }
    finally { disposeSurroundingCityRoot(result.root); }
  }
});

test("a model gate closing during actual geometry decode cannot publish or announce a retired front", async () => {
  const f = fixture(); let ready = true, closed = false, attached = 0, released = 0;
  const states: string[][] = [], original = BufferGeometry.prototype.setAttribute;
  const hook = spyOn(BufferGeometry.prototype, "setAttribute").mockImplementation(function (name, attribute) {
    if (!closed && name === "position") { closed = true; ready = false; }
    return original.call(this, name, attribute);
  });
  const city = createSurroundingCity({ ...f.options, wilhelmStreetFrontsV325: () => ready,
    onAttach: () => { attached++; }, onQuarterResidentsV303: keys => states.push([...keys]),
    onRelease: root => { released++; disposeSurroundingCityRoot(root); } });
  try {
    await city.ready; await until(() => !city.pending);
    expect(closed).toBeTrue(); expect(attached).toBe(0); expect(released).toBe(1);
    expect(city.residentChunkCount).toBe(0); expect(states.flat()).toEqual([]);
  } finally { hook.mockRestore(); city.dispose(); }
});

test("closing admission inside onAttach disposes the unpublished packet and announces no resident key", async () => {
  const f = fixture(); let ready = true, attached = 0, released = 0;
  const states: string[][] = [];
  const city = createSurroundingCity({ ...f.options, wilhelmStreetFrontsV325: () => ready,
    onAttach(root) { attached++; expect(root.userData.sourceQuarterOwnersV303).toEqual([owner]); ready = false; },
    onQuarterResidentsV303: keys => states.push([...keys]),
    onRelease(root) { released++; disposeSurroundingCityRoot(root); } });
  try {
    await city.ready; await until(() => !city.pending);
    expect(attached).toBe(1); expect(released).toBe(1); expect(city.residentChunkCount).toBe(0); expect(states.flat()).toEqual([]);
  } finally { city.dispose(); }
});

test("a resident's closed/open/revoked/retry cycle restores the old front and publishes keys only while admitted", async () => {
  const f = fixture(); let ready = false, clock = 0;
  const states: string[][] = [], released: Group[] = [];
  const city = createSurroundingCity({ ...f.options, now: () => clock, wilhelmStreetFrontsV325: () => ready,
    onQuarterResidentsV303: keys => states.push([...keys]), onRelease(root) { released.push(root); disposeSurroundingCityRoot(root); } });
  try {
    await city.ready; await until(() => !city.pending && city.residentChunkCount === 1);
    expect(indices(resident(city))).toEqual([0, 1, 2, 3, 4, 5]); expect(states.at(-1)).toEqual([]);
    for (const state of [true, false, true]) {
      const previous = resident(city); ready = state; clock += 1000; city.refresh(clock);
      expect(city.residentChunkCount).toBe(0); expect(states.at(-1)).toEqual([]); expect(released).toContain(previous);
      await until(() => !city.pending && city.residentChunkCount === 1);
      expect(indices(resident(city))).toEqual(state ? [0, 0, 0, 3, 4, 5] : [0, 1, 2, 3, 4, 5]);
      expect(states.at(-1)).toEqual(state ? [`drawn:${ids[0]}`] : []);
      expect(city.navigationTiles[0].nav).toEqual(f.packets.get(ids[0])!.nav);
    }
    expect(f.requests.filter(name => name.endsWith("drawn.json"))).toHaveLength(4);
    city.dispose(); expect(states.at(-1)).toEqual([]);
  } finally { city.dispose(); }
});

test("an unrelated resident never polls the complete new street-front gate", async () => {
  const f = fixture(false, true); let samples = 0, oldSamples=0, clock = 0;
  const city = createSurroundingCity({ ...f.options, now: () => clock, wilhelmStreetFrontsV325: () => { samples++; return true; },
    wilhelmHousingV324:()=>{oldSamples++;return true;} });
  try {
    await city.ready; await until(() => !city.pending && city.residentChunkCount === 1);
    for (clock = 1000; clock < 4000; clock += 1000) city.refresh(clock);
    expect(samples).toBe(0);expect(oldSamples).toBe(0); expect(indices(resident(city))).toEqual([0, 1, 2, 3, 4, 5]);
  } finally { city.dispose(); }
});

test("the actual catalogue order preserves both old housing and new street private quarter markers in one packet",()=>{
  const f=fixture(),packet=f.packets.get(ids[0])!,before=JSON.stringify(packet);
  const housingSource=structuredClone(f.source),housingPlan=housingSource.packets[`drawn:${ids[0]}`];
  housingPlan.retire=[{mesh:0,triangles:[1]}];housingPlan.owners=['older-complete-housing-owner'];
  const housing={source:housingSource,kind:'wilhelm-housing-v324',requiredReplacement:true,admission:'wilhelm-v324'as const};
  for(const oldReady of[false,true])for(const newReady of[false,true]){
    const result=createSurroundingCityChunk(packet,ids[0],false,{sourceQuartersV303:true,
      sourceQuarterSourcesV303:[f.entry,housing],wilhelmHousingV324:oldReady,wilhelmStreetFrontsV325:newReady});
    try{
      expect(indices(result.root)).toEqual([0,...(newReady?[0,0]:[1,2]),3,...(oldReady?[3,3]:[4,5])]);
      expect(result.root.userData.sourceQuarterOwnersV303).toEqual([...(newReady?[owner]:[]),...(oldReady?housingPlan.owners:[])]);
      expect(result.nav).toEqual(packet.nav);expect(JSON.stringify(packet)).toBe(before);
    }finally{disposeSurroundingCityRoot(result.root);}
  }
});

test("each actual release resamples the model gate before retaining another retired resident", async () => {
  const f = fixture(true), second = deferred<void>();
  let ready = false, opened = false, clock = 0, firstRoot: Group | undefined, city!: SurroundingCity;
  const states: string[][] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    if (String(input).endsWith(`${ids[1]}.drawn.json`)) { await second.promise; return response(f.packets.get(ids[1])); }
    return f.options.fetch!(input);
  }) as typeof fetch;
  city = createSurroundingCity({ ...f.options, fetch: fetcher, now: () => clock, wilhelmStreetFrontsV325: () => ready,
    onAttach(root) { firstRoot ??= root; }, onQuarterResidentsV303: keys => states.push([...keys]),
    onChange() { if (city?.residentChunkCount === 1 && !opened) { opened = true; ready = true; second.resolve(); } },
    onRelease(root) { if (root === firstRoot) ready = false; disposeSurroundingCityRoot(root); } });
  try {
    await city.ready; await until(() => !city.pending && city.residentChunkCount === 2);
    expect(states.at(-1)).toEqual([`drawn:${ids[1]}`]);
    clock = 1000; city.refresh(clock);
    expect(ready).toBeFalse(); expect(city.residentChunkCount).toBe(0); expect(states.at(-1)).toEqual([]);
    await until(() => !city.pending && city.residentChunkCount === 2);
    expect(city.root.children.every(root => root.userData.sourceQuarterOwnersV303.length === 0)).toBeTrue();
  } finally { second.resolve(); city.dispose(); }
});

test("the actual catalogue is drawn-only; Native packet fetches cannot import or apply its Drawn retirement recipe", async () => {
  const actual = SOURCE_QUARTER_CATALOGUE_V309.find(entry => entry.kind === "wilhelm-street-v325")!;
  expect(actual.keys).toEqual(["drawn:1_0", "drawn:1_1"]); expect(actual.admission).toBe("wilhelm-street-v325"); expect(actual.requiredReplacement).toBeTrue();
  const f = fixture(true); let imports = 0;
  const load = createSourceQuarterRecipeLoaderV309([{ ...actual, load: async () => { imports++; return { default: f.source }; } }]);
  for (const id of [...ids, "almost-1_0"]) expect(await load(id, true)).toEqual([]);
  expect(await load("almost-1_0", false)).toEqual([]); expect(imports).toBe(0);
  const native = fixture(); let gateSamples = 0;
  const city = createSurroundingCity({ ...native.options, mode: "minecraft", loadSourceQuarterSourcesV309: load,
    wilhelmStreetFrontsV325: () => { gateSamples++; return true; } });
  try {
    await city.ready; await until(() => !city.pending && city.residentChunkCount === 1);
    expect(imports).toBe(0); expect(gateSamples).toBe(0);
    expect(native.requests).toEqual(["manifest.json", "1_0.minecraft.json"]);
    expect(resident(city).userData.nativeMinecraft).toBeTrue(); expect(indices(resident(city))).toEqual([0, 1, 2, 3, 4, 5]);
    const loaded = await Promise.all(ids.map(id => load(id, false)));
    expect(imports).toBe(1); expect(loaded.every(entries => entries[0].source === f.source)).toBeTrue();
    expect(loaded.every(entries => entries[0].admission === "wilhelm-street-v325" && entries[0].requiredReplacement)).toBeTrue();
  } finally { city.dispose(); }
});

test("a real release hook changing the other Wilhelm generation resamples both relevant residents", async () => {
  // First remove an earlier housing packet, then reverse the direction so a
  // later street eviction revokes an already-visited earlier housing packet.
  for (const first of ["housing", "street"] as const) {
    const f=fixture(true), roots=new Map<Group,string>(), states:string[][]=[];
    let housing=first!=="housing",street=first!=="street",clock=0;
    const recipes=async(id:string,native=false):Promise<SourceQuarterRecipesV309>=>{
      if(native||!ids.includes(id as typeof ids[number]))return[];
      const key=`drawn:${id}`,source:SourceQuarterSourceV303={schemaVersion:1,keys:[key],packets:{[key]:f.source.packets[key]}};
      return[{source,kind:id===ids[0]?"wilhelm-housing-v324":"wilhelm-street-v325",requiredReplacement:true,
        admission:id===ids[0]?"wilhelm-v324":"wilhelm-street-v325"}];
    };
    const city=createSurroundingCity({...f.options,now:()=>clock,loadSourceQuarterSourcesV309:recipes,
      wilhelmHousingV324:()=>housing,wilhelmStreetFrontsV325:()=>street,
      onAttach(root){roots.set(root,root.position.x===0?ids[0]:ids[1]);},onQuarterResidentsV303:keys=>states.push([...keys]),
      onRelease(root){
        const id=roots.get(root);
        if(first==="housing"&&id===ids[0])street=false;
        if(first==="street"&&id===ids[1])housing=false;
        disposeSurroundingCityRoot(root);
      }});
    try{
      await city.ready;await until(()=>!city.pending&&city.residentChunkCount===2);
      expect(states.at(-1)).toEqual([`drawn:${first==="housing"?ids[1]:ids[0]}`]);
      const previous=[...city.root.children]as Group[];
      if(first==="housing")housing=true;else street=true;
      clock=1000;city.refresh(clock);
      // Both stale packet variants must leave synchronously, including the
      // one whose admission changed inside the other packet's release hook.
      expect(city.residentChunkCount).toBe(0);expect(states.at(-1)).toEqual([]);
      expect(previous.every(root=>root.parent===null)).toBeTrue();
      await until(()=>!city.pending&&city.residentChunkCount===2);
      for(const root of city.root.children as Group[]){
        const active=roots.get(root)===ids[0]?housing:street;
        expect(indices(root)).toEqual(active?[0,0,0,3,4,5]:[0,1,2,3,4,5]);
      }
      expect(city.navigationTiles.every(tile=>tile.nav.buildings[0].sourceId==="unchanged-source-building")).toBeTrue();
    }finally{city.dispose();}
  }
});
