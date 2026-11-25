import { expect, test } from "bun:test";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Group, Mesh, Raycaster, Vector3 } from "three";
import { createRestoredRoadBatch } from "../src/restoredRoadSurfaces";
import { preloadAltMitteNativeV169Source } from "../src/AltMitteNativeCoreV169";
import { createDistrictStreets } from "../src/DistrictStreets";
import { createExpandedCityDetails } from "../src/ExpandedCityDetails";
import { buildMinecraftVoxelWorldSteps } from "../src/MinecraftVoxelWorld";
import { CLASS_SHADES, createGroundSlabs, smoothGroundTopSampler } from "../src/terrainPayload";

const floorName = "Gehweg am Westeingang der Mall of Berlin";
const payload = (name: string) =>
  Bun.file(new URL(`../public/mesh/regierungsviertel/${name}.json`, import.meta.url)).json();

test.each([false,true])("the normal city entrance displays the west pavement above its original terrain (block=%s)", async native=>{
  const data = await payload(native ? "minecraft-voxels" : "ground-context");
  const root = new Group();
  let oldFloor: Mesh;
  if (native) {
    const [prisms, scene] = await Promise.all([payload("lod2-prisms"),payload("scene")]);
    await preloadAltMitteNativeV169Source();
    const steps = buildMinecraftVoxelWorldSteps(root,data,null,scene.tiergartentunnel,{
      includeLegacyMonbijou:false, sourcePrisms:prisms.buildings,
    });
    while (!root.children.some(child => child.name === floorName))
      if (steps.next().done) throw Error("Mall west entrance was missing from the native city");
    steps.return(root);
    oldFloor = root.getObjectByName("Voxel ground runs") as Mesh;
  } else {
    root.add(createExpandedCityDetails([{name:"Mall of Berlin",world:[633.506,5.1,953.597]}]));
    oldFloor = createGroundSlabs(data,"Drawn ground slabs",CLASS_SHADES,{parkRelief:"drawn",skipClasses:["asphalt"]});
    root.add(oldFloor);
  }
  root.updateMatrixWorld(true);
  const displayed: Mesh[]=[];
  root.traverse(o=>{if (o instanceof Mesh && o.name===floorName) displayed.push(o);});
  expect(displayed).toHaveLength(1);
  expect(oldFloor).toBeInstanceOf(Mesh);
  const down = (x:number,z:number)=>new Raycaster(new Vector3(x,9,z),new Vector3(0,-1,0),0,7);
  const smooth = smoothGroundTopSampler(data);
  const doorway = down(529.8,998.15);
  const connection = down(528,998.7);
  if (native) {
    // The native world does not load the vector street packets. The actual
    // four-metre terrain here is grass, below the stone at the door and curb.
    for (const ray of [doorway,connection]) {
      const stone = ray.intersectObject(displayed[0])[0];
      expect(stone.point.y).toBeCloseTo(5.0,2);
      expect(stone.point.y).toBeGreaterThan(ray.intersectObject(oldFloor)[0].point.y+.5);
    }
  } else {
    const input = createReadStream(new URL("../src/data/restoredRoadSurfaces.ndjson.txt",import.meta.url));
    const packets = createInterface({input,crlfDelay:Infinity});
    let existingPaving: Group | undefined;
    try {
      for await (const line of packets) {
        if (!line.startsWith('{"id":"restored-paving-1-1"')) continue;
        existingPaving = createRestoredRoadBatch(JSON.parse(line),(x,z)=>
          smooth(x/data.cell_m-data.grid.min_x_idx,z/data.cell_m-data.grid.min_z_idx));
        existingPaving.updateMatrixWorld(true);
        break;
      }
    } finally { packets.close();input.destroy(); }
    if (!existingPaving) throw Error("Missing original Mall doorway paving packet");
    const originalDoor = doorway.intersectObject(existingPaving,true)[0];
    expect(originalDoor?.object.name).toBe("smooth paved paths");
    expect(originalDoor.point.y).toBeCloseTo(4.98656,3);
    expect(doorway.intersectObject(displayed[0])).toHaveLength(0);
    const districtStreets = createDistrictStreets(data);
    districtStreets.updateMatrixWorld(true);
    const originalPath = connection.intersectObject(districtStreets,true)[0];
    expect(originalPath?.point.y).toBeGreaterThan(connection.intersectObject(oldFloor)[0].point.y);
    expect(connection.intersectObject(displayed[0])).toHaveLength(0);
  }
  for (const [x,z] of [[526,998.7],[525,1005.5],[527,1012],[530.35,1018.4]]) {
    const ray = down(x,z);
    const old = ray.intersectObject(oldFloor)[0];
    const hit = ray.intersectObject(displayed[0])[0];
    expect(old).toBeDefined();
    expect(hit, `west pavement at ${x}, ${z}`).toBeDefined();
    expect(hit.point.y).toBeGreaterThan(old.point.y+.015);
    const terrain = smooth(x/data.cell_m-data.grid.min_x_idx,z/data.cell_m-data.grid.min_z_idx);
    const expectedTop=Math.max(old.point.y+.05,terrain+.10);
    expect(Math.abs(hit.point.y-expectedTop)).toBeLessThan(.045);
  }
  // Ring road, OSM stair 394948620, the nearest street-tree base in the
  // municipal register, the park lawn and a spot behind the facade.
  for (const [x,z] of [[520,1005],[516,1005],[511.6,1010.6],[508.462,999.666],[490,1000],[538,1003]])
    expect(down(x,z).intersectObject(displayed[0])).toHaveLength(0);
},60000);
