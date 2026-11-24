import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {Box3,Mesh,Vector3} from "three";
import {attachBerlinDetailsV378} from "../src/berlinDetailSitesV378";
import {attachRykeBasilicaV381} from "../src/rykeBasilicaV381";
import {createReligiousSitesV205} from "../src/ReligiousSitesV205";
import {createPrenzlbergV264} from "../src/PrenzlbergV264";
import {loadSourceQuarterRecipesV309} from "../src/SourceQuarterCatalogueV309";
import {createSurroundingCityChunk,type SurroundingCityChunk} from "../src/SurroundingCityGeometry";
import {disposeSurroundingCityRoot} from "../src/disposeSurroundingCityRootV323";

const host = "6_-4", frontage = "DEBE03YY600007vG";
for (const native of [false,true]) {
  const mode = native ? "minecraft" : "drawn";
  test("the historic basilica belongs to the direct-start city tile in " + mode, async () => {
    const group=createReligiousSitesV205(native,true);
    expect(group.children).toHaveLength(5);
    expect(group.children.some(g=>g.userData.siteId==="rykestrasse")).toBe(false);
    const url=new URL("../public/mesh/surrounding-berlin-v159/"+host+"."+mode+".json.gz",import.meta.url);
    const raw:SurroundingCityChunk=JSON.parse(gunzipSync(readFileSync(url)).toString());
    const entry=createSurroundingCityChunk(raw,host,native);
    const before=entry.geometryBytes;
    const signal=new AbortController().signal;
    await attachRykeBasilicaV381(entry,"6_-5",native,signal);
    await attachRykeBasilicaV381(entry,host,native,AbortSignal.abort());
    expect(entry.geometryBytes).toBe(before);
    await Promise.all([attachRykeBasilicaV381(entry,host,native,signal),attachRykeBasilicaV381(entry,host,native,signal)]);
    expect(entry.root.userData.rykeBasilicaV381).toBe(true);
    const found:Mesh[]=[];
    entry.root.traverse(o=>{if(o instanceof Mesh&&o.userData.rykeBasilicaV381)found.push(o)});
    expect(found).toHaveLength(1);
    const mesh=found[0];
    expect(mesh.userData.sourceOwner).toBe("DEBE03YY600004DV");
    expect(mesh.userData.dayMaterial).toBeTruthy();
    expect(mesh.userData.nightMaterial).toBeTruthy();
    entry.root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(mesh);
    expect(bounds.min.x).toBeGreaterThan(3210);
    expect(bounds.max.x).toBeLessThan(3268);
    expect(bounds.min.z).toBeGreaterThan(-1797);
    expect(bounds.max.z).toBeLessThan(-1724);
    expect(bounds.min.y).toBeCloseTo(3,0);
    expect(bounds.max.y).toBeCloseTo(26.345,0);
    expect(entry.geometryBytes).toBeGreaterThan(before);
    const position = mesh.geometry.getAttribute("position");
    const indices = mesh.geometry.index!;
    expect(indices.count/3).toBeLessThan(native?26000:3400);
    const colors = mesh.geometry.getAttribute("color");
    const palette = new Set<number>();
    for(let i=0;i<colors.count;i++) {
      palette.add(colors.array[i*3]*65536 + colors.array[i*3+1]*256 + colors.array[i*3+2]);
    }
    expect(palette.size).toBeGreaterThan(10);
    if (native) {
      const a=new Vector3(), b=new Vector3(), c=new Vector3();
      let diagonal=0;
      for (let i=0;i<indices.count;i+=3) {
        a.fromBufferAttribute(position,indices.getX(i));
        b.fromBufferAttribute(position,indices.getX(i+1)).sub(a);
        c.fromBufferAttribute(position,indices.getX(i+2)).sub(a);
        const normal=b.cross(c);
        if ([normal.x,normal.y,normal.z].filter(v=>v!==0).length!==1) diagonal++;
      }
      expect(diagonal).toBe(0);
    }
    const oldAccent=createPrenzlbergV264(native,true);
    expect(oldAccent.children.some(c=>c.userData.siteKey==="rykestrasse")).toBe(false);
    expect(oldAccent.children.some(c=>c.userData.siteKey==="planetarium")).toBe(true);
    disposeSurroundingCityRoot(entry.root);
    disposeSurroundingCityRoot(oldAccent);
    disposeSurroundingCityRoot(group);
  });

  test("the street house exchanges its original owner inside its actual city tile in " + mode, async () => {
    const url=new URL("../public/mesh/surrounding-berlin-v159/"+host+"."+mode+".json.gz",import.meta.url);
    const raw:SurroundingCityChunk=JSON.parse(gunzipSync(readFileSync(url)).toString());
    const recipes=await loadSourceQuarterRecipesV309(host,native);
    expect(recipes.filter(r=>r.kind==="ryke-street-house-v381")).toHaveLength(1);
    const create=(source:SurroundingCityChunk, sources=recipes)=>createSurroundingCityChunk(source,host,native,{
      sourceQuartersV303:true,sourceQuarterSourcesV303:sources,groundOverlaysV329:false,
    });
    const original=raw.nav.buildings.find(b=>b.sourceId===frontage)!;
    const baseline=create(raw, recipes.filter(r=>r.kind!=="ryke-street-house-v381"));
    const actual=create(raw);
    try {
      await Promise.all([actual,baseline].map(entry=>
        attachBerlinDetailsV378(entry,host,native,new AbortController().signal)
      ));
      expect(actual.root.userData.rykeBasilicaV381).toBe(true);
      expect(actual.root.userData.sourceQuarterOwnersV303).toContain(frontage);
      expect(actual.root.userData.sourceQuarterTrianglesV303).toBeGreaterThanOrEqual(native?112:34);
      const replacement=actual.nav.buildings.filter(b=>b.sourceId===frontage);
      expect(replacement).not.toContainEqual(original);
      if (native) expect(replacement.length).toBeGreaterThan(6);
      else expect(replacement[0].roofTriangles!.length).toBeGreaterThan(3);
      expect(Math.max(...replacement.map(r=>r.height))).toBeLessThan(29.1);
      expect(actual.nav.buildings.filter(b=>b.sourceId!==frontage)).toEqual(
        baseline.nav.buildings.filter(b=>b.sourceId!==frontage)
      );
    } finally { disposeSurroundingCityRoot(actual.root); disposeSurroundingCityRoot(baseline.root); }
    const fallback=create({...raw,nav:{...raw.nav,groundY:raw.nav.groundY+.005}});
    try {
      expect(fallback.nav.buildings.filter(b=>b.sourceId===frontage)).toEqual([original]);
      expect(fallback.root.userData.sourceQuarterOwnersV303).not.toContain(frontage);
    } finally { disposeSurroundingCityRoot(fallback.root); }
  });
}
