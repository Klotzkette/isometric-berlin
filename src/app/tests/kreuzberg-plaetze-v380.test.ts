import { describe, expect, test } from "bun:test";
import { Group, Mesh, type BufferGeometry } from "three";
import { attachKreuzbergPlaetzeV380 } from "../src/kreuzbergPlaetzeV380";
import { kreuzbergPlaetzeHostsV380 } from "../src/kreuzbergPlaetzeIndexV380";
import { kreuzbergPlaetzeViewsV380 } from "../src/kreuzbergPlaetzeViewsV380";
import type { SurroundingChunkGeometry } from "../src/SurroundingCityGeometry";

function host():SurroundingChunkGeometry {
  return {root:new Group(),origin:[0,0,0],geometryBytes:0,bufferCount:0,nav:{groundY:0,ground:[],water:[],buildings:[]}};
}
describe("Kreuzberger Plätze auf vermessenen Straßenflächen",()=>{
  test("Kameras zielen in zwei verschiedene, begrenzte Kartenbereiche",()=>{
    const names=["Moritzplatz","Rio-Reiser-Platz (Heinrichplatz)"];
    kreuzbergPlaetzeHostsV380.forEach(({bounds:[west,north,east,south]},i)=>{
      const [x,,z]=kreuzbergPlaetzeViewsV380[names[i]].target;
      expect(x).toBeGreaterThan(west);expect(x).toBeLessThan(east);
      expect(z).toBeGreaterThan(north);expect(z).toBeLessThan(south);
    });
  });
  for (const {id} of kreuzbergPlaetzeHostsV380) {
    test(id+" teilt das Straßenprofil zwischen den beiden Darstellungen",async()=>{
      const grounds:Int16Array[]=[];
      for (const native of [false,true]) {
        const entry=host(),signal=new AbortController().signal;
        await Promise.all([attachKreuzbergPlaetzeV380(entry,id,native,signal),attachKreuzbergPlaetzeV380(entry,id,native,signal)]);
        expect(entry.root.children).toHaveLength(1);
        expect(entry.bufferCount).toBe(6);
        const geometries:BufferGeometry[]=[];
        entry.root.traverse(o=>{if(o instanceof Mesh)geometries.push(o.geometry);});
        expect(geometries).toHaveLength(2);
        for (const g of geometries) {
          const pos=g.getAttribute("position");
          expect(pos.count).toBe(g.getAttribute("color").count);
          const bounds=g.boundingBox!;
          expect(bounds.max.x-bounds.min.x).toBeLessThan(250*100);
          expect(bounds.max.z-bounds.min.z).toBeLessThan(250*100);
          expect(g.getIndex()!.count%3).toBe(0);
        }
        grounds.push(geometries[0].getAttribute("position").array as Int16Array);
        const floor=entry.root.userData.kreuzbergPlaetzeFloorV380;
        const z=id.endsWith("rio")?2152:1756;
        const x=id.endsWith("rio")?3457:2603;
        expect(floor(x,z)).toBeGreaterThan(3.25);
        expect(floor(0,0)).toBeNull();
        expect(entry.geometryBytes).toBeLessThan(400_000);
      }
      expect(Buffer.compare(Buffer.from(grounds[0].buffer),Buffer.from(grounds[1].buffer))).toBe(0);
    });
  }
  test("Ein Abbruch vor der Veröffentlichung hinterlässt keine Geometrie",async()=>{
    const entry=host(),c=new AbortController();
    const pending=attachKreuzbergPlaetzeV380(entry,"kreuzberg380-rio",false,c.signal);
    c.abort();await pending;
    expect(entry.root.children).toHaveLength(0);expect(entry.geometryBytes).toBe(0);
    expect(entry.root.userData.kreuzbergPlaetzeFloorV380).toBeUndefined();
  });
});
