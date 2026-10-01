import { describe, expect, test } from "bun:test";
import { CircleGeometry, Mesh, MeshBasicMaterial, Points, PointsMaterial, Raycaster, Vector3 } from "three";
import { GROSSER_STERN_GATEHOUSES_V164_PROFILE, gatehouseV164World } from "../src/grosserSternGatehousesV164Profile";

import {
  createSnowstorm,
  setSnowstormPresentation,
  snowFlurryIntensity,
  snowfallAnimationActive,
  snowflakeCount,
  updateSnowstorm,
} from "../src/SnowstormEffects";

describe("snowstorm presentation", () => {
  test("uses one bounded point field and a smaller mobile budget", () => {
    const desktop = createSnowstorm(false);
    const mobile = createSnowstorm(true);
    expect(desktop.flakes).toHaveLength(snowflakeCount(false));
    expect(mobile.flakes).toHaveLength(snowflakeCount(true));
    expect(mobile.flakes.length).toBeLessThan(desktop.flakes.length);
    expect(desktop.air.children).toHaveLength(1);
    const flakes = desktop.air.children[0] as Points;
    expect((flakes.material as PointsMaterial).map).not.toBeNull();
    expect(desktop.flakeMaterial.alphaToCoverage).toBeTrue();
    expect(desktop.flakeMaterial.sizeAttenuation).toBeFalse();
    expect(desktop.flakeMaterial.alphaTest).toBeLessThan(0.01);
    expect(desktop.flakeMaterial.size).toBeGreaterThanOrEqual(5);
    expect(desktop.flakeMaterial.opacity).toBeGreaterThanOrEqual(0.65);
    expect(
      desktop.settled.getObjectByName(
        "Continuous deep snow cover across the expanded city",
      ),
    ).toBeDefined();
  });

  test("snow cover leaves all four gatehouse stairs open and retains the original surrounding plane", () => {
    const original = new CircleGeometry(3_600,96);
    original.rotateX(-Math.PI/2);original.translate(-735,5.72,-355);
    const oldPositions=original.getAttribute("position");
    let desktopPositions:number[]|undefined,desktopIndices:number[]|undefined;
    for(const mobile of [false,true]){
      const snow=createSnowstorm(mobile);
      const blanket=snow.settled.getObjectByName("Continuous deep snow cover across the expanded city") as Mesh;
      blanket.updateMatrixWorld(true);
      const geometry=blanket.geometry,positions=geometry.getAttribute("position"),material=blanket.material as MeshBasicMaterial;
      expect(geometry.userData.gatehouseGroundApertures).toBeTrue();
      expect(geometry.getAttribute("normal")).toBeUndefined();expect(geometry.getAttribute("uv")).toBeUndefined();
      expect(Array.from(positions.array).slice(0,oldPositions.array.length)).toEqual(Array.from(oldPositions.array));
      expect(blanket.position.toArray()).toEqual([0,0,0]);
      expect(material.color.getHex()).toBe(0xf5f7f6);expect(material.opacity).toBe(.92);
      expect(material.depthWrite).toBe(false);expect(material.transparent).toBe(true);
      expect(material.polygonOffset).toBe(true);expect(material.polygonOffsetFactor).toBe(-1);expect(material.polygonOffsetUnits).toBe(-1);
      expect(material.toneMapped).toBe(false);expect(blanket.renderOrder).toBe(3);
      const currentTriangles=new Set<string>();
      for(let i=0;i<geometry.index!.count;i+=3)currentTriangles.add(Array.from(geometry.index!.array.slice(i,i+3)).join(","));
      let retained=0;
      for(let i=0;i<original.index!.count;i+=3){
        const ids=Array.from(original.index!.array.slice(i,i+3));
        const xs=ids.map(id=>oldPositions.getX(id)),zs=ids.map(id=>oldPositions.getZ(id));
        if(Math.max(...xs)<-1590||Math.min(...xs)>-1330||Math.max(...zs)<399||Math.min(...zs)>512){
          expect(currentTriangles.has(ids.join(","))).toBe(true);retained++;
        }
      }
      expect(retained).toBeGreaterThan(70);
      const hit=(x:number,z:number)=>new Raycaster(new Vector3(x,10,z),new Vector3(0,-1,0),0,10).intersectObject(blanket);
      for(const h of GROSSER_STERN_GATEHOUSES_V164_PROFILE){
        const d=h.bodyDepthM/2;
        for(const u of [-2.56,0,2.56])for(const v of [-d+.44,0,d-.36]){
          const p=gatehouseV164World(h,u,0,v);expect(hit(p[0],p[2])).toHaveLength(0);
        }
        // Snow coverage just two centimetres beyond each aperture edge remains.
        for(const [u,v] of [[-2.60,0],[2.60,0],[0,-d+.40],[0,d-.32]]){
          const p=gatehouseV164World(h,u,0,v),hits=hit(p[0],p[2]);
          expect(hits.length).toBeGreaterThan(0);expect(hits[0].point.y).toBeCloseTo(5.72,5);
        }
      }
      for(const [x,z] of [[-735,-355],[1000,0],[-3000,500]])expect(hit(x,z)[0].point.y).toBeCloseTo(5.72,5);
      if(!mobile){desktopPositions=Array.from(positions.array);desktopIndices=Array.from(geometry.index!.array);}
      else {expect(Array.from(positions.array)).toEqual(desktopPositions);expect(Array.from(geometry.index!.array)).toEqual(desktopIndices);}
    }
    original.dispose();
  });

  test("moves through calm snow and a smooth intermittent mini-blizzard", () => {
    expect(snowFlurryIntensity(0)).toBe(0);
    expect(snowFlurryIntensity(1.9)).toBe(0);
    expect(snowFlurryIntensity(6)).toBeGreaterThan(0.85);
    expect(snowFlurryIntensity(13)).toBe(0);
    const sampled = Array.from({ length: 265 }, (_, index) =>
      snowFlurryIntensity(-2 + index * 0.25),
    );
    expect(Math.min(...sampled)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...sampled)).toBeLessThanOrEqual(1);
    expect(snowFlurryIntensity(Number.NaN)).toBe(0);
  });

  test("includes one tiny ice fisher on a mapped Tiergarten pond", () => {
    const snow = createSnowstorm(false);
    const fisher = snow.settled.getObjectByName(
      "Tiergarten pond ice fisher easter egg",
    );
    expect(fisher).toBeDefined();
    expect(fisher!.position.toArray()).toEqual([-931, 6.03, 700]);
    expect(
      fisher!.getObjectByName("sawn fishing hole in frozen Tiergarten pond"),
    ).toBeDefined();
  });

  test("keeps settled snow while the weather toggle controls falling flakes", () => {
    const snow = createSnowstorm(false);
    for (const mode of ["day", "night", "minecraft"] as const) {
      setSnowstormPresentation(snow, {
        enabled: true,
        mode,
        obstructed: false,
      });
      expect(snow.group.visible).toBe(false);
    }
    setSnowstormPresentation(snow, {
      enabled: false,
      mode: "snowstorm",
      obstructed: false,
    });
    expect(snow.group.visible).toBe(true);
    expect(snow.settled.visible).toBe(true);
    expect(snow.air.visible).toBe(false);
    expect(snowfallAnimationActive(snow)).toBe(false);
    const pausedAge = snow.ageSeconds;
    updateSnowstorm(snow, 0.1, new Vector3());
    expect(snow.ageSeconds).toBe(pausedAge);
    setSnowstormPresentation(snow, {
      enabled: true,
      mode: "snowstorm",
      obstructed: false,
    });
    expect(snow.group.visible).toBe(true);
    expect(snow.settled.visible).toBe(true);
    expect(snow.air.visible).toBe(true);
    expect(snowfallAnimationActive(snow)).toBe(true);
    setSnowstormPresentation(snow, {
      enabled: true,
      mode: "snowstorm",
      obstructed: true,
    });
    expect(snow.group.visible).toBe(false);
    expect(snow.settled.visible).toBe(false);
    expect(snow.air.visible).toBe(false);
    expect(snowfallAnimationActive(snow)).toBe(false);
  });

  test("falls around the current focus without changing particle count", () => {
    const snow = createSnowstorm(false);
    setSnowstormPresentation(snow, {
      enabled: true,
      mode: "snowstorm",
      obstructed: false,
    });
    const before = snow.flakePositions.getY(0);
    const calmOpacity = snow.flakeMaterial.opacity;
    updateSnowstorm(snow, 0.08, new Vector3(150, 10, -420));
    expect(snow.air.position.x).toBe(150);
    expect(snow.air.position.z).toBe(-420);
    expect(snow.flakePositions.getY(0)).not.toBe(before);
    expect(snow.flakes).toHaveLength(snowflakeCount(false));
    expect(snow.ageSeconds).toBeCloseTo(0.08, 6);
    expect(new Set(snow.flakes.map(({ drift }) => drift)).size).toBeGreaterThan(
      1_000,
    );
    snow.ageSeconds = 5.9;
    updateSnowstorm(snow, 0.1, new Vector3(150, 10, -420));
    expect(snow.flakeMaterial.opacity).toBeGreaterThan(calmOpacity + 0.25);
  });
});
