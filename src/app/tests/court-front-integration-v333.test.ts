import { expect, test } from "bun:test";
import { courtPaneMasksV333, createCourtsParkV293 } from "../src/CourtsParkV293";
import { createDistrictCourtsV229 } from "../src/DistrictCourtsV229";
import { startupFlightView, startupViewSelection } from "../src/startupView";

for (const native of [false, true]) {
  test(`both court fronts and the retained park details attach together (native=${native})`, () => {
    const masks = courtPaneMasksV333();
    const recognition = createDistrictCourtsV229(native, masks);
    const admitted = recognition.children.filter(child => child.userData.courtFacadeV333)
      .map(child => child.userData.siteKey).sort();
    expect(admitted).toEqual(["charlottenburg", "wedding"]);
    const park = createCourtsParkV293(native, masks);
    const before = createCourtsParkV293(native).userData.roles as Record<string, number>;
    const after = park.userData.roles as Record<string, number>;
    expect(after["wedding:four-leaf-window"]).toBe(before["wedding:four-leaf-window"] - 24);
    expect(after["charlottenburg:four-leaf-window"]).toBe(before["charlottenburg:four-leaf-window"] - 80);
    const outsideCourt = ([key]: [string, number]) => !key.startsWith("wedding:") && !key.startsWith("charlottenburg:");
    expect(Object.entries(after).filter(outsideCourt)).toEqual(Object.entries(before).filter(outsideCourt));
  });
}

test("each explicit place link opens its own plaza-facing flight view", () => {
  for (const [slug, name, outward] of [
    ["amtsgericht-wedding", "Amtsgericht Wedding", [-.714, .700]],
    ["amtsgericht-charlottenburg", "Amtsgericht Charlottenburg", [.491, -.871]],
  ] as const) {
    expect(startupViewSelection([], `#${slug}`)).toEqual({ name, automatic: false });
    const { pose, fov } = startupFlightView(name);
    expect(fov).toBe(16);
    const [x, , z] = pose.position.map((value, i) => value - pose.target[i]);
    expect((x * outward[0] + z * outward[1]) / Math.hypot(x, z)).toBeGreaterThan(.99);
  }
});
