import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BoxGeometry, BufferGeometry, Group, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createMemorialLandmarks, setStelenfeldPresentation } from "../src/MemorialLandmarks";
import { HOLOCAUST_FIELD, holocaustStelePlacements, PITCH_ACROSS, PITCH_ALONG,
  stelenfeldGroundAtV385, stelenfeldSolidAtV385 } from "../src/holocaustField";
import { replacesSteleColumn, replacesStelePrism, inStelenfeldSite, STELENFELD_ANCHOR,
  STELENFELD_RING, stelenfeldOwnsGroundCell } from "../src/stelenfeldSiteV385";
import type { PrismPayload } from "../src/IsometricCityWorld";
import { createPedestrianEnvironment, PEDESTRIAN_BODY_RADIUS_M, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import {buildMinecraftVoxelWorldSteps, type VoxelBuildingColumn, type VoxelPayload} from "../src/MinecraftVoxelWorld";
import {preloadAltMitteNativeV169Source} from "../src/AltMitteNativeCoreV169";

const name = "Denkmal für die ermordeten Juden Europas";
const field = createMemorialLandmarks([{name, world: [STELENFELD_ANCHOR[0],8,STELENFELD_ANCHOR[1]]}]);
field.updateMatrixWorld(true);
const stones = field.getObjectByName("Holocaust Memorial 2598 raised stelae") as InstancedMesh<BoxGeometry>;
const paving = field.getObjectByName("Stelenfeld surveyed alley pavement") as Mesh<BufferGeometry>;
const fromCore = <T,>(file: string): T => JSON.parse(readFileSync(new URL(
  "../public/mesh/regierungsviertel/"+file, import.meta.url), "utf8"));
const source = fromCore<PrismPayload>("lod2-prisms.json");
const voxel = fromCore<VoxelPayload>("minecraft-voxels.json");

describe("Stelenfeld cadastral and laser survey", () => {
  test("shows the Foundation's 2,710 current stelae, including 112 at pavement level", () => {
    const poses = holocaustStelePlacements();
    expect(poses).toHaveLength(HOLOCAUST_FIELD.steleCount);
    expect(stones.count+paving.userData.flushInserts).toBe(2710);
    expect(poses.filter(p=>p.height===0)).toHaveLength(112);
    expect(Math.max(...poses.map(p=>p.height))).toBeCloseTo(4.53,2);
    expect(new Set(poses.map(p=>[p.x,p.z].join())).size).toBe(2710);
    expect(poses.every(p=>p.height===0 || Math.hypot(p.tiltX,p.tiltZ)<0.035)).toBe(true);
    expect(stones.geometry.parameters.width).toBe(2.38);
    expect(stones.geometry.parameters.depth).toBe(0.95);
    expect(PITCH_ACROSS).toBeCloseTo(1.90,6);
    expect(PITCH_ALONG).toBeCloseTo(3.33,6);
    expect(poses.every(p=>p.rotationY<0 && p.rotationY>-.023)).toBe(true);
  });

  test("renders the triangle surface sampled by both navigation families", () => {
    const distinct = source.buildings.filter(replacesStelePrism);
    expect(distinct).toHaveLength(2601);
    const original = distinct.find(p=>p.id==="xMIcRZKx")!;
    const environment = createPedestrianEnvironment(voxel, {water:[]}, undefined,
      {...source, buildings:[original]});
    for (const [x,z,y] of [[460,552,3.24],[483,550,2.35],[504,550,3.105],[460,592,2.21],[483.597,552.822,2.53111]]) {
      const ray = new Raycaster(new Vector3(x,20,z),new Vector3(0,-1,0));
      expect(ray.intersectObject(paving,false)[0].point.y).toBeCloseTo(y,2);
      expect(stelenfeldGroundAtV385(x,z)).toBeCloseTo(y,3);
      expect(environment.groundAt(x,z)).toBeCloseTo(y,3);
    }
    const obstacles = [...environment.obstacles!.cells.values()].flat();
    expect(obstacles.some(o=>o.sourceId===original.id)).toBe(false);
    expect(stelenfeldGroundAtV385(393,486)).toBeNull();
    expect(inStelenfeldSite(394,645)).toBe(true);
    expect(stelenfeldOwnsGroundCell(394,646)).toBe(false);
    expect(stelenfeldOwnsGroundCell(482,554)).toBe(true);
    const area = STELENFELD_RING.reduce((s,[x,z],i) => {
      const [nx,nz]=STELENFELD_RING[(i+1)%STELENFELD_RING.length];
      return s+x*nz-z*nx;
    },0);
    expect(Math.abs(area)/2).toBeCloseTo(19064.5068,3);
    for (const changed of [{id:"other"}, {h_dm:original.h_dm+1}, {class:original.class+1},
      {ring:original.ring.map(([x,z])=>[x+1,z])}, {holes:[[[0,0],[1,1],[1,0]]]}]) {
      expect(replacesStelePrism({...original,...changed})).toBe(false);
    }
  });

  test("removes the 1,190 registered raster columns and retains different heights or classes", () => {
    const matches = {short:0, tall:0};
    for (const [row,runs] of voxel.building_rows!.entries()) for (const [start,n,low,high,cls] of runs) {
      const z=voxel.grid.min_z_idx+row;
      for (let j=0; j<n; j++) {
        const x=voxel.grid.min_x_idx+start+j;
        if (!replacesSteleColumn(x,z,low,high,cls)) continue;
        if (high-low===80) matches.tall++;
        else matches.short++;
        expect(replacesSteleColumn(x,z,low-1,high-1,cls)).toBe(false);
        expect(replacesSteleColumn(x,z,low,high+(high-low===80 ? -40 : 40),cls)).toBe(false);
        expect(replacesSteleColumn(x,z,low,high,cls+1)).toBe(false);
      }
    }
    expect(matches).toEqual({short:1167,tall:23});
  });

  test("exposes the measured surface below all five former voxel roofs and preserves the real museum access", async () => {
    await preloadAltMitteNativeV169Source();
    const buildings: VoxelBuildingColumn[] = [];
    for (const [row,runs] of voxel.building_rows!.entries()) {
      const z=voxel.grid.min_z_idx+row;
      if (z<120 || z>162) continue;
      for (const [start,n,low,high,cls] of runs) {
        for (let x=voxel.grid.min_x_idx+start; x<voxel.grid.min_x_idx+start+n; x++) {
          if (x>=97 && x<=142) buildings.push([x,z,low,high,cls]);
        }
      }
    }
    const sourceHere = {...voxel, grid:{min_x_idx:97,min_z_idx:120,cols:46,rows:43},
      building_rows:undefined,buildings,ground_rows:[],tree_rows:[],trees:[]};
    const native = new Group();
    let nativeBuildingsReady=false;
    const steps = buildMinecraftVoxelWorldSteps(native,sourceHere,null,null,{
      onBuildProgress:completed=>{ nativeBuildingsReady=completed>=5; },
    });
    try {
      while (!nativeBuildingsReady && !steps.next().done) {}
      native.updateMatrixWorld(true);
      const bodies=native.getObjectByName("Voxel building columns")!;
      const windows=native.getObjectByName("Voxel facade windows")!;
      expect(bodies).toBeDefined();
      expect(windows).toBeDefined();
      for (const [x,z] of [[459.203,546.222],[466.745,585.965],[482.924,590.058],
        [413.081,564.000],[399.118,639.608]]) {
        const ray=new Raycaster(new Vector3(x,20,z),new Vector3(0,-1,0));
        expect(ray.intersectObjects([bodies,windows],false)).toHaveLength(0);
        for (const block of [true,false]) {
          setStelenfeldPresentation(field,block,false);
          expect(ray.intersectObject(paving)[0].point.y).toBeCloseTo(stelenfeldGroundAtV385(x,z,block)!,3);
          expect(ray.intersectObjects([paving,stones])[0].point.y).toBeLessThan(8);
        }
      }
      // The cadastral structure's dark flat roof was missing from both old scenes.
      const kiosk=new Raycaster(new Vector3(550,20,586),new Vector3(0,-1,0));
      const sitePrisms=source.buildings.filter(replacesStelePrism);
      const environment=createPedestrianEnvironment(voxel,{water:[]},undefined,{buildings:sitePrisms});
      environment.interiorSolidAt=stelenfeldSolidAtV385;
      for(const mode of ["day","minecraft"] as const) {
        setStelenfeldPresentation(field,mode==="minecraft",false);
        environment.visualMode=()=>mode;
        expect(kiosk.intersectObjects([bodies,paving])[0].point.y).toBeCloseTo(7.98,2);
        expect(pedestrianPointIsBlocked(550,586,environment.groundAt(550,586)!,environment.obstacles,environment)).toBe(true);
        // Three street-level approaches to the documented entrance and stairs,
        // then a proven clear alley in or beside each old voxel cluster.
        for (const [x,z] of [[546.4,553],[526,585.9],[551.3,591],
          [458.903,546.422],[466.145,586.665],[482.924,590.758],[413.081,564.801],[399.118,640.508]]) {
          const ground=environment.groundAt(x,z)!;
          expect(ground).toBeCloseTo(stelenfeldGroundAtV385(x,z,mode==="minecraft")!,3);
          expect(pedestrianPointIsBlocked(x,z,ground,environment.obstacles,environment)).toBe(false);
        }
      }
      // Original cells touching the stair footprints and kiosk persist.
      for (const tuple of [[137,138,45,85,3],[136,143,46,86,3],[137,146,46,86,3]] as const) {
        expect(buildings).toContainEqual([...tuple]);
        expect(replacesSteleColumn(...tuple)).toBe(false);
      }
    } finally {
      steps.return(undefined as never);
      setStelenfeldPresentation(field,false,false);
    }
  },30_000);

  test("admits a full-size pedestrian along the central 0.95 m alley and stops the same pedestrian at concrete", () => {
    const access = {interiorSolidAt: stelenfeldSolidAtV385};
    expect(PEDESTRIAN_BODY_RADIUS_M).toBe(.42);
    for (let i=-90; i<=90; i++) {
      const x=483.597+i/10, z=552.822+i/10*.019;
      expect(pedestrianPointIsBlocked(x,z,stelenfeldGroundAtV385(x,z)!,undefined,access)).toBe(false);
    }
    const x=483.597, z=553.02;
    expect(pedestrianPointIsBlocked(x,z,stelenfeldGroundAtV385(x,z)!,undefined,access)).toBe(true);
    expect(stelenfeldSolidAtV385(x,15,z,.42)).toBe(false);
  });

  test("joins the registered flush inserts to paved sidewalks in both styles without covering tree pits or bicycle lanes", () => {
    const anchors = [
      [400.25,556.00,4.6334,4.6763], [396.36,578.71,4.6016,4.6700],
      [559.88,566.60,4.6367,4.6700], [421.53,639.94,4.3305,4.3700],
    ];
    const surfaceHits = (x:number,z:number) => new Raycaster(new Vector3(x,25,z),
      new Vector3(0,-1,0)).intersectObject(paving,false);
    for (const native of [false,true]) {
      setStelenfeldPresentation(field,native,false);
      for (const [x,z,drawnY,nativeY] of anchors) {
        const y=stelenfeldGroundAtV385(x,z,native)!;
        expect(y).toBeCloseTo(native ? nativeY : drawnY,2);
        // The first three original streamed surfaces were measured separately
        // from their temporary backing. Only 3 mm separate the drawn faces.
        const insert=surfaceHits(x,z)[0].point.y;
        expect(insert-y).toBeGreaterThan(.002);
        expect(insert-y).toBeLessThan(.0041);
      }
      for (const [x,z] of [[402,534],[470,630],[562,602]]) {
        expect(surfaceHits(x,z)[0].point.y).toBeCloseTo(stelenfeldGroundAtV385(x,z,native)!,3);
      }
      // Original trunk openings, cycle track, joint and commuter kerb are uncovered.
      for (const [x,z] of [[391.75,631.79],[403.71,550.36],[393.08,576.75],[395.21,626.16],[382,634]]) {
        expect(surfaceHits(x,z)).toHaveLength(0);
        expect(stelenfeldGroundAtV385(x,z,native)).toBeNull();
      }
    }
    setStelenfeldPresentation(field,false,false);
  });

  test("retains all 29 mapped trees across mode changes and changes only top-face paint in snow", () => {
    const shared=field.getObjectByName("Stelenfeld mapped trees")!;
    const native=field.getObjectByName("Stelenfeld native tree completion")!;
    const count=(group: typeof shared) => (group.getObjectByName("Stelenfeld mapped tree crowns") as InstancedMesh).count;
    expect(count(shared)).toBe(9);
    expect(count(native)).toBe(20);
    expect(native.visible).toBe(false);
    const day=stones.geometry.getAttribute("color");
    setStelenfeldPresentation(field,true,false);
    expect(native.visible).toBe(true);
    setStelenfeldPresentation(field,false,true);
    expect(native.visible).toBe(false);
    const snow=stones.geometry.getAttribute("color"), normals=stones.geometry.getAttribute("normal");
    for (let i=0;i<day.count;i++) {
      if (normals.getY(i)>.5) expect(snow.getX(i)).toBeGreaterThan(day.getX(i));
      else expect(snow.getX(i)).toBe(day.getX(i));
    }
    setStelenfeldPresentation(field,false,false);
    expect(stones.geometry.getAttribute("color")).toBe(day);
  });
});
