import { describe,expect,test } from "bun:test";
import { Group, InstancedMesh, Mesh } from "three";
import { memorialParcelGroundV378, memorialParcelsV378 } from "../src/memorialParcelGroundV378";
import { surroundingScopeGroundAt } from "../src/surroundingCityScope";
import { createMemorialsV378 } from "../src/memorialsV378";
import { memorialViewsV378 } from "../src/memorialsV378Stops";
import plots from "../src/data/memorialsV378Plots.json";
import { northParksV198GroundAt, northParksV198TerrainAt } from "../src/northParksV198Navigation";
import source from "../src/data/memorialsV378Headstones.json";

const dry = {ground:()=>3,water:()=>false,blocked:()=>false,hasHost:()=>false};
describe("mapped burial places",()=>{
  test("CWGC rows follow the original resident family and release their instance buffers",()=>{
    const m=createMemorialsV378();new Group().add(m.root);
    const hashes=new Map(source.tiles.map(t=>[t.id,t.sha[0]]));
    const support={...dry,hasHost:(id:string,sha:string)=>hashes.get(id)===sha};
    expect(m.refresh(-10246,1014,false,support)).toBeTrue();
    const hosts=m.root.children as InstancedMesh[];
    expect(hosts).toHaveLength(4);
    expect(hosts.every(mesh=>mesh.isInstancedMesh)).toBeTrue();
    expect(hosts.reduce((a,b)=>a+b.count,0)).toBe(source.stoneCount);
    const first=source.tiles[0].rows[0],sx=source.origin[0]+Number(first[1])/10,sz=source.origin[1]+Number(first[2])/10;
    expect(m.solidAt(sx,3.6,sz,.01,false)).toBeTrue();
    expect(m.solidAt(sx,4,sz,.01,false)).toBeFalse();
    expect(m.refresh(-10246,1014,true,support)).toBeTrue();
    expect(m.root.children).toHaveLength(0);
    for(const tile of source.tiles)hashes.set(tile.id,tile.sha[1]);
    m.refresh(-10246,1014,true,support);
    expect(m.solidAt(sx,3.6,sz,.01,true)).toBeTrue();
    expect(m.solidAt(sx,3.6,sz,.01,false)).toBeFalse();
    expect(m.refresh(0,0,true,support)).toBeTrue();
    expect(m.root.children).toHaveLength(0);m.dispose();
  });
  for(const [place,x,z,height] of [
    ["Mendelssohn",1397.406,2692.842,2.12],["Columbiadamm",2358.880,4345.378,3],
  ] as const) test(place+" ties the cross, visible face and collision to dry terrain",()=>{
    const m=createMemorialsV378();new Group().add(m.root);
    for(const native of [false,true]){
      expect(m.refresh(x,z,native,{...dry,water:()=>true})).toBeFalse();
      expect(m.refresh(x,z,native,dry)).toBeTrue();
      const mesh=m.root.children[0] as Mesh;
      expect(mesh.position.toArray()).toEqual([x,3,z]);
      expect(mesh.geometry.boundingBox!.max.y).toBeCloseTo(height,4);
      expect(m.solidAt(x,3+height-.05,z,0,native)).toBeTrue();
      expect(m.solidAt(x,3+height+.02,z,0,native)).toBeFalse();
      expect(m.refresh(x,z,native,{...dry,blocked:()=>true})).toBeTrue();
      expect(m.root.children).toHaveLength(0);
    }
    m.dispose();
  });
  test("measured Soviet burial landscape follows the visible original park owners",()=>{
    for(const native of [false,true])for(const kind of ["schoenholz","treptow"] as const){
      const m=createMemorialsV378(),scene=new Group(),owner=new Group();
      scene.add(m.root,owner);
      const [x,z]=plots[kind][0],y=kind==="treptow"?3.01:northParksV198TerrainAt(x,z,native);
      expect(m.refresh(x,z,native,dry,scene)).toBeFalse();
      owner.userData={blockNative:native,[kind==="treptow"?"eastParksV198":"northParksV198"]:true,
        burialTerrainHeightV378:(sx:number,sz:number)=>northParksV198TerrainAt(sx,sz,native)};
      expect(m.refresh(x,z,native,dry,scene)).toBeTrue();
      expect(m.root.children).toHaveLength(1);
      const mesh=m.root.children[0] as Mesh;
      if(native)expect(mesh instanceof InstancedMesh).toBeTrue();
      for(const [cx,cz] of plots[kind]){
        const floor=kind==="treptow"?3.01:northParksV198TerrainAt(cx,cz,native);
        if(kind==="schoenholz")expect(northParksV198GroundAt(cx,cz,native)).not.toBeNull();
        expect(m.solidAt(cx,floor+.12,cz,0,native)).toBeTrue();
      }
      expect(m.solidAt(x,y+3,z,0,native)).toBeFalse();
      owner.visible=false;
      expect(m.refresh(x,z,native,dry,scene)).toBeTrue();
      expect(m.root.children).toHaveLength(0);
      m.dispose();
    }
  });
  test("grave inscriptions require the two actually admitted earlier stones",()=>{
    const m=createMemorialsV378(),original=new Group();
    new Group().add(m.root);
    for(const native of [false,true]){
      const host=new Mesh();
      host.position.set(459.268,5.2-10,-2120.331);
      host.userData={sourceId:"node/274785461",blockNative:native};
      original.add(host);
      expect(m.refresh(463,-2116,native,dry,null,original)).toBeTrue();
      expect(m.root.children[0].name).toContain("Emilie Fontane");
      expect(m.root.children[0].position.y).toBeCloseTo(5.2,8);
      host.removeFromParent();
      expect(m.refresh(463,-2116,native,dry,null,original)).toBeTrue();
      expect(m.root.children).toHaveLength(0);
    }
    m.dispose();
  });
  test("the surviving Heiligensee access and Frohnau memorial have finite welcome areas in both modes",()=>{
    const m=createMemorialsV378();new Group().add(m.root);
    for(const site of memorialParcelsV378){
      const [x,z]=site.center;
      expect(memorialParcelGroundV378(x,z)).toBe(site.groundY);
      expect(memorialParcelGroundV378(site.bounds[0]-2,site.bounds[1]-2)).toBeNull();
      for(const native of [false,true]){
        expect(surroundingScopeGroundAt(x,z,native)).toBe(site.groundY);
        expect(m.refresh(x,z,native,dry)).toBeTrue();
        const mesh=m.root.children[0] as Mesh;
        expect(mesh.position.toArray()).toEqual([x,site.groundY,z]);
        expect(mesh.geometry.boundingBox!.max.y).toBeGreaterThan(1.3);
        expect(m.solidAt(x,site.groundY+1,z,0,native)).toBe(site.id==="frohnau");
      }
    }
    expect(m.refresh(0,0,false,dry)).toBeTrue();
    expect(m.root.children).toHaveLength(0);m.dispose();
  });
  test("a burial field and an airlift memorial have separate entrances in the sight selector",()=>{
    const names=Object.keys(memorialViewsV378);
    expect(names.some(n=>n.includes("US-Flieger")&&n.includes("Grabfeld 2"))).toBeTrue();
    expect(names.some(n=>n.includes("Luftbrückendenkmal"))).toBeTrue();
    expect(names.filter(n=>/Fontane|Hoffmann|Mendelssohn|Päffgen/.test(n))).toHaveLength(4);
  });
});
