import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3, type WebGLRenderer } from "three";
import type { createColumbiaConcertV257 } from "./ColumbiaConcertV257";

export type ColumbiahalleV257 = ReturnType<typeof createColumbiahalleV257>;
const ENTRANCE = new Vector3(1340.17,4.8,3854.77);
const NORMAL = new Vector3(-.110303,0,.993898);
const TANGENT = new Vector3(.993898,0,.110303);
const APPROACH_SCREEN = new Vector3();

export function columbiaCopyV257(language:string) {
  return language.toLowerCase().startsWith("de") ? {
    enter:"Columbiahalle betreten", description:"Columbiahalle · Beispielkonzert · stumm",
    recording:"Aufnahme ansehen", leave:"Verlassen", pause:"Pause", play:"Abspielen",
    back:"Zur Lichtszene", videoLabel:"Bereitgestellte Konzertaufnahme · stumme Endlosschleife · 19.10.2026",
    videoAria:"Stumme bereitgestellte Konzertaufnahme", error:"Die Columbiahalle konnte nicht geöffnet werden.",
  } : {
    enter:"Enter Columbiahalle", description:"Columbiahalle · illustrative concert · silent",
    recording:"Watch recording", leave:"Leave", pause:"Pause", play:"Play",
    back:"Back to light scene", videoLabel:"Provided concert recording · silent loop · 19 October 2026",
    videoAria:"Silent provided concert recording", error:"The Columbiahalle could not be opened.",
  };
}

/** Only room controls belong to this view. Browser chords and other keys pass. */
export function columbiaKeyActionV257(key:Pick<KeyboardEvent,"key"|"ctrlKey"|"metaKey"|"altKey">) {
  if(key.ctrlKey||key.metaKey||key.altKey)return null;
  return ({Escape:"exit",ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down"} as Record<string,string>)[key.key]??null;
}

export function columbiaApproachV257(camera: PerspectiveCamera): boolean {
  const x=camera.position.x-ENTRANCE.x,z=camera.position.z-ENTRANCE.z;
  const forward=x*NORMAL.x+z*NORMAL.z,side=Math.abs(x*TANGENT.x+z*TANGENT.z);
  if(forward<=1||forward>=72||side>=32||Math.abs(camera.position.y-ENTRANCE.y)>=24)return false;
  const screen=APPROACH_SCREEN.copy(ENTRANCE).project(camera);
  return screen.z>-1 && screen.z<1 && Math.abs(screen.x)<.92 && Math.abs(screen.y)<.9;
}

/** Reversible portal into a bounded illustrative room. One existing renderer
 * and frame loop; no city geometry, navigation or user camera is modified. */
export function createColumbiahalleV257(options:{
  canvas:HTMLCanvasElement; renderer:WebGLRenderer; worldCamera:PerspectiveCamera;
  native:()=>boolean; reducedMotion:boolean; invalidate:()=>void;
  onChange?:(entered:boolean,restoreAudio?:boolean)=>void;
  resetInput:()=>void; onError?:(message:string)=>void;
}) {
  const parent=options.canvas.parentElement!;
  let entered=false,disposed=false,pending=false;
  let concert:ReturnType<typeof createColumbiaConcertV257>|null=null;
  let native=false,lastFrame=-Infinity,lastTime=0,elapsed=0;
  let pitch=.063,yaw=0,suspended=false;
  let lastWidth=0,lastHeight=0;
  let pointer:{id:number;x:number;y:number;startX:number;startY:number;at:number;door:boolean}|null=null;
  let video:HTMLVideoElement|null=null,videoPanel:HTMLDivElement|null=null,recordingPaused=false;
  let videoLabel:HTMLDivElement|null=null,videoToggle:HTMLButtonElement|null=null,videoBack:HTMLButtonElement|null=null;
  let language=document.documentElement.lang,copy=columbiaCopyV257(language);
  let previousZIndex:string|null=null;
  const cityControls=new Map<HTMLElement,boolean>();
  const ray=new Raycaster(),ndc=new Vector2(),hit=new Vector3();
  const plane=new Plane().setFromNormalAndCoplanarPoint(NORMAL,ENTRANCE);
  const ui=document.createElement("div");
  ui.dataset.columbiahalleV257="true";
  ui.style.cssText="position:absolute;right:16px;bottom:calc(148px + env(safe-area-inset-bottom, 0px));z-index:30;display:none;gap:8px;align-items:center;flex-wrap:wrap;max-width:calc(100% - 32px);padding:10px;border-radius:10px;background:#111520ed;color:#f2e7d2;font:14px system-ui;box-shadow:0 3px 16px #0006";
  ui.hidden=true;
  const showUi=(show:boolean)=>{ui.hidden=!show;ui.style.display=show?"flex":"none";};
  const button=(text:string,action:()=>void)=>{
    const b=document.createElement("button");b.type="button";b.textContent=text;
    b.style.cssText="border:1px solid #7b8496;border-radius:6px;background:#263349;color:#fff;padding:10px 12px;min-height:44px;font:inherit;cursor:pointer";
    b.onclick=action;ui.append(b);return b;
  };
  const enter=button(copy.enter,()=>{void open();});
  const description=document.createElement("span");
  description.textContent=copy.description;
  description.style.cssText="max-width:250px";ui.append(description);description.hidden=true;
  const recording=button(copy.recording,()=>showRecording());recording.hidden=true;
  const leave=button(copy.leave,()=>close(true));leave.hidden=true;
  // Share the app overlay layer so mobile controls cannot cover entry.
  (parent.closest(".app-shell")??parent).append(ui);

  function presentInterior(show:boolean) {
    // Outside, leave room for the mobile bottom toolbar and device safe area.
    ui.style.bottom=show?"calc(24px + env(safe-area-inset-bottom, 0px))":"calc(148px + env(safe-area-inset-bottom, 0px))";
    ui.style.zIndex=show?"60":"30";
    if(show) {
      previousZIndex=parent.style.zIndex;parent.style.zIndex="50";
      const app=parent.closest(".app-shell");
      if(app) {
        let branch:HTMLElement=parent;
        while(branch.parentElement&&branch.parentElement!==app)branch=branch.parentElement;
        for(const sibling of app.children)if(sibling!==branch&&sibling!==ui&&"inert" in sibling){
          const control=sibling as HTMLElement;cityControls.set(control,control.inert);control.inert=true;
        }
      }
    } else {
      if(previousZIndex!==null){parent.style.zIndex=previousZIndex;previousZIndex=null;}
      for(const [control,inert] of cityControls)control.inert=inert;
      cityControls.clear();
    }
  }

  function syncLanguage() {
    if(language===document.documentElement.lang)return;
    language=document.documentElement.lang;copy=columbiaCopyV257(language);
    enter.textContent=copy.enter;description.textContent=copy.description;
    recording.textContent=copy.recording;leave.textContent=copy.leave;
    if(videoLabel)videoLabel.textContent=copy.videoLabel;
    if(videoToggle)videoToggle.textContent=recordingPaused?copy.play:copy.pause;
    if(videoBack)videoBack.textContent=copy.back;
    video?.setAttribute("aria-label",copy.videoAria);
  }

  function hideRecording() {
    if(video){video.pause();video.removeAttribute("src");video.load();video.remove();video=null;}
    videoPanel?.remove();videoPanel=null;videoLabel=null;videoToggle=null;videoBack=null;recordingPaused=false;lastFrame=-Infinity;
  }
  function showRecording() {
    if(!entered||videoPanel)return;
    syncLanguage();
    videoPanel=document.createElement("div");
    videoPanel.style.cssText="position:absolute;inset:12% 8% 18%;z-index:31;background:#070911f5;padding:14px;border:1px solid #64718a;border-radius:12px;display:flex;flex-direction:column;gap:8px;color:white;font:14px system-ui";
    const label=document.createElement("div");label.textContent=copy.videoLabel;videoLabel=label;
    video=document.createElement("video");video.muted=true;video.defaultMuted=true;video.volume=0;
    video.playsInline=true;video.loop=true;video.preload="none";
    video.style.cssText="width:100%;height:calc(100% - 90px);min-height:0;object-fit:contain;background:black";
    video.setAttribute("aria-label",copy.videoAria);
    video.src=new URL("media/columbiahalle-v257-silent.mp4",document.baseURI).href;
    const buttons=document.createElement("div");buttons.style.cssText="display:flex;gap:8px";
    const toggle=document.createElement("button");toggle.type="button";toggle.textContent=copy.pause;videoToggle=toggle;
    toggle.onclick=()=>{if(!video)return;recordingPaused=!recordingPaused;toggle.textContent=recordingPaused?copy.play:copy.pause;if(recordingPaused)video.pause();else void video.play().catch(()=>{});};
    const back=document.createElement("button");back.type="button";back.textContent=copy.back;back.onclick=hideRecording;videoBack=back;
    for(const b of [toggle,back]){b.style.cssText=leave.style.cssText;buttons.append(b);}
    videoPanel.append(label,video,buttons);parent.append(videoPanel);
    void video.play().catch(()=>{recordingPaused=true;toggle.textContent=copy.play;});back.focus();
  }
  async function open() {
    if(disposed||pending||entered)return;
    pending=true;enter.disabled=true;
    try {
      const {createColumbiaConcertV257}=await import("./ColumbiaConcertV257");
      if(disposed)return;
      native=options.native();concert=createColumbiaConcertV257(native);
      options.onChange?.(true);options.resetInput();
      entered=true;elapsed=0;lastTime=0;lastFrame=-Infinity;pitch=.063;yaw=0;
      presentInterior(true);
      enter.hidden=true;description.hidden=false;recording.hidden=false;leave.hidden=false;
      showUi(true);leave.focus();options.invalidate();
    } catch(error) {options.onError?.(error instanceof Error?error.message:copy.error);}
    finally {pending=false;enter.disabled=false;}
  }
  function close(restoreAudio:boolean) {
    if(!entered)return;
    hideRecording();concert?.dispose();concert=null;entered=false;pointer=null;
    presentInterior(false);
    options.resetInput();options.onChange?.(false,restoreAudio);
    enter.hidden=false;description.hidden=true;recording.hidden=true;leave.hidden=true;
    options.invalidate();if(!disposed)options.canvas.focus({preventScroll:true});
  }
  function doorAt(x:number,y:number) {
    if(!columbiaApproachV257(options.worldCamera))return false;
    const r=options.canvas.getBoundingClientRect();
    ndc.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);
    ray.setFromCamera(ndc,options.worldCamera);
    if(!ray.ray.intersectPlane(plane,hit))return false;
    hit.sub(ENTRANCE);
    return Math.abs(hit.dot(TANGENT))<5.2 && hit.y>-1.6 && hit.y<2.3;
  }
  function pointerDown(e:PointerEvent) {
    if(e.target!==options.canvas)return;
    const door=!entered && doorAt(e.clientX,e.clientY);
    if(!entered&&!door)return;
    pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,at:performance.now(),door};
    if(entered){e.preventDefault();e.stopImmediatePropagation();options.canvas.focus();}
  }
  function pointerMove(e:PointerEvent) {
    if(!entered||!pointer||pointer.id!==e.pointerId)return;
    yaw=Math.max(-.8,Math.min(.8,yaw-(e.clientX-pointer.x)*.0025));
    pitch=Math.max(-.25,Math.min(.45,pitch+(e.clientY-pointer.y)*.0025));
    pointer.x=e.clientX;pointer.y=e.clientY;lastFrame=-Infinity;
    e.preventDefault();e.stopImmediatePropagation();
  }
  function pointerUp(e:PointerEvent) {
    if(!pointer||pointer.id!==e.pointerId)return;
    const p=pointer;pointer=null;
    if(entered){e.preventDefault();e.stopImmediatePropagation();return;}
    if(e.type!=="pointercancel"&&p.door&&Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<7&&performance.now()-p.at<600){e.preventDefault();e.stopImmediatePropagation();void open();}
  }
  function key(e:KeyboardEvent) {
    if(!entered)return;
    const action=columbiaKeyActionV257(e);if(!action)return;
    if(action==="exit"){e.preventDefault();e.stopImmediatePropagation();if(videoPanel)hideRecording();else close(true);return;}
    if(action==="left")yaw=Math.min(.8,yaw+.055);
    if(action==="right")yaw=Math.max(-.8,yaw-.055);
    if(action==="up")pitch=Math.min(.45,pitch+.04);
    if(action==="down")pitch=Math.max(-.25,pitch-.04);
    lastFrame=-Infinity;e.preventDefault();e.stopImmediatePropagation();
  }
  function wheel(e:WheelEvent){if(entered&&e.target===options.canvas){e.preventDefault();e.stopImmediatePropagation();}}
  function suspend(){suspended=true;lastTime=0;lastFrame=-Infinity;video?.pause();pointer=null;showUi(false);if(videoPanel){videoPanel.hidden=true;videoPanel.style.display="none";}}
  const visibility=()=>{if(document.hidden)suspend();};
  window.addEventListener("pointerdown",pointerDown,true);
  window.addEventListener("pointermove",pointerMove,true);
  window.addEventListener("pointerup",pointerUp,true);
  window.addEventListener("pointercancel",pointerUp,true);
  window.addEventListener("keydown",key,true);
  window.addEventListener("wheel",wheel,{capture:true,passive:false});
  document.addEventListener("visibilitychange",visibility);
  document.addEventListener("freeze",suspend);
  window.addEventListener("pagehide",suspend);
  return {
    get entered(){return entered;},open,close:()=>close(true),suspend,
    update(timestamp:number):boolean {
      if(disposed)return false;
      syncLanguage();
      if(document.hidden){suspend();return entered;}
      if(!entered){showUi(columbiaApproachV257(options.worldCamera));return false;}
      const viewport=options.canvas.getBoundingClientRect();
      if(!options.canvas.isConnected||viewport.width<=0||viewport.height<=0){suspend();return entered;}
      if(suspended){suspended=false;lastFrame=-Infinity;if(videoPanel){videoPanel.hidden=false;videoPanel.style.display="flex";}if(video&&!recordingPaused)void video.play().catch(()=>{});}
      showUi(true);
      if(native!==options.native()){close(true);return false;}
      if(!concert)return true;
      if(viewport.width!==lastWidth||viewport.height!==lastHeight){lastWidth=viewport.width;lastHeight=viewport.height;lastFrame=-Infinity;}
      const delta=lastTime?Math.min(50,Math.max(0,timestamp-lastTime)):0;lastTime=timestamp;
      if(!videoPanel)elapsed+=delta/1000;
      if(timestamp-lastFrame<33 || (options.reducedMotion&&lastFrame!==-Infinity)||videoPanel)return true;
      lastFrame=timestamp;
      concert.camera.aspect=Math.max(1,viewport.width)/Math.max(1,viewport.height);concert.camera.updateProjectionMatrix();
      concert.camera.lookAt(Math.sin(yaw)*24,2.35+Math.sin(pitch)*24,12.2-Math.cos(yaw)*24);
      concert.update(elapsed,options.reducedMotion);
      options.renderer.setRenderTarget(null);options.renderer.render(concert.scene,concert.camera);
      return true;
    },
    dispose(){
      if(disposed)return;disposed=true;close(false);hideRecording();ui.remove();
      window.removeEventListener("pointerdown",pointerDown,true);window.removeEventListener("pointermove",pointerMove,true);
      window.removeEventListener("pointerup",pointerUp,true);window.removeEventListener("pointercancel",pointerUp,true);
      window.removeEventListener("keydown",key,true);window.removeEventListener("wheel",wheel,true);
      document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",suspend);
      document.removeEventListener("freeze",suspend);
    },
  };
}
