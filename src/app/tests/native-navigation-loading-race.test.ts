import { expect, test } from "bun:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import { publishedNavigationMode, type VisualMode } from "../src/visualMode";

const viewer = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
const parsed = ts.createSourceFile("ThreeViewer.tsx", viewer, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const modeCallbacks: string[] = [];
const callbackOwners: string[] = [];
function visit(node: ts.Node): void {
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isArrowFunction(node.right) && /^(pedestrianEnvironment|environment)\.visualMode$/.test(node.left.getText(parsed))) {
    modeCallbacks.push(node.right.getText(parsed));
    callbackOwners.push(node.left.getText(parsed));
  }
  ts.forEachChild(node, visit);
}
visit(parsed);

test("navigation preserves every drawn mode and activates native queries only after publication", () => {
  for (const mode of ["day", "night", "snowstorm", "schwellenraum", "flood"] as VisualMode[]) {
    expect(publishedNavigationMode(mode, false)).toBe(mode);
    expect(publishedNavigationMode(mode, true)).toBe(mode);
  }
  expect(publishedNavigationMode("minecraft", false)).toBe("day");
  expect(publishedNavigationMode("minecraft", true)).toBe("minecraft");
  expect(modeCallbacks).toHaveLength(2);
  expect(callbackOwners).toEqual(["pedestrianEnvironment.visualMode", "environment.visualMode"]);
});

for (const fails of [false, true]) {
  test(`both live navigation callbacks remain safe during a ${fails ? "rejected" : "pending"} native import`, () => {
    const profile = fileURLToPath(new URL("../src/altMitteV169Profile.ts", import.meta.url));
    const modeModule = fileURLToPath(new URL("../src/visualMode.ts", import.meta.url));
    const script = `
      import { plugin } from "bun";
      let open, reject;
      const pending = new Promise((resolve, fail) => {open=resolve;reject=fail;});
      let nativeStarted=false;
      plugin({name:"delayed-native-navigation",setup(build){
        build.onLoad({filter:/altMitteV169DrawnNavigationData\\.ts$/},()=>({loader:"js",contents:
          'export default {parts:[],roofTriangles:[[[0,3,0],[8,5,0],[0,3,8]]]};'}));
        build.onLoad({filter:/altMitteV169NativeNavigationData\\.ts$/},async()=>{
          nativeStarted=true;await pending;
          return {loader:"js",contents:'export default {legacyPrisms:[],nativeRoofCells:[[2,2,9]],nativeRoofSpans:[]};'};
        });
      }});
      const profile=await import(${JSON.stringify(profile)});
      const {publishedNavigationMode}=await import(${JSON.stringify(modeModule)});
      const runtime={lightingMode:"day",voxelWorld:null};
      const voxelModeActive=runtime=>runtime.lightingMode==="minecraft"&&runtime.voxelWorld!==null;
      const callbacks=${JSON.stringify(modeCallbacks)}.map(code=>new Function("runtime","publishedNavigationMode","voxelModeActive","return ("+code+");")(runtime,publishedNavigationMode,voxelModeActive));
      profile.prepareAltMitteV169Navigation();
      const roof=callback=>profile.altMitteV169RoofAt(2,2,callback()==="minecraft");
      const check=value=>{for(const callback of callbacks)if(roof(callback)!==value)throw new Error("Wrong published roof");};
      check(3.5);
      runtime.lightingMode="minecraft";
      let failed=false;
      const loading=profile.preloadAltMitteV169NativeNavigation().catch(error=>{failed=true;});
      for(let n=0;n<20&&!nativeStarted;n++)await new Promise(resolve=>setTimeout(resolve,0));
      if(!nativeStarted)throw new Error("Native import did not start");
      for(let n=0;n<10;n++)check(3.5);
      // Cancellation while an import is in flight retains the drawn roof.
      runtime.lightingMode="night";check(3.5);
      runtime.lightingMode="minecraft";check(3.5);
      if(${fails})reject(new Error("fixture network failure"));else open();
      await loading;
      if(failed!==${fails})throw new Error("Unexpected preload outcome");
      check(3.5);
      if(!failed){runtime.voxelWorld={};check(9);runtime.lightingMode="day";check(3.5);}
      console.log("navigation stayed on the published representation");
    `;
    const result = Bun.spawnSync([process.execPath, "--eval", script]);
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("navigation stayed on the published representation");
  });
}
