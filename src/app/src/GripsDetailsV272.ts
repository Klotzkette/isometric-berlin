import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { GRIPS_ENTRANCE, GRIPS_THEATRE_WEST, GRIPS_THEATRE_SOUTH, gripsAxisLength, gripsAxisPoint, type GripsAxis } from './gripsHansaplatzProfile';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

/** Additive recognition only: the complete v139 theatre, courts and links survive. */
export function createGripsDetailsV272(native = false, _options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = 'GRIPS v272 additive entrance and exterior-stair fittings';
  const matrices: number[] = [], colors: number[] = [], m = new Matrix4(), q = new Quaternion(), color = new Color(), up = new Vector3(0,1,0);
  const roles: Record<string, number> = {};
  function box(p: number[], s: number[], yaw: number, tone: number, role: string) {
    m.compose(new Vector3(...p as [number,number,number]), q.setFromAxisAngle(up, native ? 0 : yaw), new Vector3(...s as [number,number,number]));
    matrices.push(...m.elements); color.setHex(tone).toArray(colors, colors.length); roles[role] = (roles[role] ?? 0) + 1;
  }
  function face(a: GripsAxis, u: number, y: number, w: number, h: number, depth: number, tone: number, role: string, out = .28) {
    const len = gripsAxisLength(a), dx = (a.b[0]-a.a[0])/len, dz = (a.b[1]-a.a[1])/len;
    if (!native) box(gripsAxisPoint(a,u,y,out),[w,h,depth],-Math.atan2(dz,dx),tone,role);
    else { const n = Math.max(1,Math.ceil(w/.55)); for (let i=0;i<n;i++) box(gripsAxisPoint(a,u-w/2+(i+.5)*w/n,y,out+1.05),[Math.max(.07,Math.abs(dx)*w/n+Math.abs(dz)*depth),h,Math.max(.07,Math.abs(dz)*w/n+Math.abs(dx)*depth)],0,tone,role); }
  }
  // Panel joints and a folded roof-edge cap keep the low pavilion silhouette.
  const west=GRIPS_THEATRE_WEST, wl=gripsAxisLength(west);
  for (const y of [6.15,7.13,12.99]) face(west,wl/2,y,wl-.08,.028,.055,0x8F9994,'metal-panel-horizontal-joint',.16);
  for (const a of [west,GRIPS_THEATRE_SOUTH]) face(a,gripsAxisLength(a)/2,13.56,gripsAxisLength(a),.11,.24,0x7C8782,'folded-parapet-cap',.19);
  // Shallow poster cases flank the retained foyer doors. Colour is not a poster copy.
  const entry=GRIPS_ENTRANCE, el=gripsAxisLength(entry);
  for (const u of [el*.08,el*.91]) {
    face(entry,u,6.75,1.03,1.52,.12,0x465A5C,'foyer-display-case');
    face(entry,u,6.75,.87,1.34,.055,0xE5DDC8,'foyer-display-paper',.36);
    face(entry,u,7.19,.75,.16,.04,0xC83830,'foyer-display-red-header',.41);
    for (const yy of [6.86,6.61,6.36]) face(entry,u,yy,.60,.045,.04,0x5E716E,'foyer-display-graphic-rule',.41);
  }
  // Connect the existing external spiral stair's top tread to its retained door.
  // No speculative new staircase, floor, theatre interior or walking collision.
  face(west,1.85,9.17,1.65,.12,1.7,0xA84937,'spiral-stair-top-landing',.91);
  for (const u of [1.03,2.67]) {
    face(west,u,9.68,.055,1.02,1.55,0x527276,'landing-guardrail-upright',.91);
    face(west,u,10.18,.07,.07,1.58,0x527276,'landing-guardrail-top',.91);
  }
  for (const u of [1.03,2.67]) face(west,u,10.32,.09,2.5,.10,0xA5B2AA,'stair-door-frame',.42);
  face(west,1.85,11.56,1.74,.09,.10,0xA5B2AA,'stair-door-frame',.42);
  const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute('uv');
  const day=new MeshBasicMaterial({color:0xFFFFFF}), night=new MeshStandardMaterial({color:0xFFFFFF,roughness:.85,flatShading:true});
  const mesh=new InstancedMesh(geometry,day,0);mesh.count=colors.length/3;mesh.instanceMatrix=new InstancedBufferAttribute(new Float32Array(matrices),16);mesh.instanceColor=new InstancedBufferAttribute(new Float32Array(colors),3);mesh.computeBoundingBox();mesh.computeBoundingSphere();
  mesh.name='GRIPS roof-edge, foyer and stair-landing additions';mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,fullStaticDetailOnTouch:true,recognitionRoles:roles};
  root.userData={...mesh.userData,sourceEnvelopeRetained:true,additiveOnly:true,noHiddenSolidInfill:true,renderBudget:{drawnBatches:1,nativeBatches:1,instances:mesh.count},referenceStatus:'Display-estimated secondary fittings on retained v139 source axes; no survey precision claimed.'};
  root.add(mesh);return freezeStaticSceneTransforms(root);
}
