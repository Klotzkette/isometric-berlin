import { staticModelDetailProfile } from "./staticModelDetail";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from "three";

import { createLetteringTexture } from "./drawnLettering";
import {
  type Builder,
  addBox,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";

import czechSource from "./czechEmbassyFacadeSource.json";

type DetailProfile = "full" | "mobile";
type WorldPoint2 = readonly [number, number];

export type SourceFacadeRun = Readonly<{
  endWorldM: WorldPoint2;
  groundYM: number;
  measuredHeightM: number;
  sourcePartId: string;
  startWorldM: WorldPoint2;
}>;

type RecognitionBuilding = Readonly<{
  centerWorldM: WorldPoint2;
  name: string;
  parentId: string;
  runs: readonly SourceFacadeRun[];
  style: "brutalist" | "retail" | "slab";
}>;

export const WILHELM_STRESEMANN_DETAILS_GROUP_NAME =
  "Wilhelmstrasse and Stresemannstrasse source-bounded details";

/**
 * Exact source identities and exterior LoD2 edges for the requested southern
 * centre recognition layer. The base city keeps every complete source shell;
 * these shallow overlays only restore characteristic facade rhythm.
 */
export const WILHELM_STRESEMANN_DETAIL_PROFILE = {
  coordinateFrame:
    "EPSG:25833; world_x=easting-389500; world_z=5820000-northing",
  geometryStatus:
    "exact LoD2 exterior-edge overlays plus one exact OSM tennis footprint; no replacement building volumes",
  maxOverlayDepthM: 0.32,
  buildings: [
    {
      centerWorldM: [590.06, 557.12],
      name: "DDR apartment slab behind the Holocaust Memorial",
      parentId: "DEBE01AL1H500002",
      style: "slab",
      runs: [
        {
          endWorldM: [593.6, 550.8],
          groundYM: 4.6,
          measuredHeightM: 30.292,
          sourcePartId: "p5FAcMO3",
          startWorldM: [579.937, 554.903],
        },
        {
          endWorldM: [584.594, 531.569],
          groundYM: 4.6,
          measuredHeightM: 30.294,
          sourcePartId: "vvI1GdNi",
          startWorldM: [573.929, 534.748],
        },
        {
          endWorldM: [602.194, 562.584],
          groundYM: 4.6,
          measuredHeightM: 30.8,
          sourcePartId: "B2Vth5Jo",
          startWorldM: [592.267, 529.281],
        },
      ],
    },
    {
      centerWorldM: [575.17, 507.2],
      name: "DDR apartment slab at the former Fuehrerbunker site",
      parentId: "DEBE01AL1H500005",
      style: "slab",
      runs: [
        {
          endWorldM: [581.6, 510.5],
          groundYM: 4.7,
          measuredHeightM: 31.261,
          sourcePartId: "ax5YgxRI",
          startWorldM: [573.8, 484.4],
        },
        {
          endWorldM: [567.9, 514.6],
          groundYM: 4.6,
          measuredHeightM: 31.216,
          sourcePartId: "FaCSYflp",
          startWorldM: [573.929, 534.748],
        },
        {
          endWorldM: [594.739, 528.544],
          groundYM: 4.6,
          measuredHeightM: 11.251,
          sourcePartId: "bYXvpXur",
          startWorldM: [584.806, 495.241],
        },
      ],
    },
    {
      centerWorldM: [654.18, 759.74],
      name: "Wilhelmstrasse slab beside the former Fuehrerbunker",
      parentId: "DEBE01YYK00005zY",
      style: "slab",
      runs: [
        {
          endWorldM: [644.707, 749.217],
          groundYM: 5.2,
          measuredHeightM: 25.878,
          sourcePartId: "PWxW8URU",
          startWorldM: [632.247, 750.285],
        },
        {
          endWorldM: [636.271, 769.736],
          groundYM: 5.2,
          measuredHeightM: 25.878,
          sourcePartId: "PWxW8URU",
          startWorldM: [650.921, 768.595],
        },
        {
          endWorldM: [674.922, 751.596],
          groundYM: 5.2,
          measuredHeightM: 23.061,
          sourcePartId: "LOqXC8Ah",
          startWorldM: [655.654, 753.089],
        },
        {
          endWorldM: [652.026, 767.286],
          groundYM: 5.2,
          measuredHeightM: 23.061,
          sourcePartId: "LOqXC8Ah",
          startWorldM: [680.917, 765.026],
        },
      ],
    },
    {
      centerWorldM: [844.99, 868.37],
      name: "Czech Embassy",
      parentId: "DEBE01YYK00001Te",
      style: "brutalist",
      runs: [
        {
          endWorldM: [852.389, 840.146],
          groundYM: 5.2,
          measuredHeightM: 23.216,
          sourcePartId: "EMaPXpuq",
          startWorldM: [816.195, 850.935],
        },
        {
          endWorldM: [848.836, 854.346],
          groundYM: 5.2,
          measuredHeightM: 13.348,
          sourcePartId: "0P8jVotB",
          startWorldM: [829.409, 860.278],
        },
        {
          endWorldM: [871.331, 870.071],
          groundYM: 5.2,
          measuredHeightM: 23.284,
          sourcePartId: "5AO8artw",
          startWorldM: [866.653, 854.549],
        },
      ],
    },
    {
      centerWorldM: [825.51, 807.08],
      name: "HIT Ullrich Wilhelmstrasse",
      parentId: "DEBE01YYK000028X",
      style: "retail",
      runs: [
        {
          endWorldM: [819.239, 819.523],
          groundYM: 5.2,
          measuredHeightM: 8.375,
          sourcePartId: "K000028X",
          startWorldM: [837.379, 814.188],
        },
      ],
    },
  ] satisfies readonly RecognitionBuilding[],
  hit: {
    officialAddress: "Anton-Wilhelm-Amo-Strasse 69, 10117 Berlin",
    osmNodeId: "1588155369",
    worldM: [827.971, 811.243] as const,
  },
  tennisCourt: {
    elevationStatus: "display elevation sampled from the local public realm",
    osmWayId: "323827330",
    surface: "rubber",
    topYM: 5.24,
    worldRingM: [
      [541.574, 675.186],
      [543.401, 698.751],
      [554.235, 697.914],
      [552.415, 674.35],
    ] as const,
  },
  performance: {
    drawnRenderableBudget: 5,
    mobileFacadeStride: 2,
    textureCountBudget: 1,
  },
  sourceUrls: [
    "https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin",
    "https://www.openstreetmap.org/way/323827330",
    "https://www.hit.de/maerkte/berlin-mitte",
    "https://mzv.gov.cz/berlin/en/index.html",
  ],
} as const;

type RunFrame = {
  axis: WorldPoint2;
  lengthM: number;
  midpoint: WorldPoint2;
  outward: WorldPoint2;
  rotationY: number;
};

function runFrame(run: SourceFacadeRun, buildingCenter: WorldPoint2): RunFrame {
  const dx = run.endWorldM[0] - run.startWorldM[0];
  const dz = run.endWorldM[1] - run.startWorldM[1];
  const lengthM = Math.hypot(dx, dz);
  const axis: WorldPoint2 = [dx / lengthM, dz / lengthM];
  const midpoint: WorldPoint2 = [
    (run.startWorldM[0] + run.endWorldM[0]) / 2,
    (run.startWorldM[1] + run.endWorldM[1]) / 2,
  ];
  let outward: WorldPoint2 = [axis[1], -axis[0]];
  const towardCenter: WorldPoint2 = [
    buildingCenter[0] - midpoint[0],
    buildingCenter[1] - midpoint[1],
  ];
  if (outward[0] * towardCenter[0] + outward[1] * towardCenter[1] > 0) {
    outward = [-outward[0], -outward[1]];
  }
  return {
    axis,
    lengthM,
    midpoint,
    outward,
    rotationY: -Math.atan2(dz, dx),
  };
}

function addRunBox(
  builder: Builder,
  run: SourceFacadeRun,
  center: WorldPoint2,
  color: number,
  alongM: number,
  centerY: number,
  outwardM: number,
  widthM: number,
  heightM: number,
  depthM: number,
  inked = false,
): void {
  const frame = runFrame(run, center);
  addBox(
    builder,
    color,
    frame.midpoint[0] + frame.axis[0] * alongM + frame.outward[0] * outwardM,
    centerY,
    frame.midpoint[1] + frame.axis[1] * alongM + frame.outward[1] * outwardM,
    widthM,
    heightM,
    depthM,
    frame.rotationY,
    inked,
  );
}

function addSlabFacade(
  builder: Builder,
  building: RecognitionBuilding,
  run: SourceFacadeRun,
  detailProfile: DetailProfile,
): void {
  const frame = runFrame(run, building.centerWorldM);
  const floorPitch = 3.05;
  const floors = Math.max(
    2,
    Math.floor((run.measuredHeightM - 1.1) / floorPitch),
  );
  const stride = detailProfile === "mobile" ? 2 : 1;
  for (let floor = 1; floor < floors; floor += stride) {
    const y = run.groundYM + 0.65 + floor * floorPitch;
    addRunBox(
      builder,
      run,
      building.centerWorldM,
      floor % 2 === 0 ? 0xc6c1b5 : 0xaaa99f,
      0,
      y,
      0.2,
      frame.lengthM,
      0.3,
      0.28,
    );
    addRunBox(
      builder,
      run,
      building.centerWorldM,
      0x52666a,
      0,
      y + 0.44,
      0.31,
      frame.lengthM - 0.35,
      0.12,
      0.1,
    );
  }
  const bayPitch = detailProfile === "mobile" ? 7.2 : 4.4;
  const bays = Math.max(2, Math.floor(frame.lengthM / bayPitch));
  for (let bay = 1; bay < bays; bay += 1) {
    addRunBox(
      builder,
      run,
      building.centerWorldM,
      bay % 3 === 0 ? 0x676b68 : 0xd7d1c3,
      -frame.lengthM / 2 + (frame.lengthM * bay) / bays,
      run.groundYM + run.measuredHeightM / 2,
      0.24,
      0.16,
      run.measuredHeightM - 1.4,
      0.18,
    );
  }
}

/** Ribbon glazing and folded granite aprons follow all retained exterior runs. */
function addCzechEmbassyFacades(builder: Builder, minecraft = false): void {
  const center = [844.99, 868.37] as const;
  const coreIds = new Set(["gFIHTCRe", "H5JWrRQf"]);
  for (const part of czechSource.parts) for (const [start, end] of part.exterior_runs) {
    const run: SourceFacadeRun = { startWorldM: start as [number, number], endWorldM: end as [number, number],
      groundYM: 5.2, measuredHeightM: part.height_m, sourcePartId: part.short_id };
    const frame = runFrame(run, center), length = frame.lengthM;
    const box = (color: number, along: number, y: number, out: number, w: number, h: number, d: number): void =>
      addRunBox(builder, run, center, color, along, y + 5.2, out, w, h, d, false);
    const granite = 0xbdb7a7, bronzeGlass = 0x746c54, metal = 0x494b44;
    if (coreIds.has(part.short_id)) {
      box(0x635b4e, 0, part.height_m / 2, .12, length, part.height_m, .15);
      const ribs = Math.max(2, Math.floor(length / .58));
      for (let i=0;i<ribs;i++) box(i%3 ? 0x81725c : 0x6b6151,
        (i+.5)*length/ribs-length/2, part.height_m/2, .22, .045, part.height_m-.2, .08);
      if (length > 6) for(let level=0;level<6;level++)
        box(level%2 ? 0x83b6ab : 0x9ac4b4, -length*.35, 3+level*3.7, .27, .54, 2.7, .06);
      continue;
    }
    // Flat undercroft, lower glazed reception rooms and the upper office ribbons.
    box(0x656052, 0, 1.6, .1, length, 3.2, .12);
    box(0x7e6652, 0, 4.85, .16, length, 3.3, .18);
    const bays=Math.max(1,Math.round(length/2.6)), pitch=length/bays;
    for(let bay=1;bay<bays;bay++) box(metal,bay*pitch-length/2,4.85,.28,.09,3.3,.13);
    const apron=(bottom: number, top: number, color: number):void => {
      if(minecraft) { for(let step=0;step<4;step++) box(color,0,bottom+(top-bottom)*(step+.5)/4,
        .06+.23*(step+.5)/4,length,(top-bottom)/4,.14); return; }
      const point=(along:number,y:number,out:number):number[] => [frame.midpoint[0]+frame.axis[0]*along+frame.outward[0]*out,
        y+5.2,frame.midpoint[1]+frame.axis[1]*along+frame.outward[1]*out];
      const a=point(-length/2,bottom,.06), b=point(length/2,bottom,.06),
        c=point(length/2,top,.31), d=point(-length/2,top,.31);
      const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute([...a,...b,...c,...a,...c,...d,...c,...b,...a,...d,...c,...a],3));
      g.setIndex(Array.from({length:12},(_,i)=>i));paintGeometry(g,color);builder.parts.push(g);
      // Stone slab joints belong to the folds, not a full-height office grid.
      for(let i=1;i<Math.ceil(length/1.2);i++) {
        const along=i*length/Math.ceil(length/1.2)-length/2;
        box(0x918875,along,(bottom+top)/2,.25,.027,top-bottom,.04);
      }
    };
    apron(1.2,3.2,granite); apron(6.5,7.7,0xada797);
    box(0x484b42,0,8.1,.14,length,.8,.16);
    const upperTop=Math.min(23.18,part.height_m), first=9.1;
    for(let base=first;base<upperTop-1.2;base+=3.45) {
      const top=Math.min(base+3.45,upperTop);
      apron(base,Math.min(base+1.42,top),granite);
      const glassBottom=base+1.42, glassTop=top-.12;
      if(glassTop<=glassBottom)continue;
      box(bronzeGlass,0,(glassBottom+glassTop)/2,.18,length,glassTop-glassBottom,.12);
      box(0x4c5049,0,glassBottom,.29,length,.09,.08);
      box(0xc5bba1,0,glassTop,.28,length,.09,.08);
      for(let bay=1;bay<bays;bay++) box(metal,bay*pitch-length/2,(glassBottom+glassTop)/2,.28,.075,glassTop-glassBottom,.1);
      // A restrained warm reflection on individual panes keeps bronze glazing legible.
      for(let bay=0;bay<bays;bay++) if(bay%3===1)
        box(0x958c69,(bay+.5)*pitch-length/2,(glassBottom+glassTop)/2,.25,pitch-.16,glassTop-glassBottom-.16,.025);
    }
    box(granite,0,upperTop-.1,.12,length,.2,.28);
  }
}

function addRetailFacade(
  builder: Builder,
  building: RecognitionBuilding,
  run: SourceFacadeRun,
  detailProfile: DetailProfile,
): void {
  const frame = runFrame(run, building.centerWorldM);
  addRunBox(
    builder,
    run,
    building.centerWorldM,
    0x436066,
    0,
    run.groundYM + 2.35,
    0.2,
    frame.lengthM - 0.5,
    4.3,
    0.12,
  );
  const bays = detailProfile === "mobile" ? 4 : 7;
  for (let bay = 1; bay < bays; bay += 1) {
    addRunBox(
      builder,
      run,
      building.centerWorldM,
      0xc9d0ca,
      -frame.lengthM / 2 + (frame.lengthM * bay) / bays,
      run.groundYM + 2.3,
      0.31,
      0.12,
      4.4,
      0.18,
    );
  }
  // Existing low store envelope: shallow parapet, transom and paired glazed entry.
  addRunBox(builder,run,building.centerWorldM,0xc4b9a2,0,run.groundYM+7.45,.2,frame.lengthM,1.45,.2);
  addRunBox(builder,run,building.centerWorldM,0x4e625d,0,run.groundYM+6.42,.24,frame.lengthM-.4,.63,.1);
  for(let bay=1;bay<7;bay++) addRunBox(builder,run,building.centerWorldM,0xd6c9ae,
    -frame.lengthM/2+frame.lengthM*bay/7,run.groundYM+6.42,.3,.1,.65,.1);
  for(const side of[-1,1]) {
    const along=frame.lengthM*.23+side*.67;
    addRunBox(builder,run,building.centerWorldM,0x748680,along,run.groundYM+2.04,.51,1.24,3.7,.06);
    addRunBox(builder,run,building.centerWorldM,0xd7d4c3,along-side*.45,run.groundYM+1.8,.57,.04,.6,.04);
  }
  addRunBox(builder,run,building.centerWorldM,0xbdb8a8,frame.lengthM*.23,run.groundYM+.06,.42,3.05,.12,.45);
  addRunBox(
    builder,
    run,
    building.centerWorldM,
    0xc52b2f,
    0,
    run.groundYM + 5.15,
    0.32,
    frame.lengthM,
    1.05,
    0.28,
    true,
  );
  addRunBox(
    builder,
    run,
    building.centerWorldM,
    0x252c2c,
    frame.lengthM * 0.23,
    run.groundYM + 2.1,
    0.34,
    2.8,
    4.05,
    0.3,
    true,
  );
}

function addBuildingDetails(
  builder: Builder,
  building: RecognitionBuilding,
  detailProfile: DetailProfile,
): void {
  for (const run of building.runs) {
    if (building.style === "slab") {
      addSlabFacade(builder, building, run, detailProfile);
    } else if (building.style === "brutalist") {
      continue; // The complete source-perimeter pass below replaces the old three-run grid.
    } else {
      addRetailFacade(builder, building, run, detailProfile);
    }
  }
}

function createHitLettering(): Mesh {
  const building = WILHELM_STRESEMANN_DETAIL_PROFILE.buildings.find(
    ({ style }) => style === "retail",
  )!;
  const run = building.runs[0];
  const frame = runFrame(run, building.centerWorldM);
  const texture = createLetteringTexture({
    bandHeightM: 0.82,
    bandWidthM: 8.6,
    capHeightM: 0.58,
    fieldColor: "#c52b2f",
    letterColor: "#fff8df",
    text: "HIT ULLRICH",
    texelsPerMetre: 150,
  });
  const material = texture
    ? new MeshStandardMaterial({
        map: texture,
        roughness: 0.76,
        side: DoubleSide,
      })
    : new MeshBasicMaterial({ color: 0xfff2d2, side: DoubleSide });
  const sign = new Mesh(new PlaneGeometry(8.6, 0.82), material);
  sign.name = "HIT Ullrich exact-facade lettering";
  sign.position.set(
    frame.midpoint[0] + frame.outward[0] * 0.49,
    run.groundYM + 5.15,
    frame.midpoint[1] + frame.outward[1] * 0.49,
  );
  sign.rotation.y = frame.rotationY;
  sign.userData.fallbackWithoutCanvas = texture === null;
  sign.userData.sourcePartId = run.sourcePartId;
  return sign;
}

function courtPoint(across: number, along: number): Vector3 {
  const ring = WILHELM_STRESEMANN_DETAIL_PROFILE.tennisCourt.worldRingM;
  const nearLeft = ring[0];
  const farLeft = ring[1];
  const farRight = ring[2];
  const nearRight = ring[3];
  const leftX = nearLeft[0] + (farLeft[0] - nearLeft[0]) * along;
  const leftZ = nearLeft[1] + (farLeft[1] - nearLeft[1]) * along;
  const rightX = nearRight[0] + (farRight[0] - nearRight[0]) * along;
  const rightZ = nearRight[1] + (farRight[1] - nearRight[1]) * along;
  return new Vector3(
    leftX + (rightX - leftX) * across,
    WILHELM_STRESEMANN_DETAIL_PROFILE.tennisCourt.topYM,
    leftZ + (rightZ - leftZ) * across,
  );
}

function createTennisCourt(): Group {
  const group = new Group();
  group.name = "Former Fuehrerbunker exact OSM tennis court";
  const ring = WILHELM_STRESEMANN_DETAIL_PROFILE.tennisCourt.worldRingM;
  const y = WILHELM_STRESEMANN_DETAIL_PROFILE.tennisCourt.topYM;
  const surface = new BufferGeometry();
  surface.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        ring[0][0],
        y,
        ring[0][1],
        ring[1][0],
        y,
        ring[1][1],
        ring[2][0],
        y,
        ring[2][1],
        ring[0][0],
        y,
        ring[0][1],
        ring[2][0],
        y,
        ring[2][1],
        ring[3][0],
        y,
        ring[3][1],
      ],
      3,
    ),
  );
  const day = new MeshBasicMaterial({ color: 0x9d5e50, side: DoubleSide });
  const night = new MeshStandardMaterial({
    color: 0x6e4c48,
    roughness: 0.96,
    side: DoubleSide,
  });
  const court = new Mesh(surface, day);
  court.name = "Tennis court exact rubber surface";
  court.userData.dayMaterial = day;
  court.userData.nightMaterial = night;
  court.userData.sourceOsmWayId =
    WILHELM_STRESEMANN_DETAIL_PROFILE.tennisCourt.osmWayId;
  court.userData.textureFree = true;
  group.add(court);

  const positions: number[] = [];
  const addLine = (a: Vector3, b: Vector3): void => {
    positions.push(a.x, a.y + 0.025, a.z, b.x, b.y + 0.025, b.z);
  };
  for (let edge = 0; edge < ring.length; edge += 1) {
    const next = (edge + 1) % ring.length;
    addLine(
      new Vector3(ring[edge][0], y, ring[edge][1]),
      new Vector3(ring[next][0], y, ring[next][1]),
    );
  }
  addLine(courtPoint(0, 0.5), courtPoint(1, 0.5));
  for (const along of [0.25, 0.75]) {
    addLine(courtPoint(0.12, along), courtPoint(0.88, along));
  }
  addLine(courtPoint(0.5, 0.25), courtPoint(0.5, 0.75));
  const markingsGeometry = new BufferGeometry();
  markingsGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  const markingDay = new LineBasicMaterial({ color: 0xf1eee4 });
  const markingNight = new LineBasicMaterial({ color: 0xc9d1ce });
  const markings = new LineSegments(markingsGeometry, markingDay);
  markings.name = "Tennis court exact boundary and playing lines";
  markings.userData.dayMaterial = markingDay;
  markings.userData.nightMaterial = markingNight;
  markings.userData.textureFree = true;
  group.add(markings);
  group.userData = WILHELM_STRESEMANN_DETAIL_PROFILE.tennisCourt;
  return group;
}

function addTennisNet(builder: Builder): void {
  const left = courtPoint(0, 0.5);
  const right = courtPoint(1, 0.5);
  const dx = right.x - left.x;
  const dz = right.z - left.z;
  const length = Math.hypot(dx, dz);
  const rotationY = -Math.atan2(dz, dx);
  const centerX = (left.x + right.x) / 2;
  const centerZ = (left.z + right.z) / 2;
  const groundY = WILHELM_STRESEMANN_DETAIL_PROFILE.tennisCourt.topYM;
  addBox(
    builder,
    0x454a48,
    centerX,
    groundY + 0.48,
    centerZ,
    length,
    0.76,
    0.035,
    rotationY,
    false,
  );
  for (const point of [left, right]) {
    addBox(
      builder,
      0xd6d2c8,
      point.x,
      groundY + 0.58,
      point.z,
      0.1,
      1.16,
      0.1,
      rotationY,
      false,
    );
  }
}

export function createWilhelmStresemannDetails(
  detailProfile: DetailProfile = "full",
): Group {
  detailProfile = staticModelDetailProfile(detailProfile);
  const group = new Group();
  group.name = WILHELM_STRESEMANN_DETAILS_GROUP_NAME;
  group.userData = {
    ...WILHELM_STRESEMANN_DETAIL_PROFILE,
    collisionRole:
      "visual thin overlays only; complete LoD2 shells own collision",
    detailFadeM: [950, 1350],
    detailProfile,
    keepInMinecraft: false,
  };
  const builder = createBuilder();
  for (const building of WILHELM_STRESEMANN_DETAIL_PROFILE.buildings) {
    addBuildingDetails(builder, building, detailProfile);
  }
  addCzechEmbassyFacades(builder);
  addTennisNet(builder);
  const facades = finishDrawnGroup(builder, {
    name: "Wilhelmstrasse Stresemannstrasse recognition facades",
  });
  if (facades) group.add(facades);
  group.add(createHitLettering());
  group.add(createTennisCourt());
  group.userData.renderableBudget =
    WILHELM_STRESEMANN_DETAIL_PROFILE.performance.drawnRenderableBudget;
  group.userData.textureCountBudget =
    WILHELM_STRESEMANN_DETAIL_PROFILE.performance.textureCountBudget;
  group.userData.palette = {
    concrete: new Color(0xb89a71).getHex(),
    glass: new Color(0x556d70).getHex(),
    rubber: new Color(0x9d5e50).getHex(),
  };
  return group;
}

/** Source bodies stay native Minecraft; these bounded facade-only cubes add recognition. */
export function createMinecraftWilhelmStresemannDetails(): Group {
  const builder=createBuilder();addCzechEmbassyFacades(builder,true);
  const retail=WILHELM_STRESEMANN_DETAIL_PROFILE.buildings.find(b=>b.style === "retail")!;
  addRetailFacade(builder,retail,retail.runs[0],"full");
  // Coarse native red fascia is legible without a texture or smooth sign double.
  const group=finishDrawnGroup(builder,{name:"Block-native Czech Embassy and HIT Ullrich facades"})!;
  group.userData={...group.userData,keepInMinecraft:true,nativeMinecraft:true,blockNative:true,textureFree:true,
    sourceParentIds:[czechSource.parent_id,retail.parentId],sourcePartIds:czechSource.parts.map(p=>p.short_id),
    geometryRole:"facade-only cubes; every original source body remains"};
  return group;
}
