import { DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Group } from "three";
import data from "./data/gendarmenQuartierV383.json";
import { createMeasuredPlaceGeometry } from "./measuredPlaceGeometryV381";

type Point = [number, number, number];
type DetailBuilder = {
  minecraft: boolean;
  add(kind: "box" | "column" | "head", at: Point, size: Point, color: number): void;
  beam(a: Point, b: Point, width: number, color: number): void;
  box(at: Point, size: Point, color: number, yaw?: number): void;
};

function candelabrum(b: DetailBuilder, x: number, z: number) {
  const base = 5.36, stone = 0xb8a992, bronze = 0x4d5149, glass = 0xece0b7;
  const stem = (y: number, diameter: number, height: number, color: number) =>
    b.add("column", [x, base + y, z], [diameter, height, diameter], color);
  b.box([x, base + .13, z], [1.01, .26, 1.01], stone);
  b.box([x, base + .88, z], [.76, 1.25, .76], stone);
  b.box([x, base + 1.59, z], [.90, .18, .90], 0xc9bea9);
  stem(2.01,.56,.68,stone); stem(2.43,.61,.17,bronze); stem(3.34,.23,1.72,bronze);
  function lantern(cx: number, y: number, cz: number) {
    b.add("column", [cx,base+y-.18,cz], [.32,.11,.32],bronze);
    b.add("head", [cx,base+y+.05,cz], [.49,.56,.49],glass);
    b.add("column", [cx,base+y+.36,cz], [.47,.1,.47],bronze);
    b.add("head", [cx,base+y+.46,cz], [.33,.21,.33],bronze);
  }
  for (let i=0;i<8;i++) {
    const a = (i+.5) * Math.PI/4, high=i%2===0, span=high?.96:1.13;
    const dx=Math.cos(a), dz=Math.sin(a), y=high?4.99:4.60;
    const joint: Point = [x+span*.68*dx,base+4.17,z+span*.68*dz];
    const outer: Point = [x+span*dx,base+y-.24,z+span*dz];
    b.beam([x,base+3.9,z],joint,.098,bronze); b.beam(joint,outer,.083,bronze);
    lantern(outer[0],y,outer[2]);
  }
  stem(4.62,.12,1.03,bronze); lantern(x,5.35,z);
}

/** The public plaza is a single colour-indexed surface with the mapped interior
 * openings. The surrounding residential streets have their own surface owners. */
export function addGendarmenQuartierV383(root: Group, b: DetailBuilder) {
  const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,flatShading:true,roughness:.95});
  const ground=new Mesh(createMeasuredPlaceGeometry(data.mesh),day);
  ground.position.fromArray(data.mesh.origin); ground.scale.setScalar(.01);
  ground.name="Gendarmenmarkt – vermessenes Pflasterraster und Domgärten";
  ground.userData={dayMaterial:day,nightMaterial:night,textureFree:true,osmKey:"relation/3573535",keepInMinecraft:b.minecraft};
  root.add(ground);
  for (const [x,z] of data.lamps) candelabrum(b,x,z);
  for (const [x1,z1,x2,z2,wood,back] of data.benches) {
    const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz),yaw=-Math.atan2(dz,dx);
    const x=(x1+x2)/2,z=(z1+z2)/2;
    const tint=wood?0x876c53:0xc6bdac;
    for (const f of [-.32,.32]) b.box([x+dx*f,5.57,z+dz*f],[.23,.42,.48],wood?0x555b55:0xa89e90,yaw);
    b.box([x,5.84,z],[length,.15,.56],tint,yaw);
    if (wood) for (const f of [-.25,.25]) b.box([x+dx*f,6.02,z+dz*f],[.055,.20,.54],0x474d49,yaw);
    if (back) b.box([x-.22*dz/length,6.04,z+.22*dx/length],[length,.25,.065],tint,yaw);
  }
  for (const [x,z] of data.drink) {
    b.add("column",[x,5.8,z],[.37,.88,.37],0x558178);
    b.add("column",[x,6.24,z],[.47,.10,.47],0x80978d);
  }
}
