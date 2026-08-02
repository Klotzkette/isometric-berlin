import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, LineSegments, Mesh } from "three";
import {
  type BrandenburgGateModelSignature,
  type ChancelleryModelSignature,
  type HauptbahnhofModelSignature,
  type ReichstagModelSignature,
  createArchitecturalSignature,
  focusCameraForSignature,
  REICHSTAG_COURTYARDS,
  REICHSTAG_COURTYARD_DEPTH_M,
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
      gate!.children.filter((child) => child.name.includes("Doric capital")),
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
    expect(
      gate!.children.filter((child) => child.name.startsWith("Quadriga horse leg")),
    ).toHaveLength(16);
    expect(
      gate!.children.filter((child) => child.name.startsWith("Quadriga horse ear")),
    ).toHaveLength(8);
    expect(
      gate!.getObjectByName("Brandenburg Gate batched Doric column fluting"),
    ).toBeInstanceOf(LineSegments);
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
    expect(bounds.max.y).toBeCloseTo(46, 1);
    expect(
      station!.children.some((child) => child.name.includes("321 m east-west")),
    ).toBe(true);
    expect(
      station!.children.filter(
        (child) => child.name === "Hauptbahnhof 46 m office bridge",
      ),
    ).toHaveLength(2);
    expect(
      station!.children.filter(
        (child) => child.name === "Hauptbahnhof upper-level rail",
      ),
    ).toHaveLength(8);
    const trackDeck = station!.getObjectByName(
      "Hauptbahnhof east-west elevated track deck",
    );
    const trackDeckBounds = new Box3().setFromObject(trackDeck!);
    // 321 m shed plus a 110 m approach to the west only. The east approach
    // is gone: the Stadtbahn curves towards Friedrichstraße the moment it
    // leaves the shed, so a straight stub pointed at empty air over the
    // Humboldthafen. The OSM viaduct carries the tracks on from the gable.
    expect(trackDeckBounds.max.x - trackDeckBounds.min.x).toBeCloseTo(431, 1);
    const roofBounds = new Box3().setFromObject(
      station!.getObjectByName("Hauptbahnhof 321 m east-west glass roof")!,
    );
    expect(trackDeckBounds.max.x).toBeLessThanOrEqual(roofBounds.max.x + 1);
    expect(
      station!.children.filter(
        (child) => child.name === "Hauptbahnhof upper-level ballast bed",
      ),
    ).toHaveLength(4);
    const approachPiers = station!.getObjectByName(
      "Hauptbahnhof instanced approach-viaduct piers",
    );
    expect(approachPiers).toBeInstanceOf(InstancedMesh);
    expect((approachPiers as InstancedMesh).count).toBeGreaterThan(8);
    expect(
      station!.children.some((child) => child.name.includes("stationary ICE")),
    ).toBe(true);
    expect(
      station!.children.some((child) => child.name.includes("Berlin S-Bahn")),
    ).toBe(true);
    expect(
      station!.children.filter((child) => child.name.includes("glass panel seams")),
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
    const sleepers = station!.getObjectByName(
      "Hauptbahnhof instanced upper-level track sleepers",
    );
    expect(sleepers).toBeInstanceOf(InstancedMesh);
    expect((sleepers as InstancedMesh).count).toBeGreaterThan(600);
    expect(
      station!.children.filter((child) => child.name.includes("instanced wheels")),
    ).toHaveLength(2);
  });

  test("preserves the LoD2 Chancellery envelope and official heights", () => {
    const signature: ChancelleryModelSignature = {
      ...base,
      cube_depth_m: 56.376,
      cube_height_m: 36,
      cube_offset_world: [66.2, 0, -0.3],
      cube_width_m: 56.472,
      forecourt_offset_world: [88, 0, 68],
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
      66.2,
      0,
      -0.3,
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
    const chancelleryConcrete = chancellery!.getObjectByName(
      "Chancellery central concrete pylon",
    ) as Mesh;
    expect(chancelleryConcrete.material.userData.nightEmissive).toBe(
      0x55687b,
    );
    expect(
      chancelleryConcrete.material.userData.nightEmissiveIntensity,
    ).toBe(0.32);
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
      reichstag!.children.filter((child) => child.name.includes("facade windows")),
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
    expect(towerWindows.reduce((sum, windows) => sum + windows.count, 0)).toBe(24);
    expect(towerWindows[0].material.userData.nightEmissive).toBeUndefined();
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
    expect(bandWidth).toBeGreaterThan(dedicationLayout().totalWidthM);
    expect(
      reichstag.getObjectByName(
        "Reichstag DEM DEUTSCHEN VOLKE inscription band",
      ),
    ).toBeInstanceOf(Mesh);
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
