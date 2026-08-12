import { describe, expect, test } from "bun:test";
import {
  Box3,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
} from "three";
import {
  type BrandenburgGateModelSignature,
  type ChancelleryModelSignature,
  type HauptbahnhofModelSignature,
  type ReichstagModelSignature,
  createArchitecturalSignature,
  focusCameraForSignature,
  HAUPTBAHNHOF_DB_PYLON_PROFILE,
  REICHSTAG_COURTYARDS,
  REICHSTAG_COURTYARD_DEPTH_M,
  REICHSTAG_FLAG_HEIGHT_M,
  REICHSTAG_FLAG_WIDTH_M,
  REICHSTAG_FLAGPOLE_HEIGHT_M,
  REICHSTAG_INSCRIPTION_FIELD_WIDTH_M,
} from "../src/ArchitecturalLandmarks";
import { dedicationLayout } from "../src/reichstagInscription";
import { windFlagMatrixCount } from "../src/WindFlags";

const base = {
  anchor_world: [0, 0, 0] as [number, number, number],
  focus_camera: {
    azimuth_degrees: 45,
    distance_m: 200,
    polar_degrees: 60,
    target_height_m: 18,
  },
  geometry_status: "metric test",
  landmark_name: "Test",
  rotation_y_degrees: 0,
  source_url: "https://example.com/official",
};

describe("metre-scale architectural recognition models", () => {
  test("builds all twelve Brandenburg Gate columns at published scale", () => {
    const signature: BrandenburgGateModelSignature = {
      ...base,
      column_height_m: 13.5,
      column_rows: 2,
      columns_per_row: 6,
      depth_m: 11,
      gate_height_m: 20.3,
      id: "brandenburger-tor-model",
      kind: "brandenburg_gate_model",
      total_height_m: 26,
      width_m: 62.5,
    };
    const gate = createArchitecturalSignature(signature);
    expect(gate).not.toBeNull();
    const bounds = new Box3().setFromObject(gate!);
    expect(
      gate!.children.filter((child) =>
        /^Brandenburg Gate Doric column \d+:\d+$/.test(child.name),
      ),
    ).toHaveLength(12);
    expect(
      gate!.children.filter((child) =>
        /^Brandenburg Gate Doric capital \d+:\d+$/.test(child.name),
      ),
    ).toHaveLength(12);
    expect(
      gate!.children.filter(
        (child) => child.name === "Brandenburg Gate passage paving shadow",
      ),
    ).toHaveLength(5);
    expect(
      gate!.children.filter(
        (child) => child.name === "Brandenburg Gate shaded passage interior",
      ),
    ).toHaveLength(5);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(62.5, 1);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(11, 1);
    expect(bounds.max.y).toBeGreaterThan(25);
    expect(bounds.max.y).toBeLessThan(27);
    // The Quadriga is its own module now (Quadriga.ts), merged into a
    // handful of meshes rather than a few dozen loose boxes, and scaled
    // from the signature so the eagle lands exactly at total_height_m.
    const quadriga = gate!.getObjectByName("Quadriga mit Victoria")!;
    expect(quadriga).toBeDefined();
    expect(quadriga.getObjectByName("Quadriga bodies")).toBeDefined();
    const quadrigaBounds = new Box3().setFromObject(quadriga);
    expect(quadrigaBounds.min.y).toBeCloseTo(signature.gate_height_m, 1);
    expect(quadrigaBounds.max.y).toBeCloseTo(signature.total_height_m, 1);
    const fluting = gate!.getObjectByName(
      "Brandenburg Gate batched Doric column fluting",
    );
    expect(fluting).toBeInstanceOf(LineSegments);
    expect(
      ((fluting as LineSegments).material as LineBasicMaterial).userData
        .architecturalInkRole,
    ).toBe("micro");
    expect(
      gate!.getObjectByName("Brandenburg Gate batched pavilion masonry joints"),
    ).toBeInstanceOf(LineSegments);
    const gateStone = gate!.getObjectByName(
      "Brandenburg Gate Doric column 1:1",
    ) as Mesh;
    expect(gateStone.material.userData.nightEmissive).toBe(0xf0c184);
    expect(gateStone.material.userData.nightEmissiveIntensity).toBe(0.72);
    const triglyphs = gate!.getObjectByName(
      "Brandenburg Gate instanced frieze triglyphs",
    );
    expect(triglyphs).toBeInstanceOf(InstancedMesh);
    expect((triglyphs as InstancedMesh).count).toBe(50);
    const abaci = gate!.getObjectByName(
      "Brandenburg Gate instanced Doric capital abaci",
    );
    expect(abaci).toBeInstanceOf(InstancedMesh);
    expect((abaci as InstancedMesh).count).toBe(12);
  });

  test("makes the Hauptbahnhof cross and office bridges legible", () => {
    const signature: HauptbahnhofModelSignature = {
      ...base,
      east_west_roof_length_m: 321,
      east_west_roof_width_m: 40,
      id: "hauptbahnhof-model",
      kind: "hauptbahnhof_model",
      north_south_hall_length_m: 180,
      north_south_hall_width_m: 42,
      office_bridge_height_m: 46,
    };
    const station = createArchitecturalSignature(signature);
    expect(station).not.toBeNull();
    const bounds = new Box3().setFromObject(station!);
    expect(bounds.max.x - bounds.min.x).toBeGreaterThanOrEqual(321);
    expect(bounds.max.z - bounds.min.z).toBeGreaterThanOrEqual(180);
    expect(bounds.max.y).toBeGreaterThanOrEqual(46);
    expect(bounds.max.y).toBeCloseTo(
      HAUPTBAHNHOF_DB_PYLON_PROFILE.heightM + 2.55,
      3,
    );
    const officeBridges = station!.children.filter(
      (child) => child.name === "Hauptbahnhof 46 m office bridge",
    );
    for (const bridge of officeBridges) {
      expect(new Box3().setFromObject(bridge).max.y).toBeLessThan(47);
    }
    expect(
      station!.children.some((child) =>
        child.name.includes("east-west glass roof"),
      ),
    ).toBe(true);
    expect(officeBridges).toHaveLength(2);
    // v0.56: the elevated deck, ballast, rails, sleepers and platforms are
    // now built from many short straight sub-segments that each follow
    // the real rail curve (railCurveOffset) instead of one long straight
    // run per track -- see the curvature contract test below, which
    // checks that this segmented deck actually tracks the real rail
    // polyline. So "upper-level rail" and "upper-level ballast bed" now
    // appear many times (one set of segments per track), not once per
    // track: assert there are several segments per track rather than
    // exactly one long box per track.
    expect(
      station!.children.filter(
        (child) => child.name === "Hauptbahnhof upper-level rail",
      ).length,
    ).toBeGreaterThan(8);
    const trackDeckSegments = station!.children.filter(
      (child) => child.name === "Hauptbahnhof east-west elevated track deck",
    );
    expect(trackDeckSegments.length).toBeGreaterThan(1);
    const trackDeckBounds = new Box3();
    for (const segment of trackDeckSegments) {
      trackDeckBounds.union(new Box3().setFromObject(segment));
    }
    // 321 m shed plus a 110 m approach to the west only. The east approach
    // is gone: the Stadtbahn curves towards Friedrichstraße the moment it
    // leaves the shed, so a straight stub pointed at empty air over the
    // Humboldthafen. The OSM viaduct carries the tracks on from the gable.
    // v0.56: the deck is now built from short segments that follow the
    // real rail curve, so its bounding-box x-extent is slightly larger
    // than the nominal 431 m span (curved sub-segments, plus a small
    // per-segment overlap margin) -- allow a generous tolerance instead
    // of the old dead-straight exact figure.
    expect(
      trackDeckBounds.max.x - trackDeckBounds.min.x,
    ).toBeGreaterThanOrEqual(431);
    expect(trackDeckBounds.max.x - trackDeckBounds.min.x).toBeLessThan(
      431 + 15,
    );
    // Step 38: the shed used to be two separate barrel-roof bodies (a
    // 321 m main shed plus a 110 m "west approach wing" butted against
    // its gable), which read as two disconnected flat segments meeting at
    // a hard seam. Step 40 / v0.56.1: the roof is now ONE continuous body
    // stuck to its real ~321 m length (the old "431 m" figure was the
    // *deck's* length, wrongly copied onto the roof, which is why the old
    // shed used to overhang the Humboldthafen at both ends with nothing
    // underneath). The elevated deck below is still allowed to run past
    // the shed as an open approach viaduct, so the roof is now shorter
    // than the deck on purpose, not equal to it.
    const roof = station!.getObjectByName(
      "Hauptbahnhof 321 m east-west glass roof",
    );
    expect(roof).toBeDefined();
    const roofBounds = new Box3().setFromObject(roof!);
    expect(roofBounds.max.x - roofBounds.min.x).toBeGreaterThanOrEqual(321);
    expect(roofBounds.max.x - roofBounds.min.x).toBeLessThan(321 + 15);
    // The roof must stay within the deck's own span (never overhang past
    // the last supported bit of track) and be strictly shorter than it,
    // which is the whole point of the v0.56.1 fix.
    expect(roofBounds.min.x).toBeGreaterThanOrEqual(trackDeckBounds.min.x - 1);
    expect(roofBounds.max.x).toBeLessThanOrEqual(trackDeckBounds.max.x + 1);
    expect(roofBounds.max.x - roofBounds.min.x).toBeLessThan(
      trackDeckBounds.max.x - trackDeckBounds.min.x,
    );
    expect(
      station!.getObjectByName("Hauptbahnhof west approach glass roof wing"),
    ).toBeUndefined();
    expect(
      station!.children.filter(
        (child) => child.name === "Hauptbahnhof upper-level ballast bed",
      ).length,
    ).toBeGreaterThan(4);
    const approachPiers = station!.getObjectByName(
      "Hauptbahnhof instanced approach-viaduct piers",
    );
    expect(approachPiers).toBeInstanceOf(InstancedMesh);
    expect((approachPiers as InstancedMesh).count).toBeGreaterThan(8);
    // Step 37: the stationary ICE moved out of this local model group and
    // onto a real rail-lines.json centreline in world space (see
    // createIceOnRails and tests/ice-on-rails.test.ts) -- it must NOT be a
    // child of the station group any more, or it would still be riding
    // the station's own fictional stub track.
    expect(
      station!.children.some((child) => child.name.includes("stationary ICE")),
    ).toBe(false);
    expect(
      station!.children.some((child) => child.name.includes("Berlin S-Bahn")),
    ).toBe(true);
    // Step 38: two barrel roofs now -- the single continuous east-west
    // shed (see above) and the north-south crossing hall. The two office
    // towers are drawn as solid boxes with their own edges, not barrel
    // roofs, so they do not add to this count.
    expect(
      station!.children.filter((child) =>
        child.name.includes("glass panel seams"),
      ),
    ).toHaveLength(2);
    const roofRibs = station!.children.filter((child) =>
      child.name.includes("instanced steel arch ribs"),
    );
    expect(roofRibs).toHaveLength(2);
    expect(
      roofRibs.reduce(
        (count, child) => count + (child as InstancedMesh).count,
        0,
      ),
    ).toBeGreaterThan(50);
    // Step 38: the office towers are legible solid volumes now, each with
    // its own ink edges traced from the same box geometry (no separate,
    // mismatched outline box) plus a flush roof cap -- the fix for the
    // reference photos' "overlapping white flat-arch segments" complaint.
    const officeTowers = station!.children.filter(
      (child) => child.name === "Hauptbahnhof 46 m office bridge",
    );
    for (const tower of officeTowers) {
      const towerBounds = new Box3().setFromObject(tower);
      expect(towerBounds.max.y - towerBounds.min.y).toBeCloseTo(46, 1);
    }
    expect(
      station!.children.filter(
        (child) => child.name === "Hauptbahnhof office-bridge roof cap",
      ),
    ).toHaveLength(2);
    const officeEndGrids = station!.children.filter(
      (child) =>
        child.name === "Hauptbahnhof batched office-bridge end-facade grid",
    );
    expect(officeEndGrids).toHaveLength(2);
    for (const grid of officeEndGrids) {
      expect(grid).toBeInstanceOf(LineSegments);
      expect(
        (grid as LineSegments).geometry.getAttribute("position").count,
      ).toBe(60);
    }
    const sleepers = station!.getObjectByName(
      "Hauptbahnhof instanced upper-level track sleepers",
    );
    expect(sleepers).toBeInstanceOf(InstancedMesh);
    expect((sleepers as InstancedMesh).count).toBeGreaterThan(600);
    // Step 37: only the S-Bahn is still built inside this local model
    // group -- the ICE moved to a real rail centreline in world space, so
    // only one train's wheel-instance mesh remains a child here.
    expect(
      station!.children.filter((child) =>
        child.name.includes("instanced wheels"),
      ),
    ).toHaveLength(1);
    const shopfronts = station!.getObjectByName(
      "Hauptbahnhof instanced concourse shopfronts",
    );
    expect(shopfronts).toBeInstanceOf(InstancedMesh);
    expect((shopfronts as InstancedMesh).count).toBeGreaterThanOrEqual(20);
    expect(
      station!.getObjectByName(
        "Hauptbahnhof batched gallery glass balustrades",
      ),
    ).toBeInstanceOf(LineSegments);
    const liftShafts = station!.children.filter(
      (child) => child.name === "Hauptbahnhof cylindrical glass lift shaft",
    );
    expect(liftShafts).toHaveLength(4);
    for (const shaft of liftShafts) {
      expect((shaft as Mesh).geometry.type).toBe("CylinderGeometry");
    }
    expect(
      station!.getObjectByName(
        "Hauptbahnhof instanced cylindrical lift frames",
      ),
    ).toBeInstanceOf(InstancedMesh);
  });

  test("preserves the LoD2 Chancellery envelope and official heights", () => {
    const signature: ChancelleryModelSignature = {
      ...base,
      cube_depth_m: 56.376,
      cube_height_m: 36,
      cube_offset_world: [66.2, 0, -0.3],
      cube_width_m: 56.472,
      forecourt_offset_world: [158.4, 0, -7.5],
      forecourt_sculpture_height_m: 5.5,
      id: "bundeskanzleramt-model",
      kind: "chancellery_model",
      office_height_m: 18,
      office_segments: [
        {
          depth_m: 24,
          height_m: 18,
          offset_world: [-25, 0, 32],
          width_m: 180,
        },
      ],
      overall_depth_m: 106.175,
      overall_width_m: 344.964,
    };
    const chancellery = createArchitecturalSignature(signature);
    expect(chancellery).not.toBeNull();
    expect(chancellery!.userData.cube_height_m).toBe(36);
    expect(chancellery!.userData.office_height_m).toBe(18);
    expect(
      chancellery!.children.filter((child) =>
        child.name.includes("semicircular leadership window"),
      ),
    ).toHaveLength(2);
    expect(focusCameraForSignature(signature)?.target_world).toEqual([
      66.2, 0, -0.3,
    ]);
    expect(
      chancellery!.children.filter((child) =>
        child.name.includes("Eduardo Chillida Berlin"),
      ).length,
    ).toBeGreaterThanOrEqual(7);
    expect(
      chancellery!.getObjectByName(
        "Chancellery batched semicircular leadership-window grid",
      ),
    ).toBeInstanceOf(LineSegments);
    expect(
      chancellery!.getObjectByName(
        "Chancellery batched central-cube curtain-wall grid",
      ),
    ).toBeInstanceOf(LineSegments);
    expect(
      chancellery!.children.filter(
        (child) => child.name === "Chancellery central side curtain wall",
      ),
    ).toHaveLength(2);
    expect(
      chancellery!.children.filter(
        (child) => child.name === "Chancellery central open floor plate",
      ),
    ).toHaveLength(0);
    expect(
      chancellery!.getObjectByName("Chancellery central glass cube"),
    ).toBeUndefined();
    const visibleInterior = chancellery!.getObjectByName(
      "Chancellery exterior-visible interior",
    );
    expect(visibleInterior).not.toBeUndefined();
    expect(visibleInterior!.userData.geometryStatus).toContain(
      "not a surveyed",
    );
    expect(visibleInterior!.userData.sourceBoundary).toContain(
      "externally visible",
    );
    const splitGalleryPlates = chancellery!.getObjectByName(
      "Chancellery central split gallery floor plates",
    );
    expect(splitGalleryPlates).toBeInstanceOf(InstancedMesh);
    expect((splitGalleryPlates as InstancedMesh).count).toBe(16);
    expect(splitGalleryPlates!.userData.atriumClearWidthM).toBe(14.4);
    expect(
      chancellery!.getObjectByName(
        "Chancellery externally visible atrium bridges",
      ),
    ).toBeInstanceOf(InstancedMesh);
    expect(
      chancellery!.getObjectByName(
        "Chancellery exterior-visible gallery rails",
      ),
    ).toBeInstanceOf(LineSegments);
    const stairTreads = chancellery!.getObjectByName(
      "Chancellery visible atrium stair treads",
    );
    expect(stairTreads).toBeInstanceOf(InstancedMesh);
    expect((stairTreads as InstancedMesh).count).toBe(24);
    expect(
      chancellery!.getObjectByName(
        "Chancellery exterior-visible meeting chairs",
      ),
    ).toBeInstanceOf(InstancedMesh);
    const interiorLights = chancellery!.getObjectByName(
      "Chancellery exterior-visible interior ceiling lights",
    ) as InstancedMesh;
    expect(interiorLights).toBeInstanceOf(InstancedMesh);
    expect(interiorLights.count).toBe(70);
    expect(interiorLights.material.userData.nightEmissive).toBe(0xffc66d);
    expect(interiorLights.material.userData.nightEmissiveIntensity).toBe(1.55);
    const linearInteriorLights = chancellery!.getObjectByName(
      "Chancellery exterior-visible linear interior lights",
    );
    expect(linearInteriorLights).toBeInstanceOf(InstancedMesh);
    expect((linearInteriorLights as InstancedMesh).count).toBe(48);
    const warmInteriorPanels = chancellery!.getObjectByName(
      "Chancellery sparse exterior-visible warm interior panels",
    );
    expect(warmInteriorPanels).toBeInstanceOf(InstancedMesh);
    expect((warmInteriorPanels as InstancedMesh).count).toBe(12);
    const chancelleryConcrete = chancellery!.getObjectByName(
      "Chancellery central concrete pylon",
    ) as Mesh;
    expect(chancelleryConcrete.material.userData.nightEmissive).toBe(0x55687b);
    expect(chancelleryConcrete.material.userData.nightEmissiveIntensity).toBe(
      0.32,
    );
    expect(
      chancellery!.getObjectByName(
        "Chancellery instanced office-band window panes",
      ),
    ).toBeInstanceOf(InstancedMesh);
    const darkOfficePanes = chancellery!.getObjectByName(
      "Chancellery instanced office-band window panes",
    ) as InstancedMesh;
    const litOfficePanes = chancellery!.getObjectByName(
      "Chancellery selectively lit office-band window panes",
    ) as InstancedMesh;
    expect(litOfficePanes).toBeInstanceOf(InstancedMesh);
    expect(darkOfficePanes.material.userData.nightEmissiveIntensity).toBe(0.12);
    expect(litOfficePanes.material.userData.nightEmissiveIntensity).toBe(0.82);
    expect(litOfficePanes.count).toBeLessThan(darkOfficePanes.count);
    const leadershipColumns = chancellery!.getObjectByName(
      "Chancellery instanced semicircular-hall columns",
    );
    expect(leadershipColumns).toBeInstanceOf(InstancedMesh);
    expect((leadershipColumns as InstancedMesh).count).toBe(8);
    const leadershipCapitals = chancellery!.getObjectByName(
      "Chancellery instanced semicircular-hall capitals",
    );
    expect(leadershipCapitals).toBeInstanceOf(InstancedMesh);
    expect((leadershipCapitals as InstancedMesh).count).toBe(8);
    expect(
      chancellery!.getObjectByName(
        "Chancellery batched semicircular-hall balcony rails",
      ),
    ).toBeInstanceOf(LineSegments);
    const police = chancellery!.getObjectByName(
      "Chancellery two Federal Police uniformed torsos",
    );
    expect(police).toBeInstanceOf(InstancedMesh);
    expect((police as InstancedMesh).count).toBe(2);
    expect(
      chancellery!.getObjectByName(
        "Chancellery two Federal Police reflective chest bands",
      ),
    ).toBeInstanceOf(InstancedMesh);
    expect(
      chancellery!.getObjectByName("Chancellery monumental concave roof shell"),
    ).toBeInstanceOf(Mesh);
    const soffitLights = chancellery!.getObjectByName(
      "Chancellery monumental roof soffit downlights",
    );
    expect(soffitLights).toBeInstanceOf(InstancedMesh);
    expect((soffitLights as InstancedMesh).count).toBe(45);
    const lobbyLights = chancellery!.getObjectByName(
      "Chancellery Ehrenhof lobby ceiling lights",
    );
    expect(lobbyLights).toBeInstanceOf(InstancedMesh);
    expect((lobbyLights as InstancedMesh).count).toBe(27);
    expect(
      chancellery!.getObjectByName(
        "Chancellery monumental concave roof shell drawn perimeter",
      ),
    ).toBeInstanceOf(LineSegments);
    expect(
      chancellery!.getObjectByName(
        "Chancellery Ehrenhof lower tensile entrance canopy",
      ),
    ).toBeInstanceOf(Mesh);
    expect(
      chancellery!.getObjectByName(
        "Chancellery batched Ehrenhof entrance glazing grid",
      ),
    ).toBeInstanceOf(LineSegments);
    const ivyPanels = chancellery!.getObjectByName(
      "Chancellery instanced Ehrenhof ivy wall patches",
    );
    expect(ivyPanels).toBeInstanceOf(InstancedMesh);
    expect((ivyPanels as InstancedMesh).count).toBeGreaterThanOrEqual(32);
    const guardhouse = chancellery!.getObjectByName(
      "Chancellery rounded street security pavilion",
    ) as Mesh;
    expect(guardhouse).toBeInstanceOf(Mesh);
    expect(guardhouse.geometry.type).toBe("CylinderGeometry");
    expect(guardhouse.position.x).toBeGreaterThan(
      signature.forecourt_offset_world![0],
    );
    expect(
      chancellery!.getObjectByName(
        "Chancellery street pavilion wraparound window band",
      ),
    ).toBeInstanceOf(Mesh);
    const streetLamps = chancellery!.getObjectByName(
      "Chancellery instanced oval street entrance lamp heads",
    );
    expect(streetLamps).toBeInstanceOf(InstancedMesh);
    expect((streetLamps as InstancedMesh).count).toBe(5);
    const fenceBars = chancellery!.getObjectByName(
      "Chancellery instanced street security fence bars",
    );
    expect(fenceBars).toBeInstanceOf(InstancedMesh);
    expect((fenceBars as InstancedMesh).count).toBe(41);
    expect(
      chancellery!.children.filter((child) =>
        child.name.startsWith("Chancellery Ehrenhof German German flag stripe"),
      ),
    ).toHaveLength(3);
    const courtyardStripe = chancellery!.children.find((child) =>
      child.name.startsWith("Chancellery Ehrenhof German German flag stripe"),
    ) as Mesh;
    courtyardStripe.geometry.computeBoundingBox();
    expect(
      courtyardStripe.geometry.boundingBox!.max.x -
        courtyardStripe.geometry.boundingBox!.min.x,
    ).toBeCloseTo(3.8, 5);
    expect(
      courtyardStripe.geometry.boundingBox!.max.y -
        courtyardStripe.geometry.boundingBox!.min.y,
    ).toBeCloseTo(2.6 / 3, 5);
    expect(
      chancellery!.getObjectByName(
        "Chancellery Ehrenhof EU European Union flag",
      ),
    ).toBeInstanceOf(Mesh);
    expect(
      chancellery!.children.filter((child) =>
        child.name.startsWith("Chancellery central roof frame"),
      ),
    ).toHaveLength(8);
    const entranceHall = chancellery!.getObjectByName(
      "Chancellery Ehrenhof glazed entrance hall",
    ) as Mesh;
    const entranceHallEdges = chancellery!.getObjectByName(
      "Chancellery Ehrenhof glazed entrance hall model edges",
    ) as LineSegments;
    expect(entranceHallEdges.rotation.y).toBeCloseTo(
      entranceHall.rotation.y,
      8,
    );
    const grassIslands = chancellery!.getObjectByName(
      "Chancellery instanced Ehrenhof organic grass islands",
    );
    expect(grassIslands).toBeInstanceOf(InstancedMesh);
    expect((grassIslands as InstancedMesh).count).toBe(5);
  });

  test("adds the Reichstag's four towers and west portico", () => {
    const signature: ReichstagModelSignature = {
      ...base,
      body_height_m: 28.06,
      depth_m: 138,
      id: "reichstag-model",
      kind: "reichstag_model",
      rotation_y_degrees: 21.82,
      width_m: 100,
    };
    const reichstag = createArchitecturalSignature(signature);
    expect(reichstag).not.toBeNull();
    expect(
      reichstag!.children.filter(
        (child) =>
          child.name.includes("corner tower") &&
          !child.name.includes("model edges"),
      ),
    ).toHaveLength(4);
    expect(
      reichstag!.children.filter((child) =>
        /^Reichstag west portico column \d+$/.test(child.name),
      ),
    ).toHaveLength(6);
    const reichstagStone = reichstag!.getObjectByName(
      "Reichstag corner-tower roof cornice",
    ) as Mesh;
    expect(reichstagStone.material.userData.nightEmissive).toBe(0x65778d);
    expect(reichstagStone.material.userData.nightEmissiveIntensity).toBe(0.5);
    const focusCamera = focusCameraForSignature(signature);
    expect(focusCamera?.distance_m).toBe(200);
    expect(focusCamera?.target_world).toEqual([0, 0, 0]);
    expect(reichstag!.rotation.y).toBeCloseTo((21.82 * Math.PI) / 180, 6);
    expect(
      reichstag!.children.filter((child) =>
        child.name.includes("German flag stripe"),
      ),
    ).toHaveLength(9);
    expect(
      reichstag!.children.filter((child) =>
        child.name.includes("European Union flag"),
      ),
    ).toHaveLength(2);
    expect(windFlagMatrixCount(reichstag!)).toBe(11);
    expect(
      reichstag!.children.filter((child) => child.name.endsWith("flagpole")),
    ).toHaveLength(4);
    const germanStripe = reichstag!.children.find((child) =>
      child.name.includes("German flag stripe"),
    ) as Mesh;
    germanStripe.geometry.computeBoundingBox();
    const germanStripeBounds = germanStripe.geometry.boundingBox!;
    expect(germanStripeBounds.max.x - germanStripeBounds.min.x).toBeCloseTo(
      REICHSTAG_FLAG_WIDTH_M,
      5,
    );
    expect(germanStripeBounds.max.y - germanStripeBounds.min.y).toBeCloseTo(
      REICHSTAG_FLAG_HEIGHT_M / 3,
      5,
    );
    const flagpoles = reichstag!.children.filter((child) =>
      child.name.endsWith("flagpole"),
    ) as Mesh[];
    for (const flagpole of flagpoles) {
      flagpole.geometry.computeBoundingBox();
      const poleBounds = flagpole.geometry.boundingBox!;
      expect(poleBounds.max.y - poleBounds.min.y).toBeCloseTo(
        REICHSTAG_FLAGPOLE_HEIGHT_M,
        5,
      );
    }
    expect(
      reichstag!.children.filter((child) =>
        child.name.includes("facade windows"),
      ),
    ).toHaveLength(3);
    const darkArches = reichstag!.getObjectByName(
      "Reichstag dark tall arched facade windows",
    ) as InstancedMesh;
    const litArches = reichstag!.getObjectByName(
      "Reichstag selectively lit tall arched facade windows",
    ) as InstancedMesh;
    expect(darkArches).toBeInstanceOf(InstancedMesh);
    expect(litArches).toBeInstanceOf(InstancedMesh);
    expect(darkArches.material.color.getHex()).toBe(0x7c9499);
    expect(darkArches.material.userData.nightEmissive).toBeUndefined();
    expect(litArches.material.userData.nightEmissive).toBe(0xffd28a);
    const towerWindows = reichstag!.children.filter((child) =>
      child.name.includes("three-bay tower arched windows"),
    ) as InstancedMesh[];
    expect(towerWindows).toHaveLength(1);
    expect(towerWindows.reduce((sum, windows) => sum + windows.count, 0)).toBe(
      24,
    );
    expect(towerWindows[0].material.userData.nightEmissive).toBeUndefined();
    const upperTowerWindows = reichstag!.getObjectByName(
      "Reichstag dark upper corner-tower windows",
    );
    expect(upperTowerWindows).toBeInstanceOf(InstancedMesh);
    expect((upperTowerWindows as InstancedMesh).count).toBe(24);
    expect(
      (upperTowerWindows as InstancedMesh).material.userData.nightEmissive,
    ).toBeUndefined();
    const upperTowerFrames = reichstag!.getObjectByName(
      "Reichstag instanced upper corner-tower window frames",
    );
    expect(upperTowerFrames).toBeInstanceOf(InstancedMesh);
    expect((upperTowerFrames as InstancedMesh).count).toBe(24);
    const tallMullions = reichstag!.getObjectByName(
      "Reichstag instanced tall-window vertical mullions",
    );
    expect(tallMullions).toBeInstanceOf(InstancedMesh);
    expect((tallMullions as InstancedMesh).count).toBeGreaterThan(40);
    const upperWindows = reichstag!.getObjectByName(
      "Reichstag dark upper rectangular facade windows",
    ) as InstancedMesh;
    expect(upperWindows.material.userData.nightEmissive).toBeUndefined();
    upperWindows.geometry.computeBoundingBox();
    const upperBounds = upperWindows.geometry.boundingBox!;
    expect(upperBounds.max.y - upperBounds.min.y).toBeGreaterThan(
      (upperBounds.max.x - upperBounds.min.x) * 2,
    );
    const upperFrames = reichstag!.getObjectByName(
      "Reichstag instanced upper-window 10 cm reveal frames",
    );
    expect(upperFrames).toBeInstanceOf(InstancedMesh);
    expect((upperFrames as InstancedMesh).count).toBe(upperWindows.count);
    expect(
      reichstag!.children.filter((child) =>
        child.name.includes("west entrance tall glass pane"),
      ),
    ).toHaveLength(5);
    const balustrade = reichstag!.getObjectByName(
      "Reichstag instanced roof-balustrade posts",
    );
    expect(balustrade).toBeInstanceOf(InstancedMesh);
    expect((balustrade as InstancedMesh).count).toBeGreaterThan(80);
    expect(
      reichstag!.getObjectByName("Reichstag batched facade string courses"),
    ).toBeInstanceOf(LineSegments);
  });

  test("spells DEM DEUTSCHEN VOLKE across the west architrave", () => {
    const signature: ReichstagModelSignature = {
      ...base,
      body_height_m: 28.06,
      depth_m: 138,
      id: "reichstag-model",
      kind: "reichstag_model",
      width_m: 100,
    };
    const reichstag = createArchitecturalSignature(signature)!;
    const dedication = reichstag.getObjectByName(
      "Reichstag DEM DEUTSCHEN VOLKE dedication lettering",
    ) as Mesh;
    expect(dedication).toBeInstanceOf(Mesh);
    // Faces west, out over the grand stair, so the line reads from the square.
    expect(dedication.rotation.y).toBeCloseTo(-Math.PI / 2, 6);
    expect(dedication.position.x).toBeLessThan(-signature.width_m / 2);
    // Sits on the architrave, between the capitals and the pediment.
    expect(dedication.position.y).toBeGreaterThan(17.8);
    expect(dedication.position.y).toBeLessThan(19.4);
    dedication.geometry.computeBoundingBox();
    const bounds = dedication.geometry.boundingBox!;
    const bandWidth = bounds.max.x - bounds.min.x;
    expect(bandWidth).toBeCloseTo(REICHSTAG_INSCRIPTION_FIELD_WIDTH_M, 5);
    expect(bandWidth).toBeGreaterThan(dedicationLayout().totalWidthM);
    const band = reichstag.getObjectByName(
      "Reichstag DEM DEUTSCHEN VOLKE inscription band",
    );
    expect(band).toBeInstanceOf(Mesh);
    // A real depth separation prevents coplanar z-fighting at rest.
    expect(band!.position.x - dedication.position.x).toBeGreaterThan(0.1);
    expect(dedication.material.depthWrite).toBe(false);
    expect(dedication.frustumCulled).toBe(false);
  });

  test("hollows out the six documented inner courtyards", () => {
    const signature: ReichstagModelSignature = {
      ...base,
      body_height_m: 28.06,
      depth_m: 138,
      id: "reichstag-model",
      kind: "reichstag_model",
      width_m: 100,
    };
    const reichstag = createArchitecturalSignature(signature)!;
    const floors = reichstag.children.filter(
      (child) =>
        child.name === "Reichstag inner courtyard floor" &&
        child instanceof Mesh,
    ) as Mesh[];
    expect(floors).toHaveLength(6);
    expect(REICHSTAG_COURTYARDS).toHaveLength(6);
    const shafts = reichstag.children.filter(
      (child) => child.name === "Reichstag inner courtyard shaft",
    );
    expect(shafts).toHaveLength(6);
    for (const floor of floors) {
      // Recessed below the cornice, never poking through the roof.
      expect(floor.position.y).toBeLessThan(
        signature.body_height_m - REICHSTAG_COURTYARD_DEPTH_M,
      );
      expect(floor.position.y).toBeGreaterThan(0);
    }
    // Every courtyard has to stay inside the LoD2 envelope.
    for (const court of REICHSTAG_COURTYARDS) {
      expect(Math.abs(court.x_m) + court.width_m / 2).toBeLessThan(
        signature.width_m / 2,
      );
      expect(Math.abs(court.z_m) + court.depth_m / 2).toBeLessThan(
        signature.depth_m / 2,
      );
    }
    // The wings are symmetric about the cross axis, as the footprint is.
    const north = REICHSTAG_COURTYARDS.filter((court) => court.z_m < 0);
    const south = REICHSTAG_COURTYARDS.filter((court) => court.z_m > 0);
    expect(north).toHaveLength(3);
    expect(south).toHaveLength(3);
  });
});
