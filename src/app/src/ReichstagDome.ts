import {
  AdditiveBlending,
  BoxGeometry,
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
  RingGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { markArchitecturalAccentInk } from "./architecturalInk";
import { REICHSTAG_DOME_EVIDENCE as EVIDENCE } from "./HeroArchitectureEvidence";

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

const TOP_OPENING_RADIUS_M = EVIDENCE.openingDiameterM / 2;
const PLATFORM_INNER_RADIUS_M = 7.8;
const PLATFORM_OUTER_RADIUS_M = Math.sqrt(EVIDENCE.platformAreaM2 / Math.PI + PLATFORM_INNER_RADIUS_M ** 2);
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

/** Same-handed, half-turn-separated helices provide separate up/down routes.
 * Only length, endpoints and separation are published; width/curvature are display choices.
 */
export function reichstagRampPoints(phase = 0): Vector3[] {
  const makePoints = (turns: number): Vector3[] => Array.from({ length: 161 }, (_, index) => {
    const t = index / 160;
    const radius = 18.1 + (PLATFORM_OUTER_RADIUS_M - 0.9 - 18.1) * t;
    const angle = t * Math.PI * 2 * turns + phase;
    return new Vector3(Math.cos(angle) * radius, t * EVIDENCE.platformHeightAboveTerraceM, Math.sin(angle) * radius);
  });
  let low = 1, high = 4;
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const turns = (low + high) / 2;
    const points = makePoints(turns);
    const length = points.slice(1).reduce((sum, point, index) => sum + point.distanceTo(points[index]), 0);
    if (length < EVIDENCE.rampLengthM) low = turns;
    else high = turns;
  }
  return makePoints((low + high) / 2);
}

function rampDeckGeometry(points: Vector3[]): BufferGeometry {
  const vertices: number[] = [], indices: number[] = [];
  points.forEach((point, index) => {
    const radial = new Vector3(point.x, 0, point.z).normalize();
    for (const y of [0, -0.14]) for (const offset of [-0.9, 0.9]) {
      vertices.push(point.x + radial.x * offset, point.y + y, point.z + radial.z * offset);
    }
    if (index === 0) return;
    const a = (index - 1) * 4, b = index * 4;
    indices.push(a, b, a+1, a+1, b, b+1, a+2, a+3, b+2, a+3, b+3, b+2,
      a, a+2, b, a+2, b+2, b, a+1, b+1, a+3, a+3, b+1, b+3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addRamps(group: Group): void {
  const deckMaterial = new MeshStandardMaterial({ color: 0xd8e0e3, metalness: 0.35, roughness: 0.42, side: DoubleSide });
  const railMaterial = new MeshStandardMaterial({ color: 0xaebbc0, metalness: 0.6, roughness: 0.3 });
  for (const route of [0, 1]) {
    const points = reichstagRampPoints(route * EVIDENCE.rampStartSeparationRadians);
    const label = route === 0 ? "ascending" : "descending";
    const ramp = new Mesh(rampDeckGeometry(points), deckMaterial);
    ramp.name = `${label} visitor ramp deck`;
    ramp.userData = { flatDeck: true, publishedLengthM: EVIDENCE.rampLengthM, displayWidthM: 1.8 };
    ramp.castShadow = true;
    group.add(ramp);
    for (const railOffset of [-0.85, 0.85]) {
      const railPoints = points.map((point) => point.clone().addScaledVector(new Vector3(point.x, 0, point.z).normalize(), railOffset).add(new Vector3(0, 0.92, 0)));
      const rail = new Mesh(new TubeGeometry(new CatmullRomCurve3(railPoints), 160, 0.045, 6, false), railMaterial);
      rail.name = `${label} ramp ${railOffset < 0 ? "inner" : "outer"} handrail`;
      group.add(rail);
    }
    const balusters: number[] = [];
    for (let index = 0; index < points.length; index += 4) {
      const point = points[index];
      for (const railOffset of [-0.85, 0.85]) {
        const base = point.clone().addScaledVector(new Vector3(point.x, 0, point.z).normalize(), railOffset);
        balusters.push(...base.toArray(), base.x, base.y + 0.92, base.z);
      }
    }
    // Continue the inner/outer guards around the observation platform in the same ink batch.
    if (route === 0) for (const radius of [PLATFORM_INNER_RADIUS_M, PLATFORM_OUTER_RADIUS_M]) {
      for (let index = 0; index < 96; index += 1) {
        const a = index / 96 * Math.PI * 2, b = (index + 1) / 96 * Math.PI * 2;
        const y = EVIDENCE.platformHeightAboveTerraceM;
        balusters.push(Math.cos(a)*radius,y+0.92,Math.sin(a)*radius,Math.cos(b)*radius,y+0.92,Math.sin(b)*radius);
        if (index % 4 === 0) balusters.push(Math.cos(a)*radius,y,Math.sin(a)*radius,Math.cos(a)*radius,y+0.92,Math.sin(a)*radius);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(balusters, 3));
    const lines = new LineSegments(geometry, markArchitecturalAccentInk(new LineBasicMaterial(), 0xaebbc0, "detail"));
    lines.name = `${label} ramp batched guardrail balusters`;
    group.add(lines);
  }
  const platform = new Mesh(new RingGeometry(PLATFORM_INNER_RADIUS_M, PLATFORM_OUTER_RADIUS_M, 96), deckMaterial);
  platform.name = "Reichstag open observation platform";
  platform.rotation.x = -Math.PI / 2;
  platform.position.y = EVIDENCE.platformHeightAboveTerraceM;
  platform.userData = { publishedAreaM2: EVIDENCE.platformAreaM2, annularPlanIsDisplayApproximation: true };
  group.add(platform);
  // Static position of the documented moving louvre screen; no simulated tracking claim.
  const shade = new InstancedMesh(new BoxGeometry(1, 1, 1), railMaterial, 32);
  shade.name = "Reichstag aluminium louvre sunshade";
  shade.userData = { displayLouvreCount: 30, sourceUrl: EVIDENCE.sourceUrl, staticPose: true };
  const dummy = new Object3D();
  for (let index = 0; index < 32; index += 1) {
    if (index < 30) {
      const t = (index + 0.5) / 30;
      dummy.position.set(2.4 + 5.4 * t + 0.4, t * 18, 0);
      dummy.scale.set(0.12, 0.42, 2.8 + 4.8 * t);
    } else {
      dummy.position.set(5.5, 9, (index === 30 ? -1 : 1) * 2.5);
      dummy.scale.set(0.16, 18, 0.16);
    }
    dummy.rotation.set(0, 0, index < 30 ? 0.12 : -Math.atan(5.4 / 18));
    dummy.updateMatrix();
    shade.setMatrixAt(index, dummy.matrix);
  }
  shade.computeBoundingBox(); shade.computeBoundingSphere(); shade.castShadow = true;
  group.add(shade);
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
    markArchitecturalAccentInk(
      new LineBasicMaterial({ opacity: 0.4, transparent: true }),
      0x9eb1b7,
      "micro",
    ),
  );
  braces.name = "dome alternating diagonal glazing braces";
  braces.renderOrder = 7;
  group.add(braces);
}

function addBaseRadialBeams(
  group: Group,
  signature: ArchitecturalSignature,
): void {
  const positions: number[] = [];
  const outerRadius = signature.diameter_m / 2 + 0.12;
  const innerRadius = 8.15;
  for (let sector = 0; sector < signature.vertical_ribs; sector += 1) {
    const angle = (sector / signature.vertical_ribs) * Math.PI * 2;
    positions.push(
      Math.cos(angle) * innerRadius,
      0.34,
      Math.sin(angle) * innerRadius,
      Math.cos(angle) * outerRadius,
      0.34,
      Math.sin(angle) * outerRadius,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const beams = new LineSegments(
    geometry,
    markArchitecturalAccentInk(
      new LineBasicMaterial(),
      0x8fa4ab,
      "detail",
    ),
  );
  beams.name = "dome batched base radial beams";
  beams.renderOrder = 7;
  group.add(beams);
}

function addMirrorConeFacets(group: Group): void {
  const positions: number[] = [];
  const sectors = EVIDENCE.mirrorsPerRow;
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
  for (let level = 1; level < EVIDENCE.mirrorRows; level += 1) {
    const t = level / EVIDENCE.mirrorRows;
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
    markArchitecturalAccentInk(
      new LineBasicMaterial({
        opacity: 0.72,
        transparent: true,
      }),
      0xf1f5f4,
      "micro",
    ),
  );
  facets.name = "daylight mirror cone 12-sector 30-row facet grid";
  facets.renderOrder = 8;
  group.add(facets);
}

function addMirrorConePanels(group: Group): void {
  const sectors = EVIDENCE.mirrorsPerRow;
  const rows = EVIDENCE.mirrorRows;
  const panelGeometry = new PlaneGeometry(1, 1);
  // Drawn silver, not physical metal: high metalness without an
  // environment map renders nearly black in three.js, which made the
  // mirror cone read as a dark shaft instead of the silvery funnel.
  const panelMaterial = new MeshPhysicalMaterial({
    color: 0xe8eef0,
    metalness: 0.22,
    roughness: 0.42,
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
  panels.userData = { rows, mirrorsPerRow: sectors };
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
      dummy.scale.set(panelWidth, (18 / rows) * 0.88, 1);
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
    sourceDetail: EVIDENCE,
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
  const ribGeometry = new TubeGeometry(
    new CatmullRomCurve3(domeCurvePoints(signature, 0)),
    64,
    0.075,
    6,
    false,
  );
  const ribs = new InstancedMesh(ribGeometry, steel, signature.vertical_ribs);
  ribs.name = "main steel ribs instanced";
  const ribTransform = new Object3D();
  for (let index = 0; index < signature.vertical_ribs; index += 1) {
    ribTransform.rotation.set(
      0,
      -(index / signature.vertical_ribs) * Math.PI * 2,
      0,
    );
    ribTransform.updateMatrix();
    ribs.setMatrixAt(index, ribTransform.matrix);
  }
  ribs.instanceMatrix.needsUpdate = true;
  ribs.computeBoundingBox();
  ribs.computeBoundingSphere();
  ribs.castShadow = true;
  ribs.renderOrder = 7;
  group.add(ribs);

  addDiagonalBracing(group, signature);
  addBaseRadialBeams(group, signature);

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
    // Drawn silver (see addMirrorConePanels): low metalness so the cone
    // shades as a bright silvery funnel under the scene lights.
    new MeshPhysicalMaterial({
      color: 0xe2eaec,
      metalness: 0.2,
      roughness: 0.4,
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

  addRamps(group);
  return group;
}
