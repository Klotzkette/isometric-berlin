import { expect, test } from "bun:test";
import { PerspectiveCamera, ShapeUtils, Vector2, Vector3 } from "three";
import boundary from "../src/data/berlinBoundariesV200Scope.json";
import east from "../src/data/eastCityScopeV200.json";
import regional from "../src/data/regionalScopeV200.json";
import { captureCameraPose, REGIERUNGSVIERTEL_FLIGHT_BOUNDS, stabilizeCameraRig } from "../src/cameraNavigation";
import { outlineNavigationEnvelopeBounds } from "../src/outlineNavigationEnvelope";
import { surroundingScopeGroundAt } from "../src/surroundingCityScope";
import { surroundingPolygonContains } from "../src/SurroundingCityGeometry";
import { constrainSurfaceCameraRig, SURFACE_CAMERA_CLEARANCE_M } from "../src/surfaceCameraNavigation";
import { miniMapScale, REFERENCE_MAP_TRANSFORM, worldToReferenceMapPoint } from "../src/pedestrianMiniMapProjection";
import { worldCameraFarM } from "../src/worldCameraDepth";

type Polygon = { ring: number[][]; holes: number[][][] };

// Choose an actual interior point of a source polygon, not its potentially
// out-of-polygon centroid (thin route strips and administrative holes matter).
function interior(polygon: Polygon): [number, number] {
  const ring = polygon.ring.map(([x, z]) => new Vector2(x, z));
  const holes = polygon.holes.map(h => h.map(([x, z]) => new Vector2(x, z)));
  const faces = ShapeUtils.triangulateShape(ring, holes);
  const points = [...ring, ...holes.flat()];
  for (const [a, b, c] of faces) {
    const x = (points[a].x + points[b].x + points[c].x) / 3;
    const z = (points[a].y + points[b].y + points[c].y) / 3;
    const doubleArea = Math.abs((points[b].x-points[a].x)*(points[c].y-points[a].y) -
      (points[c].x-points[a].x)*(points[b].y-points[a].y));
    if (doubleArea > 1 && surroundingPolygonContains(polygon, x, z)) return [x, z];
  }
  throw new Error("No non-degenerate source interior");
}

function samples(footprint: Polygon[]) {
  const area = (ring: number[][]) => Math.abs(ring.reduce((sum,p,i) => {
    const q = ring[(i+1)%ring.length]; return sum+p[0]*q[1]-q[0]*p[1];
  },0))/2;
  const rows = footprint.map(p => {
    const xs = p.ring.map(v => v[0]), zs = p.ring.map(v => v[1]);
    const bounds = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
    return { p, bounds, span: (bounds[2]-bounds[0])*(bounds[3]-bounds[1]),
      area: area(p.ring)-p.holes.reduce((sum,h) => sum+area(h),0) };
  }).filter(r => r.span > 100 && r.area > 4);
  const selected = new Set<Polygon>([rows.toSorted((a,b) => b.span-a.span)[0].p]);
  for (let axis = 0; axis < 4; axis++) {
    selected.add(rows.toSorted((a,b) => axis < 2 ? a.bounds[axis]-b.bounds[axis] : b.bounds[axis]-a.bounds[axis])[0].p);
  }
  return [...selected].map(interior);
}

const sites = [...samples(east.footprint), ...samples(regional.footprint)];

test("every new source scope vertex fits the same navigation and far-clip envelope", () => {
  const envelope = outlineNavigationEnvelopeBounds();
  let outside = 0, vertices = 0, greatestDistance = 0, greatestFloatRounding = 0;
  for (const scope of [east, regional]) {
    expect(scope.groundY).toBe(3);
    for (const p of scope.footprint) for (const ring of [p.ring, ...p.holes]) for (const [x,z] of ring) {
      vertices++;
      greatestFloatRounding = Math.max(greatestFloatRounding, Math.abs(Math.fround(x)-x), Math.abs(Math.fround(z)-z));
      if (x < envelope.minX || x > envelope.maxX || z < envelope.minZ || z > envelope.maxZ) outside++;
      for (const tx of [envelope.minX,envelope.maxX]) for (const tz of [envelope.minZ,envelope.maxZ]) {
        greatestDistance = Math.max(greatestDistance, Math.hypot(x-tx,z-tz,1000) + 6600);
      }
    }
  }
  expect(vertices).toBeGreaterThan(100);
  expect(outside).toBe(0);
  // Keep the established coordinate frame: even these regional extrema fit
  // within the existing centimetre-scale source packet precision.
  expect(greatestFloatRounding).toBeLessThan(0.005);
  expect(REGIERUNGSVIERTEL_FLIGHT_BOUNDS.min.x).toBe(envelope.minX);
  expect(REGIERUNGSVIERTEL_FLIGHT_BOUNDS.max.z).toBe(envelope.maxZ);
  expect(greatestDistance).toBeLessThanOrEqual(worldCameraFarM(6600));
});

test("source-ground is ready before lazy geometry and changing modes keeps the remote pose", () => {
  expect(sites.length).toBeGreaterThanOrEqual(4);
  for (const [x,z] of sites) {
    const camera = new PerspectiveCamera(39, 1, 0.25, worldCameraFarM(2600));
    const target = new Vector3(x, 8, z);
    camera.position.set(x+60, 65, z+80); camera.lookAt(target);
    const original = captureCameraPose(camera,target);
    for (const mode of ["day","night","snowstorm","schwellenraum","flood","minecraft"]) {
      expect(surroundingScopeGroundAt(x,z,mode === "minecraft")).toBe(3);
      const stable = stabilizeCameraRig(camera,target,original,0.35,2600);
      expect(stable.changed).toBe(false); expect(stable.recovered).toBe(false);
      expect(camera.position.equals(original.position)).toBe(true);
      expect(target.equals(original.target)).toBe(true);
    }
    // A low camera is lifted at this same remote place, never reset to Berlin.
    camera.position.set(x,-10,z); target.set(x,-30,z);
    constrainSurfaceCameraRig(camera,target,(a,b) => surroundingScopeGroundAt(a,b));
    expect(camera.position.x).toBe(x); expect(camera.position.z).toBe(z);
    expect(camera.position.y).toBeCloseTo(3+SURFACE_CAMERA_CLEARANCE_M,10);
  }
});

test("regional camera reach does not turn the A10 interior into city ground", () => {
  // Unrequested land between northern Berlin and the A10: this point may be
  // inside the navigation rectangle, but is outside every named data scope.
  const [x,z] = [0,-17000];
  const bounds = outlineNavigationEnvelopeBounds();
  expect(z).toBeGreaterThan(bounds.minZ);
  expect(z).toBeLessThan(bounds.maxZ);
  for (const scope of [east,regional]) {
    expect(scope.footprint.some(p => surroundingPolygonContains(p,x,z))).toBe(false);
  }
  expect(surroundingScopeGroundAt(x,z)).toBeNull();
  expect(surroundingScopeGroundAt(x,z,true)).toBeNull();
});

test("the existing local minimap projection keeps metre-scale offsets at the remote sites", () => {
  const scale = miniMapScale(REFERENCE_MAP_TRANSFORM);
  for (const [x,z] of sites) {
    const a = worldToReferenceMapPoint(x,z), b = worldToReferenceMapPoint(x+100,z+75);
    expect(b.x-a.x).toBeCloseTo(100*scale,8);
    expect(b.y-a.y).toBeCloseTo(75*scale,8);
  }
});


test("the full official state boundary stays reachable without adding filled ground", () => {
  const b = outlineNavigationEnvelopeBounds(), s = boundary.bounds;
  expect(s[0]).toBeGreaterThanOrEqual(b.minX); expect(s[2]).toBeLessThanOrEqual(b.maxX);
  expect(s[1]).toBeGreaterThanOrEqual(b.minZ); expect(s[3]).toBeLessThanOrEqual(b.maxZ);
});
