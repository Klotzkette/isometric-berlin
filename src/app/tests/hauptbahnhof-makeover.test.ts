import { describe, expect, test } from "bun:test";
import {
  Box3,
  BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Raycaster,
  Vector3,
} from "three";

import {
  createArchitecturalSignature,
  HAUPTBAHNHOF_DB_PYLON_PROFILE,
  type HauptbahnhofModelSignature,
} from "../src/ArchitecturalLandmarks";

const signature: HauptbahnhofModelSignature = {
  anchor_world: [0, 0, 0],
  east_west_roof_length_m: 321,
  east_west_roof_width_m: 40,
  focus_camera: {
    azimuth_degrees: 52,
    distance_m: 370,
    polar_degrees: 42,
    target_height_m: 21,
  },
  geometry_status: "metric test",
  id: "hauptbahnhof-model",
  kind: "hauptbahnhof_model",
  landmark_name: "Berlin Hauptbahnhof",
  north_south_hall_length_m: 180,
  north_south_hall_width_m: 42,
  office_bridge_height_m: 46,
  rotation_y_degrees: 0,
  source_url: "https://www.deutschebahn.com/de/architektur_bahnhof-6878040",
};

function station(): Group {
  const result = createArchitecturalSignature(signature);
  if (!(result instanceof Group)) {
    throw new Error("the Hauptbahnhof signature must build");
  }
  return result;
}

function endTopY(mesh: Mesh, positiveX: boolean): number {
  const positions = mesh.geometry.getAttribute("position") as BufferAttribute;
  let top = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    if (Math.abs(x-(positiveX?9.5:-9.5)) < .00001) {
      top = Math.max(top, positions.getY(index));
    }
  }
  return top;
}

describe("Hauptbahnhof facade makeover", () => {
  test("gives the two office bridges mirrored raking crowns", () => {
    const bridges = station().children.filter(
      (child) => child.name === "Hauptbahnhof 46 m office bridge",
    ) as Mesh[];
    expect(bridges).toHaveLength(2);
    expect(endTopY(bridges[0], false)).toBeGreaterThan(
      endTopY(bridges[0], true) + 5,
    );
    expect(endTopY(bridges[1], true)).toBeGreaterThan(
      endTopY(bridges[1], false) + 5,
    );
  });

  test("puts the documented exposed steel order in front of the glass", () => {
    const root = station();
    const columns = root.getObjectByName(
      "Hauptbahnhof instanced office-bridge exoskeleton columns",
    );
    const beams = root.getObjectByName(
      "Hauptbahnhof instanced office-bridge longitudinal exoskeleton beams",
    );
    expect(columns).toBeInstanceOf(InstancedMesh);
    expect(beams).toBeInstanceOf(InstancedMesh);
    // Cuts may transfer a different number of whole instances into the
    // complement mesh. Verify original source sections, not that split count.
    expect((columns as InstancedMesh).count).toBeLessThanOrEqual(22);
    const complement=root.getObjectByName(`${columns!.name} railway-hall complements`) as Mesh;
    expect(complement.userData.hbfOfficeUnderpassV291).toBe(true);
    expect(complement.material).toBe((columns as InstancedMesh).material);
    const matrix=new Matrix4(),columnKeys=new Set<string>();
    (columns as InstancedMesh).geometry.computeBoundingBox();
    const columnSize=(columns as InstancedMesh).geometry.boundingBox!.getSize(new Vector3());
    for(let i=0;i<(columns as InstancedMesh).count;i++) {
      (columns as InstancedMesh).getMatrixAt(i,matrix);const e=matrix.elements;
      const localX=Math.abs(e[12]+44.5)<.001?-9.5:9.5,top=localX<0?46:40.4;
      expect(e[12]).toBeCloseTo(-35+localX,4);expect(e[13]).toBeCloseTo(top/2,4);
      expect(e[0]*columnSize.x).toBeCloseTo(1.02,5);expect(e[5]*columnSize.y).toBeCloseTo(top,4);expect(e[10]*columnSize.z).toBeCloseTo(1.02,5);
      const sourceIndex=Math.round((e[14]+90)/18);expect(sourceIndex).toBeGreaterThanOrEqual(0);expect(sourceIndex).toBeLessThanOrEqual(10);
      expect(e[14]).toBeCloseTo(-90+sourceIndex*18,4);
      const key=`${localX}/${sourceIndex}`;expect(columnKeys.has(key)).toBe(false);columnKeys.add(key);
    }
    const cp=complement.geometry.getAttribute("position");
    for(let i=0;i<cp.count;i++) {
      const x=cp.getX(i),y=cp.getY(i),z=cp.getZ(i),localX=Math.abs(x+44.5)<.511?-9.5:9.5;
      expect(Math.abs(x-(-35+localX))).toBeLessThanOrEqual(.5101);
      expect(y).toBeGreaterThanOrEqual(-.0001);expect(y).toBeLessThanOrEqual((localX<0?46:40.4)+.0001);
      expect(Array.from({length:11},(_,j)=>-90+j*18).some(centre=>Math.abs(z-centre)<=.5101)).toBe(true);
    }
    root.updateMatrixWorld(true);
    const ray=new Raycaster();ray.far=.08;
    // All original upper column sections survive above the new railway arch.
    for(const localX of[-9.5,9.5])for(let i=0;i<=10;i++) {
      const top=localX<0?46:40.4;
      ray.set(new Vector3(-35+localX,top+.02,-90+i*18),new Vector3(0,-1,0));
      expect(ray.intersectObjects([columns as InstancedMesh,complement]).length).toBeGreaterThan(0);
    }
    expect((beams as InstancedMesh).count).toBeLessThanOrEqual(10);
    const beamComplements=root.getObjectByName(`${beams!.name} railway-hall complements`) as Mesh;
    expect(beamComplements.userData.hbfOfficeUnderpassV291).toBe(true);
    expect(beamComplements.material).toBe((beams as InstancedMesh).material);
    (beams as InstancedMesh).geometry.computeBoundingBox();
    const beamSize=(beams as InstancedMesh).geometry.boundingBox!.getSize(new Vector3());
    for(let i=0;i<(beams as InstancedMesh).count;i++) {
      (beams as InstancedMesh).getMatrixAt(i,matrix);const e=matrix.elements;
      expect([-44.5,-25.5].some(x=>Math.abs(x-e[12])<.001)).toBe(true);
      expect([.8,11.4,22.7,34,39.2].some(y=>Math.abs(y-e[13])<.001)).toBe(true);
      expect(e[14]).toBe(0);expect(e[0]*beamSize.x).toBeCloseTo(1.02,5);expect(e[5]*beamSize.y).toBeCloseTo(.94,5);expect(e[10]*beamSize.z).toBeCloseTo(180.8,4);
    }
    const bp=beamComplements.geometry.getAttribute("position");
    for(let i=0;i<bp.count;i++) {
      expect([-44.5,-25.5].some(x=>Math.abs(x-bp.getX(i))<=.5101)).toBe(true);
      expect([.8,11.4,22.7,34,39.2].some(y=>Math.abs(y-bp.getY(i))<=.4701)).toBe(true);
      expect(Math.abs(bp.getZ(i))).toBeLessThanOrEqual(90.4001);
    }
    // Both outer ends of all ten original longitudinal beams stay intact.
    ray.far=.08;
    for(const localX of[-9.5,9.5])for(const y of[.8,11.4,22.7,34,39.2])for(const z of[-90,90]) {
      ray.set(new Vector3(-35+localX,y+.49,z),new Vector3(0,-1,0));
      expect(ray.intersectObjects([beams as InstancedMesh,beamComplements]).length).toBeGreaterThan(0);
    }
    expect(
      root.children.filter(
        (child) =>
          child.name === "Hauptbahnhof office-bridge raking crown beam",
      ),
    ).toHaveLength(4);
  });

  test("fills both entrance gables and projects both glass canopies", () => {
    const root = station();
    for (const name of [
      "Hauptbahnhof Europaplatz entrance facade",
      "Hauptbahnhof Washingtonplatz entrance facade",
    ]) {
      const facade = root.getObjectByName(name) as Mesh;
      const bounds = new Box3().setFromObject(facade);
      expect(bounds.max.y).toBeGreaterThan(26);
      expect(bounds.min.y).toBeCloseTo(0, 4);
    }
    const canopies = root.children.filter(
      (child) =>
        child.name === "Hauptbahnhof entrance cantilevered glass canopy",
    ) as Mesh[];
    expect(canopies).toHaveLength(2);
    for (const canopy of canopies) {
      expect(canopy.material).toBeInstanceOf(MeshPhysicalMaterial);
      expect((canopy.material as MeshPhysicalMaterial).transparent).toBe(true);
      const size = new Box3().setFromObject(canopy).getSize(new Vector3());
      expect(size.x).toBeGreaterThanOrEqual(55);
      expect(size.z).toBeGreaterThanOrEqual(17);
    }
  });

  test("adds station identity and the roof-integrated solar field", () => {
    const root = station();
    expect(
      root.children.filter(
        (child) => child.name === "Hauptbahnhof entrance wordmark",
      ),
    ).toHaveLength(2);
    expect(
      root.getObjectByName("Hauptbahnhof Washingtonplatz DB pylon"),
    ).toBeInstanceOf(Mesh);
    expect(
      root.children.filter(
        (child) => child.name === "Hauptbahnhof Washingtonplatz DB pylon",
      ),
    ).toHaveLength(HAUPTBAHNHOF_DB_PYLON_PROFILE.wallCount);
    const pylonBounds = new Box3().setFromObject(
      root.getObjectByName("Hauptbahnhof Washingtonplatz DB pylon")!,
    );
    expect(pylonBounds.max.y).toBeCloseTo(
      HAUPTBAHNHOF_DB_PYLON_PROFILE.heightM,
      4,
    );
    expect(
      root.children.filter(
        (child) => child.name === "Hauptbahnhof Washingtonplatz pylon DB badge",
      ),
    ).toHaveLength(HAUPTBAHNHOF_DB_PYLON_PROFILE.badgeCount);
    const pylonBadges = root.children.filter(
      (child) => child.name === "Hauptbahnhof Washingtonplatz pylon DB badge",
    ) as Mesh[];
    const pylonCentre = root.children
      .filter((child) => child.name === "Hauptbahnhof Washingtonplatz DB pylon")
      .reduce((sum, wall) => sum.add(wall.position), new Vector3())
      .multiplyScalar(1 / HAUPTBAHNHOF_DB_PYLON_PROFILE.wallCount);
    for (const badge of pylonBadges) {
      expect(badge.userData.lettering).toBe("DB");
      expect(badge.userData.letteringFieldColor).toBe("#fffdf8");
      expect(badge.userData.letteringInkColor).toBe("#d51f2a");
      expect(badge.userData.preserveInkAtNight).toBe(true);
      expect(badge.userData.logoRendering).toBe(
        "closed frame with filled geometric glyphs",
      );
      expect(badge.userData.nightMaterial).toBeInstanceOf(MeshBasicMaterial);
      expect(badge.userData.sourceUrl).toContain("deutschebahn.com");
      const outward = badge.position
        .clone()
        .sub(pylonCentre)
        .setY(0)
        .normalize();
      const faceNormal = new Vector3(0, 0, 1)
        .applyEuler(badge.rotation)
        .normalize();
      expect(faceNormal.dot(outward)).toBeGreaterThan(0.99);
    }
    const pylonBadgeFrames = root.children.filter(
      (child) => child.name === "Hauptbahnhof DB pylon badge red frame backing",
    ) as Mesh[];
    expect(pylonBadgeFrames).toHaveLength(
      HAUPTBAHNHOF_DB_PYLON_PROFILE.badgeCount,
    );
    for (const frame of pylonBadgeFrames) {
      frame.geometry.computeBoundingBox();
      const size = frame.geometry.boundingBox!.getSize(new Vector3());
      expect(size.x).toBeCloseTo(
        HAUPTBAHNHOF_DB_PYLON_PROFILE.badgeWidthM + 0.48,
        4,
      );
      expect(size.y).toBeCloseTo(
        HAUPTBAHNHOF_DB_PYLON_PROFILE.badgeHeightM + 0.48,
        4,
      );
      expect(frame.userData.logoRole).toBe("closed red DB frame");
    }
    expect(
      root.getObjectByName("Hauptbahnhof DB pylon perforated service plinth"),
    ).toBeInstanceOf(Mesh);
    const perforations = root.getObjectByName(
      "Hauptbahnhof instanced DB pylon perforations",
    );
    expect(perforations).toBeInstanceOf(InstancedMesh);
    expect((perforations as InstancedMesh).count).toBe(
      HAUPTBAHNHOF_DB_PYLON_PROFILE.perforationCount,
    );
    expect(
      root.getObjectByName("Hauptbahnhof DB pylon antenna crown"),
    ).toBeDefined();
    expect(root.userData.dbPylon).toEqual(HAUPTBAHNHOF_DB_PYLON_PROFILE);
    expect(HAUPTBAHNHOF_DB_PYLON_PROFILE.sourceUrl).toContain("sbp.de");
    expect(HAUPTBAHNHOF_DB_PYLON_PROFILE.logoSourceUrl).toContain(
      "deutschebahn.com",
    );
    expect(HAUPTBAHNHOF_DB_PYLON_PROFILE.frameFieldsPerWall).toBe(3);
    expect(
      root.children.filter(
        (child) =>
          child.name === "Hauptbahnhof office-bridge rooftop louver bank",
      ),
    ).toHaveLength(4);
    const photovoltaics = root.getObjectByName(
      "Hauptbahnhof instanced roof-integrated photovoltaic modules",
    );
    expect(photovoltaics).toBeInstanceOf(InstancedMesh);
    expect((photovoltaics as InstancedMesh).count).toBe(260);
    expect(photovoltaics!.userData.documentedModuleCount).toBe(780);
  });
});
