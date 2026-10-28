import { describe, expect, test } from "bun:test";
import { BufferGeometry, Color, Frustum, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, ShaderLib, ShaderMaterial, Vector3, Vector4 } from "three";
import { createFernsehturmArchitecture, createMinecraftFernsehturmArchitecture, updateFernsehturmLighting } from "../src/FernsehturmArchitecture";
import { FERNSEHTURM_DETAIL_PROFILE as P } from "../src/fernsehturmDetailProfile";
import { nativeFernsehturmCoverageBands } from "../src/FernsehturmHorizon";
import { WORLD_ORBIT_BASE_DISTANCE_M, worldCameraFarM } from "../src/worldCameraDepth";

type Point = [number, number];
// Independent numerical oracle: convex quad clipped to a unit pixel. The
// browser test exercises the real GLSL and single-sample + SMAA pipeline.
function areaInPixel(polygon: Point[], x: number, y: number): number {
  let points = polygon.map(([a,b])=>[a-x,b-y] as Point);
  for (const [nx,ny] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    if (!points.length) return 0;
    const next: Point[]=[];
    let previous=points.at(-1)!, previousDistance=previous[0]*nx+previous[1]*ny+.5;
    for (const current of points) {
      const distance=current[0]*nx+current[1]*ny+.5;
      if ((distance>=0)!==(previousDistance>=0)) {
        const t=previousDistance/(previousDistance-distance);
        next.push([previous[0]+(current[0]-previous[0])*t,previous[1]+(current[1]-previous[1])*t]);
      }
      if (distance>=0) next.push(current);
      previous=current; previousDistance=distance;
    }
    expect(next.length).toBeLessThanOrEqual(8);
    points=next;
  }
  return Math.abs(points.reduce((sum,a,i)=>{
    const b=points[(i+1)%points.length];return sum+a[0]*b[1]-a[1]*b[0];
  },0))*.5;
}

function coverageMesh(root: ReturnType<typeof createFernsehturmArchitecture>) {
  let found: Mesh<BufferGeometry,ShaderMaterial> | undefined;
  root.traverse(o=>{if (o instanceof Mesh && o.userData.fernsehturmHorizonCoverage) found=o as Mesh<BufferGeometry,ShaderMaterial>;});
  expect(found).toBeDefined();return found!;
}

describe("Fernsehturm horizon area coverage",()=>{
  for (const native of [false,true]) test(`bounded filter preserves complete ${native?"native":"drawn"} geometry and depth`,()=>{
    const create=native?createMinecraftFernsehturmArchitecture:createFernsehturmArchitecture;
    const root=create(), mesh=coverageMesh(root), geometry=mesh.geometry;
    expect(mesh.frustumCulled).toBeTrue();
    expect(mesh.renderOrder).toBe(0);
    expect(mesh.castShadow).toBeFalse();
    expect(mesh.receiveShadow).toBeFalse();
    expect(mesh.material.depthTest).toBeTrue();
    expect(mesh.material.depthWrite).toBeFalse();
    expect(mesh.material.transparent).toBeTrue();
    expect(geometry.attributes.uv).toBeUndefined();
    const bytes=Object.values(geometry.attributes).reduce((n,a)=>n+a.array.byteLength,geometry.index!.array.byteLength);
    expect(bytes).toBe(native ? 25_500 : 9_588);
    expect(geometry.attributes.position.count / 4).toBe(native ? 125 : 47);
    expect(geometry.boundingBox!.min.y).toBeCloseTo(P.groundY,3);
    expect(geometry.boundingBox!.max.y).toBeCloseTo(P.groundY+368,3);
    expect(geometry.boundingBox!.max.x-P.x).toBeLessThan(17.4);
    expect(mesh.material.vertexShader).toContain("1. - smoothstep(.75, 2., diameter)");
    expect(mesh.material.vertexShader).toContain("float diameter = 32.0 * projectionMatrix");
    expect(mesh.material.vertexShader).toContain("if (head.z >= -.25 || coverageFade <= 0.)");
    expect(mesh.material.fragmentShader).toContain("pixelArea() * coverageFade");
    expect(mesh.material.fragmentShader).toContain("if (nextCount < 8)");
    expect(mesh.material.vertexShader).not.toContain("gl_Position.z =");
    expect(mesh.material.fragmentShader).not.toContain("gl_FragDepth");
    let originals=0, originalInstances=0;
    root.traverse(o=>{
      if (!(o instanceof Mesh) || o===mesh) return;
      originals++; if(o instanceof InstancedMesh) originalInstances+=o.count;
      expect(o.visible).toBeTrue();
      for (const material of [o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial]) {
        const shader={vertexShader:ShaderLib.basic.vertexShader,fragmentShader:ShaderLib.basic.fragmentShader,uniforms:{}};
        material.onBeforeCompile(shader,{});
        expect(shader.fragmentShader).toContain("if (!towerSubmerged) towerFog = min(towerFog, .72)");
        expect(shader.fragmentShader).toContain("fogNear <= 4.01 && fogFar <= 240.01");
        expect(shader.fragmentShader).toContain("abs(fogNear - 540.) < .01 && abs(fogFar - 2250.) < .01");
        expect(shader.fragmentShader).toContain("smoothstep(fogFar, fogFar * 2., vFogDepth)");
        expect(shader.fragmentShader).toContain("min(gl_FragColor.rgb, fogColor * .15)");
        expect(shader.fragmentShader).not.toContain("coverageFade");
      }
    });
    expect(originals).toBe(native?3:4);expect(originalInstances).toBe(native?11831:900);
    updateFernsehturmLighting(root,[0,1,0],.45);
    expect(mesh.material.uniforms.coverageDaylight.value).toBe(.45);
    const mobile=coverageMesh(create(true));
    expect(Array.from(mobile.geometry.attributes.coverageProfile.array)).toEqual(Array.from(geometry.attributes.coverageProfile.array));
  });

  test("native profile reads independent stepped block rows, including gaps and overlaps",()=>{
    const rows=nativeFernsehturmCoverageBands([
      {p:[0,1,0],s:[2,2,2],color:1},
      {p:[0,1,0],s:[4,1,4],color:2},
      {p:[0,4,0],s:[1,2,1],color:3},
    ]);
    expect(rows).toEqual([
      {bottom:0,top:.5,bottomRadius:1,topRadius:1,color:1},
      {bottom:.5,top:1.5,bottomRadius:2,topRadius:2,color:2},
      {bottom:1.5,top:2,bottomRadius:1,topRadius:1,color:1},
      {bottom:3,top:5,bottomRadius:.5,topRadius:.5,color:3},
    ]);
  });

  test("native coverage joins only contiguous equal-radius equal-colour rows",()=>{
    expect(nativeFernsehturmCoverageBands([
      {p:[0,.5,0],s:[2,1,2],color:1},
      {p:[0,1.5,0],s:[2,1,2],color:1},
      {p:[0,2.5,0],s:[2,1,2],color:2},
      {p:[0,3.5,0],s:[4,1,4],color:2},
      {p:[0,5.5,0],s:[4,1,4],color:2},
    ])).toEqual([
      {bottom:0,top:2,bottomRadius:1,topRadius:1,color:1},
      {bottom:2,top:3,bottomRadius:1,topRadius:1,color:2},
      {bottom:3,top:4,bottomRadius:2,topRadius:2,color:2},
      {bottom:5,top:6,bottomRadius:2,topRadius:2,color:2},
    ]);
  });

  test("native BER coverage survives unsigned-byte blending through fractional-pixel pans",()=>{
    const mesh=coverageMesh(createMinecraftFernsehturmArchitecture());
    const profile=mesh.geometry.attributes.coverageProfile;
    const color=mesh.geometry.attributes.color;
    // The offscreen composer uses linear working colour and unsigned bytes.
    // BER lies before native fog begins; this checks the filter independently
    // of occasional original-geometry raster hits and subsequent SMAA.
    const sky=new Color(0xdcf3f9).toArray().map(c=>Math.round(c*255));
    for(const dpr of [1,1.35,1.75]) {
      const width=Math.floor(568*dpr),height=Math.floor(224*dpr);
      const camera=new PerspectiveCamera(66,568/224,.25,91000);
      camera.position.set(8820,80,17260);
      camera.lookAt(P.x,P.groundY+212,P.z);
      camera.updateMatrixWorld();
      const head=new Vector4(P.x,P.groundY+212,P.z,1).applyMatrix4(camera.matrixWorldInverse);
      const diameter=32*camera.projectionMatrix.elements[5]*height/(-2*head.z);
      expect(diameter).toBeLessThan(.75);
      const bands:{quad:Point[];paint:number[]}[]=[];
      for(let i=0;i<profile.count;i+=4) {
        const bottom=profile.getX(i),top=profile.getY(i);
        const rb=profile.getZ(i),rt=profile.getW(i);
        bands.push({
          paint:[color.getX(i),color.getY(i),color.getZ(i)],
          quad:[[-rb,bottom],[rb,bottom],[rt,top],[-rt,top]].map(([r,y])=>{
            const v=new Vector4(P.x,P.groundY+y,P.z,1).applyMatrix4(camera.matrixWorldInverse);
            v.x+=r;
            v.applyMatrix4(camera.projectionMatrix);
            return [(v.x/v.w*.5+.5)*width,(v.y/v.w*.5+.5)*height] as Point;
          }),
        });
      }
      for(let phase=0;phase<10;phase++) {
        const pixels=new Map<string,number[]>();
        for(const {quad,paint} of bands) {
          const shifted=quad.map(([x,y])=>[x+phase*.1*dpr,y] as Point);
          const xs=shifted.map(p=>p[0]),ys=shifted.map(p=>p[1]);
          for(let x=Math.floor(Math.min(...xs));x<=Math.floor(Math.max(...xs));x++)
            for(let y=Math.floor(Math.min(...ys));y<=Math.floor(Math.max(...ys));y++) {
              const alpha=areaInPixel(shifted,x+.5,y+.5);
              if(alpha<=.000001)continue;
              const key=`${x}:${y}`,old=pixels.get(key)??sky;
              pixels.set(key,paint.map((c,i)=>Math.round(c*255*alpha+old[i]*(1-alpha))));
            }
        }
        let maximumContrast=0;
        for(const pixel of pixels.values())
          maximumContrast=Math.max(maximumContrast,...pixel.map((v,i)=>Math.abs(v-sky[i])));
        expect(maximumContrast).toBeGreaterThanOrEqual(9);
      }
    }
  });

  test("distant Snow preserves a byte-level coverage contribution without changing its alpha",()=>{
    // BER 568x320/16 degrees: approximately .02 pixel area per globe strip.
    // Before the contrast adjustment, the sample rounds back to the already
    // quantized sky in the unsigned-byte composer; stronger contrast survives.
    const sky=.52, silver=.38, fog=.72, alpha=.02;
    const storedSky=Math.round(sky*255)/255;
    const compositeByte=(paint:number)=>Math.round(255*(storedSky+(paint*(1-fog)+sky*fog-storedSky)*alpha));
    expect(compositeByte(silver)).toBe(Math.round(sky*255));
    expect(compositeByte(Math.min(silver,sky*.15))).toBeLessThan(Math.round(sky*255));
  });

  test("subpixel area survives fractional-pixel pans at all four outer-city viewpoints",()=>{
    const mesh=coverageMesh(createFernsehturmArchitecture());
    const profile=mesh.geometry.attributes.coverageProfile;
    const positions=[[8820,80,17260],[-8900,115,2220],[-11550,70,-2120],[12000,90,-2400]];
    for (const position of positions) for (const [width,height] of [[568,224],[390,465]]) {
      const camera=new PerspectiveCamera(66,width/height,.25,worldCameraFarM(WORLD_ORBIT_BASE_DISTANCE_M));
      camera.position.fromArray(position);camera.lookAt(P.x,P.groundY+212,P.z);camera.updateMatrixWorld();
      const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
      expect(frustum.intersectsObject(mesh)).toBeTrue();
      const quads:Point[][]=[];
      for(let i=0;i<profile.count;i+=4){
        const bottom=profile.getX(i),top=profile.getY(i),rb=profile.getZ(i),rt=profile.getW(i);
        quads.push([[-rb,bottom],[rb,bottom],[rt,top],[-rt,top]].map(([r,y])=>{
          const v=new Vector4(P.x,P.groundY+y,P.z,1).applyMatrix4(camera.matrixWorldInverse);v.x+=r;v.applyMatrix4(camera.projectionMatrix);
          return [(v.x/v.w*.5+.5)*width,(v.y/v.w*.5+.5)*height] as Point;
        }));
      }
      let baseline=0;
      for(let phase=0;phase<10;phase++) {
        let sum=0;
        for(const quad of quads){
          const shifted=quad.map(([x,y])=>[x+phase*.1,y+phase*.07] as Point);
          const xs=shifted.map(p=>p[0]),ys=shifted.map(p=>p[1]);
          for(let x=Math.floor(Math.min(...xs));x<=Math.floor(Math.max(...xs));x++)
            for(let y=Math.floor(Math.min(...ys));y<=Math.floor(Math.max(...ys));y++)sum+=areaInPixel(shifted,x+.5,y+.5);
        }
        expect(sum).toBeGreaterThan(.1);
        if(phase===0)baseline=sum;else expect(sum).toBeCloseTo(baseline,7);
      }
    }
  });
});
