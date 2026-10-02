import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const cases = [
  { module: "CityWestCinemasV166", data: "cityWestCinemasV166Source", field: "nativeBlocks", count: "nativeSourceBlocks",
    day: "createCityWestCinemasV166", native: "createMinecraftCityWestCinemasV166", budget: "CITYWEST_CINEMAS_V166_RENDER_BUDGET" },
  { module: "NeueSynagogeV167", data: "neueSynagogeV167Source", field: "nativeBlocks", count: "nativeBlocks",
    day: "createNeueSynagogeV167", native: "createMinecraftNeueSynagogeV167", budget: "NEUE_SYNAGOGE_V167_RENDER_BUDGET" },
  { module: "KosmosV166", data: "kosmosV166Source", field: "nativeBlocks", count: "nativeSourceBlocks",
    day: "createKosmosV166", native: "createMinecraftKosmosV166", budget: "KOSMOS_V166_RENDER_BUDGET" },
  { module: "HumboldtMainV168Details", data: "humboldtMainV168Source", field: "nativeBoxes", count: "nativeBoxes",
    day: "createHumboldtMainV168Details", native: "createMinecraftHumboldtMainV168Details", budget: "HUMBOLDT_MAIN_V168_RENDER_BUDGET" },
];

for (const fixture of cases) {
  test(`${fixture.module}: drawn factories leave native rows unread and metadata still reports exact counts`, async () => {
    const dataPath = fileURLToPath(new URL(`../src/data/${fixture.data}.json`, import.meta.url));
    const modulePath = fileURLToPath(new URL(`../src/${fixture.module}.ts`, import.meta.url));
    const source = await Bun.file(dataPath).text();
    const expected = JSON.parse(source)[fixture.field].length;
    const sourceSuffix = `
      const rows=source[${JSON.stringify(fixture.field)}];
      Object.defineProperty(source,${JSON.stringify(fixture.field)}, {
        enumerable:true,configurable:true,get(){globalThis.nativeBudgetReads++;return rows;}
      });
      export default source;`;
    const script = `
      import { plugin } from "bun";
      import { readFileSync } from "node:fs";
      const sourceModule="const source=JSON.parse("+JSON.stringify(readFileSync(${JSON.stringify(dataPath)},"utf8"))+");"+${JSON.stringify(sourceSuffix)};
      globalThis.nativeBudgetReads=0;
      plugin({name:"native-budget-read-audit",setup(build){
        build.onLoad({filter:/${fixture.data}\\.json$/},()=>({loader:"js",contents:sourceModule}));
      }});
      const model=await import(${JSON.stringify(modulePath)});
      if(globalThis.nativeBudgetReads!==0)throw new Error("Module metadata decoded native rows");
      const release=root=>root.traverse(o=>{o.geometry?.dispose();for(const m of new Set([o.material,o.userData.dayMaterial,o.userData.nightMaterial]))if(m&&!Array.isArray(m))m.dispose();});
      for(const options of [{},{mobileLike:true}]){
        const root=model[${JSON.stringify(fixture.day)}](options);
        if(globalThis.nativeBudgetReads!==0)throw new Error("Drawn construction decoded native rows");
        if(root.children.length===0)throw new Error("Drawn geometry missing");
        if(root.userData.renderBudget!==model[${JSON.stringify(fixture.budget)}])throw new Error("Metadata identity changed");
        release(root);
      }
      const budget=model[${JSON.stringify(fixture.budget)}];
      if(!Object.isFrozen(budget)||budget[${JSON.stringify(fixture.count)}]!==${expected})throw new Error("Native count changed");
      if(globalThis.nativeBudgetReads!==1)throw new Error("Explicit native metadata did not read its source");
      const root=model[${JSON.stringify(fixture.native)}]();
      if(globalThis.nativeBudgetReads<2||root.children.length===0)throw new Error("Native construction did not use complete native rows");
      release(root);
      console.log("drawn and native metadata lifetimes verified");
    `;
    const result = Bun.spawnSync([process.execPath, "--eval", script]);
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("drawn and native metadata lifetimes verified");
  });
}
