import { ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Shape } from "three";
import type { PrismBuilding } from "./IsometricCityWorld";
import type { VoxelPayload } from "./terrainPayload";
import { GendarmenmarktFacadeBuilder, perimeterEdgeLength, type PerimeterFacadeEdge } from "./GendarmenmarktFacadeBuilder";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import receipt from "./data/petriExteriorV344.json";

const stone = 0xcecbc1, trim = 0xe0ddd2, glass = 0x526368;
const base = receipt.source.y0_dm / 10, top = base + receipt.heightM;

export function petriSourceAdmittedV344(prisms: readonly PrismBuilding[]): boolean {
  const matched = prisms.filter(p => p.id === receipt.source.id);
  const p = matched[0], r = receipt.source;
  return matched.length === 1 && p.y0_dm === r.y0_dm && p.h_dm === r.h_dm &&
    p.class === r.class && p.roof === r.roof && JSON.stringify(p.ring) === JSON.stringify(r.ring) &&
    JSON.stringify(p.holes ?? []) === JSON.stringify(r.holes) && JSON.stringify(p.tone) === JSON.stringify(r.tone);
}

function edges(): PerimeterFacadeEdge[] {
  const ring = receipt.source.ring;
  const area = ring.reduce((sum, [x,z], i) => { const [xx,zz] = ring[(i+1)%ring.length]; return sum+x*zz-z*xx; },0);
  return ring.map((a,i) => ({startXZ:a.map(n=>n/10),endXZ:ring[(i+1)%ring.length].map(n=>n/10),
    outwardSide:area>0?-1:1,wallBaseY:base,wallTopY:top,street:"PETRI Berlin, Gertraudenstraße 8",prismId:receipt.source.id}));
}

/** A stepped Native face belongs to the same measured elevation as Drawn.
 * A diagonal half-plane also opened the two neighbouring return walls. */
function nativeFront(x: number, z: number, nx: number, nz: number): boolean {
  const candidates = edges().map((edge, index) => {
    const [ax, az] = edge.startXZ, [bx, bz] = edge.endXZ, dx = bx - ax, dz = bz - az;
    const length = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (length * length)));
    return { index, distance: Math.hypot(x - ax - dx * t, z - az - dz * t),
      facing: (-dz * nx + dx * nz) / length * edge.outwardSide };
  }).sort((a, b) => a.distance - b.distance);
  return candidates[0].index === receipt.frontEdge && candidates[0].facing > .4;
}

function facade(b: GendarmenmarktFacadeBuilder, edge: PerimeterFacadeEdge, front: boolean, native: boolean) {
  const length=perimeterEdgeLength(edge), bays=native?1:front?4:Math.max(1,Math.round(length/3.8));
  // Preserve the original lower source body inside a complete new exterior.
  // This is an exterior model, not a claim of a traversable ground-floor arcade.
  b.face(edge,length/2,base+10,length-.015,20,.18,stone,.20);
  b.face(edge,length/2,base+.28,length-.015,.55,.22,0xa5a59e,.24);
  for(let i=0;i<bays;i++) {
    const u=(i+.5)*length/bays, width=Math.min(1.65,length/bays*.60);
    for(const y of [9.15,13.15,17.15]) {
      b.window(edge,u,base+y,width,2.10,trim,0x787e7b,glass,false,.34);
    }
    if(front) {
      b.face(edge,u,base+3.2,length/bays-.75,5.4,.16,0x45545a,.34,"glass");
      b.face(edge,i*length/bays+.31,base+3.2,.62,6.2,.72,trim,.57);
    } else {
      b.window(edge,u,base+3.3,Math.min(1.6,length/bays*.60),3.6,trim,0x787e7b,glass,false,.34);
    }
  }
  if(front) {
    b.face(edge,length-.31,base+3.2,.62,6.2,.72,trim,.57);
    b.face(edge,length/2,base+6.45,length,.6,.70,trim,.56);
    // Open upper loggia: columns and a roof beam, with no solid front backing.
    for(let i=0;i<=bays;i++) b.face(edge,Math.max(.25,Math.min(length-.25,i*length/bays)),
      base+21.95,.50,3.5,.62,trim,.02);
  } else b.face(edge,length/2,base+22,length-.015,4,.48,stone,-.04);
  b.face(edge,length/2,top-.2,length+.05,.4,.70,trim,.06);
  b.face(edge,length/2,top+.025,length+.08,.05,.75,0x929a99,.06);
}

function slab(root: Group, y:number, height:number, color:number) {
  const shape=new Shape();
  receipt.source.ring.forEach(([x,z],i)=>i?shape.lineTo(x/10,-z/10):shape.moveTo(x/10,-z/10));
  shape.closePath();
  const geometry=new ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:1});
  geometry.rotateX(-Math.PI/2);geometry.translate(0,y,0);geometry.deleteAttribute("uv");
  const mesh=new Mesh(geometry,new MeshBasicMaterial({color}));
  mesh.name="PETRI source-plan upper shell";
  mesh.userData.nightMaterial=new MeshStandardMaterial({color,roughness:.9});
  root.add(mesh);
}

/** Source-bound exterior update; no old source, navigation, neighbour or packet is retired. */
export function createPetriExteriorV344(prisms: readonly PrismBuilding[], voxels?:VoxelPayload):Group|null {
  if(!petriSourceAdmittedV344(prisms)) return null;
  const root=new Group(), b=new GendarmenmarktFacadeBuilder(Boolean(voxels),true,0);
  root.name="PETRI Berlin completed exterior";
  if(!voxels) {
    slab(root,base+9,11,stone);slab(root,base+20,.26,0xa6a79f);slab(root,top-.28,.28,trim);
    edges().forEach((edge,i)=>facade(b,edge,i===receipt.frontEdge,false));
  } else {
    if(voxels.cell_m!==4) return null;
    const columns=receipt.nativeColumns;
    const matches=columns.every(([x,z,lo,hi,kind])=>voxels.building_rows?.[z-voxels.grid.min_z_idx]?.some(
      ([start,count,a,c,k])=>x-voxels.grid.min_x_idx>=start&&x-voxels.grid.min_x_idx<start+count&&a===lo&&c===hi&&k===kind)??
      voxels.buildings?.some(row=>JSON.stringify(row)===JSON.stringify([x,z,lo,hi,kind])));
    if(!matches) return null;
    const keys=new Set(columns.map(([x,z])=>`${x}/${z}`));
    for(const [x,z,,hi] of columns) {
      b.box([(x+.5)*4,(hi/10+base+20)/2,(z+.5)*4],[4,base+20-hi/10,4],stone);
      b.box([(x+.5)*4,top-.14,(z+.5)*4],[4,.28,4],trim);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if(keys.has(`${x+dx}/${z+dz}`)) continue;
        const cx=(x+.5+dx/2)*4,cz=(z+.5+dz/2)*4;
        const edge:PerimeterFacadeEdge={startXZ:[cx-dz*2,cz+dx*2],endXZ:[cx+dz*2,cz-dx*2],
          outwardSide:1,wallBaseY:base,wallTopY:top,street:"PETRI native source column",prismId:receipt.source.id};
        const front=nativeFront(cx,cz,dx,dz);
        facade(b,edge,front,true);
      }
    }
  }
  root.add(b.finish("PETRI plaster, windows, colonnade and roof loggia"));
  Object.assign(root.userData,{petriExteriorV344:true,blockNative:Boolean(voxels),keepInMinecraft:Boolean(voxels),
    sourceId:receipt.source.id,heightM:receipt.heightM,heightApproximate:true,originalSourcePreserved:true,groundArcadeWalkable:false});
  return freezeStaticSceneTransforms(root);
}
