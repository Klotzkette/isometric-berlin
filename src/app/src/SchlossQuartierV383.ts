import { Color, Group, Mesh } from "three";
import { ALT_MITTE_V169_NATIVE_GROUP } from "./AltMitteCoreV169";
import gable from "./data/kurstrasseGiebelV383.json";
import { GendarmenmarktFacadeBuilder, perimeterEdgeLength, type PerimeterFacadeEdge } from "./GendarmenmarktFacadeBuilder";
import { createSourceWallHostVerifierV344 } from "./sourceWallHostV344";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import source from "./data/schlossQuartierV383.json";

type Front = typeof source.fronts[number];
type Point = [number, number, number];
type Panel = { u: number; y: number; w: number; h: number; out: number; depth: number; color: number };

function panels(front: Front) {
  const width = perimeterEdgeLength(front.edge);
  const base = front.edge.wallBaseY;
  const height = front.edge.wallTopY - base;
  const wall = Number.parseInt(front.color, 16);
  const trim = new Color(wall).lerp(new Color(0xf2e8cb), .35).getHex();
  const glass = front.style === "copper" ? 0x495e61 : front.style === "ribbon" ? 0x61787b : 0x667279;
  const out: Panel[] = [];
  function add(u: number, y: number, w: number, h: number, offset: number, depth: number, color: number) {
    out.push({u, y, w, h, out:offset, depth, color});
  }
  if(front.style==="kur17") {
    // The 22 m² LoD2 appendage DEBE00YY1Ze00053 projects a blank triangle
    // 0.60 m ahead of the registered wall. The architect's street elevation
    // shows continuous window bays on that exterior plane, with five ledges.
    const outer=.70,shadow=0x797360,frame=0xd5cbb2;
    add(width/2,base+height*.5,width+.01,height-.02,outer,.12,wall);
    for(const row of front.rows) {
      const h=height*front.height,y=base+height*row;
      add(width/2,y-h*.70,width,.12,outer+.16,.32,shadow);
      add(width/2,y-h*.70+.095,width,.125,outer+.19,.40,frame);
      for(const col of front.cols) {
        const u=col*width,w=front.width*width;
        add(u,y,w+.40,h+.15,outer+.09,.10,shadow);
        add(u,y-.06,w,h-.09,outer+.16,.07,0x687277);
        add(u,y,.067,h-.10,outer+.21,.06,0xa69d88);
        add(u,y+.09*h,w,.07,outer+.21,.06,0xa69d88);
        for(const sign of [-1,1])add(u+sign*(w/2+.17),y,.14,h+.28,outer+.21,.17,frame);
        add(u,y+h/2+.01,w+.46,.16,outer+.20,.19,frame);
        add(u,y-h*.29,w+.03,.067,outer+.23,.08,0x625f55);
        for(let k=1;k<7;k++)add(u+w*(k/7-.5),y-h*.395,.027,h*.20,outer+.23,.04,0x6a665a);
      }
    }
    // The entrance and four narrow openings are located in a single ground-floor
    // band across the source wall's two survey segments.
    const [from,to]=front.kurRange;
    for(const [a,b,lo,hi] of [[.093,.115,.044,.109],[.22,.242,.044,.111],[.359,.38,.044,.111],[.49,.51,.046,.112],
      [.625,.733,.006,.166],[.847,.923,.005,.11]]) {
      const start=Math.max(a,from),end=Math.min(b,to);
      if(start>=end)continue;
      const u=((start+end)/2-from)*width/(to-from),w=(end-start)*width/(to-from);
      add(u,base+(lo+hi)*height/2,w,(hi-lo)*height,outer+.15,.055,0x56554a);
      if(a>.6)add(u+w*.30,base+(lo+hi)*height/2,w*.09,(hi-lo)*height,outer+.20,.04,0x947d62);
    }
    return out;
  }
  // Replace the photographed portion of the earlier speculative window grid.
  // Blank archival pixels at the foot and roofline have no measured openings.
  const bottom = Math.max(.12, Math.min(...front.rows) - front.height * .70);
  const top = Math.min(.997, Math.max(...front.rows) + front.height * .72);
  add(width/2, base+height*(bottom+top)/2, width-.035, height*(top-bottom), .23, .13, wall);
  const grouped = front.style === "ribbon" || front.style === "copper";
  const sculpted = front.style === "pilaster" || front.style === "sandstone";
  for (const row of front.rows) {
    const y = base + height*row;
    const h = front.height*height;
    if (grouped) add(width/2, y, width-.065, h+.24, .315, .065, 0x475652);
    for (const col of front.cols) {
      const u = col*width, w = Math.min(width*front.width, 3.85);
      add(u,y,w+.19,h+.20,.35,.08,sculpted ? trim : 0x777d76);
      add(u,y,w,h,.41,.055,glass);
      add(u,y+.07*h,w,.065,.452,.055,0x3f494a);
      if (w>.88) add(u,y,.063,h,.452,.055,0x404d4f);
      add(u,y-h/2-.085,w+.24,.115,.455,.24,trim);
      if (sculpted) add(u,y+h/2+.105,w+.26,.15,.455,.23,trim);
    }
    if (sculpted || front.style === "copper") add(width/2,y-h*.65,width-.06,.115,.36,.17,trim);
  }
  if (sculpted) {
    for (let i=1;i<front.cols.length;i++) {
      const u = width*(front.cols[i-1]+front.cols[i])/2;
      add(u,base+height*(bottom+top)/2,.18,height*(top-bottom),.34,.16,trim);
    }
  }
  return out;
}

function drawFront(builder: GendarmenmarktFacadeBuilder, front:Front) {
  const edge: PerimeterFacadeEdge = front.edge;
  const length = perimeterEdgeLength(edge);
  const dx = (edge.endXZ[0]-edge.startXZ[0])/length;
  const dz = (edge.endXZ[1]-edge.startXZ[1])/length;
  for (const p of panels(front)) {
    if (!builder.minecraft) {
      builder.face(edge,p.u,p.y,p.w,p.h,p.depth,p.color,p.out);
      continue;
    }
    for (const host of front.steps) {
      const component = host.axis===0 ? dz : dx;
      if (Math.abs(component)<.1) continue;
      const lo = Math.max(host.u-Math.abs(component),p.u-p.w/2);
      const hi = Math.min(host.u+Math.abs(component),p.u+p.w/2);
      const y0 = Math.max(host.bottom+.01,p.y-p.h/2);
      const y1 = Math.min(host.top-.01,p.y+p.h/2);
      if (hi-lo<.025 || y1-y0<.025) continue;
      const along = host.along+1+((lo+hi)/2-host.u)/component;
      const w = (hi-lo)/Math.abs(component);
      // The native relief sits against the primary full-height cardinal face.
      const offset = front.style==="kur17" ? p.out-.57 : p.out;
      const v = host.coordinate+host.sign*offset;
      if (host.axis===0) builder.box([v,(y0+y1)/2,along],[p.depth,y1-y0,w],p.color);
      else builder.box([along,(y0+y1)/2,v],[w,y1-y0,p.depth],p.color);
    }
  }
}

const ground = 5.67;
const sites = source.sites;
const iron = 0x454d49;

function stroke(builder:GendarmenmarktFacadeBuilder,a:Point,b:Point,thickness:number,tone:number) {
  if (!builder.minecraft) { builder.beam(a,b,thickness,tone); return; }
  const delta = b.map((v,i)=>v-a[i]);
  const steps = Math.max(1,Math.ceil(Math.max(...delta.map(Math.abs))/Math.max(thickness,.16)));
  for (let k=0;k<steps;k++) {
    const t = (k+.5)/steps;
    builder.box([a[0]+t*delta[0],a[1]+t*delta[1],a[2]+t*delta[2]],
      [Math.abs(delta[0])/steps+thickness*.75,Math.abs(delta[1])/steps+thickness*.75,
        Math.abs(delta[2])/steps+thickness*.75],tone);
  }
}

function sanchi(builder:GendarmenmarktFacadeBuilder) {
  // The 2026 TrueDOP locates the north/south red stone superstructure 13 m
  // southwest of the map pin. HS3, HS5 and HS7 are read from the execution plan.
  const x=2033.71,z=126.8;
  const red=0xba856b,light=0xd5a38a,shadow=0x9c6751;
  function block(u:number,h:number,w:number,dy:number,depth:number,tone:number) {
    builder.box([x,ground+h,z+u],[depth,dy,w],tone);
  }
  for (const side of [-1,1]) {
    const u=side*1.51;
    block(u,.12,1.08,.24,1.08,shadow);
    block(u,1.85,.67,3.52,.67,red);
    for (const h of [1.10,2.38,3.03,3.55]) block(u,h,.80,.15,.81,light);
    block(u,4.12,1.22,.83,.91,light);
    for (const sign of [-1,1]) {
      // Profile of the elephant capitals, trunk and ears, facing the outer ends.
      builder.box([x+sign*.29,ground+4.39,z+u+side*.12],[.49,.55,1.10],red);
      builder.box([x+sign*.29,ground+4.33,z+u+side*.67],[.39,.47,.43],light);
      builder.box([x+sign*.29,ground+3.98,z+u+side*.78],[.19,.43,.20],red);
    }
    block(u,4.88,1.42,.31,1.25,light);
    for (const h of [6.12,7.48]) block(u,h,.55,.81,.66,red);
  }
  for (const [level,half] of [[5.54,3.01],[6.89,2.95],[8.25,2.82]]) {
    // The three beams bow upward at their rolled outer ends.
    const n=20;
    for(let i=0;i<n;i++) {
      const u=-half+(i+.5)*2*half/n;
      const y=level+.19*(u/half)**2;
      block(u,y,2*half/n+.008,.55,.56,red);
      block(u,y+.28,2*half/n+.008,.09,.62,light);
      block(u,y-.27,2*half/n+.008,.09,.61,shadow);
      if(i%2===0)for(const s of [-1,1])builder.box([x+s*.30,ground+y,z+u],[.08,.25,.14],light);
    }
    for(const s of [-1,1]) {
      block(s*half,level+.19,.42,.62,.65,light);
      block(s*half,level+.20,.22,.26,.70,shadow);
    }
  }
  for (const y of [6.17,7.52]) for(const u of [-.83,-.41,0,.41,.83])block(u,y,.13,.74,.38,light);
  for(const u of [-1.43,0,1.43]) {
    block(u,8.80,.32,.59,.34,red);
    for(const sign of [-1,1])stroke(builder,[x,ground+8.82,z+u],[x,ground+9.38,z+u+sign*.36],.15,light);
    for(let i=0;i<12;i++) {
      const angle=i*Math.PI*2/12,next=angle+Math.PI*2/12;
      const ring=(a:number):Point=>[x,ground+9.48+.34*Math.sin(a),z+u+.34*Math.cos(a)];
      stroke(builder,ring(angle),ring(next),.105,red);
    }
  }
}

function basin(builder:GendarmenmarktFacadeBuilder,points:number[][],radius:number,water:number) {
  const ring=points.slice(0,-1);
  const x=ring.reduce((s,p)=>s+p[0],0)/ring.length;
  const z=ring.reduce((s,p)=>s+p[1],0)/ring.length;
  const segments=builder.minecraft?36:64;
  for(let i=0;i<segments;i++) {
    const a=(i+.5)*Math.PI*2/segments;
    const step=2*radius/segments;
    const offset=-radius+(i+.5)*step;
    const width=2*Math.sqrt(Math.max(0,radius*radius-offset*offset));
    builder.box([x,ground+.21,z+offset],[width,.18,step+.006],water);
    const next=a+Math.PI*2/segments;
    const rim=(v:number):Point=>[x+radius*Math.cos(v),ground+.32,z+radius*Math.sin(v)];
    stroke(builder,rim(a),rim(next),.27,0xad9183);
  }
  for(let i=0;i<9;i++) {
    const a=i*2*Math.PI/9;
    stroke(builder,[x,ground+.38,z],[x+.36*Math.cos(a),ground+.62,z+.36*Math.sin(a)],.13,0x65786a);
  }
  builder.box([x,ground+.90,z],[.11,1.12,.11],0xb8d4d0);
}

function schinkel(builder:GendarmenmarktFacadeBuilder) {
  basin(builder,sites.w1092121325.points,3.0,0x829b9b);
  const bench=sites.w1182118331.points;
  for(let i=1;i<bench.length;i++) {
    const a=bench[i-1],b=bench[i];
    stroke(builder,[a[0],ground+.40,a[1]],[b[0],ground+.40,b[1]],.64,0xb69382);
    stroke(builder,[a[0],ground+.77,a[1]],[b[0],ground+.77,b[1]],.36,0x997465);
  }
  const names=["n305468712","n305468730","n305468951"] as const;
  const shade=[0x655c50,0x575c50,0x58625a];
  names.forEach((id,i)=>{
    const [x,z]=sites[id].points[0];
    for(const [y,w,h,tone] of [[.13,1.78,.26,0xc8b3a0],[.39,1.53,.26,0xb09f8f],
      [1.18,1.24,1.45,0xc8b7a2],[1.97,1.47,.19,0xd5c8b6]])builder.box([x,ground+y,z],[w,h,w],tone);
    for(const s of [-1,1])stroke(builder,[x+s*.16,ground+2.08,z],[x+s*.12,ground+2.98,z+.03],.19,shade[i]);
    builder.box([x,ground+3.22,z],[.55,.89,.37],shade[i]);
    builder.box([x,ground+3.88,z],[.32,.39,.32],shade[i]);
    stroke(builder,[x-.29,ground+3.51,z],[x-.34,ground+3.02+i*.09,z-.13],.16,shade[i]);
    stroke(builder,[x+.29,ground+3.51,z],[x+.38-i*.12,ground+3.04+i*.10,z-.24],.16,shade[i]);
  });
  for(const id of ["w1182118328","w1182118329","w1182118330","w1092121323"] as const) {
    const points=sites[id].points;
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.32);
      for(const y of [.24,.54])stroke(builder,[a[0],ground+y,a[1]],[b[0],ground+y,b[1]],.041,iron);
      for(let j=0;j<n;j++)builder.box([a[0]+(b[0]-a[0])*j/n,ground+.33,a[1]+(b[1]-a[1])*j/n],[.048,.66,.048],iron);
    }
  }
}

function hausvogtei(builder:GendarmenmarktFacadeBuilder) {
  basin(builder,sites.w389101363.points,4.15,0x7e9594);
  const [x,z]=sites.n2840516201.points[0];
  // Drei eigenständige doppelseitige Spiegel aus Metall, Oberkante 2,70 m.
  for(let i=0;i<3;i++) {
    const angle=(i*120+20)*Math.PI/180;
    const dx=Math.cos(angle), dz=Math.sin(angle), px=x+dx*.85,pz=z+dz*.85;
    const strips=builder.minecraft?9:1;
    for(let j=0;j<strips;j++) {
      const u=((j+.5)/strips-.5)*.98;
      const w=.98/strips;
      const sx=px-dz*u,sz=pz+dx*u;
      const yaw=builder.minecraft?0:-Math.atan2(dx,-dz);
      const size:Point=builder.minecraft?[Math.max(.08,Math.abs(dz)*w+.045),2.66,Math.max(.08,Math.abs(dx)*w+.045)]:[w,2.66,.092];
      builder.box([sx,ground+1.37,sz],size,0x4c5959,yaw);
      for(const sign of [-1,1])builder.box([sx+sign*.061*dx,ground+1.42,sz+sign*.061*dz],
        [size[0]*.92,2.49,size[2]*.91],0xa6b3ae,yaw);
    }
  }
}

function retireKurstrasseGable(world:Group,verify:ReturnType<typeof createSourceWallHostVerifierV344>):number {
  const packet=world.getObjectByName(ALT_MITTE_V169_NATIVE_GROUP+": "+gable.packet);
  const body=packet?.children.find(o=>o instanceof Mesh && o.name.endsWith(" mapped surfaces and massing"));
  if(!(body instanceof Mesh)||!body.geometry.index) return 0;
  if(body.userData.kurstrasseGableV383) return gable.triangles.length;
  const triangles=gable.triangles.map(([i,a,b,c])=>({
    offset:3*i,positions:[...gable.vertices[a],...gable.vertices[b],...gable.vertices[c]],
  }));
  // Match every current triangle and its world-space transform before changing
  // any index. The named family continues inland beyond this facade strip.
  if(!verify([{packetId:gable.packet,origin:gable.origin,triangles}])) return 0;
  const index=body.geometry.index;
  for(const {offset} of triangles) {
    const first=index.getX(offset);
    index.setX(offset+1,first);index.setX(offset+2,first);
  }
  index.needsUpdate=true;
  body.userData.kurstrasseGableV383=true;
  return triangles.length;
}

/** Attach the photographed public elevations to their measured, resident triangles.
 * The three freestanding ensembles are located in the same public square as their source. */
export function createSchlossQuartierV383(world:Group,native=false):Group {
  const verify=createSourceWallHostVerifierV344(world,native);
  const group=new Group();
  group.name="Schlossplatz, Schinkelplatz und Hausvogteiplatz";
  const admitted:string[]=[];
  const streets=new Map<string,GendarmenmarktFacadeBuilder>();
  let kur17Walls=0;
  for(const front of source.fronts) {
    if(!verify(native?front.nativeHosts:front.drawnHosts))continue;
    let builder=streets.get(front.edge.street);
    if(!builder){builder=new GendarmenmarktFacadeBuilder(native,false,0);streets.set(front.edge.street,builder);}
    drawFront(builder,front);admitted.push(front.surface);
    if(front.style==="kur17")kur17Walls++;
  }
  for(const [street,builder] of streets)group.add(builder.finish("Fotografierte Straßenfronten · "+street));
  const objects=[
    ["Sanchi-Tor am Humboldt Forum",sanchi],
    ["Schinkelplatz mit Brunnen und Exedra",schinkel],
    ["Denkzeichen am Hausvogteiplatz",hausvogtei],
  ] as const;
  for(const [name,build] of objects) {
    const builder=new GendarmenmarktFacadeBuilder(native,false,0);build(builder);group.add(builder.finish(name));
  }
  const retired=native && kur17Walls===2 ? retireKurstrasseGable(world,verify) : 0;
  Object.assign(group.userData,{schlossQuartierV383:true,kurstrasseGableTriangles:retired,admitted,keepInMinecraft:native,nativeMinecraft:native});
  return freezeStaticSceneTransforms(group);
}
