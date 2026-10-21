import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { InstancedMesh, Mesh, PerspectiveCamera } from "three";
import { createColumbiaConcertV257 } from "../src/ColumbiaConcertV257";
import { columbiaApproachV257, columbiaCopyV257, columbiaKeyActionV257, createColumbiahalleV257 } from "../src/ColumbiahalleV257";
import { columbiaFacadeV257 } from "../src/columbiaFacadeV257";
import source from "../src/data/venuesV238Replacement.json";
import type { SurroundingPackedMesh } from "../src/SurroundingCityGeometry";

for(const native of [false,true]) test(`Columbia ${native?"native":"drawn"} local scene changes light and releases every GPU object`,()=>{
  const concert=createColumbiaConcertV257(native);
  const geometries=new Set(),materials=new Set(),disposedGeometry=new Set(),disposedMaterial=new Set();
  const instanceMeshes=new Set(),disposedInstances=new Set();let instanceDisposeEvents=0;
  let bytes=0,draws=0,instances=0;
  concert.root.traverse(o=>{
    if(!(o instanceof Mesh))return;draws++;
    if(!geometries.has(o.geometry)) {
      geometries.add(o.geometry);o.geometry.addEventListener("dispose",()=>disposedGeometry.add(o.geometry));
      for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;
      bytes+=o.geometry.index?.array.byteLength??0;
    }
    for(const m of Array.isArray(o.material)?o.material:[o.material])if(!materials.has(m)){
      materials.add(m);m.addEventListener("dispose",()=>disposedMaterial.add(m));
    }
    if(o instanceof InstancedMesh){bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);instances+=o.count;instanceMeshes.add(o);o.addEventListener("dispose",()=>{disposedInstances.add(o);instanceDisposeEvents++;});}
    if(native)expect(o.geometry.type).toBe("BoxGeometry");
  });
  expect(draws).toBe(10);expect(bytes).toBeLessThan(100_000);
  const last=concert.root.children.at(-1) as Mesh;
  concert.update(1);const early=(last.material as any).color.getHex();
  concert.update(12);expect((last.material as any).color.getHex()).not.toBe(early);
  concert.update(25);expect((last.material as any).color.getHex()).toBe(early);
  concert.update(4,true);const still=(last.material as any).color.getHex();
  concert.update(18,true);expect((last.material as any).color.getHex()).toBe(still);
  concert.dispose();concert.dispose();
  expect(disposedGeometry).toEqual(geometries);expect(disposedMaterial).toEqual(materials);
  expect(disposedInstances).toEqual(instanceMeshes);expect(instanceDisposeEvents).toBe(instanceMeshes.size);
  expect(concert.scene.children.length).toBe(0);
  console.log("Columbia interior",{native,bytes,draws,instances});
});

test("reduced-motion recovery redraws once and concert stacking restores city controls",async()=>{
  class Element extends EventTarget {
    style={cssText:"",display:"",zIndex:""};dataset={};hidden=false;inert=false;className="";isConnected=true;parentElement:Element|null=null;children:Element[]=[];
    append(...children:Element[]){for(const child of children){child.parentElement=this;this.children.push(child);}}
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);}
    closest(selector:string):Element|null{return selector===".app-shell"&&this.className==="app-shell"?this:this.parentElement?.closest(selector)??null;}
    focus(){} getBoundingClientRect(){return {width:640,height:360,left:0,top:0};}
  }
  const previousWindow=Object.getOwnPropertyDescriptor(globalThis,"window"),previousDocument=Object.getOwnPropertyDescriptor(globalThis,"document");
  const documentTarget=Object.assign(new EventTarget(),{hidden:false,documentElement:{lang:"en"},createElement:()=>new Element()});
  Object.defineProperty(globalThis,"window",{configurable:true,value:new EventTarget()});
  Object.defineProperty(globalThis,"document",{configurable:true,value:documentTarget});
  const app=new Element();app.className="app-shell";
  const stage=new Element(),controls=new Element(),alreadyInert=new Element();alreadyInert.inert=true;app.append(stage,controls,alreadyInert);
  const parent=new Element(),canvas=new Element();parent.style.zIndex="2";stage.append(parent);parent.append(canvas);
  let frames=0;
  const controller=createColumbiahalleV257({canvas:canvas as any,renderer:{setRenderTarget(){},render(){frames++;}} as any,worldCamera:new PerspectiveCamera(),native:()=>false,reducedMotion:true,invalidate(){},resetInput(){}});
  try {
    await controller.open();controller.update(1);controller.update(100);
    expect(frames).toBe(1);
    const portal=app.children.find(child=>child.dataset.columbiahalleV257==="true");
    expect(portal).toBeDefined();expect(portal!.inert).toBeFalse();
    expect(portal!.style.zIndex).toBe("60");
    expect(parent.style.zIndex).toBe("50");expect(controls.inert).toBeTrue();expect(alreadyInert.inert).toBeTrue();
    controller.suspend();controller.update(200);controller.update(300);
    expect(frames).toBe(2);
    controller.suspend();controller.update(400);controller.update(500);
    expect(frames).toBe(3);
    controller.close();
    expect(portal!.style.zIndex).toBe("30");
    expect(parent.style.zIndex).toBe("2");expect(controls.inert).toBeFalse();expect(alreadyInert.inert).toBeTrue();
    await controller.open();controller.dispose();
    expect(parent.style.zIndex).toBe("2");expect(controls.inert).toBeFalse();
  } finally {
    controller.dispose();
    if(previousWindow)Object.defineProperty(globalThis,"window",previousWindow);else Reflect.deleteProperty(globalThis,"window");
    if(previousDocument)Object.defineProperty(globalThis,"document",previousDocument);else Reflect.deleteProperty(globalThis,"document");
  }
});

test("entered concert blocks the actual viewer double-click handler before city access",()=>{
  const viewer=readFileSync(new URL("../src/ThreeViewer.tsx",import.meta.url),"utf8");
  const start=viewer.indexOf("const onDoubleClick = (event: MouseEvent) => {");
  const end=viewer.indexOf("\n      };",start);
  const body=viewer.slice(start+"const onDoubleClick = (event: MouseEvent) => {".length,end);
  const runtime={columbiahalleV257:{entered:true},get pedestrian(){throw new Error("City pedestrian state accessed");},get pergamonReveal(){throw new Error("City picking accessed");}};
  const invoke=new Function("runtime","event",body);
  expect(()=>invoke(runtime,{button:0,preventDefault(){throw new Error("City event handling accessed");}})).not.toThrow();
});

test("city GPU warmup neither schedules nor executes a queued task during the concert",()=>{
  const viewer=readFileSync(new URL("../src/ThreeViewer.tsx",import.meta.url),"utf8");
  const marker="runtime.scheduleGpuWarmup = () => {",start=viewer.indexOf(marker),end=viewer.indexOf("\n      };",start);
  const body=viewer.slice(start+marker.length,end).replace("catch (error: unknown)","catch (error)").replace("import.meta.env.DEV","false");
  let callback:(()=>void)|undefined,warmed=0,scheduled=0;
  const runtime={contextLost:false,columbiahalleV257:{entered:true},gpuWarmup:{pending:true,warmNext(){warmed++;}}};
  const schedule=new Function("runtime","window",`let gpuWarmupTimer=null,gpuWarmupInteractionUntil=0;const disposed=false,document={hidden:false},activeRef={current:true},browserInputPending=()=>false;${body}`);
  const host={setTimeout(f:()=>void){callback=f;scheduled++;return 1;}};
  schedule(runtime,host);expect(scheduled).toBe(0);
  runtime.columbiahalleV257.entered=false;schedule(runtime,host);expect(scheduled).toBe(1);
  runtime.columbiahalleV257.entered=true;callback!();expect(warmed).toBe(0);
});

test("Columbia entrance only prompts from its visible southern approach",()=>{
  const c=new PerspectiveCamera(60,1,.1,1000);
  c.position.set(1340,6,3890);c.lookAt(1340,5,3855);c.updateMatrixWorld();
  expect(columbiaApproachV257(c)).toBeTrue();
  c.position.set(1340,6,3830);c.lookAt(1340,5,3855);c.updateMatrixWorld();
  expect(columbiaApproachV257(c)).toBeFalse();
  c.position.set(1340,6,3990);c.lookAt(1340,5,3855);c.updateMatrixWorld();
  expect(columbiaApproachV257(c)).toBeFalse();
});

test("concert controls follow German/English language and preserve browser keys",()=>{
  expect(columbiaCopyV257("de-DE").enter).toBe("Columbiahalle betreten");
  expect(columbiaCopyV257("en").enter).toBe("Enter Columbiahalle");
  expect(columbiaCopyV257("en").videoLabel).toContain("silent loop");
  const plain={key:"ArrowLeft",ctrlKey:false,metaKey:false,altKey:false};
  expect(columbiaKeyActionV257(plain)).toBe("left");
  for(const modifier of ["ctrlKey","metaKey","altKey"])expect(columbiaKeyActionV257({...plain,[modifier]:true})).toBeNull();
  for(const key of ["Tab","Enter"," ","F5","l"])expect(columbiaKeyActionV257({...plain,key})).toBeNull();
  expect(columbiaKeyActionV257({...plain,key:"Escape"})).toBe("exit");
});

test("Columbia facade requires the exact original v238 packed mesh",()=>{
  for(const native of [false,true]){
    const mesh=source.packets[`${native?"minecraft":"drawn"}:2_7`].replacement as SurroundingPackedMesh;
    const run=(m:SurroundingPackedMesh)=>{const g=columbiaFacadeV257(m,native);let r=g.next();while(!r.done)r=g.next();return r.value;};
    const saved=JSON.stringify(mesh);const upgraded=run(mesh);
    expect(upgraded).not.toBe(mesh);expect(JSON.stringify(mesh)).toBe(saved);
    const stale={...mesh,colors:mesh.colors.slice(0,-4)+"AAAA"};
    expect(run(stale)).toBe(stale);
  }
});

test("provided recording is compact H.264 with no audio track",()=>{
  const bytes=readFileSync(new URL("../public/media/columbiahalle-v257-silent.mp4",import.meta.url));
  expect(bytes.byteLength).toBeLessThan(2*1024*1024);
  const trackTypes:string[]=[];
  const scan=(lo:number,hi:number)=>{for(let p=lo;p+8<=hi;){const n=bytes.readUInt32BE(p),type=bytes.toString("ascii",p+4,p+8);if(n<8||p+n>hi)break;if(["moov","trak","mdia"].includes(type))scan(p+8,p+n);if(type==="hdlr")trackTypes.push(bytes.toString("ascii",p+16,p+20));p+=n;}};
  scan(0,bytes.length);expect(trackTypes).toEqual(["vide"]);
  expect(bytes.includes(Buffer.from("avc1"))).toBeTrue();
});
