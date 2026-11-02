/** Offline, actual production constructor replay: no guessed predecessor grids. */
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { InstancedMesh, LineSegments, Mesh } from "three";
import { createIsometricCityCore } from "../src/IsometricCityWorld";
import owners from "../src/data/moabitMitteV300Owners.json";
import westOwners from "../src/data/westKiezV302CoreOwners.json";
import profile from "../src/data/moabitMitteV300Profile.json";
const app = resolve(import.meta.dir, "..");
const payload = JSON.parse(readFileSync(resolve(app, "public/mesh/regierungsviertel/lod2-prisms.json"), "utf8"));
const sha = (value: ArrayBufferView | string) => createHash("sha256").update(typeof value === "string" ? value : Buffer.from(value.buffer, value.byteOffset, value.byteLength)).digest("hex");
function release(group: ReturnType<typeof createIsometricCityCore>) { const seen = new Set<object>(); group.traverse(o => { if (o instanceof Mesh || o instanceof LineSegments) { if (!seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); } for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (!seen.has(m)) { seen.add(m); m.dispose(); } if (o instanceof InstancedMesh) o.dispose(); } }); group.clear(); }
function onFront(x: number, y: number, z: number, faces: typeof profile.fronts): boolean { return faces.some(f => { const dx=f.b[0]-f.a[0], dz=f.b[1]-f.a[1], l=Math.hypot(dx,dz), u=((x-f.a[0])*dx+(z-f.a[1])*dz)/l, across=Math.abs((x-f.a[0])*dz-(z-f.a[1])*dx)/l; return u>=-.6&&u<=l+.6&&across<=.6&&y>=f.bottom-.2&&y<=f.top+.2; }); }
const families = [
  { key: "moabit-mitte-v300", old: owners.oldPrisms, retained: owners.retainedPrisms },
  { key: "west-kiez-v302", old: westOwners.oldPrisms, retained: [] },
];
type Family = {kind:string;receipts:{owner:string;sourceRetired:boolean;batches:Batch[]}[]};
type Batch = {kind:string;name:string;records:number[][]};
const output: unknown[] = [];
for (const family of families) {
  const receipts: unknown[] = [];
  for (const source of [...family.old, ...family.retained]) {
    const retained = family.retained.some(p=>p.id===source.id);
    const sites = profile.sites.filter(s=>s.oldIds.includes(source.id)), parentIds = new Set(sites.map(s=>s.parent));
    const faces = retained ? profile.fronts.filter(f=>parentIds.has(f.owner)) : [];
    const group = createIsometricCityCore(payload, null, null, null, { includeContext: false, buildings: [source] });
    const batches: unknown[] = [];
    group.traverse(object => {
      if (object instanceof LineSegments && object.name === "LoD2 facade axes") {
        const positions=object.geometry.getAttribute("position"), distances=object.geometry.getAttribute("lineDistance"); const records:number[][]=[];
        for(let i=0;i<positions.count;i+=2) {
          const row=Array.from(positions.array.slice(i*3,(i+2)*3));
          if(retained&&!onFront((row[0]+row[3])/2,(row[1]+row[4])/2,(row[2]+row[5])/2,faces))continue;
          records.push([...row,distances.getX(i),distances.getX(i+1)]);
        }
        batches.push({ kind:"lines",name:object.name,fullPositionSha256:sha(positions.array),fullDistancesSha256:sha(distances.array),records });
      }
      if(object instanceof InstancedMesh && (object.name==="Estimated ordinary windows on retained storey and bay axes v288"||object.name==="LoD2 facade night strips")) {
        const records:number[][]=[];
        for(let i=0;i<object.count;i++) {
          const row=Array.from(object.instanceMatrix.array.slice(i*16,(i+1)*16));
          if(retained&&!onFront(row[12],row[13],row[14],faces))continue;
          records.push(row);
        }
        batches.push({kind:"instances",name:object.name,fullMatrixSha256:sha(object.instanceMatrix.array),records});
      }
    });
    receipts.push({owner:source.id,sourceRetired:!retained,faces:faces.map(f=>({owner:f.owner,part:f.part,surface:f.surface})),batches});release(group);
  }
  output.push({kind:family.key,receipts});
}
const completeReceipt = {schemaVersion:1,sourcePrismsSha256:sha(readFileSync(resolve(app,"public/mesh/regierungsviertel/lod2-prisms.json"))),constructionSourceSha256:sha(readFileSync(resolve(app,"src/IsometricCityWorld.ts"))),families:output};
writeFileSync(resolve(app,"../../geo_data/regierungsviertel/moabit-mitte-v300-core-fittings.json.gz"),gzipSync(JSON.stringify(completeReceipt)+"\n",{level:9}));
const runtime = {schemaVersion:1,families:(output as Family[]).map(f=>({...f,receipts:f.receipts.filter(r=>!r.sourceRetired)}))};
writeFileSync(resolve(app,"src/data/moabitMitteV300CoreFittingReceipts.json"),JSON.stringify(runtime)+"\n");
console.log(JSON.stringify((output as {kind:string;receipts:{batches:{kind:string;records:unknown[]}[]}[]}[]).map(f=>({kind:f.kind,owners:f.receipts.length,lines:f.receipts.flatMap(r=>r.batches).filter(b=>b.kind==='lines').reduce((n,b)=>n+b.records.length,0),instances:f.receipts.flatMap(r=>r.batches).filter(b=>b.kind==='instances').reduce((n,b)=>n+b.records.length,0)}))));
