import { expect, test } from "bun:test";
import { Mesh, Raycaster, Vector3 } from "three";
import { createChariteAnatomicalTheatre } from "../src/ChariteAnatomicalTheatre";
import { CHARITE_THEATRE_PROFILE as P } from "../src/chariteTheatreProfile";

test("theatre drum and dome face outward and upward for one-sided day/night materials", () => {
  const root = createChariteAnatomicalTheatre();
  const shell = root.getObjectByName("Langhans light drum and patinated dome") as Mesh;
  const positions = shell.geometry.getAttribute("position"), normals = shell.geometry.getAttribute("normal");
  for (let i = 0; i < positions.count; i++) {
    const nx = normals.getX(i), ny = normals.getY(i), nz = normals.getZ(i);
    if (Math.hypot(nx, ny, nz) < .5) continue; // Zero-area pole triangle.
    if (Math.abs(ny) < .001) {
      expect(nx * (positions.getX(i) - P.center[0]) + nz * (positions.getZ(i) - P.center[1])).toBeGreaterThan(0);
    } else expect(ny).toBeGreaterThan(0);
  }
  const ray = new Raycaster(new Vector3(P.center[0] + 20, 15, P.center[1]), new Vector3(-1, 0, 0));
  expect(ray.intersectObject(shell)[0]?.distance).toBeCloseTo(12, 3);
});

test("native dome is a connected roof surface across radial courses and angular intervals", () => {
  const root = createChariteAnatomicalTheatre(true); root.updateMatrixWorld(true);
  for (let radius = .4; radius < 7.9; radius += .63) {
    for (let angle = .071; angle < Math.PI * 2; angle += .41) {
      const x = P.center[0] + Math.cos(angle) * radius, z = P.center[1] + Math.sin(angle) * radius;
      const hits = new Raycaster(new Vector3(x, 30, z), new Vector3(0, -1, 0)).intersectObject(root, true);
      expect(hits[0]?.point.y ?? 0).toBeGreaterThan(P.drumTopY);
    }
  }
});
