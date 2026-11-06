import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {
  governmentPreviousPrismV321 as lightGovernment,
  universitiesPreviousPrismV322 as lightUniversity,
} from "../src/GovernmentOfficeOwnershipV323";
import {governmentPreviousPrismV321 as fullGovernment} from "../src/GovernmentOfficesV321";
import {universitiesPreviousPrismV322 as fullUniversity} from "../src/UniversitiesArchitectureV322";
import index from "../src/data/governmentOfficeOriginalPrismsV323.json";

const read = (file: string) => JSON.parse(readFileSync(new URL("../src/data/" + file, import.meta.url), "utf8"));
const clone = <T>(value: T): T => structuredClone(value);

test("small synchronous classifiers contain every complete original record and no model or source-plan data", () => {
  expect(index.federal).toEqual(read("federalMinistriesV321.json").oldBodies);
  expect(index.senate).toEqual(read("berlinSenateBuildingsV321.json").oldBodies);
  expect(index.universities).toEqual(read("universitiesArchitectureV322.json").oldBodies);
  expect([index.federal.length,index.senate.length,index.universities.length]).toEqual([5,1,21]);
  const code=readFileSync(new URL("../src/GovernmentOfficeOwnershipV323.ts",import.meta.url),"utf8");
  const imports=[...code.matchAll(/\bimport[\s\S]*?from\s+["']([^"']+)["'];/g)].map(match=>match[1]);
  expect(imports).toEqual(["./data/governmentOfficeOriginalPrismsV323.json"]);
  expect(code).not.toMatch(/\bimport\s*\(/);
  expect(JSON.stringify(index).length).toBeLessThan(13000);
});

test("light and retained full classifiers agree on every complete owner, clone, foreign family and own-data corruption", () => {
  for(const original of [...index.federal,...index.senate,...index.universities]){
    const variants:unknown[]=[original,clone(original),null,{}, {id:original.id}, {...original,unexpected:true}];
    const altered=clone(original);altered.h_dm++;variants.push(altered);
    const moved=clone(original);moved.ring[0][0]++;variants.push(moved);
    const inherited=Object.create(original);variants.push(inherited);
    const customPrototype=Object.assign(Object.create({foreign:true}),clone(original));variants.push(customPrototype);
    let getterReads=0;
    const accessor=clone(original);Object.defineProperty(accessor,"h_dm",{get(){getterReads++;return original.h_dm;},enumerable:true});variants.push(accessor);
    const idAccessor=clone(original);Object.defineProperty(idAccessor,"id",{get(){getterReads++;return original.id;},enumerable:true});variants.push(idAccessor);
    for(const variant of variants){expect(lightGovernment(variant)).toBe(fullGovernment(variant));expect(lightUniversity(variant)).toBe(fullUniversity(variant));}
    expect(getterReads).toBe(0);
  }
});

test("all actual retained source records classify identically and only the exact 27 originals match", () => {
  const prisms=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8"));
  let government=0,universities=0;
  for(const prism of prisms.buildings){const g=lightGovernment(prism),u=lightUniversity(prism);expect(g).toBe(fullGovernment(prism));expect(u).toBe(fullUniversity(prism));government+=+g;universities+=+u;}
  expect(government).toBe(6);expect(universities).toBe(21);
});
