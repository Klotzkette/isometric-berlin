import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { GendarmenmarktFacadeBuilder } from "./GendarmenmarktFacadeBuilder";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { addSurveyTreesV380, createSurveySurfaceV380, type PrenzlauerStreetPacketV380 } from "./prenzlauerStreetsV380";
import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";
import index from "./data/wittenbergQuartierIndexV383.json";

type Point = [number,number,number];
type Section = [height:number, xRadius:number, zRadius:number];
const ground = 5.72;
const patina = 0x62776b, bronze = 0x5e594e, granite = 0xb3a398, soil = 0x665b49;

/** Closed radial sections and rounded solids share a single vertex-coloured mesh.
 * The native equivalent uses stacked instanced block courses with the same outline. */
class Fountain {
  readonly blocks: GendarmenmarktFacadeBuilder;
  private readonly positions:number[] = [];
  private readonly colors:number[] = [];
  private readonly indices:number[] = [];
  constructor(readonly x:number, readonly z:number, readonly native:boolean) {
    this.blocks = new GendarmenmarktFacadeBuilder(native,false,0);
  }

  profile(cx:number, cz:number, sections:Section[], tone:number, lobes=0, sides=40, yaw=0) {
    const cos=Math.cos(yaw), sin=Math.sin(yaw);
    if (this.native) {
      for (let j=1;j<sections.length;j++) {
        const [lo,ax,az]=sections[j-1], [hi,bx,bz]=sections[j];
        if (hi<=lo) continue;
        const rx=(ax+bx)/2,rz=(az+bz)/2;
        if (Math.min(rx,rz)<.01) continue;
        const ring=Array.from({length:sides},(_,i)=>{
          const a=i*Math.PI*2/sides,k=1+lobes*Math.cos(a*4);
          const x=rx*Math.cos(a)*k,z=rz*Math.sin(a)*k;
          return [x*cos-z*sin,x*sin+z*cos];
        });
        const low=Math.min(...ring.map(p=>p[1])),high=Math.max(...ring.map(p=>p[1]));
        const count=Math.max(1,Math.ceil((high-low)/.34)), dz=(high-low)/count;
        for(let i=0;i<count;i++) {
          const z=low+(i+.5)*dz,cuts:number[]=[];
          for(let k=0;k<sides;k++) {
            const a=ring[k],b=ring[(k+1)%sides];
            if ((a[1]<=z&&b[1]>z)||(b[1]<=z&&a[1]>z)) cuts.push(a[0]+(z-a[1])*(b[0]-a[0])/(b[1]-a[1]));
          }
          cuts.sort((a,b)=>a-b);
          for(let k=1;k<cuts.length;k+=2) {
            const loX=cuts[k-1],hiX=cuts[k];
            this.blocks.box([this.x+cx+(loX+hiX)/2,ground+(lo+hi)/2,this.z+cz+z],
              [Math.max(.015,hiX-loX),hi-lo,dz],tone);
          }
        }
      }
      return;
    }
    const first=this.positions.length/3, tint=new Color(tone);
    for (let j=0;j<sections.length;j++) {
      const [y,rx,rz]=sections[j];
      for (let i=0;i<sides;i++) {
        const a=i*2*Math.PI/sides, k=1+lobes*Math.cos(a*4);
        const x=Math.cos(a)*rx*k, z=Math.sin(a)*rz*k;
        this.positions.push(this.x+cx+x*cos-z*sin,ground+y,this.z+cz+x*sin+z*cos);
        const light=.79+.17*Math.cos(a+2.4)+j/Math.max(1,sections.length-1)*.09;
        this.colors.push(tint.r*light,tint.g*light,tint.b*light);
        if (j===0) continue;
        const a0=first+(j-1)*sides+i,a1=first+(j-1)*sides+(i+1)%sides;
        this.indices.push(a0,a0+sides,a1+sides,a0,a1+sides,a1);
      }
    }
  }

  apron(corners:number[][]) {
    const cy=ground+.10;
    if(this.native){
      const lo=Math.min(...corners.map(p=>p[1])),hi=Math.max(...corners.map(p=>p[1]));
      const steps=Math.ceil((hi-lo)/.21),dz=(hi-lo)/steps;
      for(let i=0;i<steps;i++) {
        const z=lo+(i+.5)*dz,xs:number[]=[];
        for(let k=0;k<4;k++){
          const a=corners[k],b=corners[(k+1)%4];
          if((a[1]<=z&&b[1]>z)||(b[1]<=z&&a[1]>z)) xs.push(a[0]+(z-a[1])*(b[0]-a[0])/(b[1]-a[1]));
        }
        if(xs.length===2) this.blocks.box([(xs[0]+xs[1])/2,cy,z],[Math.abs(xs[1]-xs[0]),.22,dz],granite);
      }
    }else{
      const off=this.positions.length/3,c=new Color(granite);
      for(const [x,z] of corners) {
        this.positions.push(x,cy+.11,z);this.colors.push(c.r,c.g,c.b);
      }
      this.indices.push(off,off+1,off+2,off,off+2,off+3);
    }
    const middle=corners.reduce((v,p)=>[v[0]+p[0]/4,v[1]+p[1]/4],[0,0]);
    const inset=(a:number[],t:number)=>[middle[0]+(a[0]-middle[0])*t,middle[1]+(a[1]-middle[1])*t];
    for(let i=0;i<4;i++){
      const a=corners[i],b=corners[(i+1)%4];
      for(const [h,scale,w,tone] of [[.225,.985,.17,0xb6ada4],[.228,.91,.11,0x8a8174]]) {
        const u=inset(a,scale),v=inset(b,scale);
        this.beam([u[0]-this.x,h,u[1]-this.z],[v[0]-this.x,h,v[1]-this.z],w,tone);
      }
    }
  }

  ellipsoid(x:number,y:number,z:number,rx:number,ry:number,rz:number,tone:number,yaw=0) {
    const sections:Section[]=[];
    for (let i=0;i<=6;i++) {
      const a=i*Math.PI/6;
      sections.push([y-ry*Math.cos(a),rx*Math.sin(a),rz*Math.sin(a)]);
    }
    this.profile(x,z,sections,tone,0,10,yaw);
  }

  beam(a:Point,b:Point,width:number,tone:number) {
    const start:Point=[this.x+a[0],ground+a[1],this.z+a[2]], end:Point=[this.x+b[0],ground+b[1],this.z+b[2]];
    if (!this.native) { this.blocks.beam(start,end,width,tone); return; }
    const count=Math.ceil(Math.max(...end.map((v,i)=>Math.abs(v-start[i])))/Math.max(.15,width));
    for(let k=0;k<count;k++){
      const p=start.map((v,i)=>v+(end[i]-v)*(k+.5)/count) as Point;
      const sizes=start.map((v,i)=>Math.abs(end[i]-v)/count+width*.70) as Point;
      this.blocks.box(p,sizes,tone);
    }
  }

  finish(name:string) {
    const group=this.blocks.finish(name);
    if (this.indices.length) {
      const geom=new BufferGeometry();
      geom.setAttribute("position",new Float32BufferAttribute(this.positions,3));
      geom.setAttribute("color",new Float32BufferAttribute(this.colors,3));
      geom.setIndex(this.indices);geom.computeVertexNormals();geom.computeBoundingSphere();
      const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
      const night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.78});
      const mesh=new Mesh(geom,day);
      mesh.userData={dayMaterial:day,nightMaterial:night};group.add(mesh);
    }
    return group;
  }
}

function planting(f:Fountain,y:number,rx:number,rz:number,count:number) {
  const foliage=[0x75845f,0x839369,0x929578,0x718373];
  const blossom=[0xaa8b97,0xb6a2ad,0xc3bba5];
  for(let i=0;i<count;i++) {
    const a=i*2.39996323, r=Math.sqrt((i+.5)/count)*.93;
    const x=Math.cos(a)*r*rx,z=Math.sin(a)*r*rz, h=.10+.08*(i%4);
    f.ellipsoid(x,y+h*.7,z,.23,h,.19,foliage[i%foliage.length],a);
    if(i%3===0) f.ellipsoid(x+.04,y+h*1.58,z+.03,.09,.12,.085,blossom[i%blossom.length]);
  }
}

function figure(f:Fountain,x:number,z:number,scale:number,pose:"standing"|"seated"|"reclining",angle:number,plinth:number) {
  const c=Math.cos(angle),s=Math.sin(angle);
  const p=(u:number,y:number,v:number):Point=>[x+(u*c-v*s)*scale,plinth+y*scale,z+(u*s+v*c)*scale];
  const shape=(u:number,y:number,v:number,rx:number,ry:number,rz:number)=>{
    const [px,py,pz]=p(u,y,v);f.ellipsoid(px,py,pz,rx*scale,ry*scale,rz*scale,bronze,angle);
  };
  const seated=pose==="seated", prone=pose==="reclining";
  const hip=prone?.32:seated?.56:.92, shoulders=prone?.69:hip+.5;
  shape(0,hip+.13,prone?.16:0,.23,.28,.17);
  shape(0,shoulders,prone?.35:.03,.25,.32,.16);
  shape(0,shoulders+.40,prone?.50:.05,.15,.205,.14);
  for (const side of [-1,1]) {
    const knee=p(side*.14,prone?.23:seated?.48:.51,prone?-.55:seated?.45:.06);
    f.beam(p(side*.13,hip,0),knee,.18*scale,bronze);
    f.beam(knee,p(side*.17,.09,prone?-1.02:seated?.50:.12),.135*scale,bronze);
    const elbow=p(side*.30,shoulders-.20,prone?.47:.14);
    f.beam(p(side*.19,shoulders+.08,prone?.36:.05),elbow,.12*scale,bronze);
    f.beam(elbow,p(side*.20,shoulders-(seated?.29:.37),prone?.70:.25),.095*scale,bronze);
  }
}

function createFountain(north:boolean,native:boolean) {
  const [x,z]=index.sites[north?"n6760617075":"w720361325"];
  const f=new Fountain(x,z,native);
  f.apron(index.squareBounds[north?"north":"south"]);
  if(north) {
    f.profile(0,0,[[.21,1.30,1.30],[.37,1.30,1.30]],granite);
    f.profile(0,0,[[.36,1.28,1.28],[.54,1.05,1.05],[1.73,.65,.65],[2.15,.87,.87],[2.78,1.61,1.61],[3.04,1.72,1.72],[3.39,1.64,1.64],[3.41,1.43,1.43],[3.32,.001,.001]],patina,.14);
    planting(f,3.41,1.36,1.36,32);
    for(const [px,pz,w] of [[-2.4,.85,1.1],[1.5,-2.7,1.16],[2.5,.91,1.02],[-1,-2.56,.78]]) {
      f.ellipsoid(px,.46,pz,w,.32,.63,0x9b9486,.36);
      for(let k=0;k<4;k++) f.ellipsoid(px-.16+k*.20,.61,pz+.23,.27,.20,.27,0x82916c);
    }
    return f.finish("Nordbrunnen am Wittenbergplatz");
  }
  f.profile(0,0,[[.21,1.88,1.54],[.32,1.88,1.54]],granite);
  // Dry bronze canopies on two plazas have different profiles. The southern bowl is oval.
  f.profile(0,0,[[.30,1.76,1.21],[.57,1.68,1.11],[1.90,1.30,.95],[2.16,1.72,1.13],
    [2.61,1.94,2.56],[2.77,2.13,2.75],[3.19,2.13,2.75],[3.24,2.00,2.60],[3.20,.001,.001]],patina,0,48,.27);
  planting(f,3.22,1.90,2.45,46);
  const groups:[[number,number],number,"standing"|"seated"|"reclining",number][]=[
    [[-.1,-3.7],1.05,"standing",.2],[[.73,-3.8],.91,"standing",.15],
    [[2.9,-1.3],1.02,"reclining",1.2],[[3.7,1.0],.98,"seated",2.3],[[3.2,2.1],.84,"reclining",2.2],
    [[-1.0,1.7],.87,"seated",2.7],[[-2.0,2.3],1.02,"seated",3.0],[[-2.7,2.7],1.04,"seated",3.3],
    [[-3.1,-1.05],.68,"standing",-.5],[[-3.6,-1.5],.61,"seated",-.8],[[-3.1,-2.0],.65,"standing",.3],
  ];
  for(const [[px,pz],k,pose,yaw] of groups) {
    f.ellipsoid(px,.47,pz,.80,.23,.69,0x92877a,yaw);
    figure(f,px,pz,k,pose,yaw,.64);
  }
  // The group of children includes a slender sighthound.
  f.ellipsoid(-3.83,.98,-.46,.14,.22,.45,bronze);
  f.ellipsoid(-3.83,1.29,.0,.10,.13,.22,bronze);
  for(const side of [-1,1])for(const end of [-1,1]) f.beam([-3.83+side*.09,.95,-.47+end*.26],[-3.83+side*.14,.56,-.47+end*.32],.062,bronze);
  for(const sign of [-1,1]) {
    f.profile(sign*3.86,-3.40,[[.29,.54,.48],[.85,.53,.45],[1.33,.35,.38],[1.54,.02,.01]],bronze);
  }
  for(const [px,pz,a] of [[-.3,3.9,.35],[-2.9,-2.65,1.9],[2.75,-2.9,.3],[3.35,.95,1.9]]) {
    f.ellipsoid(px,.32,pz,.92,.15,.56,soil,a);
    for(let k=0;k<6;k++){
      const u=(k%3-1)*.38,v=(Math.floor(k/3)-.5)*.32;
      f.ellipsoid(px+u*Math.cos(a)-v*Math.sin(a),.50+.04*(k%2),pz+u*Math.sin(a)+v*Math.cos(a),
        .28,.19,.27,0x83916a,a);
    }
  }
  return f.finish("Lebensalterbrunnen am Wittenbergplatz");
}

export async function attachWittenbergQuartierV383(entry:SurroundingChunkGeometry,id:string,native:boolean,signal:AbortSignal) {
  const tile=id.slice("wit383-".length);
  if(!index.hosts.includes(tile)||entry.root.userData.wittenbergQuartierV383) return;
  signal.throwIfAborted();
  const [data,station]=await Promise.all([
    import(`./data/wittenbergQuartierV383/${tile}.json`).then(m=>m.default as PrenzlauerStreetPacketV380),
    tile==="-4_3" ? import(`./data/wittenbergBahnhofV383/${native?"native":"drawn"}.json`)
      .then(m=>m.default as PrenzlauerStreetPacketV380) : undefined,
  ]);
  signal.throwIfAborted();
  if(entry.root.userData.wittenbergQuartierV383) return;
  const part=new Group();
  part.name="Tauentzienstraße, Wittenbergplatz und Straßen südlich des Aquariums";
  part.userData={nativeMinecraft:native,keepInMinecraft:native,surveyedTreeCount:data.trees.length};
  part.add(createSurveySurfaceV380(data,"Vermessene Gehwege und Bordsteine · "+tile));
  addSurveyTreesV380(part,data.trees,native);
  if(station) part.add(createSurveySurfaceV380(station,"Bahnhof Wittenbergplatz · Vorplätze, Oberlichter und Portale"),
    createFountain(true,native),createFountain(false,native));
  attachWorldSpaceDetail(entry,part);
  entry.root.userData.wittenbergQuartierV383=true;
}
