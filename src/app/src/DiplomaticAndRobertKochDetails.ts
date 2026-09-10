import { Group } from "three";

import { addBox, addCylinder, createBuilder, finishDrawnGroup } from "./drawnKit";

export const DIPLOMATIC_AND_ROBERT_KOCH_PROFILE = {
  name: "Diplomatic quarter and Robert-Koch-Platz recognition details",
  geometryStatus: "OSM-centred recognition overlays on the Berlin LoD2 shells",
  sites: {
    austria: { osmWayId: "24034597", centerWorldM: [-550.96, 1038.42] },
    india: { osmWayId: "24034639", centerWorldM: [-664.23, 1048.58] },
    japan: { osmWayId: "24045967", centerWorldM: [-949.75, 1053.91] },
    nordic: { osmWayIds: ["26746067", "26746068", "26746069", "26746070", "37428406"], centerWorldM: [-1449.65, 1068.09] },
    mexico: { osmRelationId: "18086221", centerWorldM: [-1403.77, 1166.38] },
    greenHeadquarters: { osmWayId: "54672713", centerWorldM: [565.85, -1091.96] },
    kaiserinFriedrichHaus: { osmRelationId: "15931988", centerWorldM: [446.48, -975.53] },
  },
  sources: [
    "https://www.berlin.de/sehenswuerdigkeiten/3561120-3558930-tiergartenviertel.html",
    "https://www.bmeia.gv.at/oeb-berlin/ueber-uns/das-botschaftsgebaeude",
    "https://www.openstreetmap.org/relation/18086221",
    "https://www.gruene.de/service/bundesgeschaeftsstelle",
    "https://www.openstreetmap.org/way/54672713",
    "https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/kaiserin-friedrich-haus-641067.php",
    "https://www.openstreetmap.org/relation/15931988",
  ],
} as const;

function facadeGrid(builder: ReturnType<typeof createBuilder>, x: number, z: number, width: number, floors: number, rotation = 0, color = 0x49636b): void {
  for (let floor = 0; floor < floors; floor += 1) {
    for (let bay = -Math.floor(width / 4); bay <= Math.floor(width / 4); bay += 1) {
      const along = bay * 3.5;
      const dx = Math.cos(rotation) * along;
      const dz = -Math.sin(rotation) * along;
      addBox(builder, color, x + dx, 7.1 + floor * 3.25, z + dz, 2.15, 1.75, 0.16, rotation, false);
    }
  }
}

export function createDiplomaticAndRobertKochDetails(detailProfile: "full" | "mobile" = "full"): Group {
  const b = createBuilder();
  const full = detailProfile === "full";

  // Austrian embassy: three unequal volumes and the copper-clad curved corner.
  addBox(b, 0xd4d0c5, -557, 10.5, 1038, 29, 12, 1.2, -0.18);
  addBox(b, 0xa94f3f, -543, 10.8, 1044, 18, 12.5, 1.2, -0.18);
  for (let i = -4; i <= 4; i += 1) addBox(b, 0x719181, -535 + i * 1.35, 11.2, 1032 + Math.abs(i) * 0.28, 1.0, 13.4, 0.7, -0.18, false);

  // Indian red-sandstone front and the cylindrical entrance cut-out.
  addBox(b, 0xa95642, -664, 11, 1048, 43, 14, 1.0, -0.08);
  for (let i = -5; i <= 5; i += 1) addBox(b, 0x3d3330, -664 + i * 3.4, 11, 1047.4, 1.15, 7.5, 0.25, -0.08, false);
  addCylinder(b, 0xd6b899, -664, 10.2, 1046.6, 4.2, 13, 20);
  addCylinder(b, 0x39454a, -664, 10.2, 1045.9, 2.25, 11.5, 20);

  // Japanese stone screen and narrow vertical cadence.
  addBox(b, 0xd8d3c8, -950, 10.5, 1054, 49, 13, 0.9, 0.04);
  for (let i = -10; i <= 10; i += 1) addBox(b, 0x9a968d, -950 + i * 2.15, 10.5, 1053.4, 0.26, 12.5, 0.2, 0.04, false);

  // Nordic embassies: the shared green-copper band across the five houses.
  for (let i = 0; i < (full ? 26 : 14); i += 1) {
    const a = -0.78 + (i / (full ? 25 : 13)) * 1.55;
    addBox(b, 0x6e9783, -1449.6 + Math.sin(a) * 55, 11.6, 1069 + Math.cos(a) * 8, 4.5, 12.5, 1.0, a, false);
  }

  // Mexican embassy: the defining vertical exposed-concrete fins.
  addBox(b, 0xc8c3b6, -1404, 10.8, 1166, 48, 13.5, 0.8, 0.05);
  for (let i = -12; i <= 12; i += 1) addBox(b, 0xddd8cc, -1404 + i * 1.75, 11, 1165.25, 0.42, 14.2, 1.5, 0.05);

  // Bündnis 90/Die Grünen: five-storey office front, green entrance band.
  facadeGrid(b, 565.8, -1092.2, 28, 5, -0.08, 0x526a70);
  addBox(b, 0x5a9f45, 563.2, 7.0, -1092.5, 8.5, 1.05, 0.35, -0.08);

  // Kaiserin-Friedrich-Haus: restored three-wing Wilhelminian front and portal.
  facadeGrid(b, 446.5, -976.0, 40, 3, -0.08, 0x567078);
  for (const x of [430, 446.5, 463]) addBox(b, 0xd5c8b2, x, 11.2, -976.6, 0.65, 12.5, 0.55, -0.08);
  addBox(b, 0x493f38, 471.5, 7.4, -976.0, 3.1, 4.5, 0.4, -0.08);

  const group = finishDrawnGroup(b, { name: DIPLOMATIC_AND_ROBERT_KOCH_PROFILE.name });
  if (!group) throw new Error("Diplomatic quarter detail group is empty");
  group.userData = { ...DIPLOMATIC_AND_ROBERT_KOCH_PROFILE, detailProfile, keepInMinecraft: false };
  return group;
}
