import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Mesh, MeshStandardMaterial, Vector3 } from "three";

export const CHANCELLERY_FORECOURT_V281 = {
  osmId: "node/4329873408",
  heightM: 5.5,
  source: "https://www.museum-der-1000-orte.de/kunstwerke/kunstwerk/berlin",
  governmentReference: "https://www.bundesregierung.de/breg-de/bundesregierung/bundeskanzleramt/bundeskanzleramt-mit-ehrenhof-975026",
  replacedNames: ["Eduardo Chillida Berlin sculpture plinth", "Eduardo Chillida Berlin vertical steel body", "Eduardo Chillida Berlin interlocking arm"],
  geometryStatus: "Published 5.5 m overall height; OSM anchor retained. Square-section curved arms, width, depth and the small missing sculpture lawn are photo-guided display estimates, not a scan or a survey.",
} as const;

/** Retire the old authored sculpture only for the delivered, audited owner.
 * An independently changed signature retains its earlier complete fallback. */
export function matchesChancelleryForecourtV281(signature: {
  anchor_world: readonly number[]; rotation_y_degrees: number;
  forecourt_offset_world?: readonly number[] | null;
  forecourt_sculpture_height_m?: number;
}): boolean {
  const point=signature.forecourt_offset_world;
  return !!point && point[0]===158.413 && point[2]===-7.51 &&
    signature.anchor_world[0]===-220.236 && signature.anchor_world[1]===1.554 &&
    signature.anchor_world[2]===-145.806 && signature.rotation_y_degrees===-1.337 &&
    signature.forecourt_sculpture_height_m===5.5;
}

/** Local x/z offsets about the retained artwork node. Photos show two lobes
 * directly beneath the steel feet, without the old large stone plinth. The
 * DOP's building lean/shadow obscures this island, so this is NOT a DOP trace. */
export const CHILLIDA_LAWN_V281: readonly (readonly [number,number])[] = [
  [-2,-3.9],[-1.5,-5],[-.2,-5.3],[1.3,-4.7],[2,-3.6],[1.5,-2.2],
  [1.1,-.9],[1.8,.3],[1.9,2],[1.2,3.9],[.1,4.8],[-1.5,4.6],
  [-2.2,3.2],[-1.8,1.7],[-.7,.6],[-.9,-1.1],[-1.8,-2.4],
];

/** Two original bent iron forms: all coordinates are transverse/y/depth.
 * Rectangular sweeps preserve the open eyes, lower curl and separate tips. */
const DRAWN_ARMS: readonly (readonly (readonly [number,number,number])[])[] = [
  [[-2.25,.43,.15],[-2.25,3.45,.15]],
  [[2.25,.43,-.1],[2.25,3.45,-.1]],
  [[-4.05,3.45,.15],[-2.25,3.45,.15],[-.5,3.8,.15],[.25,3.9,.15]],
  [[4.05,3.45,-.1],[2.25,3.45,-.1],[1.6,3.55,-.1]],
  [[-2.25,3.45,.15],[-1.9,4.3,.15],[-1.25,4.98,.15],[-.35,5.02,.15],[.25,4.4,.15]],
  [[2.25,3.45,-.1],[1.65,3.9,-.1],[1.45,4.85,-.1],[.9,5.02,-.1],[.5,4.1,-.1]],
  [[1.65,3.45,-.1],[1.35,2.55,-.1],[.8,1.95,-.1],[0,1.95,-.1],[-.55,2.55,-.1],[-.6,3.2,-.1]],
  [[-2.25,3.45,.15],[-1.8,3.0,.55],[-1.6,2.3,.65],[-.9,2.25,.65]],
];

/** One texture-free mesh replaces only the seven exact old authored pieces. */
export function createChillidaSculptureV281(x: number, z: number): Mesh {
  const positions: number[]=[];
  const half=.43, halfDepth=.48;
  function face(a: Vector3,b: Vector3,c: Vector3,d: Vector3): void {
    for(const p of [a,b,c,a,c,d]) positions.push(p.x,p.y,p.z);
  }
  for(const controls of DRAWN_ARMS) {
    const curve=new CatmullRomCurve3(controls.map(p=>new Vector3(p[2],p[1],p[0])),false,"centripetal");
    const points=curve.getPoints(controls.length===2?1:24);
    const sections=points.map((p,i)=>{
      const tangent=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]).normalize();
      const normal=new Vector3(0,-tangent.z,tangent.y).normalize().multiplyScalar(half);
      return [-1,1].flatMap(depth=>[-1,1].map(side=>p.clone().addScaledVector(normal,side).add(new Vector3(depth*halfDepth,0,0))));
    });
    for(let i=1;i<sections.length;i++) {
      const a=sections[i-1],b=sections[i];
      for(const [j,k] of [[0,1],[1,3],[3,2],[2,0]])face(a[j],a[k],b[k],b[j]);
    }
    const first=sections[0],last=sections[sections.length-1];
    face(first[0],first[2],first[3],first[1]);face(last[1],last[3],last[2],last[0]);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute("position",new Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();
  // Published overall height applies to the sculpture itself, including the
  // curved crown; no extra 5.5 m column plus unaccounted plinth is introduced.
  const min=geometry.boundingBox!.min.y,max=geometry.boundingBox!.max.y;
  geometry.translate(0,-min,0);geometry.scale(1,5.5/(max-min),1);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=new MeshStandardMaterial({color:0x87513b,metalness:.42,roughness:.78});
  const mesh=new Mesh(geometry,material);
  mesh.name="Eduardo Chillida Berlin curved square-section iron sculpture v281";
  mesh.position.set(x,.21,z);
  mesh.userData={textureFree:true,sourceGeometryRetained:true,fullStaticDetailOnTouch:true,...CHANCELLERY_FORECOURT_V281};
  return mesh;
}

/** Deliberately authored orthogonal courses, independent of the drawn curves. */
export function chillidaNativeRowsV281(x: number,z: number): number[][] {
  const rows: number[][]=[];
  const colour=0xb9684f;
  const add=(u:number,y:number,depth:number,w:number,h:number,d=.9):void=>{rows.push([x+depth,.21+y,z+u,d,h,w,colour]);};
  add(-2.25,1.8,.15,.9,3.6);add(2.25,1.8,-.1,.9,3.6);
  add(-2.6,3.55,.15,3.75,.65);add(3.05,3.55,-.1,2.8,.65);
  // Keep the two crown eyes and the lower U visibly open. The previous .85 m
  // courses met across these gaps and read as a solid plate in the browser.
  add(-1.5,4.15,.15,.65,1.1);add(-.75,4.85,.15,1.65,.65);
  add(.05,4.35,.15,.65,.85);add(1.65,4.1,-.1,.65,1.2);
  add(1.05,4.85,-.1,1.8,.65);add(.45,4.2,-.1,.65,.85);
  add(1.3,2.8,-.1,.65,1.2);add(.4,2.15,-.1,1.8,.65);
  add(-.5,2.8,-.1,.65,1.2);add(-1.6,2.75,.65,.65,1.05);
  add(-1.05,2.25,.65,1.2,.65);
  // Top is the same published 5.5 m; native crown is stepped independently.
  const max=Math.max(...rows.map(r=>r[1]+r[4]/2));
  const scale=5.5/(max-.21);
  for(const row of rows){row[1]=.21+(row[1]-.21)*scale;row[4]*=scale;}
  return rows;
}

export function chillidaNativeLawnV281(x:number,z:number): number[][] {
  // Nine separate cardinal strips retain the two lobes within the existing
  // 5,500-instance architectural budget. They share edges, never top faces.
  return [[-4,2.1,0],[-3,3.2,-.1],[-2,2.2,-.1],[-1,1.7,.1],
    [0,1.7,.4],[1,2.3,.3],[2,3.2,-.1],[3,3.1,-.2],[4,1.9,-.3]]
    .map(([dz,width,dx])=>[x+dx,.12,z+dz,width,.18,1,0x5d9634]);
}
