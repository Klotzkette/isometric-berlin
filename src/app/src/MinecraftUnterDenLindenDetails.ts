import {
  BoxGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import {
  type FacadeAxis,
  MINECRAFT_UNTER_DEN_LINDEN_GROUP_NAME,
  UNTER_DEN_LINDEN_DETAILS_PROFILE,
} from "./unterDenLindenProfiles";

type Point = [number, number, number];
type Instance = { color: number; matrix: number[] };

const IDENTITY = new Quaternion();
const STONE = 0xd0cdc1;
const STONE_LIGHT = 0xe5e1d7;
const GLASS = 0x51676c;
const GLASS_LIGHT = 0x769296;
const METAL = 0x42494a;
const BLUE = 0x244b84;
const RED = 0xb53a34;
const PURPLE = 0x765583;
const WHITE = 0xebe8df;

class BlockBuilder {
  readonly instances: Instance[] = [];
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();

  box(position: Point, size: Point, color: number): void {
    this.matrix.compose(
      this.position.set(...position),
      IDENTITY,
      this.scale.set(...size),
    );
    this.instances.push({ color, matrix: this.matrix.toArray() });
  }
}

function axisLength(axis: FacadeAxis): number {
  return Math.hypot(
    axis.endWorldXZ[0] - axis.startWorldXZ[0],
    axis.endWorldXZ[1] - axis.startWorldXZ[1],
  );
}

function facadePoint(
  axis: FacadeAxis,
  u: number,
  y: number,
  outward: number,
): Point {
  const dx = axis.endWorldXZ[0] - axis.startWorldXZ[0];
  const dz = axis.endWorldXZ[1] - axis.startWorldXZ[1];
  const length = Math.hypot(dx, dz);
  const signedOutward = outward * axis.outwardSide;
  return [
    axis.startWorldXZ[0] + (dx * u + dz * signedOutward) / length,
    y,
    axis.startWorldXZ[1] + (dz * u - dx * signedOutward) / length,
  ];
}

function facadeBlock(
  builder: BlockBuilder,
  axis: FacadeAxis,
  u: number,
  y: number,
  outward: number,
  width: number,
  height: number,
  depth: number,
  color: number,
): void {
  const dx = axis.endWorldXZ[0] - axis.startWorldXZ[0];
  const dz = axis.endWorldXZ[1] - axis.startWorldXZ[1];
  const length = Math.hypot(dx, dz);
  const alongX = Math.abs(dx / length);
  const alongZ = Math.abs(dz / length);
  builder.box(
    facadePoint(axis, u, y, outward),
    [
      Math.max(0.55, alongX * width + alongZ * depth),
      height,
      Math.max(0.55, alongZ * width + alongX * depth),
    ],
    color,
  );
}

function voxelGrid(
  builder: BlockBuilder,
  axis: FacadeAxis,
  baseY: number,
  bays: number,
  floors: number,
  firstFloorY: number,
  floorPitch: number,
  accent?: (bay: number, floor: number) => number | null,
): void {
  const length = axisLength(axis);
  const pitch = length / bays;
  for (let floor = 0; floor < floors; floor += 1) {
    facadeBlock(
      builder, axis, length / 2,
      baseY + firstFloorY + floor * floorPitch - 1.35,
      0.98, length, 0.3, 0.8, STONE_LIGHT,
    );
  }
  for (let bay = 0; bay < bays; bay += 1) {
    for (let floor = 0; floor < floors; floor += 1) {
      const color = accent?.(bay, floor) ??
        (floor % 2 === 0 ? GLASS : GLASS_LIGHT);
      facadeBlock(
        builder,
        axis,
        (bay + 0.5) * pitch,
        baseY + firstFloorY + floor * floorPitch,
        0.85,
        pitch * 0.7,
        2.25,
        0.72,
        color,
      );
    }
  }
  for (let boundary = 0; boundary <= bays; boundary += 1) {
    facadeBlock(
      builder,
      axis,
      boundary * pitch,
      baseY + firstFloorY + ((floors - 1) * floorPitch) / 2,
      0.94,
      0.58,
      (floors - 1) * floorPitch + 3.3,
      0.74,
      STONE_LIGHT,
    );
  }
}

function addBritishEmbassy(builder: BlockBuilder): void {
  const baseY =
    UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.britishEmbassy.anchorWorldM[1];
  const axis: FacadeAxis = {
    startWorldXZ: [598.18, 390.0],
    endWorldXZ: [598.18, 358.0],
    outwardSide: 1,
  };
  const length = axisLength(axis);
  const pitch = length / 8;
  for (let bay = 0; bay < 8; bay += 1) {
    const centralVoid = bay === 3 || bay === 4;
    for (let floor = 0; floor < 4; floor += 1) {
      if (centralVoid && floor < 3) continue;
      facadeBlock(
        builder,
        axis,
        (bay + 0.5) * pitch,
        baseY + 6.0 + floor * 4.15,
        0.85 + (floor % 2 === 0 ? 0.18 : 0),
        pitch * 0.58,
        2.45,
        0.72,
        floor % 2 === 0 ? GLASS : STONE,
      );
    }
  }
  facadeBlock(builder, axis, length / 2, baseY + 10.7, 1.1, 11.5, 12.8, 0.8, METAL);
  facadeBlock(builder, axis, length * 0.39, baseY + 14.8, 2.4, 5.8, 5.2, 3.2, PURPLE);
  facadeBlock(builder, axis, length * 0.64, baseY + 10.3, 2.5, 6.5, 6.2, 3.8, 0x5aa8bd);
  facadeBlock(builder, axis, length / 2, baseY + 1.45, 1.25, length, 2.9, 0.9, STONE);
}

function addRussianEmbassy(builder:BlockBuilder):void {
 const p=UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.russianEmbassy,base=p.anchorWorldM[1];
 for(const[section,axis]of p.frontageAxes.entries()){
  const length=axisLength(axis),central=section===2,pavilion=section===0||section===4,bays=central?3:pavilion?5:4;
  if(!central)voxelGrid(builder,axis,base,bays,3,7.2,5.3);
  else for(let i=0;i<3;i++)for(const[y,h]of[[7.1,3],[14.4,8.2]])facadeBlock(builder,axis,(i+.5)*length/3,base+y,.9,length/3*.56,h,.7,GLASS);
  facadeBlock(builder,axis,length/2,base+2.1,.65,length,4.2,.7,0xaaa28d);
  for(const y of[4.35,20.65,21.25,22.05])facadeBlock(builder,axis,length/2,base+y,1.05,length,.4,.85,STONE_LIGHT);
  if(pavilion)for(let i=0;i<=5;i++){
   const u=.45+i*(length-.9)/5;facadeBlock(builder,axis,u,base+12.5,1.1,.9,15.35,.9,STONE_LIGHT);
   for(const y of[4.83,20.28])facadeBlock(builder,axis,u,base+y,1.15,1.22,.4,1.05,STONE_LIGHT);
  }
 }
 const[x,z]=p.towerWorldXZ;
 builder.box([x,base+25.65,z],[18.2,5.8,17.5],STONE);
 for(const y of[28.45,29.1])builder.box([x,base+y,z],[18.7,.55,18],STONE_LIGHT);
 for(const sign of[-1,1])for(const u of[-4.5,0,4.5])for(const transpose of[false,true])builder.box([x+(transpose?sign*4.5:u),base+33.2,z+(transpose?u:sign*4.5)],[.7,7.2,.7],STONE_LIGHT);
 for(const[y,w,h]of[[29.65,10.5,.7],[36.98,11.3,.7],[37.65,10.75,.5]])builder.box([x,base+y,z],[w,h,w],STONE_LIGHT);
 for(const dx of[-7.6,7.6])for(const dz of[-7.3,7.3]){builder.box([x+dx,base+30.95,z+dz],[.8,2.7,.8],STONE);builder.box([x+dx,base+32.45,z+dz],[.55,.62,.55],STONE_LIGHT);}
 builder.box([x,base+40.75,z],[.25,6.2,.25],METAL);for(const[y,color]of[[42.5,WHITE],[42.12,BLUE],[41.74,RED]]as const)builder.box([x+1,base+y,z],[2,.36,.3],color);
 const axis=p.fenceAxis,l=axisLength(axis);for(const y of[.35,2.7])facadeBlock(builder,axis,l/2,base+y,0,l,.18,.2,METAL);
 for(let u=.2;u<l;u+=.75)facadeBlock(builder,axis,u,base+1.6,0,.16,2.65,.2,METAL);
 for(const u of[2.6,l-2.6]){facadeBlock(builder,axis,u,base+1.92,-1.45,3.4,3.84,2.9,STONE);facadeBlock(builder,axis,u,base+4.02,-1.45,3.75,.35,3.2,STONE_LIGHT);facadeBlock(builder,axis,u,base+1.5,.2,1.3,2.8,.3,METAL);}
}

function addAeroflot(builder: BlockBuilder): void {
  const profile = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.aeroflot;
  const axis = profile.streetFacade;
  const baseY = profile.anchorWorldM[1];
  const length = axisLength(axis);
  voxelGrid(builder, axis, baseY, 8, 4, 6.25, 3.28);
  facadeBlock(builder, axis, length / 2, baseY + 2.3, 0.85, length - 1, 4.2, 0.72, GLASS);
  facadeBlock(builder, axis, length / 2, baseY + 18.8, .82, length, .55, .7, STONE_LIGHT);
  for (let mark = 0; mark < 8; mark += 1) {
    facadeBlock(builder, axis, length * .06 + mark * 1.9, baseY + 19.8, 1.2, 1.2, 1.2, .55, METAL);
  }
}

function addEinstein(builder: BlockBuilder): void {
  const profile = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.einstein;
  const base = profile.anchorWorldM[1];
  for (const [side, axis] of [profile.streetFacade, profile.westFacade].entries()) {
    const length = axisLength(axis), usable = side === 0 ? length - profile.glassAtriumWidthM : length;
    const end = facadePoint(axis, usable, 0, 0);
    voxelGrid(builder, { ...axis, endWorldXZ: [end[0], end[2]] }, base, side === 0 ? 3 : 10, 5, 6.8, 4.1);
    facadeBlock(builder, axis, usable / 2, base + 1.9, .9, usable, 3.8, .7, METAL);
    facadeBlock(builder, axis, usable / 2, base + 3.95, 1.1, usable, .6, .8, 0x75332e);
    facadeBlock(builder, axis, length / 2, base + 25.8, .85, length, 3.1, .7, GLASS_LIGHT);
    for (const y of [24.2, 27.5]) facadeBlock(builder, axis, length / 2, base + y, 1.0, length, .4, .8, STONE_LIGHT);
    if (side === 0) facadeBlock(builder, axis, length - profile.glassAtriumWidthM / 2,
      base + 14, 1.0, profile.glassAtriumWidthM, 27, .7, GLASS_LIGHT);
  }
}

function addDussmann(builder: BlockBuilder): void {
  const p = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.dussmann, base = p.anchorWorldM[1];
  const modern = (axis: FacadeAxis, bays: number): void => {
    const l = axisLength(axis), pitch = l / bays;
    for (let bay = 0; bay < bays; bay++) for (let floor = 0; floor < 4; floor++)
      facadeBlock(builder, axis, (bay + .5) * pitch, base + 10.5 + floor * 4.1, .85,
        pitch * .77, 3.2, .7, (floor === 0 && bay > 3) || (floor === 1 && bay < 3) ? RED : GLASS_LIGHT);
    for (let i = 0; i <= bays; i++) facadeBlock(builder, axis, i * pitch, base + 4.1, 1.2, .9, 8.2, 1.4, STONE_LIGHT);
    for (const y of [8.3, 12.8, 16.9, 21.0, 25.1]) facadeBlock(builder, axis, l / 2, base + y, 1, l, .45, .7, STONE_LIGHT);
    for (const y of [27.4, 30.45]) facadeBlock(builder, axis, l / 2, base + y, -.5, l - 2, 1.6, .6, GLASS);
  };
  modern(p.eastFacade, 9);
  for (const axis of [p.northFacade, p.southFacade]) {
    const l = axisLength(axis), historic = l - 11.2;
    for (let bay = 0; bay < 8; bay++) for (let floor = 0; floor < 4; floor++)
      facadeBlock(builder, axis, (bay + .5) * historic / 8, base + 2.7 + floor * 5, .9,
        historic / 8 * .53, 3.1, .7, GLASS);
    for (const y of [4.8, 10, 15, 20.8]) facadeBlock(builder, axis, historic / 2, base + y, 1.1, historic, .4, .7, STONE_LIGHT);
    const start = facadePoint(axis, historic, base, 0);
    modern({ ...axis, startWorldXZ: [start[0], start[2]] }, 2);
  }
  const l = axisLength(p.eastFacade);
  facadeBlock(builder, p.eastFacade, l * .32, base + 15.6, 1.7, 1.3, 14.2, .8, STONE_LIGHT);
  for (let i = 0; i < 8; i++) facadeBlock(builder, p.eastFacade, l * .32, base + 21.2 - i * 1.55, 2.1, .7, .7, .5, RED);
  facadeBlock(builder, p.eastFacade, l * .5, base + 7.55, 1.8, 13.5, .8, .7, WHITE);
}

function addKomischeOper(builder: BlockBuilder): void {
  const p = UNTER_DEN_LINDEN_DETAILS_PROFILE.buildings.komischeOper;
  const axis = p.entranceRisalit, base = p.anchorWorldM[1], length = axisLength(axis);
  facadeBlock(builder, axis, length / 2, base + 9.8, .8, length, 9.6, .6, GLASS);
  for (let i = 0; i <= 8; i++) facadeBlock(builder, axis, i * length / 8, base + 9.8, 1.2, .35, 9.7, .55, METAL);
  for (const y of [5.1, 14.75]) facadeBlock(builder, axis, length / 2, base + y, 1.2, length, .85, .7, 0x465346);
  for (let i = 0; i < 3; i++) facadeBlock(builder, axis, (i + .5) * length / 3, base + 1.7, .8, 3.1, 3.35, .6, METAL);
}

function finishBlocks(builder: BlockBuilder, root: Group): void {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
  const nightMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    flatShading: true,
    metalness: 0,
    roughness: 0.86,
  });
  const mesh = new InstancedMesh(geometry, dayMaterial, 0);
  const matrices = new Float32Array(builder.instances.length * 16);
  const colors = new Float32Array(builder.instances.length * 3);
  const color = new Color();
  builder.instances.forEach((instance, index) => {
    matrices.set(instance.matrix, index * 16);
    color.setHex(instance.color).toArray(colors, index * 3);
  });
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.count = builder.instances.length;
  mesh.name = "Unter den Linden native facade blocks box";
  mesh.userData.dayMaterial = dayMaterial;
  mesh.userData.nightMaterial = nightMaterial;
  mesh.userData.textureFree = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  root.add(mesh);
}

export function createMinecraftUnterDenLindenDetails(options: { includeLegacyAeroflot?: boolean } = {}): Group {
  const group = new Group();
  group.name = MINECRAFT_UNTER_DEN_LINDEN_GROUP_NAME;
  group.userData = {
    ...UNTER_DEN_LINDEN_DETAILS_PROFILE,
    blockNative: true,
    keepInMinecraft: true,
    facadeOnly: true,
  };
  const builder = new BlockBuilder();
  addBritishEmbassy(builder);
  addRussianEmbassy(builder);
  if (options.includeLegacyAeroflot !== false) addAeroflot(builder);
  addEinstein(builder);
  addDussmann(builder);
  addKomischeOper(builder);
  finishBlocks(builder, group);
  return freezeStaticSceneTransforms(group);
}
