import { describe, expect, test } from "bun:test";
import { Mesh } from "three";
import { createSpringerV215 } from "../src/SpringerV215";
import { correctedSpringerPartsV215, correctedSpringerRoofAtV215, SPRINGER_V215_PROFILE } from "../src/springerV215Profile";
import nav from "../src/data/springerV215Navigation.json";
import { pointInWorldRing, type WorldRing } from "../src/chancelleryExtensionProfile";

describe("current Springergebäude source-owner correction",()=>{
  test("one bounded texture-free full-detail batch in each independent mode",()=>{
    for (const native of [false,true]) {
      const a=createSpringerV215(native), b=createSpringerV215(native);
      expect(a.userData.fullStaticDetailOnTouch).toBe(true);
      expect(a.userData.fullMobileIdentical).toBe(true);
      expect(a.userData.blockNative).toBe(native);
      expect(a.children).toHaveLength(1);
      const am=a.children[0] as Mesh,bm=b.children[0] as Mesh;
      expect(am.geometry).not.toBe(bm.geometry);
      expect(am.geometry.getAttribute("position").array).toEqual(bm.geometry.getAttribute("position").array);
      expect(a.userData.geometryBytes).toBe(native?SPRINGER_V215_PROFILE.counts.minecraftGpuBytes:SPRINGER_V215_PROFILE.counts.drawnGpuBytes);
      expect(am.geometry.getAttribute("uv")).toBeUndefined();
      expect(am.matrixAutoUpdate).toBe(false);
    }
  });
  test("roof callback uses actual native tops and removes exact obsolete-only cells",()=>{
    let removed=0,added=0;
    for (const [x,z,oldY,newY] of nav.nativeChangedRoofCells) {
      expect(correctedSpringerRoofAtV215(x!+.5,z!+.5,true,oldY)).toBe(newY);
      if (oldY!==null && newY===null) removed++;
      if (oldY===null && newY!==null) added++;
      expect(correctedSpringerRoofAtV215(x!+.5,z!+.5,true,100)).toBe(100);
    }
    expect(removed).toBeGreaterThan(0);expect(added).toBeGreaterThan(0);
    expect(correctedSpringerRoofAtV215(1000,1000,true,19)).toBe(19);
  });
  test("current collision parts retain unrelated identities and clear predecessor projections",()=>{
    const old={id:nav.owner,sourceId:nav.owner,ring:nav.oldRing,holes:[],groundY:nav.groundY,topY:nav.oldRoofY};
    const neighbour={...old,id:"unrelated"};
    const mapped=correctedSpringerPartsV215([old,neighbour]);
    expect(mapped[1]).toBe(neighbour);expect(mapped[0].ring).toEqual(nav.ring);
    expect(old.ring).toBe(nav.oldRing);
    let removed=0,added=0;
    for(let x=-125;x<-62;x+=.5) for(let z=-1740;z<-1688;z+=.5) {
      const before=pointInWorldRing(x,z,nav.oldRing as WorldRing);
      const after=pointInWorldRing(x,z,nav.ring as WorldRing);
      const roof=correctedSpringerRoofAtV215(x,z,false,before?nav.oldRoofY:null);
      if(before&&!after){expect(roof).toBeNull();removed++;}
      if(after&&!before){expect(roof).toBeGreaterThanOrEqual(nav.roofY-1e-6);added++;}
    }
    expect(removed).toBeGreaterThan(0);expect(added).toBeGreaterThan(0);
  });
});
