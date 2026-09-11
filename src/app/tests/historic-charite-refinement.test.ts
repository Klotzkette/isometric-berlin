import { describe, expect, test } from "bun:test";
import { Box3, Color, FrontSide, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import { createHistoricChariteCampus, historicChariteFacadeTop, historicChariteRoofCode, historicChariteWindows, chariteFacadePointExposed, CHARITE_ALTHOFF_TOWER_ID, CHARITE_FRIEDRICH_ALTHOFF_IDS, CHARITE_MEDICAL_MUSEUM_IDS, HISTORIC_CHARITE_IDS, HISTORIC_CHARITE_TONES, type ChariteSourcePrism } from "../src/HistoricChariteCampus";
import { createHistoricChariteColumnTester, createMinecraftHistoricCharite } from "../src/MinecraftHistoricCharite";
import { createIsometricCity, fitRectangle, roofRise, ROOF_MIN_RECTANGULARITY, type PrismPayload } from "../src/IsometricCityWorld";

const prisms=prismJson as unknown as PrismPayload;
const source=prisms.buildings.filter(b=>HISTORIC_CHARITE_IDS.has(b.id));
const heritage=source.filter(b=>CHARITE_MEDICAL_MUSEUM_IDS.has(b.id)||CHARITE_FRIEDRICH_ALTHOFF_IDS.has(b.id));

function stats(root: ReturnType<typeof createHistoricChariteCampus>) {
  let bytes=0, calls=0;
  root.traverse(object=>{
    if(!(object instanceof Mesh)&&!('isLineSegments' in object))return;
    const mesh=object as Mesh;calls++;
    for(const a of Object.values(mesh.geometry.attributes)) bytes+=a.array.byteLength;
    bytes+=mesh.geometry.index?.array.byteLength??0;
    if(mesh instanceof InstancedMesh) bytes+=mesh.instanceMatrix.array.byteLength+(mesh.instanceColor?.array.byteLength??0);
  });
  return {bytes,calls};
}

describe("Charite v1.0.4 exterior and block reconstruction",()=>{
  test("keeps the source payload immutable and every roof cornice below its drawn roof",()=>{
    const before=JSON.stringify(source);
    createHistoricChariteCampus(prisms,"mobile");createMinecraftHistoricCharite(source,"mobile");
    expect(JSON.stringify(source)).toBe(before);
    for(const part of heritage) {
      if(part.id===CHARITE_ALTHOFF_TOWER_ID){expect(historicChariteFacadeTop(part)).toBe(20.1);continue;}
      const rect=fitRectangle(part.ring.map(([x,z])=>[x/10,z/10]));
      const code=historicChariteRoofCode(part.id,part.roof??0);
      const rise=rect&&rect.rectangularity>=ROOF_MIN_RECTANGULARITY&&[2100,3100,3200,3500].includes(code)?roofRise(rect,part.h_dm/10):0;
      expect(historicChariteFacadeTop(part)).toBeCloseTo((part.y0_dm+part.h_dm)/10-rise,5);
    }
  });

  test("binds seven Althoff street axes, three floors, the blind opening and four dormers",()=>{
    const althoff=source.find(p=>p.id===CHARITE_ALTHOFF_TOWER_ID)!;
    const windows=historicChariteWindows(althoff,source).filter(w=>w.streetAlthoff);
    expect(windows.length).toBe(21);
    expect(windows.filter(w=>w.paired).length).toBe(7);
    expect(windows.filter(w=>w.blind).map(w=>[w.floor,w.bay])).toEqual([[0,0]]);
    const model=createHistoricChariteCampus(prisms,"mobile");
    expect(model.userData.detailCounts.althoffDormers).toBe(4);
    const block=createMinecraftHistoricCharite(source,"mobile");
    expect(block.userData.detailCounts.althoffDormers).toBe(4);
    // Previously class=glass made the source-backed red-brick house blue.
    const house=createIsometricCity(prisms,null,null,null,{includeContext:false,buildings:source.filter(b=>CHARITE_FRIEDRICH_ALTHOFF_IDS.has(b.id))});
    expect(house.getObjectByName("LoD2 glass prisms")).toBeUndefined();
  });

  test("puts new museum vitrine windows on the actual OSM-containing LoD2 part",()=>{
    const museum=source.find(p=>p.id==="gwXjAt32")!;
    const windows=historicChariteWindows(museum,source).filter(w=>w.museumStreet);
    expect(new Set(windows.map(w=>w.wall.index))).toEqual(new Set([14,16]));
    const longWall=windows.find(w=>w.wall.index===14)!.wall;
    const shortWall=windows.find(w=>w.wall.index===16)!.wall;
    expect([longWall.x1,longWall.z1]).toEqual([223.9,-814.4]);
    expect(longWall.length).toBeCloseTo(20.9153,3);
    expect([shortWall.x1,shortWall.z1]).toEqual([236.7,-797.8]);
    expect(shortWall.length).toBeCloseTo(13.7295,3);
    expect(windows.filter(w=>w.floor===0).length).toBe(6);
    expect(windows.filter(w=>w.paired).length).toBe(13);
    expect(windows.every(w=>w.height>=2.85)).toBe(true);
  });

  test("suppresses openings hidden by neighboring source parts",()=>{
    for(const part of heritage)for(const w of historicChariteWindows(part,heritage)) {
      expect(chariteFacadePointExposed(part.id,w.wall,w.along,w.bottom+w.height/2,heritage)).toBe(true);
    }
    const first=heritage.find(p=>p.id==="nbLoon0z")!;
    const w=historicChariteWindows(first,[first])[0];
    const x=w.wall.x1+w.wall.dirX*w.along+w.wall.nx*0.25;
    const z=w.wall.z1+w.wall.dirZ*w.along+w.wall.nz*0.25;
    const obstacle:ChariteSourcePrism={id:"test-neighbor",y0_dm:0,h_dm:500,ring:[[x-2,z-2],[x+2,z-2],[x+2,z+2],[x-2,z+2]].map(([x,z])=>[x*10,z*10])};
    expect(chariteFacadePointExposed(first.id,w.wall,w.along,w.bottom+1,[first,obstacle])).toBe(false);
  });

  test("both source ring directions expose front-sided glass to an outside camera",()=>{
    for(const reversed of [false,true]) {
      const ring=[[0,0],[120,0],[120,100],[0,100]];
      const part={...heritage.find(p=>p.id==="nbLoon0z")!,ring:reversed?ring.reverse():ring,y0_dm:40,h_dm:220};
      const payload={...prisms,buildings:[part]};
      const model=createHistoricChariteCampus(payload,"mobile");model.updateMatrixWorld(true);
      const windows=historicChariteWindows(part,[part]);
      for(const w of windows.filter(w=>w.floor===0)) {
        const u=w.along+w.width*0.23,y=w.bottom+w.height*0.30;
        const origin=new Vector3(w.wall.x1+w.wall.dirX*u+w.wall.nx*2,y,w.wall.z1+w.wall.dirZ*u+w.wall.nz*2);
        const ray=new Raycaster(origin,new Vector3(-w.wall.nx,0,-w.wall.nz),0,4);
        const hit=ray.intersectObjects(model.children,true).find(h=>h.object instanceof Mesh)!;
        expect(hit).toBeDefined();expect(hit.distance).toBeCloseTo(2-0.215,3);
        const material=(hit.object as Mesh).material;expect(Array.isArray(material)?material[0].side:material.side).toBe(FrontSide);
        const mesh=hit.object as Mesh, colors=mesh.geometry.getAttribute("color"), i=hit.face!.a;
        const actual=new Color().fromBufferAttribute(colors,i);
        const valid=[HISTORIC_CHARITE_TONES.glassDark,HISTORIC_CHARITE_TONES.nightGlass].map(c=>new Color(c));
        expect(valid.some(c=>Math.abs(c.r-actual.r)+Math.abs(c.g-actual.g)+Math.abs(c.b-actual.b)<0.025)).toBe(true);
      }
    }
  });

  test("former missing upper roof facets are front-sided and visible from above",()=>{
    for(const id of ["t76KCSEh","KztaII44","8iaMbUbh"]) {
      const part=source.find(b=>b.id===id)!;
      const city=createIsometricCity(prisms,null,null,null,{includeContext:false,buildings:[part]});city.updateMatrixWorld(true);
      const rect=fitRectangle(part.ring.map(([x,z])=>[x/10,z/10]))!;
      for(const sign of [-1,1]) {
        const [ax,az]=rect.axis,[cx,cz]=rect.center,v=sign*rect.halfWidth*0.45;
        const hit=new Raycaster(new Vector3(cx-az*v,60,cz+ax*v),new Vector3(0,-1,0),0,65).intersectObject(city,true).find(h=>h.object instanceof Mesh)!;
        expect(hit).toBeDefined();
        const expected=historicChariteFacadeTop(part)+roofRise(rect,part.h_dm/10)*(1-Math.abs(v)/(rect.halfWidth+0.35));
        expect(hit.point.y).toBeCloseTo(expected,1);
      }
    }
  });

  test("block glazing remains in front of the native source walls",()=>{
    for(const id of ["nbLoon0z","gwXjAt32",CHARITE_ALTHOFF_TOWER_ID]) {
      const part=heritage.find(p=>p.id===id)!;
      const block=createMinecraftHistoricCharite([part],"mobile");block.updateMatrixWorld(true);
      const windows=historicChariteWindows(part,[part]).filter(w=>w.floor===0&&!w.blind).slice(0,8);
      for(const w of windows) {
        const u=w.along+w.width*0.23,y=w.bottom+w.height*0.30;
        const origin=new Vector3(w.wall.x1+w.wall.dirX*u+w.wall.nx*2,y,w.wall.z1+w.wall.dirZ*u+w.wall.nz*2);
        const hit=new Raycaster(origin,new Vector3(-w.wall.nx,0,-w.wall.nz),0,4).intersectObject(block,true)[0];
        expect(hit).toBeDefined();expect(hit.distance).toBeCloseTo(2-0.255,3);
        const color=new Color();(hit.object as InstancedMesh).getColorAt(hit.instanceId!,color);
        const glass=new Color(HISTORIC_CHARITE_TONES.glassDark);
        expect(Math.abs(color.r-glass.r)+Math.abs(color.g-glass.g)+Math.abs(color.b-glass.b)).toBeLessThan(0.005);
      }
    }
  });

  test("exact footprint filtering protects postwar parts, courtyards and missing-source fallback",()=>{
    const test=createHistoricChariteColumnTester(source);
    expect(test(225,-794)).toBe(true);
    expect(test(452,-906)).toBe(false);
    expect(test(400,-700)).toBe(false);
    expect(createHistoricChariteColumnTester([])(225,-794)).toBe(false);
    const part={...heritage[0],ring:[[0,0],[100,0],[100,100],[0,100]],holes:[[[20,20],[80,20],[80,80],[20,80]]]};
    const holeTest=createHistoricChariteColumnTester([part]);expect(holeTest(1,1)).toBe(true);expect(holeTest(5,5)).toBe(false);
  });

  for(const profile of ["full","mobile"] as const)test(`${profile} stays surface-only, texture-free and inside an explicit geometry budget`,()=>{
    const drawn=createHistoricChariteCampus(prisms,profile);
    const block=createMinecraftHistoricCharite(source,profile,true);
    expect(stats(drawn).calls).toBe(5);expect(stats(block).calls).toBe(1);
    expect(stats(drawn).bytes).toBeLessThan(2_600_000);
    expect(stats(block).bytes).toBeLessThan(profile==="full"?580_000:370_000);
    expect(block.userData.sourcePrisms).toBe(26);
    expect(block.userData.detailCounts.windows).toBe(673);
    const records=block.userData.blockRecords as Array<{role:string,sourceId:string,position:number[],size:number[]}>;
    for(const record of records) {
      expect(record.position.every(Number.isFinite)&&record.size.every(n=>Number.isFinite(n)&&n>0)).toBe(true);
      const part=heritage.find(p=>p.id===record.sourceId)!;
      const top=record.position[1]+record.size[1]/2;
      expect(top).toBeLessThanOrEqual((part.y0_dm+part.h_dm)/10+(part.id===CHARITE_ALTHOFF_TOWER_ID?0.046:0.001));
      if(record.role==="source-wall")expect(record.size[2]).toBe(0.36);
      if(record.role==="source-roof")expect(record.position[1]-record.size[1]/2).toBeGreaterThanOrEqual(historicChariteFacadeTop(part)-0.19);
    }
    expect(new Box3().setFromObject(block).max.y).toBeLessThanOrEqual(30.501);
    expect(createMinecraftHistoricCharite(source,profile).userData.blockRecords).toBeUndefined();
    expect(drawn.userData.facadeWindowRecords).toBeUndefined();
  });
});
