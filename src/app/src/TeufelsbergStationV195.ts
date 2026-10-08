import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import source from "./data/teufelsbergStationV195.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const TEUFELSBERG_STATION_V195_PROFILE = {
  bounds: [-9026,2092,-8866,2291],
  budgetBytes: 1_800_000,
  sourceDatum: "NHN minus 30 metres, no terrain shift",
  cameras: {
    overview: {position:[-8750,190,2340],target:[-8940,108,2175],spanM:360},
    tower: {position:[-8850,145,2050],target:[-8938.439,122,2115.111],spanM:135},
  },
} as const;

/** Five source-bound radomes and all measured surrounding station blocks. */
export function createTeufelsbergStationV195(native = false): Group {
  const root = new Group();
  root.name = "Teufelsberg former listening station: measured blocks and five radomes v195";
  root.userData = { teufelsbergStationV195:true, textureFree:true, fullStaticDetailOnTouch:true, blockNative:native, keepInMinecraft:native, sourceDatumNHN:30 };
  if (native) {
    const mesh = justicePalaceV183Boxes(source.blocks,true);
    mesh.name = "Independent exterior station blocks and five stepped spherical caps";
    root.add(mesh);
    return freezeStaticSceneTransforms(root);
  }
  const length = source.surfaces.reduce((n,s)=>n+s.triangles.length*9,0);
  const positions = new Float32Array(length), colors = new Float32Array(length), color = new Color();
  let offset = 0;
  for (const surface of source.surfaces) {
    color.setHex(surface.color);
    for (const t of surface.triangles) for (const p of t) {
      positions.set(p,offset);color.toArray(colors,offset);offset+=3;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position",new BufferAttribute(positions,3));
  geometry.setAttribute("color",new BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const night = new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.9,flatShading:true});
  const mesh = new Mesh(geometry,day);
  mesh.name = "Complete station source sheets with five explicit radome profile corrections";
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};
  root.add(mesh);
  const frame = justicePalaceV183Boxes(source.boxes);
  frame.name="Open tower frame and platform rings";root.add(frame);
  const linePositions = new Float32Array(source.lines.length*6), lineColors = new Float32Array(source.lines.length*6);
  source.lines.forEach((line,i)=>{
    linePositions.set(line[0] as number[],i*6);linePositions.set(line[1] as number[],i*6+3);
    color.setHex(line[2] as number);color.toArray(lineColors,i*6);color.toArray(lineColors,i*6+3);
  });
  const linesGeometry = new BufferGeometry();
  linesGeometry.setAttribute("position",new BufferAttribute(linePositions,3));linesGeometry.setAttribute("color",new BufferAttribute(lineColors,3));
  linesGeometry.computeBoundingBox();linesGeometry.computeBoundingSphere();
  const lineDay = new LineBasicMaterial({vertexColors:true}),lineNight = new LineBasicMaterial({vertexColors:true});
  const seams = new LineSegments(linesGeometry,lineDay);seams.name="Code-authored radome panel seams";
  seams.userData={dayMaterial:lineDay,nightMaterial:lineNight,textureFree:true};root.add(seams);
  return freezeStaticSceneTransforms(root);
}
