import {expect,test} from "bun:test";
import {readFileSync,statSync} from "node:fs";
import {Group,Mesh,MeshBasicMaterial,Vector3} from "three";
import {kollwitzKiezViewsV381} from "../src/kollwitzKiezViewsV381";
import {attachKollwitzStreetFurnitureV381} from "../src/kollwitzStreetFurnitureV381";
import {openingSiteOwnerV379} from "../src/openingSiteOwnerV379";
import {loadBerlinPlaceViewsV378,startupViewSelection} from "../src/startupView";
import {sightSlug} from "../src/viewNavigation";
import {surroundingBuildingSolidAt,type SurroundingChunkGeometry} from "../src/SurroundingCityGeometry";

const survey=JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/kollwitz-stadtmoebel-v381.json",import.meta.url),"utf8")) as {
  columns:{surveyId:string;xy:[number,number];osmXZ:[number,number];h:number}[];
  plaque:{drawn:number[];native:number[]};
};

test("each local camera resolves in the normal viewer and selects all required resident geometry",async()=>{
  await loadBerlinPlaceViewsV378();
  const names=Object.keys(kollwitzKiezViewsV381);
  expect(new Set(names.map(sightSlug)).size).toBe(names.length);
  for(const [name,{target}] of Object.entries(kollwitzKiezViewsV381)){
    expect(startupViewSelection([],"#landmark="+sightSlug(name))).toEqual({name,automatic:false});
    const [x,,z]=target;
    const owner=openingSiteOwnerV379(name,x,z);
    expect(owner.required).toContain(Math.floor(x/512)+"_"+Math.floor(z/512));
    expect(owner.waitForAll === true).toBe(owner.required.length>1);
  }
  expect(openingSiteOwnerV379("Kollwitzplatz",3139,-1852).required).toContain("kollwitz381-platz");
  expect(openingSiteOwnerV379("Wasserturm Prenzlauer Berg",3236,-1629).required).toContain("wasserturm381-park");
  expect(openingSiteOwnerV379("Synagoge Rykestraße",3230,-1743).required).toEqual(["6_-4"]);
});

test("three surveyed column centres collide in both styles and the plaque faces the street",async()=>{
  let bytes=0;
  for(const native of [false,true])for(const id of ["6_-4","6_-5"]){
    const [cx,cz]=id.split("_").map(Number);
    const origin:[number,number,number]=[cx*512,2.5,cz*512];
    const root=new Group();
    root.position.fromArray(origin);
    const entry:SurroundingChunkGeometry={origin,root,geometryBytes:0,bufferCount:0,nav:{buildings:[],water:[],ground:[],groundY:2.5}};
    const aborted=AbortSignal.abort();
    await expect(attachKollwitzStreetFurnitureV381(entry,id,native,aborted)).rejects.toThrow();
    expect(root.children.length).toBe(0);
    await Promise.all([1,2].map(()=>attachKollwitzStreetFurnitureV381(entry,id,native,new AbortController().signal)));
    expect(root.children.length).toBe(1);
    const rows=survey.columns.filter(c=>Math.floor(c.xy[1]/512)===cz);
    expect(entry.nav.buildings.map(b=>b.sourceId)).toEqual(rows.map(c=>c.surveyId));
    for(const c of rows){
      const [x,z]=c.xy;
      expect(Math.hypot(x-c.osmXZ[0],z-c.osmXZ[1])).toBeLessThan(.65);
      expect(surroundingBuildingSolidAt(entry.nav,x-origin[0],4.5,z-origin[2])).toBe(true);
      expect(surroundingBuildingSolidAt(entry.nav,x-origin[0]+2,4.5,z-origin[2])).toBe(false);
      expect(surroundingBuildingSolidAt(entry.nav,x-origin[0],3.24+c.h+.05,z-origin[2])).toBe(false);
    }
    root.updateWorldMatrix(true,true);
    const plaque=root.getObjectByName("Kollwitzstraße 56a · Gedenktafel für Käthe und Karl Kollwitz") as Mesh | undefined;
    expect(!!plaque).toBe(id==="6_-4");
    if(plaque){
      const [x,z,nx,nz]=survey.plaque[native?"native":"drawn"];
      const normal=plaque.getWorldDirection(new Vector3());
      expect(normal.dot(new Vector3(nx,0,nz))).toBeGreaterThan(.999);
      const pos=plaque.getWorldPosition(new Vector3());
      expect((pos.x-x)*nx+(pos.z-z)*nz).toBeCloseTo(.13,3);
      const mat=plaque.material as MeshBasicMaterial;
      expect([mat.map!.image.width,mat.map!.image.height]).toEqual([208,150]);
      let disposed=false;
      mat.map!.addEventListener("dispose",()=>{disposed=true});
      mat.dispose();
      expect(disposed).toBe(true);
      expect(entry.geometryBytes).toBeGreaterThan(208*150*4);
    }
    bytes+=statSync(new URL("../src/data/kollwitzStreetFurnitureV381/"+(native?"native_":"drawn_")+id+".json",import.meta.url)).size;
  }
  expect(bytes).toBeLessThan(34000);
});
