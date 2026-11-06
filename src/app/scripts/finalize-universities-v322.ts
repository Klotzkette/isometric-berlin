/** Pin the canonical JS serialization without changing any source geometry. */
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const repo=resolve(import.meta.dir,"../../.."),app=resolve(repo,"src/app"),file=resolve(app,"src/data/universitiesArchitectureV322.json"),profile=JSON.parse(readFileSync(file,"utf8")),previous=JSON.parse(readFileSync(resolve(app,"src/data/universitiesPreviousV322.json"),"utf8"));
const fnv=(v:unknown)=>{const text=JSON.stringify(v);let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;return h;};
if(profile.sites.length!==18||profile.models.length!==45||profile.oldBodies.length!==21||profile.sourcePrisms.length!==22)throw Error("Incomplete finite universities profile");
const controls=Object.fromEntries(Object.entries(previous.plans).map(([k,v])=>[k,fnv(v)]));
const provider=resolve(app,"src/universitiesPreviousV322.ts");let text=readFileSync(provider,"utf8");if(!/const controls:Record<Key,number>=\{[^;]+\};/.test(text))throw Error("Provider literal guard moved");text=text.replace(/const controls:Record<Key,number>=\{[^;]+\};/,"const controls:Record<Key,number>="+JSON.stringify(controls)+";");writeFileSync(provider,text);
const factory=resolve(app,"src/UniversitiesArchitectureV322.ts");text=readFileSync(factory,"utf8");text=text.replace(/const CONTROL:number=\d+;/,"const CONTROL:number="+fnv(profile)+";").replace(/const OLD_BODY_CONTROL:number=\d+;/,"const OLD_BODY_CONTROL:number="+fnv(profile.oldBodies)+";");writeFileSync(factory,text);
const pins={schemaVersion:1,profileControl:fnv(profile),oldBodyControl:fnv(profile.oldBodies),planControls:controls,sites:profile.sites.length,models:profile.models.length,parts:profile.sites.reduce((n:number,s:any)=>n+s.partIds.length,0)};
writeFileSync(resolve(repo,"geo_data/regierungsviertel/universities-v322-controls.json"),JSON.stringify(pins)+"\n");console.log(JSON.stringify(pins));
