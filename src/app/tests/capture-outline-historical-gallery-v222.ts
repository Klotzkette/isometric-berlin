import { plugin } from "bun";
import { resolve } from "node:path";
// Run twice from any directory: bun tests/capture-outline-historical-gallery-v222.ts [--historical].
// Each process prints one immutable-source side of the compact receipt.
const repo = resolve(import.meta.dir, "../../..");
const currentBase = "aa9a58cea59a0a00c50eacab12dc75362b88e239";
const inputs = Bun.spawnSync(["git", "diff", "--quiet", currentBase, "--", "src/app/src/data"], {cwd: repo});
if (inputs.exitCode) throw Error("Historical source JSON inputs no longer match v121");
const historical = process.argv.includes("--historical");
const git = (ref: string, path: string) => { const r = Bun.spawnSync(["git", "show", `${ref}:${path}`], {cwd: repo}); if(r.exitCode) throw Error(r.stderr.toString()); return r.stdout.toString(); };
plugin({name:"immutable-source audit",setup(build){build.onLoad({filter:/\/src\/app\/src\/.*\.ts$/},args=>({contents:git(historical && args.path.endsWith("/NeueNationalgalerieV183.ts") ? "6e58dc7a14780239b7dd2157203800deca2cce38" : currentBase,args.path.slice(repo.length+1)),loader:"ts",resolveDir:resolve(args.path,"..")}));}});
const {createOutlineLandmarksV182,disposeOutlineConstruction}=await import(`${repo}/src/app/src/OutlineLandmarksV182.ts`);
const {restoreOutlineEstimatesV210,outlineAdditionsV210}=await import(`${repo}/src/app/tests/helpers/outlinePreservationV210.ts`);
const {outlineSignature}=await import(`${repo}/src/app/tests/helpers/outlineConstructionSignature.ts`);
const {detachNationalgalerieSculpturesV221}=await import(`${repo}/src/app/tests/helpers/nationalgalerieSculpturesV221.ts`);
const result:any={};
for(const mode of ["day","minecraft"] as const){
 const root=createOutlineLandmarksV182(mode); const original=[...root.children];
 const restore=historical?()=>{}:detachNationalgalerieSculpturesV221(root,mode==="minecraft");
 const cleanup=restoreOutlineEstimatesV210(root,mode);
 try {
  const names=new Set(outlineAdditionsV210(mode));
  for(const name of ["Bundeswehrkrankenhaus source facade and helipad v214","Litfin neighbours v215","Gendarmenmarkt and BND neighbours v214","WZB and Potsdamer park-side source facade accents v214"]) names.add(name+(mode==="minecraft"?" native":""));
  names.add("Red rescue helicopter landing at Bundeswehrkrankenhaus v214");
  root.children=original.filter(c=>!names.has(c.name)); const v209=outlineSignature(root);
  for(const name of ["Tegel and two distinct Stasi memorial sites v209 exterior details","Helmholtzplatz community and cafe facades v209"]) names.add(name+(mode==="minecraft"?" native":""));
  names.add("Exact Orankesee shore and mapped public lido fittings v209");
  root.children=original.filter(c=>!names.has(c.name)); const v208=outlineSignature(root);
  for(const name of ["Northern Linden corridor architecture v208","Russian Embassy and Aeroflot architectural refinements v208","BMAS campus and Quartier 206 architecture v208"]) names.add(name+(mode==="minecraft"?" native":""));
  root.children=original.filter(c=>!names.has(c.name)); const v207=outlineSignature(root);
  if(historical) for(const [version,value] of Object.entries({v207,v208,v209})) { const old=await Bun.file(`${repo}/src/app/tests/fixtures/outline-landmarks-${version}-synchronous.json`).json(); if(JSON.stringify(value)!==JSON.stringify(old[mode])) throw Error(`Historical ${mode}/${version} does not reproduce its frozen digest: ${JSON.stringify(value)}`); }
  result[mode]={v207,v208,v209};
 }finally{root.children=original;cleanup();restore();disposeOutlineConstruction(root);}
}
console.log(JSON.stringify(result,null,2));
