import { expect, test } from "bun:test";
import { Group, Mesh, Raycaster, Vector3 } from "three";
import { buildAltMitteCoreV169Steps, createAltMitteCoreV169 } from "../src/AltMitteDrawnCoreV169";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import { DZ_FRONT_V374, DZ_ROOF_V374, finishPariserNeighboursV374, SOMMER_V374 } from "../src/PariserPlatzNeighboursV374";

function frontage(world: Group, ax: number, az: number, bx: number, bz: number, u: number, y: number) {
  const len = Math.hypot(bx-ax, bz-az);
  const direction = new Vector3((az-bz)/len, 0, (bx-ax)/len);
  const origin = new Vector3(ax + u*(bx-ax)/len, y, az + u*(bz-az)/len).addScaledVector(direction,-3);
  return new Raycaster(origin,direction,0,7).intersectObject(world)[0];
}

for (const mode of ["standalone", "browser"] as const) {
  test(`${mode} opens the actual recessed windows, with no former wall in front of them`, () => {
    const steps = buildAltMitteCoreV169Steps({gateWingsV374:true, architectureV241:true});
    function build() {
      let step = steps.next();
      while (!step.done) step = steps.next();
      return step.value;
    }
    const world = mode === "standalone" ? createAltMitteCoreV169() : build();
    world.updateMatrixWorld(true);
    for (const name of [SOMMER_V374, DZ_FRONT_V374, DZ_ROOF_V374]) expect(world.getObjectByName(name)).toBeInstanceOf(Mesh);
    // Centre of the second bay on Gehry's northern frontage. The old box
    // intercepted both rays at 3 m. The carved glass now lies behind its piers.
    const bankWidth = Math.hypot(523.49-481.87,353.17-356.8), pitch = (bankWidth-1.08)/7;
    for (let bay=0; bay<7; bay++) {
      const hit = frontage(world,481.87,356.8,523.49,353.17,.54+(bay+.5)*pitch,15.4);
      expect(hit.object.name).toBe(DZ_FRONT_V374);
      expect(hit.distance).toBeCloseTo(3.82,3);
    }
    const pier = frontage(world,481.87,356.8,523.49,353.17,.54+pitch,15.4);
    expect(pier.object.name).toBe(DZ_FRONT_V374);
    expect(pier.distance).toBeCloseTo(3,3);
    // Public east elevation of Haus Sommer. Sample away from the mullion.
    const sommerWidth = Math.hypot(444.82-442.35,360.05-332.29);
    const sommer = frontage(world,442.35,332.29,444.82,360.05,.75*sommerWidth/11.5+.20,12.3);
    expect(sommer.object.name).toBe(SOMMER_V374);
    expect(sommer.distance).toBeCloseTo(3.34,3);
    const down = (x: number,z: number) => new Raycaster(new Vector3(x,60,z),new Vector3(0,-1,0)).intersectObject(world)[0];
    const crown = down(504.9,398.6), flank = down(498,398.6), strip = down(491.5,398.6);
    for (const hit of [crown, flank, strip]) expect(hit.object.name).toBe(DZ_ROOF_V374);
    expect(crown.point.y).toBeGreaterThan(flank.point.y+.7);
    expect(flank.point.y).toBeGreaterThan(strip.point.y+.35);
    expect(strip.point.y).toBeCloseTo(27.11,2);
    const home = world.getObjectByName(SOMMER_V374) as Mesh;
    setIsoNightPresentation(world, true);
    expect(home.material).toBe(home.userData.nightMaterial);
    setIsoNightPresentation(world, false);
    expect(home.material).toBe(home.userData.dayMaterial);
  });
}

test("an incomplete resident source cannot acquire a partial replacement", () => {
  const missing = new Group();
  finishPariserNeighboursV374(missing);
  expect(missing.children).toHaveLength(0);
  expect(missing.userData.pariserNeighboursV374).toBeUndefined();
});
