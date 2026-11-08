import{$ as e,Et as t,Ht as n,L as r,M as i,O as a,Ut as o,Wt as s,_t as c,at as l,b as u,et as d,f,tt as p,u as m,v as h}from"./three-engine-CtJ9JXFd.js";import{n as g}from"./staticSceneTransforms-lrUlPhzI.js";import{n as _}from"./materialGrade-DHOujStX.js";import{n as v,r as y,t as b}from"./fernsehturmDetailProfile-CD4bbo6B.js";var x=`
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float towerFog = 1. - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float towerFog = smoothstep(fogNear, fogFar, vFogDepth);
      bool towerSubmerged = fogNear <= 4.01 && fogFar <= 240.01;
      // The bright Snow sky and silver/ivory tower otherwise converge before
      // tiny coverage contributions reach the 8-bit composer. Reserve a muted
      // distant silhouette contrast, gradually beyond Snow's opaque fog range.
      // Nearby paint, all other modes and actual submerged fog are unchanged.
      bool towerSnow = abs(fogNear - 540.) < .01 && abs(fogFar - 2250.) < .01;
      float towerSnowDistance = towerSnow ? smoothstep(fogFar, fogFar * 2., vFogDepth) : 0.;
      gl_FragColor.rgb = mix(gl_FragColor.rgb, min(gl_FragColor.rgb, fogColor * .15), towerSnowDistance);
      if (!towerSubmerged) towerFog = min(towerFog, .72);
    #endif
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, towerFog);
  #endif
`,S=new WeakSet;function C(e){if(S.has(e))return;S.add(e);let t=e.onBeforeCompile.bind(e),n=e.customProgramCacheKey();e.onBeforeCompile=(e,n)=>{t(e,n),e.fragmentShader=e.fragmentShader.replace(`#include <fog_fragment>`,x)},e.customProgramCacheKey=()=>`${n}|fernsehturm-horizon-haze-v283`}function w(e,r,i={value:1}){let o=[],c=[],l=[],u=[],p=[],m=new h;for(let t of e){let e=o.length/3;m.setHex(t.color);for(let[e,n]of[[-1,0],[1,0],[1,1],[-1,1]]){let r=n?t.topRadius:t.bottomRadius;o.push(v.x+e*r,v.groundY+(n?t.top:t.bottom),v.z),c.push(t.bottom,t.top,t.bottomRadius,t.topRadius),u.push(e,n),l.push(m.r,m.g,m.b)}p.push(e,e+1,e+2,e,e+2,e+3)}let g=new f;g.setAttribute(`position`,new a(o,3)),g.setAttribute(`coverageProfile`,new a(c,4)),g.setAttribute(`coverageCorner`,new a(u,2)),g.setAttribute(`color`,new a(l,3)),g.setIndex(p),g.computeBoundingBox(),g.computeBoundingSphere();let _=new t({vertexColors:!0,transparent:!0,depthWrite:!1,depthTest:!0,fog:!0,uniforms:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new h(16777215)},coverageViewport:{value:new s(0,0,1,1)},coverageDaylight:i},vertexShader:`
      attribute vec4 coverageProfile;
      attribute vec2 coverageCorner;
      uniform vec4 coverageViewport;
      varying vec3 coverageColor;
      varying vec2 coverageA;
      varying vec2 coverageB;
      varying vec2 coverageC;
      varying vec2 coverageD;
      varying float coverageFade;
      #include <fog_pars_vertex>
      vec2 pixel(vec4 clip) { return (clip.xy / clip.w * .5 + .5) * coverageViewport.zw + coverageViewport.xy; }
      void main() {
        vec4 head = modelViewMatrix * vec4(${v.x}, ${v.groundY+v.sphereCenterHeight}, ${v.z}, 1.0);
        float diameter = ${(v.sphereRadius*2).toFixed(1)} * projectionMatrix[1][1] * coverageViewport.w / max(1., -2. * head.z);
        coverageFade = 1. - smoothstep(.75, 2., diameter);
        // No coverage surface near the camera or behind it. In particular,
        // do not divide near-plane clips by zero while the filter is inactive.
        if (head.z >= -.25 || coverageFade <= 0.) {
          gl_Position = vec4(2., 2., 2., 1.);
          return;
        }
        vec4 lower = modelViewMatrix * vec4(${v.x}, ${v.groundY} + coverageProfile.x, ${v.z}, 1.0);
        vec4 upper = modelViewMatrix * vec4(${v.x}, ${v.groundY} + coverageProfile.y, ${v.z}, 1.0);
        // A view-facing coverage envelope stays centred on the real world axis.
        // Its conservative one-pixel border is transparent outside exact coverage.
        vec4 a = projectionMatrix * (lower + vec4(-coverageProfile.z, 0., 0., 0.));
        vec4 b = projectionMatrix * (lower + vec4( coverageProfile.z, 0., 0., 0.));
        vec4 c = projectionMatrix * (upper + vec4( coverageProfile.w, 0., 0., 0.));
        vec4 d = projectionMatrix * (upper + vec4(-coverageProfile.w, 0., 0., 0.));
        coverageA = pixel(a); coverageB = pixel(b); coverageC = pixel(c); coverageD = pixel(d);
        coverageColor = color;
        vec4 clip = coverageCorner.y > .5 ? (coverageCorner.x > 0. ? c : d) : (coverageCorner.x > 0. ? b : a);
        vec2 center = (coverageA + coverageB + coverageC + coverageD) * .25;
        vec2 edge = pixel(clip) - center;
        vec2 pad = sign(edge);
        clip.xy += pad * 2. / coverageViewport.zw * clip.w;
        gl_Position = clip;
        vec4 mvPosition = mix(lower, upper, coverageCorner.y);
        #include <fog_vertex>
      }
    `,fragmentShader:`
      uniform float coverageDaylight;
      varying vec3 coverageColor;
      varying vec2 coverageA;
      varying vec2 coverageB;
      varying vec2 coverageC;
      varying vec2 coverageD;
      varying float coverageFade;
      #include <fog_pars_fragment>
      // Exact area of a projected quadrilateral intersected with this unit pixel.
      // Integrating coverage keeps tiny geometry visible without a one-pixel width.
      float pixelArea() {
        vec2 points[8]; vec2 next[8]; int count = 4;
        points[0] = coverageA - gl_FragCoord.xy;
        points[1] = coverageB - gl_FragCoord.xy;
        points[2] = coverageC - gl_FragCoord.xy;
        points[3] = coverageD - gl_FragCoord.xy;
        for (int edge = 0; edge < 4; edge++) {
          if (count == 0) return 0.;
          vec2 normal = edge == 0 ? vec2(1.,0.) : edge == 1 ? vec2(-1.,0.) : edge == 2 ? vec2(0.,1.) : vec2(0.,-1.);
          vec2 previous = points[count - 1];
          float previousDistance = dot(previous,normal) + .5;
          int nextCount = 0;
          for (int i = 0; i < 8; i++) {
            if (i >= count) break;
            vec2 current = points[i]; float distance = dot(current,normal) + .5;
            if ((distance >= 0.) != (previousDistance >= 0.)) {
              if (nextCount < 8) next[nextCount++] = mix(previous,current,previousDistance / (previousDistance - distance));
            }
            if (distance >= 0. && nextCount < 8) next[nextCount++] = current;
            previous = current; previousDistance = distance;
          }
          count = nextCount;
          for (int i = 0; i < 8; i++) { if (i >= count) break; points[i] = next[i]; }
        }
        float area = 0.;
        for (int i = 0; i < 8; i++) {
          if (i >= count) break;
          vec2 a = points[i], b = points[i == count - 1 ? 0 : i + 1];
          area += a.x*b.y - a.y*b.x;
        }
        return clamp(abs(area)*.5, 0., 1.);
      }
      void main() {
        float alpha = pixelArea() * coverageFade;
        if (alpha <= .000001) discard;
        vec3 paint = mix(coverageColor * vec3(.42,.49,.60),coverageColor,clamp(coverageDaylight,0.,1.));
        #if defined(USE_FOG) && !defined(FOG_EXP2)
          // Snow's lighting hook is overcast, not nighttime.
          if (fogNear > 4.01 && fogFar <= 2250.01) paint = coverageColor;
        #endif
        gl_FragColor = vec4(paint,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        ${x}
      }
    `}),y=new d(g,_);y.name=r?`Fernsehturm native subpixel coverage`:`Fernsehturm drawn subpixel coverage`,y.userData={fernsehturmHorizonCoverage:!0,textureFree:!0,keepInMinecraft:r,blockNative:r,originalSourceRetained:!0,coverageInterpretation:r?`area-filtered silhouette of native exterior rows`:`area-filtered piecewise silhouette at original dimensions`};let b=_.uniforms.coverageViewport.value,S=new n;return y.onBeforeRender=e=>{e.getCurrentViewport(b),(b.z<=0||b.w<=0)&&(e.getDrawingBufferSize(S),b.set(0,0,S.x,S.y))},y}function T(){let e=[{bottom:0,top:20,bottomRadius:16,topRadius:8,color:12961209},{bottom:20,top:196,bottomRadius:8,topRadius:5.704347826,color:12961209},{bottom:228,top:250,bottomRadius:6.55,topRadius:6.55,color:12105899}],t=e=>Math.sqrt(Math.max(0,256-(e-212)**2));for(let n=196;n<228;n++)e.push({bottom:n,top:n+1,bottomRadius:t(n),topRadius:t(n+1),color:v.windowBands.some(([e,t])=>n+.5>=e&&n+.5<=t)?3755864:10135984});for(let t=0;t<12;t++)e.push({bottom:250+t*118/12,top:250+(t+1)*118/12,bottomRadius:1.45-t/12*1.05,topRadius:1.45-(t+1)/12*1.05,color:t%2?15263450:12872784});return e}function E(e){let t=new Map,n=e=>{let n=t.get(e);return n||(n={add:[],remove:[]},t.set(e,n)),n};for(let t of e)n(t.p[1]-t.s[1]/2).add.push(t),n(t.p[1]+t.s[1]/2).remove.push(t);let r=[...t.keys()].sort((e,t)=>e-t),i=new Set,a=[];for(let e=0;e<r.length-1;e++){let n=r[e],o=r[e+1],s=t.get(n);for(let e of s.remove)i.delete(e);for(let e of s.add)i.add(e);if(o-n<1e-6)continue;let c=0,l=0;for(let e of i){let t=Math.max(Math.abs(e.p[0])+e.s[0]/2,Math.abs(e.p[2])+e.s[2]/2);t>c&&(c=t,l=e.color)}if(c>0){let e=a.at(-1);e&&e.top===n&&e.bottomRadius===c&&e.topRadius===c&&e.color===l?e.top=o:a.push({bottom:n,top:o,bottomRadius:c,topRadius:c,color:l})}}return a}var D=new WeakMap,O=12961209,k=10135984,A=12105899,j=3755864,M=new o(0,1,0),N=e=>v.windowBands.some(([t,n])=>e>=t&&e<=n),P=e=>Math.sqrt(Math.max(0,v.sphereRadius**2-(e-v.sphereCenterHeight)**2));function F(e,t,n){let r=D.get(e);r&&(t instanceof o?r.sun.value.copy(t):r.sun.value.set(t[0],t[1],t[2]),r.sun.value.lengthSq()<1e-10?r.sun.value.set(0,-1,0):r.sun.value.normalize(),r.daylight.value=Math.max(0,Math.min(1,Number.isFinite(n)?n:0)))}function I(e,t){e.name=`Fernsehturm stainless steel, view-dependent sunlight`,e.onBeforeCompile=e=>{e.uniforms.fernsehturmSun=t.sun,e.uniforms.fernsehturmDaylight=t.daylight,e.vertexShader=`varying vec3 vFernsehturmWorld;\n${e.vertexShader}`.replace(`#include <project_vertex>`,`
      vec4 tvVertex = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        tvVertex = instanceMatrix * tvVertex;
      #endif
      vFernsehturmWorld = (modelMatrix * tvVertex).xyz;
      #include <project_vertex>`),e.fragmentShader=`uniform vec3 fernsehturmSun; uniform float fernsehturmDaylight;
      varying vec3 vFernsehturmWorld;\n${e.fragmentShader}`.replace(`#include <opaque_fragment>`,`
      vec3 tvN = normalize(vFernsehturmWorld - vec3(${v.x}, ${v.groundY+v.sphereCenterHeight}, ${v.z}));
      vec3 tvV = normalize(cameraPosition - vFernsehturmWorld);
      vec3 tvSum = tvV + fernsehturmSun;
      float tvHlen = length(tvSum); vec3 tvH = tvSum / max(tvHlen, 0.00001);
      vec3 tvT = vec3(tvH.z, 0.0, -tvH.x); float tvTlen = length(tvT); tvT /= max(tvTlen, 0.00001);
      vec3 tvU = cross(tvH, tvT);
      float tvX = dot(tvN, tvT), tvY = dot(tvN, tvU);
      // Integrate thin distant highlights over a pixel, without changing geometry.
      float tvWidth = max(${v.reflection.narrow}, min(0.095, max(fwidth(tvX), fwidth(tvY)) * 0.65));
      vec2 tvAxisV = vec2(tvX / tvWidth, tvY / ${v.reflection.broad});
      vec2 tvAxisH = vec2(tvX / ${v.reflection.broad}, tvY / tvWidth);
      float tvVertical = exp(-dot(tvAxisV, tvAxisV));
      float tvHorizontal = exp(-dot(tvAxisH, tvAxisH));
      float tvLit = step(0.00001, fernsehturmSun.y) * step(0.00001, dot(tvN, fernsehturmSun)) * step(0.00001, dot(tvN, tvV))
        * step(0.00001, tvHlen) * step(0.00001, tvTlen);
      float tvGrazing = max(0.0, dot(tvN, fernsehturmSun)) * max(0.0, dot(tvN, tvV));
      float tvGlint = max(tvVertical, tvHorizontal) * pow(max(0.0, dot(tvN, tvH)), 12.0) * fernsehturmDaylight * tvLit * tvGrazing * ${v.reflection.strength};
      outgoingLight += vec3(1.0, 0.94, 0.78) * tvGlint;
      #include <opaque_fragment>`)},e.customProgramCacheKey=()=>`fernsehturm-steel-cross-v149`}var L=class{positions=[];normals=[];colours=[];color=new h;triangle(e,t,n,r){let i=new o(...t).sub(new o(...e)).cross(new o(...n).sub(new o(...e))).normalize();this.color.setHex(r);let a=.74+.26*Math.max(0,i.x*-.45+i.y*.72+i.z*.4);for(let r of[e,t,n])this.positions.push(r[0]+v.x,r[1]+v.groundY,r[2]+v.z),this.normals.push(i.x,i.y,i.z),this.colours.push(this.color.r*a,this.color.g*a,this.color.b*a)}append(e,t,n,r){let i=e.index?e.toNonIndexed():e;r&&i.applyQuaternion(r),i.translate(...t);let a=i.getAttribute(`position`);for(let e=0;e<a.count;e+=3)this.triangle([a.getX(e),a.getY(e),a.getZ(e)],[a.getX(e+1),a.getY(e+1),a.getZ(e+1)],[a.getX(e+2),a.getY(e+2),a.getZ(e+2)],n);i.dispose(),i!==e&&e.dispose()}cylinder(e,t,n,r,i,a=64){this.append(new u(r,n,t-e,a),[0,(e+t)/2,0],i)}mesh(e,t=!1){let n=new f;n.setAttribute(`position`,new a(this.positions,3)),n.setAttribute(`normal`,new a(this.normals,3)),n.setAttribute(`color`,new a(this.colours,3)),n.computeBoundingBox(),n.computeBoundingSphere();let r=new p({vertexColors:!0}),i=new l({vertexColors:!0,roughness:t?.28:.72,metalness:.15,emissive:t?12162133:0,emissiveIntensity:t?.6:0}),o=new d(n,r);return o.name=e,o.userData={textureFree:!0,dayMaterial:r,nightMaterial:i},o}};function R(t,n){let i=new m(1,1,1);i.deleteAttribute(`uv`);let a=new p({color:16777215}),s=new r(i,a,t.length),u=new e,d=new c,f=new h,g=new o,_=new o;return t.forEach((e,t)=>{u.compose(g.set(e.p[0]+v.x,e.p[1]+v.groundY,e.p[2]+v.z),e.q??d.setFromAxisAngle(M,e.yaw??0),_.set(...e.s)),s.setMatrixAt(t,u),s.setColorAt(t,f.setHex(e.color))}),s.name=n,s.userData={textureFree:!0,dayMaterial:a,nightMaterial:new l({color:16777215,roughness:.72})},s.computeBoundingBox(),s.computeBoundingSphere(),s}function z(e){let t=new i;t.name=e?y:b;let n={sun:{value:new o(e?760:-760,980,e?-720:720).normalize()},daylight:{value:1}};return D.set(t,n),t.userData={textureFree:!0,keepInMinecraft:e,blockNative:e,originalSourceRetained:!0,sourcePartIds:v.sourcePartIds,sourceConflict:v.sourceConflict,hiddenSolidInfill:!1,publicLevels:[203,207],totalHeight:v.totalHeight,setFernsehturmLighting:(e,n)=>F(t,e,n)},{root:t,state:n}}function B(e,t){let n=e.userData.dayMaterial;I(n,t);let i=_(e,n),a=i.onBeforeCompile.bind(i);i.onBeforeCompile=(e,t)=>{n.onBeforeCompile(e,t),a(e,t)},i.customProgramCacheKey=()=>`fernsehturm-steel-cross-v149-schwellenraum`,e.userData.sunReflectionSurface=!0,e.userData.nightMaterial=new l({vertexColors:!(e instanceof r),color:16777215,roughness:.32,metalness:.45})}function V(e){e.traverse(e=>{if(!(e instanceof d)||!e.userData.dayMaterial)return;let t=e.userData.dayMaterial,n=_(e,t);for(let r of[t,e.userData.nightMaterial,n])C(r)})}function H(e=!1){let{root:t,state:n}=z(!1),r=new L,i=new L,a=new L,s=[];r.cylinder(0,20,16,8,O),r.cylinder(20,250,8,4.5,O);for(let e of[184.5,188.1])r.cylinder(e,e+1.25,7.3,7.3,A),r.cylinder(e+1.25,e+1.65,7.45,7.45,7043452);let l=(e,t,n=0)=>{let r=P(e)+n;return[r*Math.sin(t),e,r*Math.cos(t)]},d=new Set([196,228,...v.windowBands.flat()]);for(let e=1;e<v.shellRows;e++)d.add(196+e*32/v.shellRows);let f=[...d].sort((e,t)=>e-t);for(let e=0;e<f.length-1;e++){let t=f[e],n=f[e+1],r=(t+n)/2,o=N(r),s=o?a:i;for(let e=0;e<v.circumferentialPanels;e++){let i=e*Math.PI*2/64,a=(e+1)*Math.PI*2/64,c=l(t,i),u=l(t,a),d=l(n,a),f=l(n,i),p=l(r,(i+a)/2,o?0:v.panelRelief),m=o?j:k;s.triangle(c,u,p,m),s.triangle(u,d,p,m),s.triangle(d,f,p,m),s.triangle(f,c,p,m)}}for(let[e,t]of v.windowBands){for(let n=0;n<64;n++){let r=n*Math.PI*2/64,i=new o(...l(e,r,.14)),a=new o(...l(t,r,.14)),u=a.clone().sub(i),d=u.length();s.push({p:i.add(a).multiplyScalar(.5).toArray(),s:[.105,d,.13],color:A,q:new c().setFromUnitVectors(M,u.divideScalar(d))})}for(let n of[e,t])r.cylinder(n-.09,n+.09,P(n)+.13,P(n)+.13,A)}for(let e=0;e<=8;e++){let t=228+e*22/8;r.cylinder(t,t+.23,6.55,6.55,A);for(let e=0;e<48;e++){let n=(e+.5)*Math.PI/24;s.push({p:[6.55*Math.sin(n),t+1.24,6.55*Math.cos(n)],s:[2*6.55*Math.sin(Math.PI/48),.075,.075],color:A,yaw:n})}for(let e=0;e<24;e++){let n=e*Math.PI/12;s.push({p:[6.55*Math.sin(n),t+.69,6.55*Math.cos(n)],s:[.085,1.12,.085],color:A})}if(e<8)for(let e=0;e<8;e++){let n=e*Math.PI/4;s.push({p:[6.55*Math.sin(n),t+1.35,6.55*Math.cos(n)],s:[.16,2.75,.16],color:7437436})}}for(let e=0;e<20;e++){let t=e*2.39996323,n=230+e%5*3.65,i=6.97,a=new o(Math.sin(t),.12,Math.cos(t)).normalize(),s=.46+e%3*.17;r.append(new u(s,s,.2,12),[i*Math.sin(t),n,i*Math.cos(t)],14212827,new c().setFromUnitVectors(M,a))}r.cylinder(249.15,250,7.45,7.45,A);for(let e=0;e<12;e++)r.cylinder(250+e*118/12,250+(e+1)*118/12,1.45-e/12*1.05,1.45-(e+1)/12*1.05,e%2?15263450:12872784,24);for(let e of[256,267,285,307,330]){let t=e<270?2.35:1.9;r.cylinder(e,e+.35,t,t,A,24);for(let n=0;n<12;n++){let r=n*Math.PI/6;s.push({p:[t*Math.sin(r),e+.72,t*Math.cos(r)],s:[.075,.9,.075],color:A})}}t.add(r.mesh(`Fernsehturm concrete shaft, open radio balconies, dishes and red-white antenna`));let p=i.mesh(`Fernsehturm raised diamond stainless shell and solar cross`);return B(p,n),t.add(p),t.add(a.mesh(`Fernsehturm observation 203 m and restaurant 207 m window belts`,!0)),t.add(R(s,`Fernsehturm window mullions and open maintenance rails`)),V(t),t.add(w(T(),!1,n.daylight)),g(t)}function U(e=!1){let{root:t,state:n}=z(!0),r=[],i=[],a=[],o=v.nativeCell,s=(e,t,n,r,i,a=o)=>{let s=Math.ceil(r/o),c=o/2;for(let l=-s;l<=s;l++)for(let u=-s;u<=s;u++){let s=l*o,d=u*o,f=Math.hypot(Math.max(0,Math.abs(s)-c),Math.max(0,Math.abs(d)-c)),p=Math.hypot(Math.abs(s)+c,Math.abs(d)+c);f>r||p<Math.max(0,r-a)||e.push({p:[s,t,d],s:[o,n,o],color:i})}};for(let e=0;e<250;e+=o){let t=Math.min(250,e+o),n=(e+t)/2,i=n<=20?16-n*.4:8-(n-20)*3.5/230;(n<196||n>228)&&s(r,n,t-e,i,O)}for(let e=196;e<228;e+=o){let t=Math.min(228,e+o),n=(e+t)/2,r=N(n)?a:i;s(r,n,t-e,P(n),r===a?j:k)}for(let e of[184.5,188.1])s(r,e+.7,1.4,7.3,A);for(let e=0;e<=8;e++){let t=228+e*22/8;s(r,t,.38,6.55,A,.7);for(let e=0;e<16;e++){let n=e*Math.PI/8;r.push({p:[6.55*Math.sin(n),t+.7,6.55*Math.cos(n)],s:[.18,1.1,.18],color:A})}}for(let e=0;e<20;e++){let t=e*2.39996323,n=230+e%5*3.65;r.push({p:[6.9*Math.sin(t),n,6.9*Math.cos(t)],s:[1.1,1.1,1.1],color:14212827})}for(let e=250;e<368;e+=2){let t=Math.min(368,e+2),n=1.45-((e+t)/2-250)/118*1.05;r.push({p:[0,(e+t)/2,0],s:[n*2,t-e,n*2],color:Math.floor((e-250)/(118/12))%2?15263450:12872784})}for(let e of[256,267,285,307,330])s(r,e+.25,.5,e<270?2.35:1.9,A,.6);t.add(R(r,`Fernsehturm native concrete, service and antenna courses`));let c=R(i,`Fernsehturm native stainless shell and solar cross`);B(c,n),t.add(c);let u=R(a,`Fernsehturm native 203 m and 207 m dark window belts`);return u.userData.nightMaterial=new l({color:16777215,roughness:.4,emissive:12162133,emissiveIntensity:.6}),t.add(u),V(t),t.add(w(E([...r,...i,...a]),!0,n.daylight)),t.traverse(e=>{e instanceof d&&(e.userData.blockNative=!0)}),g(t)}export{H as createFernsehturmArchitecture,U as createMinecraftFernsehturmArchitecture,F as updateFernsehturmLighting};