import {
  AdditiveBlending,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  Group,
  LatheGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  InstancedMesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
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
const UNGLAZED_LOWER_ROWS = 4;

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
  const deckMaterial = new MeshStandardMaterial({
    color: 0xd8e0e3,
    metalness: 0.72,
    roughness: 0.24,
  });
  const railMaterial = new MeshStandardMaterial({
    color: 0xaebbc0,
    metalness: 0.86,
    roughness: 0.18,
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
    const label = direction < 0 ? "descending" : "ascending";
    const ramp = new Mesh(
      new TubeGeometry(new CatmullRomCurve3(points), 160, 0.42, 8, false),
      deckMaterial,
    );
    ramp.name = `${label} visitor ramp deck`;
    ramp.castShadow = true;
    group.add(ramp);

    for (const railOffset of [-0.72, 0.72]) {
      const railPoints = points.map((point, index) => {
        const radial = new Vector3(point.x, 0, point.z).normalize();
        return point
          .clone()
          .addScaledVector(radial, railOffset)
          .add(new Vector3(0, 0.92, 0));
      });
      const rail = new Mesh(
        new TubeGeometry(
          new CatmullRomCurve3(railPoints),
          160,
          0.045,
          6,
          false,
        ),
        railMaterial,
      );
      rail.name = `${label} ramp ${railOffset < 0 ? "inner" : "outer"} handrail`;
      group.add(rail);
    }

    const balusters: number[] = [];
    for (let index = 0; index < points.length; index += 4) {
      const point = points[index];
      for (const railOffset of [-0.72, 0.72]) {
        const radial = new Vector3(point.x, 0, point.z).normalize();
        const base = point.clone().addScaledVector(radial, railOffset);
        const top = base.clone().add(new Vector3(0, 0.92, 0));
        balusters.push(...base.toArray(), ...top.toArray());
      }
    }
    const balusterGeometry = new BufferGeometry();
    balusterGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(balusters, 3),
    );
    const balusterLines = new LineSegments(
      balusterGeometry,
      new LineBasicMaterial({ color: 0xaebbc0 }),
    );
    balusterLines.name = `${label} ramp batched guardrail balusters`;
    group.add(balusterLines);
  }
}

function addDiagonalBracing(
  group: Group,
  signature: ArchitecturalSignature,
): void {
  const positions: number[] = [];
  for (let row = 0; row < signature.horizontal_rings; row += 1) {
    const t0 = row / signature.horizontal_rings;
    const t1 = (row + 1) / signature.horizontal_rings;
    for (let sector = 0; sector < signature.vertical_ribs; sector += 1) {
      const direction = row % 2 === 0 ? 1 : -1;
      const angle0 = (sector / signature.vertical_ribs) * Math.PI * 2;
      const angle1 =
        ((sector + direction) / signature.vertical_ribs) * Math.PI * 2;
      const radius0 = domeRadius(t0, signature.diameter_m) + 0.135;
      const radius1 = domeRadius(t1, signature.diameter_m) + 0.135;
      positions.push(
        Math.cos(angle0) * radius0,
        t0 * signature.height_m,
        Math.sin(angle0) * radius0,
        Math.cos(angle1) * radius1,
        t1 * signature.height_m,
        Math.sin(angle1) * radius1,
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const braces = new LineSegments(
    geometry,
    new LineBasicMaterial({ color: 0x9eb1b7, opacity: 0.4, transparent: true }),
  );
  braces.name = "dome alternating diagonal glazing braces";
  braces.renderOrder = 7;
  group.add(braces);
}

function addMirrorConeFacets(group: Group): void {
  const positions: number[] = [];
  const sectors = 24;
  for (let index = 0; index < sectors; index += 1) {
    const angle = (index / sectors) * Math.PI * 2;
    positions.push(
      Math.cos(angle) * 2.4,
      0,
      Math.sin(angle) * 2.4,
      Math.cos(angle) * 7.8,
      18,
      Math.sin(angle) * 7.8,
    );
  }
  for (let level = 1; level < 6; level += 1) {
    const t = level / 6;
    const radius = 2.4 + (7.8 - 2.4) * t;
    for (let index = 0; index < sectors; index += 1) {
      const angle0 = (index / sectors) * Math.PI * 2;
      const angle1 = ((index + 1) / sectors) * Math.PI * 2;
      positions.push(
        Math.cos(angle0) * radius,
        t * 18,
        Math.sin(angle0) * radius,
        Math.cos(angle1) * radius,
        t * 18,
        Math.sin(angle1) * radius,
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const facets = new LineSegments(
    geometry,
    new LineBasicMaterial({
      color: 0xf1f5f4,
      opacity: 0.72,
      transparent: true,
    }),
  );
  facets.name = "daylight mirror cone 24-sector facet grid";
  facets.renderOrder = 8;
  group.add(facets);
}

function addMirrorConePanels(group: Group): void {
  const sectors = 24;
  const rows = 15;
  const panelGeometry = new PlaneGeometry(1, 1);
  const panelMaterial = new MeshPhysicalMaterial({
    color: 0xe4ecee,
    metalness: 0.94,
    roughness: 0.06,
    side: DoubleSide,
  });
  panelMaterial.userData.nightEmissive = 0xffd99a;
  panelMaterial.userData.nightEmissiveIntensity = 2.2;
  const panels = new InstancedMesh(
    panelGeometry,
    panelMaterial,
    sectors * rows,
  );
  panels.name = "daylight mirror cone 360 individual panels";
  const dummy = new Object3D();
  let instance = 0;
  for (let row = 0; row < rows; row += 1) {
    const t = (row + 0.5) / rows;
    const radius = 2.4 + (7.8 - 2.4) * t + 0.04;
    const panelWidth = ((Math.PI * 2 * radius) / sectors) * 0.84;
    for (let sector = 0; sector < sectors; sector += 1) {
      const angle = ((sector + 0.5) / sectors) * Math.PI * 2;
      dummy.position.set(
        Math.cos(angle) * radius,
        t * 18,
        Math.sin(angle) * radius,
      );
      dummy.rotation.set(0, Math.PI / 2 - angle, 0);
      dummy.scale.set(panelWidth, 0.94, 1);
      dummy.updateMatrix();
      panels.setMatrixAt(instance, dummy.matrix);
      instance += 1;
    }
  }
  panels.instanceMatrix.needsUpdate = true;
  panels.computeBoundingBox();
  panels.computeBoundingSphere();
  panels.renderOrder = 6;
  group.add(panels);
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

  const firstGlazedRow = UNGLAZED_LOWER_ROWS / signature.horizontal_rings;
  const profile = Array.from({ length: 49 }, (_, index) => {
    const t = firstGlazedRow + (index / 48) * (1 - firstGlazedRow);
    return new Vector2(
      domeRadius(t, signature.diameter_m) + 0.24,
      t * signature.height_m,
    );
  });
  const glass = new Mesh(
    new LatheGeometry(profile, signature.vertical_ribs),
    new MeshPhysicalMaterial({
      color: 0xc8e4ec,
      metalness: 0.04,
      opacity: 0.13,
      roughness: 0.04,
      side: DoubleSide,
      thickness: 0.18,
      transmission: 0.78,
      transparent: true,
      depthWrite: false,
    }),
  );
  glass.material.userData.nightEmissive = 0xb8d8ec;
  glass.material.userData.nightEmissiveIntensity = 2.8;
  glass.name = "24-sector glass envelope with 13 glazed rows";
  glass.userData = {
    glazedRows: signature.horizontal_rings - UNGLAZED_LOWER_ROWS,
    glazingSectors: signature.vertical_ribs,
    structuralRows: signature.horizontal_rings,
    unglazedLowerRows: UNGLAZED_LOWER_ROWS,
  };
  glass.renderOrder = 5;
  group.add(glass);

  const nightGlassGlow = new Mesh(
    new LatheGeometry(profile, signature.vertical_ribs),
    new MeshBasicMaterial({
      blending: AdditiveBlending,
      color: 0xffc987,
      depthTest: false,
      depthWrite: false,
      opacity: 0.08,
      side: FrontSide,
      transparent: true,
    }),
  );
  nightGlassGlow.name = "Reichstag dome 13-row interior night glow";
  nightGlassGlow.renderOrder = 6;
  nightGlassGlow.visible = false;
  nightGlassGlow.userData.nightOnly = true;
  group.add(nightGlassGlow);

  const steel = new MeshStandardMaterial({
    color: 0x90a5ad,
    emissive: 0x1c3038,
    emissiveIntensity: 0.1,
    metalness: 0.82,
    roughness: 0.19,
  });
  steel.userData.nightEmissive = 0xb5d5ea;
  steel.userData.nightEmissiveIntensity = 2.2;
  for (let index = 0; index < signature.vertical_ribs; index += 1) {
    const angle = (index / signature.vertical_ribs) * Math.PI * 2;
    const rib = new Mesh(
      new TubeGeometry(
        new CatmullRomCurve3(domeCurvePoints(signature, angle)),
        64,
        0.075,
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

  addDiagonalBracing(group, signature);

  for (let index = 1; index <= signature.horizontal_rings; index += 1) {
    const t = index / (signature.horizontal_rings + 1);
    const ring = new Mesh(
      new TorusGeometry(
        domeRadius(t, signature.diameter_m) + 0.12,
        0.055,
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

  const oculusRing = new Mesh(
    new TorusGeometry(TOP_OPENING_RADIUS_M, 0.24, 10, 96),
    steel,
  );
  oculusRing.name = "dome crown compression and open oculus ring";
  oculusRing.rotation.x = Math.PI / 2;
  oculusRing.position.y = signature.height_m;
  oculusRing.castShadow = true;
  group.add(oculusRing);

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
  mirrorCone.material.userData.nightEmissiveIntensity = 3.4;
  mirrorCone.name = "daylight mirror cone";
  mirrorCone.position.y = 9;
  mirrorCone.castShadow = true;
  group.add(mirrorCone);
  addMirrorConePanels(group);
  addMirrorConeFacets(group);

  for (const [index, y] of [7.2, 14.4].entries()) {
    const light = new PointLight(0xffd6a0, 110, 65, 1.8);
    light.name = `Reichstag dome warm interior night light ${index + 1}`;
    light.position.set(0, y, 0);
    light.visible = false;
    light.userData.nightOnly = true;
    group.add(light);
  }

  addRamps(group, signature);
  return group;
}
