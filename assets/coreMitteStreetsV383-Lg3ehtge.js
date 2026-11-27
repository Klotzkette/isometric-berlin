import{a as e}from"./index-fowiMR5a.js";import{N as t}from"./three-engine-BJKQgvdU.js";import{t as n}from"./_rolldown_dynamic_import_helper-CIAwlR2T.js";import{attachWorldSpaceDetail as r}from"./attachWorldSpaceDetail-DKBdG8CE.js";import{createSurveySurfaceV380 as i}from"./prenzlauerStreetsV380-BzJ5N-OT.js";function a(e){e.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`#include <common>`,`
      #include <common>
      attribute float jointSize;
      varying vec3 mittePaving;
    `).replace(`#include <begin_vertex>`,`
      #include <begin_vertex>
      mittePaving = vec3(position.xz, jointSize);
    `),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`
      #include <common>
      varying vec3 mittePaving;
      float mitteGrain(vec2 cell) {
        vec3 p = fract(vec3(cell.xyx) * .1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
    `).replace(`#include <color_fragment>`,`
      #include <color_fragment>
      float finish = mittePaving.z;
      if (finish > .97) {
        vec2 g = mittePaving.xy / .11;
        vec2 f = fract(g);
        f = f*f*(3.-2.*f);
        float grain = mix(mix(mitteGrain(floor(g)),mitteGrain(floor(g)+vec2(1.,0.)),f.x),
            mix(mitteGrain(floor(g)+vec2(0.,1.)),mitteGrain(floor(g)+vec2(1.)),f.x),f.y);
        float fade = 1.-smoothstep(.25,1.,max(fwidth(g.x),fwidth(g.y)));
        diffuseColor.rgb *= 1.+(grain-.5)*.12*fade;
      } else if (finish>.02) {
        bool palace = abs(finish-.91)<.01;
        mat2 grid = palace ? mat2(.812,.584,-.584,.812) : mat2(.9966,.0825,-.0825,.9966);
        float stone = palace ? .23 : finish;
        vec2 q = grid*mittePaving.xy / vec2(stone,stone*(stone>.30?.68:.82));
        vec2 width = max(fwidth(q), vec2(.003));
        q.x += mod(floor(q.y),2.)*.5;
        vec2 edge = .5-abs(fract(q)-.5);
        vec2 inside = smoothstep(vec2(.018)-width*.5,vec2(.023)+width*.5,edge);
        float joint = (1.-min(inside.x,inside.y))*(1.-smoothstep(.15,.85,max(width.x,width.y)));
        diffuseColor.rgb *= 1.-.19*joint;
      }
    `)},e.customProgramCacheKey=()=>`mitte-survey-stone-and-gravel-v383`}function o(e,n){let r=new t;r.name=`Vermessene Straßen und Platzränder der historischen Mitte`,r.userData={coreMitteStreetsV383:!0,nativeMinecraft:n,keepInMinecraft:n};let o=i(e,`Fahrbahnen, abgesenkte Borde und Gehwegbeläge`);return a(o.userData.dayMaterial),a(o.userData.nightMaterial),r.add(o),r}async function s(t,i,a,s){s?.throwIfAborted();let c=i.slice(16),{default:l}=await n(Object.assign({"./data/coreMitteStreetsV383/1_0.json":()=>e(()=>import(`./1_0-CVelumIs.js`),[],import.meta.url),"./data/coreMitteStreetsV383/1_1.json":()=>e(()=>import(`./1_1-CmNc1YNo.js`),[],import.meta.url),"./data/coreMitteStreetsV383/2_0.json":()=>e(()=>import(`./2_0-DhIZpt4M.js`),[],import.meta.url),"./data/coreMitteStreetsV383/2_1.json":()=>e(()=>import(`./2_1-CEnwcBlS.js`),[],import.meta.url),"./data/coreMitteStreetsV383/3_0.json":()=>e(()=>import(`./3_0-Dto7_1-h.js`),[],import.meta.url),"./data/coreMitteStreetsV383/3_1.json":()=>e(()=>import(`./3_1-SsMBbXFg.js`),[],import.meta.url),"./data/coreMitteStreetsV383/4_0.json":()=>e(()=>import(`./4_0-5Bm8dnVO.js`),[],import.meta.url)}),`./data/coreMitteStreetsV383/${c}.json`,4);s?.throwIfAborted(),r(t,o(l,a))}export{s as attachCoreMitteStreetsV383};