import { describe, expect, test } from "bun:test";
import { MathUtils, Spherical, Vector3 } from "three";
import landmarks from "../src/data/regierungsviertel-landmarks.json";
import { directStartupMode } from "../src/modeLinks";
import { SIMULATION_START_VIEWS, simulationStartLabel } from "../src/simulationStartViews";
import { GALLERY_FLIGHT_START_V223, STARTUP_ONLY_SIGHTS, startupFlightCamera, startupFlightView,
  startupViewSelection } from "../src/startupView";
import { SIMULATION_START_SIGHT_NAMES as names, SIMULATION_START_STORAGE_KEY as key,
  nextSimulationStartSight, sightSlug, simulationStartStorage } from "../src/viewNavigation";

function browserStores(blocked: string[] = []) {
  const values = { localStorage: new Map<string, string>(), sessionStorage: new Map<string, string>() };
  const writes: unknown[][] = [];
  const history = { state: { router: "retain this" } as unknown, replaceState(state: unknown, ...rest: unknown[]) {
    this.state = state;
    writes.push([state, ...rest]);
  } };
  const browser = { history } as Parameters<typeof simulationStartStorage>[0];
  for (const field of ["localStorage", "sessionStorage"] as const)
    Object.defineProperty(browser, field, { get() {
      if (blocked.includes(field)) throw new Error("Storage denied");
      return { getItem: (key: string) => values[field].get(key) ?? null,
        setItem: (key: string, value: string) => values[field].set(key, value) };
    } });
  if (blocked.includes("history")) Object.defineProperty(browser, "history", { get() { throw new Error("History denied"); } });
  return { browser, values, history, writes };
}

describe("seven rotating flight starts v232", () => {
  test.each([[], ["localStorage"], ["localStorage", "sessionStorage"]].map(blocked => ({ blocked })))(
    "successive launches never immediately repeat with unavailable stores %j", ({ blocked }) => {
      const { browser, history, writes } = browserStores(blocked);
      const results = Array.from({ length: 15 }, () => nextSimulationStartSight(simulationStartStorage(browser)));
      expect(results.slice(0, 7)).toEqual([...names]);
      for (let i = 1; i < results.length; i++) expect(results[i]).not.toBe(results[i - 1]);
      expect(results[7]).toBe(names[0]);
      expect((history.state as { router: string }).router).toBe("retain this");
      expect(writes.every(args => args.length === 2)).toBeTrue(); // No URL/hash replacement.
    });

  test("session fallback works when history and localStorage are both unavailable", () => {
    const { browser } = browserStores(["history", "localStorage"]);
    expect(nextSimulationStartSight(simulationStartStorage(browser))).toBe(names[0]);
    expect(nextSimulationStartSight(simulationStartStorage(browser))).toBe(names[1]);
  });

  test("local fallback works when history and sessionStorage are unavailable", () => {
    const { browser } = browserStores(["history", "sessionStorage"]);
    expect(nextSimulationStartSight(simulationStartStorage(browser))).toBe(names[0]);
    expect(nextSimulationStartSight(simulationStartStorage(browser))).toBe(names[1]);
  });

  test("fully blocked persistence is harmless and remembers within this launch", () => {
    const storage = simulationStartStorage(browserStores(["history", "sessionStorage", "localStorage"]).browser);
    expect(nextSimulationStartSight(storage)).toBe(names[0]);
    expect(storage.getItem(key)).toBe(names[0]);
  });

  test("obsolete values do not mask a valid fallback, nor overwrite opaque history", () => {
    const { browser, values, history, writes } = browserStores();
    history.state = "opaque router state";
    values.sessionStorage.set(key, "retired place");
    values.localStorage.set(key, "Neue Nationalgalerie");
    expect(nextSimulationStartSight(simulationStartStorage(browser))).toBe(names[0]);
    expect(history.state).toBe("opaque router state");
    expect(writes).toHaveLength(0);
  });

  test("explicit catalogue and new place links never consume the automatic rotation", () => {
    const { browser, writes } = browserStores();
    const storage = simulationStartStorage(browser);
    for (const sight of [...landmarks.landmarks, ...STARTUP_ONLY_SIGHTS]) {
      for (const hash of [`#landmark=${sightSlug(sight.name)}&view=E`, `#${sightSlug(sight.name)}`])
        expect(startupViewSelection(landmarks.landmarks, hash, storage)).toEqual({ name: sight.name, automatic: false });
    }
    expect(writes).toHaveLength(0);
    expect(startupViewSelection(landmarks.landmarks, "#landmark=unknown", storage)).toEqual({ name: names[0], automatic: true });
  });

  test("all theme-only links keep their mode and choose an ordinary flight start", () => {
    for (const mode of ["day", "night", "snowstorm", "schwellenraum", "flood", "minecraft"] as const) {
      const url = new URL(`https://example.test/?theme=${mode}`);
      expect(directStartupMode(url.search)).toBe(mode);
      const selection = startupViewSelection(landmarks.landmarks, url.hash);
      expect(selection).toEqual({ name: names[0], automatic: true });
      expect(startupFlightView(selection.name).pose.position[1]).toBeGreaterThan(30);
    }
  });

  test("new names are selection metadata only; the frozen catalogue and Serra alias remain intact", () => {
    expect(landmarks.landmarks).toHaveLength(93);
    for (const sight of STARTUP_ONLY_SIGHTS) {
      expect(Object.keys(sight).sort()).toEqual(["name", "role"]);
      expect(landmarks.landmarks.some(row => row.name === sight.name)).toBeFalse();
    }
    expect(simulationStartLabel("Berliner Philharmonie")).toBe("Richard Serra · Berlin Junction");
    expect(SIMULATION_START_VIEWS["Kaiser-Wilhelm-Gedächtniskirche"].target).toEqual([-2495.572, 25, 1507.709]);
    expect(SIMULATION_START_VIEWS["Rotes Rathaus"].target).toEqual([2495.891, 25, 99.061]);
  });

  test("every start and linked new place uses the same 16-degree flight pose without reframing", () => {
    for (const name of names) {
      const physical = SIMULATION_START_VIEWS[name], view = startupFlightView(name), camera = startupFlightCamera(name);
      expect(view.landmarkName).toBe(name);
      expect(view.fov).toBe(16);
      expect(view.pose.target).toEqual([...physical.target]);
      expect(view.pose.position[1]).toBeGreaterThan(30);
      const physicalDistance = Math.hypot(...physical.position.map((value, i) => value - physical.target[i]));
      expect(camera.distance_m * Math.tan(16 * Math.PI / 360))
        .toBeCloseTo(physicalDistance * Math.tan(physical.fov * Math.PI / 360), 8);
      const position = new Vector3(...camera.target_world).add(new Vector3().setFromSpherical(new Spherical(
        camera.distance_m, MathUtils.degToRad(camera.polar_degrees), MathUtils.degToRad(camera.azimuth_degrees))));
      for (let i = 0; i < 3; i++) expect(position.getComponent(i)).toBeCloseTo(view.pose.position[i], 8);
    }
    expect(startupFlightView("Neue Nationalgalerie")).toBe(GALLERY_FLIGHT_START_V223);
  });
});
