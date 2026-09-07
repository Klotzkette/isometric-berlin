import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Vector3,
} from "three";

import {
  HUGO_PREUSS_OSM_DECK,
  HUMBOLDTHAFEN_NORTH_CREST_M,
  HUMBOLDTHAFEN_ROAD_AXES,
  HUMBOLDTHAFEN_SOURCES,
  SANDKRUG_OSM_DECK,
  SANDKRUG_STRUCTURE_PROFILE,
  isNorthernHumboldthafenReplacementCell,
  northernHumboldthafenCrestZAt,
  northernHumboldthafenWaterZAt,
} from "./HumboldthafenSources";
import {
  REAL_SPREE_VESSEL_PROFILES,
  REEDEREI_RIEDEL_FLEET_SOURCE,
} from "./SpreeVesselProfiles";
import {
  ECONOMIC_MINISTRY_MINECRAFT_FACADES,
  ECONOMIC_MINISTRY_PROFILE,
} from "./EconomicMinistryDetails";

type HumboldthafenVoxelPayload = {
  classes?: string[];
  ground_rows?: number[][][];
  cell_m: number;
  grid: { cols: number; min_x_idx: number; min_z_idx: number; rows: number };
  ground_height: {
    cols: number;
    rows: number;
    stride_cells: number;
    y_dm: number[];
  };
  water_top_y_m: number;
};

type Block = {
  color: number;
  position: [number, number, number];
  rotationY?: number;
  size: [number, number, number];
  sourceRole:
    | "bank"
    | "bridge-rail"
    | "bridge-frame"
    | "bridge-deck"
    | "bridge-lamp"
    | "building-detail"
    | "path"
    | "vessel";
};

const BANK_STONE = [0xa8a18c, 0xb9b19a] as const;
const IRON = 0x475157;
const PATH = 0xc8bea8;
const WHITE = 0xece9dd;
const WINDOW = 0x315c6a;
const BOOT = 0x30383e;
const MINISTRY_STONE = 0xe4e5dc;
const MINISTRY_HISTORIC_STONE = 0xece3d2;
const MINISTRY_GLASS = 0x496b72;

function worldGroundSampler(payload: HumboldthafenVoxelPayload) {
  const { cell_m: cell, grid, ground_height: heights } = payload;
  return (x: number, z: number): number | null => {
    const xOffset = x / cell - grid.min_x_idx;
    const zOffset = z / cell - grid.min_z_idx;
    if (
      xOffset < 0 ||
      zOffset < 0 ||
      xOffset >= grid.cols ||
      zOffset >= grid.rows
    ) {
      return null;
    }
    const col = Math.min(
      heights.cols - 1,
      Math.floor(xOffset / heights.stride_cells),
    );
    const row = Math.min(
      heights.rows - 1,
      Math.floor(zOffset / heights.stride_cells),
    );
    return (heights.y_dm[row * heights.cols + col] ?? 40) / 10;
  };
}

function addNorthBank(
  blocks: Block[],
  payload: HumboldthafenVoxelPayload,
  sampleGround: (x: number, z: number) => number | null,
): void {
  const cell = payload.cell_m;
  const water = payload.water_top_y_m;
  const minX = Math.floor(-5.8 / cell) * cell + cell / 2;
  const maxX = 101.591;
  const minZ = Math.floor(-857.225 / cell) * cell + cell / 2;
  const maxZ = -844.435 + cell;
  for (let x = minX; x <= maxX; x += cell) {
    const waterZ = northernHumboldthafenWaterZAt(x);
    const crestZ = northernHumboldthafenCrestZAt(x);
    const crestY = sampleGround(x, crestZ);
    if (crestY === null) continue;
    for (let z = minZ; z <= maxZ; z += cell) {
      if (!isNorthernHumboldthafenReplacementCell(x, z)) continue;
      const t = Math.max(0, Math.min(1, (z - waterZ) / (crestZ - waterZ || 1)));
      const top = water + 0.14 + (crestY - water - 0.14) * t;
      const bottom = water - 3;
      blocks.push({
        color: BANK_STONE[(Math.round(x / cell) + Math.round(z / cell)) & 1],
        position: [x, (top + bottom) / 2, z],
        size: [cell, top - bottom, cell],
        sourceRole: "bank",
      });
    }
  }

  // One-block source crest path and historic two-rail motif. These sit above
  // the replacement blocks rather than sharing a face with the old ground.
  const [[startX, startZ], [endX, endZ]] = HUMBOLDTHAFEN_NORTH_CREST_M;
  const run = Math.hypot(endX - startX, endZ - startZ);
  const ux = (endX - startX) / run;
  const uz = (endZ - startZ) / run;
  const rotationY = -Math.atan2(uz, ux);
  const stations = Math.ceil(run / cell);
  for (let index = 0; index < stations; index += 1) {
    const length = Math.min(cell, run - index * cell);
    const along = index * cell + length / 2;
    const x = startX + ux * along;
    const z = startZ + uz * along;
    const y = sampleGround(x, z);
    if (y === null) continue;
    blocks.push({
      color: PATH,
      position: [x, y + 0.12, z],
      rotationY,
      size: [length, 0.22, 1],
      sourceRole: "path",
    });
    blocks.push({
      color: IRON,
      position: [x, y + 1, z + 0.55],
      rotationY,
      size: [length, 0.42, 0.42],
      sourceRole: "bridge-rail",
    });
  }
}

function addBridgeRail(
  blocks: Block[],
  sampleGround: (x: number, z: number) => number | null,
  profile: {
    axis: readonly [number, number];
    centreWorldM: readonly [number, number];
    inventoryLengthM: number;
    inventoryWidthM: number;
  },
): void {
  const [ux, uz] = profile.axis;
  const nx = -uz;
  const nz = ux;
  const rotationY = -Math.atan2(uz, ux);
  const quantum = 4;
  const stations = Math.ceil(profile.inventoryLengthM / quantum);
  for (const side of [-1, 1]) {
    for (let index = 0; index < stations; index += 1) {
      const length = Math.min(
        quantum,
        profile.inventoryLengthM - index * quantum,
      );
      const along =
        -profile.inventoryLengthM / 2 + index * quantum + length / 2;
      const across = side * (profile.inventoryWidthM / 2 - 0.35);
      const x = profile.centreWorldM[0] + ux * along + nx * across;
      const z = profile.centreWorldM[1] + uz * along + nz * across;
      const deckY = sampleGround(x, z);
      if (deckY === null) continue;
      blocks.push({
        color: IRON,
        position: [x, deckY + 0.85, z],
        rotationY,
        size: [length, 0.5, 0.45],
        sourceRole: "bridge-rail",
      });
      if (index % 2 === 0) {
        blocks.push({
          color: IRON,
          position: [x, deckY + 0.55, z],
          rotationY,
          size: [0.45, 1.1, 0.45],
          sourceRole: "bridge-rail",
        });
      }
    }
  }
}

/** Complete block-native bridge; replaces only its separately named drawn root. */
function addSandkrugBridge(blocks: Block[], payload: HumboldthafenVoxelPayload,
  sample: (x:number,z:number)=>number|null): void {
  const p=SANDKRUG_OSM_DECK,[ux,uz]=p.axis,[cx,cz]=p.centreWorldM;
  const yaw=-Math.atan2(uz,ux),hl=p.inventoryLengthM/2,hw=p.inventoryWidthM/2;
  let deckY=payload.water_top_y_m+5.4;
  const bridgeClass=payload.classes?.indexOf("bridge")??-1;
  payload.ground_rows?.forEach((row,zOffset)=>{for(const entry of row){
    const [start,run,kind]=entry;if(kind!==bridgeClass)continue;
    for(let j=0;j<run;j+=1){
      const x=(payload.grid.min_x_idx+start+j+0.5)*payload.cell_m;
      const z=(payload.grid.min_z_idx+zOffset+0.5)*payload.cell_m;
      const dx=x-cx,dz=z-cz;
      if(Math.abs(dx*ux+dz*uz)<hl+payload.cell_m && Math.abs(-dx*uz+dz*ux)<hw+payload.cell_m)
        deckY=Math.max(deckY,(sample(x,z)??0)+0.55);
    }
  }});
  const add=(u:number,v:number,y:number,length:number,height:number,width:number,color:number,sourceRole:Block["sourceRole"],cross=false)=>
    blocks.push({position:[cx+ux*u-uz*v,y,cz+uz*u+ux*v],size:[length,height,width],rotationY:yaw+(cross?Math.PI/2:0),color,sourceRole});
  for(let i=0;i<16;i+=1){
    const length=p.inventoryLengthM/16,u=-hl+(i+0.5)*length;
    const rise=0.12*Math.cos(u/hl*Math.PI/2)**2,y=deckY+rise;
    add(u,0,y-0.17,length+0.015,0.34,p.inventoryWidthM,0x555b5b,"bridge-deck");
    add(u,0,y+0.035,length+0.015,0.07,18.7,0x77746f,"bridge-deck");
    for(const side of [-1,1]) {
      add(u,side*(18.7/2+(p.inventoryWidthM-18.7)/4),y+0.07,length+0.015,0.12,(p.inventoryWidthM-18.7)/2,0xb9b8b1,"bridge-deck");
      add(u,side*(hw-0.25),y-0.55,length+0.015,1.1,0.45,IRON,"bridge-frame");
      add(u,side*hw,y+0.58,0.2,1.16,0.2,0xadb6b5,"bridge-rail");
      for(const level of [0.16,0.31,0.46,0.61,0.76,1.18])
        add(u,side*hw,y+level,length+0.015,0.09,0.12,0xadb6b5,"bridge-rail");
    }
  }
  for(let stem=0;stem<5;stem+=1){
    const v=-(p.inventoryWidthM-1.8)/2+stem*(p.inventoryWidthM-1.8)/4;
    add(0,v,deckY-0.88,21,0.45,0.46,IRON,"bridge-frame");
    for(const end of [-1,1])for(let step=0;step<4;step+=1)
      add(end*(10.9+step*1.2),v,deckY-0.85+step*0.16,1.25,0.36,0.46,IRON,"bridge-frame");
  }
  for(const u of [-hl+1.35,hl-1.35])add(u,0,deckY-2.65,2.1,3.1,p.inventoryWidthM-0.8,0x8c8c86,"bridge-frame");
  for(const fraction of [-0.58,0.58])for(const side of [-1,1]){
    const u=hl*fraction,y=deckY+0.12*Math.cos(fraction*Math.PI/2)**2,v=side*(hw-0.22);
    add(u,v,y+4.25,0.15,8.5,0.2,0xb2bab6,"bridge-lamp");
    add(u+0.3,v,y+4.25,0.12,8.5,0.2,0xb2bab6,"bridge-lamp");
    add(u+0.15,v,y+2.3,0.12,2.8,0.22,0xffd77b,"bridge-lamp");
    add(u+0.24,v,y+8.52,0.54,0.2,0.28,0xffd77b,"bridge-lamp");
  }
}

function addRoadLine(
  blocks: Block[],
  sampleGround: (x: number, z: number) => number | null,
  points: readonly (readonly [number, number])[],
): void {
  const quantum = 4;
  for (let segment = 0; segment < points.length - 1; segment += 1) {
    const [ax, az] = points[segment];
    const [bx, bz] = points[segment + 1];
    const run = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / run;
    const uz = (bz - az) / run;
    const rotationY = -Math.atan2(uz, ux);
    for (let along = 1; along < run; along += quantum * 2) {
      const length = Math.min(2, run - along);
      const x = ax + ux * (along + length / 2);
      const z = az + uz * (along + length / 2);
      const y = sampleGround(x, z);
      if (y === null) continue;
      blocks.push({
        color: WHITE,
        position: [x, y + 0.13, z],
        rotationY,
        size: [length, 0.2, 0.35],
        sourceRole: "path",
      });
    }
  }
}

function addVessels(blocks: Block[], water: number): void {
  const quantum = 2;
  for (const profile of REAL_SPREE_VESSEL_PROFILES) {
    const [ux, uz] = profile.heading;
    const rotationY = -Math.atan2(uz, ux);
    const lengthCells = Math.ceil(profile.lengthM / quantum);
    const beamCells = Math.ceil(profile.beamM / quantum);
    for (let alongIndex = 0; alongIndex < lengthCells; alongIndex += 1) {
      const length = Math.min(quantum, profile.lengthM - alongIndex * quantum);
      const along = -profile.lengthM / 2 + alongIndex * quantum + length / 2;
      for (let beamIndex = 0; beamIndex < beamCells; beamIndex += 1) {
        const width = Math.min(quantum, profile.beamM - beamIndex * quantum);
        const across = -profile.beamM / 2 + beamIndex * quantum + width / 2;
        const x = profile.displayPositionWorldM[0] + ux * along - uz * across;
        const z = profile.displayPositionWorldM[1] + uz * along + ux * across;
        blocks.push({
          color: alongIndex === lengthCells - 1 ? WHITE : BOOT,
          position: [x, water - profile.draughtM / 2 + 0.38, z],
          rotationY,
          size: [length, profile.draughtM + 0.76, width],
          sourceRole: "vessel",
        });
      }
    }
    const cabinLength =
      profile.lengthM * (profile.type === "salon" ? 0.62 : 0.56);
    const cabinCells = Math.ceil(cabinLength / quantum);
    for (let index = 0; index < cabinCells; index += 1) {
      const length = Math.min(quantum, cabinLength - index * quantum);
      const along = -cabinLength / 2 + index * quantum + length / 2;
      const x = profile.displayPositionWorldM[0] + ux * along;
      const z = profile.displayPositionWorldM[1] + uz * along;
      blocks.push({
        color: index % 2 === 0 ? WINDOW : WHITE,
        position: [x, water + 1.8, z],
        rotationY,
        size: [length, profile.type === "salon" ? 2.7 : 2.3, profile.beamM - 1],
        sourceRole: "vessel",
      });
    }
  }
}

function addEconomicMinistryFacadeBlocks(blocks: Block[]): void {
  for (const [key, profile] of Object.entries(
    ECONOMIC_MINISTRY_MINECRAFT_FACADES,
  )) {
    const dx = profile.to[0] - profile.from[0];
    const dz = profile.to[1] - profile.from[1];
    const run = Math.hypot(dx, dz);
    const ux = dx / run;
    const uz = dz / run;
    const rotationY = -Math.atan2(uz, ux);
    const historic = key.includes("Historic");
    const main = key.startsWith("main");
    const floorPitch = main ? 4.85 : historic ? 3.75 : 3.55;
    const firstCentre = main ? 5.55 : 2.35;
    const facadeHeight = (profile.levels - 1) * floorPitch + 2.45;
    for (let level = 0; level < profile.levels; level += 1) {
      if (historic) {
        const count=profile.mullions;
        for(let bay=0;bay<count;bay+=1) {
          const along=0.6+(run-1.2)*(bay+0.5)/count;
          const x=profile.from[0]+ux*along,z=profile.from[1]+uz*along;
          const y=profile.y0+firstCentre+level*floorPitch,width=(run-1.2)/count*0.52;
          blocks.push({color:MINISTRY_GLASS,position:[x,y,z],rotationY,
            size:[width,main?2.8:2.25,0.6],sourceRole:"building-detail"});
          blocks.push({color:MINISTRY_HISTORIC_STONE,position:[x,y,z],rotationY,
            size:[0.09,main?2.8:2.25,0.68],sourceRole:"building-detail"});
          blocks.push({color:MINISTRY_HISTORIC_STONE,position:[x,y+0.3,z],rotationY,
            size:[width,0.09,0.68],sourceRole:"building-detail"});
        }
        continue;
      }
      blocks.push({
        color: MINISTRY_GLASS,
        position: [
          (profile.from[0] + profile.to[0]) / 2,
          profile.y0 + firstCentre + level * floorPitch,
          (profile.from[1] + profile.to[1]) / 2,
        ],
        rotationY,
        size: [run - 1.2, 2.05, 0.42],
        sourceRole: "building-detail",
      });
    }
    for (let index = 0; index <= profile.mullions; index += 1) {
      const along = 0.6 + ((run - 1.2) * index) / profile.mullions;
      blocks.push({
        color: historic ? MINISTRY_HISTORIC_STONE : MINISTRY_STONE,
        position: [
          profile.from[0] + ux * along,
          profile.y0 + firstCentre + ((profile.levels - 1) * floorPitch) / 2,
          profile.from[1] + uz * along,
        ],
        rotationY,
        size: [historic ? 0.42 : 0.3, facadeHeight, 0.48],
        sourceRole: "building-detail",
      });
    }
  }
}

/**
 * One instanced draw call for the replacement bank, bridge furniture,
 * source paths and the two real-profile passenger vessels.
 */
export function createMinecraftHumboldthafenDetails(
  payload: HumboldthafenVoxelPayload,
): Group {
  const blocks: Block[] = [];
  const sampleGround = worldGroundSampler(payload);
  addNorthBank(blocks, payload, sampleGround);
  addBridgeRail(blocks, sampleGround, HUGO_PREUSS_OSM_DECK);
  addSandkrugBridge(blocks, payload, sampleGround);
  addRoadLine(
    blocks,
    sampleGround,
    HUMBOLDTHAFEN_ROAD_AXES.rahelHirschStrasse.points,
  );
  addEconomicMinistryFacadeBlocks(blocks);
  addVessels(blocks, payload.water_top_y_m);

  const material = new MeshBasicMaterial({ vertexColors: true });
  const mesh = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    material,
    blocks.length,
  );
  mesh.name = "Minecraft source-bound Humboldthafen blocks";
  const matrix = new Matrix4();
  const size = new Vector3();
  const position = new Vector3();
  const color = new Color();
  blocks.forEach((block, index) => {
    if (block.rotationY) matrix.makeRotationY(block.rotationY);
    else matrix.identity();
    size.set(...block.size);
    matrix.scale(size);
    position.set(...block.position);
    matrix.setPosition(position);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, color.setHex(block.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.userData.sourceRoles = blocks.reduce<Record<string, number>>(
    (counts, block) => {
      counts[block.sourceRole] = (counts[block.sourceRole] ?? 0) + 1;
      return counts;
    },
    {},
  );
  mesh.userData.drawCalls = 1;
  mesh.userData.approxInstanceTransferBytes = blocks.length * 76;
  mesh.userData.staticAllModes = true;
  mesh.userData.staticAntiFlicker = true;

  const group = new Group();
  group.name = "Minecraft Humboldthafen and Spree refinements";
  group.userData.sourceBound = true;
  group.userData.sources = {
    ...HUMBOLDTHAFEN_SOURCES,
    bridges: {
      hugoPreuss: HUGO_PREUSS_OSM_DECK,
      sandkrug: SANDKRUG_OSM_DECK,
      sandkrugStructure: SANDKRUG_STRUCTURE_PROFILE,
    },
    roads: HUMBOLDTHAFEN_ROAD_AXES,
    wirtschaftsministerium: ECONOMIC_MINISTRY_PROFILE,
    vessels: REEDEREI_RIEDEL_FLEET_SOURCE,
  };
  group.userData.collisionSource =
    "north-bank blocks replace exactly the same predicate suppressed from committed DGM ground";
  group.userData.vessels = REAL_SPREE_VESSEL_PROFILES.map((profile) => ({
    beamM: profile.beamM,
    draughtM: profile.draughtM,
    lengthM: profile.lengthM,
    name: profile.name,
    type: profile.type,
  }));
  group.userData.drawCalls = 1;
  group.userData.staticAllModes = true;
  group.add(mesh);
  return group;
}
