import {
  BoxGeometry, BufferAttribute, BufferGeometry, Camera, Color, DoubleSide, Group,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, Points, PointsMaterial, SphereGeometry, Vector3,
} from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type PlanPoint = readonly [number, number];
type Point = readonly [number, number, number];
type Stand = readonly [number, number, number, number, number, number, number, number];
const stands: readonly Stand[] = [
  // Stand node, connection inside the retained gate head, node and wall source IDs.
  [8692.18,17178.05,8707.24,17155.13,8066123510,1082978641,.93969,-.34202],
  [8728.12,17304.33,8752.10,17278.46,8066123502,1082978638,.93969,-.34202],
  [8778.64,17433.02,8796.95,17401.76,8066123492,1083495136,.93969,-.34202],
  [8835.01,17590.86,8856.80,17566.16,8526110711,1083495133,.93969,-.34202],
  [8878.86,17715.47,8901.65,17689.46,8526110701,1083495130,.93969,-.34202],
  [9114.47,17776.80,9085.50,17766.01,6310545703,1082978620,-.34202,-.93969],
  [9238.11,17732.40,9208.81,17721.14,9270057603,1082978614,-.34202,-.93969],
  [9319.43,17702.62,9290.98,17691.21,9270057609,1082978610,-.34202,-.93969],
];
const tower: Point = [8336.48,73.62,17571.21];
const cell = (x: number, z: number) => Math.floor(x/512) + "_" + Math.floor(z/512);
const airportCell = (x: number, z: number) => "ber236-" + cell(x,z);
const towerTile = airportCell(tower[0],tower[2]);
const ivory = 0xe5e6dd, graphite = 0x344653, metal = 0xa8b1ae, shadow = 0x505d60;

/** Geometry lives in one tile-local colour batch, with a geographic transform
 * on the parent. Each native planar part is sampled on cardinal strips. */
class AirfieldBatch {
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  private readonly normals:number[]=[];
  private readonly indices:number[]=[];
  private readonly corners=new Map<string,number>();
  private readonly palette = new Map<number, Color>();
  constructor(readonly native: boolean, readonly x0: number, readonly z0: number) {}
  tri(a: Point,b: Point,c: Point,paint: number): void {
    let color=this.palette.get(paint);
    if (!color) { color=new Color(paint); this.palette.set(paint,color); }
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,n=Math.hypot(nx,ny,nz);
    if(n<1e-10)return;
    const normal=[Math.round(nx/n*127),Math.round(ny/n*127),Math.round(nz/n*127)];
    const shade=.74+.26*Math.abs(ny/n)+.035*nx/n-.025*nz/n;
    const face=normal.join(",")+":"+paint+":";
    for(const p of [a,b,c]){
      const x=Math.round((p[0]-this.x0)*100),y=Math.round(p[1]*100),z=Math.round((p[2]-this.z0)*100);
      const key=face+x+","+y+","+z;
      let index=this.corners.get(key);
      if(index===undefined){
        index=this.positions.length/3;this.corners.set(key,index);
        this.positions.push(x,y,z);this.normals.push(...normal);
        this.colors.push(Math.min(65535,Math.round(color.r*shade*65535)),Math.min(65535,Math.round(color.g*shade*65535)),Math.min(65535,Math.round(color.b*shade*65535)));
      }
      this.indices.push(index);
    }
  }
  quad(a: Point,b: Point,c: Point,d: Point,paint: number): void {
    this.tri(a,b,c,paint);this.tri(a,c,d,paint);
  }
  /** The input footprints are convex. Omit buried bottoms on top-only paint. */
  shell(ring: readonly PlanPoint[],low: number,high: number,paint: number):void {
    const p=(v:PlanPoint,y:number):Point=>[v[0],y,v[1]];
    for(let i=1;i+1<ring.length;i++) {
      this.tri(p(ring[0],high),p(ring[i],high),p(ring[i+1],high),paint);
      if(high-low>.04)this.tri(p(ring[0],low),p(ring[i+1],low),p(ring[i],low),paint);
    }
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      this.quad(p(a,low),p(b,low),p(b,high),p(a,high),paint);
    }
  }
  box(x:number,z:number,w:number,d:number,low:number,high:number,paint:number):void {
    this.shell([[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]],low,high,paint);
  }
  prism(ring: readonly PlanPoint[],low:number,high:number,paint:number,step=.8):void {
    if(!this.native){this.shell(ring,low,high,paint);return;}
    const zmin=Math.min(...ring.map(p=>p[1])), zmax=Math.max(...ring.map(p=>p[1]));
    // Clip cardinal rows through the source polygon, also for narrow fittings.
    const rows=Math.max(1,Math.ceil((zmax-zmin)/step)),dz=(zmax-zmin)/rows;
    if(dz<.001)return;
    for(let j=0;j<rows;j++){
      const z=zmin+(j+.5)*dz,hits:number[]=[];
      for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length];
        if((a[1]>z)!==(b[1]>z)) hits.push(a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]));
      }
      hits.sort((a,b)=>a-b);
      for(let i=1;i<hits.length;i+=2)if(hits[i]-hits[i-1]>.015)
        this.box((hits[i]+hits[i-1])/2,z,hits[i]-hits[i-1],dz,low,high,paint);
    }
  }
  finish():Mesh {
    const geometry=new BufferGeometry();
    geometry.setAttribute("position",new BufferAttribute(new Int16Array(this.positions),3));
    geometry.setAttribute("normal",new BufferAttribute(new Int8Array(this.normals),3,true));
    geometry.setIndex(this.indices);
    geometry.setAttribute("color",new BufferAttribute(new Uint16Array(this.colors),3,true));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
    const night=new MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.82,side:DoubleSide});
    const mesh=new Mesh(geometry,day);mesh.scale.setScalar(.01);
    mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:this.native,keepInMinecraft:this.native};
    return mesh;
  }
}

function aircraft(batch:AirfieldBatch,cx:number,cz:number,ux:number,uz:number,scale:number,accent:number):PlanPoint {
  const p=(along:number,left:number,height:number):Point=>
    [cx+(along*ux+left*uz)*scale,3.05+height*scale,cz+(along*uz-left*ux)*scale];
  const xz=(along:number,left:number):PlanPoint=>{const v=p(along,left,0);return [v[0],v[2]];};
  const skin=(ring:PlanPoint[],low:number,high:number,paint:number,step=.8)=>
    batch.prism(ring.map(([u,v])=>xz(u,v)),3.05+low*scale,3.05+high*scale,paint,step*scale);
  const sections=[
    [-17.3,.14,4.3],[-14.4,.95,3.9],[-9,1.84,3.3],[-5.8,2.04,3.15],
    [8.3,2.04,3.15],[12.6,1.88,3.1],[15.2,1.43,2.9],[17.1,.69,2.68],[17.8,.08,2.65],
  ];
  const body=(along:number,radius:number,y:number,angle:number) =>
    p(along,Math.cos(angle)*radius,y+Math.sin(angle)*radius*.94);
  if (!batch.native) {
    for(let i=1;i<sections.length;i++)for(let j=0;j<12;j++) {
      const a=sections[i-1],b=sections[i],t=j*Math.PI/6,s=(j+1)*Math.PI/6;
      batch.quad(body(a[0],a[1],a[2],t),body(b[0],b[1],b[2],t),body(b[0],b[1],b[2],s),body(a[0],a[1],a[2],s),j>=7&&j<=10?0xc3cac7:ivory);
    }
  } else {
    for(let i=1;i<sections.length;i++) {
      const a=sections[i-1],b=sections[i],width=(a[1]+b[1])*.5;
      const outline:PlanPoint[]=[[a[0],-a[1]],[b[0],-b[1]],[b[0],b[1]],[a[0],a[1]]];
      const y=(a[2]+b[2])*.5;skin(outline,y-width*.76,y+width*.51,ivory,1.45);
      if(width>.75) skin(outline.map(([u,v])=>[u,v*.76]),y+width*.51,y+width*.94,ivory,1.45);
    }
  }
  const wingTip = 17;
  for(const side of [-1,1]){
    const wing:PlanPoint[]=[[3.1,1.1],[-3.8,wingTip],[-5.5,wingTip+.33],[-5.9,wingTip-1.1],[-4.8,1.1]];
    skin(wing.map(([u,v])=>[u,v*side]),2.5,2.85,metal,1.4);
    if(!batch.native) skin([[2.97,1.2*side],[-3.82,wingTip*side],[-4.28,wingTip*side],[2.40,1.2*side]],2.85,2.89,0xc7cfce,1.4);
    if(!batch.native){
      batch.quad(p(-3.8,wingTip*side,2.86),p(-5.48,(wingTip+.28)*side,2.86),
        p(-5.65,(wingTip+.86)*side,4.08),p(-4.7,(wingTip+.76)*side,4.08),accent);
    }else skin([[-3.8,wingTip*side],[-5.5,(wingTip+.28)*side],[-5.5,(wingTip+.67)*side],[-4.4,(wingTip+.5)*side]],2.85,3.68,accent);
    skin([[-11.6,.4*side],[-15.5,6.1*side],[-16.9,6.1*side],[-15.2,.4*side]],3.8,4.03,metal,1.1);
    const offset=6.1;
    {
      skin([[2.75,(offset-.64)*side],[2.75,(offset+.64)*side],[-.45,(offset+.75)*side],[-1.2,offset*side],[-.45,(offset-.75)*side]],1.08,2.57,metal);
        skin([[2.75,(offset-.54)*side],[2.81,(offset-.54)*side],[2.81,(offset+.54)*side],[2.75,(offset+.54)*side]],1.45,2.24,graphite,.45);
    }
    for(let i=0;i<15;i++){
      const u=-6.5+i*1.05;
      if(batch.native) {const c=xz(u,side*2.05);batch.box(c[0],c[1],.5*scale,.48*scale,3.05+3.27*scale,3.05+3.78*scale,graphite);}
      else batch.quad(p(u,side*2.05,3.29),p(u+.44,side*2.05,3.29),p(u+.44,side*1.98,3.81),p(u,side*1.98,3.81),graphite);
    }
    if(!batch.native){
      // Two windshield panes follow the actual tapered upper nose rather
      // than a flat rectangle buried inside the solid fuselage.
      const glass=(u:number,r:number,y:number,t:number)=>p(u,side*(r+.045)*Math.cos(t),y+(r+.045)*.94*Math.sin(t));
      for(const [a,b] of [[.22,.72],[.76,1.46]]){
        batch.quad(glass(12.82,1.84,3.08,a),glass(15.18,1.43,2.9,a+.04),
          glass(15.18,1.43,2.9,b),glass(12.82,1.84,3.08,b),graphite);
      }
    }
    else skin([[12.7,side*1.7],[15.2,side*.99],[15.2,side*.62],[12.7,side*1.27]],3.64,4.15,graphite,.65);
  }
  // Triangular fin with a single muted, unliveried paint field.
  if(!batch.native) {
    const q=(s:number)=>[p(-15.9,s,4.05),p(-9.1,s,4.05),p(-14.9,s,9.35),p(-16.45,s,9.35)];
    const l=q(-.18),r=q(.18);batch.quad(l[0],l[1],l[2],l[3],accent);batch.quad(r[3],r[2],r[1],r[0],accent);
    for(let i=0;i<4;i++)batch.quad(l[i],l[(i+1)%4],r[(i+1)%4],r[i],accent);
  }else for(let i=0;i<5;i++){
    const a=-15.9-i*.11,b=-9.1-i*1.15;
    skin([[a,-.3],[b,-.3],[b,.3],[a,.3]],4.05+i*1.06,4.05+(i+1)*1.06,accent,.7);
  }
  for(const [along,left] of [[9.6,0],[-2.0,-2.3],[-2.0,2.3]]) {
    const c=xz(along,left);
    batch.box(c[0],c[1],.74*scale,.67*scale,3.05,3.05+.89*scale,graphite);
    batch.box(c[0],c[1],.29*scale,.29*scale,3.05+.8*scale,3.05+2.7*scale,shadow);
  }
  return xz(10.5,2.05);
}

function jetBridge(batch: AirfieldBatch, anchor:PlanPoint, door:PlanPoint):void {
  const dx=door[0]-anchor[0],dz=door[1]-anchor[1],len=Math.hypot(dx,dz);
  const normal:PlanPoint=[-dz/len,dx/len];
  const xz=(t:number,offset:number):PlanPoint=>[anchor[0]+dx*t+normal[0]*offset,anchor[1]+dz*t+normal[1]*offset];
  const tube=(t0:number,t1:number,side:number,width:number,low:number,high:number,paint:number)=>
    batch.prism([xz(t0,side-width/2),xz(t1,side-width/2),xz(t1,side+width/2),xz(t0,side+width/2)],low,high,paint);
  tube(-.075,.54,0,2.95,6.19,8.72,0xb9c6c8);tube(.54,.92,0,2.63,6.18,8.54,0xcdd3cd);
  for(const sign of [-1,1]) {
    tube(.03,.52,sign*1.48,.07,6.94,8.24,0x739096);
    tube(.55,.91,sign*1.324,.055,6.91,8.06,0x739096);
    for(let i=1;i<8;i++){
      const t=i/8; tube(t,t+.012,sign*(t<.54?1.52:1.36),.08,6.84,8.26,metal);
    }
  }
  tube(.92,1.01,0,3,6.16,8.62,0x586466);
  const cart=xz(.76,0);batch.box(cart[0],cart[1],1.15,1.15,3.16,6.18,shadow);
  for(const side of [-1,1]){const w=xz(.76,side*.84);batch.box(w[0],w[1],.8,.66,3.05,3.85,graphite);}
}

// Digitised positions, noses, spans and finishes of four exterior museum
// exhibits in Berlin's spring 2026 orthophoto. Nearby older OSM points drift
// by several metres on this moving outdoor collection; use its photographed pose.
type Exhibit = readonly [number,number,number,number,number,number,number,number];
const gatow: readonly Exhibit[] = [
  [-15559.76,4689.54,-.991,-.131,29.79,39.57,0xbac1ac,4],
  [-15529.54,4647.20,-.992,-.123,22.74,28.44,0xd4d6c3,2],
  [-15477.31,4633.55,-.973,-.232,12.03,22.51,0xd5d9d1,2],
  [-15448.48,4629.37,-.996,-.087,19.29,18.68,0xdfad54,0],
];
const nord262:Exhibit=[1985.91,4640.55,-.98,-.2,19.13,22.27,0xd8dbd3,0];
function historicAircraft(batch:AirfieldBatch,record:Exhibit):void {
  const [x,z,ux,uz,length,span,paint,engines]=record;
  const point=(u:number,v:number):PlanPoint=>[x+length*u*ux+span*v*uz,z+length*u*uz-span*v*ux];
  const height=Math.max(1.8,length*.099),base=3.07+height*.31;
  const draw=(shape:PlanPoint[],low:number,high:number,color:number)=>batch.prism(shape.map(([u,v])=>point(u,v)),low,high,color,.84);
  const wheel=(u:number,v:number)=>{const p=point(u,v);batch.box(p[0],p[1],.46,.46,3.05,base+.1,shadow);};
  wheel(.29,0);wheel(-.02,.13);wheel(-.02,-.13);
  const hull:PlanPoint[]=[[.50,0],[.44,.035],[.25,.05],[-.15,.046],[-.48,.015],[-.5,0],[-.47,-.015],[-.15,-.046],[.25,-.05],[.44,-.035]];
  draw(hull,base,base+height*.68,paint);
  draw(hull.map(([u,v])=>[u*.90,v*.76]),base+height*.68,base+height*.92,paint);
  draw([[.38,-.036],[.43,-.022],[.43,.022],[.38,.036],[.335,.033],[.335,-.033]],base+height*.84,base+height*.97,graphite);
  for(const sign of [-1,1]){
    draw([[.14,0],[.085,sign*.34],[.055,sign*.5],[-.035,sign*.49],[-.112,sign*.24],[-.14,0]],base+height*.59,base+height*.74,paint);
    draw([[-.34,0],[-.405,sign*.19],[-.475,sign*.18],[-.46,0]],base+height*.48,base+height*.59,paint);
    for(const v of (engines===4?[.15,.29]:engines===2?[.18]:[])) {
      draw([[.17,sign*(v-.016)],[.17,sign*(v+.016)],[-.036,sign*(v+.019)],[-.072,sign*v],[-.036,sign*(v-.019)]],base+height*.34,base+height*.72,metal);
    }
  }
  for(let i=0;i<4;i++) {
    const end=-.32-i*.034;
    draw([[-.495,-.009],[end,-.009],[end,.009],[-.495,.009]],base+height*(.5+i*.26),base+height*(.77+i*.26),i===3?shadow:paint);
  }
}
const tegNorthX=[-6972,-6687,-6406,-6125,-5844,-5560,-5280,-4995];
const txlWest=[-7049.8,-4479.8] as const;
const txlTile=(x:number,z:number)=>"tegel346-"+cell(x,z);
const txlZ=(x:number)=>-4477.37-(x+7067.74)*.13595;
function obsoleteRunwayPaint(batch:AirfieldBatch,tile:string):number {
  let marks=0;
  const stripe=(x:number,z:number,dx:number,dz:number,length:number,width:number,paint:number)=>{
    const n=Math.hypot(dx,dz);dx/=n;dz/=n;
    const p=(u:number,v:number):PlanPoint=>[x+u*dx-v*dz,z+u*dz+v*dx];
    batch.prism([p(-length/2,-width/2),p(length/2,-width/2),p(length/2,width/2),p(-length/2,width/2)],3.15,3.17,paint,1.45);
  };
  for(const x of tegNorthX)if(txlTile(x,txlZ(x))===tile){
    // Faded Xs explicitly designate the former runway in the source image.
    stripe(x,txlZ(x),.948,.278,39,1.8,0xd6d7c8);
    stripe(x,txlZ(x),.870,-.485,39,1.8,0xd6d7c8);marks++;
  }
  if(txlTile(...txlWest)===tile)for(const side of [-1,1])for(const v of [2.7,5.95,9.2,12.45,15.7,18.95]){
    stripe(txlWest[0]+side*.134*v,txlWest[1]+side*.991*v,.991,-.134,29.6,1.64,0xd4d5ca);marks++;
  }
  return marks;
}

const gatowTile="kladow346--31_9",tempelhofTile="ring182-3_9";
export const TRANSPORT_AIRPORT_TILES_V378:readonly string[]=Object.freeze([...new Set([
  ...stands.map(s=>airportCell(s[0],s[1])),towerTile,gatowTile,tempelhofTile,
  ...tegNorthX.map(x=>txlTile(x,txlZ(x))),txlTile(...txlWest),
])]);

/** Selection is bound to exactly one ordinary existing geographical host.
 * The returned local batch already carries its geographic world translation.
 * Attach under the caller's inverse-tile-origin container like other details. */
export function createTransportAirportsV378(tile:string,native=false): Group | undefined {
  if(!TRANSPORT_AIRPORT_TILES_V378.includes(tile))return;
  const found=tile.match(/-(-?\d+)_(-?\d+)$/)!;
  const x0=Number(found[1])*512+256,z0=Number(found[2])*512+256;
  const batch=new AirfieldBatch(native,x0,z0),root=new Group();root.position.set(x0,0,z0);
  root.name="Flugplätze und ziviles Vorfeld v378";
  root.userData={transportAirportsV378:true,blockNative:native,nativeMinecraft:native,textureFree:true,keepInMinecraft:native,
    civilianStandsV378:[] as number[],gateHeadsV378:[] as number[],museumExhibitsV378:0};
  for(const [x,z,ax,az,id,head,ux,uz] of stands) {
    if(airportCell(x,z)!==tile)continue;
    const accents=[0x788b91,0x798b83,0x727f8c];
    const door=aircraft(batch,x,z,ux,uz,1,accents[id%accents.length]);
    jetBridge(batch,[ax,az],door);
    root.userData.civilianStandsV378.push(id);root.userData.gateHeadsV378.push(head);
  }
  if(tile===gatowTile || tile===tempelhofTile){
    const exhibits=tile===gatowTile?gatow:[nord262];
    for(const exhibit of exhibits)historicAircraft(batch,exhibit);
    root.userData.museumExhibitsV378=exhibits.length;
  }
  if(tile.startsWith("tegel346-"))root.userData.disusedRunwayMarksV378=obsoleteRunwayPaint(batch,tile);
  if(batch.positions.length){
    const mesh=batch.finish();
    mesh.name=tile.startsWith("tegel346-")?"Tegel · Sperrkreuze und alte Schwellenmarkierung":
      tile===gatowTile?"Gatow · Freilichtausstellung":tile===tempelhofTile?"Tempelhofer Feld · historisches Übungsflugzeug":
      "BER · Zivilflugzeuge und ausgefahrene Fluggastbrücken";
    root.add(mesh);
  }
  if(tile===towerTile){
    const paint=new MeshBasicMaterial({color:0xff8d67,toneMapped:false});
    const lamp=new Mesh(native?new BoxGeometry(1.4,1.4,1.4):new SphereGeometry(.81,10,6),paint);
    lamp.name="BER · dekoratives Towerlicht";
    lamp.position.set(tower[0]-x0,tower[1],tower[2]-z0);
    lamp.userData={dayMaterial:paint,nightMaterial:paint,textureFree:true,blockNative:native,keepInMinecraft:native};
    root.add(lamp);
    // The small lens stays recognisable when a distant roof is only a few
    // pixels high. One depth-tested procedural point needs no light or texture.
    const haloGeometry=new BufferGeometry();
    haloGeometry.setAttribute("position",new BufferAttribute(new Float32Array([0,0,0]),3));
    const glow=new PointsMaterial({color:0xffab82,size:7,sizeAttenuation:false,transparent:true,opacity:.66,depthWrite:false,toneMapped:false});
    glow.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",
        "#include <color_fragment>\n diffuseColor.a *= 1.0 - smoothstep(0.05, 0.5, length(gl_PointCoord - 0.5));");
    };
    const halo=new Points(haloGeometry,glow);halo.name="BER · Lichtschein";halo.position.copy(lamp.position);
    halo.userData={dayMaterial:glow,nightMaterial:glow,textureFree:true,blockNative:native,keepInMinecraft:native};
    root.add(halo);
    const point=new Vector3(...tower),screen=new Vector3();
    let bright=true;
    // A faint baseline is visible in both states. No timer, point light,
    // network source or work off-screen; the viewer owns single-frame requests.
    root.userData.updateTransportAirportsV378=(timestamp:number,camera:Camera,reducedMotion:boolean):boolean=>{
      if(camera.position.distanceToSquared(point)>2100**2){
        if(!halo.visible)return false;
        halo.visible=false;return true;
      }
      screen.copy(point).project(camera);
      if(Math.abs(screen.x)>1.03||Math.abs(screen.y)>1.03||Math.abs(screen.z)>1)return false;
      const next=reducedMotion||Math.sin(timestamp*.0026)>.18;
      if(next===bright && halo.visible===next)return false;
      halo.visible=next;
      bright=next;paint.color.setHex(next?0xff8d67:0x713b34);return true;
    };
  }
  return freezeStaticSceneTransforms(root);
}
