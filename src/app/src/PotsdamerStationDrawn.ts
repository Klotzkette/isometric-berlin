import {
  BoxGeometry, BufferGeometry, DoubleSide, EdgesGeometry, ExtrudeGeometry,
  Group, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry,
  Quaternion, Shape, Vector3,
} from "three";
import { createLetteringTexture } from "./drawnLettering";
import { POTSDAMER_DETAIL_PROFILE } from "./expandedCityProfiles";
import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import { addBox, createBuilder, finishDrawnGroup, paintGeometry, type Builder } from "./drawnKit";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { canReplacePotsdamerSouthStationPhoto } from "./potsdamerStationPhotoOwnership";
import { POTSDAMER_STATION_PHOTO_STRIP_RECEIPT as strip } from "./potsdamerStationPhotoOwnership";
import { potsdamerStationStripPhotoMembers } from "./potsdamerStationPhotoStrip";

type WorldRing = readonly (readonly [number, number])[];
const GLASS = 0xa7d1d8;
const DARK_FRAME = 0x29373a;

function addCustomGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  inked = true,
  lamp = false,
): void {
  if (!geometry.index) {
    const count = geometry.getAttribute("position").count;
    geometry.setIndex(Array.from({ length: count }, (_, index) => index));
  }
  paintGeometry(geometry, color);
  (lamp ? builder.lamps : builder.parts).push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function rotatedLocalOffset(
  localX: number,
  localZ: number,
  rotationY: number,
): [number, number] {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [localX * cosine + localZ * sine, -localX * sine + localZ * cosine];
}

function addLocalBox(
  builder: Builder,
  color: number,
  origin: Vector3,
  localX: number,
  centerY: number,
  localZ: number,
  width: number,
  height: number,
  depth: number,
  rotationY: number,
  inked = true,
): void {
  const [offsetX, offsetZ] = rotatedLocalOffset(localX, localZ, rotationY);
  addBox(
    builder,
    color,
    origin.x + offsetX,
    centerY,
    origin.z + offsetZ,
    width,
    height,
    depth,
    rotationY,
    inked,
  );
}

function polygonPrismGeometry(
  ring: WorldRing,
  bottomY: number,
  height: number,
): BufferGeometry {
  const shape = new Shape();
  ring.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: height,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bottomY, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function addPolygonPrism(
  builder: Builder,
  color: number,
  ring: WorldRing,
  bottomY: number,
  height: number,
  inked = true,
): void {
  if (ring.length < 3 || height <= 0) return;
  addCustomGeometry(
    builder,
    polygonPrismGeometry(ring, bottomY, height),
    color,
    inked,
  );
}

function addBeamBetween(
  builder: Builder,
  color: number,
  start: Vector3,
  end: Vector3,
  thickness: number,
  lamp = false,
): void {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length < 0.08) return;
  const geometry = new BoxGeometry(thickness, length, thickness);
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      direction.normalize(),
    ),
  );
  geometry.translate(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    (start.z + end.z) / 2,
  );
  addCustomGeometry(builder, geometry, color, false, lamp);
}

function createLetterSign(
  text: string,
  width: number,
  height: number,
  position: Vector3,
  rotationY: number,
  fieldColor: string,
  letterColor: string,
): Mesh | null {
  const texture = createLetteringTexture({
    bandHeightM: height,
    bandWidthM: width,
    capHeightM: height * 0.58,
    fieldColor,
    letterColor,
    text,
    texelsPerMetre: 180,
  });
  const material = texture
    ? new MeshStandardMaterial({
        map: texture,
        roughness: 0.68,
        side: DoubleSide,
      })
    : new MeshBasicMaterial({ color: fieldColor, side: DoubleSide });
  if (material instanceof MeshStandardMaterial) {
    material.userData.nightEmissive = 0xffdca0;
    material.userData.nightEmissiveIntensity = 0.55;
  }
  const sign = new Mesh(new PlaneGeometry(width, height), material);
  sign.name = `${text} rooftop lettering`;
  sign.userData.lettering = text;
  sign.userData.fallbackWithoutCanvas = texture === null;
  sign.position.copy(position);
  sign.rotation.y = rotationY;
  return sign;
}

function addPotsdamerEntranceHalls(
  builder: Builder,
  byName: Map<string, unknown>,
  selection: "all" | "north" | "south" = "all",
): void {
  if (!byName.has("Mall of Berlin")) return;
  const profile = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls;

  for (const hall of profile.halls) {
    if (selection !== "all" && hall.key !== selection) continue;
    const origin = new Vector3(
      hall.centerWorldM[0],
      hall.groundY,
      hall.centerWorldM[1],
    );
    const [width, depth] = hall.footprintSizeM;
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const topY = "sourceRoofYM" in hall
      ? hall.sourceRoofYM : hall.groundY + hall.officialHeightM;
    const displayedHeight = "sourceRoofYM" in hall
      ? topY - hall.groundY : hall.officialHeightM;
    const fasciaHeight = 0.82;
    const frameStroke = 0.34;
    const glazedHeight = displayedHeight - fasciaHeight - 0.34;
    const glazedCenterY = hall.groundY + glazedHeight / 2 + 0.17;
    const frontSide = hall.frontSide;
    const backSide = -frontSide;
    const recognition = profile.ownerPhotoRecognition;
    const photoGuided = hall.sourceBuildingId === recognition.sourceBuildingId;
    const steelTone = photoGuided ? recognition.steelTone : DARK_FRAME;
    // The drawn glass is opaque flat paint. Keep its outer face behind the
    // existing steel grid, so the source-bounded members remain visible.
    // The original north hall recipe stays byte-identical.
    const glassInset = photoGuided ? 0.21 : 0.09;

    // The source's south height includes its below-street wall section.
    // Use that original absolute roof Y, not street Y plus total source H.
    // The two halls keep their exact LoD2 plan. Their bodies
    // remain visibly hollow: three thin glass planes, an open entrance front
    // and a welded steel grid replace the former pair of tiny solid canopies.
    addPolygonPrism(
      builder,
      GLASS,
      hall.footprintRingWorldM,
      topY - 0.12,
      0.12,
      false,
    );
    addLocalBox(
      builder,
      GLASS,
      origin,
      0,
      glazedCenterY,
      backSide * (halfDepth - glassInset),
      width - frameStroke * 2,
      glazedHeight,
      0.12,
      hall.rotationY,
      false,
    );
    for (const side of [-1, 1]) {
      addLocalBox(
        builder,
        GLASS,
        origin,
        side * (halfWidth - glassInset),
        glazedCenterY,
        0,
        0.12,
        glazedHeight,
        depth - frameStroke * 2,
        hall.rotationY,
        false,
      );
    }

    // Perimeter frame and corner columns stay wholly inside the official
    // source footprint instead of adding another unmeasured outer shell.
    for (const side of [-1, 1]) {
      addLocalBox(
        builder,
        steelTone,
        origin,
        0,
        topY - fasciaHeight / 2,
        side * (halfDepth - frameStroke / 2),
        width,
        fasciaHeight,
        frameStroke,
        hall.rotationY,
      );
      addLocalBox(
        builder,
        steelTone,
        origin,
        side * (halfWidth - frameStroke / 2),
        topY - fasciaHeight / 2,
        0,
        frameStroke,
        fasciaHeight,
        depth,
        hall.rotationY,
      );
      for (const depthSide of [-1, 1]) {
        addLocalBox(
          builder,
          steelTone,
          origin,
          side * (halfWidth - frameStroke / 2),
          hall.groundY + displayedHeight / 2,
          depthSide * (halfDepth - frameStroke / 2),
          frameStroke,
          displayedHeight,
          frameStroke,
          hall.rotationY,
        );
      }
    }

    // Roof carrier grid: ten bays across and six in depth, matching the
    // repeated welded hollow-box rhythm visible in the architect/Commons
    // references while remaining explicitly presentation geometry.
    for (let bay = 1; bay < profile.roofBayCountAcross; bay += 1) {
      addLocalBox(
        builder,
        steelTone,
        origin,
        -halfWidth + (width * bay) / profile.roofBayCountAcross,
        topY - 0.18,
        0,
        0.16,
        0.26,
        depth - frameStroke * 2,
        hall.rotationY,
        false,
      );
    }
    for (let bay = 1; bay < profile.roofBayCountDepth; bay += 1) {
      addLocalBox(
        builder,
        steelTone,
        origin,
        0,
        topY - 0.18,
        -halfDepth + (depth * bay) / profile.roofBayCountDepth,
        width - frameStroke * 2,
        0.26,
        0.16,
        hall.rotationY,
        false,
      );
    }

    // Three rows of glass wall panels and slender mullions. The front stays
    // open; the side walls receive the characteristic diagonal steel braces.
    for (let row = 1; row < profile.wallPanelRows; row += 1) {
      const y = hall.groundY + (glazedHeight * row) / profile.wallPanelRows;
      addLocalBox(
        builder,
        steelTone,
        origin,
        0,
        y,
        backSide * (halfDepth - 0.14),
        width - frameStroke,
        0.13,
        0.16,
        hall.rotationY,
        false,
      );
      for (const side of [-1, 1]) {
        addLocalBox(
          builder,
          steelTone,
          origin,
          side * (halfWidth - 0.14),
          y,
          0,
          0.16,
          0.13,
          depth - frameStroke,
          hall.rotationY,
          false,
        );
      }
    }
    for (let bay = 1; bay < profile.roofBayCountAcross; bay += 1) {
      addLocalBox(
        builder,
        steelTone,
        origin,
        -halfWidth + (width * bay) / profile.roofBayCountAcross,
        glazedCenterY,
        backSide * (halfDepth - 0.14),
        0.13,
        glazedHeight,
        0.16,
        hall.rotationY,
        false,
      );
    }
    for (const side of [-1, 1]) {
      for (let bay = 1; bay < profile.roofBayCountDepth; bay += 1) {
        addLocalBox(
          builder,
          steelTone,
          origin,
          side * (halfWidth - 0.14),
          glazedCenterY,
          -halfDepth + (depth * bay) / profile.roofBayCountDepth,
          0.16,
          glazedHeight,
          0.13,
          hall.rotationY,
          false,
        );
      }
    }
    // The owner's street views show a continuous low charcoal sill below
    // the broad glazing. It belongs only to the photographed south hall;
    // the full entrance side and both existing stair approaches stay open.
    if (photoGuided) {
      addLocalBox(builder, steelTone, origin, 0,
        hall.groundY + recognition.baseHeightM / 2,
        backSide * (halfDepth - frameStroke / 2),
        width - frameStroke * 2, recognition.baseHeightM, frameStroke,
        hall.rotationY, false);
      for (const side of [-1, 1]) {
        addLocalBox(builder, steelTone, origin,
          side * (halfWidth - frameStroke / 2),
          hall.groundY + recognition.baseHeightM / 2, 0,
          frameStroke, recognition.baseHeightM, depth - frameStroke * 2,
          hall.rotationY, false);
      }
    }
    const localPoint = (localX: number, y: number, localZ: number): Vector3 => {
      const [offsetX, offsetZ] = rotatedLocalOffset(
        localX,
        localZ,
        hall.rotationY,
      );
      return new Vector3(origin.x + offsetX, y, origin.z + offsetZ);
    };
    for (const side of [-1, 1]) {
      for (let bay = 0; bay < profile.roofBayCountDepth; bay += 2) {
        const z0 = -halfDepth + (depth * bay) / profile.roofBayCountDepth;
        const z1 =
          -halfDepth +
          (depth * Math.min(profile.roofBayCountDepth, bay + 2)) /
            profile.roofBayCountDepth;
        // Correct the earlier floating brace ends at the photographed hall:
        // meet the existing sill/head and vertical grid stations directly.
        const braceZ0 = photoGuided
          ? z0 + (bay === 0 ? frameStroke / 2 : 0) : z0 + 0.2;
        const braceZ1 = photoGuided
          ? z1 - (bay + 2 >= profile.roofBayCountDepth ? frameStroke / 2 : 0)
          : z1 - 0.2;
        const braceX = side * (halfWidth - (photoGuided ? 0.14 : 0.17));
        const braceBottom = hall.groundY + 0.3;
        const braceTop = topY - fasciaHeight - (photoGuided ? 0.04 : 0.2);
        addBeamBetween(
          builder,
          steelTone,
          localPoint(braceX, braceBottom, braceZ0),
          localPoint(braceX, braceTop, braceZ1),
          0.12,
        );
        addBeamBetween(
          builder,
          steelTone,
          localPoint(braceX, braceTop, braceZ0),
          localPoint(braceX, braceBottom, braceZ1),
          0.12,
        );
      }
    }

    // Two stair/escalator banks descend from each hall's mapped entrance
    // edge. The below-grade run is diagrammatic and does not change the LoD2
    // footprint or claim an as-built underground survey.
    addLocalBox(
      builder,
      0x30383a,
      origin,
      0,
      hall.groundY + 0.035,
      frontSide * (halfDepth - 6.8),
      16.4,
      0.07,
      11.4,
      hall.rotationY,
      false,
    );
    for (const bankX of [-5.0, 5.0]) {
      for (let step = 0; step < 11; step += 1) {
        addLocalBox(
          builder,
          0xbdb9ae,
          origin,
          bankX,
          hall.groundY + 0.16 - step * 0.14,
          frontSide * (halfDepth - 1.8 - step * 0.84),
          4.4,
          0.16,
          0.88,
          hall.rotationY,
          false,
        );
      }
      for (const railSide of [-1, 1]) {
        addBeamBetween(
          builder,
          0x7c8587,
          localPoint(
            bankX + railSide * 2.05,
            hall.groundY + 1.05,
            frontSide * (halfDepth - 1.45),
          ),
          localPoint(
            bankX + railSide * 2.05,
            hall.groundY - 0.9,
            frontSide * (halfDepth - 10.7),
          ),
          0.11,
        );
      }
    }
  }
}

function addPotsdamerEntranceHallLettering(
  group: Group,
  byName: Map<string, unknown>,
  selection: "all" | "north" | "south" = "all",
): void {
  if (!byName.has("Mall of Berlin")) return;
  const profile = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls;
  for (const hall of profile.halls) {
    if (selection !== "all" && hall.key !== selection) continue;
    const [width, depth] = hall.footprintSizeM;
    const [offsetX, offsetZ] = rotatedLocalOffset(
      0,
      // The old plane sat 3 cm behind the opaque fascia. Keep it on the
      // source-bound outer face with only a millimetric anti-flicker offset.
      hall.frontSide * (depth / 2 + (
        hall.sourceBuildingId === profile.ownerPhotoRecognition.sourceBuildingId
          ? 0.012 : -0.03)),
      hall.rotationY,
    );
    const sign = createLetterSign(
      "BAHNHOF POTSDAMER PLATZ",
      width - 1.1,
      0.74,
      new Vector3(
        hall.centerWorldM[0] + offsetX,
        ("sourceRoofYM" in hall ? hall.sourceRoofYM : hall.groundY + hall.officialHeightM) - 0.43,
        hall.centerWorldM[1] + offsetZ,
      ),
      hall.rotationY + (hall.frontSide < 0 ? Math.PI : 0),
      hall.sourceBuildingId === profile.ownerPhotoRecognition.sourceBuildingId
        ? "#42474a" : "#4f5759",
      "#f1eee6",
    );
    if (!sign) continue;
    sign.name = `Potsdamer Platz ${hall.key} hall fascia lettering`;
    sign.userData.sourceBuildingId = hall.sourceBuildingId;
    group.add(sign);
    if (hall.sourceBuildingId !== profile.ownerPhotoRecognition.sourceBuildingId) continue;
    // The camera is southeast of the hall: the supplied views show the
    // south glass wall and its east return. Retain the old north entry sign.
    const side = profile.ownerPhotoRecognition.sideLetteringNormal;
    const [sideX, sideZ] = rotatedLocalOffset(side * (width / 2 + 0.012), 0, hall.rotationY);
    const sideSign = createLetterSign(profile.ownerPhotoRecognition.sideLettering,
      depth - 1.1, 0.74, new Vector3(hall.centerWorldM[0] + sideX,
        hall.sourceRoofYM - 0.43,
        hall.centerWorldM[1] + sideZ),
      hall.rotationY + side * Math.PI / 2, "#42474a", "#f1eee6");
    if (!sideSign) continue;
    sideSign.name = `Potsdamer Platz ${hall.key} hall east fascia lettering`;
    sideSign.userData.sourceBuildingId = hall.sourceBuildingId;
    group.add(sideSign);
    const [rearX, rearZ] = rotatedLocalOffset(0, -hall.frontSide * (depth / 2 + .012), hall.rotationY);
    const rearSign = createLetterSign(profile.ownerPhotoRecognition.sideLettering,
      width - 1.1, .74, new Vector3(hall.centerWorldM[0] + rearX,
        hall.sourceRoofYM - .43, hall.centerWorldM[1] + rearZ),
      hall.rotationY, "#42474a", "#f1eee6");
    if (!rearSign) continue;
    rearSign.name = `Potsdamer Platz ${hall.key} hall south fascia lettering`;
    rearSign.userData.sourceBuildingId = hall.sourceBuildingId;
    group.add(rearSign);
  }
}

/** Common factory keeps the complete existing north recipe byte-identical.
 * The south-only form is constructed by the required-site transaction before
 * its exact old generic glass envelope is allowed to yield. */
export function createPotsdamerStationDrawn(selection: "all" | "north" | "south" = "all"): Group {
  const root = new Group(); root.name = "Potsdamer Platz station entrance details";
  const byName = new Map<string, unknown>([["Mall of Berlin", {}]]);
  const builder = createBuilder();
  addPotsdamerEntranceHalls(builder, byName, selection);
  if (selection !== "north") {
    for (const member of potsdamerStationStripPhotoMembers()) {
      const color = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls.ownerPhotoRecognition.steelTone;
      if (member.a[1] === member.b[1]) {
        // Keep the horizontal profile upright: a generic 3D quaternion rolls
        // its square cross-section and would raise the measured roof datum.
        const dx = member.b[0] - member.a[0], dz = member.b[2] - member.a[2];
        addBox(builder, color, (member.a[0] + member.b[0]) / 2, member.a[1],
          (member.a[2] + member.b[2]) / 2, member.thickness, member.thickness,
          Math.hypot(dx, dz), Math.atan2(dx, dz), false);
      } else addBeamBetween(builder, color,
        new Vector3(...member.a), new Vector3(...member.b), member.thickness);
    }
  }
  const halls = finishDrawnGroup(builder, { name: "Potsdamer Platz station entrance halls" });
  if (halls) {
    halls.userData = POTSDAMER_DETAIL_PROFILE.stationEntranceHalls;
    root.add(halls);
  }
  addPotsdamerEntranceHallLettering(root, byName, selection);
  if (selection !== "north") {
    const geometry = polygonPrismGeometry(strip.fullSourceRingWorldM,
      strip.alignedRoofYM - .04, .04);
    geometry.deleteAttribute("uv");
    const day = new MeshBasicMaterial({ color: GLASS, opacity: .28,
      transparent: true, depthWrite: false, side: DoubleSide });
    const night = new MeshStandardMaterial({ color: GLASS, opacity: .28,
      transparent: true, depthWrite: false, side: DoubleSide, roughness: .35,
      flatShading: true });
    const glass = new Mesh(geometry, day);
    glass.name = "Complete OSM 464904393 roof-edge thin glass";
    glass.userData = { dayMaterial: day, nightMaterial: night, keepInMinecraft: false,
      sourceBuildingId: "OSM-way-464904393", geometryStatus: strip.heightStatus };
    root.add(glass);
  }
  return root;
}

export function createPotsdamerSouthStationPhotoDrawn(prisms: readonly unknown[] | undefined): Group | null {
  if (!canReplacePotsdamerSouthStationPhoto(prisms)) return null;
  const root = createPotsdamerStationDrawn("south");
  root.name = "Potsdamer Platz south station photo recognition";
  root.userData = { potsdamerStationPhoto: true, keepInMinecraft: false,
    fullStaticDetailOnTouch: true, sourceGeometryRetained: true,
    sourceBuildingId: "DEBE01YYK0000BRX", sourceBuildingIds: ["DEBE01YYK0000BRX", "OSM-way-464904393"],
    absoluteSourceRoofYM: 14.178, stripHeightStatus: strip.heightStatus };
  return freezeStaticSceneTransforms(root);
}
