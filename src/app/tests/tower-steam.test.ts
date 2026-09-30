import { describe, expect, test } from "bun:test";
import { Group, PerspectiveCamera, Vector3 } from "three";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import { FERNSEHTURM_DETAIL_PROFILE as TOWER } from "../src/fernsehturmDetailProfile";
import {
  createSchwellenraumTowerSteam, isSchwellenraumTowerSteamOnScreen,
  setSchwellenraumTowerSteamPresentation, updateSchwellenraumTowerSteam,
  SCHWELLENRAUM_TOWER_STEAM_INITIAL_TIME, TOWER_STEAM_PROFILE,
} from "../src/visual-modes/schwellenraum/towerSteam";

describe("bounded rose vapour above the Fernsehturm sphere", () => {
  test("one fixed, texture-free batch preserves the metric anchor and its buffers while animating", () => {
    const mesh = createSchwellenraumTowerSteam(), g = mesh.geometry, m = mesh.material;
    expect(mesh.position.toArray()).toEqual([TOWER.x, TOWER.groundY + TOWER.sphereCenterHeight, TOWER.z]);
    expect(mesh.visible).toBeFalse();
    expect(g.instanceCount).toBe(108);
    expect(g.getAttribute("particle").count).toBe(g.instanceCount);
    expect(g.getAttribute("position").count).toBe(4);
    const buffers = Object.values(g.attributes).map(a => a.array);
    const snapshots = buffers.map(a => Array.from(a));
    expect(buffers.reduce((n,a) => n+a.byteLength, g.index!.array.byteLength)).toBeLessThan(2048);
    expect(m.transparent).toBeTrue(); expect(m.depthWrite).toBeFalse(); expect(m.depthTest).toBeTrue();
    expect(mesh.matrixAutoUpdate).toBeFalse(); expect(mesh.castShadow).toBeFalse();
    expect(m.uniforms.steamTime.value).toBe(SCHWELLENRAUM_TOWER_STEAM_INITIAL_TIME);
    expect(Object.values(m.uniforms).some(u => u.value?.isTexture)).toBeFalse();
    for (const t of [0, 3, 9, 20, 29, 42, 100000]) updateSchwellenraumTowerSteam(mesh, t);
    expect(m.uniforms.steamTime.value).toBe(100000);
    Object.values(g.attributes).forEach((a,i) => { expect(a.array).toBe(buffers[i]); expect(Array.from(a.array)).toEqual(snapshots[i]); });
    updateSchwellenraumTowerSteam(mesh, Number.NaN);
    expect(m.uniforms.steamTime.value).toBe(100000);
    g.dispose(); m.dispose();
  });

  test("actual world presentation exposes the effect only in Schwellenraum without rebuilding it", () => {
    const root = new Group(), mesh = createSchwellenraumTowerSteam(); root.add(mesh);
    const g=mesh.geometry, m=mesh.material;
    for (const mode of ["day", "schwellenraum", "night", "snowstorm", "minecraft", "schwellenraum", "day"] as const) {
      setIsoNightPresentation(root, mode === "night", true, mode);
      expect(mesh.visible).toBe(mode === "schwellenraum");
      expect(mesh.geometry).toBe(g); expect(mesh.material).toBe(m);
    }
    setSchwellenraumTowerSteamPresentation(mesh,"schwellenraum",true);
    expect(mesh.visible).toBeFalse();
    setSchwellenraumTowerSteamPresentation(mesh,"schwellenraum");
    expect(mesh.visible).toBeTrue();
    g.dispose(); m.dispose();
  });

  test("culls behind-camera and hidden worlds, including the displaced plume above the sphere", () => {
    const root = new Group(), mesh = createSchwellenraumTowerSteam(); root.add(mesh);
    const camera = new PerspectiveCamera(40,1, .1,4000);
    const anchor = mesh.position.clone();
    camera.position.copy(anchor).add(new Vector3(0,28,180));
    camera.lookAt(anchor.clone().add(new Vector3(0,28,0)));
    expect(isSchwellenraumTowerSteamOnScreen(mesh,camera)).toBeFalse();
    mesh.visible=true;
    expect(isSchwellenraumTowerSteamOnScreen(mesh,camera)).toBeTrue();
    camera.lookAt(camera.position.clone().add(new Vector3(0,0,100)));
    expect(isSchwellenraumTowerSteamOnScreen(mesh,camera)).toBeFalse();
    camera.lookAt(anchor.clone().add(new Vector3(0,60,0)));
    expect(isSchwellenraumTowerSteamOnScreen(mesh,camera)).toBeTrue();
    root.visible=false;
    expect(isSchwellenraumTowerSteamOnScreen(mesh,camera)).toBeFalse();
    mesh.geometry.dispose(); mesh.material.dispose();
  });

  test("all generated puff seeds and conservative motion extremes stay within the fixed GPU bounds", () => {
    const mesh=createSchwellenraumTowerSteam(), a=mesh.geometry.getAttribute("particle"), p=TOWER_STEAM_PROFILE;
    let bursts=0;
    for(let i=0;i<a.count;i++) {
      expect(a.getX(i)).toBeGreaterThan(0); expect(a.getX(i)).toBeLessThan(1);
      expect(a.getY(i)).toBeGreaterThanOrEqual(0); expect(a.getY(i)).toBeLessThan(1);
      expect(a.getZ(i)).toBeGreaterThanOrEqual(0); expect(a.getZ(i)).toBeLessThan(p.ventCount);
      bursts+=a.getW(i);
    }
    expect(bursts).toBe(p.burstCount);
    const sphere=mesh.geometry.boundingSphere!;
    for(const burst of [false,true]) for(const age of [0,.25,.5,.75,1]) {
      const size=(burst?1.1:1.8)+age*((burst?7:10)-(burst?1.1:1.8));
      // Any billboard rotation/camera orientation fits inside sqrt(2)*size.
      const envelope=new Vector3(p.ventRadius+9*age,p.ventHeight+age*(burst?p.burstRise:p.steadyRise),p.ventRadius+6*age);
      expect(envelope.distanceTo(sphere.center)+Math.SQRT2*size).toBeLessThan(sphere.radius);
    }
    mesh.geometry.dispose(); mesh.material.dispose();
  });
});
