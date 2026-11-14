import { DEFAULT_THREE_CAMERA_OFFSET } from "./resetView";
import { findSightBySlug, nextSimulationStartSight, parseViewHash, type NamedSight, type StartStorage } from "./viewNavigation";
import type { NavigationSnapshot } from "./navigationContinuity";
import { SIMULATION_START_VIEWS } from "./simulationStartViews";
import type { FocusCamera } from "./ArchitecturalLandmarks";

// Match the existing ordinary gallery focus: its catalogue anchor, the default
// orbit direction and 190 m focus distance with the usual 39° → 16° dolly.
// This seeds that same flight view before scene construction, without moving
// the requested gallery arrival back to the separate Reichstag reset view.
const target: [number, number, number] = [-305.13579248450696, 8, 1322.372333274223];
const distance = 190 * Math.tan(39 * Math.PI / 360) / Math.tan(16 * Math.PI / 360);
const offsetLength = Math.hypot(...DEFAULT_THREE_CAMERA_OFFSET);

export const GALLERY_FLIGHT_START_V223: Pick<NavigationSnapshot, "pose" | "fov"> & {
  landmarkName: string;
} = {
  landmarkName: "Neue Nationalgalerie",
  pose: {
    position: target.map((value, i) => value + DEFAULT_THREE_CAMERA_OFFSET[i] / offsetLength * distance) as [number, number, number],
    target,
  },
  fov: 16,
};

const GARDEN_VIEWS_V330: Record<string, {
  position: [number, number, number];
  target: [number, number, number];
}> = {
  "Gärten der Welt": { position: [15130, 1070, -690], target: [13908, 28, -1798] },
  "Orientalisch-Islamischer Garten": { position: [13915, 119, -1895], target: [13868, 26, -2037] },
  "Japanischer Garten Marzahn": { position: [14325, 78, -1834], target: [14211, 23, -1881] },
  "Koreanischer Garten Marzahn": { position: [14272, 100, -1875], target: [14180, 23, -1977] },
  "Irrgarten der Gärten der Welt": { position: [13874, 122, -1694], target: [13810, 25, -1790] },
  "Wolkenhain": { position: [14471, 172, -1304], target: [14260, 82, -1470] },
  "Seilbahn Gärten der Welt": { position: [14902, 367, -654], target: [14382, 51, -1239] },
};

const AMENITY_VIEWS_V332: typeof GARDEN_VIEWS_V330 = {
  "Sommerbad Kreuzberg": { position: [2262, 118, 2540], target: [2144, 8, 2460] },
  "Polizeipräsidium Berlin": { position: [795, 89, 3890], target: [960, 18, 4017] },
  "Nebenwache am Alexanderplatz": { position: [2804, 45, -173], target: [2840, 7, -220] },
  "Späti 24/7 Naunynstraße": { position: [3546, 15, 2020], target: [3524.56, 6.02, 2064.14] },
};

const COURT_VIEWS_V333: typeof GARDEN_VIEWS_V330 = {
  "Amtsgericht Wedding": { position: [165, 49, -3352], target: [254.65, 16, -3439.50] },
  "Amtsgericht Charlottenburg": { position: [-5148, 37, 1186], target: [-5212.30, 13, 1299.85] },
};

const TRANSPORT_VIEWS_V334: typeof GARDEN_VIEWS_V330 = {
  "Bülowstraße": { position: [-771, 44, 2356], target: [-661, 13, 2342] },
  "Schönhauser Allee": { position: [2946, 48, -3220], target: [2942, 9, -3329] },
  "Rosa-Luxemburg-Platz": { position: [2631, 52, -1090], target: [2652, 4, -980] },
  "Schlesisches Tor": { position: [4851, 77, 2158], target: [4742, 9, 2098] },
  "Gendarmenmarkt": { position: [1472, 64, 623], target: [1429, 11, 621] },
  "Hausvogteiplatz": { position: [1715, 57, 685], target: [1702, 5, 674] },
  "Katzengrabensteg": { position: [13939, 45, 7994], target: [14016, 11, 8193] },
  "Löwenbrücke": { position: [-1806, 15, 642], target: [-1766.91, 3, 680.64] },
};

const BRITZ_NEUKOELLN_VIEWS_V342: typeof GARDEN_VIEWS_V330 = {
  "Britzer Garten": { position: [5500, 3400, 13300], target: [3100, 18, 9500] },
  "Kalenderplatz im Britzer Garten": { position: [3250, 115, 9405], target: [3143, 16, 9230] },
  "Schloss Britz": { position: [4545, 165, 8260], target: [4335.13, 10, 8106.34] },
  "Hufeisensiedlung Britz": { position: [6092, 1078.2, 9301], target: [5060, 9, 7975] },
  "Stadtbad Neukölln": { position: [4425, 110, 4228], target: [4505, 11, 4518] },
  "Körnerpark": { position: [4602, 98, 5350], target: [4307, 7, 5403] },
};

// Extra place links use the same focus control without adding tour stops.
export const STARTUP_ONLY_SIGHTS = [
  "Kaiser-Wilhelm-Gedächtniskirche",
  "Rotes Rathaus",
  "Gymnasium Steglitz",
  "Heesestraße",
  "Albrechtstraße Steglitz",
  "Alte Post Steglitz",
  "F. W. Bernstein",
  "Bergstraße",
  "Steglitzer Kreisel",
  "Hermann-Ehlers-Platz",
  "Schloßstraße",
  "Titania-Palast",
  ...Object.keys(GARDEN_VIEWS_V330),
  ...Object.keys(AMENITY_VIEWS_V332),
  ...Object.keys(COURT_VIEWS_V333),
  ...Object.keys(TRANSPORT_VIEWS_V334),
  ...Object.keys(BRITZ_NEUKOELLN_VIEWS_V342),
].map(name => ({ name, role: "owner_added" }));

export function startupOnlySight(name: string) {
  return STARTUP_ONLY_SIGHTS.find(sight => sight.name === name) ?? null;
}

export type StartupFlightView = Pick<NavigationSnapshot, "pose" | "fov"> & { landmarkName: string };

/** Retain each opening's target and apparent scale at the ordinary 16-degree
 * flight lens. No pedestrian state is created or enabled. */
export function startupFlightView(name: string): StartupFlightView {
  if (name === GALLERY_FLIGHT_START_V223.landmarkName) return GALLERY_FLIGHT_START_V223;
  const extra = GARDEN_VIEWS_V330[name] ?? AMENITY_VIEWS_V332[name] ?? COURT_VIEWS_V333[name] ?? TRANSPORT_VIEWS_V334[name] ?? BRITZ_NEUKOELLN_VIEWS_V342[name];
  if (extra) return { landmarkName: name, fov: 16, pose: { target: [...extra.target], position: [...extra.position] } };
  const view = SIMULATION_START_VIEWS[name];
  if (!view) return GALLERY_FLIGHT_START_V223;
  const scale = Math.tan(view.fov * Math.PI / 360) / Math.tan(16 * Math.PI / 360);
  const position = view.target.map((value, i) => value + (view.position[i] - value) * scale) as [number, number, number];
  if (name === "Berliner Philharmonie") {
    // The original 39-degree Serra approach is clear, but its longer flight
    // dolly enters the Philharmonie roof. Rotate only this flight approach
    // around the same target, at the same height and radius. The 20-degree
    // azimuth clears both plates against the retained concert-hall geometry.
    const azimuth = 20 * Math.PI / 180;
    const radius = Math.hypot(position[0] - view.target[0], position[2] - view.target[2]);
    position[0] = view.target[0] + Math.sin(azimuth) * radius;
    position[2] = view.target[2] + Math.cos(azimuth) * radius;
  }
  return { landmarkName: name, fov: 16, pose: { target: [...view.target], position } };
}

/** The same flight pose for an explicit startup-only place link. */
export function startupFlightCamera(name: string): FocusCamera {
  const view = startupFlightView(name);
  const [x, y, z] = view.pose.position.map((value, i) => value - view.pose.target[i]);
  const distance = Math.hypot(x, y, z);
  return { target_world: [...view.pose.target], target_height_m: 0, distance_m: distance,
    azimuth_degrees: Math.atan2(x, z) * 180 / Math.PI,
    polar_degrees: Math.acos(y / distance) * 180 / Math.PI, fov_degrees: view.fov };
}

/** Resolve explicit places before advancing the once-per-launch rotation. */
export function startupViewSelection(landmarks: NamedSight[], hash = "", storage: StartStorage | null = null): {
  name: string;
  automatic: boolean;
} {
  const slug = parseViewHash(hash).landmarkSlug;
  const explicit = findSightBySlug(landmarks, slug) ?? findSightBySlug(STARTUP_ONLY_SIGHTS, slug);
  return explicit
    ? { name: explicit.name, automatic: false }
    : { name: nextSimulationStartSight(storage), automatic: true };
}
