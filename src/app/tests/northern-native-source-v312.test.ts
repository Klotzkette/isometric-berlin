/** Execute the real completed-native sampler/optional-navigation publication ABI. */
import{expect,test}from"bun:test";
import ts from"typescript";
import{worldGroundSampler}from"../src/terrainPayload";
import type{VoxelPayload}from"../src/MinecraftVoxelWorld";
const viewer=await Bun.file(new URL("../src/ThreeViewer.tsx",import.meta.url)).text(),ast=ts.createSourceFile("ThreeViewer.tsx",viewer,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const loader=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="ensureVoxelWorld");if(!loader)throw Error("Real native loader required");
let block:ts.Block|undefined,index=-1;function walk(node:ts.Node){if(ts.isBlock(node)){const at=node.statements.findIndex(s=>ts.isExpressionStatement(s)&&s.getText(ast)==="(runtime.northernOriginalGroundV309 ??= {}).native = worldGroundSampler(payload);");if(at>=0){if(block)throw Error("Ambiguous native original source publication");block=node;index=at;}}ts.forEachChild(node,walk);}walk(loader);
if(!block||index<0)throw Error("Completed native source capture is missing outside optional navigation");
const conditional=block.statements[index+1];if(!ts.isIfStatement(conditional)||conditional.expression.getText(ast)!=="prisms && runtime.pedestrian.environment === null")throw Error("Native navigation policy changed");
const publication=block.statements.findIndex(s=>s.getText(ast)==="runtime.voxelWorld = provisionalVoxelWorld;");if(publication<=index)throw Error("Native original sampler must precede world publication");
const code=ts.transpileModule(`function prepare(runtime,payload,prisms){let provisionalEnvironment=null;${block.statements[index].getText(ast)}${conditional.getText(ast)}return provisionalEnvironment;}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const payload=await Bun.file(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json",import.meta.url)).json()as VoxelPayload;
for(const warm of[false,true])for(const hasPrisms of[false,true])test(`completed native source uses its real grid with ${warm?"retained Day":"cold native"} navigation and ${hasPrisms?"available":"missing"} prisms`,()=>{
 const drawn=()=>999,oldEnvironment={groundAt:drawn},created={groundAt:()=>-1},runtime={pedestrian:{environment:warm?oldEnvironment:null},northernOriginalGroundV309:{drawn,native:undefined as undefined|((x:number,z:number)=>number|null)}};
 const prisms=hasPrisms?{buildings:[]}:null;let built=0;
 const prepare=new Function("worldGroundSampler","prepareVoxelNavigation",`${code};return prepare;`)(worldGroundSampler,(r:unknown,p:unknown,s:unknown)=>{expect(r).toBe(runtime);expect(p).toBe(payload);expect(s).toBe(prisms);built++;return created;});
 const result=prepare(runtime,payload,prisms),sample=runtime.northernOriginalGroundV309.native!,original=worldGroundSampler(payload);
 expect(typeof sample).toBe("function");expect(sample).not.toBe(drawn);expect(runtime.northernOriginalGroundV309.drawn).toBe(drawn);
 for(const[x,z]of[[950,-3150],[1510,-3328],[20,20],[1e8,1e8]])expect(sample(x,z)).toBe(original(x,z));
 expect(sample(950,-3150)).not.toBe(999);expect(runtime.pedestrian.environment).toBe(warm?oldEnvironment:null);expect(built).toBe(!warm&&hasPrisms?1:0);expect(result).toBe(!warm&&hasPrisms?created:null);
});
