import{Gt as e,Kt as t,M as n,O as r,Ot as i,R as a,b as o,et as s,f as c,nt as l,ot as u,qt as d,tt as f,u as p,v as m,vt as h}from"./three-engine-CNKo5lvV.js";import{n as g}from"./staticSceneTransforms-lrUlPhzI.js";import{r as _}from"./materialGrade-XpNk40fe.js";import{n as v,r as y,t as b}from"./fernsehturmDetailProfile-CD4bbo6B.js";var x=`
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
`,S=new WeakSet;function C(e){if(S.has(e))return;S.add(e);let t=e.onBeforeCompile.bind(e),n=e.customProgramCacheKey();e.onBeforeCompile=(e,n)=>{t(e,n),e.fragmentShader=e.fragmentShader.replace(`#include <fog_fragment>`,x)},e.customProgramCacheKey=()=>`${n}|fernsehturm-horizon-haze-v283`}function w(t,n,a={value:1}){let o=[],s=[],l=[],u=[],p=[],h=new m;for(let e of t){let t=o.length/3;h.setHex(e.color);for(let[t,n]of[[-1,0],[1,0],[1,1],[-1,1]]){let r=n?e.topRadius:e.bottomRadius;o.push(v.x+t*r,v.groundY+(n?e.top:e.bottom),v.z),s.push(e.bottom,e.top,e.bottomRadius,e.topRadius),u.push(t,n),l.push(h.r,h.g,h.b)}p.push(t,t+1,t+2,t,t+2,t+3)}let g=new c;g.setAttribute(`position`,new r(o,3)),g.setAttribute(`coverageProfile`,new r(s,4)),g.setAttribute(`coverageCorner`,new r(u,2)),g.setAttribute(`color`,new r(l,3)),g.setIndex(p),g.computeBoundingBox(),g.computeBoundingSphere();let _=new i({vertexColors:!0,transparent:!0,depthWrite:!1,depthTest:!0,fog:!0,uniforms:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new m(16777215)},coverageViewport:{value:new d(0,0,1,1)},coverageDaylight:a},vertexShader:`
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
    `}),y=new f(g,_);y.name=n?`Fernsehturm native subpixel coverage`:`Fernsehturm drawn subpixel coverage`,y.userData={fernsehturmHorizonCoverage:!0,textureFree:!0,keepInMinecraft:n,blockNative:n,originalSourceRetained:!0,coverageInterpretation:n?`area-filtered silhouette of native exterior rows`:`area-filtered piecewise silhouette at original dimensions`};let b=_.uniforms.coverageViewport.value,S=new e;return y.onBeforeRender=e=>{e.getCurrentViewport(b),(b.z<=0||b.w<=0)&&(e.getDrawingBufferSize(S),b.set(0,0,S.x,S.y))},y}function T(){let e=[{bottom:0,top:20,bottomRadius:16,topRadius:8,color:12961209},{bottom:20,top:196,bottomRadius:8,topRadius:5.704347826,color:12961209},{bottom:228,top:250,bottomRadius:6.55,topRadius:6.55,color:12105899}],t=e=>Math.sqrt(Math.max(0,256-(e-212)**2));for(let n=196;n<228;n++)e.push({bottom:n,top:n+1,bottomRadius:t(n),topRadius:t(n+1),color:v.windowBands.some(([e,t])=>n+.5>=e&&n+.5<=t)?3755864:10135984});for(let t=0;t<12;t++)e.push({bottom:250+t*118/12,top:250+(t+1)*118/12,bottomRadius:1.45-t/12*1.05,topRadius:1.45-(t+1)/12*1.05,color:t%2?15263450:12872784});return e}function E(e){let t=new Map,n=e=>{let n=t.get(e);return n||(n={add:[],remove:[]},t.set(e,n)),n};for(let t of e)n(t.p[1]-t.s[1]/2).add.push(t),n(t.p[1]+t.s[1]/2).remove.push(t);let r=[...t.keys()].sort((e,t)=>e-t),i=new Set,a=[];for(let e=0;e<r.length-1;e++){let n=r[e],o=r[e+1],s=t.get(n);for(let e of s.remove)i.delete(e);for(let e of s.add)i.add(e);if(o-n<1e-6)continue;let c=0,l=0;for(let e of i){let t=Math.max(Math.abs(e.p[0])+e.s[0]/2,Math.abs(e.p[2])+e.s[2]/2);t>c&&(c=t,l=e.color)}if(c>0){let e=a.at(-1);e&&e.top===n&&e.bottomRadius===c&&e.topRadius===c&&e.color===l?e.top=o:a.push({bottom:n,top:o,bottomRadius:c,topRadius:c,color:l})}}return a}var D=new WeakMap,O=12961209,k=10135984,A=12105899,j=3755864,M=new t(0,1,0),N=e=>v.windowBands.some(([t,n])=>e>=t&&e<=n),P=e=>Math.sqrt(Math.max(0,v.sphereRadius**2-(e-v.sphereCenterHeight)**2));function F(e,n,r){let i=D.get(e);i&&(n instanceof t?i.sun.value.copy(n):i.sun.value.set(n[0],n[1],n[2]),i.sun.value.lengthSq()<1e-10?i.sun.value.set(0,-1,0):i.sun.value.normalize(),i.daylight.value=Math.max(0,Math.min(1,Number.isFinite(r)?r:0)))}function I(e,t){e.name=`Fernsehturm stainless steel, view-dependent sunlight`,e.onBeforeCompile=e=>{e.uniforms.fernsehturmSun=t.sun,e.uniforms.fernsehturmDaylight=t.daylight,e.vertexShader=`varying vec3 vFernsehturmWorld;\n${e.vertexShader}`.replace(`#include <project_vertex>`,`
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
      #include <opaque_fragment>`)},e.customProgramCacheKey=()=>`fernsehturm-steel-cross-v149`}var L=class{positions=[];normals=[];colours=[];color=new m;triangle(e,n,r,i){let a=new t(...n).sub(new t(...e)).cross(new t(...r).sub(new t(...e))).normalize();this.color.setHex(i);let o=.74+.26*Math.max(0,a.x*-.45+a.y*.72+a.z*.4);for(let t of[e,n,r])this.positions.push(t[0]+v.x,t[1]+v.groundY,t[2]+v.z),this.normals.push(a.x,a.y,a.z),this.colours.push(this.color.r*o,this.color.g*o,this.color.b*o)}append(e,t,n,r){let i=e.index?e.toNonIndexed():e;r&&i.applyQuaternion(r),i.translate(...t);let a=i.getAttribute(`position`);for(let e=0;e<a.count;e+=3)this.triangle([a.getX(e),a.getY(e),a.getZ(e)],[a.getX(e+1),a.getY(e+1),a.getZ(e+1)],[a.getX(e+2),a.getY(e+2),a.getZ(e+2)],n);i.dispose(),i!==e&&e.dispose()}cylinder(e,t,n,r,i,a=64){this.append(new o(r,n,t-e,a),[0,(e+t)/2,0],i)}mesh(e,t=!1){let n=new c;n.setAttribute(`position`,new r(this.positions,3)),n.setAttribute(`normal`,new r(this.normals,3)),n.setAttribute(`color`,new r(this.colours,3)),n.computeBoundingBox(),n.computeBoundingSphere();let i=new l({vertexColors:!0}),a=new u({vertexColors:!0,roughness:t?.28:.72,metalness:.15,emissive:t?12162133:0,emissiveIntensity:t?.6:0}),o=new f(n,i);return o.name=e,o.userData={textureFree:!0,dayMaterial:i,nightMaterial:a},o}};function R(e,n){let r=new p(1,1,1);r.deleteAttribute(`uv`);let i=new l({color:16777215}),o=new a(r,i,e.length),c=new s,d=new h,f=new m,g=new t,_=new t;return e.forEach((e,t)=>{c.compose(g.set(e.p[0]+v.x,e.p[1]+v.groundY,e.p[2]+v.z),e.q??d.setFromAxisAngle(M,e.yaw??0),_.set(...e.s)),o.setMatrixAt(t,c),o.setColorAt(t,f.setHex(e.color))}),o.name=n,o.userData={textureFree:!0,dayMaterial:i,nightMaterial:new u({color:16777215,roughness:.72})},o.computeBoundingBox(),o.computeBoundingSphere(),o}function z(e){let r=new n;r.name=e?y:b;let i={sun:{value:new t(e?760:-760,980,e?-720:720).normalize()},daylight:{value:1}};return D.set(r,i),r.userData={textureFree:!0,keepInMinecraft:e,blockNative:e,originalSourceRetained:!0,sourcePartIds:v.sourcePartIds,sourceConflict:v.sourceConflict,hiddenSolidInfill:!1,publicLevels:[203,207],totalHeight:v.totalHeight,setFernsehturmLighting:(e,t)=>F(r,e,t)},{root:r,state:i}}function B(e,t){let n=e.userData.dayMaterial;I(n,t);let r=_(e,n),i=r.onBeforeCompile.bind(r);r.onBeforeCompile=(e,t)=>{n.onBeforeCompile(e,t),i(e,t)},r.customProgramCacheKey=()=>`fernsehturm-steel-cross-v149-schwellenraum`,e.userData.sunReflectionSurface=!0,e.userData.nightMaterial=new u({vertexColors:!(e instanceof a),color:16777215,roughness:.32,metalness:.45})}function V(e){e.traverse(e=>{if(!(e instanceof f)||!e.userData.dayMaterial)return;let t=e.userData.dayMaterial,n=_(e,t);for(let r of[t,e.userData.nightMaterial,n])C(r)})}function H(e=!1){let{root:n,state:r}=z(!1),i=new L,a=new L,s=new L,c=[];i.cylinder(0,20,16,8,O),i.cylinder(20,250,8,4.5,O);for(let e of[184.5,188.1])i.cylinder(e,e+1.25,7.3,7.3,A),i.cylinder(e+1.25,e+1.65,7.45,7.45,7043452);let l=(e,t,n=0)=>{let r=P(e)+n;return[r*Math.sin(t),e,r*Math.cos(t)]},u=new Set([196,228,...v.windowBands.flat()]);for(let e=1;e<v.shellRows;e++)u.add(196+e*32/v.shellRows);let d=[...u].sort((e,t)=>e-t);for(let e=0;e<d.length-1;e++){let t=d[e],n=d[e+1],r=(t+n)/2,i=N(r),o=i?s:a;for(let e=0;e<v.circumferentialPanels;e++){let a=e*Math.PI*2/64,s=(e+1)*Math.PI*2/64,c=l(t,a),u=l(t,s),d=l(n,s),f=l(n,a),p=l(r,(a+s)/2,i?0:v.panelRelief),m=i?j:k;o.triangle(c,u,p,m),o.triangle(u,d,p,m),o.triangle(d,f,p,m),o.triangle(f,c,p,m)}}for(let[e,n]of v.windowBands){for(let r=0;r<64;r++){let i=r*Math.PI*2/64,a=new t(...l(e,i,.14)),o=new t(...l(n,i,.14)),s=o.clone().sub(a),u=s.length();c.push({p:a.add(o).multiplyScalar(.5).toArray(),s:[.105,u,.13],color:A,q:new h().setFromUnitVectors(M,s.divideScalar(u))})}for(let t of[e,n])i.cylinder(t-.09,t+.09,P(t)+.13,P(t)+.13,A)}for(let e=0;e<=8;e++){let t=228+e*22/8;i.cylinder(t,t+.23,6.55,6.55,A);for(let e=0;e<48;e++){let n=(e+.5)*Math.PI/24;c.push({p:[6.55*Math.sin(n),t+1.24,6.55*Math.cos(n)],s:[2*6.55*Math.sin(Math.PI/48),.075,.075],color:A,yaw:n})}for(let e=0;e<24;e++){let n=e*Math.PI/12;c.push({p:[6.55*Math.sin(n),t+.69,6.55*Math.cos(n)],s:[.085,1.12,.085],color:A})}if(e<8)for(let e=0;e<8;e++){let n=e*Math.PI/4;c.push({p:[6.55*Math.sin(n),t+1.35,6.55*Math.cos(n)],s:[.16,2.75,.16],color:7437436})}}for(let e=0;e<20;e++){let n=e*2.39996323,r=230+e%5*3.65,a=6.97,s=new t(Math.sin(n),.12,Math.cos(n)).normalize(),c=.46+e%3*.17;i.append(new o(c,c,.2,12),[a*Math.sin(n),r,a*Math.cos(n)],14212827,new h().setFromUnitVectors(M,s))}i.cylinder(249.15,250,7.45,7.45,A);for(let e=0;e<12;e++)i.cylinder(250+e*118/12,250+(e+1)*118/12,1.45-e/12*1.05,1.45-(e+1)/12*1.05,e%2?15263450:12872784,24);for(let e of[256,267,285,307,330]){let t=e<270?2.35:1.9;i.cylinder(e,e+.35,t,t,A,24);for(let n=0;n<12;n++){let r=n*Math.PI/6;c.push({p:[t*Math.sin(r),e+.72,t*Math.cos(r)],s:[.075,.9,.075],color:A})}}n.add(i.mesh(`Fernsehturm concrete shaft, open radio balconies, dishes and red-white antenna`));let f=a.mesh(`Fernsehturm raised diamond stainless shell and solar cross`);return B(f,r),n.add(f),n.add(s.mesh(`Fernsehturm observation 203 m and restaurant 207 m window belts`,!0)),n.add(R(c,`Fernsehturm window mullions and open maintenance rails`)),V(n),n.add(w(T(),!1,r.daylight)),g(n)}function U(e=!1){let{root:t,state:n}=z(!0),r=[],i=[],a=[],o=v.nativeCell,s=(e,t,n,r,i,a=o)=>{let s=Math.ceil(r/o),c=o/2;for(let l=-s;l<=s;l++)for(let u=-s;u<=s;u++){let s=l*o,d=u*o,f=Math.hypot(Math.max(0,Math.abs(s)-c),Math.max(0,Math.abs(d)-c)),p=Math.hypot(Math.abs(s)+c,Math.abs(d)+c);f>r||p<Math.max(0,r-a)||e.push({p:[s,t,d],s:[o,n,o],color:i})}};for(let e=0;e<250;e+=o){let t=Math.min(250,e+o),n=(e+t)/2,i=n<=20?16-n*.4:8-(n-20)*3.5/230;(n<196||n>228)&&s(r,n,t-e,i,O)}for(let e=196;e<228;e+=o){let t=Math.min(228,e+o),n=(e+t)/2,r=N(n)?a:i;s(r,n,t-e,P(n),r===a?j:k)}for(let e of[184.5,188.1])s(r,e+.7,1.4,7.3,A);for(let e=0;e<=8;e++){let t=228+e*22/8;s(r,t,.38,6.55,A,.7);for(let e=0;e<16;e++){let n=e*Math.PI/8;r.push({p:[6.55*Math.sin(n),t+.7,6.55*Math.cos(n)],s:[.18,1.1,.18],color:A})}}for(let e=0;e<20;e++){let t=e*2.39996323,n=230+e%5*3.65;r.push({p:[6.9*Math.sin(t),n,6.9*Math.cos(t)],s:[1.1,1.1,1.1],color:14212827})}for(let e=250;e<368;e+=2){let t=Math.min(368,e+2),n=1.45-((e+t)/2-250)/118*1.05;r.push({p:[0,(e+t)/2,0],s:[n*2,t-e,n*2],color:Math.floor((e-250)/(118/12))%2?15263450:12872784})}for(let e of[256,267,285,307,330])s(r,e+.25,.5,e<270?2.35:1.9,A,.6);t.add(R(r,`Fernsehturm native concrete, service and antenna courses`));let c=R(i,`Fernsehturm native stainless shell and solar cross`);B(c,n),t.add(c);let l=R(a,`Fernsehturm native 203 m and 207 m dark window belts`);return l.userData.nightMaterial=new u({color:16777215,roughness:.4,emissive:12162133,emissiveIntensity:.6}),t.add(l),V(t),t.add(w(E([...r,...i,...a]),!0,n.daylight)),t.traverse(e=>{e instanceof f&&(e.userData.blockNative=!0)}),g(t)}export{H as createFernsehturmArchitecture,U as createMinecraftFernsehturmArchitecture,F as updateFernsehturmLighting};