import type { FocusCamera } from "./ArchitecturalLandmarks";

type Point = readonly [number, number, number];

/** Physical opening poses, in the existing east/up/south viewer frame.
 * Targets follow the committed monument/building anchors. Camera positions
 * are presentation choices over their public approaches, not survey data.
 * An explicit lens prevents the general isometric dolly from moving the
 * camera off Washingtonplatz or Pariser Platz.
 */
export const SIMULATION_START_VIEWS: Record<string, {
  position: Point;
  target: Point;
  fov: number;
}> = {
  "Siegessäule": {
    position: [-1485, 75, 466],
    target: [-1459, 65, 456],
    fov: 31,
  },
  "Reichstagsgebäude": {
    position: [158, 74, 58],
    target: [317.729, 23, 40.477],
    fov: 39,
  },
  "Brandenburger Tor": {
    position: [522, 52, 319],
    target: [417.898, 17, 300.453],
    fov: 39,
  },
  "Bundeskanzleramt": {
    position: [-12, 55, -121],
    target: [-153.882, 20, -144.215],
    fov: 39,
  },
  "Berlin Hauptbahnhof": {
    position: [-60, 62, -530],
    target: [-86.48, 25, -599.79],
    fov: 39,
  },
  // Use the existing Philharmonie catalogue stop; the arrival itself is at
  // Serra's neighbouring, source-bound sculpture, without adding a tour stop.
  "Berliner Philharmonie": {
    position: [-184, 16, 960],
    target: [-201.017, 5.7, 932.914],
    fov: 39,
  },
};

export function simulationStartLabel(name: string): string {
  return name === "Berliner Philharmonie" ? "Richard Serra · Berlin Junction" : name;
}

export function simulationStartCamera(name: string): FocusCamera | null {
  const view = SIMULATION_START_VIEWS[name];
  if (!view) return null;
  const [x, y, z] = view.position.map((value, i) => value - view.target[i]);
  const distance = Math.hypot(x, y, z);
  return {
    target_world: [...view.target],
    target_height_m: 0,
    distance_m: distance,
    azimuth_degrees: Math.atan2(x, z) * 180 / Math.PI,
    polar_degrees: Math.acos(y / distance) * 180 / Math.PI,
    fov_degrees: view.fov,
  };
}
