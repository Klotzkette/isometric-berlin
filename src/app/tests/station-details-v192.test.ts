import { describe, expect, test } from "bun:test";
import { Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createAlexanderStationDetailsV192, createZooEntranceDetailsV192, stationFacadeLetteringPointV192 } from "../src/StationDetailsV192";
import { ZOO_ENTRANCE_V192_POSTS, ZOO_ENTRANCE_V192_PART, zooEntrancePointV192, zooEntranceRoofAtV192 } from "../src/stationDetailsV192Profile";
import { ZOO_STATION_V165_PARTS, ZOO_STATION_V165_PRISM_IDS, zooStationV165PassageAt, zooStationV165SolidAt, zooStationV165SourceColumn } from "../src/zooStationV165Profile";
import { letteringLayout } from "../src/drawnLettering";
import data from "../src/data/stationDetailsV192.json";
import old from "../src/data/zooStationV165Navigation.json";

function dispose(root:Group){root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();o.userData.dayMaterial.dispose();o.userData.nightMaterial.dispose();}});}
function measure(root:Group){let bytes=0,draws=0,instances=0;root.traverse(o=>{expect(o.matrixAutoUpdate).toBe(false);if(o instanceof Mesh){draws++;expect(o.geometry.getAttribute("uv")).toBeUndefined();for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;bytes+=o.geometry.index?.array.byteLength??0;if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+o.instanceColor!.array.byteLength;}}});return {bytes,draws,instances};}

describe("bounded v192 Alexanderplatz and Zoo details",()=>{
  test("every inscription fits the shared alphabet and facade lettering is centred and outward-readable on every compass side",()=>{
    for(const text of ["ALEXA","ALEXANDERPLATZ","U","U2","U9"])expect(letteringLayout(text,1).totalWidthM).toBeGreaterThan(0);
    for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1],[.6,.8]])for(const side of [-1,1]) {
      const a={a:[12,34],dx,dz,nx:side*dz,nz:-side*dx,length:50};
      const mid=stationFacadeLetteringPointV192(a,[0,0],7,.3),left=stationFacadeLetteringPointV192(a,[-1,0],7,.3),right=stationFacadeLetteringPointV192(a,[1,0],7,.3);
      expect(mid).toEqual([12+25*dx+.3*a.nx,7,34+25*dz+.3*a.nz]);
      expect((right[0]-left[0])*a.nz-(right[2]-left[2])*a.nx).toBeCloseTo(2,6);
    }
  });
  test("combined additions stay below 0.3MiB and three submissions, with orthogonal native matrices",()=>{
    for(const native of [false,true]){
      let bytes=0,draws=0;
      for(const create of [createAlexanderStationDetailsV192,createZooEntranceDetailsV192]){
        const root=create(native),metrics=measure(root);bytes+=metrics.bytes;draws+=metrics.draws;
        root.traverse(o=>{if(o instanceof InstancedMesh){const m=new Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);expect(m.elements.every(Number.isFinite)).toBe(true);if(native)for(const k of [1,2,4,6,8,9])expect(Math.abs(m.elements[k])).toBe(0);}}
          if(o instanceof Mesh&&o.userData.glass){const mat=o.material as MeshBasicMaterial;expect(mat.opacity).toBe(.17);expect(mat.depthWrite).toBe(false);}});
        dispose(root);
      }
      expect(draws).toBe(3);expect(bytes).toBeLessThan(native?240000:100000);
    }
  });
  test("all earlier Zoo parts and exact owners remain, with precisely one canopy owner substitution",()=>{
    expect(ZOO_STATION_V165_PARTS).toEqual([...old.parts,ZOO_ENTRANCE_V192_PART]);
    expect(ZOO_STATION_V165_PRISM_IDS).toEqual(new Set([...old.legacyPrisms.map(p=>p.id),"57658318"]));
    const p=zooEntrancePointV192(.5,0,5.2);
    expect(zooStationV165SourceColumn(p[0],p[2],5.2,9.2)).toBe(true);
    expect(zooStationV165SourceColumn(p[0],p[2],5.2,13.2)).toBe(false);
    expect(zooStationV165SourceColumn(p[0]+20,p[2],5.2,9.2)).toBe(false);
    expect(zooStationV165PassageAt(p[0],6,p[2],"57658318")).toBe(true);
    expect(zooStationV165PassageAt(p[0],6,p[2],"-3652421")).toBe(false);
    expect(zooStationV165SolidAt(p[0],6,p[2])).toBe(false);
    expect(ZOO_ENTRANCE_V192_POSTS.length).toBe(6);
    for(const [x,,z] of ZOO_ENTRANCE_V192_POSTS)expect(zooStationV165SolidAt(x,6,z)).toBe(true);
    expect(zooEntranceRoofAtV192(p[0],p[2])).toBeCloseTo(8.2,5);
  });
  test("glass roof retains the complete four-corner OSM plan and the 3m mapped envelope",()=>{
    const root=createZooEntranceDetailsV192(),glass=root.children.find(o=>o instanceof Mesh&&!(o instanceof InstancedMesh)) as Mesh;
    const p=glass.geometry.getAttribute("position");let roofArea=0;
    // First four triangles are the two complete roof slopes; guards follow.
    for(let i=0;i<12;i+=3)roofArea+=Math.abs((p.getX(i+1)-p.getX(i))*(p.getZ(i+2)-p.getZ(i))-(p.getZ(i+1)-p.getZ(i))*(p.getX(i+2)-p.getX(i)))/2;
    const ring=data.zoo.roof.points;let mappedArea=0;for(let i=1;i<ring.length;i++)mappedArea+=(ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1])/2;
    expect(roofArea).toBeCloseTo(Math.abs(mappedArea),2);
    for(let i=0;i<12;i++){expect(p.getY(i)).toBeGreaterThanOrEqual(7.54);expect(p.getY(i)).toBeLessThanOrEqual(8.201);}
    dispose(root);
  });
  test("every Zoo U/U2/U9 glyph is in front of its backing in drawn and independent native views",()=>{
    const [a,c]=data.zoo.stairs.points,front=new Vector3(-(c[1]-a[1]),0,c[0]-a[0]).normalize();
    for(const native of [false,true]){
      const root=createZooEntranceDetailsV192(native),mesh=root.children.find(o=>o instanceof InstancedMesh&&!o.userData.glass) as InstancedMesh;
      const matrix=new Matrix4(),center=new Vector3();let checked=0;
      for(let i=0;i<mesh.count;i++)if(mesh.userData.roles[i]==="Zoo-entrance-line-lettering"){
        mesh.getMatrixAt(i,matrix);center.setFromMatrixPosition(matrix);
        const ray=new Raycaster(center.clone().addScaledVector(front,.6),front.clone().negate(),0,1.2);
        const hit=ray.intersectObject(mesh,false)[0];
        expect(hit).toBeDefined();expect(mesh.userData.roles[hit.instanceId!]).toBe("Zoo-entrance-line-lettering");checked++;
      }
      expect(checked).toBe(39);dispose(root);
    }
  });
});
