/** Execute the actual two Viewer functions without constructing a whole city. */
import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import ts from "typescript";
import {BufferAttribute,BufferGeometry,Group,Mesh,MeshBasicMaterial,Line,Points} from "three";
import {completeCooperatively} from "../src/cooperativeWork";

const source=readFileSync(new URL("../src/ThreeViewer.tsx",import.meta.url),"utf8");
const ast=ts.createSourceFile("ThreeViewer.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function actual(name:string,dependencies:Record<string,unknown>):(...args:any[])=>any{
  const node=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
  if(!node)throw Error(`Missing actual Viewer function ${name}`);
  const js=ts.transpileModule(node.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  return new Function(...Object.keys(dependencies),`${js}\nreturn ${name};`)(...Object.values(dependencies));
}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return{promise,resolve};}
async function settle(){for(let i=0;i<20;i++)await Promise.resolve();}
function attachment(government?:any,yieldTask:()=>Promise<void>=async()=>{}){
  const world=new Group(),batch=new Group(),trace:string[]=[],acks:any[]=[],disposed:any[]=[],failed:any[]=[];
  const worker={postMessage:(value:any)=>acks.push(value)};
  const runtime:any={isoWorld:world,progressiveWorldWorker:worker,progressiveWorldBatches:[],lightingMode:"day",nightLightsOn:false,
    governmentOfficesV321:{drawn:government},gpuResidency:{enqueue:()=>trace.push("gpu")},geometryResidency:{enqueue:()=>{}},
    gpuWarmup:{enqueue:()=>{}},scheduleGpuWarmup:()=>{},inkLineObjects:[],berlinerEnsembleRoofSignTargets:[]};
  const noop=()=>{};
  const attach=actual("attachProgressiveWorldMessage",{Group,Mesh,Line,Points,
    releaseBuiltWorldPayloads:noop,invalidateScenePresentation:()=>trace.push("invalidate"),
    progressiveWorldStopPolicy:()=>({nextState:"complete"}),collectFarZoomAntiFlickerTargets:noop,
    tryProgressiveWorkerOperation:(action:()=>void)=>{action();return{ok:true};},failProgressiveWorld:()=>failed.push(true),
    deserializeTransferredObject3D:(object:any)=>object,disposeObject3D:(_runtime:any,object:any)=>{disposed.push(object);object.removeFromParent();},
    cutRosenthalerPresentationV228:noop,cutUbahnPresentationV261:noop,cutUbahnPresentationV281:noop,
    setIsoNightPresentation:(_object:any,_night:any,_lights:any,mode:string)=>trace.push(`lighting:${mode}`),interleaveStaticGeometry:noop,
    completeCooperatively:(steps:any,options:any)=>completeCooperatively(steps,{...options,budgetMs:0}),
    governmentSwapHooksV321:()=>({}),yieldStartupWork:yieldTask,isoWorldIntentActive:(state:any)=>state.intent!==false,
    parkCompletedGeometry:()=>Promise.resolve(),hideReplacedBuildingPreview:()=>trace.push("hide-preview"),
    appendFarZoomAntiFlickerTargets:noop,assignStableInkRenderOrder:noop,updateBerlinerEnsembleRoofSign:noop,setEnvironmentalPresentation:noop,
  });
  return{runtime,world,batch,worker,trace,acks,disposed,failed,run:()=>attach(runtime,worker,{type:"batch",kind:"buildings",id:"exact-a",object:batch,replaces:[]},noop)};
}
function office(options:{stage?:()=>Generator<void,boolean>;activate?:boolean;ready?:boolean}={}){
  const trace:string[]=[];let batch:Group|undefined;
  const value={complete:()=>options.ready!==false,
    *stagePreviousSteps(object:Group){batch=object;trace.push(`stage:${object.parent===null}`);return yield*(options.stage?.()??(function*(){yield;return true;})());},
    activateFamily(object:Group){trace.push(`activate:${object.parent!==null}`);return options.activate!==false;},
    releaseFamily(object:Group){trace.push(`release:${object===batch}`);},
  };return{value,trace};
}

test("actual Viewer keeps original progressive batches when the optional replacement is absent or closed",async()=>{
  for(const government of[undefined,office({ready:false}).value]){
    const f=attachment(government);await f.run();await settle();
    expect(f.batch.parent).toBe(f.world);expect(f.runtime.progressiveWorldBatches).toEqual([f.batch]);
    expect(f.failed).toHaveLength(0);expect(f.disposed).toHaveLength(0);expect(f.acks).toEqual([{id:"exact-a",type:"batch-attached"}]);
  }
});
test("actual Viewer restores and attaches original batches after stage rejection or exception",async()=>{
  for(const stage of[function*(){yield;return false;},function*():Generator<void,boolean>{yield;throw Error("closed source");}]){
    const gov=office({stage}),f=attachment(gov.value);await f.run();await settle();
    expect(gov.trace).toEqual(["stage:true","release:true"]);expect(f.batch.parent).toBe(f.world);
    expect(f.failed).toHaveLength(0);expect(f.disposed).toHaveLength(0);expect(f.acks).toHaveLength(1);
  }
});
test("actual Viewer activates only after attachment and keeps original source after activation rejection",async()=>{
  for(const activate of[true,false]){
    const gov=office({activate}),f=attachment(gov.value);await f.run();await settle();
    expect(gov.trace).toEqual(activate?["stage:true","activate:true"]:["stage:true","activate:true","release:true"]);
    expect(f.batch.parent).toBe(f.world);expect(f.failed).toHaveLength(0);expect(f.acks).toHaveLength(1);
  }
});
test("actual Viewer cancels unpublished attachment on worker, world, mode-intent or disposal changes while yielding",async()=>{
  for(const cancel of[(f:any)=>f.runtime.progressiveWorldWorker={},(f:any)=>f.runtime.isoWorld=new Group(),
    (f:any)=>f.runtime.intent=false,(f:any)=>f.runtime.disposed=true]){
    const wait=deferred(),gov=office(),f=attachment(gov.value,()=>wait.promise);const running=f.run();
    cancel(f);wait.resolve();await running;await settle();
    expect(f.batch.parent).toBeNull();expect(f.runtime.progressiveWorldBatches).toHaveLength(0);
    expect(f.disposed).toEqual([f.batch]);expect(f.acks).toHaveLength(0);expect(f.failed).toHaveLength(0);
  }
});
test("actual Viewer rechecks publication ownership after the final cooperative Promise gap",async()=>{
  for(const admitted of[true,false]){
    let f:ReturnType<typeof attachment>;
    const gov=office({stage:function*(){yield;queueMicrotask(()=>{f.runtime.isoWorld=new Group();});return admitted;}});
    f=attachment(gov.value);await f.run();await settle();
    expect(f.batch.parent).toBeNull();expect(f.runtime.progressiveWorldBatches).toHaveLength(0);
    expect(f.disposed).toEqual([f.batch]);expect(f.acks).toHaveLength(0);
  }
});

function centralFixture(){
  const waiters:Array<ReturnType<typeof deferred>>=[],staged:Group[]=[],released:Group[]=[],uploads:Group[]=[];
  let live:Group|null=null,ready=true,prepareResult=true;
  const runtime:any={loadSignal:{aborted:false},scene:new Group(),isoWorld:new Group(),centralDetails:new Group(),
    gpuResidency:{enqueue:(root:Group)=>uploads.push(root)},geometryResidency:{enqueue:()=>{}}};
  const manager={prepare:()=>prepareResult,sync:()=>live===runtime.centralDetails&&ready,
    *stageSteps(root:Group){staged.push(root);yield;live=root;return true;},release:(root:Group)=>{released.push(root);if(live===root)live=null;}};
  const ensure=actual("ensureGovernmentCentralV321",{loadGovernmentModuleV323:async()=>({createGovernmentCentralV321:()=>manager}),
    voxelModeActive:()=>false,currentGovernmentOfficesV321:()=>ready?{}:undefined,governmentSwapHooksV321:()=>({}),
    completeCooperatively:(steps:any,options:any)=>completeCooperatively(steps,{...options,budgetMs:0}),
    yieldStartupWork:()=>{const wait=deferred();waiters.push(wait);return wait.promise;},invalidateScenePresentation:()=>{},
  });
  return{runtime,manager,ensure,waiters,staged,released,uploads,setReady:(value:boolean)=>ready=value,
    setPrepare:(value:boolean)=>prepareResult=value};
}
async function advance(f:ReturnType<typeof centralFixture>){const wait=f.waiters.shift();if(!wait)throw Error("Expected cooperative task");wait.resolve();await settle();}
test("actual Viewer coalesces Central requests and retries a replacement root after pending work cancels",async()=>{
  const f=centralFixture(),old=f.runtime.centralDetails;const first=f.ensure(f.runtime);await settle();
  f.manager.release(old);f.runtime.centralDetails=new Group();const next=f.runtime.centralDetails;
  const second=f.ensure(f.runtime);await settle();expect(f.runtime.governmentCentralRetryV321).toBe(true);
  await advance(f);await first;await second;await settle();
  expect(f.waiters).toHaveLength(1);await advance(f);await advance(f);
  expect(f.staged).toEqual([next]);expect(f.uploads).toEqual([next]);expect(f.runtime.governmentCentralPendingV321).toBeUndefined();
  expect(f.runtime.governmentCentralRetryV321).toBe(false);
});
test("actual Viewer retries a ready mode once, without duplicate staging or permanent retry loops",async()=>{
  const f=centralFixture();const first=f.ensure(f.runtime);await settle();await advance(f);
  for(let i=0;i<3;i++)void f.ensure(f.runtime);await settle();
  expect(f.runtime.governmentCentralRetryV321).toBe(true);await advance(f);await first;await settle();
  expect(f.staged).toHaveLength(1);expect(f.uploads).toHaveLength(1);expect(f.waiters).toHaveLength(0);
  expect(f.runtime.governmentCentralRetryV321).toBe(false);
});
test("actual Viewer neither retries nor uploads canceled Central work after runtime disposal",async()=>{
  const f=centralFixture();const first=f.ensure(f.runtime);await settle();void f.ensure(f.runtime);await settle();f.runtime.disposed=true;
  await advance(f);await first;expect(f.staged).toHaveLength(0);expect(f.uploads).toHaveLength(0);expect(f.waiters).toHaveLength(0);
});

type PreparationFailure="factory-null"|"factory-throw"|"core-false"|"core-throw"|"press-false"|"press-throw"|"preview-false"|"preview-throw"|undefined;
function preparation(failure?:PreparationFailure){
  const geometry=()=>{const g=new BufferGeometry();g.setAttribute("position",new BufferAttribute(new Float32Array([0,0,0,1,0,0,0,1,0]),3));g.setIndex([0,1,2]);return g;};
  const world=new Group(),preview=new Group(),press=new Group(),root=new Group(),trace:string[]=[],disposed:Group[]=[];
  preview.name="Startup complete building coverage";
  press.name="Press quarter v272 complete measured architecture";
  const core=new Mesh(geometry(),new MeshBasicMaterial()),outline=new Mesh(geometry(),new MeshBasicMaterial()),street=new Mesh(geometry(),new MeshBasicMaterial()),neighbor=new Mesh(geometry(),new MeshBasicMaterial());
  const originalCore=core.geometry,originalOutline=outline.geometry,originalStreet=street.geometry,originalNeighbor=neighbor.geometry;
  preview.add(outline);press.add(street);world.add(core,preview,press,neighbor);root.add(new Group());
  const bundle={root,
    *stagePreviousSteps(target:Group){trace.push("core");expect(target).toBe(world);core.geometry=geometry();yield;
      if(failure==="core-throw")throw Error("core source rejected");return failure!=="core-false";},
    *stagePressQuarterSteps(target:Group){trace.push("press");expect(target).toBe(press);street.geometry=geometry();yield;
      if(failure==="press-throw")throw Error("press source rejected");return failure!=="press-false";},
    *stagePreviewSteps(target:Group){trace.push("preview");expect(target).toBe(preview);outline.geometry=geometry();yield;
      if(failure==="preview-throw")throw Error("preview source rejected");return failure!=="preview-false";},
    rollback(){trace.push("rollback");core.geometry=originalCore;outline.geometry=originalOutline;street.geometry=originalStreet;},
  };
  const dependencies={
    createGovernmentOfficesV321Steps:function*(){trace.push("factory");yield;
      if(failure==="factory-throw")throw Error("factory source rejected");return failure==="factory-null"?null:bundle;},
    governmentSwapHooksV321:()=>({}),disposeObject3D:(_runtime:any,object:Group)=>{disposed.push(object);object.removeFromParent();},
  };
  const prepare=actual("prepareGovernmentOfficesV321Steps",dependencies);
  return{world,preview,press,core,outline,street,neighbor,root,trace,disposed,bundle,originalCore,originalOutline,originalStreet,originalNeighbor,
    start:(native=false)=>{press.name=native?"Press quarter v272 independent native architecture":"Press quarter v272 complete measured architecture";return prepare({},world,{native,sourcePrisms:[],mobileLike:false},dependencies) as Generator<void,typeof bundle|null>;}};
}
function drain<T>(steps:Generator<void,T>){for(;;){const step=steps.next();if(step.done)return step.value;}}
function originalCityRetained(f:ReturnType<typeof preparation>){
  expect(f.core.geometry).toBe(f.originalCore);expect(f.outline.geometry).toBe(f.originalOutline);expect(f.neighbor.geometry).toBe(f.originalNeighbor);
  expect(f.street.geometry).toBe(f.originalStreet);expect(f.press.parent).toBe(f.world);
  expect(f.core.parent).toBe(f.world);expect(f.preview.parent).toBe(f.world);expect(f.neighbor.parent).toBe(f.world);
  expect([...f.originalNeighbor.index!.array]).toEqual([0,1,2]);expect(f.world.children).toEqual([f.core,f.preview,f.press,f.neighbor]);
}
test("actual Viewer initial preparation keeps the ordinary city after null or throwing optional factories",()=>{
  for(const failure of["factory-null","factory-throw"] as const){
    const f=preparation(failure);const result=drain(f.start());expect(result).toBeNull();originalCityRetained(f);
    expect(f.disposed).toHaveLength(0);expect(f.trace).toEqual(["factory"]);
    const ordinaryLater=new Group();f.world.add(ordinaryLater);expect(ordinaryLater.parent).toBe(f.world);
  }
});
test("actual Viewer initial preparation rolls back all source families on rejected or throwing Core/Press/Preview stages",()=>{
  for(const failure of["core-false","core-throw","press-false","press-throw","preview-false","preview-throw"] as const){
    const f=preparation(failure);expect(drain(f.start())).toBeNull();originalCityRetained(f);
    expect(f.root.parent).toBeNull();expect(f.disposed).toEqual([f.root]);expect(f.trace.filter(s=>s==="rollback")).toHaveLength(1);
    const ordinaryLater=new Group();f.world.add(ordinaryLater);expect(ordinaryLater.parent).toBe(f.world);
  }
});
test("actual Viewer cancels unpublished preparation and restores the original city at every delivered stage",()=>{
  for(const stage of["factory","core","press","preview"]){
    const f=preparation(),steps=f.start();
    for(let i=0;i<10;i++){const step=steps.next();expect(step.done).toBe(false);if(f.trace.at(-1)===stage)break;}
    steps.return(null);originalCityRetained(f);expect(f.root.parent).toBeNull();
    expect(f.disposed).toEqual(stage==="factory"?[]:[f.root]);
  }
});
test("actual Viewer delivers an admitted optional bundle once and Native never stages the Drawn preview",()=>{
  for(const native of[false,true]){
    const f=preparation();expect(drain(f.start(native))).toBe(f.bundle);expect(f.root.parent).toBe(f.world);
    expect(f.core.geometry).not.toBe(f.originalCore);expect(f.outline.geometry===f.originalOutline).toBe(native);
    expect(f.street.geometry).not.toBe(f.originalStreet);
    expect(f.trace).toEqual(native?["factory","core","press"]:["factory","core","press","preview"]);expect(f.disposed).toHaveLength(0);
    expect(f.neighbor.geometry).toBe(f.originalNeighbor);
  }
});
test("actual Viewer requires exactly one existing mode-correct PressQuarter group before keeping an optional replacement",()=>{
  for(const native of[false,true])for(const duplicate of[false,true]){
    const f=preparation();if(duplicate){const extra=new Group();extra.name=native?"Press quarter v272 independent native architecture":"Press quarter v272 complete measured architecture";f.world.add(extra);}else f.press.removeFromParent();
    const originals=[...f.world.children];expect(drain(f.start(native))).toBeNull();expect(f.world.children).toEqual(originals);
    expect(f.core.geometry).toBe(f.originalCore);expect(f.outline.geometry).toBe(f.originalOutline);expect(f.street.geometry).toBe(f.originalStreet);
    expect(f.neighbor.geometry).toBe(f.originalNeighbor);expect(f.trace).toEqual(["factory","core","rollback"]);expect(f.disposed).toEqual([f.root]);
  }
});

test("actual Viewer government lighting selects only the active admitted family and forwards mode plus lights-off",()=>{
  const voxelMode=actual("voxelModeActive",{}),currentGovernment=actual("currentGovernmentOfficesV321",{voxelModeActive:voxelMode});
  const calls:any[]=[];const relight=actual("applyGovernmentLightingV321",{
    currentGovernmentOfficesV321:currentGovernment,applyLightingToRoot:(root:Group,mode:string,lightsOn:boolean)=>calls.push({root,mode,lightsOn}),
  });
  const scene=new Group(),drawnWorld=new Group(),nativeWorld=new Group(),drawnRoot=new Group(),nativeRoot=new Group();
  scene.add(drawnWorld,nativeWorld);drawnWorld.add(drawnRoot);nativeWorld.add(nativeRoot);
  let drawnValid=true,nativeValid=true;
  const runtime:any={scene,isoWorld:drawnWorld,voxelWorld:nativeWorld,lightingMode:"day",governmentOfficesV321:{
    drawn:{root:drawnRoot,complete:()=>drawnValid&&drawnRoot.visible},native:{root:nativeRoot,complete:()=>nativeValid&&nativeRoot.visible},
  }};
  for(const mode of["day","night","snowstorm","flood","schwellenraum","minecraft"]){
    runtime.lightingMode=mode;relight(runtime,mode,false);expect(calls.at(-1)).toEqual({root:mode==="minecraft"?nativeRoot:drawnRoot,mode,lightsOn:false});
  }
  calls.length=0;runtime.lightingMode="minecraft";nativeValid=false;relight(runtime,"minecraft",true);expect(calls).toHaveLength(0);
  nativeValid=true;nativeRoot.visible=false;relight(runtime,"minecraft",true);expect(calls).toHaveLength(0);
  nativeRoot.visible=true;nativeRoot.removeFromParent();relight(runtime,"minecraft",true);expect(calls).toHaveLength(0);nativeWorld.add(nativeRoot);
  nativeWorld.removeFromParent();relight(runtime,"minecraft",true);expect(calls).toHaveLength(0);scene.add(nativeWorld);
  runtime.lightingMode="night";drawnValid=false;relight(runtime,"night",false);expect(calls).toHaveLength(0);
  drawnValid=true;drawnRoot.visible=false;relight(runtime,"night",false);expect(calls).toHaveLength(0);
});
test("actual scene lighting always relights admitted government before creating Minecraft material clones",()=>{
  const sceneLighting=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="setSceneLighting")as ts.FunctionDeclaration;
  expect(sceneLighting).toBeDefined();
  const directCalls=sceneLighting.body!.statements.flatMap(statement=>ts.isExpressionStatement(statement)&&ts.isCallExpression(statement.expression)?[statement.expression]:[]);
  const governmentCalls=directCalls.filter(call=>call.expression.getText(ast)==="applyGovernmentLightingV321");
  expect(governmentCalls).toHaveLength(1);expect(governmentCalls[0].arguments.map(a=>a.getText(ast))).toEqual(["runtime","mode","lightsOn"]);
  const tram=directCalls.find(call=>call.expression.getText(ast)==="applyLightingToRoot"&&call.arguments[0].getText(ast)==="runtime.tramCatenary")!;
  expect(governmentCalls[0].pos).toBeGreaterThan(tram.pos);
  const cloneCalls:ts.CallExpression[]=[];const visit=(node:ts.Node)=>{if(ts.isCallExpression(node)&&node.expression.getText(ast)==="setMinecraftMaterialPresentation")cloneCalls.push(node);ts.forEachChild(node,visit);};
  visit(sceneLighting);expect(cloneCalls.length).toBeGreaterThan(0);expect(cloneCalls.every(call=>call.pos>governmentCalls[0].pos)).toBeTrue();
});
