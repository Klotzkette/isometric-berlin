import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {createBerlinBoundariesV200} from "../src/BerlinBoundariesV200";
import {restoreFamilyBeforeV281} from "./helpers/familyHistoryV299Replay";
import {geometryPreservationV206} from "./helpers/geometryPreservationV206";
import {disposeStaticAudit,staticGeometryAudit} from "./helpers/staticGeometryAudit";
import {nativeSourceAtV281,replayNativeSourceV299,assertNativeHistorySourcesV299} from "./helpers/sourceHistoryV299";
import proof from "./fixtures/native-history-v299-replay.json";
const sha=(value:string|Uint8Array)=>createHash("sha256").update(value).digest("hex");
test("exact isolated Git controls retain their immutable anchors and capture implementations",()=>{
  assertNativeHistorySourcesV299();expect(proof.commits).toEqual({"0f":"0f6174362de87d785f6e6f5b864d05e5efa973fc",v281:"4adfbf744f0c419851387fe874b7363acf449123"});
  expect(sha(readFileSync(new URL("./helpers/captureNativeHistoryV299.ts",import.meta.url)))).toBe(proof.captureToolSha256);
  expect(sha(readFileSync(new URL("./helpers/captureFamilyHistoryV299.ts",import.meta.url)))).toBe(proof.familyCaptureToolSha256);
  for(const profile of ["full","mobile"]as const){expect(proof.profiles[profile].map(s=>s.added.length)).toEqual([2,30]);expect(proof.profiles[profile].map(s=>s.changes.length)).toEqual([1,7]);}
});
test("source projection accepts only exact full-file inputs through the frozen finite chain",()=>{
  const path="src/app/src/MinecraftVoxelWorld.ts",source=readFileSync(new URL("../src/MinecraftVoxelWorld.ts",import.meta.url),"utf8");
  const stage=proof.sourceStages.find(s=>s.before==="v281")!;const target=stage.changes[path].beforeSha256;
  expect(sha(nativeSourceAtV281(path,source))).toBe(target);
  expect(()=>replayNativeSourceV299(source+"\n// unrelated mutation\n",target)).toThrow("No complete source lineage");
});
for(const native of [false,true])test(`${native?"native":"drawn"} boundary replay is complete, reversible and rejects an unknown vertex`,()=>{
  const root=createBerlinBoundariesV200(native);const family=native?"boundaries-native":"boundaries-drawn";
  try{const before=geometryPreservationV206(root),stat=staticGeometryAudit(root),restore=restoreFamilyBeforeV281(root,family);
    try{expect(sha(JSON.stringify(geometryPreservationV206(root)))).toBe(proof.families[family].beforeRecordsSha256);expect(geometryPreservationV206(root)).not.toEqual(before);}finally{restore();}
    expect(geometryPreservationV206(root)).toEqual(before);expect(staticGeometryAudit(root)).toEqual(stat);
    const mesh:any=root.getObjectByName("Mapped Vorderlandmauer and underwater boundary course, 1989"),position=mesh.geometry.getAttribute("position");const old=position.array[0];position.array[0]=old+1;
    const changed=geometryPreservationV206(root);expect(()=>restoreFamilyBeforeV281(root,family)).toThrow();expect(geometryPreservationV206(root)).toEqual(changed);position.array[0]=old;
    expect(geometryPreservationV206(root)).toEqual(before);
  }finally{disposeStaticAudit(root);}
});
