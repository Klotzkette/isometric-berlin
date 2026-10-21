import { expect, test } from "bun:test";
import { PerspectiveCamera } from "three";
import { createColumbiahalleV257 } from "../src/ColumbiahalleV257";

class Element extends EventTarget {
  style={cssText:"",display:"",zIndex:""};dataset:Record<string,string>={};hidden=false;inert=false;className="";isConnected=true;
  parentElement:Element|null=null;children:Element[]=[];textContent="";value="0";isContentEditable=false;
  onclick:(()=>void)|null=null;onchange:(()=>void)|null=null;attributes=new Map<string,string>();
  constructor(readonly tagName:string){super();}
  append(...children:Element[]){for(const child of children){child.parentElement=this;this.children.push(child);}}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.parentElement=null;this.isConnected=false;}
  closest(selector:string):Element|null {
    const match=selector===".app-shell"?this.className==="app-shell":selector.split(",").some(s=>s.trim().toUpperCase()===this.tagName||(s.trim()==="[contenteditable]"&&this.isContentEditable));
    return match?this:this.parentElement?.closest(selector)??null;
  }
  setAttribute(name:string,value:string){this.attributes.set(name,value);}
  removeAttribute(name:string){this.attributes.delete(name);}
  get options(){return this.children;}
  focus(){} getBoundingClientRect(){return {width:640,height:480,left:0,top:0};}
}
class Video extends Element {
  src="";paused=true;plays:Array<{reject:(error:Error)=>void}>=[];
  play(){this.paused=false;return new Promise<void>((_,reject)=>{this.plays.push({reject});});}
  pause(){this.paused=true;} load(){}
  override removeAttribute(name:string){super.removeAttribute(name);if(name==="src")this.src="";}
}
const descendants=(node:Element):Element[]=>node.children.flatMap(child=>[child,...descendants(child)]);
async function fixture(run:(f:{controller:ReturnType<typeof createColumbiahalleV257>;app:Element;canvas:Element;host:EventTarget;videos:Video[];click:(text:string)=>void})=>Promise<void>) {
  const names=["window","document","HTMLElement","Element"];
  const saved=names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)] as const);
  const videos:Video[]=[],host=new EventTarget();
  const document=Object.assign(new EventTarget(),{hidden:false,baseURI:"https://example.test/viewer/",documentElement:{lang:"en"},createElement:(tag:string)=>{
    if(tag==="video"){const video=new Video("VIDEO");videos.push(video);return video;}return new Element(tag.toUpperCase());
  }});
  for(const [name,value] of Object.entries({window:host,document,HTMLElement:Element,Element}))Object.defineProperty(globalThis,name,{configurable:true,value});
  const app=new Element("DIV");app.className="app-shell";
  const stage=new Element("DIV"),parent=new Element("DIV"),canvas=new Element("CANVAS");app.append(stage);stage.append(parent);parent.append(canvas);
  const controller=createColumbiahalleV257({canvas:canvas as any,renderer:{setRenderTarget(){},render(){}} as any,worldCamera:new PerspectiveCamera(),native:()=>false,reducedMotion:false,invalidate(){},resetInput(){}});
  const click=(text:string)=>{const button=descendants(app).find(e=>e.tagName==="BUTTON"&&e.textContent===text);expect(button).toBeDefined();button!.onclick!();};
  try {await controller.open();await run({controller,app,canvas,host,videos,click});}
  finally {controller.dispose();for(const [name,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}}
}

test("concert window capture preserves selection/editing arrows and still handles room arrows",async()=>{
  await fixture(async({app,canvas,host,click})=>{
    click("Watch recording");
    const select=descendants(app).find(e=>e.tagName==="SELECT")!;
    const nested=new Element("SPAN"),button=new Element("BUTTON");button.append(nested);
    const editable=new Element("DIV");editable.isContentEditable=true;
    let passed=0;host.addEventListener("keydown",()=>passed++);
    for(const target of [select,new Element("INPUT"),new Element("TEXTAREA"),nested,editable])for(const key of ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"]){
      const event=new Event("keydown",{cancelable:true});Object.assign(event,{key,ctrlKey:false,metaKey:false,altKey:false});Object.defineProperty(event,"target",{value:target});
      const before=passed;host.dispatchEvent(event);expect(event.defaultPrevented).toBeFalse();expect(passed).toBe(before+1);
    }
    const event=new Event("keydown",{cancelable:true});Object.assign(event,{key:"ArrowLeft",ctrlKey:false,metaKey:false,altKey:false});Object.defineProperty(event,"target",{value:canvas});
    const before=passed;host.dispatchEvent(event);expect(event.defaultPrevented).toBeTrue();expect(passed).toBe(before);
  });
});

test("stale play rejections cannot override pause/resume or clip changes and one video is reused",async()=>{
  await fixture(async({controller,app,videos,click})=>{
    click("Watch recording");
    const video=videos[0],select=descendants(app).find(e=>e.tagName==="SELECT")!;
    const toggle=()=>descendants(app).find(e=>e.tagName==="BUTTON"&&["Play","Pause"].includes(e.textContent))!;
    const reject=async(index:number)=>{video.plays[index].reject(new Error("Aborted obsolete play"));await Promise.resolve();};
    click("Pause");expect(toggle().textContent).toBe("Play");click("Play");
    await reject(0);expect(toggle().textContent).toBe("Pause");
    controller.suspend();expect(video.paused).toBeTrue();controller.update(100);
    await reject(1);expect(toggle().textContent).toBe("Pause");
    select.value="1";select.onchange!();await reject(2);
    expect(toggle().textContent).toBe("Pause");expect(video.src).toEndWith("columbiahalle-v258-red-silent.mp4");
    click("Pause");const attempts=video.plays.length;select.value="2";select.onchange!();await reject(3);
    expect(toggle().textContent).toBe("Play");expect(video.plays.length).toBe(attempts);
    expect(video.src).toEndWith("columbiahalle-v258-portrait-silent.mp4");
    expect(videos.length).toBe(1);expect(descendants(app).filter(e=>e.tagName==="VIDEO")).toEqual([video]);
    click("Play");await reject(4);expect(toggle().textContent).toBe("Play"); // A current failure still updates the control.
    click("Play");controller.close();await reject(5);
    expect(video.src).toBe("");expect(video.paused).toBeTrue();expect(descendants(app).some(e=>e.tagName==="VIDEO")).toBeFalse();
  });
});
