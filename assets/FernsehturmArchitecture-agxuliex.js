import{$ as e,D as t,Ht as n,I as r,Q as i,Tt as a,Ut as o,Vt as s,_ as c,et as l,f as u,gt as d,it as f,j as p,u as m,y as h}from"./three-engine-cMJx6om8.js";import{n as g}from"./staticSceneTransforms-lrUlPhzI.js";import{n as _,r as v,t as y}from"./fernsehturmDetailProfile-CD4bbo6B.js";import{n as b}from"./materialGrade-DypwFicZ.js";var x=`
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
`,S=new WeakSet;function C(e){if(S.has(e))return;S.add(e);let t=e.onBeforeCompile.bind(e),n=e.customProgramCacheKey();e.onBeforeCompile=(e,n)=>{t(e,n),e.fragmentShader=e.fragmentShader.replace(`#include <fog_fragment>`,x)},e.customProgramCacheKey=()=>`${n}|fernsehturm-horizon-haze-v283`}function w(n,r,i={value:1}){let l=[],d=[],f=[],p=[],m=[],h=new c;for(let e of n){let t=l.length/3;h.setHex(e.color);for(let[t,n]of[[-1,0],[1,0],[1,1],[-1,1]]){let r=n?e.topRadius:e.bottomRadius;l.push(_.x+t*r,_.groundY+(n?e.top:e.bottom),_.z),d.push(e.bottom,e.top,e.bottomRadius,e.topRadius),p.push(t,n),f.push(h.r,h.g,h.b)}m.push(t,t+1,t+2,t,t+2,t+3)}let g=new u;g.setAttribute(`position`,new t(l,3)),g.setAttribute(`coverageProfile`,new t(d,4)),g.setAttribute(`coverageCorner`,new t(p,2)),g.setAttribute(`color`,new t(f,3)),g.setIndex(m),g.computeBoundingBox(),g.computeBoundingSphere();let v=new a({vertexColors:!0,transparent:!0,depthWrite:!1,depthTest:!0,fog:!0,uniforms:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new c(16777215)},coverageViewport:{value:new o(0,0,1,1)},coverageDaylight:i},vertexShader:`
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
        vec4 head = modelViewMatrix * vec4(${_.x}, ${_.groundY+_.sphereCenterHeight}, ${_.z}, 1.0);
        float diameter = ${(_.sphereRadius*2).toFixed(1)} * projectionMatrix[1][1] * coverageViewport.w / max(1., -2. * head.z);
        coverageFade = 1. - smoothstep(.75, 2., diameter);
        // No coverage surface near the camera or behind it. In particular,
        // do not divide near-plane clips by zero while the filter is inactive.
        if (head.z >= -.25 || coverageFade <= 0.) {
          gl_Position = vec4(2., 2., 2., 1.);
          return;
        }
        vec4 lower = modelViewMatrix * vec4(${_.x}, ${_.groundY} + coverageProfile.x, ${_.z}, 1.0);
        vec4 upper = modelViewMatrix * vec4(${_.x}, ${_.groundY} + coverageProfile.y, ${_.z}, 1.0);
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
    `}),y=new e(g,v);y.name=r?`Fernsehturm native subpixel coverage`:`Fernsehturm drawn subpixel coverage`,y.userData={fernsehturmHorizonCoverage:!0,textureFree:!0,keepInMinecraft:r,blockNative:r,originalSourceRetained:!0,coverageInterpretation:r?`area-filtered silhouette of native exterior rows`:`area-filtered piecewise silhouette at original dimensions`};let b=v.uniforms.coverageViewport.value,S=new s;return y.onBeforeRender=e=>{e.getCurrentViewport(b),(b.z<=0||b.w<=0)&&(e.getDrawingBufferSize(S),b.set(0,0,S.x,S.y))},y}function T(){let e=[{bottom:0,top:20,bottomRadius:16,topRadius:8,color:12961209},{bottom:20,top:196,bottomRadius:8,topRadius:5.704347826,color:12961209},{bottom:228,top:250,bottomRadius:6.55,topRadius:6.55,color:12105899}],t=e=>Math.sqrt(Math.max(0,256-(e-212)**2));for(let n=196;n<228;n++)e.push({bottom:n,top:n+1,bottomRadius:t(n),topRadius:t(n+1),color:_.windowBands.some(([e,t])=>n+.5>=e&&n+.5<=t)?3755864:10135984});for(let t=0;t<12;t++)e.push({bottom:250+t*118/12,top:250+(t+1)*118/12,bottomRadius:1.45-t/12*1.05,topRadius:1.45-(t+1)/12*1.05,color:t%2?15263450:12872784});return e}function E(e){let t=new Map,n=e=>{let n=t.get(e);return n||(n={add:[],remove:[]},t.set(e,n)),n};for(let t of e)n(t.p[1]-t.s[1]/2).add.push(t),n(t.p[1]+t.s[1]/2).remove.push(t);let r=[...t.keys()].sort((e,t)=>e-t),i=new Set,a=[];for(let e=0;e<r.length-1;e++){let n=r[e],o=r[e+1],s=t.get(n);for(let e of s.remove)i.delete(e);for(let e of s.add)i.add(e);if(o-n<1e-6)continue;let c=0,l=0;for(let e of i){let t=Math.max(Math.abs(e.p[0])+e.s[0]/2,Math.abs(e.p[2])+e.s[2]/2);t>c&&(c=t,l=e.color)}if(c>0){let e=a.at(-1);e&&e.top===n&&e.bottomRadius===c&&e.topRadius===c&&e.color===l?e.top=o:a.push({bottom:n,top:o,bottomRadius:c,topRadius:c,color:l})}}return a}var D=new WeakMap,O=12961209,k=10135984,A=12105899,j=3755864,M=new n(0,1,0),N=e=>_.windowBands.some(([t,n])=>e>=t&&e<=n),P=e=>Math.sqrt(Math.max(0,_.sphereRadius**2-(e-_.sphereCenterHeight)**2));function F(e,t,r){let i=D.get(e);i&&(t instanceof n?i.sun.value.copy(t):i.sun.value.set(t[0],t[1],t[2]),i.sun.value.lengthSq()<1e-10?i.sun.value.set(0,-1,0):i.sun.value.normalize(),i.daylight.value=Math.max(0,Math.min(1,Number.isFinite(r)?r:0)))}function I(e,t){e.name=`Fernsehturm stainless steel, view-dependent sunlight`,e.onBeforeCompile=e=>{e.uniforms.fernsehturmSun=t.sun,e.uniforms.fernsehturmDaylight=t.daylight,e.vertexShader=`varying vec3 vFernsehturmWorld;\n${e.vertexShader}`.replace(`#include <project_vertex>`,`
      vec4 tvVertex = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        tvVertex = instanceMatrix * tvVertex;
      #endif
      vFernsehturmWorld = (modelMatrix * tvVertex).xyz;
      #include <project_vertex>`),e.fragmentShader=`uniform vec3 fernsehturmSun; uniform float fernsehturmDaylight;
      varying vec3 vFernsehturmWorld;\n${e.fragmentShader}`.replace(`#include <opaque_fragment>`,`
      vec3 tvN = normalize(vFernsehturmWorld - vec3(${_.x}, ${_.groundY+_.sphereCenterHeight}, ${_.z}));
      vec3 tvV = normalize(cameraPosition - vFernsehturmWorld);
      vec3 tvSum = tvV + fernsehturmSun;
      float tvHlen = length(tvSum); vec3 tvH = tvSum / max(tvHlen, 0.00001);
      vec3 tvT = vec3(tvH.z, 0.0, -tvH.x); float tvTlen = length(tvT); tvT /= max(tvTlen, 0.00001);
      vec3 tvU = cross(tvH, tvT);
      float tvX = dot(tvN, tvT), tvY = dot(tvN, tvU);
      // Integrate thin distant highlights over a pixel, without changing geometry.
      float tvWidth = max(${_.reflection.narrow}, min(0.095, max(fwidth(tvX), fwidth(tvY)) * 0.65));
      vec2 tvAxisV = vec2(tvX / tvWidth, tvY / ${_.reflection.broad});
      vec2 tvAxisH = vec2(tvX / ${_.reflection.broad}, tvY / tvWidth);
      float tvVertical = exp(-dot(tvAxisV, tvAxisV));
      float tvHorizontal = exp(-dot(tvAxisH, tvAxisH));
      float tvLit = step(0.00001, fernsehturmSun.y) * step(0.00001, dot(tvN, fernsehturmSun)) * step(0.00001, dot(tvN, tvV))
        * step(0.00001, tvHlen) * step(0.00001, tvTlen);
      float tvGrazing = max(0.0, dot(tvN, fernsehturmSun)) * max(0.0, dot(tvN, tvV));
      float tvGlint = max(tvVertical, tvHorizontal) * pow(max(0.0, dot(tvN, tvH)), 12.0) * fernsehturmDaylight * tvLit * tvGrazing * ${_.reflection.strength};
      outgoingLight += vec3(1.0, 0.94, 0.78) * tvGlint;
      #include <opaque_fragment>`)},e.customProgramCacheKey=()=>`fernsehturm-steel-cross-v149`}var L=class{positions=[];normals=[];colours=[];color=new c;triangle(e,t,r,i){let a=new n(...t).sub(new n(...e)).cross(new n(...r).sub(new n(...e))).normalize();this.color.setHex(i);let o=.74+.26*Math.max(0,a.x*-.45+a.y*.72+a.z*.4);for(let n of[e,t,r])this.positions.push(n[0]+_.x,n[1]+_.groundY,n[2]+_.z),this.normals.push(a.x,a.y,a.z),this.colours.push(this.color.r*o,this.color.g*o,this.color.b*o)}append(e,t,n,r){let i=e.index?e.toNonIndexed():e;r&&i.applyQuaternion(r),i.translate(...t);let a=i.getAttribute(`position`);for(let e=0;e<a.count;e+=3)this.triangle([a.getX(e),a.getY(e),a.getZ(e)],[a.getX(e+1),a.getY(e+1),a.getZ(e+1)],[a.getX(e+2),a.getY(e+2),a.getZ(e+2)],n);i.dispose(),i!==e&&e.dispose()}cylinder(e,t,n,r,i,a=64){this.append(new h(r,n,t-e,a),[0,(e+t)/2,0],i)}mesh(n,r=!1){let i=new u;i.setAttribute(`position`,new t(this.positions,3)),i.setAttribute(`normal`,new t(this.normals,3)),i.setAttribute(`color`,new t(this.colours,3)),i.computeBoundingBox(),i.computeBoundingSphere();let a=new l({vertexColors:!0}),o=new f({vertexColors:!0,roughness:r?.28:.72,metalness:.15,emissive:r?12162133:0,emissiveIntensity:r?.6:0}),s=new e(i,a);return s.name=n,s.userData={textureFree:!0,dayMaterial:a,nightMaterial:o},s}};function R(e,t){let a=new m(1,1,1);a.deleteAttribute(`uv`);let o=new l({color:16777215}),s=new r(a,o,e.length),u=new i,p=new d,h=new c,g=new n,v=new n;return e.forEach((e,t)=>{u.compose(g.set(e.p[0]+_.x,e.p[1]+_.groundY,e.p[2]+_.z),e.q??p.setFromAxisAngle(M,e.yaw??0),v.set(...e.s)),s.setMatrixAt(t,u),s.setColorAt(t,h.setHex(e.color))}),s.name=t,s.userData={textureFree:!0,dayMaterial:o,nightMaterial:new f({color:16777215,roughness:.72})},s.computeBoundingBox(),s.computeBoundingSphere(),s}function z(e){let t=new p;t.name=e?v:y;let r={sun:{value:new n(e?760:-760,980,e?-720:720).normalize()},daylight:{value:1}};return D.set(t,r),t.userData={textureFree:!0,keepInMinecraft:e,blockNative:e,originalSourceRetained:!0,sourcePartIds:_.sourcePartIds,sourceConflict:_.sourceConflict,hiddenSolidInfill:!1,publicLevels:[203,207],totalHeight:_.totalHeight,setFernsehturmLighting:(e,n)=>F(t,e,n)},{root:t,state:r}}function B(e,t){let n=e.userData.dayMaterial;I(n,t);let i=b(e,n),a=i.onBeforeCompile.bind(i);i.onBeforeCompile=(e,t)=>{n.onBeforeCompile(e,t),a(e,t)},i.customProgramCacheKey=()=>`fernsehturm-steel-cross-v149-schwellenraum`,e.userData.sunReflectionSurface=!0,e.userData.nightMaterial=new f({vertexColors:!(e instanceof r),color:16777215,roughness:.32,metalness:.45})}function V(t){t.traverse(t=>{if(!(t instanceof e)||!t.userData.dayMaterial)return;let n=t.userData.dayMaterial,r=b(t,n);for(let e of[n,t.userData.nightMaterial,r])C(e)})}function H(e=!1){let{root:t,state:r}=z(!1),i=new L,a=new L,o=new L,s=[];i.cylinder(0,20,16,8,O),i.cylinder(20,250,8,4.5,O);for(let e of[184.5,188.1])i.cylinder(e,e+1.25,7.3,7.3,A),i.cylinder(e+1.25,e+1.65,7.45,7.45,7043452);let c=(e,t,n=0)=>{let r=P(e)+n;return[r*Math.sin(t),e,r*Math.cos(t)]},l=new Set([196,228,..._.windowBands.flat()]);for(let e=1;e<_.shellRows;e++)l.add(196+e*32/_.shellRows);let u=[...l].sort((e,t)=>e-t);for(let e=0;e<u.length-1;e++){let t=u[e],n=u[e+1],r=(t+n)/2,i=N(r),s=i?o:a;for(let e=0;e<_.circumferentialPanels;e++){let a=e*Math.PI*2/64,o=(e+1)*Math.PI*2/64,l=c(t,a),u=c(t,o),d=c(n,o),f=c(n,a),p=c(r,(a+o)/2,i?0:_.panelRelief),m=i?j:k;s.triangle(l,u,p,m),s.triangle(u,d,p,m),s.triangle(d,f,p,m),s.triangle(f,l,p,m)}}for(let[e,t]of _.windowBands){for(let r=0;r<64;r++){let i=r*Math.PI*2/64,a=new n(...c(e,i,.14)),o=new n(...c(t,i,.14)),l=o.clone().sub(a),u=l.length();s.push({p:a.add(o).multiplyScalar(.5).toArray(),s:[.105,u,.13],color:A,q:new d().setFromUnitVectors(M,l.divideScalar(u))})}for(let n of[e,t])i.cylinder(n-.09,n+.09,P(n)+.13,P(n)+.13,A)}for(let e=0;e<=8;e++){let t=228+e*22/8;i.cylinder(t,t+.23,6.55,6.55,A);for(let e=0;e<48;e++){let n=(e+.5)*Math.PI/24;s.push({p:[6.55*Math.sin(n),t+1.24,6.55*Math.cos(n)],s:[2*6.55*Math.sin(Math.PI/48),.075,.075],color:A,yaw:n})}for(let e=0;e<24;e++){let n=e*Math.PI/12;s.push({p:[6.55*Math.sin(n),t+.69,6.55*Math.cos(n)],s:[.085,1.12,.085],color:A})}if(e<8)for(let e=0;e<8;e++){let n=e*Math.PI/4;s.push({p:[6.55*Math.sin(n),t+1.35,6.55*Math.cos(n)],s:[.16,2.75,.16],color:7437436})}}for(let e=0;e<20;e++){let t=e*2.39996323,r=230+e%5*3.65,a=6.97,o=new n(Math.sin(t),.12,Math.cos(t)).normalize(),s=.46+e%3*.17;i.append(new h(s,s,.2,12),[a*Math.sin(t),r,a*Math.cos(t)],14212827,new d().setFromUnitVectors(M,o))}i.cylinder(249.15,250,7.45,7.45,A);for(let e=0;e<12;e++)i.cylinder(250+e*118/12,250+(e+1)*118/12,1.45-e/12*1.05,1.45-(e+1)/12*1.05,e%2?15263450:12872784,24);for(let e of[256,267,285,307,330]){let t=e<270?2.35:1.9;i.cylinder(e,e+.35,t,t,A,24);for(let n=0;n<12;n++){let r=n*Math.PI/6;s.push({p:[t*Math.sin(r),e+.72,t*Math.cos(r)],s:[.075,.9,.075],color:A})}}t.add(i.mesh(`Fernsehturm concrete shaft, open radio balconies, dishes and red-white antenna`));let f=a.mesh(`Fernsehturm raised diamond stainless shell and solar cross`);return B(f,r),t.add(f),t.add(o.mesh(`Fernsehturm observation 203 m and restaurant 207 m window belts`,!0)),t.add(R(s,`Fernsehturm window mullions and open maintenance rails`)),V(t),t.add(w(T(),!1,r.daylight)),g(t)}function U(t=!1){let{root:n,state:r}=z(!0),i=[],a=[],o=[],s=_.nativeCell,c=(e,t,n,r,i,a=s)=>{let o=Math.ceil(r/s),c=s/2;for(let l=-o;l<=o;l++)for(let u=-o;u<=o;u++){let o=l*s,d=u*s,f=Math.hypot(Math.max(0,Math.abs(o)-c),Math.max(0,Math.abs(d)-c)),p=Math.hypot(Math.abs(o)+c,Math.abs(d)+c);f>r||p<Math.max(0,r-a)||e.push({p:[o,t,d],s:[s,n,s],color:i})}};for(let e=0;e<250;e+=s){let t=Math.min(250,e+s),n=(e+t)/2,r=n<=20?16-n*.4:8-(n-20)*3.5/230;(n<196||n>228)&&c(i,n,t-e,r,O)}for(let e=196;e<228;e+=s){let t=Math.min(228,e+s),n=(e+t)/2,r=N(n)?o:a;c(r,n,t-e,P(n),r===o?j:k)}for(let e of[184.5,188.1])c(i,e+.7,1.4,7.3,A);for(let e=0;e<=8;e++){let t=228+e*22/8;c(i,t,.38,6.55,A,.7);for(let e=0;e<16;e++){let n=e*Math.PI/8;i.push({p:[6.55*Math.sin(n),t+.7,6.55*Math.cos(n)],s:[.18,1.1,.18],color:A})}}for(let e=0;e<20;e++){let t=e*2.39996323,n=230+e%5*3.65;i.push({p:[6.9*Math.sin(t),n,6.9*Math.cos(t)],s:[1.1,1.1,1.1],color:14212827})}for(let e=250;e<368;e+=2){let t=Math.min(368,e+2),n=1.45-((e+t)/2-250)/118*1.05;i.push({p:[0,(e+t)/2,0],s:[n*2,t-e,n*2],color:Math.floor((e-250)/(118/12))%2?15263450:12872784})}for(let e of[256,267,285,307,330])c(i,e+.25,.5,e<270?2.35:1.9,A,.6);n.add(R(i,`Fernsehturm native concrete, service and antenna courses`));let l=R(a,`Fernsehturm native stainless shell and solar cross`);B(l,r),n.add(l);let u=R(o,`Fernsehturm native 203 m and 207 m dark window belts`);return u.userData.nightMaterial=new f({color:16777215,roughness:.4,emissive:12162133,emissiveIntensity:.6}),n.add(u),V(n),n.add(w(E([...i,...a,...o]),!0,r.daylight)),n.traverse(t=>{t instanceof e&&(t.userData.blockNative=!0)}),g(n)}export{H as createFernsehturmArchitecture,U as createMinecraftFernsehturmArchitecture,F as updateFernsehturmLighting};