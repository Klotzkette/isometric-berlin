import {BufferAttribute,BufferGeometry,Group,LineBasicMaterial,LineSegments} from "three";
import data from "./data/berlinBoundariesV200.json";
import {terrainGroundAt} from "./weinbergTerrainV176";
import {freezeStaticSceneTransforms} from "./staticSceneTransforms";

/** Cartographic source lines only: no filled land, blockers or invented gap joins. */
export function createBerlinBoundariesV200(native=false):Group {
  const root=new Group();root.name="Berlin state border and mapped 1989 border installations v200";
  root.userData={berlinBoundariesV200:true,cartographicOverlay:true,textureFree:true,additiveOnly:true,nativeMinecraft:native,keepInMinecraft:native};
  for(const kind of ["state","wall"] as const){
    // Constructor-only sources are copied into owned GPU buffers; nothing in
    // update/userData retains the parsed arrays or creates a second-mode copy.
    const xz=kind==="state"?data.stateXz:data.wallXz;
    const indices=kind==="state"?data.stateSegments:data.wallSegments;
    const positions=new Float32Array(xz.length/2*3);
    for(let i=0;i<xz.length;i+=2){
      const x=xz[i],z=xz[i+1],o=i/2*3;
      positions[o]=x;positions[o+1]=terrainGroundAt(x,z,3,native)+.22;positions[o+2]=z;
    }
    const geometry=new BufferGeometry();
    geometry.setAttribute("position",new BufferAttribute(positions,3));
    geometry.setIndex(new BufferAttribute(new Uint32Array(indices),1));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const material=new LineBasicMaterial({color:kind==="state"?0x607575:0xb63835,linewidth:1,transparent:true,opacity:kind==="state"?.40:.64,depthTest:false,depthWrite:false,fog:false});
    const lines=new LineSegments(geometry,material);
    lines.name=kind==="state"?"Current ALKIS Berlin state boundary":"Mapped Vorderlandmauer and underwater boundary course, 1989";
    lines.userData={berlinBoundariesV200:true,cartographicOverlay:true,textureFree:true,sourceLayer:kind==="state"?"alkis_land:landesgrenze":"berlinermauer:a_grenzmauer"};
    lines.renderOrder=kind==="state"?101:102;root.add(lines);
  }
  return freezeStaticSceneTransforms(root);
}
