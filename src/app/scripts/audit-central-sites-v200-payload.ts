/** Derive a small replay receipt from isolated --payload-only construction captures.
 * Run audit-central-sites-v200-construction.ts for legacy/current and full/mobile
 * with --payload-only --write-buffers and V200_AUDIT_PREFIX=<prefix>-<phase>-<profile>.
 * Then run this script <prefix>. No production or historical fixture is changed.
 */
import { createHash } from "node:crypto";
import baseline from "../tests/fixtures/minecraft-payload-only-v192.json";
import correction from "../src/data/centralSitesV200Correction.json";
import replacements from "../src/data/centralSitesV200Replacement.json";
const prefix = process.argv[2] ?? "/tmp/v201-payload";
const sha = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const owned = new Set([
  ...correction.native.columns.map(([x,z]) => `${(x+.5)*4},${(z+.5)*4}`),
  ...replacements.replacements.flatMap(p => p.columns.map(([x,z]) => `${x},${z}`)),
]);
const current: Record<string, unknown> = {}, profiles: Record<string, unknown> = {};
for (const profile of ["full", "mobile"] as const) {
  const snapshots = await Promise.all(["legacy", "current"].map(async phase =>
    await Bun.file(`${prefix}-${phase}-${profile}.objects.json`).json()));
  const meshByName = snapshots.map(rows => new Map<string, any>(rows.map((row: any) => [row.name,row])));
  const summary: Record<string, unknown> = {}, changed: Record<string, unknown> = {};
  for (const [name, expected] of Object.entries(baseline[profile])) {
    const [old, now] = meshByName.map(rows => rows.get(name));
    if (expected === null) {
      if (old || now) throw Error(`Unexpected mesh ${name}`);
      summary[name] = null; continue;
    }
    if (old.instances !== expected.count || old.payloadSha256 !== expected.sha256)
      throw Error(`Historical v192 buffer changed: ${profile}/${name}`);
    summary[name] = { count: now.instances, sha256: now.payloadSha256 };
    if (old.payloadSha256 === now.payloadSha256) continue;
    if (!["Voxel building columns", "Voxel facade windows"].includes(name)) throw Error(`Unexpected changed mesh ${name}`);
    const buffers = await Promise.all([old, now].map(async row => ({
      matrix: Buffer.from(await Bun.file(row.instanceMatrixPath).arrayBuffer()),
      color: Buffer.from(await Bun.file(row.instanceColorPath).arrayBuffer()),
    })));
    const record = (which:number,index:number) => Buffer.concat([
      buffers[which].matrix.subarray(index*64,index*64+64),
      buffers[which].color.subarray(index*12,index*12+12),
    ]);
    const location = (data:Buffer) => {
      const f=new Float32Array(data.buffer,data.byteOffset,19), pane=name==="Voxel facade windows";
      const x=Math.round((f[12]-(pane?f[8]*2.08:0))/4-.5)*4+2;
      const z=Math.round((f[14]-(pane?f[10]*2.08:0))/4-.5)*4+2;
      return {key:`${x},${z}`, adjacent:`${x+f[8]*4},${z+f[10]*4}`};
    };
    const removed: {index:number,data:string}[] = [], added: {index:number,data:string}[] = [];
    let i=0,j=0,retained=0;
    while(i<old.instances || j<now.instances) {
      const a=i<old.instances?record(0,i):null,b=j<now.instances?record(1,j):null;
      if(a&&b&&a.equals(b)){i++;j++;retained++;continue;}
      if(a&&owned.has(location(a).key)){removed.push({index:i++,data:a.toString("base64")});continue;}
      if(b&&name==="Voxel facade windows"&&!owned.has(location(b).key)&&owned.has(location(b).adjacent)){
        added.push({index:j++,data:b.toString("base64")});continue;
      }
      throw Error(`Unexplained buffer change ${profile}/${name}: ${i}/${j}`);
    }
    changed[name]={beforeCount:old.instances,afterCount:now.instances,retainedCount:retained,removed,added};
  }
  current[profile]=summary; profiles[profile]=changed;
}
const inputSha256:Record<string,string>={};
for (const path of ["public/mesh/regierungsviertel/minecraft-voxels.json", "src/data/centralSitesV200Correction.json", "src/data/centralSitesV200Replacement.json"])
  inputSha256[path]=sha(new Uint8Array(await Bun.file(new URL(`../${path}`,import.meta.url)).arrayBuffer()));
const fixtureRoot=new URL("../tests/fixtures/",import.meta.url);
await Bun.write(new URL("minecraft-payload-only-v200.json",fixtureRoot),JSON.stringify(current,null,2)+"\n");
await Bun.write(new URL("minecraft-payload-only-v200-delta.json",fixtureRoot),JSON.stringify({
  schemaVersion:1,constructor:"payload, null, null, {detailProfile}",
  encoding:"base64 of 16 Float32 matrix values followed by 3 Float32 color values; exact original bits",
  inputSha256,profiles,
},null,2)+"\n");
console.log(Object.fromEntries(Object.entries(profiles).map(([profile,meshes]:any)=>[profile,
  Object.fromEntries(Object.entries(meshes).map(([name,mesh]:any)=>[name,{removed:mesh.removed.length,added:mesh.added.length,retained:mesh.retainedCount}]))])));
