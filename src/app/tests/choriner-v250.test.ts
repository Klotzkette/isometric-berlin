import { describe, expect, test } from "bun:test";
import data from "../src/data/chorinerV250.json";
import north from "../src/data/northV185.json";
import places from "../src/data/schoolsPlacesV205.json";
import central from "../src/data/centralNamedV230.json";
import { appendChorinerV250, canRefineChorinerV250, refineChorinerV250Central, replacesChorinerV250Face, replacesChorinerV250Place } from "../src/ChorinerV250";

describe("Choriner Hoefe and independent Zehdenicker 7A v250",()=>{
  test("only exact obsolete authored fittings yield, retaining measured coping",()=>{
    expect(canRefineChorinerV250()).toBe(true);
    expect(north.faces.filter(replacesChorinerV250Face)).toHaveLength(2);
    const f=north.faces.find(f=>f.kind==="choriner")!;
    expect(replacesChorinerV250Face({...f,a:[f.a[0]+.01,f.a[1]]})).toBe(false);
    const old=places.places.find(g=>g.name==="Choriner Höfe – street fronts")!;
    expect(replacesChorinerV250Place(old)).toBe(true);
    expect(replacesChorinerV250Place({...old,boxes:[[1],...old.boxes]})).toBe(false);
    const site=central.sites.find(g=>g.key==="choriner-hoefe")!;
    const next=refineChorinerV250Central(site);
    expect(next.boxes).toEqual(site.boxes.slice(21));
    expect(next.nativeRows).toEqual(site.nativeRows.slice(63));
    expect(next.rods).toBe(site.rods);
    expect(next.boxes.length).toBeGreaterThan(0);
    const changed={...site,boxes:site.boxes.map((r,i)=>i===0?r.map((v,j)=>j===0?v+.01:v):r)};
    expect(refineChorinerV250Central(changed)).toBe(changed);
    for(const g of central.sites.filter(g=>g!==site))expect(refineChorinerV250Central(g)).toBe(g);
  });
  test("six exact owners, separate addresses, open source outlines and equal static quality",()=>{
    expect(data.owners).toHaveLength(6);
    expect(data.owners).toContain("DEBE00YY1JO0001g");
    expect(data.owners).not.toContain("DEBE01YYK0000AdV");
    expect(data.owners).not.toContain("DEBE01YYK00002ty");
    for(const native of [false,true]){
      const prefix=[0,1,2,3,4,5,...(native?[]:[0]),123];
      const rows=[prefix];appendChorinerV250(rows,native);
      expect(rows[0]).toBe(prefix);
      expect(rows.length).toBe(native?10528:3904);
      expect(rows.slice(1).every(r=>r.length===(native?7:8)&&r.every(Number.isFinite)&&r.slice(3,6).every(v=>v>0))).toBe(true);
      if(native)expect(rows.slice(1).every(r=>Number.isInteger(r[6]))).toBe(true);
      expect(rows.slice(1).every(r=>r[1]>8&&r[1]<40)).toBe(true);
      const again:number[][]=[];appendChorinerV250(again,native);
      expect(again).toEqual(rows.slice(1));
    }
  });
});
