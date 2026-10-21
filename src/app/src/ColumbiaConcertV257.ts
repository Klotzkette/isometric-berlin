import {
  AdditiveBlending, BoxGeometry, Color, ConeGeometry, DoubleSide, Group,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera,
  Quaternion, Scene, SphereGeometry, Vector3,
} from "three";

type Row = [number, number, number, number, number, number, number];
const BLACK = 0x111219;
export const COLUMBIA_CONCERT_V257 = Object.freeze({
  illustrative: true, sourceShellUnchanged: true, textureFree: true,
  audio: false, independentNativeGeometry: true, sameMobileDetail: true,
  audience: 330, beamCount: 8, cycleSeconds: 24,
});

/** A bounded, explicitly illustrative stage view, independently built in each
 * family. Not an as-built room survey; no collision/roof/terrain changes. */
export function createColumbiaConcertV257(native: boolean) {
  const scene = new Scene();
  scene.background = new Color(0x06070e);
  const root = new Group();
  root.name = "Columbiahalle — illustrative silent concert";
  root.userData = { ...COLUMBIA_CONCERT_V257, native };
  scene.add(root);
  const camera = new PerspectiveCamera(65, 1, .1, 100);
  camera.position.set(0, 2.35, 12.2);
  camera.lookAt(0, 4, -14);
  const boxes: Row[] = [];
  const add = (x:number,y:number,z:number,w:number,h:number,d:number,c=BLACK) => boxes.push([x,y,z,w,h,d,c]);
  add(0,-.15,0,34,.3,40,0x15141c);
  add(-17,5,0,.3,10,40,0x191723); add(17,5,0,.3,10,40,0x191723);
  add(0,10,0,34,.25,40,0x14131d); add(0,4.6,-20,34,9.2,.2,0x08090e);
  add(0,.55,-14,26,1.1,10,0x17151d);
  for (const x of [-12,12]) add(x,3.4,-12.5,1.3,4.6,1.25,0x0b0c10);
  for (const x of [-15.4,15.4]) {
    add(x,4.1,3,2.8,.24,29,0x24222a);
    add(x > 0 ? 14 : -14,4.7,3,.13,1,29,0x34303b);
  }
  for (const z of [-14,-7,0,7,14]) {
    add(0,9.2,z,33,.22,.23,0x36333e);
    add(0,8.6,z,33,.12,.12,0x292630);
    for (let x=-15;x<=15;x+=3) add(x,8.9,z,.12,.65,.12,0x39333f);
  }
  // Three anonymous performers and simple equipment, not identifiable people.
  for (const x of [-7,0,6]) {
    add(x,2.25,-14.2,.55,1.3,.36,0x14131b);
    add(x-.15,1.45,-14.2,.16,.7,.18); add(x+.15,1.45,-14.2,.16,.7,.18);
    add(x,3.05,-14.2,.34,.38,.34,0x22202a);
    add(x+.5,2,-13.9,.05,1.8,.05,0x39323e);
  }
  add(-6,2.1,-14,2,.16,.6,0x37303b);
  add(5.3,1.6,-15.6,2.6,.8,1.1,0x302532);
  const heads: Row[] = [];
  for(let row=0;row<15;row++) for(let column=0;column<22;column++) {
    const seed=(row*31+column*17)%19;
    const x=(column-10.5)*1.03 + Math.sin(seed)*.16;
    const z=-7.7+row*1.28;
    const h=1.44+(seed%7)*.055;
    const c=[0x171621,0x211b2c,0x141420,0x282031][seed%4];
    add(x,h*.48,z,.52,h*.9,.34,c);
    heads.push([x,h+.11,z,.36,.42,.36,c]);
  }
  const matrix = new Matrix4(), color = new Color();
  function batch(rows:Row[], head=false) {
    const geometry = head && !native ? new SphereGeometry(.5,8,6) : new BoxGeometry(1,1,1);
    geometry.deleteAttribute("normal"); geometry.deleteAttribute("uv");
    const mesh = new InstancedMesh(geometry,new MeshBasicMaterial(),rows.length);
    rows.forEach(([x,y,z,w,h,d,c],i)=>{
      matrix.makeScale(w,h,d).setPosition(x,y,z);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setHex(c));
    });
    mesh.instanceMatrix.needsUpdate=true;
    mesh.instanceColor!.needsUpdate=true;
    mesh.name=head ? "Anonymous audience heads" : "Stage, balcony, trusses and audience";
    mesh.userData.blockNative=native;
    root.add(mesh);
  }
  batch(boxes); batch(heads,true);
  const beams: Mesh[] = [];
  const beamGeometry = native ? new BoxGeometry(1,1,1) : new ConeGeometry(1,1,16,1,true);
  beamGeometry.deleteAttribute("normal");beamGeometry.deleteAttribute("uv");
  for(let i=0;i<8;i++) {
    const material=new MeshBasicMaterial({color:0x7361ff,transparent:true,opacity:.11,blending:AdditiveBlending,depthWrite:false,side:DoubleSide});
    if(native) {
      const mesh=new InstancedMesh(beamGeometry,material,24);
      mesh.userData.blockNative=true;beams.push(mesh);root.add(mesh);
    } else {
      const mesh=new Mesh(beamGeometry,material);beams.push(mesh);root.add(mesh);
    }
  }
  const up=new Vector3(0,1,0), source=new Vector3(), target=new Vector3(), axis=new Vector3(), midpoint=new Vector3();
  const quaternion=new Quaternion();
  const palette=[new Color(0x3b65ff),new Color(0x9f38e5),new Color(0xe74059),new Color(0xe1ddff)];
  let disposed=false;
  function update(seconds:number,reducedMotion=false) {
    if(disposed)return;
    const t=reducedMotion?2:seconds, cycle=(t%24)/6, phase=Math.floor(cycle);
    const wave=t*Math.PI/12;
    const mix=reducedMotion?.22:(cycle-phase);
    color.copy(palette[phase]).lerp(palette[(phase+1)%4],mix);
    for(let i=0;i<8;i++) {
      source.set((i-3.5)*3.25,8.6,-13.7+(i%2)*3);
      target.set((i-3.5)*2.2+Math.sin(wave+i)*4,.6,-1+Math.cos(wave*2+i*.7)*5);
      const material=beams[i].material as MeshBasicMaterial;
      material.color.copy(color).lerp(palette[3],i%3===0?.38:0);
      // Slow soft pulses; no high-frequency strobe, reduced-motion is static.
      material.opacity=reducedMotion?.065:.055+.055*(.5+.5*Math.sin(wave*6+i));
      if(native) {
        const mesh=beams[i] as InstancedMesh;
        for(let j=0;j<24;j++) {
          const p=(j+.5)/24;
          midpoint.copy(source).lerp(target,p);
          const width=.13+p*3.6;
          matrix.makeScale(width,.39,width).setPosition(midpoint);mesh.setMatrixAt(j,matrix);
        }
        mesh.instanceMatrix.needsUpdate=true;
        mesh.computeBoundingSphere();
      } else {
        axis.copy(source).sub(target);const length=axis.length();
        midpoint.copy(source).add(target).multiplyScalar(.5);
        beams[i].position.copy(midpoint);
        beams[i].scale.set(2.7,length,2.7);
        beams[i].quaternion.copy(quaternion.setFromUnitVectors(up,axis.normalize()));
      }
    }
  }
  update(0);
  return {scene,camera,root,update,dispose(){
    if(disposed)return;disposed=true;
    const geometries=new Set(),materials=new Set();
    root.traverse(o=>{if(o instanceof Mesh){if(o instanceof InstancedMesh)o.dispose();geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    for(const g of geometries)(g as BoxGeometry).dispose();
    for(const m of materials)(m as MeshBasicMaterial).dispose();
    root.clear();scene.clear();
  }};
}
