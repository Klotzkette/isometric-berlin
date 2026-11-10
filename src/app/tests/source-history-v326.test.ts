import {expect,test}from'bun:test';
import {createHash}from'node:crypto';
import {readFileSync,existsSync,readdirSync}from'node:fs';
import {execFileSync,spawn}from'node:child_process';
import {fileURLToPath}from'node:url';
import ts from'typescript';
import {assertSourceLayerV326,SOURCE_HISTORY_PROOF_SHA_V326,verifySourceLayerV326,published206SourceGraphV326,sourceAtPublished206V326,projectSourceBeforeV326,SOURCE_HISTORY_PUBLISHED_V206_V326,SOURCE_HISTORY_PROOF_V325_SHA_V326,SOURCE_HISTORY_CAPTURE_SHA_V326,type SourceReceiptV326}from'./helpers/sourceHistoryV326';
import {verifySourceLayerV325,sourceAtPublished205V325,SOURCE_HISTORY_PUBLISHED_V205_V325,SOURCE_HISTORY_PROOF_V324_SHA_V325,SOURCE_HISTORY_CAPTURE_SHA_V325,type SourceReceiptV325}from'./helpers/sourceHistoryV325';

import { sourceAtPublished207V327 } from "./helpers/sourceHistoryV327";

const sha=(raw:string|Uint8Array)=>createHash('sha256').update(raw).digest('hex');
const inverse=(before:string,current:string)=>({beforeSha256:sha(before),currentSha256:sha(current),replacements:[{before,current}]});
const tool='/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/release-plan-v207/capture_source_bridge_v326.py';
const fixture=()=>{const file='src/app/src/Packet.ts',retained='src/app/public/mesh/source.json',addition='src/app/src/PublicSitesV326.ts',before='export const version = 206;\n// complete source roof and outside\n',current='export const version = 207;\n// complete source roof and outside\n',publicBytes='{"completeOriginalRows":true}\n',added='export const finiteSourceBoundSites = true;\n';const published={[file]:sha(before),[retained]:sha(publicBytes)},files:Record<string,string>={[file]:current,[retained]:publicBytes,[addition]:added};const receipt:SourceReceiptV326={schemaVersion:1,publishedCommit:SOURCE_HISTORY_PUBLISHED_V206_V326,previousProofSha256:SOURCE_HISTORY_PROOF_V325_SHA_V326,captureToolSha256:SOURCE_HISTORY_CAPTURE_SHA_V326,additions:{[addition]:sha(added)},changes:{[file]:inverse(before,current)}};return{file,retained,addition,before,current,published,files,receipt,inventory:Object.keys(files),read:(p:string)=>Buffer.from(files[p])};};

test('finite326 synthetic inversion preserves complete206 bytes and composes independently with immutable325',()=>{
 const f=fixture(),layer=verifySourceLayerV326(f.receipt,f.published,f.inventory,f.read),old206=sourceAtPublished206V326(f.file,f.read(f.file),layer);expect(Buffer.from(old206).toString()).toBe(f.before);expect(projectSourceBeforeV326(f.current,layer)).toBe(f.before);expect(sourceAtPublished206V326(f.retained,f.read(f.retained),layer)).toEqual(f.read(f.retained));expect(Object.isFrozen(layer)).toBe(true);expect(Object.isFrozen(f.receipt.changes[f.file].replacements[0])).toBe(true);
 const before205=f.before.replace('206','205'),old:SourceReceiptV325={schemaVersion:1,publishedCommit:SOURCE_HISTORY_PUBLISHED_V205_V325,previousProofSha256:SOURCE_HISTORY_PROOF_V324_SHA_V325,captureToolSha256:SOURCE_HISTORY_CAPTURE_SHA_V325,additions:{},changes:{[f.file]:inverse(before205,f.before)}},previous=verifySourceLayerV325(old,{...f.published,[f.file]:sha(before205)},Object.keys(f.published),p=>sourceAtPublished206V326(p,f.read(p),layer));expect(Buffer.from(sourceAtPublished205V325(f.file,old206,previous)).toString()).toBe(before205);expect(Object.keys(f.receipt)).not.toContain('currentGraph');expect(Object.keys(f.receipt)).not.toContain('publishedGraph');
});

test('all retained/current/added words, finite inventory and full inverse outside are mandatory',()=>{
 for(const name of['file','retained','addition']as const){const f=fixture();f.files[f[name]]+=' ';expect(()=>verifySourceLayerV326(f.receipt,f.published,f.inventory,f.read)).toThrow('Changed complete');}
 const outside=fixture();outside.receipt.changes[outside.file].replacements[0].before='export const version = 206;\n';expect(()=>verifySourceLayerV326(outside.receipt,outside.published,outside.inventory,outside.read)).toThrow('full v326 source complement');
 const nochange=fixture();delete nochange.receipt.changes[nochange.file];expect(()=>verifySourceLayerV326(nochange.receipt,nochange.published,nochange.inventory,nochange.read)).toThrow('Changed complete');
 for(const mode of['unknown','missing','duplicate']){const f=fixture();if(mode==='unknown')f.inventory.push('src/app/src/Unknown.ts');if(mode==='missing')f.inventory.pop();if(mode==='duplicate')f.inventory.push(f.file);expect(()=>verifySourceLayerV326(f.receipt,f.published,f.inventory,f.read)).toThrow('source inventory');}
 const path=fixture();path.receipt.additions['src/app/src/../Escape.ts']=sha('escape');expect(()=>verifySourceLayerV326(path.receipt,path.published,path.inventory,path.read)).toThrow('Invalid or duplicate');
 const duplicate=fixture();duplicate.receipt.additions[duplicate.file]=sha(duplicate.current);expect(()=>verifySourceLayerV326(duplicate.receipt,duplicate.published,duplicate.inventory,duplicate.read)).toThrow('duplicate');
 for(const anchor of['publishedCommit','previousProofSha256','captureToolSha256']as const){const f=fixture();f.receipt[anchor]='0'.repeat(64);expect(()=>verifySourceLayerV326(f.receipt,f.published,f.inventory,f.read)).toThrow('Unknown immutable');}
});

test('only privately admitted exact source bytes project; literal replacements and ambiguous fingerprints remain closed',()=>{
 const f=fixture(),layer=verifySourceLayerV326(f.receipt,f.published,f.inventory,f.read);expect(()=>sourceAtPublished206V326(f.addition,f.read(f.addition),layer)).toThrow('Unknown exact');expect(()=>sourceAtPublished206V326(f.file,f.read(f.file),structuredClone(layer))).toThrow('Unknown exact');expect(()=>projectSourceBeforeV326(f.current,structuredClone(layer))).toThrow('Unverified');expect(()=>sourceAtPublished206V326(f.file,Buffer.from(f.current+' '),layer)).toThrow('Unknown exact');
 const literal=fixture(),before="export const literal = '$& $` $\u0027 $$';\n";literal.published[literal.file]=sha(before);literal.receipt.changes[literal.file]=inverse(before,literal.current);const admitted=verifySourceLayerV326(literal.receipt,literal.published,literal.inventory,literal.read);expect(Buffer.from(sourceAtPublished206V326(literal.file,literal.read(literal.file),admitted)).toString()).toBe(before);
 const ambiguous=fixture();ambiguous.receipt.changes[ambiguous.file].replacements[0].current='e';expect(()=>verifySourceLayerV326(ambiguous.receipt,ambiguous.published,ambiguous.inventory,ambiguous.read)).toThrow('Ambiguous exact');
 const duplicate=fixture();duplicate.files[duplicate.addition]=duplicate.current;duplicate.receipt.additions[duplicate.addition]=sha(duplicate.current);const d=verifySourceLayerV326(duplicate.receipt,duplicate.published,duplicate.inventory,duplicate.read);expect(()=>projectSourceBeforeV326(duplicate.current,d)).toThrow('Ambiguous full');
});

test('immutable318–325 reconstruct all2019 published206 paths; every older proof byte stays pinned',()=>{
 const raws=[318,319,320,321,322,323,324,325].map(v=>readFileSync(new URL(`./fixtures/source-history-v${v}.json`,import.meta.url))),graph=published206SourceGraphV326(raws[0],raws[1],raws[2],raws[3],raws[4],raws[5],raws[6],raws[7]);expect(Object.keys(graph)).toHaveLength(2019);expect(Object.isFrozen(graph)).toBe(true);expect(sha(raws[7])).toBe(SOURCE_HISTORY_PROOF_V325_SHA_V326);expect(sha(JSON.stringify(Object.fromEntries(Object.keys(graph).sort().map(p=>[p,graph[p]]))))).toBe('4c6298d9d68f34ae032cdb10a05f2eb4140108e260310ee22d1cadacf30dfbd2');
 for(let i=0;i<raws.length;i++){const bad=[...raws];bad[i]=Buffer.concat([bad[i],Buffer.from(' ')]);expect(()=>published206SourceGraphV326(bad[0],bad[1],bad[2],bad[3],bad[4],bad[5],bad[6],bad[7])).toThrow('Changed immutable');}
 const tree=execFileSync('git',['ls-tree','-r','--name-only',SOURCE_HISTORY_PUBLISHED_V206_V326,'--','src/app/src'],{cwd:new URL('../../..',import.meta.url),encoding:'utf8'}).trim().split('\n').filter(p=>/\.(?:ts|tsx|json)$/.test(p)).sort();expect(tree).toEqual(Object.keys(graph).filter(p=>p.startsWith('src/app/src/')).sort());
});

test.skipIf(!existsSync(tool))('external strict-delta tool verifies all independent Git206 blob bytes and refuses capture without freeze',()=>{
 if(!existsSync(tool))throw Error('Prepared external capture tool missing');expect(sha(readFileSync(tool))).toBe(SOURCE_HISTORY_CAPTURE_SHA_V326);
 const root=fileURLToPath(new URL('../../..',import.meta.url)),result=Bun.spawnSync(['uv','run','python',tool,root,'--verify-published-only'],{cwd:root});expect(result.exitCode).toBe(0);const evidence=JSON.parse(result.stdout.toString());expect(evidence.publishedCommit).toBe(SOURCE_HISTORY_PUBLISHED_V206_V326);expect(evidence.publishedPaths).toBe(2019);expect(evidence.graphSha256).toBe('4c6298d9d68f34ae032cdb10a05f2eb4140108e260310ee22d1cadacf30dfbd2');expect(evidence.allGitBlobBytesExact).toBe(true);
 const proof=new URL('./fixtures/source-history-v326.json',import.meta.url),before=existsSync(proof)?sha(readFileSync(proof)):null,nofreeze=Bun.spawnSync(['uv','run','python',tool,root],{cwd:root});expect(nofreeze.exitCode).not.toBe(0);expect(nofreeze.stderr.toString()).toContain('Capture requires Root freeze');expect(existsSync(proof)?sha(readFileSync(proof)):null).toBe(before);
},30000);

test('new history helper imports no earlier helper and the complete existing helper graph stays acyclic',()=>{
 const directory=new URL('./helpers/',import.meta.url),graph=new Map<string,string[]>();for(const name of readdirSync(directory).filter(n=>/^sourceHistoryV\d+\.ts$/.test(n))){const ast=ts.createSourceFile(name,readFileSync(new URL(name,directory),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);graph.set(name,ast.statements.flatMap(n=>ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&/^\.\/sourceHistoryV\d+$/.test(n.moduleSpecifier.text)?[n.moduleSpecifier.text.slice(2)+'.ts']:[]));}expect(graph.get('sourceHistoryV326.ts')).toEqual(['sourceHistoryV327.ts']);expect(graph.get('sourceHistoryV327.ts')).toEqual(['sourceHistoryV328.ts']);expect(graph.get('sourceHistoryV328.ts')).toEqual(['sourceHistoryV329.ts']);expect(graph.get('sourceHistoryV329.ts')).toEqual(['sourceHistoryV330.ts']);expect(graph.get('sourceHistoryV330.ts')).toEqual([]);const active=new Set<string>(),done=new Set<string>();const visit=(p:string)=>{expect(active.has(p)).toBe(false);if(done.has(p))return;active.add(p);for(const next of graph.get(p)??[])visit(next);active.delete(p);done.add(p);};for(const p of graph.keys())visit(p);
});

test("the complete reconstructed 206 inventory and every original blob match independent Git206 bytes", async () => {
  const raws = [318, 319, 320, 321, 322, 323, 324, 325].map(version => readFileSync(new URL(`./fixtures/source-history-v${version}.json`, import.meta.url)));
  const graph = published206SourceGraphV326(raws[0], raws[1], raws[2], raws[3], raws[4], raws[5], raws[6], raws[7]);
  const paths = Object.keys(graph).sort(), cwd = new URL("../../..", import.meta.url);
  const tree = execFileSync("git", ["ls-tree", "-r", "--name-only", SOURCE_HISTORY_PUBLISHED_V206_V326, "--", "src/app/src"], { cwd, encoding: "utf8" })
    .trim().split("\n").filter(path => /\.(?:ts|tsx|json)$/.test(path)).sort();
  expect(tree).toEqual(paths.filter(path => path.startsWith("src/app/src/")));
  expect(sha(JSON.stringify(Object.fromEntries(paths.map(path => [path, graph[path]])))))
    .toBe("4c6298d9d68f34ae032cdb10a05f2eb4140108e260310ee22d1cadacf30dfbd2");

  // One bounded stream hashes the blobs without retaining a full source graph
  // of bytes or launching one subprocess per source. No workspace bytes enter
  // this independent published-history check.
  const process = spawn("git", ["cat-file", "--batch"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
  const closed = new Promise<number | null>((resolve, reject) => {
    process.once("error", reject); process.once("close", code => resolve(code));
  });
  let stderr = "";
  process.stderr.on("data", chunk => { stderr += chunk.toString(); });
  process.stdin.end(paths.map(path => `${SOURCE_HISTORY_PUBLISHED_V206_V326}:${path}\n`).join(""));
  let pending = Buffer.alloc(0), remaining: number | null = null, index = 0;
  let digest: ReturnType<typeof createHash> | null = null;
  try {
    for await (const chunk of process.stdout) {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      for (;;) {
        if (remaining === null) {
          const newline = pending.indexOf(10); if (newline < 0) break;
          const header = pending.subarray(0, newline).toString("utf8").split(" ");
          expect(header).toHaveLength(3); expect(header[1]).toBe("blob");
          remaining = Number(header[2]);
          expect(Number.isSafeInteger(remaining) && remaining >= 0 && index < paths.length).toBeTrue();
          digest = createHash("sha256"); pending = pending.subarray(newline + 1);
        }
        const length = Math.min(remaining, pending.length);
        digest!.update(pending.subarray(0, length)); pending = pending.subarray(length); remaining -= length;
        if (remaining || !pending.length) break;
        expect(pending[0]).toBe(10); pending = pending.subarray(1);
        expect(digest!.digest("hex")).toBe(graph[paths[index++]]);
        digest = null; remaining = null;
      }
    }
    expect(await closed).toBe(0); expect(stderr).toBe("");
    expect(index).toBe(2019); expect(remaining).toBeNull(); expect(pending.length).toBe(0);
  } finally {
    process.stdin.destroy(); process.stdout.destroy(); process.stderr.destroy();
    if (process.exitCode === null) process.kill();
  }
}, 30000);


test("the frozen actual207 default layer proves every2093 path and complete2019 published206 bytes", () => {
  const raw=readFileSync(new URL("./fixtures/source-history-v326.json",import.meta.url));
  expect(sha(raw)).toBe(SOURCE_HISTORY_PROOF_SHA_V326);
  const layer=assertSourceLayerV326(),root=new URL("../../..",import.meta.url);
  expect(Object.keys(layer.currentGraph)).toHaveLength(2093);
  expect(Object.keys(layer.publishedGraph)).toHaveLength(2019);
  expect(Object.keys(layer.receipt.additions)).toHaveLength(74);
  expect(Object.keys(layer.receipt.changes)).toHaveLength(9);
  for(const path of Object.keys(layer.currentGraph)){
    const current=readFileSync(new URL(path,root));
    expect(sha(sourceAtPublished207V327(path,current))).toBe(layer.currentGraph[path]);
    if(Object.hasOwn(layer.receipt.additions,path)){
      expect(()=>sourceAtPublished206V326(path,current)).toThrow("Unknown exact");
      expect(()=>sourceAtPublished205V325(path,current)).toThrow("Unknown exact");
      continue;
    }
    const before=sourceAtPublished206V326(path,current);
    expect(sha(before)).toBe(layer.publishedGraph[path]);
    if(Object.hasOwn(layer.receipt.changes,path))expect(projectSourceBeforeV326(current.toString())).toBe(Buffer.from(before).toString());
  }
  const file="src/app/tests/helpers/sourceHistoryV325.ts",before=execFileSync("git",["show",`${SOURCE_HISTORY_PUBLISHED_V206_V326}:${file}`],{cwd:root,encoding:"utf8"}),current=readFileSync(new URL("./helpers/sourceHistoryV325.ts",import.meta.url),"utf8");
  const unchanged=(source:string)=>{const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);return ast.statements.filter(node=>!ts.isImportDeclaration(node)&&!(ts.isFunctionDeclaration(node)&&["assertSourceLayerV325","sourceAtPublished205V325","projectSourceBeforeV325"].includes(node.name?.text??""))).map(node=>node.getText(ast));};
  expect(unchanged(current)).toEqual(unchanged(before));
},30000);
