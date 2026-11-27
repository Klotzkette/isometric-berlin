import{At as e,Jt as t,N as n,Yt as r,bt as i,ct as a,d as o,k as s,nt as c,p as l,qt as u,rt as d,tt as f,x as p,y as m,z as h}from"./three-engine-BJKQgvdU.js";import{n as g}from"./staticSceneTransforms-lrUlPhzI.js";import{l as _}from"./schlossEastProfile-DvCLre6m.js";import{r as v}from"./materialGrade-Cp-X-vC7.js";import{n as y,r as b,t as x}from"./fernsehturmDetailProfile-Bbw4yXuG.js";var S=`
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
`,C=new WeakSet;function w(e){if(C.has(e))return;C.add(e);let t=e.onBeforeCompile.bind(e),n=e.customProgramCacheKey();e.onBeforeCompile=(e,n)=>{t(e,n),e.fragmentShader=e.fragmentShader.replace(`#include <fog_fragment>`,S)},e.customProgramCacheKey=()=>`${n}|fernsehturm-horizon-haze-v283`}function T(t,n,i={value:1}){let a=[],o=[],d=[],f=[],p=[],h=new m;for(let e of t){let t=a.length/3;h.setHex(e.color),e.color===12961209&&h.multiplyScalar(.88);for(let[t,n]of[[-1,0],[1,0],[1,1],[-1,1]]){let r=n?e.topRadius:e.bottomRadius;a.push(y.x+t*r,y.groundY+(n?e.top:e.bottom),y.z),o.push(e.bottom,e.top,e.bottomRadius,e.topRadius),f.push(t,n),d.push(h.r,h.g,h.b)}p.push(t,t+1,t+2,t,t+2,t+3)}let g=new l;g.setAttribute(`position`,new s(a,3)),g.setAttribute(`coverageProfile`,new s(o,4)),g.setAttribute(`coverageCorner`,new s(f,2)),g.setAttribute(`color`,new s(d,3)),g.setIndex(p),g.computeBoundingBox(),g.computeBoundingSphere();let _=new e({vertexColors:!0,transparent:!0,depthWrite:!1,depthTest:!0,fog:!0,uniforms:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new m(16777215)},coverageViewport:{value:new r(0,0,1,1)},coverageDaylight:i},vertexShader:`
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
        vec4 head = modelViewMatrix * vec4(${y.x}, ${y.groundY+y.sphereCenterHeight}, ${y.z}, 1.0);
        float diameter = ${(y.sphereRadius*2).toFixed(1)} * projectionMatrix[1][1] * coverageViewport.w / max(1., -2. * head.z);
        coverageFade = 1. - smoothstep(.75, 2., diameter);
        // No coverage surface near the camera or behind it. In particular,
        // do not divide near-plane clips by zero while the filter is inactive.
        if (head.z >= -.25 || coverageFade <= 0.) {
          gl_Position = vec4(2., 2., 2., 1.);
          return;
        }
        vec4 lower = modelViewMatrix * vec4(${y.x}, ${y.groundY} + coverageProfile.x, ${y.z}, 1.0);
        vec4 upper = modelViewMatrix * vec4(${y.x}, ${y.groundY} + coverageProfile.y, ${y.z}, 1.0);
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
        ${S}
      }
    `}),v=new c(g,_);v.name=n?`Fernsehturm native subpixel coverage`:`Fernsehturm drawn subpixel coverage`,v.userData={fernsehturmHorizonCoverage:!0,textureFree:!0,keepInMinecraft:n,blockNative:n,originalSourceRetained:!0,coverageInterpretation:n?`area-filtered silhouette of native exterior rows`:`area-filtered piecewise silhouette at original dimensions`};let b=_.uniforms.coverageViewport.value,x=new u;return v.onBeforeRender=e=>{e.getCurrentViewport(b),(b.z<=0||b.w<=0)&&(e.getDrawingBufferSize(x),b.set(0,0,x.x,x.y))},v}function E(){let e=[{bottom:0,top:20,bottomRadius:16,topRadius:8,color:12961209},{bottom:20,top:196,bottomRadius:y.shaftBottomRadius,topRadius:y.shaftTopRadius,color:12961209},{bottom:228,top:250,bottomRadius:6.55,topRadius:6.55,color:12105899}],t=e=>Math.sqrt(Math.max(0,256-(e-212)**2));for(let n=196;n<228;n++)e.push({bottom:n,top:n+1,bottomRadius:t(n),topRadius:t(n+1),color:y.windowBands.some(([e,t])=>n+.5>=e&&n+.5<=t)?3755864:10135984});for(let t=0;t<12;t++)e.push({bottom:250+t*118/12,top:250+(t+1)*118/12,bottomRadius:1.45-t/12*1.05,topRadius:1.45-(t+1)/12*1.05,color:t%2?15263450:12872784});return e}function D(e){let t=new Map,n=e=>{let n=t.get(e);return n||(n={add:[],remove:[]},t.set(e,n)),n};for(let t of e)n(t.p[1]-t.s[1]/2).add.push(t),n(t.p[1]+t.s[1]/2).remove.push(t);let r=[...t.keys()].sort((e,t)=>e-t),i=new Set,a=[];for(let e=0;e<r.length-1;e++){let n=r[e],o=r[e+1],s=t.get(n);for(let e of s.remove)i.delete(e);for(let e of s.add)i.add(e);if(o-n<1e-6)continue;let c=0,l=0;for(let e of i){let t=Math.max(Math.abs(e.p[0])+e.s[0]/2,Math.abs(e.p[2])+e.s[2]/2);t>c&&(c=t,l=e.color)}if(c>0){let e=a.at(-1);e&&e.top===n&&e.bottomRadius===c&&e.topRadius===c&&e.color===l?e.top=o:a.push({bottom:n,top:o,bottomRadius:c,topRadius:c,color:l})}}return a}var O=new WeakMap,k=12961209,A=10135984,j=12105899,M=3755864,N=new t(0,1,0),P=e=>y.windowBands.some(([t,n])=>e>=t&&e<=n),F=e=>Math.sqrt(Math.max(0,y.sphereRadius**2-(e-y.sphereCenterHeight)**2));function I(e,n,r){let i=O.get(e);i&&(n instanceof t?i.sun.value.copy(n):i.sun.value.set(n[0],n[1],n[2]),i.sun.value.lengthSq()<1e-10?i.sun.value.set(0,-1,0):i.sun.value.normalize(),i.daylight.value=Math.max(0,Math.min(1,Number.isFinite(r)?r:0)))}function L(e,t){e.name=`Fernsehturm stainless steel, view-dependent sunlight`,e.onBeforeCompile=e=>{e.uniforms.fernsehturmSun=t.sun,e.uniforms.fernsehturmDaylight=t.daylight,e.vertexShader=`varying vec3 vFernsehturmWorld;\n${e.vertexShader}`.replace(`#include <project_vertex>`,`
      vec4 tvVertex = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        tvVertex = instanceMatrix * tvVertex;
      #endif
      vFernsehturmWorld = (modelMatrix * tvVertex).xyz;
      #include <project_vertex>`),e.fragmentShader=`uniform vec3 fernsehturmSun; uniform float fernsehturmDaylight;
      varying vec3 vFernsehturmWorld;\n${e.fragmentShader}`.replace(`#include <opaque_fragment>`,`
      vec3 tvN = normalize(vFernsehturmWorld - vec3(${y.x}, ${y.groundY+y.sphereCenterHeight}, ${y.z}));
      vec3 tvV = normalize(cameraPosition - vFernsehturmWorld);
      vec3 tvSum = tvV + fernsehturmSun;
      float tvHlen = length(tvSum); vec3 tvH = tvSum / max(tvHlen, 0.00001);
      vec3 tvT = vec3(tvH.z, 0.0, -tvH.x); float tvTlen = length(tvT); tvT /= max(tvTlen, 0.00001);
      vec3 tvU = cross(tvH, tvT);
      float tvX = dot(tvN, tvT), tvY = dot(tvN, tvU);
      // Integrate thin distant highlights over a pixel, without changing geometry.
      float tvWidth = max(${y.reflection.narrow}, min(0.095, max(fwidth(tvX), fwidth(tvY)) * 0.65));
      vec2 tvAxisV = vec2(tvX / tvWidth, tvY / ${y.reflection.broad});
      vec2 tvAxisH = vec2(tvX / ${y.reflection.broad}, tvY / tvWidth);
      float tvVertical = exp(-dot(tvAxisV, tvAxisV));
      float tvHorizontal = exp(-dot(tvAxisH, tvAxisH));
      float tvLit = step(0.00001, fernsehturmSun.y) * step(0.00001, dot(tvN, fernsehturmSun)) * step(0.00001, dot(tvN, tvV))
        * step(0.00001, tvHlen) * step(0.00001, tvTlen);
      float tvGrazing = max(0.0, dot(tvN, fernsehturmSun)) * max(0.0, dot(tvN, tvV));
      float tvGlint = max(tvVertical, tvHorizontal) * pow(max(0.0, dot(tvN, tvH)), 12.0) * fernsehturmDaylight * tvLit * tvGrazing * ${y.reflection.strength};
      outgoingLight += vec3(1.0, 0.94, 0.78) * tvGlint;
      #include <opaque_fragment>`)},e.customProgramCacheKey=()=>`fernsehturm-steel-cross-v149`}var R=class{positions=[];normals=[];colours=[];color=new m;edge=new t;otherEdge=new t;triangle(e,t,n,r){let i=this.edge.set(t[0]-e[0],t[1]-e[1],t[2]-e[2]).cross(this.otherEdge.set(n[0]-e[0],n[1]-e[1],n[2]-e[2])).normalize();this.color.setHex(r);let a=.74+.26*Math.max(0,i.x*-.45+i.y*.72+i.z*.4);for(let r of[e,t,n])this.positions.push(r[0]+y.x,r[1]+y.groundY,r[2]+y.z),this.normals.push(i.x,i.y,i.z),this.colours.push(this.color.r*a,this.color.g*a,this.color.b*a)}append(e,t,n,r){let i=e.index?e.toNonIndexed():e;r&&i.applyQuaternion(r),i.translate(...t);let a=i.getAttribute(`position`);for(let e=0;e<a.count;e+=3)this.triangle([a.getX(e),a.getY(e),a.getZ(e)],[a.getX(e+1),a.getY(e+1),a.getZ(e+1)],[a.getX(e+2),a.getY(e+2),a.getZ(e+2)],n);i.dispose(),i!==e&&e.dispose()}cylinder(e,t,n,r,i,a=64,o=!1){this.append(new p(r,n,t-e,a,1,o),[0,(e+t)/2,0],i)}mesh(e,t=!1){let n=new l;n.setAttribute(`position`,new s(this.positions,3)),n.setAttribute(`normal`,new s(this.normals,3)),n.setAttribute(`color`,new s(this.colours,3)),n.computeBoundingBox(),n.computeBoundingSphere();let r=new d({vertexColors:!0}),i=new a({vertexColors:!0,roughness:t?.28:.72,metalness:.15,emissive:t?12162133:0,emissiveIntensity:t?.6:0}),o=new c(n,r);return o.name=e,o.userData={textureFree:!0,dayMaterial:r,nightMaterial:i},o}};function z(e,n){let r=new o(1,1,1);r.deleteAttribute(`uv`);let s=new d({color:16777215}),c=new h(r,s,e.length),l=new f,u=new i,p=new m,g=new t,_=new t;return e.forEach((e,t)=>{l.compose(g.set(e.p[0]+y.x,e.p[1]+y.groundY,e.p[2]+y.z),e.q??u.setFromAxisAngle(N,e.yaw??0),_.set(...e.s)),c.setMatrixAt(t,l),c.setColorAt(t,p.setHex(e.color))}),c.name=n,c.userData={textureFree:!0,dayMaterial:s,nightMaterial:new a({color:16777215,roughness:.72})},c.computeBoundingBox(),c.computeBoundingSphere(),c}function B(e){let r=new n;r.name=e?b:x;let i={sun:{value:new t(e?760:-760,980,e?-720:720).normalize()},daylight:{value:1}};return O.set(r,i),r.userData={textureFree:!0,keepInMinecraft:e,blockNative:e,originalSourceRetained:!0,sourcePartIds:y.sourcePartIds,sourceConflict:y.sourceConflict,hiddenSolidInfill:!1,publicLevels:[203,207],totalHeight:y.totalHeight,setFernsehturmLighting:(e,t)=>I(r,e,t)},{root:r,state:i}}function V(e,t){let n=e.userData.dayMaterial;L(n,t);let r=v(e,n),i=r.onBeforeCompile.bind(r);r.onBeforeCompile=(e,t)=>{n.onBeforeCompile(e,t),i(e,t)},r.customProgramCacheKey=()=>`fernsehturm-steel-cross-v149-schwellenraum`,e.userData.sunReflectionSurface=!0,e.userData.nightMaterial=new a({vertexColors:!(e instanceof h),color:16777215,roughness:.32,metalness:.45})}function H(e){e.traverse(e=>{if(!(e instanceof c)||!e.userData.dayMaterial)return;let t=e.userData.dayMaterial,n=v(e,t);for(let r of[t,e.userData.nightMaterial,n])w(r)})}function U(e=!1){let{root:n,state:r}=B(!1),a=new R,o=new R,s=new R,c=[];a.cylinder(0,20,16,8,k);let l=y.sphereCenterHeight-y.sphereRadius;a.cylinder(y.footFlareHeight,l,y.shaftBottomRadius,y.shaftTopRadius,k,64,!0),a.cylinder(l,y.shaftTopHeight,y.shaftTopRadius,y.shaftTopRadius,k,64,!0);for(let e of[184.5,188.1])a.cylinder(e,e+1.25,7.3,7.3,j),a.cylinder(e+1.25,e+1.65,7.45,7.45,7043452);let u=(e,t,n=0)=>{let r=F(e)+n;return[r*Math.sin(t),e,r*Math.cos(t)]},d=new Set([196,228,...y.windowBands.flat()]);for(let e=1;e<y.shellRows;e++)d.add(196+e*32/y.shellRows);let f=[...d].sort((e,t)=>e-t);for(let e=0;e<f.length-1;e++){let t=f[e],n=f[e+1],r=(t+n)/2,i=P(r),a=i?s:o;for(let e=0;e<y.circumferentialPanels;e++){let o=e*Math.PI*2/64,s=(e+1)*Math.PI*2/64,c=u(t,o),l=u(t,s),d=u(n,s),f=u(n,o),p=u(r,(o+s)/2,i?0:y.panelRelief),m=i?M:A;a.triangle(c,l,p,m),a.triangle(l,d,p,m),a.triangle(d,f,p,m),a.triangle(f,c,p,m)}}for(let[e,n]of y.windowBands){for(let r=0;r<64;r++){let a=r*Math.PI*2/64,o=new t(...u(e,a,.14)),s=new t(...u(n,a,.14)),l=s.clone().sub(o),d=l.length();c.push({p:o.add(s).multiplyScalar(.5).toArray(),s:[.105,d,.13],color:j,q:new i().setFromUnitVectors(N,l.divideScalar(d))})}for(let t of[e,n])a.cylinder(t-.09,t+.09,F(t)+.13,F(t)+.13,j)}for(let e=0;e<=8;e++){let t=228+e*22/8;a.cylinder(t,t+.23,6.55,6.55,j);for(let e=0;e<48;e++){let n=(e+.5)*Math.PI/24;c.push({p:[6.55*Math.sin(n),t+1.24,6.55*Math.cos(n)],s:[2*6.55*Math.sin(Math.PI/48),.075,.075],color:j,yaw:n})}for(let e=0;e<24;e++){let n=e*Math.PI/12;c.push({p:[6.55*Math.sin(n),t+.69,6.55*Math.cos(n)],s:[.085,1.12,.085],color:j})}if(e<8)for(let e=0;e<8;e++){let n=e*Math.PI/4;c.push({p:[6.55*Math.sin(n),t+1.35,6.55*Math.cos(n)],s:[.16,2.75,.16],color:7437436})}}for(let e=0;e<20;e++){let n=e*2.39996323,r=230+e%5*3.65,o=6.97,s=new t(Math.sin(n),.12,Math.cos(n)).normalize(),c=.46+e%3*.17;a.append(new p(c,c,.2,12),[o*Math.sin(n),r,o*Math.cos(n)],14212827,new i().setFromUnitVectors(N,s))}a.cylinder(249.15,250,7.45,7.45,j);for(let e=0;e<12;e++)a.cylinder(250+e*118/12,250+(e+1)*118/12,1.45-e/12*1.05,1.45-(e+1)/12*1.05,e%2?15263450:12872784,24);for(let e of[256,267,285,307,330]){let t=e<270?2.35:1.9;a.cylinder(e,e+.35,t,t,j,24);for(let n=0;n<12;n++){let r=n*Math.PI/6;c.push({p:[t*Math.sin(r),e+.72,t*Math.cos(r)],s:[.075,.9,.075],color:j})}}n.add(a.mesh(`Fernsehturm concrete shaft, open radio balconies, dishes and red-white antenna`));let m=o.mesh(`Fernsehturm raised diamond stainless shell and solar cross`);return V(m,r),n.add(m),n.add(s.mesh(`Fernsehturm observation 203 m and restaurant 207 m window belts`,!0)),n.add(z(c,`Fernsehturm window mullions and open maintenance rails`)),H(n),n.add(T(E(),!1,r.daylight)),g(n)}function W(e=!1){let{root:t,state:n}=B(!0),r=[],i=[],o=[],s=y.nativeCell,l=(e,t,n,r,i,a=s)=>{let o=Math.ceil(r/s),c=s/2;for(let l=-o;l<=o;l++)for(let u=-o;u<=o;u++){let o=l*s,d=u*s,f=Math.hypot(Math.max(0,Math.abs(o)-c),Math.max(0,Math.abs(d)-c)),p=Math.hypot(Math.abs(o)+c,Math.abs(d)+c);f>r||p<Math.max(0,r-a)||e.push({p:[o,t,d],s:[s,n,s],color:i})}};for(let e=0;e<250;e+=s){let t=Math.min(250,e+s),n=(e+t)/2,i=_(n);(n<196||n>228)&&l(r,n,t-e,i,k)}for(let e=196;e<228;e+=s){let t=Math.min(228,e+s),n=(e+t)/2,r=P(n)?o:i;l(r,n,t-e,F(n),r===o?M:A)}for(let e of[184.5,188.1])l(r,e+.7,1.4,7.3,j);for(let e=0;e<=8;e++){let t=228+e*22/8;l(r,t,.38,6.55,j,.7);for(let e=0;e<16;e++){let n=e*Math.PI/8;r.push({p:[6.55*Math.sin(n),t+.7,6.55*Math.cos(n)],s:[.18,1.1,.18],color:j})}}for(let e=0;e<20;e++){let t=e*2.39996323,n=230+e%5*3.65;r.push({p:[6.9*Math.sin(t),n,6.9*Math.cos(t)],s:[1.1,1.1,1.1],color:14212827})}for(let e=250;e<368;e+=2){let t=Math.min(368,e+2),n=1.45-((e+t)/2-250)/118*1.05;r.push({p:[0,(e+t)/2,0],s:[n*2,t-e,n*2],color:Math.floor((e-250)/(118/12))%2?15263450:12872784})}for(let e of[256,267,285,307,330])l(r,e+.25,.5,e<270?2.35:1.9,j,.6);t.add(z(r,`Fernsehturm native concrete, service and antenna courses`));let u=z(i,`Fernsehturm native stainless shell and solar cross`);V(u,n),t.add(u);let d=z(o,`Fernsehturm native 203 m and 207 m dark window belts`);return d.userData.nightMaterial=new a({color:16777215,roughness:.4,emissive:12162133,emissiveIntensity:.6}),t.add(d),H(t),t.add(T(D([...r,...i,...o]),!0,n.daylight)),t.traverse(e=>{e instanceof c&&(e.userData.blockNative=!0)}),g(t)}export{U as createFernsehturmArchitecture,W as createMinecraftFernsehturmArchitecture,I as updateFernsehturmLighting};