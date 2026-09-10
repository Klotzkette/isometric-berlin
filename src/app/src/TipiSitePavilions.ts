import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, ShapeUtils, Vector2, Vector3 } from "three";
import { TIPI_SITE_PARTS, TIPI_SITE_GEOMETRY_STATUS, tipiSiteEnvelope } from "./tipiSiteProfile";

/** Compact surface-only pagodas: the unchanged OSM perimeter owns every eave. */
export function createTipiSitePavilions(): Group {
  const group = new Group();
  group.name = "TIPI source-bound ancillary tents and service wings";
  const buffers = Array.from({ length: 4 }, () => [] as number[]);
  const triangle = (batch: number, a: Vector3, b: Vector3, c: Vector3) => {
    for (const p of [a, b, c]) buffers[batch].push(p.x, p.y, p.z);
  };
  const quad = (batch: number, a: Vector3, b: Vector3, c: Vector3, d: Vector3) => {
    triangle(batch, a, b, c); triangle(batch, a, c, d);
  };
  for (const part of TIPI_SITE_PARTS) {
    if (part.role === "auditorium") continue;
    const ring = part.ringDm.map(([x, z]) => new Vector3(x / 10, part.groundY, z / 10));
    const center = ring.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(ring.length);
    const { eaves, peak } = tipiSiteEnvelope(part);
    if (part.role === "service") {
      for (const face of ShapeUtils.triangulateShape(ring.map((p) => new Vector2(p.x, p.z)), [])) {
        triangle(3, ...face.map((i) => ring[i].clone().setY(part.groundY + peak)) as [Vector3, Vector3, Vector3]);
      }
    }
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const topA = a.clone().add(new Vector3(0, eaves, 0));
      const topB = b.clone().add(new Vector3(0, eaves, 0));
      quad(part.role === "turret" || part.role === "foyer" ? 1 : 0, a, b, topB, topA);
      if (part.role === "service") continue;
      const tiers = [0, 0.4, 0.75, 1];
      const at = (p: Vector3, t: number) => p.clone().lerp(center, t).setY(part.groundY + eaves + (peak - eaves) * Math.pow(t, 1.8));
      for (let j = 1; j < tiers.length; j++) {
        if (tiers[j] === 1) triangle(i % 2 === 0 ? 2 : 3, at(a, tiers[j - 1]), at(b, tiers[j - 1]), at(a, 1));
        else quad(i % 2 === 0 ? 2 : 3, at(a, tiers[j - 1]), at(b, tiers[j - 1]), at(b, tiers[j]), at(a, tiers[j]));
      }
    }
  }
  const names = ["TIPI low canvas and service walls", "TIPI timber foyer and turret walls", "TIPI mapped warm pointed canvas roofs", "TIPI mapped cool pointed canvas roofs"];
  const colors = [0xdcd9cd, 0x593d2c, 0xeeeae0, 0xcfcfc9];
  buffers.forEach((positions, index) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const material = new MeshStandardMaterial({ color: colors[index], flatShading: true, roughness: 0.9, side: 2 });
    const mesh = new Mesh(geometry, material);
    mesh.name = names[index]; mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  });
  group.userData = {
    sourcePrismIds: TIPI_SITE_PARTS.filter((p) => p.role !== "auditorium").map((p) => p.prismId),
    geometryStatus: TIPI_SITE_GEOMETRY_STATUS,
    sourceRecordsRetained: true,
    noTexture: true,
  };
  return group;
}
