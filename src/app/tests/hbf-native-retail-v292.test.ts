import { describe, expect, test } from "bun:test";
import { Group, InstancedMesh, Matrix4, Raycaster, Vector3 } from "three";
import ts from "typescript";
import { createMinecraftArchitecturalLandmarks } from "../src/MinecraftArchitecturalLandmarks";
import { createHbfInteriorV291, HBF_INTERIOR_V291 } from "../src/HbfInteriorV291";
import { HBF_CIRCULATION_V291, hbfLocalToWorldV291 } from "../src/HbfCirculationV291";
import { createParliamentInteriorsV295 } from "../src/ParliamentInteriorsV295";
import { parliamentSourceOwnersAdmittedV295 } from "../src/ParliamentRetainedEnvelopeV295";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

const legacy=createMinecraftArchitecturalLandmarks(),opened=createMinecraftArchitecturalLandmarks({hbfRetailV292:true});
const interior=createHbfInteriorV291({native:true,...HBF_CIRCULATION_V291.frame}),combined=new Group();
combined.add(interior,opened);combined.updateMatrixWorld(true);legacy.updateMatrixWorld(true);
const angle=HBF_CIRCULATION_V291.frame.rotationDegrees*Math.PI/180,axis=new Vector3(Math.cos(angle),0,-Math.sin(angle));
const oldStation=legacy.getObjectByName("Minecraft Berlin Hauptbahnhof block signature") as InstancedMesh;
const newStation=opened.getObjectByName(oldStation.name) as InstancedMesh;
const voxelSource=ts.createSourceFile("MinecraftVoxelWorld.ts",await Bun.file(new URL("../src/MinecraftVoxelWorld.ts",import.meta.url)).text(),ts.ScriptTarget.Latest,true);
const parliamentIds=new Set(["UbQkgNZe","ycOYQRVL","K0002MCN","eaCxS2u2"]);
const parliamentPrisms=(await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url)).json()).buildings.filter((p:{id:string})=>parliamentIds.has(p.id));

describe("complete native Hauptbahnhof retail visibility v292",()=>{
  test("the actual native-world transaction attaches the complete real interior before enabling retail cuts, and preserves failure ordering",()=>{
    const factory=voxelSource.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="buildMinecraftVoxelWorldSteps") as ts.FunctionDeclaration;
    expect(factory?.body).toBeDefined();
    const statements=[...factory.body!.statements];
    const calls=(node:ts.Node,name:string):boolean=>{
      if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text===name)return true;
      return ts.forEachChild(node,child=>calls(child,name)?true:undefined)===true;
    };
    const attachIndex=statements.findIndex(node=>calls(node,"createHbfInteriorV291"));
    const legacyIndex=statements.findIndex(node=>calls(node,"createMinecraftArchitecturalLandmarks"));
    expect(attachIndex).toBeGreaterThanOrEqual(0);expect(legacyIndex).toBeGreaterThan(attachIndex);
    // Already in baseline 0f617436, the v295 source admission and complete
    // parliament interior precede the legacy factory between these two stages.
    // Assert all three actual intervening statements rather than moving a
    // numerical expected index or allowing unrelated allocations/yields.
    const intervening=statements.slice(attachIndex+1,legacyIndex);
    expect(intervening.map(node=>node.kind)).toEqual([ts.SyntaxKind.VariableStatement,ts.SyntaxKind.IfStatement,ts.SyntaxKind.ExpressionStatement]);
    expect(calls(intervening[0],"parliamentSourceOwnersAdmittedV295")).toBe(true);
    expect(calls(intervening[1],"createParliamentInteriorsV295")).toBe(true);
    expect(intervening[2].getText(voxelSource)).toBe("group.userData.parliamentInteriorsV295 = parliamentInteriorsV295;");
    // Execute these exact production statements with all three real factories.
    // The observer checks ownership at the instant the legacy factory starts;
    // merely constructing the interior or adding it later cannot pass.
    const text=statements.slice(attachIndex,legacyIndex+2).map(node=>node.getText(voxelSource)).join("\n");
    const compiled=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    const run=new Function("group","createHbfInteriorV291","createMinecraftArchitecturalLandmarks","HBF_CIRCULATION_V291","options","parliamentSourceOwnersAdmittedV295","createParliamentInteriorsV295",compiled);
    for(const scenario of["disabled","missing","changed","complete","fail-hbf","fail-parliament","fail-legacy"]as const) {
      const staged=new Group();let actualInterior:Group|undefined,actualParliament:Group|undefined,actualLegacy:Group|undefined,legacyCalls=0,parliamentCalls=0;
      const shouldAdmit=["complete","fail-parliament","fail-legacy","fail-hbf"].includes(scenario);
      const options={parliamentInteriorsV295:scenario!=="disabled",sourcePrisms:scenario==="missing"?[]:scenario==="changed"?parliamentPrisms.map((p:{h_dm:number})=>({...p,h_dm:p.h_dm+1})):parliamentPrisms};
      const makeInterior=(placement:Parameters<typeof createHbfInteriorV291>[0])=>{
        if(scenario==="fail-hbf")throw new Error("Interior construction failed");
        actualInterior=createHbfInteriorV291(placement);return actualInterior;
      };
      const makeParliament=(placement:Parameters<typeof createParliamentInteriorsV295>[0])=>{
        parliamentCalls++;expect(actualInterior?.parent).toBe(staged);expect(staged.children).toEqual([actualInterior!]);
        if(scenario==="fail-parliament")throw Error("Parliament construction failed");
        actualParliament=createParliamentInteriorsV295(placement);return actualParliament;
      };
      const makeLegacy=(options:Parameters<typeof createMinecraftArchitecturalLandmarks>[0])=>{
        legacyCalls++;expect(actualInterior?.parent).toBe(staged);
        expect(staged.children).toContain(actualInterior!);
        expect(actualInterior!.userData.nativeMinecraft).toBeTrue();
        expect(actualInterior!.userData.shops).toHaveLength(16);
        expect(actualInterior!.children.length).toBeGreaterThan(0);
        expect(options?.hbfRetailV292).toBeTrue();
        expect(options?.parliamentInteriorsV295).toBe(shouldAdmit);
        expect(staged.userData.parliamentInteriorsV295).toBe(shouldAdmit);
        if(shouldAdmit){expect(actualParliament?.parent).toBe(staged);expect(actualParliament!.children.length).toBeGreaterThan(0);}
        if(scenario==="fail-legacy")throw Error("Legacy architecture failed");
        actualLegacy=createMinecraftArchitecturalLandmarks(options);return actualLegacy;
      };
      const execute=()=>run(staged,makeInterior,makeLegacy,HBF_CIRCULATION_V291,options,parliamentSourceOwnersAdmittedV295,makeParliament);
      try{
        if(scenario==="fail-hbf"){
          expect(execute).toThrow("Interior construction failed");expect(legacyCalls).toBe(0);expect(parliamentCalls).toBe(0);expect(staged.children).toHaveLength(0);
        }else if(scenario==="fail-parliament"){
          expect(execute).toThrow("Parliament construction failed");expect(legacyCalls).toBe(0);expect(parliamentCalls).toBe(1);expect(staged.children).toEqual([actualInterior!]);
        }else if(scenario==="fail-legacy"){
          expect(execute).toThrow("Legacy architecture failed");expect(legacyCalls).toBe(1);expect(staged.children).toEqual([actualInterior!,actualParliament!]);
        }else{
          execute();expect(legacyCalls).toBe(1);expect(parliamentCalls).toBe(shouldAdmit?1:0);
          expect(staged.children).toEqual([actualInterior!,...(shouldAdmit?[actualParliament!]:[]),actualLegacy!]);
        }
      }finally{disposeSurroundingCityRoot(staged);}
    }
  });

  test("the default legacy factory and other six models retain their exact instances within the same 5500 cap",()=>{
    const defaults=createMinecraftArchitecturalLandmarks({hbfRetailV292:false});
    expect(oldStation.count).toBe(2486);
    for(let i=0;i<legacy.children.length;i++) {
      const old=legacy.children[i] as InstancedMesh,unchanged=defaults.children[i] as InstancedMesh,next=opened.children[i] as InstancedMesh;
      expect(Array.from(unchanged.instanceMatrix.array)).toEqual(Array.from(old.instanceMatrix.array));
      expect(Array.from(unchanged.instanceColor!.array)).toEqual(Array.from(old.instanceColor!.array));
      if(old===oldStation)continue;
      expect(next.count).toBe(old.count);
      expect(Array.from(next.instanceMatrix.array)).toEqual(Array.from(old.instanceMatrix.array));
      expect(Array.from(next.instanceColor!.array)).toEqual(Array.from(old.instanceColor!.array));
    }
    expect(opened.children.reduce((n,o)=>n+(o as InstancedMesh).count,0)).toBeLessThan(5500);
    expect(opened.children).toHaveLength(7);
  });

  test("all flowers and every current storefront are actually visible in the combined old-plus-new native geometry",()=>{
    let flowers=0,fronts=0,oldBlockers=0;
    const shops=[...HBF_INTERIOR_V291.shops,{id:"einstein",edge:-1}];
    for(const mesh of interior.children)if(mesh instanceof InstancedMesh)for(let i=0;i<mesh.count;i++) {
      const role=mesh.userData.roles[i] as string;
      const shop=shops.find(s=>role.startsWith(`shop:${s.id}:`));
      if(!shop||!(role.endsWith(":fascia")||role.endsWith(":lettering")||role.endsWith(":recess")||role==="shop:blumen-roewer:flower-blossom"))continue;
      const matrix=new Matrix4();mesh.getMatrixAt(i,matrix);const centre=new Vector3().setFromMatrixPosition(matrix);
      const ray=new Raycaster(centre.clone().addScaledVector(axis,-shop.edge*4),axis.clone().multiplyScalar(shop.edge),0,4.1);
      if(ray.intersectObject(oldStation,false).some(hit=>hit.distance<4))oldBlockers++;
      const first=ray.intersectObject(combined,true)[0];
      expect(first,role).toBeDefined();
      expect(first.object===newStation,role).toBeFalse();
      expect(first.object.parent===interior,role).toBeTrue();
      if(role.endsWith(":flower-blossom"))flowers++;else fronts++;
    }
    expect(flowers).toBe(24);expect(fronts).toBeGreaterThan(200);expect(oldBlockers).toBeGreaterThan(24);
  });

  test("retail openings preserve opaque wall fragments above and between the actual bays",()=>{
    let checked=0;
    for(const side of[-1,1])for(const z of[-87,-73.5,-60.5,-43,0,87])for(const y of[1,5.3,8.8,18,30]) {
      const point=new Vector3(...hbfLocalToWorldV291([side*19.2,y,z]));
      const ray=new Raycaster(point.clone().addScaledVector(axis,-side*2),axis.clone().multiplyScalar(side),0,4);
      const old=ray.intersectObject(oldStation,false)[0],next=ray.intersectObject(newStation,false)[0];
      if(!old)continue;
      expect(next,`wall ${side},${y},${z}`).toBeDefined();
      expect(next.distance,`wall ${side},${y},${z}`).toBeCloseTo(old.distance,4);checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });
});
