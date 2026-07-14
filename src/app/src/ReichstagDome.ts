import {
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

export type ArchitecturalSignature = {
  anchor_world: [number, number, number];
  diameter_m: number;
  geometry_status: string;
  height_m: number;
  horizontal_rings: number;
  id: string;
  landmark_name: string;
  source_url: string;
  vertical_ribs: number;
};

const TOP_OPENING_RADIUS_M = 2.4;
const LOWER_UNGLAZED_ROWS = 4;

export function domeRadius(
  normalizedHeight: number,
  diameterM: number,
): number {
  const t = Math.max(0, Math.min(1, normalizedHeight));
  const baseRadius = diameterM / 2;
  return (
    TOP_OPENING_RADIUS_M +
    (baseRadius - TOP_OPENING_RADIUS_M) *
      Math.sqrt(Math.max(0, 1 - Math.pow(t, 1.45)))
  );
}

function domeCurvePoints(
  signature: ArchitecturalSignature,
  angle: number,
  samples = 32,
): Vector3[] {
  return Array.from({ length: samples + 1 }, (_, index) => {
    const t = index / samples;
    const radius = domeRadius(t, signature.diameter_m) + 0.12;
    return new Vector3(
      Math.cos(angle) * radius,
      t * signature.height_m,
      Math.sin(angle) * radius,
    );
  });
}

function addRamps(group: Group, signature: ArchitecturalSignature): void {
  const material = new MeshStandardMaterial({
    color: 0xd8e0e3,
    metalness: 0.72,
    roughness: 0.24,
  });
  for (const direction of [-1, 1]) {
    const points = Array.from({ length: 97 }, (_, index) => {
      const t = index / 96;
      const verticalT = 0.08 + t * 0.7;
      const radius = domeRadius(verticalT, signature.diameter_m) - 1.7;
      const angle = direction * t * Math.PI * 4.4 + (direction < 0 ? Math.PI : 0);
      return new Vector3(
        Math.cos(angle) * radius,
        verticalT * signature.height_m,
        Math.sin(angle) * radius,
      );
    });
    const ramp = new Mesh(
      new TubeGeometry(new CatmullRomCurve3(points), 144, 0.22, 6, false),
      material,
    );
    ramp.name = direction < 0 ? "descending ramp" : "ascending ramp";
    ramp.castShadow = true;
    group.add(ramp);
  }
}

export function createOfficialReichstagDome(
  signature: ArchitecturalSignature,
): Group {
  const group = new Group();
  group.name = "Official-dimension Reichstag dome";
  group.position.fromArray(signature.anchor_world);
  group.userData = {
    diameterM: signature.diameter_m,
    geometryStatus: signature.geometry_status,
    heightM: signature.height_m,
    sourceUrl: signature.source_url,
  };

  const glassStart = LOWER_UNGLAZED_ROWS / signature.horizontal_rings;
  const profile = Array.from({ length: 37 }, (_, index) => {
    const t = glassStart + (index / 36) * (1 - glassStart);
    return new Vector2(
      domeRadius(t, signature.diameter_m),
      t * signature.height_m,
    );
  });
  const glass = new Mesh(
    new LatheGeometry(profile, 128),
    new MeshPhysicalMaterial({
      color: 0xb9dce8,
      metalness: 0.04,
      opacity: 0.2,
      roughness: 0.08,
      side: DoubleSide,
      thickness: 0.32,
      transmission: 0.64,
      transparent: true,
      depthWrite: false,
    }),
  );
  glass.material.userData.nightEmissive = 0xb8dcff;
  glass.material.userData.nightEmissiveIntensity = 0.72;
  glass.name = "3,000 square metre glass envelope";
  glass.renderOrder = 5;
  group.add(glass);

  const steel = new MeshStandardMaterial({
    color: 0x90a5ad,
    depthTest: false,
    emissive: 0x1c3038,
    emissiveIntensity: 0.1,
    metalness: 0.82,
    roughness: 0.19,
  });
  steel.userData.nightEmissive = 0x9ecaf0;
  steel.userData.nightEmissiveIntensity = 0.44;
  for (let index = 0; index < signature.vertical_ribs; index += 1) {
    const angle = (index / signature.vertical_ribs) * Math.PI * 2;
    const rib = new Mesh(
      new TubeGeometry(
        new CatmullRomCurve3(domeCurvePoints(signature, angle)),
        64,
        0.1,
        6,
        false,
      ),
      steel,
    );
    rib.name = `main steel rib ${index + 1}`;
    rib.castShadow = true;
    rib.renderOrder = 7;
    group.add(rib);
  }

  for (let index = 1; index <= signature.horizontal_rings; index += 1) {
    const t = index / (signature.horizontal_rings + 1);
    const ring = new Mesh(
      new TorusGeometry(
        domeRadius(t, signature.diameter_m) + 0.12,
        0.08,
        6,
        96,
      ),
      steel,
    );
    ring.name = `horizontal steel ring ${index}`;
    ring.rotation.x = Math.PI / 2;
    ring.position.y = t * signature.height_m;
    ring.castShadow = true;
    ring.renderOrder = 7;
    group.add(ring);
  }

  const baseRing = new Mesh(
    new TorusGeometry(signature.diameter_m / 2 + 0.12, 0.16, 8, 128),
    steel,
  );
  baseRing.name = "dome base ring";
  baseRing.rotation.x = Math.PI / 2;
  baseRing.renderOrder = 7;
  group.add(baseRing);

  const mirrorCone = new Mesh(
    new CylinderGeometry(7.8, 2.4, 18, 48, 1, true),
    new MeshPhysicalMaterial({
      color: 0xdde7ea,
      metalness: 0.92,
      roughness: 0.08,
      side: DoubleSide,
    }),
  );
  mirrorCone.material.userData.nightEmissive = 0xffd58d;
  mirrorCone.material.userData.nightEmissiveIntensity = 0.85;
  mirrorCone.name = "daylight mirror cone";
  mirrorCone.position.y = 9;
  mirrorCone.castShadow = true;
  group.add(mirrorCone);

  addRamps(group, signature);
  return group;
}
