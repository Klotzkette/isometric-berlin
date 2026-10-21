import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { InstancedMesh, PerspectiveCamera, Scene } from "three";
import { createColumbiahalleV257 } from "../src/ColumbiahalleV257";

class Element extends EventTarget {
  style={cssText:"",display:"",zIndex:""};dataset:Record<string,string>={};hidden=false;inert=false;className="";isConnected=true;
  parentElement:Element|null=null;children:Element[]=[];textContent="";isContentEditable=false;
  onclick:(()=>void)|null=null;attributes=new Map<string,string>();
  bounds={width:640,height:480,left:0,top:0,right:640,bottom:480};
  constructor(readonly tagName:string){super();}
  append(...children:Element[]){for(const child of children){child.parentElement=this;this.children.push(child);}}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.parentElement=null;this.isConnected=false;}
  closest(selector:string):Element|null {
    const match=selector===".app-shell"?this.className==="app-shell":selector.split(",").some(s=>s.trim().toUpperCase()===this.tagName||(s.trim()==="[contenteditable]"&&this.isContentEditable));
    return match?this:this.parentElement?.closest(selector)??null;
  }
  setAttribute(name:string,value:string){this.attributes.set(name,value);}
  focus(){} getBoundingClientRect(){return this.bounds;}
}
const descendants=(node:Element):Element[]=>node.children.flatMap(child=>[child,...descendants(child)]);
async function fixture(run:(f:{controller:ReturnType<typeof createColumbiahalleV257>;app:Element;canvas:Element;host:EventTarget;document:EventTarget&{hidden:boolean;documentElement:{lang:string}};frames:string[];tags:string[];click:(text:string)=>void})=>Promise<void>,reducedMotion=false) {
  const names=["window","document","HTMLElement","Element"];
  const saved=names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)] as const);
  const tags:string[]=[],frames:string[]=[],host=Object.assign(new EventTarget(),{innerWidth:800,innerHeight:600});
  const document=Object.assign(new EventTarget(),{hidden:false,documentElement:{lang:"en"},createElement:(tag:string)=>{
    tags.push(tag);if(["video","audio","select","source","iframe"].includes(tag))throw new Error(`Unexpected media control ${tag}`);
    return new Element(tag.toUpperCase());
  }});
  for(const [name,value] of Object.entries({window:host,document,HTMLElement:Element,Element}))Object.defineProperty(globalThis,name,{configurable:true,value});
  const app=new Element("DIV");app.className="app-shell";
  const stage=new Element("DIV"),parent=new Element("DIV"),canvas=new Element("CANVAS");app.append(stage);stage.append(parent);parent.append(canvas);
  const controller=createColumbiahalleV257({canvas:canvas as any,renderer:{setRenderTarget(){},render(scene:Scene){
    const mesh=scene.children[0].children[0] as InstancedMesh;
    frames.push(createHash("sha256").update(new Uint8Array(mesh.instanceMatrix.array.buffer)).digest("hex"));
  }} as any,worldCamera:new PerspectiveCamera(),native:()=>false,reducedMotion,invalidate(){},resetInput(){}});
  const click=(text:string)=>{const button=descendants(app).find(e=>e.tagName==="BUTTON"&&e.textContent===text);expect(button).toBeDefined();button!.onclick!();};
  try {await controller.open();await run({controller,app,canvas,host,document,frames,tags,click});}
  finally {controller.dispose();for(const [name,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}}
}

test("graphic concert preserves editing arrows while room arrows and Escape work",async()=>{
  await fixture(async({controller,canvas,host})=>{
    const nested=new Element("SPAN"),button=new Element("BUTTON");button.append(nested);
    const editable=new Element("DIV");editable.isContentEditable=true;
    let passed=0;host.addEventListener("keydown",()=>passed++);
    for(const target of [new Element("SELECT"),new Element("INPUT"),new Element("TEXTAREA"),nested,editable])for(const key of ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"]){
      const event=new Event("keydown",{cancelable:true});Object.assign(event,{key,ctrlKey:false,metaKey:false,altKey:false});Object.defineProperty(event,"target",{value:target});
      const before=passed;host.dispatchEvent(event);expect(event.defaultPrevented).toBeFalse();expect(passed).toBe(before+1);
    }
    const event=new Event("keydown",{cancelable:true});Object.assign(event,{key:"ArrowLeft",ctrlKey:false,metaKey:false,altKey:false});Object.defineProperty(event,"target",{value:canvas});
    const before=passed;host.dispatchEvent(event);expect(event.defaultPrevented).toBeTrue();expect(passed).toBe(before);
    const escape=new Event("keydown",{cancelable:true});Object.assign(escape,{key:"Escape",ctrlKey:false,metaKey:false,altKey:false});host.dispatchEvent(escape);
    expect(controller.entered).toBeFalse();expect(escape.defaultPrevented).toBeTrue();
  });
});

test("graphic view pauses exactly across hidden/offscreen recovery, resumes and releases controls",async()=>{
  await fixture(async({controller,app,canvas,document,frames,tags,click})=>{
    expect(tags).not.toContain("video");expect(tags).not.toContain("select");
    controller.update(10);controller.update(100);expect(frames).toHaveLength(2);expect(frames[1]).not.toBe(frames[0]);
    click("Pause");controller.update(200);const still=frames.at(-1)!;expect(still).toBe(frames[1]);
    controller.update(500);expect(frames).toHaveLength(3);
    document.hidden=true;document.dispatchEvent(new Event("visibilitychange"));controller.update(900);expect(frames).toHaveLength(3);
    document.hidden=false;controller.update(1000);expect(frames).toHaveLength(4);expect(frames.at(-1)).toBe(still);
    canvas.bounds.top=700;canvas.bounds.bottom=1180;controller.update(1100);expect(frames).toHaveLength(4);
    canvas.bounds.top=0;canvas.bounds.bottom=480;controller.update(1200);expect(frames).toHaveLength(5);expect(frames.at(-1)).toBe(still);
    const play=descendants(app).find(e=>e.textContent==="Play")!;expect(play.attributes.get("aria-pressed")).toBe("true");
    click("Play");controller.update(1300);controller.update(1340);expect(frames.at(-1)).not.toBe(still);
    click("Pause");document.documentElement.lang="de";controller.update(1400);
    expect(descendants(app).some(e=>e.textContent==="Abspielen")).toBeTrue();expect(descendants(app).some(e=>e.textContent==="Verlassen")).toBeTrue();
    click("Verlassen");expect(controller.entered).toBeFalse();const count=frames.length;controller.update(1500);expect(frames).toHaveLength(count);
    controller.dispose();expect(descendants(app).some(e=>e.dataset.columbiahalleV257)).toBeFalse();
  });
});

test("reduced motion starts still and only explicit Play starts the graphic loop",async()=>{
  await fixture(async({controller,frames,click})=>{
    controller.update(10);controller.update(100);expect(frames).toHaveLength(1);
    click("Play");controller.update(200);controller.update(240);expect(frames).toHaveLength(3);expect(frames[2]).not.toBe(frames[0]);
    click("Pause");controller.update(300);controller.update(600);expect(frames).toHaveLength(4);expect(frames[3]).toBe(frames[2]);
  },true);
});
